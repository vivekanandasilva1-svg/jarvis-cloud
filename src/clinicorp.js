// cliente da API do Clinicorp (sistema de gestao de clinica odontologica) - credenciais SAO
// por tenant (cada clinica tem a propria assinatura do Clinicorp), guardadas cifradas no
// Postgres via tenantConfig.js, nunca mais em env var global. Tenant sem Clinicorp configurado
// recebe um erro claro em vez de acidentalmente usar a config de outro cliente.
import { AsyncLocalStorage } from 'node:async_hooks';
import * as tenantConfig from './tenantConfig.js';
import { mapEmLotes } from './lotes.js';

const BASE_URL = 'https://api.clinicorp.com/rest/v1';

async function credenciais(tenantId) {
  const cfg = await tenantConfig.obterClinicorp(tenantId);
  if (!cfg) throw new Error('Esse cliente nao tem o Clinicorp conectado.');
  const authHeader = `Basic ${Buffer.from(`${cfg.apiUser}:${cfg.apiToken}`).toString('base64')}`;
  return {
    authHeader,
    subscriberId: cfg.subscriberId,
    // numero, nao string - o endpoint de criar agendamento valida o tipo e rejeita (400
    // "Clinic_BusinessId nao pode ser string") se vier como texto
    defaultBusinessId: Number(cfg.defaultBusinessId),
  };
}

// ---------- controle do limite de consultas (o Clinicorp aceita 25 requisicoes por hora por assinatura) ----------
// Todas as chamadas passam por request(), que conta as consultas da ultima hora por assinatura (subscriber). As rotinas
// automaticas (Follow Up, Resgate, Aniversariantes) rodam "comoAutomatico" e PARAM quando sobram poucas consultas: o resto
// fica reservado pro que o usuario clica. Se o Clinicorp responder 429, as chamadas passam a falhar na hora (sem gastar
// consulta) com uma mensagem clara, e uma consulta manual por minuto serve de sonda pra descobrir que o limite voltou.
// O contador fica na memoria: reiniciar o servico zera a contagem (o 429 do Clinicorp continua protegendo).
const LIMITE_HORA = 25;
const RESERVA_MANUAL = 8;
const JANELA_MS = 3600000;
const BLOQUEIO_PADRAO_MS = 5 * 60000;
const contexto = new AsyncLocalStorage();
const consumo = new Map(); // subscriberId -> { usos: [timestamps], bloqueadoAte, ultimaSonda }

// roda fn como rotina automatica (a cota de reserva fica pro uso manual)
export function comoAutomatico(fn) { return contexto.run({ automatico: true }, fn); }

function estadoDe(chave) {
  let e = consumo.get(chave);
  if (!e) { e = { usos: [], bloqueadoAte: 0, ultimaSonda: 0 }; consumo.set(chave, e); }
  const corte = Date.now() - JANELA_MS;
  while (e.usos.length && e.usos[0] < corte) e.usos.shift();
  return e;
}

class ErroLimiteClinicorp extends Error {
  constructor(mensagem) { super(mensagem); this.codigo = 'CLINICORP_LIMITE'; this.status = 429; }
}
const mensagemLimite = (minutos) => `O Clinicorp atingiu o limite de consultas por hora. Tente de novo em cerca de ${minutos} minuto(s).`;

function reservarConsulta(chave) {
  const e = estadoDe(chave);
  const agora = Date.now();
  const automatico = !!contexto.getStore()?.automatico;
  if (e.bloqueadoAte > agora) {
    const minutos = Math.max(1, Math.ceil((e.bloqueadoAte - agora) / 60000));
    if (automatico || agora - e.ultimaSonda < 60000) throw new ErroLimiteClinicorp(mensagemLimite(minutos));
    e.ultimaSonda = agora; // uso manual: deixa passar 1 consulta por minuto pra perceber que o limite voltou
  }
  if (automatico && e.usos.length >= LIMITE_HORA - RESERVA_MANUAL) {
    throw new ErroLimiteClinicorp('Consulta automática do Clinicorp adiada: as consultas que restam na hora ficam reservadas para uso manual.');
  }
  e.usos.push(agora);
}

// quanto ja foi usado na ultima hora (pra diagnostico/tela)
export async function consumoClinicorp(tenantId) {
  const { subscriberId } = await credenciais(tenantId);
  const e = estadoDe(String(subscriberId || tenantId));
  const bloqueadoMin = e.bloqueadoAte > Date.now() ? Math.ceil((e.bloqueadoAte - Date.now()) / 60000) : 0;
  return { usadas: e.usos.length, limite: LIMITE_HORA, reservaManual: RESERVA_MANUAL, restantes: Math.max(0, LIMITE_HORA - e.usos.length), bloqueadoMin };
}

async function request(tenantId, method, path, { query, body } = {}) {
  const { authHeader, subscriberId } = await credenciais(tenantId);
  const chaveConsumo = String(subscriberId || tenantId);
  reservarConsulta(chaveConsumo); // conta a consulta (ou recusa se o limite/reserva pede)
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  // sem timeout, uma API do Clinicorp lenta/travada deixava o fetch pendurado pra sempre - e
  // como o auto-atendimento espera essa resposta antes de responder o contato, isso "travava"
  // a conversa inteira (o contato nunca recebia resposta nenhuma, nem erro)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Clinicorp demorou demais pra responder (mais de 15s) em ${path}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => null);

  if (res.status === 429) { // limite por hora do Clinicorp: bloqueia as proximas chamadas (sem gastar consulta) e avisa com clareza
    const espera = Number(res.headers.get('retry-after'));
    const ms = Number.isFinite(espera) && espera > 0 ? Math.min(espera * 1000, JANELA_MS) : BLOQUEIO_PADRAO_MS;
    const est = estadoDe(chaveConsumo);
    est.bloqueadoAte = Date.now() + ms;
    est.ultimaSonda = Date.now(); // esta propria resposta foi a sonda do minuto
    throw new ErroLimiteClinicorp(mensagemLimite(Math.max(1, Math.ceil(ms / 60000))));
  }

  if (!res.ok) {
    // a API do Clinicorp as vezes devolve o erro em "Message" (string) e as vezes em
    // "Messages" (array) - depende do endpoint/tipo de erro, entao cobre os dois formatos
    const message = data?.Message || (Array.isArray(data?.Messages) ? data.Messages.join('; ') : null) || `Erro ${res.status} ao chamar ${path}`;
    throw new Error(message);
  }

  return data;
}

export async function listBusinesses(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/business/list', { query: { subscriber_id: cfg.subscriberId } });
}

export async function listProfessionals(tenantId, { fromOnlineScheduling } = {}) {
  return request(tenantId, 'GET', '/professional/list_all_professionals', { query: { fromOnlineScheduling } });
}

// showAvailableTimes: 'X' faz a API já devolver os horários livres dentro de cada dia
// code_link: codigo de acesso do agendamento online (Configuracoes > Agendamento Online no Clinicorp)
export async function getAvailableDays(tenantId, { from, to, includeHolidays, codeLink } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/appointment/get_avaliable_days', {
    query: {
      subscriber_id: cfg.subscriberId,
      code_link: codeLink,
      from,
      to,
      includeHolidays,
      showAvailableTimes: 'X',
    },
  });
}

const cachePaciente = new Map();
export async function findPatient(tenantId, { patientId, name, document, phone, email } = {}) {
  const cfg = await credenciais(tenantId);
  const chave = JSON.stringify([tenantId, patientId, name, document, phone, email]);
  const guardado = cachePaciente.get(chave);
  if (guardado && Date.now() - guardado.em < 5 * 60000) return guardado.dados;
  const dados = await consultarPaciente(tenantId, cfg, { patientId, name, document, phone, email });
  if (cachePaciente.size > 500) cachePaciente.clear();
  cachePaciente.set(chave, { em: Date.now(), dados });
  return dados;
}

async function consultarPaciente(tenantId, cfg, { patientId, name, document, phone, email }) {
  return request(tenantId, 'GET', '/patient/get', {
    query: {
      subscriber_id: cfg.subscriberId,
      PatientId: patientId,
      Name: name,
      OtherDocumentId: document,
      Phone: phone,
      Email: email,
    },
  });
}

export async function createPatient(tenantId, {
  name,
  birthDate,
  sex,
  email,
  mobilePhone,
  documentId,
  otherDocumentId,
  notes,
} = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'POST', '/patient/create', {
    body: {
      subscriber_id: cfg.subscriberId,
      Name: name,
      BirthDate: birthDate,
      Sex: sex,
      Email: email,
      MobilePhone: mobilePhone,
      DocumentId: documentId,
      OtherDocumentId: otherDocumentId,
      Notes: notes,
    },
  });
}

export async function listPatientAppointments(tenantId, { patientId } = {}) {
  return request(tenantId, 'GET', '/patient/list_appointments', { query: { PatientId: patientId } });
}

export async function createAppointment(tenantId, {
  patientId,
  patientName,
  mobilePhone,
  email,
  date,
  fromTime,
  toTime,
  businessId,
  dentistId,
  procedures,
  categoryColor,
  categoryDescription,
  notes,
} = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'POST', '/appointment/create_appointment_by_api', {
    body: {
      Patient_PersonId: patientId,
      PatientName: patientName,
      MobilePhone: mobilePhone,
      Email: email,
      date: date ? `${date}T00:00:00.000Z` : undefined,
      fromTime,
      toTime,
      Clinic_BusinessId: businessId || cfg.defaultBusinessId,
      Dentist_PersonId: dentistId,
      Procedures: procedures,
      CategoryColor: categoryColor,
      CategoryDescription: categoryDescription,
      Notes: notes,
    },
  });
}

export async function cancelAppointment(tenantId, { id } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'POST', '/appointment/cancel_appointment', {
    body: { subscriber_id: cfg.subscriberId, id },
  });
}

// Agenda geral da clinica num periodo (nao so de 1 paciente). includeCanceled: 'X' pra incluir cancelados.
export async function listAppointments(tenantId, { from, to, businessId, patientId, includeCanceled } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/appointment/list', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      businessId: businessId || cfg.defaultBusinessId,
      patientId,
      includeCanceled,
    },
  });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getAppointmentStatusList(tenantId) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/appointment/status_list', { query: { subscriber_id: cfg.subscriberId } });
  return Array.isArray(data) ? data : data.list || [];
}

export async function listCategories(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/appointment/list_categories', { query: { subscriber_id: cfg.subscriberId } });
}

// Resumo financeiro (vendas, recebido, despesas) de um periodo.
export async function getFinancialSummary(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/financial/list_summary', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
}

export async function listEstimates(tenantId, { from, to, clinicId } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/estimates/list', {
    query: { subscriber_id: cfg.subscriberId, from, to, clinic_id: clinicId },
  });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getEstimateDetail(tenantId, { treatmentId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/estimates/get', { query: { subscriber_id: cfg.subscriberId, treatment_id: treatmentId } });
}

// /estimates/list rejeita periodos com mais de 31 dias - quebra o periodo pedido em pedacos de
// ate 31 dias e junta os resultados, pra poder consultar um trimestre/ano inteiro de uma vez
function dividirEmJanelasDe31Dias(from, to) {
  const janelas = [];
  let inicio = new Date(`${from}T00:00:00Z`);
  const fim = new Date(`${to}T00:00:00Z`);
  while (inicio <= fim) {
    const fimJanela = new Date(Math.min(inicio.getTime() + 30 * 24 * 60 * 60 * 1000, fim.getTime()));
    janelas.push({ from: inicio.toISOString().slice(0, 10), to: fimJanela.toISOString().slice(0, 10) });
    inicio = new Date(fimJanela.getTime() + 24 * 60 * 60 * 1000);
  }
  return janelas;
}

// resposta real do Clinicorp: cada orcamento (treatment) tem uma lista de procedimentos
// (ProcedureList), e cada procedimento tem "Executed" ("X" = ja foi executado clinicamente,
// "" = ainda nao) - e' o unico jeito de saber, pela API, se um orcamento aprovado ja foi
// finalizado na pratica ou ainda esta em andamento (nao existe endpoint separado de prontuario/
// execucao clinica, mas esse dado ja vem embutido aqui)
export async function getEstimatesExecutionSummary(tenantId, { from, to, status, situacaoClinica } = {}) {
  const janelas = dividirEmJanelasDe31Dias(from, to);
  // ate 4 janelas ao mesmo tempo (a ordem se mantem); 24 meses eram 24 chamadas em fila
  const todos = (await mapEmLotes(janelas, 4, (janela) => listEstimates(tenantId, { from: janela.from, to: janela.to }))).flat();

  // um mesmo orcamento pode aparecer em mais de uma janela se a busca original cruzar meses -
  // dedup pelo id do orcamento (TreatmentId/PaymentPlanId, aqui exposto como "id")
  const vistos = new Set();
  const todosOrcamentos = [];
  for (const o of todos) {
    if (vistos.has(o.id)) continue;
    vistos.add(o.id);
    if (status && o.Status !== status) continue;
    const procedimentos = o.ProcedureList || [];
    const executados = procedimentos.filter((p) => p.Executed === 'X').length;
    const total = procedimentos.length;
    todosOrcamentos.push({
      id: o.id,
      pacienteId: o.PatientId ?? o.PersonId ?? null,
      paciente: o.PatientName,
      telefone: o.PatientMobilePhone,
      profissional: o.ProfessionalName,
      valor: o.Amount,
      status: o.Status,
      data: o.Date,
      totalProcedimentos: total,
      procedimentosExecutados: executados,
      situacaoClinica: total === 0 ? 'sem_procedimentos' : executados === 0 ? 'nao_iniciado' : executados === total ? 'finalizado' : 'em_andamento',
    });
  }

  // resumo (contagens/valores) sempre calculado em cima de TODOS, mesmo se o chamador pedir
  // so uma situacao especifica na lista - assim o total nunca fica inconsistente com o filtro
  const resumo = { totalOrcamentos: todosOrcamentos.length, finalizados: 0, emAndamento: 0, naoIniciados: 0, semProcedimentos: 0, valorFinalizado: 0, valorNaoFinalizado: 0 };
  for (const o of todosOrcamentos) {
    if (o.situacaoClinica === 'finalizado') { resumo.finalizados++; resumo.valorFinalizado += o.valor; }
    else if (o.situacaoClinica === 'em_andamento') { resumo.emAndamento++; resumo.valorNaoFinalizado += o.valor; }
    else if (o.situacaoClinica === 'nao_iniciado') { resumo.naoIniciados++; resumo.valorNaoFinalizado += o.valor; }
    else resumo.semProcedimentos++;
  }

  const orcamentos = situacaoClinica ? todosOrcamentos.filter((o) => o.situacaoClinica === situacaoClinica) : todosOrcamentos;

  return { resumo, orcamentos };
}

export async function listProcedures(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/procedures/list', { query: { subscriber_id: cfg.subscriberId } });
}

export async function listSpecialties(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/procedures/list_specialties', { query: { subscriber_id: cfg.subscriberId } });
}

export async function getAppointmentInfo(tenantId, { from, to, businessId, groupByMonth } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/appointment/list_info', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      business_id: businessId || cfg.defaultBusinessId,
      group_by: groupByMonth ? 'month' : undefined,
    },
  });
}

export async function getScheduleOccupation(tenantId, { from, to, businessId, groupByMonth } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/appointment/schedule_occupation', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      business_id: businessId || cfg.defaultBusinessId,
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

// --- Financeiro detalhado ---

export async function listInvoices(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/financial/list_invoices', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function listReceipts(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/financial/list_receipt', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function listCashFlow(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/financial/list_cash_flow', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
}

export async function listFinancialPayments(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/financial/list_payments', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function getAverageInstallments(tenantId, { from, to, businessId, groupByMonth } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/financial/average_installments', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      business_id: businessId || cfg.defaultBusinessId,
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

// --- Comercial / metas ---

export async function getSalesConversion(tenantId, { from, to, businessId, groupByMonth } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/sales/estimates_and_conversion', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      business_id: businessId || cfg.defaultBusinessId,
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

export async function getExpertiseRevenue(tenantId, { from, to, businessId, patientId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/sales/expertise_revenue', {
    query: { subscriber_id: cfg.subscriberId, from, to, businessId: businessId || cfg.defaultBusinessId, patientId },
  });
}

export async function getAnalyticsResults(tenantId, { from, to } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/analytics/list_results', { query: { subscriber_id: cfg.subscriberId, from, to } });
}

export async function listMissesGoals(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/operational/list_misses_goals', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId, isAPI: 'X' },
  });
}

export async function listSalesGoals(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/operational/list_sales_goals', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId, isAPI: 'X' },
  });
}

// --- Pagamentos ---

export async function listPayments(tenantId, { from, to, includeTotalAmount, dateType } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/payment/list', {
    query: {
      subscriber_id: cfg.subscriberId,
      from,
      to,
      include_total_amount: includeTotalAmount ? 'X' : undefined,
      date_type: dateType,
    },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

// type: ALL, OPEN, DISPUTE, REJECT, PARTIAL_PAID, PAID
export async function listPaymentReconcileClaim(tenantId, { from, to, type = 'ALL' } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/payment/list_reconcile_claim', {
    query: { subscriber_id: cfg.subscriberId, from, to, type },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

// --- Organizacao ---

export async function listSubscribersClinics(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/group/list_subscribers_clinics', { query: { subscriber_id: cfg.subscriberId } });
}

export async function listSubscribers(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/group/list_subscribers', { query: { subscriber_id: cfg.subscriberId } });
}

export async function listUsers(tenantId) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/security/list_users', { query: { subscriber_id: cfg.subscriberId } });
}

export async function listChairs(tenantId, { businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/business/list_chairs', {
    query: { subscriber_id: cfg.subscriberId, Clinic_BusinessId: businessId || cfg.defaultBusinessId },
  });
}

// --- Pacientes extra ---

export async function getPatientBirthdays(tenantId, { date } = {}) {
  const cfg = await credenciais(tenantId);
  const data = await request(tenantId, 'GET', '/patient/birthdays', { query: { subscriber_id: cfg.subscriberId, date } });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getPatientEstimatesSum(tenantId, { from, to, businessId } = {}) {
  const cfg = await credenciais(tenantId);
  return request(tenantId, 'GET', '/patient/list_estimates', {
    query: { subscriber_id: cfg.subscriberId, from, to, business_id: businessId || cfg.defaultBusinessId },
  });
}
