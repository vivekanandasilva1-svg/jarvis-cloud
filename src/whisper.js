// transcricao via Whisper auto-hospedado (onerahmet/openai-whisper-asr-webservice) rodando
// na propria VPS - sem custo por uso, sem cota, sem depender de disponibilidade de terceiro.
// So existe quando WHISPER_URL esta configurado (ambientes sem essa infra, como o Render,
// continuam usando o Gemini como transcricao).
//
// modelo configurado e o ASR_MODEL=small (mais lento no CPU que tiny/base, mas mais preciso) -
// rodando numa VPS de 2 vCPU compartilhada com varios outros servicos (n8n, Evolution API,
// Kokoro TTS etc), entao transcricao pode legitimamente levar perto do limite abaixo sob
// carga. O timeout do frontend (app.js, transcreverAudio) TEM que ficar maior que este.
const WHISPER_TIMEOUT_MS = 35000;

export async function transcribeAudioWhisper(buffer, mimeType = 'audio/webm') {
  const extensao = (mimeType.split('/')[1] || 'webm').split(';')[0];
  const form = new FormData();
  form.append('audio_file', new Blob([buffer], { type: mimeType }), `audio.${extensao}`);

  // vad_filter descarta os trechos de silencio antes de transcrever - reduz o tempo de
  // processamento (menos audio pra rodar no modelo) sem perder precisao, ja que silencio nao
  // tem fala pra perder mesmo
  const url = `${process.env.WHISPER_URL}/asr?task=transcribe&language=pt&output=json&vad_filter=true`;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), WHISPER_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: form, signal: controlador.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

// ponto unico de transcricao usado pelo resto do app - ordem de preferencia: Groq (nuvem,
// gratis dentro da cota, nao disputa CPU com o Kokoro na VPS) -> Whisper local (fallback se a
// Groq falhar ou estourar cota, ja esta rodando aqui mesmo) -> Gemini (fallback final, usado
// tambem em ambientes sem WHISPER_URL, tipo Render).
export async function transcrever(buffer, mimeType) {
  const { transcribeAudioGroq } = await import('./groq.js');
  const { transcribeAudio } = await import('./gemini.js');

  if (process.env.GROQ_API_KEY) {
    try {
      return await transcribeAudioGroq(buffer, mimeType);
    } catch (err) {
      console.error('Groq falhou na transcricao, caindo pro fallback:', err.message);
    }
  }
  if (process.env.WHISPER_URL) {
    try {
      return await transcribeAudioWhisper(buffer, mimeType);
    } catch (err) {
      console.error('Whisper local falhou na transcricao, caindo pro Gemini:', err.message);
    }
  }
  return transcribeAudio(buffer, mimeType);
}
