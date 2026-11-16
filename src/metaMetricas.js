// Padrao UNICO de metricas do Meta Ads, igual as colunas do relatorio oficial do Gerenciador de Anuncios
// (Conversas por mensagem iniciadas, Custo por conversa, Valor gasto, Alcance, Impressoes, Frequencia,
// Reproducoes de 50/75/95/100% do video, Visualizacoes, Cliques no link, CPC do link, Cliques (todos),
// CPC (todos), CPM e CTR (todos)). Usado pelo relatorio automatico da Lumia e pelo app Lumia Gestao Geral,
// pra os dois mostrarem exatamente os mesmos numeros do Gerenciador. Cada conta/campanha e calculada
// SEPARADA: nunca se somam contas (alcance de contas diferentes pode repetir a mesma pessoa).

// action_type que o Gerenciador chama de "Conversas por mensagem iniciadas"
export const ACAO_CONVERSA = 'onsite_conversion.messaging_conversation_started_7d';

// campos pedidos ao Meta (insights)
export const CAMPOS_INSIGHTS = [
  'spend', 'impressions', 'reach', 'frequency', 'clicks', 'ctr', 'cpc', 'cpm',
  'inline_link_clicks', 'cost_per_inline_link_click',
  'actions', 'cost_per_action_type',
  'video_play_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p95_watched_actions', 'video_p100_watched_actions',
];

// colunas na ordem do relatorio oficial. formato: numero | reais | percentual | decimal
export const COLUNAS = [
  { id: 'conversas', rotulo: 'Conversas por mensagem iniciadas', formato: 'numero' },
  { id: 'custoPorConversa', rotulo: 'Custo por conversa por mensagem', formato: 'reais' },
  { id: 'gasto', rotulo: 'Valor gasto', formato: 'reais' },
  { id: 'alcance', rotulo: 'Alcance', formato: 'numero' },
  { id: 'impressoes', rotulo: 'Impressões', formato: 'numero' },
  { id: 'frequencia', rotulo: 'Frequência', formato: 'decimal' },
  { id: 'video50', rotulo: 'Reproduções de 50% do vídeo', formato: 'numero' },
  { id: 'video75', rotulo: 'Reproduções de 75% do vídeo', formato: 'numero' },
  { id: 'video95', rotulo: 'Reproduções de 95% do vídeo', formato: 'numero' },
  { id: 'video100', rotulo: 'Reproduções de 100% do vídeo', formato: 'numero' },
  { id: 'visualizacoes', rotulo: 'Visualizações', formato: 'numero' },
  { id: 'cliquesLink', rotulo: 'Cliques no link', formato: 'numero' },
  { id: 'cpcLink', rotulo: 'CPC (custo por clique no link)', formato: 'reais' },
  { id: 'cliques', rotulo: 'Cliques (todos)', formato: 'numero' },
  { id: 'cpc', rotulo: 'CPC (todos)', formato: 'reais' },
  { id: 'cpm', rotulo: 'CPM (custo por 1.000 impressões)', formato: 'reais' },
  { id: 'ctr', rotulo: 'CTR (todos)', formato: 'percentual' },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// campos de acao/video vem como lista [{action_type, value}] - o valor "geral" e o primeiro item
const primeiroValor = (campo) => (Array.isArray(campo) && campo.length ? num(campo[0].value) : 0);
const valorAcao = (lista, tipo) => num((Array.isArray(lista) ? lista : []).find((a) => a.action_type === tipo)?.value);
const razao = (a, b) => (b > 0 ? a / b : null);

// uma linha de insights do Meta -> as metricas do padrao (linha ausente = tudo zero, custos null)
export function normalizarLinha(row) {
  const r = row || {};
  const gasto = num(r.spend);
  const alcance = num(r.reach);
  const impressoes = num(r.impressions);
  const conversas = valorAcao(r.actions, ACAO_CONVERSA);
  const cliquesLink = num(r.inline_link_clicks);
  const cliques = num(r.clicks);
  const custoMeta = valorAcao(r.cost_per_action_type, ACAO_CONVERSA);
  return {
    conversas,
    custoPorConversa: conversas > 0 ? (custoMeta > 0 ? custoMeta : gasto / conversas) : null,
    gasto,
    alcance,
    impressoes,
    frequencia: r.frequency != null && r.frequency !== '' ? num(r.frequency) : razao(impressoes, alcance),
    video50: primeiroValor(r.video_p50_watched_actions),
    video75: primeiroValor(r.video_p75_watched_actions),
    video95: primeiroValor(r.video_p95_watched_actions),
    video100: primeiroValor(r.video_p100_watched_actions),
    visualizacoes: primeiroValor(r.video_play_actions),
    cliquesLink,
    cpcLink: cliquesLink > 0 ? (num(r.cost_per_inline_link_click) > 0 ? num(r.cost_per_inline_link_click) : gasto / cliquesLink) : null,
    cliques,
    cpc: cliques > 0 ? (num(r.cpc) > 0 ? num(r.cpc) : gasto / cliques) : null,
    cpm: impressoes > 0 ? (num(r.cpm) > 0 ? num(r.cpm) : (gasto / impressoes) * 1000) : null,
    ctr: r.ctr != null && r.ctr !== '' ? num(r.ctr) : (impressoes > 0 ? (cliques / impressoes) * 100 : null),
  };
}

// formata um valor do padrao pro texto brasileiro (null = "—")
export function formatarMetrica(valor, formato) {
  if (valor === null || valor === undefined) return '—';
  if (formato === 'reais') return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (formato === 'percentual') return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (formato === 'decimal') return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(valor).toLocaleString('pt-BR');
}
