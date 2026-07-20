const API_VERSION = 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function tokenSets() {
  const raw = process.env.META_ADS_TOKENS;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('META_ADS_TOKENS no .env nao e um JSON valido');
  }
}

// caches em memoria: qual token (das varias empresas) e dono de cada objeto
const accountTokenCache = new Map();
const campaignTokenCache = new Map();
const adsetTokenCache = new Map();
const adTokenCache = new Map();

const CACHE_BY_TYPE = {
  account: accountTokenCache,
  campaign: campaignTokenCache,
  adset: adsetTokenCache,
  ad: adTokenCache,
};

async function callWithToken(token, method, path, { query, body } = {}) {
  const url = new URL(BASE_URL + path);
  url.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.error) {
    const message = data?.error?.message || `Erro ${res.status} ao chamar ${path}`;
    const err = new Error(message);
    err.isApiError = true;
    throw err;
  }

  return data;
}

// tenta o token em cache primeiro; se nao tiver ou falhar, tenta todos ate um funcionar
async function requestForId(cache, id, method, path, opts) {
  const cached = cache.get(id);
  if (cached) {
    try {
      return await callWithToken(cached, method, path, opts);
    } catch (err) {
      if (!err.isApiError) throw err;
      // cache pode estar desatualizado, cai para tentar todos
    }
  }

  const sets = tokenSets();
  if (sets.length === 0) throw new Error('Nenhum token configurado em META_ADS_TOKENS no .env');

  let lastError;
  for (const set of sets) {
    try {
      const data = await callWithToken(set.token, method, path, opts);
      cache.set(id, set.token);
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function normalizeAccountId(accountId) {
  if (!accountId) return accountId;
  return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
}

// pra conta pre-paga (a maioria no Brasil - is_prepay_account true), o Meta nao devolve um
// campo unico de "saldo restante": spend_cap (quanto ja foi carregado/autorizado na conta) e
// amount_spent (quanto ja foi gasto) sao ambos em centavos, e a diferenca entre os dois E o
// saldo disponivel de verdade - confirmado batendo com o funding_source_details.display_string
// ("Saldo disponivel (R$X)") que o proprio Meta mostra pro usuario. Pra conta pos-paga (fatura),
// isso nao se aplica - o campo "balance" e que representa o que esta em aberto pra pagar.
function calcularSaldo(acc) {
  if (acc.is_prepay_account && acc.spend_cap != null) {
    const saldoCentavos = Number(acc.spend_cap) - Number(acc.amount_spent || 0);
    return { tipoConta: 'prepago', saldoDisponivel: saldoCentavos / 100 };
  }
  if (acc.balance != null) {
    return { tipoConta: 'pos-pago (fatura)', valorEmAberto: Number(acc.balance) / 100 };
  }
  return { tipoConta: 'desconhecido' };
}

export async function listAdAccounts() {
  const sets = tokenSets();
  if (sets.length === 0) throw new Error('Nenhum token configurado em META_ADS_TOKENS no .env');

  const all = [];
  for (const set of sets) {
    let path = '/me/adaccounts';
    let query = {
      fields: 'name,account_id,account_status,currency,amount_spent,business_name,spend_cap,balance,is_prepay_account,funding_source_details{display_string}',
      limit: 100,
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const data = await callWithToken(set.token, 'GET', path, { query });
      for (const acc of data.data) {
        accountTokenCache.set(acc.id, set.token);
        all.push({
          ...acc,
          empresa: set.label,
          amountSpentReais: Number(acc.amount_spent || 0) / 100,
          ...calcularSaldo(acc),
          saldoTexto: acc.funding_source_details?.display_string || null,
        });
      }
      if (!data.paging?.next) break;
      const nextUrl = new URL(data.paging.next);
      path = nextUrl.pathname.replace(`/${API_VERSION}`, '');
      query = Object.fromEntries(nextUrl.searchParams);
      delete query.access_token;
    }
  }

  return all;
}

export async function listCampaigns({ accountId, status } = {}) {
  const acc = normalizeAccountId(accountId);
  const data = await requestForId(accountTokenCache, acc, 'GET', `/${acc}/campaigns`, {
    query: {
      fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
      effective_status: status ? JSON.stringify([status]) : undefined,
      limit: 100,
    },
  });

  const token = accountTokenCache.get(acc);
  if (token) data.data.forEach((c) => campaignTokenCache.set(c.id, token));

  return data.data;
}

// objectType = tipo do objeto sendo consultado (account/campaign/adset/ad), usado so para
// achar o token certo no cache. level = granularidade do resultado (pode ser mais fino que
// objectType, ex: objectType 'campaign' + level 'ad' devolve 1 linha por anuncio dentro dela).
export async function getInsights({ objectId, objectType = 'account', level, since, until, datePreset } = {}) {
  const id = objectType === 'account' ? normalizeAccountId(objectId) : objectId;
  const cache = CACHE_BY_TYPE[objectType] || accountTokenCache;
  const breakdownLevel = level || objectType;

  const fields = [
    'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'frequency', 'actions', 'cost_per_action_type',
    'inline_link_clicks', 'video_play_actions',
    'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p95_watched_actions',
  ];
  if (breakdownLevel === 'ad') fields.push('ad_id', 'ad_name', 'adset_id', 'adset_name');
  else if (breakdownLevel === 'adset') fields.push('adset_id', 'adset_name');
  else if (breakdownLevel === 'campaign') fields.push('campaign_id', 'campaign_name');

  const query = { fields: fields.join(','), level: breakdownLevel, limit: 200 };
  if (since && until) {
    query.time_range = JSON.stringify({ since, until });
  } else {
    query.date_preset = datePreset || 'yesterday';
  }

  const data = await requestForId(cache, id, 'GET', `/${id}/insights`, { query });
  return data.data;
}

// relatorio de gasto por dia ou por mes, de UMA conta (accountId informado) ou de TODAS as
// contas que a Lumia tem acesso (accountId omitido) - usa time_increment do Meta pra ja
// devolver o gasto quebrado por periodo direto da API, sem precisar somar manualmente.
export async function getSpendReport({ accountId, since, until, timeIncrement = '1' } = {}) {
  const contasAlvo = accountId
    ? [{ id: normalizeAccountId(accountId), name: null, empresa: null }]
    : await listAdAccounts();

  const resultado = [];
  for (const conta of contasAlvo) {
    try {
      const data = await requestForId(accountTokenCache, conta.id, 'GET', `/${conta.id}/insights`, {
        query: {
          fields: 'spend',
          time_increment: timeIncrement,
          time_range: JSON.stringify({ since, until }),
          limit: 500,
        },
      });
      resultado.push({
        contaId: conta.id,
        nome: conta.name,
        empresa: conta.empresa,
        porPeriodo: data.data.map((d) => ({ inicio: d.date_start, fim: d.date_stop, gasto: Number(d.spend || 0) })),
      });
    } catch (err) {
      resultado.push({ contaId: conta.id, nome: conta.name, empresa: conta.empresa, erro: err.message });
    }
  }
  return resultado;
}

export async function createCampaign({ accountId, name, objective, status = 'PAUSED' } = {}) {
  const acc = normalizeAccountId(accountId);
  const data = await requestForId(accountTokenCache, acc, 'POST', `/${acc}/campaigns`, {
    body: { name, objective, status, special_ad_categories: [] },
  });
  const token = accountTokenCache.get(acc);
  if (token && data.id) campaignTokenCache.set(data.id, token);
  return data;
}

export async function updateCampaignStatus({ campaignId, status } = {}) {
  return requestForId(campaignTokenCache, campaignId, 'POST', `/${campaignId}`, { body: { status } });
}

export async function updateAdSetBudget({ adSetId, dailyBudgetCents } = {}) {
  return requestForId(adsetTokenCache, adSetId, 'POST', `/${adSetId}`, { body: { daily_budget: dailyBudgetCents } });
}

export async function listAdSets({ campaignId } = {}) {
  const data = await requestForId(campaignTokenCache, campaignId, 'GET', `/${campaignId}/adsets`, {
    query: { fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event', limit: 100 },
  });

  const token = campaignTokenCache.get(campaignId);
  if (token) data.data.forEach((a) => adsetTokenCache.set(a.id, token));

  return data.data;
}

export async function listAds({ adSetId } = {}) {
  const data = await requestForId(adsetTokenCache, adSetId, 'GET', `/${adSetId}/ads`, {
    query: {
      fields: 'id,name,status,effective_status,creative{title,body,thumbnail_url,object_story_spec}',
      limit: 100,
    },
  });

  const token = adsetTokenCache.get(adSetId);
  if (token) data.data.forEach((a) => adTokenCache.set(a.id, token));

  return data.data;
}

export function extractResultsAndCPA(insightRow) {
  const actions = insightRow.actions || [];
  const costPerAction = insightRow.cost_per_action_type || [];
  // prioriza resultados de lead/conversao, cai para link_click se nao tiver
  const priority = ['lead', 'onsite_conversion.lead', 'purchase', 'onsite_conversion.messaging_conversation_started_7d', 'link_click'];
  for (const type of priority) {
    const action = actions.find((a) => a.action_type === type);
    if (action) {
      const cost = costPerAction.find((c) => c.action_type === type);
      return { tipo: type, resultados: Number(action.value), custoPorResultado: cost ? Number(cost.value) : null };
    }
  }
  return { tipo: null, resultados: 0, custoPorResultado: null };
}

// Analise comparativa: pega o desempenho de cada anuncio dentro de uma campanha e aponta
// quais estao performando pior que a media do grupo (CTR baixo, CPC/custo por resultado alto).
export async function analyzeCampaignAds({ campaignId, since, until, datePreset } = {}) {
  const rows = await getInsights({ objectId: campaignId, objectType: 'campaign', level: 'ad', since, until, datePreset });

  if (rows.length === 0) {
    return { anuncios: [], resumo: 'Sem dados de performance no periodo (sem gasto/impressoes).' };
  }

  // insights e dado HISTORICO - um anuncio que gastou/teve resultado no periodo mas ja foi
  // pausado/arquivado depois ainda aparece aqui normalmente. Pedido explicito do usuario: so
  // quer anuncio que esta ATIVO DE VERDADE agora, entao confere o effective_status atual de
  // cada anuncio (chamada em lote, 1 so requisicao pra todos os ids) e filtra por isso.
  const adIds = [...new Set(rows.map((r) => r.ad_id).filter(Boolean))];
  const token = adTokenCache.get(adIds[0]) || campaignTokenCache.get(campaignId);
  let statusPorAd = null;
  if (token && adIds.length) {
    try {
      const data = await callWithToken(token, 'GET', '/', { query: { ids: adIds.join(','), fields: 'effective_status' } });
      statusPorAd = {};
      for (const id of adIds) {
        statusPorAd[id] = data[id]?.effective_status || null;
        adTokenCache.set(id, token);
      }
    } catch { /* se a checagem de status falhar, segue sem filtrar - melhor mostrar de mais que travar o relatorio inteiro */ }
  }
  const rowsAtivos = statusPorAd ? rows.filter((r) => statusPorAd[r.ad_id] === 'ACTIVE') : rows;

  if (rowsAtivos.length === 0) {
    return { anuncios: [], resumo: 'Nenhum anuncio ativo (todos pausados/arquivados) com dados de performance no periodo.' };
  }

  // acao de video vem como lista [{action_type, value}] igual "actions" - so tem 1 item
  // relevante aqui, mas o formato da API e sempre lista
  const extrairValorVideo = (campo) => (Array.isArray(campo) && campo.length ? Number(campo[0].value || 0) : 0);

  const anuncios = rowsAtivos.map((r) => {
    const { tipo, resultados, custoPorResultado } = extractResultsAndCPA(r);
    const impressoes = Number(r.impressions || 0);
    const videoViews50 = extrairValorVideo(r.video_p50_watched_actions);
    const videoViews75 = extrairValorVideo(r.video_p75_watched_actions);
    const videoViews95 = extrairValorVideo(r.video_p95_watched_actions);
    return {
      adId: r.ad_id,
      nome: r.ad_name,
      gasto: Number(r.spend || 0),
      impressoes,
      alcance: Number(r.reach || 0),
      cliques: Number(r.clicks || 0),
      cliquesLink: Number(r.inline_link_clicks || 0),
      ctr: Number(r.ctr || 0),
      cpc: Number(r.cpc || 0),
      tipoResultado: tipo,
      resultados,
      custoPorResultado,
      // taxa de retencao de video, relativa as impressoes do anuncio (so faz sentido pra
      // anuncio em video - fica 0 pra anuncio estatico, o que e o esperado)
      taxaVideo50: impressoes ? (videoViews50 / impressoes) * 100 : 0,
      taxaVideo75: impressoes ? (videoViews75 / impressoes) * 100 : 0,
      taxaVideo95: impressoes ? (videoViews95 / impressoes) * 100 : 0,
    };
  });

  const media = (key) => anuncios.reduce((s, a) => s + (a[key] || 0), 0) / anuncios.length;
  const ctrMedio = media('ctr');
  const cpcMedio = media('cpc');
  const comCusto = anuncios.filter((a) => a.custoPorResultado);
  const custoMedio = comCusto.length ? comCusto.reduce((s, a) => s + a.custoPorResultado, 0) / comCusto.length : null;

  const analisados = anuncios.map((a) => {
    const alertas = [];
    if (ctrMedio > 0 && a.ctr < ctrMedio * 0.5) alertas.push('CTR bem abaixo da media do grupo (possivel criativo cansado)');
    if (cpcMedio > 0 && a.cpc > cpcMedio * 1.5) alertas.push('CPC bem acima da media do grupo');
    if (custoMedio && a.custoPorResultado && a.custoPorResultado > custoMedio * 1.5) {
      alertas.push('Custo por resultado bem acima da media do grupo');
    }
    if (a.impressoes > 500 && a.resultados === 0) alertas.push('Teve impressoes relevantes mas nenhum resultado');
    return { ...a, alertas };
  });

  return {
    mediaGrupo: { ctr: ctrMedio, cpc: cpcMedio, custoPorResultado: custoMedio },
    anuncios: analisados.sort((a, b) => b.gasto - a.gasto),
  };
}
