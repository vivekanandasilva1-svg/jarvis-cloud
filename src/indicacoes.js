// Controle de Indicacoes (aba "Indicacoes"): pacientes (indicadores) que indicam outras pessoas (indicados).
// O indicado entra por 4 caminhos - cadastro individual, planilha, formulario publico (link da clinica enviado
// pelo WhatsApp) ou recepcao (cadastro individual com origem "recepcao") - e cai no mesmo quadro, sem repetir
// (o mesmo telefone, com ou sem o 9, e um unico indicado por clinica). A CRM de indicacoes trabalha o quadro:
// Novo -> 1a tentativa (dia 1) -> 2a (dia 2) -> 3a (dia 7) -> Agendado -> Compareceu / Sem sucesso.
// O link publico da clinica e uma PESQUISA DE SATISFACAO (nome, telefone, nota 0-10, "nos indicaria?", sugestao/elogio/
// reclamacao); quem diz que indicaria vira um indicador em potencial pra CRM de indicacoes contatar.
// Tudo isolado por tenant. O Clinicorp so e consultado/escrito sob demanda (limite de 25 requisicoes/hora).
import crypto from 'node:crypto';
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { normalizarTelefone, varianteNonoDigito } from './crm.js';
import * as clinicorp from './clinicorp.js';

export const ETAPAS = [
  { id: 'novo', nome: 'Novo indicado' },
  { id: 'tentativa1', nome: '1ª tentativa (Dia 1)' },
  { id: 'tentativa2', nome: '2ª tentativa (Dia 2)' },
  { id: 'tentativa3', nome: '3ª tentativa (Dia 7)' },
  { id: 'agendado', nome: 'Agendado' },
  { id: 'compareceu', nome: 'Compareceu' },
  { id: 'sem_sucesso', nome: 'Sem sucesso' },
];
const IDS_ETAPAS = new Set(ETAPAS.map((e) => e.id));
export const ORIGENS = { recepcao: 'Recepção', formulario: 'Formulário', lista: 'Lista', individual: 'Cadastro individual' };

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      token TEXT NOT NULL UNIQUE,
      instancia TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_indicadores (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome TEXT NOT NULL,
      telefone TEXT,
      clinicorp_id TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ind_indicadores_tel_idx ON ind_indicadores (tenant_id, telefone)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_indicados (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      indicador_id INT REFERENCES ind_indicadores(id) ON DELETE SET NULL,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      etapa TEXT NOT NULL DEFAULT 'novo',
      origem TEXT NOT NULL DEFAULT 'individual',
      ja_paciente BOOLEAN,
      clinicorp_id TEXT,
      observacao TEXT,
      criado_por TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, telefone)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ind_indicados_tenant_idx ON ind_indicados (tenant_id, etapa)`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS cadastrado_clinicorp_em TIMESTAMPTZ`);
  // respostas da pesquisa de satisfacao (formulario publico)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_respostas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      nota INT NOT NULL,
      indicaria BOOLEAN NOT NULL,
      comentario TEXT,
      contatado BOOLEAN NOT NULL DEFAULT false,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ind_respostas_tenant_idx ON ind_respostas (tenant_id, criado_em DESC)`);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('[indicacoes] erro criando tabelas:', err.message));

const texto = (v, max) => { const t = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return t || null; };

export async function obterConfig(tenantId) {
  if (!pool) return { token: null, instancia: null };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT token, instancia FROM ind_config WHERE tenant_id = $1', [tenantId]);
  if (rows[0]) return rows[0];
  const token = crypto.randomBytes(12).toString('hex');
  await pool.query('INSERT INTO ind_config (tenant_id, token) VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING', [tenantId, token]);
  const { rows: r2 } = await pool.query('SELECT token, instancia FROM ind_config WHERE tenant_id = $1', [tenantId]);
  return r2[0];
}

// acha (ou cria) o indicador: pelo telefone (com/sem o 9) ou, sem telefone, pelo nome exato
async function acharOuCriarIndicador(tenantId, nome, telefone) {
  const tel = telefone ? normalizarTelefone(telefone) : null;
  if (tel) {
    const v = varianteNonoDigito(tel);
    const { rows } = await pool.query('SELECT id FROM ind_indicadores WHERE tenant_id = $1 AND telefone = ANY($2::text[]) ORDER BY id LIMIT 1', [tenantId, v ? [tel, v] : [tel]]);
    if (rows[0]) return { id: rows[0].id, telefone: tel };
  } else {
    const { rows } = await pool.query('SELECT id FROM ind_indicadores WHERE tenant_id = $1 AND lower(nome) = lower($2) ORDER BY id LIMIT 1', [tenantId, nome]);
    if (rows[0]) return { id: rows[0].id, telefone: null };
  }
  const { rows: [novo] } = await pool.query('INSERT INTO ind_indicadores (tenant_id, nome, telefone) VALUES ($1,$2,$3) RETURNING id', [tenantId, nome, tel]);
  return { id: novo.id, telefone: tel };
}

// cadastra UMA indicacao. Devolve { ok, id } ou { duplicado, indicadoPor, ... } - nunca repete o mesmo telefone
export async function cadastrarIndicacao(tenantId, { indicadorNome, indicadorTelefone, indicadoNome, indicadoTelefone, origem = 'individual', observacao, autor }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const nomeIndicado = texto(indicadoNome, 120);
  const telIndicado = normalizarTelefone(indicadoTelefone);
  if (!nomeIndicado) throw new Error('Informe o nome do indicado.');
  if (!telIndicado) throw new Error('Telefone do indicado inválido - use DDD + número.');
  const nomeIndicador = texto(indicadorNome, 120);
  if (!nomeIndicador) throw new Error('Informe quem indicou.');
  const indicador = await acharOuCriarIndicador(tenantId, nomeIndicador, indicadorTelefone);
  if (indicador.telefone && (indicador.telefone === telIndicado || varianteNonoDigito(indicador.telefone) === telIndicado)) throw new Error('O indicado não pode ser a própria pessoa que indicou.');
  const v = varianteNonoDigito(telIndicado);
  const { rows: ex } = await pool.query(
    `SELECT i.id, i.nome, i.etapa, ind.nome AS indicador_nome FROM ind_indicados i LEFT JOIN ind_indicadores ind ON ind.id = i.indicador_id
      WHERE i.tenant_id = $1 AND i.telefone = ANY($2::text[]) LIMIT 1`,
    [tenantId, v ? [telIndicado, v] : [telIndicado]],
  );
  if (ex[0]) return { duplicado: true, id: ex[0].id, nome: ex[0].nome, etapa: ex[0].etapa, indicadoPor: ex[0].indicador_nome };
  const o = ORIGENS[origem] ? origem : 'individual';
  const { rows: [novo] } = await pool.query(
    `INSERT INTO ind_indicados (tenant_id, indicador_id, nome, telefone, origem, observacao, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, indicador.id, nomeIndicado, telIndicado, o, texto(observacao, 1000), texto(autor, 80)],
  );
  return { ok: true, id: novo.id };
}

export async function importarLista(tenantId, linhas, autor) {
  if (!Array.isArray(linhas) || !linhas.length) throw new Error('Nenhuma linha na lista.');
  const r = { novos: 0, duplicados: 0, invalidos: 0, erros: [] };
  const vistos = new Set();
  for (const l of linhas.slice(0, 1000)) {
    const tel = normalizarTelefone(l?.indicadoTelefone);
    const chave = tel && /^55\d{2}[6-9]\d{7}$/.test(tel) ? `${tel.slice(0, 4)}9${tel.slice(4)}` : tel;
    if (chave && vistos.has(chave)) { r.duplicados++; continue; }
    if (chave) vistos.add(chave);
    try {
      const x = await cadastrarIndicacao(tenantId, { ...l, origem: 'lista', autor });
      if (x.duplicado) r.duplicados++; else r.novos++;
    } catch (err) {
      r.invalidos++;
      if (r.erros.length < 5) r.erros.push(`${texto(l?.indicadoNome, 40) || '(sem nome)'}: ${err.message}`);
    }
  }
  return r;
}

export async function listar(tenantId) {
  if (!pool) return { indicados: [] };
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT i.id, i.nome, i.telefone, i.etapa, i.origem, i.ja_paciente, i.observacao, i.criado_por, i.criado_em, i.atualizado_em,
            ind.id AS indicador_id, ind.nome AS indicador_nome, ind.telefone AS indicador_telefone
       FROM ind_indicados i LEFT JOIN ind_indicadores ind ON ind.id = i.indicador_id
      WHERE i.tenant_id = $1 ORDER BY i.criado_em DESC LIMIT 3000`,
    [tenantId],
  );
  const { rows: respostas } = await pool.query(
    'SELECT id, nome, telefone, nota, indicaria, comentario, contatado, criado_em FROM ind_respostas WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 1000',
    [tenantId],
  );
  return { indicados: rows, respostas };
}

export async function marcarRespostaContatada(tenantId, id, contatado) {
  await tabelasProntas;
  await pool.query('UPDATE ind_respostas SET contatado = $3 WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, !!contatado]);
}
export async function apagarResposta(tenantId, id) {
  await tabelasProntas;
  await pool.query('DELETE FROM ind_respostas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// cadastro OPCIONAL no Clinicorp (so quando a CRM clica): cria o indicado como paciente com a observacao de quem indicou
export async function cadastrarNoClinicorp(tenantId, id) {
  await tabelasProntas;
  const { rows: [i] } = await pool.query(
    `SELECT i.id, i.nome, i.telefone, i.ja_paciente, i.cadastrado_clinicorp_em, ind.nome AS indicador_nome FROM ind_indicados i LEFT JOIN ind_indicadores ind ON ind.id = i.indicador_id WHERE i.id = $1 AND i.tenant_id = $2`,
    [Number(id), tenantId],
  );
  if (!i) throw new Error('Indicado não encontrado.');
  if (i.ja_paciente) throw new Error('Esse indicado já é paciente no Clinicorp.');
  if (i.cadastrado_clinicorp_em) throw new Error('Esse indicado já foi cadastrado no Clinicorp.');
  const celular = Number(i.telefone.replace(/^55/, ''));
  try {
    await clinicorp.createPatient(tenantId, { name: i.nome, mobilePhone: celular, notes: `Indicado por ${i.indicador_nome || 'paciente'} (cadastrado pela Lumia - Indicações)` });
  } catch (err) {
    if (/nao tem o Clinicorp conectado/i.test(err.message)) throw err;
    if (/429|limite|requisi/i.test(err.message)) throw new Error('O Clinicorp limita as consultas por hora - tente de novo daqui a pouco.');
    throw new Error(`O Clinicorp não aceitou o cadastro: ${err.message}`);
  }
  await pool.query('UPDATE ind_indicados SET cadastrado_clinicorp_em = now(), ja_paciente = true, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [i.id, tenantId]);
  return { ok: true };
}

export async function moverEtapa(tenantId, id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error('Etapa inválida.');
  await tabelasProntas;
  const { rowCount } = await pool.query('UPDATE ind_indicados SET etapa = $3, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, etapa]);
  if (!rowCount) throw new Error('Indicado não encontrado.');
}

export async function editar(tenantId, id, { nome, observacao }) {
  await tabelasProntas;
  const n = texto(nome, 120);
  if (!n) throw new Error('Informe o nome.');
  const { rowCount } = await pool.query('UPDATE ind_indicados SET nome = $3, observacao = $4, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, n, texto(observacao, 1000)]);
  if (!rowCount) throw new Error('Indicado não encontrado.');
}

export async function apagar(tenantId, id) {
  await tabelasProntas;
  await pool.query('DELETE FROM ind_indicados WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// numero de WhatsApp responsavel pelas Indicacoes (escolhido entre os numeros conectados da conta; null = nenhum)
export async function definirInstancia(tenantId, instancia, instanciasDaConta) {
  await tabelasProntas;
  const nome = instancia ? String(instancia) : null;
  if (nome && !(instanciasDaConta || []).includes(nome)) throw new Error('Escolha um número de WhatsApp desta conta.');
  await obterConfig(tenantId); // garante a linha (e o token)
  await pool.query('UPDATE ind_config SET instancia = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, nome]);
}

// consulta o Clinicorp (1 requisicao) pra saber se o indicado JA e paciente - so quando alguem clica
export async function conferirNoClinicorp(tenantId, id) {
  await tabelasProntas;
  const { rows: [i] } = await pool.query('SELECT id, telefone FROM ind_indicados WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!i) throw new Error('Indicado não encontrado.');
  const local = i.telefone.replace(/^55/, '');
  let paciente = null;
  try {
    const r = await clinicorp.findPatient(tenantId, { phone: local });
    // a busca por telefone devolve uma LISTA de pacientes (ou um objeto, dependendo do caso)
    const candidatos = Array.isArray(r) ? r : (r ? [r] : []);
    paciente = candidatos.find((x) => x && (x.PatientId || x.Name)) || null;
  } catch (err) {
    if (/nao tem o Clinicorp conectado/i.test(err.message)) throw err;
    if (/429|limite|requisi/i.test(err.message)) throw new Error('O Clinicorp limita as consultas por hora - tente de novo daqui a pouco.');
    paciente = null; // "nao encontrado" ou formato sem retorno = nao e paciente
  }
  await pool.query('UPDATE ind_indicados SET ja_paciente = $3, clinicorp_id = $4, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [i.id, tenantId, !!paciente, paciente?.PatientId ? String(paciente.PatientId) : null]);
  return { jaPaciente: !!paciente, nomeNoClinicorp: paciente?.Name || null };
}

// ---------- formulario publico (link da clinica, sem login) ----------
const limitePorIp = new Map(); // ip -> [timestamps]
function limitarIp(ip) {
  const agora = Date.now();
  const lista = (limitePorIp.get(ip) || []).filter((t) => agora - t < 3600000);
  if (lista.length >= 8) return false;
  lista.push(agora);
  limitePorIp.set(ip, lista);
  return true;
}

async function tenantDoToken(token) {
  if (!pool || !/^[a-f0-9]{24}$/.test(String(token || ''))) return null;
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT t.id, t.nome FROM ind_config c JOIN tenants t ON t.id = c.tenant_id WHERE c.token = $1 AND (t.ativo OR t.super_admin)`,
    [token],
  );
  return rows[0] || null;
}

export async function infoPublica(token) {
  const t = await tenantDoToken(token);
  return t ? { clinica: t.nome } : null;
}

export async function registrarPublico(token, corpo, ip) {
  const t = await tenantDoToken(token);
  if (!t) throw new Error('Link inválido ou desativado.');
  if (corpo?.site) return { ok: true, indicados: 0 }; // honeypot: robo preenche, finge sucesso
  if (!limitarIp(ip || 'x')) throw new Error('Muitos envios deste aparelho. Tente novamente mais tarde.');
  const nome = texto(corpo?.nome, 120);
  const tel = normalizarTelefone(corpo?.telefone);
  const nota = Number(corpo?.nota);
  if (!nome || nome.split(' ').length < 2) throw new Error('Informe o seu nome completo.');
  if (!tel) throw new Error('Informe o seu telefone com DDD.');
  if (!Number.isInteger(nota) || nota < 0 || nota > 10) throw new Error('Escolha uma nota de 0 a 10.');
  if (typeof corpo?.indicaria !== 'boolean') throw new Error('Responda se nos indicaria.');
  await pool.query(
    'INSERT INTO ind_respostas (tenant_id, nome, telefone, nota, indicaria, comentario) VALUES ($1,$2,$3,$4,$5,$6)',
    [t.id, nome, tel, nota, corpo.indicaria, texto(corpo?.comentario, 2000)],
  );
  // se quis ja indicar alguem agora (opcional), entra no funil como "formulario"
  let indicados = 0;
  if (corpo.indicaria && Array.isArray(corpo?.indicados)) {
    for (const x of corpo.indicados.slice(0, 3).filter((y) => y && (y.nome || y.telefone))) {
      try {
        const r = await cadastrarIndicacao(t.id, { indicadorNome: nome, indicadorTelefone: tel, indicadoNome: x.nome, indicadoTelefone: x.telefone, origem: 'formulario', autor: 'Formulário' });
        if (r.ok) indicados++;
      } catch { /* indicado invalido: ignora, a pesquisa ja foi salva */ }
    }
  }
  return { ok: true, indicados };
}
