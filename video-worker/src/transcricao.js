// transcricao com o tempo de CADA palavra - e a base de tudo: os cortes, as legendas e o momento
// de cada animacao sao ancorados nas palavras faladas. Groq (whisper-large-v3-turbo, nuvem, rapido)
// primeiro; se falhar, cai pro Whisper que ja roda na propria VPS (mais lento, sem custo).
import fs from 'node:fs/promises';

function limparPalavras(lista) {
  const palavras = lista
    .map((w) => ({ t: String(w.word ?? w.text ?? '').trim(), i: Number(w.start), f: Number(w.end) }))
    .filter((w) => w.t && Number.isFinite(w.i) && Number.isFinite(w.f))
    .map((w) => ({ ...w, f: Math.max(w.f, w.i + 0.05) }));
  // o Whisper as vezes separa "%" ou pontuacao em token proprio ("27" + "%") - gruda na palavra
  // anterior pra legenda nao mostrar o simbolo sozinho
  const juntas = [];
  for (const w of palavras) {
    const anterior = juntas[juntas.length - 1];
    if (anterior && /^[%.,!?…:;]+$/.test(w.t)) {
      anterior.t += w.t;
      anterior.f = Math.max(anterior.f, w.f);
    } else {
      juntas.push(w);
    }
  }
  return juntas;
}

async function viaGroq(arquivo) {
  const buf = await fs.readFile(arquivo);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'pt');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Groq erro ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  return { texto: (data.text || '').trim(), palavras: limparPalavras(data.words || []) };
}

async function viaWhisperLocal(arquivo) {
  const buf = await fs.readFile(arquivo);
  const form = new FormData();
  form.append('audio_file', new Blob([buf], { type: 'audio/mpeg' }), 'audio.mp3');
  const url = `${process.env.WHISPER_URL}/asr?task=transcribe&language=pt&output=json&word_timestamps=true&vad_filter=true`;
  const res = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(20 * 60 * 1000) });
  if (!res.ok) throw new Error(`Whisper local erro ${res.status}`);
  const data = await res.json();
  const palavras = limparPalavras((data.segments || []).flatMap((s) => s.words || []));
  return { texto: (data.text || '').trim(), palavras };
}

export async function transcrever(arquivo) {
  const erros = [];
  if (process.env.GROQ_API_KEY) {
    try { return await viaGroq(arquivo); } catch (err) { erros.push(err.message); }
  }
  if (process.env.WHISPER_URL) {
    try { return await viaWhisperLocal(arquivo); } catch (err) { erros.push(err.message); }
  }
  throw new Error(`nao consegui transcrever o audio (${erros.join(' | ') || 'nenhum servico de transcricao configurado'})`);
}
