import 'dotenv/config';
import crypto from 'node:crypto';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, continuarAcaoLocal, limparConversa, iniciarSchedulerLembretes, iniciarSchedulerSaldoAnuncios, iniciarSchedulerRelatorioDiario, obterStatusAoVivo } from './cloudAgent.js';
import { synthesizeSpeechWithTimestamps } from './gemini.js';
import { synthesizeSpeechKokoro } from './kokoro.js';
import { transcrever } from './whisper.js';
import { sendTextMessage, downloadMedia } from './whatsapp.js';
import { obterArquivo } from './arquivosGerados.js';
import * as evolutionApi from './evolutionApi.js';
import { enviarMensagemTexto } from './evolutionApi.js';
import * as agenda from './agenda.js';
import * as googleCalendar from './googleCalendar.js';
import * as whatsappInstances from './whatsappInstances.js';
import * as autoAtendimento from './autoAtendimento.js';
import * as autoArquivos from './autoAtendimentoArquivos.js';
import * as crm from './crm.js';
import * as relatoriosProgramados from './relatoriosProgramados.js';
import * as tenants from './tenants.js';

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

// protege tudo (estaticos + api) com um token assinado por tenant (ver tenants.js), no lugar
// da senha unica compartilhada de antes - cada cliente faz login com usuario/senha proprios e
// recebe um token HMAC que carrega o tenantId; toda rota autenticada usa req.tenantId a partir
// daqui pra isolar os dados de cada cliente. O link fica publico na internet e essa versao
// mexe em orcamento real de anuncio e dado de paciente, entao nao pode ficar aberta pra
// qualquer um. Os webhooks do WhatsApp ficam de fora porque quem chama e a propria
// Meta/Evolution (nao da pra mandar nosso token) - eles se protegem sozinhos (assinatura HMAC /
// mapeamento de instancia pro tenant certo).
app.use((req, res, next) => {
  if (!process.env.SESSION_SECRET) return next(); // sem auth configurada, roda aberto (dev local sem Postgres)
  if (
    req.path === '/api/login' ||
    req.path === '/webhook/whatsapp' ||
    req.path === '/api/whatsapp-evolution/webhook' ||
    req.path === '/api/agenda/google/callback' ||
    // EventSource nativo do browser nao manda headers customizados - a senha vai por query
    // string aqui, e o proprio handler da rota confere ela antes de abrir o stream
    req.path === '/api/crm/eventos' ||
    // <img src>/<audio src> tambem nao mandam headers customizados - mesma solucao (senha via
    // query string, conferida dentro do proprio handler)
    req.path.startsWith('/api/crm/midia/')
  ) return next();

  // /api/agenda/google/conectar e navegacao de pagina de verdade (o navegador redireciona pro
  // consentimento do Google), nao um fetch que consiga mandar header - o token vem por query
  // param SO nesse caso especifico, nunca como mecanismo geral de auth
  const provided = req.path === '/api/agenda/google/conectar'
    ? req.query.token
    : req.header('x-app-password');

  const tenantId = tenants.verificarToken(provided);
  if (tenantId) { req.tenantId = tenantId; return next(); }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ erro: 'sessao invalida - faca login de novo' });
  }
  next();
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!process.env.SESSION_SECRET) return res.json({ ok: true });
  try {
    const tenantId = await tenants.autenticar(username, password);
    if (!tenantId) return res.json({ ok: false });
    res.json({ ok: true, token: tenants.firmarToken(tenantId) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// o app chama isso no carregamento da pagina pra confirmar que o token guardado ainda e
// valido (nao expirou) e pra saber o nome do tenant logado
app.get('/api/me', async (req, res) => {
  if (!req.tenantId) return res.status(401).json({ erro: 'nao autenticado' });
  try {
    const tenant = await tenants.obterPorId(req.tenantId);
    if (!tenant || !tenant.ativo) return res.status(401).json({ erro: 'tenant nao encontrado' });
    res.json({ tenantId: tenant.id, nome: tenant.nome, slug: tenant.slug });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
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

// prefixa o sessionId (gerado pelo proprio navegador, guardado no localStorage) com o tenant
// autenticado - nunca confia no cliente pra dizer "de qual tenant" e essa sessao, isso vem
// sempre do token verificado pelo middleware (req.tenantId). Mantem session_id globalmente
// unico como PK da tabela sessions sem precisar de chave composta.
function sessionIdDoTenant(req, sessionId) {
  return `t${req.tenantId}:${sessionId}`;
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, attachments } = req.body || {};
  const temAnexo = Array.isArray(attachments) && attachments.length > 0;
  if ((!message && !temAnexo) || !sessionId) {
    return res.status(400).json({ erro: 'message (ou attachments) e sessionId sao obrigatorios' });
  }

  try {
    const sessionIdCompleto = sessionIdDoTenant(req, sessionId);
    sessoesVistas.add(sessionIdCompleto);
    comandosProcessados++;
    // chat() devolve { reply } no caso normal, ou { reply: null, localAction } quando a
    // proxima coisa a fazer e uma acao no computador do usuario - o navegador que decide
    // rodar (via o agente local) e reporta o resultado em /api/local-action-result
    const resultado = await chat(req.tenantId, sessionIdCompleto, message, attachments);
    res.json(resultado);
  } catch (err) {
    console.error('Erro no chat:', err);
    res.status(500).json({ erro: err.message });
  }
});

// o app faz polling nisso enquanto espera a resposta de /api/chat, pra mostrar um indicador
// na janela de conversa (pensando, rodando ferramenta, calculando, transcrevendo audio...) -
// leitura rapida em RAM, sem tocar no Postgres
app.get('/api/chat/status', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ erro: 'sessionId obrigatorio' });
  res.json(obterStatusAoVivo(sessionIdDoTenant(req, sessionId)) || { estado: null });
});

// o navegador chama isso depois de executar uma acao no computador do usuario (via agente
// local) - devolve o resultado real pra Claude continuar a conversa de onde parou
app.post('/api/local-action-result', async (req, res) => {
  const { sessionId, resultado } = req.body || {};
  if (!sessionId || resultado === undefined) {
    return res.status(400).json({ erro: 'sessionId e resultado sao obrigatorios' });
  }
  try {
    const saida = await continuarAcaoLocal(req.tenantId, sessionIdDoTenant(req, sessionId), resultado);
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
    await limparConversa(req.tenantId, sessionIdDoTenant(req, sessionId));
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
    // mesma normalizacao usada no audio do auto-atendimento (moeda "R$"/"$" e hora "14h"/
    // "14:00h" faladas por extenso) - aqui ainda nao passava por nada antes, entao o Kokoro
    // podia ler o cifrao literal e soar como "real dolar" junto
    const textoFalado = autoAtendimento.prepararTextoParaAudio(text);
    // KOKORO_URL so existe nos ambientes com o Kokoro TTS auto-hospedado rodando ao lado (a
    // VPS) - voz fixa, sem cota nem custo por uso. Onde nao tem essa infra (ex: Render), cai
    // pro Gemini como estava antes.
    const { audioBase64, alignment } = process.env.KOKORO_URL
      ? await synthesizeSpeechKokoro(textoFalado)
      : await synthesizeSpeechWithTimestamps(textoFalado);
    // devolve o texto normalizado tambem - o frontend usa ele (nao o "text" original) na
    // legenda final, senao a legenda mostraria "Real"/horas por extenso durante a fala e
    // "pularia" de volta pro "R$"/"14h" original no instante em que o audio termina
    res.json({ audio: audioBase64, alignment, textoFalado });
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
    const texto = await transcrever(buffer, mediaType || 'audio/webm');
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

// canal legado (Meta Cloud API oficial, ao contrario do Evolution API que e o canal principal
// hoje) - ainda nao tem roteamento por tenant configuravel (WHATSAPP_ALLOWED_NUMBERS continua
// um env var global), entao fica fixo no tenant 1 por enquanto. Revisar se/quando outro tenant
// precisar desse canal especifico.
const TENANT_ID_WHATSAPP_META_LEGADO = 1;

async function processarMensagemWhatsapp(msg) {
  const from = msg.from;
  if (!numeroWhatsappPermitido(from)) return; // ignora silenciosamente numeros nao autorizados

  const tenantId = TENANT_ID_WHATSAPP_META_LEGADO;
  const sessionId = `t${tenantId}:whatsapp:${from}`;
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
    const resultado = await chat(tenantId, sessionId, texto, attachments);
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
  const id = data?.key?.id || null;

  if (msg.imageMessage) return { numero, texto: msg.imageMessage.caption || '', tipo: 'image', fromMe: !!data?.key?.fromMe, id };
  if (msg.audioMessage) return { numero, texto: '', tipo: 'audio', fromMe: !!data?.key?.fromMe, id };
  if (msg.videoMessage) return { numero, texto: msg.videoMessage.caption || '', tipo: 'video', fromMe: !!data?.key?.fromMe, id };

  const texto = msg.conversation || msg.extendedTextMessage?.text || '';
  return { numero, texto, tipo: 'text', fromMe: !!data?.key?.fromMe, id };
}

// compara dois numeros de telefone ignorando formatacao (DDI "55" presente ou nao, o "9" extra
// de celular presente ou nao) - comparar string exata quebrava silenciosamente quando o numero
// admin era salvo sem o "55" na frente (formato facil de digitar errado na tela de config)
function normalizarTelefone(n) {
  return (n || '').replace(/\D/g, '');
}
function mesmoNumero(a, b) {
  const na = normalizarTelefone(a);
  const nb = normalizarTelefone(b);
  if (!na || !nb) return false;
  return na === nb || na.slice(-10) === nb.slice(-10);
}

// ids das mensagens que a PROPRIA Lumia acabou de mandar pro numero do dono - quando o
// WhatsApp do dono e a mesma conta que a instancia da Lumia usa (o dono "conversa com ela
// mesma" no chat de "Mensagem para voce mesmo"), toda mensagem enviada por QUALQUER dispositivo
// dessa conta (inclusive as respostas que a propria Lumia manda) chega no webhook com
// fromMe:true - sem rastrear o que a gente mesma mandou, a resposta da Lumia seria reprocessada
// como se fosse uma nova pergunta do dono, entrando em loop infinito consigo mesma.
const idsEnviadosPorNos = new Set();
function lembrarEnviada(resposta) {
  const id = resposta?.key?.id;
  if (!id) return;
  idsEnviadosPorNos.add(id);
  if (idsEnviadosPorNos.size > 200) {
    idsEnviadosPorNos.delete(idsEnviadosPorNos.values().next().value);
  }
}

// baixa a midia (so imagem/audio - video fica de fora, arquivo grande e a aba CRM so mostra o
// icone mesmo) e ja guarda junto no CRM, pra dar pra ver/ouvir dias depois na aba CRM sem
// depender do WhatsApp/Evolution ainda ter o arquivo disponivel na hora que o dono for abrir.
// "melhor esforco": se o download falhar, ainda registra a mensagem (so sem midia, cai no
// icone de sempre) em vez de perder a mensagem inteira do historico do CRM.
async function registrarMensagemComMidia(tenantId, { numero, instancia, direcao, tipo, texto, nome, mensagemBruta }) {
  let midiaBase64 = null;
  let midiaMimetype = null;
  if (tipo === 'image' || tipo === 'audio') {
    try {
      const midia = await evolutionApi.baixarMidiaMensagem(instancia, mensagemBruta);
      midiaBase64 = midia?.base64 || null;
      midiaMimetype = midia?.mimetype || null;
    } catch (err) {
      console.error('Erro baixando midia pro CRM:', err.message);
    }
  }
  await crm.registrarMensagem(tenantId, { numero, instancia, direcao, tipo, texto, nome, midiaBase64, midiaMimetype });
}

async function processarMensagemEvolution(instanciaDoWebhook, data) {
  // primeira coisa: descobre de qual tenant e essa instancia - sem mapeamento, ignora a
  // mensagem silenciosamente (mesmo padrao ja usado pra numero fora da allowlist). Isso
  // impede uma instancia nao cadastrada de "vazar" pra dentro de um tenant qualquer.
  const tenantId = await tenants.resolverTenantPorInstancia(instanciaDoWebhook);
  if (!tenantId) return;

  const { numero, texto, tipo, fromMe, id } = extrairMensagemEvolution(data);
  const { instanciaAtiva, numeroAdmin } = await whatsappInstances.obterConfig(tenantId);
  const ehNumeroAdmin = numeroAdmin && mesmoNumero(numero, numeroAdmin);

  if (fromMe) {
    // eco confirmado de algo que a propria Lumia mandou (painel CRM ou auto-atendimento) -
    // esses dois caminhos ja registram a mensagem 'saida' no CRM no proprio ponto de envio,
    // entao so ignora aqui pra nao duplicar
    if (id && idsEnviadosPorNos.has(id)) { idsEnviadosPorNos.delete(id); return; }
    // fromMe sem ser eco rastreado, PRA UM CONTATO (nao o numero do dono): e o dono
    // respondendo manualmente pelo proprio WhatsApp de verdade (celular/WhatsApp Web), sem
    // passar pela Lumia nem pelo painel - registra no CRM como 'saida' pra a conversa la
    // ficar identica a conversa real (senao essas respostas manuais nunca apareciam no CRM).
    if (!ehNumeroAdmin) {
      registrarMensagemComMidia(tenantId, { numero, instancia: instanciaDoWebhook, direcao: 'saida', tipo, texto, nome: data?.pushName, mensagemBruta: data })
        .catch((err) => console.error('Erro registrando mensagem manual (fromMe) no CRM:', err.message));
      return;
    }
    // fromMe pro proprio numero do dono (chat "Mensagem para voce mesmo") - continua nao
    // sendo uma conversa de CRM, e a conversa pessoal do dono com a Lumia
  }
  if (tipo === 'text' && !texto) return;

  // espelha no CRM (Kanban) qualquer mensagem recebida de um contato que nao seja o proprio
  // dono, em qualquer instancia conectada - "best-effort", nunca trava o fluxo principal (a
  // resposta da Lumia) se o CRM der erro
  if (!ehNumeroAdmin) {
    registrarMensagemComMidia(tenantId, { numero, instancia: instanciaDoWebhook, direcao: 'entrada', tipo, texto, nome: data?.pushName, mensagemBruta: data })
      .catch((err) => console.error('Erro registrando mensagem no CRM:', err.message));
  }

  // mensagem do dono, na instancia pessoal ativa - conversa normal (todas as ferramentas,
  // memoria persistente, personalidade completa). Midia do dono continua so texto por
  // enquanto (esse caminho ja tinha essa limitacao antes do auto-atendimento existir).
  if (instanciaDoWebhook === instanciaAtiva && ehNumeroAdmin) {
    if (tipo !== 'text') return;
    try {
      const resultado = await chat(tenantId, `t${tenantId}:whatsapp-evo:${numero}`, texto, []);
      if (resultado.localAction) {
        lembrarEnviada(await enviarMensagemTexto(tenantId, numero, 'Isso aí envolve mexer no seu computador, e isso só funciona pelo app no próprio PC (não dá pra fazer por aqui pelo WhatsApp).'));
        return;
      }
      lembrarEnviada(await enviarMensagemTexto(tenantId, numero, resultado.reply));
    } catch (err) {
      console.error('Erro no chat via Evolution/WhatsApp:', err);
      lembrarEnviada(await enviarMensagemTexto(tenantId, numero, `Deu erro por aqui: ${err.message}`).catch(() => {}));
    }
    return;
  }

  // qualquer outro contato (nao o dono) - so responde se o auto-atendimento estiver ativo
  // NESSA instancia especifica; usa um motor totalmente separado (prompt/historico/ferramentas
  // proprios), nunca a conversa pessoal da Lumia
  const configAuto = await autoAtendimento.obterConfig(tenantId);
  if (!configAuto.ativo || configAuto.instancia !== instanciaDoWebhook) return;
  // pausa pontual por conversa (aba CRM) - tem prioridade sobre a config global estar ativa;
  // a mensagem do contato ja foi registrada no CRM acima, so nao gera resposta automatica
  if (await crm.estaPausado(tenantId, numero, instanciaDoWebhook).catch(() => false)) return;

  // "digitando..."/"gravando audio..." no WhatsApp expira sozinho depois de poucos segundos
  // (o app do contato esconde o indicador se nao renovar) - como pensar a resposta (chamar a
  // IA, rodar ferramenta de agenda/Clinicorp etc) pode levar bem mais que isso, reenvia o
  // sinal em loop ate o instante exato de mandar a mensagem de verdade, sem deixar "apagar" no
  // meio do caminho. Ja sabe de antemao se vai ser audio ou texto, pra mostrar o icone certo
  // desde o comeco (nao so "digitando" ate o fim e "gravando" so no ultimo segundo).
  const provavelAudio = await autoAtendimento.preverVaiSerAudio(tenantId, numero, tipo).catch(() => false);
  const tipoPresenca = provavelAudio ? 'recording' : 'composing';
  const manterPresenca = setInterval(() => {
    evolutionApi.enviarPresenca(instanciaDoWebhook, numero, tipoPresenca).catch(() => {});
  }, 4000);
  evolutionApi.enviarPresenca(instanciaDoWebhook, numero, tipoPresenca).catch(() => {});

  try {
    // trava de seguranca: mesmo com os timeouts internos (Clinicorp, Evolution), algo
    // inesperado (ex: a propria API da Anthropic pendurada) ainda podia deixar o contato sem
    // resposta pra sempre - "travado" do lado de quem manda mensagem. Isso garante um limite
    // maximo de espera; se estourar, cai no catch abaixo e manda um aviso em vez de silencio.
    const resultado = await Promise.race([
      autoAtendimento.processarMensagem(tenantId, numero, instanciaDoWebhook, { texto, tipo, mensagemBruta: data }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Demorou demais pra gerar uma resposta (mais de 55s)')), 55000)),
    ]);
    if (!resultado) return;

    clearInterval(manterPresenca); // para de renovar bem no instante de mandar a mensagem

    if (resultado.respondeComAudio) {
      try {
        await autoAtendimento.enviarRespostaEmAudio(instanciaDoWebhook, numero, resultado.texto);
        crm.registrarMensagem(tenantId, { numero, instancia: instanciaDoWebhook, direcao: 'saida', tipo: 'audio', texto: resultado.texto })
          .catch((err) => console.error('Erro registrando mensagem no CRM:', err.message));
        return;
      } catch (err) {
        console.error('Erro mandando resposta em audio, caindo pra texto:', err.message);
      }
    }
    await evolutionApi.enviarMensagemTextoPor(instanciaDoWebhook, numero, resultado.texto);
    crm.registrarMensagem(tenantId, { numero, instancia: instanciaDoWebhook, direcao: 'saida', tipo: 'text', texto: resultado.texto })
      .catch((err) => console.error('Erro registrando mensagem no CRM:', err.message));
  } catch (err) {
    console.error('Erro no auto-atendimento via Evolution/WhatsApp:', err);
    // nunca deixa o contato literalmente sem resposta nenhuma por causa de um erro tecnico -
    // antes disso, um erro (Anthropic sobrecarregada, Clinicorp fora do ar etc) resultava em
    // silencio total, o que parecia a Lumia ter "travado" pra quem estava mandando mensagem
    await evolutionApi.enviarMensagemTextoPor(instanciaDoWebhook, numero, 'Desculpa, tive um probleminha técnico aqui agora. Pode mandar sua mensagem de novo?').catch(() => {});
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
    const config = await whatsappInstances.obterConfig(req.tenantId);
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

// so mostra/deixa mexer nas instancias que pertencem AO TENANT LOGADO - o Evolution API por
// baixo e compartilhado entre todos os tenants, entao sem esse filtro um cliente conseguiria
// ver (e ate desconectar/reconectar) o WhatsApp de outro cliente
async function instanciaPertenceAoTenant(req, nome) {
  const dono = await tenants.resolverTenantPorInstancia(nome);
  return dono === req.tenantId;
}

app.get('/api/whatsapp/instancias', async (req, res) => {
  try {
    const permitidas = new Set(await tenants.listarInstanciasDoTenant(req.tenantId));
    const todas = await evolutionApi.listarInstancias();
    res.json({ instancias: todas.filter((i) => permitidas.has(i.nome)) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/instancias', async (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
  try {
    const resultado = await evolutionApi.criarInstancia(nome);
    // a instancia nasce ja vinculada a quem criou - sem isso ela ficaria "orfa" (sem tenant
    // nenhum mapeado) e nenhuma mensagem recebida nela seria roteada pra ninguem
    await tenants.mapearInstanciaParaTenant(nome, req.tenantId);
    res.json({ ok: true, qrcode: resultado?.qrcode?.base64 || null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/whatsapp/qrcode/:nome', async (req, res) => {
  try {
    if (!(await instanciaPertenceAoTenant(req, req.params.nome))) {
      return res.status(403).json({ erro: 'Essa instancia nao pertence a essa conta.' });
    }
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
    if (!(await instanciaPertenceAoTenant(req, nome))) {
      return res.status(403).json({ erro: 'Essa instancia nao pertence a essa conta.' });
    }
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
    if (!(await instanciaPertenceAoTenant(req, nome))) {
      return res.status(403).json({ erro: 'Essa instancia nao pertence a essa conta.' });
    }
    await whatsappInstances.definirInstanciaAtiva(req.tenantId, nome);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/whatsapp/admin', async (req, res) => {
  const { numero } = req.body || {};
  if (!numero) return res.status(400).json({ erro: 'numero obrigatorio' });
  try {
    await whatsappInstances.definirNumeroAdmin(req.tenantId, numero);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- Auto atendimento (persona/prompt isolado pra atender outros contatos) ----------

app.get('/api/auto-atendimento/config', async (req, res) => {
  try {
    res.json(await autoAtendimento.obterConfig(req.tenantId));
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
    await autoAtendimento.salvarConfig(req.tenantId, { ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, agendarClinicorp, agendarAgendaInterna });
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
    res.json({ arquivos: await autoArquivos.listarArquivos(req.tenantId) });
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
    const id = await autoArquivos.salvarArquivo(req.tenantId, nomeArquivo, descricao, Buffer.from(base64, 'base64'), mediaType);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/auto-atendimento/arquivos/:id', async (req, res) => {
  try {
    await autoArquivos.apagarArquivo(req.tenantId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- Relatorios programados (aba "Relatorios") ----------

app.get('/api/relatorios/destinatarios', async (req, res) => {
  try {
    res.json({ destinatarios: await relatoriosProgramados.listarDestinatarios(req.tenantId) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/relatorios/destinatarios', async (req, res) => {
  const { numero } = req.body || {};
  if (!numero) return res.status(400).json({ erro: 'numero obrigatorio' });
  try {
    const id = await relatoriosProgramados.adicionarDestinatario(req.tenantId, numero);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/relatorios/destinatarios/:id', async (req, res) => {
  try {
    await relatoriosProgramados.removerDestinatario(req.tenantId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/relatorios/configs', async (req, res) => {
  try {
    res.json({ configs: await relatoriosProgramados.obterConfigs(req.tenantId) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/relatorios/configs/:tipo', async (req, res) => {
  const { ativo, frequencia, horaEnvio, instancia } = req.body || {};
  try {
    if (instancia && !(await instanciaPertenceAoTenant(req, instancia))) {
      return res.status(403).json({ erro: 'Essa instancia nao pertence a essa conta.' });
    }
    await relatoriosProgramados.salvarConfig(req.tenantId, req.params.tipo, { ativo, frequencia, horaEnvio, instancia });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// manda o relatorio na hora, pra todos os destinatarios cadastrados - usado pelo botao
// "Enviar agora" da aba, sem esperar a data programada
app.post('/api/relatorios/enviar-agora/:tipo', async (req, res) => {
  try {
    const resultado = await relatoriosProgramados.enviarRelatorioAgora(req.tenantId, req.params.tipo);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---------- CRM estilo Kanban (espelho das conversas do WhatsApp por etapa do funil) ----------

app.get('/api/crm/contatos', async (req, res) => {
  try {
    res.json({ etapas: crm.ETAPAS, contatos: await crm.listarContatos(req.tenantId) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/crm/mensagens', async (req, res) => {
  const { numero, instancia } = req.query;
  if (!numero || !instancia) return res.status(400).json({ erro: 'numero e instancia sao obrigatorios' });
  try {
    res.json({ mensagens: await crm.listarMensagens(req.tenantId, String(numero), String(instancia)) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/crm/mensagens', async (req, res) => {
  const { numero, instancia, texto } = req.body || {};
  if (!numero || !instancia || !texto) return res.status(400).json({ erro: 'numero, instancia e texto sao obrigatorios' });
  try {
    await crm.enviarMensagem(req.tenantId, numero, instancia, texto);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/crm/contatos/:id/etapa', async (req, res) => {
  const { etapa } = req.body || {};
  if (!etapa) return res.status(400).json({ erro: 'etapa e obrigatoria' });
  try {
    await crm.moverEtapa(req.tenantId, Number(req.params.id), etapa);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/crm/contatos/:id/auto', async (req, res) => {
  const { pausado } = req.body || {};
  try {
    await crm.alternarAutoAtendimento(req.tenantId, Number(req.params.id), !!pausado);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/crm/contatos/:id', async (req, res) => {
  try {
    await crm.apagarContato(req.tenantId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// esconde/reexibe manualmente uma conversa do funil ("conversas trancadas" que o dono quer
// tirar de vista - nao ha como detectar chat/contato bloqueado de verdade via Evolution API,
// esse dado de privacidade do WhatsApp oficial nao e sincronizado pro Baileys)
app.post('/api/crm/contatos/:id/ocultar', async (req, res) => {
  const { oculto } = req.body || {};
  try {
    await crm.alternarOcultar(req.tenantId, Number(req.params.id), !!oculto);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// senha extra (separada da senha geral do app) pra ver a lista de ocultas - protege contra
// quem tem acesso normal ao painel (ex: funcionario que usa o CRM no dia a dia) mas nao deve
// ver as conversas que o dono marcou pra ignorar/esconder
app.get('/api/crm/contatos-ocultos', async (req, res) => {
  try {
    const ok = await crm.verificarSenhaOcultas(req.tenantId, req.query.senha ? String(req.query.senha) : '');
    if (!ok) return res.status(401).json({ erro: 'senha incorreta' });
    res.json({ etapas: crm.ETAPAS, contatos: await crm.listarContatosOcultos(req.tenantId) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// serve a imagem/audio guardada de uma mensagem do CRM - autenticado por query string (token)
// porque e usado direto em <img src>/<audio src>, que nao mandam header customizado. So essa
// rota fica de fora do middleware geral (ver acima), entao valida o token aqui na mao.
app.get('/api/crm/midia/:mensagemId', async (req, res) => {
  const tenantId = tenants.verificarToken(req.query.senha);
  if (!tenantId) return res.status(401).end();
  try {
    const midia = await crm.obterMidiaMensagem(tenantId, Number(req.params.mensagemId));
    if (!midia) return res.status(404).end();
    res.set('Content-Type', midia.mimetype);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(midia.base64, 'base64'));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/crm/ocultas/senha-status', async (req, res) => {
  try {
    res.json({ configurada: !!(await crm.obterSenhaOcultas(req.tenantId)) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// define/troca/remove a senha das ocultas - se ja existe uma, exige a atual pra trocar (mas o
// acesso a essa rota ja exige login no tenant, ver middleware de auth acima)
app.post('/api/crm/ocultas/senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  try {
    const atual = await crm.obterSenhaOcultas(req.tenantId);
    if (atual && senhaAtual !== atual) return res.status(401).json({ erro: 'senha atual incorreta' });
    await crm.definirSenhaOcultas(req.tenantId, novaSenha ? String(novaSenha) : null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// tempo real da aba CRM via Server-Sent Events - EventSource nativo do browser nao manda
// headers customizados, entao o frontend usa fetch() + leitura manual do stream (mesmo token
// de sempre, so que como query string aqui, unico jeito de autenticar essa rota especifica
// sem mudar todo o esquema de auth do app). So essa rota fica de fora do middleware geral, e
// so repassa eventos do PROPRIO tenant - eventosCrm e um emissor global compartilhado por
// todos os tenants no mesmo processo, entao o filtro por tenantId aqui e essencial, senao um
// cliente veria em tempo real as conversas de outro.
app.get('/api/crm/eventos', (req, res) => {
  const tenantId = tenants.verificarToken(req.query.senha);
  if (!tenantId) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // desliga buffering do Traefik/nginx na frente, senao o evento fica preso no proxy
  });
  res.write('\n');

  const mandar = (tipo, payload) => res.write(`data: ${JSON.stringify({ tipo, ...payload })}\n\n`);
  const onMensagem = (payload) => { if (payload.tenantId === tenantId) mandar('mensagem', payload); };
  const onContatoAtualizado = (payload) => { if (payload.tenantId === tenantId) mandar('contato-atualizado', payload); };
  crm.eventosCrm.on('mensagem', onMensagem);
  crm.eventosCrm.on('contato-atualizado', onContatoAtualizado);

  // sem isso a conexao fica "ociosa" e proxies na frente (Traefik) derrubam depois de um
  // tempo sem trafego nenhum - um comentario SSE (linha comecando com ":") a cada 20s mantem
  // viva sem gerar evento nenhum pro frontend processar
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    crm.eventosCrm.off('mensagem', onMensagem);
    crm.eventosCrm.off('contato-atualizado', onContatoAtualizado);
  });
});

// ---------- Agenda interna + sincronizacao opcional com o Google Agenda ----------

app.get('/api/agenda/eventos', async (req, res) => {
  try {
    const eventos = await agenda.listarEventos(req.tenantId, req.query.from, req.query.to);
    res.json({ eventos });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/agenda/eventos', async (req, res) => {
  const { titulo, descricao, local, inicio, fim } = req.body || {};
  if (!titulo || !inicio || !fim) return res.status(400).json({ erro: 'titulo, inicio e fim sao obrigatorios' });
  try {
    const resultado = await agenda.criarEvento(req.tenantId, { titulo, descricao, local, inicio, fim });
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/agenda/eventos/:id', async (req, res) => {
  try {
    await agenda.cancelarEvento(req.tenantId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/agenda/google/status', async (req, res) => {
  try {
    res.json({ conectado: await googleCalendar.estaConectado(req.tenantId) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// estado anti-CSRF de curta duracao (2min) pro round-trip do OAuth - confirma que o callback
// que voltou do Google corresponde a um "conectar" que a gente mesmo iniciou, E carrega o
// tenantId (o callback do Google nao consegue mandar nosso token de sessao, entao e assim que
// sabemos pra qual tenant salvar os tokens de calendario)
const estadosOAuthPendentes = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [state, { criadoEm }] of estadosOAuthPendentes) {
    if (agora - criadoEm > 2 * 60 * 1000) estadosOAuthPendentes.delete(state);
  }
}, 60 * 1000).unref();

app.get('/api/agenda/google/conectar', (req, res) => {
  if (!req.tenantId) return res.status(401).send('Sessao invalida - abre essa tela de dentro do app, nao direto pela URL.');
  try {
    const state = crypto.randomUUID();
    estadosOAuthPendentes.set(state, { criadoEm: Date.now(), tenantId: req.tenantId });
    res.redirect(`${googleCalendar.urlAutorizacao()}&state=${state}`);
  } catch (err) {
    res.status(500).send(`Erro iniciando conexao com o Google: ${err.message}`);
  }
});

app.get('/api/agenda/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`/?agenda_google=erro&msg=${encodeURIComponent(String(error))}`);
  const pendente = state && estadosOAuthPendentes.get(String(state));
  if (!pendente) return res.status(400).send('Estado invalido ou expirado - tenta conectar de novo pelo app.');
  estadosOAuthPendentes.delete(String(state));

  try {
    await googleCalendar.trocarCodigoPorToken(pendente.tenantId, code);
    res.redirect('/?agenda_google=conectado');
  } catch (err) {
    res.redirect(`/?agenda_google=erro&msg=${encodeURIComponent(err.message)}`);
  }
});

app.post('/api/agenda/google/desconectar', async (req, res) => {
  try {
    await googleCalendar.desconectar(req.tenantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

iniciarSchedulerLembretes();
// O alerta de saldo baixo fixo (env var LUMIA_WHATSAPP_ADMIN, sem configuracao de
// instancia/destinatarios) foi substituido pelo tipo "ads_saldo_baixo" na aba Relatorios -
// mesma logica, agora configuravel (instancia de envio, destinatarios, frequencia de checagem,
// "enviar agora"), e so alerta contas com campanha ativa (ver gerarAlertaSaldoBaixo).
// iniciarSchedulerSaldoAnuncios();
// O relatorio diario automatico antigo (por env var LUMIA_WHATSAPP_ADMIN) foi desativado a
// pedido do usuario - estava indo pra um numero errado. Continua disponivel sob demanda via
// gerarRelatorioDiario() no chat da Lumia.
// iniciarSchedulerRelatorioDiario();
// Scheduler dos relatorios configuraveis da aba Relatorios (inclui o alerta de saldo baixo
// acima) - cada tipo so e enviado automaticamente se estiver "Ativado" na aba; por padrao vem
// desativado, entao reativar esse scheduler geral e seguro.
relatoriosProgramados.iniciarSchedulerRelatoriosProgramados();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jarvis Cloud rodando na porta ${PORT}`);
});
