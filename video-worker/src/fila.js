// projetos de edicao + fila de processamento. UMA edicao processa por vez, de proposito (o servico
// tem 1 CPU reservada). Estado de cada projeto fica em /data/jobs/<id>/job.json - sobrevive a
// reinicio do container, e quem estava no meio do processo volta pra fila sozinho.
//
// Um projeto nasce como "rascunho": o cliente envia o video principal, opcionalmente um video
// referencia (estilo a imitar) e midias de apoio (imagens, videos, audios). So quando ele pede
// "Editar com IA" o projeto entra na fila.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as midia from './midia.js';
import { transcrever } from './transcricao.js';
import * as diretor from './diretor.js';
import { montarRoteiro, momentosRevisao, FORMATOS } from './montarRoteiro.js';
import { renderizar, quadroPrevia } from './render.js';
import { recortarPessoa } from './recorte.js';
import { gerarImagem } from './imagens.js';
import { aplicarEdicao, precisaPessoa, recalcularDerivados } from './edicaoManual.js';

export const PASTA_DADOS = process.env.DATA_DIR || '/data';
const PASTA_JOBS = path.join(PASTA_DADOS, 'jobs');
const DURACAO_MAX = Number(process.env.DURACAO_MAX_SEGUNDOS || 600);
const DIAS_RETENCAO = Number(process.env.DIAS_RETENCAO || 30);
const MAX_MIDIAS_APOIO = 15;
const FINAIS = new Set(['pronto', 'erro', 'rascunho']);
const ESTILOS = ['criador', 'neon', 'clinica', 'impacto', 'documentario'];

export const pasta = (id) => path.join(PASTA_JOBS, id);
const arq = (id, nome) => path.join(pasta(id), nome);
export const pastaMidia = (id, mid) => path.join(pasta(id), 'midias', mid);

export function idValido(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

async function lerJson(arquivo) {
  return JSON.parse(await fs.readFile(arquivo, 'utf8'));
}
async function gravarJson(arquivo, dados) {
  const tmp = `${arquivo}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dados));
  await fs.rename(tmp, arquivo);
}
const existe = (f) => fs.access(f).then(() => true, () => false);

export async function obter(id) {
  try { return await lerJson(arq(id, 'job.json')); } catch { return null; }
}

// quando o container recebe ordem de desligar (deploy novo), para de gravar progresso: o container
// novo ja assumiu a edicao e uma gravacao atrasada daqui sobrescreveria o estado dele
let encerrando = false;
let emExecucao = null;

export async function encerrar() {
  if (encerrando) return;
  if (emExecucao) await atualizar(emExecucao, { status: 'na_fila', etapa: 'na_fila', progresso: 0 }).catch(() => {});
  encerrando = true;
}

// gravacoes do mesmo projeto em serie (upload de midia e progresso podem chegar juntos)
const travas = new Map();
// projetos apagados enquanto processavam: a edicao em andamento e abandonada sem gravar nada
const apagados = new Set();

async function atualizar(id, mudancas) {
  if (encerrando || apagados.has(id)) return null;
  const anterior = travas.get(id) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(async () => {
    if (!(await existe(pasta(id)))) return null; // pasta sumiu (projeto apagado) - nao recria nada
    const job = (await obter(id)) || { id };
    const novo = typeof mudancas === 'function' ? mudancas(job) : mudancas;
    Object.assign(job, novo, { atualizadoEm: new Date().toISOString() });
    await gravarJson(arq(id, 'job.json'), job);
    return job;
  });
  travas.set(id, atual);
  try { return await atual; } finally { if (travas.get(id) === atual) travas.delete(id); }
}

// ---------- fila ----------
const fila = [];
let rodando = false;

function enfileirar(id) {
  if (!fila.includes(id)) fila.push(id);
  processarFila();
}

async function processarFila() {
  if (rodando) return;
  rodando = true;
  try {
    while (fila.length) {
      const id = fila.shift();
      const job = await obter(id);
      if (!job || FINAIS.has(job.status)) continue;
      emExecucao = id;
      try {
        await executar(job);
      } catch (err) {
        if (apagados.has(id)) {
          console.log(`[${id}] projeto apagado durante o processamento - edicao cancelada`);
        } else {
          console.error(`[${id}] erro:`, err);
          await atualizar(id, { status: 'erro', etapa: 'erro', erro: String(err.message || err).slice(0, 500), pendente: null }).catch(() => {});
        }
      } finally {
        emExecucao = null;
      }
    }
  } finally {
    rodando = false;
  }
}

export function posicaoNaFila(id) {
  const i = fila.indexOf(id);
  return i < 0 ? 0 : i + 1;
}

// ---------- projeto ----------

function normalizarOpcoes(opcoes = {}, atuais = {}) {
  const v = { ...atuais, ...opcoes };
  return {
    estilo: ESTILOS.includes(v.estilo) ? v.estilo : 'criador',
    formato: FORMATOS[v.formato] ? v.formato : '9:16',
    instrucoes: String(v.instrucoes || '').slice(0, 2000),
    corDestaque: /^#[0-9a-fA-F]{6}$/.test(v.corDestaque || '') ? v.corDestaque : null,
    legendas: v.legendas !== false && v.legendas !== 'false',
    revisaoAutomatica: v.revisaoAutomatica !== false && v.revisaoAutomatica !== 'false',
  };
}

export async function criar({ id, tenantId, nome, opcoes }) {
  await fs.mkdir(path.join(pasta(id), 'midias'), { recursive: true });
  return atualizar(id, {
    id, tenantId, nomeOriginal: String(nome || 'Novo projeto').slice(0, 200), criadoEm: new Date().toISOString(),
    status: 'rascunho', etapa: 'rascunho', progresso: 0, erro: null,
    opcoes: normalizarOpcoes(opcoes), midias: [], ajustes: [], pendente: null,
  });
}

export async function atualizarOpcoes(id, opcoes) {
  return atualizar(id, (job) => ({ opcoes: normalizarOpcoes(opcoes, job.opcoes) }));
}

// recebe o arquivo (ja gravado em disco pelo server.js) e registra como midia do projeto
export async function registrarMidia(id, { mid, tipo, nome, mime, arquivo, tamanho }) {
  const job = await obter(id);
  if (!job) throw new Error('projeto nao encontrado');
  const kind = tipo === 'apoio' ? midia.tipoMidia(nome, mime) : 'video';
  if (tipo === 'apoio' && (job.midias || []).filter((m) => m.tipo === 'apoio').length >= MAX_MIDIAS_APOIO) {
    throw new Error(`limite de ${MAX_MIDIAS_APOIO} midias de apoio por projeto`);
  }
  let info = {};
  try {
    info = await midia.inspecionarMidia(arquivo, kind, path.join(pastaMidia(id, mid), 'miniatura.jpg'));
  } catch (err) {
    throw new Error(`nao consegui ler esse arquivo (${kind}) - ${err.message.slice(0, 120)}`);
  }
  if (tipo === 'principal' && info.duracao > DURACAO_MAX + 1) {
    throw new Error(`o video tem ${Math.round(info.duracao)}s - o limite e ${Math.round(DURACAO_MAX / 60)} minutos`);
  }
  const registro = { id: mid, tipo, kind, nome: String(nome).slice(0, 200), tamanho, duracao: info.duracao || null, criadoEm: new Date().toISOString() };
  // principal e referencia sao unicos: o novo substitui o anterior
  let substituidas = [];
  await atualizar(id, (j) => {
    const midias = j.midias || [];
    substituidas = tipo === 'apoio' ? [] : midias.filter((m) => m.tipo === tipo);
    const mudancas = { midias: [...midias.filter((m) => !substituidas.includes(m)), registro] };
    if (tipo === 'principal') mudancas.nomeOriginal = registro.nome;
    return mudancas;
  });
  for (const m of substituidas) await fs.rm(pastaMidia(id, m.id), { recursive: true, force: true });
  return registro;
}

export async function removerMidia(id, mid) {
  const job = await obter(id);
  if (!job) throw new Error('projeto nao encontrado');
  if (!FINAIS.has(job.status)) throw new Error('espere a edicao terminar pra mexer nas midias');
  await atualizar(id, (j) => ({ midias: (j.midias || []).filter((m) => m.id !== mid) }));
  await fs.rm(pastaMidia(id, mid), { recursive: true, force: true });
}

export function arquivoMidia(id, mid, qual) {
  return path.join(pastaMidia(id, mid), qual === 'miniatura' ? 'miniatura.jpg' : 'original');
}

// "Editar com IA": edicao completa do zero (tambem serve pra refazer depois de trocar midias)
export async function iniciar(id, opcoes) {
  const job = await obter(id);
  if (!job) throw new Error('projeto nao encontrado');
  if (!FINAIS.has(job.status)) throw new Error('essa edicao ja esta em andamento');
  const temPrincipal = (job.midias || []).some((m) => m.tipo === 'principal') || (await existe(arq(id, 'original')));
  if (!temPrincipal) throw new Error('envie o video que sera editado');
  await atualizar(id, (j) => ({
    opcoes: normalizarOpcoes(opcoes, j.opcoes),
    status: 'na_fila', etapa: 'na_fila', progresso: 0, erro: null, pendente: { tipo: 'completo' },
  }));
  enfileirar(id);
}

export async function pedirAjuste(id, pedido) {
  const job = await obter(id);
  if (!job) throw new Error('edicao nao encontrada');
  if (!['pronto', 'erro'].includes(job.status)) throw new Error('essa edicao ainda esta em andamento - espere terminar pra pedir ajuste');
  if (!(await existe(arq(id, 'plano.json')))) throw new Error('essa edicao ainda nao tem um plano pra ajustar - use "Editar com IA"');
  await atualizar(id, { status: 'na_fila', etapa: 'na_fila', progresso: 0, erro: null, pendente: { tipo: 'ajuste', pedido: String(pedido).slice(0, 2000) } });
  enfileirar(id);
}

export async function apagar(id) {
  const i = fila.indexOf(id);
  if (i >= 0) fila.splice(i, 1);
  if (emExecucao === id) apagados.add(id); // a edicao em andamento vai falhar ao tentar ler/gravar - e esperado
  await fs.rm(pasta(id), { recursive: true, force: true });
}

export async function linhaDoTempo(id) {
  const [roteiro, ondas] = await Promise.all([
    lerJson(arq(id, 'roteiro.json')).catch(() => null),
    lerJson(arq(id, 'ondas.json')).catch(() => null),
  ]);
  if (!roteiro) return null;
  // os enderecos internos (loopback) nao servem pro navegador - so o id da midia
  const { videoSrc: _v, ...resto } = roteiro;
  return {
    ...resto,
    insercoes: (roteiro.insercoes || []).map(({ src: _s, ...x }) => x),
    elementos: (roteiro.elementos || []).map(({ src: _s, ...x }) => x),
    fundos: (roteiro.fundos || []).map(({ src: _s, ...x }) => x),
    divisoes: (roteiro.divisoes || []).map(({ src: _s, ...x }) => x),
    pessoaSrc: undefined,
    trilha: roteiro.trilha ? { midia: roteiro.trilha.midia } : null,
    ondas, temTira: await existe(arq(id, 'tira.jpg')),
  };
}

// ---------- pipeline ----------

const urlInterna = (id, rel) => `http://127.0.0.1:${process.env.PORT || 4100}/interno/midia/${id}/${rel}`;

async function quadrosDe(arquivo, duracao, prefixo, fracoes) {
  const quadros = [];
  for (const [k, frac] of fracoes.entries()) {
    const saida = `${prefixo}-${k}.jpg`;
    try {
      await midia.extrairQuadro(arquivo, duracao * frac, saida, 360);
      quadros.push({ arquivo: saida, segundo: duracao * frac });
    } catch { /* quadro e opcional */ }
  }
  return quadros;
}

// gera as imagens que o diretor pediu (gerar_imagens) e troca os apelidos do plano ("g1") pelo id
// da midia gravada. Imagem que falhar some do plano (o resto da edicao continua).
async function gerarImagensDoPlano(job, plano, opcoes, midiasRender) {
  const pedidos = plano.gerar_imagens || [];
  if (!pedidos.length) return plano;
  const { id } = job;
  await atualizar(id, { etapa: 'gerando_imagens', progresso: 0.22 });
  const mapa = new Map();
  const faltando = new Set();
  // 2 por vez: rapido sem estourar o limite de chamadas
  for (let i = 0; i < pedidos.length; i += 2) {
    await Promise.all(pedidos.slice(i, i + 2).map(async (g) => {
      const mid = crypto.randomBytes(8).toString('hex');
      const dir = pastaMidia(id, mid);
      try {
        await fs.mkdir(dir, { recursive: true });
        await gerarImagem({ ...g, formato: opcoes.formato }, path.join(dir, 'pronto.png'), path.join(dir, 'miniatura.jpg'));
        await fs.copyFile(path.join(dir, 'pronto.png'), path.join(dir, 'original'));
        const registro = {
          id: mid, tipo: 'gerada', kind: 'imagem', nome: `${g.tipo.replace('_', ' ')}: ${g.prompt.slice(0, 80)}`, prompt: g.prompt,
          recortada: g.tipo === 'objeto_3d' || g.tipo === 'icone', tamanho: (await fs.stat(path.join(dir, 'pronto.png'))).size, criadoEm: new Date().toISOString(),
        };
        await atualizar(id, (j) => ({ midias: [...(j.midias || []), registro] }));
        job.midias = [...(job.midias || []), registro];
        midiasRender[mid] = { kind: 'imagem', src: urlInterna(id, `midias/${mid}/pronto.png`) };
        mapa.set(g.id, mid);
      } catch (err) {
        console.error(`[${id}] imagem ${g.id} falhou:`, err.message);
        await fs.rm(dir, { recursive: true, force: true });
        faltando.add(g.id);
      }
    }));
  }
  const troca = (v) => mapa.get(v) || v;
  const novo = diretor.semImagens({
    ...plano,
    gerar_imagens: [],
    insercoes: plano.insercoes.map((x) => ({ ...x, midia: troca(x.midia) })),
    elementos: plano.elementos.map((x) => ({ ...x, imagem: troca(x.imagem) })),
    fundos: plano.fundos.map((x) => ({ ...x, imagem: troca(x.imagem) })),
    divisoes: plano.divisoes.map((x) => ({ ...x, midia: troca(x.midia) })),
  }, faltando);
  if (faltando.size) novo.resumo = `${novo.resumo} (${faltando.size} imagem(ns) não puderam ser geradas e ficaram de fora.)`;
  return novo;
}

async function limparTemporarios(id) {
  for (const f of await fs.readdir(pasta(id))) {
    if (/^(contexto|previa|referencia)-\d+\.jpg$/.test(f)) await fs.rm(arq(id, f), { force: true });
  }
}

async function executar(job) {
  const { id, opcoes } = job;
  const pend = job.pendente || { tipo: 'completo' };
  if (pend.tipo === 'manual') return executarManual(job);
  const midiasJob = job.midias || [];
  const principal = midiasJob.find((m) => m.tipo === 'principal');
  const arquivoPrincipal = principal ? arquivoMidia(id, principal.id) : arq(id, 'original'); // projetos antigos
  const referenciaMidia = midiasJob.find((m) => m.tipo === 'referencia');
  const apoio = midiasJob.filter((m) => m.tipo === 'apoio');

  let meta = job.meta;
  let palavras;
  let plano;
  let referencia = job.referencia || null;

  if (pend.tipo === 'completo') {
    await atualizar(id, { status: 'processando', etapa: 'preparando', progresso: 0.02, referencia: null, problemasCorrigidos: [] });
    referencia = null;
    await fs.rm(arq(id, 'pessoa.webm'), { force: true }); // base nova = recorte novo
    const info = await midia.analisar(arquivoPrincipal);
    if (info.duracao > DURACAO_MAX + 1) throw new Error(`o video tem ${Math.round(info.duracao)}s - o limite e ${Math.round(DURACAO_MAX / 60)} minutos`);
    const { largura, altura } = FORMATOS[opcoes.formato];
    meta = { duracao: info.duracao, larguraOriginal: info.largura, alturaOriginal: info.altura };
    await midia.normalizar(arquivoPrincipal, arq(id, 'base.mp4'), { largura, altura, temAudio: info.temAudio, hdr: info.hdr, duracao: info.duracao }, (p) => {
      atualizar(id, { progresso: 0.02 + 0.08 * p }).catch(() => {});
    });
    meta.duracao = (await midia.analisar(arq(id, 'base.mp4'))).duracao;
    await atualizar(id, { meta, etapa: 'transcrevendo', progresso: 0.1 });

    await midia.extrairAudioTranscricao(arq(id, 'base.mp4'), arq(id, 'audio.mp3'));
    const temFala = info.temAudio && (await midia.volumeMaximo(arq(id, 'audio.mp3'))) > -40;
    const transcricao = temFala ? await transcrever(arq(id, 'audio.mp3'), meta.duracao) : { texto: '', palavras: [] };
    palavras = transcricao.palavras;
    await gravarJson(arq(id, 'transcricao.json'), transcricao);
    await fs.rm(arq(id, 'audio.mp3'), { force: true });

    if (referenciaMidia) {
      await atualizar(id, { etapa: 'estudando_referencia', progresso: 0.14 });
      const arqRef = arquivoMidia(id, referenciaMidia.id);
      const infoRef = await midia.analisar(arqRef);
      const cortes = await midia.detectarCortes(arqRef);
      const quadrosRef = await quadrosDe(arqRef, infoRef.duracao, arq(id, 'referencia'), [0.05, 0.18, 0.31, 0.44, 0.57, 0.7, 0.83, 0.95]);
      referencia = await diretor.estudarReferencia({ quadros: quadrosRef, cortesPorMinuto: (cortes / Math.max(1, infoRef.duracao)) * 60, duracao: infoRef.duracao });
      await atualizar(id, { referencia });
    }
  } else {
    palavras = (await lerJson(arq(id, 'transcricao.json'))).palavras;
    await atualizar(id, { status: 'processando', etapa: 'dirigindo', progresso: 0.1 });
  }

  // midias de apoio prontas pra renderizacao (so as que ainda nao foram preparadas)
  const midiasRender = {};
  if (apoio.length) {
    await atualizar(id, { etapa: 'preparando_midias', progresso: 0.17 });
    for (const m of apoio) {
      const ext = m.kind === 'imagem' ? 'jpg' : m.kind === 'audio' ? 'm4a' : 'mp4';
      const pronto = path.join(pastaMidia(id, m.id), `pronto.${ext}`);
      if (!(await existe(pronto))) await midia.prepararMidia(arquivoMidia(id, m.id), m.kind, pronto);
      midiasRender[m.id] = { kind: m.kind, duracao: m.duracao, src: urlInterna(id, `midias/${m.id}/pronto.${ext}`) };
    }
  }
  // imagens geradas por IA em rodadas anteriores continuam disponiveis (o diretor pode reutilizar)
  for (const m of midiasJob.filter((x) => x.tipo === 'gerada')) {
    midiasRender[m.id] = { kind: 'imagem', src: urlInterna(id, `midias/${m.id}/pronto.png`) };
  }
  const apoioDiretor = () => (job.midias || []).filter((m) => m.tipo === 'apoio' || m.tipo === 'gerada')
    .map((m) => ({ ...m, miniatura: arquivoMidia(id, m.id, 'miniatura') }));
  const videoSrc = urlInterna(id, 'base.mp4');

  await atualizar(id, { etapa: 'dirigindo', progresso: 0.2 });
  const quadros = await quadrosDe(arq(id, 'base.mp4'), meta.duracao, arq(id, 'contexto'), [0.1, 0.35, 0.6, 0.85]);
  if (pend.tipo === 'completo') {
    plano = await diretor.planejar({ palavras, meta, opcoes, quadros, apoio: apoioDiretor(), referencia });
  } else {
    const planoAtual = await lerJson(arq(id, 'plano.json'));
    plano = await diretor.ajustar({ palavras, meta, opcoes, planoAtual, pedido: pend.pedido, quadros, apoio: apoioDiretor(), referencia });
  }

  // transforma o plano em coisa concreta: gera as imagens pedidas e recorta a pessoa se precisar
  let pessoaSrc = null;
  const materializar = async () => {
    plano = await gerarImagensDoPlano(job, plano, opcoes, midiasRender);
    if (diretor.precisaRecorte(plano)) {
      try {
        if (!(await existe(arq(id, 'pessoa.webm')))) {
          await atualizar(id, { etapa: 'recortando', progresso: 0.24 });
          const { largura, altura } = FORMATOS[opcoes.formato];
          await recortarPessoa(arq(id, 'base.mp4'), pasta(id), { largura, altura, duracao: meta.duracao }, (p) => {
            atualizar(id, { progresso: 0.24 + 0.05 * p }).catch(() => {});
          });
          await fs.rm(arq(id, 'mascara.mp4'), { force: true });
        }
        pessoaSrc = urlInterna(id, 'pessoa.webm');
      } catch (err) {
        // sem recorte o render ainda funciona: o que era "atras" vai pra frente e o fundo nao troca
        console.error(`[${id}] recorte falhou, seguindo sem ele:`, err.message);
      }
    }
  };
  await materializar();

  const montar = () => montarRoteiro({ palavras, plano, meta, opcoes, videoSrc, midias: midiasRender, referencia, pessoaSrc });
  let roteiro = montar();
  let problemas = [];

  // revisao de qualidade com quadros de previa (barato: so alguns frames, nao o video inteiro)
  if (opcoes.revisaoAutomatica && palavras.length) {
    await atualizar(id, { etapa: 'revisando', progresso: 0.3 });
    try {
      const previas = [];
      for (const [k, m] of momentosRevisao(roteiro).entries()) {
        const saida = arq(id, `previa-${k}.jpg`);
        await quadroPrevia(roteiro, m.frame, saida);
        previas.push({ arquivo: saida, segundo: m.frame / roteiro.fps, descricao: m.descricao });
      }
      const revisao = await diretor.revisarQuadros({ palavras, planoAtual: plano, quadros: previas, apoio: apoioDiretor() });
      if (!revisao.aprovado && revisao.plano) {
        problemas = revisao.problemas;
        plano = revisao.plano;
        await materializar();
        roteiro = montar();
      }
    } catch (err) {
      // revisao e um extra - se falhar, segue com o plano original em vez de perder a edicao
      console.error(`[${id}] revisao falhou, seguindo sem ela:`, err.message);
    }
  }
  await limparTemporarios(id);

  await gravarJson(arq(id, 'plano.json'), plano);
  await gravarJson(arq(id, 'roteiro.json'), roteiro);

  const ajustes = pend.tipo === 'ajuste' ? [...(job.ajustes || []), { pedido: pend.pedido, em: new Date().toISOString(), resumo: plano.resumo }] : job.ajustes || [];
  await renderizarEFinalizar(job, roteiro, { titulo: plano.titulo, resumo: plano.resumo, problemasCorrigidos: problemas, ajustes, edicoesManuais: 0 });
}

// midias prontas pro render (apoio enviadas + imagens geradas), preparando o que faltar
async function mapaMidias(job) {
  const mapa = {};
  for (const m of job.midias || []) {
    if (m.tipo === 'gerada') {
      mapa[m.id] = { kind: 'imagem', src: urlInterna(job.id, `midias/${m.id}/pronto.png`) };
    } else if (m.tipo === 'apoio') {
      const ext = m.kind === 'imagem' ? 'jpg' : m.kind === 'audio' ? 'm4a' : 'mp4';
      const pronto = path.join(pastaMidia(job.id, m.id), `pronto.${ext}`);
      if (!(await existe(pronto))) await midia.prepararMidia(arquivoMidia(job.id, m.id), m.kind, pronto);
      mapa[m.id] = { kind: m.kind, duracao: m.duracao, src: urlInterna(job.id, `midias/${m.id}/pronto.${ext}`) };
    }
  }
  return mapa;
}

export async function aplicarEdicaoManual(id, edicao) {
  const job = await obter(id);
  if (!job) throw new Error('edicao nao encontrada');
  if (!['pronto', 'erro'].includes(job.status)) throw new Error('espere a edicao atual terminar');
  if (!(await existe(arq(id, 'roteiro.json')))) throw new Error('essa edicao ainda nao tem linha do tempo');
  await gravarJson(arq(id, 'edicao-manual.json'), edicao || {});
  await atualizar(id, { status: 'na_fila', etapa: 'na_fila', progresso: 0, erro: null, pendente: { tipo: 'manual' } });
  enfileirar(id);
}

// re-render com as mudancas feitas a mao na linha do tempo - sem IA, so o motor de render
async function executarManual(job) {
  const { id } = job;
  await atualizar(id, { status: 'processando', etapa: 'aplicando_edicao', progresso: 0.05 });
  const midias = await mapaMidias(job);
  let roteiro = aplicarEdicao(await lerJson(arq(id, 'roteiro.json')), await lerJson(arq(id, 'edicao-manual.json')).catch(() => ({})), midias);
  let pessoaSrc = null;
  if (precisaPessoa(roteiro)) {
    try {
      if (!(await existe(arq(id, 'pessoa.webm')))) {
        await atualizar(id, { etapa: 'recortando', progresso: 0.1 });
        const { largura, altura } = FORMATOS[job.opcoes.formato] || FORMATOS['9:16'];
        await recortarPessoa(arq(id, 'base.mp4'), pasta(id), { largura, altura, duracao: job.meta.duracao }, (p) => {
          atualizar(id, { progresso: 0.1 + 0.2 * p }).catch(() => {});
        });
        await fs.rm(arq(id, 'mascara.mp4'), { force: true });
      }
      pessoaSrc = urlInterna(id, 'pessoa.webm');
    } catch (err) {
      console.error(`[${id}] recorte falhou na edicao manual:`, err.message);
    }
  }
  roteiro = recalcularDerivados(roteiro, pessoaSrc);
  await gravarJson(arq(id, 'roteiro.json'), roteiro);
  await fs.rm(arq(id, 'edicao-manual.json'), { force: true });
  await renderizarEFinalizar(job, roteiro, { edicoesManuais: (job.edicoesManuais || 0) + 1 });
}

// render + capa + dados da linha do tempo + estado final (comum a edicao pela IA e a manual)
async function renderizarEFinalizar(job, roteiro, extras) {
  const { id } = job;
  await atualizar(id, { etapa: 'renderizando', progresso: 0.35 });
  let ultimo = 0;
  await renderizar(roteiro, arq(id, 'final.tmp.mp4'), (p) => {
    const agora = Date.now();
    if (agora - ultimo < 3000) return;
    ultimo = agora;
    atualizar(id, { progresso: 0.35 + 0.58 * p }).catch(() => {});
  });
  await fs.rename(arq(id, 'final.tmp.mp4'), arq(id, 'final.mp4'));

  await atualizar(id, { etapa: 'finalizando', progresso: 0.95 });
  const duracaoFinal = roteiro.duracaoFrames / roteiro.fps;
  await midia.extrairQuadro(arq(id, 'final.mp4'), Math.min(1.2, duracaoFinal / 2), arq(id, 'capa.jpg'), 360);
  await midia.tiraMiniaturas(arq(id, 'final.mp4'), duracaoFinal, arq(id, 'tira.jpg')).catch(() => {});
  await gravarJson(arq(id, 'ondas.json'), await midia.picosAudio(arq(id, 'final.mp4')).catch(() => []));

  await atualizar(id, (j) => ({
    status: 'pronto', etapa: 'pronto', progresso: 1, pendente: null, erro: null,
    ...extras,
    duracaoFinal,
    contagem: {
      cortes: roteiro.segmentos.length - 1, textos: roteiro.textos.length, numeros: roteiro.numeros.length,
      listas: roteiro.listas.length, zooms: roteiro.zooms.length, insercoes: (roteiro.insercoes || []).length,
      transicoes: (roteiro.transicoes || []).length, trilha: !!roteiro.trilha, legendas: !!roteiro.legendas,
      alturaTextos: roteiro.alturaTextos,
      textosAtras: (roteiro.textosAtras || []).length, elementos: (roteiro.elementos || []).length,
      fundos: (roteiro.fundos || []).length, divisoes: (roteiro.divisoes || []).length, efeitos: (roteiro.efeitos || []).length,
      recorte: !!roteiro.pessoaSrc,
      imagensGeradas: (j.midias || []).filter((m) => m.tipo === 'gerada').length,
    },
  }));
}

// ---------- inicializacao e limpeza ----------

export async function iniciarServico() {
  await fs.mkdir(PASTA_JOBS, { recursive: true });
  const ids = await fs.readdir(PASTA_JOBS);
  for (const id of ids) {
    const job = await obter(id);
    if (!job) continue;
    // projetos do formato antigo (video em /original, sem lista de midias): vira midia "principal"
    if (!job.midias && (await existe(arq(id, 'original')))) {
      const mid = crypto.randomBytes(8).toString('hex');
      await fs.mkdir(pastaMidia(id, mid), { recursive: true });
      await fs.rename(arq(id, 'original'), arquivoMidia(id, mid));
      let info = {};
      try { info = await midia.inspecionarMidia(arquivoMidia(id, mid), 'video', arquivoMidia(id, mid, 'miniatura')); } catch { /* so a miniatura */ }
      const tamanho = (await fs.stat(arquivoMidia(id, mid))).size;
      await atualizar(id, { midias: [{ id: mid, tipo: 'principal', kind: 'video', nome: job.nomeOriginal || 'video', tamanho, duracao: info.duracao || null, criadoEm: job.criadoEm }] });
    }
    // edicoes prontas antes da linha do tempo existir: gera a forma de onda e a tira de miniaturas
    if (job.status === 'pronto' && !(await existe(arq(id, 'ondas.json'))) && (await existe(arq(id, 'final.mp4')))) {
      await midia.tiraMiniaturas(arq(id, 'final.mp4'), job.duracaoFinal || 30, arq(id, 'tira.jpg')).catch(() => {});
      await gravarJson(arq(id, 'ondas.json'), await midia.picosAudio(arq(id, 'final.mp4')).catch(() => []));
    }
    if (job.status === 'recebendo') {
      // upload interrompido no meio (formato antigo) - nao tem como continuar
      await atualizar(id, { status: 'erro', etapa: 'erro', erro: 'o envio do video foi interrompido - envie de novo' });
    } else if (!FINAIS.has(job.status)) {
      await atualizar(id, { status: 'na_fila', etapa: 'na_fila' });
      fila.push(id);
    }
  }
  processarFila();
  setInterval(limparAntigos, 6 * 60 * 60 * 1000).unref();
  limparAntigos();
}

async function limparAntigos() {
  const limite = Date.now() - DIAS_RETENCAO * 24 * 60 * 60 * 1000;
  for (const id of await fs.readdir(PASTA_JOBS).catch(() => [])) {
    const job = await obter(id);
    if (job && FINAIS.has(job.status) && new Date(job.atualizadoEm).getTime() < limite) {
      await fs.rm(pasta(id), { recursive: true, force: true }).catch(() => {});
    }
  }
}

export const NOME_ARQUIVOS = { video: 'final.mp4', capa: 'capa.jpg', tira: 'tira.jpg' };
