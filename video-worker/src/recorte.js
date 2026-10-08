// recorte da pessoa (video matting) com o Robust Video Matting (RVM, modelo ONNX rodando na CPU).
// Gera "pessoa.webm": o video padronizado com canal alfa (fundo transparente). E o que destrava os
// efeitos de profundidade: texto passando POR TRAS da pessoa, fundo trocado/criado do zero,
// desfoque so do fundo e elementos 3D atras dela.
//
// Roda em meia resolucao (o recorte e suavizado no upscale) - rapido o bastante pra 1 CPU. O RVM
// e recorrente (usa o quadro anterior), entao o contorno fica estavel, sem "tremer" entre quadros.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELO = process.env.RVM_MODELO || path.join(RAIZ, 'modelos', 'rvm_mobilenetv3_fp32.onnx');

let sessao = null;
async function obterSessao() {
  if (!sessao) {
    sessao = await ort.InferenceSession.create(MODELO, { intraOpNumThreads: 1, interOpNumThreads: 1, graphOptimizationLevel: 'all' });
  }
  return sessao;
}

function processo(args, entrada = 'ignore') {
  const p = spawn('ffmpeg', args, { stdio: [entrada, 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
  p.terminou = new Promise((resolve, reject) => {
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com codigo ${code}: ${err.slice(-400)}`))));
  });
  return p;
}

// gera a mascara (tons de cinza, branco = pessoa) em meia resolucao
async function gerarMascara(base, mascara, { largura, altura }, aoProgredir) {
  const w = Math.round(largura / 4) * 2;
  const h = Math.round(altura / 4) * 2;
  const s = await obterSessao();
  const tamQuadro = w * h * 3;
  const dec = processo(['-i', base, '-an', '-vf', `scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const enc = processo(['-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${w}x${h}`, '-r', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', mascara], 'pipe');

  // estado recorrente comeca vazio; downsample deixa a rede trabalhar em ~256px no lado menor
  const zero = () => new ort.Tensor('float32', new Float32Array([0]), [1, 1, 1, 1]);
  let r = [zero(), zero(), zero(), zero()];
  const downsample = new ort.Tensor('float32', new Float32Array([Math.min(1, 256 / Math.min(w, h))]), [1]);
  const entrada = new Float32Array(tamQuadro);
  const saidaGray = Buffer.alloc(w * h);
  let pendente = Buffer.alloc(0);
  let quadros = 0;
  const totalEstimado = aoProgredir?.total || 0;

  const escrever = (buf) => new Promise((resolve) => (enc.stdin.write(buf) ? resolve() : enc.stdin.once('drain', resolve)));

  for await (const pedaco of dec.stdout) {
    pendente = pendente.length ? Buffer.concat([pendente, pedaco]) : pedaco;
    while (pendente.length >= tamQuadro) {
      const q = pendente.subarray(0, tamQuadro);
      // RGB intercalado (HWC, 0-255) -> planar (CHW, 0-1)
      const plano = w * h;
      for (let i = 0, j = 0; i < plano; i++, j += 3) {
        entrada[i] = q[j] / 255;
        entrada[i + plano] = q[j + 1] / 255;
        entrada[i + 2 * plano] = q[j + 2] / 255;
      }
      const out = await s.run({
        src: new ort.Tensor('float32', entrada, [1, 3, h, w]),
        r1i: r[0], r2i: r[1], r3i: r[2], r4i: r[3], downsample_ratio: downsample,
      });
      r = [out.r1o, out.r2o, out.r3o, out.r4o];
      const pha = out.pha.data;
      for (let i = 0; i < plano; i++) saidaGray[i] = Math.max(0, Math.min(255, Math.round(pha[i] * 255)));
      await escrever(saidaGray);
      pendente = pendente.subarray(tamQuadro);
      quadros++;
      if (totalEstimado && quadros % 30 === 0) aoProgredir(quadros / totalEstimado);
    }
  }
  enc.stdin.end();
  await Promise.all([dec.terminou, enc.terminou]);
  return quadros;
}

// pessoa.webm = video base + mascara como canal alfa (VP9 com transparencia, que o Remotion le)
export async function recortarPessoa(base, pastaSaida, { largura, altura, duracao }, aoProgredir) {
  const mascara = path.join(pastaSaida, 'mascara.mp4');
  const pessoa = path.join(pastaSaida, 'pessoa.webm');
  const total = Math.round(duracao * 30);
  const progresso = aoProgredir ? Object.assign((p) => aoProgredir(0.85 * p), { total }) : null;
  await gerarMascara(base, mascara, { largura, altura }, progresso);
  // contorno: leve erosao + desfoque pra borda nao ficar serrilhada nem com halo do fundo antigo
  const filtro = `[1:v]scale=${largura}:${altura}:flags=bicubic,format=gray,erosion=threshold0=40,gblur=sigma=1.2[m];[0:v][m]alphamerge,format=yuva420p`;
  await processo(['-y', '-i', base, '-i', mascara, '-filter_complex', filtro, '-an',
    '-c:v', 'libvpx-vp9', '-threads', '1', '-tile-columns', '0', '-frame-parallel', '0', '-lag-in-frames', '0',
    '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '0', '-crf', '30', '-auto-alt-ref', '0', pessoa]).terminou;
  aoProgredir?.(1);
  return pessoa;
}
