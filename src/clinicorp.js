// cliente da API do Clinicorp (sistema de gestao de clinica odontologica) - credenciais SAO
// por tenant (cada clinica tem a propria assinatura do Clinicorp), guardadas cifradas no
// Postgres via tenantConfig.js, nunca mais em env var global. Tenant sem Clinicorp configurado
// recebe um erro claro em vez de acidentalmente usar a config de outro cliente.
import * as tenantConfig from './tenantConfig.js';

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

async function request(tenantId, method, path, { query, body } = {}) {
  const { authHeader } = await credenciais(tenantId);
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

export async function findPatient(tenantId, { patientId, name, document, phone, email } = {}) {
  const cfg = await credenciais(tenantId);
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
  const todos = [];
  for (const janela of janelas) {
    const pedaco = await listEstimates(tenantId, { from: janela.from, to: janela.to });
    todos.push(...pedaco);
  }

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
