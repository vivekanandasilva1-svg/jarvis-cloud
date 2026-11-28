// Ritmo seguro dos envios PROATIVOS (follow-ups, primeiras tentativas, listas importadas): o WhatsApp bloqueia numero que
// manda varias mensagens seguidas pra quem nao falou antes. Aqui cada numero de WhatsApp (instancia) tem uma FILA: uma mensagem
// proativa por vez, com um intervalo aleatorio de 45 a 110 segundos entre uma e outra (~45 por hora no maximo). A primeira
// mensagem depois de um tempo parado sai na hora; so quando vem varias e que elas passam a sair aos poucos.
// Vale pro Follow Up e pro Follow Up Inteligente (que compartilham o mesmo numero), mesmo com varias rodadas em paralelo.
const MIN_S = Number(process.env.RITMO_MIN_S) || 45; // (as variaveis so existem pra teste)
const MAX_S = Number(process.env.RITMO_MAX_S) || 110;
const liberadoEm = new Map(); // instancia -> instante em que o proximo envio pode sair
const cauda = new Map(); // instancia -> promessa do ultimo da fila

export function esperarVez(instancia, { minS = MIN_S, maxS = MAX_S } = {}) {
  const chave = String(instancia || '');
  const anterior = cauda.get(chave) || Promise.resolve();
  const minha = anterior.then(async () => {
    const espera = (liberadoEm.get(chave) || 0) - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    liberadoEm.set(chave, Date.now() + (minS + Math.random() * (maxS - minS)) * 1000);
  });
  cauda.set(chave, minha.catch(() => {}));
  return minha;
}
