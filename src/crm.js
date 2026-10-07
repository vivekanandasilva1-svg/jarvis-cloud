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
  { id: 'em_negociacao', nome: 'Em negociação' },
  { id: 'pre_agendado', nome: 'Pré-agendamento' },
  { id: 'agendado', nome: 'Agendado' },
  { id: 'compareceu', nome: 'Compareceu' },
  { id: 'follow_up', nome: 'Follow Up' },
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
  // dados do pre-agendamento combinado pela IA (dia/hora/medico/paciente/telefone/resumo) - a
  // atendente humana usa isso pra confirmar (ver marcarPreAgendado)
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS pre_agendamento JSONB;`);
  // alerta de retorno: o lead pediu pra retomar o contato mais tarde. retorno_em = quando; ao criar,
  // o card vai pra "Em negociacao"; na hora, o verificador (server.js) devolve pra "Em atendimento"
  // e a IA retoma (retorno_disparado_em marca que ja disparou). Limpa quando o lead responde.
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS retorno_em TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS retorno_nota TEXT;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS retorno_origem TEXT;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS retorno_disparado_em TIMESTAMPTZ;`);
  // controle de "mensagem nao lida" pro sino de notificacoes: ultima_entrada_em = ultima mensagem
  // que o CONTATO mandou; lido_em = quando alguem abriu a conversa no app pela ultima vez
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS ultima_entrada_em TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ;`);
  // id da mensagem no WhatsApp (key.id) - evita registrar duas vezes a mesma mensagem quando o
  // Evolution reenvia o webhook (ou o eco de algo que a gente mesmo mandou chega depois de um reinicio)
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS wa_id TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_mensagens_waid_idx ON crm_mensagens (tenant_id, instancia, wa_id) WHERE wa_id IS NOT NULL;`);

  await pool.query(`ALTER TABLE crm_contatos DROP CONSTRAINT IF EXISTS crm_contatos_numero_instancia_key;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_contatos_tenant_numero_instancia_idx ON crm_contatos (tenant_id, numero, instancia);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_seguranca_tenant_idx ON crm_seguranca (tenant_id);`);
  // a coluna "id" antiga (schema pre-multi-tenant: PRIMARY KEY DEFAULT 1, CHECK id=1 - so
  // existia 1 linha global) ficou pra tras e nunca foi removida. Como ela nunca e passada no
  // INSERT de definirSenhaOcultas, todo INSERT (1o tenant NOVO a definir a senha de "Ocultas")
  // tentava "id=1" de novo pelo DEFAULT, colidindo com a linha do primeiro tenant que ja
  // existia (mesmo bug ja corrigido em auto_atendimento_config, ver autoAtendimento.js).
  await pool.query(`ALTER TABLE crm_seguranca DROP CONSTRAINT IF EXISTS crm_seguranca_pkey;`);
  await pool.query(`ALTER TABLE crm_seguranca DROP CONSTRAINT IF EXISTS crm_seguranca_id_check;`);
  await pool.query(`ALTER TABLE crm_seguranca DROP COLUMN IF EXISTS id;`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do CRM:', err.message);
});

// registra uma mensagem (entrada = contato mandou, saida = a gente/Lumia mandou) e garante que
// o contato tem um card. Etapa inicial: "novo_lead" SO quando o proprio contato foi quem escreveu
// primeiro; se a clinica/IA e quem puxou a conversa (saida), o card ja nasce em "em_atendimento".
// Card em "novo_lead" que recebe resposta nossa vai pra "em_atendimento"; card em "perdido" cujo
// contato volta a escrever tambem volta pra "em_atendimento". O dono ainda pode mover manualmente.
//
// - nome: so vale quando a mensagem e de ENTRADA - em mensagem enviada por nos, o pushName do
//   webhook e o do DONO do WhatsApp, e gravar isso virava todo paciente com o nome da clinica
// - quando: horario real da mensagem no WhatsApp (messageTimestamp), pra ordem da conversa bater
//   com o WhatsApp mesmo se o webhook atrasar; sem isso usa o horario de agora
// - waId: id da mensagem no WhatsApp - mensagem repetida (webhook reenviado) e ignorada
// - evitarEco: usado no registro de mensagem "fromMe" - se a gente acabou de registrar o MESMO
//   texto como saida (ex: resposta da IA), o eco que o WhatsApp devolve nao duplica
export async function registrarMensagem(tenantId, { numero, instancia, direcao, tipo = 'text', texto = '', nome, midiaBase64, midiaMimetype, quando, waId, evitarEco = false }) {
  if (!pool) return;
  await tabelasProntas;

  if (waId) {
    const { rows: jaTem } = await pool.query('SELECT 1 FROM crm_mensagens WHERE tenant_id = $1 AND instancia = $2 AND wa_id = $3', [tenantId, instancia, waId]);
    if (jaTem.length) return;
  }
  if (evitarEco && texto) {
    const { rows: eco } = await pool.query(
      `SELECT 1 FROM crm_mensagens WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 AND direcao = 'saida' AND texto = $4 AND criado_em > now() - interval '3 minutes' LIMIT 1`,
      [tenantId, numero, instancia, texto],
    );
    if (eco.length) return;
  }

  const preview = (texto || '').slice(0, 200) || (tipo !== 'text' ? `[${tipo}]` : '');
  const nomeFinal = direcao === 'entrada' ? (nome || null) : null;
  // horario da mensagem: o do WhatsApp se vier e for plausivel (nunca no futuro), senao agora
  let ts = quando ? new Date(quando) : null;
  if (!ts || Number.isNaN(ts.getTime()) || ts.getTime() > Date.now() + 5 * 60 * 1000) ts = new Date();

  const { rows } = await pool.query(
    `INSERT INTO crm_contatos (tenant_id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, ultima_entrada_em)
     VALUES ($1, $2, $3, $4, CASE WHEN $6::text = 'entrada' THEN 'novo_lead' ELSE 'em_atendimento' END, $5, $7::timestamptz, CASE WHEN $6::text = 'entrada' THEN $7::timestamptz ELSE NULL END)
     ON CONFLICT (tenant_id, numero, instancia) DO UPDATE SET
       nome = COALESCE(EXCLUDED.nome, crm_contatos.nome),
       ultima_mensagem = CASE WHEN crm_contatos.ultima_mensagem_em IS NULL OR $7::timestamptz >= crm_contatos.ultima_mensagem_em THEN $5 ELSE crm_contatos.ultima_mensagem END,
       ultima_mensagem_em = GREATEST(COALESCE(crm_contatos.ultima_mensagem_em, $7::timestamptz), $7::timestamptz),
       ultima_entrada_em = CASE WHEN $6::text = 'entrada' THEN GREATEST(COALESCE(crm_contatos.ultima_entrada_em, $7::timestamptz), $7::timestamptz) ELSE crm_contatos.ultima_entrada_em END,
       retorno_em = CASE WHEN $6::text = 'entrada' AND crm_contatos.retorno_disparado_em IS NOT NULL THEN NULL ELSE crm_contatos.retorno_em END,
       retorno_nota = CASE WHEN $6::text = 'entrada' AND crm_contatos.retorno_disparado_em IS NOT NULL THEN NULL ELSE crm_contatos.retorno_nota END,
       retorno_origem = CASE WHEN $6::text = 'entrada' AND crm_contatos.retorno_disparado_em IS NOT NULL THEN NULL ELSE crm_contatos.retorno_origem END,
       retorno_disparado_em = CASE WHEN $6::text = 'entrada' AND crm_contatos.retorno_disparado_em IS NOT NULL THEN NULL ELSE crm_contatos.retorno_disparado_em END,
       etapa = CASE
         WHEN crm_contatos.etapa = 'novo_lead' AND $6::text = 'saida' THEN 'em_atendimento'
         WHEN crm_contatos.etapa = 'perdido' AND $6::text = 'entrada' THEN 'em_atendimento'
         ELSE crm_contatos.etapa END
     RETURNING id`,
    [tenantId, numero, instancia, nomeFinal, preview, direcao, ts],
  );

  const { rows: msgRows } = await pool.query(
    `INSERT INTO crm_mensagens (tenant_id, numero, instancia, direcao, tipo, texto, midia_base64, midia_mimetype, criado_em, wa_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id, instancia, wa_id) WHERE wa_id IS NOT NULL DO NOTHING
     RETURNING id, direcao, tipo, texto, criado_em, (midia_base64 IS NOT NULL) AS tem_midia`,
    [tenantId, numero, instancia, direcao, tipo, texto || '', midiaBase64 || null, midiaMimetype || null, ts, waId || null],
  );
  if (!msgRows[0]) return rows[0]?.id; // outro webhook identico ganhou a corrida - nada a emitir

  eventosCrm.emit('mensagem', { tenantId, contatoId: rows[0]?.id, numero, instancia, mensagem: msgRows[0] });

  return rows[0]?.id;
}

// chamado pelo auto-atendimento quando um agendamento e criado com sucesso (Clinicorp e/ou
// agenda interna) - pula o card direto pra "agendado", de qualquer etapa que estivesse antes
export async function marcarAgendado(tenantId, numero, instancia) {
  if (!pool) return;
  await tabelasProntas;
  const { rows } = await pool.query(
    `UPDATE crm_contatos SET etapa = 'agendado', pre_agendamento = NULL WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 RETURNING id`,
    [tenantId, numero, instancia],
  );
  if (rows[0]) eventosCrm.emit('contato-atualizado', { tenantId, contatoId: rows[0].id });
}

// chamado pelo auto-atendimento quando o "agendamento direto no Clinicorp" esta DESLIGADO e um
// pre-agendamento e combinado com o lead - pula o card pra uma etapa propria (diferente de
// "agendado" de proposito) pra deixar claro pra atendente humana que esse aqui ainda precisa
// de uma ligacao/WhatsApp pra confirmar de verdade antes de virar um agendamento real. Guarda
// tambem o que foi combinado (dia, hora, medico, paciente...) pra ela ver direto no card, e
// avisa o painel em tempo real (SSE) pro card trocar de coluna sem recarregar a pagina.
export async function marcarPreAgendado(tenantId, numero, instancia, detalhes = null) {
  if (!pool) return;
  await tabelasProntas;
  const { rows } = await pool.query(
    `UPDATE crm_contatos SET etapa = 'pre_agendado', pre_agendamento = $4 WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 RETURNING id`,
    [tenantId, numero, instancia, detalhes ? JSON.stringify({ ...detalhes, em: new Date().toISOString() }) : null],
  );
  if (rows[0]) eventosCrm.emit('contato-atualizado', { tenantId, contatoId: rows[0].id });
}

// so os NAO ocultos - o padrao do board (ver listarContatosOcultos pra tela de gerenciar)
export async function listarContatos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado, pre_agendamento,
            retorno_em, retorno_nota, retorno_origem, retorno_disparado_em,
            (retorno_em IS NOT NULL AND (retorno_em AT TIME ZONE 'America/Maceio')::date <= (now() AT TIME ZONE 'America/Maceio')::date) AS retorno_hoje,
            (ultima_entrada_em IS NOT NULL AND (lido_em IS NULL OR ultima_entrada_em > lido_em)) AS nao_lida
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = false ORDER BY ultima_mensagem_em DESC NULLS LAST`,
    [tenantId],
  );
  return rows;
}

export async function listarContatosOcultos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado, pre_agendamento,
            retorno_em, retorno_nota, retorno_origem, retorno_disparado_em,
            (retorno_em IS NOT NULL AND (retorno_em AT TIME ZONE 'America/Maceio')::date <= (now() AT TIME ZONE 'America/Maceio')::date) AS retorno_hoje,
            (ultima_entrada_em IS NOT NULL AND (lido_em IS NULL OR ultima_entrada_em > lido_em)) AS nao_lida
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

// ---------- alerta de retorno + notificacoes ----------

const NOTA_MAX = 500;

// define (ou troca) o alerta de retorno de um contato e move o card pra "Em negociacao".
// origem: 'humano' (botao na conversa) ou 'ia' (ferramenta criar_alerta_retorno). Identifica o
// contato por id (painel) ou por numero+instancia (IA).
export async function definirRetorno(tenantId, { id, numero, instancia }, { quando, nota, origem }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) throw new Error('Data/hora invalida.');
  if (data.getTime() <= Date.now()) throw new Error('A data/hora do retorno precisa ser no futuro.');
  const notaFinal = (nota || '').slice(0, NOTA_MAX) || null;
  const origemFinal = origem === 'ia' ? 'ia' : 'humano';
  const filtro = id ? 'id = $5' : 'numero = $5 AND instancia = $6';
  const params = [tenantId, data, notaFinal, origemFinal, id || numero];
  if (!id) params.push(instancia);
  const { rows } = await pool.query(
    `UPDATE crm_contatos SET etapa = 'em_negociacao', retorno_em = $2, retorno_nota = $3, retorno_origem = $4, retorno_disparado_em = NULL
     WHERE tenant_id = $1 AND ${filtro} RETURNING id`,
    params,
  );
  if (!rows[0]) throw new Error('Contato nao encontrado no CRM.');
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: rows[0].id });
  return rows[0].id;
}

// remove o alerta; se o card estava em "Em negociacao" por causa dele, volta pra "Em atendimento"
export async function removerRetorno(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `UPDATE crm_contatos SET retorno_em = NULL, retorno_nota = NULL, retorno_origem = NULL, retorno_disparado_em = NULL,
       etapa = CASE WHEN etapa = 'em_negociacao' THEN 'em_atendimento' ELSE etapa END
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

// retornos que ja chegaram na hora e ainda nao dispararam - de TODOS os tenants (o verificador do
// server.js roda isso a cada minuto)
export async function listarRetornosVencidos() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, tenant_id, numero, instancia, nome, retorno_nota, retorno_origem FROM crm_contatos
     WHERE retorno_em IS NOT NULL AND retorno_em <= now() AND retorno_disparado_em IS NULL ORDER BY retorno_em ASC`,
  );
  return rows;
}

// marca o retorno como disparado e devolve o card pra "Em atendimento" (mantem retorno_em pra
// continuar aparecendo em laranja ate o lead responder ou alguem remover)
export async function marcarRetornoDisparado(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `UPDATE crm_contatos SET retorno_disparado_em = now(), etapa = CASE WHEN etapa = 'em_negociacao' THEN 'em_atendimento' ELSE etapa END
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

export async function marcarLido(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query('UPDATE crm_contatos SET lido_em = now() WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}

// dados do sino de notificacoes (ver /api/notificacoes) - so o que vem do proprio CRM; faltas do
// Clinicorp sao somadas na rota
export async function resumoNotificacoes(tenantId) {
  if (!pool) return { naoLidas: [], retornos: [], preAgendamentos: [] };
  await tabelasProntas;
  const base = `FROM crm_contatos WHERE tenant_id = $1 AND oculto = false`;
  const [naoLidas, retornos, pre] = await Promise.all([
    pool.query(`SELECT id, numero, instancia, nome, ultima_mensagem, ultima_entrada_em ${base} AND ultima_entrada_em IS NOT NULL AND (lido_em IS NULL OR ultima_entrada_em > lido_em) ORDER BY ultima_entrada_em DESC LIMIT 30`, [tenantId]),
    pool.query(`SELECT id, numero, instancia, nome, retorno_em, retorno_nota, retorno_disparado_em ${base} AND retorno_em IS NOT NULL AND (retorno_em AT TIME ZONE 'America/Maceio')::date <= (now() AT TIME ZONE 'America/Maceio')::date ORDER BY retorno_em ASC LIMIT 30`, [tenantId]),
    pool.query(`SELECT id, numero, instancia, nome, pre_agendamento ${base} AND etapa = 'pre_agendado' ORDER BY ultima_mensagem_em DESC LIMIT 30`, [tenantId]),
  ]);
  return { naoLidas: naoLidas.rows, retornos: retornos.rows, preAgendamentos: pre.rows };
}

// consultado pelo webhook (server.js) pra saber a etapa atual do contato antes de decidir se
// quem responde e o auto-atendimento normal ou o Follow Up (ver processarMensagemEvolution) -
// null se esse numero/instancia ainda nao tem card nenhum
export async function obterContato(tenantId, numero, instancia) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, etapa, auto_pausado FROM crm_contatos WHERE tenant_id = $1 AND numero = $2 AND instancia = $3`,
    [tenantId, numero, instancia],
  );
  return rows[0] || null;
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
