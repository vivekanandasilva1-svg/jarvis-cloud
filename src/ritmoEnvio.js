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

// ---------------- REFORCO NO MESMO DIA (manha + inicio da tarde) ----------------
// Cada mensagem proativa que o lead nao responde ganha um REFORCO: enviada de manha, o reforco sai no inicio da tarde do mesmo
// dia; enviada a tarde/noite, sai na manha do dia seguinte (e sempre pelo menos 3 horas depois da primeira).
const FUSO = 'America/Maceio'; // UTC-3 fixo
export const horaLocalHHMM = (d) => d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
const dataLocal = (d) => d.toLocaleDateString('en-CA', { timeZone: FUSO });

export function instanteDoReforco(enviadaEm, { horaManha = '09:00', horaTarde = '14:00' } = {}) {
  const dia = dataLocal(enviadaEm);
  if (horaLocalHHMM(enviadaEm) < horaTarde) {
    const tarde = new Date(`${dia}T${horaTarde}:00-03:00`);
    if (tarde.getTime() - enviadaEm.getTime() >= 3 * 3600 * 1000) return tarde;
  }
  const amanha = dataLocal(new Date(new Date(`${dia}T12:00:00-03:00`).getTime() + 24 * 3600 * 1000));
  return new Date(`${amanha}T${horaManha}:00-03:00`);
}
