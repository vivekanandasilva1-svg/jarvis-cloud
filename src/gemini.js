import { alinharTextoComAudio } from './audioAlign.js';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_TTS = 'gemini-2.5-flash-preview-tts';
const MODELO_TRANSCRICAO = 'gemini-flash-latest';
// "Leda" e descrita pela propria Google como uma voz jovem ("Youthful") - a mais proxima do
// que foi pedido (jovem, humana, natural) entre as vozes prontas do Gemini.
const VOZ = 'Leda';

function chaveApi() {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new Error('GEMINI_API_KEY nao configurado');
  return chave;
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// sem limite de tempo por tentativa, uma unica chamada travada (comum quando o Gemini esta
// respondendo devagar, nao so quando devolve erro) podia prender o pedido inteiro por dezenas
// de segundos - e com retry em cima disso, MULTIPLICAVA essa espera por tentativa. No modo
// conversa isso e o pior caso possivel: parece que "nao funciona" quando na verdade so esta
// preso esperando. Cortando cada tentativa individualmente, o total fica previsivel.
async function fetchComLimite(chamarFetch, timeoutMs) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await chamarFetch(controlador.signal);
  } finally {
    clearTimeout(timer);
  }
}

// o Gemini (principalmente no tier gratis) devolve 503 "high demand" com frequencia mesmo
// em uso normal - isso e transitorio e quase sempre passa numa segunda tentativa. Sem retry,
// qualquer pico momentaneo derrubava a transcricao/voz inteira (o usuario via "nao consegui
// transcrever o audio" ou ficava sem ouvir a Lumia) mesmo quando o problema durava so 1-2s.
// 429 NAO entra no retry: quando e cota diaria estourada (o caso mais comum no tier gratis),
// as tentativas vao falhar do mesmo jeito e so gastam tempo/mais chamadas a toa - so vale
// retry pra estouro momentaneo de taxa, que o proprio 503 ja cobre na pratica.
async function comRetry(chamarFetch, { tentativas = 3, timeoutMs = 20000 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    let res;
    try {
      res = await fetchComLimite(chamarFetch, timeoutMs);
    } catch (err) {
      // AbortError (timeout) ou falha de rede - trata como transitorio, mesma logica do 503
      if (i === tentativas - 1) throw new Error(`Gemini demorou demais pra responder (mais de ${timeoutMs / 1000}s)`);
      await esperar(400 * (i + 1));
      continue;
    }
    if (res.ok || res.status !== 503 || i === tentativas - 1) return res;
    ultimoErro = res;
    await esperar(400 * (i + 1));
  }
  return ultimoErro;
}

// transforma o erro cru da API do Gemini numa mensagem que diz a causa de verdade - "cota
// esgotada" (429, precisa esperar o reset diario ou ativar faturamento) e bem diferente de
// "sobrecarregado" (503, tenta de novo em instantes), e o usuario precisa saber qual e qual
// pra nao ficar achando que e um bug quando na verdade e limite de uso da API gratuita.
async function erroGemini(res, contexto) {
  const errText = await res.text().catch(() => '');
  if (res.status === 429) {
    return new Error(`${contexto}: cota da API do Gemini esgotada (429) - espera o reset diario ou ativa faturamento em aistudio.google.com`);
  }
  if (res.status === 503) {
    return new Error(`${contexto}: Gemini sobrecarregado no momento (503) - tenta de novo em alguns segundos`);
  }
  return new Error(`${contexto} ${res.status}: ${errText.slice(0, 300)}`);
}

// monta um cabecalho WAV na frente do audio PCM cru que o Gemini devolve - o <audio> do
// navegador nao toca PCM sem container, precisa de um arquivo de verdade (mesmo que simples)
function pcmParaWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export async function synthesizeSpeechWithTimestamps(text) {
  const res = await comRetry((signal) => fetch(`${API_URL}/${MODELO_TTS}:generateContent?key=${chaveApi()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Fale de forma natural, calma e humana, com voz jovem: ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
      },
    }),
  }), { tentativas: 3, timeoutMs: 20000 });

  if (!res.ok) throw await erroGemini(res, 'Gemini TTS erro');

  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  const base64Pcm = part?.inlineData?.data;
  if (!base64Pcm) throw new Error('Gemini TTS nao devolveu audio');

  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const wavBuffer = pcmParaWav(pcmBuffer);
  const audioBase64 = wavBuffer.toString('base64');

  const sampleRate = 24000;
  const alignment = alinharTextoComAudio(text, pcmBuffer, sampleRate);

  return { audioBase64, alignment };
}

// transcreve audio (fala -> texto) mandando o arquivo direto pro Gemini com um pedido de
// transcricao - funciona com qualquer formato de audio comum (webm, ogg, mp3, wav etc).
// timeout mais curto e so 1 retry (nao 3): isso e o passo do modo conversa que o usuario
// literalmente fica esperando em tempo real - preferimos falhar rapido e deixar ouvir de novo
// a "acertar" depois de meio minuto de espera acumulada em tentativas.
export async function transcribeAudio(buffer, mimeType = 'audio/webm') {
  const res = await comRetry((signal) => fetch(`${API_URL}/${MODELO_TRANSCRICAO}:generateContent?key=${chaveApi()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Transcreva exatamente o que e falado neste audio, em portugues, sem comentarios nem formatacao extra - so o texto transcrito.' },
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ],
      }],
    }),
  }), { tentativas: 2, timeoutMs: 10000 });

  if (!res.ok) throw await erroGemini(res, 'Gemini erro');

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return texto.trim();
}
