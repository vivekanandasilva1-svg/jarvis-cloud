// identidade de tenant (cliente pagante da Lumia como SaaS) - cada tenant tem seu proprio
// usuario/senha, isolado dos dados dos outros tenants em todas as tabelas do sistema. Fase 1
// da conversao multi-tenant (ver plano salvo em .claude/plans na epoca dessa mudanca).
import crypto from 'node:crypto';
import { pool } from './db.js';
import { encrypt, decrypt } from './crypto.js';

const SCRYPT_KEYLEN = 64;

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // super_admin = enxerga a aba "Clientes" (criar/gerenciar outros tenants) - so o dono da
  // Lumia (tenant 1) tem isso; nenhum cliente que comprar o produto deve ver essa aba
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS super_admin BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`UPDATE tenants SET super_admin = true WHERE id = 1 AND super_admin = false;`);
  // periodo de contratacao do cliente (acesso geral a Lumia) - NULL = vitalicio. Mesmo modelo
  // do proposta_acesso_expira_em do Gerador de Propostas, so que pro produto principal.
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS acesso_expira_em TIMESTAMPTZ;`);
  // exclusao suave - "apagar" na UI so MARCA o tenant (desativa + agenda a exclusao real pra
  // daqui DIAS_ANTES_DE_APAGAR_DE_VERDADE dias), nunca apaga dado nenhum na hora. So o sweep
  // purgarTenantsMarcados() (chamado 1x por dia no boot do server.js) apaga de verdade, e so
  // depois que essa data passar - da tempo de perceber e restaurar (ver restaurarTenant) um
  // clique errado ou um teste feito sem querer contra producao antes da perda virar definitiva.
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS apagar_em TIMESTAMPTZ;`);
  // copia CIFRADA (reversivel, diferente do password_hash que e um hash de verdade e nunca
  // volta a virar texto) da senha, pra o super_admin poder consultar depois - pedido explicito
  // do usuario. So existe pra senha criada/redefinida a PARTIR de agora (criarTenant/
  // redefinirSenha abaixo); conta antiga nunca teve a senha original guardada em lugar nenhum,
  // entao nao tem como "aparecer" retroativamente - so redefinindo de novo.
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS senha_visivel_enc BYTEA;`);
  // qual tenant e dono de cada instancia do Evolution API - usado pra rotear mensagem
  // recebida no webhook (que so identifica a instancia, nao tem conceito de tenant) pro
  // tenant certo. 1 instancia so pode pertencer a 1 tenant.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_instance_tenant (
      instancia TEXT PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id)
    );
  `);
}
// exportado pra outros modulos poderem esperar a tabela "tenants" existir antes de criar as
// PROPRIAS tabelas (que tem REFERENCES tenants(id)) - sem isso, como cada modulo cria sua
// tabela de forma assincrona e independente no momento do import, um modulo importado ANTES
// de tenants.js (ou so mais rapido no race) podia tentar criar sua tabela com a FK apontando
// pra "tenants" antes dela existir de verdade, e quebrar com "relation tenants does not exist"
export const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabela de tenants:', err.message);
});

// ---------- senha (scrypt - sem dependencia nova, node:crypto ja tem tudo) ----------

function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const derivado = crypto.scryptSync(senha, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${derivado.toString('hex')}`;
}

function senhaConfere(senha, hash) {
  const [saltHex, derivadoHex] = (hash || '').split(':');
  if (!saltHex || !derivadoHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const esperado = Buffer.from(derivadoHex, 'hex');
  const calculado = crypto.scryptSync(senha, salt, SCRYPT_KEYLEN);
  // tamanho tem que bater antes do timingSafeEqual, senao ele lanca excecao em vez de false
  if (calculado.length !== esperado.length) return false;
  return crypto.timingSafeEqual(calculado, esperado);
}

// ---------- token de sessao (HMAC assinado - mesmo estilo ja usado na verificacao da
// assinatura do webhook do WhatsApp, sem precisar de jsonwebtoken como dependencia nova) ----------

const TOKEN_VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function segredoSessao() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET nao configurado');
  return s;
}

export function firmarToken(tenantId) {
  const payload = JSON.stringify({ tenantId, exp: Date.now() + TOKEN_VALIDADE_MS });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const assinatura = crypto.createHmac('sha256', segredoSessao()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${assinatura}`;
}

// devolve o tenantId se o token for valido e nao tiver expirado, ou null
export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, assinatura] = token.split('.');
  const esperada = crypto.createHmac('sha256', segredoSessao()).update(payloadB64).digest('base64url');
  const bufAssinatura = Buffer.from(assinatura || '');
  const bufEsperada = Buffer.from(esperada);
  if (bufAssinatura.length !== bufEsperada.length || !crypto.timingSafeEqual(bufAssinatura, bufEsperada)) return null;
  try {
    const { tenantId, exp } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!tenantId || !exp || Date.now() > exp) return null;
    return tenantId;
  } catch {
    return null;
  }
}

// ---------- CRUD de tenant ----------

export async function autenticar(username, senha) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, password_hash, ativo FROM tenants WHERE username = $1', [username]);
  const tenant = rows[0];
  if (!tenant || !tenant.ativo) return null;
  if (!senhaConfere(senha, tenant.password_hash)) return null;
  return tenant.id;
}

export async function obterPorId(id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, slug, nome, username, ativo, super_admin FROM tenants WHERE id = $1', [id]);
  return rows[0] || null;
}

// painel "Clientes" (aba nova, so super_admin ve) - lista todo mundo, do jeito mais simples
// exclui quem e assinante do Gerador de Propostas (tenant_config.proposta_plano preenchido) -
// esses aparecem so na aba "Gerador de Propostas" (ver tenantConfig.listarTenantsComPlano), a
// aba "Clientes" e so pros clientes de verdade da Lumia, sem nenhuma mistura entre os dois.
// Referencia a tabela tenant_config direto por nome (sem importar o modulo, pra nao criar
// import circular - tenantConfig.js ja importa daqui) - ela sempre existe nesse ponto, ja que
// isso so roda depois do boot completo da aplicacao.
export async function listarTenants() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(`
    SELECT t.id, t.slug, t.nome, t.username, t.ativo, t.acesso_expira_em, t.apagar_em, t.criado_em
    FROM tenants t
    LEFT JOIN tenant_config tc ON tc.tenant_id = t.id
    WHERE tc.proposta_plano IS NULL
    ORDER BY t.criado_em ASC
  `);
  return rows;
}

function gerarSlug(nome) {
  return (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acento
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cliente-${Date.now()}`;
}

export async function criarTenant({ slug, nome, username, senha }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (!nome || !username || !senha) throw new Error('nome, username e senha sao obrigatorios');
  await tabelasProntas;
  // slug precisa ser unico (mesmo pra um tenant marcado pra exclusao mas ainda nao apagado de
  // verdade - ele continua ocupando o slug ate os 30 dias passarem ou ser apagado
  // definitivamente). Sem isso, criar um cliente novo com o MESMO nome de um que ja foi
  // "apagado" (marcado) dava um erro cru de constraint do Postgres direto na tela - agora so
  // acrescenta um sufixo numerico ate achar um slug livre.
  const base = slug || gerarSlug(nome);
  let slugFinal = base;
  let tentativa = 2;
  while (true) {
    const { rows: existentes } = await pool.query('SELECT 1 FROM tenants WHERE slug = $1', [slugFinal]);
    if (!existentes.length) break;
    slugFinal = `${base}-${tentativa}`;
    tentativa += 1;
  }
  const { rows } = await pool.query(
    'INSERT INTO tenants (slug, nome, username, password_hash, senha_visivel_enc) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [slugFinal, nome, username, hashSenha(senha), encrypt(senha)],
  );
  return rows[0].id;
}

export async function definirAtivo(tenantId, ativo) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query('UPDATE tenants SET ativo = $1 WHERE id = $2', [!!ativo, tenantId]);
}

// periodo de contratacao (acesso geral a Lumia) - mesmo modelo do Gerador de Propostas
// (ver tenantConfig.definirAcessoProposta): NULL = vitalicio, senao expira em N meses e um
// sweep (bloquearClientesExpirados abaixo) desativa sozinho quando passa da data
export async function definirAcessoCliente(tenantId, meses) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;

  let expiraEm = null;
  if (meses !== null && meses !== undefined && meses !== '') {
    const n = Number(meses);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error('periodo invalido - use de 1 a 12 meses, ou vitalicio');
    expiraEm = new Date();
    expiraEm.setMonth(expiraEm.getMonth() + n);
  }

  await pool.query('UPDATE tenants SET acesso_expira_em = $1 WHERE id = $2', [expiraEm, tenantId]);
  await definirAtivo(tenantId, true);
}

// sweep periodico (chamado pelo server.js) - bloqueia cliente cujo periodo contratado venceu.
// Vitalicio (acesso_expira_em NULL) nunca cai aqui.
export async function bloquearClientesExpirados() {
  if (!pool) return 0;
  await tabelasProntas;
  const { rows } = await pool.query(`
    SELECT id FROM tenants WHERE acesso_expira_em IS NOT NULL AND acesso_expira_em < now() AND ativo = true
  `);
  for (const r of rows) {
    await definirAtivo(r.id, false);
  }
  return rows.length;
}

// quantos dias de "carencia" entre marcar um tenant pra exclusao e ele ser apagado de
// verdade - da tempo real de perceber um clique errado (ou um teste feito sem querer contra
// producao) e restaurar antes da perda virar definitiva. Existe por causa de um incidente real:
// 14 tenants foram apagados de vez sem ninguem perceber a tempo, sem nenhum jeito de recuperar
// porque a exclusao era imediata e nao existia backup do banco.
const DIAS_ANTES_DE_APAGAR_DE_VERDADE = 30;

// "apagar" na UI so MARCA o tenant - desativa login na hora e agenda a exclusao de verdade pra
// daqui DIAS_ANTES_DE_APAGAR_DE_VERDADE dias (ver purgarTenantsMarcados). NENHUM dado e
// removido aqui. Reversivel via restaurarTenant ate a data marcada passar.
export async function marcarParaExclusao(tenantId) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;

  const tenant = await obterPorId(tenantId);
  if (!tenant) throw new Error('tenant nao encontrado');
  if (tenant.super_admin) throw new Error('nao e possivel apagar um super_admin');

  const apagarEm = new Date(Date.now() + DIAS_ANTES_DE_APAGAR_DE_VERDADE * 24 * 60 * 60 * 1000);
  await pool.query('UPDATE tenants SET apagar_em = $1, ativo = false WHERE id = $2', [apagarEm, tenantId]);
  return apagarEm;
}

// desfaz uma marcacao pra exclusao (ou simplesmente reativa um tenant desativado por outro
// motivo) - limpa apagar_em e reativa o login
export async function restaurarTenant(tenantId) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query('UPDATE tenants SET apagar_em = NULL, ativo = true WHERE id = $1', [tenantId]);
}

// apaga um tenant e TODOS os dados dele em qualquer tabela que referencie tenants(id) - usa o
// catalogo do proprio Postgres (em vez de uma lista fixa de tabelas aqui) pra nunca ficar
// desatualizado conforme novas tabelas com tenant_id forem criadas. Roda numa transacao: ou
// apaga tudo, ou nada (se uma tabela falhar no meio, reverte). NAO da pra desfazer.
// Exportada (chamada tanto pelo sweep purgarTenantsMarcados() abaixo quanto direto pela rota
// "Apagar definitivamente" da UI, pedido explicito do usuario pra nao precisar esperar os 30
// dias quando ele ja tem certeza) - a friccao contra clique errado fica no FRONTEND (exige
// digitar o nome do tenant pra confirmar), nao aqui.
export async function apagarTenantDeVerdade(tenantId) {
  const tenant = await obterPorId(tenantId);
  if (!tenant) return;
  if (tenant.super_admin) throw new Error('nao e possivel apagar um super_admin');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: referencias } = await client.query(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'tenants' AND ccu.column_name = 'id'
        AND tc.table_name <> 'tenants'
    `);

    for (const { table_name: tabela, column_name: coluna } of referencias) {
      await client.query(`DELETE FROM "${tabela}" WHERE "${coluna}" = $1`, [tenantId]);
    }

    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// sweep periodico (chamado 1x por dia no boot do server.js, junto dos outros sweeps) - apaga de
// verdade quem foi marcado ha mais de DIAS_ANTES_DE_APAGAR_DE_VERDADE dias e nunca foi
// restaurado. So aqui a exclusao definitiva acontece de verdade.
export async function purgarTenantsMarcados() {
  if (!pool) return 0;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE apagar_em IS NOT NULL AND apagar_em < now()`);
  for (const r of rows) {
    try {
      await apagarTenantDeVerdade(r.id);
    } catch (err) {
      console.error(`Erro apagando tenant ${r.id} marcado pra exclusao:`, err.message);
    }
  }
  return rows.length;
}

export async function redefinirSenha(tenantId, novaSenha) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (!novaSenha) throw new Error('Nova senha obrigatoria.');
  await tabelasProntas;
  await pool.query(
    'UPDATE tenants SET password_hash = $1, senha_visivel_enc = $2 WHERE id = $3',
    [hashSenha(novaSenha), encrypt(novaSenha), tenantId],
  );
}

// devolve a senha em texto legivel pro super_admin consultar - so funciona pra senha
// criada/redefinida DEPOIS que essa funcionalidade foi adicionada (ver senha_visivel_enc
// acima); conta antiga (so tem o hash de sempre, que e irreversivel por design) devolve null.
export async function obterSenhaVisivel(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT senha_visivel_enc FROM tenants WHERE id = $1', [tenantId]);
  const bruto = rows[0]?.senha_visivel_enc;
  if (!bruto) return null;
  return decrypt(bruto);
}

export { hashSenha };

// ---------- roteamento de WhatsApp (Evolution API) por instancia -> tenant ----------

export async function resolverTenantPorInstancia(instancia) {
  if (!pool || !instancia) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT tenant_id FROM whatsapp_instance_tenant WHERE instancia = $1', [instancia]);
  return rows[0]?.tenant_id || null;
}

// usado pelo painel de provisionamento manual (fase 3) e pelo script de migracao do tenant 1
export async function mapearInstanciaParaTenant(instancia, tenantId) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO whatsapp_instance_tenant (instancia, tenant_id) VALUES ($1, $2)
     ON CONFLICT (instancia) DO UPDATE SET tenant_id = $2`,
    [instancia, tenantId],
  );
}

export async function listarInstanciasDoTenant(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT instancia FROM whatsapp_instance_tenant WHERE tenant_id = $1', [tenantId]);
  return rows.map((r) => r.instancia);
}
