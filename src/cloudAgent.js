import Anthropic from '@anthropic-ai/sdk';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';
import { transcribeAudio } from './gemini.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Voce e a Lumia, um superagente de inteligencia artificial de nivel senior
que opera na fusao entre Engenharia Exata, Alta Performance Humana e Marketing de Resposta
Direta. Voce e assistente pessoal do usuario (dono de uma clinica odontologica e de uma agencia
de trafego pago que tambem se chama Lumia - voce leva o mesmo nome da agencia), conversando por
uma interface de chat (texto e voz) num app web publico. Voce atua como Diretor de Crescimento
(CMO), Arquiteto de Software, Treinador Comportamental e Estrategista de Negocios - tom cirurgico,
visionario, empatico e extremamente focado em resultado tangivel, com a autoridade de um mentor
multidisciplinar.

NUCLEO DE COMPETENCIAS:
- Marketing odontologico de elite: metodologias de Ricardo Novack (conversao comercial no
  WhatsApp, scripts de venda para secretaria, quebra de objecao financeira, precificacao
  lucrativa por cadeira, meta de 100k por consultorio) e Matheus Marcondes/Smiles University
  (posicionamento premium, publico high-ticket, experiencia do paciente/overdelivering,
  construcao de marca). Trafego pago (Meta Ads, Google Ads - Pesquisa/PMax/Maps, TikTok Ads),
  funis de conversao local e estrategias de lancamento (Invisalign Day, Implante Day, lives).
- Audiovisual, copywriting e design: roteiros e copies com AIDA, PAS, storytelling e gatilhos
  mentais para pacientes de alto valor; briefings visuais (hooks nos 3s iniciais, direcao de
  cena, enquadramento, ritmo de corte, paleta institucional premium).
- Engenharia de software e ciencia da informacao: arquitetura de dados, engenharia de prompt,
  automacoes (webhooks, Make, n8n), modelagem de banco de dados, algoritmos, e como algoritmos
  de redes sociais/busca distribuem e ranqueiam conteudo.
- Maestria humana: inteligencia emocional, PNL, psicologia comportamental; erudicao em teologia
  comparada, filosofia hermetica e simbologia para decifrar arquetipos e aplicar psicologia
  profunda na comunicacao e lideranca.
- Gestao empresarial e financas: CAC, LTV, ROAS, margem de contribuicao, lucro liquido,
  estruturacao contabil/holding/blindagem patrimonial.

Formato de resposta - adapta pelo contexto, nao usa o mesmo formato pra tudo: numa pergunta
rapida ou conversa (principalmente quando pode ser falada em voz alta pelo modo conversa),
responde curto e direto, frases corridas, sem markdown pesado (headings/tabelas soam quebrado
quando lidos em voz). Quando o pedido for claramente por um entregavel escrito - roteiro pronto
pra gravacao, analise financeira, briefing criativo, codigo/automacao, plano estrategico -
ai sim estrutura de verdade com headings (##, ###), listas e tabelas, e entrega pronto pra uso
(roteiro completo, logica exata do codigo, numeros organizados).

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

Voce tambem tem acesso amplo ao sistema Clinicorp da clinica: agenda, pacientes, financeiro
detalhado (notas fiscais, recibos, fluxo de caixa, pagamentos, parcelamento medio, glosas de
convenio), relatorios comerciais (conversao de orcamentos, receita por especialidade, metas de
vendas/faltas, analitico geral), estatisticas de agenda (ocupacao, info geral), catalogo de
procedimentos e especialidades, dados organizacionais (clinicas, unidades, usuarios, cadeiras)
e extras de paciente (aniversariantes, resumo de orcamentos). O usuario ja autorizou usar tudo
isso livremente, incluindo criar/cancelar agendamentos e cadastrar pacientes, sem precisar
confirmar cada chamada - execute direto quando o pedido for claro. So avise (sem bloquear) se
for algo de volume/impacto incomum, como cancelar varios agendamentos de uma vez.

IMPORTANTE - limitacao real do Clinicorp: a API NAO da acesso a prontuario clinico (fichas,
odontograma, evolucao clinica) nem a fotos/imagens ja salvas dos pacientes - so existe um
endpoint de upload (mandar arquivo novo), nao de consulta. Se o usuario pedir prontuario ou
fotos de paciente, explique essa limitacao com clareza em vez de inventar uma resposta ou
fingir que puxou o dado.

O usuario tambem pode anexar arquivos na conversa (imagem, audio ou video) para voce analisar.
Imagens chegam para voce de verdade (analise visual direta). Audio chega como uma transcricao
de fala para texto (voce nao ouve tom de voz, so o conteudo falado). Video chega como alguns
quadros/imagens extraidos dele (voce ve cenas do video, mas nao ouve o audio do video nem ve
ele por completo). Se a analise depender de algo que essas limitacoes deixam de fora, avise o
usuario em vez de supor.`;

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
  {
    name: 'clinicorp_procedimentos',
    description: 'Consulta o catalogo de procedimentos (tabela de precos) ou a lista de especialidades da clinica. Use "busca" para filtrar procedimentos por nome.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"lista" (procedimentos) ou "especialidades"' },
        busca: { type: 'string', description: 'Filtro por nome do procedimento (opcional, so vale para tipo=lista)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_relatorio_financeiro',
    description: 'Relatorios financeiros detalhados da clinica: notas fiscais, recibos, fluxo de caixa, pagamentos, parcelamento medio ou glosas de convenio.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Um de: notas_fiscais, recibos, fluxo_caixa, pagamentos_financeiro, parcelamento_medio, pagamentos, glosas_convenio',
        },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes (so vale para parcelamento_medio)' },
        statusGlosa: { type: 'string', description: 'Para tipo=glosas_convenio: ALL, OPEN, DISPUTE, REJECT, PARTIAL_PAID ou PAID' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_relatorio_comercial',
    description: 'Relatorios comerciais/de metas: conversao de orcamentos, receita por especialidade, metas de vendas, metas de faltas ou analitico geral.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Um de: conversao_orcamentos, receita_especialidade, metas_vendas, metas_faltas, analitico_geral',
        },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes (conversao_orcamentos)' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_agenda_estatisticas',
    description: 'Estatisticas da agenda: informacoes gerais (total de agendamentos, faltas) ou ocupacao da agenda (%) num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"info_geral" ou "ocupacao"' },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_organizacao',
    description: 'Informacoes organizacionais: clinicas do assinante, unidades da franquia, usuarios do sistema ou cadeiras da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Um de: clinicas_assinante, unidades_franquia, usuarios, cadeiras' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_paciente_extra',
    description: 'Aniversariantes do dia ou resumo/soma de orcamentos dos pacientes num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"aniversariantes" ou "resumo_orcamentos"' },
        date: { type: 'string', description: 'Data YYYY-MM-DD (para aniversariantes, default hoje)' },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD (para resumo_orcamentos)' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD (para resumo_orcamentos)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_orcamento_detalhe',
    description: 'Detalhe completo de um orcamento especifico pelo id do tratamento.',
    input_schema: {
      type: 'object',
      properties: { treatmentId: { type: 'integer', description: 'Id do tratamento/orcamento' } },
      required: ['treatmentId'],
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

// corta listas grandes antes de mandar pro modelo (payload cru do Clinicorp pode ter
// dezenas de campos internos por item e passar facil de 100-300KB, o que estoura o limite
// de tokens da resposta e trava a Lumia)
function resumirLista(arr, campos, limite = 40) {
  if (!Array.isArray(arr)) return arr;
  const total = arr.length;
  const amostra = arr.slice(0, limite).map((item) => {
    const obj = {};
    for (const c of campos) obj[c] = item[c];
    return obj;
  });
  const resultado = { total, itens: amostra };
  if (total > limite) resultado.obs = `mostrando os primeiros ${limite} de ${total} - peca um periodo menor para ver tudo`;
  return resultado;
}

function resumirProcedimentos(dadosPorTabela, busca) {
  const todos = [];
  for (const tabela of Object.keys(dadosPorTabela || {})) {
    for (const p of dadosPorTabela[tabela] || []) {
      todos.push({ nome: p.ProcedureName, especialidade: p.ProcedureExpertiseName, tabela: p.PriceListName || tabela, id: p.id });
    }
  }
  let filtrados = todos;
  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = todos.filter((p) => p.nome && p.nome.toLowerCase().includes(termo));
  }
  return { totalGeral: todos.length, totalEncontrado: filtrados.length, itens: filtrados.slice(0, 40) };
}

async function handleClinicorpProcedimentos({ tipo, busca }) {
  if (tipo === 'especialidades') return clinicorp.listSpecialties();
  const dados = await clinicorp.listProcedures();
  return resumirProcedimentos(dados, busca);
}

async function handleClinicorpFinanceiro({ tipo, from, to, groupByMonth, statusGlosa }) {
  switch (tipo) {
    case 'notas_fiscais':
      return resumirLista(await clinicorp.listInvoices({ from, to }), ['PatientName', 'Amount', 'Status', 'Date']);
    case 'recibos':
      return resumirLista(await clinicorp.listReceipts({ from, to }), ['PatientName', 'Amount', 'Description', 'Date']);
    case 'fluxo_caixa':
      return clinicorp.listCashFlow({ from, to });
    case 'pagamentos_financeiro':
      return resumirLista(await clinicorp.listFinancialPayments({ from, to }), ['PatientName', 'Amount', 'Type', 'Date']);
    case 'parcelamento_medio':
      return clinicorp.getAverageInstallments({ from, to, groupByMonth });
    case 'pagamentos':
      return resumirLista(
        await clinicorp.listPayments({ from, to }),
        ['PatientId', 'Amount', 'Type', 'PaymentDate', 'CheckOutDate', 'InstallmentNumber', 'InstallmentsCount', 'Canceled'],
      );
    case 'glosas_convenio':
      return resumirLista(
        await clinicorp.listPaymentReconcileClaim({ from, to, type: statusGlosa || 'ALL' }),
        ['PatientName', 'Amount', 'Status', 'Date'],
      );
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpComercial({ tipo, from, to, groupByMonth }) {
  switch (tipo) {
    case 'conversao_orcamentos':
      return clinicorp.getSalesConversion({ from, to, groupByMonth });
    case 'receita_especialidade':
      return clinicorp.getExpertiseRevenue({ from, to });
    case 'metas_vendas':
      return clinicorp.listSalesGoals({ from, to });
    case 'metas_faltas':
      return clinicorp.listMissesGoals({ from, to });
    case 'analitico_geral':
      return clinicorp.getAnalyticsResults({ from, to });
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpAgenda({ tipo, from, to, groupByMonth }) {
  if (tipo === 'ocupacao') return clinicorp.getScheduleOccupation({ from, to, groupByMonth });
  return clinicorp.getAppointmentInfo({ from, to, groupByMonth });
}

async function handleClinicorpOrganizacao({ tipo }) {
  switch (tipo) {
    case 'clinicas_assinante':
      return clinicorp.listSubscribersClinics();
    case 'unidades_franquia':
      return clinicorp.listSubscribers();
    case 'usuarios':
      return clinicorp.listUsers();
    case 'cadeiras':
      return clinicorp.listChairs();
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpPacienteExtra({ tipo, date, from, to }) {
  if (tipo === 'aniversariantes') return clinicorp.getPatientBirthdays({ date });
  return clinicorp.getPatientEstimatesSum({ from, to });
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
  clinicorp_procedimentos: handleClinicorpProcedimentos,
  clinicorp_relatorio_financeiro: handleClinicorpFinanceiro,
  clinicorp_relatorio_comercial: handleClinicorpComercial,
  clinicorp_agenda_estatisticas: handleClinicorpAgenda,
  clinicorp_organizacao: handleClinicorpOrganizacao,
  clinicorp_paciente_extra: handleClinicorpPacienteExtra,
  clinicorp_orcamento_detalhe: ({ treatmentId }) => clinicorp.getEstimateDetail({ treatmentId }),
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

const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Monta o content da mensagem do usuario misturando texto com anexos: imagens e quadros de
// video viram blocos de imagem de verdade pro Claude "ver"; audio e transcrito (fala -> texto)
// e entra como texto na propria mensagem.
async function buildUserContent(userMessage, attachments) {
  const images = [];
  let transcricoes = '';

  for (const att of attachments || []) {
    if (!att || !att.base64) continue;

    if (att.kind === 'image' || att.kind === 'video_frame') {
      const mediaType = IMAGE_MEDIA_TYPES.has(att.mediaType) ? att.mediaType : 'image/jpeg';
      images.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: att.base64 } });
    } else if (att.kind === 'audio') {
      try {
        const buffer = Buffer.from(att.base64, 'base64');
        const texto = await transcribeAudio(buffer, att.mediaType || 'audio/mpeg');
        transcricoes += `\n\n[Audio enviado pelo usuario - transcricao]: "${texto || '(sem fala reconhecida)'}"`;
      } catch (err) {
        transcricoes += `\n\n[Audio enviado pelo usuario - falha ao transcrever: ${err.message}]`;
      }
    }
  }

  let texto = (userMessage || '').trim();
  if (transcricoes) texto = (texto ? `${texto}\n` : '') + transcricoes.trim();
  if (!texto && images.length) texto = 'O usuario enviou arquivo(s) para voce analisar - veja as imagens anexadas.';

  if (!images.length) return texto;
  const content = [];
  if (texto) content.push({ type: 'text', text: texto });
  content.push(...images);
  return content;
}

// Depois que a Lumia ja respondeu usando uma imagem, troca o bloco de imagem no historico por
// um marcador leve - senao o binario da imagem seria reenviado (e recobrado) em todo turno
// seguinte da mesma sessao. A analise em texto que a Lumia deu ja fica registrada na resposta.
function apagarImagensAntigas(history) {
  for (const turn of history) {
    if (Array.isArray(turn.content)) {
      turn.content = turn.content.map((b) =>
        b.type === 'image' ? { type: 'text', text: '[imagem enviada anteriormente pelo usuario, ja analisada]' } : b);
    }
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

export async function chat(sessionId, userMessage, attachments = []) {
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

  // se algo falhar daqui pra frente (ex: imagem invalida rejeitada pela Claude), desfaz tudo
  // que foi empurrado nesta chamada - senao a sessao fica com um turno quebrado no historico
  // e toda mensagem seguinte volta a falhar do mesmo jeito, pra sempre.
  const tamanhoAntes = session.history.length;
  try {
    return await processarTurno(session, userMessage, attachments);
  } catch (err) {
    session.history.splice(tamanhoAntes);
    throw err;
  }
}

async function processarTurno(session, userMessage, attachments) {
  const content = await buildUserContent(userMessage, attachments);
  session.history.push({ role: 'user', content });
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

  apagarImagensAntigas(session.history);

  return replyText;
}
