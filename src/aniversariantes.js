// Aniversariantes do mes (aba "Aniversariantes"): puxa os pacientes que fazem aniversario do
// Clinicorp de cada clinica, monta a programacao do mes inteiro (1 linha por paciente, na data
// do aniversario) e o agendador manda sozinho a mensagem de parabens no dia - texto (com o nome
// do paciente, opcionalmente reescrito pela IA pra nao sair identico pra todos) mais os arquivos
// que a clinica subiu (imagem, audio, video curto, PDF). Tudo por tenant: configuracao, arquivos,
// programacao e Clinicorp sao sempre os da clinica dona da conta.
//
// Regras de seguranca: so manda de instancia de WhatsApp ativa do tenant (a trava de conta
// desativada fica no evolutionApi), 1 envio por paciente por ano (UNIQUE), "reserva" a linha
// (status 'enviando') antes de mandar pra dois ciclos do agendador nunca mandarem em duplicidade,
// e pausa aleatoria entre pacientes pra nao parecer disparo em massa.
import { anthropic } from './anthropicClient.js';
import * as clinicorp from './clinicorp.js';
import { pool } from './db.js';
import * as evolutionApi from './evolutionApi.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { classificarPacientes, IDS_PERFIL, passaNoFiltro } from './aniversariantesPerfil.js';
import * as whatsappInstances from './whatsappInstances.js';

const MODEL = 'claude-sonnet-5';
const TAMANHO_MAX_ARQUIVO = 12 * 1024 * 1024; // base64 aumenta ~33% e o JSON do app aceita 20mb
const MAX_ARQUIVOS = 5;
const MENSAGEM_PADRAO = 'Oi, {nome}! 🎉 Hoje é o seu dia e a nossa equipe quis passar aqui pra te desejar um feliz aniversário, com muita saúde, alegria e motivos pra sorrir bastante! Um abraço de todos nós.';
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos; // REFERENCES tenants(id) abaixo
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aniversariantes_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      ativo BOOLEAN NOT NULL DEFAULT false,
      hora_envio TEXT NOT NULL DEFAULT '09:00',
      mensagem TEXT,
      usar_ia BOOLEAN NOT NULL DEFAULT false,
      instrucoes_ia TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aniversariantes_arquivos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome_arquivo TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS aniversariantes_arquivos_tenant_idx ON aniversariantes_arquivos (tenant_id);`);
  // 1 linha por paciente por aniversario (data_envio = o dia em que a mensagem deve sair).
  // "mensagem" so tem valor quando a clinica editou o texto daquele paciente especificamente.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aniversariantes_envios (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      paciente_chave TEXT NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL DEFAULT '',
      data_envio DATE NOT NULL,
      mensagem TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      erro TEXT,
      enviado_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, paciente_chave, data_envio)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS aniversariantes_envios_data_idx ON aniversariantes_envios (tenant_id, data_envio);`);
  // diagnostico da ultima sincronizacao com o Clinicorp (quantos vieram, quantos sem telefone,
  // quais campos a API devolveu) - o formato da API nao e documentado publicamente, entao a tela
  // mostra isso pra ficar facil de ver se algum campo veio com outro nome
  await pool.query(`ALTER TABLE aniversariantes_config ADD COLUMN IF NOT EXISTS ultima_sync JSONB;`);
  // filtro de perfil: perfis_filtro = lista dos perfis que RECEBEM a mensagem (NULL = todos); meses_ativo = janela do perfil "ativo"
  await pool.query(`ALTER TABLE aniversariantes_config ADD COLUMN IF NOT EXISTS perfis_filtro JSONB;`);
  await pool.query(`ALTER TABLE aniversariantes_config ADD COLUMN IF NOT EXISTS meses_ativo INT NOT NULL DEFAULT 12;`);
  // perfis do paciente na ultima sincronizacao (ver aniversariantesPerfil.js); NULL = ainda nao classificado
  await pool.query(`ALTER TABLE aniversariantes_envios ADD COLUMN IF NOT EXISTS perfis JSONB;`);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas dos Aniversariantes:', err.message);
});

// ---------- datas (fuso fixo America/Maceio, igual ao resto do app) ----------

function hojeMaceio() {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' }); // YYYY-MM-DD
  const [ano, mes, dia] = iso.split('-').map(Number);
  return { iso, ano, mes, dia };
}
const horaAgoraMaceio = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
const doisDig = (n) => String(n).padStart(2, '0');
const ultimoDiaDoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- configuracao ----------

const CONFIG_VAZIA = { ativo: false, horaEnvio: '09:00', mensagem: MENSAGEM_PADRAO, usarIa: false, instrucoesIa: '', ultimaSync: null, perfisFiltro: null, mesesAtivo: 12 };

export async function obterConfig(tenantId) {
  if (!pool) return CONFIG_VAZIA;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT ativo, hora_envio, mensagem, usar_ia, instrucoes_ia, ultima_sync, perfis_filtro, meses_ativo FROM aniversariantes_config WHERE tenant_id = $1`, [tenantId]);
  if (!rows.length) return CONFIG_VAZIA;
  const r = rows[0];
  return { ativo: !!r.ativo, horaEnvio: r.hora_envio || '09:00', mensagem: r.mensagem || MENSAGEM_PADRAO, usarIa: !!r.usar_ia, instrucoesIa: r.instrucoes_ia || '', ultimaSync: r.ultima_sync || null, perfisFiltro: Array.isArray(r.perfis_filtro) && r.perfis_filtro.length ? r.perfis_filtro : null, mesesAtivo: r.meses_ativo || 12 };
}

export async function salvarConfig(tenantId, { ativo, horaEnvio, mensagem, usarIa, instrucoesIa, perfisFiltro, mesesAtivo }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const hora = horaEnvio || '09:00';
  if (!HORA_RE.test(hora)) throw new Error('Horario invalido (use o formato HH:MM).');
  const texto = String(mensagem || '').trim();
  if (!texto) throw new Error('Escreva a mensagem de aniversario.');
  if (texto.length > 1500) throw new Error('A mensagem passou de 1500 caracteres.');
  // perfis: undefined/null = todos; lista = so esses. Todos marcados vira NULL ("sem filtro"), que tambem inclui quem ficou "indefinido"
  let filtro = null;
  if (perfisFiltro !== undefined && perfisFiltro !== null) {
    if (!Array.isArray(perfisFiltro) || perfisFiltro.some((p) => !IDS_PERFIL.includes(p))) throw new Error('Perfil invalido.');
    const unicos = [...new Set(perfisFiltro)];
    if (!unicos.length) throw new Error('Marque pelo menos um perfil de paciente pra receber a mensagem.');
    filtro = unicos.length === IDS_PERFIL.length ? null : unicos;
  }
  const meses = mesesAtivo === undefined || mesesAtivo === null ? 12 : Number(mesesAtivo);
  if (!Number.isInteger(meses) || meses < 1 || meses > 60) throw new Error('Meses do perfil "ativo" precisa ser entre 1 e 60.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO aniversariantes_config (tenant_id, ativo, hora_envio, mensagem, usar_ia, instrucoes_ia, perfis_filtro, meses_ativo, atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     ON CONFLICT (tenant_id) DO UPDATE SET ativo = $2, hora_envio = $3, mensagem = $4, usar_ia = $5, instrucoes_ia = $6, perfis_filtro = $7, meses_ativo = $8, atualizado_em = now()`,
    [tenantId, !!ativo, hora, texto, !!usarIa, String(instrucoesIa || '').slice(0, 800), filtro ? JSON.stringify(filtro) : null, meses],
  );
}

// ---------- arquivos (mandados junto da mensagem pra todo aniversariante) ----------

export async function listarArquivos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, nome_arquivo, media_type, octet_length(conteudo) AS tamanho, criado_em FROM aniversariantes_arquivos WHERE tenant_id = $1 ORDER BY criado_em`,
    [tenantId],
  );
  return rows;
}

export async function salvarArquivo(tenantId, nomeArquivo, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (!/^(image|audio|video)\//.test(mediaType) && mediaType !== 'application/pdf') throw new Error('Envie imagem, audio, video ou PDF.');
  if (buffer.length > TAMANHO_MAX_ARQUIVO) throw new Error(`Arquivo grande demais (${Math.round(buffer.length / 1048576)} MB) - o limite e ${TAMANHO_MAX_ARQUIVO / 1048576} MB. Use um video mais curto/comprimido.`);
  await tabelasProntas;
  const { rows: existentes } = await pool.query(`SELECT count(*)::int AS n FROM aniversariantes_arquivos WHERE tenant_id = $1`, [tenantId]);
  if (existentes[0].n >= MAX_ARQUIVOS) throw new Error(`Maximo de ${MAX_ARQUIVOS} arquivos por mensagem - apague algum antes de subir outro.`);
  const { rows } = await pool.query(
    `INSERT INTO aniversariantes_arquivos (tenant_id, nome_arquivo, media_type, conteudo) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, String(nomeArquivo).slice(0, 200), mediaType, buffer],
  );
  return rows[0].id;
}

export async function apagarArquivo(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await pool.query(`DELETE FROM aniversariantes_arquivos WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

async function arquivosComConteudo(tenantId) {
  const { rows } = await pool.query(`SELECT nome_arquivo, media_type, conteudo FROM aniversariantes_arquivos WHERE tenant_id = $1 ORDER BY criado_em`, [tenantId]);
  return rows;
}

async function enviarArquivo(instancia, numero, arquivo) {
  const base64 = arquivo.conteudo.toString('base64');
  if (arquivo.media_type.startsWith('audio/')) return evolutionApi.enviarAudio(instancia, numero, base64);
  const mediatype = arquivo.media_type.startsWith('image/') ? 'image' : arquivo.media_type.startsWith('video/') ? 'video' : 'document';
  return evolutionApi.enviarMidia(instancia, numero, { mediatype, mimetype: arquivo.media_type, media: base64, fileName: arquivo.nome_arquivo });
}

// ---------- leitura dos aniversariantes no Clinicorp ----------

// a API nao tem documentacao publica - le os campos pelo nome aceitando variacoes (maiuscula,
// underscore, sinonimos) em vez de depender de um unico formato
function pick(obj, nomes) {
  if (!obj || typeof obj !== 'object') return undefined;
  const mapa = new Map(Object.keys(obj).map((k) => [k.toLowerCase().replace(/[_\s-]/g, ''), k]));
  for (const n of nomes) {
    const k = mapa.get(n.toLowerCase().replace(/[_\s-]/g, ''));
    if (k !== undefined && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }
  return undefined;
}

function parseNascimento(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return { mes: Number(m[2]), dia: Number(m[3]) };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return { mes: Number(m[2]), dia: Number(m[1]) };
  return null;
}

export function normalizarTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 13 && d.startsWith('55') ? d : '';
}

const CAMPOS_TELEFONE = ['MobilePhone', 'CellPhone', 'Cellphone', 'Mobile', 'WhatsApp', 'Whatsapp', 'Phone', 'Telephone', 'PhoneNumber', 'Celular', 'Telefone'];

function normalizarPaciente(item) {
  const nome = String(pick(item, ['Name', 'PatientName', 'FullName', 'Nome']) || '').trim();
  if (!nome) return null;
  const id = pick(item, ['PatientId', 'Patient_Id', 'PersonId', 'Id', 'Patient']);
  let telefone = '';
  for (const campo of CAMPOS_TELEFONE) { telefone = normalizarTelefone(pick(item, [campo])); if (telefone) break; }
  return {
    id: id !== undefined ? String(id) : null,
    nome,
    telefone,
    nasc: parseNascimento(pick(item, ['BirthDate', 'Birthday', 'BirthDay', 'DateOfBirth', 'BornDate', 'Nascimento', 'DataNascimento'])),
    campos: Object.keys(item || {}),
  };
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// busca dia a dia (30 chamadas, com pausa curta). Se a API responder o mes inteiro de uma vez
// (itens com dia de aniversario diferente do pedido), para na primeira chamada.
async function buscarDoMes(tenantId, ano, mes) {
  const ultimo = ultimoDiaDoMes(ano, mes);
  const achados = new Map();
  const camposVistos = new Set();
  let modoMes = false;
  let chamadas = 0;
  let falhas = 0;
  let ultimoErro = '';
  for (let dia = 1; dia <= ultimo; dia++) {
    let lista;
    try {
      lista = await clinicorp.getPatientBirthdays(tenantId, { date: `${ano}-${doisDig(mes)}-${doisDig(dia)}` });
    } catch (err) {
      if (/nao tem o Clinicorp conectado/.test(err.message)) throw err;
      falhas++; ultimoErro = err.message;
      if (falhas >= 3 && chamadas === 0) break; // desiste cedo se nada funciona
      continue;
    }
    chamadas++;
    for (const bruto of Array.isArray(lista) ? lista : []) {
      const p = normalizarPaciente(bruto);
      if (!p) continue;
      p.campos.forEach((c) => camposVistos.add(c));
      if (p.nasc && p.nasc.dia !== dia) modoMes = true;
      const nasc = p.nasc || { mes, dia };
      if (nasc.mes !== mes) continue;
      p.dia = Math.min(nasc.dia, ultimo);
      achados.set(p.id ? `id:${p.id}` : `nome:${slug(p.nome)}`, p);
    }
    if (modoMes) break;
    await pausa(250);
  }
  if (!chamadas) throw new Error(`Nao consegui ler os aniversariantes no Clinicorp${ultimoErro ? `: ${ultimoErro}` : ''}`);
  return { pacientes: [...achados.entries()].map(([chave, p]) => ({ chave, ...p })), camposVistos: [...camposVistos].sort(), falhas, modoMes };
}

// o endpoint de aniversariantes pode vir sem telefone - tenta completar pelo cadastro do paciente
async function completarTelefone(tenantId, p) {
  if (p.telefone || !p.id) return;
  try {
    const r = await clinicorp.findPatient(tenantId, { patientId: p.id });
    const cad = Array.isArray(r) ? r[0] : r?.list?.[0] || r?.Patient || r;
    for (const campo of CAMPOS_TELEFONE) { p.telefone = normalizarTelefone(pick(cad, [campo])); if (p.telefone) return; }
  } catch { /* melhor esforco - fica sem telefone */ }
}

// traz os aniversariantes do mes do Clinicorp e grava a programacao. Nunca mexe em quem ja foi
// enviado/pulado/editado; so atualiza nome/telefone de quem ainda esta pendente.
export async function sincronizarMes(tenantId, ano, mes) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12 || ano < 2020 || ano > 2100) throw new Error('Mes invalido.');
  await tabelasProntas;
  const { pacientes, camposVistos, falhas, modoMes } = await buscarDoMes(tenantId, ano, mes);
  let completados = 0;
  for (const p of pacientes) {
    if (!p.telefone && completados < 60) { completados++; await completarTelefone(tenantId, p); await pausa(150); }
  }
  // perfil de cada paciente (agendado/ativo/em tratamento/finalizado/inativo) - nunca derruba a sincronizacao
  let perfil = { mapa: new Map(), avisos: [], contagem: null };
  try {
    perfil = await classificarPacientes(tenantId, pacientes, { mesesAtivo: (await obterConfig(tenantId)).mesesAtivo });
  } catch (err) {
    perfil.avisos.push(`Não consegui classificar os perfis (${err.message}).`);
  }
  for (const p of pacientes) {
    const perfis = perfil.mapa.get(p.chave);
    await pool.query(
      `INSERT INTO aniversariantes_envios (tenant_id, paciente_chave, nome, telefone, data_envio, status, perfis)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, paciente_chave, data_envio) DO UPDATE SET
         nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, perfis = COALESCE(EXCLUDED.perfis, aniversariantes_envios.perfis),
         status = CASE WHEN EXCLUDED.telefone <> '' AND aniversariantes_envios.status = 'sem_telefone' THEN 'pendente'
                       WHEN EXCLUDED.telefone = '' AND aniversariantes_envios.status = 'pendente' THEN 'sem_telefone'
                       ELSE aniversariantes_envios.status END
       WHERE aniversariantes_envios.status IN ('pendente','sem_telefone')`,
      [tenantId, p.chave, p.nome, p.telefone, `${ano}-${doisDig(mes)}-${doisDig(p.dia)}`, p.telefone ? 'pendente' : 'sem_telefone', perfis ? JSON.stringify(perfis) : null],
    );
  }
  const resumo = { quando: new Date().toISOString(), ano, mes, total: pacientes.length, semTelefone: pacientes.filter((p) => !p.telefone).length, camposVistos, falhas, modoMes, perfis: perfil.contagem, avisosPerfil: perfil.avisos };
  await pool.query(
    `INSERT INTO aniversariantes_config (tenant_id, ultima_sync) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET ultima_sync = $2`,
    [tenantId, JSON.stringify(resumo)],
  );
  return resumo;
}

// ---------- programacao do mes (o que a tela mostra) ----------

export async function listarMes(tenantId, ano, mes) {
  if (!pool) return [];
  await tabelasProntas;
  const ini = `${ano}-${doisDig(mes)}-01`;
  const { rows } = await pool.query(
    `SELECT id, nome, telefone, to_char(data_envio, 'YYYY-MM-DD') AS data_envio, mensagem, status, erro, enviado_em, perfis
     FROM aniversariantes_envios
     WHERE tenant_id = $1 AND data_envio >= $2::date AND data_envio < ($2::date + interval '1 month')
     ORDER BY data_envio, nome`,
    [tenantId, ini],
  );
  return rows;
}

export async function atualizarEnvio(tenantId, id, { mensagem, status }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const sets = [];
  const valores = [id, tenantId];
  if (mensagem !== undefined) {
    const t = String(mensagem || '').trim();
    if (t.length > 1500) throw new Error('A mensagem passou de 1500 caracteres.');
    valores.push(t || null); sets.push(`mensagem = $${valores.length}`);
  }
  if (status !== undefined) {
    // so da pra alternar entre pendente <-> pulado pela tela; o resto e controlado pelo envio
    if (!['pendente', 'pulado'].includes(status)) throw new Error('Status invalido.');
    valores.push(status); sets.push(`status = $${valores.length}`);
    sets.push(`erro = NULL`);
  }
  if (!sets.length) return;
  const { rowCount } = await pool.query(
    `UPDATE aniversariantes_envios SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 AND status IN ('pendente','pulado','falhou','sem_telefone')${status === 'pendente' ? " AND telefone <> ''" : ''}`,
    valores,
  );
  if (!rowCount) throw new Error('Nao foi possivel alterar (ja enviado, sem telefone ou nao encontrado).');
}

// ---------- montagem e envio ----------

const primeiroNome = (nome) => {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
};
const aplicarNome = (modelo, nome) => String(modelo).replace(/\{nome\}/gi, primeiroNome(nome) || 'tudo bem').replace(/\s+([!,.])/g, '$1');

const TOOL_MENSAGEM = {
  name: 'entregar_mensagem_aniversario',
  description: 'Entrega a mensagem final de aniversario a ser enviada pelo WhatsApp.',
  input_schema: { type: 'object', properties: { mensagem: { type: 'string', description: 'Texto pronto, ja com o nome da pessoa, sem aspas nem explicacoes.' } }, required: ['mensagem'] },
};

async function redigirComIa(tenantId, config, nome, modelo) {
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 400,
    tools: [TOOL_MENSAGEM], tool_choice: { type: 'tool', name: 'entregar_mensagem_aniversario' },
    messages: [{ role: 'user', content:
      `Voce escreve, em nome de uma clinica, a mensagem de WhatsApp de aniversario para um paciente.\n\n` +
      `Modelo da clinica (mantenha o sentido, o tom e as informacoes; reescreva com palavras um pouco diferentes pra nao sair identico pra todo mundo):\n"""${modelo}"""\n\n` +
      (config.instrucoesIa ? `Instrucoes extras da clinica: ${config.instrucoesIa}\n\n` : '') +
      `Nome do paciente: ${primeiroNome(nome)}\n` +
      `Regras: portugues do Brasil, caloroso e curto (ate 4 frases), use o primeiro nome, no maximo 2 emojis, NAO invente promocao, preco, horario ou qualquer informacao que nao esteja no modelo.` }],
    _uso: { tenantId, modulo: 'aniversariantes' },
  });
  const tool = resp.content.find((b) => b.type === 'tool_use');
  const texto = String(tool?.input?.mensagem || '').trim();
  if (!texto) throw new Error('a IA nao devolveu a mensagem');
  return texto;
}

async function montarMensagem(tenantId, config, envio) {
  // texto editado a mao pra esse paciente vai literal; o modelo geral pode ser reescrito pela IA
  if (envio.mensagem) return aplicarNome(envio.mensagem, envio.nome);
  const base = aplicarNome(config.mensagem, envio.nome);
  if (!config.usarIa) return base;
  try {
    return await redigirComIa(tenantId, config, envio.nome, base);
  } catch (err) {
    console.error(`Aniversariantes: IA falhou pro tenant ${tenantId}, usando o texto padrao:`, err.message);
    return base;
  }
}

async function instanciaDoTenant(tenantId) {
  const { instanciaAtiva } = await whatsappInstances.obterConfig(tenantId);
  if (!instanciaAtiva) throw new Error('Nenhum WhatsApp conectado - conecte um numero na aba WhatsApp.');
  return instanciaAtiva;
}

// envia 1 paciente. "reserva" a linha antes (so uma chamada ganha) pra nunca mandar em duplicidade.
export async function enviarEnvio(tenantId, id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const config = await obterConfig(tenantId);
  const instancia = await instanciaDoTenant(tenantId);
  const { rows } = await pool.query(
    `UPDATE aniversariantes_envios SET status = 'enviando', erro = NULL
     WHERE id = $1 AND tenant_id = $2 AND status IN ('pendente','falhou') AND telefone <> ''
     RETURNING id, nome, telefone, mensagem`,
    [id, tenantId],
  );
  if (!rows.length) throw new Error('Esse aniversariante nao esta pendente (ja enviado, pulado ou sem telefone).');
  const envio = rows[0];
  let texto;
  try {
    texto = await montarMensagem(tenantId, config, envio);
    await evolutionApi.enviarMensagemTextoPor(instancia, envio.telefone, texto);
  } catch (err) {
    await pool.query(`UPDATE aniversariantes_envios SET status = 'falhou', erro = $3 WHERE id = $1 AND tenant_id = $2`, [id, tenantId, String(err.message).slice(0, 300)]);
    throw err;
  }
  // texto ja saiu: a partir daqui o paciente foi parabenizado - falha de anexo so vira aviso
  const avisos = [];
  try {
    for (const arq of await arquivosComConteudo(tenantId)) {
      await pausa(1500 + Math.random() * 1500);
      try { await enviarArquivo(instancia, envio.telefone, arq); } catch (err) { avisos.push(`${arq.nome_arquivo}: ${err.message}`); }
    }
  } catch (err) { avisos.push(err.message); }
  await pool.query(
    `UPDATE aniversariantes_envios SET status = 'enviado', enviado_em = now(), erro = $3 WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId, avisos.length ? `Texto enviado, mas: ${avisos.join('; ').slice(0, 250)}` : null],
  );
  return { texto, avisos };
}

// manda a mensagem de exemplo (com os arquivos) so pro numero do proprio dono - pra ver como fica
// antes de ligar a automacao
export async function enviarTeste(tenantId, numero) {
  const telefone = normalizarTelefone(numero);
  if (!telefone) throw new Error('Informe o seu WhatsApp com DDD (ex: 82999998888).');
  const config = await obterConfig(tenantId);
  const instancia = await instanciaDoTenant(tenantId);
  const texto = await montarMensagem(tenantId, config, { nome: 'Maria', mensagem: null });
  await evolutionApi.enviarMensagemTextoPor(instancia, telefone, `[TESTE] ${texto}`);
  for (const arq of await arquivosComConteudo(tenantId)) {
    await pausa(1200);
    await enviarArquivo(instancia, telefone, arq);
  }
}

// ---------- agendador ----------

let rodando = false;

// 1 clinica: se ainda nao puxou os aniversariantes de hoje, puxa do Clinicorp (assim funciona mesmo
// sem apertar "Sincronizar"); depois, a partir da hora configurada, manda os pendentes de hoje que
// passam no filtro de perfil. Quem ficou pendente (ex: WhatsApp fora do ar) e retomado no mesmo dia;
// nunca manda aniversario de dia passado. pausaMs so existe pra o teste nao esperar 20-45s por paciente.
export async function processarTenant(tenantId, { pausaMs } = {}) {
  const config = await obterConfig(tenantId);
  if (!config.ativo || horaAgoraMaceio() < config.horaEnvio) return { enviados: 0, foraDoFiltro: 0 };
  const hoje = hojeMaceio();

  const sync = config.ultimaSync;
  const jaSincHoje = sync?.quando && sync.ano === hoje.ano && sync.mes === hoje.mes
    && new Date(sync.quando).toLocaleDateString('en-CA', { timeZone: 'America/Maceio' }) === hoje.iso;
  if (!jaSincHoje) {
    try { await sincronizarMes(tenantId, hoje.ano, hoje.mes); } catch (err) { console.error(`Aniversariantes: sincronizacao do tenant ${tenantId} falhou:`, err.message); }
  }

  const { rows: pendentes } = await pool.query(
    `SELECT id, perfis FROM aniversariantes_envios WHERE tenant_id = $1 AND data_envio = $2::date AND status = 'pendente' AND telefone <> '' ORDER BY id`,
    [tenantId, hoje.iso],
  );
  let enviados = 0;
  let foraDoFiltro = 0;
  for (const { id, perfis } of pendentes) {
    if (!passaNoFiltro(perfis, config.perfisFiltro)) { foraDoFiltro++; continue; }
    try {
      await enviarEnvio(tenantId, id);
      enviados++;
    } catch (err) {
      console.error(`Aniversariantes: envio ${id} (tenant ${tenantId}) falhou:`, err.message);
      if (err.codigo === 'CONTA_INATIVA' || /Nenhum WhatsApp conectado/.test(err.message)) break;
    }
    await pausa(pausaMs ?? 20000 + Math.random() * 25000); // 20-45s entre pacientes: nao parece disparo em massa
  }
  return { enviados, foraDoFiltro };
}

// a cada 5min, pra cada clinica com a automacao ligada
export function iniciarSchedulerAniversariantes() {
  const checar = async () => {
    if (rodando || !pool) return;
    rodando = true;
    try {
      await tabelasProntas;
      const { rows: tenantsAtivos } = await pool.query(
        `SELECT c.tenant_id FROM aniversariantes_config c JOIN tenants t ON t.id = c.tenant_id WHERE c.ativo = true AND (t.ativo OR t.super_admin)`,
      );
      for (const { tenant_id: tenantId } of tenantsAtivos) {
        try {
          await processarTenant(tenantId);
        } catch (err) {
          console.error(`Aniversariantes: erro no tenant ${tenantId}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando aniversariantes:', err.message);
    } finally {
      rodando = false;
    }
  };
  setInterval(checar, 5 * 60 * 1000).unref();
}
