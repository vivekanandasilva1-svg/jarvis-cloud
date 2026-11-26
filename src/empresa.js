// "Minha Empresa": dados reais pra animar o escritorio 3D (quem esta trabalhando agora e os
// numeros do dia). So leitura, sempre filtrada pelo tenant. De onde sai a atividade de cada agente:
//  - Liz  = respostas da IA (autor 'ia') em contatos que ja passaram do atendimento inicial
//  - Bia  = respostas da IA em leads novos/em conversa (etapas novo_lead, em_atendimento, em_negociacao, pre_agendado)
//  - Lua  = Follow Up (follow_up_contatos)
//  - Anne = funis do Follow Up Inteligente (fui_execucoes)
//  - Lorena = aniversariantes enviados (aniversariantes_envios)
//  - Lay  = indicadores do laboratorio lancados no Gestao (gestao_lancamentos, so banco)
//  - Mya  = lancamentos do financeiro + vendas/recebido do mes no Clinicorp (cache de 30 min, so quando a aba esta aberta)
//  - Kyan = alertas das campanhas (meta_saude_alertas) + gasto/resultados de hoje das contas do painel de Vendas (cache de 15 min)
import { pool } from './db.js';
import * as agenda from './agenda.js';
import * as gestao from './gestao.js';
import * as gestaoStore from './gestaoStore.js';
import * as clinicorp from './clinicorp.js';
import * as metaAds from './metaads.js';
import * as metaSaude from './metaSaude.js';

const FUSO = 'America/Maceio';
const HOJE_INI = `(date_trunc('day', now() AT TIME ZONE $2)) AT TIME ZONE $2`;
const ETAPAS_BIA = ['novo_lead', 'em_atendimento', 'em_negociacao', 'pre_agendado'];

const vazio = () => ({ hoje: 0, recentes: 0, ultimaEm: null, ativa: false, extras: [], alerta: null });
const ativaPor = (ultima) => !!ultima && Date.now() - new Date(ultima).getTime() < 3 * 60 * 1000; // mexeu nos ultimos 3 min

async function ler(rotulo, fn) {
  try { return await fn(); } catch (err) { console.error(`Empresa: erro lendo ${rotulo}:`, err.message); return null; }
}


// ---------- Lay, Mya e Kyan ----------
const reais = (v) => `R$ ${Math.round(Number(v) || 0).toLocaleString('pt-BR')}`;
const rotuloCurto = { emProducao: 'Trabalhos em produção', atrasados: 'Trabalhos atrasados', refazer: 'Trabalhos para refazer', pacientesEsperando: 'Pacientes esperando prótese', inadimplencia: 'Inadimplência lançada', contasAVencer: 'Contas a vencer em 7 dias' };
const lancado = (v, fmt = String) => (v === null || v === undefined ? 'não lançado' : fmt(v));

// cache em memoria por clinica: devolve o ultimo valor e atualiza em segundo plano (nunca segura a tela)
const caches = new Map();
function comCache(chave, ttlMs, carregar) {
  let c = caches.get(chave);
  if (!c) { c = { em: 0, dados: null, carregando: false }; caches.set(chave, c); }
  if (!c.carregando && Date.now() - c.em > ttlMs) {
    c.carregando = true;
    carregar().then((d) => { c.dados = d; }).catch((err) => { console.error(`Empresa: ${chave}:`, err.message); }).finally(() => { c.em = Date.now(); c.carregando = false; });
  }
  return c.dados;
}

async function agenteLabEFinanceiro(tenantId, agentes) {
  const manual = (await ler('Gestao (manual)', () => gestao.resumoSemanalManual(tenantId))) || {};
  const ultimas = await ler('Gestao (ultimos lancamentos)', async () => (await pool.query(
    `SELECT setor, max(atualizado_em) AS ultima FROM gestao_lancamentos WHERE tenant_id = $1 AND setor IN ('laboratorio', 'financeiro') GROUP BY setor`,
    [tenantId],
  )).rows);
  const ultimaDe = Object.fromEntries((ultimas || []).map((r) => [r.setor, r.ultima]));

  // Lay: laboratorio
  const lab = manual.laboratorio || [];
  const v = (lista, id) => lista.find((x) => x.id === id)?.valor ?? null;
  const atrasados = v(lab, 'atrasados');
  agentes.lay = {
    ...vazio(), ultimaEm: ultimaDe.laboratorio || null, ativa: ativaPor(ultimaDe.laboratorio),
    extras: ['emProducao', 'atrasados', 'refazer', 'pacientesEsperando'].map((id) => [rotuloCurto[id], lancado(v(lab, id))]),
    alerta: atrasados > 0 ? `${atrasados} trabalho(s) atrasado(s) no laboratório` : null,
  };

  // Mya: financeiro (lancamentos do gestor + Clinicorp do mes, em cache e como consulta automatica)
  const fin = manual.financeiro || [];
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
  const mes = comCache(`fin:${tenantId}:${hoje.slice(0, 7)}`, 30 * 60 * 1000, () => clinicorp.comoAutomatico(() => clinicorp.getFinancialSummary(tenantId, { from: `${hoje.slice(0, 7)}-01`, to: hoje })));
  const inad = v(fin, 'inadimplencia');
  agentes.mya = {
    ...vazio(), ultimaEm: ultimaDe.financeiro || null, ativa: ativaPor(ultimaDe.financeiro),
    extras: [
      ['Vendas do mês (Clinicorp)', mes ? reais(mes.TotalSales) : 'indisponível'],
      ['Recebido no mês (Clinicorp)', mes ? reais(mes.TotalIncome) : 'indisponível'],
      ['Despesas no mês (Clinicorp)', mes ? reais(mes.TotalExpenses) : 'indisponível'],
      [rotuloCurto.inadimplencia, lancado(inad, reais)],
      [rotuloCurto.contasAVencer, lancado(v(fin, 'contasAVencer'), reais)],
    ],
    alerta: inad > 0 ? `Inadimplência de ${reais(inad)} lançada` : null,
  };
  agentes.mya.mes = mes ? { vendas: Number(mes.TotalSales) || 0, recebido: Number(mes.TotalIncome) || 0, despesas: Number(mes.TotalExpenses) || 0 } : null;
}

async function agenteTrafego(tenantId, agentes) {
  const abertos = (await ler('alertas Meta', () => metaSaude.listarAbertos(tenantId))) || [];
  const criticos = abertos.filter((a) => a.nivel === 'critico').length;
  const exec = await ler('ultima checagem Meta', () => metaSaude.ultimaExecucao(tenantId));
  const contas = (await ler('contas do painel de Vendas', () => gestaoStore.obterConfig(tenantId, 'vendas_contas_meta', []))) || [];
  const hoje = comCache(`meta:${tenantId}:${contas.join(',')}`, 15 * 60 * 1000, async () => {
    let gasto = 0; let resultados = 0;
    for (const id of contas.slice(0, 10)) {
      const linhas = await metaAds.getInsights(tenantId, { objectId: id, datePreset: 'today' });
      for (const l of linhas || []) { gasto += Number(l.spend) || 0; resultados += metaAds.extractResultsAndCPA(l).resultados || 0; }
    }
    return { gasto, resultados };
  });
  agentes.kyan = {
    ...vazio(), ultimaEm: exec?.ultima_em || null, ativa: ativaPor(exec?.ultima_em),
    extras: [
      ['Alertas abertos nas campanhas', String(abertos.length)],
      ['Alertas críticos', String(criticos)],
      ['Gasto hoje (contas do painel)', !contas.length ? 'sem contas no painel' : hoje ? `R$ ${hoje.gasto.toFixed(2).replace('.', ',')}` : 'carregando…'],
      ['Resultados hoje (contas do painel)', !contas.length ? '—' : hoje ? String(hoje.resultados) : 'carregando…'],
    ],
    alerta: criticos > 0 ? `${criticos} alerta(s) crítico(s) nas campanhas` : null,
  };
}

export async function estado(tenantId) {
  const agora = new Date();
  const agentes = { liz: vazio(), bia: vazio(), lua: vazio(), anne: vazio(), lorena: vazio(), lay: vazio(), mya: vazio(), kyan: vazio() };
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

  await ler('Lay e Mya', () => agenteLabEFinanceiro(tenantId, agentes));
  await ler('Kyan', () => agenteTrafego(tenantId, agentes));

  try {
    const ini = new Date(agora.toLocaleDateString('en-CA', { timeZone: FUSO }) + 'T00:00:00-03:00');
    const fim = new Date(ini.getTime() + 24 * 3600 * 1000 - 1);
    pacientesHoje = (await agenda.listarEventos(tenantId, ini.toISOString(), fim.toISOString())).length;
  } catch {
    pacientesHoje = null; // agenda nao conectada: o escritorio so usa o fluxo ilustrativo
  }
  return { agora: agora.toISOString(), agentes, pacientesHoje };
}
