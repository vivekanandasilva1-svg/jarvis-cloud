// Cerebro de IA (aba "Cerebro" do app): uma memoria UNICA compartilhada entre todas as IAs que o
// tenant usa (Claude, ChatGPT, Cursor, Gemini, a propria Lumia...). Cada IA se conecta pelo
// endpoint MCP (ver cerebroMcp.js) com um token proprio e consegue salvar/buscar memorias
// (decisoes, fatos, preferencias, contexto de projeto) - o que uma IA aprende, a outra ja sabe.
//
// Busca por significado SEM pgvector de proposito: o Postgres da VPS e o postgres:17-alpine puro
// (sem a extensao), e trocar a imagem do banco de producao so pra isso e risco desnecessario. O
// embedding (Gemini, mesma GEMINI_API_KEY ja usada pra voz/transcricao) fica guardado como BYTEA
// (Float32 cru, ~3KB por memoria) e a similaridade e calculada aqui no Node, com um cache por
// tenant em RAM que so e carregado quando alguem do tenant realmente usa o Cerebro. Ate alguns
// milhares de memorias por tenant isso responde em poucos ms.
//
// Se o Gemini falhar (cota, fora do ar), a memoria e salva do mesmo jeito sem embedding e a
// busca cai pra texto simples (ILIKE) - o Cerebro nunca para de funcionar por causa disso.
import crypto from 'node:crypto';
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { tabelasProntas as tenantConfigPronto } from './tenantConfig.js';

const DIMENSOES = 768;
const MODELO_EMBEDDING = 'gemini-embedding-001';
// quantas memorias parecidas cada memoria nova liga sozinha no grafo, e o minimo de
// similaridade pra considerar "relacionada". Os embeddings do Gemini ficam espremidos numa faixa
// alta (textos sem nada a ver ja dao ~0.65, mesmo assunto da ~0.80) - medido com memorias reais,
// abaixo de 0.75 a ligacao vira ruido. Mesmo projeto ganha um empurraozinho pra memorias do mesmo
// projeto se agruparem visualmente no grafo.
const LIGACOES_AUTO = 4;
const SIMILARIDADE_MIN_LIGACAO = 0.75;
const BONUS_MESMO_PROJETO = 0.04;
// teto de nos enviados pro grafo de uma vez - mantem a aba fluida ate no celular
const MAX_NOS_GRAFO = 1500;

export const TIPOS = ['decisao', 'fato', 'preferencia', 'tarefa', 'contexto', 'aprendizado'];
export const ORIGENS = ['claude', 'chatgpt', 'cursor', 'gemini', 'lumia', 'manual', 'outra'];

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cerebro_memorias (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      titulo TEXT,
      conteudo TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'fato',
      projeto TEXT,
      origem TEXT NOT NULL DEFAULT 'manual',
      tags TEXT[] NOT NULL DEFAULT '{}',
      embedding BYTEA,
      arquivada BOOLEAN NOT NULL DEFAULT false,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS cerebro_memorias_tenant_idx ON cerebro_memorias (tenant_id, arquivada, criado_em DESC);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cerebro_ligacoes (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      origem_id INT NOT NULL REFERENCES cerebro_memorias(id) ON DELETE CASCADE,
      destino_id INT NOT NULL REFERENCES cerebro_memorias(id) ON DELETE CASCADE,
      peso REAL NOT NULL DEFAULT 1,
      PRIMARY KEY (origem_id, destino_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS cerebro_ligacoes_tenant_idx ON cerebro_ligacoes (tenant_id);`);
  // token de conexao MCP: so o hash fica salvo (o token em si aparece UMA vez na tela, na hora
  // de criar) - mesmo raciocinio de senha, quem tiver acesso ao banco nao consegue se passar
  // pela IA de ninguem
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cerebro_tokens (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome TEXT NOT NULL,
      origem TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      prefixo TEXT NOT NULL,
      revogado BOOLEAN NOT NULL DEFAULT false,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultimo_uso_em TIMESTAMPTZ
    );
  `);
  // liberacao paga por cliente: fica FORA de tabs_habilitadas de proposito - la "nada marcado"
  // significa "tudo liberado", e o Cerebro precisa ser o contrario (desligado ate o admin ligar)
  await tenantConfigPronto;
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS cerebro_liberado BOOLEAN NOT NULL DEFAULT false;`);
}

export const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Cerebro:', err.message);
});

function exigirBanco() {
  if (!pool) throw new Error('O Cerebro precisa do Postgres configurado (DATABASE_URL).');
}

// ---------- liberacao por cliente ----------

export async function estaLiberado(tenantId) {
  if (!pool) return false;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT cerebro_liberado FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return !!rows[0]?.cerebro_liberado;
}

export async function definirLiberado(tenantId, liberado) {
  exigirBanco();
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, cerebro_liberado, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET cerebro_liberado = $2, atualizado_em = now()`,
    [tenantId, !!liberado],
  );
}

// ---------- embeddings (Gemini) ----------

function normalizar(vetor) {
  let soma = 0;
  for (let i = 0; i < vetor.length; i++) soma += vetor[i] * vetor[i];
  const norma = Math.sqrt(soma) || 1;
  const out = new Float32Array(vetor.length);
  for (let i = 0; i < vetor.length; i++) out[i] = vetor[i] / norma;
  return out;
}

// RETRIEVAL_DOCUMENT pra memoria guardada, RETRIEVAL_QUERY pra pergunta de busca - o Gemini
// otimiza o vetor diferente pra cada lado, o que melhora o acerto da busca
async function gerarEmbedding(texto, taskType) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) return null;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 8000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_EMBEDDING}:embedContent?key=${chave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: texto.slice(0, 8000) }] },
        taskType,
        outputDimensionality: DIMENSOES,
      }),
      signal: controlador.signal,
    });
    if (!res.ok) {
      console.error('Cerebro: embedding falhou', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const valores = data?.embedding?.values;
    // com dimensao reduzida (768 em vez de 3072) o Gemini NAO devolve o vetor normalizado -
    // normaliza aqui uma vez e a similaridade vira um produto escalar simples depois
    return Array.isArray(valores) && valores.length === DIMENSOES ? normalizar(valores) : null;
  } catch (err) {
    console.error('Cerebro: embedding falhou', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const paraBytea = (vetor) => (vetor ? Buffer.from(vetor.buffer, vetor.byteOffset, vetor.byteLength) : null);
function deBytea(buf) {
  if (!buf || buf.length !== DIMENSOES * 4) return null;
  // copia pra um ArrayBuffer alinhado (o Buffer do pg pode vir com offset nao multiplo de 4)
  const copia = new Uint8Array(buf.length);
  copia.set(buf);
  return new Float32Array(copia.buffer);
}

function produto(a, b) {
  let s = 0;
  for (let i = 0; i < DIMENSOES; i++) s += a[i] * b[i];
  return s;
}

// ---------- cache de vetores por tenant (so carrega quando o tenant usa o Cerebro) ----------

const cacheVetores = new Map(); // tenantId -> { carregadoEm, itens: [{ id, projeto, vetor }] }
const CACHE_TTL_MS = 10 * 60 * 1000;

async function vetoresDoTenant(tenantId) {
  const atual = cacheVetores.get(tenantId);
  if (atual && Date.now() - atual.carregadoEm < CACHE_TTL_MS) return atual.itens;
  const { rows } = await pool.query(
    'SELECT id, projeto, embedding FROM cerebro_memorias WHERE tenant_id = $1 AND NOT arquivada AND embedding IS NOT NULL',
    [tenantId],
  );
  const itens = rows.map((r) => ({ id: r.id, projeto: r.projeto, vetor: deBytea(r.embedding) })).filter((i) => i.vetor);
  cacheVetores.set(tenantId, { carregadoEm: Date.now(), itens });
  return itens;
}

const invalidarCache = (tenantId) => cacheVetores.delete(tenantId);

function maisParecidas(itens, vetor, { limite, minimo = 0, ignorarId = null, projeto = null, bonusProjeto = null }) {
  const pontuados = [];
  for (const item of itens) {
    if (item.id === ignorarId) continue;
    if (projeto && item.projeto !== projeto) continue;
    const s = produto(item.vetor, vetor) + (bonusProjeto && item.projeto === bonusProjeto ? BONUS_MESMO_PROJETO : 0);
    if (s >= minimo) pontuados.push({ id: item.id, similaridade: s });
  }
  pontuados.sort((a, b) => b.similaridade - a.similaridade);
  return pontuados.slice(0, limite);
}

// ---------- memorias ----------

function limparTexto(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function limparTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 40));
}

const colunasPublicas = 'id, titulo, conteudo, tipo, projeto, origem, tags, criado_em, atualizado_em';

export async function salvarMemoria(tenantId, { titulo, conteudo, tipo, projeto, origem, tags, relacionadas } = {}) {
  exigirBanco();
  await tabelasProntas;
  const texto = limparTexto(conteudo, 20000);
  if (!texto) throw new Error('conteudo da memoria e obrigatorio');
  const tituloLimpo = limparTexto(titulo, 200);
  const tipoLimpo = TIPOS.includes(tipo) ? tipo : 'fato';
  const origemLimpa = ORIGENS.includes(origem) ? origem : 'outra';
  const projetoLimpo = limparTexto(projeto, 80);

  const vetor = await gerarEmbedding([tituloLimpo, texto].filter(Boolean).join('\n'), 'RETRIEVAL_DOCUMENT');
  const { rows } = await pool.query(
    `INSERT INTO cerebro_memorias (tenant_id, titulo, conteudo, tipo, projeto, origem, tags, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${colunasPublicas}`,
    [tenantId, tituloLimpo, texto, tipoLimpo, projetoLimpo, origemLimpa, limparTags(tags), paraBytea(vetor)],
  );
  const memoria = rows[0];

  // liga sozinha as memorias mais parecidas (e isso que forma a "teia" do grafo), mais as que a
  // propria IA disse que sao relacionadas
  const ligacoes = [];
  if (vetor) {
    const itens = await vetoresDoTenant(tenantId);
    for (const p of maisParecidas(itens, vetor, { limite: LIGACOES_AUTO, minimo: SIMILARIDADE_MIN_LIGACAO, ignorarId: memoria.id, bonusProjeto: projetoLimpo })) {
      ligacoes.push([p.id, p.similaridade]);
    }
  }
  if (Array.isArray(relacionadas)) {
    for (const id of relacionadas.map(Number).filter(Number.isInteger).slice(0, 10)) ligacoes.push([id, 1]);
  }
  const ligadas = [];
  for (const [destino, peso] of ligacoes) {
    // o subselect garante que so liga com memoria do PROPRIO tenant (id vindo da IA nao e confiavel)
    const { rowCount } = await pool.query(
      `INSERT INTO cerebro_ligacoes (tenant_id, origem_id, destino_id, peso)
       SELECT $1, $2, id, $4 FROM cerebro_memorias WHERE id = $3 AND tenant_id = $1 AND id <> $2
       ON CONFLICT DO NOTHING`,
      [tenantId, memoria.id, destino, peso],
    );
    if (rowCount) ligadas.push(destino);
  }
  invalidarCache(tenantId);
  return { ...memoria, ligadaA: ligadas, semEmbedding: !vetor };
}

export async function atualizarMemoria(tenantId, id, campos = {}) {
  exigirBanco();
  await tabelasProntas;
  const { rows: atuais } = await pool.query(
    'SELECT titulo, conteudo FROM cerebro_memorias WHERE id = $1 AND tenant_id = $2 AND NOT arquivada',
    [id, tenantId],
  );
  if (!atuais[0]) throw new Error('memoria nao encontrada');
  const sets = [];
  const valores = [id, tenantId];
  const add = (coluna, valor) => { valores.push(valor); sets.push(`${coluna} = $${valores.length}`); };
  if (campos.titulo !== undefined) add('titulo', limparTexto(campos.titulo, 200));
  if (campos.conteudo !== undefined) {
    const t = limparTexto(campos.conteudo, 20000);
    if (!t) throw new Error('conteudo nao pode ficar vazio');
    add('conteudo', t);
  }
  if (campos.tipo !== undefined && TIPOS.includes(campos.tipo)) add('tipo', campos.tipo);
  if (campos.projeto !== undefined) add('projeto', limparTexto(campos.projeto, 80));
  if (campos.tags !== undefined) add('tags', limparTags(campos.tags));
  if (campos.titulo !== undefined || campos.conteudo !== undefined) {
    const titulo = campos.titulo !== undefined ? campos.titulo : atuais[0].titulo;
    const conteudo = campos.conteudo !== undefined ? campos.conteudo : atuais[0].conteudo;
    add('embedding', paraBytea(await gerarEmbedding([titulo, conteudo].filter(Boolean).join('\n'), 'RETRIEVAL_DOCUMENT')));
  }
  if (!sets.length) throw new Error('nada pra atualizar');
  const { rows } = await pool.query(
    `UPDATE cerebro_memorias SET ${sets.join(', ')}, atualizado_em = now() WHERE id = $1 AND tenant_id = $2 RETURNING ${colunasPublicas}`,
    valores,
  );
  invalidarCache(tenantId);
  return rows[0];
}

// arquiva em vez de apagar de verdade - uma IA mandando "esquecer" algo por engano nao vira
// perda definitiva (da pra restaurar direto no banco se precisar)
export async function arquivarMemoria(tenantId, id) {
  exigirBanco();
  await tabelasProntas;
  const { rowCount } = await pool.query(
    'UPDATE cerebro_memorias SET arquivada = true, atualizado_em = now() WHERE id = $1 AND tenant_id = $2 AND NOT arquivada',
    [id, tenantId],
  );
  if (!rowCount) throw new Error('memoria nao encontrada');
  invalidarCache(tenantId);
}

export async function obterMemoria(tenantId, id) {
  exigirBanco();
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT ${colunasPublicas} FROM cerebro_memorias WHERE id = $1 AND tenant_id = $2 AND NOT arquivada`,
    [id, tenantId],
  );
  if (!rows[0]) return null;
  const { rows: rel } = await pool.query(
    `SELECT m.id, m.titulo, m.conteudo, m.origem, m.tipo, m.projeto, m.criado_em FROM cerebro_ligacoes l
     JOIN cerebro_memorias m ON m.id = CASE WHEN l.origem_id = $1 THEN l.destino_id ELSE l.origem_id END
     WHERE l.tenant_id = $2 AND (l.origem_id = $1 OR l.destino_id = $1) AND NOT m.arquivada
     ORDER BY l.peso DESC LIMIT 20`,
    [id, tenantId],
  );
  return { ...rows[0], relacionadas: rel };
}

export async function buscarMemorias(tenantId, { consulta, projeto, limite = 8 } = {}) {
  exigirBanco();
  await tabelasProntas;
  const n = Math.min(Math.max(Number(limite) || 8, 1), 30);
  const projetoLimpo = limparTexto(projeto, 80);
  const texto = limparTexto(consulta, 2000);
  if (!texto) return listarMemorias(tenantId, { projeto: projetoLimpo, limite: n });

  const vetor = await gerarEmbedding(texto, 'RETRIEVAL_QUERY');
  if (vetor) {
    // corte RELATIVO ao melhor resultado (mesma faixa espremida do Gemini comentada la em cima):
    // um corte fixo ou deixava passar coisa sem relacao nenhuma ou cortava resultado bom
    const candidatas = maisParecidas(await vetoresDoTenant(tenantId), vetor, { limite: n, minimo: 0.55, projeto: projetoLimpo });
    const corte = candidatas.length ? Math.max(0.58, candidatas[0].similaridade - 0.12) : 1;
    const melhores = candidatas.filter((c) => c.similaridade >= corte);
    if (melhores.length) {
      const { rows } = await pool.query(
        `SELECT ${colunasPublicas} FROM cerebro_memorias WHERE tenant_id = $1 AND id = ANY($2::int[])`,
        [tenantId, melhores.map((m) => m.id)],
      );
      const porId = new Map(rows.map((r) => [r.id, r]));
      return melhores.filter((m) => porId.has(m.id)).map((m) => ({ ...porId.get(m.id), similaridade: Number(m.similaridade.toFixed(3)) }));
    }
  }
  // fallback por texto (sem Gemini, ou memorias antigas sem embedding)
  const termos = texto.split(/\s+/).filter((t) => t.length > 2).slice(0, 6);
  if (!termos.length) return [];
  const valores = [tenantId];
  const conds = termos.map((t) => { valores.push(`%${t}%`); return `(conteudo ILIKE $${valores.length} OR titulo ILIKE $${valores.length})`; });
  let filtroProjeto = '';
  if (projetoLimpo) { valores.push(projetoLimpo); filtroProjeto = ` AND projeto = $${valores.length}`; }
  valores.push(n);
  const { rows } = await pool.query(
    `SELECT ${colunasPublicas} FROM cerebro_memorias WHERE tenant_id = $1 AND NOT arquivada${filtroProjeto} AND (${conds.join(' OR ')})
     ORDER BY criado_em DESC LIMIT $${valores.length}`,
    valores,
  );
  return rows;
}

export async function listarMemorias(tenantId, { projeto, tipo, origem, limite = 20 } = {}) {
  exigirBanco();
  await tabelasProntas;
  const valores = [tenantId];
  const filtros = ['tenant_id = $1', 'NOT arquivada'];
  if (projeto) { valores.push(projeto); filtros.push(`projeto = $${valores.length}`); }
  if (tipo) { valores.push(tipo); filtros.push(`tipo = $${valores.length}`); }
  if (origem) { valores.push(origem); filtros.push(`origem = $${valores.length}`); }
  valores.push(Math.min(Math.max(Number(limite) || 20, 1), 100));
  const { rows } = await pool.query(
    `SELECT ${colunasPublicas} FROM cerebro_memorias WHERE ${filtros.join(' AND ')} ORDER BY criado_em DESC LIMIT $${valores.length}`,
    valores,
  );
  return rows;
}

export async function listarProjetos(tenantId) {
  exigirBanco();
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT projeto, count(*)::int AS total, max(criado_em) AS ultima FROM cerebro_memorias
     WHERE tenant_id = $1 AND NOT arquivada AND projeto IS NOT NULL GROUP BY projeto ORDER BY ultima DESC`,
    [tenantId],
  );
  return rows;
}

// dados do grafo 3D da aba - so o necessario pra desenhar (o conteudo completo de cada memoria
// e buscado sob demanda quando o usuario clica num no, via obterMemoria)
export async function grafo(tenantId) {
  exigirBanco();
  await tabelasProntas;
  const { rows: nos } = await pool.query(
    `SELECT id, titulo, left(conteudo, 140) AS resumo, tipo, projeto, origem, criado_em FROM cerebro_memorias
     WHERE tenant_id = $1 AND NOT arquivada ORDER BY criado_em DESC LIMIT ${MAX_NOS_GRAFO}`,
    [tenantId],
  );
  const ids = nos.map((n) => n.id);
  const { rows: links } = ids.length
    ? await pool.query(
      `SELECT origem_id AS source, destino_id AS target, peso FROM cerebro_ligacoes
       WHERE tenant_id = $1 AND origem_id = ANY($2::int[]) AND destino_id = ANY($2::int[])`,
      [tenantId, ids],
    )
    : { rows: [] };
  const { rows: tot } = await pool.query('SELECT count(*)::int AS total FROM cerebro_memorias WHERE tenant_id = $1 AND NOT arquivada', [tenantId]);
  return { nos, links, total: tot[0].total, limite: MAX_NOS_GRAFO };
}

// ---------- tokens de conexao MCP ----------

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function criarToken(tenantId, { nome, origem }) {
  exigirBanco();
  await tabelasProntas;
  const nomeLimpo = limparTexto(nome, 60);
  if (!nomeLimpo) throw new Error('de um nome pra conexao (ex: "Claude do notebook")');
  const origemLimpa = ORIGENS.includes(origem) ? origem : 'outra';
  const token = `crb_${crypto.randomBytes(24).toString('base64url')}`;
  const { rows } = await pool.query(
    `INSERT INTO cerebro_tokens (tenant_id, nome, origem, token_hash, prefixo) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, nomeLimpo, origemLimpa, hashToken(token), token.slice(0, 10)],
  );
  return { id: rows[0].id, token };
}

export async function listarTokens(tenantId) {
  exigirBanco();
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome, origem, prefixo, criado_em, ultimo_uso_em FROM cerebro_tokens
     WHERE tenant_id = $1 AND NOT revogado ORDER BY criado_em DESC`,
    [tenantId],
  );
  return rows;
}

export async function revogarToken(tenantId, id) {
  exigirBanco();
  await tabelasProntas;
  await pool.query('UPDATE cerebro_tokens SET revogado = true WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

// usado pelo endpoint MCP: token -> { tenantId, origem }. Tambem bloqueia se o tenant foi
// desativado ou se o Cerebro foi desligado pra ele (cliente parou de pagar) - o super_admin
// nunca fica bloqueado aqui, mesma regra das abas
export async function autenticarToken(token) {
  if (!pool || !token || typeof token !== 'string' || !token.startsWith('crb_')) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT t.id, t.tenant_id, t.origem, tn.ativo, tn.super_admin, coalesce(c.cerebro_liberado, false) AS liberado
     FROM cerebro_tokens t
     JOIN tenants tn ON tn.id = t.tenant_id
     LEFT JOIN tenant_config c ON c.tenant_id = t.tenant_id
     WHERE t.token_hash = $1 AND NOT t.revogado`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r || !r.ativo || !(r.super_admin || r.liberado)) return null;
  pool.query('UPDATE cerebro_tokens SET ultimo_uso_em = now() WHERE id = $1', [r.id]).catch(() => {});
  return { tenantId: r.tenant_id, origem: r.origem };
}
