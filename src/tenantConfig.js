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
import { tabelasProntas as tenantsProntos, definirAtivo } from './tenants.js';

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
  // Gerador de Propostas (public/gerador-propostas.html): "branded" usa a marca fixa do
  // Vivekananda (o tenant so preenche os dados do cliente dele); "white_label" deixa o tenant
  // configurar a propria marca (nome, subtitulo, logo, dominio) pras propostas que ele manda.
  // O PLANO em si so o super_admin muda (corresponde ao que o assinante pagou) - os campos de
  // marca abaixo sao self-service, o proprio tenant edita.
  // NULL = esse tenant NAO e assinante do Gerador de Propostas (caso de qualquer cliente comum
  // da Lumia - nao deve ter NENHUMA ligacao com esse produto). So fica com um valor quando o
  // admin cria/marca ele como assinante pela aba "Gerador de Propostas" - nunca por default.
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_plano TEXT;`);
  // instalacoes antigas tinham NOT NULL DEFAULT 'branded' - isso fazia QUALQUER tenant que
  // tivesse tenant_config tocado por qualquer motivo (Clinicorp, Meta Ads, etc) ganhar
  // "branded" de brinde. Remove a constraint pra valer so pra quem for cadastrado como
  // assinante de verdade (idempotente - nao da erro se ja tiver sido removida antes).
  await pool.query(`ALTER TABLE tenant_config ALTER COLUMN proposta_plano DROP DEFAULT;`);
  await pool.query(`ALTER TABLE tenant_config ALTER COLUMN proposta_plano DROP NOT NULL;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_brand_name TEXT;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_brand_subtitle TEXT;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_logo_text TEXT;`);
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_custom_domain TEXT;`);
  // modelo de conteudo proprio do assinante white_label (o <main> inteiro da proposta.html,
  // reescrito por ele via Modo Editor) - fica null pra "branded" e pra quem ainda nao editou
  // nada (nesses casos a proposta.html usa o conteudo padrao do Vivekananda)
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_template_html TEXT;`);
  // periodo de acesso do assinante ao Gerador de Propostas - NULL = vitalicio (nunca expira).
  // Quando preenchido, um sweep periodico (ver bloquearAssinantesExpirados, chamado no boot do
  // server.js) desativa o tenant (tenants.ativo = false) assim que a data passa - o mesmo campo
  // que ja bloqueia login em tenants.autenticar(), reaproveitado em vez de criar outro flag.
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS proposta_acesso_expira_em TIMESTAMPTZ;`);
  // quais abas do app o cliente pode ver/usar (Painel, Agenda, WhatsApp, CRM, Auto Atendimento,
  // Relatorios, Integracoes) - NULL = todas liberadas (comportamento de sempre, nao quebra
  // cliente antigo). Array JSON com as chaves habilitadas quando o admin restringe algo,
  // ex: ["painel","agenda","crm"]. Ver TABS_VALIDAS abaixo pra lista completa de chaves.
  await pool.query(`ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS tabs_habilitadas JSONB;`);
}

// chaves == os mesmos "data-tab" usados em index.html/app.js - se um dia adicionar aba nova,
// precisa incluir a chave aqui tambem pra ela poder ser restringida
export const TABS_VALIDAS = ['painel', 'agenda', 'whatsapp', 'crm', 'auto', 'relatorios', 'geradorRelatorios', 'integracoes'];
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

// ---------- Gerador de Propostas (plano + marca de cada assinante) ----------

// plano null = esse tenant NAO e assinante do Gerador de Propostas (cliente comum da Lumia,
// ou ninguem configurou ainda) - quem chama isso pra decidir se libera acesso tem que checar
// "plano" explicitamente, nunca assumir "branded" como default
export async function obterConfigProposta(tenantId) {
  if (!pool) return { plano: null, brandName: null, brandSubtitle: null, logoText: null, customDomain: null, templateHtml: null };
  await tabelasProntas;
  const { rows } = await pool.query(
    'SELECT proposta_plano, proposta_brand_name, proposta_brand_subtitle, proposta_logo_text, proposta_custom_domain, proposta_template_html FROM tenant_config WHERE tenant_id = $1',
    [tenantId],
  );
  const r = rows[0];
  return {
    plano: r?.proposta_plano || null,
    brandName: r?.proposta_brand_name || null,
    brandSubtitle: r?.proposta_brand_subtitle || null,
    logoText: r?.proposta_logo_text || null,
    customDomain: r?.proposta_custom_domain || null,
    templateHtml: r?.proposta_template_html || null,
  };
}

// remove tags <script> e atributos "on*=" (onclick, onerror etc) e "javascript:" em
// href/src - protecao basica contra o assinante (sem querer ou de proposito) salvar algo que
// rode script no navegador de quem abrir o link da proposta. Nao e um sanitizador completo,
// mas cobre o que da pra colar/digitar num campo contentEditable comum.
function sanitizarHtmlModelo(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

const LIMITE_TEMPLATE_HTML = 300000; // ~300kb - generoso pro conteudo de uma pagina, evita abuso

export async function obterTemplateProposta(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT proposta_template_html FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return rows[0]?.proposta_template_html || null;
}

export async function salvarTemplateProposta(tenantId, html) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (typeof html !== 'string' || !html.trim()) throw new Error('conteudo do modelo vazio');
  if (html.length > LIMITE_TEMPLATE_HTML) throw new Error('conteudo do modelo grande demais');
  await tabelasProntas;
  const limpo = sanitizarHtmlModelo(html);
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, proposta_template_html, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET proposta_template_html = $2, atualizado_em = now()`,
    [tenantId, limpo],
  );
}

// self-service: SO os campos de marca, nunca o plano (isso e definido por definirPlanoProposta,
// so o super_admin chama)
export async function salvarMarcaProposta(tenantId, { brandName, brandSubtitle, logoText, customDomain }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, proposta_brand_name, proposta_brand_subtitle, proposta_logo_text, proposta_custom_domain, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       proposta_brand_name = $2, proposta_brand_subtitle = $3, proposta_logo_text = $4, proposta_custom_domain = $5, atualizado_em = now()`,
    [tenantId, brandName || null, brandSubtitle || null, logoText || null, customDomain || null],
  );
}

// admin-only (ver server.js) - define se o assinante e "branded" (usa a marca do Vivekananda) ou
// "white_label" (usa a marca propria) - corresponde ao plano que ele pagou
export async function definirPlanoProposta(tenantId, plano) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (plano !== 'branded' && plano !== 'white_label') throw new Error('plano invalido');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO tenant_config (tenant_id, proposta_plano, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET proposta_plano = $2, atualizado_em = now()`,
    [tenantId, plano],
  );
}

// pra aba admin "Propostas" (lista de assinantes do Gerador de Propostas com o plano de cada
// um) - 1 query so com JOIN, em vez de listar tenants e depois buscar o plano de cada um em
// N chamadas separadas
// so tenants que sao REALMENTE assinantes do Gerador de Propostas (proposta_plano preenchido)
// - um cliente comum da Lumia nunca aparece aqui, mesmo que tenha tenant_config por outro
// motivo (Clinicorp, Meta Ads etc)
export async function listarTenantsComPlano() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(`
    SELECT t.id, t.nome, t.username, t.ativo, t.apagar_em, tc.proposta_plano, tc.proposta_acesso_expira_em
    FROM tenants t
    JOIN tenant_config tc ON tc.tenant_id = t.id
    WHERE tc.proposta_plano IS NOT NULL
    ORDER BY t.nome
  `);
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    username: r.username,
    ativo: r.ativo,
    apagarEm: r.apagar_em,
    propostaPlano: r.proposta_plano,
    propostaAcessoExpiraEm: r.proposta_acesso_expira_em,
  }));
}

// admin define o periodo de acesso ao Gerador de Propostas - meses: 1 a 12, ou null/undefined
// pra vitalicio (nunca expira). Sempre reativa o tenant junto (renovar/definir um periodo novo
// e o jeito de desbloquear alguem que tinha expirado, sem precisar de uma acao separada).
export async function definirAcessoProposta(tenantId, meses) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;

  let expiraEm = null;
  if (meses !== null && meses !== undefined && meses !== '') {
    const n = Number(meses);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error('periodo invalido - use de 1 a 12 meses, ou vitalicio');
    expiraEm = new Date();
    expiraEm.setMonth(expiraEm.getMonth() + n);
  }

  await pool.query(
    `INSERT INTO tenant_config (tenant_id, proposta_acesso_expira_em, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET proposta_acesso_expira_em = $2, atualizado_em = now()`,
    [tenantId, expiraEm],
  );
  await definirAtivo(tenantId, true);
}

// sweep periodico (chamado no boot + de tempos em tempos pelo server.js) - bloqueia quem
// passou do periodo de acesso pago. Vitalicio (proposta_acesso_expira_em NULL) nunca cai aqui.
export async function bloquearAssinantesExpirados() {
  if (!pool) return 0;
  await tabelasProntas;
  const { rows } = await pool.query(`
    SELECT tc.tenant_id FROM tenant_config tc
    JOIN tenants t ON t.id = tc.tenant_id
    WHERE tc.proposta_acesso_expira_em IS NOT NULL
      AND tc.proposta_acesso_expira_em < now()
      AND t.ativo = true
  `);
  for (const r of rows) {
    await definirAtivo(r.tenant_id, false);
  }
  return rows.length;
}

// ---------- Quais abas/recursos cada cliente pode usar ----------

// null = tudo liberado (default histórico, ninguem fica restrito sem o admin mexer nisso)
export async function obterTabsHabilitadas(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT tabs_habilitadas FROM tenant_config WHERE tenant_id = $1', [tenantId]);
  return rows[0]?.tabs_habilitadas || null;
}

// tabs: array de chaves (ver TABS_VALIDAS) ou null/[] pra liberar tudo de novo
export async function salvarTabsHabilitadas(tenantId, tabs) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;

  let valor = null;
  if (Array.isArray(tabs) && tabs.length) {
    const invalidas = tabs.filter((t) => !TABS_VALIDAS.includes(t));
    if (invalidas.length) throw new Error(`aba(s) desconhecida(s): ${invalidas.join(', ')}`);
    valor = tabs;
  }

  await pool.query(
    `INSERT INTO tenant_config (tenant_id, tabs_habilitadas, atualizado_em) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (tenant_id) DO UPDATE SET tabs_habilitadas = $2::jsonb, atualizado_em = now()`,
    [tenantId, valor ? JSON.stringify(valor) : null],
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
