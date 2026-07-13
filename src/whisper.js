// transcricao via Whisper auto-hospedado (onerahmet/openai-whisper-asr-webservice) rodando
// na propria VPS - sem custo por uso, sem cota, sem depender de disponibilidade de terceiro.
// So existe quando WHISPER_URL esta configurado (ambientes sem essa infra, como o Render,
// continuam usando o Gemini como transcricao).
export async function transcribeAudioWhisper(buffer, mimeType = 'audio/webm') {
  const extensao = (mimeType.split('/')[1] || 'webm').split(';')[0];
  const form = new FormData();
  form.append('audio_file', new Blob([buffer], { type: mimeType }), `audio.${extensao}`);

  const url = `${process.env.WHISPER_URL}/asr?task=transcribe&language=pt&output=json`;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 30000);
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
