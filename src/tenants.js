// identidade de tenant (cliente pagante da Lumia como SaaS) - cada tenant tem seu proprio
// usuario/senha, isolado dos dados dos outros tenants em todas as tabelas do sistema. Fase 1
// da conversao multi-tenant (ver plano salvo em .claude/plans na epoca dessa mudanca).
import crypto from 'node:crypto';
import { pool } from './db.js';

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
  const { rows } = await pool.query('SELECT id, slug, nome, username, ativo FROM tenants WHERE id = $1', [id]);
  return rows[0] || null;
}

// usado pelo painel de provisionamento manual (fase 3) - por enquanto so exportado pra uso
// via script/console, sem rota HTTP ainda
export async function criarTenant({ slug, nome, username, senha }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (!slug || !nome || !username || !senha) throw new Error('slug, nome, username e senha sao obrigatorios');
  await tabelasProntas;
  const { rows } = await pool.query(
    'INSERT INTO tenants (slug, nome, username, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [slug, nome, username, hashSenha(senha)],
  );
  return rows[0].id;
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
