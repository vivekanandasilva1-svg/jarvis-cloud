// Editor de Video (aba "Editor de Vídeo"): a Lumia so guarda QUEM e dono de cada projeto e faz a
// ponte com o servico de video (video-worker/, container separado na VPS com CPU/memoria
// limitados). Todo o trabalho pesado - preparar o video, transcrever, estudar a referencia, a IA
// dirigir a edicao e renderizar - acontece la, entao o app continua leve pra todo mundo enquanto
// um video e editado.
//
// Uploads e downloads passam por aqui em STREAMING (nunca o arquivo inteiro em memoria) - o
// servico de video nao tem dominio publico, so a Lumia fala com ele, sempre mandando o tenantId
// pra ele conferir o dono de novo.
//
// Recurso pago a parte (mesma logica do Cerebro): desligado por padrao, o super admin libera por
// cliente na aba Clientes.
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { tabelasProntas as tenantConfigPronto } from './tenantConfig.js';

// endereco interno do servico na rede do Docker; a senha entre os dois e derivada do
// SESSION_SECRET que o app ja tem (o servico recebe o mesmo valor no deploy) - sem precisar de
// mais uma variavel de ambiente pra manter sincronizada
const WORKER_URL = process.env.VIDEO_WORKER_URL || 'http://lumia-video:4100';
const WORKER_SECRET = process.env.VIDEO_WORKER_SECRET
  || (process.env.SESSION_SECRET ? crypto.createHmac('sha256', process.env.SESSION_SECRET).update('lumia-video-worker').digest('hex') : '');

const TAMANHO_MAX = 1024 * 1024 * 1024;
const STATUS_FINAIS = ['pronto', 'erro', 'expirado', 'rascunho'];

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await tenantConfigPronto;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_edicoes (
      id TEXT PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome_arquivo TEXT,
      estilo TEXT,
      formato TEXT,
      titulo TEXT,
      status TEXT NOT NULL DEFAULT 'enviando',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS video_edicoes_tenant_idx ON video_edicoes (tenant_id, criado_em DESC);');
  await pool.query('ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS video_liberado BOOLEAN NOT NULL DEFAULT false;');
}

export const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Editor de Video:', err.message);
});

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });

function exigirConfig() {
  if (!pool) throw erro('O Editor de Vídeo precisa do Postgres configurado.', 500);
  if (!WORKER_URL || !WORKER_SECRET) throw erro('O serviço de vídeo ainda não está configurado neste servidor.', 500);
}

export async function estaLiberado(tenantId) {
  if (!pool) return false;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT video_liberado FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return !!rows[0]?.video_liberado;
}

export async function definirLiberado(tenantId, liberado) {
  if (!pool) throw new Error('Postgres nao configurado');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, video_liberado, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET video_liberado = $2, atualizado_em = now()`,
    [tenantId, !!liberado],
  );
}

function urlWorker(caminho, tenantId, extra = {}) {
  const u = new URL(caminho, WORKER_URL);
  u.searchParams.set('tenant', String(tenantId));
  for (const [k, v] of Object.entries(extra)) if (v != null) u.searchParams.set(k, v);
  return u;
}

async function chamarWorker(caminho, tenantId, { metodo = 'GET', corpo, timeout = 20000 } = {}) {
  const res = await fetch(urlWorker(caminho, tenantId), {
    method: metodo,
    headers: { 'x-worker-secret': WORKER_SECRET, ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw erro(dados.erro || `serviço de vídeo respondeu ${res.status}`, res.status);
  return dados;
}

async function garantirDono(tenantId, id) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM video_edicoes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!rows[0]) throw erro('projeto não encontrado', 404);
  return rows[0];
}

// guarda status/titulo na tabela pra lista abrir rapido sem consultar o servico pra cada item
async function sincronizar(tenantId, id, job) {
  await pool.query(
    `UPDATE video_edicoes SET status = $3, titulo = coalesce($4, titulo), nome_arquivo = coalesce($5, nome_arquivo),
       estilo = coalesce($6, estilo), formato = coalesce($7, formato), atualizado_em = now()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId, job.status, job.titulo || null, job.nomeOriginal || null, job.opcoes?.estilo || null, job.opcoes?.formato || null],
  );
}

function resumoJob(linha, job) {
  return {
    id: linha.id,
    nomeArquivo: job?.nomeOriginal || linha.nome_arquivo,
    estilo: job?.opcoes?.estilo || linha.estilo,
    formato: job?.opcoes?.formato || linha.formato,
    criadoEm: linha.criado_em,
    titulo: job?.titulo || linha.titulo,
    status: job?.status || linha.status,
    etapa: job?.etapa || null,
    progresso: job?.progresso ?? null,
    posicaoFila: job?.posicaoFila || 0,
    erro: job?.erro || null,
    resumo: job?.resumo || null,
    duracaoOriginal: job?.meta?.duracao || null,
    duracaoFinal: job?.duracaoFinal || null,
    contagem: job?.contagem || null,
    problemasCorrigidos: job?.problemasCorrigidos || [],
    ajustes: job?.ajustes || [],
    ajustePendente: job?.ajustePendente || null,
    opcoes: job?.opcoes || null,
    midias: job?.midias || [],
    referencia: job?.referencia || null,
    completo: !!job,
  };
}

export async function criar(tenantId, { nome, opcoes } = {}) {
  exigirConfig();
  await tabelasProntas;
  const id = crypto.randomBytes(12).toString('hex');
  const nomeProjeto = String(nome || 'Novo projeto').slice(0, 200);
  await pool.query(
    'INSERT INTO video_edicoes (id, tenant_id, nome_arquivo, estilo, formato, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, tenantId, nomeProjeto, opcoes?.estilo || 'criador', opcoes?.formato || '9:16', 'rascunho'],
  );
  try {
    const job = await chamarWorker(`/jobs/${id}`, tenantId, { metodo: 'POST', corpo: { nome: nomeProjeto, opcoes: opcoes || {} } });
    return resumoJob({ id, criado_em: new Date() }, job);
  } catch (err) {
    await pool.query('DELETE FROM video_edicoes WHERE id = $1', [id]).catch(() => {});
    throw err;
  }
}

export async function listar(tenantId) {
  exigirConfig();
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM video_edicoes WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 60', [tenantId]);
  // so consulta o servico pras que ainda estao em andamento (as outras ja tem status salvo)
  return Promise.all(rows.map(async (linha) => {
    // 'erro' tambem e reconsultado: uma edicao com erro pode ter sido retomada e terminado depois
    if (STATUS_FINAIS.includes(linha.status) && linha.status !== 'erro') return resumoJob(linha, null);
    try {
      const job = await chamarWorker(`/jobs/${linha.id}`, tenantId);
      await sincronizar(tenantId, linha.id, job);
      return resumoJob(linha, job);
    } catch (err) {
      if (err.status === 404) {
        await pool.query("UPDATE video_edicoes SET status = 'expirado' WHERE id = $1", [linha.id]);
        return resumoJob({ ...linha, status: 'expirado' }, null);
      }
      return resumoJob(linha, null);
    }
  }));
}

export async function obter(tenantId, id) {
  exigirConfig();
  const linha = await garantirDono(tenantId, id);
  try {
    const job = await chamarWorker(`/jobs/${id}`, tenantId);
    await sincronizar(tenantId, id, job);
    return resumoJob(linha, job);
  } catch (err) {
    if (err.status === 404) {
      await pool.query("UPDATE video_edicoes SET status = 'expirado' WHERE id = $1", [id]);
      return resumoJob({ ...linha, status: 'expirado' }, null);
    }
    throw err;
  }
}

// acoes simples (JSON) repassadas pro servico depois de conferir o dono
export async function acao(tenantId, id, caminho, metodo, corpo) {
  exigirConfig();
  const linha = await garantirDono(tenantId, id);
  const job = await chamarWorker(`/jobs/${id}${caminho}`, tenantId, { metodo, corpo });
  if (job?.status) await sincronizar(tenantId, id, job);
  return job?.status ? resumoJob(linha, job) : job;
}

export async function linhaDoTempo(tenantId, id) {
  exigirConfig();
  await garantirDono(tenantId, id);
  return chamarWorker(`/jobs/${id}/linha-do-tempo`, tenantId);
}

// upload de midia (principal, referencia ou apoio): o corpo da requisicao vai direto pro servico
export async function enviarMidia(tenantId, id, req) {
  exigirConfig();
  await garantirDono(tenantId, id);
  const tamanho = Number(req.header('content-length') || 0);
  if (!tamanho) throw erro('envie o arquivo');
  if (tamanho > TAMANHO_MAX) throw erro('o arquivo passa de 1 GB - envie um arquivo menor', 413);
  const res = await fetch(urlWorker(`/jobs/${id}/midias`, tenantId, {
    tipo: String(req.query.tipo || ''), nome: String(req.query.nome || 'arquivo').slice(0, 200), mime: String(req.query.mime || '').slice(0, 100),
  }), {
    method: 'PUT',
    headers: { 'x-worker-secret': WORKER_SECRET, 'content-type': 'application/octet-stream', 'content-length': String(tamanho) },
    body: Readable.toWeb(req),
    duplex: 'half',
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw erro(dados.erro || `falha no envio (${res.status})`, res.status);
  const job = await chamarWorker(`/jobs/${id}`, tenantId);
  await sincronizar(tenantId, id, job);
  return dados;
}

export async function apagar(tenantId, id) {
  exigirConfig();
  await garantirDono(tenantId, id);
  await chamarWorker(`/jobs/${id}`, tenantId, { metodo: 'DELETE' }).catch((err) => { if (err.status !== 404) throw err; });
  await pool.query('DELETE FROM video_edicoes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

// arquivos (video final, capa, tira da linha do tempo, midias): repassa em streaming, incluindo
// Range (o <video> do navegador pede pedacos pra conseguir avancar e voltar sem baixar tudo)
export async function transmitirArquivo(tenantId, id, caminho, req, res) {
  exigirConfig();
  const linha = await garantirDono(tenantId, id);
  const headers = { 'x-worker-secret': WORKER_SECRET };
  if (req.headers.range) headers.range = req.headers.range;
  const resposta = await fetch(urlWorker(`/jobs/${id}/${caminho}`, tenantId), { headers });
  if (!resposta.ok && resposta.status !== 206) {
    res.status(resposta.status).json(await resposta.json().catch(() => ({ erro: 'arquivo indisponível' })));
    return;
  }
  res.status(resposta.status);
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = resposta.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.setHeader('Cache-Control', 'private, max-age=30');
  if (caminho === 'video' && req.query.baixar === '1') {
    const nome = (linha.titulo || linha.nome_arquivo || 'video').replace(/[^\w\-. À-ú]+/g, '').trim().slice(0, 80) || 'video';
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${nome} - editado.mp4`)}`);
  }
  await pipeline(Readable.fromWeb(resposta.body), res);
}
