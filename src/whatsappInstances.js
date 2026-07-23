// qual instancia do Evolution API (numero de WhatsApp) esta "ativa" pra cada tenant usar -
// guardado no Postgres, 1 linha por tenant, pra dar pra trocar direto pela aba WhatsApp do app
// sem precisar mexer no servidor.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabela() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      instancia_ativa TEXT,
      numero_admin TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // instalacao que ja tinha essa tabela ANTES da conversao multi-tenant (schema antigo:
  // "id INT PK DEFAULT 1", sem tenant_id) - o CREATE TABLE acima e um no-op nesse caso (a
  // tabela ja existe), entao adiciona a coluna nova por fora. Fica nullable de proposito ate
  // o backfill (scripts/migrate-to-tenant-1.js) preencher tenant_id nas linhas existentes.
  await pool.query(`ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  // exigido pelo ON CONFLICT (tenant_id) usado em salvar() abaixo
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_config_tenant_idx ON whatsapp_config (tenant_id);`);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela whatsapp_config:', err.message);
});

export async function obterConfig(tenantId) {
  if (!pool) return { instanciaAtiva: null, numeroAdmin: null };
  await tabelaPronta;
  const { rows } = await pool.query('SELECT instancia_ativa, numero_admin FROM whatsapp_config WHERE tenant_id = $1', [tenantId]);
  return {
    instanciaAtiva: rows[0]?.instancia_ativa || null,
    numeroAdmin: rows[0]?.numero_admin || null,
  };
}

async function salvar(tenantId, campo, valor) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar essa configuracao.');
  await tabelaPronta;
  await pool.query(
    `INSERT INTO whatsapp_config (tenant_id, ${campo}, atualizado_em) VALUES ($1, $2, now())
     ON CONFLICT (tenant_id) DO UPDATE SET ${campo} = $2, atualizado_em = now()`,
    [tenantId, valor],
  );
}

export async function definirInstanciaAtiva(tenantId, nome) {
  if (!nome) throw new Error('Nome da instancia obrigatorio.');
  await salvar(tenantId, 'instancia_ativa', nome);
}

export async function definirNumeroAdmin(tenantId, numero) {
  if (!numero) throw new Error('Numero obrigatorio.');
  await salvar(tenantId, 'numero_admin', numero.replace(/\D/g, ''));
}
