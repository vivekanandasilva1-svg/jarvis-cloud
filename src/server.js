import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './cloudAgent.js';
import { synthesizeSpeechWithTimestamps, transcribeAudio } from './gemini.js';
import { transcribeAudioWhisper } from './whisper.js';
import { sendTextMessage, downloadMedia } from './whatsapp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
// limite maior que o padrao (100kb) pra caber fotos e audios em base64 anexados no chat;
// "verify" guarda o corpo cru da requisicao, necessario pra conferir a assinatura do
// webhook do WhatsApp (a Meta assina o payload exato, nao o objeto ja parseado)
app.use(express.json({
  limit: '20mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

const APP_PASSWORD = process.env.APP_PASSWORD;

// protege tudo (estaticos + api) com uma senha simples via header - o link fica publico na
// internet e essa versao consegue mexer em orcamento real de anuncio, entao nao pode ficar
// aberta para qualquer um que ache a URL. O webhook do WhatsApp fica de fora dessa checagem
// porque quem chama e a propria Meta (nao da pra mandar nossa senha) - ele se protege sozinho
// checando a assinatura da requisicao e o numero de quem manda a mensagem.
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next(); // sem senha configurada, roda aberto (nao recomendado)
  if (req.path === '/api/login' || req.path === '/webhook/whatsapp') return next();

  const provided = req.header('x-app-password');
  if (provided === APP_PASSWORD) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ erro: 'senha invalida' });
  }
  next();
});

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!APP_PASSWORD) return res.json({ ok: true });
  res.json({ ok: password === APP_PASSWORD });
});

app.use(express.static(PUBLIC_DIR));

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, attachments } = req.body || {};
  const temAnexo = Array.isArray(attachments) && attachments.length > 0;
  if ((!message && !temAnexo) || !sessionId) {
    return res.status(400).json({ erro: 'message (ou attachments) e sessionId sao obrigatorios' });
  }

  try {
    const reply = await chat(sessionId, message, attachments);
    res.json({ reply });
  } catch (err) {
    console.error('Erro no chat:', err);
    res.status(500).json({ erro: err.message });
  }
});

// devolve o audio (base64) + o alinhamento de tempo de cada caractere, pra sincronizar a
// legenda na tela com a fala de verdade
app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ erro: 'text obrigatorio' });

  try {
    const { audioBase64, alignment } = await synthesizeSpeechWithTimestamps(text);
    res.json({ audio: audioBase64, alignment });
  } catch (err) {
    console.error('Erro no TTS:', err);
    res.status(500).json({ erro: err.message });
  }
});

// transcreve um audio gravado no navegador (fala -> texto) - usado pelo microfone do app web.
// Existe separado do /api/chat porque queremos mostrar pro usuario o texto que ele "falou"
// antes de mandar pra Lumia (mesma UX de digitar), em vez de mandar o audio direto sem o
// usuario ver o que foi entendido.
app.post('/api/transcribe', async (req, res) => {
  const { audioBase64, mediaType } = req.body || {};
  if (!audioBase64) return res.status(400).json({ erro: 'audioBase64 obrigatorio' });

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    // WHISPER_URL so existe nos ambientes com o Whisper auto-hospedado rodando ao lado (a
    // VPS) - sem custo por uso e sem cota. Onde nao tem essa infra (ex: Render), cai pro
    // Gemini como estava antes.
    const texto = process.env.WHISPER_URL
      ? await transcribeAudioWhisper(buffer, mediaType || 'audio/webm')
      : await transcribeAudio(buffer, mediaType || 'audio/webm');
    res.json({ text: texto });
  } catch (err) {
    console.error('Erro na transcricao:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ---------- WhatsApp (Meta Cloud API) ----------

// handshake de verificacao que a Meta faz uma vez, quando voce configura o webhook no
// painel do app - so confirma que voce e dono do endpoint, devolvendo o "challenge" de volta
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// confere que a requisicao realmente veio da Meta (assinatura HMAC do corpo cru com o
// App Secret) - esse endpoint nao tem a senha do app, entao essa e a unica defesa contra
// alguem forjar uma mensagem falsa pra fazer a Lumia executar acoes.
function assinaturaWhatsappValida(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sem app secret configurado, pula a checagem (nao recomendado)
  if (!req.rawBody) return false;

  const assinatura = req.header('x-hub-signature-256') || '';
  const esperado = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// so numeros na lista permitida podem conversar com a Lumia por aqui - ela age de verdade
// (cancela agendamento, consulta financeiro, etc), entao nao pode responder qualquer numero
// que mandar mensagem pro numero de WhatsApp do consultorio.
function numeroWhatsappPermitido(numero) {
  const lista = (process.env.WHATSAPP_ALLOWED_NUMBERS || '')
    .split(',').map((n) => n.trim()).filter(Boolean);
  if (lista.length === 0) return false; // sem lista configurada, nao permite ninguem
  return lista.includes(numero);
}

async function processarMensagemWhatsapp(msg) {
  const from = msg.from;
  if (!numeroWhatsappPermitido(from)) return; // ignora silenciosamente numeros nao autorizados

  const sessionId = `whatsapp:${from}`;
  let texto = '';
  const attachments = [];

  if (msg.type === 'text') {
    texto = msg.text?.body || '';
  } else if (msg.type === 'image' || msg.type === 'audio') {
    try {
      const { buffer, mimeType } = await downloadMedia(msg[msg.type].id);
      attachments.push({ kind: msg.type, mediaType: mimeType, base64: buffer.toString('base64') });
      texto = msg[msg.type]?.caption || '';
    } catch (err) {
      await sendTextMessage(from, `Nao consegui baixar o arquivo que voce mandou: ${err.message}`);
      return;
    }
  } else {
    await sendTextMessage(from, 'Por aqui eu ainda so consigo analisar texto, imagem e audio - esse tipo de arquivo eu nao processo.');
    return;
  }

  if (!texto && attachments.length === 0) return;

  try {
    const resposta = await chat(sessionId, texto, attachments);
    await sendTextMessage(from, resposta);
  } catch (err) {
    console.error('Erro no chat via WhatsApp:', err);
    await sendTextMessage(from, `Deu erro por aqui: ${err.message}`).catch(() => {});
  }
}

// a Meta espera um 200 rapido (senao ela reenvia a mesma mensagem varias vezes) - por isso
// respondemos na hora e processamos a mensagem de verdade depois, em segundo plano
app.post('/webhook/whatsapp', (req, res) => {
  if (!assinaturaWhatsappValida(req)) return res.sendStatus(401);
  res.sendStatus(200);

  const mensagens = req.body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
  for (const msg of mensagens) {
    processarMensagemWhatsapp(msg).catch((err) => console.error('Erro ao processar mensagem do WhatsApp:', err));
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jarvis Cloud rodando na porta ${PORT}`);
});
