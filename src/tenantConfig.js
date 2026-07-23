// credenciais especificas de cada tenant que hoje eram env vars globais (uma clinica/1 dono
// so). Regra critica: NENHUMA integracao pessoal do dono da Lumia pode ficar acessivel pra um
// cliente que comprar o produto - cada tenant so ve/mexe nas proprias contas. O Evolution API
// continua compartilhado entre todos os tenants (1 servidor, varias instancias nomeadas - ver
// whatsappInstances.js pra qual instancia cada tenant usa - a instancia em si e isolada por
// tenant, so o servidor por baixo e compartilhado), entao NAO entra aqui. Ja Clinicorp e Meta
// Ads sao credenciais de CONTA (Clinicorp = 1 assinatura por clinica, Meta Ads = tokens que dao
// acesso as contas de anuncio de negocio de cada cliente) - essas tem que ser por tenant.
import { pool } from './db.js';
import { encrypt, decrypt } from './crypto.js';

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      clinicorp_api_user TEXT,
      clinicorp_api_token_enc BYTEA,
      clinicorp_subscriber_id TEXT,
      clinicorp_default_business_id TEXT,
      meta_ads_tokens_enc BYTEA,
      trello_api_key TEXT,
      trello_token_enc BYTEA,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS trello_api_key TEXT;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS trello_token_enc BYTEA;`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabela de tenant_config:', err.message);
});

// devolve null se o tenant nao tiver Clinicorp configurado (tenant sem essa integracao - ver
// fase 2 do plano, por enquanto so significa "essas ferramentas nao vao funcionar pra ele")
export async function obterClinicorp(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    'SELECT clinicorp_api_user, clinicorp_api_token_enc, clinicorp_subscriber_id, clinicorp_default_business_id FROM tenant_config WHERE tenant_id = $1',
    [tenantId],
  );
  const linha = rows[0];
  if (!linha || !linha.clinicorp_api_user) return null;
  return {
    apiUser: linha.clinicorp_api_user,
    apiToken: decrypt(linha.clinicorp_api_token_enc),
    subscriberId: linha.clinicorp_subscriber_id,
    defaultBusinessId: linha.clinicorp_default_business_id,
  };
}

export async function salvarClinicorp(tenantId, { apiUser, apiToken, subscriberId, defaultBusinessId }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, clinicorp_api_user, clinicorp_api_token_enc, clinicorp_subscriber_id, clinicorp_default_business_id, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       clinicorp_api_user = $2, clinicorp_api_token_enc = $3, clinicorp_subscriber_id = $4, clinicorp_default_business_id = $5, atualizado_em = now()`,
    [tenantId, apiUser, encrypt(apiToken), subscriberId, defaultBusinessId],
  );
}

// ---------- Meta Ads (tokens das contas de anuncio de negocio do proprio tenant) ----------

// devolve [] (nao null) se o tenant nao tiver nenhuma conta de anuncio conectada - metaads.js
// usa isso direto como a lista de token sets, um array vazio ja significa "sem nenhuma conta"
// sem precisar de checagem null espalhada
export async function obterMetaAdsTokens(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT meta_ads_tokens_enc FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  const bruto = rows[0]?.meta_ads_tokens_enc;
  if (!bruto) return [];
  try {
    return JSON.parse(decrypt(bruto));
  } catch (err) {
    console.error(`tenant_config: meta_ads_tokens do tenant ${tenantId} corrompido:`, err.message);
    return [];
  }
}

// tokens: array de { label, token } - uma entrada por conta/negocio de anuncio que o cliente
// quiser conectar, mesmo formato que META_ADS_TOKENS tinha como env var global antes
export async function salvarMetaAdsTokens(tenantId, tokens) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, meta_ads_tokens_enc, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET meta_ads_tokens_enc = $2, atualizado_em = now()`,
    [tenantId, encrypt(JSON.stringify(tokens || []))],
  );
}

// ---------- Trello (quadro pessoal do proprio tenant) ----------

export async function obterTrello(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT trello_api_key, trello_token_enc FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  const linha = rows[0];
  if (!linha || !linha.trello_api_key) return null;
  return { apiKey: linha.trello_api_key, token: decrypt(linha.trello_token_enc) };
}

export async function salvarTrello(tenantId, { apiKey, token }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, trello_api_key, trello_token_enc, atualizado_em) VALUES ($1, $2, $3, now())
     ON CONFLICT (tenant_id) DO UPDATE SET trello_api_key = $2, trello_token_enc = $3, atualizado_em = now()`,
    [tenantId, apiKey, encrypt(token)],
  );
}
