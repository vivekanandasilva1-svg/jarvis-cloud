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
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
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
  // "ativo" de cada integracao (aba Integracoes) - desativar NAO apaga a credencial, so faz
  // obterClinicorp/obterTrello devolverem null enquanto estiver falso, como se o tenant nao
  // tivesse configurado nada. Reversivel, sem perder o que ja foi cadastrado.
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS clinicorp_ativo BOOLEAN NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS trello_ativo BOOLEAN NOT NULL DEFAULT true;`);
  // ids das contas de anuncio (Meta Ads) que o tenant tirou dos relatorios automaticos - a
  // conta continua conectada e utilizavel pelo chat/ferramentas, so fica de fora do que os
  // geradores de relatorio (relatoriosProgramados.js) incluem
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS meta_ads_contas_desativadas JSONB NOT NULL DEFAULT '[]'::jsonb;`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabela de tenant_config:', err.message);
});

// le a linha crua do Clinicorp, IGNORANDO o "ativo" - uso interno (obterClinicorp de verdade e
// obterStatusIntegracoes/obterResumo, que precisam saber se ta configurado mesmo desativado)
async function _lerClinicorpBruto(tenantId) {
  const { rows } = await pool.query(
    'SELECT clinicorp_api_user, clinicorp_api_token_enc, clinicorp_subscriber_id, clinicorp_default_business_id, clinicorp_ativo FROM tenant_config WHERE tenant_id = $1',
    [tenantId],
  );
  return rows[0] || null;
}

// devolve null se o tenant nao tiver Clinicorp configurado OU se tiver desativado na aba
// Integracoes (tenant sem essa integracao - ver fase 2 do plano, por enquanto so significa
// "essas ferramentas nao vao funcionar pra ele")
export async function obterClinicorp(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const linha = await _lerClinicorpBruto(tenantId);
  if (!linha || !linha.clinicorp_api_user || !linha.clinicorp_ativo) return null;
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

// ---------- Meta Ads: quais contas ficam de fora dos relatorios automaticos ----------
// (a conta continua conectada e utilizavel pelo chat normalmente - ver metaads.js listAdAccounts)

export async function obterContasMetaAdsDesativadas(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT meta_ads_contas_desativadas FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return rows[0]?.meta_ads_contas_desativadas || [];
}

export async function definirContaMetaAdsAtiva(tenantId, accountId, ativa) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const atuais = await obterContasMetaAdsDesativadas(tenantId);
  const proximas = ativa ? atuais.filter((id) => id !== accountId) : [...new Set([...atuais, accountId])];
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, meta_ads_contas_desativadas, atualizado_em) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (tenant_id) DO UPDATE SET meta_ads_contas_desativadas = $2::jsonb, atualizado_em = now()`,
    [tenantId, JSON.stringify(proximas)],
  );
}

// ---------- Trello (quadro pessoal do proprio tenant) ----------

async function _lerTrelloBruto(tenantId) {
  const { rows } = await pool.query('SELECT trello_api_key, trello_token_enc, trello_ativo FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return rows[0] || null;
}

export async function obterTrello(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const linha = await _lerTrelloBruto(tenantId);
  if (!linha || !linha.trello_api_key || !linha.trello_ativo) return null;
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

// resumo pro painel "Clientes" (aba admin) - so diz O QUE ESTA configurado, nunca devolve o
// segredo em si de volta pro navegador (o apiUser do Clinicorp e o label de cada conta de Ads
// nao sao segredo, servem so pra confirmar visualmente qual conta ta conectada). Le os dados
// BRUTOS (ignora o "ativo") - uma integracao pausada continua aparecendo como configurada aqui,
// so nao aparece como configurada pra obterClinicorp/obterTrello (que sao os que decidem se a
// ferramenta funciona de verdade).
export async function obterResumo(tenantId) {
  if (!pool) return { clinicorp: null, metaAds: [], trello: false };
  await tabelasProntas;
  const [clinicorpBruto, metaAdsTokens, trelloBruto] = await Promise.all([
    _lerClinicorpBruto(tenantId),
    obterMetaAdsTokens(tenantId),
    _lerTrelloBruto(tenantId),
  ]);
  const clinicorp = clinicorpBruto?.clinicorp_api_user ? clinicorpBruto : null;
  const trello = trelloBruto?.trello_api_key ? trelloBruto : null;
  return {
    clinicorp: clinicorp ? { apiUser: clinicorp.clinicorp_api_user, subscriberId: clinicorp.clinicorp_subscriber_id } : null,
    metaAds: metaAdsTokens.map((t) => t.label),
    trello: !!trello,
  };
}

// status pra aba "Integracoes" (visivel pra qualquer tenant, sobre as PROPRIAS integracoes) -
// mesma logica "bruta" do obterResumo acima, mas incluindo o flag ativo de cada uma
export async function obterStatusIntegracoes(tenantId) {
  if (!pool) return { clinicorp: { conectado: false, ativo: true }, trello: { conectado: false, ativo: true }, metaAds: { conectado: false, quantidade: 0 } };
  await tabelasProntas;
  const [clinicorpBruto, metaAdsTokens, trelloBruto] = await Promise.all([
    _lerClinicorpBruto(tenantId),
    obterMetaAdsTokens(tenantId),
    _lerTrelloBruto(tenantId),
  ]);
  return {
    clinicorp: {
      conectado: !!clinicorpBruto?.clinicorp_api_user,
      ativo: clinicorpBruto?.clinicorp_ativo !== false,
      apiUser: clinicorpBruto?.clinicorp_api_user || null,
    },
    trello: {
      conectado: !!trelloBruto?.trello_api_key,
      ativo: trelloBruto?.trello_ativo !== false,
    },
    metaAds: {
      conectado: metaAdsTokens.length > 0,
      quantidade: metaAdsTokens.length,
    },
  };
}

// liga/desliga uma integracao inteira (Clinicorp ou Trello) sem apagar a credencial ja salva -
// so faz obterClinicorp/obterTrello devolverem null enquanto estiver desativada
export async function definirIntegracaoAtiva(tenantId, sistema, ativo) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const coluna = { clinicorp: 'clinicorp_ativo', trello: 'trello_ativo' }[sistema];
  if (!coluna) throw new Error(`Sistema desconhecido: ${sistema}`);
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, ${coluna}, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET ${coluna} = $2, atualizado_em = now()`,
    [tenantId, !!ativo],
  );
}
