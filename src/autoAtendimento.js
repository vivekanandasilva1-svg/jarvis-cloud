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
import * as clinicorp from './clinicorp.js';
import * as crm from './crm.js';
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
  // onde o agendamento feito pelo auto-atendimento deve ser criado - pode ligar os dois ao
  // mesmo tempo (cria nos dois lugares)
  await pool.query(`ALTER TABLE auto_atendimento_config ADD COLUMN IF NOT EXISTS agendar_clinicorp BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE auto_atendimento_config ADD COLUMN IF NOT EXISTS agendar_agenda_interna BOOLEAN NOT NULL DEFAULT true;`);
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
  const vazio = {
    ativo: false, instancia: null, prompt: '', frequenciaAudio: 0, audioSeReceberAudio: false,
    agendarClinicorp: false, agendarAgendaInterna: true,
  };
  if (!pool) return vazio;
  await tabelasProntas;
  const { rows } = await pool.query(
    'SELECT ativo, instancia, prompt, frequencia_audio, audio_se_receber_audio, agendar_clinicorp, agendar_agenda_interna FROM auto_atendimento_config WHERE id = 1',
  );
  if (!rows.length) return vazio;
  return {
    ativo: rows[0].ativo,
    instancia: rows[0].instancia,
    prompt: rows[0].prompt || '',
    frequenciaAudio: rows[0].frequencia_audio || 0,
    audioSeReceberAudio: !!rows[0].audio_se_receber_audio,
    agendarClinicorp: !!rows[0].agendar_clinicorp,
    agendarAgendaInterna: !!rows[0].agendar_agenda_interna,
  };
}

export async function salvarConfig({ ativo, instancia, prompt, frequenciaAudio, audioSeReceberAudio, agendarClinicorp, agendarAgendaInterna }) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar essa configuracao.');
  await tabelasProntas;

  await pool.query(
    `INSERT INTO auto_atendimento_config (id, ativo, instancia, prompt, frequencia_audio, audio_se_receber_audio, agendar_clinicorp, agendar_agenda_interna, atualizado_em)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       ativo = $1, instancia = $2, prompt = $3, frequencia_audio = $4, audio_se_receber_audio = $5,
       agendar_clinicorp = $6, agendar_agenda_interna = $7, atualizado_em = now()`,
    [!!ativo, instancia || null, prompt || '', Number(frequenciaAudio) || 0, !!audioSeReceberAudio, !!agendarClinicorp, !!agendarAgendaInterna],
  );
  // NAO chama mais /settings/set aqui - ver nota grande em evolutionApi.js sobre o porque
  // (causou pelo menos uma desconexao real por "conflict/device_removed" logo depois de
  // chamado). Estabilidade da sessao do WhatsApp vale muito mais que o indicador "online".
}

// ---------- ferramentas: agenda interna e/ou Clinicorp (conforme configurado) + mandar um
// arquivo de referencia (contexto injetado por closure, pra tool_use conseguir mandar midia
// sem precisar de parametros extras vindos da IA) ----------

const TOOL_AGENDA_LISTAR_INTERNA = {
  name: 'agenda_listar_eventos',
  description: 'Lista os horarios ja ocupados na agenda interna num periodo, pra saber o que esta livre antes de sugerir um horario.',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Inicio do periodo, ISO 8601 (opcional)' },
      to: { type: 'string', description: 'Fim do periodo, ISO 8601 (opcional)' },
    },
  },
};

const TOOL_CLINICORP_CONSULTAR_AGENDA = {
  name: 'clinicorp_consultar_agenda_medico',
  description: 'Lista os horarios JA OCUPADOS de um dentista especifico da clinica (Clinicorp) num periodo - use antes de marcar, pra saber o que sugerir. Passe o nome do medico como o contato falou (ex: "Dr. Thales", "Dra. Vanessa") - o sistema encontra o profissional certo pelo nome.',
  input_schema: {
    type: 'object',
    properties: {
      medico: { type: 'string', description: 'Nome (completo ou parcial) do dentista' },
      from: { type: 'string', description: 'Inicio do periodo, formato AAAA-MM-DD' },
      to: { type: 'string', description: 'Fim do periodo, formato AAAA-MM-DD' },
    },
    required: ['medico', 'from', 'to'],
  },
};

function toolCriarAgendamento({ agendarClinicorp, agendarAgendaInterna }) {
  const destinos = [];
  if (agendarClinicorp) destinos.push('na agenda do Clinicorp (precisa informar o medico)');
  if (agendarAgendaInterna) destinos.push('na agenda interna');
  return {
    name: 'criar_agendamento',
    description: `Marca um agendamento/consulta ${destinos.join(' e ')}. Sempre inclua um resumo do que foi conversado com o contato nas observacoes. Calcule inicio/fim como data/hora absoluta ISO 8601 usando o "agora" informado - NUNCA um horario que ja passou (o sistema rejeita e devolve erro se tentar). Antes de chamar essa ferramenta, SEMPRE consulte a disponibilidade primeiro (agenda_listar_eventos e/ou clinicorp_consultar_agenda_medico) pra nao sugerir um horario ocupado. Regras que o sistema aplica automaticamente: nunca duplica o mesmo paciente no mesmo horario, e no Clinicorp um mesmo horario aceita no maximo 2 pacientes diferentes com o mesmo medico (a partir do 3º, rejeita).`,
    input_schema: {
      type: 'object',
      properties: {
        pacienteNome: { type: 'string', description: 'Nome do contato/paciente' },
        pacienteTelefone: { type: 'string', description: 'Telefone do contato, se souber' },
        medico: { type: 'string', description: agendarClinicorp ? 'Nome do dentista escolhido (obrigatorio pro Clinicorp)' : 'Nome do profissional, se houver' },
        inicio: { type: 'string', description: 'Data/hora de inicio, ISO 8601' },
        fim: { type: 'string', description: 'Data/hora de fim, ISO 8601' },
        resumo: { type: 'string', description: 'Resumo do que foi tratado/conversado com o contato - vai nas observacoes do agendamento' },
      },
      required: agendarClinicorp ? ['pacienteNome', 'medico', 'inicio', 'fim', 'resumo'] : ['pacienteNome', 'inicio', 'fim', 'resumo'],
    },
  };
}

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

// acha o profissional certo pelo nome que o contato falou (aceita nome parcial, sem
// acento/maiusculas - "Thales", "dr thales" ou o nome completo todos acham o mesmo)
function normalizarNome(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^dr\.?a?\.?\s+/, '').trim();
}
async function resolverMedico(nomeFalado) {
  const profissionais = await clinicorp.listProfessionals();
  const alvo = normalizarNome(nomeFalado);
  const achado = profissionais.find((p) => normalizarNome(p.name).includes(alvo) || alvo.includes(normalizarNome(p.name)));
  if (!achado) throw new Error(`Nao encontrei nenhum dentista chamado "${nomeFalado}" no Clinicorp.`);
  return achado;
}

async function runTool(name, input, contexto) {
  try {
    if (name === 'agenda_listar_eventos') return await agenda.listarEventos(input.from, input.to);

    if (name === 'clinicorp_consultar_agenda_medico') {
      const medico = await resolverMedico(input.medico);
      const todos = await clinicorp.listAppointments({ from: input.from, to: input.to });
      const doMedico = todos
        .filter((a) => String(a.Dentist_PersonId) === String(medico.id))
        .map((a) => ({ paciente: a.PatientName, data: a.date?.slice(0, 10), de: a.fromTime, ate: a.toTime }));
      return { medico: medico.name, horariosOcupados: doMedico };
    }

    if (name === 'criar_agendamento') {
      const config = contexto.config;

      // regra de negocio que vale pros dois destinos: nunca marcar no passado - checa server
      // side, nao confia so na IA calcular certo a partir do "agora" do prompt
      const inicioData = new Date(input.inicio);
      if (Number.isNaN(inicioData.getTime())) return { erro: `Data/hora de inicio invalida: "${input.inicio}"` };
      if (inicioData.getTime() <= Date.now()) {
        return { erro: 'Esse horario ja passou (ou e agora mesmo) - so da pra marcar pra um horario no futuro.' };
      }

      const resultado = {};

      if (config.agendarClinicorp) {
        try {
          const medico = await resolverMedico(input.medico);
          const data = input.inicio.slice(0, 10);
          const de = input.inicio.slice(11, 16);
          const ate = input.fim.slice(11, 16);

          // olha quem ja esta marcado com esse medico nesse dia, pra checar duplicidade e o
          // limite de 2 pessoas diferentes no mesmo horario antes de tentar criar de verdade
          const doDia = await clinicorp.listAppointments({ from: data, to: data });
          const domedico = doDia.filter((a) => String(a.Dentist_PersonId) === String(medico.id));
          const mesmoHorario = domedico.filter((a) => a.fromTime === de);
          const nomeNovoPaciente = normalizarNome(input.pacienteNome);

          const jaTemEsseMesmoPaciente = mesmoHorario.some((a) => normalizarNome(a.PatientName) === nomeNovoPaciente);
          if (jaTemEsseMesmoPaciente) {
            resultado.clinicorp = { erro: `${input.pacienteNome} ja tem um agendamento marcado com ${medico.name} nesse mesmo horario - nao duplica.` };
          } else {
            const pacientesDiferentes = new Set(mesmoHorario.map((a) => normalizarNome(a.PatientName)));
            if (pacientesDiferentes.size >= 2) {
              resultado.clinicorp = { erro: `Esse horario com ${medico.name} ja tem 2 pessoas diferentes marcadas - escolha outro horario.` };
            } else {
              await clinicorp.createAppointment({
                patientName: input.pacienteNome,
                mobilePhone: input.pacienteTelefone || contexto.numero,
                date: data,
                fromTime: de,
                toTime: ate,
                dentistId: medico.id,
                categoryDescription: 'Auto atendimento WhatsApp',
                notes: input.resumo,
              });
              resultado.clinicorp = { ok: true, medico: medico.name };
            }
          }
        } catch (err) {
          resultado.clinicorp = { erro: err.message };
        }
      }

      if (config.agendarAgendaInterna) {
        try {
          // agenda interna e de uso pessoal (1 coisa de cada vez) - nunca sobrepoe outro
          // compromisso ja marcado, ao contrario do Clinicorp que aceita ate 2 pessoas
          const existentes = await agenda.listarEventos(input.inicio, input.fim);
          const fimData = new Date(input.fim);
          const sobrepoe = existentes.some((e) => new Date(e.inicio) < fimData && new Date(e.fim) > inicioData);
          if (sobrepoe) {
            resultado.agendaInterna = { erro: 'Ja existe outro compromisso nesse horario na agenda interna - escolha outro horario.' };
          } else {
            const r = await agenda.criarEvento({
              titulo: `${input.pacienteNome}${input.medico ? ` - ${input.medico}` : ''}`,
              descricao: input.resumo,
              inicio: input.inicio,
              fim: input.fim,
            });
            resultado.agendaInterna = { ok: true, id: r.id };
          }
        } catch (err) {
          resultado.agendaInterna = { erro: err.message };
        }
      }

      // pula o card do contato pro "Agendado" no CRM se qualquer um dos dois destinos deu certo
      // - best-effort, nunca deve quebrar a resposta pro contato se o CRM falhar
      if (resultado.clinicorp?.ok || resultado.agendaInterna?.ok) {
        crm.marcarAgendado(contexto.numero, contexto.instancia).catch((err) => console.error('Erro movendo card no CRM:', err.message));
      }

      return resultado;
    }

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

// aviso dinamico, colocado no FIM do prompt (maior prioridade/recencia) - o prompt customizado
// do usuario pode ter instrucoes gerais tipo "use uns emojis" (pensando em texto) que colidem
// com a regra de audio; como aqui a gente ja sabe ANTES de gerar se essa resposta especifica
// vai ser falada ou lida, da pra avisar a IA de forma inequivoca em vez de deixar ela adivinhar
const AVISO_RESPOSTA_EM_AUDIO = `\n\nATENCAO - ESTA RESPOSTA ESPECIFICA VAI SER CONVERTIDA EM AUDIO E OUVIDA EM VOZ ALTA (nao lida como texto). Isso PREVALECE sobre qualquer instrucao anterior sobre emoji/formatacao: NUNCA use emoji (nem um so, mesmo que o prompt acima peca), NUNCA use asterisco, #, _, markdown ou qualquer simbolo de formatacao - escreva so texto corrido, como se estivesse falando naturalmente em voz alta. Fale horas por extenso (ex: "14 horas", "14 horas e 30", nunca "14h" ou "14:00h").`;

function systemPromptComHoje(promptCustom, vaiSerAudio) {
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  const agoraHora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  let prompt = `${promptCustom}\n\nAgora sao ${agoraHora} de ${hoje} (fuso horario de Maceio/Brasil, UTC-03:00). Use isso pra calcular qualquer data/hora de agendamento - nunca chute.\n\nVoce pode receber do contato texto, audio (chega ja transcrito), imagem (voce ve de verdade) ou video (voce so sabe que recebeu, ainda nao consegue assistir).`;
  if (vaiSerAudio) prompt += AVISO_RESPOSTA_EM_AUDIO;
  return prompt;
}

// rede de seguranca no CODIGO (nao so no prompt) - mesmo que a IA "esqueça" a instrucao, isso
// garante que nenhum audio saia com emoji falado por extenso ou simbolo de markdown lido em
// voz alta, e converte "14h"/"14:00h" pro formato falado que foi pedido
const REGEX_EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}️‍]/gu;
export function prepararTextoParaAudio(texto) {
  return texto
    .replace(REGEX_EMOJI, '')
    .replace(/\*\*|__|##+|`+/g, '')
    .replace(/(?<![:\d])\b(\d{1,2}):00h?\b/g, '$1 horas')
    .replace(/(?<![:\d])\b(\d{1,2}):(\d{2})h?\b/g, '$1 horas e $2')
    .replace(/(?<![:\d])\b(\d{1,2})h00\b/g, '$1 horas')
    .replace(/(?<![:\d])\b(\d{1,2})h(\d{2})\b/g, '$1 horas e $2')
    .replace(/(?<![:\d])\b(\d{1,2})h\b/g, '$1 horas')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const MAX_RODADAS_FERRAMENTA = 5;

function decidirSeAudio(config, novaContagem, tipo) {
  return (
    (config.audioSeReceberAudio && tipo === 'audio') ||
    (config.frequenciaAudio > 0 && novaContagem % config.frequenciaAudio === 0)
  );
}

// consulta rapida (sem gerar nada) pra saber com antecedencia se a PROXIMA resposta desse
// contato vai ser audio ou texto - usada pelo servidor pra ja mostrar o indicador de presenca
// certo ("digitando" ou "gravando audio") antes mesmo de comecar a pensar na resposta
export async function preverVaiSerAudio(numero, tipo) {
  const config = await obterConfig();
  if (!config.ativo) return false;
  const { contagem } = await obterSessao(numero);
  return decidirSeAudio(config, contagem + 1, tipo);
}

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

  // decide ANTES de gerar se essa resposta vai por audio - sempre que o contato mandou audio
  // (se a opcao estiver ligada), ou a cada N mensagens (cadencia configurada). Precisa saber
  // isso agora (nao so depois) pra poder avisar a IA no proprio prompt desta chamada.
  const novaContagem = contagem + 1;
  const vaiSerAudio = decidirSeAudio(config, novaContagem, tipo);

  const listaArquivos = await arquivos.listarArquivos();
  const TOOLS = [];
  if (config.agendarAgendaInterna) TOOLS.push(TOOL_AGENDA_LISTAR_INTERNA);
  if (config.agendarClinicorp) TOOLS.push(TOOL_CLINICORP_CONSULTAR_AGENDA);
  if (config.agendarClinicorp || config.agendarAgendaInterna) TOOLS.push(toolCriarAgendamento(config));
  TOOLS.push(toolEnviarArquivo(listaArquivos));
  const contexto = { instancia, numero, config };
  const system = systemPromptComHoje(config.prompt, vaiSerAudio);

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

  await salvarSessao(numero, history, novaContagem);

  return { texto: respostaTexto, respondeComAudio: vaiSerAudio };
}

// sintetiza e manda a resposta como nota de voz; se der qualquer erro, quem chamou deve cair
// pra texto (nunca deixar o contato sem resposta nenhuma por causa disso). Passa pelo filtro
// de seguranca (prepararTextoParaAudio) mesmo que o prompt/aviso dinamico ja tenham pedido pra
// IA nao usar emoji/markdown - garante o resultado mesmo se ela nao seguir 100%.
export async function enviarRespostaEmAudio(instancia, numero, texto) {
  const { audioBase64 } = await synthesizeSpeechKokoro(prepararTextoParaAudio(texto));
  await evolutionApi.enviarAudio(instancia, numero, audioBase64);
}
