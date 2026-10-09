// audio final montado direto no ffmpeg a partir do roteiro (sem passar pelo Chrome): fala cortada
// nos mesmos pontos do video (com micro-fade em cada corte), trilha de fundo que abaixa sozinha
// quando a pessoa fala (sidechain) e efeitos sonoros nos quadros certos. A passada de audio do
// Remotion percorria o video inteiro de novo (decodificando ate a pessoa recortada quadro a
// quadro) - num video de 5 min isso era outro render de horas; aqui leva segundos.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_SFX = path.join(RAIZ, 'remotion', 'public', 'sfx');
const PASTA_DADOS = process.env.DATA_DIR || '/data';

// http://127.0.0.1:4100/interno/midia/<id>/<arquivo> -> /data/jobs/<id>/<arquivo>
function caminhoLocal(url) {
  const m = String(url || '').match(/\/interno\/midia\/([a-zA-Z0-9_-]+)\/(.+)$/);
  if (!m) throw new Error(`endereco de midia inesperado: ${url}`);
  return path.join(PASTA_DADOS, 'jobs', m[1], m[2]);
}

function rodar(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg audio ${c}: ${err.slice(-500)}`))));
  });
}

export async function montarAudio(roteiro, saida) {
  const fps = roteiro.fps || 30;
  const duracao = roteiro.duracaoFrames / fps;
  const entradas = ['-i', caminhoLocal(roteiro.videoSrc)];
  const filtros = [];

  // 1) fala: os mesmos trechos do video, na mesma ordem
  const fade = 2 / fps;
  roteiro.segmentos.forEach((s, k) => {
    const ini = s.srcInicioFrame / fps;
    const dur = s.duracao / fps;
    filtros.push(`[0:a]atrim=start=${ini.toFixed(4)}:duration=${dur.toFixed(4)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:d=${fade.toFixed(4)},afade=t=out:st=${Math.max(0, dur - fade).toFixed(4)}:d=${fade.toFixed(4)}[s${k}]`);
  });
  filtros.push(`${roteiro.segmentos.map((_, k) => `[s${k}]`).join('')}concat=n=${roteiro.segmentos.length}:v=0:a=1,apad,atrim=0:${duracao.toFixed(4)}[fala]`);

  const mix = [];
  let entrada = 1;
  // 2) trilha de fundo com "ducking" pela propria fala
  if (roteiro.trilha?.src) {
    entradas.push('-stream_loop', '-1', '-i', caminhoLocal(roteiro.trilha.src));
    filtros.push('[fala]asplit=2[falaMix][falaSC]');
    filtros.push(`[${entrada}:a]atrim=0:${duracao.toFixed(4)},asetpts=PTS-STARTPTS,volume=0.32,`
      + `afade=t=in:d=1,afade=t=out:st=${Math.max(0, duracao - 1.5).toFixed(4)}:d=1.5[trl]`);
    filtros.push('[trl][falaSC]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=350[trilha]');
    mix.push('[falaMix]', '[trilha]');
    entrada++;
  } else {
    mix.push('[fala]');
  }

  // 3) efeitos sonoros (um arquivo por tipo, dividido pra cada ocorrencia)
  const porTipo = {};
  for (const s of roteiro.sfx || []) (porTipo[s.tipo] ||= []).push(s.frame);
  for (const [tipo, quadros] of Object.entries(porTipo)) {
    const arquivo = path.join(PASTA_SFX, `${tipo}.wav`);
    try { await fs.access(arquivo); } catch { continue; }
    entradas.push('-i', arquivo);
    const rotulos = quadros.map((_, j) => `[${tipo}${j}]`);
    filtros.push(`[${entrada}:a]asplit=${quadros.length}${rotulos.join('')}`);
    quadros.forEach((q, j) => {
      const ms = Math.max(0, Math.round((q / fps) * 1000));
      filtros.push(`[${tipo}${j}]adelay=${ms}|${ms},volume=${tipo === 'whoosh' ? 0.32 : 0.4}[x${tipo}${j}]`);
      mix.push(`[x${tipo}${j}]`);
    });
    entrada++;
  }

  filtros.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=first,alimiter=limit=0.95[saida]`);
  const script = `${saida}.filtros.txt`;
  await fs.writeFile(script, filtros.join(';\n'));
  try {
    await rodar(['-y', ...entradas, '-filter_complex_script', script, '-map', '[saida]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', saida]);
  } finally {
    await fs.rm(script, { force: true });
  }
}
