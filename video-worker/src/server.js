// API interna do servico de video - so a Lumia fala com ele (rede interna do Docker, sem dominio
// publico), autenticando com VIDEO_WORKER_SECRET. Quem cuida de login, tenant e permissao e a
// Lumia; aqui so chega pedido ja autorizado, sempre com o tenantId junto pra conferir dono.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import express from 'express';
import * as fila from './fila.js';

const PORT = Number(process.env.PORT || 4100);
const SEGREDO = process.env.VIDEO_WORKER_SECRET || '';
const TAMANHO_MAX = Number(process.env.TAMANHO_MAX_MB || 1024) * 1024 * 1024;
const TIPOS_MIDIA = ['principal', 'referencia', 'apoio'];

const app = express();

const ehLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// o renderizador (Chrome headless rodando AQUI dentro) le o video padronizado e as midias de
// apoio por essa rota - so aceita conexao da propria maquina e so esses arquivos
app.get(/^\/interno\/midia\/([a-zA-Z0-9_-]{8,64})\/(base\.mp4|midias\/[a-f0-9]{16}\/pronto\.(?:mp4|jpg|m4a))$/, (req, res) => {
  if (!ehLoopback(req)) return res.status(403).end();
  res.sendFile(path.join(fila.pasta(req.params[0]), req.params[1]));
});

app.get('/saude', (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  const recebido = Buffer.from(req.header('x-worker-secret') || '');
  const esperado = Buffer.from(SEGREDO);
  if (!SEGREDO || recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
    return res.status(401).json({ erro: 'nao autorizado' });
  }
  next();
});

const rota = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 400).json({ erro: err.message });
  }
};

// confere que o projeto existe e e do tenant que esta pedindo
async function carregar(req, res) {
  const { id } = req.params;
  const tenantId = Number(req.query.tenant);
  if (!fila.idValido(id)) { res.status(400).json({ erro: 'id invalido' }); return null; }
  const job = await fila.obter(id);
  if (!job || job.tenantId !== tenantId) { res.status(404).json({ erro: 'edicao nao encontrada' }); return null; }
  return job;
}

function publico(job) {
  const { pendente, ...resto } = job;
  return { ...resto, posicaoFila: fila.posicaoNaFila(job.id), ajustePendente: pendente?.tipo === 'ajuste' ? pendente.pedido : null };
}

app.post('/jobs/:id', express.json(), rota(async (req, res) => {
  const { id } = req.params;
  const tenantId = Number(req.query.tenant);
  if (!fila.idValido(id) || !Number.isInteger(tenantId)) return res.status(400).json({ erro: 'parametros invalidos' });
  if (await fila.obter(id)) return res.status(409).json({ erro: 'projeto ja existe' });
  res.json(publico(await fila.criar({ id, tenantId, nome: req.body?.nome, opcoes: req.body?.opcoes || {} })));
}));

app.get('/jobs/:id', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (job) res.json(publico(job));
}));

app.patch('/jobs/:id/opcoes', express.json(), rota(async (req, res) => {
  const job = await carregar(req, res);
  if (job) res.json(publico(await fila.atualizarOpcoes(job.id, req.body || {})));
}));

// upload de midia: corpo cru, streaming direto pro disco (nunca o arquivo inteiro em memoria)
app.put('/jobs/:id/midias', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const tipo = String(req.query.tipo || '');
  if (!TIPOS_MIDIA.includes(tipo)) return res.status(400).json({ erro: 'tipo de midia invalido' });
  if (Number(req.header('content-length') || 0) > TAMANHO_MAX) return res.status(413).json({ erro: `arquivo maior que ${TAMANHO_MAX / 1024 / 1024} MB` });
  const mid = crypto.randomBytes(8).toString('hex');
  const dir = fila.pastaMidia(job.id, mid);
  fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, 'original');
  let recebidos = 0;
  req.on('data', (c) => {
    recebidos += c.length;
    if (recebidos > TAMANHO_MAX) req.destroy(new Error('arquivo grande demais'));
  });
  try {
    await pipeline(req, fs.createWriteStream(destino));
    if (recebidos < 100) throw new Error('arquivo vazio');
    const registro = await fila.registrarMidia(job.id, {
      mid, tipo, nome: String(req.query.nome || 'arquivo'), mime: String(req.query.mime || ''), arquivo: destino, tamanho: recebidos,
    });
    res.json(registro);
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    res.status(400).json({ erro: err.message });
  }
}));

app.delete('/jobs/:id/midias/:mid', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  await fila.removerMidia(job.id, req.params.mid);
  res.json(publico(await fila.obter(job.id)));
}));

app.get('/jobs/:id/midias/:mid/:qual(miniatura|arquivo)', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const m = (job.midias || []).find((x) => x.id === req.params.mid);
  if (!m) return res.status(404).json({ erro: 'midia nao encontrada' });
  const caminho = fila.arquivoMidia(job.id, m.id, req.params.qual);
  if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'arquivo indisponivel' });
  res.sendFile(caminho, { headers: { 'Cache-Control': 'private, max-age=300' } });
}));

app.post('/jobs/:id/iniciar', express.json(), rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  try {
    await fila.iniciar(job.id, req.body || {});
  } catch (err) {
    return res.status(409).json({ erro: err.message });
  }
  res.json(publico(await fila.obter(job.id)));
}));

app.post('/jobs/:id/ajustar', express.json(), rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const pedido = String(req.body?.pedido || '').trim();
  if (!pedido) return res.status(400).json({ erro: 'descreva o ajuste' });
  try {
    await fila.pedirAjuste(job.id, pedido);
  } catch (err) {
    return res.status(409).json({ erro: err.message });
  }
  res.json(publico(await fila.obter(job.id)));
}));

app.get('/jobs/:id/linha-do-tempo', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const dados = await fila.linhaDoTempo(job.id);
  if (!dados) return res.status(404).json({ erro: 'linha do tempo ainda nao existe' });
  res.json(dados);
}));

app.get('/jobs/:id/:arquivo(video|capa|tira)', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const caminho = path.join(fila.pasta(job.id), fila.NOME_ARQUIVOS[req.params.arquivo]);
  if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'arquivo ainda nao esta pronto' });
  res.sendFile(caminho, { headers: { 'Cache-Control': 'private, max-age=30' } });
}));

app.delete('/jobs/:id', rota(async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  await fila.apagar(job.id);
  res.json({ ok: true });
}));

// deploy novo: devolve a edicao em andamento pra fila (o container novo retoma) e sai
for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, async () => {
    await fila.encerrar();
    process.exit(0);
  });
}

await fila.iniciarServico();
app.listen(PORT, () => console.log(`servico de video ouvindo na porta ${PORT}`));
