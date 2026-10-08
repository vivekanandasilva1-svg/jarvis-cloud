// converte o plano da IA (ancorado em numeros de palavras do video BRUTO) no roteiro que a
// composicao Remotion desenha (tudo em frames do video FINAL, ja descontados os cortes).
export const FPS = 30;

export const FORMATOS = {
  '9:16': { largura: 1080, altura: 1920 },
  '4:5': { largura: 1080, altura: 1350 },
  '1:1': { largura: 1080, altura: 1080 },
  '16:9': { largura: 1920, altura: 1080 },
};

// pausa maior que isso entre duas palavras vira corte (tira o "ar morto" do video)
const PAUSA_MAX = 0.35;
const RESPIRO_ANTES = 0.08;
const RESPIRO_DEPOIS = 0.18;
const DURACAO_MIN_SOBREPOSICAO = 1.3;

export function montarRoteiro({ palavras, plano, meta, opcoes, videoSrc }) {
  const { largura, altura } = FORMATOS[opcoes.formato] || FORMATOS['9:16'];
  const removidas = new Set();
  for (const r of plano.remover) for (let n = r.de; n <= r.ate; n++) removidas.add(n);

  // 1) segmentos do video bruto que ficam
  const segmentosSrc = [];
  if (!palavras.length) {
    segmentosSrc.push({ inicio: 0, fim: meta.duracao, palavras: [] });
  } else {
    let atual = null;
    palavras.forEach((p, n) => {
      if (removidas.has(n)) { atual = null; return; }
      const anterior = atual && palavras[atual.palavras[atual.palavras.length - 1]];
      if (!atual || p.i - anterior.f > PAUSA_MAX) {
        atual = { palavras: [] };
        segmentosSrc.push(atual);
      }
      atual.palavras.push(n);
    });
    segmentosSrc.forEach((s, k) => {
      const primeira = palavras[s.palavras[0]];
      const ultima = palavras[s.palavras[s.palavras.length - 1]];
      const fimAnterior = k > 0 ? segmentosSrc[k - 1].fim : 0;
      // respiro nao pode invadir palavra removida/vizinha
      const idxDepois = s.palavras[s.palavras.length - 1] + 1;
      const limiteDepois = palavras[idxDepois] ? palavras[idxDepois].i - 0.02 : meta.duracao;
      const idxAntes = s.palavras[0] - 1;
      const limiteAntes = idxAntes >= 0 ? palavras[idxAntes].f + 0.02 : 0;
      s.inicio = Math.max(fimAnterior, limiteAntes, primeira.i - RESPIRO_ANTES, 0);
      s.fim = Math.min(meta.duracao, Math.max(ultima.f + 0.02, Math.min(limiteDepois, ultima.f + RESPIRO_DEPOIS)));
    });
  }

  // 2) segmentos em frames do video final
  let cursor = 0;
  const segmentos = segmentosSrc
    .map((s) => ({ ...s, srcInicioFrame: Math.round(s.inicio * FPS), duracao: Math.round((s.fim - s.inicio) * FPS) }))
    .filter((s) => s.duracao >= 2)
    .map((s, k) => {
      const seg = { srcInicioFrame: s.srcInicioFrame, outInicio: cursor, duracao: s.duracao, escala: k % 2 === 1 ? 1.07 : 1, palavras: s.palavras };
      cursor += s.duracao;
      return seg;
    });
  const duracaoFrames = Math.max(1, cursor);

  // 3) posicao de cada palavra mantida no video final
  const posicao = new Map(); // indice -> { i, f } em frames do video final
  for (const s of segmentos) {
    for (const n of s.palavras) {
      const p = palavras[n];
      const i = s.outInicio + Math.round(p.i * FPS) - s.srcInicioFrame;
      const f = s.outInicio + Math.round(p.f * FPS) - s.srcInicioFrame;
      posicao.set(n, { i: Math.max(s.outInicio, i), f: Math.min(s.outInicio + s.duracao, Math.max(i + 1, f)) });
    }
  }
  // ancora de uma palavra cortada = a proxima mantida (ou a anterior, se for o fim)
  const ancora = (n, campo) => {
    for (let k = n; k < palavras.length; k++) if (posicao.has(k)) return posicao.get(k)[campo];
    for (let k = n; k >= 0; k--) if (posicao.has(k)) return posicao.get(k)[campo];
    return 0;
  };

  const destaques = new Set(plano.destaques);
  const palavrasSaida = [...posicao.entries()]
    .sort((a, b) => a[1].i - b[1].i)
    .map(([n, pos]) => ({ t: palavras[n].t, i: pos.i / FPS, f: pos.f / FPS, d: destaques.has(n) }));

  // 4) sobreposicoes (textos, numeros, listas) - uma de cada vez, com tempo minimo de leitura
  const sobreposicoes = [
    ...plano.textos.map((t) => ({ tipo: 'texto', ...t })),
    ...plano.numeros.map((x) => ({ tipo: 'numero', ...x })),
    ...plano.listas.map((l) => ({ tipo: 'lista', ...l })),
  ]
    .map((o) => {
      const inicio = Math.max(0, ancora(o.de, 'i') - 3);
      const fim = Math.min(duracaoFrames, Math.max(ancora(o.ate, 'f') + 12, inicio + Math.round(DURACAO_MIN_SOBREPOSICAO * FPS)));
      return { ...o, inicio, fim };
    })
    .sort((a, b) => a.inicio - b.inicio);
  const aceitas = [];
  for (const o of sobreposicoes) {
    const ultima = aceitas[aceitas.length - 1];
    if (ultima && o.inicio < ultima.fim) {
      // encosta na anterior se ainda sobrar tempo de leitura; senao descarta
      if (o.fim - ultima.fim >= DURACAO_MIN_SOBREPOSICAO * FPS) o.inicio = ultima.fim;
      else continue;
    }
    if (o.fim - o.inicio >= FPS * 0.8) aceitas.push(o);
  }

  // 5) zooms (com espacamento minimo) e efeitos sonoros nas entradas
  const zooms = [];
  for (const z of [...plano.zooms].sort((a, b) => a.palavra - b.palavra)) {
    const frame = ancora(z.palavra, 'i');
    if (zooms.length && frame - zooms[zooms.length - 1].frame < FPS * 1.6) continue;
    zooms.push({ frame, tipo: z.tipo });
  }
  const sfx = aceitas.map((o) => ({
    frame: Math.max(0, o.inicio - 2),
    tipo: o.tipo === 'numero' || o.estilo === 'etiqueta' ? 'pop' : 'whoosh',
  }));

  return {
    largura, altura, fps: FPS, duracaoFrames, videoSrc,
    estilo: opcoes.estilo, corDestaque: opcoes.corDestaque || null,
    legendas: opcoes.legendas !== false && plano.legendas !== false,
    posicaoLegenda: plano.posicao_legenda,
    alturaTextos: plano.altura_textos === 'media' ? 'media' : 'alta',
    segmentos: segmentos.map(({ palavras: _p, ...s }) => s),
    palavras: palavrasSaida,
    zooms,
    textos: aceitas.filter((o) => o.tipo === 'texto').map((o) => ({ inicio: o.inicio, fim: o.fim, texto: o.texto, estilo: o.estilo })),
    numeros: aceitas.filter((o) => o.tipo === 'numero').map((o) => ({ inicio: o.inicio, fim: o.fim, valor: o.valor, prefixo: o.prefixo, sufixo: o.sufixo, rotulo: o.rotulo })),
    listas: aceitas.filter((o) => o.tipo === 'lista').map((o) => ({ inicio: o.inicio, fim: o.fim, titulo: o.titulo, itens: o.itens })),
    sfx,
  };
}

// momentos que valem um quadro de previa pra revisao de qualidade: meio de cada sobreposicao +
// alguns trechos so com legenda
export function momentosRevisao(roteiro, max = 8) {
  const momentos = [
    ...roteiro.textos.map((t) => ({ frame: Math.round(t.inicio + (t.fim - t.inicio) * 0.6), descricao: `texto ${t.estilo}: "${t.texto}"` })),
    ...roteiro.numeros.map((x) => ({ frame: Math.round(x.inicio + (x.fim - x.inicio) * 0.7), descricao: `numero ${x.prefixo}${x.valor}${x.sufixo}` })),
    ...roteiro.listas.map((l) => ({ frame: l.fim - 15, descricao: `lista "${l.titulo}"` })),
  ];
  for (const frac of [0.25, 0.5, 0.8]) momentos.push({ frame: Math.round(roteiro.duracaoFrames * frac), descricao: 'legenda' });
  return momentos
    .filter((m) => m.frame >= 0 && m.frame < roteiro.duracaoFrames)
    .sort((a, b) => a.frame - b.frame)
    .slice(0, max);
}
