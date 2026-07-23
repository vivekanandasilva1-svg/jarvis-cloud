const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const appWindow = document.getElementById('appWindow');

const chatLog = document.getElementById('chatLog');
const composer = document.getElementById('composer');
const textInput = document.getElementById('textInput');
const micBtn = document.getElementById('micBtn');
const convBtn = document.getElementById('convBtn');
const muteBtn = document.getElementById('muteBtn');
const logoutBtn = document.getElementById('logoutBtn');
const agentBtn = document.getElementById('agentBtn');
const agentDot = document.getElementById('agentDot');
const agentPanel = document.getElementById('agentPanel');
const agentPanelClose = document.getElementById('agentPanelClose');
const agentTokenInput = document.getElementById('agentTokenInput');
const agentSaveBtn = document.getElementById('agentSaveBtn');
const agentStatus = document.getElementById('agentStatus');
const controleAbasToggle = document.getElementById('controleAbasToggle');
const clearBtn = document.getElementById('clearBtn');
const extractBtn = document.getElementById('extractBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachPreview = document.getElementById('attachPreview');
const bot = document.getElementById('bot');
const statusEl = document.getElementById('status');
const clockEl = document.getElementById('clock');
const hintEl = document.getElementById('hint');

// ---------- Painel: elementos ----------
const weatherBadge = document.getElementById('weatherBadge');
const weatherBadgeTemp = document.getElementById('weatherBadgeTemp');
const statsRefresh = document.getElementById('statsRefresh');
const cpuValue = document.getElementById('cpuValue');
const cpuBar = document.getElementById('cpuBar');
const cpuMini = document.getElementById('cpuMini');
const ramValue = document.getElementById('ramValue');
const ramBar = document.getElementById('ramBar');
const ramMini = document.getElementById('ramMini');
const diskMini = document.getElementById('diskMini');
const weatherRefresh = document.getElementById('weatherRefresh');
const weatherTemp = document.getElementById('weatherTemp');
const weatherPlace = document.getElementById('weatherPlace');
const weatherCond = document.getElementById('weatherCond');
const weatherHumidity = document.getElementById('weatherHumidity');
const weatherWind = document.getElementById('weatherWind');
const weatherFeels = document.getElementById('weatherFeels');
const cameraToggle = document.getElementById('cameraToggle');
const cameraVideo = document.getElementById('cameraVideo');
const cameraOffMsg = document.getElementById('cameraOffMsg');
const cameraHint = document.getElementById('cameraHint');
const uptimeLive = document.getElementById('uptimeLive');
const uptimeBig = document.getElementById('uptimeBig');
const sessionValue = document.getElementById('sessionValue');
const commandsValue = document.getElementById('commandsValue');
const loadLabel = document.getElementById('loadLabel');
const loadBar = document.getElementById('loadBar');

// ---------- Abas: elementos ----------
const tabBtnPainel = document.getElementById('tabBtnPainel');
const tabBtnAgenda = document.getElementById('tabBtnAgenda');
const tabBtnWhatsapp = document.getElementById('tabBtnWhatsapp');
const tabBtnCrm = document.getElementById('tabBtnCrm');
const tabBtnAuto = document.getElementById('tabBtnAuto');
const tabBtnRelatorios = document.getElementById('tabBtnRelatorios');
const tabBtnClientes = document.getElementById('tabBtnClientes');
const tabPainel = document.getElementById('tabPainel');
const tabAgenda = document.getElementById('tabAgenda');
const tabWhatsapp = document.getElementById('tabWhatsapp');
const tabCrm = document.getElementById('tabCrm');
const tabAuto = document.getElementById('tabAuto');
const tabRelatorios = document.getElementById('tabRelatorios');
const tabClientes = document.getElementById('tabClientes');

// ---------- Clientes (admin - so super_admin ve): elementos ----------
const clienteNomeInput = document.getElementById('clienteNomeInput');
const clienteUsuarioInput = document.getElementById('clienteUsuarioInput');
const clienteSenhaInput = document.getElementById('clienteSenhaInput');
const clienteCriarBtn = document.getElementById('clienteCriarBtn');
const clienteCriarErro = document.getElementById('clienteCriarErro');
const clientesLista = document.getElementById('clientesLista');
const clienteIntegracoesPainel = document.getElementById('clienteIntegracoesPainel');
const agendaGoogleStatus = document.getElementById('agendaGoogleStatus');
const agendaGoogleBtn = document.getElementById('agendaGoogleBtn');
const agendaForm = document.getElementById('agendaForm');
const agendaTitulo = document.getElementById('agendaTitulo');
const agendaLocal = document.getElementById('agendaLocal');
const agendaData = document.getElementById('agendaData');
const agendaHoraInicio = document.getElementById('agendaHoraInicio');
const agendaHoraFim = document.getElementById('agendaHoraFim');
const agendaDescricao = document.getElementById('agendaDescricao');
const agendaErro = document.getElementById('agendaErro');
const agendaGrade = document.getElementById('agendaGrade');
const agendaRefresh = document.getElementById('agendaRefresh');
const agendaDiaTitulo = document.getElementById('agendaDiaTitulo');
const agendaDiaAnterior = document.getElementById('agendaDiaAnterior');
const agendaDiaHoje = document.getElementById('agendaDiaHoje');
const agendaDiaProximo = document.getElementById('agendaDiaProximo');

// ---------- WhatsApp: elementos ----------
const waInstanciaAtiva = document.getElementById('waInstanciaAtiva');
const waBadge = document.getElementById('waBadge');
const waAdminInput = document.getElementById('waAdminInput');
const waAdminSalvar = document.getElementById('waAdminSalvar');
const waNovoNome = document.getElementById('waNovoNome');
const waNovoCriar = document.getElementById('waNovoCriar');
const waQrArea = document.getElementById('waQrArea');
const waQrImg = document.getElementById('waQrImg');
const waQrFechar = document.getElementById('waQrFechar');
const waLista = document.getElementById('waLista');
const waRefresh = document.getElementById('waRefresh');

// ---------- CRM: elementos ----------
const crmBoard = document.getElementById('crmBoard');
const crmRefresh = document.getElementById('crmRefresh');
const crmScrollEsq = document.getElementById('crmScrollEsq');
const crmScrollDir = document.getElementById('crmScrollDir');
const crmConversa = document.getElementById('crmConversa');
const crmConversaNome = document.getElementById('crmConversaNome');
const crmConversaNumero = document.getElementById('crmConversaNumero');
const crmConversaLog = document.getElementById('crmConversaLog');
const crmConversaForm = document.getElementById('crmConversaForm');
const crmConversaInput = document.getElementById('crmConversaInput');
const crmConversaFechar = document.getElementById('crmConversaFechar');
const crmConversaErro = document.getElementById('crmConversaErro');
const crmConversaPausar = document.getElementById('crmConversaPausar');
const crmConversaApagar = document.getElementById('crmConversaApagar');
const crmConversaOcultar = document.getElementById('crmConversaOcultar');
const crmConversaAvatar = document.getElementById('crmConversaAvatar');
const crmConversaAvatarFallback = document.getElementById('crmConversaAvatarFallback');
const crmVerOcultas = document.getElementById('crmVerOcultas');
const crmOcultasModal = document.getElementById('crmOcultasModal');
const crmOcultasFechar = document.getElementById('crmOcultasFechar');
const crmOcultasLista = document.getElementById('crmOcultasLista');
const crmOcultasRodape = document.getElementById('crmOcultasRodape');
const crmOcultasTrocarSenhaBtn = document.getElementById('crmOcultasTrocarSenhaBtn');
const crmOcultasSenhaGate = document.getElementById('crmOcultasSenhaGate');
const crmOcultasSenhaTexto = document.getElementById('crmOcultasSenhaTexto');
const crmOcultasSenhaInput = document.getElementById('crmOcultasSenhaInput');
const crmOcultasSenhaEntrar = document.getElementById('crmOcultasSenhaEntrar');
const crmOcultasSenhaErro = document.getElementById('crmOcultasSenhaErro');
const crmOcultasTrocarSenha = document.getElementById('crmOcultasTrocarSenha');
const crmOcultasTrocarTexto = document.getElementById('crmOcultasTrocarTexto');
const crmOcultasSenhaAtualInput = document.getElementById('crmOcultasSenhaAtualInput');
const crmOcultasSenhaNovaInput = document.getElementById('crmOcultasSenhaNovaInput');
const crmOcultasSenhaSalvar = document.getElementById('crmOcultasSenhaSalvar');
const crmOcultasSenhaCancelar = document.getElementById('crmOcultasSenhaCancelar');
const crmOcultasTrocarErro = document.getElementById('crmOcultasTrocarErro');

// ---------- Auto Atendimento: elementos ----------
const autoAtivo = document.getElementById('autoAtivo');
const autoAtivoLabel = document.getElementById('autoAtivoLabel');
const autoInstancia = document.getElementById('autoInstancia');
const autoPrompt = document.getElementById('autoPrompt');
const autoFrequenciaAudio = document.getElementById('autoFrequenciaAudio');
const autoAudioSeReceberAudio = document.getElementById('autoAudioSeReceberAudio');
const autoAgendarInterna = document.getElementById('autoAgendarInterna');
const autoAgendarClinicorp = document.getElementById('autoAgendarClinicorp');
const autoSalvar = document.getElementById('autoSalvar');
const autoErro = document.getElementById('autoErro');
const autoArquivoInput = document.getElementById('autoArquivoInput');
const autoArquivoEscolher = document.getElementById('autoArquivoEscolher');
const autoArquivoNome = document.getElementById('autoArquivoNome');
const autoArquivoDescricao = document.getElementById('autoArquivoDescricao');
const autoArquivoEnviar = document.getElementById('autoArquivoEnviar');
const autoArquivosLista = document.getElementById('autoArquivosLista');

// ---------- Relatorios: elementos ----------
const relatorioNumeroInput = document.getElementById('relatorioNumeroInput');
const relatorioNumeroAdicionar = document.getElementById('relatorioNumeroAdicionar');
const relatorioNumeroErro = document.getElementById('relatorioNumeroErro');
const relatorioDestinatariosLista = document.getElementById('relatorioDestinatariosLista');
const relatorioConfigsLista = document.getElementById('relatorioConfigsLista');

let sessionId = localStorage.getItem('jarvis_session_id');
if (!sessionId) {
  sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('jarvis_session_id', sessionId);
}

// o header HTTP x-app-password so aceita ByteString (caracteres de 0-255) - se a senha
// guardada tiver algum caractere especial (ex: colada de um lugar com bullet point "•" ou
// outra formatacao), TODO pedido autenticado quebra com um erro criptico de "ByteString" que
// nao diz nada pro usuario. Detecta e limpa isso aqui, na largada, pra sessao se autocurar
// em vez de ficar travada pra sempre nesse estado.
function senhaValida(s) { return /^[\x00-\xFF]*$/.test(s); }

let appPassword = sessionStorage.getItem('jarvis_password') || '';
if (!senhaValida(appPassword)) {
  appPassword = '';
  sessionStorage.removeItem('jarvis_password');
}
let vozAtivada = true;
let gravando = false;
let modoConversa = false;
let aguardandoResposta = false;
let processandoEnvio = false;
let silenceTimer = null;
const PAUSA_TOLERANCIA_MS = 4000; // quanto tempo de silencio aceitar (modo conversa) antes de considerar que a pessoa terminou de falar

// ---------- Relogio ----------

function atualizarRelogio() {
  const agora = new Date();
  clockEl.textContent = agora.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000 * 30);

// ---------- Audio (desbloqueio para autoplay em celular) ----------

let audioCtx = null;
function ensureAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function desbloquearAudio() {
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  document.removeEventListener('pointerdown', desbloquearAudio);
  document.removeEventListener('keydown', desbloquearAudio);
}
document.addEventListener('pointerdown', desbloquearAudio);
document.addEventListener('keydown', desbloquearAudio);

// ---------- Login / Logout ----------
// cada tenant (cliente) faz login com usuario/senha proprios - o servidor devolve um token
// assinado (nao mais a senha em si) que fica guardado em appPassword/sessionStorage e vai no
// mesmo header x-app-password de sempre em toda chamada. Como o header nunca mudou de nome,
// nenhum dos ~40 fetch() espalhados pelo resto deste arquivo precisou mudar - so o que
// acontece AQUI (obter/validar o valor) mudou.

// devolve o token em caso de sucesso, ou null - nunca mais reaproveita a senha digitada como
// se fosse a credencial de toda chamada seguinte
async function tentarEntrar(usuario, senha) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usuario, password: senha }),
  });
  const raw = await res.text();
  try {
    const data = JSON.parse(raw);
    if (!data.ok) return null;
    // ambiente sem SESSION_SECRET configurado (dev local sem Postgres) roda aberto - o
    // servidor devolve {ok:true} sem token, e o middleware la tambem nao exige nada nesse caso
    return data.token || 'sem-auth-configurada';
  } catch {
    return null;
  }
}

// so o dono da Lumia (tenant 1) tem isso true - controla se a aba "Clientes" aparece.
// Preenchido por tokenValido()/mostrarApp() ao consultar /api/me.
let souSuperAdmin = false;

// confirma que o token guardado ainda e valido (nao expirou, tenant continua ativo) - chamado
// no carregamento da pagina, ja que um token velho nao pode mais ser "reenviado como senha"
// pra revalidar como acontecia antes. Aproveita e guarda se esse tenant e super_admin.
async function tokenValido() {
  if (!appPassword) return false;
  try {
    const res = await fetch('/api/me', { headers: { 'x-app-password': appPassword } });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    souSuperAdmin = !!data?.superAdmin;
    return true;
  } catch {
    return false;
  }
}

function mostrarApp() {
  loginScreen.hidden = true;
  appWindow.hidden = false;
  tabBtnClientes.hidden = !souSuperAdmin;
  if (!chatLog.childElementCount) {
    addBubble('Lumia pronta. Digite, aperte o microfone ou ative o modo conversa.', 'system');
  }
  setStatus('pronto', null);
  // o canvas do avatar fica em 0x0 enquanto a tela de login esta visivel (elemento pai
  // hidden) - o ResizeObserver nem sempre pega essa transicao de "escondido -> visivel",
  // entao forca a medicao de novo agora que o app realmente apareceu
  ajustarTamanhoCanvas();
  iniciarPainelSistema();
  iniciarClima();
  testarConexaoAgenteLocal();
}

function sair() {
  pararModoConversa();
  window.speechSynthesis.cancel();
  appPassword = '';
  sessionStorage.removeItem('jarvis_password');
  passwordInput.value = '';
  appWindow.hidden = true;
  loginScreen.hidden = false;
}

logoutBtn.addEventListener('click', sair);

if (appPassword) {
  tokenValido().then((ok) => {
    if (ok) mostrarApp();
    else { appPassword = ''; sessionStorage.removeItem('jarvis_password'); }
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = usernameInput.value;
  const senha = passwordInput.value;
  loginError.textContent = '';
  if (!senhaValida(senha)) {
    loginError.textContent = 'Essa senha tem um caractere invalido (parece colada de algum lugar com formatacao) - tenta digitar direto.';
    return;
  }
  const token = await tentarEntrar(usuario, senha);
  if (!token) {
    loginError.textContent = 'Usuario ou senha incorretos.';
    return;
  }
  appPassword = token;
  sessionStorage.setItem('jarvis_password', token);
  await tokenValido(); // so pra popular souSuperAdmin antes de decidir mostrar a aba "Clientes"
  mostrarApp();
});

// ---------- Anexos (imagem, audio, video) ----------

let anexosPendentes = []; // [{ kind, mediaType, base64, label, thumb }]

function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// reduz fotos grandes (celular tira facil 10-12MB) pra um tamanho razoavel antes de mandar
async function redimensionarImagem(file, maxDim = 1568, qualidade = 0.85) {
  const base64Original = await arquivoParaBase64(file);
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  let { width, height } = img;
  if (width <= maxDim && height <= maxDim && file.size < 4 * 1024 * 1024) {
    return { base64: base64Original, mediaType: file.type || 'image/jpeg' };
  }
  const escala = Math.min(1, maxDim / Math.max(width, height));
  width = Math.round(width * escala);
  height = Math.round(height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
}

// extrai alguns quadros do video (a Lumia nao ouve o audio do video, so ve cenas dele)
function extrairQuadrosDeVideo(file, numQuadros = 3) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = URL.createObjectURL(file);

    const quadros = [];
    let indice = 0;
    let pontos = [];

    function capturarAtual() {
      const canvas = document.createElement('canvas');
      const escala = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      quadros.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      indice += 1;
      if (indice < pontos.length) {
        video.currentTime = pontos[indice];
      } else {
        URL.revokeObjectURL(video.src);
        resolve(quadros);
      }
    }

    video.onloadedmetadata = () => {
      const duracao = video.duration || 0;
      pontos = Array.from({ length: numQuadros }, (_, i) => (duracao * (i + 1)) / (numQuadros + 1));
      video.currentTime = pontos[0] || 0;
    };
    video.onseeked = capturarAtual;
    video.onerror = () => { URL.revokeObjectURL(video.src); reject(new Error('nao consegui ler o video')); };
  });
}

function renderizarPreviewAnexos() {
  attachPreview.innerHTML = '';
  attachPreview.hidden = anexosPendentes.length === 0;
  anexosPendentes.forEach((anexo, i) => {
    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    if (anexo.thumb) {
      const img = document.createElement('img');
      img.src = anexo.thumb;
      chip.appendChild(img);
    }
    const label = document.createElement('span');
    label.textContent = anexo.label;
    chip.appendChild(label);
    const removerBtn = document.createElement('button');
    removerBtn.type = 'button';
    removerBtn.textContent = '✕';
    removerBtn.title = 'Remover';
    removerBtn.addEventListener('click', () => {
      anexosPendentes.splice(i, 1);
      renderizarPreviewAnexos();
    });
    chip.appendChild(removerBtn);
    attachPreview.appendChild(chip);
  });
}

async function adicionarArquivo(file) {
  try {
    if (file.type.startsWith('image/')) {
      const { base64, mediaType } = await redimensionarImagem(file);
      anexosPendentes.push({ kind: 'image', mediaType, base64, label: file.name, thumb: `data:${mediaType};base64,${base64}` });
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const base64 = await arquivoParaBase64(file);
      anexosPendentes.push({ kind: 'document', mediaType: 'application/pdf', base64, label: `📄 ${file.name}` });
    } else if (file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const base64 = await arquivoParaBase64(file);
      anexosPendentes.push({ kind: 'word', mediaType: file.type, base64, label: `📝 ${file.name}` });
    } else if (file.name.toLowerCase().endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const base64 = await arquivoParaBase64(file);
      anexosPendentes.push({ kind: 'excel', mediaType: file.type, base64, label: `📊 ${file.name}` });
    } else if (file.type.startsWith('audio/')) {
      const base64 = await arquivoParaBase64(file);
      anexosPendentes.push({ kind: 'audio', mediaType: file.type || 'audio/mpeg', base64, label: `🎵 ${file.name}` });
    } else if (file.type.startsWith('video/')) {
      setStatus('processando video...', 'thinking');
      const quadros = await extrairQuadrosDeVideo(file);
      quadros.forEach((base64, idx) => {
        anexosPendentes.push({
          kind: 'video_frame',
          mediaType: 'image/jpeg',
          base64,
          label: `🎬 ${file.name} (quadro ${idx + 1})`,
          thumb: `data:image/jpeg;base64,${base64}`,
        });
      });
      setStatus('pronto', null);
    } else {
      addBubble(`Tipo de arquivo nao suportado: ${file.name}`, 'system');
      return;
    }
    renderizarPreviewAnexos();
  } catch (err) {
    addBubble(`Erro ao processar arquivo ${file.name}: ${err.message}`, 'system');
    setStatus('pronto', null);
  }
}

function resumirAnexosParaBolha(anexos) {
  const partes = [];
  const contagemVideo = {};
  for (const a of anexos) {
    if (a.kind === 'image') partes.push(`📷 ${a.label}`);
    else if (a.kind === 'document') partes.push(a.label);
    else if (a.kind === 'word') partes.push(a.label);
    else if (a.kind === 'excel') partes.push(a.label);
    else if (a.kind === 'audio') partes.push(a.label);
    else if (a.kind === 'video_frame') {
      const nomeArquivo = a.label.replace(/^🎬 /, '').replace(/ \(quadro \d+\)$/, '');
      contagemVideo[nomeArquivo] = (contagemVideo[nomeArquivo] || 0) + 1;
    }
  }
  for (const [nome, qtd] of Object.entries(contagemVideo)) {
    partes.push(`🎬 ${nome} (${qtd} quadro${qtd > 1 ? 's' : ''})`);
  }
  return partes.join('\n');
}

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const arquivos = Array.from(fileInput.files || []);
  fileInput.value = '';
  for (const file of arquivos) {
    await adicionarArquivo(file);
  }
});

// ---------- Chat ----------

function setStatus(text, botState) {
  statusEl.textContent = text;
  bot.classList.remove('listening', 'thinking', 'speaking');
  if (botState) bot.classList.add(botState);

  // centraliza a troca pro video de "pensando" aqui (ponto unico por onde passam TODOS os
  // estados) em vez de espalhar chamadas em cada callsite que usa 'thinking' - assim nenhum
  // lugar que precise mostrar "pensando" fica esquecido. "speaking" e de proposito ignorado
  // aqui: quem liga a fala e iniciarFalaVisual() (chamado direto no audio.onplay), que faz o
  // dissolve DIRETO do video de pensando pro de fala - se essa funcao tambem reagisse a
  // 'speaking' voltando pro idle antes, criaria um flash de idle no meio (pensando -> idle ->
  // fala) em vez da transicao unica e continua que foi pedida.
  if (botState === 'thinking') {
    iniciarPensamentoVisual();
  } else if (botState !== 'speaking' && estaPensando()) {
    pararPensamentoVisual();
  }
}

function addBubble(text, kind) {
  const div = document.createElement('div');
  div.className = `bubble ${kind}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

// baixa um arquivo gerado pela Lumia (PDF/Word/Excel/grafico/imagem) - via fetch autenticado
// (com o header de senha do app) em vez de um <a href> direto, porque a API exige esse header
// em toda chamada e um link comum de navegador nao manda header nenhum
async function baixarArquivo(id, nomeArquivo, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Baixando...';
  try {
    const res = await fetch(`/api/arquivos/${id}`, { headers: { 'x-app-password': appPassword } });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.erro || `erro ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    btn.textContent = 'Baixado ✓';
  } catch (err) {
    btn.textContent = textoOriginal;
    btn.disabled = false;
    addBubble(`Nao consegui baixar o arquivo: ${err.message}`, 'system');
  }
}

// anexa um botao real de download na bolha da resposta (nao um link vindo do texto da IA -
// isso nunca depende de renderizar HTML/markdown gerado por ela, so um botao que a gente cria)
function anexarBotaoDownload(bubbleEl, arquivo) {
  const btn = document.createElement('button');
  btn.className = 'botao-download-arquivo';
  btn.textContent = `⬇ Baixar ${arquivo.nomeArquivo}`;
  btn.addEventListener('click', () => baixarArquivo(arquivo.id, arquivo.nomeArquivo, btn));
  bubbleEl.appendChild(document.createElement('br'));
  bubbleEl.appendChild(btn);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// O avatar e um video real (com movimento e boca falando de verdade), gravado em fundo verde
// de estudio de verdade - entao a gente desenha cada quadro num canvas e faz chroma-key: apaga
// (ou suaviza, nas bordas) os pixels onde o verde domina claramente sobre vermelho/azul.
// #bot agora e um <canvas>; os <video> reais ficam escondidos (.bot-source) so fornecendo quadros.
// Tem varios videos de "parada" (poses/movimentos diferentes) que revezam sozinhos de vez em
// quando, e um video de fala. A troca entre qualquer um deles usa um crossfade (dissolve) em
// vez de corte seco, pra disfarcar a mudanca de pose e parecer um movimento continuo.
// duas instancias do MESMO clipe pra cada fase parada (neutro e gesto) - rodam fora de
// sincronia uma da outra, entao alternar entre elas com dissolve (ver POOLS_COM_ANTICORTE)
// evita o corte seco do <video loop> nativo quando uma fase fica em tela mais tempo que a
// duracao natural do clipe (o neutro, por exemplo, fica ate 30s com um clipe de so ~5.7s)
const poolIdleNeutro = [
  document.getElementById('botSrcIdle1a'),
  document.getElementById('botSrcIdle1b'),
];
const poolIdleGesto = [
  document.getElementById('botSrcIdle2a'),
  document.getElementById('botSrcIdle2b'),
];
const videosTalk = [
  document.getElementById('botSrcTalk1'),
  document.getElementById('botSrcTalk2'),
];
const videosPensando = [
  document.getElementById('botSrcPensando1'),
  document.getElementById('botSrcPensando2'),
];
const botCtx = bot.getContext('2d', { willReadFrequently: true });
const offCanvas = document.createElement('canvas');
const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

let videoAtivo = poolIdleNeutro[0];
let transicao = null; // { de, inicio, duracao }
let timerRevezamentoIdle = null;

// quanto o verde precisa dominar (g - max(r,b)) pra contar como fundo. Entre 0 e esse valor
// e zona de transicao (borda) - fica parcialmente transparente e com o verde residual suprimido,
// pra nao sobrar uma auréola verde ao redor do cabelo/ombros (green spill classico de chroma key)
const DOMINANCIA_VERDE_MAX = 24;

function removerFundo(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const dominancia = g - Math.max(r, b);
    if (dominancia <= 0) continue; // verde nao domina - e ela mesma, deixa intacto
    const fator = Math.min(1, dominancia / DOMINANCIA_VERDE_MAX);
    d[i + 3] = Math.round(d[i + 3] * (1 - fator));
    const neutro = (r + b) / 2;
    d[i + 1] = Math.round(g - (g - neutro) * fator);
  }
}

function ajustarTamanhoCanvas() {
  // limita o pixel ratio usado no canvas do avatar - em tela retina/4K (dpr 3+) o canvas real
  // ficava enorme e cada quadro processado pixel a pixel (chave de croma pra tirar o fundo
  // verde) custava muito mais CPU sem ganho visivel nenhum, ja que o avatar ocupa uma area
  // modesta da tela
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = bot.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return; // ainda escondido (tela de login)
  bot.width = Math.max(1, Math.round(rect.width * dpr));
  bot.height = Math.max(1, Math.round(rect.height * dpr));
  offCanvas.width = bot.width;
  offCanvas.height = bot.height;
}
// ResizeObserver pega tanto o resize da janela quanto o momento em que o app deixa de
// estar escondido (tela de login -> app), quando o canvas passa de 0x0 pro tamanho real
new ResizeObserver(ajustarTamanhoCanvas).observe(bot);
ajustarTamanhoCanvas();

// desenha o video "cobrindo" o canvas inteiro (igual object-fit: cover), cortando o excesso
// "contain": encaixa o corpo inteiro dentro do quadro (nunca corta cabeca nem pe), ancorado
// embaixo - sobra espaco vazio nas laterais quando o quadro e mais largo que o corpo, mas
// isso e preferivel a cortar qualquer parte da Lumia (era o que "cover" fazia antes)
function desenharContido(ctx, video, destW, destH) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return false;
  const escala = Math.min(destW / vw, destH / vh);
  const sw = vw * escala, sh = vh * escala;
  const dx = (destW - sw) / 2;
  const dy = destH - sh; // ancora embaixo - fica "de pe" no chao do quadro, nao flutuando
  ctx.clearRect(0, 0, destW, destH);
  ctx.drawImage(video, 0, 0, vw, vh, dx, dy, sw, sh);
  return true;
}

function obterQuadroTratado(ctx, video, w, h) {
  if (!desenharContido(ctx, video, w, h)) return null;
  const frame = ctx.getImageData(0, 0, w, h);
  removerFundo(frame);
  return frame;
}

function misturarQuadros(a, b, t) {
  const out = new ImageData(a.width, a.height);
  const ad = a.data, bd = b.data, od = out.data;
  for (let i = 0; i < od.length; i++) od[i] = Math.round(ad[i] * (1 - t) + bd[i] * t);
  return out;
}

// smoothstep - acelera e desacelera a transicao em vez de andar em velocidade constante,
// fica com uma cadencia mais organica (menos "computador fazendo fade")
function suavizar(t) { return t * t * (3 - 2 * t); }

// dissolve lento (pose parada trocando de outra pose parada) - aqui nao tem pressa, o
// importante e disfarcar a troca de pose, entao um fade mais longo fica mais natural
const DURACAO_CROSSFADE_IDLE_MS = 650;
// quase instantaneo ao COMECAR a falar - a boca precisa aparecer se mexendo NO MESMO frame que
// o audio comeca, nao alguns quadros depois. 120ms parece pouco mas nos primeiros ~100ms desse
// dissolve a tela ainda mostra majoritariamente a pose ANTERIOR (pensando/parada) misturada com
// a de fala - ficava perceptivelmente fora de sincronia com o audio, que ja tinha comecado.
// Com um valor bem menor que 1 quadro de render (~33ms a 30fps), o proprio "t" do dissolve ja
// chega perto de 1 (video de fala quase puro) logo no primeiro quadro renderizado depois da
// troca - dentro da margem de sincronia audio/video considerada imperceptivel (~40ms).
const DURACAO_CROSSFADE_INICIO_FALA_MS = 40;
// dissolve curto no meio de uma resposta longa (troca de um video de fala pro outro, antes
// do loop nativo) - precisa ser rapido pra nao borrar a boca em movimento por muito tempo
const DURACAO_CROSSFADE_LOOP_FALA_MS = 220;

function estaFalando() {
  return videosTalk.includes(videoAtivo);
}

function estaPensando() {
  return videosPensando.includes(videoAtivo);
}

// se chamarem trocarAvatarComTransicao de novo enquanto UMA JA esta rolando (ex: o anti-corte
// do loop trocou de instancia de fala bem no instante em que o audio termina), guarda aqui pra
// disparar assim que a atual terminar - em vez de interromper o dissolve no meio. Interromper
// no meio causava exatamente o "corte sem transicao" reportado: o "de" da nova transicao virava
// o video que AINDA nao tinha acabado de aparecer na tela (so parcialmente visivel no blend),
// entao o proximo quadro pulava desse blend parcial direto pro video cheio, um salto visivel.
let transicaoPendente = null;

// troca pra outro video (parado ou falando) com um dissolve suave em vez de corte seco -
// disfarca a mudanca de pose entre clipes diferentes. A duracao e ajustavel: rapida quando
// precisa sincronizar com audio (comeco da fala), mais lenta quando e so troca de pose parada.
function trocarAvatarComTransicao(novoVideo, duracaoMs = DURACAO_CROSSFADE_IDLE_MS) {
  if (novoVideo === videoAtivo) { transicaoPendente = null; return; }
  if (transicao) {
    transicaoPendente = { novoVideo, duracaoMs };
    return;
  }
  transicao = { de: videoAtivo, inicio: performance.now(), duracaoMs };
  novoVideo.currentTime = 0;
  novoVideo.play().catch(() => {});
  videoAtivo = novoVideo;
}

// pega o proximo video de um "pool" de 2 instancias do MESMO clipe, evitando repetir a
// instancia que acabou de tocar - usado tanto pra variar entre clipes (fala) quanto pra
// alternar entre copias do mesmo clipe fora de sincronia entre si (pensando, poses paradas),
// que e o que da o dissolve suave em vez do corte seco do <video loop> nativo (ver
// POOLS_COM_ANTICORTE/evitarCorteDoLoopNativo logo abaixo)
function criarEscolhedorDePool(pool) {
  let ultimoEscolhido = null;
  return function escolher() {
    const opcoes = pool.filter((v) => v !== ultimoEscolhido);
    const lista = opcoes.length ? opcoes : pool;
    const escolhido = lista[Math.floor(Math.random() * lista.length)];
    ultimoEscolhido = escolhido;
    return escolhido;
  };
}
const escolherVideoTalk = criarEscolhedorDePool(videosTalk);
const escolherVideoPensando = criarEscolhedorDePool(videosPensando);
const escolherVideoIdleNeutro = criarEscolhedorDePool(poolIdleNeutro);
const escolherVideoIdleGesto = criarEscolhedorDePool(poolIdleGesto);

// antecedencia com que troca pra outra instancia do mesmo pool ANTES do video ativo chegar no
// fim do proprio loop - sem isso, qualquer estado que fique em tela mais tempo que a duracao
// natural do clipe (resposta falada longa, "pensando" demorado, ou so ficar parada por 30s com
// um clipe de uns 6s) faria o proprio <video> reiniciar sozinho de corte seco a cada volta.
const ANTECEDENCIA_LOOP_S = 0.5;

// todo pool cujo video ativo precisa desse anti-corte - generico o bastante pra cobrir fala,
// pensando e as duas fases da sequencia parada sem repetir a mesma logica pra cada uma
const POOLS_COM_ANTICORTE = [
  { pool: videosTalk, escolher: escolherVideoTalk, duracaoMs: DURACAO_CROSSFADE_LOOP_FALA_MS },
  { pool: videosPensando, escolher: escolherVideoPensando, duracaoMs: DURACAO_CROSSFADE_LOOP_FALA_MS },
  { pool: poolIdleNeutro, escolher: escolherVideoIdleNeutro, duracaoMs: DURACAO_CROSSFADE_IDLE_MS },
  { pool: poolIdleGesto, escolher: escolherVideoIdleGesto, duracaoMs: DURACAO_CROSSFADE_IDLE_MS },
];

function evitarCorteDoLoopNativo() {
  if (!videoAtivo.duration || (videoAtivo.duration - videoAtivo.currentTime) >= ANTECEDENCIA_LOOP_S) return;
  const entrada = POOLS_COM_ANTICORTE.find((e) => e.pool.includes(videoAtivo));
  if (entrada) trocarAvatarComTransicao(entrada.escolher(), entrada.duracaoMs);
}

// a chave de croma (remocao do fundo verde) e processada pixel a pixel via getImageData -
// rodar isso a 60fps o tempo todo (mesmo com a Lumia parada, so respirando) e o maior peso
// do app na maquina do usuario. 30fps e imperceptivel num avatar com movimento sutil e corta
// pela metade esse custo de CPU/GPU enquanto o app fica aberto.
const FPS_ALVO_AVATAR = 30;
const INTERVALO_QUADRO_MS = 1000 / FPS_ALVO_AVATAR;
let ultimoQuadroEm = 0;

function renderizarQuadro(agora) {
  requestAnimationFrame(renderizarQuadro);
  if (agora - ultimoQuadroEm < INTERVALO_QUADRO_MS) return;
  ultimoQuadroEm = agora;

  const w = bot.width, h = bot.height;
  if (w > 0 && h > 0) {
    if (transicao) {
      const t = suavizar(Math.min(1, (performance.now() - transicao.inicio) / transicao.duracaoMs));
      const quadroDe = obterQuadroTratado(offCtx, transicao.de, w, h);
      const quadroPara = obterQuadroTratado(botCtx, videoAtivo, w, h);
      if (quadroDe && quadroPara) {
        botCtx.putImageData(misturarQuadros(quadroDe, quadroPara, t), 0, 0);
      } else if (quadroPara) {
        botCtx.putImageData(quadroPara, 0, 0);
      }
      if (t >= 1) {
        transicao = null;
        // dissolve atual acabou de resolver limpo (video cheio, sem blend) - so agora e seguro
        // comecar o proximo, se tiver algum esperando (ver transicaoPendente)
        if (transicaoPendente) {
          const { novoVideo, duracaoMs } = transicaoPendente;
          transicaoPendente = null;
          trocarAvatarComTransicao(novoVideo, duracaoMs);
        }
      }
    } else {
      evitarCorteDoLoopNativo();
      if (videoAtivo.readyState >= 2) {
        const quadro = obterQuadroTratado(botCtx, videoAtivo, w, h);
        if (quadro) botCtx.putImageData(quadro, 0, 0);
      }
    }
  }
}
requestAnimationFrame(renderizarQuadro);

// sequencia da Lumia parada (sem interacao) - pedido explicito do usuario, SO esses dois
// movimentos, nessa ordem, sempre: fica parada/seria olhando pra frente por um bom tempo, faz
// UM gesto (o clipe unico que sorri e olha de lado - e uma tomada continua, nao dois clipes
// separados) e volta a ficar parada olhando pra frente. Nunca mais que isso (nada de gesto de
// apontar - videosIdle3 continua fora da rotacao, como ja era antes). duracaoMs do gesto e
// menor que a duracao natural do proprio clipe (~6.2s) de proposito: garante que ele sempre
// toca so UMA vez, inteiro, antes de voltar pro neutro - nunca reinicia sozinho no meio.
const SEQUENCIA_IDLE = [
  { pool: poolIdleNeutro, escolher: escolherVideoIdleNeutro, duracaoMs: 30000 }, // parada, seria, olhando pra frente
  { pool: poolIdleGesto, escolher: escolherVideoIdleGesto, duracaoMs: 5000 }, // sorri e olha de lado, um play-through so
];
let indiceSequenciaIdle = 0;

function agendarProximoRevezamentoIdle() {
  clearTimeout(timerRevezamentoIdle);
  const fase = SEQUENCIA_IDLE[indiceSequenciaIdle];
  const variacao = 0.9 + Math.random() * 0.2; // +-10%, pra nao ficar cronometrado igual robo
  timerRevezamentoIdle = setTimeout(() => {
    // esta falando ou pensando - tenta de novo depois, nao interrompe pra trocar de pose parada
    if (estaFalando() || estaPensando()) { agendarProximoRevezamentoIdle(); return; }
    indiceSequenciaIdle = (indiceSequenciaIdle + 1) % SEQUENCIA_IDLE.length;
    trocarAvatarComTransicao(SEQUENCIA_IDLE[indiceSequenciaIdle].escolher());
    agendarProximoRevezamentoIdle();
  }, fase.duracaoMs * variacao);
}
agendarProximoRevezamentoIdle();

function iniciarFalaVisual() {
  clearTimeout(timerRevezamentoIdle);
  // transicao rapida aqui - a boca precisa comecar a se mexer junto com o audio, nao depois.
  // se ela ja estava no video de "pensando", esse dissolve vai DIRETO de pensando pra fala
  // (nunca passa pelo idle no meio), porque trocarAvatarComTransicao so olha pro video ativo
  // agora, nao pro estado logico anterior
  trocarAvatarComTransicao(escolherVideoTalk(), DURACAO_CROSSFADE_INICIO_FALA_MS);
}

// usado tanto ao sair da fala quanto ao sair do "pensando" sem chegar a falar (resposta so em
// texto, erro, voz desligada) - sempre volta pra fase atual da sequencia idle (nao pula
// aleatoriamente), mantendo o ritmo previsivel
function voltarParaIdleVisual() {
  clearTimeout(timerRevezamentoIdle);
  trocarAvatarComTransicao(SEQUENCIA_IDLE[indiceSequenciaIdle].escolher());
  agendarProximoRevezamentoIdle();
}

function pararFalaVisual() {
  voltarParaIdleVisual();
}

function iniciarPensamentoVisual() {
  clearTimeout(timerRevezamentoIdle);
  trocarAvatarComTransicao(escolherVideoPensando(), DURACAO_CROSSFADE_IDLE_MS);
}

function pararPensamentoVisual() {
  voltarParaIdleVisual();
}

// so um audio por vez - qualquer fala nova cancela a anterior, pra nao atropelar
let audioAtual = null;

function base64ParaBlob(base64, tipo) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

// revela o texto na bolha em sincronia com o audio, usando o alinhamento de caracteres
// que o servidor devolve (estimado a partir da duracao real do audio gerado)
let legendaRAF = null;
function legendarProgressivo(audio, bubbleEl, characters, starts) {
  cancelAnimationFrame(legendaRAF);
  function atualizar() {
    const t = audio.currentTime;
    let idx = 0;
    while (idx < starts.length && starts[idx] <= t) idx++;
    bubbleEl.textContent = characters.slice(0, idx).join('');
    chatLog.scrollTop = chatLog.scrollHeight;
    if (!audio.paused && !audio.ended) legendaRAF = requestAnimationFrame(atualizar);
  }
  atualizar();
}

function pararLegenda(bubbleEl, textoCompleto) {
  if (legendaRAF) cancelAnimationFrame(legendaRAF);
  legendaRAF = null;
  if (bubbleEl) bubbleEl.textContent = textoCompleto;
}

async function falarComVozNatural(texto, bubbleEl) {
  // sem isso, o intervalo entre a resposta chegar (bolha "pensando" ja some antes daqui) e o
  // audio comecar a tocar ficava com a tela parada, sem feedback nenhum - parecia travado
  // mesmo quando o Kokoro so estava demorando um pouco (VPS sob carga)
  mostrarBolhaStatus('gerando_audio', 'Gerando audio...');
  let res;
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ text: texto }),
    });
  } finally {
    removerBolhaStatus();
  }
  if (!res.ok) throw new Error('tts indisponivel');
  const data = await res.json();
  if (!data.audio || !data.alignment) throw new Error('tts sem alinhamento');
  // texto normalizado (ex: "R$" -> "Real", "14h" -> "14 horas") que foi de fato falado - usa
  // ele na legenda final tambem, senao ela mostraria isso durante a fala e "pularia" de volta
  // pro texto original no instante em que o audio termina
  const textoFalado = data.textoFalado || texto;

  if (audioAtual) { audioAtual.pause(); audioAtual = null; }

  const blob = base64ParaBlob(data.audio, 'audio/mpeg');
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audioAtual = audio;

  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const source = ctx.createMediaElementSource(audio);
  source.connect(ctx.destination);

  const characters = data.alignment.characters || [];
  const starts = data.alignment.character_start_times_seconds || [];

  await new Promise((resolve) => {
    let timeoutSeguranca = null;
    audio.onplay = () => {
      clearTimeout(timeoutSeguranca);
      setStatus('falando', 'speaking');
      iniciarFalaVisual();
      if (bubbleEl) legendarProgressivo(audio, bubbleEl, characters, starts);
    };
    const finalizar = () => {
      clearTimeout(timeoutSeguranca);
      pararFalaVisual();
      pararLegenda(bubbleEl, textoFalado);
      URL.revokeObjectURL(url);
      if (audioAtual === audio) audioAtual = null;
      resolve();
    };
    audio.onended = finalizar;
    audio.onerror = finalizar;
    audio.play().catch(finalizar);
    // se o <audio> nunca disparar "ended" (aba em segundo plano, engasgo do SO etc), o modo
    // conversa ficava esperando pra sempre sem nunca voltar a ouvir - rede de seguranca com
    // folga generosa (duracao estimada do audio, com minimo de 6s)
    timeoutSeguranca = setTimeout(finalizar, Math.max(6000, (starts[starts.length - 1] || 0) * 1000 + 4000));
  });
}


// fala a resposta revelando o texto em sincronia; se o modo conversa estiver ativo, so
// volta a ouvir depois de terminar
async function falar(texto, bubbleEl) {
  if (vozAtivada && texto) {
    try {
      await falarComVozNatural(texto, bubbleEl);
    } catch (err) {
      // a voz definitiva da Lumia e a Kokoro (auto-hospedada na VPS) - uma falha aqui costuma
      // ser um engasgo passageiro (o container reiniciando, por exemplo), entao tenta mais
      // uma vez antes de desistir, em vez de cair direto pra voz robotica do navegador. O
      // usuario pediu explicitamente pra nunca trocar de voz no meio da conversa - preferimos
      // ficar so em texto dessa vez a soar diferente dela mesma.
      console.warn('Voz da Kokoro falhou na 1a tentativa, tentando de novo:', err);
      try {
        await new Promise((r) => setTimeout(r, 500));
        await falarComVozNatural(texto, bubbleEl);
      } catch (err2) {
        console.warn('Voz da Kokoro falhou de novo, ficando so em texto (sem cair pra voz robotica):', err2);
        addBubble(`Voz indisponivel no momento (${err2.message}). A resposta acima ficou so em texto.`, 'system');
        if (bubbleEl) bubbleEl.textContent = texto;
      }
    }
  } else if (bubbleEl) {
    bubbleEl.textContent = texto;
  }
  setStatus('pronto', null);
  aguardandoResposta = false;
  if (modoConversa) setTimeout(ouvirSegmento, 350);
}

// ---------- Agente local (controle do computador) ----------
// o agente roda SO na maquina do usuario, escutando so em 127.0.0.1 - o navegador (aqui)
// e quem fala com ele, nunca o servidor na nuvem. Por isso so funciona enquanto essa aba
// esta aberta no PC de verdade, mesmo que a senha do site vaze pra alguem de fora.
const LOCAL_AGENT_URL = 'http://127.0.0.1:5391';

function obterTokenAgenteLocal() {
  return localStorage.getItem('lumia_agent_token') || '';
}

// controle de abas (abrir aba nova, mudar de aba) fica desligado por padrao, mesmo com o
// agente local conectado - o usuario pediu um botao a parte pra ligar/desligar isso quando
// quiser, sem depender so de estar/nao estar com o agente rodando
const TOOLS_CONTROLE_ABAS = new Set(['pc_abrir_aba', 'pc_mudar_aba']);
function controleAbasAtivado() {
  return localStorage.getItem('lumia_controle_abas') === '1';
}

const PC_ENDPOINTS = {
  pc_abrir_app: { path: '/abrir-app', montar: (i) => ({ nome: i.nome }) },
  pc_fechar_app: { path: '/fechar-app', montar: (i) => ({ nome: i.nome }) },
  pc_abrir_arquivo: { path: '/abrir-arquivo', montar: (i) => ({ caminho: i.caminho }) },
  pc_ler_arquivo: { path: '/ler-arquivo', montar: (i) => ({ caminho: i.caminho }) },
  pc_listar_pasta: { path: '/listar-pasta', montar: (i) => ({ caminho: i.caminho }) },
  pc_criar_arquivo: { path: '/criar-arquivo', montar: (i) => ({ caminho: i.caminho, conteudo: i.conteudo }) },
  pc_editar_arquivo: { path: '/editar-arquivo', montar: (i) => ({ caminho: i.caminho, conteudo: i.conteudo }) },
  pc_apagar_arquivo: { path: '/apagar-arquivo', montar: (i) => ({ caminho: i.caminho }) },
  pc_listar_favoritos: { path: '/favoritos', montar: () => ({}) },
  pc_listar_abas_navegador: { path: '/abas', montar: () => ({}) },
  pc_abrir_aba: { path: '/abrir-aba', montar: (i) => ({ url: i.url }) },
  pc_mudar_aba: { path: '/mudar-aba', montar: (i) => ({ termo: i.termo }) },
};

async function executarAcaoLocal(tool, input) {
  // ver_camera roda direto no navegador (getUserMedia) - nao passa pelo agente local, entao
  // nem precisa do token dele configurado
  if (tool === 'ver_camera') {
    try {
      const imagemBase64 = await capturarFrameCamera();
      return { imagemBase64, mediaType: 'image/jpeg' };
    } catch (err) {
      return { erro: `Nao consegui acessar a camera: ${err.message}` };
    }
  }

  if (TOOLS_CONTROLE_ABAS.has(tool) && !controleAbasAtivado()) {
    return { erro: 'Controle de abas do navegador esta desativado. Ative o botao "Controle de abas do navegador" no painel do agente (icone de computador) se quiser que eu faca isso.' };
  }

  const token = obterTokenAgenteLocal();
  if (!token) {
    return { erro: 'O agente local nao esta configurado neste navegador. Abre o icone de computador no topo, roda "npm run local-agent" no seu PC e cola o token que aparecer.' };
  }
  const endpoint = PC_ENDPOINTS[tool];
  if (!endpoint) return { erro: `Acao desconhecida: ${tool}` };

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15000);
  try {
    const res = await fetch(LOCAL_AGENT_URL + endpoint.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': token },
      body: JSON.stringify(endpoint.montar(input)),
      signal: controlador.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { erro: (data && data.erro) || `agente local respondeu ${res.status}` };
    return data;
  } catch (err) {
    return { erro: `Nao consegui falar com o agente local no seu computador (${err.message}). Confirma que ele esta ligado (npm run local-agent) e que voce esta usando o app neste mesmo PC.` };
  } finally {
    clearTimeout(timer);
  }
}

async function testarConexaoAgenteLocal() {
  const token = obterTokenAgenteLocal();
  if (!token) { agentDot.classList.remove('conectado'); agentStatus.classList.remove('conectado'); agentStatus.textContent = 'Nao conectado.'; return; }
  try {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), 4000);
    const res = await fetch(`${LOCAL_AGENT_URL}/ping`, { headers: { 'x-agent-token': token }, signal: controlador.signal });
    clearTimeout(timer);
    if (res.ok) {
      agentDot.classList.add('conectado');
      agentStatus.classList.add('conectado');
      agentStatus.textContent = 'Conectado - a Lumia ja pode controlar este computador.';
    } else {
      throw new Error('token invalido');
    }
  } catch {
    agentDot.classList.remove('conectado');
    agentStatus.classList.remove('conectado');
    agentStatus.textContent = 'Nao conectado - confirma que o agente esta rodando (npm run local-agent) e que o token esta certo.';
  }
}

agentBtn.addEventListener('click', () => {
  agentPanel.hidden = !agentPanel.hidden;
  if (!agentPanel.hidden) {
    agentTokenInput.value = obterTokenAgenteLocal();
    testarConexaoAgenteLocal();
    controleAbasToggle.checked = controleAbasAtivado();
  }
});
controleAbasToggle.addEventListener('change', () => {
  localStorage.setItem('lumia_controle_abas', controleAbasToggle.checked ? '1' : '0');
});
agentPanelClose.addEventListener('click', () => { agentPanel.hidden = true; });
agentSaveBtn.addEventListener('click', () => {
  localStorage.setItem('lumia_agent_token', agentTokenInput.value.trim());
  testarConexaoAgenteLocal();
});

// ---------- Indicador de status "ao vivo" na janela de conversa ----------
// enquanto espera a resposta de /api/chat (que pode levar um tempo se a Lumia estiver
// rodando varias ferramentas em sequencia), mostra uma bolha na propria janela de conversa
// com o que ela esta fazendo agora (pensando, calculando, transcrevendo audio, executando
// uma acao...), via polling num endpoint leve que so le um status em RAM no servidor.
let statusBubbleEl = null;
let statusPollTimer = null;

const ICONES_STATUS = {
  pensando: '🧠',
  executando: '⚙️',
  calculando: '🧮',
  transcrevendo: '🎙️',
  lendo_arquivo: '📄',
  gerando_arquivo: '📄',
  gerando_audio: '🔊',
};

function mostrarBolhaStatus(estado, detalhe) {
  if (!statusBubbleEl) {
    statusBubbleEl = document.createElement('div');
    statusBubbleEl.className = 'bubble assistant status-bubble';
    chatLog.appendChild(statusBubbleEl);
  }
  const icone = ICONES_STATUS[estado] || '💭';
  statusBubbleEl.innerHTML = `<span class="status-bubble-icone">${icone}</span><span class="status-bubble-texto">${detalhe || 'Trabalhando nisso...'}</span><span class="status-bubble-pontos"><span></span><span></span><span></span></span>`;
  chatLog.scrollTop = chatLog.scrollHeight;
}

function removerBolhaStatus() {
  if (statusBubbleEl) {
    statusBubbleEl.remove();
    statusBubbleEl = null;
  }
}

function iniciarPollingStatus() {
  pararPollingStatus();
  mostrarBolhaStatus('pensando', 'Pensando na resposta...');
  statusPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/chat/status?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { 'x-app-password': appPassword },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.estado) mostrarBolhaStatus(data.estado, data.detalhe);
    } catch {
      // e so um indicador visual - uma falha no polling nao pode travar o fluxo principal
    }
  }, 700);
}

function pararPollingStatus() {
  if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }
  removerBolhaStatus();
}

async function enviarMensagem(texto) {
  const textoLimpo = (texto || '').trim();
  const anexos = anexosPendentes;
  if ((!textoLimpo && anexos.length === 0) || processandoEnvio) return;
  processandoEnvio = true;
  aguardandoResposta = true;
  clearTimeout(silenceTimer);

  anexosPendentes = [];
  renderizarPreviewAnexos();

  const resumoAnexos = anexos.length ? resumirAnexosParaBolha(anexos) : '';
  const textoBolha = textoLimpo && resumoAnexos ? `${textoLimpo}\n${resumoAnexos}` : (textoLimpo || resumoAnexos);
  addBubble(textoBolha, 'user');
  textInput.value = '';
  ajustarAlturaTextInput();
  setStatus('pensando', 'thinking');
  iniciarPollingStatus();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        message: textoLimpo,
        sessionId,
        attachments: anexos.map(({ kind, mediaType, base64, label }) => ({ kind, mediaType, base64, label })),
      }),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Servidor respondeu algo inesperado (status ${res.status}). Tenta de novo em alguns segundos.`);
    }
    if (!res.ok) throw new Error(data.erro || 'Erro desconhecido');

    registrarComando();
    let resultado = data;
    // enquanto o servidor pedir uma acao no computador, executa aqui (via agente local) e
    // manda o resultado de volta - pode encadear mais de uma (ex: ler um arquivo, editar ele)
    while (resultado.localAction) {
      const resultadoLocal = await executarAcaoLocal(resultado.localAction.tool, resultado.localAction.input);
      const res2 = await fetch('/api/local-action-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ sessionId, resultado: resultadoLocal }),
      });
      const raw2 = await res2.text();
      let data2;
      try {
        data2 = JSON.parse(raw2);
      } catch {
        throw new Error(`Servidor respondeu algo inesperado (status ${res2.status}). Tenta de novo em alguns segundos.`);
      }
      if (!res2.ok) throw new Error(data2.erro || 'Erro desconhecido');
      resultado = data2;
    }

    pararPollingStatus();
    const bubble = addBubble('', 'assistant');
    await falar(resultado.reply, bubble);
    if (resultado.arquivo) anexarBotaoDownload(bubble, resultado.arquivo);
  } catch (err) {
    pararPollingStatus();
    addBubble(`Erro: ${err.message}`, 'system');
    setStatus('erro', null);
    aguardandoResposta = false;
    if (modoConversa) setTimeout(ouvirSegmento, 800);
  } finally {
    processandoEnvio = false;
    pararPollingStatus();
  }
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarMensagem(textInput.value);
});

// campo agora e um textarea multi-linha que cresce com o texto digitado (era um input de 1
// linha so, dificil de ver mensagens maiores) - Enter continua enviando, Shift+Enter quebra
// linha, igual WhatsApp/apps de chat em geral
function ajustarAlturaTextInput() {
  textInput.style.height = 'auto';
  textInput.style.height = `${textInput.scrollHeight}px`;
}
textInput.addEventListener('input', ajustarAlturaTextInput);
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

clearBtn.addEventListener('click', async () => {
  chatLog.innerHTML = '';
  // apaga de verdade no servidor (Postgres), nao so visualmente - senao a conversa "esquecida"
  // reaparecia sozinha na proxima mensagem, porque o historico continuaria salvo la
  try {
    await fetch('/api/session/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ sessionId }),
    });
  } catch (err) {
    console.warn('Nao consegui confirmar a limpeza no servidor:', err);
  }
  addBubble('Conversa limpa. Pode continuar de onde quiser.', 'system');
});

extractBtn.addEventListener('click', () => {
  const linhas = Array.from(chatLog.querySelectorAll('.bubble')).map((b) => {
    const quem = b.classList.contains('user') ? 'Voce' : b.classList.contains('assistant') ? 'Lumia' : 'Sistema';
    return `${quem}: ${b.textContent}`;
  });
  const blob = new Blob([linhas.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lumia-conversa-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Voz: gravacao + transcricao no servidor ----------
// A Web Speech API (webkitSpeechRecognition) nao existe no Safari/iPhone (nem no Chrome de
// iOS, que por exigencia da Apple usa o motor do Safari por baixo) - o microfone simplesmente
// nao funcionava em celular Apple. Em vez de depender do reconhecimento de voz do navegador,
// gravamos o audio de verdade (MediaRecorder, suportado em qualquer navegador/dispositivo
// moderno) e mandamos pro nosso servidor transcrever (Gemini) - funciona igual em todo lugar.

const gravacaoSuportada = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let vadCtx = null;
let vadRAF = null;
let vadSource = null;
let vadAnalyser = null;
let vadFailsafeTimer = null;
const VOLUME_MINIMO_FALA = 12; // 0-255 (media de frequencia) - piso minimo do limiar de fala, mesmo apos calibrar
// se passar tanto tempo assim sem detectar NENHUMA fala, reinicia sozinho o segmento de escuta
// - antes disso, se o limiar de voz nunca disparasse (ambiente muito quieto, microfone com
// ganho baixo etc), o modo conversa ficava "ouvindo" pra sempre sem nunca fazer nada, o que
// parecia (e na pratica era) o modo conversa simplesmente nao funcionando
const SILENCIO_MAXIMO_SEM_FALAR_MS = 20000;

async function pedirMicrofone() {
  if (micStream && micStream.active) return micStream;
  // em alguns navegadores/SOs o pedido de permissao do microfone simplesmente nunca resolve
  // nem da erro (nao aparece prompt nenhum, ou fica pendurado) - sem esse limite, o modo
  // conversa ficava com o botao aceso pra sempre sem nunca comecar a ouvir de verdade
  const semResposta = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('o navegador nao respondeu ao pedido de microfone a tempo')), 10000);
  });
  micStream = await Promise.race([navigator.mediaDevices.getUserMedia({ audio: true }), semResposta]);
  return micStream;
}

function escolherMimeTypeGravacao() {
  const candidatos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidatos.find((tipo) => window.MediaRecorder && MediaRecorder.isTypeSupported(tipo)) || '';
}

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcreverAudio(blob, mimeType) {
  const base64 = await blobParaBase64(blob);
  // sem limite de tempo aqui, uma trava no servidor (Whisper sobrecarregado, rede ruim etc)
  // deixava o modo conversa parado pra sempre em "transcrevendo..." sem nunca dar erro nem
  // voltar a ouvir - o servidor tenta Groq (15s) e, se falhar, cai pro Whisper auto-hospedado
  // (35s, ver WHISPER_TIMEOUT_MS em whisper.js) antes de desistir de vez - esse timeout aqui
  // tem que ser MAIOR que a soma dos dois, senao o frontend desiste primeiro e mostra "demorou
  // demais" mesmo quando o servidor teria respondido poucos segundos depois.
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 55000);
  let res;
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ audioBase64: base64, mediaType: mimeType }),
      signal: controlador.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('demorou demais pra transcrever, tenta de novo');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erro || 'erro na transcricao');
  return (data.text || '').trim();
}

// so usado no modo conversa: monitora o volume do microfone pra saber sozinho quando a
// pessoa parou de falar (no modo de toque unico, quem decide e o proprio usuario clicando de novo)
async function monitorarSilencio(stream, aoParar) {
  const ctx = ensureAudioContext();
  // sem isso, se o contexto ainda estiver suspenso (comum ate um gesto "de audio" liberar),
  // o analisador so le silencio pra sempre - a gravacao fica esperando sem nunca detectar
  // fala e nunca envia nada, o que parecia "o modo conversa nao funciona"
  if (ctx.state === 'suspended') await ctx.resume();
  vadCtx = ctx;
  // cria (e guarda pra desconectar depois em pararMonitorSilencio) um novo par source/analyser
  // a cada segmento de escuta - sem desconectar o anterior, cada rodada do modo conversa
  // deixava mais nos de audio pendurados no mesmo AudioContext pra sempre (vazamento que ia
  // deixando o navegador mais pesado quanto mais tempo a conversa continua ficava aberta)
  vadSource = ctx.createMediaStreamSource(stream);
  vadAnalyser = ctx.createAnalyser();
  vadAnalyser.fftSize = 512;
  vadSource.connect(vadAnalyser);

  const dataArray = new Uint8Array(vadAnalyser.frequencyBinCount);
  let falouAlgumaVez = false;

  // calibra o "ruido da sala" nos primeiros ~300ms antes de comecar a detectar fala de
  // verdade - assim o limiar se adapta ao microfone/ambiente de cada usuario, em vez de um
  // numero fixo que funciona numa maquina e nunca dispara em outra (ganho de mic baixo,
  // ruido de fundo diferente etc) - essa era a causa mais provavel do modo conversa parecer
  // travado: ela escutava, mas o limiar fixo nunca cruzava e nada acontecia
  const CALIBRACAO_FRAMES = 18; // ~300ms a 60fps
  let framesCalibracao = 0;
  let somaCalibracao = 0;
  let limiarFala = VOLUME_MINIMO_FALA;

  vadFailsafeTimer = setTimeout(() => { if (!falouAlgumaVez) aoParar(false); }, SILENCIO_MAXIMO_SEM_FALAR_MS);

  function checar() {
    vadAnalyser.getByteFrequencyData(dataArray);
    const media = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;

    if (framesCalibracao < CALIBRACAO_FRAMES) {
      framesCalibracao++;
      somaCalibracao += media;
      if (framesCalibracao === CALIBRACAO_FRAMES) {
        const ruidoDeFundo = somaCalibracao / CALIBRACAO_FRAMES;
        limiarFala = Math.min(45, Math.max(VOLUME_MINIMO_FALA, ruidoDeFundo * 1.8 + 6));
      }
      vadRAF = requestAnimationFrame(checar);
      return;
    }

    if (media > limiarFala) {
      falouAlgumaVez = true;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => { clearTimeout(vadFailsafeTimer); aoParar(falouAlgumaVez); }, PAUSA_TOLERANCIA_MS);
    }
    vadRAF = requestAnimationFrame(checar);
  }
  checar();
}

function pararMonitorSilencio() {
  if (vadRAF) cancelAnimationFrame(vadRAF);
  vadRAF = null;
  clearTimeout(silenceTimer);
  clearTimeout(vadFailsafeTimer);
  vadFailsafeTimer = null;
  if (vadSource) { try { vadSource.disconnect(); } catch { /* ja desconectado */ } vadSource = null; }
  if (vadAnalyser) { try { vadAnalyser.disconnect(); } catch { /* ja desconectado */ } vadAnalyser = null; }
}

async function iniciarGravacao(comDeteccaoSilencio) {
  const stream = await pedirMicrofone();
  const mimeType = escolherMimeTypeGravacao();
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

  gravando = true;
  micBtn.classList.add('active');
  setStatus(modoConversa ? 'ouvindo (modo conversa)' : 'ouvindo...', 'listening');
  mediaRecorder.start();

  if (comDeteccaoSilencio) {
    monitorarSilencio(stream, (falouAlgumaVez) => {
      if (falouAlgumaVez) pararGravacaoEEnviar();
      else { pararGravacaoSemEnviar(); if (modoConversa) setTimeout(ouvirSegmento, 120); }
    });
  }
}

function pararGravacaoSemEnviar() {
  pararMonitorSilencio();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => { gravando = false; micBtn.classList.remove('active'); };
    mediaRecorder.stop();
  } else {
    gravando = false;
    micBtn.classList.remove('active');
  }
}

async function pararGravacaoEEnviar() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  pararMonitorSilencio();
  const mimeTypeGravado = mediaRecorder.mimeType || 'audio/webm';

  const texto = await new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      gravando = false;
      micBtn.classList.remove('active');
      if (audioChunks.length === 0) return resolve('');
      const blob = new Blob(audioChunks, { type: mimeTypeGravado });
      setStatus('transcrevendo...', 'thinking');
      try {
        resolve(await transcreverAudio(blob, mimeTypeGravado));
      } catch (err) {
        addBubble(`Nao consegui transcrever o audio: ${err.message}`, 'system');
        resolve('');
      }
    };
    mediaRecorder.stop();
  });

  if (texto) {
    enviarMensagem(texto);
  } else {
    setStatus('pronto', null);
    if (modoConversa) setTimeout(ouvirSegmento, 300);
  }
}

function ouvirSegmento() {
  if (!gravacaoSuportada || gravando || aguardandoResposta) return;
  iniciarGravacao(modoConversa).catch((err) => {
    addBubble(`Nao consegui acessar o microfone: ${err.message}`, 'system');
    if (modoConversa) pararModoConversa();
    else setStatus('pronto', null);
  });
}

if (!gravacaoSuportada) {
  micBtn.title = 'Microfone nao suportado neste navegador';
  micBtn.style.opacity = '0.35';
  convBtn.style.opacity = '0.35';
}

micBtn.addEventListener('click', () => {
  if (!gravacaoSuportada) return;
  if (modoConversa) { pararModoConversa(); return; }
  if (gravando) { pararGravacaoEEnviar(); return; }
  if (audioAtual) audioAtual.pause();
  window.speechSynthesis.cancel();
  ouvirSegmento();
});

function iniciarModoConversa() {
  if (!gravacaoSuportada) return;
  modoConversa = true;
  aguardandoResposta = false;
  convBtn.classList.add('active');
  hintEl.textContent = 'Modo conversa ativo - pode falar quando quiser';
  addBubble('Modo conversa ativado - pode falar, eu escuto e ja respondo sozinha.', 'system');
  ouvirSegmento();
}

function pararModoConversa() {
  modoConversa = false;
  aguardandoResposta = false;
  pararGravacaoSemEnviar();
  convBtn.classList.remove('active');
  hintEl.textContent = 'Aperte o microfone ou digite abaixo';
  setStatus('pronto', null);
}

convBtn.addEventListener('click', () => {
  if (modoConversa) pararModoConversa();
  else iniciarModoConversa();
});

muteBtn.addEventListener('click', () => {
  vozAtivada = !vozAtivada;
  muteBtn.textContent = vozAtivada ? '🔊' : '🔇';
  if (!vozAtivada) { window.speechSynthesis.cancel(); pararFalaVisual(); }
});

// ---------- Painel: System Stats + Uptime ----------
// dados reais do proprio servidor (CPU/RAM/disco da VPS, comandos processados) - nada
// inventado. O contador de comandos e por sessao de navegador (zera se recarregar a pagina),
// o resto vem direto do /api/system-stats.

let comandosNestaSessao = 0;
function registrarComando() {
  comandosNestaSessao++;
  commandsValue.textContent = String(comandosNestaSessao);
}

function corMedidor(elemento, percentual) {
  elemento.classList.toggle('silver', percentual < 55);
}

async function atualizarStatsSistema() {
  try {
    const res = await fetch('/api/system-stats', { headers: { 'x-app-password': appPassword } });
    if (!res.ok) return;
    const d = await res.json();

    cpuValue.textContent = `${d.cpuPercent}%`;
    cpuMini.textContent = `${d.cpuPercent}%`;
    cpuBar.style.width = `${d.cpuPercent}%`;
    corMedidor(cpuBar, d.cpuPercent);

    ramValue.textContent = `${d.ram.usadoGB} GB`;
    ramMini.textContent = `${d.ram.percentual}%`;
    ramBar.style.width = `${d.ram.percentual}%`;
    corMedidor(ramBar, d.ram.percentual);

    diskMini.textContent = d.disco ? `${d.disco.usadoGB}/${d.disco.totalGB}GB` : 'N/D';

    loadBar.style.width = `${d.cpuPercent}%`;
    corMedidor(loadBar, d.cpuPercent);
    loadLabel.textContent = d.cpuPercent < 30 ? 'Idle' : d.cpuPercent < 70 ? 'Moderate' : 'High';

    sessionValue.textContent = String(d.sessoesAtivas || 1);

    const h = Math.floor(d.uptimeSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((d.uptimeSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(d.uptimeSegundos % 60).toString().padStart(2, '0');
    uptimeBig.textContent = `${h}:${m}:${s}`;
    uptimeLive.textContent = `${h}:${m}:${s}`;
  } catch {
    // painel decorativo em cima de dados reais - se a rede falhar por um instante, so
    // mantem o ultimo valor na tela em vez de quebrar a interface com erro visivel
  }
}

function iniciarPainelSistema() {
  atualizarStatsSistema();
  setInterval(atualizarStatsSistema, 5000);
  statsRefresh.addEventListener('click', atualizarStatsSistema);
}

// ---------- Painel: Weather ----------
// Open-Meteo (previsao) + BigDataCloud (geocodificacao reversa) - as duas sao gratuitas e
// nao exigem chave de API. Pede a localizacao real do navegador; se o usuario negar, cai
// pra Maceio/AL (onde fica a clinica) em vez de travar o painel sem dado nenhum.
const MACEIO_FALLBACK = { lat: -9.6498, lon: -35.7089, nome: 'Maceió, AL' };

const CODIGOS_TEMPO = {
  0: 'Ceu limpo', 1: 'Predominante limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Neblina', 48: 'Neblina com geada', 51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa forte',
  61: 'Chuva fraca', 63: 'Chuva', 65: 'Chuva forte', 71: 'Neve fraca', 73: 'Neve',
  75: 'Neve forte', 80: 'Pancadas de chuva', 81: 'Pancadas de chuva', 82: 'Pancadas fortes',
  95: 'Tempestade', 96: 'Tempestade com granizo', 99: 'Tempestade forte',
};

async function buscarClima(lat, lon, nomeLocal) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code`;
    const res = await fetch(url);
    const d = await res.json();
    const c = d.current;
    if (!c) return;

    const temp = Math.round(c.temperature_2m);
    weatherTemp.textContent = `${temp}°C`;
    weatherBadgeTemp.textContent = `${temp}°`;
    weatherBadge.hidden = false;
    weatherPlace.textContent = nomeLocal;
    weatherCond.textContent = CODIGOS_TEMPO[c.weather_code] || '';
    weatherHumidity.textContent = `${Math.round(c.relative_humidity_2m)}%`;
    weatherWind.textContent = `${c.wind_speed_10m.toFixed(1)} m/s`;
    weatherFeels.textContent = `${Math.round(c.apparent_temperature)}°C`;
  } catch {
    weatherPlace.textContent = 'Indisponivel';
  }
}

async function nomeDaLocalizacao(lat, lon) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`);
    const d = await res.json();
    const cidade = d.city || d.locality || d.principalSubdivision;
    return cidade ? `${cidade}${d.principalSubdivision ? ', ' + d.principalSubdivisionCode?.split('-')[1] || '' : ''}` : MACEIO_FALLBACK.nome;
  } catch {
    return MACEIO_FALLBACK.nome;
  }
}

async function obterClimaLocal() {
  if (!navigator.geolocation) {
    return buscarClima(MACEIO_FALLBACK.lat, MACEIO_FALLBACK.lon, MACEIO_FALLBACK.nome);
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const nome = await nomeDaLocalizacao(latitude, longitude);
      buscarClima(latitude, longitude, nome);
    },
    () => buscarClima(MACEIO_FALLBACK.lat, MACEIO_FALLBACK.lon, MACEIO_FALLBACK.nome),
    { timeout: 8000 },
  );
}

function iniciarClima() {
  obterClimaLocal();
  setInterval(obterClimaLocal, 15 * 60 * 1000); // a cada 15min - clima nao muda rapido
  weatherRefresh.addEventListener('click', obterClimaLocal);
}

// ---------- Painel: Camera ----------
// preview da webcam local, independente do microfone/gravacao de audio - so um toggle
// liga/desliga, sem gravar nem mandar nada pra lugar nenhum.
let cameraStream = null;

async function ligarCamera() {
  if (cameraStream) return cameraStream;
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  cameraVideo.srcObject = cameraStream;
  cameraVideo.hidden = false;
  cameraOffMsg.hidden = true;
  cameraHint.textContent = 'Camera ativa - fica so localmente, nada e enviado.';
  cameraToggle.classList.add('active');
  return cameraStream;
}

cameraToggle.addEventListener('click', async () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
    cameraVideo.hidden = true;
    cameraVideo.srcObject = null;
    cameraOffMsg.hidden = false;
    cameraHint.textContent = 'Camera is inactive. Click the power button to start.';
    cameraToggle.classList.remove('active');
    return;
  }
  try {
    await ligarCamera();
  } catch (err) {
    cameraHint.textContent = `Nao consegui acessar a camera: ${err.message}`;
  }
});

// usado quando a Lumia pede pra "ver" (ferramenta ver_camera) - liga a camera se estiver
// desligada, espera um quadro de verdade estar pronto e captura ele como JPEG base64
async function capturarFrameCamera() {
  await ligarCamera();
  if (cameraVideo.readyState < 2) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('a camera demorou demais pra ficar pronta')), 5000);
      cameraVideo.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth || 640;
  canvas.height = cameraVideo.videoHeight || 480;
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// ---------- Abas: Painel / Agenda / WhatsApp ----------
function mudarAba(aba) {
  tabPainel.hidden = aba !== 'painel';
  tabAgenda.hidden = aba !== 'agenda';
  tabWhatsapp.hidden = aba !== 'whatsapp';
  tabCrm.hidden = aba !== 'crm';
  tabAuto.hidden = aba !== 'auto';
  tabRelatorios.hidden = aba !== 'relatorios';
  tabClientes.hidden = aba !== 'clientes';
  tabBtnPainel.classList.toggle('active', aba === 'painel');
  tabBtnAgenda.classList.toggle('active', aba === 'agenda');
  tabBtnWhatsapp.classList.toggle('active', aba === 'whatsapp');
  tabBtnCrm.classList.toggle('active', aba === 'crm');
  tabBtnAuto.classList.toggle('active', aba === 'auto');
  tabBtnRelatorios.classList.toggle('active', aba === 'relatorios');
  tabBtnClientes.classList.toggle('active', aba === 'clientes');
  if (aba === 'agenda') {
    carregarStatusGoogleAgenda();
    carregarEventosAgenda();
  } else if (aba === 'whatsapp') {
    carregarStatusWhatsapp();
    carregarInstanciasWhatsapp();
  } else if (aba === 'crm') {
    carregarCrm();
  } else if (aba === 'auto') {
    carregarConfigAutoAtendimento();
  } else if (aba === 'relatorios') {
    carregarDestinatariosRelatorios();
    carregarConfigsRelatorios();
  } else if (aba === 'clientes') {
    carregarClientes();
  }
  // o polling do CRM (contatos + conversa aberta) so deve rodar com a aba visivel, senao fica
  // batendo na API/banco a toa em segundo plano pra sempre
  pararPollingCrm();
  if (aba === 'crm') iniciarPollingCrm();
}
tabBtnPainel.addEventListener('click', () => mudarAba('painel'));
tabBtnAgenda.addEventListener('click', () => mudarAba('agenda'));
tabBtnWhatsapp.addEventListener('click', () => mudarAba('whatsapp'));
tabBtnCrm.addEventListener('click', () => mudarAba('crm'));
tabBtnRelatorios.addEventListener('click', () => mudarAba('relatorios'));
tabBtnAuto.addEventListener('click', () => mudarAba('auto'));
tabBtnClientes.addEventListener('click', () => mudarAba('clientes'));

// ---------- Agenda: Google Agenda (conectar/desconectar) ----------
async function carregarStatusGoogleAgenda() {
  try {
    const res = await fetch('/api/agenda/google/status', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (data.conectado) {
      agendaGoogleStatus.textContent = 'Conectada - os compromissos ja sincronizam automaticamente.';
      agendaGoogleBtn.textContent = 'Desconectar';
      agendaGoogleBtn.classList.add('conectado');
    } else {
      agendaGoogleStatus.textContent = 'Nao conectada - a agenda funciona so aqui no app.';
      agendaGoogleBtn.textContent = 'Conectar';
      agendaGoogleBtn.classList.remove('conectado');
    }
  } catch {
    agendaGoogleStatus.textContent = 'Nao consegui checar o status da conexao.';
  }
}

agendaGoogleBtn.addEventListener('click', async () => {
  const conectado = agendaGoogleBtn.classList.contains('conectado');
  if (!conectado) {
    // precisa ser navegacao de pagina de verdade (nao fetch), entao nao da pra mandar o
    // header de autenticacao - vai por query param so nessa navegacao especifica (o servidor
    // le isso uma unica vez pra saber qual tenant esta conectando, ver server.js)
    window.location.href = `/api/agenda/google/conectar?token=${encodeURIComponent(appPassword)}`;
    return;
  }
  if (!confirm('Desconectar a Google Agenda? Os compromissos continuam salvos aqui no app, so param de sincronizar com o Google.')) return;
  try {
    await fetch('/api/agenda/google/desconectar', {
      method: 'POST',
      headers: { 'x-app-password': appPassword },
    });
    carregarStatusGoogleAgenda();
  } catch (err) {
    agendaGoogleStatus.textContent = `Erro desconectando: ${err.message}`;
  }
});

// depois do OAuth, o servidor redireciona de volta pra cá com ?agenda_google=conectado|erro -
// mostra o resultado numa bolha do chat e limpa o parametro da URL
(function tratarRetornoOAuthGoogle() {
  const params = new URLSearchParams(window.location.search);
  const resultado = params.get('agenda_google');
  if (!resultado) return;
  if (resultado === 'conectado') {
    addBubble('Google Agenda conectada com sucesso! Os compromissos ja passam a sincronizar.', 'system');
  } else if (resultado === 'erro') {
    addBubble(`Nao consegui conectar a Google Agenda: ${params.get('msg') || 'erro desconhecido'}`, 'system');
  }
  params.delete('agenda_google');
  params.delete('msg');
  const novaUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
  window.history.replaceState({}, '', novaUrl);
})();

// ---------- Agenda: visao de dia estilo Clinicorp (coluna de horarios + blocos) ----------
const AGENDA_HORA_INICIO = 7; // 07:00
const AGENDA_HORA_FIM = 20; // ate 20:00 (compromissos fora dessa janela caem numa lista a parte)
const AGENDA_ALTURA_HORA = 56; // px, precisa bater com --agenda-grade-hora/linha no CSS

let agendaDiaSelecionado = new Date(); // sempre meio-dia local pra evitar virar o dia trocando fuso

function formatarDataAgendaISO(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarHoraEvento(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
}

function atualizarTituloDia() {
  agendaDiaTitulo.textContent = agendaDiaSelecionado.toLocaleDateString('pt-BR', {
    timeZone: 'America/Maceio',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function montarGradeVazia() {
  agendaGrade.textContent = '';

  const colHoras = document.createElement('div');
  colHoras.className = 'agenda-grade-horas';
  for (let h = AGENDA_HORA_INICIO; h < AGENDA_HORA_FIM; h++) {
    const marca = document.createElement('div');
    marca.className = 'agenda-grade-hora';
    marca.textContent = `${String(h).padStart(2, '0')}:00`;
    colHoras.appendChild(marca);
  }

  const corpo = document.createElement('div');
  corpo.className = 'agenda-grade-corpo';
  corpo.id = 'agendaGradeCorpo';
  const totalHoras = AGENDA_HORA_FIM - AGENDA_HORA_INICIO;
  corpo.style.height = `${totalHoras * AGENDA_ALTURA_HORA}px`;
  for (let h = AGENDA_HORA_INICIO; h < AGENDA_HORA_FIM; h++) {
    const linha = document.createElement('div');
    linha.className = 'agenda-grade-linha';
    corpo.appendChild(linha);
  }

  agendaGrade.appendChild(colHoras);
  agendaGrade.appendChild(corpo);
  return corpo;
}

function criarBlocoEvento(ev) {
  const bloco = document.createElement('div');
  bloco.className = ev.origem === 'google' ? 'agenda-bloco agenda-bloco-google' : 'agenda-bloco';

  const titulo = document.createElement('div');
  titulo.className = 'agenda-bloco-titulo';
  titulo.textContent = ev.titulo;
  if (ev.origem === 'google') {
    const tag = document.createElement('span');
    tag.className = 'agenda-bloco-tag';
    tag.textContent = 'Google';
    titulo.appendChild(tag);
  }
  bloco.appendChild(titulo);

  const quando = document.createElement('div');
  quando.className = 'agenda-bloco-quando';
  quando.textContent = `${formatarHoraEvento(ev.inicio)} - ${formatarHoraEvento(ev.fim)}${ev.local ? ` · ${ev.local}` : ''}`;
  bloco.appendChild(quando);

  if (ev.origem !== 'google' && ev.id) {
    const cancelarBtn = document.createElement('button');
    cancelarBtn.type = 'button';
    cancelarBtn.className = 'agenda-bloco-cancelar';
    cancelarBtn.textContent = '✕';
    cancelarBtn.title = 'Cancelar compromisso';
    cancelarBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Cancelar "${ev.titulo}"?`)) return;
      try {
        await fetch(`/api/agenda/eventos/${ev.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
        carregarEventosAgenda();
      } catch (err) {
        agendaErro.textContent = `Erro cancelando: ${err.message}`;
        agendaErro.hidden = false;
      }
    });
    bloco.appendChild(cancelarBtn);
  }

  return bloco;
}

function renderizarEventosAgenda(eventos) {
  const corpo = montarGradeVazia();
  const janelaInicioMin = AGENDA_HORA_INICIO * 60;
  const janelaFimMin = AGENDA_HORA_FIM * 60;
  const foraDoHorario = [];

  for (const ev of eventos) {
    const inicio = new Date(ev.inicio);
    const fim = new Date(ev.fim);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) continue;

    const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes();
    let minutosFim = fim.getHours() * 60 + fim.getMinutes();
    if (fim.toDateString() !== inicio.toDateString()) minutosFim = janelaFimMin; // continua pro proximo dia - corta na borda

    if (minutosFim <= janelaInicioMin || minutosInicio >= janelaFimMin) {
      foraDoHorario.push(ev);
      continue;
    }

    const inicioClamp = Math.max(minutosInicio, janelaInicioMin);
    const fimClamp = Math.min(minutosFim, janelaFimMin);
    const top = ((inicioClamp - janelaInicioMin) / 60) * AGENDA_ALTURA_HORA;
    const altura = Math.max(((fimClamp - inicioClamp) / 60) * AGENDA_ALTURA_HORA, 26);

    const bloco = criarBlocoEvento(ev);
    bloco.style.top = `${top}px`;
    bloco.style.height = `${altura}px`;
    corpo.appendChild(bloco);
  }

  if (!eventos.length) {
    const vazio = document.createElement('p');
    vazio.className = 'agenda-fora-do-dia';
    vazio.textContent = 'Nenhum compromisso nesse dia.';
    corpo.appendChild(vazio);
  } else if (foraDoHorario.length) {
    const aviso = document.createElement('p');
    aviso.className = 'agenda-fora-do-dia';
    aviso.textContent = `+ ${foraDoHorario.length} compromisso(s) fora do horario ${String(AGENDA_HORA_INICIO).padStart(2, '0')}:00-${String(AGENDA_HORA_FIM).padStart(2, '0')}:00: ${foraDoHorario.map((e) => `${e.titulo} (${formatarHoraEvento(e.inicio)})`).join(', ')}`;
    agendaGrade.appendChild(aviso);
  }
}

async function carregarEventosAgenda() {
  atualizarTituloDia();
  agendaGrade.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  agendaGrade.appendChild(carregando);

  const inicioDia = new Date(agendaDiaSelecionado);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(agendaDiaSelecionado);
  fimDia.setHours(23, 59, 59, 999);

  try {
    const params = new URLSearchParams({ from: inicioDia.toISOString(), to: fimDia.toISOString() });
    const res = await fetch(`/api/agenda/eventos?${params}`, { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    renderizarEventosAgenda(data.eventos || []);
  } catch (err) {
    agendaGrade.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar a agenda: ${err.message}`;
    agendaGrade.appendChild(erro);
  }
}

agendaRefresh.addEventListener('click', carregarEventosAgenda);
agendaDiaAnterior.addEventListener('click', () => {
  agendaDiaSelecionado.setDate(agendaDiaSelecionado.getDate() - 1);
  carregarEventosAgenda();
});
agendaDiaProximo.addEventListener('click', () => {
  agendaDiaSelecionado.setDate(agendaDiaSelecionado.getDate() + 1);
  carregarEventosAgenda();
});
agendaDiaHoje.addEventListener('click', () => {
  agendaDiaSelecionado = new Date();
  carregarEventosAgenda();
});

agendaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  agendaErro.hidden = true;

  const data = agendaData.value;
  const horaInicio = agendaHoraInicio.value;
  const horaFim = agendaHoraFim.value;
  if (!data || !horaInicio || !horaFim) return;

  // Maceio e sempre UTC-03:00 (Brasil nao tem mais horario de verao) - monta o ISO com o
  // offset fixo pra nao depender do fuso do navegador de quem esta usando o app
  const inicio = `${data}T${horaInicio}:00-03:00`;
  const fim = `${data}T${horaFim}:00-03:00`;

  try {
    const res = await fetch('/api/agenda/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        titulo: agendaTitulo.value.trim(),
        descricao: agendaDescricao.value.trim(),
        local: agendaLocal.value.trim(),
        inicio,
        fim,
      }),
    });
    const resultado = await res.json();
    if (!res.ok) throw new Error(resultado.erro || 'erro desconhecido');

    agendaForm.reset();
    carregarEventosAgenda();
  } catch (err) {
    agendaErro.textContent = err.message;
    agendaErro.hidden = false;
  }
});

// se o app abrir ja com ?agenda_google=... na URL (voltando do OAuth), mostra a aba Agenda
// direto em vez de deixar escondida atras da aba Painel
if (new URLSearchParams(window.location.search).has('agenda_google')) {
  mudarAba('agenda');
}

// ---------- WhatsApp: status da instancia ativa + numero admin ----------
async function carregarStatusWhatsapp() {
  try {
    const res = await fetch('/api/whatsapp/status', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    waInstanciaAtiva.textContent = data.instanciaAtiva || '--';
    waAdminInput.value = data.numeroAdmin || '';
    const conectada = data.estado === 'open';
    waBadge.textContent = conectada ? 'Conectada' : (data.estado === 'connecting' ? 'Conectando...' : 'Desconectada');
    waBadge.className = `wa-badge ${conectada ? 'wa-badge-ok' : 'wa-badge-off'}`;
  } catch (err) {
    waBadge.textContent = 'Erro';
    waBadge.className = 'wa-badge wa-badge-off';
    waInstanciaAtiva.textContent = err.message;
  }
}

waAdminSalvar.addEventListener('click', async () => {
  const numero = waAdminInput.value.replace(/\D/g, '');
  if (!numero) return;
  waAdminSalvar.disabled = true;
  try {
    const res = await fetch('/api/whatsapp/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    addBubble('Numero autorizado do WhatsApp atualizado.', 'system');
  } catch (err) {
    addBubble(`Erro salvando numero: ${err.message}`, 'system');
  } finally {
    waAdminSalvar.disabled = false;
  }
});

// ---------- WhatsApp: lista de instancias ----------
function mostrarQr(base64) {
  waQrImg.src = base64;
  waQrArea.hidden = false;
  waQrArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
waQrFechar.addEventListener('click', () => { waQrArea.hidden = true; waQrImg.src = ''; });

async function carregarInstanciasWhatsapp() {
  waLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  waLista.appendChild(carregando);

  try {
    const [resInstancias, resStatus] = await Promise.all([
      fetch('/api/whatsapp/instancias', { headers: { 'x-app-password': appPassword } }),
      fetch('/api/whatsapp/status', { headers: { 'x-app-password': appPassword } }),
    ]);
    const dataInstancias = await resInstancias.json();
    const dataStatus = await resStatus.json();
    if (!resInstancias.ok) throw new Error(dataInstancias.erro || 'erro desconhecido');

    waLista.textContent = '';
    const instancias = dataInstancias.instancias || [];
    if (!instancias.length) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Nenhuma instancia encontrada.';
      waLista.appendChild(vazio);
      return;
    }

    for (const inst of instancias) {
      const item = document.createElement('div');
      item.className = 'wa-instancia';

      const info = document.createElement('div');
      info.className = 'wa-instancia-info';
      const nome = document.createElement('div');
      nome.className = 'wa-instancia-nome';
      nome.textContent = inst.nome;
      if (inst.nome === dataStatus.instanciaAtiva) {
        const tag = document.createElement('span');
        tag.className = 'agenda-evento-tag';
        tag.textContent = 'Ativa';
        nome.appendChild(tag);
      }
      const detalhe = document.createElement('div');
      detalhe.className = 'wa-instancia-detalhe';
      detalhe.textContent = `${inst.numero || 'sem numero'} · ${inst.status || 'desconhecido'}`;
      info.appendChild(nome);
      info.appendChild(detalhe);
      item.appendChild(info);

      const acoes = document.createElement('div');
      acoes.className = 'wa-instancia-acoes';

      if (inst.nome !== dataStatus.instanciaAtiva) {
        const usarBtn = document.createElement('button');
        usarBtn.type = 'button';
        usarBtn.textContent = 'Usar esta';
        usarBtn.addEventListener('click', async () => {
          usarBtn.disabled = true;
          try {
            await fetch('/api/whatsapp/ativar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
              body: JSON.stringify({ nome: inst.nome }),
            });
            addBubble(`Instancia ativa trocada pra "${inst.nome}".`, 'system');
            carregarStatusWhatsapp();
            carregarInstanciasWhatsapp();
          } catch (err) {
            addBubble(`Erro ativando instancia: ${err.message}`, 'system');
            usarBtn.disabled = false;
          }
        });
        acoes.appendChild(usarBtn);
      }

      const qrBtn = document.createElement('button');
      qrBtn.type = 'button';
      qrBtn.textContent = 'Gerar QR';
      qrBtn.addEventListener('click', async () => {
        qrBtn.disabled = true;
        try {
          const res = await fetch(`/api/whatsapp/qrcode/${encodeURIComponent(inst.nome)}`, { headers: { 'x-app-password': appPassword } });
          const data = await res.json();
          if (!res.ok || !data.qrcode) throw new Error(data.erro || 'nao consegui gerar o QR (talvez ja esteja conectada)');
          mostrarQr(data.qrcode);
        } catch (err) {
          addBubble(`Erro gerando QR: ${err.message}`, 'system');
        } finally {
          qrBtn.disabled = false;
        }
      });
      acoes.appendChild(qrBtn);

      const desconectarBtn = document.createElement('button');
      desconectarBtn.type = 'button';
      desconectarBtn.className = 'wa-instancia-desconectar';
      desconectarBtn.textContent = 'Desconectar';
      desconectarBtn.addEventListener('click', async () => {
        if (!confirm(`Desconectar o numero da instancia "${inst.nome}"? Vai precisar escanear um QR novo pra reconectar.`)) return;
        desconectarBtn.disabled = true;
        try {
          await fetch('/api/whatsapp/desconectar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ nome: inst.nome }),
          });
          carregarInstanciasWhatsapp();
          carregarStatusWhatsapp();
        } catch (err) {
          addBubble(`Erro desconectando: ${err.message}`, 'system');
          desconectarBtn.disabled = false;
        }
      });
      acoes.appendChild(desconectarBtn);

      item.appendChild(acoes);
      waLista.appendChild(item);
    }
  } catch (err) {
    waLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar as instancias: ${err.message}`;
    waLista.appendChild(erro);
  }
}
waRefresh.addEventListener('click', () => { carregarInstanciasWhatsapp(); carregarStatusWhatsapp(); });

waNovoCriar.addEventListener('click', async () => {
  const nome = waNovoNome.value.trim();
  if (!nome) return;
  waNovoCriar.disabled = true;
  try {
    const res = await fetch('/api/whatsapp/instancias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ nome }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    if (data.qrcode) mostrarQr(data.qrcode);
    waNovoNome.value = '';
    carregarInstanciasWhatsapp();
    addBubble(`Instancia "${nome}" criada. Escaneia o QR pra conectar o numero, depois clica em "Usar esta" pra ativar ela.`, 'system');
  } catch (err) {
    addBubble(`Erro criando instancia: ${err.message}`, 'system');
  } finally {
    waNovoCriar.disabled = false;
  }
});

// ---------- CRM Kanban ----------
let crmContatoAberto = null; // {id, numero, instancia} - conversa aberta no momento, se tiver
let crmPollingContatos = null;
let crmPollingConversa = null;
let crmArrastandoId = null;

function crmFormatarQuando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const agora = new Date();
  const mesmoDia = d.toDateString() === agora.toDateString();
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit' });
}

function crmCriarCard(contato) {
  const card = document.createElement('div');
  card.className = 'crm-card';
  card.draggable = true;
  card.dataset.id = contato.id;

  const nome = document.createElement('div');
  nome.className = 'crm-card-nome';
  nome.textContent = contato.nome || contato.numero;
  if (contato.auto_pausado) {
    const badge = document.createElement('span');
    badge.className = 'crm-card-pausado';
    badge.title = 'Auto-atendimento pausado nesta conversa';
    badge.textContent = '⏸';
    nome.appendChild(badge);
  }
  card.appendChild(nome);

  const numero = document.createElement('div');
  numero.className = 'crm-card-numero';
  numero.textContent = `${contato.numero} · ${contato.instancia}`;
  card.appendChild(numero);

  if (contato.ultima_mensagem) {
    const preview = document.createElement('div');
    preview.className = 'crm-card-preview';
    preview.textContent = contato.ultima_mensagem;
    card.appendChild(preview);
  }

  const quando = document.createElement('div');
  quando.className = 'crm-card-quando';
  quando.textContent = crmFormatarQuando(contato.ultima_mensagem_em);
  card.appendChild(quando);

  card.addEventListener('dragstart', () => {
    crmArrastandoId = contato.id;
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    crmArrastandoId = null;
  });
  card.addEventListener('click', () => abrirConversaCrm(contato));

  return card;
}

async function carregarCrm() {
  try {
    const res = await fetch('/api/crm/contatos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    renderizarCrmBoard(data.etapas || [], data.contatos || []);
  } catch (err) {
    crmBoard.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar o CRM: ${err.message}`;
    crmBoard.appendChild(erro);
  }
}

function renderizarCrmBoard(etapas, contatos) {
  crmBoard.textContent = '';
  for (const etapa of etapas) {
    const coluna = document.createElement('div');
    coluna.className = 'crm-coluna';
    coluna.dataset.etapa = etapa.id;

    const contatosDaEtapa = contatos.filter((c) => c.etapa === etapa.id);

    const header = document.createElement('div');
    header.className = 'crm-coluna-header';
    const titulo = document.createElement('span');
    titulo.textContent = etapa.nome;
    const contagem = document.createElement('span');
    contagem.className = 'crm-coluna-contagem';
    contagem.textContent = contatosDaEtapa.length;
    header.appendChild(titulo);
    header.appendChild(contagem);
    coluna.appendChild(header);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'crm-coluna-cards';
    if (!contatosDaEtapa.length) {
      const vazio = document.createElement('p');
      vazio.className = 'crm-coluna-vazia';
      vazio.textContent = 'Nenhum contato aqui.';
      cardsWrap.appendChild(vazio);
    } else {
      for (const contato of contatosDaEtapa) cardsWrap.appendChild(crmCriarCard(contato));
    }
    coluna.appendChild(cardsWrap);

    coluna.addEventListener('dragover', (e) => {
      e.preventDefault();
      coluna.classList.add('drag-over');
    });
    coluna.addEventListener('dragleave', () => coluna.classList.remove('drag-over'));
    coluna.addEventListener('drop', async (e) => {
      e.preventDefault();
      coluna.classList.remove('drag-over');
      const id = crmArrastandoId;
      if (!id) return;
      try {
        await fetch(`/api/crm/contatos/${id}/etapa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
          body: JSON.stringify({ etapa: etapa.id }),
        });
        carregarCrm();
      } catch (err) {
        addBubble(`Erro movendo o card: ${err.message}`, 'system');
      }
    });

    crmBoard.appendChild(coluna);
  }
}

crmRefresh.addEventListener('click', carregarCrm);
// rolagem horizontal do board por botao - alem da barra de rolagem (que ja fica visivel/dourada
// no CSS), garante um jeito obvio de ver colunas que passam da largura da tela (ex: "Perdidos",
// a ultima, que ficava parecendo cortada sem nenhuma pista de que dava pra rolar)
crmScrollEsq.addEventListener('click', () => crmBoard.scrollBy({ left: -260, behavior: 'smooth' }));
crmScrollDir.addEventListener('click', () => crmBoard.scrollBy({ left: 260, behavior: 'smooth' }));

// tempo real via SSE (ver /api/crm/eventos no server) - o board e a conversa aberta atualizam
// na hora que uma mensagem chega/sai, sem esperar polling. O polling abaixo vira so uma rede
// de seguranca bem mais espacada, pro caso raro do SSE cair e nao reconectar sozinho.
let crmEventSource = null;

function conectarEventosCrm() {
  if (crmEventSource) return;
  crmEventSource = new EventSource(`/api/crm/eventos?senha=${encodeURIComponent(appPassword)}`);
  crmEventSource.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (data.tipo === 'mensagem') {
      carregarCrm(); // preview/ordem dos cards muda a cada mensagem nova
      if (crmContatoAberto && data.numero === crmContatoAberto.numero && data.instancia === crmContatoAberto.instancia) {
        carregarMensagensCrm();
      }
    } else if (data.tipo === 'contato-atualizado') {
      carregarCrm();
      if (data.apagado && crmContatoAberto?.id === data.contatoId) {
        crmConversa.hidden = true;
        crmContatoAberto = null;
      }
    }
  };
  // EventSource reconecta sozinho quando a conexao cai - so evita barulho no console
  crmEventSource.onerror = () => {};
}

function desconectarEventosCrm() {
  if (crmEventSource) { crmEventSource.close(); crmEventSource = null; }
}

function iniciarPollingCrm() {
  conectarEventosCrm();
  // rede de seguranca (nao a fonte principal de atualizacao) - 20s em vez dos 8s de antes
  crmPollingContatos = setInterval(carregarCrm, 20000);
}
function pararPollingCrm() {
  desconectarEventosCrm();
  if (crmPollingContatos) { clearInterval(crmPollingContatos); crmPollingContatos = null; }
  pararPollingConversaCrm();
}
function pararPollingConversaCrm() {
  if (crmPollingConversa) { clearInterval(crmPollingConversa); crmPollingConversa = null; }
}

const CRM_ICONE_MIDIA = { image: '🖼️', audio: '🎤', video: '🎥' };

function crmFormatarHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
}

function crmFormatarSeparadorData(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
  const mesmaData = (a, b) => a.toDateString() === b.toDateString();
  if (mesmaData(d, hoje)) return 'Hoje';
  if (mesmaData(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// visual proposital diferente do chat principal da Lumia - bolhas verde/cinza no estilo
// classico do WhatsApp (ver .crm-msg no CSS), com separador de data e timestamp+check em cada
// mensagem, pra essa aba parecer "a conversa de verdade" em vez do tema dourado do resto do app
function crmRenderizarMensagens(mensagens) {
  crmConversaLog.textContent = '';
  let ultimaDataSeparador = null;

  for (const m of mensagens) {
    const separador = crmFormatarSeparadorData(m.criado_em);
    if (separador && separador !== ultimaDataSeparador) {
      const sep = document.createElement('div');
      sep.className = 'crm-msg-data-separador';
      sep.textContent = separador;
      crmConversaLog.appendChild(sep);
      ultimaDataSeparador = separador;
    }

    const saida = m.direcao !== 'entrada';
    const bubble = document.createElement('div');
    bubble.className = `crm-msg ${saida ? 'crm-msg-saida' : 'crm-msg-entrada'}`;

    const corpo = document.createElement('div');
    corpo.className = 'crm-msg-corpo';
    if (m.tipo === 'image' && m.tem_midia) {
      const midia = document.createElement('div');
      midia.className = 'crm-msg-midia-imagem';
      const img = document.createElement('img');
      img.src = `/api/crm/midia/${m.id}?senha=${encodeURIComponent(appPassword)}`;
      img.alt = 'Imagem enviada pelo WhatsApp';
      img.loading = 'lazy';
      midia.appendChild(img);
      corpo.appendChild(midia);
      if (m.texto) {
        const legenda = document.createElement('div');
        legenda.className = 'crm-msg-legenda';
        legenda.textContent = m.texto;
        corpo.appendChild(legenda);
      }
    } else if (m.tipo === 'audio' && m.tem_midia) {
      const midia = document.createElement('div');
      midia.className = 'crm-msg-midia-audio';
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = `/api/crm/midia/${m.id}?senha=${encodeURIComponent(appPassword)}`;
      midia.appendChild(audio);
      corpo.appendChild(midia);
    } else if (m.tipo && m.tipo !== 'text') {
      const midia = document.createElement('div');
      midia.className = 'crm-msg-midia';
      midia.textContent = `${CRM_ICONE_MIDIA[m.tipo] || '📎'} ${m.texto || `[${m.tipo}]`}`;
      corpo.appendChild(midia);
    } else {
      corpo.textContent = m.texto || '';
    }
    bubble.appendChild(corpo);

    const meta = document.createElement('span');
    meta.className = 'crm-msg-meta';
    meta.textContent = crmFormatarHora(m.criado_em);
    if (saida) {
      const check = document.createElement('span');
      check.className = 'crm-msg-check';
      // sem status de entrega/leitura de verdade guardado no historico - so confirma que foi
      // enviada (nao finge "lido" sem esse dado real)
      check.textContent = '✓';
      meta.appendChild(check);
    }
    bubble.appendChild(meta);

    crmConversaLog.appendChild(bubble);
  }
  crmConversaLog.scrollTop = crmConversaLog.scrollHeight;
}

async function carregarMensagensCrm() {
  if (!crmContatoAberto) return;
  try {
    const params = new URLSearchParams({ numero: crmContatoAberto.numero, instancia: crmContatoAberto.instancia });
    const res = await fetch(`/api/crm/mensagens?${params}`, { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmRenderizarMensagens(data.mensagens || []);
  } catch (err) {
    crmConversaErro.textContent = `Nao consegui carregar a conversa: ${err.message}`;
    crmConversaErro.hidden = false;
  }
}

function crmAtualizarBotaoPausar() {
  const pausado = !!crmContatoAberto?.auto_pausado;
  crmConversaPausar.textContent = pausado ? 'Retomar auto-atendimento' : 'Pausar auto-atendimento';
  crmConversaPausar.classList.toggle('crm-btn-ativo', pausado);
}

function crmAtualizarAvatar(contato) {
  // sem foto de perfil guardada ainda - so a inicial do nome/numero como fallback, no mesmo
  // estilo circular que uma foto real ocuparia
  crmConversaAvatar.hidden = true;
  crmConversaAvatarFallback.hidden = false;
  const base = contato.nome || contato.numero || '?';
  crmConversaAvatarFallback.textContent = base.trim().charAt(0) || '?';
}

function crmAtualizarBotaoOcultar() {
  crmConversaOcultar.textContent = crmContatoAberto?.oculto ? 'Reexibir conversa' : 'Ocultar conversa';
}

function abrirConversaCrm(contato) {
  crmContatoAberto = contato;
  crmConversaNome.textContent = contato.nome || contato.numero;
  crmConversaNumero.textContent = `${contato.numero} · ${contato.instancia}`;
  crmConversaErro.hidden = true;
  crmConversa.hidden = false;
  crmAtualizarAvatar(contato);
  crmAtualizarBotaoPausar();
  crmAtualizarBotaoOcultar();
  carregarMensagensCrm();
  pararPollingConversaCrm();
  // o SSE (conectarEventosCrm) e a fonte principal de atualizacao em tempo real - isso aqui e
  // so uma rede de seguranca bem espacada, caso a conexao caia sem reconectar
  crmPollingConversa = setInterval(carregarMensagensCrm, 20000);
}

crmConversaFechar.addEventListener('click', () => {
  crmConversa.hidden = true;
  crmContatoAberto = null;
  pararPollingConversaCrm();
});

crmConversaPausar.addEventListener('click', async () => {
  if (!crmContatoAberto) return;
  const novoPausado = !crmContatoAberto.auto_pausado;
  crmConversaPausar.disabled = true;
  try {
    const res = await fetch(`/api/crm/contatos/${crmContatoAberto.id}/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ pausado: novoPausado }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmContatoAberto.auto_pausado = novoPausado;
    crmAtualizarBotaoPausar();
    carregarCrm();
  } catch (err) {
    crmConversaErro.textContent = `Nao consegui atualizar: ${err.message}`;
    crmConversaErro.hidden = false;
  } finally {
    crmConversaPausar.disabled = false;
  }
});

crmConversaApagar.addEventListener('click', async () => {
  if (!crmContatoAberto) return;
  const nomeOuNumero = crmContatoAberto.nome || crmContatoAberto.numero;
  if (!confirm(`Apagar a conversa com ${nomeOuNumero}? Isso remove o card e todo o historico de mensagens do CRM - nao da pra desfazer.`)) return;
  crmConversaApagar.disabled = true;
  try {
    const res = await fetch(`/api/crm/contatos/${crmContatoAberto.id}`, {
      method: 'DELETE',
      headers: { 'x-app-password': appPassword },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmConversa.hidden = true;
    crmContatoAberto = null;
    pararPollingConversaCrm();
    carregarCrm();
  } catch (err) {
    crmConversaErro.textContent = `Nao consegui apagar: ${err.message}`;
    crmConversaErro.hidden = false;
  } finally {
    crmConversaApagar.disabled = false;
  }
});

crmConversaOcultar.addEventListener('click', async () => {
  if (!crmContatoAberto) return;
  const novoOculto = !crmContatoAberto.oculto;
  crmConversaOcultar.disabled = true;
  try {
    const res = await fetch(`/api/crm/contatos/${crmContatoAberto.id}/ocultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ oculto: novoOculto }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmContatoAberto.oculto = novoOculto;
    crmAtualizarBotaoOcultar();
    // ocultar tira da lista padrao do board - fecha a conversa junto pra nao ficar olhando
    // pra uma conversa que "sumiu" da lista de tras
    if (novoOculto) {
      crmConversa.hidden = true;
      crmContatoAberto = null;
      pararPollingConversaCrm();
    }
    carregarCrm();
  } catch (err) {
    crmConversaErro.textContent = `Nao consegui atualizar: ${err.message}`;
    crmConversaErro.hidden = false;
  } finally {
    crmConversaOcultar.disabled = false;
  }
});

// ---------- CRM: gerenciar conversas ocultas (protegido por uma segunda senha, separada da
// senha geral do app - pra um funcionario que usa o CRM no dia a dia nao conseguir ver as
// conversas que o dono marcou pra ignorar so por ter a senha normal do painel) ----------

// true/false conforme a ultima checagem de status - usado so pra escolher o texto certo do
// botao "Trocar/remover senha" x "Definir senha"; a senha em si nunca fica guardada aqui, o
// gate e sempre pedido de novo a cada vez que o modal abre
let crmOcultasSenhaConfiguradaAtual = false;

function crmOcultasMostrarSoLista() {
  crmOcultasSenhaGate.hidden = true;
  crmOcultasTrocarSenha.hidden = true;
  crmOcultasLista.hidden = false;
  crmOcultasRodape.hidden = false;
  crmOcultasTrocarSenhaBtn.textContent = crmOcultasSenhaConfiguradaAtual ? 'Trocar/remover senha' : 'Definir senha';
}

function crmOcultasMostrarGate(mensagemErro) {
  crmOcultasLista.hidden = true;
  crmOcultasRodape.hidden = true;
  crmOcultasTrocarSenha.hidden = true;
  crmOcultasSenhaGate.hidden = false;
  crmOcultasSenhaInput.value = '';
  crmOcultasSenhaErro.hidden = !mensagemErro;
  crmOcultasSenhaErro.textContent = mensagemErro || '';
  crmOcultasSenhaInput.focus();
}

function crmOcultasRenderizarLista(lista) {
  crmOcultasLista.textContent = '';
  if (!lista.length) {
    const vazio = document.createElement('p');
    vazio.className = 'agenda-vazia';
    vazio.textContent = 'Nenhuma conversa oculta.';
    crmOcultasLista.appendChild(vazio);
    return;
  }
  for (const contato of lista) {
    const item = document.createElement('div');
    item.className = 'auto-arquivo-item';
    const info = document.createElement('div');
    info.className = 'auto-arquivo-info';
    const nome = document.createElement('div');
    nome.className = 'auto-arquivo-nome';
    nome.textContent = contato.nome || contato.numero;
    info.appendChild(nome);
    item.appendChild(info);

    const reexibirBtn = document.createElement('button');
    reexibirBtn.type = 'button';
    reexibirBtn.className = 'agenda-evento-cancelar';
    reexibirBtn.textContent = '↩';
    reexibirBtn.title = 'Reexibir no funil';
    reexibirBtn.addEventListener('click', async () => {
      try {
        await fetch(`/api/crm/contatos/${contato.id}/ocultar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
          body: JSON.stringify({ oculto: false }),
        });
        crmOcultasCarregarLista();
        carregarCrm();
      } catch (err) {
        addBubble(`Erro reexibindo conversa: ${err.message}`, 'system');
      }
    });
    item.appendChild(reexibirBtn);

    crmOcultasLista.appendChild(item);
  }
}

// busca a lista ja passando a senha (vazia se ainda nao ha protecao configurada) - o backend
// e quem decide se aceita ou nao (verificarSenhaOcultas)
async function crmOcultasCarregarLista(senha = '') {
  crmOcultasLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  crmOcultasLista.appendChild(carregando);

  try {
    const res = await fetch(`/api/crm/contatos-ocultos?senha=${encodeURIComponent(senha)}`, {
      headers: { 'x-app-password': appPassword },
    });
    const data = await res.json();
    if (res.status === 401) { crmOcultasMostrarGate('Senha incorreta.'); return; }
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmOcultasMostrarSoLista();
    crmOcultasRenderizarLista(data.contatos || []);
  } catch (err) {
    crmOcultasMostrarSoLista();
    crmOcultasLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar: ${err.message}`;
    crmOcultasLista.appendChild(erro);
  }
}

crmVerOcultas.addEventListener('click', async () => {
  crmOcultasModal.hidden = false;
  try {
    const res = await fetch('/api/crm/ocultas/senha-status', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    crmOcultasSenhaConfiguradaAtual = !!data.configurada;
  } catch {
    crmOcultasSenhaConfiguradaAtual = false;
  }
  if (crmOcultasSenhaConfiguradaAtual) {
    crmOcultasMostrarGate();
  } else {
    crmOcultasCarregarLista('');
  }
});

crmOcultasFechar.addEventListener('click', () => { crmOcultasModal.hidden = true; });

crmOcultasSenhaEntrar.addEventListener('click', () => {
  const senha = crmOcultasSenhaInput.value;
  if (!senha) { crmOcultasSenhaErro.hidden = false; crmOcultasSenhaErro.textContent = 'Digite a senha.'; return; }
  crmOcultasCarregarLista(senha);
});
crmOcultasSenhaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') crmOcultasSenhaEntrar.click();
});

crmOcultasTrocarSenhaBtn.addEventListener('click', () => {
  crmOcultasLista.hidden = true;
  crmOcultasRodape.hidden = true;
  crmOcultasTrocarTexto.textContent = crmOcultasSenhaConfiguradaAtual
    ? 'Trocar ou remover a senha das conversas ocultas.'
    : 'Definir uma senha pra proteger as conversas ocultas.';
  crmOcultasSenhaAtualInput.hidden = !crmOcultasSenhaConfiguradaAtual;
  crmOcultasSenhaAtualInput.value = '';
  crmOcultasSenhaNovaInput.value = '';
  crmOcultasTrocarErro.hidden = true;
  crmOcultasTrocarSenha.hidden = false;
});

crmOcultasSenhaCancelar.addEventListener('click', () => {
  crmOcultasTrocarSenha.hidden = true;
  crmOcultasLista.hidden = false;
  crmOcultasRodape.hidden = false;
});

crmOcultasSenhaSalvar.addEventListener('click', async () => {
  const senhaAtual = crmOcultasSenhaAtualInput.value;
  const novaSenha = crmOcultasSenhaNovaInput.value;
  try {
    const res = await fetch('/api/crm/ocultas/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    const data = await res.json();
    if (!res.ok) {
      crmOcultasTrocarErro.hidden = false;
      crmOcultasTrocarErro.textContent = data.erro || 'erro desconhecido';
      return;
    }
    crmOcultasSenhaConfiguradaAtual = !!novaSenha;
    crmOcultasCarregarLista(novaSenha);
  } catch (err) {
    crmOcultasTrocarErro.hidden = false;
    crmOcultasTrocarErro.textContent = err.message;
  }
});

crmConversaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  crmConversaErro.hidden = true;
  const texto = crmConversaInput.value.trim();
  if (!texto || !crmContatoAberto) return;
  try {
    const res = await fetch('/api/crm/mensagens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ numero: crmContatoAberto.numero, instancia: crmContatoAberto.instancia, texto }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmConversaInput.value = '';
    carregarMensagensCrm();
  } catch (err) {
    crmConversaErro.textContent = err.message;
    crmConversaErro.hidden = false;
  }
});

// ---------- Auto Atendimento ----------
autoAtivo.addEventListener('change', () => {
  autoAtivoLabel.textContent = autoAtivo.checked ? 'Ativado' : 'Desativado';
});

// o botao "Salvar Configurações" fica vermelho assim que qualquer campo da aba muda (avisa que
// tem alteracao pendente) e volta pro dourado (com um "pulso" rapido) so depois de salvar de
// verdade com sucesso - assim fica visivelmente claro quando ainda falta salvar
function marcarAlteracoesNaoSalvas() {
  autoSalvar.classList.add('nao-salvo');
  autoSalvar.classList.remove('salvo-pulso');
  autoSalvar.textContent = 'Salvar Configurações *';
}
[autoAtivo, autoInstancia, autoPrompt, autoFrequenciaAudio, autoAudioSeReceberAudio, autoAgendarInterna, autoAgendarClinicorp]
  .forEach((el) => {
    // 'input' pega cada tecla digitada no prompt; 'change' cobre checkbox/select (que nem
    // sempre disparam 'input' de forma consistente entre navegadores)
    el.addEventListener('input', marcarAlteracoesNaoSalvas);
    el.addEventListener('change', marcarAlteracoesNaoSalvas);
  });

async function carregarConfigAutoAtendimento() {
  autoErro.hidden = true;
  try {
    const [resConfig, resInstancias] = await Promise.all([
      fetch('/api/auto-atendimento/config', { headers: { 'x-app-password': appPassword } }),
      fetch('/api/whatsapp/instancias', { headers: { 'x-app-password': appPassword } }),
    ]);
    const config = await resConfig.json();
    const dataInstancias = await resInstancias.json();
    if (!resConfig.ok) throw new Error(config.erro || 'erro desconhecido');

    autoInstancia.textContent = '';
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = '-- escolha um numero --';
    autoInstancia.appendChild(vazio);
    for (const inst of dataInstancias.instancias || []) {
      const opt = document.createElement('option');
      opt.value = inst.nome;
      opt.textContent = `${inst.nome} (${inst.numero || 'sem numero'})`;
      autoInstancia.appendChild(opt);
    }

    autoAtivo.checked = !!config.ativo;
    autoAtivoLabel.textContent = config.ativo ? 'Ativado' : 'Desativado';
    autoInstancia.value = config.instancia || '';
    autoPrompt.value = config.prompt || '';
    autoFrequenciaAudio.value = String(config.frequenciaAudio || 0);
    autoAudioSeReceberAudio.checked = !!config.audioSeReceberAudio;
    autoAgendarInterna.checked = !!config.agendarAgendaInterna;
    autoAgendarClinicorp.checked = !!config.agendarClinicorp;

    // acabou de carregar do servidor - nao tem nada "nao salvo" ainda
    autoSalvar.classList.remove('nao-salvo', 'salvo-pulso');
    autoSalvar.textContent = 'Salvar Configurações';
  } catch (err) {
    autoErro.textContent = `Nao consegui carregar a configuracao: ${err.message}`;
    autoErro.hidden = false;
  }
  carregarArquivosAutoAtendimento();
}

// um unico botao "Salvar Configurações" grava TUDO da tela de uma vez (ativo/inativo, numero,
// prompt, cadencia de audio, destino do agendamento) - entra em vigor imediatamente na proxima
// mensagem, sem precisar de mais nada (a config e lida do banco a cada mensagem recebida)
autoSalvar.addEventListener('click', async () => {
  autoErro.hidden = true;
  const ativo = autoAtivo.checked;
  const instancia = autoInstancia.value;
  const prompt = autoPrompt.value.trim();
  const frequenciaAudio = Number(autoFrequenciaAudio.value) || 0;
  const audioSeReceberAudio = autoAudioSeReceberAudio.checked;
  const agendarAgendaInterna = autoAgendarInterna.checked;
  const agendarClinicorp = autoAgendarClinicorp.checked;
  if (ativo && (!instancia || !prompt)) {
    autoErro.textContent = 'Pra ativar, escolhe o numero e escreve o prompt de treinamento.';
    autoErro.hidden = false;
    return;
  }
  autoSalvar.disabled = true;
  try {
    const res = await fetch('/api/auto-atendimento/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, agendarAgendaInterna, agendarClinicorp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');

    // salvou de verdade - tira o vermelho, volta pro dourado com um "pulso" rapido pra ficar
    // visivel que salvou agora mesmo (nao so que "nao ha mudanca pendente")
    autoSalvar.classList.remove('nao-salvo');
    autoSalvar.textContent = 'Salvo ✓';
    autoSalvar.classList.add('salvo-pulso');
    setTimeout(() => {
      autoSalvar.classList.remove('salvo-pulso');
      autoSalvar.textContent = 'Salvar Configurações';
    }, 1200);

    addBubble(`Configurações salvas e já valendo${ativo ? ` no numero "${instancia}"` : ' (desativado)'}.`, 'system');
  } catch (err) {
    autoErro.textContent = err.message;
    autoErro.hidden = false;
  } finally {
    autoSalvar.disabled = false;
  }
});

// ---------- Auto Atendimento: arquivos de referencia ----------
let autoArquivoSelecionado = null;

autoArquivoEscolher.addEventListener('click', () => autoArquivoInput.click());
autoArquivoInput.addEventListener('change', () => {
  autoArquivoSelecionado = autoArquivoInput.files[0] || null;
  autoArquivoNome.textContent = autoArquivoSelecionado ? autoArquivoSelecionado.name : 'Nenhum arquivo escolhido';
});

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function carregarArquivosAutoAtendimento() {
  autoArquivosLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  autoArquivosLista.appendChild(carregando);

  try {
    const res = await fetch('/api/auto-atendimento/arquivos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');

    autoArquivosLista.textContent = '';
    const lista = data.arquivos || [];
    if (!lista.length) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Nenhum arquivo cadastrado ainda.';
      autoArquivosLista.appendChild(vazio);
      return;
    }

    for (const arq of lista) {
      const item = document.createElement('div');
      item.className = 'auto-arquivo-item';

      const info = document.createElement('div');
      info.className = 'auto-arquivo-info';
      const nome = document.createElement('div');
      nome.className = 'auto-arquivo-nome';
      nome.textContent = arq.nome_arquivo;
      const detalhe = document.createElement('div');
      detalhe.className = 'auto-arquivo-detalhe';
      detalhe.textContent = `${arq.descricao} · ${formatarTamanho(Number(arq.tamanho))}`;
      info.appendChild(nome);
      info.appendChild(detalhe);
      item.appendChild(info);

      const apagarBtn = document.createElement('button');
      apagarBtn.type = 'button';
      apagarBtn.className = 'agenda-evento-cancelar';
      apagarBtn.textContent = '✕';
      apagarBtn.title = 'Apagar arquivo';
      apagarBtn.addEventListener('click', async () => {
        if (!confirm(`Apagar "${arq.nome_arquivo}"?`)) return;
        try {
          await fetch(`/api/auto-atendimento/arquivos/${arq.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
          carregarArquivosAutoAtendimento();
        } catch (err) {
          addBubble(`Erro apagando arquivo: ${err.message}`, 'system');
        }
      });
      item.appendChild(apagarBtn);

      autoArquivosLista.appendChild(item);
    }
  } catch (err) {
    autoArquivosLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar os arquivos: ${err.message}`;
    autoArquivosLista.appendChild(erro);
  }
}

autoArquivoEnviar.addEventListener('click', async () => {
  const descricao = autoArquivoDescricao.value.trim();
  if (!autoArquivoSelecionado) { addBubble('Escolhe um arquivo primeiro.', 'system'); return; }
  if (!descricao) { addBubble('Escreve pra que serve o arquivo antes de enviar.', 'system'); return; }

  autoArquivoEnviar.disabled = true;
  try {
    const base64 = await arquivoParaBase64(autoArquivoSelecionado);
    const res = await fetch('/api/auto-atendimento/arquivos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        nomeArquivo: autoArquivoSelecionado.name,
        descricao,
        mediaType: autoArquivoSelecionado.type || 'application/octet-stream',
        base64,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');

    autoArquivoSelecionado = null;
    autoArquivoInput.value = '';
    autoArquivoNome.textContent = 'Nenhum arquivo escolhido';
    autoArquivoDescricao.value = '';
    carregarArquivosAutoAtendimento();
  } catch (err) {
    addBubble(`Erro enviando arquivo: ${err.message}`, 'system');
  } finally {
    autoArquivoEnviar.disabled = false;
  }
});

// ---------- Relatorios programados ----------

const RELATORIO_FREQUENCIAS = [
  { valor: '6_horas', rotulo: 'A cada 6 horas' },
  { valor: '12_horas', rotulo: 'A cada 12 horas' },
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'quinzenal', rotulo: 'Quinzenal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'semestral', rotulo: 'Semestral' },
  { valor: 'anual', rotulo: 'Anual' },
];
// frequencias sem "hora do dia" fixa (o alerta de saldo baixo, por ex, roda relativo ao ultimo
// envio) - o campo de horario some da UI pra essas, ja que o backend ignora ele mesmo assim
const FREQUENCIAS_SUB_DIARIAS = new Set(['6_horas', '12_horas']);

async function carregarDestinatariosRelatorios() {
  relatorioDestinatariosLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  relatorioDestinatariosLista.appendChild(carregando);

  try {
    const res = await fetch('/api/relatorios/destinatarios', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');

    relatorioDestinatariosLista.textContent = '';
    const lista = data.destinatarios || [];
    if (!lista.length) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Nenhum numero cadastrado ainda - os relatorios nao tem pra onde ir.';
      relatorioDestinatariosLista.appendChild(vazio);
      return;
    }

    for (const dest of lista) {
      const item = document.createElement('div');
      item.className = 'auto-arquivo-item';

      const info = document.createElement('div');
      info.className = 'auto-arquivo-info';
      const nome = document.createElement('div');
      nome.className = 'auto-arquivo-nome';
      nome.textContent = dest.numero;
      info.appendChild(nome);
      item.appendChild(info);

      const apagarBtn = document.createElement('button');
      apagarBtn.type = 'button';
      apagarBtn.className = 'agenda-evento-cancelar';
      apagarBtn.textContent = '✕';
      apagarBtn.title = 'Remover numero';
      apagarBtn.addEventListener('click', async () => {
        if (!confirm(`Remover ${dest.numero} dos destinatarios de relatorio?`)) return;
        try {
          await fetch(`/api/relatorios/destinatarios/${dest.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
          carregarDestinatariosRelatorios();
        } catch (err) {
          addBubble(`Erro removendo numero: ${err.message}`, 'system');
        }
      });
      item.appendChild(apagarBtn);

      relatorioDestinatariosLista.appendChild(item);
    }
  } catch (err) {
    relatorioDestinatariosLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar os destinatarios: ${err.message}`;
    relatorioDestinatariosLista.appendChild(erro);
  }
}

relatorioNumeroAdicionar.addEventListener('click', async () => {
  const numero = relatorioNumeroInput.value.trim();
  relatorioNumeroErro.hidden = true;
  if (!numero) return;
  try {
    const res = await fetch('/api/relatorios/destinatarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    relatorioNumeroInput.value = '';
    carregarDestinatariosRelatorios();
  } catch (err) {
    relatorioNumeroErro.textContent = err.message;
    relatorioNumeroErro.hidden = false;
  }
});

function formatarUltimoEnvio(iso) {
  if (!iso) return 'Nunca enviado ainda';
  const data = new Date(iso);
  return `Ultimo envio: ${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

async function carregarConfigsRelatorios() {
  relatorioConfigsLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  relatorioConfigsLista.appendChild(carregando);

  try {
    const [resConfigs, resInstancias] = await Promise.all([
      fetch('/api/relatorios/configs', { headers: { 'x-app-password': appPassword } }),
      fetch('/api/whatsapp/instancias', { headers: { 'x-app-password': appPassword } }),
    ]);
    const data = await resConfigs.json();
    if (!resConfigs.ok) throw new Error(data.erro || 'erro desconhecido');
    const dataInstancias = await resInstancias.json().catch(() => ({}));
    const instancias = resInstancias.ok ? (dataInstancias.instancias || []) : [];

    relatorioConfigsLista.textContent = '';
    for (const cfg of data.configs || []) {
      relatorioConfigsLista.appendChild(criarCardConfigRelatorio(cfg, instancias));
    }
  } catch (err) {
    relatorioConfigsLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar os relatorios: ${err.message}`;
    relatorioConfigsLista.appendChild(erro);
  }
}

function criarCardConfigRelatorio(cfg, instancias) {
  const card = document.createElement('div');
  card.className = 'auto-aviso relatorio-config-card';

  const titulo = document.createElement('div');
  titulo.className = 'relatorio-config-titulo';
  titulo.textContent = cfg.nome;
  card.appendChild(titulo);

  const toggleRow = document.createElement('div');
  toggleRow.className = 'auto-toggle-row';
  const switchLabel = document.createElement('label');
  switchLabel.className = 'auto-switch';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!cfg.ativo;
  const track = document.createElement('span');
  track.className = 'auto-switch-track';
  const thumb = document.createElement('span');
  thumb.className = 'auto-switch-thumb';
  track.appendChild(thumb);
  switchLabel.appendChild(checkbox);
  switchLabel.appendChild(track);
  toggleRow.appendChild(switchLabel);
  const statusLabel = document.createElement('span');
  statusLabel.textContent = cfg.ativo ? 'Ativado' : 'Desativado';
  toggleRow.appendChild(statusLabel);
  card.appendChild(toggleRow);

  const linhaConfig = document.createElement('div');
  linhaConfig.className = 'relatorio-config-linha';

  const blocoFrequencia = document.createElement('div');
  blocoFrequencia.className = 'relatorio-config-bloco';
  const rotuloFrequencia = document.createElement('label');
  rotuloFrequencia.className = 'auto-label';
  rotuloFrequencia.textContent = 'De quanto em quanto tempo';
  blocoFrequencia.appendChild(rotuloFrequencia);
  const selectFrequencia = document.createElement('select');
  selectFrequencia.className = 'relatorio-config-select';
  for (const f of RELATORIO_FREQUENCIAS) {
    const opt = document.createElement('option');
    opt.value = f.valor;
    opt.textContent = f.rotulo;
    if (f.valor === cfg.frequencia) opt.selected = true;
    selectFrequencia.appendChild(opt);
  }
  blocoFrequencia.appendChild(selectFrequencia);
  linhaConfig.appendChild(blocoFrequencia);

  const blocoHora = document.createElement('div');
  blocoHora.className = 'relatorio-config-bloco';
  const rotuloHora = document.createElement('label');
  rotuloHora.className = 'auto-label';
  rotuloHora.textContent = 'Horario do envio';
  blocoHora.appendChild(rotuloHora);
  const inputHora = document.createElement('input');
  inputHora.type = 'time';
  inputHora.className = 'relatorio-config-select';
  inputHora.value = cfg.horaEnvio || '07:00';
  blocoHora.appendChild(inputHora);
  linhaConfig.appendChild(blocoHora);

  // frequencias sub-diarias (alerta de saldo baixo, por ex) nao tem "hora do dia" - o campo
  // some pra nao confundir, ja que o backend ignora ele mesmo assim nesse caso
  const atualizarVisibilidadeHora = () => {
    blocoHora.hidden = FREQUENCIAS_SUB_DIARIAS.has(selectFrequencia.value);
  };
  atualizarVisibilidadeHora();

  const blocoInstancia = document.createElement('div');
  blocoInstancia.className = 'relatorio-config-bloco';
  const rotuloInstancia = document.createElement('label');
  rotuloInstancia.className = 'auto-label';
  rotuloInstancia.textContent = 'Instância de envio';
  blocoInstancia.appendChild(rotuloInstancia);
  const selectInstancia = document.createElement('select');
  selectInstancia.className = 'relatorio-config-select';
  const optPadrao = document.createElement('option');
  optPadrao.value = '';
  optPadrao.textContent = 'Padrão (ativa)';
  if (!cfg.instancia) optPadrao.selected = true;
  selectInstancia.appendChild(optPadrao);
  for (const inst of instancias || []) {
    const opt = document.createElement('option');
    opt.value = inst.nome;
    opt.textContent = inst.numero ? `${inst.nome} (${inst.numero})` : inst.nome;
    if (inst.nome === cfg.instancia) opt.selected = true;
    selectInstancia.appendChild(opt);
  }
  blocoInstancia.appendChild(selectInstancia);
  linhaConfig.appendChild(blocoInstancia);

  card.appendChild(linhaConfig);

  const salvar = async () => {
    try {
      await fetch(`/api/relatorios/configs/${cfg.tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({
          ativo: checkbox.checked,
          frequencia: selectFrequencia.value,
          horaEnvio: inputHora.value,
          instancia: selectInstancia.value || null,
        }),
      });
      statusLabel.textContent = checkbox.checked ? 'Ativado' : 'Desativado';
    } catch (err) {
      addBubble(`Erro salvando configuracao do relatorio: ${err.message}`, 'system');
    }
  };
  checkbox.addEventListener('change', salvar);
  selectFrequencia.addEventListener('change', () => { atualizarVisibilidadeHora(); salvar(); });
  inputHora.addEventListener('change', salvar);
  selectInstancia.addEventListener('change', salvar);

  const ultimoEnvio = document.createElement('p');
  ultimoEnvio.className = 'agenda-vazia';
  ultimoEnvio.style.margin = '0';
  ultimoEnvio.textContent = formatarUltimoEnvio(cfg.ultimoEnvioEm);
  card.appendChild(ultimoEnvio);

  const enviarBtn = document.createElement('button');
  enviarBtn.type = 'button';
  enviarBtn.className = 'relatorio-config-enviar';
  enviarBtn.textContent = 'Enviar agora';
  enviarBtn.addEventListener('click', async () => {
    enviarBtn.disabled = true;
    enviarBtn.textContent = 'Enviando...';
    try {
      const res = await fetch(`/api/relatorios/enviar-agora/${cfg.tipo}`, {
        method: 'POST',
        headers: { 'x-app-password': appPassword },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      enviarBtn.textContent = data.semNadaAReportar ? 'Nada a reportar agora' : 'Enviado ✓';
      carregarConfigsRelatorios();
    } catch (err) {
      addBubble(`Erro enviando relatorio: ${err.message}`, 'system');
      enviarBtn.textContent = 'Enviar agora';
    } finally {
      enviarBtn.disabled = false;
    }
  });
  card.appendChild(enviarBtn);

  return card;
}

// ---------- Clientes (painel admin - so super_admin ve, ver tokenValido()/mostrarApp()) ----------
// cadastro manual de tenant novo (decisao explicita do usuario: sem cadastro publico/cobranca
// automatica por enquanto) + configuracao das integracoes isoladas de cada um (Clinicorp, Meta
// Ads, Trello) - nunca mostra o segredo salvo de volta, so confirma o que ja esta configurado.
let clienteSelecionadoId = null;

async function carregarClientes() {
  clientesLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  clientesLista.appendChild(carregando);

  try {
    const res = await fetch('/api/admin/tenants', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    clientesLista.textContent = '';

    if (!data.tenants.length) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Nenhum cliente cadastrado ainda.';
      clientesLista.appendChild(vazio);
      return;
    }

    for (const t of data.tenants) {
      const card = document.createElement('div');
      card.className = 'cliente-card' + (t.id === clienteSelecionadoId ? ' selecionado' : '');
      card.addEventListener('click', () => selecionarCliente(t.id, t.nome));

      const nome = document.createElement('div');
      nome.className = 'cliente-card-nome';
      nome.textContent = t.nome;
      card.appendChild(nome);

      const meta = document.createElement('div');
      meta.className = 'cliente-card-meta';
      meta.textContent = `usuario: ${t.username}`;
      card.appendChild(meta);

      const row = document.createElement('div');
      row.className = 'cliente-card-row';
      const status = document.createElement('span');
      status.className = 'cliente-card-meta';
      status.textContent = t.ativo ? 'Ativo' : 'Desativado';
      row.appendChild(status);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.textContent = t.ativo ? 'Desativar' : 'Ativar';
      toggleBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          await fetch(`/api/admin/tenants/${t.id}/ativo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ ativo: !t.ativo }),
          });
          carregarClientes();
        } catch (err) {
          addBubble(`Erro atualizando cliente: ${err.message}`, 'system');
        }
      });
      row.appendChild(toggleBtn);
      card.appendChild(row);

      clientesLista.appendChild(card);
    }
  } catch (err) {
    clientesLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar os clientes: ${err.message}`;
    clientesLista.appendChild(erro);
  }
}

clienteCriarBtn.addEventListener('click', async () => {
  const nome = clienteNomeInput.value.trim();
  const username = clienteUsuarioInput.value.trim();
  const senha = clienteSenhaInput.value;
  clienteCriarErro.hidden = true;
  if (!nome || !username || !senha) {
    clienteCriarErro.textContent = 'Preenche nome, usuario e senha.';
    clienteCriarErro.hidden = false;
    return;
  }
  try {
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ nome, username, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    clienteNomeInput.value = '';
    clienteUsuarioInput.value = '';
    clienteSenhaInput.value = '';
    carregarClientes();
  } catch (err) {
    clienteCriarErro.textContent = err.message;
    clienteCriarErro.hidden = false;
  }
});

async function selecionarCliente(id, nome) {
  clienteSelecionadoId = id;
  carregarClientes(); // redesenha pra marcar o card selecionado
  clienteIntegracoesPainel.textContent = '';

  const titulo = document.createElement('h3');
  titulo.textContent = `Integracoes de "${nome}"`;
  clienteIntegracoesPainel.appendChild(titulo);

  const carregandoIntegracoes = document.createElement('p');
  carregandoIntegracoes.className = 'agenda-vazia';
  carregandoIntegracoes.textContent = 'Carregando...';
  clienteIntegracoesPainel.appendChild(carregandoIntegracoes);

  let resumo;
  try {
    const res = await fetch(`/api/admin/tenants/${id}/integracoes`, { headers: { 'x-app-password': appPassword } });
    resumo = await res.json();
    if (!res.ok) throw new Error(resumo.erro || 'erro desconhecido');
  } catch (err) {
    clienteIntegracoesPainel.textContent = '';
    clienteIntegracoesPainel.appendChild(titulo);
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar as integracoes: ${err.message}`;
    clienteIntegracoesPainel.appendChild(erro);
    return;
  }

  clienteIntegracoesPainel.textContent = '';
  clienteIntegracoesPainel.appendChild(titulo);

  // ---- Clinicorp ----
  const clinicorpLabel = document.createElement('label'); clinicorpLabel.className = 'auto-label'; clinicorpLabel.textContent = 'Clinicorp';
  clienteIntegracoesPainel.appendChild(clinicorpLabel);
  const clinicorpStatus = document.createElement('p');
  clinicorpStatus.className = 'agenda-vazia';
  clinicorpStatus.textContent = resumo.clinicorp
    ? `Conectado (usuario: ${resumo.clinicorp.apiUser})`
    : 'Nao conectado.';
  clienteIntegracoesPainel.appendChild(clinicorpStatus);

  const clinicorpForm = document.createElement('div');
  clinicorpForm.className = 'cliente-form';
  const ccApiUser = document.createElement('input'); ccApiUser.placeholder = 'API User';
  const ccApiToken = document.createElement('input'); ccApiToken.placeholder = 'API Token'; ccApiToken.type = 'password';
  const ccSubscriber = document.createElement('input'); ccSubscriber.placeholder = 'Subscriber ID';
  const ccBusiness = document.createElement('input'); ccBusiness.placeholder = 'Default Business ID (opcional)';
  const ccSalvar = document.createElement('button'); ccSalvar.type = 'button'; ccSalvar.textContent = 'Salvar Clinicorp';
  ccSalvar.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/integracoes/clinicorp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ apiUser: ccApiUser.value.trim(), apiToken: ccApiToken.value, subscriberId: ccSubscriber.value.trim(), defaultBusinessId: ccBusiness.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      selecionarCliente(id, nome);
    } catch (err) {
      addBubble(`Erro salvando Clinicorp: ${err.message}`, 'system');
    }
  });
  clinicorpForm.append(ccApiUser, ccApiToken, ccSubscriber, ccBusiness, ccSalvar);
  clienteIntegracoesPainel.appendChild(clinicorpForm);

  // ---- Meta Ads ----
  const metaAdsLabel = document.createElement('label'); metaAdsLabel.className = 'auto-label'; metaAdsLabel.textContent = 'Meta Ads';
  clienteIntegracoesPainel.appendChild(metaAdsLabel);
  const metaAdsStatus = document.createElement('p');
  metaAdsStatus.className = 'agenda-vazia';
  metaAdsStatus.textContent = resumo.metaAds.length
    ? `${resumo.metaAds.length} conta(s) conectada(s): ${resumo.metaAds.join(', ')}`
    : 'Nenhuma conta conectada.';
  clienteIntegracoesPainel.appendChild(metaAdsStatus);

  const metaAdsForm = document.createElement('div');
  metaAdsForm.className = 'cliente-form';
  const maAviso = document.createElement('p');
  maAviso.className = 'agenda-vazia';
  maAviso.textContent = 'Cole 1 conta por linha, no formato "Nome da empresa | token_de_acesso". Isso SUBSTITUI a lista atual desse cliente.';
  const maTextarea = document.createElement('textarea');
  maTextarea.placeholder = 'Ex:\nClinica Sorriso | EAABw...token...\nOutra Empresa | EAABw...token2...';
  maTextarea.rows = 4;
  const maSalvar = document.createElement('button'); maSalvar.type = 'button'; maSalvar.textContent = 'Salvar Meta Ads';
  maSalvar.addEventListener('click', async () => {
    const linhas = maTextarea.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const tokens = linhas.map((l) => {
      const [label, token] = l.split('|').map((p) => p?.trim());
      return { label: label || 'Conta', token: token || '' };
    }).filter((t) => t.token);
    try {
      const res = await fetch(`/api/admin/tenants/${id}/integracoes/metaads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      selecionarCliente(id, nome);
    } catch (err) {
      addBubble(`Erro salvando Meta Ads: ${err.message}`, 'system');
    }
  });
  metaAdsForm.append(maAviso, maTextarea, maSalvar);
  clienteIntegracoesPainel.appendChild(metaAdsForm);

  // ---- Trello ----
  const trelloLabel = document.createElement('label'); trelloLabel.className = 'auto-label'; trelloLabel.textContent = 'Trello';
  clienteIntegracoesPainel.appendChild(trelloLabel);
  const trelloStatus = document.createElement('p');
  trelloStatus.className = 'agenda-vazia';
  trelloStatus.textContent = resumo.trello ? 'Conectado.' : 'Nao conectado.';
  clienteIntegracoesPainel.appendChild(trelloStatus);

  const trelloForm = document.createElement('div');
  trelloForm.className = 'cliente-form';
  const trApiKey = document.createElement('input'); trApiKey.placeholder = 'API Key';
  const trToken = document.createElement('input'); trToken.placeholder = 'Token'; trToken.type = 'password';
  const trSalvar = document.createElement('button'); trSalvar.type = 'button'; trSalvar.textContent = 'Salvar Trello';
  trSalvar.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/integracoes/trello`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ apiKey: trApiKey.value.trim(), token: trToken.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      selecionarCliente(id, nome);
    } catch (err) {
      addBubble(`Erro salvando Trello: ${err.message}`, 'system');
    }
  });
  trelloForm.append(trApiKey, trToken, trSalvar);
  clienteIntegracoesPainel.appendChild(trelloForm);

  // ---- Redefinir senha ----
  const senhaLabel = document.createElement('label'); senhaLabel.className = 'auto-label'; senhaLabel.textContent = 'Redefinir senha de acesso';
  clienteIntegracoesPainel.appendChild(senhaLabel);
  const senhaForm = document.createElement('div');
  senhaForm.className = 'cliente-form';
  const novaSenhaInput = document.createElement('input'); novaSenhaInput.placeholder = 'Nova senha'; novaSenhaInput.type = 'password';
  const senhaSalvar = document.createElement('button'); senhaSalvar.type = 'button'; senhaSalvar.textContent = 'Redefinir senha';
  senhaSalvar.addEventListener('click', async () => {
    if (!novaSenhaInput.value) return;
    try {
      const res = await fetch(`/api/admin/tenants/${id}/senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ novaSenha: novaSenhaInput.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      novaSenhaInput.value = '';
      addBubble(`Senha de "${nome}" redefinida.`, 'system');
    } catch (err) {
      addBubble(`Erro redefinindo senha: ${err.message}`, 'system');
    }
  });
  senhaForm.append(novaSenhaInput, senhaSalvar);
  clienteIntegracoesPainel.appendChild(senhaForm);
}
