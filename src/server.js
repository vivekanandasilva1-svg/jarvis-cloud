import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './cloudAgent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());

const APP_PASSWORD = process.env.APP_PASSWORD;

// protege tudo (estaticos + api) com uma senha simples via header - o link fica publico na
// internet e essa versao consegue mexer em orcamento real de anuncio, entao nao pode ficar
// aberta para qualquer um que ache a URL.
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next(); // sem senha configurada, roda aberto (nao recomendado)
  if (req.path === '/api/login') return next();

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
  const { message, sessionId } = req.body || {};
  if (!message || !sessionId) {
    return res.status(400).json({ erro: 'message e sessionId sao obrigatorios' });
  }

  try {
    const reply = await chat(sessionId, message);
    res.json({ reply });
  } catch (err) {
    console.error('Erro no chat:', err);
    res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jarvis Cloud rodando na porta ${PORT}`);
});
