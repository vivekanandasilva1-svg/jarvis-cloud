// "Minha Empresa": dados reais pra animar o escritorio 3D (quem esta trabalhando agora e os
// numeros do dia). So leitura, sempre filtrada pelo tenant. De onde sai a atividade de cada agente:
//  - Liz  = respostas da IA (autor 'ia') em contatos que ja passaram do atendimento inicial
//  - Bia  = respostas da IA em leads novos/em conversa (etapas novo_lead, em_atendimento, em_negociacao, pre_agendado)
//  - Lua  = Follow Up (follow_up_contatos)
//  - Anne = funis do Follow Up Inteligente (fui_execucoes)
//  - Lorena = aniversariantes enviados (aniversariantes_envios)
import { pool } from './db.js';
import * as agenda from './agenda.js';

const FUSO = 'America/Maceio';
const HOJE_INI = `(date_trunc('day', now() AT TIME ZONE $2)) AT TIME ZONE $2`;
const ETAPAS_BIA = ['novo_lead', 'em_atendimento', 'em_negociacao', 'pre_agendado'];

const vazio = () => ({ hoje: 0, recentes: 0, ultimaEm: null, ativa: false, extras: [] });
const ativaPor = (ultima) => !!ultima && Date.now() - new Date(ultima).getTime() < 3 * 60 * 1000; // mexeu nos ultimos 3 min

async function ler(rotulo, fn) {
  try { return await fn(); } catch (err) { console.error(`Empresa: erro lendo ${rotulo}:`, err.message); return null; }
}

export async function estado(tenantId) {
  const agora = new Date();
  const agentes = { liz: vazio(), bia: vazio(), lua: vazio(), anne: vazio(), lorena: vazio() };
  let pacientesHoje = null;
  if (!pool) return { agora: agora.toISOString(), agentes, pacientesHoje };
  const q = (sql) => pool.query(sql, [tenantId, FUSO]);

  // Liz e Bia: mesma IA de atendimento, separadas pela etapa em que o contato esta
  const ia = await ler('IA de atendimento', async () => (await pool.query(
    `SELECT CASE WHEN COALESCE(c.etapa, 'novo_lead') = ANY($3::text[]) THEN 'bia' ELSE 'liz' END AS ag,
            count(*) FILTER (WHERE m.criado_em >= ${HOJE_INI})::int AS hoje,
            count(*) FILTER (WHERE m.criado_em > now() - interval '10 minutes')::int AS recentes,
            count(DISTINCT m.numero) FILTER (WHERE m.criado_em >= ${HOJE_INI})::int AS pessoas,
            max(m.criado_em) AS ultima
       FROM crm_mensagens m
       LEFT JOIN crm_contatos c ON c.tenant_id = m.tenant_id AND c.numero = m.numero AND c.instancia = m.instancia
      WHERE m.tenant_id = $1 AND m.direcao = 'saida' AND m.autor = 'ia' AND m.criado_em > now() - interval '2 days'
      GROUP BY 1`,
    [tenantId, FUSO, ETAPAS_BIA],
  )).rows);
  for (const r of ia || []) {
    const a = agentes[r.ag];
    a.hoje = r.hoje; a.recentes = r.recentes; a.ultimaEm = r.ultima; a.ativa = ativaPor(r.ultima);
    a.extras = [[r.ag === 'bia' ? 'Leads atendidos hoje' : 'Pacientes atendidos hoje', String(r.pessoas)]];
  }

  const lua = await ler('Follow Up', async () => (await q(
    `SELECT count(*) FILTER (WHERE ultima_etapa_enviada_em >= ${HOJE_INI})::int AS hoje,
            count(*) FILTER (WHERE ultima_etapa_enviada_em > now() - interval '10 minutes')::int AS recentes,
            count(*) FILTER (WHERE NOT finalizado)::int AS ativos, max(ultima_etapa_enviada_em) AS ultima
       FROM follow_up_contatos WHERE tenant_id = $1`,
  )).rows[0]);
  if (lua) agentes.lua = { hoje: lua.hoje, recentes: lua.recentes, ultimaEm: lua.ultima, ativa: ativaPor(lua.ultima), extras: [['Leads no follow-up agora', String(lua.ativos)]] };

  const anne = await ler('Follow Up Inteligente', async () => (await q(
    `SELECT count(*) FILTER (WHERE ultima_em >= ${HOJE_INI})::int AS hoje,
            count(*) FILTER (WHERE ultima_em > now() - interval '10 minutes')::int AS recentes,
            count(*) FILTER (WHERE NOT finalizado)::int AS ativos, max(ultima_em) AS ultima
       FROM fui_execucoes WHERE tenant_id = $1`,
  )).rows[0]);
  if (anne) agentes.anne = { hoje: anne.hoje, recentes: anne.recentes, ultimaEm: anne.ultima, ativa: ativaPor(anne.ultima), extras: [['Leads nos funis agora', String(anne.ativos)]] };

  const lorena = await ler('Aniversariantes', async () => (await q(
    `SELECT count(*) FILTER (WHERE status = 'enviado' AND enviado_em >= ${HOJE_INI})::int AS hoje,
            count(*) FILTER (WHERE status = 'enviado' AND enviado_em > now() - interval '10 minutes')::int AS recentes,
            count(*) FILTER (WHERE status = 'pendente' AND data_envio = (now() AT TIME ZONE $2)::date)::int AS pendentes,
            max(enviado_em) AS ultima
       FROM aniversariantes_envios WHERE tenant_id = $1`,
  )).rows[0]);
  if (lorena) agentes.lorena = { hoje: lorena.hoje, recentes: lorena.recentes, ultimaEm: lorena.ultima, ativa: ativaPor(lorena.ultima), extras: [['Aniversários na fila', String(lorena.pendentes)]] };

  try {
    const ini = new Date(agora.toLocaleDateString('en-CA', { timeZone: FUSO }) + 'T00:00:00-03:00');
    const fim = new Date(ini.getTime() + 24 * 3600 * 1000 - 1);
    pacientesHoje = (await agenda.listarEventos(tenantId, ini.toISOString(), fim.toISOString())).length;
  } catch {
    pacientesHoje = null; // agenda nao conectada: o escritorio so usa o fluxo ilustrativo
  }
  return { agora: agora.toISOString(), agentes, pacientesHoje };
}
