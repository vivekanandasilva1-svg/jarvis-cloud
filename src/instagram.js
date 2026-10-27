// Instagram (API do Instagram com login do Instagram - conta profissional/comercial ou criador):
// conexao por OAuth por tenant, webhook de DMs e comentarios, atendimento das DMs pela mesma IA do
// Auto Atendimento (a conversa aparece na aba Conversas como mais um "numero", instancia "ig:<conta>"),
// respostas automaticas a comentario por palavra-chave (resposta publica e/ou direct) e publicacao
// de feed/carrossel/reels/story na hora ou agendada.
//
// Depende de um app na Meta (developers.facebook.com) com o produto "Instagram" -> "API com login
// do Instagram", aprovado nas permissoes instagram_business_basic, _manage_messages,
// _manage_comments e _content_publish. Enquanto INSTAGRAM_APP_ID/SECRET nao estiverem no ambiente
// a aba mostra "aguardando configuracao" e nada aqui roda.
import crypto from 'node:crypto';
import { pool } from './db.js';
import { encrypt, decrypt } from './crypto.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as crm from './crm.js';
import * as autoAtendimento from './autoAtendimento.js';

const GRAPH = 'https://graph.instagram.com/v23.0';
const ESCOPOS = ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments', 'instagram_business_content_publish'];
export const TIPOS_POST = ['feed', 'carrossel', 'reels', 'story'];
const MIDIA_MAX_BYTES = 100 * 1024 * 1024;

export function configurado() {
  return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}
export function urlBase() {
  return (process.env.PUBLIC_BASE_URL || 'https://lumia-marketing.com').replace(/\/$/, '');
}
const urlCallback = () => `${urlBase()}/api/instagram/callback`;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  // 1 conta de Instagram por tenant (ig_user_id unico: a mesma conta nao pode estar em 2 tenants,
  // senao o webhook nao saberia pra quem mandar a DM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_contas (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ig_user_id TEXT NOT NULL UNIQUE,
      username TEXT,
      nome TEXT,
      foto_url TEXT,
      token BYTEA NOT NULL,
      token_expira_em TIMESTAMPTZ,
      dm_ia_ativa BOOLEAN NOT NULL DEFAULT false,
      conectado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_regras_comentario (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      palavras TEXT[] NOT NULL,
      media_id TEXT,
      media_legenda TEXT,
      resposta_publica TEXT,
      resposta_dm TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      disparos INT NOT NULL DEFAULT 0,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // evita responder o mesmo comentario duas vezes (a Meta reenvia webhook)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_comentarios_tratados (
      tenant_id INT NOT NULL,
      comment_id TEXT NOT NULL,
      regra_id INT,
      em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, comment_id)
    );
  `);
  // arquivos enviados pra publicar - a Meta busca a midia por URL publica, entao ficam servidos
  // em /ig-midia/<token> (token aleatorio, nao da pra adivinhar) e sao apagados depois de publicados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_midias (
      token TEXT PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      mimetype TEXT NOT NULL,
      nome TEXT,
      tamanho INT,
      dados BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_posts (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      tipo TEXT NOT NULL,
      legenda TEXT,
      midias JSONB NOT NULL,
      agendado_para TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'agendado',
      containers JSONB,
      container_final TEXT,
      tentativas INT NOT NULL DEFAULT 0,
      erro TEXT,
      media_id TEXT,
      permalink TEXT,
      publicado_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS instagram_posts_fila_idx ON instagram_posts (status, agendado_para);`);
}
export const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Instagram:', err.message);
});

// ---------- chamadas a API ----------

async function chamarGraph(method, caminho, { token, params = {}, body } = {}) {
  const url = new URL(caminho.startsWith('http') ? caminho : `${GRAPH}${caminho}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const err = new Error(e.error_user_msg || e.message || `Instagram respondeu ${res.status}`);
    err.codigo = e.code;
    throw err;
  }
  return data;
}

async function obterConta(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM instagram_contas WHERE tenant_id = $1', [tenantId]);
  return rows[0] || null;
}
async function contaPorIgUserId(igUserId) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM instagram_contas WHERE ig_user_id = $1', [String(igUserId)]);
  return rows[0] || null;
}
const tokenDa = (conta) => decrypt(conta.token);
const instanciaDa = (conta) => `ig:${conta.username || conta.ig_user_id}`;

export async function status(tenantId) {
  const conta = await obterConta(tenantId);
  return {
    configurado: configurado(),
    conectado: !!conta,
    conta: conta ? {
      username: conta.username, nome: conta.nome, fotoUrl: conta.foto_url, tokenExpiraEm: conta.token_expira_em,
      dmIaAtiva: conta.dm_ia_ativa, conectadoEm: conta.conectado_em, instancia: instanciaDa(conta),
    } : null,
  };
}

// ---------- conexao (OAuth) ----------

// state assinado (tenant + validade) - nao precisa guardar nada em memoria e sobrevive a reinicio
function assinarEstado(tenantId) {
  const payload = Buffer.from(JSON.stringify({ t: tenantId, e: Date.now() + 15 * 60 * 1000, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`ig:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}
function lerEstado(state) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) return null;
  const esperada = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`ig:${payload}`).digest('base64url');
  if (sig.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperada))) return null;
  const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return dados.e > Date.now() ? dados.t : null;
}

export function urlAutorizacao(tenantId) {
  if (!configurado()) throw new Error('A integracao com o Instagram ainda nao foi configurada no servidor.');
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', process.env.INSTAGRAM_APP_ID);
  url.searchParams.set('redirect_uri', urlCallback());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', ESCOPOS.join(','));
  url.searchParams.set('state', assinarEstado(tenantId));
  return url.toString();
}

export async function concluirConexao(state, code) {
  const tenantId = lerEstado(state);
  if (!tenantId) throw new Error('Link de conexao expirado - tente conectar de novo pelo app.');
  // codigo curto -> token curto (1h) -> token longo (60 dias, renovado sozinho pelo agendador)
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: urlCallback(),
    code: String(code).replace(/#_$/, ''),
  });
  const resCurto = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  const curto = await resCurto.json().catch(() => ({}));
  if (!resCurto.ok || !curto.access_token) throw new Error(curto.error_message || 'O Instagram nao devolveu o acesso.');
  const longo = await chamarGraph('GET', 'https://graph.instagram.com/access_token', {
    params: { grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET, access_token: curto.access_token },
  });
  const perfil = await chamarGraph('GET', '/me', { token: longo.access_token, params: { fields: 'user_id,username,name,profile_picture_url' } });
  const igUserId = String(perfil.user_id || perfil.id);

  await tabelasProntas;
  const { rows: outro } = await pool.query('SELECT tenant_id FROM instagram_contas WHERE ig_user_id = $1 AND tenant_id <> $2', [igUserId, tenantId]);
  if (outro.length) throw new Error('Essa conta do Instagram ja esta conectada em outra conta da Lumia.');
  await pool.query(
    `INSERT INTO instagram_contas (tenant_id, ig_user_id, username, nome, foto_url, token, token_expira_em)
     VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7::int))
     ON CONFLICT (tenant_id) DO UPDATE SET ig_user_id = EXCLUDED.ig_user_id, username = EXCLUDED.username, nome = EXCLUDED.nome,
       foto_url = EXCLUDED.foto_url, token = EXCLUDED.token, token_expira_em = EXCLUDED.token_expira_em, conectado_em = now()`,
    [tenantId, igUserId, perfil.username || null, perfil.name || null, perfil.profile_picture_url || null, encrypt(longo.access_token), Number(longo.expires_in) || 5184000],
  );
  // inscreve a conta pra mandar DMs e comentarios pro nosso webhook
  await chamarGraph('POST', '/me/subscribed_apps', { token: longo.access_token, params: { subscribed_fields: 'messages,comments' } })
    .catch((err) => console.error('Instagram: falha inscrevendo webhook da conta:', err.message));
  return tenantId;
}

export async function desconectar(tenantId) {
  await tabelasProntas;
  await pool.query('DELETE FROM instagram_contas WHERE tenant_id = $1', [tenantId]);
}

export async function definirDmIa(tenantId, ativa) {
  await tabelasProntas;
  const { rowCount } = await pool.query('UPDATE instagram_contas SET dm_ia_ativa = $1 WHERE tenant_id = $2', [!!ativa, tenantId]);
  if (!rowCount) throw new Error('Conecte o Instagram primeiro.');
}

// token longo vale 60 dias - renova os que vencem em menos de 10 (precisa ter mais de 24h de vida)
async function renovarTokens() {
  if (!pool || !configurado()) return;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT * FROM instagram_contas WHERE token_expira_em < now() + interval '10 days' AND conectado_em < now() - interval '1 day'`);
  for (const conta of rows) {
    try {
      const novo = await chamarGraph('GET', 'https://graph.instagram.com/refresh_access_token', { params: { grant_type: 'ig_refresh_token', access_token: tokenDa(conta) } });
      await pool.query(`UPDATE instagram_contas SET token = $1, token_expira_em = now() + make_interval(secs => $2::int) WHERE tenant_id = $3`, [encrypt(novo.access_token), Number(novo.expires_in) || 5184000, conta.tenant_id]);
    } catch (err) {
      console.error(`Instagram: nao consegui renovar o token do tenant ${conta.tenant_id}:`, err.message);
    }
  }
}

// ---------- DMs ----------

// manda texto pra um usuario (IGSID) ou como resposta privada a um comentario (commentId). A
// Meta so deixa responder ate 24h depois da ultima mensagem da pessoa
async function enviarDMBruto(conta, { igsid, commentId, texto }) {
  return chamarGraph('POST', '/me/messages', {
    token: tokenDa(conta),
    body: { recipient: commentId ? { comment_id: commentId } : { id: igsid }, message: { text: String(texto).slice(0, 1000) } },
  });
}

// usado pelo crm.enviarMensagem quando o contato e do Instagram (instancia "ig:...")
export async function enviarDMDoCrm(tenantId, igsid, texto) {
  const conta = await obterConta(tenantId);
  if (!conta) throw new Error('O Instagram dessa conta esta desconectado.');
  try {
    return await enviarDMBruto(conta, { igsid, texto });
  } catch (err) {
    if (err.codigo === 10 || /window|janela|24/i.test(err.message)) {
      throw new Error('O Instagram so deixa responder ate 24h depois da ultima mensagem da pessoa.');
    }
    throw err;
  }
}

const perfisEmCache = new Map();
async function perfilDoRemetente(conta, igsid) {
  const chave = `${conta.tenant_id}:${igsid}`;
  if (perfisEmCache.has(chave)) return perfisEmCache.get(chave);
  let perfil = null;
  try {
    perfil = await chamarGraph('GET', `/${igsid}`, { token: tokenDa(conta), params: { fields: 'name,username' } });
  } catch { /* sem permissao de perfil: fica so o id */ }
  perfisEmCache.set(chave, perfil);
  if (perfisEmCache.size > 500) perfisEmCache.delete(perfisEmCache.keys().next().value);
  return perfil;
}

// uma resposta da IA por vez por contato (mensagens em sequencia nao geram respostas cruzadas)
const filaPorContato = new Map();
function enfileirar(chave, tarefa) {
  const anterior = filaPorContato.get(chave) || Promise.resolve();
  const atual = anterior.then(tarefa, tarefa).finally(() => {
    if (filaPorContato.get(chave) === atual) filaPorContato.delete(chave);
  });
  filaPorContato.set(chave, atual);
  return atual;
}

async function tratarMensagem(conta, evento) {
  const msg = evento.message;
  if (!msg || msg.is_deleted) return;
  const ehEco = !!msg.is_echo;
  const igsid = String(ehEco ? evento.recipient?.id : evento.sender?.id);
  if (!igsid || igsid === conta.ig_user_id) return;
  const instancia = instanciaDa(conta);
  const anexo = msg.attachments?.[0];
  const tipo = anexo ? ({ image: 'image', video: 'video', audio: 'audio', file: 'document' }[anexo.type] || 'text') : 'text';
  const texto = msg.text || (anexo ? (anexo.type === 'story_mention' ? '[mencionou voce num story]' : `[${anexo.type}]`) : '');

  if (ehEco) {
    // mensagem que saiu da conta (pelo app do Instagram ou por nos) - evitarEco nao duplica a que
    // a gente mesmo ja registrou ao enviar
    await crm.registrarMensagem(conta.tenant_id, { numero: igsid, instancia, direcao: 'saida', tipo, texto, quando: evento.timestamp, waId: msg.mid, evitarEco: true, autor: 'humano' });
    return;
  }

  const perfil = await perfilDoRemetente(conta, igsid);
  const nome = perfil?.name || (perfil?.username ? `@${perfil.username}` : null);
  await crm.registrarMensagem(conta.tenant_id, { numero: igsid, instancia, direcao: 'entrada', tipo, texto, nome, quando: evento.timestamp, waId: msg.mid });

  if (!conta.dm_ia_ativa) return;
  await enfileirar(`${conta.tenant_id}:${igsid}`, async () => {
    const config = await autoAtendimento.obterConfig(conta.tenant_id);
    if (!config.ativo || !config.prompt || !autoAtendimento.dentroDoHorario(config)) return;
    const { rows: [contato] } = await pool.query('SELECT auto_pausado FROM crm_contatos WHERE tenant_id = $1 AND numero = $2 AND instancia = $3', [conta.tenant_id, igsid, instancia]);
    if (contato?.auto_pausado) return;
    // IGSID (16+ digitos) nunca colide com telefone de WhatsApp na sessao da IA, e e o mesmo
    // "numero" do card no CRM - as ferramentas da IA (marcar agendado etc.) acham o card certo
    const resultado = await autoAtendimento.processarMensagem(conta.tenant_id, igsid, instancia, { texto, tipo: 'text', semAudio: true });
    if (!resultado?.texto) return;
    const enviada = await enviarDMBruto(conta, { igsid, texto: resultado.texto });
    await crm.registrarMensagem(conta.tenant_id, { numero: igsid, instancia, direcao: 'saida', tipo: 'text', texto: resultado.texto, waId: enviada?.message_id || null, autor: 'ia' });
  });
}

// ---------- comentarios ----------

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function regraBate(regra, texto) {
  const alvo = ` ${semAcento(texto).replace(/[^a-z0-9#@]+/g, ' ')} `;
  return regra.palavras.some((p) => {
    const chave = semAcento(p).replace(/[^a-z0-9#@]+/g, ' ').trim();
    return chave && alvo.includes(` ${chave} `);
  });
}

// troca {nome} pelo @ de quem comentou
const preencher = (texto, username) => String(texto || '').replace(/\{nome\}/gi, username ? `@${username}` : '').trim();

async function tratarComentario(conta, valor) {
  const commentId = String(valor?.id || '');
  if (!commentId || !valor.text) return;
  if (String(valor.from?.id) === conta.ig_user_id) return; // comentario da propria conta
  const mediaId = String(valor.media?.id || '');
  const { rows: regras } = await pool.query(
    `SELECT * FROM instagram_regras_comentario WHERE tenant_id = $1 AND ativo = true AND (media_id IS NULL OR media_id = $2) ORDER BY media_id NULLS LAST, id`,
    [conta.tenant_id, mediaId],
  );
  const regra = regras.find((r) => regraBate(r, valor.text));
  if (!regra) return;
  const { rowCount } = await pool.query(
    `INSERT INTO instagram_comentarios_tratados (tenant_id, comment_id, regra_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [conta.tenant_id, commentId, regra.id],
  );
  if (!rowCount) return; // ja respondido (webhook repetido)

  const username = valor.from?.username;
  const token = tokenDa(conta);
  if (regra.resposta_publica) {
    await chamarGraph('POST', `/${commentId}/replies`, { token, params: { message: preencher(regra.resposta_publica, username) } })
      .catch((err) => console.error('Instagram: falha respondendo comentario:', err.message));
  }
  if (regra.resposta_dm) {
    const texto = preencher(regra.resposta_dm, username);
    try {
      await enviarDMBruto(conta, { commentId, texto });
      // a resposta privada abre a conversa no direct - ja registra no CRM pra aparecer em Conversas
      if (valor.from?.id) {
        await crm.registrarMensagem(conta.tenant_id, {
          numero: String(valor.from.id), instancia: instanciaDa(conta), direcao: 'saida', tipo: 'text', texto, autor: 'ia',
        });
      }
    } catch (err) {
      console.error('Instagram: falha mandando direct do comentario:', err.message);
    }
  }
  await pool.query('UPDATE instagram_regras_comentario SET disparos = disparos + 1 WHERE id = $1', [regra.id]);
}

// ---------- webhook ----------

export function verificarAssinatura(rawBody, cabecalho) {
  if (!process.env.INSTAGRAM_APP_SECRET || !rawBody || !cabecalho) return false;
  const esperada = `sha256=${crypto.createHmac('sha256', process.env.INSTAGRAM_APP_SECRET).update(rawBody).digest('hex')}`;
  return esperada.length === cabecalho.length && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(cabecalho));
}

export async function processarWebhook(corpo) {
  if (corpo?.object !== 'instagram') return;
  for (const entrada of corpo.entry || []) {
    const conta = await contaPorIgUserId(entrada.id);
    if (!conta) continue;
    for (const evento of entrada.messaging || []) {
      await tratarMensagem(conta, evento).catch((err) => console.error('Instagram: erro tratando DM:', err.message));
    }
    for (const mudanca of entrada.changes || []) {
      if (mudanca.field === 'comments') {
        await tratarComentario(conta, mudanca.value).catch((err) => console.error('Instagram: erro tratando comentario:', err.message));
      }
    }
  }
}

// ---------- regras de comentario ----------

export async function listarRegras(tenantId) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM instagram_regras_comentario WHERE tenant_id = $1 ORDER BY criado_em DESC', [tenantId]);
  return rows;
}

export async function salvarRegra(tenantId, dados) {
  await tabelasProntas;
  const palavras = [...new Set((Array.isArray(dados.palavras) ? dados.palavras : String(dados.palavras || '').split(','))
    .map((p) => String(p).trim().slice(0, 60)).filter(Boolean))].slice(0, 20);
  if (!palavras.length) throw new Error('Informe pelo menos uma palavra-chave.');
  const publica = String(dados.respostaPublica || '').trim().slice(0, 300) || null;
  const dm = String(dados.respostaDm || '').trim().slice(0, 1000) || null;
  if (!publica && !dm) throw new Error('Escreva a resposta no comentário, a mensagem no direct, ou as duas.');
  const valores = [palavras, dados.mediaId || null, dados.mediaLegenda ? String(dados.mediaLegenda).slice(0, 120) : null, publica, dm];
  if (dados.id) {
    const { rowCount } = await pool.query(
      `UPDATE instagram_regras_comentario SET palavras = $1, media_id = $2, media_legenda = $3, resposta_publica = $4, resposta_dm = $5 WHERE id = $6 AND tenant_id = $7`,
      [...valores, Number(dados.id), tenantId],
    );
    if (!rowCount) throw new Error('Regra nao encontrada.');
    return Number(dados.id);
  }
  const { rows } = await pool.query(
    `INSERT INTO instagram_regras_comentario (tenant_id, palavras, media_id, media_legenda, resposta_publica, resposta_dm) VALUES ($6, $1, $2, $3, $4, $5) RETURNING id`,
    [...valores, tenantId],
  );
  return rows[0].id;
}

export async function alternarRegra(tenantId, id, ativo) {
  await tabelasProntas;
  await pool.query('UPDATE instagram_regras_comentario SET ativo = $1 WHERE id = $2 AND tenant_id = $3', [!!ativo, Number(id), tenantId]);
}
export async function apagarRegra(tenantId, id) {
  await tabelasProntas;
  await pool.query('DELETE FROM instagram_regras_comentario WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// ultimas publicacoes da conta (pra escolher em qual post a regra vale)
export async function listarPublicacoes(tenantId) {
  const conta = await obterConta(tenantId);
  if (!conta) return [];
  const data = await chamarGraph('GET', '/me/media', { token: tokenDa(conta), params: { fields: 'id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp', limit: 24 } });
  return (data.data || []).map((m) => ({
    id: m.id, legenda: (m.caption || '').slice(0, 120), tipo: m.media_product_type || m.media_type,
    miniatura: m.thumbnail_url || (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? m.media_url : null),
    link: m.permalink, em: m.timestamp,
  }));
}

// ---------- midias pra publicar ----------

export async function guardarMidia(tenantId, { buffer, mimetype, nome }) {
  await tabelasProntas;
  if (!buffer?.length) throw new Error('Arquivo vazio.');
  if (buffer.length > MIDIA_MAX_BYTES) throw new Error('Arquivo maior que 100 MB.');
  if (!/^(image\/jpeg|video\/mp4|video\/quicktime)$/.test(mimetype)) throw new Error('Use foto JPG ou vídeo MP4/MOV.');
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query(
    'INSERT INTO instagram_midias (token, tenant_id, mimetype, nome, tamanho, dados) VALUES ($1, $2, $3, $4, $5, $6)',
    [token, tenantId, mimetype, String(nome || '').slice(0, 120) || null, buffer.length, buffer],
  );
  return { token, tipo: mimetype.startsWith('video/') ? 'video' : 'imagem', tamanho: buffer.length };
}

export async function lerMidiaPublica(token) {
  if (!pool || !/^[0-9a-f]{48}$/.test(String(token))) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT mimetype, dados FROM instagram_midias WHERE token = $1', [token]);
  return rows[0] || null;
}

// ---------- publicacoes (agendadas ou na hora) ----------

export async function criarPost(tenantId, { tipo, legenda, midias, agendadoPara }) {
  await tabelasProntas;
  if (!(await obterConta(tenantId))) throw new Error('Conecte o Instagram primeiro.');
  if (!TIPOS_POST.includes(tipo)) throw new Error('Tipo de publicacao invalido.');
  const lista = Array.isArray(midias) ? midias : [];
  const { rows: donas } = await pool.query('SELECT token, mimetype FROM instagram_midias WHERE tenant_id = $1 AND token = ANY($2::text[])', [tenantId, lista]);
  const porToken = new Map(donas.map((d) => [d.token, d.mimetype]));
  if (!lista.length || lista.some((t) => !porToken.has(t))) throw new Error('Envie os arquivos de novo - algum deles nao foi encontrado.');
  const tipos = lista.map((t) => (porToken.get(t).startsWith('video/') ? 'video' : 'imagem'));
  if (tipo === 'feed' && (lista.length !== 1 || tipos[0] !== 'imagem')) throw new Error('Post de feed usa 1 foto (pra várias, use carrossel; pra vídeo, use reels).');
  if (tipo === 'carrossel' && (lista.length < 2 || lista.length > 10)) throw new Error('Carrossel precisa de 2 a 10 arquivos.');
  if (tipo === 'reels' && (lista.length !== 1 || tipos[0] !== 'video')) throw new Error('Reels usa 1 vídeo.');
  if (tipo === 'story' && lista.length !== 1) throw new Error('Story usa 1 foto ou 1 vídeo por vez.');
  const quando = agendadoPara ? new Date(agendadoPara) : new Date();
  if (Number.isNaN(quando.getTime())) throw new Error('Data de agendamento invalida.');
  if (quando.getTime() > Date.now() + 75 * 86400000) throw new Error('Agende no maximo 75 dias pra frente.');
  const { rows } = await pool.query(
    `INSERT INTO instagram_posts (tenant_id, tipo, legenda, midias, agendado_para) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, tipo, tipo === 'story' ? null : String(legenda || '').slice(0, 2200), JSON.stringify(lista.map((t, i) => ({ token: t, tipo: tipos[i] }))), quando],
  );
  // "publicar agora" ja comeca na hora em vez de esperar o proximo minuto do agendador
  if (quando.getTime() <= Date.now() + 1000) processarFila().catch(() => {});
  return rows[0].id;
}

export async function listarPosts(tenantId) {
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, tipo, legenda, midias, agendado_para, status, erro, permalink, publicado_em, criado_em FROM instagram_posts
     WHERE tenant_id = $1 AND (status IN ('agendado', 'processando') OR criado_em > now() - interval '60 days')
     ORDER BY agendado_para DESC LIMIT 100`,
    [tenantId],
  );
  return rows;
}

export async function cancelarPost(tenantId, id) {
  await tabelasProntas;
  const { rowCount } = await pool.query(`UPDATE instagram_posts SET status = 'cancelado' WHERE id = $1 AND tenant_id = $2 AND status = 'agendado'`, [Number(id), tenantId]);
  if (!rowCount) throw new Error('So da pra cancelar publicacao que ainda nao comecou.');
}

const urlMidia = (token) => `${urlBase()}/ig-midia/${token}`;

// cria os "containers" na Meta (1 por midia; carrossel ganha mais 1 juntando os filhos)
async function criarContainers(conta, post) {
  const token = tokenDa(conta);
  const midias = post.midias;
  const corpoMidia = (m, extra = {}) => (m.tipo === 'video' ? { video_url: urlMidia(m.token), ...extra } : { image_url: urlMidia(m.token), ...extra });
  if (post.tipo === 'carrossel') {
    const filhos = [];
    for (const m of midias) {
      const r = await chamarGraph('POST', '/me/media', { token, body: corpoMidia(m, { is_carousel_item: true, ...(m.tipo === 'video' ? { media_type: 'VIDEO' } : {}) }) });
      filhos.push(r.id);
    }
    const pai = await chamarGraph('POST', '/me/media', { token, body: { media_type: 'CAROUSEL', children: filhos.join(','), caption: post.legenda || undefined } });
    return { containers: [...filhos, pai.id], final: pai.id };
  }
  const m = midias[0];
  const extra = post.tipo === 'reels' ? { media_type: 'REELS', caption: post.legenda || undefined }
    : post.tipo === 'story' ? { media_type: 'STORIES' }
      : { caption: post.legenda || undefined };
  const r = await chamarGraph('POST', '/me/media', { token, body: corpoMidia(m, extra) });
  return { containers: [r.id], final: r.id };
}

async function statusContainers(conta, ids) {
  const token = tokenDa(conta);
  const estados = [];
  for (const id of ids) {
    const r = await chamarGraph('GET', `/${id}`, { token, params: { fields: 'status_code,status' } });
    estados.push(r);
  }
  return estados;
}

let filaRodando = false;
export async function processarFila() {
  if (!pool || !configurado() || filaRodando) return;
  filaRodando = true;
  try {
    await tabelasProntas;
    const { rows } = await pool.query(
      `SELECT p.* FROM instagram_posts p JOIN instagram_contas c ON c.tenant_id = p.tenant_id
       WHERE (p.status = 'agendado' AND p.agendado_para <= now()) OR p.status = 'processando' ORDER BY p.agendado_para LIMIT 10`,
    );
    for (const post of rows) {
      const conta = await obterConta(post.tenant_id);
      try {
        if (post.status === 'agendado') {
          const { containers, final } = await criarContainers(conta, post);
          await pool.query(`UPDATE instagram_posts SET status = 'processando', containers = $1, container_final = $2 WHERE id = $3`, [JSON.stringify(containers), final, post.id]);
          continue; // video precisa de tempo pra Meta processar - confere no proximo minuto
        }
        const estados = await statusContainers(conta, post.containers || []);
        if (estados.some((e) => e.status_code === 'ERROR' || e.status_code === 'EXPIRED')) {
          const detalhe = estados.find((e) => e.status_code === 'ERROR' || e.status_code === 'EXPIRED');
          throw new Error(`O Instagram recusou a mídia (${detalhe.status || detalhe.status_code}). Confira formato e proporção.`);
        }
        if (estados.some((e) => e.status_code && e.status_code !== 'FINISHED' && e.status_code !== 'PUBLISHED')) {
          if (post.tentativas > 40) throw new Error('O Instagram demorou demais pra processar o vídeo.');
          await pool.query('UPDATE instagram_posts SET tentativas = tentativas + 1 WHERE id = $1', [post.id]);
          continue;
        }
        const publicado = await chamarGraph('POST', '/me/media_publish', { token: tokenDa(conta), body: { creation_id: post.container_final } });
        let permalink = null;
        try {
          permalink = (await chamarGraph('GET', `/${publicado.id}`, { token: tokenDa(conta), params: { fields: 'permalink' } })).permalink || null;
        } catch { /* story nao tem permalink publico */ }
        await pool.query(`UPDATE instagram_posts SET status = 'publicado', media_id = $1, permalink = $2, publicado_em = now(), erro = NULL WHERE id = $3`, [publicado.id, permalink, post.id]);
      } catch (err) {
        await pool.query(`UPDATE instagram_posts SET status = 'erro', erro = $1 WHERE id = $2`, [String(err.message).slice(0, 500), post.id]);
      }
    }
    // arquivos ja publicados (ou de publicacoes canceladas/com erro) somem depois de 3 dias; os
    // enviados e nunca usados, depois de 2 dias
    await pool.query(
      `DELETE FROM instagram_midias m WHERE m.criado_em < now() - interval '2 days' AND NOT EXISTS (
         SELECT 1 FROM instagram_posts p WHERE p.tenant_id = m.tenant_id AND p.midias @> jsonb_build_array(jsonb_build_object('token', m.token))
           AND (p.status IN ('agendado', 'processando') OR p.criado_em > now() - interval '3 days'))`,
    );
  } catch (err) {
    console.error('Instagram: erro no agendador de publicacoes:', err.message);
  } finally {
    filaRodando = false;
  }
}

export function iniciarAgendadorInstagram() {
  setInterval(() => processarFila(), 60 * 1000).unref();
  setInterval(() => renovarTokens(), 6 * 60 * 60 * 1000).unref();
  setTimeout(() => renovarTokens(), 60 * 1000).unref();
}
