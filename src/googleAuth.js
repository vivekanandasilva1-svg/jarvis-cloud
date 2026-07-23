// autenticacao OAuth do Google compartilhada entre integracoes (Agenda, Planilhas), POR TENANT
// - cada cliente conecta a PROPRIA conta Google uma vez so (tela "Agenda" do app) e concede
// acesso a tudo que estiver no SCOPE abaixo; access/refresh token ficam guardados numa linha
// por tenant, reaproveitados por qualquer modulo que precise chamar uma API do Google em nome
// dele. O app OAuth (client id/secret) e compartilhado entre todos os tenants (1 app cadastrado
// no Google Cloud) - so os TOKENS sao por tenant, cada um fazendo o proprio consentimento.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabela() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      access_token TEXT,
      refresh_token TEXT,
      expiry_date BIGINT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // instalacao que ja tinha essa tabela ANTES da conversao multi-tenant (schema antigo: "id
  // INT PK DEFAULT 1", sem tenant_id) - o CREATE TABLE acima e no-op nesse caso. Adiciona a
  // coluna (nullable ate o backfill) e um indice unico nela, exigido pelo ON CONFLICT
  // (tenant_id) usado em trocarCodigoPorToken - sem esse indice o INSERT... ON CONFLICT falha.
  await pool.query(`ALTER TABLE google_calendar_tokens ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_tokens_tenant_idx ON google_calendar_tokens (tenant_id);`);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela google_calendar_tokens:', err.message);
});

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// calendar.events (Agenda) + spreadsheets (Planilhas Google, ex: planilha do laboratorio) -
// reconectar depois de adicionar um escopo novo aqui pede consentimento de novo pro usuario
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets';

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

export async function trocarCodigoPorToken(tenantId, code) {
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
    `INSERT INTO google_calendar_tokens (tenant_id, access_token, refresh_token, expiry_date, atualizado_em)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       access_token = $2,
       refresh_token = COALESCE($3, google_calendar_tokens.refresh_token),
       expiry_date = $4,
       atualizado_em = now()`,
    [tenantId, data.access_token, data.refresh_token || null, Date.now() + data.expires_in * 1000],
  );
}

async function obterTokens(tenantId) {
  if (!pool) return null;
  await tabelaPronta;
  const { rows } = await pool.query('SELECT access_token, refresh_token, expiry_date FROM google_calendar_tokens WHERE tenant_id = $1', [tenantId]);
  return rows[0] || null;
}

export async function estaConectado(tenantId) {
  const tokens = await obterTokens(tenantId);
  return !!(tokens && tokens.refresh_token);
}

export async function desconectar(tenantId) {
  if (!pool) return;
  await tabelaPronta;
  await pool.query('DELETE FROM google_calendar_tokens WHERE tenant_id = $1', [tenantId]);
}

// renova o access token via refresh token quando necessario (ou na primeira vez) - o Google so
// da um access token novo de tempos em tempos (~1h), o refresh token e o que fica valendo pra
// sempre ate o usuario desconectar
export async function tokenValido(tenantId) {
  const tokens = await obterTokens(tenantId);
  if (!tokens || !tokens.refresh_token) throw new Error('Google nao esta conectado (conecte na aba Agenda do app).');
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
  await pool.query('UPDATE google_calendar_tokens SET access_token = $1, expiry_date = $2, atualizado_em = now() WHERE tenant_id = $3', [
    data.access_token,
    Date.now() + data.expires_in * 1000,
    tenantId,
  ]);
  return data.access_token;
}
