// voz definitiva da Lumia: Kokoro TTS auto-hospedado na propria VPS (open source, ~82M
// parametros, roda em CPU) - sem custo por uso, sem cota, sem depender de credito de
// terceiro. "pf_dora" e a voz feminina brasileira do modelo - fixa, nao muda dependendo do
// navegador/dispositivo de quem esta ouvindo, ao contrario do fallback de voz do navegador.
import { alinharTextoComAudio } from './audioAlign.js';

const VOZ = 'pf_dora';

export async function synthesizeSpeechKokoro(text) {
  const url = process.env.KOKORO_URL;
  if (!url) throw new Error('KOKORO_URL nao configurado');

  const controlador = new AbortController();
  // reduzido de 25s pra 10s - a VPS pode ficar com a CPU disputada (steal time do host) e
  // fazer o Kokoro demorar demais; e melhor falhar rapido e cair pro texto do que deixar o
  // usuario parado vendo "pensando" por quase 1 minuto (2 tentativas x 25s) esperando a voz
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
