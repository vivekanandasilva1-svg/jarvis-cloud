// Importar conversas recentes de um WhatsApp recem-conectado para o CRM.
//
// De onde vem: o WhatsApp manda um pedaco do historico (ate ~90 dias) quando o numero e pareado e a
// Evolution API guarda isso (POST /chat/findChats e /chat/findMessages). Aqui so LEMOS esse historico e
// gravamos no CRM - nada e enviado pra ninguem.
//
// Cuidados (de proposito):
//  - grava direto no banco, sem passar por crm.registrarMensagem: nao dispara eventos, nao mexe de etapa,
//    nao acorda Follow Up nem IA por ter "chegado" mensagem;
//  - contatos novos entram com origem 'importado' (nao entram nas contas de "leads novos / origem dos
//    leads"), com a data real da 1a mensagem e ja marcados como lidos;
//  - por padrao entram com a IA/envios automaticos PAUSADOS (auto_pausado): o Follow Up Inteligente varre os
//    contatos por etapa e poderia mandar mensagem pra quem so foi importado;
//  - contato que ja existe (mesmo numero ou a variante com/sem 9) so ganha as mensagens que faltam;
//  - grupos, canais, status e listas de transmissao ficam de fora; midia entra como indicacao ("[imagem]").
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import * as tenants from './tenants.js';

const FUSO = 'America/Maceio';
const MSGS_POR_CONVERSA = 50;
const CONCORRENCIA = 3;
const PERIODOS = new Set(['mes', '7', '30', '90']);

const jobs = new Map(); // tenantId -> job (so o ultimo de cada cliente)

export function inicioDoPeriodo(periodo) {
  if (periodo === 'mes') {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
    return new Date(`${hoje.slice(0, 7)}-01T00:00:00-03:00`);
  }
  return new Date(Date.now() - Number(periodo) * 86400000);
}

const ehIndividual = (jid) => !!jid && !/@(g\.us|newsletter|broadcast)$/.test(jid);

function momentoDoChat(chat) {
  const a = Date.parse(chat.updatedAt || '') || 0;
  const b = Number(chat.lastMessage?.messageTimestamp || 0) * 1000;
  return Math.max(a, b);
}

// numero real (so digitos com DDI): o jid novo "@lid" esconde o numero em remoteJidAlt
function numeroDoJid(jid) {
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return null;
  const n = jid.split('@')[0].replace(/\D/g, '');
  return n.length >= 10 && n.length <= 15 ? n : null;
}

// extrai {texto} de uma mensagem do WhatsApp (ou null se nao for conversa: reacao, apagar, protocolo...)
function textoDaMensagem(m) {
  if (!m) return null;
  if (m.ephemeralMessage?.message) return textoDaMensagem(m.ephemeralMessage.message);
  if (m.viewOnceMessage?.message) return textoDaMensagem(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2?.message) return textoDaMensagem(m.viewOnceMessageV2.message);
  if (m.documentWithCaptionMessage?.message) return textoDaMensagem(m.documentWithCaptionMessage.message);
  if (typeof m.conversation === 'string' && m.conversation.trim()) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  const com = (rotulo, legenda) => (legenda ? `[${rotulo}] ${legenda}` : `[${rotulo}]`);
  if (m.imageMessage) return com('imagem', m.imageMessage.caption);
  if (m.videoMessage) return com('vídeo', m.videoMessage.caption);
  if (m.audioMessage) return '[áudio]';
  if (m.documentMessage) return com('documento', m.documentMessage.caption || m.documentMessage.fileName);
  if (m.stickerMessage) return '[figurinha]';
  if (m.locationMessage) return '[localização]';
  if (m.contactMessage || m.contactsArrayMessage) return '[contato]';
  return null;
}

async function listarChatsIndividuais(instancia) {
  const chats = await evolutionApi.listarChats(instancia);
  return (Array.isArray(chats) ? chats : []).filter((c) => ehIndividual(c.remoteJid));
}

async function exigirInstanciaDoCliente(tenantId, instancia) {
  const dono = await tenants.resolverTenantPorInstancia(instancia);
  if (dono !== tenantId) throw new Error('Essa instancia nao pertence a essa conta.');
}

// quantas conversas existem no periodo (pra mostrar antes de importar)
export async function previa(tenantId, instancia, periodo) {
  if (!PERIODOS.has(String(periodo))) throw new Error('Periodo invalido.');
  await exigirInstanciaDoCliente(tenantId, instancia);
  const chats = await listarChatsIndividuais(instancia);
  const desde = inicioDoPeriodo(String(periodo)).getTime();
  const noPeriodo = chats.filter((c) => momentoDoChat(c) >= desde);
  return {
    totalNoWhatsapp: chats.length,
    noPeriodo: noPeriodo.length,
    desde: new Date(desde).toISOString(),
    etapas: crm.ETAPAS.filter((e) => e.id !== 'follow_up').map((e) => ({ id: e.id, nome: e.nome })),
  };
}

function publico(job) {
  if (!job) return { estado: 'nenhuma' };
  const { cancelar, promessa, ...resto } = job;
  return { ...resto, cancelando: !!cancelar && job.estado === 'rodando' };
}
export const status = (tenantId) => publico(jobs.get(tenantId));
export function cancelar(tenantId) {
  const j = jobs.get(tenantId);
  if (j && j.estado === 'rodando') j.cancelar = true;
  return publico(j);
}
export const aguardar = (tenantId) => jobs.get(tenantId)?.promessa;

async function importarConversa(tenantId, instancia, chat, opcoes, job) {
  const registros = (await evolutionApi.mensagensDoChat(instancia, chat.remoteJid, MSGS_POR_CONVERSA))
    .filter((r) => r?.key?.id && r.messageTimestamp);

  let numero = numeroDoJid(chat.remoteJid);
  if (!numero) for (const r of registros) { numero = numeroDoJid(r.key?.remoteJidAlt); if (numero) break; }
  // o WhatsApp novo esconde o telefone de muita gente ("@lid"): o app, ao vivo, identifica essa pessoa pelo
  // codigo do WhatsApp (server.js, extrairMensagemEvolution) - o importador faz igual, assim a pessoa nao vira
  // um contato duplicado quando escrever de novo
  let semTelefone = false;
  if (!numero && chat.remoteJid.endsWith('@lid')) { numero = chat.remoteJid.split('@')[0].replace(/\D/g, ''); semTelefone = !!numero; }
  if (!numero) { job.semNumero++; return; }

  const msgs = [];
  for (const r of registros) {
    const texto = textoDaMensagem(r.message);
    if (!texto) continue;
    const ts = new Date(Number(r.messageTimestamp) * 1000);
    if (Number.isNaN(ts.getTime()) || ts.getTime() > Date.now() + 300000) continue;
    msgs.push({ waId: r.key.id, direcao: r.key.fromMe ? 'saida' : 'entrada', texto: texto.slice(0, 4000), ts, pushName: r.key.fromMe ? null : r.pushName });
  }
  if (!msgs.length) { job.semMensagens++; return; }
  msgs.sort((a, b) => a.ts - b.ts);
  const primeira = msgs[0];
  const ultima = msgs[msgs.length - 1];
  const ultimaEntrada = [...msgs].reverse().find((m) => m.direcao === 'entrada') || null;
  const nomeValido = (n) => (n && !/^\d+$/.test(String(n).trim()) && String(n).trim() !== 'Você' ? String(n).trim() : null);
  const nome = [...msgs].reverse().map((m) => nomeValido(m.pushName)).find(Boolean) || nomeValido(chat.pushName) || null;

  // o contato ja existe? (mesmo numero ou a variante com/sem o 9 - mesma regra do registrarMensagem)
  const variante = crm.varianteNonoDigito(numero);
  const candidatos = variante ? [numero, variante] : [numero];
  const { rows: ex } = await pool.query(
    'SELECT id, numero FROM crm_contatos WHERE tenant_id = $1 AND instancia = $2 AND numero = ANY($3::text[]) ORDER BY (numero = $4) DESC LIMIT 1',
    [tenantId, instancia, candidatos, numero],
  );
  let contatoId = ex[0]?.id || null;
  let numeroContato = ex[0]?.numero || numero;
  let novo = false;
  if (!contatoId) {
    const { rows } = await pool.query(
      `INSERT INTO crm_contatos (tenant_id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, ultima_entrada_em, origem, auto_pausado, lido_em, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'importado', $9, now(), $10)
       ON CONFLICT (tenant_id, numero, instancia) DO NOTHING RETURNING id`,
      [tenantId, numero, instancia, nome, opcoes.etapa, ultima.texto.slice(0, 200), ultima.ts, ultimaEntrada?.ts || null, !!opcoes.pausarIA, primeira.ts],
    );
    if (rows[0]) { contatoId = rows[0].id; novo = true; }
    else {
      const { rows: de } = await pool.query('SELECT id, numero FROM crm_contatos WHERE tenant_id = $1 AND instancia = $2 AND numero = $3', [tenantId, instancia, numero]);
      contatoId = de[0]?.id || null; numeroContato = de[0]?.numero || numero;
    }
  }
  if (!contatoId) { job.erros++; return; }

  // mensagens (as que ja existem sao ignoradas pelo indice unico de wa_id)
  const valores = [];
  const params = [tenantId, numeroContato, instancia];
  msgs.forEach((m, i) => {
    const b = 3 + i * 4;
    valores.push(`($1, $2, $3, $${b + 1}, 'text', $${b + 2}, $${b + 3}, $${b + 4})`);
    params.push(m.direcao, m.texto, m.ts, m.waId);
  });
  const { rowCount } = await pool.query(
    `INSERT INTO crm_mensagens (tenant_id, numero, instancia, direcao, tipo, texto, criado_em, wa_id) VALUES ${valores.join(', ')}
     ON CONFLICT (tenant_id, instancia, wa_id) WHERE wa_id IS NOT NULL DO NOTHING`,
    params,
  );
  job.mensagens += rowCount || 0;
  if (semTelefone) job.semTelefone++;
  if (novo) job.contatosNovos++; else {
    job.contatosExistentes++;
    // contato que ja existia: so atualiza a "ultima mensagem" se a importada for mais recente
    await pool.query(
      `UPDATE crm_contatos SET
         ultima_mensagem = CASE WHEN ultima_mensagem_em IS NULL OR $2::timestamptz > ultima_mensagem_em THEN $3 ELSE ultima_mensagem END,
         ultima_mensagem_em = GREATEST(COALESCE(ultima_mensagem_em, $2::timestamptz), $2::timestamptz)
       WHERE id = $1 AND tenant_id = $4`,
      [contatoId, ultima.ts, ultima.texto.slice(0, 200), tenantId],
    );
  }
}

async function executar(tenantId, instancia, chats, opcoes, job) {
  let proximo = 0;
  const trabalhador = async () => {
    while (!job.cancelar) {
      const i = proximo++;
      if (i >= chats.length) return;
      try { await importarConversa(tenantId, instancia, chats[i], opcoes, job); } catch (err) {
        job.erros++;
        if (!job.ultimoErro) job.ultimoErro = String(err.message).slice(0, 200);
      }
      job.processados++;
    }
  };
  await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));
  job.estado = job.cancelar ? 'cancelado' : 'concluido';
  job.terminouEm = new Date().toISOString();
}

export async function iniciar(tenantId, { instancia, periodo, etapa, pausarIA = true, limiteChats = null }) {
  if (!PERIODOS.has(String(periodo))) throw new Error('Periodo invalido.');
  if (!crm.ETAPAS.some((e) => e.id === etapa) || etapa === 'follow_up') throw new Error('Escolha uma etapa valida do funil (o Follow Up nao pode ser usado na importacao).');
  if (jobs.get(tenantId)?.estado === 'rodando') throw new Error('Ja existe uma importacao em andamento.');
  await exigirInstanciaDoCliente(tenantId, instancia);
  const estadoConexao = await evolutionApi.statusConexaoInstancia(instancia).catch(() => null);
  if (estadoConexao?.instance?.state !== 'open') throw new Error('Esse numero nao esta conectado agora.');

  const desde = inicioDoPeriodo(String(periodo)).getTime();
  let chats = (await listarChatsIndividuais(instancia)).filter((c) => momentoDoChat(c) >= desde);
  chats.sort((a, b) => momentoDoChat(b) - momentoDoChat(a)); // as mais recentes primeiro
  if (limiteChats) chats = chats.slice(0, limiteChats);

  const job = {
    estado: 'rodando', instancia, periodo: String(periodo), etapa, pausarIA: !!pausarIA,
    totalConversas: chats.length, processados: 0, contatosNovos: 0, contatosExistentes: 0, mensagens: 0,
    semTelefone: 0, semNumero: 0, semMensagens: 0, erros: 0, ultimoErro: null, iniciadoEm: new Date().toISOString(), terminouEm: null, cancelar: false,
  };
  jobs.set(tenantId, job);
  job.promessa = executar(tenantId, instancia, chats, { etapa, pausarIA }, job).catch((err) => {
    job.estado = 'erro'; job.ultimoErro = String(err.message).slice(0, 200); job.terminouEm = new Date().toISOString();
  });
  return publico(job);
}
