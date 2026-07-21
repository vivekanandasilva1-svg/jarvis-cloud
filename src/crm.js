// CRM estilo Kanban - espelha as conversas do WhatsApp (qualquer instancia conectada, exceto o
// numero pessoal do dono) em cards organizados por etapa do funil. Guarda tambem o historico de
// mensagens (entrada/saida) pra abrir a conversa direto no app e responder por aqui, sem precisar
// abrir o WhatsApp de verdade. Tudo em Postgres, permanente ate o dono apagar/mover manualmente -
// mesma politica de persistencia da agenda.
import { EventEmitter } from 'node:events';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';

// avisa quem estiver ouvindo (endpoint SSE em server.js) sempre que uma mensagem nova entra ou
// sai de alguma conversa - e o que da o "tempo real" da aba CRM, sem precisar de polling
// agressivo. So um emissor em memoria (best-effort, nao sobrevive a reinicio do processo, mas
// nao precisa: quem reconecta busca o estado atual via /api/crm/contatos e /api/crm/mensagens).
export const eventosCrm = new EventEmitter();
eventosCrm.setMaxListeners(50); // cada aba do painel aberta conta como 1 listener

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
  // coluna nova (pausar auto-atendimento so pra essa conversa) - IF NOT EXISTS pra nao quebrar
  // instalacoes que ja tinham essa tabela antes dessa funcionalidade existir
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS auto_pausado BOOLEAN NOT NULL DEFAULT false;`);
  // oculto = o dono escolheu manualmente esconder essa conversa do funil (ex: numero pessoal
  // de um fornecedor, engano, spam) - nao apaga nada, so tira da visualizacao padrao
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;`);
  // senha extra (separada da senha geral do app) pra abrir a lista de conversas ocultas -
  // linha unica (id sempre 1). Sem senha configurada ainda = qualquer um com acesso ao app
  // ve a lista normalmente, ate o dono definir uma pela propria tela de "Ocultas".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_seguranca (
      id INTEGER PRIMARY KEY DEFAULT 1,
      senha_ocultas TEXT,
      CHECK (id = 1)
    );
  `);
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

  const { rows: msgRows } = await pool.query(
    `INSERT INTO crm_mensagens (numero, instancia, direcao, tipo, texto) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, direcao, tipo, texto, criado_em`,
    [numero, instancia, direcao, tipo, texto || ''],
  );

  eventosCrm.emit('mensagem', { contatoId: rows[0]?.id, numero, instancia, mensagem: msgRows[0] });

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

// so os NAO ocultos - o padrao do board (ver listarContatosOcultos pra tela de gerenciar)
export async function listarContatos() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado
     FROM crm_contatos WHERE oculto = false ORDER BY ultima_mensagem_em DESC NULLS LAST`,
  );
  return rows;
}

export async function listarContatosOcultos() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado
     FROM crm_contatos WHERE oculto = true ORDER BY ultima_mensagem_em DESC NULLS LAST`,
  );
  return rows;
}

// ---------- senha extra pra ver a lista de conversas ocultas ----------

export async function obterSenhaOcultas() {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT senha_ocultas FROM crm_seguranca WHERE id = 1`);
  return rows[0]?.senha_ocultas || null;
}

// null/vazio = remove a protecao (volta a abrir direto, sem pedir senha)
export async function definirSenhaOcultas(senha) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO crm_seguranca (id, senha_ocultas) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET senha_ocultas = $1`,
    [senha || null],
  );
}

export async function verificarSenhaOcultas(senha) {
  const atual = await obterSenhaOcultas();
  if (!atual) return true; // ninguem configurou senha ainda
  return senha === atual;
}

// esconde/reexibe uma conversa do funil manualmente (pedido explicito do usuario: "conversas
// trancadas" que ele quer marcar pra nao aparecer) - nao apaga nada, so tira da visualizacao
// padrao do board; listarContatosOcultos() deixa gerenciar/desfazer depois
export async function alternarOcultar(id, oculto) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET oculto = $1 WHERE id = $2`, [!!oculto, id]);
  eventosCrm.emit('contato-atualizado', { contatoId: id });
}

// liga/desliga o auto-atendimento so pra essa conversa especifica - nao mexe na config global
// (auto_atendimento_config.ativo), so cria uma excecao pontual pra esse numero
export async function alternarAutoAtendimento(id, pausado) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET auto_pausado = $1 WHERE id = $2`, [!!pausado, id]);
  eventosCrm.emit('contato-atualizado', { contatoId: id });
}

// consultado pelo auto-atendimento (autoAtendimento.js/server.js) antes de gerar qualquer
// resposta automatica - contato/instancia sem card ainda (primeira mensagem) nunca esta pausado
export async function estaPausado(numero, instancia) {
  if (!pool) return false;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT auto_pausado FROM crm_contatos WHERE numero = $1 AND instancia = $2`,
    [numero, instancia],
  );
  return rows[0]?.auto_pausado || false;
}

// apaga a conversa inteira (card + historico de mensagens do CRM) - irreversivel, usado pelo
// botao "Apagar conversa" do app. Nao mexe na sessao/historico do auto-atendimento
// (auto_atendimento_sessions em autoAtendimento.js) de proposito: apagar do CRM e so limpeza
// visual do funil, nao deve resetar a memoria da conversa com o contato caso ele volte a falar.
export async function apagarContato(id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT numero, instancia FROM crm_contatos WHERE id = $1`, [id]);
  if (!rows.length) return;
  const { numero, instancia } = rows[0];
  await pool.query(`DELETE FROM crm_mensagens WHERE numero = $1 AND instancia = $2`, [numero, instancia]);
  await pool.query(`DELETE FROM crm_contatos WHERE id = $1`, [id]);
  eventosCrm.emit('contato-atualizado', { contatoId: id, apagado: true });
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
  eventosCrm.emit('contato-atualizado', { contatoId: id });
}

// manda uma mensagem de texto pro contato direto pelo CRM (usa a mesma instancia que o card
// pertence) e registra como saida - assim a conversa aberta no app fica igual a conversa real
export async function enviarMensagem(numero, instancia, texto) {
  await evolutionApi.enviarMensagemTextoPor(instancia, numero, texto);
  await registrarMensagem({ numero, instancia, direcao: 'saida', tipo: 'text', texto });
}
