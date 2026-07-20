// transcricao via Groq (whisper-large-v3-turbo hospedado na nuvem deles, GPU propria) - camada
// gratuita generosa pro volume de uma clinica + chat pessoal, e tira o peso da transcricao dos
// 2 vCPUs compartilhados da VPS (que tambem rodam o Kokoro TTS, brigando pelo mesmo CPU). So
// existe quando GROQ_API_KEY esta configurado - ver transcrever() em whisper.js pra fallback.
const GROQ_TIMEOUT_MS = 15000;

export async function transcribeAudioGroq(buffer, mimeType = 'audio/webm') {
  const extensao = (mimeType.split('/')[1] || 'webm').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), `audio.${extensao}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), GROQ_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
      signal: controlador.signal,
    });
  } catch (err) {
    throw new Error(`Nao consegui falar com a Groq: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq erro ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}
