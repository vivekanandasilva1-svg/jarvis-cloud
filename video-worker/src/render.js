// renderizacao com Remotion. O pacote da composicao (webpack) e gerado UMA vez no build da
// imagem Docker (src/bundle.js) - em tempo de execucao so renderiza, sem recompilar nada.
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { montarAudio } from './audioFinal.js';
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

// video longo e cheio de camadas fazia o Chrome do render estourar memoria ("Page crashed!") no
// meio do caminho. Agora renderiza em partes de 30s, cada uma num Chrome novo (memoria nao
// acumula), com nova tentativa por parte e retomada: partes prontas ficam salvas e um render
// interrompido continua de onde parou. O audio sai inteiro numa passada so (sem emenda nos cortes
// entre partes) e no fim tudo e juntado sem recodificar.
const TAM_PARTE = Number(process.env.RENDER_FRAMES_POR_PARTE || 900);
const existe = (f) => fs.access(f).then(() => true, () => false);

function rodarFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.slice(-400)}`))));
  });
}

export async function renderizar(roteiro, saida, aoProgredir) {
  const serveUrl = await servirDe();
  const composition = await selectComposition({ serveUrl, id: 'Edicao', inputProps: roteiro });
  const total = composition.durationInFrames;
  const pasta = path.join(path.dirname(saida), 'partes');
  // roteiro mudou (ajuste/edicao manual) = partes antigas nao servem mais
  const assinatura = crypto.createHash('sha1').update(JSON.stringify(roteiro)).digest('hex');
  if ((await fs.readFile(path.join(pasta, 'assinatura'), 'utf8').catch(() => '')) !== assinatura) {
    await fs.rm(pasta, { recursive: true, force: true });
    await fs.mkdir(pasta, { recursive: true });
    await fs.writeFile(path.join(pasta, 'assinatura'), assinatura);
  }
  const comum = {
    composition, serveUrl, inputProps: roteiro, concurrency: CONCORRENCIA,
    offthreadVideoThreads: 1, offthreadVideoCacheSizeInBytes: 96 * 1024 * 1024, timeoutInMilliseconds: 120000,
  };

  const partes = [];
  for (let ini = 0, k = 0; ini < total; ini += TAM_PARTE, k++) {
    const fim = Math.min(total - 1, ini + TAM_PARTE - 1);
    const arquivo = path.join(pasta, `parte-${String(k).padStart(4, '0')}.mp4`);
    partes.push(arquivo);
    if (await existe(`${arquivo}.ok`)) continue;
    for (let tentativa = 1; ; tentativa++) {
      try {
        await renderMedia({
          ...comum, codec: 'h264', muted: true, frameRange: [ini, fim], outputLocation: arquivo,
          crf: 20, x264Preset: 'veryfast', pixelFormat: 'yuv420p',
          onProgress: ({ progress }) => aoProgredir?.(Math.min(0.97, ((ini + progress * (fim - ini + 1)) / total) * 0.97)),
        });
        await fs.writeFile(`${arquivo}.ok`, '');
        break;
      } catch (err) {
        if (tentativa >= 3) throw new Error(`render falhou no trecho ${Math.round(ini / 30)}s-${Math.round(fim / 30)}s: ${err.message}`);
        console.error(`render: parte ${k} falhou (tentativa ${tentativa}), tentando de novo:`, err.message);
      }
    }
  }

  const audio = path.join(pasta, 'audio.m4a');
  if (!(await existe(`${audio}.ok`))) {
    await montarAudio(roteiro, audio);
    await fs.writeFile(`${audio}.ok`, '');
  }
  const lista = path.join(pasta, 'lista.txt');
  await fs.writeFile(lista, partes.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  await rodarFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
    '-c', 'copy', '-shortest', '-movflags', '+faststart', saida]);
  aoProgredir?.(1);
  await fs.rm(pasta, { recursive: true, force: true });
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
