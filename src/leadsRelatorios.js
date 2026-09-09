// Captura de leads da pagina publica de vendas do "Relatorio Automatico de Anuncios"
// (public/relatorio-automatico.html) - produto avulso, vendido pra qualquer negocio que
// anuncia no Meta Ads (nao so clinicas), fechado manualmente por Vivekananda via WhatsApp/Pix
// (sem cobranca automatica ainda). Sem tenant_id de proposito: e um lead, ainda nao e cliente.
import { pool } from './db.js';

async function garantirTabela() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads_relatorios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      empresa TEXT,
      whatsapp TEXT NOT NULL,
      email TEXT,
      interesses TEXT,
      mensagem TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
export const tabelasProntas = garantirTabela().catch((err) => {
  console.error('Erro criando tabela leads_relatorios:', err.message);
});

const LIMITES = { nome: 150, empresa: 150, whatsapp: 30, email: 150, interesses: 200, mensagem: 1000 };

function cortar(valor, max) {
  return typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, max) : null;
}

export async function criar(dados) {
  if (!pool) throw new Error('banco de dados nao configurado');
  await tabelasProntas;

  const nome = cortar(dados.nome, LIMITES.nome);
  const whatsapp = cortar(dados.whatsapp, LIMITES.whatsapp);
  if (!nome || !whatsapp) throw new Error('nome e whatsapp sao obrigatorios');

  const interesses = Array.isArray(dados.interesses) ? dados.interesses.join(', ') : cortar(dados.interesses, LIMITES.interesses);

  const { rows } = await pool.query(
    `INSERT INTO leads_relatorios (nome, empresa, whatsapp, email, interesses, mensagem)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [nome, cortar(dados.empresa, LIMITES.empresa), whatsapp, cortar(dados.email, LIMITES.email), interesses, cortar(dados.mensagem, LIMITES.mensagem)]
  );
  return rows[0].id;
}

export async function listar() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT * FROM leads_relatorios ORDER BY criado_em DESC LIMIT 500`);
  return rows;
}
