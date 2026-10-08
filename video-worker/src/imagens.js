// imagens geradas por IA (Gemini) pra compor a edicao: fotos e ilustracoes de apoio, renders 3D de
// objetos (com fundo removido, pra flutuar na cena atras/na frente da pessoa) e fundos inteiros
// criados do zero. O diretor (Claude) escreve o pedido de cada imagem a partir do que a pessoa fala.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const MODELOS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

const PROPORCAO = { '9:16': '9:16', '4:5': '4:5', '1:1': '1:1', '16:9': '16:9' };

// objetos "recortaveis" sao gerados num fundo verde chapado e o verde e removido depois
const SUFIXO = {
  foto: 'Photorealistic, professional photography, sharp focus, natural light, high detail. No text, no watermark.',
  render_3d: 'High-end 3D render, single isolated object, soft studio lighting, subtle reflections, octane/cinema4d look, centered with margin around it. No text, no watermark.',
  ilustracao: 'Clean modern illustration, vibrant but tasteful colors, high detail. No text, no watermark.',
  fundo: 'Background plate for a video, no people, depth of field, cinematic lighting, uncluttered center area. No text, no watermark.',
};
const FUNDO_VERDE = ' The object is on a perfectly flat, uniform pure chroma-key green background (#00FF00), no shadows on the background, no green on the object.';

function rodarFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

async function chamarGemini(modelo, texto, proporcao) {
  const res = await fetch(`${API}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: texto }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: proporcao } },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Gemini ${modelo} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = await res.json();
  const parte = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  if (!parte) throw new Error(`Gemini ${modelo} nao devolveu imagem`);
  return Buffer.from(parte.inlineData.data, 'base64');
}

// gera e grava: "arquivo.png" (com transparencia se recortar) + miniatura
export async function gerarImagem({ prompt, tipo, recortar, formato }, saidaPng, miniatura) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY nao configurada no servico de video');
  const recorta = recortar && tipo !== 'fundo';
  const proporcao = tipo === 'fundo' ? (PROPORCAO[formato] || '9:16') : recorta ? '1:1' : (PROPORCAO[formato] || '9:16');
  const texto = `${prompt.trim()}\n\n${SUFIXO[tipo] || SUFIXO.foto}${recorta ? FUNDO_VERDE : ''}`;
  let buf = null;
  let ultimoErro;
  for (const modelo of MODELOS) {
    try { buf = await chamarGemini(modelo, texto, proporcao); break; } catch (err) { ultimoErro = err; }
  }
  if (!buf) throw ultimoErro;
  const bruto = `${saidaPng}.bruto`;
  await fs.writeFile(bruto, buf);
  if (recorta) {
    // remove o verde + tira o "vazamento" verde das bordas
    await rodarFfmpeg(['-y', '-i', bruto, '-vf', 'colorkey=0x00FF00:0.32:0.08,despill=type=green,format=rgba', '-frames:v', '1', saidaPng]);
  } else {
    await rodarFfmpeg(['-y', '-i', bruto, '-vf', "scale='min(1920,iw)':-2", '-frames:v', '1', saidaPng]);
  }
  await rodarFfmpeg(['-y', '-i', saidaPng, '-vf', 'scale=360:-2', '-frames:v', '1', '-q:v', '4', miniatura]).catch(async () => {
    await rodarFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=0x222222:s=360x360', '-i', saidaPng, '-filter_complex', '[1]scale=360:-2[i];[0][i]overlay=(W-w)/2:(H-h)/2', '-frames:v', '1', miniatura]);
  });
  await fs.rm(bruto, { force: true });
}
