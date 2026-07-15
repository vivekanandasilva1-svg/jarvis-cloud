// cliente do Evolution API (WhatsApp via Baileys) - ja roda na mesma VPS pra outras automacoes
// (clinica/n8n), aqui usamos uma instancia PROPRIA e dedicada, so da Lumia, sem mexer nas
// instancias existentes.
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

function nomeInstancia() {
  return process.env.EVOLUTION_INSTANCE || 'Lumia';
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

export async function criarInstancia(webhookUrl) {
  return chamar('POST', '/instance/create', {
    instanceName: nomeInstancia(),
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    webhook: { url: webhookUrl, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] },
  });
}

export async function obterQrCode() {
  return chamar('GET', `/instance/connect/${nomeInstancia()}`);
}

export async function statusConexao() {
  return chamar('GET', `/instance/connectionState/${nomeInstancia()}`);
}

export async function configurarWebhook(webhookUrl) {
  return chamar('POST', `/webhook/set/${nomeInstancia()}`, {
    webhook: { url: webhookUrl, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] },
  });
}

// numero no formato so-digitos com DDI (ex: 5582991184771) - a propria API aceita nesse
// formato e resolve pro jid do WhatsApp internamente
export async function enviarMensagemTexto(numero, texto) {
  return chamar('POST', `/message/sendText/${nomeInstancia()}`, {
    number: numero,
    text: texto,
  });
}
