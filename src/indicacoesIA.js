// IA EXCLUSIVA da aba Indicacoes: responde, no numero escolhido como responsavel pelas Indicacoes, as pessoas que
// escrevem (indicados e quem indica). Totalmente separada do Auto Atendimento: prompt proprio, arquivos proprios
// (imagem, audio, PDF, video curto), memoria propria, e pausa propria (geral e por indicado).
// Nunca responde sozinha se: estiver pausada, o numero nao for o responsavel pelas Indicacoes, o indicado estiver com
// a IA pausada ou a conversa estiver pausada no CRM. So texto por enquanto (audio/imagem recebidos nao sao respondidos).
import { pool } from './db.js';
import { anthropic } from './anthropicClient.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import * as indicacoes from './indicacoes.js';

const MODEL = 'claude-sonnet-5-5';
const MAX_RODADAS = 4;
const MAX_HISTORICO = 24;
const MAX_ARQUIVO_BYTES = 12 * 1024 * 1024;
const TIPOS_OK = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/(mp4|3gpp|quicktime|webm)|application\/pdf)$/;

export const PROMPT_PADRAO = `Você é a assistente de relacionamento da clínica, no WhatsApp da equipe de Indicações. Você conversa com pessoas que foram indicadas por pacientes da clínica (e com os próprios pacientes que indicam).
Objetivo: ser simpática, explicar de forma curta que a clínica foi recomendada por um paciente, entender se a pessoa tem interesse e convidá-la para uma avaliação.
Regras: mensagens curtas, uma ideia por vez, sem inventar preços, horários ou promoções que não estejam aqui. Se a pessoa quiser agendar, peça o melhor dia e período e registre com a ferramenta. Se pedir para falar com uma pessoa, diga que a equipe vai retornar. Se disser que não tem interesse, agradeça com educação e registre.`;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_ia_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      prompt TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_ia_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      descricao TEXT,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_ia_sessoes (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, numero)
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('[indicacoesIA] erro criando tabelas:', err.message));

export async function obterConfig(tenantId) {
  if (!pool) return { ativo: false, prompt: '' };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT ativo, prompt FROM ind_ia_config WHERE tenant_id = $1', [tenantId]);
  return rows[0] ? { ativo: rows[0].ativo, prompt: rows[0].prompt || '' } : { ativo: false, prompt: '' };
}
export async function salvarConfig(tenantId, { ativo, prompt }) {
  await tabelasProntas;
  const p = String(prompt ?? '').slice(0, 12000);
  if (ativo && !p.trim()) throw new Error('Escreva o prompt da IA antes de ligar.');
  await pool.query(
    `INSERT INTO ind_ia_config (tenant_id, ativo, prompt) VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET ativo = $2, prompt = $3, atualizado_em = now()`,
    [tenantId, !!ativo, p],
  );
}
export async function definirAtivo(tenantId, ativo) {
  const c = await obterConfig(tenantId);
  if (ativo && !c.prompt.trim()) throw new Error('Escreva e salve o prompt da IA antes de ligar.');
  await salvarConfig(tenantId, { ativo, prompt: c.prompt });
}

export async function listarArquivos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, nome_arquivo, media_type, descricao, length(conteudo) AS tamanho, criado_em FROM ind_ia_arquivos WHERE tenant_id = $1 ORDER BY id', [tenantId]);
  return rows;
}
export async function salvarArquivo(tenantId, { nomeArquivo, mediaType, descricao, buffer }) {
  await tabelasProntas;
  const nome = String(nomeArquivo || '').trim().slice(0, 120);
  if (!nome) throw new Error('Arquivo sem nome.');
  if (!TIPOS_OK.test(String(mediaType || ''))) throw new Error('Tipo de arquivo não aceito. Use imagem, áudio, PDF ou vídeo curto (MP4).');
  if (!buffer?.length) throw new Error('Arquivo vazio.');
  if (buffer.length > MAX_ARQUIVO_BYTES) throw new Error('Arquivo muito grande (máximo 12 MB). Para vídeo, use um trecho curto.');
  const { rows: [qtd] } = await pool.query('SELECT count(*)::int AS n FROM ind_ia_arquivos WHERE tenant_id = $1', [tenantId]);
  if (qtd.n >= 20) throw new Error('Limite de 20 arquivos. Apague algum antes de enviar outro.');
  const { rows: [r] } = await pool.query(
    'INSERT INTO ind_ia_arquivos (tenant_id, nome_arquivo, media_type, descricao, conteudo) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [tenantId, nome, mediaType, String(descricao || '').trim().slice(0, 200) || null, buffer],
  );
  return r.id;
}
export async function apagarArquivo(tenantId, id) {
  await tabelasProntas;
  await pool.query('DELETE FROM ind_ia_arquivos WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

export async function pausarIndicado(tenantId, id, pausada) {
  await tabelasProntas;
  const { rowCount } = await pool.query('UPDATE ind_indicados SET ia_pausada = $3 WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, !!pausada]);
  if (!rowCount) throw new Error('Indicado não encontrado.');
}

// ---- o webhook pergunta: esse numero e o responsavel pelas Indicacoes? ----
const _cacheNumero = new Map();
export async function ehNumeroDasIndicacoes(tenantId, instancia) {
  if (!pool || !instancia) return false;
  const c = _cacheNumero.get(tenantId);
  if (c && c.ate > Date.now()) return c.instancia === instancia;
  await tabelasProntas;
  const cfg = await indicacoes.obterConfig(tenantId).catch(() => ({ instancia: null }));
  _cacheNumero.set(tenantId, { instancia: cfg.instancia || null, ate: Date.now() + 15000 });
  return (cfg.instancia || null) === instancia;
}
export function limparCacheNumero(tenantId) { _cacheNumero.delete(tenantId); }

const FERRAMENTAS = [
  {
    name: 'enviar_arquivo',
    description: 'Envia ao contato um dos arquivos cadastrados (imagem, áudio, PDF ou vídeo curto). Use só quando fizer sentido na conversa.',
    input_schema: { type: 'object', properties: { nome_arquivo: { type: 'string', description: 'Nome exato do arquivo da lista.' } }, required: ['nome_arquivo'] },
  },
  {
    name: 'registrar_resultado',
    description: 'Registra o resultado da conversa para a equipe: "agendou" (a pessoa topou agendar), "sem_interesse" (recusou), ou "pedir_retorno" (pediu para ser chamada em outro momento).',
    input_schema: {
      type: 'object',
      properties: {
        resultado: { type: 'string', enum: ['agendou', 'sem_interesse', 'pedir_retorno'] },
        observacao: { type: 'string', description: 'Resumo curto do que foi combinado (dia/período preferido, motivo, etc.).' },
        retorno_em: { type: 'string', description: 'Só para pedir_retorno: data e hora ISO 8601 (fuso -03:00) do retorno combinado.' },
      },
      required: ['resultado'],
    },
  },
];

async function enviarArquivo(instancia, numero, arq) {
  const base64 = arq.conteudo.toString('base64');
  if (arq.media_type.startsWith('audio/')) { await evolutionApi.enviarAudio(instancia, numero, base64); return; }
  const mediatype = arq.media_type.startsWith('image/') ? 'image' : arq.media_type.startsWith('video/') ? 'video' : 'document';
  await evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arq.media_type, media: base64, fileName: arq.nome_arquivo });
}

async function acharIndicado(tenantId, numero) {
  const tel = crm.normalizarTelefone(numero);
  if (!tel) return null;
  const v = crm.varianteNonoDigito(tel);
  const { rows } = await pool.query(
    `SELECT i.id, i.nome, i.etapa, i.ia_pausada, ind.nome AS indicador_nome FROM ind_indicados i LEFT JOIN ind_indicadores ind ON ind.id = i.indicador_id WHERE i.tenant_id = $1 AND i.telefone = ANY($2::text[]) LIMIT 1`,
    [tenantId, v ? [tel, v] : [tel]],
  );
  return rows[0] || null;
}

async function carregarHistorico(tenantId, numero) {
  const { rows } = await pool.query('SELECT history FROM ind_ia_sessoes WHERE tenant_id = $1 AND numero = $2', [tenantId, numero]);
  return Array.isArray(rows[0]?.history) ? rows[0].history : [];
}
async function salvarHistorico(tenantId, numero, history) {
  let h = history.slice(-MAX_HISTORICO);
  while (h.length && h[0].role !== 'user') h = h.slice(1);
  await pool.query(
    `INSERT INTO ind_ia_sessoes (tenant_id, numero, history) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_id, numero) DO UPDATE SET history = $3::jsonb, updated_at = now()`,
    [tenantId, numero, JSON.stringify(h)],
  );
}

// chamada pelo webhook para mensagem recebida no numero das Indicacoes
export async function atender(tenantId, numero, instancia, { texto, tipo }) {
  if (!pool) return;
  await tabelasProntas;
  if (tipo && tipo !== 'text') return; // so texto por enquanto
  const msg = String(texto || '').trim();
  if (!msg) return;
  const cfg = await obterConfig(tenantId);
  if (!cfg.ativo || !cfg.prompt.trim()) return; // IA pausada/desligada: a equipe responde pelo CRM/WhatsApp
  const indicado = await acharIndicado(tenantId, numero);
  if (indicado?.ia_pausada) return;
  if (await crm.estaPausado(tenantId, numero, instancia).catch(() => false)) return;

  const arquivos = await listarArquivos(tenantId);
  const { rows: [t] } = await pool.query('SELECT nome FROM tenants WHERE id = $1', [tenantId]);
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio', dateStyle: 'full', timeStyle: 'short' });
  let contexto = `\n\n--- CONTEXTO (não repita para o contato) ---\nAgora: ${agora} (Maceió).\nClínica: ${t?.nome || ''}.`;
  if (indicado) {
    const lista = await indicacoes.listarNotas(tenantId, indicado.id).catch(() => []);
    contexto += `\nO contato é um INDICADO: ${indicado.nome}${indicado.indicador_nome ? `, indicado por ${indicado.indicador_nome}` : ''}. Etapa atual no funil: ${indicado.etapa}.`;
    if (lista.length) contexto += `\nAnotações da equipe sobre ele(a):\n${lista.slice(0, 8).map((n) => `- ${n.texto.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n')}`;
  } else {
    contexto += '\nEsse contato não está na lista de indicados (pode ser um paciente que indica, ou alguém novo). Seja cordial e descubra como ajudar; ferramentas de resultado não se aplicam a ele(a).';
  }
  contexto += arquivos.length ? `\nArquivos que você pode enviar com a ferramenta enviar_arquivo:\n${arquivos.map((a) => `- ${a.nome_arquivo}${a.descricao ? ` — ${a.descricao}` : ''}`).join('\n')}` : '\nNão há arquivos cadastrados para envio.';
  const system = cfg.prompt + contexto;

  const history = await carregarHistorico(tenantId, numero);
  history.push({ role: 'user', content: msg });
  const mensagens = history.map((h) => ({ role: h.role, content: h.content }));
  const tools = FERRAMENTAS.filter((f) => (f.name === 'enviar_arquivo' ? arquivos.length > 0 : !!indicado));
  const base = { model: MODEL, max_tokens: 1024, system, ...(tools.length ? { tools } : {}), _uso: { tenantId, modulo: 'indicacoes' } };
  let resposta = await anthropic.messages.create({ ...base, messages: mensagens });
  let rodadas = 0;
  const enviadosNaVez = [];
  while (resposta.stop_reason === 'tool_use' && rodadas < MAX_RODADAS) {
    mensagens.push({ role: 'assistant', content: resposta.content });
    const resultados = [];
    for (const bloco of resposta.content.filter((b) => b.type === 'tool_use')) {
      let r;
      try {
        if (bloco.name === 'enviar_arquivo') {
          const nome = String(bloco.input?.nome_arquivo || '').toLowerCase();
          const alvo = arquivos.find((a) => a.nome_arquivo.toLowerCase() === nome) || arquivos.find((a) => a.nome_arquivo.toLowerCase().includes(nome));
          if (!alvo) r = { erro: 'Arquivo não encontrado na lista.' };
          else if (enviadosNaVez.includes(alvo.id)) r = { ok: true, aviso: 'Já enviado nesta resposta.' };
          else {
            const { rows: [full] } = await pool.query('SELECT nome_arquivo, media_type, conteudo FROM ind_ia_arquivos WHERE id = $1 AND tenant_id = $2', [alvo.id, tenantId]);
            await enviarArquivo(instancia, numero, full);
            enviadosNaVez.push(alvo.id);
            r = { ok: true };
          }
        } else if (bloco.name === 'registrar_resultado' && indicado) {
          r = await indicacoes.registrarResultadoPelaIA(tenantId, indicado.id, { resultado: bloco.input?.resultado, observacao: bloco.input?.observacao, retornoEm: bloco.input?.retorno_em });
        } else r = { erro: 'Ferramenta indisponível.' };
      } catch (err) { r = { erro: err.message }; }
      resultados.push({ type: 'tool_result', tool_use_id: bloco.id, content: JSON.stringify(r) });
    }
    mensagens.push({ role: 'user', content: resultados });
    resposta = await anthropic.messages.create({ ...base, messages: mensagens });
    rodadas += 1;
  }
  const textoResposta = resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!textoResposta) return;
  history.push({ role: 'assistant', content: textoResposta });
  await salvarHistorico(tenantId, numero, history);
  await evolutionApi.enviarMensagemTextoPor(instancia, numero, textoResposta);
  crm.registrarMensagem(tenantId, { numero, instancia, direcao: 'saida', tipo: 'text', texto: textoResposta, autor: 'ia', manterEtapa: true })
    .catch((err) => console.error('[indicacoesIA] registrar mensagem no CRM:', err.message));
}
