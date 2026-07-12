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
  const res = await fetch(`${API_URL}/${MODELO_TTS}:generateContent?key=${chaveApi()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Fale de forma natural, calma e humana, com voz jovem: ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } },
      },
    }),
  });

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
  const character_start_times_seconds = characters.map((_, i) => (i / characters.length) * duracaoSegundos);

  return { audioBase64, alignment: { characters, character_start_times_seconds } };
}

// transcreve audio (fala -> texto) mandando o arquivo direto pro Gemini com um pedido de
// transcricao - funciona com qualquer formato de audio comum (webm, ogg, mp3, wav etc).
export async function transcribeAudio(buffer, mimeType = 'audio/webm') {
  const res = await fetch(`${API_URL}/${MODELO_TRANSCRICAO}:generateContent?key=${chaveApi()}`, {
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
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return texto.trim();
}
