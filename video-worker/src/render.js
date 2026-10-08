// renderizacao com Remotion. O pacote da composicao (webpack) e gerado UMA vez no build da
// imagem Docker (src/bundle.js) - em tempo de execucao so renderiza, sem recompilar nada.
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_BUNDLE = process.env.REMOTION_BUNDLE || path.join(RAIZ, 'bundle');

async function servirDe() {
  try {
    await fs.access(path.join(PASTA_BUNDLE, 'index.html'));
    return PASTA_BUNDLE;
  } catch {
    // ambiente de desenvolvimento sem bundle pre-gerado
    const { gerarBundle } = await import('./bundle.js');
    return gerarBundle();
  }
}

// 1 aba do Chrome e 1 thread de video por vez: o servico roda com limite de CPU/memoria pra
// nunca disputar recurso com a Lumia - mais lento, mas previsivel
const CONCORRENCIA = Number(process.env.RENDER_CONCORRENCIA || 1);

export async function renderizar(roteiro, saida, aoProgredir) {
  const serveUrl = await servirDe();
  const composition = await selectComposition({ serveUrl, id: 'Edicao', inputProps: roteiro });
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: saida, inputProps: roteiro,
    concurrency: CONCORRENCIA, crf: 20, x264Preset: 'veryfast', audioBitrate: '192k', pixelFormat: 'yuv420p',
    offthreadVideoThreads: 1, offthreadVideoCacheSizeInBytes: 96 * 1024 * 1024,
    timeoutInMilliseconds: 120000,
    onProgress: ({ progress }) => aoProgredir?.(progress),
  });
}

// SVG (desenhado pelo Claude) -> PNG com transparencia
export async function rasterizarSvg(svg, largura, altura, saida) {
  const serveUrl = await servirDe();
  const inputProps = { svg, largura, altura };
  const composition = await selectComposition({ serveUrl, id: 'Arte', inputProps });
  await renderStill({ composition, serveUrl, frame: 0, output: saida, inputProps, imageFormat: 'png', timeoutInMilliseconds: 60000 });
}

export async function quadroPrevia(roteiro, frame, saida) {
  const serveUrl = await servirDe();
  const composition = await selectComposition({ serveUrl, id: 'Edicao', inputProps: roteiro });
  await renderStill({ composition, serveUrl, frame, output: saida, inputProps: roteiro, imageFormat: 'jpeg', jpegQuality: 70, scale: 0.5, timeoutInMilliseconds: 120000 });
}
