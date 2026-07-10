const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const appWindow = document.getElementById('appWindow');

const chatLog = document.getElementById('chatLog');
const composer = document.getElementById('composer');
const textInput = document.getElementById('textInput');
const micBtn = document.getElementById('micBtn');
const muteBtn = document.getElementById('muteBtn');
const orb = document.getElementById('orb');
const statusEl = document.getElementById('status');

let sessionId = localStorage.getItem('jarvis_session_id');
if (!sessionId) {
  sessionId = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('jarvis_session_id', sessionId);
}

let appPassword = sessionStorage.getItem('jarvis_password') || '';
let vozAtivada = true;
let reconhecendo = false;

// ---------- Login ----------

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
  addBubble('Jarvis pronto. Digite ou aperte o microfone pra falar comigo.', 'system');
  setStatus('pronto', null);
}

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

function setStatus(text, orbState) {
  statusEl.textContent = text;
  orb.classList.remove('listening', 'thinking', 'speaking');
  if (orbState) orb.classList.add(orbState);
}

function addBubble(text, kind) {
  const div = document.createElement('div');
  div.className = `bubble ${kind}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function falar(texto) {
  if (!vozAtivada || !texto) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = 'pt-BR';
  utter.rate = 1.02;
  utter.onstart = () => setStatus('falando', 'speaking');
  utter.onend = () => setStatus('pronto', null);
  window.speechSynthesis.speak(utter);
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
    falar(data.reply);
    if (!vozAtivada) setStatus('pronto', null);
  } catch (err) {
    addBubble(`Erro: ${err.message}`, 'system');
    setStatus('erro', null);
  }
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarMensagem(textInput.value);
});

// ---------- Voz: reconhecimento (Web Speech API) ----------

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

if (SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = 'pt-BR';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onstart = () => {
    reconhecendo = true;
    micBtn.classList.add('active');
    setStatus('ouvindo...', 'listening');
  };

  recognizer.onresult = (event) => {
    const texto = event.results[0][0].transcript;
    enviarMensagem(texto);
  };

  recognizer.onerror = () => {
    setStatus('nao entendi, tenta de novo', null);
  };

  recognizer.onend = () => {
    reconhecendo = false;
    micBtn.classList.remove('active');
  };
} else {
  micBtn.title = 'Reconhecimento de voz nao suportado neste navegador (use o Chrome)';
  micBtn.style.opacity = '0.35';
}

micBtn.addEventListener('click', () => {
  if (!recognizer) return;
  if (reconhecendo) {
    recognizer.stop();
    return;
  }
  window.speechSynthesis.cancel();
  recognizer.start();
});

muteBtn.addEventListener('click', () => {
  vozAtivada = !vozAtivada;
  muteBtn.textContent = vozAtivada ? '🔊' : '🔇';
  if (!vozAtivada) window.speechSynthesis.cancel();
});
