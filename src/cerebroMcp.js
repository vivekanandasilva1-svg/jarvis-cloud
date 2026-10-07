// Endpoint MCP do Cerebro (ver cerebro.js) - e por aqui que Claude, ChatGPT, Cursor etc. se
// conectam pra ler/gravar na memoria compartilhada do tenant.
//
// Implementa o transporte "Streamable HTTP" do MCP na mao (so JSON-RPC via POST, respondendo
// JSON direto, sem SSE) em vez de puxar o @modelcontextprotocol/sdk - o protocolo que a gente
// precisa e pequeno (initialize, tools/list, tools/call, ping) e assim o app nao ganha nenhuma
// dependencia nova. Sem estado de sessao no servidor: cada POST e autocontido.
//
// Autenticacao: token proprio do Cerebro (crb_..., criado na aba), aceito de 2 jeitos - no
// header "Authorization: Bearer" (Claude Code, Cursor) ou no proprio caminho da URL
// (/mcp/<token>), porque os conectores do claude.ai/ChatGPT so aceitam colar uma URL, sem header.
import express from 'express';
import * as cerebro from './cerebro.js';

const VERSOES_SUPORTADAS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCOES = `Este servidor e o "Cerebro": a memoria de longo prazo compartilhada entre todas as IAs do usuario (Claude, ChatGPT, Cursor, Lumia...).
- No inicio de uma tarefa ou quando o usuario mencionar um projeto, cliente ou decisao anterior, use buscar_memoria antes de responder.
- Quando surgir algo que valha lembrar em outra conversa ou em outra IA (decisao tomada, preferencia do usuario, fato de um projeto, aprendizado, tarefa combinada), use salvar_memoria com um texto curto e autossuficiente (de pra entender sem o resto da conversa) e o nome do projeto.
- Nao salve conversa fiada, dados temporarios nem segredos (senhas, chaves de API, tokens).
- Se uma memoria antiga ficou errada ou desatualizada, use atualizar_memoria em vez de criar outra repetida.`;

const TOOLS = [
  {
    name: 'buscar_memoria',
    description: 'Busca por SIGNIFICADO na memoria compartilhada (nao precisa das palavras exatas). Use antes de responder sobre projetos, clientes, decisoes ou preferencias do usuario.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'O que voce quer lembrar, em linguagem natural' },
        projeto: { type: 'string', description: 'Opcional: restringe a um projeto' },
        limite: { type: 'integer', description: 'Quantos resultados (padrao 8, max 30)' },
      },
      required: ['consulta'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'salvar_memoria',
    description: 'Grava uma memoria nova (decisao, fato, preferencia, tarefa, contexto ou aprendizado) que todas as IAs do usuario vao poder consultar depois. Liga sozinha a memorias parecidas.',
    inputSchema: {
      type: 'object',
      properties: {
        conteudo: { type: 'string', description: 'O que lembrar - texto curto e autossuficiente' },
        titulo: { type: 'string', description: 'Titulo curto (opcional, ajuda no grafo)' },
        tipo: { type: 'string', enum: cerebro.TIPOS, description: 'Categoria da memoria' },
        projeto: { type: 'string', description: 'Nome do projeto/cliente (use sempre o mesmo nome pro mesmo projeto)' },
        tags: { type: 'array', items: { type: 'string' } },
        relacionadas: { type: 'array', items: { type: 'integer' }, description: 'IDs de memorias que tem relacao direta com esta' },
      },
      required: ['conteudo'],
    },
  },
  {
    name: 'listar_memorias',
    description: 'Lista as memorias mais recentes, com filtro opcional por projeto ou tipo.',
    inputSchema: {
      type: 'object',
      properties: {
        projeto: { type: 'string' },
        tipo: { type: 'string', enum: cerebro.TIPOS },
        limite: { type: 'integer', description: 'Padrao 20, max 100' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'ver_memoria',
    description: 'Mostra uma memoria completa pelo ID, junto com as memorias ligadas a ela.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'atualizar_memoria',
    description: 'Corrige ou complementa uma memoria existente (use quando algo mudou, em vez de criar uma duplicada).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        conteudo: { type: 'string' },
        titulo: { type: 'string' },
        tipo: { type: 'string', enum: cerebro.TIPOS },
        projeto: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'esquecer_memoria',
    description: 'Arquiva uma memoria que nao vale mais (ela some das buscas e do grafo).',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
    annotations: { destructiveHint: true },
  },
  {
    name: 'listar_projetos',
    description: 'Lista os projetos que ja tem memorias, com a quantidade de cada um - util pra usar o nome de projeto certo.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
];

const dataCurta = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function formatarMemoria(m) {
  const cab = [`#${m.id}`, m.titulo ? `"${m.titulo}"` : null, `[${m.tipo}]`, m.projeto ? `projeto: ${m.projeto}` : null, `via ${m.origem}`, dataCurta(m.criado_em), m.similaridade != null ? `relevancia ${m.similaridade}` : null]
    .filter(Boolean).join(' · ');
  return `${cab}\n${m.conteudo}${m.tags?.length ? `\ntags: ${m.tags.join(', ')}` : ''}`;
}

const texto = (t) => ({ content: [{ type: 'text', text: t }] });

async function executarTool(nome, args, { tenantId, origem }) {
  switch (nome) {
    case 'buscar_memoria': {
      const r = await cerebro.buscarMemorias(tenantId, args);
      return texto(r.length ? r.map(formatarMemoria).join('\n\n') : 'Nenhuma memoria encontrada sobre isso.');
    }
    case 'salvar_memoria': {
      const m = await cerebro.salvarMemoria(tenantId, { ...args, origem });
      return texto(`Memoria #${m.id} salva${m.ligadaA.length ? `, ligada a ${m.ligadaA.map((i) => `#${i}`).join(', ')}` : ''}.`);
    }
    case 'listar_memorias': {
      const r = await cerebro.listarMemorias(tenantId, args);
      return texto(r.length ? r.map(formatarMemoria).join('\n\n') : 'Nenhuma memoria ainda.');
    }
    case 'ver_memoria': {
      const m = await cerebro.obterMemoria(tenantId, Number(args.id));
      if (!m) return texto(`Memoria #${args.id} nao encontrada.`);
      const rel = m.relacionadas.map((r) => `- #${r.id} ${r.titulo || r.conteudo.slice(0, 80)}`).join('\n');
      return texto(`${formatarMemoria(m)}${rel ? `\n\nLigada a:\n${rel}` : ''}`);
    }
    case 'atualizar_memoria': {
      const { id, ...campos } = args;
      const m = await cerebro.atualizarMemoria(tenantId, Number(id), campos);
      return texto(`Memoria #${m.id} atualizada.`);
    }
    case 'esquecer_memoria':
      await cerebro.arquivarMemoria(tenantId, Number(args.id));
      return texto(`Memoria #${args.id} arquivada.`);
    case 'listar_projetos': {
      const r = await cerebro.listarProjetos(tenantId);
      return texto(r.length ? r.map((p) => `- ${p.projeto} (${p.total})`).join('\n') : 'Nenhum projeto ainda.');
    }
    default:
      return null;
  }
}

const erroRpc = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function tratarMensagem(msg, auth) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return erroRpc(msg?.id, -32600, 'Invalid Request');
  const ehNotificacao = msg.id === undefined || msg.id === null;
  if (ehNotificacao) return null; // notifications/initialized, cancelled etc. - nada a responder
  const { id, method, params = {} } = msg;

  if (method === 'initialize') {
    const pedida = params.protocolVersion;
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: VERSOES_SUPORTADAS.includes(pedida) ? pedida : VERSOES_SUPORTADAS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cerebro-lumia', title: 'Cerebro (Lumia)', version: '1.0.0' },
        instructions: INSTRUCOES,
      },
    };
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    try {
      const r = await executarTool(params.name, params.arguments || {}, auth);
      if (!r) return erroRpc(id, -32602, `Tool desconhecida: ${params.name}`);
      return { jsonrpc: '2.0', id, result: r };
    } catch (err) {
      // erro de execucao vai como resultado com isError (a IA le e corrige), nao como erro de protocolo
      return { jsonrpc: '2.0', id, result: { ...texto(`Erro: ${err.message}`), isError: true } };
    }
  }
  if (method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } };
  if (method === 'prompts/list') return { jsonrpc: '2.0', id, result: { prompts: [] } };
  return erroRpc(id, -32601, `Metodo nao suportado: ${method}`);
}

export const router = express.Router();

async function autenticar(req, res, next) {
  const header = req.header('authorization') || '';
  const token = req.params.token || (header.startsWith('Bearer ') ? header.slice(7).trim() : null);
  try {
    const auth = await cerebro.autenticarToken(token);
    if (!auth) {
      res.set('WWW-Authenticate', 'Bearer realm="cerebro"');
      return res.status(401).json(erroRpc(null, -32001, 'Token do Cerebro invalido, revogado ou recurso nao liberado pra essa conta'));
    }
    req.cerebroAuth = auth;
    next();
  } catch (err) {
    res.status(500).json(erroRpc(null, -32603, err.message));
  }
}

async function postMcp(req, res) {
  const corpo = req.body;
  const lote = Array.isArray(corpo);
  const mensagens = lote ? corpo : [corpo];
  const respostas = (await Promise.all(mensagens.map((m) => tratarMensagem(m, req.cerebroAuth)))).filter(Boolean);
  if (!respostas.length) return res.status(202).end();
  res.json(lote ? respostas : respostas[0]);
}

// sem SSE: GET (stream de notificacoes do servidor) nao e oferecido - a especificacao manda
// responder 405 nesse caso, e os clientes seguem normalmente so com POST
const semStream = (req, res) => res.status(405).set('Allow', 'POST').json(erroRpc(null, -32000, 'Use POST'));

router.post('/mcp', autenticar, postMcp);
router.post('/mcp/:token', autenticar, postMcp);
router.get(['/mcp', '/mcp/:token'], semStream);
router.delete(['/mcp', '/mcp/:token'], (req, res) => res.status(200).end());
