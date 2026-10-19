// Teste de qualidade/custo do Auto Atendimento: compara a configuracao ATUAL da IA com alternativas
// mais baratas (modelo e/ou esforco de raciocinio), usando mensagens REAIS do tenant (ultimos 14 dias).
//
//   node scripts/eval-atendimento.mjs <tenantId> [nCasos=30] [arquivoSaida=/tmp/eval-atendimento.json] [foco]
//   foco = "agenda" -> so conversas que falam de agendamento/horario (onde as ferramentas pesam)
//   variaveis: JUIZ=<modelo avaliador> (padrao claude-sonnet-5-5; use outro modelo pra tirar vies de familia)
//              CONFIGS=A,A2,B,D (subconjunto das configuracoes; A e sempre incluida)
//
// Como funciona (sem efeito colateral nenhum):
//  - cada caso = uma mensagem de lead que teve resposta real + as mensagens anteriores da conversa
//  - cada configuracao responde so a PRIMEIRA jogada: texto ou chamada de ferramenta. A ferramenta
//    NAO e executada (nada e agendado, cadastrado ou enviado a ninguem)
//  - um avaliador (outro modelo, as cegas, com a ordem sorteada) compara a resposta de cada alternativa
//    com a da configuracao atual. A config "controle" repete a atual pra medir o ruido do proprio teste
//  - custa dinheiro real da conta Anthropic (alguns dolares) - passa pelo cliente central, entao
//    aparece no painel de saldo como modulo "eval"
// Conteudo de conversa fica so no arquivo de saida (nao subir pro git) - o resumo impresso e agregado.
import fs from 'node:fs';
import { pool } from '../src/db.js';
import * as aa from '../src/autoAtendimento.js';
import * as arquivos from '../src/autoAtendimentoArquivos.js';
import { anthropic } from '../src/anthropicClient.js';
import { custoDaChamada } from '../src/saldoIA.js';

const tenantId = Number(process.argv[2]);
const N = Number(process.argv[3]) || 30;
const SAIDA = process.argv[4] || '/tmp/eval-atendimento.json';
const FOCO = process.argv[5] || '';
if (!tenantId) { console.error('uso: node scripts/eval-atendimento.mjs <tenantId> [nCasos] [arquivoSaida]'); process.exit(1); }

const CONFIGS = [
  { id: 'A', rotulo: 'Sonnet 5 / esforco medium (ATUAL)', model: 'claude-sonnet-5', effort: 'medium' },
  { id: 'A2', rotulo: 'CONTROLE (repete a atual)', model: 'claude-sonnet-5', effort: 'medium', controle: true },
  { id: 'B', rotulo: 'Sonnet 5.5 / medium', model: 'claude-sonnet-5-5', effort: 'medium' },
  { id: 'C', rotulo: 'Sonnet 5.5 / low', model: 'claude-sonnet-5-5', effort: 'low' },
  { id: 'D', rotulo: 'Haiku 5.5 / medium', model: 'claude-haiku-5-5', effort: 'medium' },
  { id: 'E', rotulo: 'Haiku 5.5 / low', model: 'claude-haiku-5-5', effort: 'low' },
];
const JUIZ = process.env.JUIZ || 'claude-sonnet-5-5';
if (process.env.CONFIGS) { const quer = new Set(['A', ...process.env.CONFIGS.split(',')]); for (let i = CONFIGS.length - 1; i >= 0; i--) if (!quer.has(CONFIGS[i].id)) CONFIGS.splice(i, 1); }
const REGEX_AGENDA = /agend|marc(ar|a|ado|ou)|hor[aá]rio|consulta|avalia[cç]|dispon|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|\d{1,2}\s?(h|hs|:\d\d)/i;

// ---------- sorteio reprodutivel ----------
function prng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = prng(42);
const embaralhar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- casos reais ----------
const config = await aa.obterConfig(tenantId);
if (!config.prompt) { console.error('tenant sem prompt do Auto Atendimento'); process.exit(1); }
const { rows } = await pool.query(
  `SELECT numero, direcao, texto, criado_em FROM crm_mensagens
   WHERE tenant_id = $1 AND instancia = $2 AND criado_em > now() - interval '14 days' AND tipo = 'text' AND coalesce(length(texto),0) > 0
   ORDER BY numero, criado_em`, [tenantId, config.instancia]);
const porNumero = new Map();
for (const r of rows) { if (!porNumero.has(r.numero)) porNumero.set(r.numero, []); porNumero.get(r.numero).push(r); }

const candidatos = [];
for (const [numero, msgs] of porNumero) {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i], prox = msgs[i + 1];
    if (m.direcao !== 'entrada' || !prox || prox.direcao === 'entrada') continue;
    if (new Date(prox.criado_em) - new Date(m.criado_em) > 15 * 60 * 1000) continue; // so quando houve resposta de verdade
    const anteriores = msgs.slice(Math.max(0, i - 8), i);
    if (FOCO === 'agenda' && !REGEX_AGENDA.test(`${m.texto} ${prox.texto} ${anteriores.slice(-2).map((a) => a.texto).join(' ')}`)) continue;
    candidatos.push({ numero, quando: m.criado_em, primeira: i === 0, anteriores, atual: m });
  }
}
const primeiras = FOCO === 'agenda' ? [] : embaralhar(candidatos.filter((c) => c.primeira)).slice(0, Math.round(N / 3));
const meio = embaralhar(candidatos.filter((c) => !c.primeira)).slice(0, N - primeiras.length);
const casos = [...primeiras, ...meio].map((c, idx) => {
  const turnos = [];
  const empurra = (role, texto) => { const u = turnos[turnos.length - 1]; if (u && u.role === role) u.content += `\n${texto}`; else turnos.push({ role, content: texto }); };
  for (const a of c.anteriores) empurra(a.direcao === 'entrada' ? 'user' : 'assistant', a.texto);
  empurra('user', c.atual.texto);
  while (turnos.length && turnos[0].role !== 'user') turnos.shift();
  return { id: idx + 1, primeira: c.primeira, quando: c.quando, messages: turnos };
});
console.log(`avaliador: ${JUIZ} | foco: ${FOCO || 'geral'} | configs: ${CONFIGS.map((c) => c.id).join(',')}`);
console.log(`casos montados: ${casos.length} (de ${candidatos.length} possiveis; ${primeiras.length} primeiros contatos) | conversas: ${porNumero.size}`);

const listaArquivos = await arquivos.listarArquivos(tenantId);
const tools = aa.montarTools(config, listaArquivos);

// ---------- uma jogada de uma configuracao ----------
async function responder(cfg, caso) {
  const system = aa.systemBlocos(config, {
    vaiSerAudio: false,
    temAgenda: !!(config.agendarClinicorp || config.agendarAgendaInterna),
    contextoTemporalTexto: caso.primeira ? '\n\nFATOS REAIS DESSA CONVERSA (ja conferidos no sistema - nunca invente nada diferente disso, e nunca diga que "nao tem acesso" a essa informacao, porque voce tem):\n- Essa e a PRIMEIRA mensagem dessa conversa com esse contato.' : '',
    agora: new Date(caso.quando),
  });
  const r = await anthropic.messages.create({
    model: cfg.model, max_tokens: 4096, thinking: { type: 'adaptive' }, output_config: { effort: cfg.effort },
    system, tools, messages: caso.messages, _uso: { tenantId: 1, modulo: 'eval' },
  });
  const texto = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const ferramentas = r.content.filter((b) => b.type === 'tool_use').map((b) => ({ nome: b.name, entrada: b.input }));
  return { texto, ferramentas, parou: r.stop_reason, uso: r.usage, custo: custoDaChamada(cfg.model, r.usage) };
}

async function emLotes(itens, concorrencia, fn) {
  const out = new Array(itens.length); let prox = 0;
  await Promise.all(Array.from({ length: concorrencia }, async () => { while (prox < itens.length) { const i = prox++; out[i] = await fn(itens[i], i); } }));
  return out;
}

const resultados = {};
for (const cfg of CONFIGS) {
  const t0 = Date.now();
  // o 1o caso roda sozinho pra escrever o cache; o resto em paralelo le o cache (como na producao)
  const primeira = await responder(cfg, casos[0]).catch((e) => ({ erro: String(e.message).slice(0, 200) }));
  const resto = await emLotes(casos.slice(1), 3, (c) => responder(cfg, c).catch((e) => ({ erro: String(e.message).slice(0, 200) })));
  resultados[cfg.id] = [primeira, ...resto];
  const ok = resultados[cfg.id].filter((x) => !x.erro);
  console.log(`${cfg.id} ${cfg.rotulo}: ${ok.length}/${casos.length} ok em ${Math.round((Date.now() - t0) / 1000)}s`);
}

// ---------- avaliador cego, par a par contra a atual ----------
const resumoFerramentas = tools.map((t) => `- ${t.name}: ${String(t.description).split('\n')[0].slice(0, 160)}`).join('\n');
const sistemaJuiz = [
  { type: 'text', cache_control: { type: 'ephemeral', ttl: '1h' }, text:
`Voce e um avaliador rigoroso de respostas de um atendente de IA no WhatsApp. Abaixo esta o PROMPT que o atendente recebe (as regras que ele deve seguir) e as ferramentas que ele pode chamar.

=== PROMPT DO ATENDENTE ===
${config.prompt}

=== FERRAMENTAS DISPONIVEIS ===
${resumoFerramentas}

Voce vai ver o inicio de uma conversa real e DUAS respostas candidatas (X e Y) para a ultima mensagem do contato. Uma resposta pode ser um texto pro contato, uma chamada de ferramenta (que e uma jogada legitima, por exemplo consultar a agenda antes de responder) ou os dois.
Julgue qual resposta e MELHOR para o contato e para a clinica, considerando: segue as regras do prompt; nao inventa precos, horarios, confirmacoes ou informacoes; nunca diz que agendou/confirmou sem ter chamado a ferramenta; conduz bem a conversa (objetiva, curta, no tom certo, avanca para o proximo passo); usa a ferramenta certa no momento certo (ou corretamente nao usa). Ignore diferencas de estilo que nao mudam o resultado. Se forem equivalentes em qualidade, diga EMPATE.
Responda com no maximo 3 linhas de justificativa e, na ULTIMA linha, exatamente: VEREDITO: X  ou  VEREDITO: Y  ou  VEREDITO: EMPATE` },
];
const fmt = (r) => [r.texto ? `Texto: ${r.texto}` : null, ...r.ferramentas.map((f) => `Chamou a ferramenta ${f.nome} com ${JSON.stringify(f.entrada)}`)].filter(Boolean).join('\n') || '(resposta vazia)';
async function julgar(caso, base, cand) {
  const candidatoEhX = rnd() < 0.5;
  const [x, y] = candidatoEhX ? [cand, base] : [base, cand];
  const conversa = caso.messages.map((m) => `${m.role === 'user' ? 'CONTATO' : 'ATENDENTE'}: ${m.content}`).join('\n');
  const r = await anthropic.messages.create({
    model: JUIZ, max_tokens: 1500, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, system: sistemaJuiz,
    messages: [{ role: 'user', content: `=== CONVERSA ===\n${conversa}\n\n=== RESPOSTA X ===\n${fmt(x)}\n\n=== RESPOSTA Y ===\n${fmt(y)}` }],
    _uso: { tenantId: 1, modulo: 'eval' },
  });
  const t = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const v = (t.match(/VEREDITO:\s*(X|Y|EMPATE)/i) || [])[1]?.toUpperCase();
  const veredito = v === 'EMPATE' || !v ? 'empate' : ((v === 'X') === candidatoEhX ? 'candidata' : 'atual');
  return { veredito, motivo: t.slice(0, 400), semVeredito: !v };
}

const julgamentos = {};
for (const cfg of CONFIGS.filter((c) => c.id !== 'A')) {
  julgamentos[cfg.id] = await emLotes(casos, 3, async (caso, i) => {
    const base = resultados.A[i], cand = resultados[cfg.id][i];
    if (base.erro || cand.erro) return { veredito: 'erro' };
    return julgar(caso, base, cand).catch((e) => ({ veredito: 'erro', motivo: String(e.message).slice(0, 200) }));
  });
  console.log(`avaliado ${cfg.id}`);
}

// ---------- resumo agregado (sem conteudo de conversa) ----------
const media = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const linhas = [];
for (const cfg of CONFIGS) {
  const rs = resultados[cfg.id].filter((x) => !x.erro);
  const hits = rs.filter((x) => (x.uso.cache_read_input_tokens || 0) > 0);
  const base = resultados.A;
  const mesmaDecisao = rs.length ? media(resultados[cfg.id].map((x, i) => (!x.erro && !base[i].erro && JSON.stringify(x.ferramentas.map((f) => f.nome).sort()) === JSON.stringify(base[i].ferramentas.map((f) => f.nome).sort())) ? 1 : 0)) : 0;
  const j = julgamentos[cfg.id]?.filter((x) => x.veredito !== 'erro');
  const cont = (v) => j?.filter((x) => x.veredito === v).length ?? null;
  linhas.push({
    id: cfg.id, config: cfg.rotulo, ok: `${rs.length}/${casos.length}`,
    saidaMedia: Math.round(media(rs.map((x) => x.uso.output_tokens))),
    custoPorChamadaRegime: Number(media((hits.length ? hits : rs).map((x) => x.custo)).toFixed(4)),
    usaFerramenta: `${Math.round(100 * media(rs.map((x) => (x.ferramentas.length ? 1 : 0))))}%`,
    mesmaFerramentaQueAtual: `${Math.round(100 * mesmaDecisao)}%`,
    vsAtual: cfg.id === 'A' ? '-' : `candidata ${cont('candidata')} | empate ${cont('empate')} | atual ${cont('atual')}`,
  });
}
console.table(linhas);
fs.writeFileSync(SAIDA, JSON.stringify({ geradoEm: new Date().toISOString(), tenantId, configs: CONFIGS, casos, resultados, julgamentos, linhas }, null, 1));
console.log(`detalhe (contem conversas reais - NAO versionar): ${SAIDA}`);
await pool.end();
process.exit(0);
