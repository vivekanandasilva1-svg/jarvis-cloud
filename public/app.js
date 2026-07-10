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
const bot = document.getElementById('bot');
const mouthBars = bot.querySelectorAll('.mouth .bar');
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
let reconhecendo = false;
let modoConversa = false;
let bufferConversa = '';

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
    addBubble('Klaus pronto. Digite, aperte o microfone ou ative o modo conversa.', 'system');
  }
  setStatus('pronto', null);
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

function bocaParada() {
  mouthBars.forEach((bar) => { bar.style.transform = 'scaleY(1)'; });
}

// fallback (sem ElevenLabs): boca com pulso aleatorio enquanto fala
let mouthFallbackTimer = null;
function bocaAleatoria(ativo) {
  clearInterval(mouthFallbackTimer);
  if (!ativo) { bocaParada(); return; }
  mouthFallbackTimer = setInterval(() => {
    mouthBars.forEach((bar) => {
      bar.style.transform = `scaleY(${(0.4 + Math.random() * 1.6).toFixed(2)})`;
    });
  }, 90);
}

// boca sincronizada com o audio de verdade (analisando o volume em tempo real)
let mouthRAF = null;
function falarComAnalise(audio, analyserNode) {
  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  function animar() {
    analyserNode.getByteFrequencyData(dataArray);
    const media = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
    const escala = 0.35 + (media / 255) * 2.3;
    mouthBars.forEach((bar) => {
      const jitter = 0.85 + Math.random() * 0.3;
      bar.style.transform = `scaleY(${(escala * jitter).toFixed(2)})`;
    });
    mouthRAF = requestAnimationFrame(animar);
  }
  animar();
}

function pararAnaliseBoca() {
  if (mouthRAF) cancelAnimationFrame(mouthRAF);
  mouthRAF = null;
  bocaParada();
}

async function falarElevenLabs(texto) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
    body: JSON.stringify({ text: texto }),
  });
  if (!res.ok) throw new Error('tts indisponivel');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const source = ctx.createMediaElementSource(audio);
  const analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 256;
  source.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  await new Promise((resolve) => {
    audio.onplay = () => { setStatus('falando', 'speaking'); falarComAnalise(audio, analyserNode); };
    const finalizar = () => { pararAnaliseBoca(); URL.revokeObjectURL(url); resolve(); };
    audio.onended = finalizar;
    audio.onerror = finalizar;
    audio.play().catch(finalizar);
  });
}

function falarNavegador(texto) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'pt-BR';
    utter.rate = 1.02;
    utter.onstart = () => { setStatus('falando', 'speaking'); bocaAleatoria(true); };
    const finalizar = () => { bocaAleatoria(false); resolve(); };
    utter.onend = finalizar;
    utter.onerror = finalizar;
    window.speechSynthesis.speak(utter);
  });
}

async function falar(texto) {
  if (!vozAtivada || !texto) {
    if (modoConversa) setTimeout(ouvirUmaVez, 300);
    return;
  }
  try {
    await falarElevenLabs(texto);
  } catch {
    await falarNavegador(texto);
  }
  setStatus('pronto', null);
  if (modoConversa) setTimeout(ouvirUmaVez, 400);
}

async function enviarMensagem(texto) {
  if (!texto || !texto.trim()) return;
  addBubble(texto, 'user');
  textInput.value = '';
  setStatus('pensando', 'thinking');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': appPassword },
      body: JSON.stringify({ message: texto, sessionId }),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Servidor respondeu algo inesperado (status ${res.status}). Tenta de novo em alguns segundos.`);
    }
    if (!res.ok) throw new Error(data.erro || 'Erro desconhecido');

    addBubble(data.reply, 'assistant');
    await falar(data.reply);
    if (!vozAtivada) {
      setStatus('pronto', null);
      if (modoConversa) setTimeout(ouvirUmaVez, 400);
    }
  } catch (err) {
    addBubble(`Erro: ${err.message}`, 'system');
    setStatus('erro', null);
    if (modoConversa) setTimeout(ouvirUmaVez, 800);
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
    const quem = b.classList.contains('user') ? 'Voce' : b.classList.contains('assistant') ? 'Klaus' : 'Sistema';
    return `${quem}: ${b.textContent}`;
  });
  const blob = new Blob([linhas.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `klaus-conversa-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Voz: reconhecimento (Web Speech API) ----------

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

const ERRO_RECONHECIMENTO = {
  'not-allowed': 'Permissao de microfone negada - libera o microfone nas configuracoes do navegador.',
  'no-speech': 'Nao ouvi nada, tenta falar de novo.',
  'audio-capture': 'Nao encontrei um microfone disponivel.',
  network: 'Erro de rede no reconhecimento de voz.',
  aborted: null,
};

if (SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = 'pt-BR';
  recognizer.maxAlternatives = 1;

  recognizer.onstart = () => {
    reconhecendo = true;
    micBtn.classList.add('active');
    setStatus(modoConversa ? 'ouvindo (modo conversa)' : 'ouvindo...', 'listening');
  };

  recognizer.onresult = (event) => {
    if (!modoConversa) {
      const texto = event.results[event.results.length - 1][0].transcript;
      enviarMensagem(texto);
      return;
    }
    // modo conversa: so acumula os trechos finais, nao envia a cada palavra
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        bufferConversa += (bufferConversa ? ' ' : '') + event.results[i][0].transcript;
      }
    }
  };

  recognizer.onerror = (event) => {
    const msg = ERRO_RECONHECIMENTO[event.error];
    if (msg) addBubble(`Erro no microfone: ${msg}`, 'system');
    setStatus('pronto', null);
    if (event.error === 'not-allowed' && modoConversa) pararModoConversa();
  };

  recognizer.onend = () => {
    reconhecendo = false;
    micBtn.classList.remove('active');

    if (modoConversa) {
      const texto = bufferConversa.trim();
      bufferConversa = '';
      if (texto) {
        enviarMensagem(texto);
      } else {
        setTimeout(ouvirUmaVez, 300);
      }
    }
  };
} else {
  micBtn.title = 'Reconhecimento de voz nao suportado neste navegador (use o Chrome)';
  micBtn.style.opacity = '0.35';
  convBtn.style.opacity = '0.35';
}

function ouvirUmaVez() {
  if (!recognizer || reconhecendo) return;
  recognizer.continuous = modoConversa;
  recognizer.interimResults = modoConversa;
  try {
    recognizer.start();
  } catch {
    /* ja estava rodando, ignora */
  }
}

micBtn.addEventListener('click', () => {
  if (!recognizer) return;
  if (modoConversa) { pararModoConversa(); return; }
  if (reconhecendo) {
    recognizer.stop();
    return;
  }
  window.speechSynthesis.cancel();
  ouvirUmaVez();
});

function iniciarModoConversa() {
  if (!recognizer) return;
  modoConversa = true;
  bufferConversa = '';
  convBtn.classList.add('active');
  hintEl.textContent = 'Modo conversa ativo - pode falar quando quiser';
  ouvirUmaVez();
}

function pararModoConversa() {
  modoConversa = false;
  bufferConversa = '';
  convBtn.classList.remove('active');
  hintEl.textContent = 'Aperte o microfone ou digite abaixo';
  if (reconhecendo) recognizer.stop();
}

convBtn.addEventListener('click', () => {
  if (modoConversa) pararModoConversa();
  else iniciarModoConversa();
});

muteBtn.addEventListener('click', () => {
  vozAtivada = !vozAtivada;
  muteBtn.textContent = vozAtivada ? '🔊' : '🔇';
  if (!vozAtivada) { window.speechSynthesis.cancel(); pararAnaliseBoca(); }
});
