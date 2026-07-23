// cliente do Trello (REST API) - autenticacao simples via API Key + Token na query string
// (sem OAuth de verdade, e assim que o Trello recomenda pra uso pessoal/de uma conta so).
// Credenciais SAO por tenant (cada cliente conecta o proprio quadro Trello, guardadas
// cifradas via tenantConfig.js) - nunca mais env var global.
import * as tenantConfig from './tenantConfig.js';

const BASE_URL = 'https://api.trello.com/1';

async function credenciais(tenantId) {
  const cfg = await tenantConfig.obterTrello(tenantId);
  if (!cfg) throw new Error('Esse cliente nao tem o Trello conectado.');
  return { key: cfg.apiKey, token: cfg.token };
}

async function chamar(tenantId, method, path, { query, body } = {}) {
  const { key, token } = await credenciais(tenantId);
  const url = new URL(BASE_URL + path);
  url.searchParams.set('key', key);
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let data;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = texto; }

  if (!res.ok) {
    const mensagem = typeof data === 'string' ? data : data?.message || `Trello erro ${res.status}`;
    throw new Error(mensagem);
  }
  return data;
}

export async function listarQuadros(tenantId) {
  const boards = await chamar(tenantId, 'GET', '/members/me/boards', { query: { fields: 'id,name,url,closed' } });
  return boards.filter((b) => !b.closed).map((b) => ({ id: b.id, nome: b.name, url: b.url }));
}

export async function listarListas(tenantId, boardId) {
  const listas = await chamar(tenantId, 'GET', `/boards/${boardId}/lists`, { query: { fields: 'id,name,closed' } });
  return listas.filter((l) => !l.closed).map((l) => ({ id: l.id, nome: l.name }));
}

// listId OU boardId (um dos dois) - lista os cartoes de uma lista especifica ou do quadro todo
export async function listarCartoes(tenantId, { listId, boardId }) {
  if (!listId && !boardId) throw new Error('Precisa informar listId ou boardId.');
  const path = listId ? `/lists/${listId}/cards` : `/boards/${boardId}/cards`;
  const cartoes = await chamar(tenantId, 'GET', path, {
    query: { fields: 'id,name,desc,due,idList,url,dateLastActivity' },
  });
  return cartoes.map((c) => ({
    id: c.id,
    nome: c.name,
    descricao: c.desc,
    vencimento: c.due,
    listaId: c.idList,
    url: c.url,
  }));
}

export async function criarCartao(tenantId, { listId, nome, descricao, vencimento }) {
  const card = await chamar(tenantId, 'POST', '/cards', {
    query: { idList: listId, name: nome, desc: descricao, due: vencimento },
  });
  return { id: card.id, nome: card.name, url: card.url };
}

export async function editarCartao(tenantId, { cardId, nome, descricao, vencimento }) {
  const query = {};
  if (nome !== undefined) query.name = nome;
  if (descricao !== undefined) query.desc = descricao;
  if (vencimento !== undefined) query.due = vencimento;
  const card = await chamar(tenantId, 'PUT', `/cards/${cardId}`, { query });
  return { id: card.id, nome: card.name };
}

export async function moverCartao(tenantId, { cardId, listId }) {
  const card = await chamar(tenantId, 'PUT', `/cards/${cardId}`, { query: { idList: listId } });
  return { id: card.id, listaId: card.idList };
}

// "arquivar" (closed=true) em vez de apagar de verdade - reversivel, o cartao continua
// existindo e pode ser restaurado pelo proprio Trello, so sai da visualizacao normal do quadro
export async function arquivarCartao(tenantId, cardId) {
  await chamar(tenantId, 'PUT', `/cards/${cardId}`, { query: { closed: true } });
  return { ok: true };
}

export async function comentarCartao(tenantId, { cardId, texto }) {
  await chamar(tenantId, 'POST', `/cards/${cardId}/actions/comments`, { query: { text: texto } });
  return { ok: true };
}
