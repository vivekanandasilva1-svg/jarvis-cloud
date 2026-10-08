// transcricao com o tempo de CADA palavra - e a base de tudo: os cortes, as legendas e o momento
// de cada animacao sao ancorados nas palavras faladas. O Claude nao recebe audio, entao essa etapa
// usa o Gemini Pro do cliente (ouve o audio e devolve palavra + inicio + fim); se falhar, cai pro
// Whisper que roda na propria VPS (mais lento, sem servico externo).
import fs from 'node:fs/promises';

const MODELOS_GEMINI = ['gemini-pro-latest', 'gemini-3.1-pro-preview', 'gemini-2.5-pro'];
const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

function limparPalavras(lista) {
  const palavras = lista
    .map((w) => ({ t: String(w.word ?? w.text ?? w.w ?? '').trim(), i: Number(w.start ?? w.s), f: Number(w.end ?? w.e) }))
    .filter((w) => w.t && Number.isFinite(w.i) && Number.isFinite(w.f))
    .map((w) => ({ ...w, f: Math.max(w.f, w.i + 0.05) }));
  // o transcritor as vezes separa "%" ou pontuacao em token proprio ("27" + "%") - gruda na palavra
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

// tempos do Gemini sao bons mas nem sempre perfeitamente ordenados - garante sequencia crescente,
// sem sobreposicao e dentro da duracao do audio
function ajustarTempos(palavras, duracao) {
  const saida = [];
  let ultimoFim = 0;
  for (const p of palavras) {
    const i = Math.max(p.i, ultimoFim);
    const f = Math.min(duracao || Infinity, Math.max(p.f, i + 0.08));
    if (i >= (duracao || Infinity)) break;
    saida.push({ t: p.t, i, f });
    ultimoFim = f;
  }
  return saida;
}

async function viaGemini(arquivo, duracao) {
  const audio = (await fs.readFile(arquivo)).toString('base64');
  const pedido = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'audio/mpeg', data: audio } },
        {
          text: 'Transcreva este audio em portugues do Brasil PALAVRA POR PALAVRA, exatamente como foi falado (inclua hesitacoes como "é", "hã", repeticoes e comecos falsos - eles serao cortados depois). Para cada palavra informe o segundo em que ela COMECA (s) e TERMINA (e), com precisao de centesimos, medidos do inicio do audio. Pontuacao grudada na palavra. Responda so com o JSON.',
        },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          palavras: { type: 'ARRAY', items: { type: 'OBJECT', properties: { w: { type: 'STRING' }, s: { type: 'NUMBER' }, e: { type: 'NUMBER' } }, required: ['w', 's', 'e'] } },
        },
        required: ['palavras'],
      },
    },
  };
  let ultimoErro;
  for (const modelo of MODELOS_GEMINI) {
    try {
      const res = await fetch(`${API_GEMINI}/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(pedido),
        signal: AbortSignal.timeout(8 * 60 * 1000),
      });
      if (!res.ok) throw new Error(`Gemini ${modelo} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      const data = await res.json();
      const texto = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const palavras = ajustarTempos(limparPalavras(JSON.parse(texto).palavras || []), duracao);
      // sanidade: fala real tem pelo menos ~0,5 palavra/s em media nos trechos falados
      if (duracao > 5 && palavras.length < duracao * 0.2) throw new Error(`Gemini ${modelo} devolveu poucas palavras (${palavras.length})`);
      return { texto: palavras.map((p) => p.t).join(' '), palavras, fonte: modelo };
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro;
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
  return { texto: (data.text || '').trim(), palavras, fonte: 'whisper-local' };
}

export async function transcrever(arquivo, duracao = 0) {
  const erros = [];
  if (process.env.GEMINI_API_KEY) {
    try { return await viaGemini(arquivo, duracao); } catch (err) { erros.push(err.message); }
  }
  if (process.env.WHISPER_URL) {
    try { return await viaWhisperLocal(arquivo); } catch (err) { erros.push(err.message); }
  }
  throw new Error(`nao consegui transcrever o audio (${erros.join(' | ') || 'nenhum servico de transcricao configurado'})`);
}
