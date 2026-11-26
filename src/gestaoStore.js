// Base de dados do "Lumia Gestao Geral": metas editaveis, decisoes/tarefas e lancamentos manuais
// (setores sem integracao: ASBs, Laboratorio...). Tudo por tenant (clinica). Nada aqui envia mensagem
// ou mexe em outro modulo da Lumia.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

export const SETORES_IDS = ['vendas', 'recepcao', 'asbs', 'laboratorio', 'financeiro'];
export const SITUACOES = ['aberta', 'andamento', 'feita'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_metas (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      setor TEXT NOT NULL,
      indicador TEXT NOT NULL,
      valor NUMERIC,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, setor, indicador)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_decisoes (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      setor TEXT NOT NULL,
      texto TEXT NOT NULL,
      responsavel TEXT,
      prazo DATE,
      situacao TEXT NOT NULL DEFAULT 'aberta',
      resultado TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      concluido_em TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS gestao_decisoes_tenant_idx ON gestao_decisoes (tenant_id, setor, situacao);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_config (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      chave TEXT NOT NULL,
      valor JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, chave)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_lancamentos (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      setor TEXT NOT NULL,
      indicador TEXT NOT NULL,
      semana DATE NOT NULL,
      valor NUMERIC NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, setor, indicador, semana)
    );
  `);
  // checklist diario: a linha existir = item feito naquele dia
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_checklist (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      setor TEXT NOT NULL,
      dia DATE NOT NULL,
      item TEXT NOT NULL,
      feito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, setor, dia, item)
    );
  `);
  // lancamentos diarios (Comercial: por CRC; crc '' = geral do setor)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gestao_diario (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      setor TEXT NOT NULL,
      dia DATE NOT NULL,
      crc TEXT NOT NULL DEFAULT '',
      indicador TEXT NOT NULL,
      valor NUMERIC NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, setor, dia, crc, indicador)
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('Erro criando tabelas da gestao:', err.message));

const checarSetor = (setor) => { if (!SETORES_IDS.includes(setor)) throw new Error('Setor invalido.'); };
const hojeMaceio = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' });

// segunda-feira da semana da data (a semana da rotina vai de segunda a domingo)
export function segundaDaSemana(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// ---------- metas ----------

// padroes: { indicador: { meta, melhor } } do setor; devolve o mesmo formato com o que o gestor salvou por cima.
// Meta salva como "sem meta" (null) vale null mesmo que o padrao tenha valor.
export async function metasDoSetor(tenantId, setor, padroes) {
  checarSetor(setor);
  const saida = Object.fromEntries(Object.entries(padroes).map(([id, p]) => [id, { ...p, padrao: p.meta, definida: false }]));
  if (!pool) return saida;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT indicador, valor FROM gestao_metas WHERE tenant_id = $1 AND setor = $2', [tenantId, setor]);
  for (const r of rows) {
    if (!saida[r.indicador]) continue;
    saida[r.indicador].meta = r.valor === null ? null : Number(r.valor);
    saida[r.indicador].definida = true;
  }
  return saida;
}

export async function salvarMeta(tenantId, setor, indicador, valor, indicadoresValidos) {
  checarSetor(setor);
  if (!indicadoresValidos.includes(indicador)) throw new Error('Indicador invalido.');
  let v = null;
  if (valor !== null && valor !== undefined && valor !== '') {
    v = Number(valor);
    if (!Number.isFinite(v) || v < 0 || v > 1e9) throw new Error('A meta precisa ser um numero entre 0 e 1.000.000.000.');
  }
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO gestao_metas (tenant_id, setor, indicador, valor) VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, setor, indicador) DO UPDATE SET valor = $4, atualizado_em = now()`,
    [tenantId, setor, indicador, v],
  );
}

// ---------- decisoes e tarefas ----------

const mapDecisao = (r) => ({
  id: r.id, setor: r.setor, texto: r.texto, responsavel: r.responsavel || '', prazo: r.prazo || null,
  situacao: r.situacao, resultado: r.resultado || '', criadoEm: r.criado_em, concluidoEm: r.concluido_em,
});
const COLUNAS = `id, setor, texto, responsavel, to_char(prazo,'YYYY-MM-DD') AS prazo, situacao, resultado, criado_em, concluido_em`;

export async function listarDecisoes(tenantId, { setor = null, incluirFeitas = true } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  if (setor) checarSetor(setor);
  const { rows } = await pool.query(
    `SELECT ${COLUNAS} FROM gestao_decisoes WHERE tenant_id = $1 AND ($2::text IS NULL OR setor = $2)
       AND ($3::boolean OR situacao <> 'feita' OR concluido_em >= now() - interval '14 days')
     ORDER BY (situacao = 'feita'), prazo NULLS LAST, id DESC LIMIT 300`,
    [tenantId, setor, incluirFeitas],
  );
  return rows.map(mapDecisao);
}

function validarDecisao({ texto, responsavel, prazo, situacao, resultado }, parcial = false) {
  const o = {};
  if (!parcial || texto !== undefined) {
    const t = String(texto || '').trim();
    if (!t) throw new Error('Escreva a decisao ou tarefa.');
    if (t.length > 500) throw new Error('A decisao passou de 500 caracteres.');
    o.texto = t;
  }
  if (responsavel !== undefined) { const r = String(responsavel || '').trim(); if (r.length > 80) throw new Error('Nome do responsavel muito longo.'); o.responsavel = r || null; }
  if (prazo !== undefined) { if (prazo && !DATA_RE.test(prazo)) throw new Error('Prazo invalido (use AAAA-MM-DD).'); o.prazo = prazo || null; }
  if (situacao !== undefined) { if (!SITUACOES.includes(situacao)) throw new Error('Situacao invalida.'); o.situacao = situacao; }
  if (resultado !== undefined) { const r = String(resultado || '').trim(); if (r.length > 1000) throw new Error('O resultado passou de 1000 caracteres.'); o.resultado = r || null; }
  return o;
}

export async function criarDecisao(tenantId, setor, dados) {
  checarSetor(setor);
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const d = validarDecisao(dados);
  const { rows } = await pool.query(
    `INSERT INTO gestao_decisoes (tenant_id, setor, texto, responsavel, prazo) VALUES ($1,$2,$3,$4,$5) RETURNING ${COLUNAS}`,
    [tenantId, setor, d.texto, d.responsavel ?? null, d.prazo ?? null],
  );
  return mapDecisao(rows[0]);
}

export async function atualizarDecisao(tenantId, id, dados) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const d = validarDecisao(dados, true);
  const sets = [];
  const valores = [id, tenantId];
  for (const [campo, valor] of Object.entries(d)) { valores.push(valor); sets.push(`${campo} = $${valores.length}`); }
  if (d.situacao) sets.push(d.situacao === 'feita' ? 'concluido_em = now()' : 'concluido_em = NULL');
  if (!sets.length) throw new Error('Nada para alterar.');
  const { rows } = await pool.query(`UPDATE gestao_decisoes SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${COLUNAS}`, valores);
  if (!rows.length) throw new Error('Decisao nao encontrada.');
  return mapDecisao(rows[0]);
}

export async function apagarDecisao(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const { rowCount } = await pool.query('DELETE FROM gestao_decisoes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!rowCount) throw new Error('Decisao nao encontrada.');
}

// "combinado na semana passada": o que esta aberto/andando e o que foi concluido nos ultimos 14 dias
export async function combinadoDoSetor(tenantId, setor) {
  const hoje = hojeMaceio();
  return (await listarDecisoes(tenantId, { setor, incluirFeitas: false })).map((d) => ({
    id: d.id, texto: d.texto, responsavel: d.responsavel, prazo: d.prazo,
    situacao: d.situacao === 'feita' ? 'feito' : d.prazo && d.prazo < hoje ? 'atrasado' : d.situacao === 'andamento' ? 'andamento' : 'aberto',
  }));
}

// ---------- lancamentos manuais (por semana) ----------

export async function salvarLancamento(tenantId, setor, indicador, valor, semana, indicadoresValidos) {
  checarSetor(setor);
  if (!indicadoresValidos.includes(indicador)) throw new Error('Indicador invalido.');
  const v = Number(valor);
  if (valor === '' || valor === null || valor === undefined || !Number.isFinite(v) || v < 0 || v > 1e9) throw new Error('Informe um numero valido.');
  const dia = semana || hojeMaceio();
  if (!DATA_RE.test(dia)) throw new Error('Semana invalida.');
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO gestao_lancamentos (tenant_id, setor, indicador, semana, valor) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, setor, indicador, semana) DO UPDATE SET valor = $5, atualizado_em = now()`,
    [tenantId, setor, indicador, segundaDaSemana(dia), v],
  );
}

// valor da semana do periodo (e da anterior) de cada indicador manual
export async function lancamentosDoSetor(tenantId, setor, ateIso) {
  checarSetor(setor);
  if (!pool) return {};
  await tabelasProntas;
  const semana = segundaDaSemana(ateIso);
  const anterior = new Date(new Date(`${semana}T00:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `SELECT indicador, to_char(semana,'YYYY-MM-DD') AS semana, valor FROM gestao_lancamentos
     WHERE tenant_id = $1 AND setor = $2 AND semana IN ($3::date, $4::date)`,
    [tenantId, setor, semana, anterior],
  );
  const saida = {};
  for (const r of rows) {
    saida[r.indicador] ||= { atual: null, anterior: null };
    saida[r.indicador][r.semana === semana ? 'atual' : 'anterior'] = Number(r.valor);
  }
  return saida;
}

// ---------- configuracao por clinica (ex: quais contas do Meta alimentam o painel de Vendas) ----------

export async function obterConfig(tenantId, chave, padrao = null) {
  if (!pool) return padrao;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT valor FROM gestao_config WHERE tenant_id = $1 AND chave = $2', [tenantId, chave]);
  return rows.length ? rows[0].valor : padrao;
}

export async function salvarConfig(tenantId, chave, valor) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO gestao_config (tenant_id, chave, valor) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_id, chave) DO UPDATE SET valor = $3::jsonb, atualizado_em = now()`,
    [tenantId, chave, JSON.stringify(valor)],
  );
}

// ---------- checklist diario e lancamentos diarios (usados pela rotina: gestaoRotina.js) ----------

export async function marcasChecklist(tenantId, setor, de, ate) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT setor, to_char(dia,'YYYY-MM-DD') AS dia, item, feito_em AS em FROM gestao_checklist
     WHERE tenant_id = $1 AND ($2::text IS NULL OR setor = $2) AND dia BETWEEN $3::date AND $4::date`,
    [tenantId, setor, de, ate],
  );
  return rows;
}

export async function marcarChecklist(tenantId, setor, dia, item, feito) {
  checarSetor(setor);
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  if (feito) {
    await pool.query(
      `INSERT INTO gestao_checklist (tenant_id, setor, dia, item) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [tenantId, setor, dia, item],
    );
  } else {
    await pool.query('DELETE FROM gestao_checklist WHERE tenant_id = $1 AND setor = $2 AND dia = $3 AND item = $4', [tenantId, setor, dia, item]);
  }
}

export async function diarioDoPeriodo(tenantId, setor, de, ate) {
  checarSetor(setor);
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT to_char(dia,'YYYY-MM-DD') AS dia, crc, indicador, valor FROM gestao_diario
     WHERE tenant_id = $1 AND setor = $2 AND dia BETWEEN $3::date AND $4::date`,
    [tenantId, setor, de, ate],
  );
  return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
}

export async function salvarDiario(tenantId, setor, dia, crc, indicador, valor) {
  checarSetor(setor);
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  if (valor === null) {
    await pool.query('DELETE FROM gestao_diario WHERE tenant_id = $1 AND setor = $2 AND dia = $3 AND crc = $4 AND indicador = $5', [tenantId, setor, dia, crc, indicador]);
    return;
  }
  await pool.query(
    `INSERT INTO gestao_diario (tenant_id, setor, dia, crc, indicador, valor) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (tenant_id, setor, dia, crc, indicador) DO UPDATE SET valor = $6, atualizado_em = now()`,
    [tenantId, setor, dia, crc, indicador, valor],
  );
}
