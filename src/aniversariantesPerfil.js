// Perfil de cada aniversariante (aba "Aniversariantes"): a clinica escolhe pra quais perfis a
// mensagem de parabens vai sair (ex: so quem esta em tratamento ou agendado). O perfil e
// calculado com dados do Clinicorp:
//   agendado       - tem consulta marcada de hoje em diante (nao cancelada)
//   em_tratamento  - tem orcamento APROVADO ainda nao concluido (procedimentos executados so em parte, ou nenhum ainda)
//   finalizado     - tem orcamento aprovado e TODOS os aprovados ja foram executados (nenhum em andamento)
//   ativo          - teve consulta (nao cancelada e sem falta) nos ultimos N meses, tem consulta marcada ou esta em tratamento
//   inativo        - nenhum dos acima (sem movimento recente)
//   indefinido     - o Clinicorp nao respondeu o suficiente pra decidir (nunca recebe quando ha filtro)
// Um paciente pode ter varios perfis ao mesmo tempo (ex: ativo + agendado + em tratamento); a mensagem
// sai se ele tiver PELO MENOS UM dos perfis marcados.
import * as clinicorp from './clinicorp.js';
import { mapEmLotes } from './lotes.js';

export const PERFIS = [
  { id: 'agendado', rotulo: 'Agendado', descricao: 'tem consulta marcada daqui pra frente' },
  { id: 'ativo', rotulo: 'Ativo', descricao: 'veio, ou tem consulta, nos últimos meses (você define quantos)' },
  { id: 'em_tratamento', rotulo: 'Em tratamento', descricao: 'orçamento aprovado ainda não concluído' },
  { id: 'finalizado', rotulo: 'Finalizado', descricao: 'orçamentos aprovados todos concluídos' },
  { id: 'inativo', rotulo: 'Inativo', descricao: 'sem consulta, agendamento ou tratamento recentes' },
];
export const IDS_PERFIL = PERFIS.map((p) => p.id);

const ESTIMATES_MESES = 24; // quanto tempo pra tras olhar os orcamentos (cada 31 dias = 1 chamada ao Clinicorp)
const CACHE_ORCAMENTOS_MS = 30 * 60 * 1000;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);
const somarMeses = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };

// true quando o paciente (perfis gravados) tem algum dos perfis do filtro; filtro null = sem filtro (todos)
export function passaNoFiltro(perfis, filtro) {
  if (!Array.isArray(filtro) || !filtro.length) return true;
  return Array.isArray(perfis) && perfis.some((p) => filtro.includes(p));
}

// orcamentos dos ultimos 24 meses, em cache por clinica (30 min) pra varias sincronizacoes seguidas nao repetirem as chamadas
const cacheOrcamentos = new Map();
async function orcamentosRecentes(tenantId, hoje) {
  const c = cacheOrcamentos.get(tenantId);
  if (c && Date.now() - c.t < CACHE_ORCAMENTOS_MS) return c.lista;
  const { orcamentos } = await clinicorp.getEstimatesExecutionSummary(tenantId, { from: iso(somarMeses(hoje, -ESTIMATES_MESES)), to: iso(hoje), status: 'APPROVED' });
  cacheOrcamentos.set(tenantId, { t: Date.now(), lista: orcamentos });
  return orcamentos;
}

// pacientes: [{ chave, id, nome }] -> { mapa: Map(chave -> perfis[]), avisos: string[], contagem: { perfil: n } }
// Nunca lanca: se um pedaco falhar, os pacientes afetados ficam "indefinido" e o motivo vai em "avisos".
export async function classificarPacientes(tenantId, pacientes, { mesesAtivo = 12, pausaMs = 0 } = {}) {
  const avisos = [];
  const hoje = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' })}T00:00:00Z`);
  const hojeIso = iso(hoje);

  // ----- orcamentos aprovados (1 conjunto pra todos)
  let aprovadosPorId = new Map();
  let aprovadosPorNome = new Map();
  let orcamentosOk = true;
  try {
    for (const o of await orcamentosRecentes(tenantId, hoje)) {
      if (o.pacienteId !== null && o.pacienteId !== undefined) { const k = String(o.pacienteId); aprovadosPorId.set(k, [...(aprovadosPorId.get(k) || []), o]); }
      const n = norm(o.paciente);
      if (n) aprovadosPorNome.set(n, [...(aprovadosPorNome.get(n) || []), o]);
    }
  } catch (err) {
    orcamentosOk = false;
    avisos.push(`Não consegui ler os orçamentos no Clinicorp (${err.message}) - "em tratamento" e "finalizado" ficaram de fora.`);
  }

  // ----- status "faltou" (falta nao conta como paciente ativo)
  let faltou = new Set();
  try {
    faltou = new Set((await clinicorp.getAppointmentStatusList(tenantId)).filter((s) => norm(s.Description).includes('falt')).map((s) => String(s.id)));
  } catch { /* sem a lista, falta conta como consulta - melhor esforco */ }

  const from = iso(somarMeses(hoje, -Math.max(1, Math.min(60, Number(mesesAtivo) || 12))));
  const to = iso(new Date(hoje.getTime() + 365 * 24 * 60 * 60 * 1000));
  const mapa = new Map();
  const contagem = Object.fromEntries([...IDS_PERFIL, 'indefinido'].map((id) => [id, 0]));
  let falhasAgenda = 0;

  // agenda de cada paciente, 4 por vez
  const agendas = await mapEmLotes(pacientes, 4, async (p) => {
    let agendaOk = false;
    let futuro = false;
    let recente = false;
    if (p.id) {
      try {
        const lista = await clinicorp.listAppointments(tenantId, { patientId: p.id, from, to, includeCanceled: 'X' });
        agendaOk = true;
        for (const a of lista) {
          if (a.Canceled === 'X') continue;
          const data = String(a.date || '').slice(0, 10);
          if (!data) continue;
          if (data >= hojeIso) futuro = true;
          else if (data >= from && !faltou.has(String(a.StatusId))) recente = true; // nao confia so no filtro de periodo da API
        }
      } catch { falhasAgenda++; }
      if (pausaMs) await pausa(pausaMs);
    }
    return { agendaOk, futuro, recente };
  });

  pacientes.forEach((p, i) => {
    const { agendaOk, futuro, recente } = agendas[i];
    const orcs = (p.id && aprovadosPorId.get(String(p.id))) || aprovadosPorNome.get(norm(p.nome)) || [];
    const emTratamento = orcs.some((o) => o.situacaoClinica === 'em_andamento' || o.situacaoClinica === 'nao_iniciado');
    const finalizado = !emTratamento && orcs.length > 0 && orcs.every((o) => o.situacaoClinica === 'finalizado');

    const perfis = [];
    if (futuro) perfis.push('agendado');
    if (emTratamento) perfis.push('em_tratamento');
    if (finalizado) perfis.push('finalizado');
    if (futuro || recente || emTratamento) perfis.push('ativo');
    if (!perfis.length) perfis.push(agendaOk && orcamentosOk ? 'inativo' : 'indefinido');

    for (const id of perfis) contagem[id]++;
    mapa.set(p.chave, perfis);
  });
  if (falhasAgenda) avisos.push(`Não consegui ler a agenda de ${falhasAgenda} paciente(s) - eles podem ter ficado como "indefinido".`);
  return { mapa, avisos, contagem };
}
