// integracao OPCIONAL com o Google Agenda - o usuario conecta/desconecta quando quiser (tela
// "Agenda" do app). Enquanto desconectado, a agenda interna funciona 100% sozinha; conectado,
// os eventos criados aqui tambem sao espelhados la, e os eventos de la aparecem na consulta.
import { pool } from './db.js';

async function garantirTabela() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      id INT PRIMARY KEY DEFAULT 1,
      access_token TEXT,
      refresh_token TEXT,
      expiry_date BIGINT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (id = 1)
    );
  `);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela google_calendar_tokens:', err.message);
});

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function clientId() {
  const v = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!v) throw new Error('GOOGLE_CALENDAR_CLIENT_ID nao configurado');
  return v;
}
function clientSecret() {
  const v = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!v) throw new Error('GOOGLE_CALENDAR_CLIENT_SECRET nao configurado');
  return v;
}
function redirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'https://lumia-marketing.com/api/agenda/google/callback';
}

export function urlAutorizacao() {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function trocarCodigoPorToken(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Erro trocando codigo por token do Google');

  await tabelaPronta;
  await pool.query(
    `INSERT INTO google_calendar_tokens (id, access_token, refresh_token, expiry_date, atualizado_em)
     VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET
       access_token = $1,
       refresh_token = COALESCE($2, google_calendar_tokens.refresh_token),
       expiry_date = $3,
       atualizado_em = now()`,
    [data.access_token, data.refresh_token || null, Date.now() + data.expires_in * 1000],
  );
}

async function obterTokens() {
  if (!pool) return null;
  await tabelaPronta;
  const { rows } = await pool.query('SELECT access_token, refresh_token, expiry_date FROM google_calendar_tokens WHERE id = 1');
  return rows[0] || null;
}

export async function estaConectado() {
  const tokens = await obterTokens();
  return !!(tokens && tokens.refresh_token);
}

export async function desconectar() {
  if (!pool) return;
  await tabelaPronta;
  await pool.query('DELETE FROM google_calendar_tokens WHERE id = 1');
}

// renova o access token via refresh token quando necessario (ou na primeira vez) - o Google so
// da um access token novo de tempos em tempos (~1h), o refresh token e o que fica valendo pra
// sempre ate o usuario desconectar
async function tokenValido() {
  const tokens = await obterTokens();
  if (!tokens || !tokens.refresh_token) throw new Error('Google Agenda nao esta conectado.');
  if (tokens.access_token && tokens.expiry_date && Date.now() < tokens.expiry_date - 60000) {
    return tokens.access_token;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Erro renovando token do Google');
  await pool.query('UPDATE google_calendar_tokens SET access_token = $1, expiry_date = $2, atualizado_em = now() WHERE id = 1', [
    data.access_token,
    Date.now() + data.expires_in * 1000,
  ]);
  return data.access_token;
}

async function chamarApi(method, path, body) {
  const token = await tokenValido();
  const res = await fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Google Calendar API erro ${res.status}`);
  return data;
}

export async function criarEvento({ titulo, descricao, local, inicio, fim }) {
  const evento = await chamarApi('POST', '/calendars/primary/events', {
    summary: titulo,
    description: descricao || undefined,
    location: local || undefined,
    start: { dateTime: inicio.toISOString() },
    end: { dateTime: fim.toISOString() },
  });
  return evento.id;
}

export async function listarEventos(from, to) {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const data = await chamarApi('GET', `/calendars/primary/events?${params.toString()}`);
  return data.items || [];
}

export async function cancelarEvento(googleEventId) {
  await chamarApi('DELETE', `/calendars/primary/events/${googleEventId}`);
}
