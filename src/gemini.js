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

// o Gemini (principalmente no tier gratis) devolve 503 "high demand" com frequencia mesmo
// em uso normal - isso e transitorio e quase sempre passa numa segunda tentativa. Sem retry,
// qualquer pico momentaneo derrubava a transcricao/voz inteira (o usuario via "nao consegui
// transcrever o audio" ou ficava sem ouvir a Lumia) mesmo quando o problema durava so 1-2s.
async function comRetry(chamarFetch, tentativas = 3) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    const res = await chamarFetch();
    if (res.ok) return res;
    const transitorio = res.status === 503 || res.status === 429;
    if (!transitorio || i === tentativas - 1) return res;
    ultimoErro = res;
    await esperar(500 * (i + 1)); // 500ms, depois 1000ms
  }
  return ultimoErro;
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

// gera a fala e tambem um "alinhamento" sintetico (o Gemini nao devolve timestamp por
// caractere como o ElevenLabs) - distribui o tempo de cada caractere de forma linear ao
// longo da duracao real do audio, só pra a legenda na tela continuar acompanhando a fala
// de um jeito razoavel (nao e perfeito, mas fica proximo).
export async function synthesizeSpeechWithTimestamps(text) {
  const res = await comRetry(() => fetch(`${API_URL}/${MODELO_TTS}:generateContent?key=${chaveApi()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Fale de forma natural, calma e humana, com voz jovem: ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
      },
    }),
  }));

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini TTS erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  const base64Pcm = part?.inlineData?.data;
  if (!base64Pcm) throw new Error('Gemini TTS nao devolveu audio');

  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const wavBuffer = pcmParaWav(pcmBuffer);
  const audioBase64 = wavBuffer.toString('base64');

  const sampleRate = 24000;
  const duracaoSegundos = (pcmBuffer.length / 2) / sampleRate; // 16 bits = 2 bytes/amostra
  const characters = text.split('');
  // distribuicao linear pura (1 caractere = 1 fatia igual de tempo) ignora que a fala de
  // verdade da uma pausa depois de . ! ? e uma pausa menor depois de , ; : - isso fazia a
  // legenda/animacao da boca "correr na frente" da voz nesses pontos e acumular atraso ao
  // longo da frase. Dando peso extra pros caracteres de pausa (sem mudar a duracao total,
  // so como ela e repartida) o acompanhamento fica bem mais proximo do ritmo real da fala.
  const pesos = characters.map((ch) => (/[.!?]/.test(ch) ? 9 : /[,;:]/.test(ch) ? 5 : 1));
  const pesoTotal = pesos.reduce((soma, p) => soma + p, 0);
  let acumulado = 0;
  const character_start_times_seconds = pesos.map((peso) => {
    const t = (acumulado / pesoTotal) * duracaoSegundos;
    acumulado += peso;
    return t;
  });

  return { audioBase64, alignment: { characters, character_start_times_seconds } };
}

// transcreve audio (fala -> texto) mandando o arquivo direto pro Gemini com um pedido de
// transcricao - funciona com qualquer formato de audio comum (webm, ogg, mp3, wav etc).
export async function transcribeAudio(buffer, mimeType = 'audio/webm') {
  const res = await comRetry(() => fetch(`${API_URL}/${MODELO_TRANSCRICAO}:generateContent?key=${chaveApi()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Transcreva exatamente o que e falado neste audio, em portugues, sem comentarios nem formatacao extra - so o texto transcrito.' },
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ],
      }],
    }),
  }));

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return texto.trim();
}
