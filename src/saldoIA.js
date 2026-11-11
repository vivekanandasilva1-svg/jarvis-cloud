// Indicador de saldo da IA (creditos da Anthropic). A API da Anthropic NAO tem endpoint que devolva o
// saldo pre-pago (so o Console mostra, em Plans & Billing) - entao o saldo aqui e uma ESTIMATIVA:
// o dono informa quanto tem (ex.: ao recarregar) e a cada chamada de IA o app desconta o custo real,
// calculado pelos tokens que a propria Anthropic devolve em cada resposta (entrada, saida, cache) x a
// tabela de precos abaixo. Quando o saldo estimado cai abaixo do limite escolhido, avisa o dono no
// WhatsApp (sem usar IA) ANTES de zerar. A chave da Anthropic e unica da plataforma (serve todos os
// clientes), entao o saldo e da plataforma e so o super_admin ve/edita - nao e por tenant.
import crypto from 'node:crypto';
import { pool } from './db.js';
import * as whatsappInstances from './whatsappInstances.js';
import { enviarMensagemTexto } from './evolutionApi.js';

// US$ por milhao de tokens: entrada, saida, escrita de cache de 5 min, escrita de cache de 1h, leitura de cache.
// Fonte: platform.claude.com/docs/en/about-claude/pricing (conferido em 2026-10-19).
// Haiku 5.5: valores do prompt ate 100 mil tokens (acima disso o preco e 5x - o app nunca chega la).
const PRECOS = {
  'claude-sonnet-5': { entrada: 2, saida: 10, cacheEscrita: 2.5, cacheEscrita1h: 4, cacheLeitura: 0.2 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10, cacheEscrita: 2.5, cacheEscrita1h: 4, cacheLeitura: 0.1 },
  'claude-haiku-4-5': { entrada: 1, saida: 5, cacheEscrita: 1.25, cacheEscrita1h: 2, cacheLeitura: 0.1 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5, cacheEscrita: 0.125, cacheEscrita1h: 0.2, cacheLeitura: 0.01 },
  'claude-opus-5-5': { entrada: 4, saida: 20, cacheEscrita: 5, cacheEscrita1h: 8, cacheLeitura: 0.2 },
  'claude-fable-5-1': { entrada: 10, saida: 50, cacheEscrita: 12.5, cacheEscrita1h: 20, cacheLeitura: 0.25 },
};
const PRECO_PADRAO = PRECOS['claude-sonnet-5']; // modelo desconhecido: estima como o modelo que o app mais usa

const INTERVALO_AVISO_MS = 12 * 60 * 60 * 1000;
let ultimoAvisoRam = 0;

const tabelasProntas = pool ? (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ia_saldo (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      saldo_usd NUMERIC(12,4),
      informado_em TIMESTAMPTZ,
      limite_alerta_usd NUMERIC(12,2) NOT NULL DEFAULT 5,
      aviso_baixo_em TIMESTAMPTZ
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ia_uso (
      hora TIMESTAMPTZ NOT NULL,
      modelo TEXT NOT NULL,
      chamadas INTEGER NOT NULL DEFAULT 0,
      tokens_entrada BIGINT NOT NULL DEFAULT 0,
      tokens_saida BIGINT NOT NULL DEFAULT 0,
      tokens_cache_escrita BIGINT NOT NULL DEFAULT 0,
      tokens_cache_leitura BIGINT NOT NULL DEFAULT 0,
      custo_usd NUMERIC(12,6) NOT NULL DEFAULT 0
    )`);
  // atribuicao por cliente/modulo (tenant_id 0 = chamada sem dono identificado)
  await pool.query('ALTER TABLE ia_uso ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 0');
  await pool.query(`ALTER TABLE ia_uso ADD COLUMN IF NOT EXISTS modulo TEXT NOT NULL DEFAULT ''`);
  await pool.query('ALTER TABLE ia_uso DROP CONSTRAINT IF EXISTS ia_uso_pkey');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ia_uso_chave ON ia_uso (hora, modelo, tenant_id, modulo)');
  // historico de tudo que mexe no saldo FORA do consumo automatico: conferencias (dono informa o
  // saldo real do Console), recargas e gastos externos (uso da mesma chave fora do app - testes,
  // ferramentas de desenvolvimento, outros apps). E o que permite medir quanto escapa da conta.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ia_saldo_ajustes (
      id SERIAL PRIMARY KEY,
      em TIMESTAMPTZ NOT NULL DEFAULT now(),
      tipo TEXT NOT NULL,
      valor_usd NUMERIC(12,4) NOT NULL,
      descricao TEXT,
      saldo_estimado_antes NUMERIC(12,4),
      saldo_informado NUMERIC(12,4)
    )`);
  await pool.query('INSERT INTO ia_saldo (id) VALUES (1) ON CONFLICT DO NOTHING');
})().catch((err) => console.error('Erro criando tabelas do saldo da IA:', err.message)) : Promise.resolve();

const modelosSemPreco = new Set();
export function custoDaChamada(modelo, usage) {
  if (!PRECOS[modelo] && !modelosSemPreco.has(modelo)) {
    modelosSemPreco.add(modelo);
    console.error(`[saldoIA] modelo "${modelo}" sem preco cadastrado - usando o preco do claude-sonnet-5; adicione em PRECOS pra o saldo nao derivar.`);
  }
  const p = PRECOS[modelo] || PRECO_PADRAO;
  const n = (v) => Number(v) || 0;
  // escrita de cache: a resposta separa por duracao (5 min x 1 h, a de 1h custa mais); sem essa quebra, tudo vai como 5 min
  const c1h = n(usage?.cache_creation?.ephemeral_1h_input_tokens);
  const escritaTotal = n(usage?.cache_creation_input_tokens);
  const c5m = usage?.cache_creation ? n(usage.cache_creation.ephemeral_5m_input_tokens) : escritaTotal;
  return (
    n(usage?.input_tokens) * p.entrada +
    n(usage?.output_tokens) * p.saida + // tokens de raciocinio (thinking) ja vem somados no output_tokens
    c5m * p.cacheEscrita +
    c1h * p.cacheEscrita1h +
    n(usage?.cache_read_input_tokens) * p.cacheLeitura
  ) / 1e6;
}

// chamado pelo cliente compartilhado a cada resposta da IA - nunca pode derrubar a chamada de quem usa
export async function registrarUso(modelo, usage, dono) {
  if (!pool || !usage) return;
  try {
    await tabelasProntas;
    const custo = custoDaChamada(modelo, usage);
    const n = (v) => Number(v) || 0;
    await pool.query(
      `INSERT INTO ia_uso (hora, modelo, tenant_id, modulo, chamadas, tokens_entrada, tokens_saida, tokens_cache_escrita, tokens_cache_leitura, custo_usd)
       VALUES (date_trunc('hour', now()), $1, $7, $8, 1, $2, $3, $4, $5, $6)
       ON CONFLICT (hora, modelo, tenant_id, modulo) DO UPDATE SET
         chamadas = ia_uso.chamadas + 1,
         tokens_entrada = ia_uso.tokens_entrada + EXCLUDED.tokens_entrada,
         tokens_saida = ia_uso.tokens_saida + EXCLUDED.tokens_saida,
         tokens_cache_escrita = ia_uso.tokens_cache_escrita + EXCLUDED.tokens_cache_escrita,
         tokens_cache_leitura = ia_uso.tokens_cache_leitura + EXCLUDED.tokens_cache_leitura,
         custo_usd = ia_uso.custo_usd + EXCLUDED.custo_usd`,
      [modelo || 'desconhecido', n(usage.input_tokens), n(usage.output_tokens), n(usage.cache_creation_input_tokens), n(usage.cache_read_input_tokens), custo, Number(dono?.tenantId) || 0, String(dono?.modulo || '')],
    );
    const { rows: [s] } = await pool.query(
      'UPDATE ia_saldo SET saldo_usd = saldo_usd - $1 WHERE id = 1 AND saldo_usd IS NOT NULL RETURNING saldo_usd, limite_alerta_usd, aviso_baixo_em',
      [custo],
    );
    if (s && Number(s.saldo_usd) <= Number(s.limite_alerta_usd)) avisarSaldoBaixo(s).catch(() => {});
  } catch (err) {
    console.error('Erro registrando uso da IA:', err.message);
  }
}

async function avisarSaldoBaixo(s) {
  const ultimo = s.aviso_baixo_em ? new Date(s.aviso_baixo_em).getTime() : 0;
  if (Date.now() - Math.max(ultimo, ultimoAvisoRam) < INTERVALO_AVISO_MS) return;
  ultimoAvisoRam = Date.now();
  await pool.query('UPDATE ia_saldo SET aviso_baixo_em = now() WHERE id = 1');
  const { rows } = await pool.query('SELECT id FROM tenants WHERE super_admin = true AND ativo = true');
  const saldo = Math.max(0, Number(s.saldo_usd));
  for (const { id } of rows) {
    try {
      const { numeroAdmin } = await whatsappInstances.obterConfig(id);
      if (!numeroAdmin) continue;
      await enviarMensagemTexto(id, numeroAdmin, `⚠️ Saldo da IA baixo: estimo ~US$ ${saldo.toFixed(2)} restantes na Anthropic (seu alerta é abaixo de US$ ${Number(s.limite_alerta_usd).toFixed(2)}). Recarregue em console.anthropic.com → Plans & Billing antes que acabe e a Lumia pare de responder. Depois de recarregar, atualize o saldo no app (ícone de saldo no topo).`);
    } catch (err) {
      console.error('Erro avisando saldo baixo da IA:', err.message);
    }
  }
}

export async function obterSituacao() {
  if (!pool) return { configurado: false };
  await tabelasProntas;
  const { rows: [s] } = await pool.query('SELECT saldo_usd, informado_em, limite_alerta_usd FROM ia_saldo WHERE id = 1');
  const { rows: [u] } = await pool.query(`
    SELECT
      COALESCE(SUM(custo_usd) FILTER (WHERE hora >= date_trunc('day', now() AT TIME ZONE 'America/Maceio') AT TIME ZONE 'America/Maceio'), 0) AS hoje,
      COALESCE(SUM(custo_usd) FILTER (WHERE hora >= now() - interval '7 days'), 0) AS sete_dias,
      COALESCE(SUM(chamadas) FILTER (WHERE hora >= now() - interval '7 days'), 0) AS chamadas_7d,
      MIN(hora) AS primeiro
    FROM ia_uso`);
  // quanto da entrada dos ultimos 7 dias veio do cache (leitura) - mede se o prompt caching esta funcionando
  const { rows: [c] } = await pool.query(`
    SELECT COALESCE(SUM(tokens_cache_leitura),0) AS lido,
           COALESCE(SUM(tokens_entrada + tokens_cache_escrita + tokens_cache_leitura),0) AS total
    FROM ia_uso WHERE hora >= now() - interval '7 days'`);
  const cachePct = Number(c.total) > 0 ? Math.round((Number(c.lido) / Number(c.total)) * 100) : null;
  const { rows: porCliente } = await pool.query(`
    SELECT u.tenant_id, COALESCE(t.nome, CASE WHEN u.tenant_id = 0 THEN 'Sem dono identificado' ELSE 'Cliente ' || u.tenant_id END) AS nome,
           u.modulo, SUM(u.custo_usd) AS custo, SUM(u.chamadas) AS chamadas
    FROM ia_uso u LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.hora >= now() - interval '7 days'
    GROUP BY u.tenant_id, t.nome, u.modulo ORDER BY custo DESC LIMIT 8`);
  const { rows: ajustes } = await pool.query(`SELECT id, em, tipo, valor_usd, descricao, saldo_estimado_antes, saldo_informado FROM ia_saldo_ajustes ORDER BY id DESC LIMIT 8`);
  const { rows: [fora] } = await pool.query(`
    SELECT COALESCE(SUM(valor_usd) FILTER (WHERE tipo = 'conferencia' AND valor_usd > 0 AND em >= now() - interval '30 days'), 0) AS conferencias_30d,
           COALESCE(SUM(valor_usd) FILTER (WHERE tipo = 'gasto_externo' AND em >= now() - interval '30 days'), 0) AS externos_30d
    FROM ia_saldo_ajustes`);
  const ultimaConferencia = ajustes.find((a) => a.tipo === 'conferencia');
  const diasHistorico = u.primeiro ? Math.min(7, Math.max(1, (Date.now() - new Date(u.primeiro).getTime()) / 86400000)) : 0;
  const mediaDia = diasHistorico ? Number(u.sete_dias) / diasHistorico : 0;
  const configurado = s.saldo_usd !== null;
  const saldo = configurado ? Number(s.saldo_usd) : null;
  const limite = Number(s.limite_alerta_usd);
  const diasRestantes = configurado && mediaDia > 0 ? Math.max(0, saldo) / mediaDia : null;
  let nivel = 'sem-config';
  if (configurado) {
    if (saldo <= 0) nivel = 'zerado';
    else if (saldo <= limite) nivel = 'baixo';
    else if (diasRestantes !== null && diasRestantes < 3) nivel = 'atencao';
    else nivel = 'ok';
  }
  return {
    configurado, nivel,
    saldoUsd: saldo === null ? null : Math.max(0, saldo),
    limiteAlertaUsd: limite,
    informadoEm: s.informado_em,
    gastoHojeUsd: Number(u.hoje),
    gasto7diasUsd: Number(u.sete_dias),
    mediaDiariaUsd: mediaDia,
    diasRestantes,
    chamadas7dias: Number(u.chamadas_7d),
    cachePct,
    // diferenca encontrada na ultima vez que o dono conferiu o saldo real: positivo = o app achava que
    // tinha MAIS do que tinha de verdade (gasto que nao passou pelo app)
    ultimaConferencia: ultimaConferencia ? { em: ultimaConferencia.em, estimadoUsd: Number(ultimaConferencia.saldo_estimado_antes), realUsd: Number(ultimaConferencia.saldo_informado), diferencaUsd: Number(ultimaConferencia.valor_usd) } : null,
    foraDoApp30diasUsd: Number(fora.conferencias_30d) + Number(fora.externos_30d),
    ajustes: ajustes.map((a) => ({ id: a.id, em: a.em, tipo: a.tipo, valorUsd: Number(a.valor_usd), descricao: a.descricao })),
    porCliente: porCliente.map((r) => ({ tenantId: r.tenant_id, nome: r.nome, modulo: r.modulo, custoUsd: Number(r.custo), chamadas: Number(r.chamadas) })),
  };
}

export async function definirSaldo({ saldoUsd, limiteAlertaUsd }) {
  await tabelasProntas;
  if (saldoUsd !== undefined && saldoUsd !== null) {
    const { rows: [antes] } = await pool.query('SELECT saldo_usd FROM ia_saldo WHERE id = 1');
    if (antes?.saldo_usd !== null && antes?.saldo_usd !== undefined) {
      const estimado = Number(antes.saldo_usd);
      await pool.query(
        `INSERT INTO ia_saldo_ajustes (tipo, valor_usd, descricao, saldo_estimado_antes, saldo_informado) VALUES ('conferencia', $1, $2, $3, $4)`,
        [estimado - saldoUsd, 'Saldo real conferido no Console da Anthropic', estimado, saldoUsd],
      );
    }
    await pool.query('UPDATE ia_saldo SET saldo_usd = $1, informado_em = now(), aviso_baixo_em = NULL WHERE id = 1', [saldoUsd]);
    ultimoAvisoRam = 0;
  }
  if (limiteAlertaUsd !== undefined && limiteAlertaUsd !== null) {
    await pool.query('UPDATE ia_saldo SET limite_alerta_usd = $1 WHERE id = 1', [limiteAlertaUsd]);
  }
  return obterSituacao();
}

// uso da MESMA chave fora do app (testes, ferramentas de desenvolvimento, outros apps) - nao passa
// pelo cliente compartilhado, entao o dono registra aqui. Entra no gasto de hoje/7 dias (modulo
// "externo") e desconta do saldo, igual a uma chamada normal.
export async function registrarGastoExterno({ valorUsd, descricao }) {
  await tabelasProntas;
  const valor = Number(valorUsd);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1e5) throw new Error('Informe o valor do gasto em dolar (maior que zero).');
  const texto = String(descricao || '').trim().slice(0, 200) || 'Gasto fora do app';
  await pool.query(
    `INSERT INTO ia_uso (hora, modelo, tenant_id, modulo, chamadas, custo_usd) VALUES (date_trunc('hour', now()), 'externo', 0, 'externo', 0, $1)
     ON CONFLICT (hora, modelo, tenant_id, modulo) DO UPDATE SET custo_usd = ia_uso.custo_usd + EXCLUDED.custo_usd`,
    [valor],
  );
  await pool.query('UPDATE ia_saldo SET saldo_usd = saldo_usd - $1 WHERE id = 1 AND saldo_usd IS NOT NULL', [valor]);
  await pool.query(`INSERT INTO ia_saldo_ajustes (tipo, valor_usd, descricao) VALUES ('gasto_externo', $1, $2)`, [valor, texto]);
  return obterSituacao();
}

// recarga de creditos: soma ao saldo SEM contar como diferenca de conferencia
export async function registrarRecarga({ valorUsd }) {
  await tabelasProntas;
  const valor = Number(valorUsd);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1e5) throw new Error('Informe o valor recarregado em dolar (maior que zero).');
  await pool.query('UPDATE ia_saldo SET saldo_usd = COALESCE(saldo_usd, 0) + $1, aviso_baixo_em = NULL WHERE id = 1', [valor]);
  await pool.query(`INSERT INTO ia_saldo_ajustes (tipo, valor_usd, descricao) VALUES ('recarga', $1, 'Recarga de creditos')`, [valor]);
  ultimoAvisoRam = 0;
  return obterSituacao();
}

// ---------- servicos separados (ex.: um editor de video rodando fora do app) ----------
// Quem usa a MESMA chave da Anthropic em outro processo nao passa pelo anthropicClient, entao o gasto
// dele some do saldo. Esse servico manda o `usage` de cada resposta pra POST /api/saldo-ia/uso-externo
// com o cabecalho x-uso-token (derivado do SESSION_SECRET - sem env nova) e o app desconta igual a
// uma chamada normal, atribuindo ao modulo informado.
export function tokenUsoExterno() {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update('saldo-ia-uso-externo').digest('hex');
}

export function tokenUsoExternoValido(recebido) {
  const a = Buffer.from(String(recebido || ''));
  const b = Buffer.from(tokenUsoExterno());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function registrarUsoExterno({ modelo, usage, modulo }) {
  if (!usage || typeof usage !== 'object') throw new Error('usage obrigatorio (o objeto "usage" da resposta da Anthropic).');
  const nome = String(modulo || 'externo').trim().slice(0, 40) || 'externo';
  await registrarUso(String(modelo || 'desconhecido').slice(0, 60), usage, { tenantId: 0, modulo: nome });
  return { ok: true, custoUsd: custoDaChamada(modelo, usage) };
}
