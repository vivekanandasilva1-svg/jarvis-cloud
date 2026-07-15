// motor de auto-atendimento - COMPLETAMENTE isolado do "modo normal" da Lumia (cloudAgent.js):
// prompt proprio, historico proprio (por numero de contato), conjunto de ferramentas proprio e
// bem menor (agenda + envio de arquivo de referencia). Existe pra atender contatos que mandam
// mensagem pro numero de WhatsApp escolhido - nunca mistura com a conversa pessoal do dono nem
// com a sessao do app web.
import Anthropic from '@anthropic-ai/sdk';
import { pool } from './db.js';
import * as agenda from './agenda.js';
import * as evolutionApi from './evolutionApi.js';
import * as arquivos from './autoAtendimentoArquivos.js';
import { transcribeAudio } from './gemini.js';
import { transcribeAudioWhisper } from './whisper.js';
import { synthesizeSpeechKokoro } from './kokoro.js';

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
  // colunas novas (cadencia de resposta em audio) - IF NOT EXISTS pra nao quebrar instalacoes
  // que ja tinham essa tabela antes dessa funcionalidade existir
  await pool.query(`ALTER TABLE auto_atendimento_config ADD COLUMN IF NOT EXISTS frequencia_audio INT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE auto_atendimento_config ADD COLUMN IF NOT EXISTS audio_se_receber_audio BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auto_atendimento_sessions (
      numero TEXT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      contagem_mensagens INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE auto_atendimento_sessions ADD COLUMN IF NOT EXISTS contagem_mensagens INT NOT NULL DEFAULT 0;`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas de auto-atendimento:', err.message);
});

export async function obterConfig() {
  const vazio = { ativo: false, instancia: null, prompt: '', frequenciaAudio: 0, audioSeReceberAudio: false };
  if (!pool) return vazio;
  await tabelasProntas;
  const { rows } = await pool.query(
    'SELECT ativo, instancia, prompt, frequencia_audio, audio_se_receber_audio FROM auto_atendimento_config WHERE id = 1',
  );
  if (!rows.length) return vazio;
  return {
    ativo: rows[0].ativo,
    instancia: rows[0].instancia,
    prompt: rows[0].prompt || '',
    frequenciaAudio: rows[0].frequencia_audio || 0,
    audioSeReceberAudio: !!rows[0].audio_se_receber_audio,
  };
}

export async function salvarConfig({ ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio }) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar essa configuracao.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO auto_atendimento_config (id, ativo, instancia, prompt, frequencia_audio, audio_se_receber_audio, atualizado_em)
     VALUES (1, $1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       ativo = $1, instancia = $2, prompt = $3, frequencia_audio = $4, audio_se_receber_audio = $5, atualizado_em = now()`,
    [!!ativo, instancia || null, prompt || '', Number(frequenciaAudio) || 0, !!audioSeReceberAudio],
  );
}

// ---------- ferramentas: agenda + mandar um arquivo de referencia (contexto injetado por
// closure, pra tool_use conseguir mandar midia sem precisar de parametros extras vindos da IA) ----------

const TOOLS_BASE = [
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

function toolEnviarArquivo(listaDisponiveis) {
  return {
    name: 'enviar_arquivo_referencia',
    description: `Manda pro contato um dos arquivos de referencia cadastrados (PDF, imagem, video ou audio) - use quando o assunto pedir (ex: catalogo, tabela de precos, video institucional). Arquivos disponiveis:\n${
      listaDisponiveis.length
        ? listaDisponiveis.map((a) => `- id ${a.id}: "${a.nome_arquivo}" - ${a.descricao}`).join('\n')
        : '(nenhum arquivo cadastrado ainda)'
    }`,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id do arquivo a enviar' } },
      required: ['id'],
    },
  };
}

async function runTool(name, input, contexto) {
  try {
    if (name === 'agenda_criar_evento') return await agenda.criarEvento(input);
    if (name === 'agenda_listar_eventos') return await agenda.listarEventos(input.from, input.to);
    if (name === 'enviar_arquivo_referencia') {
      const arq = await arquivos.obterArquivo(input.id);
      if (!arq) return { erro: `arquivo com id ${input.id} nao encontrado` };
      await enviarArquivoParaContato(contexto.instancia, contexto.numero, arq);
      return { ok: true, mensagem: `Arquivo "${arq.nome_arquivo}" enviado.` };
    }
    return { erro: `ferramenta desconhecida: ${name}` };
  } catch (err) {
    return { erro: err.message };
  }
}

async function enviarArquivoParaContato(instancia, numero, arquivo) {
  const base64 = arquivo.conteudo.toString('base64');
  if (arquivo.media_type.startsWith('audio/')) {
    await evolutionApi.enviarAudio(instancia, numero, base64);
    return;
  }
  const mediatype = arquivo.media_type.startsWith('image/') ? 'image' : arquivo.media_type.startsWith('video/') ? 'video' : 'document';
  await evolutionApi.enviarMidia(instancia, numero, {
    mediatype,
    mimetype: arquivo.media_type,
    media: base64,
    fileName: arquivo.nome_arquivo,
  });
}

// ---------- entendimento de midia recebida do contato (imagem/audio/video) ----------

async function entenderMidiaRecebida(instancia, mensagemBruta, tipo) {
  const { base64, mimetype } = await evolutionApi.baixarMidiaMensagem(instancia, mensagemBruta);
  const buffer = Buffer.from(base64, 'base64');

  if (tipo === 'image') {
    return { imagem: { data: base64, mediaType: mimetype || 'image/jpeg' } };
  }
  if (tipo === 'audio') {
    const texto = process.env.WHISPER_URL
      ? await transcribeAudioWhisper(buffer, mimetype || 'audio/ogg')
      : await transcribeAudio(buffer, mimetype || 'audio/ogg');
    return { textoExtra: `\n\n[Audio do contato - transcricao]: "${texto || '(sem fala reconhecida)'}"` };
  }
  // video: sem extracao de quadro por enquanto - avisa a IA da limitacao em vez de fingir que viu
  return { textoExtra: '\n\n[O contato mandou um video - voce ainda nao consegue assistir video, so pode reconhecer que recebeu um]' };
}

// ---------- historico + contador de mensagens por contato ----------

async function obterSessao(numero) {
  if (!pool) return { history: [], contagem: 0 };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT history, contagem_mensagens FROM auto_atendimento_sessions WHERE numero = $1', [numero]);
  if (!rows.length) return { history: [], contagem: 0 };
  return { history: rows[0].history || [], contagem: rows[0].contagem_mensagens || 0 };
}

const MAX_HISTORICO = 30;
async function salvarSessao(numero, history, contagem) {
  if (!pool) return;
  const cortado = history.length > MAX_HISTORICO ? history.slice(history.length - MAX_HISTORICO) : history;
  await pool.query(
    `INSERT INTO auto_atendimento_sessions (numero, history, contagem_mensagens, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (numero) DO UPDATE SET history = $2, contagem_mensagens = $3, updated_at = now()`,
    [numero, JSON.stringify(cortado), contagem],
  );
}

function systemPromptComHoje(promptCustom) {
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  const agoraHora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  return `${promptCustom}\n\nAgora sao ${agoraHora} de ${hoje} (fuso horario de Maceio/Brasil, UTC-03:00). Use isso pra calcular qualquer data/hora de agendamento - nunca chute.\n\nVoce pode receber do contato texto, audio (chega ja transcrito), imagem (voce ve de verdade) ou video (voce so sabe que recebeu, ainda nao consegue assistir).`;
}

const MAX_RODADAS_FERRAMENTA = 5;

// tipo: 'text' | 'image' | 'audio' | 'video' (o que o CONTATO mandou, se nao for so texto)
export async function processarMensagem(numero, instancia, { texto, tipo, mensagemBruta }) {
  const config = await obterConfig();
  if (!config.ativo || !config.prompt) throw new Error('Auto atendimento nao esta ativo.');

  let imagemRecebida = null;
  let textoFinal = texto || '';
  if (tipo && tipo !== 'text') {
    try {
      const entendido = await entenderMidiaRecebida(instancia, mensagemBruta, tipo);
      if (entendido.imagem) imagemRecebida = entendido.imagem;
      if (entendido.textoExtra) textoFinal += entendido.textoExtra;
    } catch (err) {
      textoFinal += `\n\n[Nao consegui processar a midia que o contato mandou: ${err.message}]`;
    }
  }
  if (!textoFinal.trim() && !imagemRecebida) return null;

  const { history, contagem } = await obterSessao(numero);
  const conteudoUsuario = imagemRecebida
    ? [
        ...(textoFinal.trim() ? [{ type: 'text', text: textoFinal.trim() }] : []),
        { type: 'image', source: { type: 'base64', media_type: imagemRecebida.mediaType, data: imagemRecebida.data } },
      ]
    : textoFinal.trim();
  history.push({ role: 'user', content: conteudoUsuario });

  const listaArquivos = await arquivos.listarArquivos();
  const TOOLS = [...TOOLS_BASE, toolEnviarArquivo(listaArquivos)];
  const contexto = { instancia, numero };
  const system = systemPromptComHoje(config.prompt);

  let response = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 1000, system, tools: TOOLS, messages: history });
  let rounds = 0;
  while (response.stop_reason === 'tool_use' && rounds < MAX_RODADAS_FERRAMENTA) {
    history.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      const result = await runTool(block.name, block.input, contexto);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    history.push({ role: 'user', content: toolResults });
    response = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: 1000, system, tools: TOOLS, messages: history });
    rounds += 1;
  }

  const respostaTexto = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    || 'Desculpa, nao consegui formular uma resposta agora - pode repetir de outro jeito?';
  history.push({ role: 'assistant', content: respostaTexto });

  const novaContagem = contagem + 1;
  await salvarSessao(numero, history, novaContagem);

  // decide se essa resposta vai por audio: sempre que o contato mandou audio (se a opcao
  // estiver ligada), ou a cada N mensagens (cadencia configurada) - nunca as duas contando em
  // dobro, um simples "ou" basta pro pedido original
  const respondeComAudio =
    (config.audioSeReceberAudio && tipo === 'audio') ||
    (config.frequenciaAudio > 0 && novaContagem % config.frequenciaAudio === 0);

  return { texto: respostaTexto, respondeComAudio };
}

// sintetiza e manda a resposta como nota de voz; se der qualquer erro, quem chamou deve cair
// pra texto (nunca deixar o contato sem resposta nenhuma por causa disso)
export async function enviarRespostaEmAudio(instancia, numero, texto) {
  const { audioBase64 } = await synthesizeSpeechKokoro(texto);
  await evolutionApi.enviarAudio(instancia, numero, audioBase64);
}
