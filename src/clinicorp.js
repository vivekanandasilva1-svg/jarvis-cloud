const BASE_URL = 'https://api.clinicorp.com/rest/v1';

function authHeader() {
  const { CLINICORP_API_USER, CLINICORP_API_TOKEN } = process.env;
  const encoded = Buffer.from(`${CLINICORP_API_USER}:${CLINICORP_API_TOKEN}`).toString('base64');
  return `Basic ${encoded}`;
}

function subscriberId() {
  return process.env.CLINICORP_SUBSCRIBER_ID;
}

// numero, nao string - o endpoint de criar agendamento valida o tipo e rejeita
// (400 "Clinic_BusinessId nao pode ser string") se vier como texto, que e como toda env var
// chega por padrao. Os outros endpoints (query string) nao ligam pro tipo, so esse.
function defaultBusinessId() {
  return Number(process.env.CLINICORP_DEFAULT_BUSINESS_ID);
}

async function request(method, path, { query, body } = {}) {
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
        Authorization: authHeader(),
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

export async function listBusinesses() {
  return request('GET', '/business/list', { query: { subscriber_id: subscriberId() } });
}

export async function listProfessionals({ fromOnlineScheduling } = {}) {
  return request('GET', '/professional/list_all_professionals', { query: { fromOnlineScheduling } });
}

// showAvailableTimes: 'X' faz a API já devolver os horários livres dentro de cada dia
// code_link: codigo de acesso do agendamento online (Configuracoes > Agendamento Online no Clinicorp)
export async function getAvailableDays({ from, to, includeHolidays } = {}) {
  return request('GET', '/appointment/get_avaliable_days', {
    query: {
      subscriber_id: subscriberId(),
      code_link: process.env.CLINICORP_CODE_LINK,
      from,
      to,
      includeHolidays,
      showAvailableTimes: 'X',
    },
  });
}

export async function findPatient({ patientId, name, document, phone, email } = {}) {
  return request('GET', '/patient/get', {
    query: {
      subscriber_id: subscriberId(),
      PatientId: patientId,
      Name: name,
      OtherDocumentId: document,
      Phone: phone,
      Email: email,
    },
  });
}

export async function createPatient({
  name,
  birthDate,
  sex,
  email,
  mobilePhone,
  documentId,
  otherDocumentId,
  notes,
} = {}) {
  return request('POST', '/patient/create', {
    body: {
      subscriber_id: subscriberId(),
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

export async function listPatientAppointments({ patientId } = {}) {
  return request('GET', '/patient/list_appointments', { query: { PatientId: patientId } });
}

export async function createAppointment({
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
  return request('POST', '/appointment/create_appointment_by_api', {
    body: {
      Patient_PersonId: patientId,
      PatientName: patientName,
      MobilePhone: mobilePhone,
      Email: email,
      date: date ? `${date}T00:00:00.000Z` : undefined,
      fromTime,
      toTime,
      Clinic_BusinessId: businessId || defaultBusinessId(),
      Dentist_PersonId: dentistId,
      Procedures: procedures,
      CategoryColor: categoryColor,
      CategoryDescription: categoryDescription,
      Notes: notes,
    },
  });
}

export async function cancelAppointment({ id } = {}) {
  return request('POST', '/appointment/cancel_appointment', {
    body: { subscriber_id: subscriberId(), id },
  });
}

// Agenda geral da clinica num periodo (nao so de 1 paciente). includeCanceled: 'X' pra incluir cancelados.
export async function listAppointments({ from, to, businessId, patientId, includeCanceled } = {}) {
  const data = await request('GET', '/appointment/list', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      businessId: businessId || defaultBusinessId(),
      patientId,
      includeCanceled,
    },
  });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getAppointmentStatusList() {
  const data = await request('GET', '/appointment/status_list', { query: { subscriber_id: subscriberId() } });
  return Array.isArray(data) ? data : data.list || [];
}

export async function listCategories() {
  return request('GET', '/appointment/list_categories', { query: { subscriber_id: subscriberId() } });
}

// Resumo financeiro (vendas, recebido, despesas) de um periodo.
export async function getFinancialSummary({ from, to, businessId } = {}) {
  return request('GET', '/financial/list_summary', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
}

export async function listEstimates({ from, to, clinicId } = {}) {
  const data = await request('GET', '/estimates/list', {
    query: { subscriber_id: subscriberId(), from, to, clinic_id: clinicId },
  });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getEstimateDetail({ treatmentId } = {}) {
  return request('GET', '/estimates/get', { query: { subscriber_id: subscriberId(), treatment_id: treatmentId } });
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
export async function getEstimatesExecutionSummary({ from, to, status, situacaoClinica } = {}) {
  const janelas = dividirEmJanelasDe31Dias(from, to);
  const todos = [];
  for (const janela of janelas) {
    const pedaco = await listEstimates({ from: janela.from, to: janela.to });
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

export async function listProcedures() {
  return request('GET', '/procedures/list', { query: { subscriber_id: subscriberId() } });
}

export async function listSpecialties() {
  return request('GET', '/procedures/list_specialties', { query: { subscriber_id: subscriberId() } });
}

export async function getAppointmentInfo({ from, to, businessId, groupByMonth } = {}) {
  return request('GET', '/appointment/list_info', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      business_id: businessId || defaultBusinessId(),
      group_by: groupByMonth ? 'month' : undefined,
    },
  });
}

export async function getScheduleOccupation({ from, to, businessId, groupByMonth } = {}) {
  return request('GET', '/appointment/schedule_occupation', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      business_id: businessId || defaultBusinessId(),
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

// --- Financeiro detalhado ---

export async function listInvoices({ from, to, businessId } = {}) {
  const data = await request('GET', '/financial/list_invoices', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function listReceipts({ from, to, businessId } = {}) {
  const data = await request('GET', '/financial/list_receipt', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function listCashFlow({ from, to, businessId } = {}) {
  return request('GET', '/financial/list_cash_flow', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
}

export async function listFinancialPayments({ from, to, businessId } = {}) {
  const data = await request('GET', '/financial/list_payments', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

export async function getAverageInstallments({ from, to, businessId, groupByMonth } = {}) {
  return request('GET', '/financial/average_installments', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      business_id: businessId || defaultBusinessId(),
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

// --- Comercial / metas ---

export async function getSalesConversion({ from, to, businessId, groupByMonth } = {}) {
  return request('GET', '/sales/estimates_and_conversion', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      business_id: businessId || defaultBusinessId(),
      group_by: groupByMonth ? 'month' : 'none',
    },
  });
}

export async function getExpertiseRevenue({ from, to, businessId, patientId } = {}) {
  return request('GET', '/sales/expertise_revenue', {
    query: { subscriber_id: subscriberId(), from, to, businessId: businessId || defaultBusinessId(), patientId },
  });
}

export async function getAnalyticsResults({ from, to } = {}) {
  return request('GET', '/analytics/list_results', { query: { subscriber_id: subscriberId(), from, to } });
}

export async function listMissesGoals({ from, to, businessId } = {}) {
  return request('GET', '/operational/list_misses_goals', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId(), isAPI: 'X' },
  });
}

export async function listSalesGoals({ from, to, businessId } = {}) {
  return request('GET', '/operational/list_sales_goals', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId(), isAPI: 'X' },
  });
}

// --- Pagamentos ---

export async function listPayments({ from, to, includeTotalAmount, dateType } = {}) {
  const data = await request('GET', '/payment/list', {
    query: {
      subscriber_id: subscriberId(),
      from,
      to,
      include_total_amount: includeTotalAmount ? 'X' : undefined,
      date_type: dateType,
    },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

// type: ALL, OPEN, DISPUTE, REJECT, PARTIAL_PAID, PAID
export async function listPaymentReconcileClaim({ from, to, type = 'ALL' } = {}) {
  const data = await request('GET', '/payment/list_reconcile_claim', {
    query: { subscriber_id: subscriberId(), from, to, type },
  });
  return Array.isArray(data) ? data : data.list || data.values || [];
}

// --- Organizacao ---

export async function listSubscribersClinics() {
  return request('GET', '/group/list_subscribers_clinics', { query: { subscriber_id: subscriberId() } });
}

export async function listSubscribers() {
  return request('GET', '/group/list_subscribers', { query: { subscriber_id: subscriberId() } });
}

export async function listUsers() {
  return request('GET', '/security/list_users', { query: { subscriber_id: subscriberId() } });
}

export async function listChairs({ businessId } = {}) {
  return request('GET', '/business/list_chairs', {
    query: { subscriber_id: subscriberId(), Clinic_BusinessId: businessId || defaultBusinessId() },
  });
}

// --- Pacientes extra ---

export async function getPatientBirthdays({ date } = {}) {
  const data = await request('GET', '/patient/birthdays', { query: { subscriber_id: subscriberId(), date } });
  return Array.isArray(data) ? data : data.list || [];
}

export async function getPatientEstimatesSum({ from, to, businessId } = {}) {
  return request('GET', '/patient/list_estimates', {
    query: { subscriber_id: subscriberId(), from, to, business_id: businessId || defaultBusinessId() },
  });
}
