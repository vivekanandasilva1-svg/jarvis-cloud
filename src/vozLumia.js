// VOZ PADRAO DA LUMIA (definida pelo dono em 2026-11-27): voz neural feminina brasileira
// "pt-BR-ThalitaMultilingualNeural" - a mesma dos videos oficiais da Lumia, com a mesma configuracao
// (prosodia padrao: SEM alterar velocidade, tom nem volume). Vale pro app web (/api/tts) e pras
// respostas em audio do WhatsApp (auto-atendimento): fica fixa, nao varia por navegador/dispositivo.
//
// Motores, em ordem (o primeiro que funcionar fala; quem chama ainda cai pra texto se todos falharem):
//   1. Azure Speech (API OFICIAL, mesma voz) - so se AZURE_SPEECH_KEY + AZURE_SPEECH_REGION existirem
//   2. Edge via Python (pacote edge-tts, servico gratuito NAO-OFICIAL da Microsoft) - o container tem um
//      venv em /opt/edge e este modulo o MANTEM ATUALIZADO e testado (ver manutencaoDaVoz abaixo)
//   3. Kokoro (VPS) / Gemini - voz de reserva de antes
// A Microsoft ja mudou a trava de acesso do servico do Edge uma vez; por isso a atualizacao automatica
// do pacote, o teste de saude e o aviso ao dono quando a voz fica fora do ar.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { alinharTextoComAudio } from './audioAlign.js';
import { pool } from './db.js';
import * as whatsappInstances from './whatsappInstances.js';
import { enviarMensagemTexto } from './evolutionApi.js';

export const VOZ_LUMIA = 'pt-BR-ThalitaMultilingualNeural';

// ---------------------------------------------------------------- estado (pra tela de saude)
const estado = { motor: 'nenhum', ultimoOk: null, ultimoErro: null, foraDesde: null, versaoEdge: null, atualizadoEm: null };
let pausaEdgeAte = 0; // depois de uma falha, nao fica tentando o Edge a cada pedido (cada tentativa pode levar segundos)
let ultimoAvisoDono = 0;
export const estadoDaVoz = () => ({ ...estado, azureConfigurado: vozAzureConfigurada(), edgeDisponivel: edgeDisponivel() });

// ---------------------------------------------------------------- Azure (oficial)
export function vozAzureConfigurada() {
  return !!(process.env.AZURE_SPEECH_KEY && (process.env.AZURE_SPEECH_REGION || process.env.AZURE_SPEECH_ENDPOINT));
}
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function sintetizarAzure(texto) {
  const url = process.env.AZURE_SPEECH_ENDPOINT || `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice name='${VOZ_LUMIA}'>${escXml(texto)}</voice></speak>`;
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'LumiaVoz',
      },
      body: ssml,
    });
    if (!res.ok) throw new Error(`Azure Speech erro ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const wav = Buffer.from(await res.arrayBuffer());
    if (wav.length < 2000) throw new Error('audio vazio');
    return { audioBase64: wav.toString('base64'), alignment: alinharTextoComAudio(texto, wav.subarray(44), wav.readUInt32LE(24)) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- Edge via Python
const PY = process.env.EDGE_PYTHON || (process.platform === 'win32' ? 'python' : '/opt/edge/bin/python');
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'voz_edge.py');
const EDGE_ATIVO = process.env.EDGE_TTS !== '0';
const edgeDisponivel = () => EDGE_ATIVO;

// no maximo 3 sinteses ao mesmo tempo (cada uma e um processo Python)
let emAndamento = 0;
const fila = [];
const pegarVaga = () => new Promise((ok) => { if (emAndamento < 3) { emAndamento++; ok(); } else fila.push(ok); });
const soltarVaga = () => { const prox = fila.shift(); if (prox) prox(); else emAndamento--; };

function rodar(cmd, args, { entrada, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const out = [];
    const err = [];
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('tempo esgotado')); }, timeoutMs);
    proc.stdout.on('data', (c) => out.push(c));
    proc.stderr.on('data', (c) => err.push(c));
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (codigo) => {
      clearTimeout(timer);
      if (codigo === 0) resolve(Buffer.concat(out).toString('utf8'));
      else reject(new Error(`codigo ${codigo}: ${Buffer.concat(err).toString('utf8').trim().split('\n').slice(-2).join(' | ').slice(0, 300)}`));
    });
    if (entrada !== undefined) proc.stdin.end(entrada, 'utf8'); else proc.stdin.end();
  });
}

// alinhamento por caractere (mesmo formato dos outros motores) a partir das marcas de palavra do
// proprio servico (tempos em 100ns); caracteres fora de palavra herdam o instante da proxima
function alinharComMarcas(texto, marcas, duracaoTotalSeg) {
  const chars = texto.split('');
  const inicios = new Array(chars.length).fill(null);
  let cursor = 0;
  for (const m of [...marcas].sort((a, b) => a.offset - b.offset)) {
    const t = (m.text || '').trim();
    if (!t) continue;
    const pos = texto.indexOf(t, cursor);
    if (pos < 0) continue;
    const ini = m.offset / 1e7;
    const fim = (m.offset + (m.duration || 0)) / 1e7;
    for (let i = 0; i < t.length; i++) inicios[pos + i] = ini + ((fim - ini) * i) / Math.max(1, t.length);
    cursor = pos + t.length;
  }
  let proximo = duracaoTotalSeg;
  for (let i = chars.length - 1; i >= 0; i--) if (inicios[i] === null) inicios[i] = proximo; else proximo = inicios[i];
  for (let i = 1; i < inicios.length; i++) if (inicios[i] < inicios[i - 1]) inicios[i] = inicios[i - 1];
  return { characters: chars, character_start_times_seconds: inicios };
}

async function sintetizarEdge(texto) {
  await pegarVaga();
  try {
    const saida = await rodar(PY, [SCRIPT], { entrada: texto, timeoutMs: 25000 });
    const dados = JSON.parse(saida);
    const mp3 = Buffer.from(dados.audio, 'base64');
    const fimMarcas = (dados.marks || []).reduce((mx, m) => Math.max(mx, (m.offset + (m.duration || 0)) / 1e7), 0);
    // MP3 24kHz/48kbps mono = ~6000 bytes por segundo
    return { audioBase64: dados.audio, alignment: alinharComMarcas(texto, dados.marks || [], fimMarcas || mp3.length / 6000) };
  } finally {
    soltarVaga();
  }
}

// ---------------------------------------------------------------- uso: ordem dos motores
// quem chama passa as vozes de reserva (kokoro/gemini) - assim este modulo nao depende deles
export async function synthesizeSpeechLumia(texto, { kokoro, gemini }) {
  if (vozAzureConfigurada()) {
    try {
      const r = await sintetizarAzure(texto);
      estado.motor = 'azure'; estado.ultimoOk = Date.now(); estado.foraDesde = null;
      return r;
    } catch (err) { estado.ultimoErro = `azure: ${err.message}`; console.error('[voz] Azure falhou:', err.message); }
  }
  if (EDGE_ATIVO && Date.now() >= pausaEdgeAte) {
    try {
      const r = await sintetizarEdge(texto);
      estado.motor = 'edge'; estado.ultimoOk = Date.now(); estado.foraDesde = null; pausaEdgeAte = 0;
      return r;
    } catch (err) {
      estado.ultimoErro = `edge: ${err.message}`;
      estado.foraDesde = estado.foraDesde || Date.now();
      pausaEdgeAte = Date.now() + 60 * 1000; // 1 min de folga; o teste de saude (abaixo) tenta consertar sozinho
      console.error('[voz] Edge falhou:', err.message);
    }
  }
  estado.motor = 'reserva';
  if (process.env.KOKORO_URL && kokoro) return kokoro(texto);
  return gemini(texto);
}

// ---------------------------------------------------------------- manutencao: atualizar + testar + avisar
async function atualizarPacoteEdge() {
  try {
    const saida = await rodar(PY, ['-m', 'pip', 'install', '--upgrade', '--disable-pip-version-check', 'edge-tts'], { timeoutMs: 180000 });
    const versao = (await rodar(PY, ['-m', 'pip', 'show', 'edge-tts'], { timeoutMs: 30000 }).catch(() => '')).match(/Version:\s*(\S+)/)?.[1] || null;
    if (versao && versao !== estado.versaoEdge) console.log(`[voz] edge-tts ${estado.versaoEdge ? `atualizado ${estado.versaoEdge} -> ` : 'em '}${versao}`);
    estado.versaoEdge = versao; estado.atualizadoEm = Date.now();
    return /Successfully installed/.test(saida);
  } catch (err) {
    console.error('[voz] nao consegui atualizar o edge-tts:', err.message);
    return false;
  }
}

async function avisarDono(texto) {
  if (!pool || Date.now() - ultimoAvisoDono < 12 * 60 * 60 * 1000) return;
  ultimoAvisoDono = Date.now();
  try {
    const { rows } = await pool.query('SELECT id FROM tenants WHERE super_admin = true AND ativo = true');
    for (const { id } of rows) {
      const { numeroAdmin } = await whatsappInstances.obterConfig(id);
      if (numeroAdmin) await enviarMensagemTexto(id, numeroAdmin, texto);
    }
  } catch (err) { console.error('[voz] erro avisando o dono:', err.message); }
}

const AUTO_ATUALIZAR = process.env.EDGE_AUTO_UPDATE === '1'; // so no container (venv proprio); nunca no Python do PC
export async function verificarSaudeDaVoz() {
  if (!EDGE_ATIVO) return;
  try {
    await sintetizarEdge('Teste da voz da Lumia.');
    pausaEdgeAte = 0;
  } catch (err) {
    estado.ultimoErro = `edge: ${err.message}`;
    estado.foraDesde = estado.foraDesde || Date.now();
    // tenta consertar sozinho: atualiza o pacote e testa de novo
    if (AUTO_ATUALIZAR) await atualizarPacoteEdge();
    try {
      await sintetizarEdge('Teste da voz da Lumia.');
      pausaEdgeAte = 0;
    } catch (err2) {
      estado.ultimoErro = `edge: ${err2.message}`;
      pausaEdgeAte = Date.now() + 5 * 60 * 1000;
      if (Date.now() - estado.foraDesde > 2 * 60 * 60 * 1000) {
        await avisarDono('⚠️ ATENÇÃO: a voz padrão da Lumia está fora do ar há mais de 2 horas (a Microsoft pode ter mudado o acesso). Os áudios estão saindo com a voz reserva ou em texto. Avise o suporte técnico para atualizar a voz.');
      }
      return;
    }
  }
  if (estado.foraDesde) console.log('[voz] voz da Lumia (Edge) voltou a funcionar.');
  estado.foraDesde = null; estado.ultimoOk = Date.now();
  if (estado.motor !== 'azure') estado.motor = 'edge';
}

// chamado uma vez no start do servidor
export function iniciarManutencaoDaVoz() {
  if (!EDGE_ATIVO) return;
  const t0 = setTimeout(async () => {
    if (AUTO_ATUALIZAR) await atualizarPacoteEdge();
    await verificarSaudeDaVoz();
  }, 15000);
  const t1 = setInterval(verificarSaudeDaVoz, 60 * 60 * 1000); // teste de saude a cada hora
  const t2 = setInterval(() => { if (AUTO_ATUALIZAR) atualizarPacoteEdge(); }, 24 * 60 * 60 * 1000); // atualiza todo dia
  for (const t of [t0, t1, t2]) t.unref?.();
}
