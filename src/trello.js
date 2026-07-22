// cliente do Trello (REST API) - autenticacao simples via API Key + Token na query string
// (sem OAuth de verdade, e assim que o Trello recomenda pra uso pessoal/de uma conta so).
const BASE_URL = 'https://api.trello.com/1';

function credenciais() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY/TRELLO_TOKEN nao configurados no .env');
  return { key, token };
}

async function chamar(method, path, { query, body } = {}) {
  const { key, token } = credenciais();
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

export async function listarQuadros() {
  const boards = await chamar('GET', '/members/me/boards', { query: { fields: 'id,name,url,closed' } });
  return boards.filter((b) => !b.closed).map((b) => ({ id: b.id, nome: b.name, url: b.url }));
}

export async function listarListas(boardId) {
  const listas = await chamar('GET', `/boards/${boardId}/lists`, { query: { fields: 'id,name,closed' } });
  return listas.filter((l) => !l.closed).map((l) => ({ id: l.id, nome: l.name }));
}

// listId OU boardId (um dos dois) - lista os cartoes de uma lista especifica ou do quadro todo
export async function listarCartoes({ listId, boardId }) {
  if (!listId && !boardId) throw new Error('Precisa informar listId ou boardId.');
  const path = listId ? `/lists/${listId}/cards` : `/boards/${boardId}/cards`;
  const cartoes = await chamar('GET', path, {
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

export async function criarCartao({ listId, nome, descricao, vencimento }) {
  const card = await chamar('POST', '/cards', {
    query: { idList: listId, name: nome, desc: descricao, due: vencimento },
  });
  return { id: card.id, nome: card.name, url: card.url };
}

export async function editarCartao({ cardId, nome, descricao, vencimento }) {
  const query = {};
  if (nome !== undefined) query.name = nome;
  if (descricao !== undefined) query.desc = descricao;
  if (vencimento !== undefined) query.due = vencimento;
  const card = await chamar('PUT', `/cards/${cardId}`, { query });
  return { id: card.id, nome: card.name };
}

export async function moverCartao({ cardId, listId }) {
  const card = await chamar('PUT', `/cards/${cardId}`, { query: { idList: listId } });
  return { id: card.id, listaId: card.idList };
}

// "arquivar" (closed=true) em vez de apagar de verdade - reversivel, o cartao continua
// existindo e pode ser restaurado pelo proprio Trello, so sai da visualizacao normal do quadro
export async function arquivarCartao(cardId) {
  await chamar('PUT', `/cards/${cardId}`, { query: { closed: true } });
  return { ok: true };
}

export async function comentarCartao({ cardId, texto }) {
  await chamar('POST', `/cards/${cardId}/actions/comments`, { query: { text: texto } });
  return { ok: true };
}
