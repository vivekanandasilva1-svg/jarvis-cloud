// Disparador de mensagens do WhatsApp (aba "Disparos"): campanhas com lista de destinatarios, texto com
// variaveis ({nome}) e variacoes ({oi|ola}), anexos, agendamento, janela de horario, ritmo humano
// (intervalo aleatorio + limite diario), relatorio e integracao com a IA (variacao do texto por
// contato + respostas atendidas pelo Auto Atendimento normal).
//
// RISCO REAL: o numero e conectado por uma via nao oficial (Baileys/Evolution) - disparo em massa e
// o que mais leva o WhatsApp a restringir numero. Por isso ha travas que NAO dependem do dono lembrar:
// intervalo minimo, limite diario, so dentro do horario, nunca manda pra quem pediu "sair" nem pra
// "contatos pessoais", e a campanha PAUSA sozinha se acumular falhas seguidas.
import { pool } from './db.js';
import { anthropic } from './anthropicClient.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import { tabelasProntas as tenantsProntos, listarInstanciasDoTenant } from './tenants.js';

const MODEL = 'claude-sonnet-5';
const MIN_INTERVALO_SEG = 10; // piso de seguranca - nunca deixa configurar mais rapido que isso
const MAX_INTERVALO_SEG = 900;
const MAX_LIMITE_DIARIO = 1000;
const MAX_DESTINATARIOS_CAMPANHA = 10000;
const MAX_ARQUIVOS = 5;
const MAX_ARQUIVO_BYTES = 12 * 1024 * 1024;
const FALHAS_SEGUIDAS_PRA_PAUSAR = 5;
const RODAPE_OPTOUT = '\n\nPara não receber mais mensagens, responda SAIR.';
const TIPOS_ARQUIVO = [/^image\//, /^audio\//, /^video\//, /^application\/pdf$/];

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disparo_campanhas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome TEXT NOT NULL,
      instancia TEXT NOT NULL,
      mensagem TEXT NOT NULL DEFAULT '',
      usar_ia BOOLEAN NOT NULL DEFAULT false,
      ia_instrucoes TEXT,
      optout_rodape BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'rascunho',
      agendar_em TIMESTAMPTZ,
      hora_inicio TEXT NOT NULL DEFAULT '08:00',
      hora_fim TEXT NOT NULL DEFAULT '20:00',
      intervalo_min INT NOT NULL DEFAULT 20,
      intervalo_max INT NOT NULL DEFAULT 60,
      limite_diario INT NOT NULL DEFAULT 150,
      proximo_envio_em TIMESTAMPTZ,
      falhas_seguidas INT NOT NULL DEFAULT 0,
      motivo_pausa TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      iniciado_em TIMESTAMPTZ,
      concluido_em TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS disparo_campanhas_tenant_idx ON disparo_campanhas (tenant_id, status);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disparo_destinatarios (
      id SERIAL PRIMARY KEY,
      campanha_id INT NOT NULL REFERENCES disparo_campanhas(id) ON DELETE CASCADE,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      nome TEXT,
      vars JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pendente',
      enviado_em TIMESTAMPTZ,
      respondeu_em TIMESTAMPTZ,
      erro TEXT,
      texto_enviado TEXT,
      UNIQUE (campanha_id, numero)
    );
  `);
  // rastreio de entrega: id da mensagem no WhatsApp + quando chegou/foi lida (evento MESSAGES_UPDATE)
  await pool.query(`ALTER TABLE disparo_destinatarios ADD COLUMN IF NOT EXISTS wa_id TEXT;`);
  await pool.query(`ALTER TABLE disparo_destinatarios ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE disparo_destinatarios ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disparo_dest_waid_idx ON disparo_destinatarios (tenant_id, wa_id) WHERE wa_id IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disparo_dest_pendente_idx ON disparo_destinatarios (campanha_id, status, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disparo_dest_numero_idx ON disparo_destinatarios (tenant_id, numero);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disparo_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      campanha_id INT NOT NULL REFERENCES disparo_campanhas(id) ON DELETE CASCADE,
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disparo_optout (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, numero)
    );
  `);
}
export const tabelasProntas = garantirTabelas().catch((err) => console.error('Erro criando tabelas de disparos:', err.message));

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EDITAVEL = new Set(['rascunho', 'pausada', 'agendada']);

// ---------- campanhas ----------

export async function listarCampanhas(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT c.id, c.nome, c.instancia, c.status, c.agendar_em, c.criado_em, c.iniciado_em, c.concluido_em, c.motivo_pausa, c.usar_ia,
            count(d.id)::int AS total,
            (count(d.id) FILTER (WHERE d.status = 'pendente'))::int AS pendentes,
            (count(d.id) FILTER (WHERE d.enviado_em IS NOT NULL))::int AS enviados,
            (count(d.id) FILTER (WHERE d.status = 'falha'))::int AS falhas,
            (count(d.id) FILTER (WHERE d.respondeu_em IS NOT NULL))::int AS respostas,
            (count(d.id) FILTER (WHERE d.status = 'optout'))::int AS optouts
     FROM disparo_campanhas c LEFT JOIN disparo_destinatarios d ON d.campanha_id = c.id
     WHERE c.tenant_id = $1 GROUP BY c.id ORDER BY c.id DESC`,
    [tenantId],
  );
  return rows;
}

export async function obterCampanha(tenantId, id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows: [c] } = await pool.query(`SELECT * FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2`, [Number(id), tenantId]);
  if (!c) return null;
  const { rows: arquivos } = await pool.query(
    `SELECT id, nome_arquivo AS nome, media_type AS tipo, octet_length(conteudo) AS tamanho FROM disparo_arquivos WHERE campanha_id = $1 ORDER BY id`, [c.id]);
  const { rows: [r] } = await pool.query(
    `SELECT count(*)::int AS total,
            (count(*) FILTER (WHERE status = 'pendente'))::int AS pendentes,
            (count(*) FILTER (WHERE enviado_em IS NOT NULL))::int AS enviados,
            (count(*) FILTER (WHERE status = 'falha'))::int AS falhas,
            (count(*) FILTER (WHERE status = 'ignorado'))::int AS ignorados,
            (count(*) FILTER (WHERE status = 'optout'))::int AS optouts,
            (count(*) FILTER (WHERE respondeu_em IS NOT NULL))::int AS respostas,
            (count(*) FILTER (WHERE wa_id IS NOT NULL))::int AS rastreados,
            (count(*) FILTER (WHERE entregue_em IS NOT NULL))::int AS entregues,
            (count(*) FILTER (WHERE lido_em IS NOT NULL))::int AS lidos,
            (count(*) FILTER (WHERE wa_id IS NOT NULL AND entregue_em IS NULL AND enviado_em < now() - interval '6 hours'))::int AS nao_entregues
     FROM disparo_destinatarios WHERE campanha_id = $1`, [c.id]);
  const { rows: porHora } = await pool.query(
    `SELECT to_char(date_trunc('hour', enviado_em AT TIME ZONE 'America/Maceio'), 'DD/MM HH24"h"') AS hora, count(*)::int AS total
     FROM disparo_destinatarios WHERE campanha_id = $1 AND enviado_em IS NOT NULL GROUP BY 1 ORDER BY min(enviado_em) DESC LIMIT 24`, [c.id]);
  return {
    id: c.id, nome: c.nome, instancia: c.instancia, mensagem: c.mensagem, usarIa: c.usar_ia, iaInstrucoes: c.ia_instrucoes || '',
    optoutRodape: c.optout_rodape, status: c.status, agendarEm: c.agendar_em, horaInicio: c.hora_inicio, horaFim: c.hora_fim,
    intervaloMin: c.intervalo_min, intervaloMax: c.intervalo_max, limiteDiario: c.limite_diario, motivoPausa: c.motivo_pausa,
    criadoEm: c.criado_em, iniciadoEm: c.iniciado_em, concluidoEm: c.concluido_em, arquivos, resumo: r, porHora: porHora.reverse(),
  };
}

export async function salvarCampanha(tenantId, d) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const nome = String(d.nome || '').trim().slice(0, 120);
  if (!nome) throw new Error('Dê um nome pra campanha.');
  const instancias = await listarInstanciasDoTenant(tenantId);
  if (!instancias.includes(d.instancia)) throw new Error('Escolha o número de WhatsApp que vai enviar.');
  const mensagem = String(d.mensagem || '').trim().slice(0, 3500);
  if (!mensagem) throw new Error('Escreva a mensagem.');
  const hi = d.horaInicio || '08:00';
  const hf = d.horaFim || '20:00';
  if (!HORA_RE.test(hi) || !HORA_RE.test(hf) || hi >= hf) throw new Error('Horário de envio inválido (o início precisa ser antes do fim).');
  const imin = Math.round(Number(d.intervaloMin));
  const imax = Math.round(Number(d.intervaloMax));
  if (!Number.isFinite(imin) || !Number.isFinite(imax) || imin < MIN_INTERVALO_SEG || imax > MAX_INTERVALO_SEG || imin > imax) {
    throw new Error(`Intervalo entre mensagens: mínimo ${MIN_INTERVALO_SEG}s e máximo ${MAX_INTERVALO_SEG}s (e o mínimo não pode passar do máximo). Intervalo curto demais aumenta o risco de bloqueio do número.`);
  }
  const limite = Math.round(Number(d.limiteDiario));
  if (!Number.isFinite(limite) || limite < 1 || limite > MAX_LIMITE_DIARIO) throw new Error(`Limite por dia: de 1 a ${MAX_LIMITE_DIARIO} mensagens.`);
  let agendarEm = null;
  if (d.agendarEm) {
    agendarEm = new Date(d.agendarEm);
    if (Number.isNaN(agendarEm.getTime())) throw new Error('Data/hora do agendamento inválida.');
  }
  const campos = [nome, d.instancia, mensagem, !!d.usarIa, String(d.iaInstrucoes || '').trim().slice(0, 2000), d.optoutRodape !== false, agendarEm, hi, hf, imin, imax, limite];

  if (d.id) {
    const { rows: [atual] } = await pool.query('SELECT status FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2', [Number(d.id), tenantId]);
    if (!atual) throw new Error('Campanha não encontrada.');
    if (!EDITAVEL.has(atual.status)) throw new Error('Pause a campanha antes de editar (campanha enviando ou concluída não pode ser alterada).');
    await pool.query(
      `UPDATE disparo_campanhas SET nome=$3, instancia=$4, mensagem=$5, usar_ia=$6, ia_instrucoes=$7, optout_rodape=$8, agendar_em=$9, hora_inicio=$10, hora_fim=$11, intervalo_min=$12, intervalo_max=$13, limite_diario=$14
       WHERE id = $1 AND tenant_id = $2`,
      [Number(d.id), tenantId, ...campos],
    );
    return Number(d.id);
  }
  const { rows } = await pool.query(
    `INSERT INTO disparo_campanhas (tenant_id, nome, instancia, mensagem, usar_ia, ia_instrucoes, optout_rodape, agendar_em, hora_inicio, hora_fim, intervalo_min, intervalo_max, limite_diario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [tenantId, ...campos],
  );
  return rows[0].id;
}

export async function apagarCampanha(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  const { rows: [c] } = await pool.query('SELECT status FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!c) return;
  if (c.status === 'enviando') throw new Error('Pause ou cancele a campanha antes de apagar.');
  await pool.query('DELETE FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

export async function acaoCampanha(tenantId, id, acao) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const { rows: [c] } = await pool.query('SELECT * FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!c) throw new Error('Campanha não encontrada.');

  if (acao === 'iniciar' || acao === 'retomar') {
    if (!['rascunho', 'pausada', 'agendada'].includes(c.status)) throw new Error('Essa campanha não pode ser iniciada agora.');
    const { rows: [{ n }] } = await pool.query(`SELECT count(*)::int AS n FROM disparo_destinatarios WHERE campanha_id = $1 AND status = 'pendente'`, [c.id]);
    if (!n) throw new Error('Adicione destinatários antes de iniciar.');
    const futuro = c.agendar_em && new Date(c.agendar_em).getTime() > Date.now();
    await pool.query(
      `UPDATE disparo_campanhas SET status = $3, iniciado_em = COALESCE(iniciado_em, CASE WHEN $3 = 'enviando' THEN now() END), motivo_pausa = NULL, falhas_seguidas = 0, proximo_envio_em = NULL
       WHERE id = $1 AND tenant_id = $2`,
      [c.id, tenantId, futuro ? 'agendada' : 'enviando'],
    );
    return;
  }
  if (acao === 'pausar') {
    if (!['enviando', 'agendada'].includes(c.status)) throw new Error('Só dá pra pausar campanha em andamento ou agendada.');
    await pool.query(`UPDATE disparo_campanhas SET status = 'pausada', motivo_pausa = 'Pausada por você' WHERE id = $1`, [c.id]);
    return;
  }
  if (acao === 'cancelar') {
    if (['concluida', 'cancelada'].includes(c.status)) throw new Error('Essa campanha já terminou.');
    await pool.query(`UPDATE disparo_campanhas SET status = 'cancelada', concluido_em = now() WHERE id = $1`, [c.id]);
    await pool.query(`UPDATE disparo_destinatarios SET status = 'ignorado', erro = 'Campanha cancelada' WHERE campanha_id = $1 AND status = 'pendente'`, [c.id]);
    return;
  }
  if (acao === 'duplicar') {
    const { rows: [novo] } = await pool.query(
      `INSERT INTO disparo_campanhas (tenant_id, nome, instancia, mensagem, usar_ia, ia_instrucoes, optout_rodape, hora_inicio, hora_fim, intervalo_min, intervalo_max, limite_diario)
       SELECT tenant_id, left(nome || ' (cópia)', 120), instancia, mensagem, usar_ia, ia_instrucoes, optout_rodape, hora_inicio, hora_fim, intervalo_min, intervalo_max, limite_diario
       FROM disparo_campanhas WHERE id = $1 RETURNING id`, [c.id]);
    await pool.query(`INSERT INTO disparo_arquivos (tenant_id, campanha_id, nome_arquivo, media_type, conteudo) SELECT tenant_id, $2, nome_arquivo, media_type, conteudo FROM disparo_arquivos WHERE campanha_id = $1`, [c.id, novo.id]);
    return novo.id;
  }
  throw new Error('Ação desconhecida.');
}

// ---------- destinatarios ----------

async function optoutDoTenant(tenantId) {
  const { rows } = await pool.query('SELECT numero FROM disparo_optout WHERE tenant_id = $1', [tenantId]);
  const s = new Set();
  for (const r of rows) { s.add(r.numero); const v = crm.varianteNonoDigito(r.numero); if (v) s.add(v); }
  return s;
}

async function exigirEditavel(tenantId, campanhaId) {
  const { rows: [c] } = await pool.query('SELECT status FROM disparo_campanhas WHERE id = $1 AND tenant_id = $2', [Number(campanhaId), tenantId]);
  if (!c) throw new Error('Campanha não encontrada.');
  if (!EDITAVEL.has(c.status)) throw new Error('Pause a campanha antes de mexer na lista.');
}

// lista = [{ numero, nome, vars }] - normaliza o telefone, tira repetido, opt-out e numero invalido
export async function adicionarDestinatarios(tenantId, campanhaId, lista) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await exigirEditavel(tenantId, campanhaId);
  const optout = await optoutDoTenant(tenantId);
  const { rows: [{ n: jaTem }] } = await pool.query('SELECT count(*)::int AS n FROM disparo_destinatarios WHERE campanha_id = $1', [Number(campanhaId)]);
  const res = { adicionados: 0, duplicados: 0, invalidos: 0, optout: 0, limite: false };
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const item of (Array.isArray(lista) ? lista : []).slice(0, 5000)) {
      const numero = crm.normalizarTelefone(item?.numero);
      if (!numero) { res.invalidos++; continue; }
      if (optout.has(numero)) { res.optout++; continue; }
      if (jaTem + res.adicionados >= MAX_DESTINATARIOS_CAMPANHA) { res.limite = true; break; }
      const vars = {};
      for (const [k, v] of Object.entries(item?.vars || {})) if (/^[a-z0-9_]{1,30}$/i.test(k)) vars[k.toLowerCase()] = String(v ?? '').slice(0, 200);
      const { rowCount } = await cliente.query(
        `INSERT INTO disparo_destinatarios (campanha_id, tenant_id, numero, nome, vars) VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (campanha_id, numero) DO NOTHING`,
        [Number(campanhaId), tenantId, numero, String(item?.nome || '').trim().slice(0, 120) || null, JSON.stringify(vars)],
      );
      if (rowCount) res.adicionados++; else res.duplicados++;
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
  return res;
}

// monta a lista a partir dos contatos do CRM (por etapa e/ou etiqueta). Nunca inclui "contatos pessoais".
export async function adicionarDoCrm(tenantId, campanhaId, { etapa, etiqueta }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  if (etapa === 'contatos_pessoais') throw new Error('Contatos pessoais nunca entram em disparo.');
  const cond = ['tenant_id = $1', 'oculto = false', "etapa <> 'contatos_pessoais'", "instancia NOT LIKE 'ig:%'", "numero ~ '^[0-9]{10,15}$'"];
  const params = [tenantId];
  if (etapa) { params.push(etapa); cond.push(`etapa = $${params.length}`); }
  if (etiqueta) { params.push(String(etiqueta).toLowerCase()); cond.push(`EXISTS (SELECT 1 FROM unnest(etiquetas) e WHERE lower(e) = $${params.length})`); }
  if (params.length === 1) throw new Error('Escolha uma etapa ou uma etiqueta do CRM.');
  const { rows } = await pool.query(`SELECT numero, nome FROM crm_contatos WHERE ${cond.join(' AND ')} LIMIT 5000`, params);
  return adicionarDestinatarios(tenantId, campanhaId, rows);
}

export async function limparPendentes(tenantId, campanhaId) {
  if (!pool) return;
  await tabelasProntas;
  await exigirEditavel(tenantId, campanhaId);
  await pool.query(`DELETE FROM disparo_destinatarios WHERE campanha_id = $1 AND status = 'pendente'`, [Number(campanhaId)]);
}

export async function listarDestinatarios(tenantId, campanhaId, { status, pagina = 0 } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  const params = [Number(campanhaId), tenantId];
  let filtro = '';
  if (status === 'respondeu') filtro = 'AND respondeu_em IS NOT NULL';
  else if (status) { params.push(status); filtro = `AND status = $${params.length}`; }
  params.push(Math.max(0, Number(pagina) || 0) * 100);
  const { rows } = await pool.query(
    `SELECT id, numero, nome, status, enviado_em, respondeu_em, erro, texto_enviado FROM disparo_destinatarios
     WHERE campanha_id = $1 AND tenant_id = $2 ${filtro} ORDER BY id ASC LIMIT 100 OFFSET $${params.length}`,
    params,
  );
  return rows;
}

// ---------- anexos ----------

export async function salvarArquivo(tenantId, campanhaId, nomeArquivo, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await exigirEditavel(tenantId, campanhaId);
  if (!TIPOS_ARQUIVO.some((re) => re.test(String(mediaType)))) throw new Error('Tipo de arquivo não aceito - use áudio, imagem, PDF ou vídeo curto.');
  if (!buffer?.length) throw new Error('Arquivo vazio.');
  if (buffer.length > MAX_ARQUIVO_BYTES) throw new Error('Arquivo grande demais - o máximo é 12 MB.');
  const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM disparo_arquivos WHERE campanha_id = $1', [Number(campanhaId)]);
  if (n >= MAX_ARQUIVOS) throw new Error(`No máximo ${MAX_ARQUIVOS} anexos por campanha.`);
  const { rows } = await pool.query(
    `INSERT INTO disparo_arquivos (tenant_id, campanha_id, nome_arquivo, media_type, conteudo) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, Number(campanhaId), String(nomeArquivo).slice(0, 200), mediaType, buffer],
  );
  return { id: rows[0].id, nome: String(nomeArquivo).slice(0, 200), tipo: mediaType, tamanho: buffer.length };
}

export async function apagarArquivo(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query('DELETE FROM disparo_arquivos WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// ---------- texto: variaveis, variacoes, IA ----------

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// {oi|olá|e aí} escolhe uma opcao ao acaso; {nome} = primeiro nome; {nome_completo}; {qualquer_coluna_da_planilha}
export function renderizarMensagem(modelo, dest) {
  let t = String(modelo || '');
  t = t.replace(/\{([^{}|]*\|[^{}]*)\}/g, (_, opcoes) => {
    const lista = opcoes.split('|');
    return lista[Math.floor(Math.random() * lista.length)].trim();
  });
  const vars = { nome: primeiroNome(dest?.nome), nome_completo: String(dest?.nome || '').trim(), ...(dest?.vars || {}) };
  t = t.replace(/\{([a-z0-9_]{1,30})\}/gi, (m, k) => (k.toLowerCase() in vars ? String(vars[k.toLowerCase()]) : m));
  // sem nome: "Olá , tudo bem?" vira "Olá, tudo bem?"
  return t.replace(/ +([,!.?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}

const TOOL_MENSAGEM = {
  name: 'entregar_mensagem',
  description: 'Entrega o texto final da mensagem pra esse contato.',
  input_schema: { type: 'object', properties: { mensagem: { type: 'string', description: 'Texto pronto pra WhatsApp, sem markdown/asterisco' } }, required: ['mensagem'] },
};

async function variarComIa(tenantId, base, instrucoes, dest) {
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 700,
    tools: [TOOL_MENSAGEM], tool_choice: { type: 'tool', name: 'entregar_mensagem' },
    messages: [{
      role: 'user',
      content: `Reescreva a mensagem abaixo, que vai ser enviada por WhatsApp pra um contato. Mantenha EXATAMENTE o sentido, o pedido de ação, links, números, preços, datas e endereços - mude só a forma (saudação, ordem das frases, palavras) pra ficar diferente das outras versões. Tom natural de WhatsApp, no máximo 1 emoji leve, sem markdown/asterisco, nunca invente informação.` +
        (instrucoes ? `\n\nInstruções do dono da campanha: ${instrucoes}` : '') +
        `\n\nNome do contato (se souber): ${dest.nome || 'não informado'}\n\nMensagem base:\n${base}`,
    }],
    _uso: { tenantId, modulo: 'disparos' },
  });
  const t = resp.content.find((b) => b.type === 'tool_use');
  const texto = String(t?.input?.mensagem || '').trim();
  if (!texto) throw new Error('a IA não devolveu texto');
  return texto;
}

// ---------- resposta do lead (chamado pelo webhook) ----------

const RE_SAIR = /^\W*(sair|parar|pare|cancelar|remover|descadastrar|n[aã]o quero( receber)?( mais)?|stop)\W*$/i;

export async function registrarResposta(tenantId, numero, texto) {
  if (!pool || !numero) return;
  await tabelasProntas;
  const nums = [numero, crm.varianteNonoDigito(numero)].filter(Boolean);
  const quer_sair = RE_SAIR.test(String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
  if (quer_sair) {
    for (const n of nums) await pool.query('INSERT INTO disparo_optout (tenant_id, numero) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tenantId, n]);
    await pool.query(`UPDATE disparo_destinatarios SET status = 'optout', erro = 'Pediu pra sair' WHERE tenant_id = $1 AND numero = ANY($2::text[]) AND status = 'pendente'`, [tenantId, nums]);
  }
  await pool.query(
    `UPDATE disparo_destinatarios SET respondeu_em = now() WHERE tenant_id = $1 AND numero = ANY($2::text[]) AND respondeu_em IS NULL AND enviado_em IS NOT NULL AND enviado_em > now() - interval '7 days'`,
    [tenantId, nums],
  );
}

export async function listarOptout(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT numero, em FROM disparo_optout WHERE tenant_id = $1 ORDER BY em DESC LIMIT 500', [tenantId]);
  return rows;
}

export async function removerOptout(tenantId, numero) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query('DELETE FROM disparo_optout WHERE tenant_id = $1 AND numero = $2', [tenantId, String(numero)]);
}

// ---------- motor de envio ----------

function dentroDaJanela(c) {
  const agora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
  return agora >= c.hora_inicio && agora < c.hora_fim;
}

async function enviarArquivo(instancia, numero, arq) {
  const base64 = arq.conteudo.toString('base64');
  if (arq.media_type.startsWith('audio/')) return evolutionApi.enviarAudio(instancia, numero, base64);
  const mediatype = arq.media_type.startsWith('image/') ? 'image' : arq.media_type.startsWith('video/') ? 'video' : 'document';
  return evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arq.media_type, media: base64, fileName: arq.nome_arquivo });
}

const erroDeNumeroInvalido = (msg) => /"exists"\s*:\s*false|not.*whatsapp|n[uú]mero.*n[aã]o/i.test(String(msg || ''));

export async function processarCampanha(c) {
  const tenantId = c.tenant_id;
  if (c.status === 'agendada') {
    if (c.agendar_em && new Date(c.agendar_em).getTime() > Date.now()) return;
    await pool.query(`UPDATE disparo_campanhas SET status = 'enviando', iniciado_em = COALESCE(iniciado_em, now()) WHERE id = $1`, [c.id]);
  }
  if (c.proximo_envio_em && new Date(c.proximo_envio_em).getTime() > Date.now()) return; // ritmo humano
  if (!dentroDaJanela(c)) return;

  // limite do dia: conta TUDO que esse numero ja mandou em disparo hoje (todas as campanhas dele)
  const { rows: [{ n: hoje }] } = await pool.query(
    `SELECT count(*)::int AS n FROM disparo_destinatarios d JOIN disparo_campanhas k ON k.id = d.campanha_id
     WHERE k.tenant_id = $1 AND k.instancia = $2 AND d.enviado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Maceio') AT TIME ZONE 'America/Maceio')`,
    [tenantId, c.instancia],
  );
  if (hoje >= c.limite_diario) return;

  // pega o proximo e ja marca "enviando" (nenhum outro ciclo pega o mesmo)
  const { rows: [d] } = await pool.query(
    `UPDATE disparo_destinatarios SET status = 'enviando' WHERE id = (
       SELECT id FROM disparo_destinatarios WHERE campanha_id = $1 AND status = 'pendente' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
     ) RETURNING id, numero, nome, vars`,
    [c.id],
  );
  if (!d) {
    await pool.query(`UPDATE disparo_campanhas SET status = 'concluida', concluido_em = now() WHERE id = $1`, [c.id]);
    return;
  }

  const ignorar = (motivo) => pool.query(`UPDATE disparo_destinatarios SET status = 'ignorado', erro = $2 WHERE id = $1`, [d.id, motivo]);
  const nums = [d.numero, crm.varianteNonoDigito(d.numero)].filter(Boolean);
  const { rows: bloqueado } = await pool.query(
    `SELECT 1 FROM disparo_optout WHERE tenant_id = $1 AND numero = ANY($2::text[])
     UNION ALL SELECT 1 FROM crm_contatos WHERE tenant_id = $1 AND numero = ANY($2::text[]) AND etapa = 'contatos_pessoais' LIMIT 1`,
    [tenantId, nums],
  );
  if (bloqueado.length) { await ignorar('Pediu pra sair ou está em Contatos pessoais'); return; }

  try {
    let texto = renderizarMensagem(c.mensagem, d);
    if (c.usar_ia) {
      try { texto = await variarComIa(tenantId, texto, c.ia_instrucoes, d); } catch (err) { console.error(`Disparo ${c.id}: IA falhou, mandando o texto base:`, err.message); }
    }
    if (c.optout_rodape) texto += RODAPE_OPTOUT;

    const resposta = await evolutionApi.enviarMensagemTextoPor(c.instancia, d.numero, texto);
    const { rows: anexos } = await pool.query('SELECT nome_arquivo, media_type, conteudo FROM disparo_arquivos WHERE campanha_id = $1 ORDER BY id', [c.id]);
    let erroAnexo = null;
    for (const anexo of anexos) {
      try { await enviarArquivo(c.instancia, d.numero, anexo); } catch (err) { erroAnexo = `Texto enviado, mas o anexo "${anexo.nome_arquivo}" falhou: ${err.message}`; }
    }
    await pool.query(`UPDATE disparo_destinatarios SET status = 'enviado', enviado_em = now(), texto_enviado = $2, erro = $3, wa_id = $4 WHERE id = $1`, [d.id, texto, erroAnexo, resposta?.key?.id || null]);
    await crm.registrarMensagem(tenantId, { numero: d.numero, instancia: c.instancia, direcao: 'saida', tipo: 'text', texto, nome: null, autor: 'disparo', waId: resposta?.key?.id || null, manterEtapa: true })
      .catch((err) => console.error('Disparo: erro registrando no CRM:', err.message));
    const espera = c.intervalo_min + Math.random() * (c.intervalo_max - c.intervalo_min);
    await pool.query(`UPDATE disparo_campanhas SET falhas_seguidas = 0, proximo_envio_em = now() + ($2 || ' seconds')::interval WHERE id = $1`, [c.id, String(Math.round(espera))]);
  } catch (err) {
    const invalido = erroDeNumeroInvalido(err.message);
    await pool.query(`UPDATE disparo_destinatarios SET status = 'falha', erro = $2 WHERE id = $1`, [d.id, String(err.message).slice(0, 300)]);
    // numero que nao tem WhatsApp e normal em lista - so conta como problema "de sistema" se NAO for isso
    const { rows: [k] } = await pool.query(
      `UPDATE disparo_campanhas SET falhas_seguidas = CASE WHEN $2 THEN falhas_seguidas ELSE falhas_seguidas + 1 END,
         proximo_envio_em = now() + interval '10 seconds' WHERE id = $1 RETURNING falhas_seguidas`,
      [c.id, invalido],
    );
    if (k.falhas_seguidas >= FALHAS_SEGUIDAS_PRA_PAUSAR) {
      await pool.query(`UPDATE disparo_campanhas SET status = 'pausada', motivo_pausa = $2 WHERE id = $1`, [c.id, `Pausada sozinha: ${FALHAS_SEGUIDAS_PRA_PAUSAR} falhas seguidas (${String(err.message).slice(0, 120)}). Confira se o número está conectado.`]);
    }
  }
}

let rodando = false;
// roda a cada 10s: UMA mensagem por campanha por ciclo (o intervalo aleatorio de cada campanha manda no ritmo)
export function iniciarSchedulerDisparos() {
  const ciclo = async () => {
    if (rodando || !pool) return;
    rodando = true;
    try {
      await tabelasProntas;
      const { rows } = await pool.query(
        `SELECT c.* FROM disparo_campanhas c JOIN tenants t ON t.id = c.tenant_id
         WHERE c.status IN ('agendada', 'enviando') AND (t.ativo OR t.super_admin) ORDER BY c.id`,
      );
      for (const c of rows) {
        try { await processarCampanha(c); } catch (err) { console.error(`Erro no disparo ${c.id}:`, err.message); }
      }
    } catch (err) {
      console.error('Erro no ciclo de disparos:', err.message);
    } finally {
      rodando = false;
    }
  };
  // se o servidor reiniciou no meio de um envio, devolve pra fila quem ficou "enviando"
  tabelasProntas.then(() => pool?.query(`UPDATE disparo_destinatarios SET status = 'pendente' WHERE status = 'enviando'`)).catch(() => {});
  setInterval(ciclo, 10 * 1000).unref();
}

// ---------- rastreio de entrega e painel geral ----------

// evento do Evolution (messages.update): DELIVERY_ACK = chegou no aparelho, READ/PLAYED = lida.
// O WhatsApp NAO avisa bloqueio nem denuncia - so da pra INFERIR: mensagem enviada que nunca chega
// (fica com 1 tracinho) por muitas horas pode ser aparelho desligado, numero sem WhatsApp ou bloqueio.
export async function registrarStatusEntrega(tenantId, evento) {
  if (!pool || !evento) return;
  await tabelasProntas;
  for (const ev of Array.isArray(evento) ? evento : [evento]) {
    const id = ev?.keyId || ev?.key?.id || ev?.messageId;
    const status = String(ev?.status || '').toUpperCase();
    if (!id) continue;
    if (status === 'READ' || status === 'PLAYED') {
      await pool.query(`UPDATE disparo_destinatarios SET lido_em = COALESCE(lido_em, now()), entregue_em = COALESCE(entregue_em, now()) WHERE tenant_id = $1 AND wa_id = $2`, [tenantId, String(id)]);
    } else if (status === 'DELIVERY_ACK') {
      await pool.query(`UPDATE disparo_destinatarios SET entregue_em = COALESCE(entregue_em, now()) WHERE tenant_id = $1 AND wa_id = $2`, [tenantId, String(id)]);
    }
  }
}

export async function removerDestinatario(tenantId, campanhaId, destId) {
  if (!pool) return;
  await tabelasProntas;
  await exigirEditavel(tenantId, campanhaId);
  await pool.query(`DELETE FROM disparo_destinatarios WHERE id = $1 AND campanha_id = $2 AND tenant_id = $3 AND status = 'pendente'`, [Number(destId), Number(campanhaId), tenantId]);
}

// numeros de TODAS as campanhas num periodo (de/ate 'YYYY-MM-DD', Maceio) + por dia + por campanha
export async function painelGeral(tenantId, { de, ate }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86400000);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) throw new Error('Periodo invalido.');
  const p = [tenantId, inicio, fim];
  const [{ rows: [t] }, { rows: dias }, { rows: camps }, { rows: [fila] }] = await Promise.all([
    pool.query(
      `SELECT (count(*) FILTER (WHERE enviado_em IS NOT NULL))::int AS enviadas,
              (count(*) FILTER (WHERE status = 'falha'))::int AS falhas,
              (count(*) FILTER (WHERE respondeu_em IS NOT NULL))::int AS respostas,
              (count(*) FILTER (WHERE status = 'optout'))::int AS optouts,
              (count(*) FILTER (WHERE wa_id IS NOT NULL))::int AS rastreadas,
              (count(*) FILTER (WHERE entregue_em IS NOT NULL))::int AS entregues,
              (count(*) FILTER (WHERE lido_em IS NOT NULL))::int AS lidas,
              (count(*) FILTER (WHERE wa_id IS NOT NULL AND entregue_em IS NULL AND enviado_em < now() - interval '6 hours'))::int AS nao_entregues
       FROM disparo_destinatarios WHERE tenant_id = $1 AND COALESCE(enviado_em, now()) >= $2 AND COALESCE(enviado_em, now()) < $3 AND status <> 'pendente'`, p),
    pool.query(
      `SELECT to_char((enviado_em AT TIME ZONE 'America/Maceio')::date, 'DD/MM') AS dia, count(*)::int AS enviadas,
              (count(*) FILTER (WHERE respondeu_em IS NOT NULL))::int AS respostas
       FROM disparo_destinatarios WHERE tenant_id = $1 AND enviado_em >= $2 AND enviado_em < $3 GROUP BY 1, (enviado_em AT TIME ZONE 'America/Maceio')::date ORDER BY (enviado_em AT TIME ZONE 'America/Maceio')::date`, p),
    pool.query(
      `SELECT c.id, c.nome, c.status,
              (count(d.id) FILTER (WHERE d.enviado_em IS NOT NULL AND d.enviado_em >= $2 AND d.enviado_em < $3))::int AS enviadas,
              (count(d.id) FILTER (WHERE d.status = 'falha' AND c.id = d.campanha_id))::int AS falhas,
              (count(d.id) FILTER (WHERE d.entregue_em IS NOT NULL))::int AS entregues,
              (count(d.id) FILTER (WHERE d.respondeu_em IS NOT NULL))::int AS respostas,
              (count(d.id) FILTER (WHERE d.wa_id IS NOT NULL AND d.entregue_em IS NULL AND d.enviado_em < now() - interval '6 hours'))::int AS nao_entregues
       FROM disparo_campanhas c LEFT JOIN disparo_destinatarios d ON d.campanha_id = c.id
       WHERE c.tenant_id = $1 AND (c.criado_em < $3) GROUP BY c.id ORDER BY c.id DESC LIMIT 30`, p),
    pool.query(`SELECT (count(*) FILTER (WHERE d.status = 'pendente'))::int AS pendentes FROM disparo_destinatarios d JOIN disparo_campanhas c ON c.id = d.campanha_id WHERE d.tenant_id = $1 AND c.status IN ('enviando', 'agendada', 'pausada', 'rascunho')`, [tenantId]),
  ]);
  return { resumo: { ...t, pendentes: fila.pendentes }, porDia: dias, campanhas: camps };
}
