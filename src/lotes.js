// Roda fn(item, indice) sobre a lista com no maximo "n" chamadas ao mesmo tempo, devolvendo os
// resultados na ordem original. Usado pra falar com o Clinicorp em paralelo (sem estourar a API
// nem fazer 1 chamada de cada vez, que deixava a sincronizacao dos aniversariantes lenta).
export async function mapEmLotes(lista, n, fn) {
  const itens = Array.from(lista);
  const saida = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, itens.length)) }, trabalhador));
  return saida;
}
