// CRM estilo Kanban - espelha as conversas do WhatsApp (qualquer instancia conectada, exceto o
// numero pessoal do dono) em cards organizados por etapa do funil, isolado por tenant. Guarda
// tambem o historico de mensagens (entrada/saida) pra abrir a conversa direto no app e responder
// por aqui, sem precisar abrir o WhatsApp de verdade. Tudo em Postgres, permanente ate o dono
// apagar/mover manualmente - mesma politica de persistencia da agenda.
import { EventEmitter } from 'node:events';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

// avisa quem estiver ouvindo (endpoint SSE em server.js) sempre que uma mensagem nova entra ou
// sai de alguma conversa - e o que da o "tempo real" da aba CRM, sem precisar de polling
// agressivo. So um emissor em memoria (best-effort, nao sobrevive a reinicio do processo, mas
// nao precisa: quem reconecta busca o estado atual via /api/crm/contatos e /api/crm/mensagens).
// Todo evento carrega tenantId - o endpoint SSE filtra por isso antes de repassar pro cliente,
// senao um tenant veria em tempo real as conversas de outro.
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
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_contatos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      instancia TEXT NOT NULL,
      nome TEXT,
      etapa TEXT NOT NULL DEFAULT 'novo_lead',
      ultima_mensagem TEXT,
      ultima_mensagem_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, numero, instancia)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_mensagens (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      instancia TEXT NOT NULL,
      direcao TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'text',
      texto TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // senha extra (separada do login) pra abrir a lista de conversas ocultas - 1 linha POR
  // TENANT (nao mais singleton global). Sem senha configurada ainda = qualquer um com acesso
  // aquele tenant ve a lista normalmente, ate o dono definir uma pela propria tela de "Ocultas".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_seguranca (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      senha_ocultas TEXT
    );
  `);

  // instalacao que ja tinha essas tabelas ANTES da conversao multi-tenant (sem tenant_id, com
  // UNIQUE so em numero+instancia, crm_seguranca com "id INT PK DEFAULT 1") - os CREATE TABLE
  // acima sao no-op nesse caso. Adiciona as colunas de tenant_id ANTES de qualquer indice/query
  // que dependa delas (senao "column tenant_id does not exist" numa instalacao antiga).
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  await pool.query(`ALTER TABLE crm_seguranca ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);

  await pool.query(`CREATE INDEX IF NOT EXISTS crm_mensagens_contato_idx ON crm_mensagens (tenant_id, numero, instancia, criado_em);`);
  // guarda a midia (imagem/audio) recebida direto no Postgres em base64, baixada do Evolution
  // API no momento em que a mensagem chega (ver server.js) - assim da pra ver/ouvir na aba CRM
  // dias depois, sem depender do WhatsApp/Evolution ainda ter o arquivo disponivel. Video fica
  // de fora de proposito (arquivo bem maior, e a aba CRM so mostra o icone mesmo, sem player).
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS midia_base64 TEXT;`);
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS midia_mimetype TEXT;`);
  // coluna nova (pausar auto-atendimento so pra essa conversa) - IF NOT EXISTS pra nao quebrar
  // instalacoes que ja tinham essa tabela antes dessa funcionalidade existir
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS auto_pausado BOOLEAN NOT NULL DEFAULT false;`);
  // oculto = o dono escolheu manualmente esconder essa conversa do funil (ex: numero pessoal
  // de um fornecedor, engano, spam) - nao apaga nada, so tira da visualizacao padrao
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;`);

  await pool.query(`ALTER TABLE crm_contatos DROP CONSTRAINT IF EXISTS crm_contatos_numero_instancia_key;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_contatos_tenant_numero_instancia_idx ON crm_contatos (tenant_id, numero, instancia);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_seguranca_tenant_idx ON crm_seguranca (tenant_id);`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do CRM:', err.message);
});

// registra uma mensagem (entrada = contato mandou, saida = a gente/Lumia mandou) e garante que
// o contato tem um card - se for a primeira vez que esse numero fala nessa instancia, cria como
// "novo_lead"; se o card ja existia como novo_lead e agora estamos respondendo (saida), passa
// pra "em_atendimento" sozinho (o dono ainda pode mover manualmente pra qualquer etapa depois)
export async function registrarMensagem(tenantId, { numero, instancia, direcao, tipo = 'text', texto = '', nome, midiaBase64, midiaMimetype }) {
  if (!pool) return;
  await tabelasProntas;

  const preview = (texto || '').slice(0, 200) || (tipo !== 'text' ? `[${tipo}]` : '');

  const { rows } = await pool.query(
    `INSERT INTO crm_contatos (tenant_id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em)
     VALUES ($1, $2, $3, $4, 'novo_lead', $5, now())
     ON CONFLICT (tenant_id, numero, instancia) DO UPDATE SET
       nome = COALESCE(EXCLUDED.nome, crm_contatos.nome),
       ultima_mensagem = $5,
       ultima_mensagem_em = now(),
       etapa = CASE WHEN crm_contatos.etapa = 'novo_lead' AND $6 = 'saida' THEN 'em_atendimento' ELSE crm_contatos.etapa END
     RETURNING id`,
    [tenantId, numero, instancia, nome || null, preview, direcao],
  );

  const { rows: msgRows } = await pool.query(
    `INSERT INTO crm_mensagens (tenant_id, numero, instancia, direcao, tipo, texto, midia_base64, midia_mimetype)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, direcao, tipo, texto, criado_em, (midia_base64 IS NOT NULL) AS tem_midia`,
    [tenantId, numero, instancia, direcao, tipo, texto || '', midiaBase64 || null, midiaMimetype || null],
  );

  eventosCrm.emit('mensagem', { tenantId, contatoId: rows[0]?.id, numero, instancia, mensagem: msgRows[0] });

  return rows[0]?.id;
}

// chamado pelo auto-atendimento quando um agendamento e criado com sucesso (Clinicorp e/ou
// agenda interna) - pula o card direto pra "agendado", de qualquer etapa que estivesse antes
export async function marcarAgendado(tenantId, numero, instancia) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `UPDATE crm_contatos SET etapa = 'agendado' WHERE tenant_id = $1 AND numero = $2 AND instancia = $3`,
    [tenantId, numero, instancia],
  );
}

// so os NAO ocultos - o padrao do board (ver listarContatosOcultos pra tela de gerenciar)
export async function listarContatos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = false ORDER BY ultima_mensagem_em DESC NULLS LAST`,
    [tenantId],
  );
  return rows;
}

export async function listarContatosOcultos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = true ORDER BY ultima_mensagem_em DESC NULLS LAST`,
    [tenantId],
  );
  return rows;
}

// ---------- senha extra pra ver a lista de conversas ocultas (por tenant) ----------

export async function obterSenhaOcultas(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT senha_ocultas FROM crm_seguranca WHERE tenant_id = $1`, [tenantId]);
  return rows[0]?.senha_ocultas || null;
}

// null/vazio = remove a protecao (volta a abrir direto, sem pedir senha)
export async function definirSenhaOcultas(tenantId, senha) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO crm_seguranca (tenant_id, senha_ocultas) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET senha_ocultas = $2`,
    [tenantId, senha || null],
  );
}

export async function verificarSenhaOcultas(tenantId, senha) {
  const atual = await obterSenhaOcultas(tenantId);
  if (!atual) return true; // ninguem configurou senha ainda
  return senha === atual;
}

// esconde/reexibe uma conversa do funil manualmente (pedido explicito do usuario: "conversas
// trancadas" que ele quer marcar pra nao aparecer) - nao apaga nada, so tira da visualizacao
// padrao do board; listarContatosOcultos() deixa gerenciar/desfazer depois
export async function alternarOcultar(tenantId, id, oculto) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET oculto = $1 WHERE id = $2 AND tenant_id = $3`, [!!oculto, id, tenantId]);
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

// liga/desliga o auto-atendimento so pra essa conversa especifica - nao mexe na config global
// (auto_atendimento_config.ativo), so cria uma excecao pontual pra esse numero
export async function alternarAutoAtendimento(tenantId, id, pausado) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET auto_pausado = $1 WHERE id = $2 AND tenant_id = $3`, [!!pausado, id, tenantId]);
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

// consultado pelo auto-atendimento (autoAtendimento.js/server.js) antes de gerar qualquer
// resposta automatica - contato/instancia sem card ainda (primeira mensagem) nunca esta pausado
export async function estaPausado(tenantId, numero, instancia) {
  if (!pool) return false;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT auto_pausado FROM crm_contatos WHERE tenant_id = $1 AND numero = $2 AND instancia = $3`,
    [tenantId, numero, instancia],
  );
  return rows[0]?.auto_pausado || false;
}

// apaga a conversa inteira (card + historico de mensagens do CRM) - irreversivel, usado pelo
// botao "Apagar conversa" do app. Nao mexe na sessao/historico do auto-atendimento
// (auto_atendimento_sessions em autoAtendimento.js) de proposito: apagar do CRM e so limpeza
// visual do funil, nao deve resetar a memoria da conversa com o contato caso ele volte a falar.
export async function apagarContato(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT numero, instancia FROM crm_contatos WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!rows.length) return;
  const { numero, instancia } = rows[0];
  await pool.query(`DELETE FROM crm_mensagens WHERE tenant_id = $1 AND numero = $2 AND instancia = $3`, [tenantId, numero, instancia]);
  await pool.query(`DELETE FROM crm_contatos WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id, apagado: true });
}

export async function listarMensagens(tenantId, numero, instancia) {
  if (!pool) return [];
  await tabelasProntas;
  // nao traz midia_base64 aqui (a lista de mensagens ficaria pesada com todo audio/imagem
  // embutido) - so avisa que existe midia (tem_midia), e o frontend busca o conteudo de fato
  // sob demanda via /api/crm/midia/:id (ver obterMidiaMensagem), igual um <img>/<audio> normal
  const { rows } = await pool.query(
    `SELECT id, direcao, tipo, texto, criado_em, (midia_base64 IS NOT NULL) AS tem_midia FROM crm_mensagens
     WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 ORDER BY criado_em ASC`,
    [tenantId, numero, instancia],
  );
  return rows;
}

// conteudo de fato (base64) de uma midia guardada - usado pela rota que serve pro <img>/<audio>.
// Confere tenant_id junto do id, senao um tenant poderia adivinhar o id numerico de uma
// mensagem de outro tenant e baixar a midia dela.
export async function obterMidiaMensagem(tenantId, mensagemId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT midia_base64, midia_mimetype FROM crm_mensagens WHERE id = $1 AND tenant_id = $2`,
    [mensagemId, tenantId],
  );
  const row = rows[0];
  if (!row?.midia_base64) return null;
  return { base64: row.midia_base64, mimetype: row.midia_mimetype || 'application/octet-stream' };
}

export async function moverEtapa(tenantId, id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error(`Etapa invalida: "${etapa}"`);
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE crm_contatos SET etapa = $1 WHERE id = $2 AND tenant_id = $3`, [etapa, id, tenantId]);
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

// manda uma mensagem de texto pro contato direto pelo CRM (usa a mesma instancia que o card
// pertence) e registra como saida - assim a conversa aberta no app fica igual a conversa real
export async function enviarMensagem(tenantId, numero, instancia, texto) {
  await evolutionApi.enviarMensagemTextoPor(instancia, numero, texto);
  await registrarMensagem(tenantId, { numero, instancia, direcao: 'saida', tipo: 'text', texto });
}
