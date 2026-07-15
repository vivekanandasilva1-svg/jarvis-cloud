// motor de auto-atendimento - COMPLETAMENTE isolado do "modo normal" da Lumia (cloudAgent.js):
// prompt proprio, historico proprio (por numero de contato), conjunto de ferramentas proprio e
// bem menor (so agenda, nada de ads/clinicorp/pc/arquivos/lembretes). Existe pra atender
// contatos que mandam mensagem pro numero de WhatsApp - nunca mistura com a conversa pessoal do
// dono nem com a sessao do app web.
import Anthropic from '@anthropic-ai/sdk';
import { pool } from './db.js';
import * as agenda from './agenda.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auto_atendimento_config (
      id INT PRIMARY KEY DEFAULT 1,
      ativo BOOLEAN NOT NULL DEFAULT false,
      instancia TEXT,
      prompt TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (id = 1)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auto_atendimento_sessions (
      numero TEXT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas de auto-atendimento:', err.message);
});

export async function obterConfig() {
  if (!pool) return { ativo: false, instancia: null, prompt: '' };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT ativo, instancia, prompt FROM auto_atendimento_config WHERE id = 1');
  if (!rows.length) return { ativo: false, instancia: null, prompt: '' };
  return { ativo: rows[0].ativo, instancia: rows[0].instancia, prompt: rows[0].prompt || '' };
}

export async function salvarConfig({ ativo, instancia, prompt }) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar essa configuracao.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO auto_atendimento_config (id, ativo, instancia, prompt, atualizado_em)
     VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE SET ativo = $1, instancia = $2, prompt = $3, atualizado_em = now()`,
    [!!ativo, instancia || null, prompt || ''],
  );
}

// conjunto de ferramentas BEM menor que o da Lumia normal - so o suficiente pra "poder realizar
// agendamento tambem" (o unico pedido explicito de capacidade pro auto-atendimento), nada de
// acesso a anuncios, Clinicorp, computador do usuario, geracao de arquivo ou outros numeros
const TOOLS = [
  {
    name: 'agenda_criar_evento',
    description: 'Marca um compromisso/agendamento na agenda. Calcule inicio/fim como data/hora absoluta ISO 8601 usando o "agora" informado.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo do compromisso (ex: nome do contato + assunto)' },
        descricao: { type: 'string', description: 'Detalhes opcionais' },
        local: { type: 'string', description: 'Local opcional' },
        inicio: { type: 'string', description: 'Data/hora de inicio, ISO 8601' },
        fim: { type: 'string', description: 'Data/hora de fim, ISO 8601' },
      },
      required: ['titulo', 'inicio', 'fim'],
    },
  },
  {
    name: 'agenda_listar_eventos',
    description: 'Lista os horarios ja ocupados na agenda num periodo, pra saber o que esta livre antes de sugerir um horario.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Inicio do periodo, ISO 8601 (opcional)' },
        to: { type: 'string', description: 'Fim do periodo, ISO 8601 (opcional)' },
      },
    },
  },
];

async function runTool(name, input) {
  try {
    if (name === 'agenda_criar_evento') return await agenda.criarEvento(input);
    if (name === 'agenda_listar_eventos') return await agenda.listarEventos(input.from, input.to);
    return { erro: `ferramenta desconhecida: ${name}` };
  } catch (err) {
    return { erro: err.message };
  }
}

async function obterHistorico(numero) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT history FROM auto_atendimento_sessions WHERE numero = $1', [numero]);
  return rows[0]?.history || [];
}

const MAX_HISTORICO = 30;
async function salvarHistorico(numero, history) {
  if (!pool) return;
  const cortado = history.length > MAX_HISTORICO ? history.slice(history.length - MAX_HISTORICO) : history;
  await pool.query(
    `INSERT INTO auto_atendimento_sessions (numero, history, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (numero) DO UPDATE SET history = $2, updated_at = now()`,
    [numero, JSON.stringify(cortado)],
  );
}

function systemPromptComHoje(promptCustom) {
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  const agoraHora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  return `${promptCustom}\n\nAgora sao ${agoraHora} de ${hoje} (fuso horario de Maceio/Brasil, UTC-03:00). Use isso pra calcular qualquer data/hora de agendamento - nunca chute.`;
}

const MAX_RODADAS_FERRAMENTA = 5;

export async function processarMensagem(numero, texto) {
  const config = await obterConfig();
  if (!config.ativo || !config.prompt) throw new Error('Auto atendimento nao esta ativo.');

  const history = await obterHistorico(numero);
  history.push({ role: 'user', content: texto });

  const system = systemPromptComHoje(config.prompt);
  let response = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 1000, system, tools: TOOLS, messages: history });
  let rounds = 0;

  while (response.stop_reason === 'tool_use' && rounds < MAX_RODADAS_FERRAMENTA) {
    history.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      const result = await runTool(block.name, block.input);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    history.push({ role: 'user', content: toolResults });
    response = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 1000, system, tools: TOOLS, messages: history });
    rounds += 1;
  }

  const respostaTexto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    || 'Desculpa, nao consegui formular uma resposta agora - pode repetir de outro jeito?';
  history.push({ role: 'assistant', content: respostaTexto });
  await salvarHistorico(numero, history);
  return respostaTexto;
}
