// API interna do servico de video - so a Lumia fala com ele (rede interna do Docker, sem dominio
// publico), autenticando com VIDEO_WORKER_SECRET. Quem cuida de login, tenant e permissao e a
// Lumia; aqui so chega pedido ja autorizado, sempre com o tenantId junto pra conferir dono.
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import express from 'express';
import * as fila from './fila.js';

const PORT = Number(process.env.PORT || 4100);
const SEGREDO = process.env.VIDEO_WORKER_SECRET || '';
const TAMANHO_MAX = Number(process.env.TAMANHO_MAX_MB || 1024) * 1024 * 1024;

const app = express();

const ehLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// o renderizador (Chrome headless rodando AQUI dentro) le o video padronizado por essa rota -
// so aceita conexao da propria maquina
app.get('/interno/midia/:id/base.mp4', (req, res) => {
  if (!ehLoopback(req) || !fila.idValido(req.params.id)) return res.status(403).end();
  res.sendFile(`${fila.pasta(req.params.id)}/base.mp4`);
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

// confere que a edicao existe e e do tenant que esta pedindo
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

// upload do video bruto: corpo cru (streaming direto pro disco, nunca inteiro em memoria)
app.post('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const tenantId = Number(req.query.tenant);
  if (!fila.idValido(id) || !Number.isInteger(tenantId)) return res.status(400).json({ erro: 'parametros invalidos' });
  if (await fila.obter(id)) return res.status(409).json({ erro: 'edicao ja existe' });
  if (Number(req.header('content-length') || 0) > TAMANHO_MAX) return res.status(413).json({ erro: `arquivo maior que ${TAMANHO_MAX / 1024 / 1024} MB` });

  let opcoes = {};
  try { opcoes = JSON.parse(req.header('x-opcoes') ? Buffer.from(req.header('x-opcoes'), 'base64').toString('utf8') : '{}'); } catch { /* opcoes padrao */ }
  await fila.criar({ id, tenantId, nomeOriginal: String(req.query.nome || 'video').slice(0, 200), opcoes });

  let recebidos = 0;
  req.on('data', (c) => {
    recebidos += c.length;
    if (recebidos > TAMANHO_MAX) req.destroy(new Error('arquivo grande demais'));
  });
  try {
    await pipeline(req, fs.createWriteStream(fila.arquivoOriginal(id)));
  } catch (err) {
    await fila.apagar(id);
    return res.status(400).json({ erro: `falha no envio: ${err.message}` });
  }
  if (recebidos < 1000) {
    await fila.apagar(id);
    return res.status(400).json({ erro: 'arquivo vazio' });
  }
  await fila.recebido(id);
  res.json(publico(await fila.obter(id)));
});

app.get('/jobs/:id', async (req, res) => {
  const job = await carregar(req, res);
  if (job) res.json(publico(job));
});

app.post('/jobs/:id/ajustar', express.json(), async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const pedido = String(req.body?.pedido || '').trim();
  if (!pedido) return res.status(400).json({ erro: 'descreva o ajuste' });
  try {
    await fila.pedirAjuste(job.id, pedido);
    res.json(publico(await fila.obter(job.id)));
  } catch (err) {
    res.status(409).json({ erro: err.message });
  }
});

app.get('/jobs/:id/:arquivo(video|capa)', async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  const caminho = `${fila.pasta(job.id)}/${fila.NOME_ARQUIVOS[req.params.arquivo]}`;
  if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'arquivo ainda nao esta pronto' });
  res.sendFile(caminho, { headers: { 'Cache-Control': 'private, max-age=60' } });
});

app.delete('/jobs/:id', async (req, res) => {
  const job = await carregar(req, res);
  if (!job) return;
  await fila.apagar(job.id);
  res.json({ ok: true });
});

await fila.iniciar();
app.listen(PORT, () => console.log(`servico de video ouvindo na porta ${PORT}`));
