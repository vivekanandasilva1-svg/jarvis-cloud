// Follow Up Inteligente (aba "Follow Up Inteligente"): cada "follow-up" e UM card que o dono cria
// escolhendo QUAIS etapas do funil do CRM ele atende, QUANTAS mensagens serao mandadas, em QUAIS
// DIAS (contados a partir de quando o lead entrou naquela etapa) e as instrucoes de como a IA deve
// escrever. Diferente do Follow Up antigo (followUp.js - so a coluna "follow_up", 5 tentativas
// fixas e a IA assume a conversa), aqui o lead continua na etapa dele e quem responde se ele
// escrever e o auto-atendimento normal; esse motor so manda as mensagens proativas programadas e
// PARA quando o lead responde (opcao do card, ligada por padrao).
//
// Tudo isolado por tenant. Nunca mexe com quem esta em "contatos_pessoais" (a IA nao atende),
// "follow_up" (motor proprio) nem com conversa pausada/oculta.
import { anthropic } from './anthropicClient.js';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

const MODEL = 'claude-sonnet-5';
const DIA_MS = 24 * 60 * 60 * 1000;
// intervalo minimo entre duas mensagens do mesmo card pro mesmo lead - evita rajada se o dono
// cadastrar dias muito colados ou se o card for criado numa etapa com lead parado ha muito tempo
const ESPACO_MINIMO_MS = 6 * 60 * 60 * 1000;
const MAX_MENSAGENS = 30;
const MAX_DURACAO_DIAS = 365;

// etapas que NAO podem receber follow-up inteligente (ver comentario do topo)
const ETAPAS_BLOQUEADAS = new Set(['contatos_pessoais', 'follow_up']);

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fui_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      prompt_geral TEXT,
      hora_inicio TEXT NOT NULL DEFAULT '08:00',
      hora_fim TEXT NOT NULL DEFAULT '20:00',
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fui_cards (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      etapas TEXT[] NOT NULL DEFAULT '{}',
      dias_envio INT[] NOT NULL DEFAULT '{}',
      duracao_dias INT NOT NULL DEFAULT 1,
      instrucoes TEXT,
      parar_se_responder BOOLEAN NOT NULL DEFAULT true,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS fui_cards_tenant_idx ON fui_cards (tenant_id);`);
  // 1 linha por (card, contato): quando o lead entrou na etapa, quantas mensagens ja foram e se
  // o ciclo acabou (concluido / lead respondeu / saiu da etapa e voltou = recomeca)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fui_execucoes (
      card_id INT NOT NULL REFERENCES fui_cards(id) ON DELETE CASCADE,
      contato_id INT NOT NULL REFERENCES crm_contatos(id) ON DELETE CASCADE,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      entrou_em TIMESTAMPTZ NOT NULL,
      enviados INT NOT NULL DEFAULT 0,
      ultima_em TIMESTAMPTZ,
      finalizado BOOLEAN NOT NULL DEFAULT false,
      motivo TEXT,
      PRIMARY KEY (card_id, contato_id)
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas do Follow Up Inteligente:', err.message);
});

// ---------- configuracao geral ----------

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CONFIG_VAZIA = { ativo: false, promptGeral: '', horaInicio: '08:00', horaFim: '20:00' };

export async function obterConfig(tenantId) {
  if (!pool) return CONFIG_VAZIA;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ativo, prompt_geral, hora_inicio, hora_fim FROM fui_config WHERE tenant_id = $1`, [tenantId]);
  if (!rows.length) return CONFIG_VAZIA;
  return { ativo: !!rows[0].ativo, promptGeral: rows[0].prompt_geral || '', horaInicio: rows[0].hora_inicio, horaFim: rows[0].hora_fim };
}

export async function salvarConfig(tenantId, { ativo, promptGeral, horaInicio, horaFim }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hi = horaInicio || '08:00';
  const hf = horaFim || '20:00';
  if (!HORA_RE.test(hi) || !HORA_RE.test(hf)) throw new Error('Horario invalido (use o formato HH:MM).');
  if (hi >= hf) throw new Error('O horario de inicio precisa ser antes do horario de fim.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO fui_config (tenant_id, ativo, prompt_geral, hora_inicio, hora_fim, atualizado_em) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id) DO UPDATE SET ativo = $2, prompt_geral = $3, hora_inicio = $4, hora_fim = $5, atualizado_em = now()`,
    [tenantId, !!ativo, String(promptGeral || '').slice(0, 4000), hi, hf],
  );
}

function dentroDoHorario(config) {
  const agora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
  return agora >= config.horaInicio && agora < config.horaFim;
}

// ---------- cards (cada um = um follow-up) ----------

export function etapasSelecionaveis() {
  return crm.ETAPAS.filter((e) => !ETAPAS_BLOQUEADAS.has(e.id));
}

export async function listarCards(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT c.id, c.etapas, c.dias_envio, c.duracao_dias, c.instrucoes, c.parar_se_responder, c.ativo,
            (SELECT count(*) FROM fui_execucoes x WHERE x.card_id = c.id AND NOT x.finalizado)::int AS em_andamento,
            (SELECT COALESCE(sum(x.enviados), 0) FROM fui_execucoes x WHERE x.card_id = c.id)::int AS enviadas
     FROM fui_cards c WHERE c.tenant_id = $1 ORDER BY c.id ASC`,
    [tenantId],
  );
  return rows.map((r) => ({
    id: r.id, etapas: r.etapas, diasEnvio: r.dias_envio, duracaoDias: r.duracao_dias, instrucoes: r.instrucoes || '',
    pararSeResponder: r.parar_se_responder, ativo: r.ativo, emAndamento: r.em_andamento, enviadas: r.enviadas,
  }));
}

// valida e normaliza o que veio do painel; lanca Error com mensagem em portugues se algo estiver errado
function validarCard({ etapas, diasEnvio, duracaoDias, instrucoes }) {
  const idsValidos = new Set(etapasSelecionaveis().map((e) => e.id));
  const etapasLimpas = [...new Set((Array.isArray(etapas) ? etapas : []).map(String))];
  if (!etapasLimpas.length) throw new Error('Escolha pelo menos uma etapa do funil.');
  const invalida = etapasLimpas.find((e) => !idsValidos.has(e));
  if (invalida) throw new Error(`A etapa "${invalida}" nao aceita follow-up inteligente.`);

  const dias = (Array.isArray(diasEnvio) ? diasEnvio : []).map(Number);
  if (!dias.length) throw new Error('Defina pelo menos 1 mensagem.');
  if (dias.length > MAX_MENSAGENS) throw new Error(`No maximo ${MAX_MENSAGENS} mensagens por follow-up.`);
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > MAX_DURACAO_DIAS)) throw new Error('Os dias de envio precisam ser numeros inteiros (0 a 365).');
  const diasOrdenados = [...dias].sort((a, b) => a - b);
  const duracao = Number(duracaoDias);
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > MAX_DURACAO_DIAS) throw new Error('A duracao precisa ser de 1 a 365 dias.');
  if (diasOrdenados[diasOrdenados.length - 1] > duracao) throw new Error('Tem mensagem marcada pra um dia depois do fim da duracao.');

  return { etapas: etapasLimpas, diasEnvio: diasOrdenados, duracaoDias: duracao, instrucoes: String(instrucoes || '').trim().slice(0, 4000) };
}

// uma etapa so pode estar em UM follow-up ativo - dois cards na mesma etapa mandariam mensagem
// duplicada pro mesmo lead
async function checarConflito(tenantId, idAtual, etapas, ativo) {
  if (!ativo) return;
  const { rows } = await pool.query(
    `SELECT id, etapas FROM fui_cards WHERE tenant_id = $1 AND ativo = true AND id <> $2 AND etapas && $3::text[]`,
    [tenantId, idAtual || 0, etapas],
  );
  if (!rows.length) return;
  const nomes = new Map(crm.ETAPAS.map((e) => [e.id, e.nome]));
  const repetidas = etapas.filter((e) => rows.some((r) => r.etapas.includes(e))).map((e) => nomes.get(e) || e);
  throw new Error(`A etapa ${repetidas.join(', ')} ja esta em outro follow-up ativo. Tire do outro (ou desative ele) primeiro.`);
}

export async function salvarCard(tenantId, dados) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const v = validarCard(dados);
  const ativo = dados.ativo !== false;
  const pararSeResponder = dados.pararSeResponder !== false;
  await checarConflito(tenantId, dados.id, v.etapas, ativo);

  if (dados.id) {
    const { rows } = await pool.query(
      `UPDATE fui_cards SET etapas = $1, dias_envio = $2, duracao_dias = $3, instrucoes = $4, parar_se_responder = $5, ativo = $6, atualizado_em = now()
       WHERE id = $7 AND tenant_id = $8 RETURNING id`,
      [v.etapas, v.diasEnvio, v.duracaoDias, v.instrucoes, pararSeResponder, ativo, Number(dados.id), tenantId],
    );
    if (!rows[0]) throw new Error('Follow-up nao encontrado.');
    return rows[0].id;
  }
  const { rows } = await pool.query(
    `INSERT INTO fui_cards (tenant_id, etapas, dias_envio, duracao_dias, instrucoes, parar_se_responder, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [tenantId, v.etapas, v.diasEnvio, v.duracaoDias, v.instrucoes, pararSeResponder, ativo],
  );
  return rows[0].id;
}

export async function apagarCard(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(`DELETE FROM fui_cards WHERE id = $1 AND tenant_id = $2`, [Number(id), tenantId]);
}

// "Gerar sugestao": a IA escreve as instrucoes do follow-up conforme as etapas e a cadencia escolhidas
export async function gerarSugestao(tenantId, { etapas, diasEnvio, duracaoDias }) {
  const nomes = new Map(crm.ETAPAS.map((e) => [e.id, e.nome]));
  const etapasTxt = (Array.isArray(etapas) ? etapas : []).map((e) => nomes.get(e) || e).join(', ') || 'nao informada';
  const dias = (Array.isArray(diasEnvio) ? diasEnvio : []).map(Number).filter(Number.isFinite);
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 700,
    messages: [{
      role: 'user',
      content: `Escreva as INSTRUCOES que um assistente de WhatsApp vai seguir pra mandar mensagens automaticas de follow-up (acompanhamento) pra leads de uma clinica/negocio. ` +
        `Etapa(s) do funil: ${etapasTxt}. Serao ${dias.length || 'algumas'} mensagem(ns) ao longo de ${duracaoDias || 'alguns'} dia(s) (dias de envio contados da entrada do lead na etapa: ${dias.join(', ') || 'a definir'}). ` +
        `Regras: texto direto em portugues, em topicos curtos, SEM markdown pesado; diga o objetivo de cada mensagem (ex: 1a lembrar, ultima encerrar com leveza), tom cordial e nada insistente, mensagens de 1 a 3 frases, no maximo 1 emoji leve, nunca inventar preco/horario/promocao, e que o envio deve parar se o lead responder. Entregue so as instrucoes, sem introducao.`,
    }],
    _uso: { tenantId, modulo: 'follow-up-inteligente' },
  });
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// ---------- geracao da mensagem ----------

const TOOL_MENSAGEM = {
  name: 'entregar_mensagem',
  description: 'Entrega o texto da mensagem de follow-up a ser enviada agora pro lead.',
  input_schema: {
    type: 'object',
    properties: { mensagem: { type: 'string', description: 'Texto pronto pra mandar por WhatsApp - direto, sem markdown/asterisco' } },
    required: ['mensagem'],
  },
};

function formatarConversa(msgs) {
  if (!msgs.length) return '(sem mensagens anteriores)';
  return msgs.map((m) => `[${m.direcao === 'entrada' ? 'Lead' : 'Nos'}${m.autor === 'followup' ? ' - follow-up automatico' : ''}] ${m.texto || `(${m.tipo})`}`).join('\n');
}

async function gerarMensagem({ tenantId, config, card, contato, numeroMensagem, totalMensagens, dia, nomeEtapa }) {
  const conversa = await crm.ultimasMensagens(tenantId, contato.numero, contato.instancia, 14);
  const texto = `${config.promptGeral ? `${config.promptGeral}\n\n` : ''}` +
    `Voce esta mandando uma mensagem automatica de FOLLOW-UP por WhatsApp. Etapa do lead no funil: ${nomeEtapa}. ` +
    `Esta e a mensagem ${numeroMensagem} de ${totalMensagens} desse follow-up (enviada no dia ${dia} depois que o lead entrou na etapa).` +
    (card.instrucoes ? `\n\nInstrucoes desse follow-up:\n${card.instrucoes}` : '') +
    `\n\nNome do lead (se souber): ${contato.nome || 'nao informado'}` +
    `\n\nUltimas mensagens da conversa:\n${formatarConversa(conversa)}` +
    `\n\nRegras fixas: 1 mensagem curta e natural (1 a 3 frases), pronta pra envio, so o texto final; nao repita o que ja foi mandado antes; sem markdown/asterisco; no maximo 1 emoji leve; nunca invente preco, horario ou promocao.`;

  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 500,
    tools: [TOOL_MENSAGEM], tool_choice: { type: 'tool', name: 'entregar_mensagem' },
    messages: [{ role: 'user', content: texto }],
    _uso: { tenantId, modulo: 'follow-up-inteligente' },
  });
  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  const mensagem = String(toolUse?.input?.mensagem || '').trim();
  if (!mensagem) throw new Error('a IA nao conseguiu gerar a mensagem de follow-up');
  return mensagem;
}

// ---------- agendador ----------

export async function processarCard(tenantId, card, config) {
  const nomes = new Map(crm.ETAPAS.map((e) => [e.id, e.nome]));
  const { rows: contatos } = await pool.query(
    `SELECT c.id, c.numero, c.instancia, c.nome, c.etapa, c.criado_em, c.ultima_entrada_em,
            (SELECT max(e.em) FROM crm_etapa_eventos e WHERE e.contato_id = c.id AND e.etapa = c.etapa) AS etapa_em,
            x.entrou_em AS x_entrou_em, x.enviados, x.ultima_em, x.finalizado
     FROM crm_contatos c
     LEFT JOIN fui_execucoes x ON x.card_id = $3 AND x.contato_id = c.id
     WHERE c.tenant_id = $1 AND c.oculto = false AND c.auto_pausado = false AND c.etapa = ANY($2::text[])
       AND c.ultima_mensagem_em IS NOT NULL AND c.instancia NOT LIKE 'ig:%'`,
    [tenantId, card.etapas, card.id],
  );

  for (const c of contatos) {
    try {
      // quando o lead entrou NESSA etapa: o evento mais recente de mudanca de etapa, ou o
      // nascimento do card se nunca houve evento; nunca antes de o follow-up existir (senao um
      // follow-up recem-criado dispararia tudo de uma vez pra quem esta parado ha meses)
      const entradaReal = new Date(c.etapa_em || c.criado_em);
      const baseline = new Date(card.atualizado_em);
      const entrada = entradaReal > baseline ? entradaReal : baseline;

      let estado = c.x_entrou_em ? { entrou: new Date(c.x_entrou_em), enviados: c.enviados, ultima: c.ultima_em ? new Date(c.ultima_em) : null, finalizado: c.finalizado } : null;
      // saiu da etapa e voltou (evento de etapa mais novo que o ciclo) = recomeca
      if (estado && c.etapa_em && new Date(c.etapa_em).getTime() > estado.entrou.getTime() + 5000) estado = null;
      if (!estado) {
        await pool.query(
          `INSERT INTO fui_execucoes (card_id, contato_id, tenant_id, entrou_em, enviados, ultima_em, finalizado, motivo)
           VALUES ($1, $2, $3, $4, 0, NULL, false, NULL)
           ON CONFLICT (card_id, contato_id) DO UPDATE SET entrou_em = $4, enviados = 0, ultima_em = NULL, finalizado = false, motivo = NULL`,
          [card.id, c.id, tenantId, entrada],
        );
        estado = { entrou: entrada, enviados: 0, ultima: null, finalizado: false };
      }
      if (estado.finalizado) continue;

      const finalizar = (motivo) => pool.query(`UPDATE fui_execucoes SET finalizado = true, motivo = $3 WHERE card_id = $1 AND contato_id = $2`, [card.id, c.id, motivo]);

      if (card.parar_se_responder && c.ultima_entrada_em && new Date(c.ultima_entrada_em) > estado.entrou) { await finalizar('respondeu'); continue; }
      if (estado.enviados >= card.dias_envio.length) { await finalizar('concluido'); continue; }

      const dia = card.dias_envio[estado.enviados];
      if (Date.now() - estado.entrou.getTime() < dia * DIA_MS) continue; // ainda nao e o dia
      if (estado.ultima && Date.now() - estado.ultima.getTime() < ESPACO_MINIMO_MS) continue;
      if (!dentroDoHorario(config)) return; // fora do expediente: tenta de novo na proxima rodada

      const mensagem = await gerarMensagem({
        tenantId, config, card, contato: c, numeroMensagem: estado.enviados + 1, totalMensagens: card.dias_envio.length, dia, nomeEtapa: nomes.get(c.etapa) || c.etapa,
      });
      const resposta = await evolutionApi.enviarMensagemTextoPor(c.instancia, c.numero, mensagem);
      await crm.registrarMensagem(tenantId, {
        numero: c.numero, instancia: c.instancia, direcao: 'saida', tipo: 'text', texto: mensagem,
        autor: 'followup', waId: resposta?.key?.id || null, manterEtapa: true,
      });
      await pool.query(`UPDATE fui_execucoes SET enviados = enviados + 1, ultima_em = now() WHERE card_id = $1 AND contato_id = $2`, [card.id, c.id]);
      if (estado.enviados + 1 >= card.dias_envio.length) await finalizar('concluido');
    } catch (err) {
      console.error(`Erro no follow-up inteligente (card ${card.id}, contato ${c.id}, tenant ${tenantId}):`, err.message);
    }
    await new Promise((r) => setTimeout(r, 3000)); // pausa curta entre leads, evita rajada
  }
}

// roda a cada 10min, pra cada tenant com o Follow Up Inteligente ligado. So chamado no boot do server.js.
export function iniciarSchedulerFollowUpInteligente() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const { rows: tenantsAtivos } = await pool.query(`SELECT f.tenant_id FROM fui_config f JOIN tenants t ON t.id = f.tenant_id WHERE f.ativo = true AND (t.ativo OR t.super_admin)`);
      for (const { tenant_id: tenantId } of tenantsAtivos) {
        try {
          const config = await obterConfig(tenantId);
          if (!config.ativo || !dentroDoHorario(config)) continue;
          const { rows: cards } = await pool.query(
            `SELECT id, etapas, dias_envio, instrucoes, parar_se_responder, atualizado_em FROM fui_cards WHERE tenant_id = $1 AND ativo = true`,
            [tenantId],
          );
          for (const card of cards) await processarCard(tenantId, card, config);
        } catch (err) {
          console.error(`Erro no follow-up inteligente do tenant ${tenantId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando follow-up inteligente:', err.message);
    }
  };
  setInterval(checar, 10 * 60 * 1000).unref();
}
