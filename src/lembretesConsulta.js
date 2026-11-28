// Lembretes da consulta agendada (dentro da aba "Follow Up Inteligente"): depois que a IA agenda um lead
// (Clinicorp direto, pre-agendamento ou agenda interna), este motor acompanha o paciente ATE o dia da
// consulta, contando de TRAS PRA FRENTE a partir da data/hora marcada (o Follow Up Inteligente comum conta
// a partir da entrada na etapa, o que nao serve pra isso):
//   - na hora de agendar: confirmacao com data, hora e nome da doutora
//   - 96h antes: depoimento / antes e depois (anexos configurados pela clinica)
//   - 72h antes: historia de transformacao (versao feminina ou masculina conforme o paciente)
//   - 24h antes: pedido caloroso de confirmacao de presenca
//   - no dia: lembrete + audio da doutora (gravado POR ELA e anexado pela clinica) + endereco/localizacao
//   - nos demais dias: mensagem leve diaria (a IA varia o texto), se ligada
// Para sozinho se a consulta for cancelada/remarcada. Tudo isolado por tenant; textos e anexos editaveis na tela.
import { anthropic } from './anthropicClient.js';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import * as crm from './crm.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

const MODEL = 'claude-sonnet-5';
const FUSO = 'America/Maceio'; // UTC-3 fixo (sem horario de verao)
const H = 60 * 60 * 1000;

export const MARCOS_COM_ANEXO = ['conf', 'd96', 'd72', 'd24', 'dia'];
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const TEXTOS_PADRAO = {
  conf: 'Tudo certo, [NOME]! Sua Consulta de Avaliação Estratégica está confirmada 😊\n\n📅 [DATA]\n🕐 [HORA]\n👩‍⚕️ Com [MEDICA]\n\n[MEDICA] já está te esperando. Qualquer dúvida, é só me chamar aqui.',
  d96: '[NOME], separei um depoimento de uma paciente da [CLINICA] para você conhecer um pouquinho do que fazemos aqui. Cada caso é único, mas é bonito ver o primeiro passo virando sorriso. 💛',
  d72f: '[NOME], quero te contar uma história que se repete muito por aqui.\n\nMuitas pacientes chegam até nós escondendo o sorriso, evitando fotos e deixando de comer o que gostam. Algumas dizem que perderam a vontade de sair com as amigas.\n\nDepois do cuidado certo, o que mais ouvimos é: "Eu voltei a comer de tudo e a sorrir sem pensar duas vezes". É uma mudança de vida de verdade.\n\nO primeiro passo é o que você já deu. Estamos muito felizes por você.',
  d72m: '[NOME], quero te contar uma história que se repete muito por aqui.\n\nMuitos pacientes chegam até nós evitando comer o que gostam e com receio de sorrir. Alguns deixavam de ir a eventos e de conversar de perto por vergonha.\n\nDepois do cuidado certo, o que mais ouvimos é: "Eu voltei a comer de tudo e a sorrir sem pensar duas vezes". É uma mudança de vida de verdade.\n\nO primeiro passo é o que você já deu. Estamos muito felizes por você.',
  diaria: 'Mensagem curta, calorosa e diferente das anteriores, lembrando a data e a hora da avaliação com [MEDICA]. Sem pressão e sem falar de preço.',
  d24: 'Olá, [NOME]! Sua consulta é amanhã, [DATA], às [HORA], com [MEDICA]. Estamos muito animados para te receber.\n\nPosso confirmar a sua presença? Se precisar mudar o horário, me avise com carinho que eu ajudo a encontrar outro. 💛',
  dia: 'Olá, [NOME]! Hoje é o grande dia: sua avaliação é às [HORA]. [MEDICA] já está te esperando e muito feliz por você ter dado esse primeiro passo. 🦷✨',
};
const CONFIG_PADRAO = {
  ativo: false, clinica: '', medica: '', endereco: '', pontoReferencia: '', linkMapa: '',
  horaInicio: '08:00', horaFim: '20:00', horaDia: '08:00', horaDiaria: '10:00', diariaAtiva: true,
  textos: TEXTOS_PADRAO,
};

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lc_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      clinica TEXT, medica TEXT, endereco TEXT, ponto_referencia TEXT, link_mapa TEXT,
      hora_inicio TEXT NOT NULL DEFAULT '08:00', hora_fim TEXT NOT NULL DEFAULT '20:00',
      hora_dia TEXT NOT NULL DEFAULT '08:00', hora_diaria TEXT NOT NULL DEFAULT '10:00',
      diaria_ativa BOOLEAN NOT NULL DEFAULT true,
      textos JSONB NOT NULL DEFAULT '{}'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lc_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      marco TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS lc_arquivos_idx ON lc_arquivos (tenant_id, marco);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lc_consultas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      numero TEXT NOT NULL,
      instancia TEXT NOT NULL,
      nome TEXT,
      medico TEXT,
      inicio TIMESTAMPTZ NOT NULL,
      fim TIMESTAMPTZ,
      origem TEXT,
      genero TEXT,
      status TEXT NOT NULL DEFAULT 'ativa',
      enviados JSONB NOT NULL DEFAULT '{}'::jsonb,
      ultima_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS lc_consultas_idx ON lc_consultas (tenant_id, status, inicio);`);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('Erro criando tabelas dos lembretes da consulta:', err.message));

// ---------------------------------------------------------------- configuracao

function lerConfig(r) {
  if (!r) return { ...CONFIG_PADRAO, textos: { ...TEXTOS_PADRAO } };
  return {
    ativo: !!r.ativo, clinica: r.clinica || '', medica: r.medica || '', endereco: r.endereco || '', pontoReferencia: r.ponto_referencia || '', linkMapa: r.link_mapa || '',
    horaInicio: r.hora_inicio, horaFim: r.hora_fim, horaDia: r.hora_dia, horaDiaria: r.hora_diaria, diariaAtiva: r.diaria_ativa !== false,
    textos: { ...TEXTOS_PADRAO, ...(r.textos || {}) },
  };
}

export async function obterConfig(tenantId) {
  if (!pool) return lerConfig(null);
  await tabelasProntas;
  const { rows } = await pool.query('SELECT * FROM lc_config WHERE tenant_id = $1', [tenantId]);
  return lerConfig(rows[0]);
}

export async function salvarConfig(tenantId, d) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const horas = { horaInicio: d.horaInicio || '08:00', horaFim: d.horaFim || '20:00', horaDia: d.horaDia || '08:00', horaDiaria: d.horaDiaria || '10:00' };
  for (const v of Object.values(horas)) if (!HORA_RE.test(v)) throw new Error('Horario invalido (use o formato HH:MM).');
  if (horas.horaInicio >= horas.horaFim) throw new Error('O horario de inicio precisa ser antes do horario de fim.');
  const cortar = (t, n) => String(t || '').trim().slice(0, n);
  const textos = {};
  for (const k of Object.keys(TEXTOS_PADRAO)) textos[k] = cortar(d.textos?.[k] ?? TEXTOS_PADRAO[k], 3000) || TEXTOS_PADRAO[k];
  await pool.query(
    `INSERT INTO lc_config (tenant_id, ativo, clinica, medica, endereco, ponto_referencia, link_mapa, hora_inicio, hora_fim, hora_dia, hora_diaria, diaria_ativa, textos, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     ON CONFLICT (tenant_id) DO UPDATE SET ativo=$2, clinica=$3, medica=$4, endereco=$5, ponto_referencia=$6, link_mapa=$7, hora_inicio=$8, hora_fim=$9, hora_dia=$10, hora_diaria=$11, diaria_ativa=$12, textos=$13, atualizado_em=now()`,
    [tenantId, !!d.ativo, cortar(d.clinica, 120), cortar(d.medica, 120), cortar(d.endereco, 300), cortar(d.pontoReferencia, 200), cortar(d.linkMapa, 300),
      horas.horaInicio, horas.horaFim, horas.horaDia, horas.horaDiaria, d.diariaAtiva !== false, JSON.stringify(textos)],
  );
}

// ---------------------------------------------------------------- anexos por momento

const MAX_ARQUIVO_BYTES = 12 * 1024 * 1024;
const MAX_ARQUIVOS_POR_MARCO = 6;
const TIPOS_ARQUIVO = [/^image\//, /^audio\//, /^video\//, /^application\/pdf$/];

export async function listarArquivos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, marco, nome_arquivo, media_type, octet_length(conteudo) AS tamanho FROM lc_arquivos WHERE tenant_id = $1 ORDER BY id', [tenantId]);
  return rows.map((r) => ({ id: r.id, marco: r.marco, nome: r.nome_arquivo, tipo: r.media_type, tamanho: Number(r.tamanho) }));
}

export async function salvarArquivo(tenantId, marco, nomeArquivo, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  if (!MARCOS_COM_ANEXO.includes(marco)) throw new Error('Momento invalido.');
  if (!TIPOS_ARQUIVO.some((re) => re.test(String(mediaType)))) throw new Error('Tipo de arquivo nao aceito - use audio, imagem, PDF ou video curto.');
  if (!buffer?.length) throw new Error('Arquivo vazio.');
  if (buffer.length > MAX_ARQUIVO_BYTES) throw new Error('Arquivo grande demais - o maximo e 12 MB.');
  const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM lc_arquivos WHERE tenant_id = $1 AND marco = $2', [tenantId, marco]);
  if (n >= MAX_ARQUIVOS_POR_MARCO) throw new Error(`No maximo ${MAX_ARQUIVOS_POR_MARCO} anexos por momento.`);
  const nome = String(nomeArquivo).slice(0, 200);
  const { rows } = await pool.query('INSERT INTO lc_arquivos (tenant_id, marco, nome_arquivo, media_type, conteudo) VALUES ($1,$2,$3,$4,$5) RETURNING id', [tenantId, marco, nome, mediaType, buffer]);
  return { id: rows[0].id, marco, nome, tipo: mediaType, tamanho: buffer.length };
}

export async function apagarArquivo(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query('DELETE FROM lc_arquivos WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// ---------------------------------------------------------------- datas e textos

// "2026-12-03T14:00:00" (sem fuso) e horario de Maceio; com Z ou +/-HH:MM vale como veio
export function paraData(valor) {
  const s = String(valor || '').trim();
  if (!s) return null;
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s.length === 10 ? `${s}T00:00:00` : s}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const dataLocal = (d) => d.toLocaleDateString('en-CA', { timeZone: FUSO }); // AAAA-MM-DD
const horaLocal = (d) => d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
const alvoLocal = (dia, hhmm) => new Date(`${dia}T${hhmm}:00-03:00`);
const somaDias = (dia, n) => dataLocal(new Date(alvoLocal(dia, '12:00').getTime() + n * 24 * H));

function textoData(d) {
  const t = d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function textoHora(d) {
  const [h, m] = horaLocal(d).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

function preencher(texto, { nome, inicio, medica, clinica }) {
  return String(texto)
    .replace(/\[NOME\]/g, primeiroNome(nome) || 'tudo bem')
    .replace(/\[DATA\]/g, textoData(inicio))
    .replace(/\[HORA\]/g, textoHora(inicio))
    .replace(/\[MEDICA\]/g, medica || 'a doutora')
    .replace(/\[CLINICA\]/g, clinica || 'nossa clinica');
}

const FEMININOS_EM_O = new Set(['socorro', 'consolacao']);
const MASCULINOS_EM_A = new Set(['luca', 'joshua', 'jose maria', 'misael']);
function generoPeloNome(nome) {
  const p = primeiroNome(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!p) return null;
  if (MASCULINOS_EM_A.has(p)) return 'M';
  if (p.endsWith('a') || p.endsWith('ane') || p.endsWith('ele') || p.endsWith('ice') || FEMININOS_EM_O.has(p)) return 'F';
  if (/(o|os|r|l|s|u|m|n|k|z|ton|son|el|er|ur)$/.test(p)) return 'M';
  return null;
}

async function descobrirGenero(tenantId, nome) {
  const quick = generoPeloNome(nome);
  if (quick) return quick;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 60,
      tools: [{ name: 'genero', description: 'Informa o genero provavel de quem tem esse nome no Brasil.', input_schema: { type: 'object', properties: { genero: { type: 'string', enum: ['F', 'M'] } }, required: ['genero'] } }],
      tool_choice: { type: 'tool', name: 'genero' },
      messages: [{ role: 'user', content: `Primeiro nome: "${primeiroNome(nome)}". Qual o genero mais provavel (F ou M) de uma pessoa com esse nome no Brasil?` }],
      _uso: { tenantId, modulo: 'lembretes-consulta' },
    });
    const g = resp.content.find((b) => b.type === 'tool_use')?.input?.genero;
    return g === 'M' ? 'M' : 'F';
  } catch {
    return 'F';
  }
}

// ---------------------------------------------------------------- envio

async function enviarArquivo(instancia, numero, arq) {
  const base64 = arq.conteudo.toString('base64');
  if (arq.media_type.startsWith('audio/')) return evolutionApi.enviarAudio(instancia, numero, base64);
  const mediatype = arq.media_type.startsWith('image/') ? 'image' : arq.media_type.startsWith('video/') ? 'video' : 'document';
  return evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arq.media_type, media: base64, fileName: arq.nome_arquivo });
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviarTexto(tenantId, c, texto) {
  const resposta = await evolutionApi.enviarMensagemTextoPor(c.instancia, c.numero, texto);
  await crm.registrarMensagem(tenantId, {
    numero: c.numero, instancia: c.instancia, direcao: 'saida', tipo: 'text', texto,
    autor: 'followup', agente: 'anne', waId: resposta?.key?.id || null, manterEtapa: true,
  });
}

async function gerarMensagemDiaria(tenantId, config, c, inicio, diasFaltando) {
  const medica = c.medico || config.medica;
  const instrucao = preencher(config.textos.diaria, { nome: c.nome, inicio, medica, clinica: config.clinica });
  const conversa = await crm.ultimasMensagens(tenantId, c.numero, c.instancia, 8).catch(() => []);
  const historico = conversa.map((m) => `[${m.direcao === 'entrada' ? 'Paciente' : 'Nos'}] ${m.texto || `(${m.tipo})`}`).join('\n') || '(sem mensagens)';
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 400,
    tools: [{ name: 'entregar_mensagem', description: 'Entrega o texto pronto pra enviar por WhatsApp.', input_schema: { type: 'object', properties: { mensagem: { type: 'string' } }, required: ['mensagem'] } }],
    tool_choice: { type: 'tool', name: 'entregar_mensagem' },
    messages: [{
      role: 'user',
      content: `Voce escreve UMA mensagem automatica de acompanhamento por WhatsApp pra um paciente com consulta marcada (${medica ? `com ${medica}, ` : ''}${textoData(inicio)}, as ${textoHora(inicio)}; faltam ${diasFaltando} dia(s)). ` +
        `Clinica: ${config.clinica || 'nossa clinica'}. Nome do paciente: ${primeiroNome(c.nome) || 'nao informado'}.\n\nInstrucoes da clinica:\n${instrucao}\n\nUltimas mensagens:\n${historico}\n\n` +
        'Regras: 1 a 3 frases curtas, natural e acolhedora; so o texto final; sem markdown/asterisco; no maximo 1 emoji; nao repita o que ja foi mandado; nunca invente preco, desconto ou promessa de resultado.',
    }],
    _uso: { tenantId, modulo: 'lembretes-consulta' },
  });
  const m = String(resp.content.find((b) => b.type === 'tool_use')?.input?.mensagem || '').trim();
  if (!m) throw new Error('a IA nao gerou a mensagem diaria');
  return m;
}

async function textoDoMarco(tenantId, config, c, inicio, marco) {
  const dados = { nome: c.nome, inicio, medica: c.medico || config.medica, clinica: config.clinica };
  if (marco === 'd72') {
    let genero = c.genero;
    if (!genero) {
      genero = await descobrirGenero(tenantId, c.nome);
      await pool.query('UPDATE lc_consultas SET genero = $2 WHERE id = $1', [c.id, genero]);
    }
    return preencher(genero === 'M' ? config.textos.d72m : config.textos.d72f, dados);
  }
  if (marco.startsWith('diaria')) {
    const dias = Math.max(1, Math.round((alvoLocal(dataLocal(inicio), '12:00') - alvoLocal(marco.slice(7), '12:00')) / (24 * H)));
    try {
      return await gerarMensagemDiaria(tenantId, config, c, inicio, dias);
    } catch (err) {
      console.error('[lembretes] mensagem diaria pela IA falhou, usando texto simples:', err.message);
      return preencher('Oi, [NOME]! Passando só para lembrar que sua avaliação com [MEDICA] é em [DATA], às [HORA]. Se precisar de algo antes, é só me chamar. 😊', dados);
    }
  }
  return preencher(config.textos[marco], dados);
}

async function enviarMarco(tenantId, config, c, marco) {
  const inicio = new Date(c.inicio);
  const texto = await textoDoMarco(tenantId, config, c, inicio, marco);
  await enviarTexto(tenantId, c, texto);
  if (MARCOS_COM_ANEXO.includes(marco)) {
    const { rows } = await pool.query('SELECT nome_arquivo, media_type, conteudo FROM lc_arquivos WHERE tenant_id = $1 AND marco = $2 ORDER BY id', [tenantId, marco]);
    for (const arq of rows) {
      await pausa(1500);
      try { await enviarArquivo(c.instancia, c.numero, arq); } catch (err) { console.error(`[lembretes] erro mandando anexo (${marco}):`, err.message); }
    }
  }
  if (marco === 'dia') {
    const linhas = [];
    if (config.endereco) linhas.push(`📍 ${config.clinica ? `${config.clinica}\n` : ''}${config.endereco}`);
    if (config.pontoReferencia) linhas.push(`Ponto de referência: ${config.pontoReferencia}`);
    if (config.linkMapa) linhas.push(`🗺️ ${config.linkMapa}`);
    if (linhas.length) { await pausa(1500); await enviarTexto(tenantId, c, linhas.join('\n')); }
  }
}

// ---------------------------------------------------------------- registro vindo do auto-atendimento

// chamado quando a IA agenda (ou pre-agenda) um paciente. Best-effort: nunca derruba o atendimento.
export async function registrarConsulta(tenantId, { numero, instancia, nome, inicio, fim, medico, origem }) {
  if (!pool) return;
  await tabelasProntas;
  const config = await obterConfig(tenantId);
  if (!config.ativo) return;
  const ini = paraData(inicio);
  if (!ini || ini.getTime() <= Date.now()) return;
  // remarcou: as consultas anteriores ainda ativas desse contato deixam de valer
  await pool.query(`UPDATE lc_consultas SET status = 'remarcada' WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 AND status = 'ativa'`, [tenantId, numero, instancia]);
  const { rows: [c] } = await pool.query(
    `INSERT INTO lc_consultas (tenant_id, numero, instancia, nome, medico, inicio, fim, origem, enviados)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}'::jsonb) RETURNING *`,
    [tenantId, numero, instancia, String(nome || '').slice(0, 120), String(medico || '').trim().slice(0, 120) || null, ini, paraData(fim), origem || null],
  );
  try {
    await enviarMarco(tenantId, config, c, 'conf'); // confirmacao na hora, mesmo fora do horario (e resposta ao que acabou de acontecer)
    await pool.query(`UPDATE lc_consultas SET enviados = enviados || $2::jsonb, ultima_em = now() WHERE id = $1`, [c.id, JSON.stringify({ conf: new Date().toISOString() })]);
  } catch (err) {
    console.error('[lembretes] erro na confirmacao do agendamento:', err.message);
  }
}

export async function cancelarConsultasDoContato(tenantId, numero, instancia) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE lc_consultas SET status = 'cancelada' WHERE tenant_id = $1 AND numero = $2 AND instancia = $3 AND status = 'ativa'`, [tenantId, numero, instancia]);
}

export async function listarConsultas(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome, numero, medico, inicio, status, enviados, origem FROM lc_consultas
     WHERE tenant_id = $1 AND (status = 'ativa' OR inicio > now() - interval '7 days') ORDER BY inicio DESC LIMIT 60`,
    [tenantId],
  );
  return rows.map((r) => ({ id: r.id, nome: r.nome, numero: r.numero, medico: r.medico, inicio: r.inicio, status: r.status, origem: r.origem, enviados: Object.keys(r.enviados || {}) }));
}

// ---------------------------------------------------------------- agendador

const dentroDaJanela = (config, agora) => { const h = horaLocal(agora); return h >= config.horaInicio && h < config.horaFim; };

// quais momentos (com o instante-alvo) existem pra essa consulta, na ordem do tempo
export function momentosDaConsulta(c, config) {
  const inicio = new Date(c.inicio);
  const criado = new Date(c.criado_em);
  const out = [];
  const diaConsulta = dataLocal(inicio);
  const rel = (marco, horas) => { const t = new Date(inicio.getTime() - horas * H); if (t > criado) out.push({ marco, alvo: t, tipo: 'rel' }); };
  rel('d96', 96); rel('d72', 72); rel('d24', 24);
  // lembrete do dia: na hora configurada; se a consulta foi marcada no proprio dia (ja passou dessa hora), sai 1h depois do agendamento
  // - desde que ainda sobre tempo antes da consulta
  const alvoDiaPadrao = alvoLocal(diaConsulta, config.horaDia);
  const alvoDia = alvoDiaPadrao > criado ? alvoDiaPadrao : new Date(criado.getTime() + H);
  if (inicio.getTime() - alvoDia.getTime() > 90 * 60 * 1000) out.push({ marco: 'dia', alvo: alvoDia, tipo: 'dia' });
  if (config.diariaAtiva) {
    const diasMarcos = new Set(out.filter((m) => m.tipo === 'rel').map((m) => dataLocal(m.alvo)));
    for (let d = somaDias(dataLocal(criado), 1); d < diaConsulta; d = somaDias(d, 1)) {
      if (diasMarcos.has(d)) continue;
      out.push({ marco: `diaria:${d}`, alvo: alvoLocal(d, config.horaDiaria), tipo: 'diaria' });
    }
  }
  return out.sort((a, b) => a.alvo - b.alvo);
}

async function processarConsulta(tenantId, config, c, agora) {
  const inicio = new Date(c.inicio);
  if (inicio <= agora) { await pool.query(`UPDATE lc_consultas SET status = 'concluida' WHERE id = $1`, [c.id]); return; }
  const { rows: [ct] } = await pool.query('SELECT oculto, etapa FROM crm_contatos WHERE tenant_id = $1 AND numero = $2 AND instancia = $3', [tenantId, c.numero, c.instancia]);
  if (ct?.oculto) return;
  if (ct && ['compareceu', 'nao_compareceu', 'comprou', 'nao_comprou', 'perdido'].includes(ct.etapa)) { await pool.query(`UPDATE lc_consultas SET status = 'concluida' WHERE id = $1`, [c.id]); return; }
  if (!dentroDaJanela(config, agora)) return;
  const enviados = c.enviados || {};
  const ultima = c.ultima_em ? new Date(c.ultima_em) : null;

  const devido = momentosDaConsulta(c, config).find((m) => {
    if (enviados[m.marco] !== undefined || m.alvo > agora) return false;
    if (m.tipo === 'dia') return inicio.getTime() - agora.getTime() > 30 * 60 * 1000; // faltando menos de 30 min nao adianta mais
    return agora.getTime() - m.alvo.getTime() < 20 * H; // perdeu a hora por muito tempo (ex: servidor fora) - pula
  });
  if (!devido) return;
  const folga = devido.tipo === 'dia' ? 1 * H : 4 * H;
  if (ultima && agora.getTime() - ultima.getTime() < folga) return;
  try {
    await enviarMarco(tenantId, config, c, devido.marco);
    await pool.query(`UPDATE lc_consultas SET enviados = enviados || $2::jsonb, ultima_em = now() WHERE id = $1`, [c.id, JSON.stringify({ [devido.marco]: new Date().toISOString() })]);
  } catch (err) {
    console.error(`[lembretes] erro no momento ${devido.marco} (consulta ${c.id}, tenant ${tenantId}):`, err.message);
  }
}

export async function rodarLembretes(agora = new Date()) {
  if (!pool) return;
  await tabelasProntas;
  const { rows: tenantsAtivos } = await pool.query(`SELECT l.tenant_id FROM lc_config l JOIN tenants t ON t.id = l.tenant_id WHERE l.ativo = true AND (t.ativo OR t.super_admin)`);
  for (const { tenant_id: tenantId } of tenantsAtivos) {
    try {
      const config = await obterConfig(tenantId);
      const { rows: consultas } = await pool.query(`SELECT * FROM lc_consultas WHERE tenant_id = $1 AND status = 'ativa'`, [tenantId]);
      for (const c of consultas) {
        await processarConsulta(tenantId, config, c, agora);
        await pausa(2000);
      }
    } catch (err) {
      console.error(`[lembretes] erro no tenant ${tenantId}:`, err.message);
    }
  }
}

export function iniciarSchedulerLembretesConsulta() {
  setInterval(() => rodarLembretes().catch((e) => console.error('[lembretes] erro:', e.message)), 5 * 60 * 1000).unref();
}
