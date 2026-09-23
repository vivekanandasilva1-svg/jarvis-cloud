// Follow Up (aba "Follow Up" do app): motor de reengajamento automatico pra leads que pararam
// de responder. Funciona junto com o CRM (crm.js) - quando um card e arrastado pra coluna
// "follow_up", esse motor assume 100% da conversa daquele contato (autoAtendimento.js NAO
// responde mais ele - ver checagem em server.js) e passa a mandar mensagens PROATIVAS numa
// cadencia configuravel (ex: 1, 3, 7, 15, 30 dias depois de entrar na coluna), cada tentativa
// com seu proprio script/anexos. Se o lead responder demonstrando interesse de verdade (a IA
// decide isso), o card volta sozinho pra "em_atendimento" pra atendente humana continuar. Se
// nenhuma tentativa gerar resposta, o card vai pra "perdido" depois da ultima tentativa + uma
// folga de dias.
//
// Diferente do autoAtendimento.js (que tem ferramentas de agenda/Clinicorp e um loop de
// tool_use), o Follow Up e mais simples de proposito: cada geracao de mensagem e UMA chamada
// forcada (tool_choice) que devolve so o texto (ou texto + decisao de interesse) - ele nao marca
// agendamento sozinho, so tenta reabrir a conversa; quando consegue, quem retoma o atendimento
// de verdade (inclusive marcar horario) e o humano ou o auto-atendimento normal, dali em diante.
import Anthropic from '@anthropic-ai/sdk';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5';

// quantos dias depois da ULTIMA tentativa configurada (ex: apos os 30 dias) o lead continua sem
// responder ate desistir de vez e mover pra "perdido" - nao e configuravel pelo painel de
// proposito (evita deixar lead parado pra sempre num card "follow_up" que ninguem olha mais)
const DIAS_FOLGA_ANTES_DE_DESISTIR = 3;

const ETAPAS_PADRAO = [
  { ordem: 1, dias: 1 },
  { ordem: 2, dias: 3 },
  { ordem: 3, dias: 7 },
  { ordem: 4, dias: 15 },
  { ordem: 5, dias: 30 },
];
const ORDENS_VALIDAS = new Set(ETAPAS_PADRAO.map((e) => e.ordem));

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      prompt_geral TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // horario de funcionamento (fuso America/Maceio) - fora dessa janela o agente nao manda
  // tentativa proativa NEM responde o lead que escrever, pra nunca incomodar o paciente de
  // madrugada ou fora do expediente. "HH:MM" em texto simples (mesmo formato do <input
  // type="time">, sem precisar converter nada no front).
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS hora_inicio TEXT NOT NULL DEFAULT '08:00';`);
  await pool.query(`ALTER TABLE follow_up_config ADD COLUMN IF NOT EXISTS hora_fim TEXT NOT NULL DEFAULT '20:00';`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_etapas (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      ordem INT NOT NULL,
      dias INT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      prompt TEXT,
      PRIMARY KEY (tenant_id, ordem)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      ordem INT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // 1 linha por contato do CRM que ja passou (ou esta) pela coluna Follow Up - guarda quando
  // entrou, qual foi a ultima tentativa mandada e o historico proprio dessa conversa de
  // reengajamento (separado do historico do auto-atendimento normal, de proposito: sao
  // "personas"/momentos diferentes). "finalizado" true = parou de ser processado pelo agendador
  // (lead retomou contato OU foi movido pra perdido) - contato_id e unico, entao um mesmo card
  // reaproveita a mesma linha se voltar pra Follow Up de novo mais tarde (reseta entrou_em).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follow_up_contatos (
      contato_id INT PRIMARY KEY REFERENCES crm_contatos(id) ON DELETE CASCADE,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultima_etapa_enviada INT NOT NULL DEFAULT 0,
      ultima_etapa_enviada_em TIMESTAMPTZ,
      historico JSONB NOT NULL DEFAULT '[]'::jsonb,
      finalizado BOOLEAN NOT NULL DEFAULT false
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS follow_up_contatos_tenant_idx ON follow_up_contatos (tenant_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS follow_up_arquivos_tenant_ordem_idx ON follow_up_arquivos (tenant_id, ordem);`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Follow Up:', err.message);
});

// ---------- configuracao geral ----------

const HORA_PADRAO_INICIO = '08:00';
const HORA_PADRAO_FIM = '20:00';
const CONFIG_VAZIA = { ativo: false, promptGeral: '', horaInicio: HORA_PADRAO_INICIO, horaFim: HORA_PADRAO_FIM };

export async function obterConfig(tenantId) {
  if (!pool) return CONFIG_VAZIA;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ativo, prompt_geral, hora_inicio, hora_fim FROM follow_up_config WHERE tenant_id = $1`, [tenantId]);
  if (!rows.length) return CONFIG_VAZIA;
  return {
    ativo: !!rows[0].ativo,
    promptGeral: rows[0].prompt_geral || '',
    horaInicio: rows[0].hora_inicio || HORA_PADRAO_INICIO,
    horaFim: rows[0].hora_fim || HORA_PADRAO_FIM,
  };
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function salvarConfig(tenantId, { ativo, promptGeral, horaInicio, horaFim }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hi = horaInicio || HORA_PADRAO_INICIO;
  const hf = horaFim || HORA_PADRAO_FIM;
  if (!HORA_RE.test(hi) || !HORA_RE.test(hf)) throw new Error('Horario invalido (use o formato HH:MM).');
  if (hi >= hf) throw new Error('O horario de inicio precisa ser antes do horario de fim.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_config (tenant_id, ativo, prompt_geral, hora_inicio, hora_fim, atualizado_em) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id) DO UPDATE SET ativo = $2, prompt_geral = $3, hora_inicio = $4, hora_fim = $5, atualizado_em = now()`,
    [tenantId, !!ativo, promptGeral || '', hi, hf],
  );
}

// fuso fixo America/Maceio (mesmo padrao usado no resto do app - relatoriosProgramados.js,
// autoAtendimento.js) - true quando o horario ATUAL esta dentro do expediente configurado
function dentroDoHorarioFuncionamento(config) {
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
  return horaAtual >= (config.horaInicio || HORA_PADRAO_INICIO) && horaAtual < (config.horaFim || HORA_PADRAO_FIM);
}

// ---------- etapas (as "tentativas" configuraveis: a cada quantos dias, com que script) ----------

// sempre devolve as 5 tentativas, mesmo que o tenant nunca tenha salvo nada ainda (usa os
// padroes: 1, 3, 7, 15, 30 dias) - assim o painel sempre tem o que mostrar de cara
export async function listarEtapas(tenantId) {
  if (!pool) return ETAPAS_PADRAO.map((e) => ({ ...e, ativo: true, prompt: '' }));
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ordem, dias, ativo, prompt FROM follow_up_etapas WHERE tenant_id = $1`, [tenantId]);
  const porOrdem = new Map(rows.map((r) => [r.ordem, r]));
  return ETAPAS_PADRAO.map((padrao) => {
    const salvo = porOrdem.get(padrao.ordem);
    return salvo
      ? { ordem: padrao.ordem, dias: salvo.dias, ativo: salvo.ativo, prompt: salvo.prompt || '' }
      : { ordem: padrao.ordem, dias: padrao.dias, ativo: true, prompt: '' };
  });
}

export async function salvarEtapa(tenantId, ordem, { dias, ativo, prompt }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const ordemNum = Number(ordem);
  if (!ORDENS_VALIDAS.has(ordemNum)) throw new Error(`Etapa invalida: "${ordem}"`);
  const diasNum = Number(dias);
  if (!Number.isFinite(diasNum) || diasNum <= 0) throw new Error('Numero de dias precisa ser maior que zero.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_etapas (tenant_id, ordem, dias, ativo, prompt) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, ordem) DO UPDATE SET dias = $3, ativo = $4, prompt = $5`,
    [tenantId, ordemNum, diasNum, !!ativo, prompt || ''],
  );
}

// ---------- arquivos por etapa (imagem/pdf/video mandados junto da mensagem daquela tentativa) ----------

export async function listarArquivos(tenantId, ordem) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome_arquivo, media_type, octet_length(conteudo) AS tamanho, criado_em
     FROM follow_up_arquivos WHERE tenant_id = $1 AND ordem = $2 ORDER BY criado_em DESC`,
    [tenantId, Number(ordem)],
  );
  return rows;
}

export async function salvarArquivo(tenantId, ordem, nomeArquivo, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const ordemNum = Number(ordem);
  if (!ORDENS_VALIDAS.has(ordemNum)) throw new Error(`Etapa invalida: "${ordem}"`);
  await tabelasProntas;
  const { rows } = await pool.query(
    `INSERT INTO follow_up_arquivos (tenant_id, ordem, nome_arquivo, media_type, conteudo) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, ordemNum, nomeArquivo, mediaType, buffer],
  );
  return rows[0].id;
}

export async function apagarArquivo(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await pool.query(`DELETE FROM follow_up_arquivos WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

async function obterArquivosComConteudo(tenantId, ordem) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT nome_arquivo, media_type, conteudo FROM follow_up_arquivos WHERE tenant_id = $1 AND ordem = $2`,
    [tenantId, ordem],
  );
  return rows;
}

async function enviarArquivoParaContato(instancia, numero, arquivo) {
  const base64 = arquivo.conteudo.toString('base64');
  if (arquivo.media_type.startsWith('audio/')) {
    await evolutionApi.enviarAudio(instancia, numero, base64);
    return;
  }
  const mediatype = arquivo.media_type.startsWith('image/') ? 'image' : arquivo.media_type.startsWith('video/') ? 'video' : 'document';
  await evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arquivo.media_type, media: base64, fileName: arquivo.nome_arquivo });
}

// ---------- ciclo de vida do acompanhamento por contato (chamado pela rota de mudar etapa) ----------

// chamado quando um card e arrastado PRA "follow_up" - idempotente: se o contato ja tiver um
// registro antigo (follow up anterior, ja finalizado), reseta pra comecar as tentativas do zero
export async function iniciarAcompanhamento(tenantId, contatoId) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(
    `INSERT INTO follow_up_contatos (contato_id, tenant_id, entrou_em, ultima_etapa_enviada, ultima_etapa_enviada_em, historico, finalizado)
     VALUES ($1, $2, now(), 0, NULL, '[]'::jsonb, false)
     ON CONFLICT (contato_id) DO UPDATE SET
       entrou_em = now(), ultima_etapa_enviada = 0, ultima_etapa_enviada_em = NULL, historico = '[]'::jsonb, finalizado = false`,
    [contatoId, tenantId],
  );
}

// chamado quando um card SAI da coluna "follow_up" (pra qualquer outra) - para o agendador de
// mandar mais tentativas pra esse contato. No-op silencioso se nunca teve registro.
export async function encerrarAcompanhamento(tenantId, contatoId) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE follow_up_contatos SET finalizado = true WHERE contato_id = $1 AND tenant_id = $2`, [contatoId, tenantId]);
}

// ---------- geracao de mensagem (IA) ----------

const TOOL_GERAR_MENSAGEM = {
  name: 'entregar_mensagem_followup',
  description: 'Entrega o texto da mensagem de reengajamento a ser enviada agora pro contato.',
  input_schema: {
    type: 'object',
    properties: { mensagem: { type: 'string', description: 'Texto pronto pra mandar por WhatsApp - direto, sem markdown/asterisco' } },
    required: ['mensagem'],
  },
};

const TOOL_RESPONDER_E_ANALISAR = {
  name: 'responder_e_analisar',
  description: 'Entrega a resposta pro contato e a analise se ele demonstrou interesse real em retomar o assunto.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: { type: 'string', description: 'Texto de resposta pro contato - direto, sem markdown/asterisco' },
      demonstrouInteresse: {
        type: 'boolean',
        description: 'true se o contato demonstrou interesse REAL em retomar (quer agendar, tira duvida de verdade sobre o servico, pede pra continuar a conversa) - false se for recusa, desinteresse claro, ou resposta que nao indica intencao de prosseguir (ex: "quem e voce", engano, silencio depois disso).',
      },
    },
    required: ['resposta', 'demonstrouInteresse'],
  },
};

function formatarHistorico(historico) {
  if (!historico?.length) return '(nenhuma mensagem trocada ainda nesse acompanhamento)';
  return historico.slice(-8).map((h) => `[${h.autor === 'lumia' ? 'Voce (Lumia)' : 'Contato'}] ${h.texto}`).join('\n');
}

async function gerarMensagemEtapa({ config, etapa, contato, historico }) {
  const texto = `${config.promptGeral}\n\n` +
    `Voce esta tentando reengajar um contato que parou de responder ha ${etapa.dias} dia(s) - essa e a tentativa numero ${etapa.ordem} de reengajamento.` +
    (etapa.prompt ? `\n\nInstrucoes especificas pra essa tentativa: ${etapa.prompt}` : '') +
    `\n\nNome do contato (se souber): ${contato.nome || 'nao informado'}` +
    `\n\nHistorico do acompanhamento ate agora:\n${formatarHistorico(historico)}` +
    `\n\nEscreva agora a mensagem a ser enviada pra tentar retomar o contato.`;

  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    tools: [TOOL_GERAR_MENSAGEM], tool_choice: { type: 'tool', name: 'entregar_mensagem_followup' },
    messages: [{ role: 'user', content: texto }],
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('a IA nao conseguiu gerar a mensagem de follow up');
  return toolUse.input.mensagem;
}

// ---------- resposta reativa (o lead respondeu enquanto esta na coluna Follow Up) ----------

// chamado pelo webhook do WhatsApp (server.js) quando a mensagem chega de um contato cujo card
// esta na coluna "follow_up" - substitui completamente o autoAtendimento.processarMensagem
// nesse caso (ver checagem em server.js). Devolve null se o Follow Up nao estiver ativo/
// configurado (o webhook entao simplesmente nao responde nada).
export async function processarMensagem(tenantId, contatoId, numero, instancia, { texto, tipo }) {
  const config = await obterConfig(tenantId);
  if (!config.ativo || !config.promptGeral) return null;
  await tabelasProntas;

  await iniciarAcompanhamento(tenantId, contatoId); // idempotente - garante que ha registro mesmo se o lead respondeu antes de qualquer tentativa automatica

  const { rows } = await pool.query(`SELECT * FROM follow_up_contatos WHERE contato_id = $1 AND tenant_id = $2`, [contatoId, tenantId]);
  const registro = rows[0];
  const historico = registro?.historico || [];

  let textoContato = texto || '';
  if (!textoContato.trim()) {
    textoContato = tipo === 'image' ? '[o contato mandou uma imagem sem legenda]'
      : tipo === 'audio' ? '[o contato mandou um audio]'
      : tipo === 'video' ? '[o contato mandou um video]'
      : '';
  }
  if (!textoContato.trim()) return null;

  // fora do horario de funcionamento configurado - guarda a mensagem no historico (o contexto
  // nao se perde) mas NAO gera nem manda resposta agora, pra nao incomodar o paciente de
  // madrugada ou fora do expediente. Quando ele escrever de novo dentro do horario, o agente ve
  // essa mensagem no historico e retoma normalmente.
  if (!dentroDoHorarioFuncionamento(config)) {
    const historicoComEspera = [...historico, { autor: 'contato', texto: textoContato, quando: new Date().toISOString() }];
    await pool.query(`UPDATE follow_up_contatos SET historico = $1 WHERE contato_id = $2 AND tenant_id = $3`, [JSON.stringify(historicoComEspera), contatoId, tenantId]);
    return null;
  }

  const etapas = await listarEtapas(tenantId);
  const etapaAtual = etapas.find((e) => e.ordem === (registro?.ultima_etapa_enviada || 0));

  const prompt = `${config.promptGeral}\n\n` +
    `Voce esta acompanhando um lead que estava sem responder, dentro de um fluxo de reengajamento.` +
    (etapaAtual?.prompt ? `\n\nInstrucoes da tentativa atual: ${etapaAtual.prompt}` : '') +
    `\n\nHistorico do acompanhamento ate agora:\n${formatarHistorico(historico)}` +
    `\n\nO contato acabou de responder: "${textoContato}"` +
    `\n\nEscreva uma resposta natural pra essa mensagem e decida se ele demonstrou interesse real em retomar o assunto.`;

  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 600,
    tools: [TOOL_RESPONDER_E_ANALISAR], tool_choice: { type: 'tool', name: 'responder_e_analisar' },
    messages: [{ role: 'user', content: prompt }],
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse) return null;
  const { resposta, demonstrouInteresse } = toolUse.input;

  const novoHistorico = [
    ...historico,
    { autor: 'contato', texto: textoContato, quando: new Date().toISOString() },
    { autor: 'lumia', texto: resposta, quando: new Date().toISOString() },
  ];
  await pool.query(`UPDATE follow_up_contatos SET historico = $1 WHERE contato_id = $2 AND tenant_id = $3`, [JSON.stringify(novoHistorico), contatoId, tenantId]);

  if (demonstrouInteresse) {
    await crm.moverEtapa(tenantId, contatoId, 'em_atendimento');
    await encerrarAcompanhamento(tenantId, contatoId);
  }

  return { texto: resposta };
}

// ---------- agendador (envio proativo das tentativas, na cadencia configurada) ----------

async function processarContato(tenantId, contato, etapas, config) {
  // fora do horario de funcionamento - nao manda tentativa nenhuma agora; o proprio agendador
  // (roda a cada 15min) pega essa tentativa vencida assim que o horario configurado abrir
  if (!dentroDoHorarioFuncionamento(config)) return;

  const diasDesdeEntrada = (Date.now() - new Date(contato.entrou_em).getTime()) / (24 * 60 * 60 * 1000);
  const ultimaOrdem = contato.ultima_etapa_enviada || 0;

  const proxima = etapas.find((e) => e.ordem > ultimaOrdem && e.ativo && diasDesdeEntrada >= e.dias);
  if (proxima) {
    const historico = contato.historico || [];
    const mensagem = await gerarMensagemEtapa({ config, etapa: proxima, contato, historico });
    await evolutionApi.enviarMensagemTextoPor(contato.instancia, contato.numero, mensagem);
    await crm.registrarMensagem(tenantId, { numero: contato.numero, instancia: contato.instancia, direcao: 'saida', tipo: 'text', texto: mensagem });

    const anexos = await obterArquivosComConteudo(tenantId, proxima.ordem);
    for (const anexo of anexos) {
      try {
        await enviarArquivoParaContato(contato.instancia, contato.numero, anexo);
      } catch (err) {
        console.error(`Erro mandando anexo da etapa ${proxima.ordem} do follow up:`, err.message);
      }
    }

    const novoHistorico = [...historico, { autor: 'lumia', etapa: proxima.ordem, texto: mensagem, quando: new Date().toISOString() }];
    await pool.query(
      `UPDATE follow_up_contatos SET ultima_etapa_enviada = $1, ultima_etapa_enviada_em = now(), historico = $2 WHERE contato_id = $3 AND tenant_id = $4`,
      [proxima.ordem, JSON.stringify(novoHistorico), contato.contato_id, tenantId],
    );
    return;
  }

  // ja mandou a ultima tentativa ativa configurada? da uma folga e desiste (move pra "perdido")
  const ultimaAtiva = [...etapas].reverse().find((e) => e.ativo);
  if (ultimaAtiva && ultimaOrdem >= ultimaAtiva.ordem && contato.ultima_etapa_enviada_em) {
    const diasDesdeUltimoEnvio = (Date.now() - new Date(contato.ultima_etapa_enviada_em).getTime()) / (24 * 60 * 60 * 1000);
    if (diasDesdeUltimoEnvio >= DIAS_FOLGA_ANTES_DE_DESISTIR) {
      await crm.moverEtapa(tenantId, contato.contato_id, 'perdido');
      await encerrarAcompanhamento(tenantId, contato.contato_id);
    }
  }
}

// roda em segundo plano - a cada 15min, PRA CADA TENANT com Follow Up ativado, checa cada
// contato ainda na coluna "follow_up" e manda a proxima tentativa vencida (se houver). So
// chamado uma vez, no boot do server.js.
export function iniciarSchedulerFollowUp() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;

      const { rows: tenantsAtivos } = await pool.query(`SELECT tenant_id FROM follow_up_config WHERE ativo = true`);
      if (!tenantsAtivos.length) return;

      for (const { tenant_id: tenantId } of tenantsAtivos) {
        try {
          const config = await obterConfig(tenantId);
          if (!config.ativo || !config.promptGeral) continue;
          const etapas = await listarEtapas(tenantId);

          const { rows: contatos } = await pool.query(
            `SELECT fc.contato_id, fc.entrou_em, fc.ultima_etapa_enviada, fc.ultima_etapa_enviada_em, fc.historico,
                    c.numero, c.instancia, c.nome
             FROM follow_up_contatos fc
             JOIN crm_contatos c ON c.id = fc.contato_id
             WHERE fc.tenant_id = $1 AND fc.finalizado = false AND c.etapa = 'follow_up'`,
            [tenantId],
          );

          for (const contato of contatos) {
            try {
              await processarContato(tenantId, contato, etapas, config);
            } catch (err) {
              console.error(`Erro no follow up do contato ${contato.contato_id} (tenant ${tenantId}):`, err.message);
            }
            await new Promise((r) => setTimeout(r, 3000)); // pausa curta entre contatos, evita rajada de chamadas
          }
        } catch (err) {
          console.error(`Erro no follow up do tenant ${tenantId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando follow up:', err.message);
    }
  };
  setInterval(checar, 15 * 60 * 1000).unref();
}
