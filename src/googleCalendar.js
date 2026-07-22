// integracao OPCIONAL com o Google Agenda - o usuario conecta/desconecta quando quiser (tela
// "Agenda" do app). Enquanto desconectado, a agenda interna funciona 100% sozinha; conectado,
// os eventos criados aqui tambem sao espelhados la, e os eventos de la aparecem na consulta.
// Autenticacao (OAuth, tokens) fica em googleAuth.js, compartilhada com outras integracoes do
// Google (ex: Planilhas) que usam a mesma conexao/consentimento.
export { urlAutorizacao, trocarCodigoPorToken, estaConectado, desconectar } from './googleAuth.js';
import { tokenValido } from './googleAuth.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function chamarApi(method, path, body) {
  const token = await tokenValido();
  const res = await fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Google Calendar API erro ${res.status}`);
  return data;
}

export async function criarEvento({ titulo, descricao, local, inicio, fim }) {
  const evento = await chamarApi('POST', '/calendars/primary/events', {
    summary: titulo,
    description: descricao || undefined,
    location: local || undefined,
    start: { dateTime: inicio.toISOString() },
    end: { dateTime: fim.toISOString() },
  });
  return evento.id;
}

export async function listarEventos(from, to) {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const data = await chamarApi('GET', `/calendars/primary/events?${params.toString()}`);
  return data.items || [];
}

export async function cancelarEvento(googleEventId) {
  await chamarApi('DELETE', `/calendars/primary/events/${googleEventId}`);
}
