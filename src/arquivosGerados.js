// arquivos gerados pela Lumia (PDF, Word, Excel, grafico, imagem de IA) ficam guardados aqui
// em memoria por um tempo curto - o suficiente pro usuario baixar depois de pedir. Nao precisa
// de disco nem storage externo: e um arquivo por sessao de uso, nao um historico permanente.
import crypto from 'crypto';

const TTL_MS = 30 * 60 * 1000; // 30min - da tempo de sobra pro usuario clicar em "baixar"
const arquivos = new Map();

export function guardarArquivo(buffer, nomeArquivo, mediaType) {
  const id = crypto.randomUUID();
  arquivos.set(id, { buffer, nomeArquivo, mediaType, criadoEm: Date.now() });
  return id;
}

export function obterArquivo(id) {
  const item = arquivos.get(id);
  if (!item) return null;
  if (Date.now() - item.criadoEm > TTL_MS) { arquivos.delete(id); return null; }
  return item;
}

setInterval(() => {
  const agora = Date.now();
  for (const [id, item] of arquivos) {
    if (agora - item.criadoEm > TTL_MS) arquivos.delete(id);
  }
}, 5 * 60 * 1000).unref();
