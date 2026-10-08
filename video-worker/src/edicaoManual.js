// edicao manual pela linha do tempo: o cliente move, estica, apaga e reescreve itens da edicao
// (textos, numeros, listas, midias, efeitos, zooms, transicoes, palavras da legenda) e o servico
// re-renderiza SEM chamar a IA. Tudo que chega do navegador e conferido aqui - so passam campos
// conhecidos, com valores dentro dos limites do video.
import { TIPOS_EFEITO, TIPOS_TRANSICAO } from './diretor.js';

const um = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
const texto = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function intervalo(x, total) {
  const inicio = Math.max(0, Math.min(total - 1, Math.round(Number(x.inicio) || 0)));
  const fim = Math.max(inicio + 6, Math.min(total, Math.round(Number(x.fim) || 0)));
  return { inicio, fim: Math.min(total, fim) };
}

// aplica a edicao (mesmo formato do roteiro, so as listas editaveis) sobre o roteiro atual
export function aplicarEdicao(roteiro, edicao, midias) {
  const total = roteiro.duracaoFrames;
  const lista = (nome, max = 80) => (Array.isArray(edicao[nome]) ? edicao[nome].slice(0, max) : roteiro[nome] || []);
  const midiaValida = (mid, aceitaVideo = true) => midias[mid] && midias[mid].kind !== 'audio' && (aceitaVideo || midias[mid].kind === 'imagem');

  const novo = { ...roteiro };
  novo.textos = lista('textos').map((t) => ({ ...intervalo(t, total), texto: texto(t.texto, 80), estilo: um(t.estilo, ['impacto', '3d', 'topo', 'etiqueta'], 'impacto') })).filter((t) => t.texto);
  novo.textosAtras = lista('textosAtras').map((t) => ({ ...intervalo(t, total), texto: texto(t.texto, 30), movimento: um(t.movimento, ['deslizar', 'subir', 'zoom', 'giro3d'], 'deslizar') })).filter((t) => t.texto);
  novo.numeros = lista('numeros').map((n) => ({
    ...intervalo(n, total), valor: Number.isFinite(Number(n.valor)) ? Number(n.valor) : 0,
    prefixo: texto(n.prefixo, 8), sufixo: texto(n.sufixo, 12), rotulo: texto(n.rotulo, 40),
  }));
  novo.listas = lista('listas').map((l) => ({
    ...intervalo(l, total), titulo: texto(l.titulo, 40),
    itens: (Array.isArray(l.itens) ? l.itens : []).map((i) => texto(i, 40)).filter(Boolean).slice(0, 8),
  })).filter((l) => l.itens.length);
  novo.insercoes = lista('insercoes').filter((x) => midiaValida(x.midia))
    .map((x) => ({ ...intervalo(x, total), midia: x.midia, kind: midias[x.midia].kind, src: midias[x.midia].src, modo: um(x.modo, ['tela_cheia', 'janela'], 'tela_cheia') }));
  novo.elementos = lista('elementos').filter((x) => midiaValida(x.midia, false))
    .map((x) => ({
      ...intervalo(x, total), midia: x.midia, src: midias[x.midia].src, camada: um(x.camada, ['atras', 'frente'], 'frente'),
      posicao: um(x.posicao, ['esquerda', 'direita', 'centro', 'topo'], 'direita'), movimento: um(x.movimento, ['flutuar', 'girar', 'entrar'], 'flutuar'),
    }));
  novo.fundos = lista('fundos').filter((f) => f.tipo !== 'imagem' || midiaValida(f.midia))
    .map((f) => {
      const tipo = um(f.tipo, ['imagem', 'gradiente', 'desfocado', 'escuro'], 'desfocado');
      return { ...intervalo(f, total), tipo, midia: tipo === 'imagem' ? f.midia : '', src: tipo === 'imagem' ? midias[f.midia].src : null, kind: tipo === 'imagem' ? midias[f.midia].kind : null };
    });
  novo.divisoes = lista('divisoes').filter((d) => midiaValida(d.midia))
    .map((d) => ({ ...intervalo(d, total), midia: d.midia, src: midias[d.midia].src, kind: midias[d.midia].kind, layout: um(d.layout, ['cima_baixo', 'lado_a_lado', 'janela_pessoa'], 'cima_baixo') }));
  novo.efeitos = lista('efeitos').map((e) => ({ ...intervalo(e, total), tipo: um(e.tipo, TIPOS_EFEITO, 'preto_branco') }));
  novo.zooms = lista('zooms', 200).map((z) => ({ frame: Math.max(0, Math.min(total - 1, Math.round(Number(z.frame) || 0))), tipo: um(z.tipo, ['soco', 'lento', 'dramatico'], 'soco') }))
    .sort((a, b) => a.frame - b.frame);
  novo.transicoes = lista('transicoes', 200).map((t) => ({ frame: Math.max(1, Math.min(total - 2, Math.round(Number(t.frame) || 0))), tipo: um(t.tipo, TIPOS_TRANSICAO, 'flash') }))
    .sort((a, b) => a.frame - b.frame);
  // legenda: so o TEXTO e o destaque de cada palavra mudam (o tempo vem da fala)
  if (Array.isArray(edicao.palavras) && edicao.palavras.length === (roteiro.palavras || []).length) {
    novo.palavras = roteiro.palavras.map((p, i) => ({ ...p, t: texto(edicao.palavras[i]?.t, 40) || p.t, d: !!edicao.palavras[i]?.d }));
  }
  if (typeof edicao.legendas === 'boolean') novo.legendas = edicao.legendas;
  if (['alta', 'media'].includes(edicao.alturaTextos)) novo.alturaTextos = edicao.alturaTextos;
  if (['baixo', 'meio'].includes(edicao.posicaoLegenda)) novo.posicaoLegenda = edicao.posicaoLegenda;
  return novo;
}

export function precisaPessoa(r) {
  return (r.textosAtras || []).length > 0 || (r.fundos || []).length > 0
    || (r.elementos || []).some((e) => e.camada === 'atras') || (r.efeitos || []).some((e) => e.tipo === 'desfoque_fundo');
}

// recalcula o que deriva das camadas: trechos com a pessoa recortada e os efeitos sonoros
export function recalcularDerivados(r, pessoaSrc) {
  const trechos = [
    ...(r.textosAtras || []), ...(r.fundos || []), ...(r.elementos || []).filter((e) => e.camada === 'atras'),
    ...(r.efeitos || []).filter((e) => e.tipo === 'desfoque_fundo'),
  ].map((x) => [x.inicio, x.fim]).sort((a, b) => a[0] - b[0]);
  const pessoa = [];
  for (const [a, b] of trechos) {
    const u = pessoa[pessoa.length - 1];
    if (u && a <= u[1] + 15) u[1] = Math.max(u[1], b); else pessoa.push([a, b]);
  }
  const sfx = [
    ...r.textos.map((t) => ({ frame: t.inicio - 2, tipo: t.estilo === 'etiqueta' ? 'pop' : 'whoosh' })),
    ...r.numeros.map((n) => ({ frame: n.inicio - 2, tipo: 'pop' })),
    ...r.listas.map((l) => ({ frame: l.inicio - 2, tipo: 'whoosh' })),
    ...(r.insercoes || []).map((x) => ({ frame: x.inicio - 2, tipo: 'whoosh' })),
    ...(r.divisoes || []).map((x) => ({ frame: x.inicio - 2, tipo: 'whoosh' })),
    ...(r.textosAtras || []).map((x) => ({ frame: x.inicio - 2, tipo: 'whoosh' })),
    ...(r.transicoes || []).filter((t) => ['whip', 'giro', 'glitch'].includes(t.tipo)).map((t) => ({ frame: t.frame - 3, tipo: 'whoosh' })),
  ].map((s) => ({ ...s, frame: Math.max(0, s.frame) })).sort((a, b) => a.frame - b.frame)
    .filter((s, i, arr) => i === 0 || s.frame - arr[i - 1].frame > 8);
  return { ...r, sfx, pessoaSrc: pessoa.length && pessoaSrc ? pessoaSrc : null, trechosPessoa: pessoaSrc ? pessoa : [] };
}
