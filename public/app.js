const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
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
const clearBtn = document.getElementById('clearBtn');
const extractBtn = document.getElementById('extractBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachPreview = document.getElementById('attachPreview');
const bot = document.getElementById('bot');
const statusEl = document.getElementById('status');
const clockEl = document.getElementById('clock');
const hintEl = document.getElementById('hint');

let sessionId = localStorage.getItem('jarvis_session_id');
if (!sessionId) {
  sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('jarvis_session_id', sessionId);
}

let appPassword = sessionStorage.getItem('jarvis_password') || '';
let vozAtivada = true;
let gravando = false;
let modoConversa = false;
let aguardandoResposta = false;
let processandoEnvio = false;
let silenceTimer = null;
const PAUSA_TOLERANCIA_MS = 1800; // quanto tempo de silencio aceitar (modo conversa) antes de considerar que a pessoa terminou de falar

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

async function tentarEntrar(senha) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: senha }),
  });
  const raw = await res.text();
  try {
    const data = JSON.parse(raw);
    return data.ok === true;
  } catch {
    return false;
  }
}

function mostrarApp() {
  loginScreen.hidden = true;
  appWindow.hidden = false;
  if (!chatLog.childElementCount) {
    addBubble('Lumia pronta. Digite, aperte o microfone ou ative o modo conversa.', 'system');
  }
  setStatus('pronto', null);
  // o canvas do avatar fica em 0x0 enquanto a tela de login esta visivel (elemento pai
  // hidden) - o ResizeObserver nem sempre pega essa transicao de "escondido -> visivel",
  // entao forca a medicao de novo agora que o app realmente apareceu
  ajustarTamanhoCanvas();
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
  tentarEntrar(appPassword).then((ok) => {
    if (ok) mostrarApp();
    else { appPassword = ''; sessionStorage.removeItem('jarvis_password'); }
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const senha = passwordInput.value;
  loginError.textContent = '';
  const ok = await tentarEntrar(senha);
  if (!ok) {
    loginError.textContent = 'Senha incorreta.';
    return;
  }
  appPassword = senha;
  sessionStorage.setItem('jarvis_password', senha);
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
}

function addBubble(text, kind) {
  const div = document.createElement('div');
  div.className = `bubble ${kind}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

// O avatar e um video real (com movimento e boca falando de verdade), gravado em fundo verde
// de estudio de verdade - entao a gente desenha cada quadro num canvas e faz chroma-key: apaga
// (ou suaviza, nas bordas) os pixels onde o verde domina claramente sobre vermelho/azul.
// #bot agora e um <canvas>; os <video> reais ficam escondidos (.bot-source) so fornecendo quadros.
const videoIdle = document.getElementById('botSrcIdle');
const videoTalk = document.getElementById('botSrcTalk');
const botCtx = bot.getContext('2d', { willReadFrequently: true });
let videoAtivo = videoIdle;

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
  const dpr = window.devicePixelRatio || 1;
  const rect = bot.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return; // ainda escondido (tela de login)
  bot.width = Math.max(1, Math.round(rect.width * dpr));
  bot.height = Math.max(1, Math.round(rect.height * dpr));
}
// ResizeObserver pega tanto o resize da janela quanto o momento em que o app deixa de
// estar escondido (tela de login -> app), quando o canvas passa de 0x0 pro tamanho real
new ResizeObserver(ajustarTamanhoCanvas).observe(bot);
ajustarTamanhoCanvas();

// desenha o video "cobrindo" o canvas inteiro (igual object-fit: cover), cortando o excesso
function desenharComCover(video, destW, destH) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return false;
  const escala = Math.max(destW / vw, destH / vh);
  const sw = destW / escala, sh = destH / escala;
  const sx = (vw - sw) / 2;
  // quando o box e baixo/largo (celular deitado com pouca altura), cortar bem no meio corta
  // o rosto - inclina o corte pra cima (mantem mais cabeca, corta mais do corpo debaixo)
  const sy = (vh - sh) * 0.18;
  botCtx.drawImage(video, sx, sy, sw, sh, 0, 0, destW, destH);
  return true;
}

function renderizarQuadro() {
  const w = bot.width, h = bot.height;
  if (w > 0 && h > 0 && videoAtivo.readyState >= 2) {
    if (desenharComCover(videoAtivo, w, h)) {
      const frame = botCtx.getImageData(0, 0, w, h);
      removerFundo(frame);
      botCtx.putImageData(frame, 0, 0);
    }
  }
  requestAnimationFrame(renderizarQuadro);
}
requestAnimationFrame(renderizarQuadro);

function iniciarFalaVisual() {
  videoAtivo = videoTalk;
  videoTalk.currentTime = 0;
  videoTalk.play().catch(() => {});
}

function pararFalaVisual() {
  videoAtivo = videoIdle;
  videoTalk.pause();
}

// so um audio por vez - qualquer fala nova cancela a anterior, pra nao atropelar
let audioAtual = null;

function base64ParaBlob(base64, tipo) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

// revela o texto na bolha em sincronia real com o audio, usando o alinhamento de
// caracteres que o ElevenLabs devolve (tempo exato de cada letra)
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

async function falarElevenLabs(texto, bubbleEl) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
    body: JSON.stringify({ text: texto }),
  });
  if (!res.ok) throw new Error('tts indisponivel');
  const data = await res.json();
  if (!data.audio || !data.alignment) throw new Error('tts sem alinhamento');

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
    audio.onplay = () => {
      setStatus('falando', 'speaking');
      iniciarFalaVisual();
      if (bubbleEl) legendarProgressivo(audio, bubbleEl, characters, starts);
    };
    const finalizar = () => {
      pararFalaVisual();
      pararLegenda(bubbleEl, texto);
      URL.revokeObjectURL(url);
      if (audioAtual === audio) audioAtual = null;
      resolve();
    };
    audio.onended = finalizar;
    audio.onerror = finalizar;
    audio.play().catch(finalizar);
  });
}

function falarNavegador(texto, bubbleEl) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    utter.rate = 1.02;
    utter.onstart = () => { setStatus('falando', 'speaking'); iniciarFalaVisual(); };
    // a Web Speech API so da o indice do caractere onde comeca cada palavra (nao o tempo
    // exato como o ElevenLabs) - ainda assim da pra revelar palavra por palavra
    utter.onboundary = (event) => {
      if (bubbleEl && event.name === 'word') {
        bubbleEl.textContent = texto.slice(0, event.charIndex + event.charLength || event.charIndex);
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    };
    const finalizar = () => { pararFalaVisual(); if (bubbleEl) bubbleEl.textContent = texto; resolve(); };
    utter.onend = finalizar;
    utter.onerror = finalizar;
    window.speechSynthesis.speak(utter);
  });
}

// fala a resposta revelando o texto em sincronia; se o modo conversa estiver ativo, so
// volta a ouvir depois de terminar
async function falar(texto, bubbleEl) {
  if (vozAtivada && texto) {
    try {
      await falarElevenLabs(texto, bubbleEl);
    } catch (err) {
      // cai pra voz robotica do navegador so como ultimo recurso - loga o motivo real (rate
      // limit da ElevenLabs, erro de rede, autoplay bloqueado etc) pra dar pra diagnosticar
      console.warn('ElevenLabs falhou, usando voz do navegador como fallback:', err);
      await falarNavegador(texto, bubbleEl);
    }
  } else if (bubbleEl) {
    bubbleEl.textContent = texto;
  }
  setStatus('pronto', null);
  aguardandoResposta = false;
  if (modoConversa) setTimeout(ouvirSegmento, 350);
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
  setStatus('pensando', 'thinking');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({
        message: textoLimpo,
        sessionId,
        attachments: anexos.map(({ kind, mediaType, base64 }) => ({ kind, mediaType, base64 })),
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

    const bubble = addBubble('', 'assistant');
    await falar(data.reply, bubble);
  } catch (err) {
    addBubble(`Erro: ${err.message}`, 'system');
    setStatus('erro', null);
    aguardandoResposta = false;
    if (modoConversa) setTimeout(ouvirSegmento, 800);
  } finally {
    processandoEnvio = false;
  }
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarMensagem(textInput.value);
});

clearBtn.addEventListener('click', () => {
  chatLog.innerHTML = '';
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
// moderno) e mandamos pro nosso servidor transcrever (ElevenLabs) - funciona igual em todo lugar.

const gravacaoSuportada = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let vadCtx = null;
let vadRAF = null;
const VOLUME_MINIMO_FALA = 12; // 0-255 (media de frequencia) - abaixo disso conta como silencio

async function pedirMicrofone() {
  if (micStream && micStream.active) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
    body: JSON.stringify({ audioBase64: base64, mediaType: mimeType }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erro || 'erro na transcricao');
  return (data.text || '').trim();
}

// so usado no modo conversa: monitora o volume do microfone pra saber sozinho quando a
// pessoa parou de falar (no modo de toque unico, quem decide e o proprio usuario clicando de novo)
function monitorarSilencio(stream, aoParar) {
  const ctx = ensureAudioContext();
  vadCtx = ctx;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let falouAlgumaVez = false;

  function checar() {
    analyser.getByteFrequencyData(dataArray);
    const media = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
    if (media > VOLUME_MINIMO_FALA) {
      falouAlgumaVez = true;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => aoParar(falouAlgumaVez), PAUSA_TOLERANCIA_MS);
    }
    vadRAF = requestAnimationFrame(checar);
  }
  checar();
}

function pararMonitorSilencio() {
  if (vadRAF) cancelAnimationFrame(vadRAF);
  vadRAF = null;
  clearTimeout(silenceTimer);
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
