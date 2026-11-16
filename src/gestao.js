// Dados de leitura para o app "Lumia Gestao Geral" (painel do gestor, app separado).
// SO LEITURA: nada aqui grava, envia mensagem ou altera dado. Cada funcao recebe o tenantId do login
// (a clinica so ve os proprios dados). Reaproveita o que a Lumia ja calcula (CRM, origem) e o Clinicorp.
import * as crm from './crm.js';
import * as clinicorp from './clinicorp.js';
import { pool } from './db.js';
import * as store from './gestaoStore.js';

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
  const metas = await store.metasDoSetor(tenantId, 'vendas', METAS_VENDAS);

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
    id, rotulo: rotulos[id], valor: valores[id], formato: formatos[id], indicador: id, meta: metas[id].meta, melhor: metas[id].melhor, metaPadrao: metas[id].padrao,
    comparacao: comparacoes[id], status: semaforo(valores[id], metas[id].meta, metas[id].melhor),
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
  if (fechamento !== null && metas.fechamento.meta !== null && fechamento < metas.fechamento.meta) decidirHoje.push(`O fechamento de orçamentos está em ${fechamento}% (meta ${metas.fechamento.meta}%).`);
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
    combinado: await store.combinadoDoSetor(tenantId, 'vendas'),
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

// =====================================================================================
// Demais setores. Cada indicador e "auto" (vem do Clinicorp) ou "manual" (o gestor lanca por semana,
// porque nao existe integracao: ASBs, Laboratorio, parte de Recepcao e Financeiro).
// =====================================================================================

const DEFS = {
  recepcao: {
    nome: 'Recepção',
    indicadores: {
      agendamentos: { rotulo: 'Agendamentos no período', formato: 'numero', meta: null, melhor: 'maior', auto: true },
      faltas: { rotulo: 'Faltas', formato: 'percentual', meta: 10, melhor: 'menor', auto: true },
      cancelamentos: { rotulo: 'Cancelamentos', formato: 'percentual', meta: 10, melhor: 'menor', auto: true },
      confirmados: { rotulo: 'Confirmados nos próximos 7 dias', formato: 'percentual', meta: 80, melhor: 'maior', auto: true },
      esperaMedia: { rotulo: 'Tempo médio de espera (min)', formato: 'numero', meta: 15, melhor: 'menor', dica: 'Quanto o paciente esperou, em média, depois do horário marcado.' },
      cadastrosIncompletos: { rotulo: 'Cadastros incompletos', formato: 'numero', meta: 0, melhor: 'menor', dica: 'Pacientes sem telefone, e-mail ou documento.' },
    },
    perguntas: [
      'Quais horários da próxima semana ainda têm buracos na agenda e o que fazer para preenchê-los?',
      'Quem faltou e já foi contatado para remarcar?',
      'Qual o principal motivo dos cancelamentos desta semana?',
    ],
  },
  asbs: {
    nome: 'ASBs',
    indicadores: {
      materialEmFalta: { rotulo: 'Itens de material em falta', formato: 'numero', meta: 0, melhor: 'menor', dica: 'Itens que faltaram durante a semana.' },
      esterilizacaoAtrasos: { rotulo: 'Atrasos na esterilização', formato: 'numero', meta: 0, melhor: 'menor', dica: 'Vezes em que o material não estava pronto a tempo.' },
      atrasoEntreAtendimentos: { rotulo: 'Tempo de troca entre atendimentos (min)', formato: 'numero', meta: 10, melhor: 'menor', dica: 'Média para preparar a sala entre um paciente e outro.' },
      salasOrganizadas: { rotulo: 'Salas conferidas e organizadas', formato: 'percentual', meta: 90, melhor: 'maior', dica: 'Percentual das salas que passaram no checklist.' },
    },
    perguntas: [
      'Algum material faltou e atrasou um atendimento? Quem faz o pedido?',
      'Onde a troca entre pacientes está demorando mais?',
      'O que a equipe precisa para trabalhar melhor na próxima semana?',
    ],
  },
  laboratorio: {
    nome: 'Laboratório protético',
    indicadores: {
      emProducao: { rotulo: 'Trabalhos em produção', formato: 'numero', meta: null, melhor: 'maior', dica: 'Trabalhos que estão no laboratório agora.' },
      atrasados: { rotulo: 'Trabalhos atrasados', formato: 'numero', meta: 0, melhor: 'menor', dica: 'Passaram do prazo combinado.' },
      refazer: { rotulo: 'Trabalhos para refazer', formato: 'numero', meta: 0, melhor: 'menor', dica: 'Devolvidos por ajuste ou erro.' },
      prazoMedio: { rotulo: 'Prazo médio de entrega (dias)', formato: 'numero', meta: 7, melhor: 'menor' },
      pacientesEsperando: { rotulo: 'Pacientes esperando prótese', formato: 'numero', meta: 0, melhor: 'menor' },
    },
    perguntas: [
      'Qual laboratório mais atrasou ou devolveu trabalho para refazer?',
      'Algum paciente está parado esperando e já foi avisado?',
      'O prazo combinado com cada laboratório está sendo cumprido?',
    ],
  },
  financeiro: {
    nome: 'Financeiro',
    indicadores: {
      vendas: { rotulo: 'Vendas no período', formato: 'reais', meta: null, melhor: 'maior', auto: true },
      recebido: { rotulo: 'Recebido no período', formato: 'reais', meta: null, melhor: 'maior', auto: true },
      despesas: { rotulo: 'Despesas no período', formato: 'reais', meta: null, melhor: 'menor', auto: true },
      lucroBruto: { rotulo: 'Lucro bruto estimado', formato: 'reais', meta: null, melhor: 'maior', auto: true },
      recebidoSobreVendas: { rotulo: 'Recebido sobre vendas', formato: 'percentual', meta: null, melhor: 'maior', auto: true },
      inadimplencia: { rotulo: 'Inadimplência (R$)', formato: 'reais', meta: null, melhor: 'menor', dica: 'Valor vencido e ainda não pago.' },
      contasAVencer: { rotulo: 'Contas a vencer em 7 dias (R$)', formato: 'reais', meta: null, melhor: 'menor' },
    },
    perguntas: [
      'O que foi vendido e ainda não foi recebido, e o que está sendo feito para cobrar?',
      'Alguma despesa fugiu do normal nesta semana?',
      'O caixa cobre as contas dos próximos 7 dias?',
    ],
  },
};
export const SETORES_COM_PAINEL = ['vendas', ...Object.keys(DEFS)];

// indicadores editaveis (meta) e lancaveis (manual) de cada setor - usados pelas rotas pra validar
export function indicadoresDoSetor(setor) {
  if (setor === 'vendas') return Object.keys(METAS_VENDAS);
  return Object.keys(DEFS[setor]?.indicadores || {});
}
export function indicadoresManuais(setor) {
  return Object.entries(DEFS[setor]?.indicadores || {}).filter(([, d]) => !d.auto).map(([id]) => id);
}
export function catalogoDeMetas() {
  const cat = { vendas: { nome: 'Vendas', indicadores: [] } };
  const rotulosVendas = { leads: ['Leads novos', 'numero'], semResposta: ['Sem resposta há mais de 1h', 'numero'], agendaram: ['Agendaram avaliação', 'percentual'], comparecimento: ['Comparecimento', 'percentual'], fechamento: ['Fechamento de orçamentos', 'percentual'], parados: ['Orçamentos parados há mais de 7 dias', 'numero'] };
  for (const [id, m] of Object.entries(METAS_VENDAS)) cat.vendas.indicadores.push({ id, rotulo: rotulosVendas[id][0], formato: rotulosVendas[id][1], melhor: m.melhor, padrao: m.meta });
  for (const [setor, def] of Object.entries(DEFS)) {
    cat[setor] = { nome: def.nome, indicadores: Object.entries(def.indicadores).map(([id, d]) => ({ id, rotulo: d.rotulo, formato: d.formato, melhor: d.melhor, padrao: d.meta })) };
  }
  return cat;
}

const intervalo = (de, ate, hoje) => {
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(ate || '') ? ate : hoje;
  const ini = /^\d{4}-\d{2}-\d{2}$/.test(de || '') ? de : somarDias(fim, -6);
  return { de: ini, ate: fim };
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function autoRecepcao(tenantId, { de, ate }, hoje, avisos) {
  const v = {};
  try {
    const info = await clinicorp.getAppointmentInfo(tenantId, { from: de, to: ate });
    const total = Number(info.ScheduledTotal) || 0;
    v.agendamentos = { valor: total, comparacao: `${Number(info.MissedAppointmentTotal) || 0} faltas, ${Number(info.CanceledAppointment) || 0} cancelamentos` };
    v.faltas = { valor: pct(Number(info.MissedAppointmentTotal) || 0, total), comparacao: `${Number(info.MissedAppointmentTotal) || 0} de ${total} agendamentos` };
    v.cancelamentos = { valor: pct(Number(info.CanceledAppointment) || 0, total), comparacao: `${Number(info.CanceledAppointment) || 0} de ${total} agendamentos` };
  } catch (err) { avisos.push(`Clinicorp indisponível para a agenda (${err.message}).`); }
  try {
    const [lista, status] = await Promise.all([
      clinicorp.listAppointments(tenantId, { from: hoje, to: somarDias(hoje, 7) }),
      clinicorp.getAppointmentStatusList(tenantId).catch(() => []),
    ]);
    const confirmado = new Set(status.filter((s) => norm(s.Description).includes('confirm')).map((s) => String(s.id)));
    const futuros = lista.filter((a) => a.Canceled !== 'X' && String(a.date || '').slice(0, 10) >= hoje);
    const confirmados = futuros.filter((a) => confirmado.has(String(a.StatusId))).length;
    v.confirmados = { valor: confirmado.size ? pct(confirmados, futuros.length) : null, comparacao: confirmado.size ? `${confirmados} de ${futuros.length} consultas` : 'status "confirmado" não encontrado no Clinicorp' };
  } catch (err) { avisos.push(`Clinicorp indisponível para confirmações (${err.message}).`); }
  return v;
}

async function autoFinanceiro(tenantId, { de, ate }, avisos) {
  const v = {};
  try {
    const dias = diasEntre(de, ate) + 1;
    const [atual, anterior] = await Promise.all([
      clinicorp.getFinancialSummary(tenantId, { from: de, to: ate }),
      clinicorp.getFinancialSummary(tenantId, { from: somarDias(de, -dias), to: somarDias(de, -1) }).catch(() => null),
    ]);
    const val = (o, k) => Number(o?.[k]) || 0;
    const lucro = (o) => val(o, 'TotalSales') - val(o, 'TotalExpenses');
    const comp = (a, b) => (b === null || b === undefined ? '' : b === 0 ? 'período anterior: R$ 0' : `${Math.round(((a - b) / b) * 100) > 0 ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs. período anterior`);
    v.vendas = { valor: val(atual, 'TotalSales'), comparacao: comp(val(atual, 'TotalSales'), anterior ? val(anterior, 'TotalSales') : null) };
    v.recebido = { valor: val(atual, 'TotalIncome'), comparacao: comp(val(atual, 'TotalIncome'), anterior ? val(anterior, 'TotalIncome') : null) };
    v.despesas = { valor: val(atual, 'TotalExpenses'), comparacao: comp(val(atual, 'TotalExpenses'), anterior ? val(anterior, 'TotalExpenses') : null) };
    v.lucroBruto = { valor: lucro(atual), comparacao: comp(lucro(atual), anterior ? lucro(anterior) : null) };
    v.recebidoSobreVendas = { valor: pct(val(atual, 'TotalIncome'), val(atual, 'TotalSales')), comparacao: 'recebido ÷ vendas' };
  } catch (err) { avisos.push(`Clinicorp indisponível para o financeiro (${err.message}).`); }
  return v;
}

const fmtValor = (valor, formato) => (formato === 'reais' ? reais(valor) : formato === 'percentual' ? `${valor}%` : String(valor));

// painel dos setores alem de Vendas (Recepcao, ASBs, Laboratorio, Financeiro)
export async function painelSetor(tenantId, setor, { de, ate } = {}) {
  const def = DEFS[setor];
  if (!def) throw new Error('Setor invalido.');
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hoje = hojeMaceio();
  const per = intervalo(de, ate, hoje);
  if (diasEntre(per.de, per.ate) < 0 || diasEntre(per.de, per.ate) > 366) throw new Error('Periodo invalido.');
  const avisos = [];
  const padroes = Object.fromEntries(Object.entries(def.indicadores).map(([id, d]) => [id, { meta: d.meta, melhor: d.melhor }]));
  const [metas, manuais, combinado] = await Promise.all([
    store.metasDoSetor(tenantId, setor, padroes),
    store.lancamentosDoSetor(tenantId, setor, per.ate),
    store.combinadoDoSetor(tenantId, setor),
  ]);
  let auto = {};
  if (setor === 'recepcao') auto = await autoRecepcao(tenantId, per, hoje, avisos);
  if (setor === 'financeiro') auto = await autoFinanceiro(tenantId, per, avisos);

  const kpis = Object.entries(def.indicadores).map(([id, d]) => {
    let valor = null;
    let comparacao = '';
    if (d.auto) {
      valor = auto[id]?.valor ?? null;
      comparacao = auto[id]?.comparacao || (valor === null ? 'sem dados do Clinicorp' : '');
    } else {
      const m = manuais[id];
      valor = m?.atual ?? null;
      comparacao = valor === null ? 'ainda não lançado nesta semana' : m?.anterior !== null && m?.anterior !== undefined ? `semana anterior: ${fmtValor(m.anterior, d.formato)}` : 'lançado nesta semana';
    }
    return { id, indicador: id, rotulo: d.rotulo, valor, formato: d.formato, meta: metas[id].meta, melhor: d.melhor, metaPadrao: metas[id].padrao, comparacao, status: semaforo(valor, metas[id].meta, d.melhor), manual: !d.auto, dica: d.dica || '' };
  });

  const decidirHoje = [];
  for (const k of kpis.filter((x) => x.status === 'vermelho')) decidirHoje.push(`${k.rotulo}: ${fmtValor(k.valor, k.formato)} (meta ${fmtValor(k.meta, k.formato)}).`);
  for (const k of kpis.filter((x) => x.status === 'amarelo')) decidirHoje.push(`Atenção em ${k.rotulo.toLowerCase()}: ${fmtValor(k.valor, k.formato)} (meta ${fmtValor(k.meta, k.formato)}).`);
  const faltaLancar = kpis.filter((k) => k.manual && k.valor === null);
  if (faltaLancar.length) decidirHoje.push(`Falta lançar nesta semana: ${faltaLancar.map((k) => k.rotulo.toLowerCase()).join(', ')}.`);
  if (!decidirHoje.length) decidirHoje.push('Nada fora do normal nos números deste período.');

  return {
    setor, demonstracao: false, periodo: per, combinado, kpis,
    funil: [], origens: [], orcamentos: [],
    decidirHoje: decidirHoje.slice(0, 6), perguntas: def.perguntas, avisos,
  };
}
