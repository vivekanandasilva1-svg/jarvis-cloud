import Anthropic from '@anthropic-ai/sdk';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Voce e o Jarvis, assistente pessoal do usuario (dono de uma clinica
odontologica e da Lumia, agencia de trafego pago), conversando por uma interface de chat
(texto e voz) num app web publico.
Responda de forma curta e direta - isto vai ser lido e tambem falado em voz alta, entao evite
listas longas ou markdown pesado, prefira frases corridas.
Sempre use as ferramentas disponiveis para agir de verdade - nunca finja ter feito algo.

Voce tem acesso ao Gerenciador de Anuncios da Meta (contas de clinicas odontologicas e outros
clientes da Lumia). Pode consultar contas, campanhas, conjuntos de anuncios, anuncios/criativos
e metricas livremente. Quando pedirem analise ou diagnostico de campanha, use
ads_diagnostico_campanha e de uma leitura profissional dos resultados (o que pausar, ajustar ou
testar), nao so liste numeros.

Ferramentas de anuncio que envolvem gastar dinheiro real (ativar campanha, mudar orcamento,
criar campanha) NAO executam na hora - elas ficam pendentes de confirmacao e o proprio sistema
vai perguntar "sim ou nao" pro usuario. So chame essas ferramentas quando o pedido do usuario ja
estiver claro o suficiente para perguntar a confirmacao (valor, campanha exatos).

Voce tambem tem acesso ao sistema Clinicorp da clinica (agenda, pacientes, financeiro,
orcamentos). O usuario ja autorizou usar essas ferramentas livremente, incluindo criar/cancelar
agendamentos e cadastrar pacientes, sem precisar confirmar cada chamada - execute direto quando
o pedido for claro. So avise (sem bloquear) se for algo de volume/impacto incomum, como cancelar
varios agendamentos de uma vez.`;

function systemPromptComHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${SYSTEM_PROMPT}\n\nA data de hoje e ${hoje} (fuso horario de Maceio/Brasil). Use isso para calcular "hoje", "ontem", "essa semana" etc sem precisar perguntar ao usuario.`;
}

const tools = [
  {
    name: 'ads_listar_contas',
    description: 'Lista todas as contas de anuncio da Meta (Facebook/Instagram Ads) que o usuario gerencia, com nome, id e cliente.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ads_listar_campanhas',
    description: 'Lista as campanhas de uma conta de anuncio especifica.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Id da conta de anuncio (ex: act_123456 ou so 123456)' },
        status: { type: 'string', description: 'Filtrar por status (ex: ACTIVE, PAUSED)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'ads_listar_adsets',
    description: 'Lista os conjuntos de anuncios (ad sets) de uma campanha, com orcamento e status.',
    input_schema: {
      type: 'object',
      properties: { campaignId: { type: 'string', description: 'Id da campanha' } },
      required: ['campaignId'],
    },
  },
  {
    name: 'ads_consultar_metricas',
    description: 'Consulta metricas de performance (gasto, impressoes, cliques, resultados) de uma conta, campanha, conjunto de anuncios ou anuncio individual.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Id do objeto (conta, campanha, ad set ou anuncio)' },
        objectType: { type: 'string', description: '"account", "campaign", "adset" ou "ad"' },
        since: { type: 'string', description: 'Data inicial YYYY-MM-DD (opcional)' },
        until: { type: 'string', description: 'Data final YYYY-MM-DD (opcional)' },
        datePreset: { type: 'string', description: 'Ex: today, yesterday, last_7d, last_30d' },
      },
      required: ['objectId', 'objectType'],
    },
  },
  {
    name: 'ads_listar_anuncios',
    description: 'Lista os anuncios (nivel criativo: titulo, texto, miniatura) dentro de um conjunto de anuncios.',
    input_schema: {
      type: 'object',
      properties: { adSetId: { type: 'string', description: 'Id do conjunto de anuncios' } },
      required: ['adSetId'],
    },
  },
  {
    name: 'ads_diagnostico_campanha',
    description: 'Analise comparativa de performance entre os anuncios de uma campanha - calcula a media do grupo e aponta quais anuncios estao performando pior e por que. Use para pedidos de analise/diagnostico/melhoria.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Id da campanha' },
        since: { type: 'string', description: 'Data inicial YYYY-MM-DD (opcional)' },
        until: { type: 'string', description: 'Data final YYYY-MM-DD (opcional)' },
        datePreset: { type: 'string', description: 'Ex: today, yesterday, last_7d, last_30d' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'ads_criar_campanha',
    description: 'Pede para criar uma campanha nova (sempre em PAUSED - nao gasta ate ter conjunto de anuncios e ser ativada). Fica pendente de confirmacao.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Id da conta de anuncio' },
        name: { type: 'string', description: 'Nome da campanha' },
        objective: { type: 'string', description: 'Objetivo (ex: OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT)' },
      },
      required: ['accountId', 'name', 'objective'],
    },
  },
  {
    name: 'ads_alterar_status_campanha',
    description: 'Pede para ativar, pausar ou arquivar uma campanha. Fica pendente de confirmacao, pois ativar gasta dinheiro real.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Id da campanha' },
        status: { type: 'string', description: 'ACTIVE, PAUSED ou ARCHIVED' },
      },
      required: ['campaignId', 'status'],
    },
  },
  {
    name: 'ads_alterar_orcamento_adset',
    description: 'Pede para mudar o orcamento diario de um conjunto de anuncios. Fica pendente de confirmacao.',
    input_schema: {
      type: 'object',
      properties: {
        adSetId: { type: 'string', description: 'Id do conjunto de anuncios' },
        dailyBudgetReais: { type: 'number', description: 'Novo orcamento diario em reais' },
      },
      required: ['adSetId', 'dailyBudgetReais'],
    },
  },
  {
    name: 'clinicorp_listar_profissionais',
    description: 'Lista os profissionais/dentistas cadastrados na clinica.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'clinicorp_listar_agendamentos',
    description: 'Lista os agendamentos da clinica num periodo (agenda geral, ou de um paciente/profissional especifico).',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        patientId: { type: 'integer', description: 'Filtrar por id de paciente (opcional)' },
        includeCanceled: { type: 'boolean', description: 'Incluir agendamentos cancelados (default false)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'clinicorp_buscar_paciente',
    description: 'Busca um paciente existente pelo telefone, nome, CPF ou email.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Telefone ou celular do paciente' },
        name: { type: 'string', description: 'Nome do paciente' },
        document: { type: 'string', description: 'CPF do paciente' },
        email: { type: 'string', description: 'Email do paciente' },
      },
    },
  },
  {
    name: 'clinicorp_criar_paciente',
    description: 'Cria um novo paciente no sistema da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome completo do paciente' },
        mobilePhone: { type: 'string', description: 'Celular do paciente' },
        email: { type: 'string', description: 'Email do paciente' },
        birthDate: { type: 'string', description: 'Data de nascimento YYYY-MM-DD' },
        document: { type: 'string', description: 'CPF do paciente' },
      },
      required: ['name'],
    },
  },
  {
    name: 'clinicorp_criar_agendamento',
    description: 'Cria um novo agendamento na agenda da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: { type: 'integer', description: 'Id do paciente, se ja conhecido' },
        patientName: { type: 'string', description: 'Nome do paciente' },
        mobilePhone: { type: 'string', description: 'Telefone de contato' },
        email: { type: 'string', description: 'Email de contato' },
        date: { type: 'string', description: 'Data YYYY-MM-DD' },
        fromTime: { type: 'string', description: 'Horario de inicio HH:mm' },
        toTime: { type: 'string', description: 'Horario de termino HH:mm' },
        procedures: { type: 'string', description: 'Procedimentos, ex: Limpeza, Consulta' },
      },
      required: ['patientName', 'date', 'fromTime', 'toTime'],
    },
  },
  {
    name: 'clinicorp_cancelar_agendamento',
    description: 'Cancela um agendamento existente pelo id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id do agendamento a cancelar' } },
      required: ['id'],
    },
  },
  {
    name: 'clinicorp_faturamento',
    description: 'Consulta o resumo financeiro da clinica (vendas, recebido, despesas) num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
];

const CONFIRM_TOOLS = new Set(['ads_criar_campanha', 'ads_alterar_status_campanha', 'ads_alterar_orcamento_adset']);

function describePendingAction(name, input) {
  switch (name) {
    case 'ads_criar_campanha':
      return `criar a campanha "${input.name}" (objetivo ${input.objective}) na conta ${input.accountId} - ela nasce pausada, nao gasta nada ainda`;
    case 'ads_alterar_status_campanha':
      return `mudar o status da campanha ${input.campaignId} para ${input.status}${input.status === 'ACTIVE' ? ' - isso passa a gastar dinheiro real' : ''}`;
    case 'ads_alterar_orcamento_adset':
      return `mudar o orcamento diario do conjunto ${input.adSetId} para R$${input.dailyBudgetReais}/dia`;
    default:
      return JSON.stringify(input);
  }
}

async function executeConfirmedAction(name, input) {
  switch (name) {
    case 'ads_criar_campanha':
      return metaAds.createCampaign(input);
    case 'ads_alterar_status_campanha':
      return metaAds.updateCampaignStatus(input);
    case 'ads_alterar_orcamento_adset':
      return metaAds.updateAdSetBudget({ adSetId: input.adSetId, dailyBudgetCents: Math.round(input.dailyBudgetReais * 100) });
    default:
      throw new Error(`Acao desconhecida: ${name}`);
  }
}

const toolHandlers = {
  ads_listar_contas: () => metaAds.listAdAccounts(),
  ads_listar_campanhas: ({ accountId, status }) => metaAds.listCampaigns({ accountId, status }),
  ads_listar_adsets: ({ campaignId }) => metaAds.listAdSets({ campaignId }),
  ads_consultar_metricas: ({ objectId, objectType, since, until, datePreset }) => metaAds.getInsights({ objectId, objectType, since, until, datePreset }),
  ads_listar_anuncios: ({ adSetId }) => metaAds.listAds({ adSetId }),
  ads_diagnostico_campanha: ({ campaignId, since, until, datePreset }) => metaAds.analyzeCampaignAds({ campaignId, since, until, datePreset }),
  clinicorp_listar_profissionais: () => clinicorp.listProfessionals(),
  clinicorp_listar_agendamentos: async ({ from, to, patientId, includeCanceled }) => {
    const appointments = await clinicorp.listAppointments({
      from, to, patientId, includeCanceled: includeCanceled ? 'X' : undefined,
    });
    // a API devolve registros enormes (notas longas, dezenas de campos internos) - resume
    // antes de mandar pro modelo, senao estoura o limite de tokens da resposta
    return {
      total: appointments.length,
      agendamentos: appointments.map((a) => ({
        id: a.id,
        paciente: a.PatientName,
        telefone: a.MobilePhone,
        de: a.fromTime,
        ate: a.toTime,
        dentistaId: a.Dentist_PersonId,
        statusId: a.StatusId,
        categoria: a.CategoryDescription,
        cancelado: a.Canceled === 'X',
        motivoCancelamento: a.Canceled === 'X' ? a.CancelReason : undefined,
      })),
    };
  },
  clinicorp_buscar_paciente: ({ phone, name, document, email }) => clinicorp.findPatient({ phone, name, document, email }),
  clinicorp_criar_paciente: ({ name, mobilePhone, email, birthDate, document }) =>
    clinicorp.createPatient({ name, mobilePhone, email, birthDate, otherDocumentId: document }),
  clinicorp_criar_agendamento: (input) => clinicorp.createAppointment(input),
  clinicorp_cancelar_agendamento: ({ id }) => clinicorp.cancelAppointment({ id }),
  clinicorp_faturamento: async ({ from, to }) => {
    const resumo = await clinicorp.getFinancialSummary({ from, to });
    // so os totais - o detalhamento linha a linha e enorme e nao cabe no limite de tokens
    return {
      de: resumo.From,
      ate: resumo.To,
      totalVendas: resumo.TotalSales,
      totalRecebido: resumo.TotalIncome,
      totalDespesas: resumo.TotalExpenses,
    };
  },
};

async function runTool(name, input, session) {
  if (CONFIRM_TOOLS.has(name)) {
    session.pendingAction = { name, input };
    return {
      status: 'aguardando_confirmacao',
      mensagem: `Preciso da sua confirmacao para ${describePendingAction(name, input)}. Responda "sim" ou "nao".`,
    };
  }

  const handler = toolHandlers[name];
  if (!handler) return { erro: `Ferramenta desconhecida: ${name}` };
  try {
    return await handler(input);
  } catch (err) {
    return { erro: err.message };
  }
}

function extractText(response) {
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

async function callClaude(history) {
  return anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    system: systemPromptComHoje(),
    tools,
    messages: history,
  });
}

const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, { history: [], pendingAction: null });
  return sessions.get(sessionId);
}

const MAX_TOOL_ROUNDS = 10;
const MAX_HISTORY = 40;

export async function chat(sessionId, userMessage) {
  const session = getSession(sessionId);

  if (session.pendingAction) {
    const { name, input } = session.pendingAction;
    const positivo = /^\s*s(im)?\b/i.test(userMessage);
    const negativo = /^\s*n(ã|a)?o?\b/i.test(userMessage);

    if (positivo) {
      session.pendingAction = null;
      let resultado;
      try {
        resultado = await executeConfirmedAction(name, input);
      } catch (err) {
        resultado = { erro: err.message };
      }
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({
        role: 'user',
        content: `[Sistema] A acao foi confirmada pelo usuario e executada. Resultado: ${JSON.stringify(resultado)}. Informe o usuario do resultado de forma natural.`,
      });
      const response = await callClaude(session.history);
      const replyText = extractText(response);
      session.history.push({ role: 'assistant', content: replyText });
      return replyText;
    }

    if (negativo) {
      session.pendingAction = null;
      const msg = 'Ok, cancelado.';
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({ role: 'assistant', content: msg });
      return msg;
    }

    session.pendingAction = null;
  }

  session.history.push({ role: 'user', content: userMessage });
  let response = await callClaude(session.history);

  let rounds = 0;
  while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
    session.history.push({ role: 'assistant', content: response.content });

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const result = await runTool(block.name, block.input, session);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    session.history.push({ role: 'user', content: toolResults });

    response = await callClaude(session.history);
    rounds += 1;

    if (session.pendingAction) break;
  }

  const replyText = extractText(response) || 'Consegui os dados mas nao terminei de formular a resposta - pode perguntar de novo, talvez de forma mais especifica (ex: um periodo menor)?';
  session.history.push({ role: 'assistant', content: replyText });

  if (session.history.length > MAX_HISTORY) {
    session.history.splice(0, session.history.length - MAX_HISTORY);
  }

  return replyText;
}
