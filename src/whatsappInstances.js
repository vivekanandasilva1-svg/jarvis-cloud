// qual instancia do Evolution API (numero de WhatsApp) esta "ativa" pra Lumia usar - guardado
// no Postgres em vez de env var, pra dar pra trocar direto pela aba WhatsApp do app sem
// precisar mexer no servidor. Sem Postgres ou sem linha configurada ainda, cai pros env vars
// (EVOLUTION_INSTANCE / LUMIA_WHATSAPP_ADMIN) como valor inicial.
import { pool } from './db.js';

async function garantirTabela() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_config (
      id INT PRIMARY KEY DEFAULT 1,
      instancia_ativa TEXT,
      numero_admin TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (id = 1)
    );
  `);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela whatsapp_config:', err.message);
});

export async function obterConfig() {
  let instanciaAtiva = process.env.EVOLUTION_INSTANCE || 'Lumia';
  let numeroAdmin = process.env.LUMIA_WHATSAPP_ADMIN || null;
  if (!pool) return { instanciaAtiva, numeroAdmin };

  await tabelaPronta;
  const { rows } = await pool.query('SELECT instancia_ativa, numero_admin FROM whatsapp_config WHERE id = 1');
  if (rows.length) {
    if (rows[0].instancia_ativa) instanciaAtiva = rows[0].instancia_ativa;
    if (rows[0].numero_admin) numeroAdmin = rows[0].numero_admin;
  }
  return { instanciaAtiva, numeroAdmin };
}

async function salvar(campo, valor) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar essa configuracao.');
  await tabelaPronta;
  await pool.query(
    `INSERT INTO whatsapp_config (id, ${campo}, atualizado_em) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET ${campo} = $1, atualizado_em = now()`,
    [valor],
  );
}

export async function definirInstanciaAtiva(nome) {
  if (!nome) throw new Error('Nome da instancia obrigatorio.');
  await salvar('instancia_ativa', nome);
}

export async function definirNumeroAdmin(numero) {
  if (!numero) throw new Error('Numero obrigatorio.');
  await salvar('numero_admin', numero.replace(/\D/g, ''));
}
