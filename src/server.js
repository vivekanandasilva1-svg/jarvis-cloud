import 'dotenv/config';
import crypto from 'node:crypto';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, continuarAcaoLocal, limparConversa, iniciarSchedulerLembretes } from './cloudAgent.js';
import { synthesizeSpeechWithTimestamps, transcribeAudio } from './gemini.js';
import { synthesizeSpeechKokoro } from './kokoro.js';
import { transcribeAudioWhisper } from './whisper.js';
import { sendTextMessage, downloadMedia } from './whatsapp.js';
import { obterArquivo } from './arquivosGerados.js';
import * as evolutionApi from './evolutionApi.js';
import { enviarMensagemTexto } from './evolutionApi.js';
import * as agenda from './agenda.js';
import * as googleCalendar from './googleCalendar.js';
import * as whatsappInstances from './whatsappInstances.js';
import * as autoAtendimento from './autoAtendimento.js';
import * as autoArquivos from './autoAtendimentoArquivos.js';

const execAsync = promisify(exec);

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
// so um usuario "de verdade" (nao e um sistema de contas) - existe pra a tela de login pedir
// usuario+senha em vez de so senha, sem precisar montar autenticacao multiusuario de verdade
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';

// protege tudo (estaticos + api) com uma senha simples via header - o link fica publico na
// internet e essa versao consegue mexer em orcamento real de anuncio, entao nao pode ficar
// aberta para qualquer um que ache a URL. O webhook do WhatsApp fica de fora dessa checagem
// porque quem chama e a propria Meta (nao da pra mandar nossa senha) - ele se protege sozinho
// checando a assinatura da requisicao e o numero de quem manda a mensagem.
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next(); // sem senha configurada, roda aberto (nao recomendado)
  // as duas rotas do Google ficam de fora porque sao navegacao de pagina de verdade (o
  // navegador vai pro consentimento do Google e volta), nao um fetch que consiga mandar o
  // header de senha - a seguranca aqui vem do proprio fluxo OAuth (o "code" so e valido uma
  // vez, pro nosso client_id/redirect_uri exatos)
  if (
    req.path === '/api/login' ||
    req.path === '/webhook/whatsapp' ||
    req.path === '/api/whatsapp-evolution/webhook' ||
    req.path === '/api/agenda/google/conectar' ||
    req.path === '/api/agenda/google/callback'
  ) return next();

  const provided = req.header('x-app-password');
  if (provided === APP_PASSWORD) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ erro: 'senha invalida' });
  }
  next();
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!APP_PASSWORD) return res.json({ ok: true });
  res.json({ ok: username === ADMIN_USERNAME && password === APP_PASSWORD });
});

app.use(express.static(PUBLIC_DIR));

// ---------- Stats do sistema (painel do dashboard) ----------

const sessoesVistas = new Set();
let comandosProcessados = 0;

// mede uso de CPU comparando os contadores acumulados de os.cpus() em dois instantes - a
// API do Node nao da uma "porcentagem atual" pronta, so o total acumulado desde o boot
function medirUsoCpu() {
  const amostra = () => os.cpus().map((c) => ({ ocioso: c.times.idle, total: Object.values(c.times).reduce((s, v) => s + v, 0) }));
  const inicio = amostra();
  return new Promise((resolve) => {
    setTimeout(() => {
      const fim = amostra();
      let ociosoDelta = 0, totalDelta = 0;
      for (let i = 0; i < inicio.length; i++) {
        ociosoDelta += fim[i].ocioso - inicio[i].ocioso;
        totalDelta += fim[i].total - inicio[i].total;
      }
      resolve(totalDelta > 0 ? Math.round((1 - ociosoDelta / totalDelta) * 100) : 0);
    }, 200);
  });
}

// `df` so existe em Linux/Mac - em dev local no Windows (sem essa infra) devolve null em vez
// de quebrar o painel inteiro
async function medirDisco() {
  try {
    const { stdout } = await execAsync('df -Pk /');
    const linha = stdout.trim().split('\n')[1];
    const [, totalKb, usadoKb] = linha.split(/\s+/);
    return {
      usadoGB: Math.round((Number(usadoKb) / 1024 / 1024) * 10) / 10,
      totalGB: Math.round((Number(totalKb) / 1024 / 1024) * 10) / 10,
      percentual: Math.round((Number(usadoKb) / Number(totalKb)) * 100),
    };
  } catch {
    return null;
  }
}

app.get('/api/system-stats', async (req, res) => {
  try {
    const [cpuPercent, disco] = await Promise.all([medirUsoCpu(), medirDisco()]);
    const ramTotal = os.totalmem();
    const ramLivre = os.freemem();
    const ramUsada = ramTotal - ramLivre;

    res.json({
      cpuPercent,
      ram: {
        usadoGB: Math.round((ramUsada / 1024 ** 3) * 10) / 10,
        totalGB: Math.round((ramTotal / 1024 ** 3) * 10) / 10,
        percentual: Math.round((ramUsada / ramTotal) * 100),
      },
      disco,
      uptimeSegundos: Math.round(process.uptime()),
      comandosProcessados,
      sessoesAtivas: sessoesVistas.size,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, attachments } = req.body || {};
  const temAnexo = Array.isArray(attachments) && attachments.length > 0;
  if ((!message && !temAnexo) || !sessionId) {
    return res.status(400).json({ erro: 'message (ou attachments) e sessionId sao obrigatorios' });
  }

  try {
    sessoesVistas.add(sessionId);
    comandosProcessados++;
    // chat() devolve { reply } no caso normal, ou { reply: null, localAction } quando a
    // proxima coisa a fazer e uma acao no computador do usuario - o navegador que decide
    // rodar (via o agente local) e reporta o resultado em /api/local-action-result
    const resultado = await chat(sessionId, message, attachments);
    res.json(resultado);
  } catch (err) {
    console.error('Erro no chat:', err);
    res.status(500).json({ erro: err.message });
  }
});

// o navegador chama isso depois de executar uma acao no computador do usuario (via agente
// local) - devolve o resultado real pra Claude continuar a conversa de onde parou
app.post('/api/local-action-result', async (req, res) => {
  const { sessionId, resultado } = req.body || {};
  if (!sessionId || resultado === undefined) {
    return res.status(400).json({ erro: 'sessionId e resultado sao obrigatorios' });
  }
  try {
    const saida = await continuarAcaoLocal(sessionId, resultado);
    res.json(saida);
  } catch (err) {
    console.error('Erro ao continuar acao local:', err);
    res.status(500).json({ erro: err.message });
  }
});

// baixa um arquivo gerado pela Lumia (PDF/Word/Excel/grafico/imagem) - protegido pelo mesmo
// middleware de senha do resto da API (o frontend busca via fetch com o header e monta o
// download no navegador, nao e um link direto clicavel, porque um <a href> comum nao manda
// o header x-app-password)
app.get('/api/arquivos/:id', (req, res) => {
  const item = obterArquivo(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Arquivo nao encontrado ou expirado (fica disponivel por 30min apos ser gerado)' });
  res.setHeader('Content-Type', item.mediaType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.nomeArquivo)}"`);
  res.send(item.buffer);
});

// apaga o historico da conversa de verdade (Postgres, nao so visualmente) - chamado pelo
// botao "Limpar" do app
app.post('/api/session/clear', async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ erro: 'sessionId obrigatorio' });
  try {
    await limparConversa(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro limpando sessao:', err);
    res.status(500).json({ erro: err.message });
  }
});

// devolve o audio (base64) + o alinhamento de tempo de cada caractere, pra sincronizar a
// legenda na tela com a fala de verdade
app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ erro: 'text obrigatorio' });

  try {
    // KOKORO_URL so existe nos ambientes com o Kokoro TTS auto-hospedado rodando ao lado (a
    // VPS) - voz fixa, sem cota nem custo por uso. Onde nao tem essa infra (ex: Render), cai
    // pro Gemini como estava antes.
    const { audioBase64, alignment } = process.env.KOKORO_URL
      ? await synthesizeSpeechKokoro(text)
      : await synthesizeSpeechWithTimestamps(text);
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
    const resultado = await chat(sessionId, texto, attachments);
    // controle do computador so funciona pelo navegador no proprio PC (precisa do agente
    // local) - por WhatsApp nao ha como executar isso, entao avisa em vez de travar
    if (resultado.localAction) {
      await sendTextMessage(from, 'Isso af envolve mexer no seu computador, e isso so funciona pelo app no proprio PC (nao da pra fazer por aqui pelo WhatsApp).');
      return;
    }
    await sendTextMessage(from, resultado.reply);
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

// ---------- WhatsApp (Evolution API - instancia propria e dedicada da Lumia) ----------
// diferente do webhook da Meta acima, esse fala com uma instancia do Evolution API (WhatsApp
// Web/Baileys) que ja roda na mesma VPS - sem as restricoes de janela de 24h/template da API
// oficial da Meta, entao da pra mandar lembrete e mensagem proativa a qualquer hora.

// extrai o numero (so digitos), o texto e o tipo de midia (se tiver) de uma mensagem no formato
// do Baileys - texto simples/resposta, ou imagem/audio/video (com ou sem legenda)
function extrairMensagemEvolution(data) {
  const remoteJid = data?.key?.remoteJid || '';
  const numero = remoteJid.split('@')[0];
  const msg = data?.message || {};

  if (msg.imageMessage) return { numero, texto: msg.imageMessage.caption || '', tipo: 'image', fromMe: !!data?.key?.fromMe };
  if (msg.audioMessage) return { numero, texto: '', tipo: 'audio', fromMe: !!data?.key?.fromMe };
  if (msg.videoMessage) return { numero, texto: msg.videoMessage.caption || '', tipo: 'video', fromMe: !!data?.key?.fromMe };

  const texto = msg.conversation || msg.extendedTextMessage?.text || '';
  return { numero, texto, tipo: 'text', fromMe: !!data?.key?.fromMe };
}

async function processarMensagemEvolution(instanciaDoWebhook, data) {
  const { numero, texto, tipo, fromMe } = extrairMensagemEvolution(data);
  if (fromMe) return; // ignora eco das proprias mensagens da Lumia
  if (tipo === 'text' && !texto) return;

  const { instanciaAtiva, numeroAdmin } = await whatsappInstances.obterConfig();

  // mensagem do dono, na instancia pessoal ativa - conversa normal (todas as ferramentas,
  // memoria persistente, personalidade completa). Midia do dono continua so texto por
  // enquanto (esse caminho ja tinha essa limitacao antes do auto-atendimento existir).
  if (instanciaDoWebhook === instanciaAtiva && numeroAdmin && numero === numeroAdmin) {
    if (tipo !== 'text') return;
    try {
      const resultado = await chat(`whatsapp-evo:${numero}`, texto, []);
      if (resultado.localAction) {
        await enviarMensagemTexto(numero, 'Isso aí envolve mexer no seu computador, e isso só funciona pelo app no próprio PC (não dá pra fazer por aqui pelo WhatsApp).');
        return;
      }
      await enviarMensagemTexto(numero, resultado.reply);
    } catch (err) {
      console.error('Erro no chat via Evolution/WhatsApp:', err);
      await enviarMensagemTexto(numero, `Deu erro por aqui: ${err.message}`).catch(() => {});
    }
    return;
  }

  // qualquer outro contato (nao o dono) - so responde se o auto-atendimento estiver ativo
  // NESSA instancia especifica; usa um motor totalmente separado (prompt/historico/ferramentas
  // proprios), nunca a conversa pessoal da Lumia
  const configAuto = await autoAtendimento.obterConfig();
  if (!configAuto.ativo || configAuto.instancia !== instanciaDoWebhook) return;

  // "digitando..."/"gravando audio..." no WhatsApp expira sozinho depois de poucos segundos
  // (o app do contato esconde o indicador se nao renovar) - como pensar a resposta (chamar a
  // IA, rodar ferramenta de agenda/Clinicorp etc) pode levar bem mais que isso, reenvia o
  // sinal em loop ate o instante exato de mandar a mensagem de verdade, sem deixar "apagar" no
  // meio do caminho. Ja sabe de antemao se vai ser audio ou texto, pra mostrar o icone certo
  // desde o comeco (nao so "digitando" ate o fim e "gravando" so no ultimo segundo).
  const provavelAudio = await autoAtendimento.preverVaiSerAudio(numero, tipo).catch(() => false);
  const tipoPresenca = provavelAudio ? 'recording' : 'composing';
  const manterPresenca = setInterval(() => {
    evolutionApi.enviarPresenca(instanciaDoWebhook, numero, tipoPresenca).catch(() => {});
  }, 4000);
  evolutionApi.enviarPresenca(instanciaDoWebhook, numero, tipoPresenca).catch(() => {});

  try {
    const resultado = await autoAtendimento.processarMensagem(numero, instanciaDoWebhook, { texto, tipo, mensagemBruta: data });
    if (!resultado) return;

    clearInterval(manterPresenca); // para de renovar bem no instante de mandar a mensagem

    if (resultado.respondeComAudio) {
      try {
        await autoAtendimento.enviarRespostaEmAudio(instanciaDoWebhook, numero, resultado.texto);
        return;
      } catch (err) {
        console.error('Erro mandando resposta em audio, caindo pra texto:', err.message);
      }
    }
    await evolutionApi.enviarMensagemTextoPor(instanciaDoWebhook, numero, resultado.texto);
  } catch (err) {
    console.error('Erro no auto-atendimento via Evolution/WhatsApp:', err);
  } finally {
    clearInterval(manterPresenca);
  }
}

// o Evolution API tambem espera resposta rapida - responde 200 na hora e processa depois
app.post('/api/whatsapp-evolution/webhook', (req, res) => {
  res.sendStatus(200);
  const evento = req.body?.event;
  if (evento !== 'messages.upsert') return;
  const data = req.body?.data;
  if (!data) return;
  processarMensagemEvolution(req.body?.instance, data).catch((err) => console.error('Erro ao processar mensagem do Evolution:', err));
});

// ---------- Gestao de instancias do WhatsApp (trocar/reconectar numero pelo app) ----------

app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const config = await whatsappInstances.obterConfig();
    let conexao = null;
    try {
      conexao = await evolutionApi.statusConexaoInstancia(config.instanciaAtiva);
    } catch (err) {
      conexao = { instance: { state: 'erro', erro: err.message } };
    }
    res.json({ ...config, estado: conexao?.instance?.state || 'desconhecido' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/whatsapp/instancias', async (req, res) => {
  try {
    res.json({ instancias: await evolutionApi.listarInstancias() });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/instancias', async (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
  try {
    const resultado = await evolutionApi.criarInstancia(nome);
    res.json({ ok: true, qrcode: resultado?.qrcode?.base64 || null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/whatsapp/qrcode/:nome', async (req, res) => {
  try {
    // pedir QR numa instancia que ja esta conectada pode forcar o Evolution API a reiniciar o
    // socket dela - e foi exatamente isso (ou algo parecido) que causou uma desconexao real por
    // "conflict/device_removed" nessa mesma instancia. So gera QR de verdade quando precisa.
    const status = await evolutionApi.statusConexaoInstancia(req.params.nome).catch(() => null);
    if (status?.instance?.state === 'open') {
      return res.status(400).json({ erro: 'Essa instancia ja esta conectada - gerar um QR novo pode derrubar a conexao atual. So gera QR se ela estiver desconectada.' });
    }
    const resultado = await evolutionApi.obterQrCode(req.params.nome);
    res.json({ qrcode: resultado?.base64 || null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/desconectar', async (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
  try {
    await evolutionApi.desconectarInstancia(nome);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/ativar', async (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
  try {
    await whatsappInstances.definirInstanciaAtiva(nome);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/admin', async (req, res) => {
  const { numero } = req.body || {};
  if (!numero) return res.status(400).json({ erro: 'numero obrigatorio' });
  try {
    await whatsappInstances.definirNumeroAdmin(numero);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- Auto atendimento (persona/prompt isolado pra atender outros contatos) ----------

app.get('/api/auto-atendimento/config', async (req, res) => {
  try {
    res.json(await autoAtendimento.obterConfig());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/auto-atendimento/config', async (req, res) => {
  const { ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, agendarClinicorp, agendarAgendaInterna } = req.body || {};
  if (ativo && (!instancia || !prompt)) {
    return res.status(400).json({ erro: 'pra ativar, precisa escolher a instancia e escrever o prompt' });
  }
  try {
    await autoAtendimento.salvarConfig({ ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, agendarClinicorp, agendarAgendaInterna });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// arquivos de referencia que a Lumia pode mandar durante o auto-atendimento (PDF, imagem,
// video, audio) - sobem em base64 no corpo do JSON (o limite de 20mb do express.json ja cobre
// arquivos de tamanho razoavel pra esse uso)
app.get('/api/auto-atendimento/arquivos', async (req, res) => {
  try {
    res.json({ arquivos: await autoArquivos.listarArquivos() });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/auto-atendimento/arquivos', async (req, res) => {
  const { nomeArquivo, descricao, mediaType, base64 } = req.body || {};
  if (!nomeArquivo || !descricao || !mediaType || !base64) {
    return res.status(400).json({ erro: 'nomeArquivo, descricao, mediaType e base64 sao obrigatorios' });
  }
  try {
    const id = await autoArquivos.salvarArquivo(nomeArquivo, descricao, Buffer.from(base64, 'base64'), mediaType);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/auto-atendimento/arquivos/:id', async (req, res) => {
  try {
    await autoArquivos.apagarArquivo(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- Agenda interna + sincronizacao opcional com o Google Agenda ----------

app.get('/api/agenda/eventos', async (req, res) => {
  try {
    const eventos = await agenda.listarEventos(req.query.from, req.query.to);
    res.json({ eventos });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/agenda/eventos', async (req, res) => {
  const { titulo, descricao, local, inicio, fim } = req.body || {};
  if (!titulo || !inicio || !fim) return res.status(400).json({ erro: 'titulo, inicio e fim sao obrigatorios' });
  try {
    const resultado = await agenda.criarEvento({ titulo, descricao, local, inicio, fim });
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/agenda/eventos/:id', async (req, res) => {
  try {
    await agenda.cancelarEvento(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/agenda/google/status', async (req, res) => {
  try {
    res.json({ conectado: await googleCalendar.estaConectado() });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// estado anti-CSRF de curta duracao (2min) pro round-trip do OAuth - so existe pra confirmar
// que o callback que voltou do Google corresponde a um "conectar" que a gente mesmo iniciou
const estadosOAuthPendentes = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [state, criadoEm] of estadosOAuthPendentes) {
    if (agora - criadoEm > 2 * 60 * 1000) estadosOAuthPendentes.delete(state);
  }
}, 60 * 1000).unref();

app.get('/api/agenda/google/conectar', (req, res) => {
  try {
    const state = crypto.randomUUID();
    estadosOAuthPendentes.set(state, Date.now());
    res.redirect(`${googleCalendar.urlAutorizacao()}&state=${state}`);
  } catch (err) {
    res.status(500).send(`Erro iniciando conexao com o Google: ${err.message}`);
  }
});

app.get('/api/agenda/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`/?agenda_google=erro&msg=${encodeURIComponent(String(error))}`);
  if (!state || !estadosOAuthPendentes.has(String(state))) return res.status(400).send('Estado invalido ou expirado - tenta conectar de novo pelo app.');
  estadosOAuthPendentes.delete(String(state));

  try {
    await googleCalendar.trocarCodigoPorToken(code);
    res.redirect('/?agenda_google=conectado');
  } catch (err) {
    res.redirect(`/?agenda_google=erro&msg=${encodeURIComponent(err.message)}`);
  }
});

app.post('/api/agenda/google/desconectar', async (req, res) => {
  try {
    await googleCalendar.desconectar();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

iniciarSchedulerLembretes();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jarvis Cloud rodando na porta ${PORT}`);
});
