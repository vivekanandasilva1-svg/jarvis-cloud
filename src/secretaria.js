// "Secretaria" da Lumia pessoal: controle financeiro simples (contas a pagar/receber, gastos,
// cartoes) + avisos automaticos de vencimento no WhatsApp do usuario (o "numero admin" configurado
// na aba WhatsApp - o mesmo numero que ja conversa com a Lumia). Tudo isolado por tenant. A
// Lumia usa isso pelas ferramentas financas_* (ver cloudAgent.js); o agendador abaixo manda o
// resumo da manha e o aviso da tarde.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as whatsappInstances from './whatsappInstances.js';
import { enviarMensagemTexto } from './evolutionApi.js';

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sec_cartoes (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome TEXT NOT NULL,
      limite NUMERIC(14,2) NOT NULL DEFAULT 0,
      dia_fechamento INT,
      dia_vencimento INT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sec_contas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      tipo TEXT NOT NULL DEFAULT 'pagar',
      descricao TEXT NOT NULL,
      valor NUMERIC(14,2) NOT NULL,
      vencimento DATE NOT NULL,
      categoria TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      pago_em TIMESTAMPTZ,
      recorrente_mensal BOOLEAN NOT NULL DEFAULT false,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sec_gastos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      descricao TEXT NOT NULL,
      valor NUMERIC(14,2) NOT NULL,
      categoria TEXT,
      data DATE NOT NULL,
      cartao_id INT REFERENCES sec_cartoes(id) ON DELETE SET NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sec_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      avisos_ativos BOOLEAN NOT NULL DEFAULT true,
      hora_resumo TEXT NOT NULL DEFAULT '08:00',
      hora_aviso_tarde TEXT NOT NULL DEFAULT '17:00',
      ultimo_resumo_data DATE,
      ultimo_aviso_tarde_data DATE
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS sec_contas_tenant_idx ON sec_contas (tenant_id, status, vencimento);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS sec_gastos_tenant_idx ON sec_gastos (tenant_id, data);`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas da secretaria:', err.message);
});

// ---------- utilitarios ----------

const FUSO = 'America/Maceio';

export function hojeMaceio() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO }); // AAAA-MM-DD
}

function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}${a !== hojeMaceio().slice(0, 4) ? `/${a}` : ''}`;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function validarData(s, campo) {
  if (!DATA_RE.test(s || '') || Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())) throw new Error(`${campo} invalida - use o formato AAAA-MM-DD.`);
  return s;
}

function validarValor(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error('O valor precisa ser um numero maior que zero (em reais).');
  return Math.round(n * 100) / 100;
}

function somarMeses(dataISO, meses) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

const COLS_CONTA = `id, tipo, descricao, valor::float8 AS valor, to_char(vencimento, 'YYYY-MM-DD') AS vencimento, categoria, status, recorrente_mensal`;

async function resolverCartao(tenantId, nome) {
  if (!nome) return null;
  const { rows } = await pool.query('SELECT id, nome FROM sec_cartoes WHERE tenant_id = $1 AND lower(nome) LIKE $2 ORDER BY id LIMIT 1', [tenantId, `%${String(nome).toLowerCase().trim()}%`]);
  if (!rows[0]) throw new Error(`Nao achei nenhum cartao chamado "${nome}" - cadastre antes com financas_salvar_cartao.`);
  return rows[0];
}

// ---------- contas ----------

export async function registrarConta(tenantId, { tipo = 'pagar', descricao, valor, vencimento, categoria, recorrenteMensal = false }) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  if (!descricao || !String(descricao).trim()) throw new Error('Falta a descricao da conta.');
  if (!['pagar', 'receber'].includes(tipo)) throw new Error('tipo precisa ser "pagar" ou "receber".');
  await tabelasProntas;
  const { rows } = await pool.query(
    `INSERT INTO sec_contas (tenant_id, tipo, descricao, valor, vencimento, categoria, recorrente_mensal)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS_CONTA}`,
    [tenantId, tipo, String(descricao).trim(), validarValor(valor), validarData(vencimento, 'Vencimento'), categoria || null, !!recorrenteMensal],
  );
  return rows[0];
}

export async function listarContas(tenantId, { status = 'pendente', tipo, de, ate } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  const cond = ['tenant_id = $1'];
  const params = [tenantId];
  if (status !== 'todas') { params.push(status === 'pago' ? 'pago' : 'pendente'); cond.push(`status = $${params.length}`); }
  if (tipo) { params.push(tipo === 'receber' ? 'receber' : 'pagar'); cond.push(`tipo = $${params.length}`); }
  if (de) { params.push(validarData(de, 'Data inicial')); cond.push(`vencimento >= $${params.length}`); }
  if (ate) { params.push(validarData(ate, 'Data final')); cond.push(`vencimento <= $${params.length}`); }
  const { rows } = await pool.query(`SELECT ${COLS_CONTA} FROM sec_contas WHERE ${cond.join(' AND ')} ORDER BY vencimento ASC, id ASC LIMIT 100`, params);
  const hoje = hojeMaceio();
  return rows.map((c) => ({ ...c, atrasada: c.status === 'pendente' && c.vencimento < hoje }));
}

// marca como paga (ou recebida). Conta recorrente mensal gera sozinha a do mes seguinte.
export async function marcarPaga(tenantId, id) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  await tabelasProntas;
  const { rows } = await pool.query(
    `UPDATE sec_contas SET status = 'pago', pago_em = now() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente' RETURNING ${COLS_CONTA}`,
    [id, tenantId],
  );
  if (!rows[0]) throw new Error(`Nao achei nenhuma conta PENDENTE com id ${id}.`);
  let proxima = null;
  if (rows[0].recorrente_mensal) {
    proxima = await registrarConta(tenantId, {
      tipo: rows[0].tipo, descricao: rows[0].descricao, valor: rows[0].valor,
      vencimento: somarMeses(rows[0].vencimento, 1), categoria: rows[0].categoria, recorrenteMensal: true,
    });
  }
  return { conta: rows[0], proximaRecorrente: proxima };
}

export async function apagarConta(tenantId, id) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  await tabelasProntas;
  const { rowCount } = await pool.query('DELETE FROM sec_contas WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!rowCount) throw new Error(`Nao achei nenhuma conta com id ${id}.`);
}

// ---------- gastos ----------

export async function registrarGasto(tenantId, { descricao, valor, categoria, data, cartao }) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  if (!descricao || !String(descricao).trim()) throw new Error('Falta a descricao do gasto.');
  await tabelasProntas;
  const c = await resolverCartao(tenantId, cartao);
  const { rows } = await pool.query(
    `INSERT INTO sec_gastos (tenant_id, descricao, valor, categoria, data, cartao_id) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, descricao, valor::float8 AS valor, categoria, to_char(data, 'YYYY-MM-DD') AS data, cartao_id`,
    [tenantId, String(descricao).trim(), validarValor(valor), categoria || null, data ? validarData(data, 'Data') : hojeMaceio(), c?.id || null],
  );
  return { ...rows[0], cartao: c?.nome || null };
}

export async function listarGastos(tenantId, { mes } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  const m = mes || hojeMaceio().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('mes invalido - use AAAA-MM.');
  const { rows } = await pool.query(
    `SELECT g.id, g.descricao, g.valor::float8 AS valor, g.categoria, to_char(g.data, 'YYYY-MM-DD') AS data, c.nome AS cartao
     FROM sec_gastos g LEFT JOIN sec_cartoes c ON c.id = g.cartao_id
     WHERE g.tenant_id = $1 AND to_char(g.data, 'YYYY-MM') = $2 ORDER BY g.data DESC, g.id DESC LIMIT 100`,
    [tenantId, m],
  );
  return rows;
}

export async function apagarGasto(tenantId, id) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  await tabelasProntas;
  const { rowCount } = await pool.query('DELETE FROM sec_gastos WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!rowCount) throw new Error(`Nao achei nenhum gasto com id ${id}.`);
}

// ---------- cartoes ----------

export async function salvarCartao(tenantId, { nome, limite, diaFechamento, diaVencimento }) {
  if (!pool) throw new Error('A secretaria precisa do Postgres configurado.');
  if (!nome || !String(nome).trim()) throw new Error('Falta o nome do cartao.');
  const dia = (v, campo) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error(`${campo} precisa ser um dia do mes (1 a 31).`);
    return n;
  };
  await tabelasProntas;
  const nomeLimpo = String(nome).trim();
  const lim = limite === undefined || limite === null ? 0 : validarValor(limite);
  const existente = await pool.query('SELECT id FROM sec_cartoes WHERE tenant_id = $1 AND lower(nome) = lower($2)', [tenantId, nomeLimpo]);
  if (existente.rows[0]) {
    await pool.query('UPDATE sec_cartoes SET limite = $3, dia_fechamento = $4, dia_vencimento = $5 WHERE id = $1 AND tenant_id = $2',
      [existente.rows[0].id, tenantId, lim, dia(diaFechamento, 'diaFechamento'), dia(diaVencimento, 'diaVencimento')]);
    return { id: existente.rows[0].id, atualizado: true };
  }
  const { rows } = await pool.query(
    'INSERT INTO sec_cartoes (tenant_id, nome, limite, dia_fechamento, dia_vencimento) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [tenantId, nomeLimpo, lim, dia(diaFechamento, 'diaFechamento'), dia(diaVencimento, 'diaVencimento')],
  );
  return { id: rows[0].id, atualizado: false };
}

// ultimo fechamento ja ocorrido (AAAA-MM-DD) pra um dia de fechamento - gastos DEPOIS dessa data
// estao na fatura aberta
function ultimoFechamento(diaFechamento, hojeISO) {
  const [a, m, d] = hojeISO.split('-').map(Number);
  const dias = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fechouEsteMes = d >= Math.min(diaFechamento, dias(a, m));
  const base = fechouEsteMes ? { a, m } : (m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 });
  const dia = Math.min(diaFechamento, dias(base.a, base.m));
  return `${base.a}-${String(base.m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export async function listarCartoes(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, nome, limite::float8 AS limite, dia_fechamento, dia_vencimento FROM sec_cartoes WHERE tenant_id = $1 ORDER BY nome', [tenantId]);
  const hoje = hojeMaceio();
  const saida = [];
  for (const c of rows) {
    const desde = c.dia_fechamento ? ultimoFechamento(c.dia_fechamento, hoje) : `${hoje.slice(0, 7)}-01`;
    const { rows: [{ total }] } = await pool.query(
      'SELECT COALESCE(sum(valor), 0)::float8 AS total FROM sec_gastos WHERE tenant_id = $1 AND cartao_id = $2 AND data > $3',
      [tenantId, c.id, desde],
    );
    saida.push({
      id: c.id, nome: c.nome, limite: c.limite, diaFechamento: c.dia_fechamento, diaVencimento: c.dia_vencimento,
      usadoNaFaturaAberta: total, limiteDisponivelAprox: c.limite ? Math.max(0, Math.round((c.limite - total) * 100) / 100) : null,
      faturaAbertaDesde: desde,
    });
  }
  return saida;
}

// ---------- resumo do mes ----------

export async function resumoDoMes(tenantId, { mes } = {}) {
  if (!pool) return null;
  await tabelasProntas;
  const m = mes || hojeMaceio().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('mes invalido - use AAAA-MM.');
  const [porCategoria, pagas, pendentes, receber, cartoes] = await Promise.all([
    pool.query(`SELECT COALESCE(categoria, 'sem categoria') AS categoria, sum(valor)::float8 AS total FROM sec_gastos WHERE tenant_id = $1 AND to_char(data, 'YYYY-MM') = $2 GROUP BY 1 ORDER BY 2 DESC`, [tenantId, m]),
    pool.query(`SELECT COALESCE(sum(valor), 0)::float8 AS total, count(*)::int AS qtd FROM sec_contas WHERE tenant_id = $1 AND tipo = 'pagar' AND status = 'pago' AND to_char(pago_em AT TIME ZONE 'America/Maceio', 'YYYY-MM') = $2`, [tenantId, m]),
    pool.query(`SELECT COALESCE(sum(valor), 0)::float8 AS total, count(*)::int AS qtd FROM sec_contas WHERE tenant_id = $1 AND tipo = 'pagar' AND status = 'pendente' AND to_char(vencimento, 'YYYY-MM') <= $2`, [tenantId, m]),
    pool.query(`SELECT COALESCE(sum(valor), 0)::float8 AS total, count(*)::int AS qtd FROM sec_contas WHERE tenant_id = $1 AND tipo = 'receber' AND status = 'pendente' AND to_char(vencimento, 'YYYY-MM') <= $2`, [tenantId, m]),
    listarCartoes(tenantId),
  ]);
  const totalGastos = porCategoria.rows.reduce((s, r) => s + r.total, 0);
  return {
    mes: m,
    gastosDoMes: { total: Math.round(totalGastos * 100) / 100, porCategoria: porCategoria.rows },
    contasPagasNoMes: pagas.rows[0],
    contasAPagarPendentes: pendentes.rows[0],
    contasAReceberPendentes: receber.rows[0],
    cartoes,
  };
}

// ---------- avisos automaticos ----------

// monta o texto de avisos (contas atrasadas, de hoje e dos proximos dias) ou null se nada pendente
async function textoDeAvisos(tenantId, { diasAFrente = 3, titulo }) {
  const hoje = hojeMaceio();
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + diasAFrente);
  const { rows } = await pool.query(
    `SELECT ${COLS_CONTA} FROM sec_contas WHERE tenant_id = $1 AND status = 'pendente' AND vencimento <= $2 ORDER BY vencimento ASC, id ASC LIMIT 30`,
    [tenantId, limite.toISOString().slice(0, 10)],
  );
  if (!rows.length) return null;
  const grupos = { atrasadas: [], hoje: [], proximas: [] };
  for (const c of rows) (c.vencimento < hoje ? grupos.atrasadas : c.vencimento === hoje ? grupos.hoje : grupos.proximas).push(c);
  const linha = (c) => `• ${c.tipo === 'receber' ? '(a receber) ' : ''}${c.descricao} - ${brl(c.valor)} (${dataBR(c.vencimento)}) [id ${c.id}]`;
  const partes = [titulo];
  if (grupos.atrasadas.length) partes.push(`\n🔴 Atrasadas:\n${grupos.atrasadas.map(linha).join('\n')}`);
  if (grupos.hoje.length) partes.push(`\n🟠 Vencem hoje:\n${grupos.hoje.map(linha).join('\n')}`);
  if (grupos.proximas.length) partes.push(`\n🟡 Proximos dias:\n${grupos.proximas.map(linha).join('\n')}`);
  partes.push('\nMe avise quando pagar que eu dou baixa. 💛');
  return partes.join('\n');
}

// uma linha curta pro contexto da Lumia ("voce tem X contas atrasadas...") - '' se nada pendente
export async function contextoCurto(tenantId) {
  if (!pool) return '';
  try {
    await tabelasProntas;
    const hoje = hojeMaceio();
    const { rows: [r] } = await pool.query(
      `SELECT count(*) FILTER (WHERE vencimento < $2)::int AS atrasadas, count(*) FILTER (WHERE vencimento = $2)::int AS hoje FROM sec_contas WHERE tenant_id = $1 AND status = 'pendente' AND tipo = 'pagar'`,
      [tenantId, hoje],
    );
    if (!r.atrasadas && !r.hoje) return '';
    return `Secretaria financeira: o usuario tem ${r.atrasadas} conta(s) a pagar ATRASADA(S) e ${r.hoje} vencendo HOJE (use financas_listar_contas pra detalhar se ele perguntar).`;
  } catch { return ''; }
}

let verificando = false;
async function checarAvisos() {
  if (verificando || !pool) return;
  verificando = true;
  try {
    await tabelasProntas;
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
    const hoje = hojeMaceio();
    const { rows: tenantsComConta } = await pool.query(`SELECT DISTINCT tenant_id FROM sec_contas WHERE status = 'pendente'`);
    for (const { tenant_id: tenantId } of tenantsComConta) {
      try {
        await pool.query('INSERT INTO sec_config (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING', [tenantId]);
        const { rows: [cfg] } = await pool.query(
          `SELECT avisos_ativos, hora_resumo, hora_aviso_tarde, to_char(ultimo_resumo_data, 'YYYY-MM-DD') AS resumo, to_char(ultimo_aviso_tarde_data, 'YYYY-MM-DD') AS tarde FROM sec_config WHERE tenant_id = $1`,
          [tenantId],
        );
        if (!cfg.avisos_ativos) continue;
        const { numeroAdmin } = await whatsappInstances.obterConfig(tenantId);
        if (!numeroAdmin) continue;

        // resumo da manha: atrasadas + hoje + proximos 3 dias. Marca o dia como feito mesmo se nao
        // havia nada, pra nao ficar reconsultando; vale ate o fim do dia (se o servidor ficou fora
        // do ar as 8h, manda assim que voltar)
        if (hora >= cfg.hora_resumo && cfg.resumo !== hoje) {
          const texto = await textoDeAvisos(tenantId, { diasAFrente: 3, titulo: '☀️ Bom dia! Seu resumo financeiro:' });
          if (texto) await enviarMensagemTexto(tenantId, numeroAdmin, texto);
          await pool.query('UPDATE sec_config SET ultimo_resumo_data = $2 WHERE tenant_id = $1', [tenantId, hoje]);
        }
        // aviso da tarde: so o que ainda esta atrasado ou vence HOJE e continua pendente
        if (hora >= cfg.hora_aviso_tarde && hora < '21:00' && cfg.tarde !== hoje) {
          const texto = await textoDeAvisos(tenantId, { diasAFrente: 0, titulo: '🔔 Lembrete: ainda tem conta pendente pra hoje:' });
          if (texto) await enviarMensagemTexto(tenantId, numeroAdmin, texto);
          await pool.query('UPDATE sec_config SET ultimo_aviso_tarde_data = $2 WHERE tenant_id = $1', [tenantId, hoje]);
        }
      } catch (err) {
        console.error(`Erro nos avisos da secretaria (tenant ${tenantId}):`, err.message);
      }
    }
  } catch (err) {
    console.error('Erro checando avisos da secretaria:', err.message);
  } finally {
    verificando = false;
  }
}

// chamado uma vez no boot do server.js
export function iniciarSchedulerSecretaria() {
  if (!pool) return;
  setInterval(checarAvisos, 5 * 60 * 1000).unref();
  setTimeout(checarAvisos, 30 * 1000).unref();
}

export { textoDeAvisos };
