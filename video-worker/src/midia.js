// operacoes de midia com ffmpeg/ffprobe (CLI do sistema) - preparo do video bruto antes da
// edicao: padroniza resolucao/fps, trata o audio e extrai o que a transcricao e a revisao precisam.
import { spawn } from 'node:child_process';

function rodar(cmd, args, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} demorou demais`)); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} saiu com codigo ${code}: ${err.slice(-600)}`));
    });
  });
}

export async function analisar(arquivo) {
  const out = await rodar('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', arquivo]);
  const info = JSON.parse(out);
  const video = info.streams.find((s) => s.codec_type === 'video');
  const audio = info.streams.find((s) => s.codec_type === 'audio');
  if (!video) throw new Error('o arquivo enviado nao tem trilha de video');
  // celular grava "deitado" e marca rotacao nos metadados - o ffmpeg ja aplica, entao a
  // orientacao real e a com largura/altura trocadas
  const rotacao = Math.abs(Number(video.tags?.rotate || video.side_data_list?.find((d) => d.rotation != null)?.rotation || 0));
  const deitado = rotacao === 90 || rotacao === 270;
  return {
    duracao: Number(info.format.duration) || 0,
    largura: deitado ? video.height : video.width,
    altura: deitado ? video.width : video.height,
    temAudio: !!audio,
    hdr: /smpte2084|arib-std-b67/.test(video.color_transfer || ''),
  };
}

// video padronizado que a renderizacao usa: ja recortado no formato final, 30fps constante,
// keyframe a cada meio segundo (o renderizador pula muito pra frente e pra tras nos cortes) e o
// audio tratado - reducao de ruido, corte de grave de microfone e volume no padrao das redes
// sociais (-14 LUFS)
export async function normalizar(entrada, saida, { largura, altura, temAudio, hdr }) {
  const filtrosVideo = [
    ...(hdr ? ['zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv'] : []),
    `scale=${largura}:${altura}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${largura}:${altura}`,
    'fps=30',
    'format=yuv420p',
  ].join(',');
  const args = ['-y', '-i', entrada, '-vf', filtrosVideo,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-g', '15', '-keyint_min', '15', '-movflags', '+faststart'];
  if (temAudio) {
    args.push('-af', 'highpass=f=80,afftdn=nf=-25:tn=1,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  } else {
    // sem audio o renderizador ainda precisa de uma trilha (silencio)
    args.splice(1, 0, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    args.push('-map', '1:v:0', '-map', '0:a:0', '-shortest', '-c:a', 'aac', '-b:a', '128k');
  }
  args.push(saida);
  try {
    await rodar('ffmpeg', args);
  } catch (err) {
    // ffmpeg sem zscale (build mais enxuto) - tenta de novo sem o mapeamento de HDR
    if (hdr && /zscale/i.test(err.message)) return normalizar(entrada, saida, { largura, altura, temAudio, hdr: false });
    throw err;
  }
}

export async function extrairAudioTranscricao(entrada, saida) {
  await rodar('ffmpeg', ['-y', '-i', entrada, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k', saida]);
}

export async function extrairQuadro(entrada, segundo, saida, largura = 540) {
  await rodar('ffmpeg', ['-y', '-ss', String(Math.max(0, segundo)), '-i', entrada, '-frames:v', '1', '-vf', `scale=${largura}:-2`, '-q:v', '4', saida]);
}
