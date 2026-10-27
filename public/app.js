const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
adicionarOlhinho(passwordInput);
const loginError = document.getElementById('loginError');
const appWindow = document.getElementById('appWindow');
const sidebarToggle = document.getElementById('sidebarToggle');
const appMain = document.querySelector('.app-main');

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
const tabBtnFollowUp = document.getElementById('tabBtnFollowUp');
const tabBtnRelatorios = document.getElementById('tabBtnRelatorios');
const tabBtnGeradorRelatorios = document.getElementById('tabBtnGeradorRelatorios');
const tabBtnIntegracoes = document.getElementById('tabBtnIntegracoes');
const tabBtnCerebro = document.getElementById('tabBtnCerebro');
const tabBtnClientes = document.getElementById('tabBtnClientes');
const tabBtnPropostasAdmin = document.getElementById('tabBtnPropostasAdmin');
const tabPainel = document.getElementById('tabPainel');
const tabAgenda = document.getElementById('tabAgenda');
const tabWhatsapp = document.getElementById('tabWhatsapp');
const tabCrm = document.getElementById('tabCrm');
const tabConversas = document.getElementById('tabConversas');
const tabBtnConversas = document.getElementById('tabBtnConversas');
const conversasBadge = document.getElementById('conversasBadge');
const tabContatos = document.getElementById('tabContatos');
const tabBtnContatos = document.getElementById('tabBtnContatos');
const tabResultados = document.getElementById('tabResultados');
const tabBtnResultados = document.getElementById('tabBtnResultados');
const tabInstagram = document.getElementById('tabInstagram');
const tabBtnInstagram = document.getElementById('tabBtnInstagram');
const tabAuto = document.getElementById('tabAuto');
const tabFollowUp = document.getElementById('tabFollowUp');
const tabRelatorios = document.getElementById('tabRelatorios');
const tabGeradorRelatorios = document.getElementById('tabGeradorRelatorios');
const tabIntegracoes = document.getElementById('tabIntegracoes');
const tabCerebro = document.getElementById('tabCerebro');
const tabClientes = document.getElementById('tabClientes');
const tabPropostasAdmin = document.getElementById('tabPropostasAdmin');

// ---------- Integracoes (Meta Ads / sistemas conectados): elementos ----------
const integracoesMetaAdsLista = document.getElementById('integracoesMetaAdsLista');
const integracoesSistemasLista = document.getElementById('integracoesSistemasLista');
const integracoesEmBreveLista = document.getElementById('integracoesEmBreveLista');
const colaboradoresWrap = document.getElementById('colaboradoresWrap');
const colabNomeInput = document.getElementById('colabNomeInput');
const colabUsuarioInput = document.getElementById('colabUsuarioInput');
const colabSenhaInput = document.getElementById('colabSenhaInput');
adicionarOlhinho(colabSenhaInput);
const colabCriarBtn = document.getElementById('colabCriarBtn');
const colabCriarErro = document.getElementById('colabCriarErro');
const colaboradoresLista = document.getElementById('colaboradoresLista');

// ---------- Clientes (admin - so super_admin ve): elementos ----------
const clienteNomeInput = document.getElementById('clienteNomeInput');
const clienteUsuarioInput = document.getElementById('clienteUsuarioInput');
const clienteSenhaInput = document.getElementById('clienteSenhaInput');
adicionarOlhinho(clienteSenhaInput);
const clienteAcessoInput = document.getElementById('clienteAcessoInput');
const clienteCriarBtn = document.getElementById('clienteCriarBtn');
const clienteCriarErro = document.getElementById('clienteCriarErro');
const clientesLista = document.getElementById('clientesLista');
const clienteIntegracoesPainel = document.getElementById('clienteIntegracoesPainel');

// ---------- Propostas (admin - assinantes do Gerador de Propostas): elementos ----------
const propAdminNomeInput = document.getElementById('propAdminNomeInput');
const propAdminUsuarioInput = document.getElementById('propAdminUsuarioInput');
const propAdminSenhaInput = document.getElementById('propAdminSenhaInput');
adicionarOlhinho(propAdminSenhaInput);
const propAdminPlanoInput = document.getElementById('propAdminPlanoInput');
const propAdminAcessoInput = document.getElementById('propAdminAcessoInput');
const propAdminCriarBtn = document.getElementById('propAdminCriarBtn');
const propAdminCriarErro = document.getElementById('propAdminCriarErro');
const propAdminLista = document.getElementById('propAdminLista');
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
adicionarOlhinho(crmOcultasSenhaInput);
const crmOcultasSenhaEntrar = document.getElementById('crmOcultasSenhaEntrar');
const crmOcultasSenhaErro = document.getElementById('crmOcultasSenhaErro');
const crmOcultasTrocarSenha = document.getElementById('crmOcultasTrocarSenha');
const crmOcultasTrocarTexto = document.getElementById('crmOcultasTrocarTexto');
const crmOcultasSenhaAtualInput = document.getElementById('crmOcultasSenhaAtualInput');
adicionarOlhinho(crmOcultasSenhaAtualInput);
const crmOcultasSenhaNovaInput = document.getElementById('crmOcultasSenhaNovaInput');
adicionarOlhinho(crmOcultasSenhaNovaInput);
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
const autoEsperaSegundos = document.getElementById('autoEsperaSegundos');
const autoHoraInicio = document.getElementById('autoHoraInicio');
const autoHoraFim = document.getElementById('autoHoraFim');
const autoHoraLimpar = document.getElementById('autoHoraLimpar');
const autoAgendarInterna = document.getElementById('autoAgendarInterna');
const autoAgendarClinicorp = document.getElementById('autoAgendarClinicorp');
const autoAgendamentoDiretoWrap = document.getElementById('autoAgendamentoDiretoWrap');
const autoAgendamentoDireto = document.getElementById('autoAgendamentoDireto');
const autoAgendamentoDiretoLabel = document.getElementById('autoAgendamentoDiretoLabel');
const autoReiniciarValor = document.getElementById('autoReiniciarValor');
const autoReiniciarUnidade = document.getElementById('autoReiniciarUnidade');
const autoResetarHistorico = document.getElementById('autoResetarHistorico');
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
// conta desativada pelo administrador: qualquer resposta 401 com `contaInativa` (ou o aviso da conexao ao
// vivo do CRM) derruba a sessao na hora - limpa o login, recarrega e mostra o aviso na tela de entrada
function sairPorContaDesativada() {
  try {
    sessionStorage.removeItem('jarvis_password');
    sessionStorage.setItem('jarvis_aviso_login', 'Sua conta foi desativada. Fale com o suporte para reativar o acesso.');
  } catch { /* sem sessionStorage: o reload abaixo ja cai na tela de login por falta de token */ }
  location.reload();
}
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await fetchOriginal(...args);
  if (res.status === 401) res.clone().json().then((d) => { if (d && d.contaInativa) sairPorContaDesativada(); }).catch(() => {});
  return res;
};
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
    if (!data.ok) return data.contaInativa ? 'conta-desativada' : null;
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
let minhasTabsHabilitadas = null; // null = tudo liberado (default); array = so essas abas
let meuPermiteColaboradores = false; // beneficio liberado pelo super_admin (aba Clientes) - ver tenants.permite_colaboradores
// Cerebro de IA e recurso pago a parte - false ate o admin liberar (super_admin sempre tem)
let meuCerebroLiberado = false;


// confirma que o token guardado ainda e valido (nao expirou, tenant continua ativo) - chamado
// no carregamento da pagina, ja que um token velho nao pode mais ser "reenviado como senha"
// pra revalidar como acontecia antes. Aproveita e guarda se esse tenant e super_admin e quais
// abas o admin liberou pra ele (ver tenantConfig.tabs_habilitadas).
async function tokenValido() {
  if (!appPassword) return false;
  try {
    const res = await fetch('/api/me', { headers: { 'x-app-password': appPassword } });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    souSuperAdmin = !!data?.superAdmin;
    minhasTabsHabilitadas = Array.isArray(data?.tabsHabilitadas) && data.tabsHabilitadas.length ? data.tabsHabilitadas : null;
    meuPermiteColaboradores = !!data?.permiteColaboradores;
    meuCerebroLiberado = !!data?.cerebroLiberado;
    return true;
  } catch {
    return false;
  }
}

// super_admin nunca fica restrito (evita o proprio dono se trancar fora sem querer) -
// tabsHabilitadas null = tudo liberado, e o comportamento de sempre pra quem o admin nao mexeu
function abaLiberada(chave) {
  return souSuperAdmin || !minhasTabsHabilitadas || minhasTabsHabilitadas.includes(chave);
}

function mostrarApp() {
  loginScreen.hidden = true;
  appWindow.hidden = false;
  tabBtnClientes.hidden = !souSuperAdmin;
  tabBtnPropostasAdmin.hidden = !souSuperAdmin;
  tabBtnPainel.hidden = !abaLiberada('painel');
  tabBtnAgenda.hidden = !abaLiberada('agenda');
  tabBtnWhatsapp.hidden = !abaLiberada('whatsapp');
  tabBtnCrm.hidden = !abaLiberada('crm');
  tabBtnConversas.hidden = !abaLiberada('crm'); // mesmas conversas do CRM, mesma permissao
  tabBtnContatos.hidden = !abaLiberada('crm'); // a base e a mesma tabela de contatos do CRM
  tabBtnResultados.hidden = !abaLiberada('crm'); // indicadores calculados sobre as conversas do CRM
  tabBtnInstagram.hidden = !abaLiberada('instagram');
  tabBtnAuto.hidden = !abaLiberada('auto');
  tabBtnFollowUp.hidden = !abaLiberada('followUp');
  tabBtnRelatorios.hidden = !abaLiberada('relatorios');
  tabBtnGeradorRelatorios.hidden = !abaLiberada('geradorRelatorios');
  tabBtnIntegracoes.hidden = !abaLiberada('integracoes');
  tabBtnCerebro.hidden = !meuCerebroLiberado;
  atualizarGruposMenu();
  atualizarCabecalhoAba(document.querySelector('.nav-btn.active')?.dataset.tab || 'painel');
  lumienAoMudarAba(document.querySelector('.nav-btn.active')?.dataset.tab || 'painel');
  // se a aba visivel por padrao (Painel) foi restringida, pula pra primeira aba liberada em
  // vez de deixar a tela em branco
  if (tabBtnPainel.hidden && !tabPainel.hidden) {
    const primeiraLiberada = [
      ['conversas', tabBtnConversas], ['agenda', tabBtnAgenda], ['whatsapp', tabBtnWhatsapp], ['crm', tabBtnCrm], ['contatos', tabBtnContatos], ['resultados', tabBtnResultados], ['instagram', tabBtnInstagram],
      ['auto', tabBtnAuto], ['followUp', tabBtnFollowUp], ['relatorios', tabBtnRelatorios], ['geradorRelatorios', tabBtnGeradorRelatorios], ['integracoes', tabBtnIntegracoes],
    ].find(([, btn]) => !btn.hidden);
    if (primeiraLiberada) mudarAba(primeiraLiberada[0]);
  }
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
  iniciarSino();
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
try {
  const avisoLogin = sessionStorage.getItem('jarvis_aviso_login');
  if (avisoLogin) { sessionStorage.removeItem('jarvis_aviso_login'); loginError.textContent = avisoLogin; }
} catch { /* sem sessionStorage */ }

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
  if (token === 'conta-desativada') {
    loginError.textContent = 'Sua conta esta desativada. Fale com o suporte para reativar o acesso.';
    return;
  }
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

// ---------- Sinalizacao: alteracao nao salva (vermelho) / salvo (verde) ----------
// qualquer botao de salvar pode ser "rastreado": quando o usuario mexe num dos campos dele, o
// botao fica vermelho e a aba no menu ganha um ponto vermelho, ate salvar com sucesso - ai o
// botao pisca verde e aparece o aviso "Salvo e atualizado" embaixo da tela
function rastrearAlteracoes(botao, campos) {
  const marcar = (ev) => { if (ev.isTrusted) marcarPendente(botao); };
  for (const el of campos) {
    if (!el) continue;
    el.addEventListener('input', marcar);
    el.addEventListener('change', marcar);
  }
}
function marcarPendente(botao) {
  botao.classList.remove('salvo');
  botao.classList.add('pendente');
  atualizarPendenciasMenu();
}
function limparPendente(botao) {
  botao.classList.remove('pendente');
  atualizarPendenciasMenu();
}
function marcarSalvo(botao, mensagem) {
  if (botao) {
    botao.classList.remove('pendente');
    botao.classList.add('salvo');
    setTimeout(() => botao.classList.remove('salvo'), 1800);
    atualizarPendenciasMenu();
  }
  mostrarAviso(mensagem || 'Salvo e atualizado', 'ok');
}
function atualizarPendenciasMenu() {
  for (const btn of document.querySelectorAll('.nav-btn[data-tab]')) {
    const id = btn.dataset.tab;
    const tab = document.getElementById(`tab${id[0].toUpperCase()}${id.slice(1)}`);
    btn.classList.toggle('pendente', !!tab?.querySelector('.pendente'));
  }
}
window.addEventListener('beforeunload', (ev) => {
  if (document.querySelector('.window-body .pendente')) { ev.preventDefault(); ev.returnValue = ''; }
});

let avisoTimer = null;
function mostrarAviso(texto, tipo = 'ok') {
  let el = document.getElementById('avisoFlutuante');
  if (!el) {
    el = document.createElement('div');
    el.id = 'avisoFlutuante';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = `aviso-flutuante ${tipo}`;
  el.textContent = `${tipo === 'ok' ? '✓' : '!'} ${texto}`;
  el.classList.add('visivel');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.remove('visivel'), 3200);
}

// titulo grande no topo de cada aba (etiqueta + titulo + descricao), no lugar de cada aba
// repetir o proprio cabecalho
const CABECALHOS_ABA = {
  painel: ['Início', 'Painel da Lumia', 'Converse com a Lumia e acompanhe o sistema em tempo real.'],
  agenda: ['Atendimento', 'Agenda', 'Compromissos e agendamentos, integrados ao Google Agenda.'],
  whatsapp: ['Atendimento', 'WhatsApp', 'Números conectados e status de cada instância.'],
  followUp: ['Atendimento', 'Follow Up', 'Retome automaticamente os leads que pararam de responder.'],
  conversas: ['Atendimento', 'Conversas', 'Atenda o WhatsApp direto pela Lumia, em tempo real.'],
  crm: ['Clientes', 'CRM', 'Seus leads em cada etapa do funil, com a conversa do WhatsApp.'],
  contatos: ['Clientes', 'Contatos', 'Toda a sua base de leads: cadastre, importe e exporte planilhas.'],
  instagram: ['Redes sociais', 'Instagram', 'Publique e agende posts, responda comentários e atenda o direct.'],
  resultados: ['Clientes', 'Resultados', 'Como está o atendimento: volume, velocidade de resposta e conversão do funil.'],
  auto: ['Automação', 'Auto Atendimento', 'Configure a IA que atende os contatos no WhatsApp.'],
  relatorios: ['Automação', 'Relatórios automáticos', 'Relatórios enviados sozinhos no WhatsApp, na frequência que você escolher.'],
  geradorRelatorios: ['Automação', 'Gerador de Relatórios', 'Relatórios de performance prontos pra mandar pro cliente.'],
  integracoes: ['Configurações', 'Integrações', 'Conecte as ferramentas e gerencie os colaboradores.'],
  cerebro: ['Administração', 'Cérebro', 'A memória viva da Lumia.'],
  clientes: ['Administração', 'Clientes', 'Contas que usam a Lumia.'],
  propostasAdmin: ['Administração', 'Gerador de Propostas', 'Propostas comerciais e assinaturas.'],
};
function atualizarCabecalhoAba(aba) {
  const cab = CABECALHOS_ABA[aba];
  const el = document.getElementById('pageHeader');
  if (!el) return;
  el.hidden = !cab || aba === 'cerebro' || aba === 'conversas'; // telas de tela cheia
  if (!cab) return;
  document.getElementById('pageHeaderEtiqueta').textContent = cab[0];
  document.getElementById('pageHeaderTitulo').textContent = cab[1];
  document.getElementById('pageHeaderSub').textContent = cab[2];
}

// esconde o titulo de grupo do menu quando nenhum item dele esta visivel pra essa conta
// (ex: grupo Administracao so aparece pro dono)
function atualizarGruposMenu() {
  for (const grupo of document.querySelectorAll('.nav-grupo')) {
    let el = grupo.nextElementSibling;
    let algumVisivel = false;
    while (el && !el.classList.contains('nav-grupo')) {
      if (el.classList.contains('nav-btn') && !el.hidden) algumVisivel = true;
      el = el.nextElementSibling;
    }
    grupo.hidden = !algumVisivel;
  }
}

// ---------- Abas: Painel / Agenda / WhatsApp ----------
function mudarAba(aba) {
  atualizarCabecalhoAba(aba);
  lumienAoMudarAba(aba);
  atualizarGruposMenu();
  tabPainel.hidden = aba !== 'painel';
  tabAgenda.hidden = aba !== 'agenda';
  tabWhatsapp.hidden = aba !== 'whatsapp';
  tabCrm.hidden = aba !== 'crm';
  tabConversas.hidden = aba !== 'conversas';
  tabContatos.hidden = aba !== 'contatos';
  tabResultados.hidden = aba !== 'resultados';
  tabInstagram.hidden = aba !== 'instagram';
  tabAuto.hidden = aba !== 'auto';
  tabFollowUp.hidden = aba !== 'followUp';
  tabRelatorios.hidden = aba !== 'relatorios';
  tabGeradorRelatorios.hidden = aba !== 'geradorRelatorios';
  tabIntegracoes.hidden = aba !== 'integracoes';
  tabCerebro.hidden = aba !== 'cerebro';
  tabClientes.hidden = aba !== 'clientes';
  tabPropostasAdmin.hidden = aba !== 'propostasAdmin';
  tabBtnPainel.classList.toggle('active', aba === 'painel');
  tabBtnAgenda.classList.toggle('active', aba === 'agenda');
  tabBtnWhatsapp.classList.toggle('active', aba === 'whatsapp');
  tabBtnCrm.classList.toggle('active', aba === 'crm');
  tabBtnConversas.classList.toggle('active', aba === 'conversas');
  tabBtnContatos.classList.toggle('active', aba === 'contatos');
  tabBtnResultados.classList.toggle('active', aba === 'resultados');
  tabBtnInstagram.classList.toggle('active', aba === 'instagram');
  tabBtnAuto.classList.toggle('active', aba === 'auto');
  tabBtnFollowUp.classList.toggle('active', aba === 'followUp');
  tabBtnRelatorios.classList.toggle('active', aba === 'relatorios');
  tabBtnGeradorRelatorios.classList.toggle('active', aba === 'geradorRelatorios');
  tabBtnIntegracoes.classList.toggle('active', aba === 'integracoes');
  tabBtnCerebro.classList.toggle('active', aba === 'cerebro');
  tabBtnClientes.classList.toggle('active', aba === 'clientes');
  tabBtnPropostasAdmin.classList.toggle('active', aba === 'propostasAdmin');
  if (aba === 'agenda') {
    carregarStatusGoogleAgenda();
    carregarEventosAgenda();
  } else if (aba === 'whatsapp') {
    carregarStatusWhatsapp();
    carregarInstanciasWhatsapp();
  } else if (aba === 'crm') {
    carregarCrm();
  } else if (aba === 'conversas') {
    carregarConversas();
  } else if (aba === 'contatos') {
    carregarContatos();
  } else if (aba === 'resultados') {
    carregarResultados();
  } else if (aba === 'instagram') {
    carregarInstagram();
  } else if (aba === 'auto') {
    carregarConfigAutoAtendimento();
  } else if (aba === 'followUp') {
    carregarFollowUp();
  } else if (aba === 'relatorios') {
    carregarDestinatariosRelatorios();
    carregarConfigsRelatorios();
  } else if (aba === 'geradorRelatorios') {
    iniciarGeradorRelatorios();
  } else if (aba === 'integracoes') {
    carregarIntegracoes();
    carregarColaboradores();
  } else if (aba === 'clientes') {
    carregarClientes();
  } else if (aba === 'propostasAdmin') {
    carregarPropostasAssinantes();
  }
  // o polling do CRM (contatos + conversa aberta) so deve rodar com a aba visivel, senao fica
  // batendo na API/banco a toa em segundo plano pra sempre
  pararPollingCrm();
  if (aba === 'crm') iniciarPollingCrm();
  if (aba === 'conversas') {
    conectarEventosCrm();
    crmPollingContatos = setInterval(carregarConversas, 20000); // rede de seguranca do SSE
  }
  fecharSidebarMobile(); // no celular, escolher uma aba ja fecha a gaveta sozinho
  // o grafo 3D do Cerebro para de renderizar quando a aba nao esta visivel (nao gasta GPU/bateria a toa)
  if (aba === 'cerebro') abrirCerebro();
  else if (window.cerebroPausar) window.cerebroPausar();
}

// cerebro.js (+ a biblioteca do grafo 3D) so e baixado na PRIMEIRA vez que a aba e aberta -
// quem nunca abre (ex: cliente que nao contratou) nao baixa nada e o app continua leve
let cerebroCarregando = null;
function abrirCerebro() {
  if (window.cerebroAbrir) return window.cerebroAbrir(tabCerebro, appPassword);
  if (!cerebroCarregando) {
    cerebroCarregando = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/cerebro.js?v=10';
      s.onload = resolve;
      s.onerror = () => { cerebroCarregando = null; reject(new Error('falha ao carregar o Cerebro')); };
      document.head.appendChild(s);
    });
  }
  cerebroCarregando
    .then(() => { if (!tabCerebro.hidden) window.cerebroAbrir(tabCerebro, appPassword); })
    .catch((err) => addBubble(err.message, 'system'));
}

// ---------- Barra lateral em tela estreita (gaveta) ----------
function abrirSidebarMobile() { appWindow.classList.add('sidebar-aberta'); }
function fecharSidebarMobile() { appWindow.classList.remove('sidebar-aberta'); }
sidebarToggle.addEventListener('click', () => {
  appWindow.classList.contains('sidebar-aberta') ? fecharSidebarMobile() : abrirSidebarMobile();
});
// clicar no fundo escurecido (fora da gaveta) fecha ela - o proprio conteudo da aba continua
// clicavel normalmente quando a gaveta esta fechada, esse listener so age enquanto ela ta aberta
appMain.addEventListener('click', () => {
  if (appWindow.classList.contains('sidebar-aberta')) fecharSidebarMobile();
});

tabBtnPainel.addEventListener('click', () => mudarAba('painel'));
tabBtnAgenda.addEventListener('click', () => mudarAba('agenda'));
tabBtnWhatsapp.addEventListener('click', () => mudarAba('whatsapp'));
tabBtnCrm.addEventListener('click', () => mudarAba('crm'));
tabBtnConversas.addEventListener('click', () => mudarAba('conversas'));
tabBtnContatos.addEventListener('click', () => mudarAba('contatos'));
tabBtnResultados.addEventListener('click', () => mudarAba('resultados'));
tabBtnInstagram.addEventListener('click', () => mudarAba('instagram'));
tabBtnRelatorios.addEventListener('click', () => mudarAba('relatorios'));
tabBtnGeradorRelatorios.addEventListener('click', () => mudarAba('geradorRelatorios'));
tabBtnAuto.addEventListener('click', () => mudarAba('auto'));
tabBtnFollowUp.addEventListener('click', () => mudarAba('followUp'));
tabBtnIntegracoes.addEventListener('click', () => mudarAba('integracoes'));
tabBtnCerebro.addEventListener('click', () => mudarAba('cerebro'));
tabBtnClientes.addEventListener('click', () => mudarAba('clientes'));
tabBtnPropostasAdmin.addEventListener('click', () => mudarAba('propostasAdmin'));

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

rastrearAlteracoes(waAdminSalvar, [waAdminInput]);
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
    marcarSalvo(waAdminSalvar, 'Número autorizado atualizado');
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

  if (contato.retorno_hoje) card.classList.add('crm-card-retorno-hoje');
  if (contato.nao_lida) {
    const ponto = document.createElement('span');
    ponto.className = 'crm-card-nao-lida';
    ponto.title = 'Mensagem nova';
    nome.appendChild(ponto);
  }
  if (contato.retorno_em) {
    const ret = document.createElement('div');
    ret.className = `crm-card-retorno${contato.retorno_hoje ? ' hoje' : ''}`;
    ret.textContent = `⏰ ${contato.retorno_hoje ? 'Retorno HOJE' : 'Retorno'} ${crmFormatarRetorno(contato.retorno_em)}`;
    if (contato.retorno_nota) ret.title = contato.retorno_nota;
    card.appendChild(ret);
  }
  // pre-agendamento combinado pela IA, aguardando a atendente confirmar (dia/hora/medico)
  if (contato.etapa === 'pre_agendado' && contato.pre_agendamento) {
    const pa = contato.pre_agendamento;
    const [ano, mes, dia] = (pa.data || '').split('-');
    const pre = document.createElement('div');
    pre.className = 'crm-card-preagendamento';
    pre.textContent = `📅 ${dia && mes ? `${dia}/${mes}` : (pa.data || '')} ${pa.de || ''}${pa.medico ? ` - ${pa.medico}` : ''} · aguardando confirmação`;
    pre.title = [pa.paciente && `Paciente: ${pa.paciente}`, pa.telefone && `Telefone: ${pa.telefone}`, pa.resumo && `Resumo: ${pa.resumo}`].filter(Boolean).join(' | ');
    card.appendChild(pre);
  }

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
    if (crmContatoAberto) {
      const atualizado = (data.contatos || []).find((c) => c.id === crmContatoAberto.id);
      if (atualizado) {
        crmContatoAberto = { ...crmContatoAberto, ...atualizado };
        crmAtualizarRetorno();
        crmAtualizarBotaoPausar();
      }
    }
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
    if (data.tipo === 'conta-inativa') { sairPorContaDesativada(); return; }
    if (!tabConversas.hidden) { cvTratarEvento(data); atualizarSino(); return; }
    if (data.tipo === 'mensagem') {
      carregarCrm(); // preview/ordem dos cards muda a cada mensagem nova
      if (crmContatoAberto && data.numero === crmContatoAberto.numero && data.instancia === crmContatoAberto.instancia) {
        carregarMensagensCrm();
        crmMarcarLido(crmContatoAberto.id);
      }
      atualizarSino();
    } else if (data.tipo === 'contato-atualizado') {
      carregarCrm();
      atualizarSino();
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
function crmRenderizarMensagens(mensagens, log = crmConversaLog) {
  log.textContent = '';
  let ultimaDataSeparador = null;

  for (const m of mensagens) {
    const separador = crmFormatarSeparadorData(m.criado_em);
    if (separador && separador !== ultimaDataSeparador) {
      const sep = document.createElement('div');
      sep.className = 'crm-msg-data-separador';
      sep.textContent = separador;
      log.appendChild(sep);
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

    log.appendChild(bubble);
  }
  log.scrollTop = log.scrollHeight;
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
  crmAtualizarRetorno();
  crmRetornoPainel.hidden = true;
  crmMarcarLido(contato.id);
  carregarMensagensCrm();
  pararPollingConversaCrm();
  // o SSE (conectarEventosCrm) e a fonte principal de atualizacao em tempo real - isso aqui e
  // so uma rede de seguranca bem espacada, caso a conexao caia sem reconectar
  crmPollingConversa = setInterval(carregarMensagensCrm, 20000);
}

// ---------- Conversas (caixa de entrada estilo WhatsApp) ----------
// mesma base do CRM (crm_contatos/crm_mensagens + tempo real via /api/crm/eventos), so que no
// formato lista + conversa, pra atendente trabalhar o dia todo pelo app como no WhatsApp Web.
// Tudo que sai daqui vai pelo mesmo numero (instancia) do contato, e o que o dono responde pelo
// celular tambem aparece aqui (o webhook registra os "fromMe" como saida).
const cvBusca = document.getElementById('cvBusca');
const cvFiltros = document.getElementById('cvFiltros');
const cvInstancia = document.getElementById('cvInstancia');
const cvLista = document.getElementById('cvLista');
const cvVazio = document.getElementById('cvVazio');
const cvChatInner = document.getElementById('cvChatInner');
const cvVoltar = document.getElementById('cvVoltar');
const cvAvatar = document.getElementById('cvAvatar');
const cvNome = document.getElementById('cvNome');
const cvSub = document.getElementById('cvSub');
const cvEtapa = document.getElementById('cvEtapa');
const cvIaBtn = document.getElementById('cvIaBtn');
const cvLog = document.getElementById('cvLog');
const cvAnexoPreview = document.getElementById('cvAnexoPreview');
const cvAnexoNome = document.getElementById('cvAnexoNome');
const cvAnexoLegenda = document.getElementById('cvAnexoLegenda');
const cvAnexoCancelar = document.getElementById('cvAnexoCancelar');
const cvAnexoEnviar = document.getElementById('cvAnexoEnviar');
const cvForm = document.getElementById('cvForm');
const cvAnexarBtn = document.getElementById('cvAnexarBtn');
const cvArquivo = document.getElementById('cvArquivo');
const cvTexto = document.getElementById('cvTexto');
const cvGravarBtn = document.getElementById('cvGravarBtn');
const cvEnviarBtn = document.getElementById('cvEnviarBtn');
const cvErro = document.getElementById('cvErro');

let cvContatos = [];
let cvEtapas = [];
let cvAberto = null;
let cvFiltro = 'todas';
let cvAnexo = null; // { file, tipo }
let cvGravador = null; // { recorder, partes, stream }

const CV_LIMITE_ARQUIVO = 14 * 1024 * 1024; // em base64 vira ~19mb, dentro dos 20mb do servidor

function cvHoraLista(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const rotulo = crmFormatarSeparadorData(iso);
  if (rotulo === 'Hoje') return crmFormatarHora(iso);
  if (rotulo === 'Ontem') return 'Ontem';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit' });
}

// contato do Instagram: "numero" e o id interno da pessoa no Instagram, nao um telefone
const ehInstagram = (c) => String(c?.instancia || '').startsWith('ig:');
const rotuloContato = (c) => (ehInstagram(c) ? 'Contato do Instagram' : `+${c.numero}`);

function cvIniciais(c) {
  const base = (c.nome || '').trim();
  if (!base) return '#';
  const partes = base.split(/\s+/);
  return ((partes[0][0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function cvMostrarErro(msg) {
  cvErro.textContent = msg;
  cvErro.hidden = !msg;
}

function atualizarBadgeConversas(qtd) {
  conversasBadge.textContent = qtd > 99 ? '99+' : String(qtd);
  conversasBadge.hidden = !qtd;
}

async function carregarConversas() {
  try {
    const res = await fetch('/api/crm/contatos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    cvContatos = data.contatos || [];
    cvEtapas = data.etapas || [];

    const instancias = [...new Set(cvContatos.map((c) => c.instancia))].sort();
    const atual = cvInstancia.value;
    cvInstancia.textContent = '';
    cvInstancia.appendChild(new Option('Todos os números', ''));
    for (const i of instancias) cvInstancia.appendChild(new Option(i.startsWith('ig:') ? `Instagram @${i.slice(3)}` : i, i));
    cvInstancia.value = instancias.includes(atual) ? atual : '';
    cvInstancia.hidden = instancias.length < 2;

    if (cvAberto) {
      const novo = cvContatos.find((c) => c.id === cvAberto.id);
      if (novo) { cvAberto = { ...novo, nao_lida: false }; cvAtualizarTopo(); }
    }
    renderizarListaConversas();
    atualizarBadgeConversas(cvContatos.filter((c) => c.nao_lida && c.id !== cvAberto?.id).length);
  } catch (err) {
    cvLista.textContent = '';
    const p = document.createElement('p');
    p.className = 'agenda-vazia';
    p.textContent = `Nao consegui carregar as conversas: ${err.message}`;
    cvLista.appendChild(p);
  }
}

function renderizarListaConversas() {
  const termo = cvBusca.value.trim().toLowerCase();
  const soDigitos = termo.replace(/\D/g, '');
  const lista = cvContatos.filter((c) => {
    if (cvInstancia.value && c.instancia !== cvInstancia.value) return false;
    if (cvFiltro === 'naoLidas' && !(c.nao_lida && c.id !== cvAberto?.id)) return false;
    if (cvFiltro === 'ia' && c.auto_pausado) return false;
    if (cvFiltro === 'humano' && !c.auto_pausado) return false;
    if (!termo) return true;
    return (c.nome || '').toLowerCase().includes(termo)
      || (soDigitos && c.numero.includes(soDigitos))
      || (c.ultima_mensagem || '').toLowerCase().includes(termo);
  });

  cvLista.textContent = '';
  if (!lista.length) {
    const vazio = document.createElement('div');
    vazio.className = 'cv-lista-vazia';
    vazio.textContent = cvContatos.length ? 'Nenhuma conversa com esse filtro.' : 'Nenhuma conversa ainda. Quando alguém mandar mensagem no WhatsApp conectado, aparece aqui.';
    cvLista.appendChild(vazio);
    return;
  }

  const nomeEtapa = Object.fromEntries(cvEtapas.map((e) => [e.id, e.nome]));
  for (const c of lista) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'cv-item';
    const naoLida = !!c.nao_lida && c.id !== cvAberto?.id;
    item.classList.toggle('ativo', c.id === cvAberto?.id);
    item.classList.toggle('nao-lida', naoLida);

    const avatar = document.createElement('div');
    avatar.className = 'cv-avatar';
    avatar.textContent = cvIniciais(c);

    const meio = document.createElement('div');
    meio.className = 'cv-item-meio';
    const linha1 = document.createElement('div');
    linha1.className = 'cv-item-linha';
    const nome = document.createElement('strong');
    nome.textContent = c.nome || rotuloContato(c);
    const hora = document.createElement('span');
    hora.className = 'cv-item-hora';
    hora.textContent = cvHoraLista(c.ultima_mensagem_em);
    linha1.append(nome, hora);

    const linha2 = document.createElement('div');
    linha2.className = 'cv-item-linha';
    const preview = document.createElement('span');
    preview.className = 'cv-item-preview';
    preview.textContent = c.ultima_mensagem || '';
    linha2.appendChild(preview);
    if (naoLida) {
      const ponto = document.createElement('span');
      ponto.className = 'cv-item-badge';
      ponto.textContent = '●';
      linha2.appendChild(ponto);
    }

    const tags = document.createElement('div');
    tags.className = 'cv-item-tags';
    const etapa = document.createElement('span');
    etapa.className = 'cv-tag';
    etapa.textContent = nomeEtapa[c.etapa] || c.etapa;
    tags.appendChild(etapa);
    if (c.auto_pausado) {
      const ia = document.createElement('span');
      ia.className = 'cv-tag cv-tag-humano';
      ia.textContent = 'IA pausada';
      tags.appendChild(ia);
    }
    if (c.retorno_hoje) {
      const ret = document.createElement('span');
      ret.className = 'cv-tag cv-tag-alerta';
      ret.textContent = 'Retorno hoje';
      tags.appendChild(ret);
    }

    meio.append(linha1, linha2, tags);
    item.append(avatar, meio);
    item.addEventListener('click', () => abrirConversa(c));
    cvLista.appendChild(item);
  }
}

function cvAtualizarTopo() {
  const c = cvAberto;
  if (!c) return;
  cvAvatar.textContent = cvIniciais(c);
  cvNome.textContent = c.nome || rotuloContato(c);
  cvSub.textContent = ehInstagram(c) ? `Instagram · @${c.instancia.slice(3)}` : `+${c.numero} · ${c.instancia}`;
  // Instagram: resposta pela Lumia so em texto por enquanto
  cvAnexarBtn.hidden = ehInstagram(c);
  cvGravarBtn.hidden = ehInstagram(c);
  cvEtapa.textContent = '';
  for (const e of cvEtapas) cvEtapa.appendChild(new Option(e.nome, e.id));
  cvEtapa.value = c.etapa;
  cvIaBtn.textContent = c.auto_pausado ? 'IA pausada' : 'IA atendendo';
  cvIaBtn.classList.toggle('pausada', !!c.auto_pausado);
  cvIaBtn.title = c.auto_pausado
    ? 'A IA não responde esta conversa - clique para ela voltar a atender'
    : 'A IA está respondendo esta conversa - clique para pausar e atender você mesmo';
}

function abrirConversa(contato) {
  const trocou = cvAberto?.id !== contato.id;
  cvAberto = { ...contato, nao_lida: false };
  cvVazio.hidden = true;
  cvChatInner.hidden = false;
  tabConversas.classList.add('cv-com-chat');
  cvMostrarErro('');
  cvAtualizarTopo();
  if (trocou) {
    cvLog.textContent = '';
    cvCancelarAnexo();
  }
  crmMarcarLido(contato.id);
  const local = cvContatos.find((c) => c.id === contato.id);
  if (local) local.nao_lida = false;
  renderizarListaConversas();
  atualizarBadgeConversas(cvContatos.filter((c) => c.nao_lida && c.id !== cvAberto.id).length);
  carregarMensagensConversa();
  if (window.matchMedia('(min-width: 900px)').matches) cvTexto.focus();
}

function fecharConversa() {
  cvAberto = null;
  cvChatInner.hidden = true;
  cvVazio.hidden = false;
  tabConversas.classList.remove('cv-com-chat');
  renderizarListaConversas();
}

async function carregarMensagensConversa() {
  if (!cvAberto) return;
  const pedido = cvAberto.id;
  try {
    const params = new URLSearchParams({ numero: cvAberto.numero, instancia: cvAberto.instancia });
    const res = await fetch(`/api/crm/mensagens?${params}`, { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    if (cvAberto?.id !== pedido) return; // trocou de conversa enquanto carregava
    crmRenderizarMensagens(data.mensagens || [], cvLog);
  } catch (err) {
    cvMostrarErro(`Nao consegui carregar a conversa: ${err.message}`);
  }
}

// tempo real: chamado pelo SSE do CRM (conectarEventosCrm) enquanto a aba Conversas esta aberta
function cvTratarEvento(data) {
  if (data.tipo === 'mensagem') {
    if (cvAberto && data.numero === cvAberto.numero && data.instancia === cvAberto.instancia) {
      carregarMensagensConversa();
      crmMarcarLido(cvAberto.id);
    }
    carregarConversas();
  } else if (data.tipo === 'contato-atualizado') {
    if (data.apagado && cvAberto?.id === data.contatoId) fecharConversa();
    carregarConversas();
  }
}

cvBusca.addEventListener('input', renderizarListaConversas);
cvInstancia.addEventListener('change', renderizarListaConversas);
cvFiltros.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.cv-filtro');
  if (!btn) return;
  cvFiltro = btn.dataset.filtro;
  for (const b of cvFiltros.querySelectorAll('.cv-filtro')) b.classList.toggle('ativo', b === btn);
  renderizarListaConversas();
});
cvVoltar.addEventListener('click', fecharConversa);

cvEtapa.addEventListener('change', async () => {
  if (!cvAberto) return;
  const etapa = cvEtapa.value;
  try {
    const res = await fetch(`/api/crm/contatos/${cvAberto.id}/etapa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ etapa }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    cvAberto.etapa = etapa;
    mostrarAviso(`Movido para "${cvEtapa.selectedOptions[0]?.textContent || etapa}"`);
    carregarConversas();
  } catch (err) {
    cvEtapa.value = cvAberto.etapa;
    mostrarAviso(`Não consegui mudar a etapa: ${err.message}`, 'erro');
  }
});

cvIaBtn.addEventListener('click', async () => {
  if (!cvAberto) return;
  const pausado = !cvAberto.auto_pausado;
  cvIaBtn.disabled = true;
  try {
    const res = await fetch(`/api/crm/contatos/${cvAberto.id}/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ pausado }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    cvAberto.auto_pausado = pausado;
    cvAtualizarTopo();
    mostrarAviso(pausado ? 'IA pausada nesta conversa - agora é com você' : 'IA voltou a atender esta conversa');
    carregarConversas();
  } catch (err) {
    mostrarAviso(`Não consegui mudar: ${err.message}`, 'erro');
  } finally {
    cvIaBtn.disabled = false;
  }
});

// texto: Enter envia, Shift+Enter quebra linha (igual WhatsApp Web); a caixa cresce ate ~6 linhas
function cvAjustarAltura() {
  cvTexto.style.height = 'auto';
  cvTexto.style.height = `${Math.min(cvTexto.scrollHeight, 140)}px`;
}
cvTexto.addEventListener('input', cvAjustarAltura);
cvTexto.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    cvForm.requestSubmit();
  }
});

cvForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!cvAberto) return;
  const texto = cvTexto.value.trim();
  if (!texto) return;
  cvMostrarErro('');
  cvEnviarBtn.disabled = true;
  try {
    const res = await fetch('/api/crm/mensagens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ numero: cvAberto.numero, instancia: cvAberto.instancia, texto }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    cvTexto.value = '';
    cvAjustarAltura();
    carregarMensagensConversa();
  } catch (err) {
    cvMostrarErro(`Não enviou: ${err.message}`);
  } finally {
    cvEnviarBtn.disabled = false;
    cvTexto.focus();
  }
});

// anexo: foto/video/documento -> barra de confirmacao com legenda antes de mandar
function cvTipoDoArquivo(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}
function cvCancelarAnexo() {
  cvAnexo = null;
  cvAnexoPreview.hidden = true;
  cvAnexoLegenda.value = '';
}
cvAnexarBtn.addEventListener('click', () => cvArquivo.click());
cvArquivo.addEventListener('change', () => {
  const file = cvArquivo.files?.[0];
  cvArquivo.value = '';
  if (!file) return;
  if (file.size > CV_LIMITE_ARQUIVO) {
    cvMostrarErro('Arquivo grande demais (máximo 14 MB).');
    return;
  }
  cvMostrarErro('');
  cvAnexo = { file, tipo: cvTipoDoArquivo(file) };
  const icone = { image: '🖼️', video: '🎥', audio: '🎵', document: '📄' }[cvAnexo.tipo];
  cvAnexoNome.textContent = `${icone} ${file.name}`;
  cvAnexoLegenda.hidden = cvAnexo.tipo === 'audio';
  cvAnexoPreview.hidden = false;
  if (!cvAnexoLegenda.hidden) cvAnexoLegenda.focus();
});
cvAnexoCancelar.addEventListener('click', cvCancelarAnexo);
cvAnexoLegenda.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); cvAnexoEnviar.click(); }
});

async function cvEnviarMidia({ tipo, base64, mimetype, fileName, legenda }) {
  const res = await fetch('/api/crm/mensagens/midia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
    body: JSON.stringify({ numero: cvAberto.numero, instancia: cvAberto.instancia, tipo, base64, mimetype, fileName, legenda }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
  carregarMensagensConversa();
}

cvAnexoEnviar.addEventListener('click', async () => {
  if (!cvAnexo || !cvAberto) return;
  cvAnexoEnviar.disabled = true;
  cvAnexoEnviar.textContent = 'Enviando...';
  cvMostrarErro('');
  try {
    const { file, tipo } = cvAnexo;
    const base64 = await arquivoParaBase64(file);
    await cvEnviarMidia({ tipo, base64, mimetype: file.type || 'application/octet-stream', fileName: file.name, legenda: cvAnexoLegenda.value.trim() });
    cvCancelarAnexo();
  } catch (err) {
    cvMostrarErro(`Não enviou o arquivo: ${err.message}`);
  } finally {
    cvAnexoEnviar.disabled = false;
    cvAnexoEnviar.textContent = 'Enviar';
  }
});

// audio: 1o clique comeca a gravar (botao fica vermelho), 2o clique para e manda como nota de voz
// (o Evolution converte pro formato do WhatsApp)
cvGravarBtn.addEventListener('click', async () => {
  if (!cvAberto) return;
  if (cvGravador) { cvGravador.recorder.stop(); return; }
  cvMostrarErro('');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    cvMostrarErro(`Não consegui usar o microfone: ${err.message}`);
    return;
  }
  const tipoPreferido = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  const recorder = new MediaRecorder(stream, tipoPreferido ? { mimeType: tipoPreferido } : undefined);
  const partes = [];
  cvGravador = { recorder, partes, stream };
  recorder.addEventListener('dataavailable', (e) => { if (e.data.size) partes.push(e.data); });
  recorder.addEventListener('stop', async () => {
    stream.getTracks().forEach((t) => t.stop());
    cvGravador = null;
    cvGravarBtn.classList.remove('gravando');
    cvGravarBtn.textContent = '🎤';
    cvGravarBtn.title = 'Gravar áudio';
    const blob = new Blob(partes, { type: recorder.mimeType || 'audio/webm' });
    if (blob.size < 1500) return; // clique sem querer, nada gravado
    cvGravarBtn.disabled = true;
    try {
      const base64 = await arquivoParaBase64(blob);
      await cvEnviarMidia({ tipo: 'audio', base64, mimetype: blob.type.split(';')[0], fileName: 'audio' });
    } catch (err) {
      cvMostrarErro(`Não enviou o áudio: ${err.message}`);
    } finally {
      cvGravarBtn.disabled = false;
    }
  });
  recorder.start();
  cvGravarBtn.classList.add('gravando');
  cvGravarBtn.textContent = '⏹';
  cvGravarBtn.title = 'Parar e enviar o áudio';
});

// ---------- Contatos (base de leads: lista, cadastro, importar e exportar planilha) ----------
// mesma tabela de contatos do CRM - aqui aparecem tambem os importados/cadastrados que ainda nao
// conversaram (esses ficam fora do funil e da aba Conversas ate a primeira mensagem)
const ctBusca = document.getElementById('ctBusca');
const ctEtapa = document.getElementById('ctEtapa');
const ctEtiqueta = document.getElementById('ctEtiqueta');
const ctOrigem = document.getElementById('ctOrigem');
const ctResumo = document.getElementById('ctResumo');
const ctCorpo = document.getElementById('ctCorpo');
const ctMaisBtn = document.getElementById('ctMaisBtn');
const ctModal = document.getElementById('ctModal');
const ctForm = document.getElementById('ctForm');
const ctModalTitulo = document.getElementById('ctModalTitulo');
const ctNome = document.getElementById('ctNome');
const ctCampoNovo = document.getElementById('ctCampoNovo');
const ctNumero = document.getElementById('ctNumero');
const ctInstanciaCad = document.getElementById('ctInstanciaCad');
const ctInstanciaCadLabel = document.getElementById('ctInstanciaCadLabel');
const ctInfoNumero = document.getElementById('ctInfoNumero');
const ctEmail = document.getElementById('ctEmail');
const ctEtiquetas = document.getElementById('ctEtiquetas');
const ctObs = document.getElementById('ctObs');
const ctModalErro = document.getElementById('ctModalErro');
const ctApagarBtn = document.getElementById('ctApagarBtn');
const ctConversarBtn = document.getElementById('ctConversarBtn');
const ctSalvarBtn = document.getElementById('ctSalvarBtn');
const ctImpModal = document.getElementById('ctImpModal');
const ctImpArquivo = document.getElementById('ctImpArquivo');
const ctImpPasso1 = document.getElementById('ctImpPasso1');
const ctImpPasso2 = document.getElementById('ctImpPasso2');
const ctImpInfo = document.getElementById('ctImpInfo');
const ctImpMapa = document.getElementById('ctImpMapa');
const ctImpInstancia = document.getElementById('ctImpInstancia');
const ctImpEtiquetaExtra = document.getElementById('ctImpEtiquetaExtra');
const ctImpModo = document.getElementById('ctImpModo');
const ctImpResumo = document.getElementById('ctImpResumo');
const ctImpPrevia = document.getElementById('ctImpPrevia');
const ctImpResultado = document.getElementById('ctImpResultado');
const ctImpErro = document.getElementById('ctImpErro');
const ctImpVoltar = document.getElementById('ctImpVoltar');
const ctImpConfirmar = document.getElementById('ctImpConfirmar');

const CT_POR_PAGINA = 200;
const CT_ORIGENS = { whatsapp: 'WhatsApp', importado: 'Importado', manual: 'Cadastrado' };
// campos que a importacao entende, com os nomes de coluna que costumam aparecer nas planilhas
// (comparados sem acento/maiuscula) - o cabecalho da propria exportacao sempre bate
const CT_CAMPOS_IMPORTACAO = [
  { id: 'numero', nome: 'Telefone', obrigatorio: true, apelidos: ['telefone', 'celular', 'whatsapp', 'numero', 'fone', 'tel', 'phone', 'contato', 'telefone celular', 'numero do whatsapp'] },
  { id: 'nome', nome: 'Nome', apelidos: ['nome', 'nome completo', 'cliente', 'paciente', 'lead', 'name'] },
  { id: 'email', nome: 'E-mail', apelidos: ['email', 'e-mail', 'mail'] },
  { id: 'etiquetas', nome: 'Etiquetas', apelidos: ['etiquetas', 'etiqueta', 'tags', 'tag', 'grupo', 'segmento'] },
  { id: 'observacoes', nome: 'Observações', apelidos: ['observacoes', 'observacao', 'obs', 'notas', 'anotacoes', 'comentarios'] },
  { id: 'etapa', nome: 'Etapa', apelidos: ['etapa', 'status', 'fase', 'estagio'] },
];

let ctContatos = [];
let ctEtapas = [];
let ctInstancias = [];
let ctLimite = CT_POR_PAGINA;
let ctEditando = null;
let ctImpLinhas = []; // linhas da planilha (array de arrays, sem o cabecalho)
let ctImpCabecalho = [];

const ctSemAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function ctFormatarTelefone(numero, instancia) {
  if (String(instancia || '').startsWith('ig:')) return `Instagram @${instancia.slice(3)}`;
  const n = String(numero || '');
  let m = n.match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
  m = n.match(/^55(\d{2})(\d{4})(\d{4})$/);
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
  return n ? `+${n}` : '';
}

// mesma regra do servidor (crm.normalizarTelefone) - aqui so pra previa e contagem
function ctNormalizarTelefone(bruto) {
  let d = String(bruto ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

async function carregarContatos() {
  try {
    const res = await fetch('/api/crm/base-contatos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    ctContatos = data.contatos || [];
    ctEtapas = data.etapas || [];
    ctInstancias = data.instancias || [];

    const etapaAtual = ctEtapa.value;
    ctEtapa.textContent = '';
    ctEtapa.appendChild(new Option('Todas as etapas', ''));
    for (const e of ctEtapas) ctEtapa.appendChild(new Option(e.nome, e.id));
    ctEtapa.value = etapaAtual;

    const etiquetas = new Map();
    for (const c of ctContatos) for (const t of c.etiquetas || []) if (!etiquetas.has(t.toLowerCase())) etiquetas.set(t.toLowerCase(), t);
    const etiquetaAtual = ctEtiqueta.value;
    ctEtiqueta.textContent = '';
    ctEtiqueta.appendChild(new Option('Todas as etiquetas', ''));
    for (const t of [...etiquetas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))) ctEtiqueta.appendChild(new Option(t, t));
    ctEtiqueta.value = [...etiquetas.values()].includes(etiquetaAtual) ? etiquetaAtual : '';
    ctEtiqueta.hidden = !etiquetas.size;

    renderizarContatos();
  } catch (err) {
    ctCorpo.textContent = '';
    ctResumo.textContent = `Não consegui carregar os contatos: ${err.message}`;
  }
}

function ctFiltrados() {
  const termo = ctSemAcento(ctBusca.value);
  const digitos = termo.replace(/\D/g, '');
  return ctContatos.filter((c) => {
    if (ctEtapa.value && c.etapa !== ctEtapa.value) return false;
    if (ctOrigem.value && c.origem !== ctOrigem.value) return false;
    if (ctEtiqueta.value && !(c.etiquetas || []).includes(ctEtiqueta.value)) return false;
    if (!termo) return true;
    return ctSemAcento(c.nome).includes(termo)
      || ctSemAcento(c.email).includes(termo)
      || (c.etiquetas || []).some((t) => ctSemAcento(t).includes(termo))
      || (digitos.length >= 3 && c.numero.includes(digitos));
  });
}

function renderizarContatos() {
  const lista = ctFiltrados();
  const nomeEtapa = Object.fromEntries(ctEtapas.map((e) => [e.id, e.nome]));
  const total = ctContatos.length;
  ctResumo.textContent = !total
    ? 'Nenhum contato ainda. Eles aparecem aqui sozinhos quando alguém conversa no WhatsApp, ou você pode cadastrar e importar uma planilha.'
    : lista.length === total
      ? `${total} ${total === 1 ? 'contato' : 'contatos'}`
      : `${lista.length} de ${total} contatos com esse filtro`;

  ctCorpo.textContent = '';
  for (const c of lista.slice(0, ctLimite)) {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.addEventListener('click', () => abrirModalContato(c));
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') abrirModalContato(c); });

    const celula = (texto, classe) => {
      const td = document.createElement('td');
      if (classe) td.className = classe;
      td.textContent = texto;
      tr.appendChild(td);
      return td;
    };
    const tdNome = celula(c.nome || 'Sem nome', c.nome ? 'ct-nome' : 'ct-nome ct-vazio');
    tdNome.dataset.rotulo = 'Nome';
    celula(ctFormatarTelefone(c.numero, c.instancia), 'ct-tel').dataset.rotulo = 'WhatsApp';
    celula(c.email || '', 'ct-email').dataset.rotulo = 'E-mail';
    const tdTags = celula('', 'ct-tags');
    tdTags.dataset.rotulo = 'Etiquetas';
    for (const t of c.etiquetas || []) {
      const chip = document.createElement('span');
      chip.className = 'ct-chip';
      chip.textContent = t;
      tdTags.appendChild(chip);
    }
    celula(nomeEtapa[c.etapa] || c.etapa, 'ct-etapa').dataset.rotulo = 'Etapa';
    celula(c.ultima_mensagem_em ? crmFormatarQuando(c.ultima_mensagem_em) : 'Sem conversa', c.ultima_mensagem_em ? '' : 'ct-vazio').dataset.rotulo = 'Última conversa';
    celula(CT_ORIGENS[c.origem] || c.origem, 'ct-origem').dataset.rotulo = 'Origem';
    ctCorpo.appendChild(tr);
  }
  ctMaisBtn.hidden = lista.length <= ctLimite;
  if (!ctMaisBtn.hidden) ctMaisBtn.textContent = `Mostrar mais (${lista.length - ctLimite} restantes)`;
}

for (const el of [ctEtapa, ctEtiqueta, ctOrigem]) el.addEventListener('change', () => { ctLimite = CT_POR_PAGINA; renderizarContatos(); });
ctBusca.addEventListener('input', () => { ctLimite = CT_POR_PAGINA; renderizarContatos(); });
ctMaisBtn.addEventListener('click', () => { ctLimite += CT_POR_PAGINA; renderizarContatos(); });

function ctPreencherInstancias(select) {
  select.textContent = '';
  for (const i of ctInstancias) select.appendChild(new Option(i, i));
}

function ctFecharModal(modal) {
  modal.hidden = true;
  if (modal === ctModal) limparPendente(ctSalvarBtn);
}
for (const btn of document.querySelectorAll('.ct-fechar')) {
  btn.addEventListener('click', () => ctFecharModal(document.getElementById(btn.dataset.fechar)));
}
for (const modal of [ctModal, ctImpModal]) {
  modal.addEventListener('click', (ev) => { if (ev.target === modal) ctFecharModal(modal); });
}
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (!ctModal.hidden) ctFecharModal(ctModal);
  else if (!ctImpModal.hidden) ctFecharModal(ctImpModal);
});

function ctMostrarErroModal(msg) {
  ctModalErro.textContent = msg || '';
  ctModalErro.hidden = !msg;
}

function abrirModalContato(contato) {
  ctEditando = contato || null;
  ctMostrarErroModal('');
  limparPendente(ctSalvarBtn);
  ctModalTitulo.textContent = contato ? (contato.nome || ctFormatarTelefone(contato.numero)) : 'Novo contato';
  ctNome.value = contato?.nome || '';
  ctEmail.value = contato?.email || '';
  ctEtiquetas.value = (contato?.etiquetas || []).join(', ');
  ctObs.value = contato?.observacoes || '';
  ctCampoNovo.hidden = !!contato;
  ctInfoNumero.hidden = !contato;
  ctApagarBtn.hidden = !contato;
  ctConversarBtn.hidden = !contato;
  if (contato) {
    ctInfoNumero.textContent = `WhatsApp ${ctFormatarTelefone(contato.numero)} · atendido pelo número ${contato.instancia}`;
  } else {
    ctNumero.value = '';
    ctPreencherInstancias(ctInstanciaCad);
    ctInstanciaCadLabel.hidden = ctInstancias.length < 2;
    if (!ctInstancias.length) ctMostrarErroModal('Conecte um número na aba WhatsApp antes de cadastrar contatos.');
  }
  ctModal.hidden = false;
  (contato ? ctNome : ctNumero).focus();
}

rastrearAlteracoes(ctSalvarBtn, [ctNome, ctNumero, ctInstanciaCad, ctEmail, ctEtiquetas, ctObs]);
document.getElementById('ctNovoBtn').addEventListener('click', () => abrirModalContato(null));

ctForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ctMostrarErroModal('');
  const dados = { nome: ctNome.value, email: ctEmail.value, etiquetas: ctEtiquetas.value, observacoes: ctObs.value };
  if (!ctEditando) Object.assign(dados, { numero: ctNumero.value, instancia: ctInstanciaCad.value || ctInstancias[0] });
  ctSalvarBtn.disabled = true;
  try {
    const res = await fetch(ctEditando ? `/api/crm/base-contatos/${ctEditando.id}` : '/api/crm/base-contatos', {
      method: ctEditando ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify(dados),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    marcarSalvo(ctSalvarBtn, ctEditando ? 'Contato atualizado' : 'Contato cadastrado');
    ctModal.hidden = true;
    carregarContatos();
  } catch (err) {
    ctMostrarErroModal(err.message);
  } finally {
    ctSalvarBtn.disabled = false;
  }
});

ctApagarBtn.addEventListener('click', async () => {
  const c = ctEditando;
  if (!c) return;
  const quem = c.nome || ctFormatarTelefone(c.numero);
  const aviso = c.ultima_mensagem_em
    ? `Apagar ${quem}? Isso remove o contato, o card do CRM e todo o histórico de conversa - não dá pra desfazer.`
    : `Apagar ${quem} da sua base de contatos?`;
  if (!confirm(aviso)) return;
  try {
    const res = await fetch(`/api/crm/contatos/${c.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    ctFecharModal(ctModal);
    mostrarAviso('Contato apagado');
    carregarContatos();
  } catch (err) {
    ctMostrarErroModal(`Não consegui apagar: ${err.message}`);
  }
});

// abre (ou comeca) a conversa desse contato na aba Conversas
ctConversarBtn.addEventListener('click', () => {
  const c = ctEditando;
  if (!c) return;
  ctFecharModal(ctModal);
  mudarAba('conversas');
  if (!cvEtapas.length) cvEtapas = ctEtapas;
  abrirConversa({ ...c, nao_lida: false });
});

// ---------- exportar ----------

function ctLinhasExportacao() {
  const nomeEtapa = Object.fromEntries(ctEtapas.map((e) => [e.id, e.nome]));
  const data = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Maceio' }) : '');
  const cabecalho = ['Nome', 'Telefone', 'E-mail', 'Etiquetas', 'Etapa', 'Origem', 'Número de atendimento', 'Última conversa', 'Cadastrado em', 'Observações'];
  const linhas = ctFiltrados().map((c) => [
    c.nome || '', c.numero, c.email || '', (c.etiquetas || []).join(', '), nomeEtapa[c.etapa] || c.etapa,
    CT_ORIGENS[c.origem] || c.origem, c.instancia, data(c.ultima_mensagem_em), data(c.criado_em), c.observacoes || '',
  ]);
  return [cabecalho, ...linhas];
}

function ctBaixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const ctNomeArquivo = (ext) => `contatos-lumia-${new Date().toISOString().slice(0, 10)}.${ext}`;

// CSV com ";" e BOM - e o formato que o Excel em portugues abre direto, com acento certo
function ctGerarCsv(linhas) {
  const campo = (v) => {
    const t = String(v ?? '');
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + linhas.map((l) => l.map(campo).join(';')).join('\r\n');
}

async function ctGarantirSheetJs() {
  if (!window.XLSX) await carregarScriptUmaVez('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  return window.XLSX;
}

document.getElementById('ctExportarCsvBtn').addEventListener('click', () => {
  const linhas = ctLinhasExportacao();
  if (linhas.length < 2) return mostrarAviso('Nenhum contato pra exportar com esse filtro', 'erro');
  ctBaixar(new Blob([ctGerarCsv(linhas)], { type: 'text/csv;charset=utf-8' }), ctNomeArquivo('csv'));
  mostrarAviso(`${linhas.length - 1} contatos exportados`);
});

document.getElementById('ctExportarXlsxBtn').addEventListener('click', async () => {
  const linhas = ctLinhasExportacao();
  if (linhas.length < 2) return mostrarAviso('Nenhum contato pra exportar com esse filtro', 'erro');
  try {
    const XLSX = await ctGarantirSheetJs();
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    planilha['!cols'] = [28, 16, 26, 22, 18, 12, 18, 18, 18, 40].map((wch) => ({ wch }));
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Contatos');
    XLSX.writeFile(livro, ctNomeArquivo('xlsx'));
    mostrarAviso(`${linhas.length - 1} contatos exportados`);
  } catch (err) {
    mostrarAviso(`Não consegui gerar o Excel: ${err.message}`, 'erro');
  }
});

// ---------- importar ----------

function ctMostrarErroImp(msg) {
  ctImpErro.textContent = msg || '';
  ctImpErro.hidden = !msg;
}

function ctImpPasso(n) {
  ctImpPasso1.hidden = n !== 1;
  ctImpPasso2.hidden = n !== 2;
  ctImpVoltar.hidden = n !== 2;
  ctImpConfirmar.hidden = n !== 2;
  ctImpConfirmar.disabled = false;
  if (n === 1) ctImpArquivo.value = '';
}

document.getElementById('ctImportarBtn').addEventListener('click', () => {
  ctMostrarErroImp('');
  ctImpResultado.hidden = true;
  ctImpPasso(1);
  if (!ctInstancias.length) ctMostrarErroImp('Conecte um número na aba WhatsApp antes de importar contatos.');
  ctImpModal.hidden = false;
});
ctImpVoltar.addEventListener('click', () => { ctImpVoltar.textContent = 'Trocar planilha'; ctImpResultado.hidden = true; ctMostrarErroImp(''); ctImpPasso(1); });

document.getElementById('ctModeloBtn').addEventListener('click', () => {
  const modelo = [
    ['Nome', 'Telefone', 'E-mail', 'Etiquetas', 'Observações'],
    ['Maria Souza', '82 99999-0000', 'maria@exemplo.com', 'implante, indicação', 'Prefere atendimento à tarde'],
  ];
  ctBaixar(new Blob([ctGerarCsv(modelo)], { type: 'text/csv;charset=utf-8' }), 'modelo-contatos-lumia.csv');
});

// CSV simples com aspas - detecta o separador (";" do Excel brasileiro, "," ou tab) pela 1a linha
function ctLerCsv(texto) {
  const primeira = texto.split(/\r?\n/, 1)[0] || '';
  const sep = [';', ',', '\t'].map((s) => [s, primeira.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// planilha salva pelo Excel antigo vem em Windows-1252 - se nao for UTF-8 valido, le nesse formato
function ctDecodificarTexto(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

ctImpArquivo.addEventListener('change', async () => {
  const arquivo = ctImpArquivo.files?.[0];
  if (!arquivo) return;
  ctMostrarErroImp('');
  ctImpResultado.hidden = true;
  try {
    const buffer = await arquivo.arrayBuffer();
    let linhas;
    if (/\.(xlsx|xls)$/i.test(arquivo.name)) {
      const XLSX = await ctGarantirSheetJs();
      const livro = XLSX.read(buffer, { type: 'array' });
      const planilha = livro.Sheets[livro.SheetNames[0]];
      linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: false, defval: '' });
    } else {
      linhas = ctLerCsv(ctDecodificarTexto(buffer));
    }
    linhas = linhas.map((l) => l.map((v) => String(v ?? '').trim())).filter((l) => l.some(Boolean));
    if (linhas.length < 2) throw new Error('A planilha precisa ter uma linha de cabeçalho e pelo menos um contato.');
    ctImpCabecalho = linhas[0];
    ctImpLinhas = linhas.slice(1);
    ctMontarMapa();
    ctImpPasso(2);
    ctImpInfo.textContent = `${arquivo.name}: ${ctImpLinhas.length} ${ctImpLinhas.length === 1 ? 'linha' : 'linhas'}. Confira qual coluna é cada informação:`;
    ctPreencherInstancias(ctImpInstancia);
    ctImpInstancia.closest('label').hidden = ctInstancias.length < 2;
    ctImpEtiquetaExtra.value = '';
    ctAtualizarPreviaImp();
  } catch (err) {
    ctMostrarErroImp(`Não consegui ler a planilha: ${err.message}`);
    ctImpArquivo.value = '';
  }
});

// um select por campo, ja escolhendo sozinho a coluna cujo nome bate com algum apelido
function ctMontarMapa() {
  ctImpMapa.textContent = '';
  const usadas = new Set();
  for (const campo of CT_CAMPOS_IMPORTACAO) {
    const label = document.createElement('label');
    label.className = 'ct-campo';
    label.textContent = campo.nome + (campo.obrigatorio ? ' *' : '');
    const sel = document.createElement('select');
    sel.dataset.campo = campo.id;
    sel.appendChild(new Option(campo.obrigatorio ? 'Escolha a coluna' : 'Não importar', ''));
    ctImpCabecalho.forEach((titulo, i) => sel.appendChild(new Option(titulo || `Coluna ${i + 1}`, String(i))));
    const achada = ctImpCabecalho.findIndex((t, i) => !usadas.has(i) && campo.apelidos.includes(ctSemAcento(t)));
    if (achada >= 0) { sel.value = String(achada); usadas.add(achada); }
    sel.addEventListener('change', ctAtualizarPreviaImp);
    label.appendChild(sel);
    ctImpMapa.appendChild(label);
  }
}

function ctMapaAtual() {
  const mapa = {};
  for (const sel of ctImpMapa.querySelectorAll('select')) if (sel.value !== '') mapa[sel.dataset.campo] = Number(sel.value);
  return mapa;
}

// etapa da planilha pode vir pelo nome ("Em atendimento") ou pelo id interno
function ctEtapaDaPlanilha(valor) {
  const v = ctSemAcento(valor);
  if (!v) return '';
  const achada = ctEtapas.find((e) => e.id === v || ctSemAcento(e.nome) === v);
  return achada ? achada.id : '';
}

function ctMontarLinhasImp() {
  const mapa = ctMapaAtual();
  const extra = ctImpEtiquetaExtra.value.trim();
  const pega = (linha, campo) => (mapa[campo] === undefined ? '' : linha[mapa[campo]] || '');
  const vistos = new Set();
  const validas = [];
  let semTelefone = 0;
  let repetidas = 0;
  for (const linha of ctImpLinhas) {
    const numero = ctNormalizarTelefone(pega(linha, 'numero'));
    if (!numero) { semTelefone++; continue; }
    if (vistos.has(numero)) { repetidas++; continue; }
    vistos.add(numero);
    const etiquetas = pega(linha, 'etiquetas');
    validas.push({
      numero,
      nome: pega(linha, 'nome'),
      email: pega(linha, 'email'),
      etiquetas: [etiquetas, extra].filter(Boolean).join(','),
      observacoes: pega(linha, 'observacoes'),
      etapa: ctEtapaDaPlanilha(pega(linha, 'etapa')),
    });
  }
  return { validas, semTelefone, repetidas, temTelefone: mapa.numero !== undefined };
}

function ctAtualizarPreviaImp() {
  const { validas, semTelefone, repetidas, temTelefone } = ctMontarLinhasImp();
  ctImpConfirmar.disabled = !temTelefone || !validas.length;
  if (!temTelefone) {
    ctImpResumo.textContent = 'Escolha qual coluna tem o telefone pra continuar.';
  } else {
    const partes = [`${validas.length} ${validas.length === 1 ? 'contato pronto' : 'contatos prontos'} pra importar`];
    if (semTelefone) partes.push(`${semTelefone} sem telefone válido (ficam de fora)`);
    if (repetidas) partes.push(`${repetidas} repetidos na planilha`);
    ctImpResumo.textContent = partes.join(' · ');
  }
  ctImpConfirmar.textContent = validas.length ? `Importar ${validas.length}` : 'Importar';

  ctImpPrevia.textContent = '';
  const cab = document.createElement('tr');
  for (const t of ['Nome', 'Telefone', 'E-mail', 'Etiquetas']) {
    const th = document.createElement('th');
    th.textContent = t;
    cab.appendChild(th);
  }
  const thead = document.createElement('thead');
  thead.appendChild(cab);
  const tbody = document.createElement('tbody');
  for (const l of validas.slice(0, 8)) {
    const tr = document.createElement('tr');
    for (const v of [l.nome || '—', ctFormatarTelefone(l.numero), l.email, l.etiquetas.split(',').filter(Boolean).join(', ')]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  ctImpPrevia.append(thead, tbody);
}
ctImpEtiquetaExtra.addEventListener('input', ctAtualizarPreviaImp);

ctImpConfirmar.addEventListener('click', async () => {
  const { validas } = ctMontarLinhasImp();
  if (!validas.length) return;
  ctMostrarErroImp('');
  ctImpConfirmar.disabled = true;
  const total = { novos: 0, atualizados: 0, ignorados: 0, invalidos: 0 };
  try {
    for (let i = 0; i < validas.length; i += 500) {
      ctImpConfirmar.textContent = `Importando ${Math.min(i + 500, validas.length)} de ${validas.length}...`;
      const res = await fetch('/api/crm/base-contatos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ instancia: ctImpInstancia.value || ctInstancias[0], modo: ctImpModo.value, linhas: validas.slice(i, i + 500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      for (const k of Object.keys(total)) total[k] += data[k] || 0;
    }
    const partes = [`${total.novos} ${total.novos === 1 ? 'contato novo' : 'contatos novos'}`];
    if (total.atualizados) partes.push(`${total.atualizados} atualizados`);
    if (total.ignorados) partes.push(`${total.ignorados} já existiam e ficaram como estavam`);
    if (total.invalidos) partes.push(`${total.invalidos} com telefone inválido`);
    ctImpResultado.textContent = `Importação concluída: ${partes.join(', ')}.`;
    ctImpResultado.hidden = false;
    ctImpPasso(0);
    ctImpVoltar.hidden = false;
    ctImpVoltar.textContent = 'Importar outra planilha';
    mostrarAviso('Contatos importados');
    carregarContatos();
  } catch (err) {
    // cada lote e uma transacao no servidor: o que ja foi confirmado fica, o lote que falhou nao entra
    ctMostrarErroImp(`A importação parou: ${err.message}${total.novos + total.atualizados ? ` (${total.novos} novos e ${total.atualizados} atualizados já tinham entrado)` : ''}`);
    ctImpConfirmar.disabled = false;
    ctAtualizarPreviaImp();
  }
});

// ---------- Resultados (indicadores do atendimento por periodo) ----------
const rsPeriodos = document.getElementById('rsPeriodos');
const rsCustom = document.getElementById('rsCustom');
const rsDe = document.getElementById('rsDe');
const rsAte = document.getElementById('rsAte');
const rsInstancia = document.getElementById('rsInstancia');
const rsErro = document.getElementById('rsErro');
const rsResumo = document.getElementById('rsResumo');
const rsKpis = document.getElementById('rsKpis');
const rsGraficoDias = document.getElementById('rsGraficoDias');
const rsGraficoHoras = document.getElementById('rsGraficoHoras');
const rsTabelaDias = document.getElementById('rsTabelaDias');
const rsTabelaBtn = document.getElementById('rsTabelaBtn');
const rsAutores = document.getElementById('rsAutores');
const rsFunil = document.getElementById('rsFunil');
const rsTooltip = document.getElementById('rsTooltip');

let rsDias = 30; // 'custom' = usa rsDe/rsAte
let rsDados = null;
let rsPedido = 0;

const rsHojeMaceio = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' });
function rsSomarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const rsDataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const rsNum = (n) => Number(n || 0).toLocaleString('pt-BR');

function rsIntervalo() {
  if (rsDias === 'custom') return { de: rsDe.value, ate: rsAte.value };
  const ate = rsHojeMaceio();
  return { de: rsSomarDias(ate, -(rsDias - 1)), ate };
}

function rsNomePeriodo() {
  if (rsDias === 1) return 'Hoje';
  if (rsDias === 'custom') {
    const { de, ate } = rsIntervalo();
    return de === ate ? `Em ${rsDataCurta(de)}` : `De ${rsDataCurta(de)} a ${rsDataCurta(ate)}`;
  }
  return `Nos últimos ${rsDias} dias`;
}

function rsFormatarTempo(seg) {
  if (seg == null) return '—';
  if (seg < 60) return `${seg}s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h < 24) return resto ? `${h}h ${resto}min` : `${h}h`;
  return `${Math.round(h / 24)} dias`;
}

async function carregarResultados() {
  const { de, ate } = rsIntervalo();
  if (!de || !ate || de > ate) {
    rsMostrarErro('Escolha uma data inicial antes da final.');
    return;
  }
  rsMostrarErro('');
  const pedido = ++rsPedido;
  rsResumo.classList.add('carregando');
  try {
    const params = new URLSearchParams({ de, ate });
    if (rsInstancia.value) params.set('instancia', rsInstancia.value);
    const res = await fetch(`/api/crm/resultados?${params}`, { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    if (pedido !== rsPedido) return; // trocou o filtro enquanto carregava
    rsDados = data;
    const atual = rsInstancia.value;
    rsInstancia.textContent = '';
    rsInstancia.appendChild(new Option('Todos os números', ''));
    for (const i of data.instancias || []) rsInstancia.appendChild(new Option(i, i));
    rsInstancia.value = (data.instancias || []).includes(atual) ? atual : '';
    rsInstancia.hidden = (data.instancias || []).length < 2;
    renderizarResultados();
  } catch (err) {
    if (pedido === rsPedido) rsMostrarErro(`Não consegui carregar os resultados: ${err.message}`);
  } finally {
    if (pedido === rsPedido) rsResumo.classList.remove('carregando');
  }
}

function rsMostrarErro(msg) {
  rsErro.textContent = msg || '';
  rsErro.hidden = !msg;
}

// variacao contra o periodo anterior de mesmo tamanho. menorMelhor = tempo de resposta
function rsVariacao(atual, anterior, menorMelhor = false) {
  if (atual == null || anterior == null) return null;
  if (!anterior) return atual ? { texto: 'novo no período', classe: '' } : null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: '= igual ao período anterior', classe: '' };
  const subiu = pct > 0;
  const bom = menorMelhor ? !subiu : subiu;
  return { texto: `${subiu ? '▲' : '▼'} ${Math.abs(pct)}% vs período anterior`, classe: bom ? 'bom' : 'ruim' };
}

function renderizarResultados() {
  const d = rsDados;
  if (!d) return;
  const a = d.atual;
  const b = d.anterior;
  const inicioPeriodo = new Date(d.periodo.inicio);
  const etapasDesde = d.registroDesde?.etapas ? new Date(d.registroDesde.etapas) : null;
  const autorDesde = d.registroDesde?.autor ? new Date(d.registroDesde.autor) : null;
  const dataBR = (dt) => dt.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit' });
  const avisoEtapas = !etapasDesde ? 'contando a partir de agora' : etapasDesde > inicioPeriodo ? `contando desde ${dataBR(etapasDesde)}` : '';
  const avisoAutor = !autorDesde ? 'registrando a partir de agora' : autorDesde > inicioPeriodo ? `registrado desde ${dataBR(autorDesde)}` : '';
  const pctIa = a.enviadas ? Math.round((a.enviadas_ia / a.enviadas) * 100) : null;
  const pct5 = a.contatos_iniciados ? Math.round((a.em_5min / a.contatos_iniciados) * 100) : null;
  // a comparacao so vale quando o registro ja existia no periodo anterior inteiro
  const comparaEtapas = etapasDesde && etapasDesde <= new Date(d.periodo.anteriorInicio);

  const tiles = [
    { rotulo: 'Novos contatos', valor: rsNum(a.novos), sub: 'chegaram pelo WhatsApp', variacao: rsVariacao(a.novos, b.novos) },
    { rotulo: 'Conversas com movimento', valor: rsNum(a.conversas), sub: `${rsNum(a.recebidas)} recebidas · ${rsNum(a.enviadas)} enviadas`, variacao: rsVariacao(a.conversas, b.conversas) },
    { rotulo: 'Mensagens recebidas', valor: rsNum(a.recebidas), sub: 'dos contatos', variacao: rsVariacao(a.recebidas, b.recebidas) },
    {
      rotulo: 'Tempo de 1ª resposta', valor: rsFormatarTempo(a.mediana_seg),
      sub: pct5 == null ? 'sem conversas iniciadas' : `mediana · ${pct5}% respondidos em até 5 min`,
      variacao: rsVariacao(a.mediana_seg, b.mediana_seg, true),
    },
    {
      rotulo: 'Agendamentos', valor: rsNum(a.agendamentos),
      sub: [a.pre_agendamentos ? `+ ${rsNum(a.pre_agendamentos)} pré-agendamentos` : '', avisoEtapas].filter(Boolean).join(' · ') || 'contatos que foram para Agendado',
      variacao: comparaEtapas ? rsVariacao(a.agendamentos, b.agendamentos) : null,
    },
    {
      rotulo: 'Respondido pela IA', valor: pctIa == null ? '—' : `${pctIa}%`,
      sub: [a.enviadas ? `${rsNum(a.enviadas_ia)} de ${rsNum(a.enviadas)} enviadas` : 'nenhuma mensagem enviada', avisoAutor].filter(Boolean).join(' · '),
      variacao: null,
    },
  ];
  rsKpis.textContent = '';
  for (const t of tiles) {
    const el = document.createElement('div');
    el.className = 'rs-kpi';
    const rot = document.createElement('span');
    rot.className = 'rs-kpi-rotulo';
    rot.textContent = t.rotulo;
    const val = document.createElement('strong');
    val.className = 'rs-kpi-valor';
    val.textContent = t.valor;
    const sub = document.createElement('span');
    sub.className = 'rs-kpi-sub';
    sub.textContent = t.sub;
    el.append(rot, val, sub);
    if (t.variacao) {
      const v = document.createElement('span');
      v.className = `rs-kpi-var ${t.variacao.classe}`;
      v.textContent = t.variacao.texto;
      el.appendChild(v);
    }
    rsKpis.appendChild(el);
  }

  rsResumo.textContent = rsMontarResumo(d, pct5);
  rsDesenharGraficos();
  rsRenderizarBarras(rsAutores, [
    { nome: 'IA (auto atendimento)', total: a.enviadas_ia },
    { nome: 'Follow Up automático', total: a.enviadas_followup },
    { nome: 'Equipe', total: a.enviadas_humano },
    { nome: 'Sem registro de autor', total: Math.max(0, a.enviadas - a.enviadas_ia - a.enviadas_followup - a.enviadas_humano) },
  ].filter((x) => x.total || x.nome !== 'Sem registro de autor'), a.enviadas, 'Nenhuma mensagem enviada no período.');
  const totalFunil = d.funil.reduce((s, f) => s + f.total, 0);
  rsRenderizarBarras(rsFunil, d.funil, totalFunil, 'Nenhum contato novo com conversa no período.');
  rsRenderizarTabelaDias();
}

// resumo escrito com os proprios numeros (sem IA - nao gasta credito e nunca inventa)
function rsMontarResumo(d, pct5) {
  const a = d.atual;
  if (!a.recebidas && !a.enviadas && !a.novos) return `${rsNomePeriodo()} não houve conversa no WhatsApp${rsInstancia.value ? ' nesse número' : ''}.`;
  const frases = [];
  const varNovos = rsVariacao(a.novos, d.anterior.novos);
  const comparacao = varNovos && varNovos.classe ? ` (${varNovos.texto.replace(' vs período anterior', '').replace('▲', 'alta de').replace('▼', 'queda de')} em relação ao período anterior)` : '';
  frases.push(`${rsNomePeriodo()}, chegaram ${rsNum(a.novos)} ${a.novos === 1 ? 'contato novo' : 'contatos novos'}${comparacao} e ${rsNum(a.conversas)} ${a.conversas === 1 ? 'conversa teve' : 'conversas tiveram'} movimento.`);
  if (a.mediana_seg != null) {
    frases.push(`A primeira resposta saiu em ${rsFormatarTempo(a.mediana_seg)} (mediana)${pct5 != null ? `, e ${pct5}% dos contatos foram respondidos em até 5 minutos` : ''}.`);
  }
  if (a.contatos_iniciados > a.respondidos) {
    const sem = a.contatos_iniciados - a.respondidos;
    frases.push(`${rsNum(sem)} ${sem === 1 ? 'contato ficou' : 'contatos ficaram'} sem resposta até agora.`);
  }
  const pico = d.porHora.reduce((m, h) => (h.recebidas > m.recebidas ? h : m), { hora: -1, recebidas: 0 });
  if (pico.recebidas) frases.push(`O horário de mais movimento é das ${pico.hora}h às ${(pico.hora + 1) % 24}h.`);
  if (d.porDia.length > 1) {
    const diaTop = d.porDia.reduce((m, x) => (x.recebidas > m.recebidas ? x : m), d.porDia[0]);
    if (diaTop.recebidas) frases.push(`O dia mais cheio foi ${rsDataCurta(diaTop.dia)}, com ${rsNum(diaTop.recebidas)} mensagens recebidas.`);
  }
  const totalFunil = d.funil.reduce((s, f) => s + f.total, 0);
  const convertidos = d.funil.filter((f) => f.id === 'agendado' || f.id === 'compareceu').reduce((s, f) => s + f.total, 0);
  if (totalFunil) frases.push(`Dos contatos que chegaram no período, ${rsNum(convertidos)} (${Math.round((convertidos / totalFunil) * 100)}%) já estão agendados ou compareceram.`);
  return frases.join(' ');
}

function rsRenderizarBarras(container, itens, total, vazio) {
  container.textContent = '';
  if (!total) {
    const p = document.createElement('p');
    p.className = 'rs-vazio';
    p.textContent = vazio;
    container.appendChild(p);
    return;
  }
  const maior = Math.max(...itens.map((i) => i.total), 1);
  for (const item of itens) {
    const linha = document.createElement('div');
    linha.className = 'rs-barra-linha';
    const nome = document.createElement('span');
    nome.className = 'rs-barra-nome';
    nome.textContent = item.nome;
    const trilho = document.createElement('div');
    trilho.className = 'rs-barra-trilho';
    const barra = document.createElement('div');
    barra.className = 'rs-barra';
    barra.style.width = item.total ? `max(4px, ${(item.total / maior) * 100}%)` : '0';
    trilho.appendChild(barra);
    const valor = document.createElement('span');
    valor.className = 'rs-barra-valor';
    valor.textContent = `${rsNum(item.total)} · ${Math.round((item.total / total) * 100)}%`;
    linha.append(nome, trilho, valor);
    container.appendChild(linha);
  }
}

// grafico de colunas em SVG (uma serie so, cor da marca), com dica ao passar o mouse/tocar
function rsGraficoColunas(container, pontos, { rotuloX, dica, altura = 200 }) {
  container.textContent = '';
  const largura = Math.max(container.clientWidth, 260);
  const margem = { topo: 12, dir: 8, base: 26, esq: 34 };
  const w = largura - margem.esq - margem.dir;
  const h = altura - margem.topo - margem.base;
  const maior = Math.max(...pontos.map((p) => p.valor), 0);
  // escala "redonda" pro eixo (1, 2, 5, 10, 20, 50...)
  const passoBruto = Math.max(maior, 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= passoBruto));
  const topoEixo = Math.max(passo, Math.ceil(maior / passo) * passo);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', largura);
  svg.setAttribute('height', altura);
  svg.setAttribute('role', 'img');
  svg.classList.add('rs-svg');
  const el = (tag, attrs, pai = svg) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    pai.appendChild(n);
    return n;
  };

  for (let v = 0; v <= topoEixo; v += passo) {
    const y = margem.topo + h - (v / topoEixo) * h;
    el('line', { x1: margem.esq, x2: margem.esq + w, y1: y, y2: y, class: v === 0 ? 'rs-eixo' : 'rs-grade' });
    el('text', { x: margem.esq - 6, y: y + 4, 'text-anchor': 'end', class: 'rs-rotulo' }).textContent = rsNum(v);
  }

  const faixa = w / pontos.length;
  const largBarra = Math.max(2, Math.min(28, faixa - 2));
  const cadaQuantos = Math.ceil(pontos.length / Math.max(1, Math.floor(w / 46)));
  pontos.forEach((p, i) => {
    const x = margem.esq + i * faixa + (faixa - largBarra) / 2;
    const alt = topoEixo ? (p.valor / topoEixo) * h : 0;
    const yBase = margem.topo + h;
    if (alt > 0) {
      const r = Math.min(4, largBarra / 2, alt);
      // topo arredondado, base reta no eixo
      el('path', {
        class: 'rs-coluna',
        d: `M${x},${yBase} V${yBase - alt + r} Q${x},${yBase - alt} ${x + r},${yBase - alt} H${x + largBarra - r} Q${x + largBarra},${yBase - alt} ${x + largBarra},${yBase - alt + r} V${yBase} Z`,
      });
    }
    if (i % cadaQuantos === 0) {
      el('text', { x: x + largBarra / 2, y: altura - 8, 'text-anchor': 'middle', class: 'rs-rotulo' }).textContent = rotuloX(p);
    }
    // area de toque maior que a coluna (a faixa inteira)
    const alvo = el('rect', { x: margem.esq + i * faixa, y: margem.topo, width: faixa, height: h, class: 'rs-alvo', tabindex: 0 });
    const mostrar = () => {
      for (const c of svg.querySelectorAll('.rs-alvo.ativo')) c.classList.remove('ativo');
      alvo.classList.add('ativo');
      rsTooltip.textContent = '';
      for (const [j, linha] of dica(p).entries()) {
        const div = document.createElement('div');
        if (j === 0) div.className = 'rs-tooltip-titulo';
        div.textContent = linha;
        rsTooltip.appendChild(div);
      }
      rsTooltip.hidden = false;
      const caixa = alvo.getBoundingClientRect();
      const tw = rsTooltip.offsetWidth;
      const left = Math.min(Math.max(8, caixa.left + caixa.width / 2 - tw / 2), window.innerWidth - tw - 8);
      rsTooltip.style.left = `${left}px`;
      rsTooltip.style.top = `${Math.max(8, caixa.top - rsTooltip.offsetHeight - 8 + (h - alt))}px`;
    };
    const esconder = () => { alvo.classList.remove('ativo'); rsTooltip.hidden = true; };
    alvo.addEventListener('mouseenter', mostrar);
    alvo.addEventListener('focus', mostrar);
    alvo.addEventListener('click', mostrar);
    alvo.addEventListener('mouseleave', esconder);
    alvo.addEventListener('blur', esconder);
  });
  svg.setAttribute('aria-label', pontos.map((p) => `${rotuloX(p)}: ${p.valor}`).join(', '));
  container.appendChild(svg);
}

const RS_DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function rsDesenharGraficos() {
  const d = rsDados;
  if (!d || tabResultados.hidden) return;
  rsGraficoColunas(rsGraficoDias, d.porDia.map((x) => ({ ...x, valor: x.recebidas })), {
    rotuloX: (p) => rsDataCurta(p.dia),
    dica: (p) => [
      `${RS_DIAS_SEMANA[new Date(`${p.dia}T12:00:00Z`).getUTCDay()]}, ${rsDataCurta(p.dia)}`,
      `${rsNum(p.recebidas)} recebidas`,
      `${rsNum(p.enviadas)} enviadas`,
      `${rsNum(p.novos)} ${p.novos === 1 ? 'contato novo' : 'contatos novos'}`,
    ],
  });
  rsGraficoColunas(rsGraficoHoras, d.porHora.map((x) => ({ ...x, valor: x.recebidas })), {
    rotuloX: (p) => `${p.hora}h`,
    dica: (p) => [`Das ${p.hora}h às ${(p.hora + 1) % 24}h`, `${rsNum(p.recebidas)} mensagens recebidas`],
    altura: 180,
  });
}

function rsRenderizarTabelaDias() {
  rsTabelaDias.textContent = '';
  const tabela = document.createElement('table');
  tabela.className = 'ct-tabela';
  const cab = document.createElement('tr');
  for (const t of ['Dia', 'Recebidas', 'Enviadas', 'Contatos novos']) {
    const th = document.createElement('th');
    th.textContent = t;
    cab.appendChild(th);
  }
  const thead = document.createElement('thead');
  thead.appendChild(cab);
  const tbody = document.createElement('tbody');
  for (const p of [...rsDados.porDia].reverse()) {
    const tr = document.createElement('tr');
    for (const v of [rsDataCurta(p.dia), rsNum(p.recebidas), rsNum(p.enviadas), rsNum(p.novos)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tabela.append(thead, tbody);
  rsTabelaDias.appendChild(tabela);
}

rsTabelaBtn.addEventListener('click', () => {
  rsTabelaDias.hidden = !rsTabelaDias.hidden;
  rsGraficoDias.hidden = !rsTabelaDias.hidden;
  rsTabelaBtn.textContent = rsTabelaDias.hidden ? 'Ver em tabela' : 'Ver gráfico';
  if (rsTabelaDias.hidden) rsDesenharGraficos();
});

rsPeriodos.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-dias]');
  if (!btn) return;
  for (const b of rsPeriodos.querySelectorAll('button')) b.classList.toggle('ativo', b === btn);
  if (btn.dataset.dias === 'custom') {
    if (!rsDe.value) {
      const { de, ate } = rsIntervalo();
      rsDe.value = de;
      rsAte.value = ate;
    }
    rsDias = 'custom';
    rsCustom.hidden = false;
    return;
  }
  rsCustom.hidden = true;
  rsDias = Number(btn.dataset.dias);
  carregarResultados();
});
document.getElementById('rsAplicar').addEventListener('click', carregarResultados);
rsInstancia.addEventListener('change', carregarResultados);

// redesenha os graficos quando a largura muda (gaveta, rotacao do celular, janela)
let rsRedesenhoTimer = null;
new ResizeObserver(() => {
  clearTimeout(rsRedesenhoTimer);
  rsRedesenhoTimer = setTimeout(rsDesenharGraficos, 120);
}).observe(rsGraficoDias);
document.addEventListener('scroll', () => { rsTooltip.hidden = true; }, true);

// ---------- Lumien (assistente flutuante: conversa com a Lumia e executa acoes no app) ----------
// usa o mesmo /api/chat da Lumia com uma sessao propria ("lumien:...") - o servidor reconhece esse
// prefixo, tira o controle do PC e devolve acoesTela (telas pra abrir) e aguardandoConfirmacao
const lumienBtn = document.getElementById('lumienBtn');
const lumienPainel = document.getElementById('lumienPainel');
const lumienLog = document.getElementById('lumienLog');
const lumienSugestoes = document.getElementById('lumienSugestoes');
const lumienForm = document.getElementById('lumienForm');
const lumienTexto = document.getElementById('lumienTexto');
const lumienEnviar = document.getElementById('lumienEnviar');
const lumienSub = document.getElementById('lumienSub');

const LUMIEN_CHAVE_SESSAO = 'lumien_session_id';
let lumienSessao = null;
let lumienOcupado = false;
let lumienPollTimer = null;

function lumienNovaSessao() {
  lumienSessao = `lumien:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try { localStorage.setItem(LUMIEN_CHAVE_SESSAO, lumienSessao); } catch { /* sem storage: vale so nesta aba */ }
}
try { lumienSessao = localStorage.getItem(LUMIEN_CHAVE_SESSAO); } catch { lumienSessao = null; }
if (!lumienSessao) lumienNovaSessao();

// chamado pelo mudarAba/mostrarApp - le os elementos direto do DOM porque pode rodar antes deste
// trecho do arquivo ter sido executado
function lumienAoMudarAba(aba) {
  const btn = document.getElementById('lumienBtn');
  const painel = document.getElementById('lumienPainel');
  if (!btn || !painel) return;
  const noInicio = aba === 'painel'; // o Inicio ja e a conversa com a Lumia
  btn.hidden = noInicio || !painel.hidden;
  if (noInicio) painel.hidden = true;
  document.body.classList.toggle('lumien-em-conversas', aba === 'conversas');
  if (!painel.hidden && typeof lumienAtualizarSugestoes === 'function') lumienAtualizarSugestoes();
}

function lumienAbaAtual() {
  return document.querySelector('.nav-btn.active')?.dataset.tab || 'painel';
}

// o que o usuario esta vendo agora - vai junto de cada mensagem pra "essa conversa", "esse
// contato" funcionarem sem ele repetir o nome
function lumienContexto() {
  const aba = lumienAbaAtual();
  const nome = CABECALHOS_ABA[aba]?.[1] || aba;
  const partes = [`aba ${nome}`];
  if (aba === 'conversas' && cvAberto) partes.push(`conversa aberta com ${cvAberto.nome || `+${cvAberto.numero}`} (contatoId ${cvAberto.id})`);
  if (aba === 'contatos' && !ctModal.hidden && ctEditando) partes.push(`ficha aberta de ${ctEditando.nome || `+${ctEditando.numero}`} (contatoId ${ctEditando.id})`);
  if (aba === 'crm' && typeof crmContatoAberto !== 'undefined' && crmContatoAberto) partes.push(`conversa aberta com ${crmContatoAberto.nome || `+${crmContatoAberto.numero}`} (contatoId ${crmContatoAberto.id})`);
  return `[Tela atual: ${partes.join(' · ')}]`;
}

function lumienSugestoesDaTela() {
  const aba = lumienAbaAtual();
  if (aba === 'conversas' && cvAberto) return ['Resuma esta conversa', 'Sugira uma resposta', cvAberto.auto_pausado ? 'Volte a IA nesta conversa' : 'Pause a IA nesta conversa'];
  if (aba === 'resultados') return ['Como foi o atendimento esta semana?', 'O que posso melhorar?'];
  if (aba === 'contatos') return ['Quem está esperando resposta?', 'Cadastre um contato'];
  return ['Quem está esperando resposta?', 'Como foi o atendimento hoje?'];
}

function lumienAtualizarSugestoes() {
  lumienSugestoes.textContent = '';
  if (lumienOcupado) return;
  for (const texto of lumienSugestoesDaTela()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    b.addEventListener('click', () => lumienMandar(texto));
    lumienSugestoes.appendChild(b);
  }
}

function lumienBolha(texto, tipo) {
  const div = document.createElement('div');
  div.className = `lumien-msg ${tipo}`;
  div.textContent = texto;
  lumienLog.appendChild(div);
  lumienLog.scrollTop = lumienLog.scrollHeight;
  return div;
}

function lumienBoasVindas() {
  if (lumienLog.childElementCount) return;
  lumienBolha('Oi! Sou o Lumien. Posso achar contatos, resumir conversas, mover etapas, pausar a IA, cadastrar leads, mostrar resultados e abrir telas pra você. Mensagem pra paciente eu só envio depois que você confirmar.', 'lumien');
}

function lumienAbrir() {
  lumienPainel.hidden = false;
  lumienBtn.hidden = true;
  lumienBoasVindas();
  lumienAtualizarSugestoes();
  if (window.matchMedia('(min-width: 900px)').matches) lumienTexto.focus();
}
function lumienFechar() {
  lumienPainel.hidden = true;
  lumienBtn.hidden = lumienAbaAtual() === 'painel';
}
lumienBtn.addEventListener('click', lumienAbrir);
document.getElementById('lumienFechar').addEventListener('click', lumienFechar);
document.getElementById('lumienNova').addEventListener('click', () => {
  if (lumienOcupado) return;
  lumienNovaSessao();
  lumienLog.textContent = '';
  lumienBoasVindas();
  lumienAtualizarSugestoes();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !lumienPainel.hidden && ctModal.hidden && ctImpModal.hidden) lumienFechar();
});

function lumienAjustarAltura() {
  lumienTexto.style.height = 'auto';
  lumienTexto.style.height = `${Math.min(lumienTexto.scrollHeight, 120)}px`;
}
lumienTexto.addEventListener('input', lumienAjustarAltura);
lumienTexto.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    lumienForm.requestSubmit();
  }
});
lumienForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const texto = lumienTexto.value.trim();
  if (!texto) return;
  lumienTexto.value = '';
  lumienAjustarAltura();
  lumienMandar(texto);
});

function lumienPararPolling() {
  clearInterval(lumienPollTimer);
  lumienPollTimer = null;
}

async function lumienMandar(texto) {
  if (lumienOcupado) return;
  lumienOcupado = true;
  lumienEnviar.disabled = true;
  lumienSugestoes.textContent = '';
  for (const b of lumienLog.querySelectorAll('.lumien-confirmar')) b.remove();
  lumienBolha(texto, 'usuario');
  const pensando = lumienBolha('Pensando...', 'lumien pensando');
  lumienPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/chat/status?sessionId=${encodeURIComponent(lumienSessao)}`, { headers: { 'x-app-password': appPassword } });
      const data = res.ok ? await res.json() : null;
      if (data?.detalhe) pensando.textContent = data.detalhe;
    } catch { /* so indicador visual */ }
  }, 900);

  try {
    // confirmacao ("sim"/"nao") vai sem prefixo - o servidor confere o comeco da mensagem
    const ehResposta = /^\s*(sim|s|n[aã]o|n)\s*[.!]?\s*$/i.test(texto);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ message: ehResposta ? texto : `${lumienContexto()}\n${texto}`, sessionId: lumienSessao }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    lumienPararPolling();
    pensando.remove();
    const bolha = lumienBolha(data.reply || 'Feito.', 'lumien');
    if (data.arquivo) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lumien-baixar';
      btn.textContent = `⬇ Baixar ${data.arquivo.nomeArquivo}`;
      btn.addEventListener('click', () => baixarArquivo(data.arquivo.id, data.arquivo.nomeArquivo, btn));
      bolha.appendChild(btn);
    }
    if (data.aguardandoConfirmacao) lumienBotoesConfirmar();
    if (data.acoesTela?.length) await lumienExecutarTelas(data.acoesTela);
    lumienRecarregarTela();
  } catch (err) {
    lumienPararPolling();
    pensando.remove();
    lumienBolha(`Não consegui: ${err.message}`, 'lumien erro');
  } finally {
    lumienOcupado = false;
    lumienEnviar.disabled = false;
    if (!lumienLog.querySelector('.lumien-confirmar')) lumienAtualizarSugestoes();
  }
}

function lumienBotoesConfirmar() {
  const linha = document.createElement('div');
  linha.className = 'lumien-confirmar';
  const sim = document.createElement('button');
  sim.type = 'button';
  sim.className = 'sim';
  sim.textContent = 'Sim, pode fazer';
  sim.addEventListener('click', () => lumienMandar('sim'));
  const nao = document.createElement('button');
  nao.type = 'button';
  nao.textContent = 'Não';
  nao.addEventListener('click', () => lumienMandar('não'));
  linha.append(sim, nao);
  lumienLog.appendChild(linha);
  lumienLog.scrollTop = lumienLog.scrollHeight;
}

// abre as telas que o Lumien pediu (app_abrir_tela)
async function lumienExecutarTelas(acoes) {
  for (const { tela, contatoId } of acoes) {
    const btn = document.querySelector(`.nav-btn[data-tab="${tela}"]`);
    if (!btn || btn.hidden) continue;
    mudarAba(tela);
    if (!contatoId) continue;
    if (tela === 'conversas') {
      await carregarConversas();
      let c = cvContatos.find((x) => x.id === contatoId);
      if (!c) {
        // contato que ainda nao conversou nao aparece na lista - busca na base
        await carregarContatos();
        c = ctContatos.find((x) => x.id === contatoId);
        if (!cvEtapas.length) cvEtapas = ctEtapas;
      }
      if (c) abrirConversa(c);
    } else if (tela === 'contatos') {
      await carregarContatos();
      const c = ctContatos.find((x) => x.id === contatoId);
      if (c) abrirModalContato(c);
    }
  }
}

// depois de uma acao, recarrega os dados da tela visivel (as que nao tem tempo real proprio)
function lumienRecarregarTela() {
  const aba = lumienAbaAtual();
  if (aba === 'contatos' && ctModal.hidden) carregarContatos();
  else if (aba === 'resultados') carregarResultados();
  else if (aba === 'conversas') carregarConversas();
  else if (aba === 'crm') carregarCrm();
}

// ---------- Instagram (conexao, publicacoes, respostas a comentario e direct) ----------
const igConta = document.getElementById('igConta');
const igConectadoBloco = document.getElementById('igConectadoBloco');
const igTipos = document.getElementById('igTipos');
const igTipoDica = document.getElementById('igTipoDica');
const igArquivos = document.getElementById('igArquivos');
const igArquivosTexto = document.getElementById('igArquivosTexto');
const igPrevias = document.getElementById('igPrevias');
const igLegendaCampo = document.getElementById('igLegendaCampo');
const igLegenda = document.getElementById('igLegenda');
const igLegendaConta = document.getElementById('igLegendaConta');
const igAgendarPara = document.getElementById('igAgendarPara');
const igPostErro = document.getElementById('igPostErro');
const igPublicarBtn = document.getElementById('igPublicarBtn');
const igPosts = document.getElementById('igPosts');
const igRegraTitulo = document.getElementById('igRegraTitulo');
const igRegraPalavras = document.getElementById('igRegraPalavras');
const igRegraPost = document.getElementById('igRegraPost');
const igRegraPublica = document.getElementById('igRegraPublica');
const igRegraDm = document.getElementById('igRegraDm');
const igRegraErro = document.getElementById('igRegraErro');
const igRegraSalvar = document.getElementById('igRegraSalvar');
const igRegraCancelar = document.getElementById('igRegraCancelar');
const igRegras = document.getElementById('igRegras');
const igDmIa = document.getElementById('igDmIa');
const igDmIaLabel = document.getElementById('igDmIaLabel');

const IG_TIPOS = {
  feed: { nome: 'Foto no feed', aceita: 'image/*', varios: false, dica: 'Uma foto. A Lumia ajusta pra proporção aceita pelo feed (entre 4:5 em pé e 1,91:1 deitada).', botao: 'Escolher foto' },
  carrossel: { nome: 'Carrossel', aceita: 'image/*,video/mp4,video/quicktime', varios: true, dica: 'De 2 a 10 fotos ou vídeos, na ordem em que você escolher.', botao: 'Escolher fotos e vídeos' },
  reels: { nome: 'Reels', aceita: 'video/mp4,video/quicktime', varios: false, dica: 'Um vídeo MP4 ou MOV em pé (9:16), de 3 segundos a 15 minutos, até 100 MB.', botao: 'Escolher vídeo' },
  story: { nome: 'Story', aceita: 'image/*,video/mp4,video/quicktime', varios: false, dica: 'Uma foto ou um vídeo em pé (9:16). Story não tem legenda pela API do Instagram.', botao: 'Escolher foto ou vídeo' },
};
const IG_STATUS = { agendado: 'Agendado', processando: 'Publicando...', publicado: 'Publicado', erro: 'Erro', cancelado: 'Cancelado' };

let igStatus = null;
let igTipo = 'feed';
let igSelecionados = []; // File[]
let igRegrasLista = [];
let igRegraEditando = null;
let igPollTimer = null;

async function igApi(caminho, opcoes = {}) {
  const res = await fetch(caminho, {
    ...opcoes,
    headers: { 'x-app-password': appPassword, ...(opcoes.body && typeof opcoes.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opcoes.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `erro ${res.status}`);
  return data;
}

async function carregarInstagram() {
  clearInterval(igPollTimer);
  try {
    igStatus = await igApi('/api/instagram/status');
  } catch (err) {
    igConta.textContent = '';
    igConta.appendChild(Object.assign(document.createElement('p'), { className: 'rs-sub', textContent: `Não consegui carregar: ${err.message}` }));
    return;
  }
  igRenderizarConta();
  igConectadoBloco.hidden = !igStatus.conectado;
  if (!igStatus.conectado) return;
  igDmIa.checked = !!igStatus.conta.dmIaAtiva;
  igAtualizarRotuloDm();
  igAtualizarTipo();
  carregarPostsInstagram();
  carregarRegrasInstagram();
  carregarPublicacoesInstagram();
  igPollTimer = setInterval(() => { if (!tabInstagram.hidden) carregarPostsInstagram(); else clearInterval(igPollTimer); }, 30000);
}

function igRenderizarConta() {
  igConta.textContent = '';
  const s = igStatus;
  const linha = document.createElement('div');
  linha.className = 'ig-conta-linha';
  const info = document.createElement('div');
  info.className = 'ig-conta-info';
  const titulo = document.createElement('h3');
  const sub = document.createElement('p');
  sub.className = 'rs-sub';
  if (!s.configurado) {
    titulo.textContent = 'Instagram: aguardando liberação da Meta';
    sub.textContent = 'A integração já está pronta aqui na Lumia. Falta a Meta aprovar o app que dá acesso às DMs, comentários e publicações. Assim que for aprovado, o botão de conectar aparece aqui.';
    info.append(titulo, sub);
    linha.appendChild(info);
  } else if (!s.conectado) {
    titulo.textContent = 'Conecte o Instagram da sua empresa';
    sub.textContent = 'Precisa ser uma conta profissional (comercial ou criador de conteúdo). Você entra com o login do Instagram e autoriza a Lumia a ler e responder as mensagens e comentários e a publicar.';
    info.append(titulo, sub);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'relatorio-config-enviar';
    btn.textContent = 'Conectar Instagram';
    btn.addEventListener('click', () => { window.location.href = `/api/instagram/conectar?token=${encodeURIComponent(appPassword)}`; });
    linha.append(info, btn);
  } else {
    const c = s.conta;
    if (c.fotoUrl) {
      const img = document.createElement('img');
      img.className = 'ig-foto';
      img.src = c.fotoUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      linha.appendChild(img);
    }
    titulo.textContent = `@${c.username}${c.nome ? ` · ${c.nome}` : ''}`;
    sub.textContent = `Conectado desde ${new Date(c.conectadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' })}. O acesso renova sozinho.`;
    info.append(titulo, sub);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'crm-btn-secundario';
    btn.textContent = 'Desconectar';
    btn.addEventListener('click', async () => {
      if (!confirm(`Desconectar @${c.username}? As DMs e comentários param de chegar e as publicações agendadas não saem até conectar de novo.`)) return;
      try {
        await igApi('/api/instagram/desconectar', { method: 'POST' });
        mostrarAviso('Instagram desconectado');
        carregarInstagram();
      } catch (err) {
        mostrarAviso(`Não consegui desconectar: ${err.message}`, 'erro');
      }
    });
    linha.append(info, btn);
  }
  igConta.appendChild(linha);
}

// sub-abas (Publicar / Respostas a comentarios / Direct)
document.querySelector('.ig-abas').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-ig-sec]');
  if (!btn) return;
  for (const b of document.querySelectorAll('.ig-abas button')) b.classList.toggle('ativo', b === btn);
  for (const p of document.querySelectorAll('[data-ig-painel]')) p.hidden = p.dataset.igPainel !== btn.dataset.igSec;
});

// ---------- publicar ----------

function igAtualizarTipo() {
  const t = IG_TIPOS[igTipo];
  for (const b of igTipos.querySelectorAll('button')) b.classList.toggle('ativo', b.dataset.tipo === igTipo);
  igTipoDica.textContent = t.dica;
  igArquivos.accept = t.aceita;
  igArquivos.multiple = t.varios;
  igArquivosTexto.textContent = t.botao;
  igLegendaCampo.hidden = igTipo === 'story';
  igSelecionados = [];
  igRenderizarPrevias();
}
igTipos.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-tipo]');
  if (!btn) return;
  igTipo = btn.dataset.tipo;
  igAtualizarTipo();
});

igArquivos.addEventListener('change', () => {
  const novos = [...(igArquivos.files || [])];
  igSelecionados = IG_TIPOS[igTipo].varios ? [...igSelecionados, ...novos].slice(0, 10) : novos.slice(0, 1);
  igArquivos.value = '';
  igRenderizarPrevias();
});

function igRenderizarPrevias() {
  for (const url of igPrevias.querySelectorAll('[data-url]')) URL.revokeObjectURL(url.dataset.url);
  igPrevias.textContent = '';
  igSelecionados.forEach((arq, i) => {
    const item = document.createElement('div');
    item.className = 'ig-previa';
    const url = URL.createObjectURL(arq);
    item.dataset.url = url;
    const midia = document.createElement(arq.type.startsWith('video/') ? 'video' : 'img');
    midia.src = url;
    if (midia.tagName === 'VIDEO') { midia.muted = true; midia.playsInline = true; }
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.textContent = '✕';
    remover.title = 'Tirar';
    remover.addEventListener('click', () => { igSelecionados.splice(i, 1); igRenderizarPrevias(); });
    item.append(midia, remover);
    if (igSelecionados.length > 1) {
      const n = document.createElement('span');
      n.className = 'ig-previa-n';
      n.textContent = String(i + 1);
      item.appendChild(n);
    }
    igPrevias.appendChild(item);
  });
}

igLegenda.addEventListener('input', () => { igLegendaConta.textContent = `${igLegenda.value.length} / 2200`; });
for (const r of document.querySelectorAll('input[name="igQuando"]')) {
  r.addEventListener('change', () => {
    const agendar = document.querySelector('input[name="igQuando"]:checked').value === 'agendar';
    igAgendarPara.hidden = !agendar;
    igPublicarBtn.textContent = agendar ? 'Agendar publicação' : 'Publicar agora';
    if (agendar && !igAgendarPara.value) {
      const d = new Date(Date.now() + 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      igAgendarPara.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
  });
}

// o Instagram so publica foto em JPEG e recusa proporcao fora de 4:5..1,91:1 no feed - converte
// e corta pelo centro aqui no navegador, antes de subir
async function igPrepararFoto(arquivo, tipo) {
  const bitmap = await createImageBitmap(arquivo);
  let { width: w, height: h } = bitmap;
  let sx = 0;
  let sy = 0;
  if (tipo !== 'story') {
    const r = w / h;
    if (r < 0.8) { const nh = Math.round(w / 0.8); sy = Math.round((h - nh) / 2); h = nh; }
    else if (r > 1.91) { const nw = Math.round(h * 1.91); sx = Math.round((w - nw) / 2); w = nw; }
  }
  const escala = Math.min(1, 1440 / w);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  canvas.getContext('2d').drawImage(bitmap, sx, sy, w, h, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('não consegui converter a foto'))), 'image/jpeg', 0.9));
}

function igMostrarErroPost(msg) {
  igPostErro.textContent = msg || '';
  igPostErro.hidden = !msg;
}

igPublicarBtn.addEventListener('click', async () => {
  igMostrarErroPost('');
  if (!igSelecionados.length) return igMostrarErroPost('Escolha o arquivo da publicação.');
  if (igTipo === 'carrossel' && igSelecionados.length < 2) return igMostrarErroPost('Carrossel precisa de pelo menos 2 arquivos.');
  const agendar = document.querySelector('input[name="igQuando"]:checked').value === 'agendar';
  if (agendar && (!igAgendarPara.value || new Date(igAgendarPara.value) <= new Date())) return igMostrarErroPost('Escolha uma data e hora no futuro.');
  const textoBotao = igPublicarBtn.textContent;
  igPublicarBtn.disabled = true;
  try {
    const tokens = [];
    for (const [i, arq] of igSelecionados.entries()) {
      igPublicarBtn.textContent = `Enviando arquivo ${i + 1} de ${igSelecionados.length}...`;
      let corpo = arq;
      let tipoMime = arq.type;
      if (arq.type.startsWith('image/')) {
        corpo = await igPrepararFoto(arq, igTipo);
        tipoMime = 'image/jpeg';
      } else if (!/^video\/(mp4|quicktime)$/.test(arq.type)) {
        throw new Error(`"${arq.name}" não é foto nem vídeo MP4/MOV.`);
      } else if (arq.size > 100 * 1024 * 1024) {
        throw new Error(`"${arq.name}" passa de 100 MB.`);
      }
      const r = await igApi('/api/instagram/midias', { method: 'POST', body: corpo, headers: { 'Content-Type': tipoMime, 'x-nome-arquivo': encodeURIComponent(arq.name) } });
      tokens.push(r.token);
    }
    igPublicarBtn.textContent = agendar ? 'Agendando...' : 'Publicando...';
    await igApi('/api/instagram/posts', {
      method: 'POST',
      body: JSON.stringify({ tipo: igTipo, legenda: igLegenda.value, midias: tokens, agendadoPara: agendar ? new Date(igAgendarPara.value).toISOString() : null }),
    });
    mostrarAviso(agendar ? 'Publicação agendada' : 'Publicando no Instagram - em instantes aparece como publicada');
    igSelecionados = [];
    igRenderizarPrevias();
    igLegenda.value = '';
    igLegendaConta.textContent = '0 / 2200';
    carregarPostsInstagram();
  } catch (err) {
    igMostrarErroPost(err.message);
  } finally {
    igPublicarBtn.disabled = false;
    igPublicarBtn.textContent = textoBotao;
  }
});

async function carregarPostsInstagram() {
  try {
    const { posts } = await igApi('/api/instagram/posts');
    igPosts.textContent = '';
    if (!posts.length) {
      igPosts.appendChild(Object.assign(document.createElement('p'), { className: 'rs-vazio', textContent: 'Nenhuma publicação feita pela Lumia ainda.' }));
      return;
    }
    const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    for (const p of posts) {
      const item = document.createElement('div');
      item.className = 'ig-item';
      const topo = document.createElement('div');
      topo.className = 'ig-item-topo';
      const nome = document.createElement('strong');
      nome.textContent = `${IG_TIPOS[p.tipo]?.nome || p.tipo}${p.midias.length > 1 ? ` · ${p.midias.length} arquivos` : ''}`;
      const chip = document.createElement('span');
      chip.className = `ig-status ${p.status}`;
      chip.textContent = p.status === 'agendado' ? `Agendado · ${quando(p.agendado_para)}`
        : p.status === 'publicado' ? `Publicado · ${quando(p.publicado_em)}` : IG_STATUS[p.status] || p.status;
      topo.append(nome, chip);
      item.appendChild(topo);
      if (p.legenda) item.appendChild(Object.assign(document.createElement('p'), { className: 'ig-item-texto', textContent: p.legenda.length > 160 ? `${p.legenda.slice(0, 160)}…` : p.legenda }));
      if (p.erro) item.appendChild(Object.assign(document.createElement('p'), { className: 'ig-item-erro', textContent: p.erro }));
      const acoes = document.createElement('div');
      acoes.className = 'ig-item-acoes';
      if (p.permalink) {
        const a = document.createElement('a');
        a.href = p.permalink;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Ver no Instagram';
        acoes.appendChild(a);
      }
      if (p.status === 'agendado') {
        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'ct-link';
        cancelar.textContent = 'Cancelar';
        cancelar.addEventListener('click', async () => {
          if (!confirm('Cancelar essa publicação agendada?')) return;
          try {
            await igApi(`/api/instagram/posts/${p.id}/cancelar`, { method: 'POST' });
            carregarPostsInstagram();
          } catch (err) {
            mostrarAviso(err.message, 'erro');
          }
        });
        acoes.appendChild(cancelar);
      }
      if (acoes.childElementCount) item.appendChild(acoes);
      igPosts.appendChild(item);
    }
  } catch (err) {
    igPosts.textContent = `Não consegui carregar as publicações: ${err.message}`;
  }
}
document.getElementById('igPostsAtualizar').addEventListener('click', carregarPostsInstagram);

// ---------- respostas a comentarios ----------

async function carregarPublicacoesInstagram() {
  try {
    const { publicacoes } = await igApi('/api/instagram/publicacoes');
    const atual = igRegraPost.value;
    igRegraPost.textContent = '';
    igRegraPost.appendChild(new Option('Todas as publicações', ''));
    for (const p of publicacoes) {
      const data = new Date(p.em).toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit' });
      igRegraPost.appendChild(new Option(`${data} · ${p.legenda || '(sem legenda)'}`.slice(0, 80), p.id));
    }
    igRegraPost.value = [...igRegraPost.options].some((o) => o.value === atual) ? atual : '';
  } catch { /* fica so "Todas as publicacoes" */ }
}

function igMostrarErroRegra(msg) {
  igRegraErro.textContent = msg || '';
  igRegraErro.hidden = !msg;
}

function igEditarRegra(regra) {
  igRegraEditando = regra;
  igRegraTitulo.textContent = regra ? 'Editar resposta automática' : 'Nova resposta automática';
  igRegraPalavras.value = regra ? regra.palavras.join(', ') : '';
  if (regra?.media_id && ![...igRegraPost.options].some((o) => o.value === regra.media_id)) {
    igRegraPost.appendChild(new Option(regra.media_legenda || 'Publicação escolhida', regra.media_id));
  }
  igRegraPost.value = regra?.media_id || '';
  igRegraPublica.value = regra?.resposta_publica || '';
  igRegraDm.value = regra?.resposta_dm || '';
  igRegraCancelar.hidden = !regra;
  igMostrarErroRegra('');
  limparPendente(igRegraSalvar);
  if (regra) igRegraPalavras.focus();
}
igRegraCancelar.addEventListener('click', () => igEditarRegra(null));
rastrearAlteracoes(igRegraSalvar, [igRegraPalavras, igRegraPost, igRegraPublica, igRegraDm]);

igRegraSalvar.addEventListener('click', async () => {
  igMostrarErroRegra('');
  igRegraSalvar.disabled = true;
  try {
    const opcao = igRegraPost.selectedOptions[0];
    await igApi('/api/instagram/regras', {
      method: 'POST',
      body: JSON.stringify({
        id: igRegraEditando?.id || null,
        palavras: igRegraPalavras.value,
        mediaId: igRegraPost.value || null,
        mediaLegenda: igRegraPost.value ? opcao?.textContent : null,
        respostaPublica: igRegraPublica.value,
        respostaDm: igRegraDm.value,
      }),
    });
    marcarSalvo(igRegraSalvar, igRegraEditando ? 'Resposta atualizada' : 'Resposta automática criada');
    igEditarRegra(null);
    carregarRegrasInstagram();
  } catch (err) {
    igMostrarErroRegra(err.message);
  } finally {
    igRegraSalvar.disabled = false;
  }
});

async function carregarRegrasInstagram() {
  try {
    const { regras } = await igApi('/api/instagram/regras');
    igRegrasLista = regras;
    igRegras.textContent = '';
    if (!regras.length) {
      igRegras.appendChild(Object.assign(document.createElement('p'), { className: 'rs-vazio', textContent: 'Nenhuma resposta automática ainda.' }));
      return;
    }
    for (const r of regras) {
      const item = document.createElement('div');
      item.className = `ig-item${r.ativo ? '' : ' inativo'}`;
      const topo = document.createElement('div');
      topo.className = 'ig-item-topo';
      const chips = document.createElement('div');
      chips.className = 'ig-chips';
      for (const p of r.palavras) chips.appendChild(Object.assign(document.createElement('span'), { className: 'ct-chip', textContent: p }));
      const chave = document.createElement('label');
      chave.className = 'auto-switch ig-switch';
      chave.title = r.ativo ? 'Ligada - clique para pausar' : 'Pausada - clique para ligar';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = r.ativo;
      cb.addEventListener('change', async () => {
        try {
          await igApi(`/api/instagram/regras/${r.id}/ativo`, { method: 'POST', body: JSON.stringify({ ativo: cb.checked }) });
          carregarRegrasInstagram();
        } catch (err) {
          mostrarAviso(err.message, 'erro');
          cb.checked = !cb.checked;
        }
      });
      const trilho = document.createElement('span');
      trilho.className = 'auto-switch-track';
      trilho.appendChild(Object.assign(document.createElement('span'), { className: 'auto-switch-thumb' }));
      chave.append(cb, trilho);
      topo.append(chips, chave);
      item.appendChild(topo);
      item.appendChild(Object.assign(document.createElement('p'), { className: 'rs-sub', textContent: `${r.media_id ? `Só em: ${r.media_legenda || 'uma publicação'}` : 'Todas as publicações'} · respondeu ${r.disparos} ${r.disparos === 1 ? 'vez' : 'vezes'}` }));
      if (r.resposta_publica) item.appendChild(Object.assign(document.createElement('p'), { className: 'ig-item-texto', textContent: `Comentário: ${r.resposta_publica}` }));
      if (r.resposta_dm) item.appendChild(Object.assign(document.createElement('p'), { className: 'ig-item-texto', textContent: `Direct: ${r.resposta_dm}` }));
      const acoes = document.createElement('div');
      acoes.className = 'ig-item-acoes';
      const editar = Object.assign(document.createElement('button'), { type: 'button', className: 'ct-link', textContent: 'Editar' });
      editar.addEventListener('click', () => { igEditarRegra(r); igRegraPalavras.scrollIntoView({ block: 'center' }); });
      const apagar = Object.assign(document.createElement('button'), { type: 'button', className: 'ct-link ig-perigo', textContent: 'Apagar' });
      apagar.addEventListener('click', async () => {
        if (!confirm(`Apagar a resposta automática para "${r.palavras.join(', ')}"?`)) return;
        try {
          await igApi(`/api/instagram/regras/${r.id}`, { method: 'DELETE' });
          if (igRegraEditando?.id === r.id) igEditarRegra(null);
          carregarRegrasInstagram();
        } catch (err) {
          mostrarAviso(err.message, 'erro');
        }
      });
      acoes.append(editar, apagar);
      item.appendChild(acoes);
      igRegras.appendChild(item);
    }
  } catch (err) {
    igRegras.textContent = `Não consegui carregar as respostas: ${err.message}`;
  }
}

// ---------- direct ----------

function igAtualizarRotuloDm() {
  igDmIaLabel.textContent = igDmIa.checked ? 'IA respondendo o direct' : 'IA desligada no direct';
}
igDmIa.addEventListener('change', async () => {
  igAtualizarRotuloDm();
  try {
    await igApi('/api/instagram/dm-ia', { method: 'POST', body: JSON.stringify({ ativa: igDmIa.checked }) });
    mostrarAviso(igDmIa.checked ? 'A IA passa a responder o direct' : 'IA desligada no direct');
  } catch (err) {
    igDmIa.checked = !igDmIa.checked;
    igAtualizarRotuloDm();
    mostrarAviso(err.message, 'erro');
  }
});

// volta do login do Instagram (?instagram=conectado|erro)
(function tratarRetornoInstagram() {
  const params = new URLSearchParams(window.location.search);
  const resultado = params.get('instagram');
  if (!resultado) return;
  const msg = params.get('msg');
  params.delete('instagram');
  params.delete('msg');
  window.history.replaceState({}, '', window.location.pathname + (params.toString() ? `?${params}` : ''));
  setTimeout(() => {
    if (resultado === 'conectado') mostrarAviso('Instagram conectado');
    else mostrarAviso(`Não consegui conectar o Instagram: ${msg || 'erro desconhecido'}`, 'erro');
    if (appPassword) mudarAba('instagram');
  }, 600);
})();

// ---------- Alerta de retorno (conversa do CRM) ----------
const crmConversaRetorno = document.getElementById('crmConversaRetorno');
const crmRetornoBanner = document.getElementById('crmRetornoBanner');
const crmRetornoPainel = document.getElementById('crmRetornoPainel');
const crmRetornoQuando = document.getElementById('crmRetornoQuando');
const crmRetornoNota = document.getElementById('crmRetornoNota');
const crmRetornoSalvar = document.getElementById('crmRetornoSalvar');
const crmRetornoRemover = document.getElementById('crmRetornoRemover');
const crmRetornoFechar = document.getElementById('crmRetornoFechar');
const crmRetornoErro = document.getElementById('crmRetornoErro');

function crmFormatarRetorno(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function crmParaInputLocal(data) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function crmMarcarLido(id) {
  fetch(`/api/crm/contatos/${id}/lido`, { method: 'POST', headers: { 'x-app-password': appPassword } })
    .then(() => atualizarSino())
    .catch(() => {});
}

function crmAtualizarRetorno() {
  const c = crmContatoAberto;
  crmConversaRetorno.textContent = c?.retorno_em ? 'Alerta de retorno ✓' : 'Alerta de retorno';
  crmConversaRetorno.classList.toggle('crm-btn-ativo', !!c?.retorno_em);
  if (!c?.retorno_em) { crmRetornoBanner.hidden = true; return; }
  const quando = crmFormatarRetorno(c.retorno_em);
  const nota = c.retorno_nota ? ` - ${c.retorno_nota}` : '';
  const ia = c.retorno_origem === 'ia' ? ' (combinado pela IA)' : '';
  const retomou = c.retorno_disparado_em ? ' · a IA já retomou o contato' : '';
  crmRetornoBanner.textContent = c.retorno_hoje
    ? `⏰ HOJE é o dia do retorno (${quando})${nota}${ia}${retomou}`
    : `⏰ Retorno agendado para ${quando}${nota}${ia}`;
  crmRetornoBanner.classList.toggle('hoje', !!c.retorno_hoje);
  crmRetornoBanner.hidden = false;
}

crmConversaRetorno.addEventListener('click', () => {
  if (!crmContatoAberto) return;
  crmRetornoErro.hidden = true;
  if (!crmRetornoPainel.hidden) { crmRetornoPainel.hidden = true; return; }
  if (crmContatoAberto.retorno_em) {
    crmRetornoQuando.value = crmParaInputLocal(new Date(crmContatoAberto.retorno_em));
    crmRetornoNota.value = crmContatoAberto.retorno_nota || '';
  } else {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    amanha.setHours(9, 0, 0, 0);
    crmRetornoQuando.value = crmParaInputLocal(amanha);
    crmRetornoNota.value = '';
  }
  crmRetornoRemover.hidden = !crmContatoAberto.retorno_em;
  crmRetornoPainel.hidden = false;
});
crmRetornoFechar.addEventListener('click', () => { crmRetornoPainel.hidden = true; });

crmRetornoSalvar.addEventListener('click', async () => {
  if (!crmContatoAberto) return;
  crmRetornoErro.hidden = true;
  if (!crmRetornoQuando.value) {
    crmRetornoErro.textContent = 'Escolha a data e a hora do retorno.';
    crmRetornoErro.hidden = false;
    return;
  }
  crmRetornoSalvar.disabled = true;
  try {
    const res = await fetch(`/api/crm/contatos/${crmContatoAberto.id}/retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ quando: new Date(crmRetornoQuando.value).toISOString(), nota: crmRetornoNota.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    crmRetornoPainel.hidden = true;
    marcarSalvo(crmRetornoSalvar, 'Alerta de retorno salvo');
    await carregarCrm();
    atualizarSino();
  } catch (err) {
    crmRetornoErro.textContent = err.message;
    crmRetornoErro.hidden = false;
  } finally {
    crmRetornoSalvar.disabled = false;
  }
});

crmRetornoRemover.addEventListener('click', async () => {
  if (!crmContatoAberto) return;
  try {
    const res = await fetch(`/api/crm/contatos/${crmContatoAberto.id}/retorno`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
    if (!res.ok) throw new Error((await res.json()).erro || 'erro desconhecido');
    crmContatoAberto.retorno_em = null;
    crmRetornoPainel.hidden = true;
    await carregarCrm();
    atualizarSino();
  } catch (err) {
    crmRetornoErro.textContent = err.message;
    crmRetornoErro.hidden = false;
  }
});

// ---------- Sino de notificacoes (barra do topo) ----------
const sinoBtn = document.getElementById('sinoBtn');
const sinoBadge = document.getElementById('sinoBadge');
const sinoPainel = document.getElementById('sinoPainel');
const sinoLista = document.getElementById('sinoLista');
const sinoTotal = document.getElementById('sinoTotal');
let sinoIniciado = false;
const URL_RECARGA_ANTHROPIC = 'https://platform.claude.com/settings/billing'; // Console da Anthropic: Plans & Billing

function sinoSecao(titulo) {
  const h = document.createElement('div');
  h.className = 'sino-secao';
  h.textContent = titulo;
  sinoLista.appendChild(h);
}

function sinoItem(titulo, detalhe, classe, aoClicar, recarregar) {
  const el = document.createElement('div');
  el.className = `sino-item ${classe || ''}`;
  el.textContent = titulo;
  if (detalhe) {
    const small = document.createElement('small');
    small.textContent = detalhe;
    el.appendChild(small);
  }
  if (recarregar) {
    const a = document.createElement('a');
    a.className = 'sino-recarregar';
    a.href = URL_RECARGA_ANTHROPIC;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Recarregar créditos ↗';
    el.appendChild(a);
  }
  if (aoClicar) el.addEventListener('click', aoClicar);
  sinoLista.appendChild(el);
}

async function sinoAbrirContato(id) {
  sinoPainel.hidden = true;
  const emConversas = !tabBtnConversas.hidden;
  mudarAba(emConversas ? 'conversas' : 'crm');
  try {
    const res = await fetch('/api/crm/contatos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    const contato = (data.contatos || []).find((c) => c.id === id);
    if (contato) (emConversas ? abrirConversa : abrirConversaCrm)(contato);
  } catch { /* o board ja carrega sozinho ao entrar na aba */ }
}

async function atualizarSino() {
  if (appWindow.hidden) return;
  try {
    const res = await fetch('/api/notificacoes', { headers: { 'x-app-password': appPassword } });
    if (!res.ok) return;
    const d = await res.json();
    sinoBadge.hidden = !d.total;
    if (tabConversas.hidden) atualizarBadgeConversas(d.naoLidas?.length || 0);
    sinoTotal.textContent = d.total ? `${d.total} pendente(s)` : '';
    sinoLista.textContent = '';
    if (!d.total) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Tudo em dia - nenhuma pendência.';
      sinoLista.appendChild(vazio);
      return;
    }
    if (d.alertas?.length) {
      sinoSecao('Atenção');
      for (const a of d.alertas) sinoItem(`⚠️ ${a.titulo}`, a.detalhe, 'vermelho', null, a.recarregar);
    }
    if (d.retornos.length) {
      sinoSecao('Alertas de retorno de hoje');
      for (const r of d.retornos) {
        sinoItem(`⏰ ${r.nome || r.numero}`, `${crmFormatarRetorno(r.retorno_em)}${r.retorno_nota ? ` - ${r.retorno_nota}` : ''}${r.retorno_disparado_em ? ' · IA já retomou' : ''}`, 'laranja', () => sinoAbrirContato(r.id));
      }
    }
    if (d.naoLidas.length) {
      sinoSecao('Mensagens novas');
      for (const m of d.naoLidas) sinoItem(m.nome || m.numero, m.ultima_mensagem, '', () => sinoAbrirContato(m.id));
    }
    if (d.preAgendamentos.length) {
      sinoSecao('Pré-agendamentos aguardando confirmação');
      for (const p of d.preAgendamentos) {
        const pa = p.pre_agendamento || {};
        const [, mes, dia] = (pa.data || '').split('-');
        sinoItem(p.nome || p.numero, pa.data ? `${dia}/${mes} ${pa.de || ''}${pa.medico ? ` - ${pa.medico}` : ''}` : 'sem horário anotado', '', () => sinoAbrirContato(p.id));
      }
    }
    if (d.faltas.length) {
      sinoSecao('Faltas recentes (Clinicorp)');
      for (const f of d.faltas) {
        const [, mes, dia] = (f.data || '').split('-');
        sinoItem(f.paciente || 'Paciente', `faltou em ${dia}/${mes} ${f.hora || ''} - vale tentar reagendar`, 'vermelho');
      }
    }
  } catch { /* sem rede / sessao expirada - tenta de novo no proximo ciclo */ }
}

sinoBtn.addEventListener('click', (ev) => {
  ev.stopPropagation();
  sinoPainel.hidden = !sinoPainel.hidden;
  if (!sinoPainel.hidden) atualizarSino();
});
document.addEventListener('click', (ev) => {
  if (!sinoPainel.hidden && !document.getElementById('sinoWrap').contains(ev.target)) sinoPainel.hidden = true;
});

// ---------- Indicador de saldo da IA (so o dono; estimativa - ver src/saldoIA.js) ----------
const saldoWrap = document.getElementById('saldoWrap');
const saldoChip = document.getElementById('saldoChip');
const saldoChipTexto = document.getElementById('saldoChipTexto');
const saldoPainel = document.getElementById('saldoPainel');
const saldoValor = document.getElementById('saldoValor');
const saldoDetalhe = document.getElementById('saldoDetalhe');
const saldoNivel = document.getElementById('saldoNivel');
const saldoInput = document.getElementById('saldoInput');
const saldoLimite = document.getElementById('saldoLimite');
const saldoSalvar = document.getElementById('saldoSalvar');
const saldoMsg = document.getElementById('saldoMsg');
const saldoUso = document.getElementById('saldoUso');
let saldoIniciado = false;

const usd = (v) => `US$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NIVEL_TEXTO = { ok: 'Saldo ok', atencao: 'Atenção', baixo: 'Saldo baixo', zerado: 'ZERADO', 'sem-config': 'Não informado' };

function renderSaldo(d) {
  saldoChip.className = `saldo-chip ${d.nivel}`;
  saldoPainel.classList.toggle('critico', d.nivel === 'baixo' || d.nivel === 'zerado');
  saldoNivel.textContent = NIVEL_TEXTO[d.nivel] || '';
  if (!d.configurado) {
    saldoChipTexto.textContent = 'Saldo IA';
    saldoValor.textContent = '--';
    saldoDetalhe.textContent = 'Informe abaixo quanto você tem na Anthropic para o app acompanhar o consumo e avisar antes de acabar.';
  } else {
    saldoChipTexto.textContent = d.nivel === 'zerado' ? 'IA sem saldo - recarregar' : `IA ${usd(d.saldoUsd)}`;
    saldoValor.textContent = `~${usd(d.saldoUsd)}`;
    const partes = [`Gasto hoje: ${usd(d.gastoHojeUsd)}`, `média ${usd(d.mediaDiariaUsd)}/dia (7 dias)`];
    if (d.diasRestantes !== null) partes.push(`dá para ~${d.diasRestantes < 1 ? 'menos de 1 dia' : `${Math.floor(d.diasRestantes)} dia(s)`} neste ritmo`);
    saldoDetalhe.textContent = partes.join(' · ');
  }
  // cache + quem mais consome (7 dias) - mostra se a economia por prompt caching esta funcionando
  saldoUso.textContent = '';
  const linha = (rotulo, valor) => {
    const l = document.createElement('div');
    l.className = 'linha';
    const a = document.createElement('span');
    a.textContent = rotulo;
    const b = document.createElement('strong');
    b.textContent = valor;
    l.append(a, b);
    saldoUso.appendChild(l);
  };
  if (d.cachePct !== null && d.cachePct !== undefined) linha('Entrada vinda do cache (7 dias)', `${d.cachePct}%`);
  const NOMES_MODULO = { 'auto-atendimento': 'Auto Atendimento', lumia: 'Lumia', 'follow-up': 'Follow Up', 'gerador-relatorios': 'Gerador de Relatórios' };
  for (const r of d.porCliente || []) linha(`${r.nome} · ${NOMES_MODULO[r.modulo] || r.modulo || 'outros'}`, usd(r.custoUsd));
  if (document.activeElement !== saldoLimite) saldoLimite.value = String(d.limiteAlertaUsd).replace('.', ',');
}

async function atualizarSaldo() {
  if (appWindow.hidden || !souSuperAdmin) { saldoWrap.hidden = true; return; }
  try {
    const res = await fetch('/api/saldo-ia', { headers: { 'x-app-password': appPassword } });
    if (!res.ok) return;
    saldoWrap.hidden = false;
    renderSaldo(await res.json());
  } catch { /* tenta de novo no proximo ciclo */ }
}

saldoChip.addEventListener('click', (ev) => {
  ev.stopPropagation();
  saldoPainel.hidden = !saldoPainel.hidden;
  if (!saldoPainel.hidden) { saldoMsg.textContent = ''; atualizarSaldo(); }
});
saldoPainel.addEventListener('click', (ev) => ev.stopPropagation());
document.addEventListener('click', () => { saldoPainel.hidden = true; });
saldoSalvar.addEventListener('click', async () => {
  saldoMsg.textContent = 'Salvando...';
  try {
    const res = await fetch('/api/saldo-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ saldoUsd: saldoInput.value.trim(), limiteAlertaUsd: saldoLimite.value.trim() }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.erro || 'erro ao salvar');
    saldoInput.value = '';
    renderSaldo(d);
    saldoMsg.textContent = 'Salvo.';
    marcarSalvo(saldoSalvar, 'Saldo da IA atualizado');
    atualizarSino();
  } catch (err) {
    saldoMsg.textContent = err.message;
  }
});

function iniciarSino() {
  atualizarSino();
  atualizarSaldo();
  if (!saldoIniciado) { saldoIniciado = true; setInterval(atualizarSaldo, 60000); }
  if (sinoIniciado) return;
  sinoIniciado = true;
  setInterval(atualizarSino, 30000);
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

// o toggle "Agendar direto no Clinicorp" so faz sentido com o Clinicorp ligado - fica escondido
// senao. Nao mexe no valor salvo (checked) so por esconder/mostrar, so na visibilidade.
function atualizarVisibilidadeAgendamentoDireto() {
  autoAgendamentoDiretoWrap.hidden = !autoAgendarClinicorp.checked;
}
autoAgendarClinicorp.addEventListener('change', atualizarVisibilidadeAgendamentoDireto);
autoHoraLimpar.addEventListener('click', () => {
  autoHoraInicio.value = '';
  autoHoraFim.value = '';
  marcarAlteracoesNaoSalvas();
});
autoAgendamentoDireto.addEventListener('change', () => {
  autoAgendamentoDiretoLabel.textContent = autoAgendamentoDireto.checked ? 'Agendar direto no Clinicorp' : 'So pre-agendar (atendente confirma depois)';
});

// o botao "Salvar Configurações" fica vermelho assim que qualquer campo da aba muda (avisa que
// tem alteracao pendente) e volta pro dourado (com um "pulso" rapido) so depois de salvar de
// verdade com sucesso - assim fica visivelmente claro quando ainda falta salvar
function marcarAlteracoesNaoSalvas() {
  marcarPendente(autoSalvar);
}
[autoAtivo, autoInstancia, autoPrompt, autoFrequenciaAudio, autoAudioSeReceberAudio, autoEsperaSegundos, autoHoraInicio, autoHoraFim, autoAgendarInterna, autoAgendarClinicorp, autoAgendamentoDireto, autoReiniciarValor, autoReiniciarUnidade]
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
    autoEsperaSegundos.value = config.respostaEsperaSegundos > 0 ? String(config.respostaEsperaSegundos) : '';
    autoHoraInicio.value = config.horaInicio || '';
    autoHoraFim.value = config.horaFim || '';
    autoAgendarInterna.checked = !!config.agendarAgendaInterna;
    autoAgendarClinicorp.checked = !!config.agendarClinicorp;
    autoAgendamentoDireto.checked = config.agendamentoDiretoClinicorp !== false;
    autoAgendamentoDiretoLabel.textContent = autoAgendamentoDireto.checked ? 'Agendar direto no Clinicorp' : 'So pre-agendar (atendente confirma depois)';
    atualizarVisibilidadeAgendamentoDireto();

    // horas guardadas no banco -> mostra na unidade mais legivel (dias quando da exato, senao horas)
    if (config.reiniciarAposHoras && config.reiniciarAposHoras > 0) {
      if (config.reiniciarAposHoras % 24 === 0) {
        autoReiniciarValor.value = String(config.reiniciarAposHoras / 24);
        autoReiniciarUnidade.value = 'dias';
      } else {
        autoReiniciarValor.value = String(config.reiniciarAposHoras);
        autoReiniciarUnidade.value = 'horas';
      }
    } else {
      autoReiniciarValor.value = '';
      autoReiniciarUnidade.value = 'horas';
    }

    // acabou de carregar do servidor - nao tem nada "nao salvo" ainda
    limparPendente(autoSalvar);
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
  const respostaEsperaSegundos = Number(autoEsperaSegundos.value) || 0;
  const horaInicio = autoHoraInicio.value;
  const horaFim = autoHoraFim.value;
  const agendarAgendaInterna = autoAgendarInterna.checked;
  const agendarClinicorp = autoAgendarClinicorp.checked;
  const agendamentoDiretoClinicorp = autoAgendamentoDireto.checked;
  const reiniciarValor = Number(autoReiniciarValor.value) || 0;
  const reiniciarAposHoras = reiniciarValor > 0 ? (autoReiniciarUnidade.value === 'dias' ? reiniciarValor * 24 : reiniciarValor) : null;
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
      body: JSON.stringify({ ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, respostaEsperaSegundos, horaInicio, horaFim, agendarAgendaInterna, agendarClinicorp, agendamentoDiretoClinicorp, reiniciarAposHoras }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');

    // salvou de verdade - tira o vermelho, volta pro dourado com um "pulso" rapido pra ficar
    // visivel que salvou agora mesmo (nao so que "nao ha mudanca pendente")
    marcarSalvo(autoSalvar, 'Configurações do Auto Atendimento salvas e valendo');

    addBubble(`Configurações salvas e já valendo${ativo ? ` no numero "${instancia}"` : ' (desativado)'}.`, 'system');
  } catch (err) {
    autoErro.textContent = err.message;
    autoErro.hidden = false;
  } finally {
    autoSalvar.disabled = false;
  }
});

// botao "Resetar histórico de todas as conversas" - apaga a memoria de TODOS os leads do tenant
// de uma vez so, pedindo confirmacao explicita antes ja que nao tem como desfazer
autoResetarHistorico.addEventListener('click', async () => {
  const ok = confirm('Isso apaga a memoria de conversa de TODOS os leads desse numero. A proxima mensagem de qualquer contato vai comecar do zero, como se nunca tivesse falado com ela antes. Nao da pra desfazer. Confirma?');
  if (!ok) return;
  autoResetarHistorico.disabled = true;
  try {
    const res = await fetch('/api/auto-atendimento/resetar-historico', {
      method: 'POST',
      headers: { 'x-app-password': appPassword },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    addBubble(`Histórico de conversas resetado (${data.apagadas || 0} conversa(s) apagada(s)). Todo lead vai comecar do zero na proxima mensagem.`, 'system');
  } catch (err) {
    autoErro.textContent = err.message;
    autoErro.hidden = false;
  } finally {
    autoResetarHistorico.disabled = false;
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

// ---------- Follow Up (reengajamento automatico de leads parados, coluna "follow_up" do CRM) ----------

const fuAtivo = document.getElementById('fuAtivo');
const fuAtivoLabel = document.getElementById('fuAtivoLabel');
const fuPromptGeral = document.getElementById('fuPromptGeral');
const fuHoraInicio = document.getElementById('fuHoraInicio');
const fuHoraFim = document.getElementById('fuHoraFim');
const fuSalvar = document.getElementById('fuSalvar');
const fuErro = document.getElementById('fuErro');
const fuEtapasLista = document.getElementById('fuEtapasLista');

fuAtivo.addEventListener('change', () => {
  fuAtivoLabel.textContent = fuAtivo.checked ? 'Ativado' : 'Desativado';
});

async function carregarFollowUp() {
  fuErro.hidden = true;
  try {
    const res = await fetch('/api/follow-up/config', { headers: { 'x-app-password': appPassword } });
    const config = await res.json();
    if (!res.ok) throw new Error(config.erro || 'erro desconhecido');
    fuAtivo.checked = !!config.ativo;
    fuAtivoLabel.textContent = config.ativo ? 'Ativado' : 'Desativado';
    fuPromptGeral.value = config.promptGeral || '';
    fuHoraInicio.value = config.horaInicio || '08:00';
    fuHoraFim.value = config.horaFim || '20:00';
    limparPendente(fuSalvar);
  } catch (err) {
    fuErro.textContent = `Nao consegui carregar a configuracao: ${err.message}`;
    fuErro.hidden = false;
  }
  carregarEtapasFollowUp();
}

rastrearAlteracoes(fuSalvar, [fuAtivo, fuPromptGeral, fuHoraInicio, fuHoraFim]);
fuSalvar.addEventListener('click', async () => {
  fuErro.hidden = true;
  const ativo = fuAtivo.checked;
  const promptGeral = fuPromptGeral.value.trim();
  const horaInicio = fuHoraInicio.value;
  const horaFim = fuHoraFim.value;
  if (ativo && !promptGeral) {
    fuErro.textContent = 'Pra ativar, escreve o script geral de como a IA deve se comportar.';
    fuErro.hidden = false;
    return;
  }
  if (horaInicio && horaFim && horaInicio >= horaFim) {
    fuErro.textContent = 'O horario de inicio precisa ser antes do horario de fim.';
    fuErro.hidden = false;
    return;
  }
  fuSalvar.disabled = true;
  try {
    const res = await fetch('/api/follow-up/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ ativo, promptGeral, horaInicio, horaFim }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    addBubble(`Configurações do Follow Up salvas${ativo ? '' : ' (desativado)'}.`, 'system');
    marcarSalvo(fuSalvar, 'Configurações do Follow Up salvas');
  } catch (err) {
    fuErro.textContent = err.message;
    fuErro.hidden = false;
  } finally {
    fuSalvar.disabled = false;
  }
});

async function carregarEtapasFollowUp() {
  fuEtapasLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  fuEtapasLista.appendChild(carregando);

  try {
    const res = await fetch('/api/follow-up/etapas', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    fuEtapasLista.textContent = '';
    for (const etapa of data.etapas || []) {
      fuEtapasLista.appendChild(criarCardEtapaFollowUp(etapa));
    }
  } catch (err) {
    fuEtapasLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar as tentativas: ${err.message}`;
    fuEtapasLista.appendChild(erro);
  }
}

function criarCardEtapaFollowUp(etapa) {
  const card = document.createElement('div');
  card.className = 'auto-aviso relatorio-config-card';

  const titulo = document.createElement('div');
  titulo.className = 'relatorio-config-titulo';
  titulo.textContent = `Tentativa ${etapa.ordem}`;
  card.appendChild(titulo);

  const toggleRow = document.createElement('div');
  toggleRow.className = 'auto-toggle-row';
  const switchLabel = document.createElement('label');
  switchLabel.className = 'auto-switch';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = !!etapa.ativo;
  const track = document.createElement('span');
  track.className = 'auto-switch-track';
  const thumb = document.createElement('span');
  thumb.className = 'auto-switch-thumb';
  track.appendChild(thumb);
  switchLabel.appendChild(checkbox);
  switchLabel.appendChild(track);
  toggleRow.appendChild(switchLabel);
  const statusLabel = document.createElement('span');
  statusLabel.textContent = etapa.ativo ? 'Ativado' : 'Desativado';
  toggleRow.appendChild(statusLabel);
  card.appendChild(toggleRow);
  checkbox.addEventListener('change', () => {
    statusLabel.textContent = checkbox.checked ? 'Ativado' : 'Desativado';
  });

  const rotuloDias = document.createElement('label');
  rotuloDias.className = 'auto-label';
  rotuloDias.textContent = 'Quantos dias depois de entrar em Follow Up';
  card.appendChild(rotuloDias);
  const inputDias = document.createElement('input');
  inputDias.type = 'number';
  inputDias.min = '1';
  inputDias.className = 'relatorio-config-select';
  inputDias.value = etapa.dias;
  card.appendChild(inputDias);

  const rotuloScript = document.createElement('label');
  rotuloScript.className = 'auto-label';
  rotuloScript.textContent = 'Script dessa tentativa (opcional - some ao script geral)';
  card.appendChild(rotuloScript);
  const textareaScript = document.createElement('textarea');
  textareaScript.placeholder = 'Ex: Pergunte se ainda tem interesse em agendar e ofereça mandar mais informações...';
  textareaScript.value = etapa.prompt || '';
  textareaScript.style.minHeight = '80px';
  card.appendChild(textareaScript);

  const erroCard = document.createElement('p');
  erroCard.className = 'agenda-erro';
  erroCard.hidden = true;
  card.appendChild(erroCard);

  const salvarBtn = document.createElement('button');
  salvarBtn.type = 'button';
  salvarBtn.textContent = 'Salvar tentativa';
  salvarBtn.addEventListener('click', async () => {
    erroCard.hidden = true;
    const dias = Number(inputDias.value);
    if (!dias || dias <= 0) {
      erroCard.textContent = 'Numero de dias precisa ser maior que zero.';
      erroCard.hidden = false;
      return;
    }
    salvarBtn.disabled = true;
    try {
      const res = await fetch(`/api/follow-up/etapas/${etapa.ordem}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ dias, ativo: checkbox.checked, prompt: textareaScript.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      salvarBtn.textContent = 'Salvo ✓';
      setTimeout(() => { salvarBtn.textContent = 'Salvar tentativa'; }, 1200);
    } catch (err) {
      erroCard.textContent = err.message;
      erroCard.hidden = false;
    } finally {
      salvarBtn.disabled = false;
    }
  });
  card.appendChild(salvarBtn);

  // ---------- anexos dessa tentativa (imagem/pdf/video mandados junto da mensagem) ----------
  const arquivosWrap = document.createElement('div');
  arquivosWrap.className = 'auto-arquivos-wrap';
  const arquivosHeader = document.createElement('div');
  arquivosHeader.className = 'auto-arquivos-header';
  arquivosHeader.textContent = 'Anexos dessa tentativa (imagem, PDF ou video)';
  arquivosWrap.appendChild(arquivosHeader);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'auto-upload-row';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,application/pdf,video/*';
  fileInput.hidden = true;
  const escolherBtn = document.createElement('button');
  escolherBtn.type = 'button';
  escolherBtn.textContent = 'Escolher arquivo';
  const nomeSpan = document.createElement('span');
  nomeSpan.textContent = 'Nenhum arquivo escolhido';
  escolherBtn.addEventListener('click', () => fileInput.click());
  let arquivoSelecionado = null;
  fileInput.addEventListener('change', () => {
    arquivoSelecionado = fileInput.files[0] || null;
    nomeSpan.textContent = arquivoSelecionado ? arquivoSelecionado.name : 'Nenhum arquivo escolhido';
  });
  uploadRow.appendChild(fileInput);
  uploadRow.appendChild(escolherBtn);
  uploadRow.appendChild(nomeSpan);
  arquivosWrap.appendChild(uploadRow);

  const enviarArquivoBtn = document.createElement('button');
  enviarArquivoBtn.type = 'button';
  enviarArquivoBtn.textContent = 'Enviar arquivo';
  arquivosWrap.appendChild(enviarArquivoBtn);

  const listaArquivos = document.createElement('div');
  listaArquivos.className = 'auto-arquivos-lista';
  arquivosWrap.appendChild(listaArquivos);
  card.appendChild(arquivosWrap);

  async function carregarArquivosDaEtapa() {
    listaArquivos.textContent = '';
    const carregando = document.createElement('p');
    carregando.className = 'agenda-vazia';
    carregando.textContent = 'Carregando...';
    listaArquivos.appendChild(carregando);
    try {
      const res = await fetch(`/api/follow-up/etapas/${etapa.ordem}/arquivos`, { headers: { 'x-app-password': appPassword } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      listaArquivos.textContent = '';
      const lista = data.arquivos || [];
      if (!lista.length) {
        const vazio = document.createElement('p');
        vazio.className = 'agenda-vazia';
        vazio.textContent = 'Nenhum anexo cadastrado ainda.';
        listaArquivos.appendChild(vazio);
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
        detalhe.textContent = formatarTamanho(Number(arq.tamanho));
        info.appendChild(nome);
        info.appendChild(detalhe);
        item.appendChild(info);
        const apagarBtn = document.createElement('button');
        apagarBtn.type = 'button';
        apagarBtn.className = 'agenda-evento-cancelar';
        apagarBtn.textContent = '✕';
        apagarBtn.title = 'Apagar anexo';
        apagarBtn.addEventListener('click', async () => {
          if (!confirm(`Apagar "${arq.nome_arquivo}"?`)) return;
          try {
            await fetch(`/api/follow-up/etapas/${etapa.ordem}/arquivos/${arq.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
            carregarArquivosDaEtapa();
          } catch (err) {
            addBubble(`Erro apagando anexo: ${err.message}`, 'system');
          }
        });
        item.appendChild(apagarBtn);
        listaArquivos.appendChild(item);
      }
    } catch (err) {
      listaArquivos.textContent = '';
      const erro = document.createElement('p');
      erro.className = 'agenda-vazia';
      erro.textContent = `Nao consegui carregar os anexos: ${err.message}`;
      listaArquivos.appendChild(erro);
    }
  }

  enviarArquivoBtn.addEventListener('click', async () => {
    if (!arquivoSelecionado) { addBubble('Escolhe um arquivo primeiro.', 'system'); return; }
    enviarArquivoBtn.disabled = true;
    try {
      const base64 = await arquivoParaBase64(arquivoSelecionado);
      const res = await fetch(`/api/follow-up/etapas/${etapa.ordem}/arquivos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({
          nomeArquivo: arquivoSelecionado.name,
          mediaType: arquivoSelecionado.type || 'application/octet-stream',
          base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
      arquivoSelecionado = null;
      fileInput.value = '';
      nomeSpan.textContent = 'Nenhum arquivo escolhido';
      carregarArquivosDaEtapa();
    } catch (err) {
      addBubble(`Erro enviando anexo: ${err.message}`, 'system');
    } finally {
      enviarArquivoBtn.disabled = false;
    }
  });

  carregarArquivosDaEtapa();

  return card;
}

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

// ---------- Gerador de Relatorios (relatorio HTML com IA + temas de cor, pra baixar e mandar) ----------

const grFonteAuto = document.getElementById('grFonteAuto');
const grFonteManual = document.getElementById('grFonteManual');
const grBlocoAuto = document.getElementById('grBlocoAuto');
const grBlocoManual = document.getElementById('grBlocoManual');
const grContaSelect = document.getElementById('grContaSelect');
const grDataDe = document.getElementById('grDataDe');
const grDataAte = document.getElementById('grDataAte');
const grArquivoInput = document.getElementById('grArquivoInput');
const grArquivosLista = document.getElementById('grArquivosLista');
const grTemaSelect = document.getElementById('grTemaSelect');
const grNovoTemaBtn = document.getElementById('grNovoTemaBtn');
const grNovoTemaForm = document.getElementById('grNovoTemaForm');
const grTemaNome = document.getElementById('grTemaNome');
const grTemaBg = document.getElementById('grTemaBg');
const grTemaPanel = document.getElementById('grTemaPanel');
const grTemaTexto = document.getElementById('grTemaTexto');
const grTemaMuted = document.getElementById('grTemaMuted');
const grTemaAccent = document.getElementById('grTemaAccent');
const grTemaAccent2 = document.getElementById('grTemaAccent2');
const grSalvarTemaBtn = document.getElementById('grSalvarTemaBtn');
const grTemaPreviewWrap = document.getElementById('grTemaPreviewWrap');
const grTemaPreviewHeader = document.getElementById('grTemaPreviewHeader');
const grTemaPreviewBody = document.getElementById('grTemaPreviewBody');
const grTemaPreviewCard = document.getElementById('grTemaPreviewCard');
const grTemaPreviewMuted = document.getElementById('grTemaPreviewMuted');
const grTemaPreviewTexto = document.getElementById('grTemaPreviewTexto');
const grTemaPreviewAccentBtn = document.getElementById('grTemaPreviewAccentBtn');
const grClienteNome = document.getElementById('grClienteNome');
const grInstrucoes = document.getElementById('grInstrucoes');
const grInstrucoesContador = document.getElementById('grInstrucoesContador');
const grPedidoInfo = document.getElementById('grPedidoInfo');
const grAjusteTexto = document.getElementById('grAjusteTexto');
const grAjustarBtn = document.getElementById('grAjustarBtn');
const grAjusteErro = document.getElementById('grAjusteErro');
let grIdAtual = null;
const grGerarBtn = document.getElementById('grGerarBtn');
const grErro = document.getElementById('grErro');
const grHistoricoLista = document.getElementById('grHistoricoLista');
const grPreviewWrap = document.getElementById('grPreviewWrap');
const grPreviewIframe = document.getElementById('grPreviewIframe');
const grBaixarPdfBtn = document.getElementById('grBaixarPdfBtn');
const grBaixarJpgBtn = document.getElementById('grBaixarJpgBtn');
const grBaixarErro = document.getElementById('grBaixarErro');

let grArquivosPendentes = []; // [{ name, mediaType, base64 }]
let grHtmlAtual = null;
let grTituloAtual = null;
let grIniciado = false;
let grLogoAtual = null; // data URI, ou null

const grMarcaNome = document.getElementById('grMarcaNome');
const grMarcaLogoInput = document.getElementById('grMarcaLogoInput');
const grMarcaLogoRemover = document.getElementById('grMarcaLogoRemover');
const grMarcaLogoPreview = document.getElementById('grMarcaLogoPreview');
const grMarcaSalvarBtn = document.getElementById('grMarcaSalvarBtn');

async function carregarMarcaGerador() {
  try {
    const r = await fetch('/api/gerador-relatorios/marca', { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    grMarcaNome.value = d.nome || '';
    grLogoAtual = d.logo || null;
    if (grLogoAtual) {
      grMarcaLogoPreview.src = grLogoAtual;
      grMarcaLogoPreview.hidden = false;
    } else {
      grMarcaLogoPreview.hidden = true;
    }
  } catch (err) {
    console.error('Erro carregando marca do gerador:', err);
  }
}

grMarcaLogoInput.addEventListener('change', async () => {
  const file = grMarcaLogoInput.files?.[0];
  if (!file) return;
  const base64 = await arquivoParaBase64(file);
  grLogoAtual = `data:${file.type};base64,${base64}`;
  grMarcaLogoPreview.src = grLogoAtual;
  grMarcaLogoPreview.hidden = false;
  grMarcaLogoInput.value = '';
});

grMarcaLogoRemover.addEventListener('click', () => {
  grLogoAtual = null;
  marcarPendente(grMarcaSalvarBtn);
  grMarcaLogoPreview.hidden = true;
});

rastrearAlteracoes(grMarcaSalvarBtn, [grMarcaNome, grMarcaLogoInput]);
grMarcaSalvarBtn.addEventListener('click', async () => {
  try {
    const r = await fetch('/api/gerador-relatorios/marca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ nome: grMarcaNome.value.trim() || null, logo: grLogoAtual }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    addBubble('Marca do relatorio salva.', 'system');
    marcarSalvo(grMarcaSalvarBtn, 'Marca do relatório salva');
  } catch (err) {
    addBubble(`Erro salvando marca: ${err.message}`, 'system');
  }
});

grFonteAuto.addEventListener('change', () => {
  grBlocoAuto.hidden = false;
  grBlocoManual.hidden = true;
});
grFonteManual.addEventListener('change', () => {
  grBlocoAuto.hidden = true;
  grBlocoManual.hidden = false;
});

grArquivoInput.addEventListener('change', async () => {
  for (const file of Array.from(grArquivoInput.files || [])) {
    try {
      const base64 = await arquivoParaBase64(file);
      grArquivosPendentes.push({ name: file.name, mediaType: file.type || 'application/octet-stream', base64 });
    } catch (err) {
      console.error('Erro lendo arquivo:', err);
    }
  }
  grArquivoInput.value = '';
  renderizarArquivosPendentesGerador();
});

function renderizarArquivosPendentesGerador() {
  grArquivosLista.innerHTML = '';
  if (!grArquivosPendentes.length) {
    grArquivosLista.innerHTML = '<p class="agenda-vazia">Nenhum arquivo anexado.</p>';
    return;
  }
  grArquivosPendentes.forEach((arq, i) => {
    const row = document.createElement('div');
    row.className = 'auto-arquivo-item';
    const nome = document.createElement('span');
    nome.textContent = arq.name;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.textContent = 'Remover';
    remover.addEventListener('click', () => {
      grArquivosPendentes.splice(i, 1);
      renderizarArquivosPendentesGerador();
    });
    row.append(nome, remover);
    grArquivosLista.appendChild(row);
  });
}

async function carregarContasGerador() {
  try {
    const r = await fetch('/api/gerador-relatorios/contas', { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    grContaSelect.innerHTML = '';
    for (const conta of d.contas || []) {
      const opt = document.createElement('option');
      opt.value = conta.id;
      opt.textContent = `${conta.empresa || conta.name || conta.id}`;
      grContaSelect.appendChild(opt);
    }
    if (!d.contas?.length) grContaSelect.innerHTML = '<option value="">Nenhuma conta conectada</option>';
  } catch (err) {
    grContaSelect.innerHTML = `<option value="">Erro: ${err.message}</option>`;
  }
}

async function carregarTemasGerador() {
  try {
    const r = await fetch('/api/gerador-relatorios/temas', { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    grTemaSelect.innerHTML = '';
    for (const tema of d.temas || []) {
      const opt = document.createElement('option');
      opt.value = tema.id;
      opt.textContent = tema.nome;
      grTemaSelect.appendChild(opt);
    }
  } catch (err) {
    grTemaSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// mockup simples (sem gerar relatorio de verdade) que reflete as 6 cores escolhidas em tempo
// real - existe porque o seletor de cor nativo (<input type="color">) e controlado pelo proprio
// navegador/sistema operacional, sem jeito do app confirmar ou mostrar feedback por dentro dele;
// o 'input' dispara a cada mudanca (inclusive arrastando dentro do seletor nativo, antes de
// fechar), entao o preview atualiza a medida que a pessoa escolhe, nao so depois de fechar
function atualizarPreviewTema() {
  grTemaPreviewHeader.style.background = grTemaBg.value;
  grTemaPreviewHeader.style.color = grTemaTexto.value;
  grTemaPreviewBody.style.background = grTemaBg.value;
  grTemaPreviewCard.style.background = grTemaPanel.value;
  grTemaPreviewMuted.style.color = grTemaMuted.value;
  grTemaPreviewTexto.style.color = grTemaTexto.value;
  grTemaPreviewAccentBtn.style.background = grTemaAccent.value;
  grTemaPreviewAccentBtn.style.color = grTemaBg.value;
  grTemaPreviewAccentBtn.style.border = `1px solid ${grTemaAccent2.value}`;
}
[grTemaBg, grTemaPanel, grTemaTexto, grTemaMuted, grTemaAccent, grTemaAccent2]
  .forEach((input) => input.addEventListener('input', atualizarPreviewTema));

grNovoTemaBtn.addEventListener('click', () => {
  grNovoTemaForm.hidden = !grNovoTemaForm.hidden;
  grTemaPreviewWrap.hidden = grNovoTemaForm.hidden;
  if (!grNovoTemaForm.hidden) atualizarPreviewTema();
});

grSalvarTemaBtn.addEventListener('click', async () => {
  if (!grTemaNome.value.trim()) {
    addBubble('De um nome pro tema antes de salvar.', 'system');
    return;
  }
  try {
    const r = await fetch('/api/gerador-relatorios/temas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        nome: grTemaNome.value.trim(), bg: grTemaBg.value, panel: grTemaPanel.value,
        texto: grTemaTexto.value, muted: grTemaMuted.value, accent: grTemaAccent.value, accent2: grTemaAccent2.value,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    grTemaNome.value = '';
    grNovoTemaForm.hidden = true;
    grTemaPreviewWrap.hidden = true;
    await carregarTemasGerador();
    grTemaSelect.value = d.tema.id;
    marcarSalvo(null, 'Tema salvo');
  } catch (err) {
    addBubble(`Erro salvando tema: ${err.message}`, 'system');
  }
});

function grFormatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function carregarHistoricoGerador() {
  grHistoricoLista.innerHTML = '<p class="agenda-vazia">Carregando...</p>';
  try {
    const r = await fetch('/api/gerador-relatorios/lista', { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    grHistoricoLista.innerHTML = '';
    if (!d.relatorios?.length) {
      grHistoricoLista.innerHTML = '<p class="agenda-vazia">Nenhum relatorio ainda.</p>';
      return;
    }
    for (const rel of d.relatorios) {
      const card = document.createElement('div');
      card.className = 'auto-arquivo-item';
      const info = document.createElement('span');
      info.className = 'gr-hist-info';
      info.textContent = `${rel.titulo || 'Relatorio'} - ${grFormatarData(rel.criado_em)}`;
      // o que foi pedido pra IA fica visivel na propria lista
      if (rel.instrucoes || Number(rel.qtd_ajustes) > 0) {
        const pedido = document.createElement('small');
        pedido.className = 'gr-hist-pedido';
        const partes = [];
        if (rel.instrucoes) partes.push(`Pedido: ${rel.instrucoes.length > 110 ? `${rel.instrucoes.slice(0, 110)}…` : rel.instrucoes}`);
        if (Number(rel.qtd_ajustes) > 0) partes.push(`${rel.qtd_ajustes} ajuste(s)`);
        pedido.textContent = partes.join(' · ');
        pedido.title = rel.instrucoes || '';
        info.appendChild(pedido);
      }
      const abrir = document.createElement('button');
      abrir.type = 'button';
      abrir.textContent = 'Abrir';
      abrir.addEventListener('click', () => abrirRelatorioGerado(rel.id));
      const apagar = document.createElement('button');
      apagar.type = 'button';
      apagar.textContent = 'Apagar';
      apagar.addEventListener('click', async () => {
        await fetch(`/api/gerador-relatorios/${rel.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
        carregarHistoricoGerador();
      });
      card.append(info, abrir, apagar);
      grHistoricoLista.appendChild(card);
    }
  } catch (err) {
    grHistoricoLista.innerHTML = `<p class="agenda-erro">Erro: ${err.message}</p>`;
  }
}

// mostra o relatorio na pre-visualizacao junto com o que foi pedido pra IA (pedido original,
// ajustes feitos depois e o que ela avisou que nao conseguiu fazer)
function mostrarRelatorioGerado(d) {
  grIdAtual = d.id;
  grHtmlAtual = d.html;
  grTituloAtual = d.titulo;
  grPreviewIframe.srcdoc = d.html;
  grPreviewWrap.hidden = false;
  grAjusteErro.hidden = true;
  renderizarPedidoGerador(d);
}

function renderizarPedidoGerador(d) {
  const ajustes = Array.isArray(d.ajustes) ? d.ajustes : [];
  const avisos = Array.isArray(d.avisos) ? d.avisos : [];
  grPedidoInfo.innerHTML = '';
  const titulo = document.createElement('div');
  titulo.className = 'gr-pedido-titulo';
  titulo.textContent = 'O que foi pedido pra IA';
  grPedidoInfo.appendChild(titulo);
  const item = (rotulo, textoItem, classe = '') => {
    const el = document.createElement('div');
    el.className = `gr-pedido-item ${classe}`;
    const b = document.createElement('b');
    b.textContent = rotulo;
    const t = document.createElement('span');
    t.textContent = textoItem;
    el.append(b, t);
    grPedidoInfo.appendChild(el);
  };
  item('Pedido inicial:', d.instrucoes || 'nenhum (relatório no padrão)');
  ajustes.forEach((a, i) => item(`Ajuste ${i + 1}:`, a.pedido));
  if (avisos.length) item('A IA avisou:', avisos.join(' · '), 'aviso');
  grPedidoInfo.hidden = false;
}

grInstrucoes.addEventListener('input', () => {
  grInstrucoesContador.textContent = `${grInstrucoes.value.length} / 4000`;
});

async function aplicarAjusteGerador() {
  const pedido = grAjusteTexto.value.trim();
  grAjusteErro.hidden = true;
  if (!grIdAtual) return;
  if (!pedido) {
    grAjusteErro.textContent = 'Escreva o ajuste que você quer.';
    grAjusteErro.hidden = false;
    return;
  }
  grAjustarBtn.disabled = true;
  grAjustarBtn.textContent = 'Aplicando ajuste...';
  try {
    const r = await fetch(`/api/gerador-relatorios/${grIdAtual}/ajustar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ pedido }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    mostrarRelatorioGerado(d);
    grAjusteTexto.value = '';
    carregarHistoricoGerador();
    addBubble(d.avisos?.length ? `Ajuste aplicado, com aviso da IA: ${d.avisos.join(' · ')}` : 'Ajuste aplicado no relatório.', 'system');
  } catch (err) {
    grAjusteErro.textContent = err.message;
    grAjusteErro.hidden = false;
  } finally {
    grAjustarBtn.disabled = false;
    grAjustarBtn.textContent = 'Aplicar ajuste';
  }
}
grAjustarBtn.addEventListener('click', aplicarAjusteGerador);
grAjusteTexto.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); aplicarAjusteGerador(); }
});

async function abrirRelatorioGerado(id) {
  try {
    const r = await fetch(`/api/gerador-relatorios/${id}`, { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    mostrarRelatorioGerado(d);
  } catch (err) {
    addBubble(`Erro abrindo relatorio: ${err.message}`, 'system');
  }
}

grGerarBtn.addEventListener('click', async () => {
  grErro.hidden = true;
  const fonte = grFonteManual.checked ? 'manual' : 'auto';
  if (fonte === 'auto' && (!grContaSelect.value || !grDataDe.value || !grDataAte.value)) {
    grErro.textContent = 'Escolha a conta e o periodo.';
    grErro.hidden = false;
    return;
  }
  if (fonte === 'manual' && !grArquivosPendentes.length) {
    grErro.textContent = 'Anexe pelo menos um arquivo.';
    grErro.hidden = false;
    return;
  }
  if (!grTemaSelect.value) {
    grErro.textContent = 'Escolha um tema.';
    grErro.hidden = false;
    return;
  }
  grGerarBtn.disabled = true;
  grGerarBtn.textContent = 'Gerando...';
  try {
    const r = await fetch('/api/gerador-relatorios/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        fonte, temaId: grTemaSelect.value,
        accountId: grContaSelect.value, from: grDataDe.value, to: grDataAte.value,
        arquivos: fonte === 'manual' ? grArquivosPendentes : undefined,
        instrucoes: grInstrucoes.value.trim() || undefined,
        clienteNome: grClienteNome.value.trim() || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    mostrarRelatorioGerado(d);
    grArquivosPendentes = [];
    renderizarArquivosPendentesGerador();
    carregarHistoricoGerador();
    addBubble('Relatorio gerado com sucesso.', 'system');
  } catch (err) {
    grErro.textContent = err.message;
    grErro.hidden = false;
  } finally {
    grGerarBtn.disabled = false;
    grGerarBtn.textContent = 'Gerar Relatório';
  }
});

// html2canvas + jsPDF sao carregados so quando o usuario realmente for baixar (a maioria das
// visitas na aba nem chega a gerar relatorio) - evita pesar o carregamento inicial do app pra
// uma funcionalidade que so entra em uso as vezes
function carregarScriptUmaVez(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha carregando biblioteca (${src})`));
    document.head.appendChild(s);
  });
}

async function garantirLibsDownloadRelatorio() {
  if (!window.html2canvas) {
    await carregarScriptUmaVez('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }
  if (!window.jspdf) {
    await carregarScriptUmaVez('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
}

// tira uma "foto" em alta resolucao do relatorio renderizado dentro do iframe de
// pre-visualizacao - serve tanto pro JPG (direto) quanto pro PDF (a imagem vira o conteudo
// de uma unica pagina do tamanho do relatorio, ja que o layout usa cores/gradiente que um PDF
// "de texto" gerado na mao (via pdfkit) nao reproduziria fielmente)
async function capturarCanvasRelatorio() {
  await garantirLibsDownloadRelatorio();
  const doc = grPreviewIframe.contentDocument;
  if (!doc?.body) throw new Error('pre-visualizacao ainda nao carregou');
  return window.html2canvas(doc.body, { backgroundColor: null, scale: 2, useCORS: true });
}

function nomeArquivoRelatorio(extensao) {
  return `${(grTituloAtual || 'relatorio').replace(/[^a-z0-9]+/gi, '_')}.${extensao}`;
}

async function baixarComoRelatorio(botao, extensao, gerar) {
  if (!grHtmlAtual) return;
  grBaixarErro.hidden = true;
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Gerando...';
  try {
    const canvas = await capturarCanvasRelatorio();
    gerar(canvas);
  } catch (err) {
    grBaixarErro.textContent = `Erro gerando ${extensao.toUpperCase()}: ${err.message}`;
    grBaixarErro.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

grBaixarJpgBtn.addEventListener('click', () => baixarComoRelatorio(grBaixarJpgBtn, 'jpg', (canvas) => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/jpeg', 0.92);
  a.download = nomeArquivoRelatorio('jpg');
  a.click();
}));

grBaixarPdfBtn.addEventListener('click', () => baixarComoRelatorio(grBaixarPdfBtn, 'pdf', (canvas) => {
  const { jsPDF } = window.jspdf;
  // jsPDF com unit:"px" da erro interno de escala em varias versoes - converte pra pt (1px =
  // 0.75pt a 96dpi) e usa unit:"pt", que e o caminho estavel da biblioteca
  const wPt = canvas.width * 0.75;
  const hPt = canvas.height * 0.75;
  const pdf = new jsPDF({ unit: 'pt', format: [wPt, hPt] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wPt, hPt);
  pdf.save(nomeArquivoRelatorio('pdf'));
}));

function iniciarGeradorRelatorios() {
  if (!grIniciado) {
    grIniciado = true;
    renderizarArquivosPendentesGerador();
  }
  carregarContasGerador();
  carregarTemasGerador();
  carregarHistoricoGerador();
  carregarMarcaGerador();
}

// ---------- Integracoes (visivel pra qualquer tenant - so mostra/mexe nas PROPRIAS contas) ----------
// contas de anuncio Meta Ads (com toggle por conta pra relatorio automatico), sistemas
// conectados (Clinicorp/Trello/Google - liga/desliga sem apagar credencial) e placeholders
// "em breve" pra Google Ads/TikTok Ads, que ainda nao tem integracao de verdade no backend.

function criarSwitch(id, marcado) {
  const label = document.createElement('label');
  label.className = 'auto-switch';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = !!marcado;
  const track = document.createElement('span');
  track.className = 'auto-switch-track';
  track.innerHTML = '<span class="auto-switch-thumb"></span>';
  label.append(input, track);
  return { label, input };
}

// botao "Apagar definitivamente" (pedido explicito do usuario, alem do "Apagar" normal que so
// marca por 30 dias) - a friccao contra clique errado e o proprio usuario ter que DIGITAR o
// nome exato do tenant pra confirmar, nao um simples OK/Cancelar. O servidor confere o nome de
// novo antes de apagar (ver rota DELETE /api/admin/tenants/:id/definitivo).
function criarBotaoApagarDefinitivo(id, nome, aoTerminar) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `Apagar "${nome}" definitivamente`;
  btn.style.cssText = 'background:rgba(220,38,38,0.28);border:1px solid #dc2626;color:#fca5a5;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;margin-top:6px;';
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const digitado = prompt(`Isso apaga "${nome}" e TODOS os dados dele AGORA, sem os 30 dias de espera - não dá pra desfazer.\n\nPra confirmar, digite o nome exato: ${nome}`);
    if (digitado === null) return;
    if (digitado.trim() !== nome) {
      alert('Nome digitado não bate - nada foi apagado.');
      return;
    }
    try {
      const r = await fetch(`/api/admin/tenants/${id}/definitivo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ confirmarNome: digitado.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      aoTerminar();
    } catch (err) {
      addBubble(`Erro apagando "${nome}" definitivamente: ${err.message}`, 'system');
    }
  });
  return btn;
}

// botaozinho "copiar" ao lado do usuario de login - a senha em si NUNCA fica visivel de novo
// depois de criada (guardada como hash irreversivel, nao em texto legivel), entao "ver login"
// na pratica vira "copiar o usuario facil" + "redefinir senha" (ja existe em cada card/painel)
function criarBotaoCopiarUsuario(username) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Copiar usuário';
  btn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;';
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(username);
      const original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch {
      addBubble(`Usuário: ${username}`, 'system');
    }
  });
  return btn;
}

// botao "Ver senha" - so funciona pra senha criada/redefinida depois dessa funcionalidade
// existir (guardada cifrada de proposito, ver tenants.js). Mostra num prompt (facil de
// selecionar/copiar) em vez de deixar exposta na tela o tempo todo.
function criarBotaoVerSenha(id, nome) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Ver senha';
  btn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;';
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    try {
      const r = await fetch(`/api/admin/tenants/${id}/senha`, { headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      if (d.senha == null) {
        alert(`Não tenho a senha de "${nome}" guardada de um jeito reversível (ela foi criada antes dessa função existir). Use "Redefinir senha" pra colocar uma nova.`);
      } else {
        prompt(`Senha de "${nome}" (Ctrl+C pra copiar):`, d.senha);
      }
    } catch (err) {
      addBubble(`Erro consultando senha: ${err.message}`, 'system');
    }
  });
  return btn;
}

// insere um botaozinho "olho" ao lado de um <input type="password"> pra mostrar/ocultar o que
// esta sendo digitado - funciona tanto num input ja no DOM quanto num recem-criado (nesse caso
// devolve um wrapper <span> que o chamador deve appendar NO LUGAR do input sozinho)
function adicionarOlhinho(input) {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'position:relative;display:inline-flex;flex:1;min-width:0;';
  const parent = input.parentNode;
  const proximo = input.nextSibling;
  wrap.appendChild(input);
  input.style.paddingRight = '34px';
  input.style.boxSizing = 'border-box';
  input.style.width = '100%';
  const olho = document.createElement('button');
  olho.type = 'button';
  olho.textContent = '👁';
  olho.title = 'Mostrar/ocultar senha';
  olho.style.cssText = 'position:absolute;right:2px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:13px;padding:2px 6px;line-height:1;';
  olho.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    input.type = input.type === 'password' ? 'text' : 'password';
    olho.textContent = input.type === 'password' ? '👁' : '🙈';
  });
  wrap.appendChild(olho);
  if (parent) parent.insertBefore(wrap, proximo);
  return wrap;
}

async function carregarIntegracoes() {
  integracoesMetaAdsLista.innerHTML = '<p class="agenda-vazia">Carregando...</p>';
  integracoesSistemasLista.innerHTML = '<p class="agenda-vazia">Carregando...</p>';
  try {
    const res = await fetch('/api/integracoes', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao carregar integrações');
    renderizarMetaAdsContas(data);
    renderizarSistemasConectados(data);
    renderizarEmBreve();
  } catch (err) {
    integracoesMetaAdsLista.innerHTML = `<p class="agenda-erro">${err.message}</p>`;
    integracoesSistemasLista.innerHTML = '';
  }
}

function renderizarMetaAdsContas(data) {
  integracoesMetaAdsLista.innerHTML = '';
  if (!data.metaAds.conectado) {
    integracoesMetaAdsLista.innerHTML = '<p class="agenda-vazia">Nenhuma conta de anúncio Meta Ads conectada ainda. Peça pro administrador cadastrar na aba Clientes.</p>';
    return;
  }
  if (data.erroMetaAds) {
    integracoesMetaAdsLista.innerHTML = `<p class="agenda-erro">Não consegui buscar as contas agora: ${data.erroMetaAds}</p>`;
    return;
  }
  if (!data.contasMetaAds.length) {
    integracoesMetaAdsLista.innerHTML = '<p class="agenda-vazia">Nenhuma conta de anúncio encontrada nos tokens conectados.</p>';
    return;
  }
  for (const conta of data.contasMetaAds) {
    const item = document.createElement('div');
    item.className = 'auto-arquivo-item';
    const info = document.createElement('div');
    info.className = 'auto-arquivo-info';
    const nome = document.createElement('div');
    nome.className = 'auto-arquivo-nome';
    nome.textContent = conta.nome;
    const detalhe = document.createElement('div');
    detalhe.className = 'auto-arquivo-detalhe';
    detalhe.textContent = `${conta.empresa} · ${conta.ativa ? 'inclui nos relatórios automáticos' : 'fora dos relatórios automáticos'}`;
    info.append(nome, detalhe);

    const { label, input } = criarSwitch(`metaAdsConta_${conta.id}`, conta.ativa);
    input.addEventListener('change', async () => {
      input.disabled = true;
      try {
        const res = await fetch(`/api/integracoes/meta-ads/contas/${encodeURIComponent(conta.id)}/ativo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
          body: JSON.stringify({ ativo: input.checked }),
        });
        if (!res.ok) throw new Error((await res.json()).erro || 'Erro ao salvar');
        detalhe.textContent = `${conta.empresa} · ${input.checked ? 'inclui nos relatórios automáticos' : 'fora dos relatórios automáticos'}`;
      } catch (err) {
        input.checked = !input.checked;
        alert(`Erro: ${err.message}`);
      } finally {
        input.disabled = false;
      }
    });

    item.append(info, label);
    integracoesMetaAdsLista.appendChild(item);
  }
}

function renderizarSistemasConectados(data) {
  integracoesSistemasLista.innerHTML = '';

  // Clinicorp e Trello: liga/desliga real (obterClinicorp/obterTrello devolvem null enquanto
  // desativado, entao as ferramentas correspondentes param de funcionar de verdade)
  for (const sistema of ['clinicorp', 'trello']) {
    const info = data[sistema];
    const item = document.createElement('div');
    item.className = 'auto-arquivo-item';
    const infoBox = document.createElement('div');
    infoBox.className = 'auto-arquivo-info';
    const nome = document.createElement('div');
    nome.className = 'auto-arquivo-nome';
    nome.textContent = sistema === 'clinicorp' ? 'Clinicorp' : 'Trello';
    const detalhe = document.createElement('div');
    detalhe.className = 'auto-arquivo-detalhe';
    detalhe.textContent = info.conectado
      ? (info.ativo ? 'Conectado · ativo' : 'Conectado · desativado')
      : 'Não conectado';
    infoBox.append(nome, detalhe);
    item.appendChild(infoBox);

    if (info.conectado) {
      const { label, input } = criarSwitch(`sistemaAtivo_${sistema}`, info.ativo);
      input.addEventListener('change', async () => {
        input.disabled = true;
        try {
          const res = await fetch(`/api/integracoes/sistemas/${sistema}/ativo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ ativo: input.checked }),
          });
          if (!res.ok) throw new Error((await res.json()).erro || 'Erro ao salvar');
          detalhe.textContent = input.checked ? 'Conectado · ativo' : 'Conectado · desativado';
        } catch (err) {
          input.checked = !input.checked;
          alert(`Erro: ${err.message}`);
        } finally {
          input.disabled = false;
        }
      });
      item.appendChild(label);
    }
    integracoesSistemasLista.appendChild(item);
  }

  // Meta Ads: so status (o controle fino e por conta, na coluna da esquerda)
  const itemAds = document.createElement('div');
  itemAds.className = 'auto-arquivo-item';
  const infoAds = document.createElement('div');
  infoAds.className = 'auto-arquivo-info';
  infoAds.innerHTML = `<div class="auto-arquivo-nome">Meta Ads</div><div class="auto-arquivo-detalhe">${data.metaAds.conectado ? `${data.metaAds.quantidade} conta(s) conectada(s) - gerencie ao lado` : 'Não conectado'}</div>`;
  itemAds.appendChild(infoAds);
  integracoesSistemasLista.appendChild(itemAds);

  // Google Calendar/Sheets: mesma conexao pras duas ferramentas - status + desconectar
  // reaproveitando a rota que a aba Agenda ja usa
  const itemGoogle = document.createElement('div');
  itemGoogle.className = 'auto-arquivo-item';
  const infoGoogle = document.createElement('div');
  infoGoogle.className = 'auto-arquivo-info';
  infoGoogle.innerHTML = `<div class="auto-arquivo-nome">Google (Agenda + Planilhas)</div><div class="auto-arquivo-detalhe">${data.google ? 'Conectado' : 'Não conectado'}</div>`;
  itemGoogle.appendChild(infoGoogle);
  if (data.google) {
    const desconectarBtn = document.createElement('button');
    desconectarBtn.type = 'button';
    desconectarBtn.className = 'relatorio-config-enviar';
    desconectarBtn.textContent = 'Desconectar';
    desconectarBtn.addEventListener('click', async () => {
      if (!confirm('Desconectar sua conta Google? A agenda para de sincronizar ate voce reconectar pela aba Agenda.')) return;
      try {
        await fetch('/api/agenda/google/desconectar', { method: 'POST', headers: { 'x-app-password': appPassword } });
        carregarIntegracoes();
      } catch (err) {
        alert(`Erro: ${err.message}`);
      }
    });
    itemGoogle.appendChild(desconectarBtn);
  }
  integracoesSistemasLista.appendChild(itemGoogle);
}

// ---------- Colaboradores (logins extras dentro da PROPRIA conta - so aparece se o
// super_admin liberou esse beneficio, ver meuPermiteColaboradores) ----------
async function carregarColaboradores() {
  colaboradoresWrap.hidden = !meuPermiteColaboradores;
  if (!meuPermiteColaboradores) return;

  colaboradoresLista.innerHTML = '<p class="agenda-vazia">Carregando...</p>';
  try {
    const r = await fetch('/api/colaboradores', { headers: { 'x-app-password': appPassword } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');

    colaboradoresLista.innerHTML = '';
    if (!d.colaboradores?.length) {
      colaboradoresLista.innerHTML = '<p class="agenda-vazia">Nenhum colaborador criado ainda.</p>';
      return;
    }
    for (const c of d.colaboradores) {
      const item = document.createElement('div');
      item.className = 'auto-arquivo-item';
      const info = document.createElement('div');
      info.className = 'auto-arquivo-info';
      const infoNome = document.createElement('div');
      infoNome.className = 'auto-arquivo-nome';
      infoNome.textContent = c.nome;
      const infoDetalhe = document.createElement('div');
      infoDetalhe.className = 'auto-arquivo-detalhe';
      infoDetalhe.textContent = `usuário: ${c.username} - ${c.ativo ? 'ativo' : 'desativado'}`;
      info.appendChild(infoNome);
      info.appendChild(infoDetalhe);
      item.appendChild(info);

      const verSenhaBtn = document.createElement('button');
      verSenhaBtn.type = 'button'; verSenhaBtn.textContent = 'Ver senha';
      verSenhaBtn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;';
      verSenhaBtn.addEventListener('click', async () => {
        try {
          const rs = await fetch(`/api/colaboradores/${c.id}/senha`, { headers: { 'x-app-password': appPassword } });
          const ds = await rs.json();
          if (!rs.ok) throw new Error(ds.erro || 'erro desconhecido');
          if (ds.senha == null) alert('Nao tenho essa senha guardada de um jeito reversivel.');
          else prompt(`Senha de "${c.nome}" (Ctrl+C pra copiar):`, ds.senha);
        } catch (err) { addBubble(`Erro: ${err.message}`, 'system'); }
      });
      item.appendChild(verSenhaBtn);

      const redefinirBtn = document.createElement('button');
      redefinirBtn.type = 'button'; redefinirBtn.textContent = 'Redefinir senha';
      redefinirBtn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;';
      redefinirBtn.addEventListener('click', async () => {
        const novaSenha = prompt(`Nova senha pra "${c.nome}":`);
        if (!novaSenha) return;
        try {
          const rs = await fetch(`/api/colaboradores/${c.id}/redefinir-senha`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ novaSenha }),
          });
          const ds = await rs.json();
          if (!rs.ok) throw new Error(ds.erro || 'erro desconhecido');
          addBubble(`Senha de "${c.nome}" redefinida.`, 'system');
        } catch (err) { addBubble(`Erro: ${err.message}`, 'system'); }
      });
      item.appendChild(redefinirBtn);

      const ativoBtn = document.createElement('button');
      ativoBtn.type = 'button'; ativoBtn.textContent = c.ativo ? 'Desativar' : 'Ativar';
      ativoBtn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;';
      ativoBtn.addEventListener('click', async () => {
        try {
          const rs = await fetch(`/api/colaboradores/${c.id}/ativo`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ ativo: !c.ativo }),
          });
          const ds = await rs.json();
          if (!rs.ok) throw new Error(ds.erro || 'erro desconhecido');
          carregarColaboradores();
        } catch (err) { addBubble(`Erro: ${err.message}`, 'system'); }
      });
      item.appendChild(ativoBtn);

      const apagarBtn = document.createElement('button');
      apagarBtn.type = 'button'; apagarBtn.textContent = 'Apagar';
      apagarBtn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:6px;color:#f87171;';
      apagarBtn.addEventListener('click', async () => {
        if (!confirm(`Apagar o acesso de "${c.nome}"? Ele nao vai mais conseguir logar.`)) return;
        try {
          const rs = await fetch(`/api/colaboradores/${c.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
          const ds = await rs.json();
          if (!rs.ok) throw new Error(ds.erro || 'erro desconhecido');
          carregarColaboradores();
        } catch (err) { addBubble(`Erro: ${err.message}`, 'system'); }
      });
      item.appendChild(apagarBtn);

      colaboradoresLista.appendChild(item);
    }
  } catch (err) {
    colaboradoresLista.innerHTML = `<p class="agenda-erro">${err.message}</p>`;
  }
}

colabCriarBtn.addEventListener('click', async () => {
  colabCriarErro.hidden = true;
  const nome = colabNomeInput.value.trim();
  const username = colabUsuarioInput.value.trim();
  const senha = colabSenhaInput.value;
  if (!nome || !username || !senha) {
    colabCriarErro.textContent = 'Preenche nome, usuario e senha.';
    colabCriarErro.hidden = false;
    return;
  }
  colabCriarBtn.disabled = true;
  try {
    const r = await fetch('/api/colaboradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ nome, username, senha }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    colabNomeInput.value = '';
    colabUsuarioInput.value = '';
    colabSenhaInput.value = '';
    addBubble(`Acesso de "${nome}" criado.`, 'system');
    carregarColaboradores();
  } catch (err) {
    colabCriarErro.textContent = err.message;
    colabCriarErro.hidden = false;
  } finally {
    colabCriarBtn.disabled = false;
  }
});

function renderizarEmBreve() {
  integracoesEmBreveLista.innerHTML = '';
  for (const nome of ['Google Ads', 'TikTok Ads']) {
    const item = document.createElement('div');
    item.className = 'auto-arquivo-item';
    item.innerHTML = `<div class="auto-arquivo-info"><div class="auto-arquivo-nome">${nome}</div><div class="auto-arquivo-detalhe">Integração ainda não disponível - avise que voce quer pra gente priorizar.</div></div>`;
    integracoesEmBreveLista.appendChild(item);
  }
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
      card.addEventListener('click', () => selecionarCliente(t.id, t.nome, t.username));

      const nome = document.createElement('div');
      nome.className = 'cliente-card-nome';
      nome.textContent = t.nome;
      card.appendChild(nome);

      const meta = document.createElement('div');
      meta.className = 'cliente-card-meta';
      meta.textContent = `usuario: ${t.username}`;
      meta.appendChild(criarBotaoCopiarUsuario(t.username));
      meta.appendChild(criarBotaoVerSenha(t.id, t.nome));
      card.appendChild(meta);

      const acessoMeta = document.createElement('div');
      acessoMeta.className = 'cliente-card-meta';
      if (!t.acesso_expira_em) {
        acessoMeta.textContent = 'Acesso: Vitalício';
      } else {
        const dataExpira = new Date(t.acesso_expira_em);
        acessoMeta.textContent = dataExpira.getTime() < Date.now()
          ? `Acesso expirado em ${dataExpira.toLocaleDateString('pt-BR')} - bloqueado`
          : `Acesso até ${dataExpira.toLocaleDateString('pt-BR')}`;
      }
      card.appendChild(acessoMeta);

      if (t.apagar_em) {
        // marcado pra exclusao - avisa e oferece restaurar em vez das acoes normais (ativar/
        // desativar nao fazem sentido pra quem ja esta marcado pra sumir)
        const aviso = document.createElement('div');
        aviso.className = 'cliente-card-meta';
        aviso.style.color = '#f87171';
        aviso.textContent = `Marcado pra exclusão - apaga de vez em ${new Date(t.apagar_em).toLocaleDateString('pt-BR')}`;
        card.appendChild(aviso);

        const restaurarBtn = document.createElement('button');
        restaurarBtn.type = 'button';
        restaurarBtn.textContent = 'Restaurar';
        restaurarBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          try {
            await fetch(`/api/admin/tenants/${t.id}/restaurar`, { method: 'POST', headers: { 'x-app-password': appPassword } });
            carregarClientes();
          } catch (err) {
            addBubble(`Erro restaurando cliente: ${err.message}`, 'system');
          }
        });
        card.appendChild(restaurarBtn);
        card.appendChild(criarBotaoApagarDefinitivo(t.id, t.nome, carregarClientes));
        clientesLista.appendChild(card);
        continue;
      }

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
      card.appendChild(criarBotaoApagarDefinitivo(t.id, t.nome, carregarClientes));

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

    const meses = clienteAcessoInput.value;
    if (meses) {
      const r2 = await fetch(`/api/admin/tenants/${data.id}/acesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ meses }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.erro || 'cliente criado, mas erro ao definir o periodo de acesso');
    }

    clienteNomeInput.value = '';
    clienteUsuarioInput.value = '';
    clienteSenhaInput.value = '';
    clienteAcessoInput.value = '';
    carregarClientes();
  } catch (err) {
    clienteCriarErro.textContent = err.message;
    clienteCriarErro.hidden = false;
  }
});

// ---------- Propostas (admin - assinantes do Gerador de Propostas) ----------
async function carregarPropostasAssinantes() {
  propAdminLista.textContent = '';
  const carregando = document.createElement('p');
  carregando.className = 'agenda-vazia';
  carregando.textContent = 'Carregando...';
  propAdminLista.appendChild(carregando);

  try {
    const res = await fetch('/api/admin/propostas-assinantes', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'erro desconhecido');
    propAdminLista.textContent = '';

    if (!data.assinantes.length) {
      const vazio = document.createElement('p');
      vazio.className = 'agenda-vazia';
      vazio.textContent = 'Nenhum assinante cadastrado ainda.';
      propAdminLista.appendChild(vazio);
      return;
    }

    for (const a of data.assinantes) {
      const card = document.createElement('div');
      card.className = 'cliente-card';

      const nome = document.createElement('div');
      nome.className = 'cliente-card-nome';
      nome.textContent = a.nome;
      card.appendChild(nome);

      const meta = document.createElement('div');
      meta.className = 'cliente-card-meta';
      meta.textContent = `usuario: ${a.username} - ${a.ativo ? 'Ativo' : 'Desativado'}`;
      meta.appendChild(criarBotaoCopiarUsuario(a.username));
      card.appendChild(meta);

      const acessoMeta = document.createElement('div');
      acessoMeta.className = 'cliente-card-meta';
      if (!a.propostaAcessoExpiraEm) {
        acessoMeta.textContent = 'Acesso: Vitalício';
      } else {
        const dataExpira = new Date(a.propostaAcessoExpiraEm);
        const expirado = dataExpira.getTime() < Date.now();
        acessoMeta.textContent = expirado
          ? `Acesso expirado em ${dataExpira.toLocaleDateString('pt-BR')} - bloqueado`
          : `Acesso até ${dataExpira.toLocaleDateString('pt-BR')}`;
      }
      card.appendChild(acessoMeta);

      const row = document.createElement('div');
      row.className = 'cliente-card-row';

      const planoSelect = document.createElement('select');
      const optBranded = document.createElement('option'); optBranded.value = 'branded'; optBranded.textContent = 'Branded';
      const optWhiteLabel = document.createElement('option'); optWhiteLabel.value = 'white_label'; optWhiteLabel.textContent = 'White Label';
      planoSelect.append(optBranded, optWhiteLabel);
      planoSelect.value = a.propostaPlano === 'white_label' ? 'white_label' : 'branded';
      planoSelect.addEventListener('change', async () => {
        try {
          const r = await fetch(`/api/admin/tenants/${a.id}/proposta-plano`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ plano: planoSelect.value }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
          carregarPropostasAssinantes();
        } catch (err) {
          addBubble(`Erro mudando plano: ${err.message}`, 'system');
        }
      });
      row.appendChild(planoSelect);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.textContent = a.ativo ? 'Desativar' : 'Ativar';
      toggleBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/admin/tenants/${a.id}/ativo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ ativo: !a.ativo }),
          });
          carregarPropostasAssinantes();
        } catch (err) {
          addBubble(`Erro atualizando assinante: ${err.message}`, 'system');
        }
      });
      row.appendChild(toggleBtn);
      card.appendChild(row);

      // renovar/definir periodo de acesso - tambem reativa quem tinha expirado
      const acessoRow = document.createElement('div');
      acessoRow.className = 'cliente-card-row';

      const acessoSelect = document.createElement('select');
      const optVitalicio = document.createElement('option'); optVitalicio.value = ''; optVitalicio.textContent = 'Vitalício';
      acessoSelect.appendChild(optVitalicio);
      for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = m === 1 ? '1 mês' : `${m} meses`;
        acessoSelect.appendChild(opt);
      }
      acessoRow.appendChild(acessoSelect);

      const renovarBtn = document.createElement('button');
      renovarBtn.type = 'button';
      renovarBtn.textContent = 'Renovar/Definir acesso';
      renovarBtn.addEventListener('click', async () => {
        try {
          const r = await fetch(`/api/admin/tenants/${a.id}/proposta-acesso`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ meses: acessoSelect.value || null }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
          carregarPropostasAssinantes();
        } catch (err) {
          addBubble(`Erro definindo acesso: ${err.message}`, 'system');
        }
      });
      acessoRow.appendChild(renovarBtn);
      card.appendChild(acessoRow);

      // redefinir senha (nao da pra "ver" a senha ja cadastrada - fica guardada como hash
      // irreversivel, nunca em texto legivel; redefinir e o equivalente seguro disso)
      const senhaRow = document.createElement('div');
      senhaRow.className = 'cliente-card-row';
      const novaSenhaInput = document.createElement('input');
      novaSenhaInput.type = 'password';
      novaSenhaInput.placeholder = 'Nova senha';
      senhaRow.appendChild(adicionarOlhinho(novaSenhaInput));
      const senhaBtn = document.createElement('button');
      senhaBtn.type = 'button';
      senhaBtn.textContent = 'Redefinir senha';
      senhaBtn.addEventListener('click', async () => {
        if (!novaSenhaInput.value) return;
        try {
          const r = await fetch(`/api/admin/tenants/${a.id}/senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
            body: JSON.stringify({ novaSenha: novaSenhaInput.value }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
          novaSenhaInput.value = '';
          addBubble(`Senha de "${a.nome}" redefinida.`, 'system');
        } catch (err) {
          addBubble(`Erro redefinindo senha: ${err.message}`, 'system');
        }
      });
      senhaRow.appendChild(senhaBtn);
      senhaRow.appendChild(criarBotaoVerSenha(a.id, a.nome));
      card.appendChild(senhaRow);

      if (a.apagarEm) {
        // marcado pra exclusao - mostra o aviso + botao pra desfazer, no lugar do botao de apagar
        const aviso = document.createElement('p');
        aviso.className = 'agenda-erro';
        aviso.textContent = `Marcado pra exclusão - apaga de vez em ${new Date(a.apagarEm).toLocaleDateString('pt-BR')}.`;
        card.appendChild(aviso);

        const restaurarBtn = document.createElement('button');
        restaurarBtn.type = 'button';
        restaurarBtn.textContent = `Restaurar "${a.nome}"`;
        restaurarBtn.style.cssText = 'background:rgba(212,175,55,0.16);border:1px solid rgba(212,175,55,0.5);color:#d4af37;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;margin-top:6px;';
        restaurarBtn.addEventListener('click', async () => {
          try {
            const r = await fetch(`/api/admin/tenants/${a.id}/restaurar`, { method: 'POST', headers: { 'x-app-password': appPassword } });
            const d = await r.json();
            if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
            carregarPropostasAssinantes();
          } catch (err) {
            addBubble(`Erro restaurando assinante: ${err.message}`, 'system');
          }
        });
        card.appendChild(restaurarBtn);
        card.appendChild(criarBotaoApagarDefinitivo(a.id, a.nome, carregarPropostasAssinantes));
      } else {
        const apagarBtn = document.createElement('button');
        apagarBtn.type = 'button';
        apagarBtn.textContent = `Apagar "${a.nome}"`;
        apagarBtn.style.cssText = 'background:rgba(220,38,38,0.16);border:1px solid rgba(220,38,38,0.5);color:#f87171;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;margin-top:6px;';
        apagarBtn.addEventListener('click', async () => {
          const confirmado = confirm(`Apagar "${a.nome}"? O acesso dele e desativado na hora, e os dados ficam guardados por 30 dias (da pra restaurar aqui na lista) antes de serem apagados de vez.`);
          if (!confirmado) return;
          try {
            const r = await fetch(`/api/admin/tenants/${a.id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
            const d = await r.json();
            if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
            carregarPropostasAssinantes();
          } catch (err) {
            addBubble(`Erro apagando assinante: ${err.message}`, 'system');
          }
        });
        card.appendChild(apagarBtn);
        card.appendChild(criarBotaoApagarDefinitivo(a.id, a.nome, carregarPropostasAssinantes));
      }

      propAdminLista.appendChild(card);
    }
  } catch (err) {
    propAdminLista.textContent = '';
    const erro = document.createElement('p');
    erro.className = 'agenda-vazia';
    erro.textContent = `Nao consegui carregar os assinantes: ${err.message}`;
    propAdminLista.appendChild(erro);
  }
}

propAdminCriarBtn.addEventListener('click', async () => {
  const nome = propAdminNomeInput.value.trim();
  const username = propAdminUsuarioInput.value.trim();
  const senha = propAdminSenhaInput.value;
  const plano = propAdminPlanoInput.value;
  propAdminCriarErro.hidden = true;
  if (!nome || !username || !senha) {
    propAdminCriarErro.textContent = 'Preenche nome, usuario e senha.';
    propAdminCriarErro.hidden = false;
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

    // sempre define o plano explicitamente (mesmo "branded") - e o que marca esse tenant como
    // assinante de verdade do Gerador de Propostas (proposta_plano preenchido). Sem isso, ele
    // ficaria com proposta_plano NULL e nao teria acesso nenhum ao produto.
    const r2 = await fetch(`/api/admin/tenants/${data.id}/proposta-plano`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ plano }),
    });
    const d2 = await r2.json();
    if (!r2.ok) throw new Error(d2.erro || 'assinante criado, mas erro ao definir o plano');

    const meses = propAdminAcessoInput.value;
    if (meses) {
      const r3 = await fetch(`/api/admin/tenants/${data.id}/proposta-acesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ meses }),
      });
      const d3 = await r3.json();
      if (!r3.ok) throw new Error(d3.erro || 'assinante criado, mas erro ao definir o periodo de acesso');
    }

    propAdminNomeInput.value = '';
    propAdminUsuarioInput.value = '';
    propAdminSenhaInput.value = '';
    propAdminPlanoInput.value = 'branded';
    propAdminAcessoInput.value = '';
    carregarPropostasAssinantes();
  } catch (err) {
    propAdminCriarErro.textContent = err.message;
    propAdminCriarErro.hidden = false;
  }
});

async function selecionarCliente(id, nome, username) {
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

  // Gerador de Propostas NAO aparece aqui de proposito - um cliente comum da Lumia nao deve
  // ter nenhuma ligacao com esse produto. Quem e assinante do Gerador de Propostas e gerenciado
  // exclusivamente pela aba "Gerador de Propostas" (tenant_config.proposta_plano so e
  // preenchido por la, e listarTenants() ja exclui esses tenants desta lista de Clientes).

  // ---- Login e senha ----
  // a senha nunca fica visivel de novo depois de criada (guardada como hash irreversivel) -
  // o usuario e visivel/copiavel aqui, redefinir senha e o equivalente seguro de "trocar a senha"
  const loginLabel = document.createElement('label'); loginLabel.className = 'auto-label'; loginLabel.textContent = 'Login';
  clienteIntegracoesPainel.appendChild(loginLabel);
  const loginInfo = document.createElement('p');
  loginInfo.className = 'agenda-vazia';
  loginInfo.textContent = `usuário: ${username}`;
  loginInfo.appendChild(criarBotaoCopiarUsuario(username));
  clienteIntegracoesPainel.appendChild(loginInfo);

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
  senhaForm.appendChild(adicionarOlhinho(novaSenhaInput));
  senhaForm.append(senhaSalvar, criarBotaoVerSenha(id, nome));
  clienteIntegracoesPainel.appendChild(senhaForm);

  // ---- Periodo de Acesso (contratacao) ----
  const acessoLabel = document.createElement('label'); acessoLabel.className = 'auto-label'; acessoLabel.textContent = 'Período de Acesso (contratação)';
  clienteIntegracoesPainel.appendChild(acessoLabel);
  const acessoStatus = document.createElement('p');
  acessoStatus.className = 'agenda-vazia';
  acessoStatus.textContent = 'Carregando...';
  clienteIntegracoesPainel.appendChild(acessoStatus);

  const acessoForm = document.createElement('div');
  acessoForm.className = 'cliente-form';
  const acessoSelect = document.createElement('select');
  const optVital = document.createElement('option'); optVital.value = ''; optVital.textContent = 'Vitalício';
  acessoSelect.appendChild(optVital);
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = m === 1 ? '1 mês' : `${m} meses`;
    acessoSelect.appendChild(opt);
  }
  const acessoSalvar = document.createElement('button'); acessoSalvar.type = 'button'; acessoSalvar.textContent = 'Renovar/Definir acesso';
  acessoSalvar.addEventListener('click', async () => {
    try {
      const r = await fetch(`/api/admin/tenants/${id}/acesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ meses: acessoSelect.value || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      carregarClientes();
      selecionarCliente(id, nome);
    } catch (err) {
      addBubble(`Erro definindo acesso: ${err.message}`, 'system');
    }
  });
  acessoForm.append(acessoSelect, acessoSalvar);
  clienteIntegracoesPainel.appendChild(acessoForm);

  (async () => {
    try {
      const r = await fetch('/api/admin/tenants', { headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      const t = (d.tenants || []).find((x) => x.id === id);
      if (!t) return;
      if (!t.acesso_expira_em) {
        acessoStatus.textContent = 'Acesso atual: Vitalício';
      } else {
        const dataExpira = new Date(t.acesso_expira_em);
        acessoStatus.textContent = dataExpira.getTime() < Date.now()
          ? `Acesso expirado em ${dataExpira.toLocaleDateString('pt-BR')} - bloqueado`
          : `Acesso atual: até ${dataExpira.toLocaleDateString('pt-BR')}`;
      }
    } catch (e) {}
  })();

  // ---- Abas/recursos liberados pra esse cliente ----
  const tabsLabel = document.createElement('label'); tabsLabel.className = 'auto-label'; tabsLabel.textContent = 'Abas/recursos liberados';
  clienteIntegracoesPainel.appendChild(tabsLabel);
  const tabsAviso = document.createElement('p');
  tabsAviso.className = 'agenda-vazia';
  tabsAviso.textContent = 'Nenhuma marcada = tudo liberado (padrão). Marque só pra restringir.';
  clienteIntegracoesPainel.appendChild(tabsAviso);

  const TABS_LABELS = { painel: 'Painel (Lumia/Chat)', agenda: 'Agenda', whatsapp: 'WhatsApp', crm: 'CRM', auto: 'Auto Atendimento', followUp: 'Follow Up', relatorios: 'Relatórios', geradorRelatorios: 'Gerador de Relatórios', integracoes: 'Integrações', instagram: 'Instagram' };
  const tabsForm = document.createElement('div');
  tabsForm.className = 'cliente-form';
  const tabsCheckboxes = {};
  for (const chave of Object.keys(TABS_LABELS)) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = chave;
    tabsCheckboxes[chave] = cb;
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(TABS_LABELS[chave]));
    tabsForm.appendChild(wrap);
  }
  const tabsSalvar = document.createElement('button'); tabsSalvar.type = 'button'; tabsSalvar.textContent = 'Salvar Abas Liberadas';
  tabsSalvar.addEventListener('click', async () => {
    const marcadas = Object.keys(tabsCheckboxes).filter((k) => tabsCheckboxes[k].checked);
    try {
      const r = await fetch(`/api/admin/tenants/${id}/tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ tabs: marcadas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      addBubble(`Abas de "${nome}" atualizadas.`, 'system');
    } catch (err) {
      addBubble(`Erro salvando abas: ${err.message}`, 'system');
    }
  });
  tabsForm.appendChild(tabsSalvar);
  clienteIntegracoesPainel.appendChild(tabsForm);

  (async () => {
    try {
      const r = await fetch(`/api/admin/tenants/${id}/tabs`, { headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      const habilitadas = Array.isArray(d.tabsHabilitadas) && d.tabsHabilitadas.length ? d.tabsHabilitadas : null;
      for (const chave of Object.keys(tabsCheckboxes)) {
        tabsCheckboxes[chave].checked = habilitadas ? habilitadas.includes(chave) : true;
      }
    } catch (e) {}
  })();

  // ---- Beneficio: cliente pode criar logins de colaborador pra propria equipe ----
  const colabLabel = document.createElement('label'); colabLabel.className = 'auto-label'; colabLabel.textContent = 'Colaboradores (login extra pra equipe do cliente)';
  clienteIntegracoesPainel.appendChild(colabLabel);
  const colabAviso = document.createElement('p');
  colabAviso.className = 'agenda-vazia';
  colabAviso.textContent = 'Quando ligado, o proprio cliente pode criar logins extras (ex: recepcionista) com acesso completo a conta dele, na aba Integracoes.';
  clienteIntegracoesPainel.appendChild(colabAviso);
  const colabToggleWrap = document.createElement('label');
  colabToggleWrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);margin:6px 0;';
  const colabToggle = document.createElement('input');
  colabToggle.type = 'checkbox';
  colabToggle.disabled = true;
  const colabToggleTexto = document.createElement('span');
  colabToggleTexto.textContent = 'Carregando...';
  colabToggleTexto.textContent = colabToggle.checked ? 'Permitido' : 'Nao permitido';
  colabToggle.addEventListener('change', async () => {
    colabToggle.disabled = true;
    try {
      const r = await fetch(`/api/admin/tenants/${id}/permite-colaboradores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ permitido: colabToggle.checked }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      colabToggleTexto.textContent = colabToggle.checked ? 'Permitido' : 'Nao permitido';
      addBubble(`Colaboradores ${colabToggle.checked ? 'liberados' : 'bloqueados'} pra "${nome}".`, 'system');
    } catch (err) {
      colabToggle.checked = !colabToggle.checked;
      addBubble(`Erro: ${err.message}`, 'system');
    } finally {
      colabToggle.disabled = false;
    }
  });
  colabToggleWrap.appendChild(colabToggle);
  colabToggleWrap.appendChild(colabToggleTexto);
  clienteIntegracoesPainel.appendChild(colabToggleWrap);

  (async () => {
    try {
      const r = await fetch('/api/admin/tenants', { headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      const t = (d.tenants || []).find((x) => x.id === id);
      colabToggle.checked = !!t?.permite_colaboradores;
      colabToggleTexto.textContent = colabToggle.checked ? 'Permitido' : 'Nao permitido';
    } catch (e) {
      colabToggleTexto.textContent = 'Erro ao carregar';
    } finally {
      colabToggle.disabled = false;
    }
  })();

  // ---- Cerebro de IA (recurso pago a parte - desligado ate liberar aqui) ----
  const cerebroLabel = document.createElement('label'); cerebroLabel.className = 'auto-label'; cerebroLabel.textContent = 'Cérebro de IA (recurso pago)';
  clienteIntegracoesPainel.appendChild(cerebroLabel);
  const cerebroWrap = document.createElement('label');
  cerebroWrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);margin-bottom:10px;cursor:pointer;';
  const cerebroCb = document.createElement('input');
  cerebroCb.type = 'checkbox';
  cerebroCb.disabled = true;
  cerebroWrap.appendChild(cerebroCb);
  cerebroWrap.appendChild(document.createTextNode('Liberar a aba Cérebro (memória compartilhada entre IAs) pra esse cliente'));
  clienteIntegracoesPainel.appendChild(cerebroWrap);
  cerebroCb.addEventListener('change', async () => {
    const liberado = cerebroCb.checked;
    try {
      const r = await fetch(`/api/admin/tenants/${id}/cerebro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
        body: JSON.stringify({ liberado }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      addBubble(`Cérebro ${liberado ? 'liberado' : 'bloqueado'} pra "${nome}".`, 'system');
    } catch (err) {
      cerebroCb.checked = !liberado;
      addBubble(`Erro alterando o Cérebro: ${err.message}`, 'system');
    }
  });
  (async () => {
    try {
      const r = await fetch(`/api/admin/tenants/${id}/cerebro`, { headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      cerebroCb.checked = !!d.liberado;
      cerebroCb.disabled = false;
    } catch (e) {}
  })();

  // ---- Apagar cliente (marca pra exclusao - so apaga de verdade depois de 30 dias, da pra
  // restaurar ate la na propria lista) ----
  const apagarLabel = document.createElement('label'); apagarLabel.className = 'auto-label'; apagarLabel.textContent = 'Zona de risco';
  clienteIntegracoesPainel.appendChild(apagarLabel);
  const apagarBtn = document.createElement('button');
  apagarBtn.type = 'button';
  apagarBtn.textContent = `Apagar "${nome}"`;
  apagarBtn.style.cssText = 'background:rgba(220,38,38,0.16);border:1px solid rgba(220,38,38,0.5);color:#f87171;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;';
  apagarBtn.addEventListener('click', async () => {
    const confirmado = confirm(`Apagar "${nome}"? O acesso dele e desativado na hora, e os dados ficam guardados por 30 dias (da pra restaurar na lista) antes de serem apagados de vez.`);
    if (!confirmado) return;
    try {
      const r = await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE', headers: { 'x-app-password': appPassword } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      clienteSelecionadoId = null;
      clienteIntegracoesPainel.textContent = '';
      const msg = document.createElement('p');
      msg.className = 'agenda-vazia';
      msg.textContent = 'Selecione um cliente na lista pra ver/configurar as integrações dele.';
      clienteIntegracoesPainel.appendChild(msg);
      carregarClientes();
    } catch (err) {
      addBubble(`Erro apagando cliente: ${err.message}`, 'system');
    }
  });
  clienteIntegracoesPainel.appendChild(apagarBtn);

  clienteIntegracoesPainel.appendChild(criarBotaoApagarDefinitivo(id, nome, () => {
    clienteSelecionadoId = null;
    clienteIntegracoesPainel.textContent = '';
    const msg = document.createElement('p');
    msg.className = 'agenda-vazia';
    msg.textContent = 'Selecione um cliente na lista pra ver/configurar as integrações dele.';
    clienteIntegracoesPainel.appendChild(msg);
    carregarClientes();
  }));
}
