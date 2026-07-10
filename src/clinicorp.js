const BASE_URL = 'https://api.clinicorp.com/rest/v1';

function authHeader() {
  const { CLINICORP_API_USER, CLINICORP_API_TOKEN } = process.env;
  const encoded = Buffer.from(`${CLINICORP_API_USER}:${CLINICORP_API_TOKEN}`).toString('base64');
  return `Basic ${encoded}`;
}

function subscriberId() {
  return process.env.CLINICORP_SUBSCRIBER_ID;
}

function defaultBusinessId() {
  return process.env.CLINICORP_DEFAULT_BUSINESS_ID;
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.Message || `Erro ${res.status} ao chamar ${path}`;
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
