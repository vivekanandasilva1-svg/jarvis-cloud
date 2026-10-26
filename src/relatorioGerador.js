// Gerador de Relatorios (aba "Gerador de Relatorios" do app): monta um relatorio de performance
// em HTML autocontido (sem depender de CDN externo - abre offline, em qualquer navegador, sem
// quebrar visual se o cliente nao tiver internet no momento de abrir), com tema de cor
// escolhivel. Duas fontes de dado:
//  - "auto": os NUMEROS vem direto da API do Meta Ads (metaads.js), calculados em codigo - mesmo
//    principio do relatorioDiario.js (nunca deixa a IA inventar numero). A IA so escreve a
//    analise qualitativa em cima dos numeros reais.
//  - "manual": o usuario anexa print/planilha/PDF de outro lugar (ex: relatorio de outra
//    plataforma) e a IA extrai os numeros de la, alem de escrever a analise - aqui SIM a IA
//    decide os numeros, porque nao tem outra fonte de verdade disponivel.
import crypto from 'node:crypto';
import { anthropic } from './anthropicClient.js';
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as metaAds from './metaads.js';
import { extrairTextoWord, extrairTextoExcel } from './leitorDocumentos.js';
import { obterMarcaRelatorio } from './tenantConfig.js';

const MODEL = 'claude-sonnet-5';

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relatorio_temas (
      id TEXT PRIMARY KEY,
      tenant_id INT REFERENCES tenants(id),
      nome TEXT NOT NULL,
      bg TEXT NOT NULL,
      panel TEXT NOT NULL,
      texto TEXT NOT NULL,
      muted TEXT NOT NULL,
      accent TEXT NOT NULL,
      accent2 TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relatorios_gerados (
      id TEXT PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      titulo TEXT,
      tema_id TEXT NOT NULL,
      fonte TEXT NOT NULL,
      html TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS relatorios_gerados_tenant_idx ON relatorios_gerados (tenant_id);`);
  // o que e preciso pra AJUSTAR um relatorio depois de gerado (sem buscar os numeros de novo) e
  // pra mostrar o que foi pedido: numeros usados, analise+layout, pedido original e ajustes
  await pool.query(`ALTER TABLE relatorios_gerados ADD COLUMN IF NOT EXISTS dados JSONB;`);
  await pool.query(`ALTER TABLE relatorios_gerados ADD COLUMN IF NOT EXISTS config JSONB;`);
  await pool.query(`ALTER TABLE relatorios_gerados ADD COLUMN IF NOT EXISTS instrucoes TEXT;`);
  await pool.query(`ALTER TABLE relatorios_gerados ADD COLUMN IF NOT EXISTS cliente_nome TEXT;`);
  await pool.query(`ALTER TABLE relatorios_gerados ADD COLUMN IF NOT EXISTS ajustes JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS relatorio_temas_tenant_idx ON relatorio_temas (tenant_id);`);
}
export const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Gerador de Relatorios:', err.message);
});

function novoId() {
  return crypto.randomBytes(6).toString('base64url');
}

// ---------- temas ----------

const TEMAS_PADRAO = [
  { id: 'padrao:branco-gold', nome: 'Branco & Gold', bg: '#f7f7f5', panel: '#ffffff', texto: '#0f172a', muted: '#64748b', accent: '#c5a059', accent2: '#8a6d2f' },
  { id: 'padrao:preto-gold', nome: 'Preto & Gold', bg: '#020617', panel: '#0f172a', texto: '#f1f5f9', muted: '#94a3b8', accent: '#f5b942', accent2: '#b45309' },
  { id: 'padrao:verde-prata', nome: 'Verde & Prata', bg: '#000000', panel: '#0c0c0c', texto: '#f4f4f5', muted: '#a1a1aa', accent: '#10b981', accent2: '#065f46' },
  { id: 'padrao:vermelho-prata', nome: 'Vermelho & Prata', bg: '#000000', panel: '#0c0c0c', texto: '#f4f4f5', muted: '#a1a1aa', accent: '#ef4444', accent2: '#7f1d1d' },
];

export async function listarTemas(tenantId) {
  if (!pool) return TEMAS_PADRAO;
  const { rows } = await pool.query(
    `SELECT id, nome, bg, panel, texto, muted, accent, accent2 FROM relatorio_temas WHERE tenant_id = $1 ORDER BY criado_em`,
    [tenantId],
  );
  return [...TEMAS_PADRAO, ...rows];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function validarCor(valor, campo) {
  if (typeof valor !== 'string' || !HEX_RE.test(valor)) {
    throw new Error(`Cor invalida em "${campo}" (use o formato #RRGGBB)`);
  }
  return valor;
}

export async function criarTema(tenantId, { nome, bg, panel, texto, muted, accent, accent2 }) {
  if (!pool) throw new Error('banco de dados indisponivel');
  if (!nome || !nome.trim()) throw new Error('nome do tema e obrigatorio');
  const cores = {
    bg: validarCor(bg, 'fundo'),
    panel: validarCor(panel, 'painel'),
    texto: validarCor(texto, 'texto'),
    muted: validarCor(muted, 'texto secundario'),
    accent: validarCor(accent, 'destaque'),
    accent2: validarCor(accent2, 'destaque 2'),
  };
  const id = novoId();
  await pool.query(
    `INSERT INTO relatorio_temas (id, tenant_id, nome, bg, panel, texto, muted, accent, accent2)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, tenantId, nome.trim().slice(0, 60), cores.bg, cores.panel, cores.texto, cores.muted, cores.accent, cores.accent2],
  );
  return { id, nome: nome.trim().slice(0, 60), ...cores };
}

export async function apagarTema(tenantId, id) {
  if (!pool || id.startsWith('padrao:')) return false;
  const { rowCount } = await pool.query(`DELETE FROM relatorio_temas WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  return rowCount > 0;
}

async function obterTema(tenantId, temaId) {
  const padrao = TEMAS_PADRAO.find((t) => t.id === temaId);
  if (padrao) return padrao;
  if (!pool) return TEMAS_PADRAO[0];
  const { rows } = await pool.query(
    `SELECT id, nome, bg, panel, texto, muted, accent, accent2 FROM relatorio_temas WHERE id = $1 AND tenant_id = $2`,
    [temaId, tenantId],
  );
  return rows[0] || TEMAS_PADRAO[0];
}

// ---------- dados: fonte automatica (numeros reais do Meta Ads) ----------

const LABEL_RESULTADO = {
  lead: 'Leads', 'onsite_conversion.lead': 'Leads', purchase: 'Compras',
  'onsite_conversion.messaging_conversation_started_7d': 'Conversas iniciadas', link_click: 'Cliques no link',
};

function num(v) {
  return Number(v || 0);
}

export async function buscarDadosAutomatico(tenantId, { accountId, from, to }) {
  if (!accountId) throw new Error('accountId e obrigatorio no modo automatico');
  if (!from || !to) throw new Error('periodo (from/to) e obrigatorio no modo automatico');

  const contas = await metaAds.listAdAccounts(tenantId);
  const conta = contas.find((c) => c.id === accountId || c.id === `act_${accountId}`);

  const linhas = await metaAds.getInsights(tenantId, { objectId: accountId, objectType: 'account', since: from, until: to });
  const linha = linhas[0] || {};
  const { tipo, resultados, custoPorResultado } = metaAds.extractResultsAndCPA(linha);

  const videoPlay = num(linha.video_play_actions?.[0]?.value);
  const video50 = num(linha.video_p50_watched_actions?.[0]?.value);
  const video95 = num(linha.video_p95_watched_actions?.[0]?.value);
  const videoRows = videoPlay > 0 ? [
    { label: 'Iniciaram o vídeo', value: videoPlay },
    { label: 'Assistiram 50%', value: video50 },
    { label: 'Assistiram até o fim (95%+)', value: video95 },
  ] : null;

  return {
    clienteNome: conta?.empresa || conta?.name || 'Cliente',
    periodo: `${formatarDataBR(from)} a ${formatarDataBR(to)}`,
    investimento: num(linha.spend),
    resultados,
    tipoResultado: LABEL_RESULTADO[tipo] || (tipo ? tipo : null),
    custoPorResultado,
    alcance: num(linha.reach),
    impressoes: num(linha.impressions),
    cliques: num(linha.clicks),
    frequencia: num(linha.frequency),
    cpm: num(linha.cpm),
    ctr: num(linha.ctr),
    videoRows,
  };
}

function formatarDataBR(isoDate) {
  const [ano, mes, dia] = String(isoDate).split('-');
  return `${dia}/${mes}/${ano}`;
}

// ---------- layout ajustavel pela IA ----------
// O relatorio nao tem mais layout fixo: a IA devolve, junto com a analise, um "layout" (titulo,
// quais metricas aparecem e em que ordem, nomes das secoes, quantas sugestoes, secoes extras,
// notas, cores...). Assim qualquer pedido do usuario ("tira o CPM", "muda o titulo", "coloca 5
// sugestoes", "adiciona uma secao sobre o criativo") vira mudanca real no relatorio. Os NUMEROS
// continuam vindo da fonte (Meta Ads ou arquivo) - a IA so escolhe o que mostrar e como chamar.

const METRICAS = {
  investimento: { rotulo: () => 'Investimento Total', valor: (d) => fmtReais(d.investimento), icone: 'trending' },
  resultados: { rotulo: (d) => d.tipoResultado || 'Resultados', valor: (d) => fmtNum(d.resultados), icone: 'check' },
  custoPorResultado: { rotulo: () => 'Custo por Resultado', valor: (d) => fmtReais(d.custoPorResultado), icone: 'activity' },
  alcance: { rotulo: () => 'Alcance Único', valor: (d) => fmtNum(d.alcance), icone: 'eye' },
  impressoes: { rotulo: () => 'Impressões', valor: (d) => fmtNum(d.impressoes), icone: 'eye' },
  cliques: { rotulo: () => 'Cliques Totais', valor: (d) => fmtNum(d.cliques), icone: 'click' },
  frequencia: { rotulo: () => 'Frequência', valor: (d) => fmtNum(d.frequencia, 2), icone: 'activity' },
  cpm: { rotulo: () => 'CPM Médio', valor: (d) => fmtReais(d.cpm), icone: 'trending' },
  ctr: { rotulo: () => 'Taxa de Clique (CTR)', valor: (d) => fmtPct(d.ctr), icone: 'bars' },
};
const CHAVES_METRICAS = Object.keys(METRICAS);

const LAYOUT_PADRAO = {
  titulo: 'Relatório Estratégico',
  subtitulo: 'Performance de Excelência',
  clienteNome: '',
  periodoTexto: '',
  kpis: ['investimento', 'resultados', 'custoPorResultado', 'alcance'],
  metricasEficiencia: ['impressoes', 'cliques', 'frequencia', 'cpm'],
  destaque: 'ctr',
  mostrarPainelDireito: true,
  mostrarSugestoes: true,
  nomes: {
    eficiencia: 'Eficiência e Tráfego', painelDireito: '', analise: 'Análise Executiva e Plano de Ação',
    analiseMetricas: 'Análise das Métricas', conclusao: 'Conclusões Estratégicas', sugestoes: 'Diretrizes de Crescimento',
  },
  rotulos: [],
  secoesExtras: [],
  notaFinal: '',
  cores: {},
};

const SCHEMA_LAYOUT = {
  type: 'object',
  description: 'Estrutura visual do relatorio. Parta do layout atual (ou do padrao) e mude SO o que o usuario pediu.',
  properties: {
    titulo: { type: 'string', description: 'Titulo principal (a ultima palavra fica em destaque de cor). Padrao: "Relatório Estratégico"' },
    subtitulo: { type: 'string', description: 'Linha pequena acima do titulo e abaixo da marca. Padrao: "Performance de Excelência"' },
    clienteNome: { type: 'string', description: 'Sobrescreve o nome do cliente exibido; vazio = usa o dos dados' },
    periodoTexto: { type: 'string', description: 'Sobrescreve o texto do periodo exibido; vazio = usa o dos dados' },
    kpis: { type: 'array', items: { type: 'string', enum: CHAVES_METRICAS }, description: 'Cartoes grandes do topo, na ordem (0 a 6)' },
    metricasEficiencia: { type: 'array', items: { type: 'string', enum: CHAVES_METRICAS }, description: 'Metricas do painel de eficiencia, na ordem (0 a 8)' },
    destaque: { type: 'string', enum: [...CHAVES_METRICAS, ''], description: 'Metrica na caixa grande de destaque do painel de eficiencia; "" = sem caixa' },
    mostrarPainelDireito: { type: 'boolean', description: 'Painel da direita (retencao de video ou engajamento estimado)' },
    mostrarSugestoes: { type: 'boolean', description: 'Bloco de sugestoes/diretrizes' },
    nomes: {
      type: 'object',
      description: 'Titulos das secoes',
      properties: {
        eficiencia: { type: 'string' }, painelDireito: { type: 'string', description: 'vazio = automatico' }, analise: { type: 'string' },
        analiseMetricas: { type: 'string' }, conclusao: { type: 'string' }, sugestoes: { type: 'string' },
      },
    },
    rotulos: {
      type: 'array',
      description: 'Renomeia o rotulo de uma metrica (ex: resultados -> "Pacientes captados")',
      items: { type: 'object', properties: { metrica: { type: 'string', enum: CHAVES_METRICAS }, rotulo: { type: 'string' } }, required: ['metrica', 'rotulo'] },
    },
    secoesExtras: {
      type: 'array',
      description: 'Secoes de texto adicionais pedidas pelo usuario, exibidas depois da analise',
      items: { type: 'object', properties: { titulo: { type: 'string' }, texto: { type: 'string' } }, required: ['titulo', 'texto'] },
    },
    notaFinal: { type: 'string', description: 'Observacao curta no fim do relatorio (vazio = nenhuma)' },
    cores: {
      type: 'object',
      description: 'So quando o usuario pedir mudanca de cor: sobrescreve cores do tema, em #RRGGBB. Omita o que nao mudar.',
      properties: {
        bg: { type: 'string' }, panel: { type: 'string' }, texto: { type: 'string' }, muted: { type: 'string' }, accent: { type: 'string' }, accent2: { type: 'string' },
      },
    },
  },
};

const PROPS_ANALISE = {
  analiseMetricas: { type: 'string', description: 'Analise dos resultados, em portugues. Padrao 3 a 5 frases; siga o tamanho/tom que o usuario pedir' },
  conclusaoEstrategica: { type: 'string', description: 'Conclusao estrategica do periodo. Padrao 3 a 5 frases; siga o tamanho/tom pedido' },
  sugestoes: { type: 'array', items: { type: 'string' }, description: 'Sugestoes curtas e acionaveis. Padrao 3; use a quantidade que o usuario pedir (0 a 8)' },
  layout: SCHEMA_LAYOUT,
  avisos: { type: 'array', items: { type: 'string' }, description: 'SOMENTE pedidos que voce NAO conseguiu atender, com o motivo (ex: dado que nao existe na fonte). Nunca confirme o que foi feito. Lista vazia se atendeu tudo.' },
};

const REGRAS_PEDIDO = `Como tratar o pedido do usuario:
- Aplique TODOS os pedidos, sejam de texto (tom, tamanho, foco, linguagem) ou de estrutura (titulo, quais metricas aparecem e em que ordem, nomes de secoes, quantidade de sugestoes, secoes novas, notas, cores, nome do cliente, texto do periodo). Estrutura vai em "layout".
- Pedido de metrica que nao existe na lista disponivel, ou de numero que nao esta na fonte: nao invente - registre em "avisos" o que nao deu pra fazer e por que.
- NUNCA invente ou altere numeros. Use exatamente os dados fornecidos.
- Sem pedido de estrutura, mantenha o layout atual (ou o padrao).
- Num ajuste, o NOVO pedido sempre vale mais que os anteriores: se ele contradiz algo pedido antes (ex: antes 5 sugestoes, agora 3), siga o novo.
- "avisos" e so pro que NAO deu pra fazer - nunca liste o que foi feito.
- Metricas disponiveis: ${CHAVES_METRICAS.join(', ')}.`;

const HEX_COR = /^#[0-9a-fA-F]{6}$/;
const texto = (v, max) => String(v ?? '').trim().slice(0, max);

// junta o que a IA devolveu com o padrao e descarta qualquer valor fora do formato
function normalizarLayout(bruto, base = LAYOUT_PADRAO) {
  const l = bruto && typeof bruto === 'object' ? bruto : {};
  const lista = (v, padrao, max) => (Array.isArray(v) ? [...new Set(v.filter((k) => CHAVES_METRICAS.includes(k)))].slice(0, max) : padrao);
  const nomes = { ...base.nomes };
  for (const k of Object.keys(LAYOUT_PADRAO.nomes)) if (typeof l.nomes?.[k] === 'string') nomes[k] = texto(l.nomes[k], 80);
  const cores = { ...(base.cores || {}) };
  for (const k of ['bg', 'panel', 'texto', 'muted', 'accent', 'accent2']) if (HEX_COR.test(l.cores?.[k] || '')) cores[k] = l.cores[k];
  return {
    titulo: typeof l.titulo === 'string' && l.titulo.trim() ? texto(l.titulo, 80) : base.titulo,
    subtitulo: typeof l.subtitulo === 'string' ? texto(l.subtitulo, 80) : base.subtitulo,
    clienteNome: typeof l.clienteNome === 'string' ? texto(l.clienteNome, 100) : base.clienteNome,
    periodoTexto: typeof l.periodoTexto === 'string' ? texto(l.periodoTexto, 80) : base.periodoTexto,
    kpis: lista(l.kpis, base.kpis, 6),
    metricasEficiencia: lista(l.metricasEficiencia, base.metricasEficiencia, 8),
    destaque: l.destaque === '' || CHAVES_METRICAS.includes(l.destaque) ? l.destaque : base.destaque,
    mostrarPainelDireito: typeof l.mostrarPainelDireito === 'boolean' ? l.mostrarPainelDireito : base.mostrarPainelDireito,
    mostrarSugestoes: typeof l.mostrarSugestoes === 'boolean' ? l.mostrarSugestoes : base.mostrarSugestoes,
    nomes,
    rotulos: Array.isArray(l.rotulos)
      ? l.rotulos.filter((r) => CHAVES_METRICAS.includes(r?.metrica) && String(r?.rotulo || '').trim()).map((r) => ({ metrica: r.metrica, rotulo: texto(r.rotulo, 60) })).slice(0, 9)
      : base.rotulos,
    secoesExtras: Array.isArray(l.secoesExtras)
      ? l.secoesExtras.filter((s) => String(s?.titulo || '').trim() && String(s?.texto || '').trim()).map((s) => ({ titulo: texto(s.titulo, 100), texto: texto(s.texto, 3000) })).slice(0, 6)
      : base.secoesExtras,
    notaFinal: typeof l.notaFinal === 'string' ? texto(l.notaFinal, 500) : base.notaFinal,
    cores,
  };
}

function normalizarAnalise(bruto, base = {}) {
  return {
    analiseMetricas: texto(bruto?.analiseMetricas || base.analiseMetricas, 4000),
    conclusaoEstrategica: texto(bruto?.conclusaoEstrategica || base.conclusaoEstrategica, 4000),
    sugestoes: Array.isArray(bruto?.sugestoes) ? bruto.sugestoes.map((s) => texto(s, 300)).filter(Boolean).slice(0, 8) : (base.sugestoes || []),
  };
}

// ---------- dados: fonte manual (extraidos por IA de arquivos anexados) ----------

const TOOL_DADOS_E_ANALISE = {
  name: 'entregar_dados_e_analise',
  description: 'Entrega os dados numericos extraidos dos arquivos anexados, a analise e o layout do relatorio.',
  input_schema: {
    type: 'object',
    properties: {
      clienteNome: { type: 'string', description: 'Nome do cliente/empresa, se identificavel nos arquivos (senao, "Cliente")' },
      periodo: { type: 'string', description: 'Periodo do relatorio como texto (ex: "01/01/2026 a 31/01/2026"), se identificavel' },
      investimento: { type: 'number', description: 'Valor total investido em reais' },
      resultados: { type: 'number', description: 'Numero de resultados (leads, vendas, conversoes etc)' },
      tipoResultado: { type: 'string', description: 'O que "resultados" representa (ex: "Leads", "Vendas")' },
      custoPorResultado: { type: 'number', description: 'Custo medio por resultado em reais' },
      alcance: { type: 'number', description: 'Alcance unico' },
      impressoes: { type: 'number', description: 'Total de impressoes' },
      cliques: { type: 'number', description: 'Total de cliques' },
      frequencia: { type: 'number', description: 'Frequencia media' },
      cpm: { type: 'number', description: 'CPM medio em reais' },
      ctr: { type: 'number', description: 'CTR em porcentagem (ex: 2.35 pra 2.35%)' },
      retencaoVideo: {
        type: 'array',
        description: 'Se os arquivos tiverem dado de retencao/visualizacao de video, uma linha por marco reportado, NA ORDEM EM QUE APARECEM (ex: se a imagem mostra "Visualizacoes 75%: 3405" e "Completaram 100%: 2585", copie os rotulos exatamente como aparecem). Omita se nao houver dado de video.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Rotulo exatamente como aparece na fonte (ex: "Visualizacoes 75%", "Completaram o video")' },
            valor: { type: 'number' },
          },
          required: ['label', 'valor'],
        },
      },
      ...PROPS_ANALISE,
    },
    required: ['analiseMetricas', 'conclusaoEstrategica', 'sugestoes', 'layout'],
  },
};

const TOOL_ANALISE = {
  name: 'entregar_analise',
  description: 'Entrega a analise do relatorio (escrita em cima dos numeros reais ja fornecidos) e o layout.',
  input_schema: {
    type: 'object',
    properties: PROPS_ANALISE,
    required: ['analiseMetricas', 'conclusaoEstrategica', 'sugestoes', 'layout'],
  },
};

const EXCEL_TYPES = new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']);
const WORD_TYPES = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function montarBlocosArquivos(arquivos) {
  const blocos = [];
  for (const arq of arquivos || []) {
    const buffer = Buffer.from(arq.base64, 'base64');
    if (IMAGE_TYPES.has(arq.mediaType)) {
      blocos.push({ type: 'image', source: { type: 'base64', media_type: arq.mediaType, data: arq.base64 } });
    } else if (arq.mediaType === 'application/pdf') {
      blocos.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: arq.base64 } });
    } else if (EXCEL_TYPES.has(arq.mediaType)) {
      const conteudo = await extrairTextoExcel(buffer);
      blocos.push({ type: 'text', text: `Conteudo da planilha "${arq.name}":\n${conteudo}` });
    } else if (WORD_TYPES.has(arq.mediaType)) {
      const conteudo = await extrairTextoWord(buffer);
      blocos.push({ type: 'text', text: `Conteudo do documento "${arq.name}":\n${conteudo}` });
    } else if (arq.mediaType === 'text/csv' || arq.mediaType === 'text/plain') {
      blocos.push({ type: 'text', text: `Conteudo do arquivo "${arq.name}":\n${buffer.toString('utf8')}` });
    }
  }
  return blocos;
}

function blocoPedido(instrucoes) {
  return instrucoes
    ? `\n\nPEDIDO DO USUARIO (aplique tudo):\n"""${instrucoes}"""`
    : '\n\nO usuario nao fez pedido especifico: use o layout padrao e 3 sugestoes.';
}

async function extrairDadosEAnaliseDeArquivos({ tenantId, arquivos, instrucoes }) {
  const blocosArquivos = await montarBlocosArquivos(arquivos);
  if (!blocosArquivos.length) throw new Error('nenhum arquivo valido anexado');

  const prompt = `Voce e um analista de marketing/performance. Extraia os dados numericos de performance de anuncios ` +
    `(investimento, resultados, alcance, impressoes, cliques, frequencia, CPM, CTR etc) dos arquivos anexados e escreva ` +
    `uma analise objetiva e profissional em portugues do Brasil, montando tambem o layout do relatorio.` +
    `\nSe algum numero nao aparecer nos arquivos, simplesmente omita o campo (nao invente valor).` +
    `\n\n${REGRAS_PEDIDO}\n\nLayout padrao (ponto de partida):\n${JSON.stringify(LAYOUT_PADRAO)}${blocoPedido(instrucoes)}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    tools: [TOOL_DADOS_E_ANALISE],
    tool_choice: { type: 'tool', name: 'entregar_dados_e_analise' },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...blocosArquivos] }],
    _uso: { tenantId, modulo: 'gerador-relatorios' },
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu extrair os dados dos arquivos');
  const { analiseMetricas, conclusaoEstrategica, sugestoes, layout, avisos, retencaoVideo, ...dados } = toolUse.input;
  dados.videoRows = Array.isArray(retencaoVideo) && retencaoVideo.length
    ? retencaoVideo.map((r) => ({ label: r.label, value: r.valor }))
    : null;
  return {
    dados,
    analise: normalizarAnalise({ analiseMetricas, conclusaoEstrategica, sugestoes }),
    layout: normalizarLayout(layout),
    avisos: Array.isArray(avisos) ? avisos.map((a) => texto(a, 300)).filter(Boolean) : [],
  };
}

function resumoNumeros(dados) {
  const linhas = [`Cliente: ${dados.clienteNome || '-'}`, `Periodo: ${dados.periodo || '-'}`];
  for (const k of CHAVES_METRICAS) {
    if (dados[k] == null) continue;
    linhas.push(`${k} (${METRICAS[k].rotulo(dados)}): ${METRICAS[k].valor(dados)}`);
  }
  if (Array.isArray(dados.videoRows) && dados.videoRows.length) {
    linhas.push(`Retencao de video: ${dados.videoRows.map((r) => `${r.label}: ${r.value}`).join('; ')}`);
  }
  return linhas.join('\n');
}

// analise + layout em cima dos numeros reais. Com "atual", e um AJUSTE: a IA recebe o relatorio
// como esta e devolve ele inteiro revisado, mudando so o que o usuario pediu
async function gerarAnaliseComIA({ tenantId, dados, instrucoes, atual }) {
  const partes = [
    'Voce e um analista de marketing/performance. Com base nesses numeros REAIS de uma campanha de anuncios, escreva ' +
      'uma analise objetiva e profissional em portugues do Brasil e monte o layout do relatorio.',
    '',
    REGRAS_PEDIDO,
    '',
    `Numeros do periodo:\n${resumoNumeros(dados)}`,
  ];
  if (atual) {
    partes.push(
      '',
      'RELATORIO ATUAL (devolva ele COMPLETO revisado, mantendo tudo que o usuario nao pediu pra mudar):',
      JSON.stringify({ analise: atual.analise, layout: atual.layout }),
      atual.historico?.length ? `\nPedidos anteriores (ja estao aplicados no relatorio atual; se o novo pedido contradizer algum deles, vale o NOVO):${atual.historico.map((p) => `"${p}"`).join('; ')}` : '',
      `\nNOVO PEDIDO DE AJUSTE (aplique tudo):\n"""${instrucoes}"""`,
    );
  } else {
    partes.push('', `Layout padrao (ponto de partida):\n${JSON.stringify(LAYOUT_PADRAO)}`, blocoPedido(instrucoes));
  }

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    tools: [TOOL_ANALISE],
    tool_choice: { type: 'tool', name: 'entregar_analise' },
    messages: [{ role: 'user', content: partes.join('\n') }],
    _uso: { tenantId, modulo: 'gerador-relatorios' },
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu gerar a analise');
  const r = toolUse.input;
  return {
    analise: normalizarAnalise(r, atual?.analise),
    layout: normalizarLayout(r.layout, atual?.layout || LAYOUT_PADRAO),
    avisos: Array.isArray(r.avisos) ? r.avisos.map((a) => texto(a, 300)).filter(Boolean) : [],
  };
}

// ---------- HTML ----------

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtReais(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(v, casas = 0) {
  if (v == null) return '-';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function fmtPct(v) {
  if (v == null) return '-';
  return `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

// icones proprios (nao usa lib externa tipo lucide, senao o HTML baixado dependeria de CDN e
// quebraria offline) - SVGs simples, so o stroke muda de cor via currentColor
const ICONES = {
  sparkles: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 5 12 1.8-5.2L21 14 9 9Z"/><path d="M7.2 7.2 5.8 5.8M5 12H3m9-9v2M6.5 6.5 5 5"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  trending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
};

// logo padrao (petalas giratorias, igual ao mark original da Lumia) - so entra quando o tenant
// nao subiu um logo proprio (ver marca.logo)
const LOGO_PADRAO_SVG = `<svg viewBox="0 0 100 100" width="40" height="40">
  <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent2)"/>
  </linearGradient></defs>
  ${[0, 60, 120, 180, 240, 300].map((r) => `<path d="M50 50 L50 20 Q70 20 80 40 L50 50" fill="url(#lg)" opacity="0.95" transform="rotate(${r} 50 50)"/>`).join('')}
  <circle cx="50" cy="50" r="12" fill="var(--panel)"/>
</svg>`;

// painel da direita: retencao de video quando o anuncio tem video, senao um fallback generico
// de engajamento (cliques -> resultado, com taxa de conversao estimada) - assim o relatorio
// nunca fica com um painel vazio so porque a campanha nao usou video
function montarPainelDireito(dados) {
  if (Array.isArray(dados.videoRows) && dados.videoRows.length) {
    return { titulo: 'Retenção de Vídeo', rows: dados.videoRows };
  }
  const tipo = dados.tipoResultado || 'Resultados';
  const taxa = dados.cliques ? (Number(dados.resultados || 0) / dados.cliques) * 100 : null;
  const rows = [
    { label: 'Cliques no Link', value: dados.cliques },
    { label: tipo, value: dados.resultados },
  ];
  if (taxa != null) rows.push({ label: `Taxa de Conversão Link/${tipo}`, value: taxa, isPct: true });
  return { titulo: 'Engajamento Estimado', rows };
}

const paragrafos = (t) => esc(t).split(/\n{2,}|\n/).filter((p) => p.trim()).map((p) => `<p>${p}</p>`).join('');

function montarHtmlRelatorio({ tema: temaBase, dados, analise, layout: layoutBruto, clienteNomeOverride, marca }) {
  const layout = normalizarLayout(layoutBruto);
  const tema = { ...temaBase, ...layout.cores };
  const rotulo = (k) => esc(layout.rotulos.find((r) => r.metrica === k)?.rotulo || METRICAS[k].rotulo(dados));
  const clienteNome = esc(layout.clienteNome || clienteNomeOverride || dados.clienteNome || 'Cliente');
  const periodo = esc(layout.periodoTexto || dados.periodo || '-');
  const sugestoes = layout.mostrarSugestoes ? (analise.sugestoes || []) : [];
  const brandNome = esc(marca?.nome || 'Lumia');
  const logoHtml = marca?.logo
    ? `<img src="${esc(marca.logo)}" alt="${brandNome}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;" />`
    : LOGO_PADRAO_SVG;

  // titulo com a ultima palavra em destaque de cor
  const palavrasTitulo = layout.titulo.split(/\s+/);
  const tituloHtml = palavrasTitulo.length > 1
    ? `${esc(palavrasTitulo.slice(0, -1).join(' '))} <span>${esc(palavrasTitulo[palavrasTitulo.length - 1])}</span>`
    : `<span>${esc(layout.titulo)}</span>`;

  const kpisHtml = layout.kpis.map((k) => `
    <div class="kpi"><div class="label">${rotulo(k)}</div><div class="value">${METRICAS[k].valor(dados)}</div></div>`).join('');

  const temEficiencia = layout.metricasEficiencia.length || layout.destaque;
  const eficienciaHtml = temEficiencia ? `
    <section class="panel">
      <h3 class="panel-title"><span class="bar"></span>${esc(layout.nomes.eficiencia)}</h3>
      <div class="metrics">
        ${layout.metricasEficiencia.map((k) => `<div class="metric"><div class="icon-row"><span class="icon-badge">${ICONES[METRICAS[k].icone]}</span><span>${rotulo(k)}</span></div><b>${METRICAS[k].valor(dados)}</b></div>`).join('')}
        ${layout.destaque ? `<div class="ctr-box"><div class="icon-row">${ICONES[METRICAS[layout.destaque].icone]}<span>${rotulo(layout.destaque)}</span></div><b>${METRICAS[layout.destaque].valor(dados)}</b></div>` : ''}
      </div>
    </section>` : '';

  let painelDireitoHtml = '';
  if (layout.mostrarPainelDireito) {
    const painelDir = montarPainelDireito(dados);
    const maiorValor = Math.max(1, ...painelDir.rows.map((r) => Number(r.value) || 0));
    const rows = painelDir.rows.map((r) => {
      const largura = Math.max(6, Math.min(100, ((Number(r.value) || 0) / maiorValor) * 100));
      const valorFmt = r.isPct ? fmtPct(r.value) : fmtNum(r.value);
      return `
          <div class="row-item">
            <div class="row-top"><span>${esc(r.label)}</span><b>${valorFmt}</b></div>
            <div class="row-track"><div class="row-fill" style="width:${largura}%"></div></div>
          </div>`;
    }).join('');
    painelDireitoHtml = `
    <section class="panel">
      <h3 class="panel-title"><span class="bar"></span>${esc(layout.nomes.painelDireito || painelDir.titulo)}</h3>
      ${rows}
    </section>`;
  }
  const paineis = [eficienciaHtml, painelDireitoHtml].filter(Boolean);

  const extrasHtml = layout.secoesExtras.map((s) => `
  <section class="panel extra">
    <h3 class="panel-title"><span class="bar"></span>${esc(s.titulo)}</h3>
    <div class="extra-texto">${paragrafos(s.texto)}</div>
  </section>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatorio - ${clienteNome}</title>
<style>
  :root {
    --bg: ${tema.bg}; --panel: ${tema.panel}; --text: ${tema.texto}; --muted: ${tema.muted};
    --accent: ${tema.accent}; --accent2: ${tema.accent2};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 1000px; margin: 0 auto; }
  header {
    display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px;
    border-bottom: 1px solid ${tema.accent}33; padding-bottom: 24px; margin-bottom: 32px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-name { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
  .brand-name span { color: var(--accent); }
  .sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.35em; color: var(--muted); margin-top: 4px; }
  .titulo { text-align: right; }
  .excelencia { display: flex; align-items: center; justify-content: flex-end; gap: 6px; color: var(--accent);
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25em; margin-bottom: 6px; }
  .excelencia svg { width: 13px; height: 13px; }
  .titulo h1 { font-size: 22px; margin: 4px 0 10px; font-weight: 900; }
  .titulo h1 span { background: linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    background: ${tema.accent}1a; color: var(--accent); border: 1px solid ${tema.accent}44; border-radius: 999px;
    padding: 4px 12px; margin-left: 6px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .kpi { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 16px; padding: 20px; text-align: center; }
  .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 10px; }
  .kpi .value { font-size: 26px; font-weight: 900; }
  .grid2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; margin-bottom: 24px; }
  .grid2.um { grid-template-columns: 1fr; }
  @media (max-width: 760px) { .grid2 { grid-template-columns: 1fr; } }
  .panel { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 20px; padding: 24px; }
  .panel-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 20px; display: flex; align-items: center; gap: 10px; }
  .bar { width: 24px; height: 4px; border-radius: 4px; background: var(--accent); display: inline-block; }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .metric { display: flex; flex-direction: column; gap: 8px; }
  .metric .icon-row { display: flex; align-items: center; gap: 8px; }
  .icon-badge { width: 26px; height: 26px; border-radius: 8px; background: ${tema.accent}18; color: var(--accent);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .icon-badge svg { width: 14px; height: 14px; }
  .metric span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
  .metric b { font-size: 18px; padding-left: 34px; }
  .ctr-box { grid-column: 1 / -1; background: ${tema.accent}12; border: 1px solid ${tema.accent}33; border-radius: 14px; padding: 14px 16px; }
  .ctr-box .icon-row { display: flex; align-items: center; gap: 8px; color: var(--accent); }
  .ctr-box .icon-row svg { width: 14px; height: 14px; }
  .ctr-box span { font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em; }
  .ctr-box b { display: block; font-size: 26px; color: var(--accent); margin-top: 4px; }
  .row-item { margin-bottom: 18px; }
  .row-item:last-child { margin-bottom: 0; }
  .row-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; font-size: 12px; color: var(--muted); }
  .row-top b { color: var(--text); font-size: 16px; font-weight: 800; }
  .row-track { height: 4px; border-radius: 4px; background: ${tema.accent}1f; overflow: hidden; }
  .row-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
  .analise { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 24px; padding: 32px; margin-bottom: 24px; }
  .analise h2 { text-align: center; font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px; }
  .analise .bar-centro { width: 60px; height: 4px; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent2)); margin: 0 auto 24px; }
  .analise-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .analise-grid.um { grid-template-columns: 1fr; }
  @media (max-width: 760px) { .analise-grid { grid-template-columns: 1fr; } }
  .analise-item { display: flex; gap: 14px; margin-bottom: 20px; }
  .num { width: 36px; height: 36px; border-radius: 10px; background: var(--text); color: var(--panel); font-weight: 900;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .analise-item h4 { margin: 0 0 6px; font-size: 14px; text-transform: uppercase; }
  .analise-item p { margin: 0 0 8px; color: var(--muted); font-size: 13px; line-height: 1.6; }
  .sugestoes { background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 20px; padding: 24px; color: var(--bg); }
  .sugestoes h4 { margin: 0 0 16px; font-size: 15px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
  .sugestoes h4 svg { width: 16px; height: 16px; }
  .sugestoes ul { margin: 0; padding: 0; list-style: none; }
  .sugestoes li { display: flex; gap: 8px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.15); font-size: 13px; font-weight: 600; }
  .sugestoes li svg { width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }
  .sugestoes li:last-child { border-bottom: none; }
  .extra { margin-bottom: 24px; }
  .extra-texto p { margin: 0 0 10px; color: var(--muted); font-size: 13px; line-height: 1.7; }
  .nota { font-size: 12px; color: var(--muted); text-align: center; line-height: 1.6; padding: 4px 16px 8px; }
  footer { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--muted); opacity: 0.6; padding-top: 24px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="brand-name">${brandNome}<span>.</span></div>
        ${layout.subtitulo ? `<div class="sub">${esc(layout.subtitulo)}</div>` : ''}
      </div>
    </div>
    <div class="titulo">
      ${layout.subtitulo ? `<div class="excelencia">${ICONES.sparkles}${esc(layout.subtitulo)}</div>` : ''}
      <h1>${tituloHtml}</h1>
      <span class="pill">Cliente: ${clienteNome}</span>
      <span class="pill">Período: ${periodo}</span>
    </div>
  </header>

  ${layout.kpis.length ? `<section class="kpis">${kpisHtml}</section>` : ''}

  ${paineis.length ? `<div class="grid2${paineis.length === 1 ? ' um' : ''}">${paineis.join('')}</div>` : ''}

  <section class="analise">
    <h2>${esc(layout.nomes.analise)}</h2>
    <div class="bar-centro"></div>
    <div class="analise-grid${sugestoes.length ? '' : ' um'}">
      <div>
        <div class="analise-item"><div class="num">01</div><div><h4>${esc(layout.nomes.analiseMetricas)}</h4>${paragrafos(analise.analiseMetricas)}</div></div>
        <div class="analise-item"><div class="num">02</div><div><h4>${esc(layout.nomes.conclusao)}</h4>${paragrafos(analise.conclusaoEstrategica)}</div></div>
      </div>
      ${sugestoes.length ? `<div class="sugestoes">
        <h4>${ICONES.trending}${esc(layout.nomes.sugestoes)}</h4>
        <ul>${sugestoes.map((s) => `<li>${ICONES.check}<span>${esc(s)}</span></li>`).join('')}</ul>
      </div>` : ''}
    </div>
  </section>
  ${extrasHtml}
  ${layout.notaFinal ? `<div class="nota">${esc(layout.notaFinal)}</div>` : ''}

  <footer>Impulsionando resultados · ${brandNome}</footer>
</div>
</body>
</html>`;
}

// ---------- orquestracao ----------

export async function gerarRelatorio(tenantId, { fonte, temaId, accountId, from, to, arquivos, instrucoes, clienteNome, titulo }) {
  const tema = await obterTema(tenantId, temaId);
  const marca = await obterMarcaRelatorio(tenantId);
  const pedido = texto(instrucoes, 4000);

  let dados;
  let gerado;
  if (fonte === 'manual') {
    const extraido = await extrairDadosEAnaliseDeArquivos({ tenantId, arquivos, instrucoes: pedido });
    dados = extraido.dados;
    gerado = extraido;
  } else {
    dados = await buscarDadosAutomatico(tenantId, { accountId, from, to });
    gerado = await gerarAnaliseComIA({ tenantId, dados, instrucoes: pedido });
  }

  const html = montarHtmlRelatorio({ tema, dados, analise: gerado.analise, layout: gerado.layout, clienteNomeOverride: clienteNome, marca });

  const id = novoId();
  const tituloFinal = titulo || `Relatorio - ${clienteNome || dados.clienteNome || 'Cliente'} - ${new Date().toLocaleDateString('pt-BR')}`;
  if (pool) {
    await pool.query(
      `INSERT INTO relatorios_gerados (id, tenant_id, titulo, tema_id, fonte, html, dados, config, instrucoes, cliente_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, tenantId, tituloFinal.slice(0, 200), tema.id, fonte, html, JSON.stringify(dados),
        JSON.stringify({ analise: gerado.analise, layout: gerado.layout, avisos: gerado.avisos }), pedido || null, clienteNome || null],
    );
  }
  return { id, titulo: tituloFinal, html, instrucoes: pedido || null, avisos: gerado.avisos, ajustes: [] };
}

// ajuste num relatorio ja gerado: reaproveita os MESMOS numeros (sem buscar no Meta de novo nem
// reler arquivo), a IA revisa analise + layout aplicando o pedido, e o relatorio e atualizado
export async function ajustarRelatorio(tenantId, id, pedidoBruto) {
  if (!pool) throw new Error('banco de dados indisponivel');
  const pedido = texto(pedidoBruto, 4000);
  if (!pedido) throw new Error('descreva o ajuste que voce quer');
  const rel = await buscarRelatorio(tenantId, id);
  if (!rel) throw new Error('relatorio nao encontrado');
  if (!rel.dados || !rel.config) {
    throw new Error('esse relatorio foi gerado antes dos ajustes existirem - gere de novo pra poder pedir ajustes nele');
  }
  const ajustes = Array.isArray(rel.ajustes) ? rel.ajustes : [];
  const historico = [rel.instrucoes, ...ajustes.map((a) => a.pedido)].filter(Boolean);
  const revisado = await gerarAnaliseComIA({
    tenantId, dados: rel.dados, instrucoes: pedido,
    atual: { analise: rel.config.analise, layout: normalizarLayout(rel.config.layout), historico },
  });
  const tema = await obterTema(tenantId, rel.tema_id);
  const marca = await obterMarcaRelatorio(tenantId);
  const html = montarHtmlRelatorio({ tema, dados: rel.dados, analise: revisado.analise, layout: revisado.layout, clienteNomeOverride: rel.cliente_nome, marca });
  const novosAjustes = [...ajustes, { pedido, em: new Date().toISOString(), avisos: revisado.avisos }].slice(-30);
  await pool.query(
    'UPDATE relatorios_gerados SET html = $3, config = $4, ajustes = $5 WHERE id = $1 AND tenant_id = $2',
    [id, tenantId, html, JSON.stringify({ analise: revisado.analise, layout: revisado.layout, avisos: revisado.avisos }), JSON.stringify(novosAjustes)],
  );
  return { id, titulo: rel.titulo, html, instrucoes: rel.instrucoes, avisos: revisado.avisos, ajustes: novosAjustes };
}

export async function listarRelatorios(tenantId) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, titulo, tema_id, fonte, criado_em, instrucoes, jsonb_array_length(coalesce(ajustes, '[]'::jsonb)) AS qtd_ajustes
     FROM relatorios_gerados WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 100`,
    [tenantId],
  );
  return rows;
}

export async function buscarRelatorio(tenantId, id) {
  if (!pool) return null;
  const { rows } = await pool.query(`SELECT * FROM relatorios_gerados WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  const r = rows[0];
  if (!r) return null;
  return { ...r, avisos: r.config?.avisos || [], ajustes: r.ajustes || [] };
}

export async function apagarRelatorio(tenantId, id) {
  if (!pool) return false;
  const { rowCount } = await pool.query(`DELETE FROM relatorios_gerados WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  return rowCount > 0;
}
