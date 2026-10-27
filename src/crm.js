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
  // base de contatos (aba Contatos): dados extras de cada lead + de onde ele veio ('whatsapp' =
  // nasceu de uma conversa, 'importado' = planilha, 'manual' = cadastrado na mao)
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS etiquetas TEXT[] NOT NULL DEFAULT '{}';`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS observacoes TEXT;`);
  await pool.query(`ALTER TABLE crm_contatos ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'whatsapp';`);
  // id da mensagem no WhatsApp (key.id) - evita registrar duas vezes a mesma mensagem quando o
  // Evolution reenvia o webhook (ou o eco de algo que a gente mesmo mandou chega depois de um reinicio)
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS wa_id TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_mensagens_waid_idx ON crm_mensagens (tenant_id, instancia, wa_id) WHERE wa_id IS NOT NULL;`);
  // quem mandou cada mensagem de saida ('ia' = auto-atendimento, 'followup' = cadencia automatica,
  // 'humano' = equipe pelo painel ou pelo proprio WhatsApp) - base da aba Resultados. Mensagens
  // antigas ficam sem autor (nao da pra saber depois)
  await pool.query(`ALTER TABLE crm_mensagens ADD COLUMN IF NOT EXISTS autor TEXT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS crm_mensagens_tenant_criado_idx ON crm_mensagens (tenant_id, criado_em);`);
  // historico de mudanca de etapa (so daqui pra frente) - e o que permite contar "agendamentos no
  // periodo", ja que crm_contatos so guarda a etapa atual
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_etapa_eventos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      contato_id INT NOT NULL,
      instancia TEXT,
      etapa TEXT NOT NULL,
      em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS crm_etapa_eventos_tenant_idx ON crm_etapa_eventos (tenant_id, em);`);

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

// guarda que o contato entrou numa etapa agora (best-effort: falha aqui nunca derruba a acao principal)
async function registrarEventoEtapa(tenantId, contatoId, instancia, etapa) {
  await pool.query(
    `INSERT INTO crm_etapa_eventos (tenant_id, contato_id, instancia, etapa) VALUES ($1, $2, $3, $4)`,
    [tenantId, contatoId, instancia || null, etapa],
  ).catch((err) => console.error('Erro registrando historico de etapa:', err.message));
}

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
export async function registrarMensagem(tenantId, { numero, instancia, direcao, tipo = 'text', texto = '', nome, midiaBase64, midiaMimetype, quando, waId, evitarEco = false, autor = null }) {
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

  // contato importado/cadastrado com o numero "com 9" (ou sem) e o WhatsApp mandando no outro
  // formato: assume o card que ainda nao tinha conversa, em vez de abrir um card duplicado
  const variante = varianteNonoDigito(numero);
  if (variante) {
    await pool.query(
      `UPDATE crm_contatos SET numero = $1 WHERE tenant_id = $2 AND instancia = $3 AND numero = $4 AND ultima_mensagem_em IS NULL
         AND NOT EXISTS (SELECT 1 FROM crm_contatos WHERE tenant_id = $2 AND instancia = $3 AND numero = $1)`,
      [numero, tenantId, instancia, variante],
    );
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
    `INSERT INTO crm_mensagens (tenant_id, numero, instancia, direcao, tipo, texto, midia_base64, midia_mimetype, criado_em, wa_id, autor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id, instancia, wa_id) WHERE wa_id IS NOT NULL DO NOTHING
     RETURNING id, direcao, tipo, texto, criado_em, (midia_base64 IS NOT NULL) AS tem_midia`,
    [tenantId, numero, instancia, direcao, tipo, texto || '', midiaBase64 || null, midiaMimetype || null, ts, waId || null, direcao === 'saida' ? autor : null],
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
  if (rows[0]) await registrarEventoEtapa(tenantId, rows[0].id, instancia, 'agendado');
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
  if (rows[0]) await registrarEventoEtapa(tenantId, rows[0].id, instancia, 'pre_agendado');
  if (rows[0]) eventosCrm.emit('contato-atualizado', { tenantId, contatoId: rows[0].id });
}

// so os NAO ocultos - o padrao do board (ver listarContatosOcultos pra tela de gerenciar)
// Contato importado/cadastrado que ainda nao conversou fica so na aba Contatos (nao lota o funil)
export async function listarContatos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, ultima_mensagem, ultima_mensagem_em, criado_em, auto_pausado, pre_agendamento,
            retorno_em, retorno_nota, retorno_origem, retorno_disparado_em,
            (retorno_em IS NOT NULL AND (retorno_em AT TIME ZONE 'America/Maceio')::date <= (now() AT TIME ZONE 'America/Maceio')::date) AS retorno_hoje,
            (ultima_entrada_em IS NOT NULL AND (lido_em IS NULL OR ultima_entrada_em > lido_em)) AS nao_lida
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = false AND ultima_mensagem_em IS NOT NULL ORDER BY ultima_mensagem_em DESC NULLS LAST`,
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

// ---------- base de contatos (aba Contatos: lista, cadastro, importar/exportar) ----------

// telefone de planilha -> so digitos no formato do WhatsApp (55 + DDD + numero). Numero
// brasileiro sem o 55 (10/11 digitos) ganha o 55; fora isso aceita internacional de 10 a 15
// digitos. Devolve null quando nao da pra ser um WhatsApp
export function normalizarTelefone(bruto) {
  let d = String(bruto ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

// celular brasileiro aparece com e sem o 9 na frente (o WhatsApp de contas antigas usa sem) -
// devolve o outro formato pra deduplicar/ligar os dois
export function varianteNonoDigito(numero) {
  const n = String(numero || '');
  if (/^55\d{2}9\d{8}$/.test(n)) return n.slice(0, 4) + n.slice(5);
  if (/^55\d{2}[6-9]\d{7}$/.test(n)) return `${n.slice(0, 4)}9${n.slice(4)}`;
  return null;
}

function limparEtiquetas(lista) {
  const vistas = new Map();
  for (const bruta of Array.isArray(lista) ? lista : String(lista || '').split(/[,;|]/)) {
    const t = String(bruta || '').trim().slice(0, 40);
    if (t && !vistas.has(t.toLowerCase())) vistas.set(t.toLowerCase(), t);
  }
  return [...vistas.values()].slice(0, 20);
}
const textoOuNull = (v, max) => {
  const t = v == null ? '' : String(v).trim().slice(0, max);
  return t || null;
};

// todos os contatos nao ocultos do tenant, com ou sem conversa - a tela de Contatos
export async function listarBaseContatos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, email, etiquetas, observacoes, origem, criado_em, ultima_mensagem_em, auto_pausado
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = false
     ORDER BY COALESCE(ultima_mensagem_em, criado_em) DESC`,
    [tenantId],
  );
  return rows;
}

async function acharPorNumero(cliente, tenantId, numero) {
  const variante = varianteNonoDigito(numero);
  const { rows } = await cliente.query(
    `SELECT id, etiquetas FROM crm_contatos WHERE tenant_id = $1 AND numero = ANY($2::text[]) ORDER BY ultima_mensagem_em DESC NULLS LAST LIMIT 1`,
    [tenantId, variante ? [numero, variante] : [numero]],
  );
  return rows[0] || null;
}

// cadastro manual (sem id) ou edicao dos dados extras (com id). Numero/instancia so no cadastro -
// trocar o numero de um contato com conversa desligaria o historico dele
export async function salvarContatoBase(tenantId, dados) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const nome = textoOuNull(dados.nome, 120);
  const email = textoOuNull(dados.email, 160);
  const observacoes = textoOuNull(dados.observacoes, 2000);
  const etiquetas = limparEtiquetas(dados.etiquetas);

  if (dados.id) {
    const { rows } = await pool.query(
      `UPDATE crm_contatos SET nome = $1, email = $2, observacoes = $3, etiquetas = $4 WHERE id = $5 AND tenant_id = $6 RETURNING id`,
      [nome, email, observacoes, etiquetas, Number(dados.id), tenantId],
    );
    if (!rows[0]) throw new Error('Contato nao encontrado.');
    eventosCrm.emit('contato-atualizado', { tenantId, contatoId: rows[0].id });
    return rows[0].id;
  }

  const numero = normalizarTelefone(dados.numero);
  if (!numero) throw new Error('Telefone invalido - use DDD + numero (ex: 82 99999-9999).');
  if (!dados.instancia) throw new Error('Escolha o numero de WhatsApp desse contato.');
  if (await acharPorNumero(pool, tenantId, numero)) throw new Error('Ja existe um contato com esse telefone.');
  const { rows } = await pool.query(
    `INSERT INTO crm_contatos (tenant_id, numero, instancia, nome, email, observacoes, etiquetas, origem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual') RETURNING id`,
    [tenantId, numero, String(dados.instancia), nome, email, observacoes, etiquetas],
  );
  return rows[0].id;
}

// importacao de planilha (a tela manda em lotes). Duplicado = mesmo telefone (com/sem o 9) em
// qualquer numero do tenant: modo 'atualizar' completa os dados (nome/email/obs so se vierem,
// etiquetas somam), 'pular' deixa como esta. Tudo numa transacao - ou entra o lote todo ou nada.
// Follow Up fica de fora: entrar nessa etapa dispara a cadencia de mensagens automaticas
const ETAPAS_IMPORTAVEIS = new Set([...IDS_ETAPAS].filter((e) => e !== 'follow_up'));
export async function importarContatos(tenantId, instancia, linhas, modo = 'pular') {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const resultado = { novos: 0, atualizados: 0, ignorados: 0, invalidos: 0 };
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const linha of linhas.slice(0, 1000)) {
      const numero = normalizarTelefone(linha?.numero);
      if (!numero) { resultado.invalidos++; continue; }
      const nome = textoOuNull(linha.nome, 120);
      const email = textoOuNull(linha.email, 160);
      const observacoes = textoOuNull(linha.observacoes, 2000);
      const etiquetas = limparEtiquetas(linha.etiquetas);
      const etapa = ETAPAS_IMPORTAVEIS.has(linha.etapa) ? linha.etapa : null;

      const existente = await acharPorNumero(cliente, tenantId, numero);
      if (existente) {
        if (modo !== 'atualizar') { resultado.ignorados++; continue; }
        await cliente.query(
          `UPDATE crm_contatos SET nome = COALESCE($1, nome), email = COALESCE($2, email), observacoes = COALESCE($3, observacoes),
             etiquetas = $4, etapa = COALESCE($5, etapa) WHERE id = $6`,
          [nome, email, observacoes, limparEtiquetas([...(existente.etiquetas || []), ...etiquetas]), etapa, existente.id],
        );
        resultado.atualizados++;
      } else {
        await cliente.query(
          `INSERT INTO crm_contatos (tenant_id, numero, instancia, nome, email, observacoes, etiquetas, etapa, origem)
           VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'novo_lead'), 'importado')`,
          [tenantId, numero, instancia, nome, email, observacoes, etiquetas, etapa],
        );
        resultado.novos++;
      }
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
  return resultado;
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
    `SELECT c.id, c.tenant_id, c.numero, c.instancia, c.nome, c.retorno_nota, c.retorno_origem FROM crm_contatos c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.retorno_em IS NOT NULL AND c.retorno_em <= now() AND c.retorno_disparado_em IS NULL AND (t.ativo OR t.super_admin)
     ORDER BY c.retorno_em ASC`,
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
  const { rows } = await pool.query(`UPDATE crm_contatos SET etapa = $1 WHERE id = $2 AND tenant_id = $3 AND etapa <> $1 RETURNING instancia`, [etapa, id, tenantId]);
  if (rows[0]) await registrarEventoEtapa(tenantId, id, rows[0].instancia, etapa);
  eventosCrm.emit('contato-atualizado', { tenantId, contatoId: id });
}

// manda uma mensagem de texto pro contato direto pelo CRM (usa a mesma instancia que o card
// pertence) e registra como saida - assim a conversa aberta no app fica igual a conversa real
// o WhatsApp devolve no envio o numero real da conta (remoteJid) - contato importado/cadastrado
// com o 9 a mais (ou a menos) passa a usar esse formato, senao as respostas dele (que chegam no
// formato real) abririam um card duplicado
async function alinharNumeroPeloEnvio(tenantId, numero, instancia, resposta) {
  const jid = resposta?.key?.remoteJid || '';
  if (!jid.endsWith('@s.whatsapp.net')) return numero;
  const real = jid.split('@')[0];
  if (!real || real === numero || varianteNonoDigito(numero) !== real || !pool) return numero;
  const { rowCount } = await pool.query(
    `UPDATE crm_contatos SET numero = $1 WHERE tenant_id = $2 AND instancia = $3 AND numero = $4
       AND NOT EXISTS (SELECT 1 FROM crm_contatos WHERE tenant_id = $2 AND instancia = $3 AND numero = $1)`,
    [real, tenantId, instancia, numero],
  );
  if (!rowCount) return numero;
  await pool.query(`UPDATE crm_mensagens SET numero = $1 WHERE tenant_id = $2 AND instancia = $3 AND numero = $4`, [real, tenantId, instancia, numero]);
  return real;
}

export async function enviarMensagem(tenantId, numero, instancia, texto) {
  const resposta = await evolutionApi.enviarMensagemTextoPor(instancia, numero, texto);
  const numeroReal = await alinharNumeroPeloEnvio(tenantId, numero, instancia, resposta);
  await registrarMensagem(tenantId, { numero: numeroReal, instancia, direcao: 'saida', tipo: 'text', texto, waId: resposta?.key?.id || null, autor: 'humano' });
  return resposta;
}

// manda midia (foto, video, documento ou audio gravado) pela aba Conversas, na mesma instancia do
// contato, e registra como saida. Guarda o base64 so de imagem/audio (mesma regra do que chega pelo
// webhook - video/documento ficam so como registro, pra nao pesar o banco). Devolve a resposta do
// Evolution pra quem chamou marcar o id como "enviado por nos" (o eco do webhook nao duplica).
const TIPOS_MIDIA_ENVIO = new Set(['image', 'video', 'document', 'audio']);
export async function enviarMidiaContato(tenantId, numero, instancia, { tipo, mimetype, base64, fileName, legenda }) {
  if (!TIPOS_MIDIA_ENVIO.has(tipo)) throw new Error(`Tipo de midia invalido: "${tipo}"`);
  if (!base64) throw new Error('arquivo vazio');
  const resposta = tipo === 'audio'
    ? await evolutionApi.enviarAudio(instancia, numero, base64)
    : await evolutionApi.enviarMidia(instancia, numero, { mediatype: tipo, mimetype, media: base64, fileName, caption: legenda || undefined });
  const guardarMidia = tipo === 'image' || tipo === 'audio';
  const numeroReal = await alinharNumeroPeloEnvio(tenantId, numero, instancia, resposta);
  await registrarMensagem(tenantId, {
    numero: numeroReal, instancia, direcao: 'saida', tipo, autor: 'humano',
    texto: legenda || (tipo === 'document' ? fileName || 'documento' : ''),
    midiaBase64: guardarMidia ? base64 : null,
    midiaMimetype: guardarMidia ? mimetype : null,
    waId: resposta?.key?.id || null,
  });
  return resposta;
}

// ---------- aba Resultados (indicadores do atendimento num periodo) ----------

// numeros de um intervalo [inicio, fim) - usado pro periodo escolhido e pro periodo anterior de
// mesmo tamanho (comparacao). instancia null = todos os numeros do tenant
async function indicadoresDoIntervalo(tenantId, inicio, fim, instancia) {
  const p = [tenantId, inicio, fim, instancia];
  const filtroInst = '($4::text IS NULL OR instancia = $4)';
  const [{ rows: [base] }, { rows: [resp] }] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*) FROM crm_contatos WHERE tenant_id = $1 AND oculto = false AND origem = 'whatsapp'
            AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS novos,
         (SELECT count(DISTINCT (numero, instancia)) FROM crm_mensagens WHERE tenant_id = $1 AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS conversas,
         (SELECT count(*) FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'entrada' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS recebidas,
         (SELECT count(*) FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'saida' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS enviadas,
         (SELECT count(*) FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'saida' AND autor = 'ia' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS enviadas_ia,
         (SELECT count(*) FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'saida' AND autor = 'followup' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS enviadas_followup,
         (SELECT count(*) FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'saida' AND autor = 'humano' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst})::int AS enviadas_humano,
         (SELECT count(DISTINCT contato_id) FROM crm_etapa_eventos WHERE tenant_id = $1 AND etapa = 'agendado' AND em >= $2 AND em < $3 AND ${filtroInst})::int AS agendamentos,
         (SELECT count(DISTINCT contato_id) FROM crm_etapa_eventos WHERE tenant_id = $1 AND etapa = 'pre_agendado' AND em >= $2 AND em < $3 AND ${filtroInst})::int AS pre_agendamentos`,
      p,
    ),
    // tempo de 1a resposta: cada vez que o contato comeca a falar (mensagem de entrada que nao vem
    // logo depois de outra entrada), quanto demorou ate a proxima mensagem nossa
    pool.query(
      `WITH m AS (
         SELECT numero, instancia, direcao, criado_em,
                lag(direcao) OVER (PARTITION BY numero, instancia ORDER BY criado_em) AS dir_anterior
         FROM crm_mensagens
         WHERE tenant_id = $1 AND criado_em >= $2::timestamptz - interval '2 days' AND criado_em < $3 AND ${filtroInst}
       ), inicios AS (
         SELECT numero, instancia, criado_em FROM m
         WHERE direcao = 'entrada' AND dir_anterior IS DISTINCT FROM 'entrada' AND criado_em >= $2 AND criado_em < $3
       ), r AS (
         SELECT i.criado_em,
                (SELECT min(s.criado_em) FROM crm_mensagens s
                 WHERE s.tenant_id = $1 AND s.numero = i.numero AND s.instancia = i.instancia AND s.direcao = 'saida' AND s.criado_em >= i.criado_em) AS respondida_em
         FROM inicios i
       )
       SELECT count(*)::int AS contatos_iniciados,
              count(respondida_em)::int AS respondidos,
              (count(*) FILTER (WHERE respondida_em - criado_em <= interval '5 minutes'))::int AS em_5min,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM respondida_em - criado_em))
                FILTER (WHERE respondida_em IS NOT NULL) AS mediana_seg
       FROM r`,
      p,
    ),
  ]);
  return { ...base, ...resp, mediana_seg: resp.mediana_seg == null ? null : Math.round(resp.mediana_seg) };
}

// de/ate: 'YYYY-MM-DD' no horario de Maceio (UTC-3 fixo, sem horario de verao)
export async function resultadosAtendimento(tenantId, { de, ate, instancia = null }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86400000);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) throw new Error('Periodo invalido.');
  if (fim - inicio > 400 * 86400000) throw new Error('Escolha um periodo de no maximo 1 ano.');
  const anteriorInicio = new Date(inicio.getTime() - (fim - inicio));
  const p = [tenantId, inicio, fim, instancia];
  const filtroInst = '($4::text IS NULL OR instancia = $4)';

  const [atual, anterior, { rows: dias }, { rows: novosDia }, { rows: horas }, { rows: funil }, { rows: [desde] }] = await Promise.all([
    indicadoresDoIntervalo(tenantId, inicio, fim, instancia),
    indicadoresDoIntervalo(tenantId, anteriorInicio, inicio, instancia),
    pool.query(
      `SELECT to_char((criado_em AT TIME ZONE 'America/Maceio')::date, 'YYYY-MM-DD') AS dia,
              (count(*) FILTER (WHERE direcao = 'entrada'))::int AS recebidas,
              (count(*) FILTER (WHERE direcao = 'saida'))::int AS enviadas
       FROM crm_mensagens WHERE tenant_id = $1 AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst} GROUP BY 1`,
      p,
    ),
    pool.query(
      `SELECT to_char((criado_em AT TIME ZONE 'America/Maceio')::date, 'YYYY-MM-DD') AS dia, count(*)::int AS novos
       FROM crm_contatos WHERE tenant_id = $1 AND oculto = false AND origem = 'whatsapp' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst} GROUP BY 1`,
      p,
    ),
    pool.query(
      `SELECT extract(hour FROM criado_em AT TIME ZONE 'America/Maceio')::int AS hora, count(*)::int AS recebidas
       FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'entrada' AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst} GROUP BY 1`,
      p,
    ),
    // funil: onde estao HOJE os contatos que chegaram no periodo
    pool.query(
      `SELECT etapa, count(*)::int AS total FROM crm_contatos
       WHERE tenant_id = $1 AND oculto = false AND ultima_mensagem_em IS NOT NULL AND criado_em >= $2 AND criado_em < $3 AND ${filtroInst}
       GROUP BY etapa`,
      p,
    ),
    // desde quando existe o registro de autor/etapa - antes disso esses numeros ficam zerados e a
    // tela avisa em vez de mostrar "0 agendamentos" como se fosse verdade
    pool.query(
      `SELECT (SELECT min(criado_em) FROM crm_mensagens WHERE tenant_id = $1 AND autor IS NOT NULL) AS autor_desde,
              (SELECT min(em) FROM crm_etapa_eventos WHERE tenant_id = $1) AS etapas_desde`,
      [tenantId],
    ),
  ]);

  const porDiaMapa = new Map(dias.map((d) => [d.dia, d]));
  const novosMapa = new Map(novosDia.map((d) => [d.dia, d.novos]));
  const porDia = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += 86400000) {
    const dia = new Date(t - 3 * 3600000).toISOString().slice(0, 10);
    const d = porDiaMapa.get(dia);
    porDia.push({ dia, recebidas: d?.recebidas || 0, enviadas: d?.enviadas || 0, novos: novosMapa.get(dia) || 0 });
  }
  const horasMapa = new Map(horas.map((h) => [h.hora, h.recebidas]));
  const funilMapa = new Map(funil.map((f) => [f.etapa, f.total]));

  return {
    periodo: { de, ate, inicio, fim, anteriorInicio },
    atual,
    anterior,
    porDia,
    porHora: Array.from({ length: 24 }, (_, h) => ({ hora: h, recebidas: horasMapa.get(h) || 0 })),
    funil: ETAPAS.map((e) => ({ id: e.id, nome: e.nome, total: funilMapa.get(e.id) || 0 })),
    registroDesde: { autor: desde.autor_desde, etapas: desde.etapas_desde },
  };
}

// ---------- consultas usadas pelo assistente Lumien (ferramentas crm_* do cloudAgent) ----------

export async function obterContatoPorId(tenantId, id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, numero, instancia, nome, etapa, email, etiquetas, observacoes, origem, auto_pausado, oculto,
            ultima_mensagem, ultima_mensagem_em, criado_em
     FROM crm_contatos WHERE id = $1 AND tenant_id = $2`,
    [Number(id), tenantId],
  );
  return rows[0] || null;
}

// busca livre por nome/telefone/e-mail/etiqueta (sem acento nao importa pro ILIKE simples, mas
// cobre o uso normal de "acha a Maria" / "contatos com etiqueta implante")
export async function buscarContatos(tenantId, { termo, etapa, etiqueta, semConversa, limite = 20 } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  const cond = ['tenant_id = $1', 'oculto = false'];
  const params = [tenantId];
  if (termo) {
    params.push(`%${String(termo).trim()}%`);
    const iT = params.length;
    let porNumero = '';
    const digitos = String(termo).replace(/\D/g, '');
    if (digitos.length >= 4) {
      params.push(`%${digitos}%`);
      porNumero = ` OR numero LIKE $${params.length}`;
    }
    cond.push(`(nome ILIKE $${iT} OR email ILIKE $${iT} OR array_to_string(etiquetas, ',') ILIKE $${iT}${porNumero})`);
  }
  if (etapa) { params.push(etapa); cond.push(`etapa = $${params.length}`); }
  if (etiqueta) { params.push(String(etiqueta).toLowerCase()); cond.push(`EXISTS (SELECT 1 FROM unnest(etiquetas) e WHERE lower(e) = $${params.length})`); }
  if (semConversa === true) cond.push('ultima_mensagem_em IS NULL');
  if (semConversa === false) cond.push('ultima_mensagem_em IS NOT NULL');
  params.push(Math.min(Math.max(Number(limite) || 20, 1), 100));
  const { rows } = await pool.query(
    `SELECT id, nome, numero, instancia, etapa, etiquetas, email, origem, auto_pausado, ultima_mensagem, ultima_mensagem_em,
            count(*) OVER () AS total
     FROM crm_contatos WHERE ${cond.join(' AND ')}
     ORDER BY ultima_mensagem_em DESC NULLS LAST, criado_em DESC LIMIT $${params.length}`,
    params,
  );
  return rows;
}

// conversas cuja ULTIMA mensagem foi do contato (ninguem respondeu ainda), da espera mais longa
// pra mais curta
export async function conversasAguardando(tenantId, { minutos = 0, limite = 30 } = {}) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome, numero, instancia, etapa, auto_pausado, ultima_mensagem, ultima_entrada_em,
            round(extract(epoch FROM now() - ultima_entrada_em) / 60)::int AS esperando_min
     FROM crm_contatos
     WHERE tenant_id = $1 AND oculto = false AND ultima_entrada_em IS NOT NULL AND ultima_entrada_em >= ultima_mensagem_em
       AND ultima_entrada_em <= now() - make_interval(mins => $2::int)
     ORDER BY ultima_entrada_em ASC LIMIT $3`,
    [tenantId, Math.max(0, Number(minutos) || 0), Math.min(Number(limite) || 30, 100)],
  );
  return rows;
}

export async function ultimasMensagens(tenantId, numero, instancia, limite = 30) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT direcao, autor, tipo, texto, criado_em FROM crm_mensagens
     WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 ORDER BY criado_em DESC LIMIT $4`,
    [tenantId, numero, instancia, Math.min(Math.max(Number(limite) || 30, 1), 80)],
  );
  return rows.reverse();
}
