// Dados de leitura para o app "Lumia Gestao Geral" (painel do gestor, app separado).
// SO LEITURA: nada aqui grava, envia mensagem ou altera dado. Cada funcao recebe o tenantId do login
// (a clinica so ve os proprios dados). Reaproveita o que a Lumia ja calcula (CRM, origem) e o Clinicorp.
import * as crm from './crm.js';
import * as clinicorp from './clinicorp.js';
import { pool } from './db.js';

// metas de referencia (SUGESTAO - o gestor ainda vai definir as reais). null = sem meta definida.
export const METAS_VENDAS = {
  leads: { meta: null, melhor: 'maior' },
  semResposta: { meta: 0, melhor: 'menor' },
  agendaram: { meta: 40, melhor: 'maior' },
  comparecimento: { meta: 75, melhor: 'maior' },
  fechamento: { meta: 40, melhor: 'maior' },
  parados: { meta: 0, melhor: 'menor' },
};

// verde bateu a meta; amarelo ate 25% de distancia; vermelho alem disso
export function semaforo(valor, meta, melhor = 'maior') {
  if (valor === null || valor === undefined) return 'sem_dados';
  if (meta === null || meta === undefined) return 'sem_meta';
  if (melhor === 'menor') {
    if (valor <= meta) return 'verde';
    if (meta === 0) return valor <= 2 ? 'amarelo' : 'vermelho';
    return valor <= meta * 1.25 ? 'amarelo' : 'vermelho';
  }
  if (valor >= meta) return 'verde';
  return valor >= meta * 0.75 ? 'amarelo' : 'vermelho';
}

const hojeMaceio = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' });
const somarDias = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null);
const reais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const ROTULO_FONTE = { meta_ads: 'Anúncio (Meta Ads)', regra: 'Texto da mensagem', organico: 'Orgânico / direto', sem_origem: 'Sem origem registrada' };

const variacao = (atual, anterior, sufixo = '') => {
  if (anterior === null || anterior === undefined) return '';
  if (anterior === 0) return atual === 0 ? 'igual à semana anterior' : 'semana anterior: 0';
  const v = Math.round(((atual - anterior) / anterior) * 100);
  return `${v > 0 ? '+' : ''}${v}%${sufixo} vs. período anterior`;
};

// quantos contatos chegaram a cada etapa no periodo (eventos de mudanca de etapa, so existem daqui pra frente)
async function eventosDeEtapa(tenantId, inicio, fim) {
  const { rows } = await pool.query(
    `SELECT etapa, count(DISTINCT contato_id)::int AS total FROM crm_etapa_eventos
     WHERE tenant_id = $1 AND em >= $2 AND em < $3 AND etapa IN ('agendado','compareceu','nao_compareceu','comprou','perdido')
     GROUP BY etapa`,
    [tenantId, inicio, fim],
  );
  return Object.fromEntries(rows.map((r) => [r.etapa, r.total]));
}

// orcamentos do Clinicorp dos ultimos 90 dias. Falha de conexao nunca derruba o painel: vira aviso.
async function orcamentos(tenantId, hoje) {
  const { orcamentos: lista } = await clinicorp.getEstimatesExecutionSummary(tenantId, { from: somarDias(hoje, -90), to: hoje });
  return lista.map((o) => ({
    paciente: String(o.paciente || 'Sem nome'),
    valor: Number(o.valor) || 0,
    data: String(o.data || '').slice(0, 10),
    status: String(o.status || ''),
    responsavel: String(o.profissional || ''),
  })).filter((o) => o.data);
}

export async function painelVendas(tenantId, { de, ate } = {}) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hoje = hojeMaceio();
  const periodoAte = /^\d{4}-\d{2}-\d{2}$/.test(ate || '') ? ate : hoje;
  const periodoDe = /^\d{4}-\d{2}-\d{2}$/.test(de || '') ? de : somarDias(periodoAte, -6);
  const avisos = [];

  const resultados = await crm.resultadosAtendimento(tenantId, { de: periodoDe, ate: periodoAte });
  const { atual, anterior, periodo } = resultados;
  const [eventos, aguardando, origemLinhas, orc] = await Promise.all([
    eventosDeEtapa(tenantId, periodo.inicio, periodo.fim),
    crm.conversasAguardando(tenantId, { minutos: 60, limite: 100 }),
    crm.relatorioOrigem(tenantId, { de: periodoDe, ate: periodoAte }),
    orcamentos(tenantId, hoje).catch((err) => { avisos.push(`Clinicorp indisponível (${err.message}) - fechamento e orçamentos parados ficaram sem dados.`); return null; }),
  ]);
  if (!resultados.registroDesde.etapas) avisos.push('Ainda não há histórico de mudança de etapa no CRM: agendamentos, comparecimento e compras só contam daqui pra frente.');

  // ----- orcamentos (Clinicorp)
  let fechamento = null;
  let parados = null;
  let topParados = [];
  let valorParado = 0;
  if (orc) {
    const noPeriodo = orc.filter((o) => o.data >= periodoDe && o.data <= periodoAte);
    const aprovados = noPeriodo.filter((o) => o.status === 'APPROVED').length;
    fechamento = pct(aprovados, noPeriodo.length);
    // "em aberto" = OPEN e FOLLOWUP; parado = sem andar ha mais de 7 dias
    const abertos = orc.filter((o) => (o.status === 'OPEN' || o.status === 'FOLLOWUP') && diasEntre(o.data, hoje) > 7);
    parados = abertos.length;
    valorParado = abertos.reduce((s, o) => s + o.valor, 0);
    topParados = abertos.sort((a, b) => b.valor - a.valor).slice(0, 5).map((o) => ({ paciente: o.paciente, valor: o.valor, diasParado: diasEntre(o.data, hoje), responsavel: o.responsavel }));
  }

  // ----- indicadores
  const compareceu = (eventos.compareceu || 0) + 0;
  const faltou = eventos.nao_compareceu || 0;
  const valores = {
    leads: atual.novos,
    semResposta: aguardando.length,
    agendaram: pct(atual.agendamentos, atual.novos),
    comparecimento: pct(compareceu, compareceu + faltou),
    fechamento,
    parados,
  };
  const rotulos = {
    leads: 'Leads novos',
    semResposta: 'Sem resposta há mais de 1h',
    agendaram: 'Agendaram avaliação',
    comparecimento: 'Comparecimento',
    fechamento: 'Fechamento de orçamentos',
    parados: 'Orçamentos parados há mais de 7 dias',
  };
  const formatos = { leads: 'numero', semResposta: 'numero', agendaram: 'percentual', comparecimento: 'percentual', fechamento: 'percentual', parados: 'numero' };
  const comparacoes = {
    leads: variacao(atual.novos, anterior.novos),
    semResposta: aguardando.length ? `mais antigo há ${Math.max(1, Math.round(aguardando[0].esperando_min / 60))}h` : 'ninguém esperando',
    agendaram: `${atual.agendamentos} agendamento(s) de ${atual.novos} lead(s)`,
    comparecimento: compareceu + faltou ? `${compareceu} compareceram, ${faltou} faltaram` : 'sem avaliações no período',
    fechamento: fechamento === null ? (orc ? 'sem orçamentos no período' : 'sem dados do Clinicorp') : 'orçamentos aprovados no período',
    parados: parados === null ? 'sem dados do Clinicorp' : `${reais(valorParado)} em aberto`,
  };
  const kpis = Object.keys(rotulos).map((id) => ({
    id, rotulo: rotulos[id], valor: valores[id], formato: formatos[id], meta: METAS_VENDAS[id].meta, melhor: METAS_VENDAS[id].melhor,
    comparacao: comparacoes[id], status: semaforo(valores[id], METAS_VENDAS[id].meta, METAS_VENDAS[id].melhor),
  }));

  // ----- origem dos leads (soma das campanhas de cada fonte)
  const porFonte = new Map();
  for (const l of origemLinhas) {
    const f = porFonte.get(l.fonte) || { fonte: ROTULO_FONTE[l.fonte] || l.fonte, leads: 0, compraram: 0 };
    f.leads += l.leads; f.compraram += l.compraram;
    porFonte.set(l.fonte, f);
  }
  const origens = [...porFonte.values()].sort((a, b) => b.leads - a.leads);

  // ----- funil do periodo (cumulativo, pelos eventos de etapa)
  const funil = [
    { etapa: 'Novos leads', total: atual.novos },
    { etapa: 'Agendaram', total: eventos.agendado || 0 },
    { etapa: 'Compareceram', total: compareceu },
    { etapa: 'Compraram', total: eventos.comprou || 0 },
  ];

  // ----- pontos de atencao (regras automaticas sobre os numeros; a IA de verdade entra numa proxima etapa)
  const decidirHoje = [];
  if (parados) decidirHoje.push(`${parados} orçamento(s) parado(s) há mais de 7 dias, somando ${reais(valorParado)}.${topParados.length >= 3 ? ` Os 3 maiores são ${Math.round((topParados.slice(0, 3).reduce((s, o) => s + o.valor, 0) / valorParado) * 100)}% desse valor.` : ''}`);
  if (fechamento !== null && fechamento < METAS_VENDAS.fechamento.meta) decidirHoje.push(`O fechamento de orçamentos está em ${fechamento}% (meta ${METAS_VENDAS.fechamento.meta}%).`);
  if (aguardando.length) decidirHoje.push(`${aguardando.length} lead(s) esperam resposta há mais de 1h; o mais antigo espera há ${Math.max(1, Math.round(aguardando[0].esperando_min / 60))}h.`);
  if (atual.mediana_seg != null && atual.mediana_seg > 900) decidirHoje.push(`O tempo típico até a primeira resposta é de ${Math.round(atual.mediana_seg / 60)} minutos; só ${pct(atual.em_5min, atual.respondidos) ?? 0}% dos leads são respondidos em até 5 minutos.`);
  const comVolume = origens.filter((o) => o.leads >= 5);
  if (comVolume.length) {
    const melhor = [...comVolume].sort((a, b) => b.compraram / b.leads - a.compraram / a.leads)[0];
    const pior = [...comVolume].sort((a, b) => b.leads - a.leads).find((o) => o.compraram === 0);
    if (melhor.compraram > 0) decidirHoje.push(`Melhor conversão por origem: ${melhor.fonte} (${melhor.compraram} de ${melhor.leads} leads compraram).`);
    if (pior) decidirHoje.push(`${pior.fonte} trouxe ${pior.leads} leads e nenhuma compra no período.`);
  }
  if (!decidirHoje.length) decidirHoje.push('Nada fora do normal nos números deste período.');

  return {
    setor: 'vendas',
    demonstracao: false,
    periodo: { de: periodoDe, ate: periodoAte },
    combinado: [], // vem da etapa "Decisoes e tarefas" (ainda nao existe)
    kpis,
    funil,
    origens,
    decidirHoje: decidirHoje.slice(0, 5),
    orcamentos: topParados,
    perguntas: [
      'Quais os 3 maiores orçamentos em aberto e o que trava cada um?',
      'Por que os perdidos disseram não?',
      'Qual origem trouxe o melhor paciente, e não só o maior volume?',
    ],
    avisos,
  };
}
