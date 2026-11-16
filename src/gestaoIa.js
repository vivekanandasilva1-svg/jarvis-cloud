// IA do "Lumia Gestao Geral": analisa o painel de um setor e responde perguntas do gestor usando SO os
// numeros do proprio setor/clinica (nada inventado). Somente leitura: a IA nao envia mensagem nem altera
// dado nenhum. O custo e atribuido a clinica (modulo 'gestao') pelo cliente central da Anthropic.
// Nomes de pacientes NAO vao pra IA: so valores, prazos e contagens.
import { anthropic } from './anthropicClient.js';
import * as gestao from './gestao.js';
import * as store from './gestaoStore.js';

const MODEL = 'claude-sonnet-5-5';
const LIMITE_POR_HORA = 40; // chamadas de IA por clinica por hora (protege o saldo de IA)
const usos = new Map(); // tenantId -> [timestamps]

function checarLimite(tenantId) {
  const agora = Date.now();
  const lista = (usos.get(tenantId) || []).filter((t) => agora - t < 3600_000);
  if (lista.length >= LIMITE_POR_HORA) throw new Error('Muitas consultas à IA na última hora. Tente de novo em alguns minutos.');
  lista.push(agora);
  usos.set(tenantId, lista);
}

const REGRAS = `Voce e o analista de gestao de uma clinica odontologica, falando com o gerente.
Regras:
- Use SOMENTE os numeros do contexto abaixo. Se faltar dado, diga que falta e o que precisa ser lancado ou conectado. Nunca invente valor, nome, motivo ou causa que nao esteja nos dados.
- Portugues do Brasil, direto, sem enrolacao, sem emoji. Valores em reais (R$).
- Compare com a meta e com o periodo anterior quando o contexto trouxer. Priorize o que mais pesa em dinheiro ou em risco para o paciente.
- Toda sugestao e uma ACAO concreta (quem faz o que, ate quando) - voce so sugere, nunca diz que fez algo.
- Voce nao tem acesso a nomes de pacientes; se o gerente pedir nomes, diga para olhar a lista no painel.`;

// painel do setor em formato enxuto (sem nomes de pacientes) + decisoes em aberto
export async function montarContexto(tenantId, setor, periodo = {}) {
  const painel = setor === 'vendas' ? await gestao.painelVendas(tenantId, periodo) : await gestao.painelSetor(tenantId, setor, periodo);
  const decisoes = (await store.listarDecisoes(tenantId, { setor, incluirFeitas: false })).map((d) => ({ texto: d.texto, responsavel: d.responsavel, prazo: d.prazo, situacao: d.situacao }));
  return {
    setor,
    periodo: painel.periodo,
    indicadores: painel.kpis.map((k) => ({ indicador: k.rotulo, valor: k.valor, formato: k.formato, meta: k.meta, semaforo: k.status, comparacao: k.comparacao })),
    funil: painel.funil,
    origens: painel.origens,
    orcamentosParados: (painel.orcamentos || []).map((o) => ({ valor: o.valor, diasParado: o.diasParado, responsavel: o.responsavel })),
    pontosDeAtencaoAutomaticos: painel.decidirHoje,
    decisoesEmAberto: decisoes,
    avisosDeDados: painel.avisos,
  };
}

const TOOL_ANALISE = {
  name: 'entregar_analise',
  description: 'Entrega a analise do setor como uma lista curta de pontos priorizados.',
  input_schema: {
    type: 'object',
    properties: {
      pontos: {
        type: 'array', minItems: 1, maxItems: 5,
        items: { type: 'string', description: 'Um ponto: o fato com o numero + a acao sugerida (quem, o que, ate quando). Ate 300 caracteres.' },
      },
    },
    required: ['pontos'],
  },
};

function ehErroDeIa(err) {
  return err?.codigo === 'CONTA_INATIVA' ? err : new Error('A IA está indisponível no momento. Tente de novo em instantes.');
}

export async function analisarSetor(tenantId, setor, periodo = {}) {
  checarLimite(tenantId);
  const contexto = await montarContexto(tenantId, setor, periodo);
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 900, system: REGRAS,
      tools: [TOOL_ANALISE], tool_choice: { type: 'tool', name: 'entregar_analise' },
      messages: [{ role: 'user', content: `Analise o setor "${setor}" e entregue de 3 a 5 pontos, do mais importante ao menos, para o gerente decidir hoje.\n\nCONTEXTO (JSON):\n${JSON.stringify(contexto)}` }],
      _uso: { tenantId, modulo: 'gestao' },
    });
    const tool = resp.content.find((b) => b.type === 'tool_use');
    const pontos = (Array.isArray(tool?.input?.pontos) ? tool.input.pontos : []).map((p) => String(p || '').trim().slice(0, 400)).filter(Boolean).slice(0, 5);
    if (!pontos.length) throw new Error('resposta vazia');
    return pontos;
  } catch (err) { throw ehErroDeIa(err); }
}

export async function perguntar(tenantId, setor, pergunta, periodo = {}) {
  const p = String(pergunta || '').trim();
  if (!p) throw new Error('Escreva a pergunta.');
  if (p.length > 500) throw new Error('A pergunta passou de 500 caracteres.');
  checarLimite(tenantId);
  const contexto = await montarContexto(tenantId, setor, periodo);
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 900, system: REGRAS,
      messages: [{ role: 'user', content: `CONTEXTO (JSON):\n${JSON.stringify(contexto)}\n\nPERGUNTA DO GERENTE:\n${p}` }],
      _uso: { tenantId, modulo: 'gestao' },
    });
    const texto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!texto) throw new Error('resposta vazia');
    return texto.slice(0, 3000);
  } catch (err) { throw ehErroDeIa(err); }
}
