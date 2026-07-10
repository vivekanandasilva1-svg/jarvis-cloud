const API_VERSION = 'v20.0';
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

function phoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

function accessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN;
}

async function graphRequest(method, path, { body } = {}) {
  const url = new URL(GRAPH_URL + path);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message || `Erro ${res.status} ao chamar ${path}`;
    throw new Error(message);
  }
  return data;
}

// Manda uma mensagem de texto simples pro numero indicado (formato so digitos, com DDI,
// sem "+" - e o mesmo formato que a Meta manda no campo "from" das mensagens recebidas).
export async function sendTextMessage(to, text) {
  return graphRequest('POST', `/${phoneNumberId()}/messages`, {
    body: {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
  });
}

// Baixa um arquivo de midia (imagem/audio) que o usuario mandou no WhatsApp. A API da Meta
// exige dois passos: primeiro pega a URL temporaria do arquivo a partir do id, depois baixa
// o conteudo de verdade - os dois passos usam o mesmo token de acesso no header.
export async function downloadMedia(mediaId) {
  const meta = await graphRequest('GET', `/${mediaId}`);
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken()}` } });
  if (!res.ok) throw new Error(`Erro ${res.status} ao baixar midia do WhatsApp`);
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}
