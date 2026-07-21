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
import { transcrever } from './whisper.js';
import { synthesizeSpeechKokoro } from './kokoro.js';
import { moedaPorExtenso } from './numeroPorExtenso.js';

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

const TOOL_VERIFICAR_COMPARECIMENTO = {
  name: 'verificar_comparecimento',
  description: 'Lista os agendamentos do contato num periodo (agenda interna e/ou Clinicorp, conforme o que estiver ativo) - passados OU futuros, dependendo do periodo pedido. Cada agendamento vem com "id" (necessario pra cancelar_agendamento) e status de cancelamento quando disponivel no Clinicorp. Use pra: (1) checar comparecimento quando o contato mencionar uma data/agendamento que ja passou - se nao ficar claro se ele foi ou faltou, pergunte diretamente em vez de supor; (2) achar o id de um agendamento FUTURO que o contato quer cancelar ou remarcar (passe um periodo que cubra a data futura em from/to).',
  input_schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Inicio do periodo a checar, formato AAAA-MM-DD (opcional, padrao 60 dias atras)' },
      to: { type: 'string', description: 'Fim do periodo a checar, formato AAAA-MM-DD (opcional, padrao hoje - informe uma data futura aqui se estiver procurando um agendamento marcado pra frente)' },
    },
  },
};

const TOOL_CANCELAR_AGENDAMENTO = {
  name: 'cancelar_agendamento',
  description: 'Cancela um agendamento DE VERDADE (chamada real na API - Clinicorp e/ou agenda interna, conforme configurado), removendo-o de vez da agenda. Use os ids que vieram de verificar_comparecimento (campo "id" de cada agendamento) - ache o agendamento certo primeiro com verificar_comparecimento antes de cancelar. Se o contato tiver mais de um agendamento proximo, confirme qual exatamente antes de cancelar. So diga pro contato que foi cancelado DEPOIS de ver ok:true no resultado - nunca diga "vou sinalizar pra equipe" ou finja que cancelou, voce tem essa ferramenta de verdade.',
  input_schema: {
    type: 'object',
    properties: {
      clinicorpId: { type: 'string', description: 'Id do agendamento no Clinicorp (campo "id" retornado por verificar_comparecimento), se aplicavel' },
      agendaInternaId: { type: 'integer', description: 'Id do evento na agenda interna (campo "id" retornado por verificar_comparecimento), se aplicavel' },
    },
  },
};

const TOOL_CLINICORP_BUSCAR_PACIENTE = {
  name: 'clinicorp_buscar_paciente',
  description: 'Busca se o contato ja tem cadastro de paciente no Clinicorp, pelo telefone (padrao: o proprio numero de WhatsApp da conversa) e/ou nome. IMPORTANTE: a busca por nome exige o nome EXATO como esta cadastrado - um nome parecido mas nao identico nao aparece, entao "nao encontrado" nao prova que e paciente novo. Use SEMPRE antes de cadastrar (clinicorp_cadastrar_paciente), mas se nao achar nada, pergunte ao contato se ele ja e paciente antes de assumir que e novo - nunca cadastre de novo sem essa confirmacao, pra nao duplicar.',
  input_schema: {
    type: 'object',
    properties: {
      telefone: { type: 'string', description: 'Telefone a buscar (padrao: o numero do proprio contato dessa conversa)' },
      nome: { type: 'string', description: 'Nome a buscar - use se a busca por telefone nao achar nada' },
    },
  },
};

const TOOL_CLINICORP_CADASTRAR_PACIENTE = {
  name: 'clinicorp_cadastrar_paciente',
  description: 'Cadastra um paciente novo de verdade no Clinicorp - use SOMENTE depois de confirmar com clinicorp_buscar_paciente que ele ainda nao tem cadastro. O Clinicorp exige pelo menos nome completo e data de nascimento - pergunte isso ao contato antes de chamar essa ferramenta, nunca invente ou deixe em branco. Depois de cadastrar, use o id do paciente devolvido (patientId) na ferramenta criar_agendamento, pra vincular o agendamento a esse cadastro de verdade.',
  input_schema: {
    type: 'object',
    properties: {
      nome: { type: 'string', description: 'Nome completo do paciente' },
      nascimento: { type: 'string', description: 'Data de nascimento, formato AAAA-MM-DD - obrigatorio, pergunte ao contato' },
      telefone: { type: 'string', description: 'Telefone (padrao: o proprio numero da conversa)' },
      email: { type: 'string', description: 'Email, se o contato informar (opcional)' },
    },
    required: ['nome', 'nascimento'],
  },
};

function toolCriarAgendamento({ agendarClinicorp, agendarAgendaInterna }) {
  const destinos = [];
  if (agendarClinicorp) destinos.push('na agenda do Clinicorp (precisa informar o medico)');
  if (agendarAgendaInterna) destinos.push('na agenda interna');
  return {
    name: 'criar_agendamento',
    description: `Marca um agendamento/consulta ${destinos.join(' e ')} DE VERDADE (chamada real na API, nao e so um texto de confirmacao) - so diga pro contato que esta confirmado DEPOIS de ver no resultado desta ferramenta que deu certo (ok: true no destino configurado); se vier erro, NUNCA finja que deu certo, explique o problema pro contato ou tente resolver (ex: escolher outro horario). ${agendarClinicorp ? 'Pro Clinicorp: se o contato for paciente novo (sem cadastro), use clinicorp_buscar_paciente e, se nao achar, clinicorp_cadastrar_paciente ANTES de chamar essa ferramenta, e passe o patientId encontrado/criado aqui - nao deixe so pro campo pacienteNome tentar criar um cadastro incompleto sozinho.' : ''} Sempre inclua um resumo do que foi conversado com o contato nas observacoes. Calcule inicio/fim como data/hora absoluta ISO 8601 usando o "agora" informado - NUNCA um horario que ja passou (o sistema rejeita e devolve erro se tentar). Antes de chamar essa ferramenta, SEMPRE consulte a disponibilidade primeiro (agenda_listar_eventos e/ou clinicorp_consultar_agenda_medico) pra nao sugerir um horario ocupado. Regras que o sistema aplica automaticamente: nunca duplica o mesmo paciente no mesmo horario, e no Clinicorp um mesmo horario aceita no maximo 2 pacientes diferentes com o mesmo medico (a partir do 3º, rejeita).`,
    input_schema: {
      type: 'object',
      properties: {
        pacienteNome: { type: 'string', description: 'Nome do contato/paciente' },
        pacienteTelefone: { type: 'string', description: 'Telefone do contato, se souber' },
        patientId: { type: 'string', description: 'Id do paciente no Clinicorp (de clinicorp_buscar_paciente ou clinicorp_cadastrar_paciente), se ja tiver - vincula o agendamento ao cadastro de verdade em vez de so passar o nome' },
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

// cache leve do catalogo de status de agendamento (Confirmado, Faltou, Protese pendente etc) -
// raramente muda, evita bater na API do Clinicorp de novo a cada checagem de comparecimento
let statusAgendamentoCache = null;
let statusAgendamentoCacheEm = 0;
async function obterStatusAgendamento() {
  if (statusAgendamentoCache && Date.now() - statusAgendamentoCacheEm < 10 * 60 * 1000) {
    return statusAgendamentoCache;
  }
  const lista = await clinicorp.getAppointmentStatusList();
  statusAgendamentoCache = lista;
  statusAgendamentoCacheEm = Date.now();
  return lista;
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

    if (name === 'clinicorp_buscar_paciente') {
      const telefone = input.telefone || contexto.numero;
      // findPatient lanca erro (404) quando nao acha nada, dependendo da API - trata qualquer
      // falha na busca como "nao encontrado" em vez de propagar erro, pra IA seguir o fluxo
      // normal de "nao achei, vou cadastrar" em vez de travar
      try {
        const porTelefone = await clinicorp.findPatient({ phone: telefone });
        const idTelefone = porTelefone?.Id ?? porTelefone?.PersonId ?? porTelefone?.PatientId ?? porTelefone?.id;
        if (idTelefone) return { encontrado: true, patientId: idTelefone, paciente: porTelefone };
      } catch { /* segue pra tentar por nome, se informado */ }

      if (input.nome) {
        try {
          const porNome = await clinicorp.findPatient({ name: input.nome });
          const idNome = porNome?.Id ?? porNome?.PersonId ?? porNome?.PatientId ?? porNome?.id;
          if (idNome) return { encontrado: true, patientId: idNome, paciente: porNome };
        } catch { /* nao achou por nome tambem */ }
      }
      return { encontrado: false };
    }

    if (name === 'clinicorp_cadastrar_paciente') {
      try {
        const paciente = await clinicorp.createPatient({
          name: input.nome,
          birthDate: input.nascimento,
          mobilePhone: input.telefone || contexto.numero,
          email: input.email,
        });
        const patientId = paciente?.Id ?? paciente?.PersonId ?? paciente?.PatientId ?? paciente?.id;
        return { ok: true, patientId, paciente };
      } catch (err) {
        return { ok: false, erro: err.message };
      }
    }

    if (name === 'verificar_comparecimento') {
      const hoje = new Date();
      const from = input.from || new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const to = input.to || hoje.toISOString().slice(0, 10);
      const resultado = {};

      if (contexto.config.agendarAgendaInterna) {
        try {
          const eventos = await agenda.listarEventos(from, to);
          // id incluido de proposito - e o que cancelar_agendamento precisa pra cancelar esse
          // evento especifico depois
          resultado.agendaInterna = eventos.map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio, fim: e.fim }));
        } catch (err) {
          resultado.agendaInterna = { erro: err.message };
        }
      }

      if (contexto.config.agendarClinicorp) {
        try {
          const paciente = await clinicorp.findPatient({ phone: contexto.numero });
          // o campo do id do paciente varia (Id/PersonId/PatientId, conforme a config da
          // clinica) - tenta os nomes conhecidos em vez de travar num so
          const patientId = paciente?.Id ?? paciente?.PersonId ?? paciente?.PatientId ?? paciente?.id;
          if (!patientId) {
            resultado.clinicorp = { mensagem: 'Nenhum paciente encontrado no Clinicorp com esse telefone - nao da pra checar historico la.' };
          } else {
            const [agendamentos, statusList] = await Promise.all([
              clinicorp.listAppointments({ patientId, from, to, includeCanceled: 'X' }),
              obterStatusAgendamento(),
            ]);
            const statusPorId = new Map(statusList.map((s) => [String(s.id), s.Description]));
            resultado.clinicorp = agendamentos.map((a) => ({
              // id incluido de proposito - e o que cancelar_agendamento precisa pra cancelar
              // esse agendamento especifico depois, sem confundir com outro do mesmo contato
              id: a.id,
              data: a.date?.slice(0, 10),
              de: a.fromTime,
              ate: a.toTime,
              // status resolvido (ex: "8-Faltou", "4-Atendido") - mais confiavel que so olhar
              // cancelado, que so cobre cancelamento explicito, nao falta registrada depois
              status: statusPorId.get(String(a.StatusId)) || null,
              cancelado: a.Canceled === 'X',
              motivoCancelamento: a.Canceled === 'X' ? a.CancelReason : undefined,
              categoria: a.CategoryDescription,
            }));
          }
        } catch (err) {
          resultado.clinicorp = { erro: err.message };
        }
      }

      return resultado;
    }

    if (name === 'cancelar_agendamento') {
      if (!input.clinicorpId && !input.agendaInternaId) {
        return { erro: 'Nao foi informado nenhum id de agendamento pra cancelar - use verificar_comparecimento primeiro pra achar o id certo.' };
      }
      const resultado = {};
      if (input.clinicorpId) {
        try {
          await clinicorp.cancelAppointment({ id: input.clinicorpId });
          resultado.clinicorp = { ok: true };
        } catch (err) {
          resultado.clinicorp = { ok: false, erro: err.message };
        }
      }
      if (input.agendaInternaId) {
        try {
          await agenda.cancelarEvento(input.agendaInternaId);
          resultado.agendaInterna = { ok: true };
        } catch (err) {
          resultado.agendaInterna = { ok: false, erro: err.message };
        }
      }
      return resultado;
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
                patientId: input.patientId || undefined,
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
    const texto = await transcrever(buffer, mimetype || 'audio/ogg');
    return { textoExtra: `\n\n[Audio do contato - transcricao]: "${texto || '(sem fala reconhecida)'}"` };
  }
  // video: sem extracao de quadro por enquanto - avisa a IA da limitacao em vez de fingir que viu
  return { textoExtra: '\n\n[O contato mandou um video - voce ainda nao consegue assistir video, so pode reconhecer que recebeu um]' };
}

// ---------- historico + contador de mensagens por contato ----------

// a API da Anthropic exige que todo tool_result tenha o tool_use correspondente na mensagem
// anterior - o corte por tamanho abaixo (slice por contagem) podia cortar bem no meio de um
// par tool_use/tool_result (mensagens adjacentes mas separadas: uma 'assistant', outra
// 'user'), deixando um tool_result orfao. A proxima chamada pra API entao quebrava com 400
// pra sempre nesse contato (mesmo bug ja corrigido no chat pessoal, ver cloudAgent.js). Essa
// funcao descarta qualquer tool_result cujo tool_use correspondente nao esteja mais no
// historico; se a mensagem ficar sem nenhum bloco depois disso, ela e descartada inteira.
function repararHistorico(history) {
  const abertos = new Set();
  const reparado = [];
  for (const msg of history) {
    if (msg.role === 'assistant') {
      reparado.push(msg);
      if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b.type === 'tool_use') abertos.add(b.id);
        }
      }
      continue;
    }
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const blocosValidos = msg.content.filter((b) => {
        if (b.type !== 'tool_result') return true;
        const valido = abertos.has(b.tool_use_id);
        if (valido) abertos.delete(b.tool_use_id);
        return valido;
      });
      if (!blocosValidos.length) continue;
      reparado.push(blocosValidos.length === msg.content.length ? msg : { ...msg, content: blocosValidos });
      continue;
    }
    reparado.push(msg);
  }
  return reparado;
}

async function obterSessao(numero) {
  if (!pool) return { history: [], contagem: 0 };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT history, contagem_mensagens FROM auto_atendimento_sessions WHERE numero = $1', [numero]);
  if (!rows.length) return { history: [], contagem: 0 };
  // repara aqui tambem: contatos que ja ficaram com um tool_result orfao salvo no banco (de
  // antes desse fix, ou de uma interrupcao a meio do loop) precisam disso pra sair do estado
  // quebrado, senao toda mensagem seguinte volta a falhar do mesmo jeito, pra sempre.
  return { history: repararHistorico(rows[0].history || []), contagem: rows[0].contagem_mensagens || 0 };
}

const MAX_HISTORICO = 30;
async function salvarSessao(numero, history, contagem) {
  if (!pool) return;
  const cortado = repararHistorico(history.length > MAX_HISTORICO ? history.slice(history.length - MAX_HISTORICO) : history);
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
const AVISO_RESPOSTA_EM_AUDIO = `\n\nATENCAO - ESTA RESPOSTA ESPECIFICA VAI SER CONVERTIDA EM AUDIO E OUVIDA EM VOZ ALTA (nao lida como texto). Isso PREVALECE sobre qualquer instrucao anterior sobre emoji/formatacao: NUNCA use emoji (nem um so, mesmo que o prompt acima peca), NUNCA use asterisco, #, _, markdown ou qualquer simbolo de formatacao - escreva so texto corrido, como se estivesse falando naturalmente em voz alta. Pode escrever hora ("14h", "14:30h") e valores em dinheiro ("R$ 1.500,00", "US$ 30,50") do jeito normal - o sistema ja converte tudo pra fala por extenso sozinho (ex: "14 horas e 30 minutos", "mil e quinhentos reais"), com "R$" sempre virando "reais" (nunca "real dolar") e "US$"/"$" sozinho virando "dolares".`;

// regra fixa no codigo (nao no prompt customizado do painel, que o usuario edita livremente) -
// garante objetividade mesmo que o prompt configurado nao mencione isso, ou peca o contrario.
// Contato de WhatsApp espera resposta rapida de ler/ouvir, nao um textao - especialmente em
// audio, onde cada segundo a mais cansa muito mais que na leitura.
const AVISO_OBJETIVIDADE = `\n\nSeja sempre objetiva e curta - va direto ao ponto na primeira frase, sem introducao nem enrolacao. Mantenha toda informacao util e necessaria, mas resuma de forma dinamica: entregue a conclusao/resposta direta primeiro, sem listar tudo em detalhe se nao for pedido. Respostas longas cansam quem esta lendo ou ouvindo no WhatsApp - poucas frases bem resolvidas valem mais que um paragrafo longo. So se estenda se o contato pedir mais detalhe explicitamente.`;

// regra fixa tambem (nao no prompt customizado) - so entra quando alguma agenda esta ativa
// (senao mencionaria uma ferramenta que nem existe nesse turno). O sistema ja rejeita no
// codigo qualquer NOVO agendamento numa data/hora que ja passou (ver criar_agendamento) - isso
// aqui cobre o outro lado: perceber quando o contato fala de algo que JA ACONTECEU (marcado
// antes) e investigar comparecimento em vez de so seguir a conversa como se nada tivesse
// passado, ou pior, tratar aquela data velha como se ainda fosse marcavel.
const AVISO_DATAS_PASSADAS = `\n\nSobre datas/agendamentos: nunca confirme ou trate como valido um agendamento numa data/hora que ja passou - o sistema rejeita automaticamente qualquer tentativa de marcar no passado, entao se o contato pedir isso, explique que precisa ser uma data futura e ja sugira alternativas. Alem disso, sempre que o contato mencionar uma data ou agendamento que ja passou, ou quando voce perceber (pelo contexto da conversa ou ao consultar a agenda) que ele tinha algo marcado numa data que ja passou, use a ferramenta verificar_comparecimento pra checar a agenda interna e o Clinicorp antes de continuar. Se dessa checagem nao ficar claro se ele compareceu ou faltou, pergunte diretamente pro contato ("voce chegou a comparecer nessa consulta?"). Se ele confirmar que faltou, ou se a falta parecer provavel, direcione a conversa pra oferecer um novo horario - nunca deixe barato nem ignore uma falta.

REGRA CRITICA sobre confirmar agendamento: so diga pro contato que o agendamento esta confirmado/marcado DEPOIS de chamar criar_agendamento e ver no resultado que o destino configurado voltou com "ok: true" - nunca diga "confirmado" ou "marcado" so porque decidiu marcar ou porque a conversa chegou nesse ponto, isso seria inventar um agendamento que nao existe de verdade. Se o resultado vier com erro, NUNCA finja sucesso pro contato - explique o problema (outro horario, tente de novo) ou avise que precisa verificar manualmente. Se o contato ainda nao tem cadastro de paciente no Clinicorp (confira com clinicorp_buscar_paciente antes de marcar pela primeira vez), pergunte nome completo e data de nascimento e cadastre de verdade com clinicorp_cadastrar_paciente antes de criar o agendamento - nunca deixe o cadastro incompleto ou pule essa etapa.

REGRA CRITICA sobre cancelar agendamento: quando o contato pedir pra cancelar/remover um agendamento, voce TEM a ferramenta cancelar_agendamento pra fazer isso de verdade - nunca diga que "nao tem como excluir por aqui" ou que vai "sinalizar pra equipe cancelar manualmente", isso e falso, voce pode cancelar direto. Fluxo: use verificar_comparecimento (com o periodo cobrindo a data do agendamento, que pode ser futura) pra achar o id certo, confirme com o contato qual agendamento exatamente se houver mais de um, chame cancelar_agendamento com esse id, e so confirme o cancelamento pro contato depois de ver ok:true no resultado.

REGRA CRITICA sobre evitar cadastro de paciente duplicado: a busca do Clinicorp por nome (clinicorp_buscar_paciente) exige o nome EXATO como esta cadastrado - um nome parecido mas nao identico (ex: contato diz "Vivekananda Silva" mas o cadastro real e "Vivekananda Francisco da Silva Filho") NAO aparece na busca, entao "nao encontrado" nao significa necessariamente que o contato e paciente novo. Por isso, antes de cadastrar um paciente novo (clinicorp_cadastrar_paciente), SEMPRE pergunte diretamente pro contato "voce ja e paciente da clinica ou seria seu primeiro cadastro?" - se ele disser que ja e paciente, peça o nome completo EXATO (ou telefone que costuma usar) e tente a busca de novo antes de criar um cadastro novo. So cadastre quando o contato confirmar que e cliente/paciente novo.`;

function systemPromptComHoje(promptCustom, vaiSerAudio, temAgenda) {
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  const agoraHora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  let prompt = `${promptCustom}\n\nAgora sao ${agoraHora} de ${hoje} (fuso horario de Maceio/Brasil, UTC-03:00). Use isso pra calcular qualquer data/hora de agendamento - nunca chute.\n\nVoce pode receber do contato texto, audio (chega ja transcrito), imagem (voce ve de verdade) ou video (voce so sabe que recebeu, ainda nao consegue assistir).`;
  prompt += AVISO_OBJETIVIDADE;
  if (temAgenda) prompt += AVISO_DATAS_PASSADAS;
  if (vaiSerAudio) prompt += AVISO_RESPOSTA_EM_AUDIO;
  return prompt;
}

// rede de seguranca no CODIGO (nao so no prompt) - mesmo que a IA "esqueça" a instrucao, isso
// garante que nenhum audio saia com emoji falado por extenso, simbolo de markdown lido em voz
// alta, "14h"/"14:00h" sem converter, ou moeda ambigua ("R$"/"$" lidos junto como "real dolar")
const REGEX_EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}️‍]/gu;
// valor no formato BR: ate 3 digitos, grupos de milhar separados por ponto, virgula decimal
// opcional - "247.011,90", "1.500,00", "50", "5,20" etc
const REGEX_VALOR_BR = '-?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?';
export function prepararTextoParaAudio(texto) {
  return texto
    .replace(REGEX_EMOJI, '')
    .replace(/\*\*|__|##+|`+/g, '')
    // moeda: "R$ 247.011,90" -> "duzentos e quarenta e sete mil e onze reais e noventa
    // centavos" (por extenso, concordando singular/plural de real/reais e centavo/centavos) -
    // a ordem importa (R$ antes de US$ antes do $ solto), senao o "$" de "R$"/"US$" seria pego
    // pela regra generica do "$" sozinho antes de chegar na regra certa
    .replace(new RegExp(`R\\$\\s*(${REGEX_VALOR_BR})`, 'gi'), (_, valor) => moedaPorExtenso(valor, 'real', 'reais'))
    .replace(new RegExp(`US\\$\\s*(${REGEX_VALOR_BR})`, 'gi'), (_, valor) => moedaPorExtenso(valor, 'dólar', 'dólares'))
    .replace(new RegExp(`\\$\\s*(${REGEX_VALOR_BR})`, 'g'), (_, valor) => moedaPorExtenso(valor, 'dólar', 'dólares'))
    // "R$"/"US$"/"$" que sobrou sem numero valido na frente (raro) - ainda assim nunca deixa o
    // simbolo cru: vira so a palavra da moeda
    .replace(/R\$\s*/gi, 'Real ')
    .replace(/US\$\s*/gi, 'Dolar ')
    .replace(/\$\s*/g, 'Dolar ')
    // hora: "8h", "08h", "8h30", "8h:30", "08:30h" etc - qualquer numero de 1-2 digitos junto de
    // "h" (com ou sem ":") significa horas, e a segunda parte (se tiver) sao os minutos
    .replace(/(?<![:\d])\b(\d{1,2}):00h?\b/g, '$1 horas')
    .replace(/(?<![:\d])\b(\d{1,2}):(\d{2})h?\b/g, '$1 horas e $2 minutos')
    .replace(/(?<![:\d])\b(\d{1,2})h:(\d{2})\b/g, '$1 horas e $2 minutos')
    .replace(/(?<![:\d])\b(\d{1,2})h00\b/g, '$1 horas')
    .replace(/(?<![:\d])\b(\d{1,2})h(\d{2})\b/g, '$1 horas e $2 minutos')
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
  if (config.agendarClinicorp) {
    TOOLS.push(TOOL_CLINICORP_CONSULTAR_AGENDA);
    TOOLS.push(TOOL_CLINICORP_BUSCAR_PACIENTE);
    TOOLS.push(TOOL_CLINICORP_CADASTRAR_PACIENTE);
  }
  if (config.agendarClinicorp || config.agendarAgendaInterna) {
    TOOLS.push(toolCriarAgendamento(config));
    TOOLS.push(TOOL_VERIFICAR_COMPARECIMENTO);
    TOOLS.push(TOOL_CANCELAR_AGENDAMENTO);
  }
  TOOLS.push(toolEnviarArquivo(listaArquivos));
  const contexto = { instancia, numero, config };
  const system = systemPromptComHoje(config.prompt, vaiSerAudio, config.agendarClinicorp || config.agendarAgendaInterna);

  // thinking adaptive + effort medio: sem isso, o modelo as vezes gasta o max_tokens inteiro
  // "pensando" internamente (bloco thinking) e nao sobra nada pro texto de verdade da resposta
  // (stop_reason=max_tokens, zero texto) - mesmo bug encontrado no chat pessoal (cloudAgent.js),
  // aqui seria ainda pior: o contato do WhatsApp ficaria sem resposta nenhuma ("travado").
  const configClaude = { model: 'claude-sonnet-5', max_tokens: 4096, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' }, system, tools: TOOLS };
  let response = await anthropic.messages.create({ ...configClaude, messages: history });
  let rounds = 0;
  while (response.stop_reason === 'tool_use' && rounds < MAX_RODADAS_FERRAMENTA) {
    history.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of response.content.filter((b) => b.type === 'tool_use')) {
      const result = await runTool(block.name, block.input, contexto);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    history.push({ role: 'user', content: toolResults });
    response = await anthropic.messages.create({ ...configClaude, messages: history });
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
