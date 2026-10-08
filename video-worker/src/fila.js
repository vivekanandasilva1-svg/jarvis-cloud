// fila de edicoes: UMA por vez, de proposito (o servico tem 1 CPU reservada). Estado de cada
// edicao fica em /data/jobs/<id>/job.json - sobrevive a reinicio do container, e quem estava no
// meio do processo volta pra fila sozinho.
import fs from 'node:fs/promises';
import path from 'node:path';
import * as midia from './midia.js';
import { transcrever } from './transcricao.js';
import * as diretor from './diretor.js';
import { montarRoteiro, momentosRevisao, FORMATOS } from './montarRoteiro.js';
import { renderizar, quadroPrevia } from './render.js';

export const PASTA_DADOS = process.env.DATA_DIR || '/data';
const PASTA_JOBS = path.join(PASTA_DADOS, 'jobs');
const DURACAO_MAX = Number(process.env.DURACAO_MAX_SEGUNDOS || 600);
const DIAS_RETENCAO = Number(process.env.DIAS_RETENCAO || 30);
const FINAIS = new Set(['pronto', 'erro']);

export const pasta = (id) => path.join(PASTA_JOBS, id);
const arq = (id, nome) => path.join(pasta(id), nome);

export function idValido(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

async function lerJson(arquivo) {
  return JSON.parse(await fs.readFile(arquivo, 'utf8'));
}
async function gravarJson(arquivo, dados) {
  const tmp = `${arquivo}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dados));
  await fs.rename(tmp, arquivo);
}

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

async function atualizar(id, mudancas) {
  if (encerrando) return null;
  const job = (await obter(id)) || { id };
  Object.assign(job, mudancas, { atualizadoEm: new Date().toISOString() });
  await gravarJson(arq(id, 'job.json'), job);
  return job;
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
        console.error(`[${id}] erro:`, err);
        await atualizar(id, { status: 'erro', etapa: 'erro', erro: String(err.message || err).slice(0, 500), pendente: null });
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

// ---------- entrada ----------

export async function criar({ id, tenantId, nomeOriginal, opcoes }) {
  await fs.mkdir(pasta(id), { recursive: true });
  const formato = FORMATOS[opcoes.formato] ? opcoes.formato : '9:16';
  return atualizar(id, {
    id, tenantId, nomeOriginal, criadoEm: new Date().toISOString(),
    status: 'recebendo', etapa: 'recebendo', progresso: 0, erro: null,
    opcoes: {
      estilo: opcoes.estilo || 'criador', formato,
      instrucoes: String(opcoes.instrucoes || '').slice(0, 2000),
      corDestaque: /^#[0-9a-fA-F]{6}$/.test(opcoes.corDestaque || '') ? opcoes.corDestaque : null,
      legendas: opcoes.legendas !== false && opcoes.legendas !== 'false',
      revisaoAutomatica: opcoes.revisaoAutomatica !== false && opcoes.revisaoAutomatica !== 'false',
    },
    ajustes: [], pendente: { tipo: 'completo' },
  });
}

export function arquivoOriginal(id) {
  return arq(id, 'original');
}

export async function recebido(id) {
  await atualizar(id, { status: 'na_fila', etapa: 'na_fila' });
  enfileirar(id);
}

export async function pedirAjuste(id, pedido) {
  const job = await obter(id);
  if (!job) throw new Error('edicao nao encontrada');
  if (!FINAIS.has(job.status)) throw new Error('essa edicao ainda esta em andamento - espere terminar pra pedir ajuste');
  try { await fs.access(arq(id, 'plano.json')); } catch { throw new Error('essa edicao nao tem plano pra ajustar - envie o video de novo'); }
  await atualizar(id, { status: 'na_fila', etapa: 'na_fila', progresso: 0, erro: null, pendente: { tipo: 'ajuste', pedido: String(pedido).slice(0, 2000) } });
  enfileirar(id);
}

export async function apagar(id) {
  const i = fila.indexOf(id);
  if (i >= 0) fila.splice(i, 1);
  await fs.rm(pasta(id), { recursive: true, force: true });
}

// ---------- pipeline ----------

async function executar(job) {
  const { id, opcoes } = job;
  const pend = job.pendente || { tipo: 'completo' };
  const videoSrc = `http://127.0.0.1:${process.env.PORT || 4100}/interno/midia/${id}/base.mp4`;

  let meta = job.meta;
  let palavras;
  let plano;

  if (pend.tipo === 'completo') {
    await atualizar(id, { status: 'processando', etapa: 'preparando', progresso: 0.02 });
    const info = await midia.analisar(arq(id, 'original'));
    if (info.duracao > DURACAO_MAX + 1) throw new Error(`o video tem ${Math.round(info.duracao)}s - o limite e ${Math.round(DURACAO_MAX / 60)} minutos`);
    const { largura, altura } = FORMATOS[opcoes.formato];
    meta = { duracao: info.duracao, larguraOriginal: info.largura, alturaOriginal: info.altura };
    await midia.normalizar(arq(id, 'original'), arq(id, 'base.mp4'), { largura, altura, temAudio: info.temAudio, hdr: info.hdr });
    meta.duracao = (await midia.analisar(arq(id, 'base.mp4'))).duracao;
    await atualizar(id, { meta, etapa: 'transcrevendo', progresso: 0.12 });

    await midia.extrairAudioTranscricao(arq(id, 'base.mp4'), arq(id, 'audio.mp3'));
    const transcricao = info.temAudio ? await transcrever(arq(id, 'audio.mp3')) : { texto: '', palavras: [] };
    palavras = transcricao.palavras;
    await gravarJson(arq(id, 'transcricao.json'), transcricao);
    await fs.rm(arq(id, 'audio.mp3'), { force: true });

    await atualizar(id, { etapa: 'dirigindo', progresso: 0.2 });
    plano = await diretor.planejar({ palavras, meta, opcoes });
  } else {
    palavras = (await lerJson(arq(id, 'transcricao.json'))).palavras;
    const planoAtual = await lerJson(arq(id, 'plano.json'));
    await atualizar(id, { status: 'processando', etapa: 'dirigindo', progresso: 0.1 });
    plano = await diretor.ajustar({ palavras, meta, opcoes, planoAtual, pedido: pend.pedido });
  }

  let roteiro = montarRoteiro({ palavras, plano, meta, opcoes, videoSrc });
  let problemas = [];

  // revisao de qualidade com quadros de previa (barato: so alguns frames, nao o video inteiro)
  if (opcoes.revisaoAutomatica && palavras.length) {
    await atualizar(id, { etapa: 'revisando', progresso: 0.3 });
    try {
      const quadros = [];
      for (const [k, m] of momentosRevisao(roteiro).entries()) {
        const saida = arq(id, `previa-${k}.jpg`);
        await quadroPrevia(roteiro, m.frame, saida);
        quadros.push({ arquivo: saida, segundo: m.frame / roteiro.fps, descricao: m.descricao });
      }
      const revisao = await diretor.revisarQuadros({ palavras, planoAtual: plano, quadros });
      if (!revisao.aprovado && revisao.plano) {
        problemas = revisao.problemas;
        plano = revisao.plano;
        roteiro = montarRoteiro({ palavras, plano, meta, opcoes, videoSrc });
      }
    } catch (err) {
      // revisao e um extra - se falhar, segue com o plano original em vez de perder a edicao
      console.error(`[${id}] revisao falhou, seguindo sem ela:`, err.message);
    } finally {
      for (const f of await fs.readdir(pasta(id))) if (f.startsWith('previa-')) await fs.rm(arq(id, f), { force: true });
    }
  }

  await gravarJson(arq(id, 'plano.json'), plano);
  await gravarJson(arq(id, 'roteiro.json'), roteiro);

  await atualizar(id, { etapa: 'renderizando', progresso: 0.35 });
  let ultimo = 0;
  await renderizar(roteiro, arq(id, 'final.tmp.mp4'), (p) => {
    const agora = Date.now();
    if (agora - ultimo < 3000) return;
    ultimo = agora;
    atualizar(id, { progresso: 0.35 + 0.63 * p }).catch(() => {});
  });
  await fs.rename(arq(id, 'final.tmp.mp4'), arq(id, 'final.mp4'));
  await midia.extrairQuadro(arq(id, 'final.mp4'), Math.min(1.2, roteiro.duracaoFrames / roteiro.fps / 2), arq(id, 'capa.jpg'), 360);

  const ajustes = pend.tipo === 'ajuste' ? [...(job.ajustes || []), { pedido: pend.pedido, em: new Date().toISOString(), resumo: plano.resumo }] : job.ajustes || [];
  await atualizar(id, {
    status: 'pronto', etapa: 'pronto', progresso: 1, pendente: null, erro: null,
    titulo: plano.titulo, resumo: plano.resumo, problemasCorrigidos: problemas, ajustes,
    duracaoFinal: roteiro.duracaoFrames / roteiro.fps,
    contagem: { cortes: roteiro.segmentos.length - 1, textos: roteiro.textos.length, numeros: roteiro.numeros.length, listas: roteiro.listas.length, zooms: roteiro.zooms.length },
  });
}

// ---------- inicializacao e limpeza ----------

export async function iniciar() {
  await fs.mkdir(PASTA_JOBS, { recursive: true });
  const ids = await fs.readdir(PASTA_JOBS);
  for (const id of ids) {
    const job = await obter(id);
    if (!job) continue;
    if (job.status === 'recebendo') {
      // upload interrompido no meio - nao tem como continuar
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

export const NOME_ARQUIVOS = { video: 'final.mp4', capa: 'capa.jpg', base: 'base.mp4' };
