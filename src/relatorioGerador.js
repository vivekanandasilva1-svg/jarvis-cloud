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
import Anthropic from '@anthropic-ai/sdk';
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as metaAds from './metaads.js';
import { extrairTextoWord, extrairTextoExcel } from './leitorDocumentos.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
    temVideo: videoPlay > 0,
    videoInicio: videoPlay,
    video50,
    video95,
  };
}

function formatarDataBR(isoDate) {
  const [ano, mes, dia] = String(isoDate).split('-');
  return `${dia}/${mes}/${ano}`;
}

// ---------- dados: fonte manual (extraidos por IA de arquivos anexados) ----------

const TOOL_DADOS_E_ANALISE = {
  name: 'entregar_dados_e_analise',
  description: 'Entrega os dados numericos extraidos dos arquivos anexados junto com a analise qualitativa do relatorio.',
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
      analiseMetricas: { type: 'string', description: 'Paragrafo (3 a 5 frases) em portugues, analisando os resultados apresentados' },
      conclusaoEstrategica: { type: 'string', description: 'Paragrafo (3 a 5 frases) em portugues com a conclusao estrategica do periodo' },
      sugestoes: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Exatamente 3 sugestoes curtas e acionaveis de proximos passos' },
    },
    required: ['analiseMetricas', 'conclusaoEstrategica', 'sugestoes'],
  },
};

const TOOL_ANALISE = {
  name: 'entregar_analise',
  description: 'Entrega a analise qualitativa do relatorio, escrita em cima dos numeros reais ja fornecidos.',
  input_schema: {
    type: 'object',
    properties: {
      analiseMetricas: { type: 'string', description: 'Paragrafo (3 a 5 frases) em portugues, analisando os resultados apresentados' },
      conclusaoEstrategica: { type: 'string', description: 'Paragrafo (3 a 5 frases) em portugues com a conclusao estrategica do periodo' },
      sugestoes: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Exatamente 3 sugestoes curtas e acionaveis de proximos passos' },
    },
    required: ['analiseMetricas', 'conclusaoEstrategica', 'sugestoes'],
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
      const texto = await extrairTextoExcel(buffer);
      blocos.push({ type: 'text', text: `Conteudo da planilha "${arq.name}":\n${texto}` });
    } else if (WORD_TYPES.has(arq.mediaType)) {
      const texto = await extrairTextoWord(buffer);
      blocos.push({ type: 'text', text: `Conteudo do documento "${arq.name}":\n${texto}` });
    } else if (arq.mediaType === 'text/csv' || arq.mediaType === 'text/plain') {
      blocos.push({ type: 'text', text: `Conteudo do arquivo "${arq.name}":\n${buffer.toString('utf8')}` });
    }
  }
  return blocos;
}

async function extrairDadosEAnaliseDeArquivos({ arquivos, instrucoes }) {
  const blocosArquivos = await montarBlocosArquivos(arquivos);
  if (!blocosArquivos.length) throw new Error('nenhum arquivo valido anexado');

  const texto = `Voce e um analista de marketing/performance. Extraia os dados numericos de performance de anuncios ` +
    `(investimento, resultados, alcance, impressoes, cliques, frequencia, CPM, CTR etc) dos arquivos anexados e escreva ` +
    `uma analise qualitativa objetiva e profissional em portugues do Brasil.` +
    (instrucoes ? `\n\nInstrucoes adicionais do usuario: ${instrucoes}` : '') +
    `\n\nSe algum numero nao aparecer nos arquivos, simplesmente omita o campo (nao invente valor).`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools: [TOOL_DADOS_E_ANALISE],
    tool_choice: { type: 'tool', name: 'entregar_dados_e_analise' },
    messages: [{ role: 'user', content: [{ type: 'text', text: texto }, ...blocosArquivos] }],
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu extrair os dados dos arquivos');
  return toolUse.input;
}

async function gerarAnaliseComIA({ dados, instrucoes }) {
  const resumo = [
    `Investimento: R$ ${dados.investimento?.toFixed(2)}`,
    dados.resultados != null ? `${dados.tipoResultado || 'Resultados'}: ${dados.resultados}` : null,
    dados.custoPorResultado != null ? `Custo por resultado: R$ ${dados.custoPorResultado.toFixed(2)}` : null,
    `Alcance: ${dados.alcance}`, `Impressoes: ${dados.impressoes}`, `Cliques: ${dados.cliques}`,
    `Frequencia: ${dados.frequencia?.toFixed(2)}`, `CPM: R$ ${dados.cpm?.toFixed(2)}`, `CTR: ${dados.ctr?.toFixed(2)}%`,
  ].filter(Boolean).join('\n');

  const texto = `Voce e um analista de marketing/performance. Com base nesses numeros REAIS de uma campanha de anuncios ` +
    `no periodo de ${dados.periodo}, escreva uma analise qualitativa objetiva e profissional em portugues do Brasil. ` +
    `NUNCA invente ou altere os numeros - use exatamente os que foram dados.` +
    (instrucoes ? `\n\nInstrucoes adicionais do usuario: ${instrucoes}` : '') +
    `\n\nNumeros do periodo:\n${resumo}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    tools: [TOOL_ANALISE],
    tool_choice: { type: 'tool', name: 'entregar_analise' },
    messages: [{ role: 'user', content: texto }],
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu gerar a analise');
  return toolUse.input;
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

function montarHtmlRelatorio({ tema, dados, analise, clienteNomeOverride }) {
  const clienteNome = esc(clienteNomeOverride || dados.clienteNome || 'Cliente');
  const periodo = esc(dados.periodo || '-');
  const sugestoes = (analise.sugestoes || []).slice(0, 3);
  const videoBlock = dados.temVideo ? `
        <section class="panel">
          <h3 class="panel-title"><span class="bar"></span>Retencao de Video</h3>
          <div class="video-rows">
            <div class="video-row"><span>Iniciaram o video</span><b>${fmtNum(dados.videoInicio)}</b></div>
            <div class="video-row"><span>Assistiram 50%</span><b>${fmtNum(dados.video50)}</b></div>
            <div class="video-row"><span>Assistiram ate o fim (95%+)</span><b>${fmtNum(dados.video95)}</b></div>
          </div>
        </section>` : '';

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
  .logo { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; }
  .logo span { color: var(--accent); }
  .sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--muted); margin-top: 2px; }
  .titulo { text-align: right; }
  .titulo h1 { font-size: 22px; margin: 4px 0; font-weight: 900; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    background: ${tema.accent}1a; color: var(--accent); border: 1px solid ${tema.accent}44; border-radius: 999px;
    padding: 4px 12px; margin-left: 6px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .kpi { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 16px; padding: 20px; text-align: center; }
  .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 10px; }
  .kpi .value { font-size: 26px; font-weight: 900; }
  .grid2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; margin-bottom: 24px; }
  @media (max-width: 760px) { .grid2 { grid-template-columns: 1fr; } }
  .panel { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 20px; padding: 24px; }
  .panel-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 20px; display: flex; align-items: center; gap: 10px; }
  .bar { width: 24px; height: 4px; border-radius: 4px; background: var(--accent); display: inline-block; }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .metric span { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .metric b { font-size: 18px; }
  .ctr-box { grid-column: 1 / -1; background: ${tema.accent}12; border: 1px solid ${tema.accent}33; border-radius: 14px; padding: 14px 16px; }
  .ctr-box span { font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em; }
  .ctr-box b { display: block; font-size: 26px; color: var(--accent); margin-top: 4px; }
  .video-rows { display: flex; flex-direction: column; gap: 14px; }
  .video-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
  .video-row b { color: var(--text); font-size: 15px; }
  .analise { background: var(--panel); border: 1px solid ${tema.accent}22; border-radius: 24px; padding: 32px; margin-bottom: 24px; }
  .analise h2 { text-align: center; font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px; }
  .analise-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  @media (max-width: 760px) { .analise-grid { grid-template-columns: 1fr; } }
  .analise-item { display: flex; gap: 14px; margin-bottom: 20px; }
  .num { width: 36px; height: 36px; border-radius: 10px; background: var(--accent); color: var(--bg); font-weight: 900;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .analise-item h4 { margin: 0 0 6px; font-size: 14px; text-transform: uppercase; }
  .analise-item p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
  .sugestoes { background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: 20px; padding: 24px; color: var(--bg); }
  .sugestoes h4 { margin: 0 0 16px; font-size: 15px; text-transform: uppercase; }
  .sugestoes ul { margin: 0; padding: 0; list-style: none; }
  .sugestoes li { padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.15); font-size: 13px; font-weight: 600; }
  .sugestoes li:last-child { border-bottom: none; }
  footer { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--muted); opacity: 0.6; padding-top: 24px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <div class="logo">Lumia<span>.</span></div>
      <div class="sub">Performance de Excelencia</div>
    </div>
    <div class="titulo">
      <h1>Relatorio Estrategico</h1>
      <span class="pill">Cliente: ${clienteNome}</span>
      <span class="pill">Periodo: ${periodo}</span>
    </div>
  </header>

  <section class="kpis">
    <div class="kpi"><div class="label">Investimento Total</div><div class="value">${fmtReais(dados.investimento)}</div></div>
    <div class="kpi"><div class="label">${esc(dados.tipoResultado || 'Resultados')}</div><div class="value">${fmtNum(dados.resultados)}</div></div>
    <div class="kpi"><div class="label">Custo por Resultado</div><div class="value">${fmtReais(dados.custoPorResultado)}</div></div>
    <div class="kpi"><div class="label">Alcance Unico</div><div class="value">${fmtNum(dados.alcance)}</div></div>
  </section>

  <div class="grid2">
    <section class="panel">
      <h3 class="panel-title"><span class="bar"></span>Eficiencia e Trafego</h3>
      <div class="metrics">
        <div class="metric"><span>Impressoes</span><b>${fmtNum(dados.impressoes)}</b></div>
        <div class="metric"><span>Cliques Totais</span><b>${fmtNum(dados.cliques)}</b></div>
        <div class="metric"><span>Frequencia</span><b>${fmtNum(dados.frequencia, 2)}</b></div>
        <div class="metric"><span>CPM Medio</span><b>${fmtReais(dados.cpm)}</b></div>
        <div class="ctr-box"><span>Taxa de Clique (CTR)</span><b>${fmtPct(dados.ctr)}</b></div>
      </div>
    </section>
${videoBlock || '<section></section>'}
  </div>

  <section class="analise">
    <h2>Analise Executiva e Plano de Acao</h2>
    <div class="analise-grid">
      <div>
        <div class="analise-item"><div class="num">01</div><div><h4>Analise das Metricas</h4><p>${esc(analise.analiseMetricas)}</p></div></div>
        <div class="analise-item"><div class="num">02</div><div><h4>Conclusoes Estrategicas</h4><p>${esc(analise.conclusaoEstrategica)}</p></div></div>
      </div>
      <div class="sugestoes">
        <h4>Diretrizes de Crescimento</h4>
        <ul>${sugestoes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>

  <footer>Relatorio gerado pela Lumia</footer>
</div>
</body>
</html>`;
}

// ---------- orquestracao ----------

export async function gerarRelatorio(tenantId, { fonte, temaId, accountId, from, to, arquivos, instrucoes, clienteNome, titulo }) {
  const tema = await obterTema(tenantId, temaId);

  let dados;
  let analise;
  if (fonte === 'manual') {
    const extraido = await extrairDadosEAnaliseDeArquivos({ arquivos, instrucoes });
    dados = extraido;
    analise = { analiseMetricas: extraido.analiseMetricas, conclusaoEstrategica: extraido.conclusaoEstrategica, sugestoes: extraido.sugestoes };
  } else {
    dados = await buscarDadosAutomatico(tenantId, { accountId, from, to });
    analise = await gerarAnaliseComIA({ dados, instrucoes });
  }

  const html = montarHtmlRelatorio({ tema, dados, analise, clienteNomeOverride: clienteNome });

  const id = novoId();
  const tituloFinal = titulo || `Relatorio - ${clienteNome || dados.clienteNome || 'Cliente'} - ${new Date().toLocaleDateString('pt-BR')}`;
  if (pool) {
    await pool.query(
      `INSERT INTO relatorios_gerados (id, tenant_id, titulo, tema_id, fonte, html) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, tituloFinal.slice(0, 200), tema.id, fonte, html],
    );
  }
  return { id, titulo: tituloFinal, html };
}

export async function listarRelatorios(tenantId) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, titulo, tema_id, fonte, criado_em FROM relatorios_gerados WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 100`,
    [tenantId],
  );
  return rows;
}

export async function buscarRelatorio(tenantId, id) {
  if (!pool) return null;
  const { rows } = await pool.query(`SELECT * FROM relatorios_gerados WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  return rows[0] || null;
}

export async function apagarRelatorio(tenantId, id) {
  if (!pool) return false;
  const { rowCount } = await pool.query(`DELETE FROM relatorios_gerados WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  return rowCount > 0;
}
