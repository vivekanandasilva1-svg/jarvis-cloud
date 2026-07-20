// voz definitiva da Lumia: Kokoro TTS auto-hospedado na propria VPS (open source, ~82M
// parametros, roda em CPU) - sem custo por uso, sem cota, sem depender de credito de
// terceiro. "pf_dora" e a voz feminina brasileira do modelo - fixa, nao muda dependendo do
// navegador/dispositivo de quem esta ouvindo, ao contrario do fallback de voz do navegador.
import { alinharTextoComAudio } from './audioAlign.js';

const VOZ = 'pf_dora';

export async function synthesizeSpeechKokoro(text) {
  const url = process.env.KOKORO_URL;
  if (!url) throw new Error('KOKORO_URL nao configurado');

  // reduzido de 25s pra 10s - diagnostico ao vivo achou a VPS com 48% de CPU steal time
  // (roubada pelo host) e load 2.55 em so 2 nucleos, fazendo o Kokoro (sem NNPACK, CPU pura)
  // levar ate 20s pra sintetizar uma unica palavra sob essas condicoes. O frontend tenta ATE
  // 2 VEZES (ver falar() em app.js) - e melhor falhar rapido e cair pro texto do que deixar o
  // usuario parado quase 1 minuto (2 tentativas x 25s) esperando a voz.
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 10000);
  let res;
  try {
    res = await fetch(`${url}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controlador.signal,
      body: JSON.stringify({ model: 'kokoro', voice: VOZ, input: text, response_format: 'wav' }),
    });
  } catch (err) {
    throw new Error(`Nao consegui falar com o Kokoro TTS: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Kokoro TTS erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const wavBuffer = Buffer.from(await res.arrayBuffer());
  const audioBase64 = wavBuffer.toString('base64');

  // o Kokoro ja devolve um WAV completo (cabecalho de 44 bytes + PCM) em 24000Hz mono
  // 16-bit - pula o cabecalho pra reaproveitar o mesmo alinhamento por energia usado no
  // Gemini, sem precisar reimplementar nada especifico pra esse motor
  const sampleRate = wavBuffer.readUInt32LE(24);
  const pcmBuffer = wavBuffer.subarray(44);
  const alignment = alinharTextoComAudio(text, pcmBuffer, sampleRate);

  return { audioBase64, alignment };
}
