// CRM estilo Kanban - espelha as conversas do WhatsApp (qualquer instancia conectada, exceto o
// numero pessoal do dono) em cards organizados por etapa do funil. Guarda tambem o historico de
// mensagens (entrada/saida) pra abrir a conversa direto no app e responder por aqui, sem precisar
// abrir o WhatsApp de verdade. Tudo em Postgres, permanente ate o dono apagar/mover manualmente -
// mesma politica de persistencia da agenda.
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';

export const ETAPAS = [
  { id: 'novo_lead', nome: 'Novo Lead' },
  { id: 'em_atendimento', nome: 'Em Atendimento' },
  { id: 'agendado', nome: 'Agendado' },
  { id: 'compareceu', nome: 'Compareceu' },
  { id: 'perdido', nome: 'Perdido / Não respondeu' },
];
const IDS_ETAPAS = new Set(ETAPAS.map((e) => e.id));

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_contatos (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL,
      instancia TEXT NOT NULL,
      nome TEXT,
      etapa TEXT NOT NULL DEFAULT 'novo_lead',
      ultima_mensagem TEXT,
      ultima_mensagem_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (numero, instancia)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_mensagens (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL,
      instancia TEXT NOT NULL,
      direcao TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'text',
      texto TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS crm_mensagens_contato_idx ON crm_mensagens (numero, instancia, criado_em);`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do CRM:', err.message);
});

// registra uma mensagem (entrada = contato mandou, saida = a gente/Lumia mandou) e garante que
// o contato tem um card - se for a primeira vez que esse numero fala nessa instancia, cria como
// "novo_lead"; se o card ja existia como novo_lead e agora estamos respondendo (saida), passa
// pra "em_atendimento" sozinho (o dono ainda pode mover manualmente pra qualquer etapa depois)
export async function registrarMensagem({ numero, instancia, direcao, tipo = 'text', texto = '', nome }) {
  if (!pool) return;
  await tabelasProntas;

  const preview = (texto || '').slice(0, 200) || (tipo !== 'text' ? `[${tipo}]` : '');

  const { rows } = await pool.query(
    `INSERT INTO crm_contatos (numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em)
     VALUES ($1, $2, $3, 'novo_lead', $4, now())
     ON CONFLICT (numero, instancia) DO UPDATE SET
       nome = COALESCE(EXCLUDED.nome, crm_contatos.nome),
       ultima_mensagem = $4,
       ultima_mensagem_em = now(),
       etapa = CASE WHEN crm_contatos.etapa = 'novo_lead' AND $5 = 'saida' THEN 'em_atendimento' ELSE crm_contatos.etapa END
     RETURNING id`,
    [numero, instancia, nome || null, preview, direcao],
  );

  await pool.query(
    `INSERT INTO crm_mensagens (numero, instancia, direcao, tipo, texto) VALUES ($1, $2, $3, $4, $5)`,
    [numero, instancia, direcao, tipo, texto || ''],
  );

  return rows[0]?.id;
}

// chamado pelo auto-atendimento quando um agendamento e criado com sucesso (Clinicorp e/ou
// agenda interna) - pula o card direto pra "agendado", de qualquer etapa que estivesse antes
export async function marcarAgendado(numero, instancia) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `UPDATE crm_contatos SET etapa = 'agendado' WHERE numero = $1 AND instancia = $2`,
    [numero, instancia],
  );
}

export async function listarContatos() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em
     FROM crm_contatos ORDER BY ultima_mensagem_em DESC NULLS LAST`,
  );
  return rows;
}

export async function listarMensagens(numero, instancia) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, direcao, tipo, texto, criado_em FROM crm_mensagens
     WHERE numero = $1 AND instancia = $2 ORDER BY criado_em ASC`,
    [numero, instancia],
  );
  return rows;
}

export async function moverEtapa(id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error(`Etapa invalida: "${etapa}"`);
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET etapa = $1 WHERE id = $2`, [etapa, id]);
}

// manda uma mensagem de texto pro contato direto pelo CRM (usa a mesma instancia que o card
// pertence) e registra como saida - assim a conversa aberta no app fica igual a conversa real
export async function enviarMensagem(numero, instancia, texto) {
  await evolutionApi.enviarMensagemTextoPor(instancia, numero, texto);
  await registrarMensagem({ numero, instancia, direcao: 'saida', tipo: 'text', texto });
}
