// cliente do Evolution API (WhatsApp via Baileys) - ja roda na mesma VPS pra outras automacoes
// (clinica/n8n). Suporta multiplas instancias (numeros) - qual delas esta "ativa" pra Lumia usar
// no dia a dia fica guardado em whatsappInstances.js, trocavel pela aba WhatsApp do app.
import { obterConfig } from './whatsappInstances.js';

const WEBHOOK_URL = 'https://lumia-marketing.com/api/whatsapp-evolution/webhook';

function baseUrl() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error('EVOLUTION_API_URL nao configurado');
  return url.replace(/\/$/, '');
}

function apiKey() {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error('EVOLUTION_API_KEY nao configurado');
  return key;
}

async function chamar(method, path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: apiKey() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.response?.message || `Evolution API erro ${res.status}`);
  return data;
}

// ---------- gestao de instancias (varios numeros possiveis) ----------

export async function listarInstancias() {
  const data = await chamar('GET', '/instance/fetchInstances');
  return (Array.isArray(data) ? data : []).map((i) => ({
    nome: i.name,
    numero: i.number || i.ownerJid?.split('@')[0] || null,
    status: i.connectionStatus,
  }));
}

export async function criarInstancia(nome) {
  return chamar('POST', '/instance/create', {
    instanceName: nome,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: { url: WEBHOOK_URL, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] },
  });
}

export async function obterQrCode(nome) {
  return chamar('GET', `/instance/connect/${nome}`);
}

export async function statusConexaoInstancia(nome) {
  return chamar('GET', `/instance/connectionState/${nome}`);
}

// desconecta a sessao do WhatsApp sem apagar a instancia - deixa ela pronta pra gerar um QR
// novo (reconectar o mesmo numero, ou usar um numero diferente no mesmo "slot")
export async function desconectarInstancia(nome) {
  return chamar('DELETE', `/instance/logout/${nome}`);
}

// numero no formato so-digitos com DDI (ex: 5582991184771) - a propria API aceita nesse
// formato e resolve pro jid do WhatsApp internamente
export async function enviarMensagemTextoPor(instancia, numero, texto) {
  return chamar('POST', `/message/sendText/${instancia}`, {
    number: numero,
    text: texto,
  });
}

// mediatype: 'image' | 'video' | 'document'. media: base64 puro (sem "data:...;base64,")
export async function enviarMidia(instancia, numero, { mediatype, mimetype, media, fileName, caption }) {
  return chamar('POST', `/message/sendMedia/${instancia}`, {
    number: numero,
    mediatype,
    mimetype,
    media,
    fileName,
    caption,
  });
}

// audio como nota de voz (PTT) - o proprio Evolution API converte o formato recebido (ex: WAV
// do Kokoro) pro ogg/opus que o WhatsApp espera, via ffmpeg internamente
export async function enviarAudio(instancia, numero, mediaBase64) {
  return chamar('POST', `/message/sendWhatsAppAudio/${instancia}`, {
    number: numero,
    audio: mediaBase64,
  });
}

// baixa o conteudo (base64) de uma midia recebida numa mensagem - usado pra "ver"/"ouvir" o
// que um contato mandou (imagem, audio, video)
export async function baixarMidiaMensagem(instancia, mensagemBruta) {
  return chamar('POST', `/chat/getBase64FromMediaMessage/${instancia}`, {
    message: { key: mensagemBruta.key, message: mensagemBruta.message },
  });
}

// mostra "digitando..." ou "gravando audio..." pro contato enquanto a resposta e preparada -
// puramente cosmetico (nunca deve derrubar o fluxo se falhar, so um "melhor esforco")
export async function enviarPresenca(instancia, numero, presence, delayMs = 1500) {
  return chamar('POST', `/chat/sendPresence/${instancia}`, {
    number: numero,
    delay: delayMs,
    presence, // 'composing' | 'recording' | 'paused' | 'available'
  });
}

// ---------- operacoes na instancia ATIVA (a que a Lumia usa no dia a dia) ----------

export async function enviarMensagemTexto(numero, texto) {
  const { instanciaAtiva } = await obterConfig();
  return enviarMensagemTextoPor(instanciaAtiva, numero, texto);
}
