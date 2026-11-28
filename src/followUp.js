// Follow Up (aba "Follow Up" do app): motor de reengajamento automatico pra leads que pararam
// de responder. Funciona junto com o CRM (crm.js) - quando um card e arrastado pra coluna
// "follow_up", esse motor assume 100% da conversa daquele contato (autoAtendimento.js NAO
// responde mais ele - ver checagem em server.js) e passa a mandar mensagens PROATIVAS numa
// cadencia configuravel (ex: 1, 3, 7, 15, 30 dias depois de entrar na coluna), cada tentativa
// com seu proprio script/anexos. Se o lead responder demonstrando interesse de verdade (a IA
// decide isso), o card volta sozinho pra "em_atendimento" pra atendente humana continuar. Se
// nenhuma tentativa gerar resposta, o card vai pra "perdido" depois da ultima tentativa + uma
// folga de dias.
//
// Diferente do autoAtendimento.js (que tem ferramentas de agenda/Clinicorp e um loop de
// tool_use), o Follow Up e mais simples de proposito: cada geracao de mensagem e UMA chamada
// forcada (tool_choice) que devolve so o texto (ou texto + decisao de interesse) - ele nao marca
// agendamento sozinho, so tenta reabrir a conversa; quando consegue, quem retoma o atendimento
// de verdade (inclusive marcar horario) e o humano ou o auto-atendimento normal, dali em diante.
import { anthropic } from './anthropicClient.js';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

const MODEL = 'claude-sonnet-5';

// quantos dias depois da ULTIMA tentativa configurada (ex: apos os 30 dias) o lead continua sem
// responder ate desistir de vez e mover pra "perdido" - nao e configuravel pelo painel de
// proposito (evita deixar lead parado pra sempre num card "follow_up" que ninguem olha mais)
const DIAS_FOLGA_ANTES_DE_DESISTIR = 3;

const ETAPAS_PADRAO = [
  { ordem: 1, dias: 1 },
  { ordem: 2, dias: 3 },
  { ordem: 3, dias: 7 },
  { ordem: 4, dias: 15 },
  { ordem: 5, dias: 30 },
];
const ORDENS_VALIDAS = new Set(ETAPAS_PADRAO.map((e) => e.ordem));

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      prompt_geral TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // horario de funcionamento (fuso America/Maceio) - fora dessa janela o agente nao manda
  // tentativa proativa NEM responde o lead que escrever, pra nunca incomodar o paciente de
  // madrugada ou fora do expediente. "HH:MM" em texto simples (mesmo formato do <input
  // type="time">, sem precisar converter nada no front).
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS hora_inicio TEXT NOT NULL DEFAULT '08:00';`);
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS hora_fim TEXT NOT NULL DEFAULT '20:00';`);
  // modo resgate: lead que responde positivo a uma tentativa ganha a etiqueta de resgate e a IA passa a buscar a objecao
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS modo_resgate BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS prompt_resgate TEXT;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_etapas (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      ordem INT NOT NULL,
      dias INT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      prompt TEXT,
      PRIMARY KEY (tenant_id, ordem)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      ordem INT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // 1 linha por contato do CRM que ja passou (ou esta) pela coluna Follow Up - guarda quando
  // entrou, qual foi a ultima tentativa mandada e o historico proprio dessa conversa de
  // reengajamento (separado do historico do auto-atendimento normal, de proposito: sao
  // "personas"/momentos diferentes). "finalizado" true = parou de ser processado pelo agendador
  // (lead retomou contato OU foi movido pra perdido) - contato_id e unico, entao um mesmo card
  // reaproveita a mesma linha se voltar pra Follow Up de novo mais tarde (reseta entrou_em).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_contatos (
      contato_id INT PRIMARY KEY REFERENCES crm_contatos(id) ON DELETE CASCADE,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultima_etapa_enviada INT NOT NULL DEFAULT 0,
      ultima_etapa_enviada_em TIMESTAMPTZ,
      historico JSONB NOT NULL DEFAULT '[]'::jsonb,
      finalizado BOOLEAN NOT NULL DEFAULT false
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS follow_up_contatos_tenant_idx ON follow_up_contatos (tenant_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS follow_up_arquivos_tenant_ordem_idx ON follow_up_arquivos (tenant_id, ordem);`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Follow Up:', err.message);
});


// ---------- prompts recomendados (botao "usar recomendado" na aba Follow Up) ----------

export const ETIQUETA_RESGATE = 'Resgate do Follow Up';

export const PROMPT_GERAL_RECOMENDADO = `Você é a assistente de relacionamento da clínica no WhatsApp. Seu trabalho é retomar o contato com quem parou de responder, faltou ou não concluiu o agendamento. Fale como uma pessoa real da recepção: calorosa, curta e natural.

OBJETIVO: fazer a pessoa responder e voltar a falar do tratamento. Não pressione nem venda na primeira mensagem.

FORMA
- 1 a 3 frases, sem markdown, sem lista, no máximo 1 emoji.
- Use o primeiro nome. Não repita a abertura de tentativas anteriores (veja o histórico).
- Termine sempre com UMA pergunta fácil de responder.
- Nunca invente fatos, preços, vagas, promoções ou prazos. Só use escassez ou urgência que esteja nas instruções da tentativa ou nas notas da equipe.
- Não dê diagnóstico nem prometa resultado. Dúvida clínica: convide para avaliação.
- Se pedir para parar ou disser que não tem interesse, agradeça com educação e encerre.

ESCALADA
1ª tentativa (1 dia): leve e curiosa, "ficou alguma dúvida?".
2ª (3 dias): facilitar (horário, forma de pagamento, avaliação).
3ª (7 dias): valor e consequência real de adiar, sem dramatizar.
4ª (15 dias): urgência ou escassez real, se existir; senão cuidado e prova social verdadeira.
5ª (30 dias): despedida gentil com porta aberta.

INTERESSE REAL (true): pede horário ou valor, pergunta sobre o tratamento, diz "quero", "pode", "me explica", explica por que sumiu e continua a conversa.
NÃO é interesse (false): recusa, engano, pergunta quem é e some, "depois eu vejo" sem abertura.`;

export const PROMPT_RESGATE_RECOMENDADO = `MODO RESGATE: esta pessoa já demonstrou interesse, não concluiu (faltou, sumiu ou deixou de agendar) e acabou de voltar a conversar. Seu papel é descobrir o que a travou, desfazer isso e remarcar. Uma etapa por mensagem, sem pular.

1. ACOLHA sem cobrar: agradeça o retorno, normalize ("acontece com todo mundo"), zero culpa.
2. DESCUBRA a objeção real com UMA pergunta aberta: "Posso te perguntar o que pesou mais pra você não conseguir vir? Foi horário, valor, receio do procedimento ou outra coisa?" Se vier vago, aprofunde: "e se isso estivesse resolvido, você viria?".
3. QUEBRE a objeção (valide, reenquadre, prove, proponha):
   - Preço: condições e parcelamento reais; o custo de esperar (problema que piora, tratamento mais longo).
   - Medo ou dor: como é o primeiro passo, conforto, anestesia, conversa com a dentista.
   - Tempo: horários flexíveis, consulta objetiva; pergunte o melhor dia e turno.
   - Dúvida ou confiança: avaliação sem compromisso; depoimentos só se existirem nos materiais.
   - "Vou ver com alguém": convide a pessoa e ofereça horário para os dois.
4. URGÊNCIA E ESCASSEZ HONESTAS: (a) a dor ou o risco real de adiar, em linguagem simples, sem terror; (b) escassez só se for verdadeira (poucos horários na semana, condição com data). Sem dado real, use o tempo: "a avaliação leva poucos minutos e já define o próximo passo".
5. FECHE com duas opções concretas: "Consigo quinta às 14h ou sexta às 9h, qual fica melhor?". Ofereça só horários que a agenda mostrar. Confirme nome, dia, hora e endereço.
6. Se agendou: confirme e tire atritos. Se resistir de novo: volte ao passo 2 com outra pergunta, no máximo 3 tentativas; depois agradeça, deixe a porta aberta e avise a equipe.

LIMITES: nada de mentira, culpa, ameaça ou promessa de cura. Uma pergunta por mensagem, 1 a 3 frases, tom caloroso, sem markdown. Se pedir para parar, encerre com educação.`;

// bloco injetado no Auto Atendimento enquanto o contato tem a etiqueta de resgate (e o modo esta ligado)
export async function posturaResgate(tenantId, numero, instancia) {
  const config = await obterConfig(tenantId);
  if (!config.modoResgate) return '';
  if (!(await crm.temEtiqueta(tenantId, { numero, instancia }, ETIQUETA_RESGATE))) return '';
  return `\n\n[POSTURA DE RESGATE - este contato foi reativado pelo Follow Up e esta etiquetado "${ETIQUETA_RESGATE}". Siga esta postura nas suas respostas, alem das regras gerais:]\n${config.promptResgate || PROMPT_RESGATE_RECOMENDADO}`;
}

// ---------- configuracao geral ----------

const HORA_PADRAO_INICIO = '08:00';
const HORA_PADRAO_FIM = '20:00';
const RECOMENDADOS = () => ({ promptGeral: PROMPT_GERAL_RECOMENDADO, promptResgate: PROMPT_RESGATE_RECOMENDADO });
const CONFIG_VAZIA = { ativo: false, promptGeral: '', horaInicio: HORA_PADRAO_INICIO, horaFim: HORA_PADRAO_FIM, modoResgate: false, promptResgate: '', etiquetaResgate: ETIQUETA_RESGATE };

export async function obterConfig(tenantId) {
  if (!pool) return { ...CONFIG_VAZIA, recomendados: RECOMENDADOS() };
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ativo, prompt_geral, hora_inicio, hora_fim, modo_resgate, prompt_resgate FROM follow_up_config WHERE tenant_id = $1`, [tenantId]);
  if (!rows.length) return { ...CONFIG_VAZIA, recomendados: RECOMENDADOS() };
  return {
    ativo: !!rows[0].ativo,
    promptGeral: rows[0].prompt_geral || '',
    horaInicio: rows[0].hora_inicio || HORA_PADRAO_INICIO,
    horaFim: rows[0].hora_fim || HORA_PADRAO_FIM,
    modoResgate: !!rows[0].modo_resgate,
    promptResgate: rows[0].prompt_resgate || '',
    etiquetaResgate: ETIQUETA_RESGATE,
    recomendados: RECOMENDADOS(),
  };
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function salvarConfig(tenantId, { ativo, promptGeral, horaInicio, horaFim, modoResgate, promptResgate }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hi = horaInicio || HORA_PADRAO_INICIO;
  const hf = horaFim || HORA_PADRAO_FIM;
  if (!HORA_RE.test(hi) || !HORA_RE.test(hf)) throw new Error('Horario invalido (use o formato HH:MM).');
  if (hi >= hf) throw new Error('O horario de inicio precisa ser antes do horario de fim.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_config (tenant_id, ativo, prompt_geral, hora_inicio, hora_fim, modo_resgate, prompt_resgate, atualizado_em) VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, ''), now())
     ON CONFLICT (tenant_id) DO UPDATE SET ativo = $2, prompt_geral = $3, hora_inicio = $4, hora_fim = $5,
       modo_resgate = COALESCE($6, follow_up_config.modo_resgate), prompt_resgate = COALESCE($7, follow_up_config.prompt_resgate), atualizado_em = now()`,
    [tenantId, !!ativo, promptGeral || '', hi, hf, modoResgate === undefined ? null : !!modoResgate, promptResgate === undefined ? null : String(promptResgate).slice(0, 8000)],
  );
}

// fuso fixo America/Maceio (mesmo padrao usado no resto do app - relatoriosProgramados.js,
// autoAtendimento.js) - true quando o horario ATUAL esta dentro do expediente configurado
function dentroDoHorarioFuncionamento(config) {
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
  return horaAtual >= (config.horaInicio || HORA_PADRAO_INICIO) && horaAtual < (config.horaFim || HORA_PADRAO_FIM);
}

// ---------- etapas (as "tentativas" configuraveis: a cada quantos dias, com que script) ----------

// sempre devolve as 5 tentativas, mesmo que o tenant nunca tenha salvo nada ainda (usa os
// padroes: 1, 3, 7, 15, 30 dias) - assim o painel sempre tem o que mostrar de cara
export async function listarEtapas(tenantId) {
  if (!pool) return ETAPAS_PADRAO.map((e) => ({ ...e, ativo: true, prompt: '' }));
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ordem, dias, ativo, prompt FROM follow_up_etapas WHERE tenant_id = $1`, [tenantId]);
  const porOrdem = new Map(rows.map((r) => [r.ordem, r]));
  return ETAPAS_PADRAO.map((padrao) => {
    const salvo = porOrdem.get(padrao.ordem);
    return salvo
      ? { ordem: padrao.ordem, dias: salvo.dias, ativo: salvo.ativo, prompt: salvo.prompt || '' }
      : { ordem: padrao.ordem, dias: padrao.dias, ativo: true, prompt: '' };
  });
}

export async function salvarEtapa(tenantId, ordem, { dias, ativo, prompt }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const ordemNum = Number(ordem);
  if (!ORDENS_VALIDAS.has(ordemNum)) throw new Error(`Etapa invalida: "${ordem}"`);
  const diasNum = Number(dias);
  if (!Number.isFinite(diasNum) || diasNum <= 0) throw new Error('Numero de dias precisa ser maior que zero.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_etapas (tenant_id, ordem, dias, ativo, prompt) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, ordem) DO UPDATE SET dias = $3, ativo = $4, prompt = $5`,
    [tenantId, ordemNum, diasNum, !!ativo, prompt || ''],
  );
}

// ---------- arquivos por etapa (imagem/pdf/video mandados junto da mensagem daquela tentativa) ----------

export async function listarArquivos(tenantId, ordem) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome_arquivo, media_type, octet_length(conteudo) AS tamanho, criado_em
     FROM follow_up_arquivos WHERE tenant_id = $1 AND ordem = $2 ORDER BY criado_em DESC`,
    [tenantId, Number(ordem)],
  );
  return rows;
}

export async function salvarArquivo(tenantId, ordem, nomeArquivo, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const ordemNum = Number(ordem);
  if (!ORDENS_VALIDAS.has(ordemNum)) throw new Error(`Etapa invalida: "${ordem}"`);
  await tabelasProntas;
  const { rows } = await pool.query(
    `INSERT INTO follow_up_arquivos (tenant_id, ordem, nome_arquivo, media_type, conteudo) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, ordemNum, nomeArquivo, mediaType, buffer],
  );
  return rows[0].id;
}

export async function apagarArquivo(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await pool.query(`DELETE FROM follow_up_arquivos WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

async function obterArquivosComConteudo(tenantId, ordem) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT nome_arquivo, media_type, conteudo FROM follow_up_arquivos WHERE tenant_id = $1 AND ordem = $2`,
    [tenantId, ordem],
  );
  return rows;
}

async function enviarArquivoParaContato(instancia, numero, arquivo) {
  const base64 = arquivo.conteudo.toString('base64');
  if (arquivo.media_type.startsWith('audio/')) {
    await evolutionApi.enviarAudio(instancia, numero, base64);
    return;
  }
  const mediatype = arquivo.media_type.startsWith('image/') ? 'image' : arquivo.media_type.startsWith('video/') ? 'video' : 'document';
  await evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arquivo.media_type, media: base64, fileName: arquivo.nome_arquivo });
}

// ---------- ciclo de vida do acompanhamento por contato (chamado pela rota de mudar etapa) ----------

// chamado quando um card e arrastado PRA "follow_up" - idempotente: se o contato ja tiver um
// registro antigo (follow up anterior, ja finalizado), reseta pra comecar as tentativas do zero
export async function iniciarAcompanhamento(tenantId, contatoId) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_contatos (contato_id, tenant_id, entrou_em, ultima_etapa_enviada, ultima_etapa_enviada_em, historico, finalizado)
     VALUES ($1, $2, now(), 0, NULL, '[]'::jsonb, false)
     ON CONFLICT (contato_id) DO UPDATE SET
       entrou_em = now(), ultima_etapa_enviada = 0, ultima_etapa_enviada_em = NULL, historico = '[]'::jsonb, finalizado = false`,
    [contatoId, tenantId],
  );
}

// chamado quando um card SAI da coluna "follow_up" (pra qualquer outra) - para o agendador de
// mandar mais tentativas pra esse contato. No-op silencioso se nunca teve registro.
export async function encerrarAcompanhamento(tenantId, contatoId) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE follow_up_contatos SET finalizado = true WHERE contato_id = $1 AND tenant_id = $2`, [contatoId, tenantId]);
}

// ---------- geracao de mensagem (IA) ----------

const TOOL_GERAR_MENSAGEM = {
  name: 'entregar_mensagem_followup',
  description: 'Entrega o texto da mensagem de reengajamento a ser enviada agora pro contato.',
  input_schema: {
    type: 'object',
    properties: { mensagem: { type: 'string', description: 'Texto pronto pra mandar por WhatsApp - direto, sem markdown/asterisco' } },
    required: ['mensagem'],
  },
};

const TOOL_RESPONDER_E_ANALISAR = {
  name: 'responder_e_analisar',
  description: 'Entrega a resposta pro contato e a analise se ele demonstrou interesse real em retomar o assunto.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: { type: 'string', description: 'Texto de resposta pro contato - direto, sem markdown/asterisco' },
      demonstrouInteresse: {
        type: 'boolean',
        description: 'true se o contato demonstrou interesse REAL em retomar (quer agendar, tira duvida de verdade sobre o servico, pede pra continuar a conversa) - false se for recusa, desinteresse claro, ou resposta que nao indica intencao de prosseguir (ex: "quem e voce", engano, silencio depois disso).',
      },
    },
    required: ['resposta', 'demonstrouInteresse'],
  },
};

function formatarHistorico(historico) {
  if (!historico?.length) return '(nenhuma mensagem trocada ainda nesse acompanhamento)';
  return historico.slice(-8).map((h) => `[${h.autor === 'lumia' ? 'Voce (Lumia)' : 'Contato'}] ${h.texto}`).join('\n');
}

async function gerarMensagemEtapa({ tenantId, config, etapa, contato, historico }) {
  const notasEquipe = await crm.notasParaIA(tenantId, { contatoId: contato.contato_id || contato.id }).catch(() => '');
  const texto = `${config.promptGeral}\n\n` +
    `Voce esta tentando reengajar um contato que parou de responder ha ${etapa.dias} dia(s) - essa e a tentativa numero ${etapa.ordem} de reengajamento.` +
    (etapa.prompt ? `\n\nInstrucoes especificas pra essa tentativa: ${etapa.prompt}` : '') +
    `\n\nNome do contato (se souber): ${contato.nome || 'nao informado'}` +
    notasEquipe +
    `\n\nHistorico do acompanhamento ate agora:\n${formatarHistorico(historico)}` +
    `\n\nEscreva agora a mensagem a ser enviada pra tentar retomar o contato.`;

  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    tools: [TOOL_GERAR_MENSAGEM], tool_choice: { type: 'tool', name: 'entregar_mensagem_followup' },
    messages: [{ role: 'user', content: texto }],
    _uso: { tenantId, modulo: 'follow-up' },
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu gerar a mensagem de follow up');
  return toolUse.input.mensagem;
}

// ---------- resposta reativa (o lead respondeu enquanto esta na coluna Follow Up) ----------

// chamado pelo webhook do WhatsApp (server.js) quando a mensagem chega de um contato cujo card
// esta na coluna "follow_up" - substitui completamente o autoAtendimento.processarMensagem
// nesse caso (ver checagem em server.js). Devolve null se o Follow Up nao estiver ativo/
// configurado (o webhook entao simplesmente nao responde nada).
export async function processarMensagem(tenantId, contatoId, numero, instancia, { texto, tipo }) {
  const config = await obterConfig(tenantId);
  if (!config.ativo || !config.promptGeral) return null;
  await tabelasProntas;

  await iniciarAcompanhamento(tenantId, contatoId); // idempotente - garante que ha registro mesmo se o lead respondeu antes de qualquer tentativa automatica

  const { rows } = await pool.query(`SELECT * FROM follow_up_contatos WHERE contato_id = $1 AND tenant_id = $2`, [contatoId, tenantId]);
  const registro = rows[0];
  const historico = registro?.historico || [];

  let textoContato = texto || '';
  if (!textoContato.trim()) {
    textoContato = tipo === 'image' ? '[o contato mandou uma imagem sem legenda]'
      : tipo === 'audio' ? '[o contato mandou um audio]'
      : tipo === 'video' ? '[o contato mandou um video]'
      : '';
  }
  if (!textoContato.trim()) return null;

  // fora do horario de funcionamento configurado - guarda a mensagem no historico (o contexto
  // nao se perde) mas NAO gera nem manda resposta agora, pra nao incomodar o paciente de
  // madrugada ou fora do expediente. Quando ele escrever de novo dentro do horario, o agente ve
  // essa mensagem no historico e retoma normalmente.
  if (!dentroDoHorarioFuncionamento(config)) {
    const historicoComEspera = [...historico, { autor: 'contato', texto: textoContato, quando: new Date().toISOString() }];
    await pool.query(`UPDATE follow_up_contatos SET historico = $1 WHERE contato_id = $2 AND tenant_id = $3`, [JSON.stringify(historicoComEspera), contatoId, tenantId]);
    return null;
  }

  const etapas = await listarEtapas(tenantId);
  const etapaAtual = etapas.find((e) => e.ordem === (registro?.ultima_etapa_enviada || 0));

  const notasEquipe = await crm.notasParaIA(tenantId, { contatoId }).catch(() => '');
  const prompt = `${config.promptGeral}\n\n` +
    `Voce esta acompanhando um lead que estava sem responder, dentro de um fluxo de reengajamento.` +
    (etapaAtual?.prompt ? `\n\nInstrucoes da tentativa atual: ${etapaAtual.prompt}` : '') +
    notasEquipe +
    `\n\nHistorico do acompanhamento ate agora:\n${formatarHistorico(historico)}` +
    (config.modoResgate
      ? `\n\nMODO RESGATE LIGADO: se o contato demonstrar interesse real (demonstrouInteresse = true), a sua resposta JA deve seguir a postura abaixo, comecando pelas etapas 1 e 2 (acolher e descobrir a objecao com UMA pergunta), sem oferecer horario ainda. Se nao houver interesse, ignore a postura e responda normalmente.\n\n${config.promptResgate || PROMPT_RESGATE_RECOMENDADO}`
      : '') +
    `\n\nO contato acabou de responder: "${textoContato}"` +
    `\n\nEscreva uma resposta natural pra essa mensagem e decida se ele demonstrou interesse real em retomar o assunto.`;

  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: config.modoResgate ? 900 : 600,
    tools: [TOOL_RESPONDER_E_ANALISAR], tool_choice: { type: 'tool', name: 'responder_e_analisar' },
    messages: [{ role: 'user', content: prompt }],
    _uso: { tenantId, modulo: 'follow-up' },
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) return null;
  const { resposta, demonstrouInteresse } = toolUse.input;

  const novoHistorico = [
    ...historico,
    { autor: 'contato', texto: textoContato, quando: new Date().toISOString() },
    { autor: 'lumia', texto: resposta, quando: new Date().toISOString() },
  ];
  await pool.query(`UPDATE follow_up_contatos SET historico = $1 WHERE contato_id = $2 AND tenant_id = $3`, [JSON.stringify(novoHistorico), contatoId, tenantId]);

  if (demonstrouInteresse) {
    if (config.modoResgate) await crm.adicionarEtiqueta(tenantId, contatoId, ETIQUETA_RESGATE).catch((err) => console.error('Follow Up: falha ao etiquetar resgate:', err.message));
    await crm.moverEtapa(tenantId, contatoId, 'em_atendimento');
    await encerrarAcompanhamento(tenantId, contatoId);
  }

  return { texto: resposta };
}

// ---------- agendador (envio proativo das tentativas, na cadencia configurada) ----------

async function processarContato(tenantId, contato, etapas, config) {
  // fora do horario de funcionamento - nao manda tentativa nenhuma agora; o proprio agendador
  // (roda a cada 15min) pega essa tentativa vencida assim que o horario configurado abrir
  if (!dentroDoHorarioFuncionamento(config)) return;
  // Instagram so deixa mandar mensagem ate 24h depois da ultima da pessoa - a cadencia de dias
  // do Follow Up nao funciona la
  if (String(contato.instancia).startsWith('ig:')) return;

  const diasDesdeEntrada = (Date.now() - new Date(contato.entrou_em).getTime()) / (24 * 60 * 60 * 1000);
  const ultimaOrdem = contato.ultima_etapa_enviada || 0;

  const proxima = etapas.find((e) => e.ordem > ultimaOrdem && e.ativo && diasDesdeEntrada >= e.dias);
  if (proxima) {
    const historico = contato.historico || [];
    const mensagem = await gerarMensagemEtapa({ tenantId, config, etapa: proxima, contato, historico });
    await evolutionApi.enviarMensagemTextoPor(contato.instancia, contato.numero, mensagem);
    await crm.registrarMensagem(tenantId, { numero: contato.numero, instancia: contato.instancia, direcao: 'saida', tipo: 'text', texto: mensagem, autor: 'followup', agente: 'lua' });

    const anexos = await obterArquivosComConteudo(tenantId, proxima.ordem);
    for (const anexo of anexos) {
      try {
        await enviarArquivoParaContato(contato.instancia, contato.numero, anexo);
      } catch (err) {
        console.error(`Erro mandando anexo da etapa ${proxima.ordem} do follow up:`, err.message);
      }
    }

    const novoHistorico = [...historico, { autor: 'lumia', etapa: proxima.ordem, texto: mensagem, quando: new Date().toISOString() }];
    await pool.query(
      `UPDATE follow_up_contatos SET ultima_etapa_enviada = $1, ultima_etapa_enviada_em = now(), historico = $2 WHERE contato_id = $3 AND tenant_id = $4`,
      [proxima.ordem, JSON.stringify(novoHistorico), contato.contato_id, tenantId],
    );
    return;
  }

  // ja mandou a ultima tentativa ativa configurada? da uma folga e desiste (move pra "perdido")
  const ultimaAtiva = [...etapas].reverse().find((e) => e.ativo);
  if (ultimaAtiva && ultimaOrdem >= ultimaAtiva.ordem && contato.ultima_etapa_enviada_em) {
    const diasDesdeUltimoEnvio = (Date.now() - new Date(contato.ultima_etapa_enviada_em).getTime()) / (24 * 60 * 60 * 1000);
    if (diasDesdeUltimoEnvio >= DIAS_FOLGA_ANTES_DE_DESISTIR) {
      await crm.moverEtapa(tenantId, contato.contato_id, 'perdido');
      await encerrarAcompanhamento(tenantId, contato.contato_id);
    }
  }
}

// roda em segundo plano - a cada 15min, PRA CADA TENANT com Follow Up ativado, checa cada
// contato ainda na coluna "follow_up" e manda a proxima tentativa vencida (se houver). So
// chamado uma vez, no boot do server.js.
export function iniciarSchedulerFollowUp() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;

      const { rows: tenantsAtivos } = await pool.query(`SELECT f.tenant_id FROM follow_up_config f JOIN tenants t ON t.id = f.tenant_id WHERE f.ativo = true AND (t.ativo OR t.super_admin)`);
      if (!tenantsAtivos.length) return;

      for (const { tenant_id: tenantId } of tenantsAtivos) {
        try {
          const config = await obterConfig(tenantId);
          if (!config.ativo || !config.promptGeral) continue;
          const etapas = await listarEtapas(tenantId);

          const { rows: contatos } = await pool.query(
            `SELECT fc.contato_id, fc.entrou_em, fc.ultima_etapa_enviada, fc.ultima_etapa_enviada_em, fc.historico,
                    c.numero, c.instancia, c.nome
             FROM follow_up_contatos fc
             JOIN crm_contatos c ON c.id = fc.contato_id
             WHERE fc.tenant_id = $1 AND fc.finalizado = false AND c.etapa = 'follow_up'`,
            [tenantId],
          );

          for (const contato of contatos) {
            try {
              await processarContato(tenantId, contato, etapas, config);
            } catch (err) {
              console.error(`Erro no follow up do contato ${contato.contato_id} (tenant ${tenantId}):`, err.message);
            }
            await new Promise((r) => setTimeout(r, 3000)); // pausa curta entre contatos, evita rajada de chamadas
          }
        } catch (err) {
          console.error(`Erro no follow up do tenant ${tenantId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando follow up:', err.message);
    }
  };
  setInterval(checar, 15 * 60 * 1000).unref();
}
