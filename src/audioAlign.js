// alinhamento de texto com audio a partir da energia real do sinal (RMS por janela de ~20ms)
// - detecta pausas de verdade no audio em vez de chutar o ritmo da fala, entao funciona igual
// pra qualquer motor de TTS que devolva PCM 16-bit (Gemini, Kokoro etc), nao so um especifico.

function calcularEnvelopeDeFala(pcmBuffer, sampleRate) {
  const totalSamples = Math.floor(pcmBuffer.length / 2); // 16 bits = 2 bytes/amostra
  const frameMs = 20;
  const amostrasPorFrame = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const numFrames = Math.max(1, Math.ceil(totalSamples / amostrasPorFrame));

  const energiaPorFrame = new Float32Array(numFrames);
  let picoEnergia = 0;
  for (let f = 0; f < numFrames; f++) {
    const inicio = f * amostrasPorFrame;
    const fim = Math.min(inicio + amostrasPorFrame, totalSamples);
    let somaQuadrados = 0;
    for (let i = inicio; i < fim; i++) {
      const amostra = pcmBuffer.readInt16LE(i * 2);
      somaQuadrados += amostra * amostra;
    }
    const contagem = fim - inicio || 1;
    const rms = Math.sqrt(somaQuadrados / contagem);
    energiaPorFrame[f] = rms;
    if (rms > picoEnergia) picoEnergia = rms;
  }

  // frames abaixo de ~4% do pico de volume da resposta inteira contam como pausa/silencio
  const limiar = picoEnergia * 0.04;
  const segundosDeFalaAcumulados = new Float32Array(numFrames + 1);
  for (let f = 0; f < numFrames; f++) {
    const ehFala = energiaPorFrame[f] > limiar;
    segundosDeFalaAcumulados[f + 1] = segundosDeFalaAcumulados[f] + (ehFala ? frameMs / 1000 : 0);
  }

  const totalSegundosDeFala = segundosDeFalaAcumulados[numFrames];

  // dado um alvo em "segundos acumulados de fala" (ignorando pausas), devolve o instante real
  // no audio (contando as pausas) em que esse tanto de fala ja foi dito
  function paraInstanteReal(segundosDeFalaAlvo) {
    if (totalSegundosDeFala <= 0) return 0;
    let lo = 0, hi = numFrames;
    while (lo < hi) {
      const meio = (lo + hi) >> 1;
      if (segundosDeFalaAcumulados[meio] < segundosDeFalaAlvo) lo = meio + 1;
      else hi = meio;
    }
    return (Math.min(lo, numFrames) * frameMs) / 1000;
  }

  return { paraInstanteReal, totalSegundosDeFala };
}

// distribui os caracteres do texto ao longo do audio usando o envelope de energia real: letras
// contam como "fala" (avancam o alvo de segundos-de-fala), espacos e pontuacao nao contam nada
// pra esse alvo - a pausa deles vem naturalmente do silencio que o proprio audio ja tem ali.
export function alinharTextoComAudio(text, pcmBuffer, sampleRate) {
  const { paraInstanteReal, totalSegundosDeFala } = calcularEnvelopeDeFala(pcmBuffer, sampleRate);
  const characters = text.split('');
  const contaComoFala = characters.map((ch) => !/[\s.!?,;:]/.test(ch));
  const totalCaracteresFalados = contaComoFala.filter(Boolean).length || 1;

  let caracteresFaladosAteAqui = 0;
  const character_start_times_seconds = characters.map((ch, i) => {
    const alvo = (caracteresFaladosAteAqui / totalCaracteresFalados) * totalSegundosDeFala;
    if (contaComoFala[i]) caracteresFaladosAteAqui++;
    return paraInstanteReal(alvo);
  });

  return { characters, character_start_times_seconds };
}
