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
import * as chamadas from './chamadas.js';

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
// funil dos PACIENTES que respondem a pesquisa (a CRM chama cada um pra pedir indicacao)
export const ETAPAS_RESP = [
  { id: 'nova', nome: 'Nova resposta' },
  { id: 'atencao', nome: 'Atenção (nota baixa)' },
  { id: 'contato', nome: 'Pedindo indicação' },
  { id: 'indicou', nome: 'Indicou' },
  { id: 'sem_indicacao', nome: 'Não vai indicar' },
];
const IDS_ETAPAS_RESP = new Set(ETAPAS_RESP.map((e) => e.id));
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
  // datas das 3 tentativas (Dia 1, Dia 2 e Dia 7 a partir da entrada, 09:00 de Maceio), alerta de retorno e pausa da IA
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS t1_em TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS t2_em TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS t3_em TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS retorno_em TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS retorno_nota TEXT`);
  await pool.query(`ALTER TABLE ind_indicados ADD COLUMN IF NOT EXISTS ia_pausada BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`
    UPDATE ind_indicados SET
      t1_em = ((date_trunc('day', criado_em AT TIME ZONE 'America/Maceio') + interval '1 day 9 hours') AT TIME ZONE 'America/Maceio'),
      t2_em = ((date_trunc('day', criado_em AT TIME ZONE 'America/Maceio') + interval '2 days 9 hours') AT TIME ZONE 'America/Maceio'),
      t3_em = ((date_trunc('day', criado_em AT TIME ZONE 'America/Maceio') + interval '7 days 9 hours') AT TIME ZONE 'America/Maceio')
    WHERE t1_em IS NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_tentativas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      indicado_id INT NOT NULL REFERENCES ind_indicados(id) ON DELETE CASCADE,
      n INT NOT NULL,
      resultado TEXT NOT NULL,
      obs TEXT,
      ligacao BOOLEAN NOT NULL DEFAULT false,
      feita_por TEXT,
      feita_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ind_tentativas_ind_idx ON ind_tentativas (indicado_id, n)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ind_notas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      indicado_id INT NOT NULL REFERENCES ind_indicados(id) ON DELETE CASCADE,
      autor_id INT NOT NULL DEFAULT 0,
      autor_nome TEXT,
      texto TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // funil dos pacientes da pesquisa + anotacoes tambem nas respostas
  await pool.query(`ALTER TABLE ind_respostas ADD COLUMN IF NOT EXISTS etapa TEXT NOT NULL DEFAULT 'nova'`);
  await pool.query(`UPDATE ind_respostas SET etapa = 'contato' WHERE contatado = true AND etapa = 'nova'`);
  await pool.query(`ALTER TABLE ind_notas ALTER COLUMN indicado_id DROP NOT NULL`);
  await pool.query(`ALTER TABLE ind_notas ADD COLUMN IF NOT EXISTS resposta_id INT REFERENCES ind_respostas(id) ON DELETE CASCADE`);
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

// 09:00 (Maceio, UTC-3) de hoje + N dias
function nove(dias) {
  const base = new Date(Date.now() - 3 * 3600000);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dias, 9 + 3, 0, 0));
}
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
    `INSERT INTO ind_indicados (tenant_id, indicador_id, nome, telefone, origem, observacao, criado_por, t1_em, t2_em, t3_em) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [tenantId, indicador.id, nomeIndicado, telIndicado, o, texto(observacao, 1000), texto(autor, 80), nove(1), nove(2), nove(7)],
  );
  if (indicador.telefone) {
    const vi = varianteNonoDigito(indicador.telefone);
    await pool.query(`UPDATE ind_respostas SET etapa = 'indicou' WHERE tenant_id = $1 AND telefone = ANY($2::text[]) AND etapa <> 'indicou'`, [tenantId, vi ? [indicador.telefone, vi] : [indicador.telefone]]);
  }
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
  await avancarTentativas();
  const { rows } = await pool.query(
    `SELECT i.id, i.nome, i.telefone, i.etapa, i.origem, i.ja_paciente, i.observacao, i.criado_por, i.criado_em, i.atualizado_em,
            i.t1_em, i.t2_em, i.t3_em, i.retorno_em, i.retorno_nota, i.ia_pausada, i.cadastrado_clinicorp_em,
            (SELECT count(*)::int FROM ind_notas n WHERE n.indicado_id = i.id) AS qtd_notas,
            ind.id AS indicador_id, ind.nome AS indicador_nome, ind.telefone AS indicador_telefone
       FROM ind_indicados i LEFT JOIN ind_indicadores ind ON ind.id = i.indicador_id
      WHERE i.tenant_id = $1 ORDER BY i.criado_em DESC LIMIT 3000`,
    [tenantId],
  );
  const { rows: respostas } = await pool.query(
    `SELECT id, nome, telefone, nota, indicaria, comentario, contatado, etapa, criado_em,
            (SELECT count(*)::int FROM ind_notas n WHERE n.resposta_id = ind_respostas.id) AS qtd_notas
       FROM ind_respostas WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 1000`,
    [tenantId],
  );
  const { rows: conta } = await pool.query(
    `SELECT ind.telefone, count(i.id)::int AS n FROM ind_indicadores ind JOIN ind_indicados i ON i.indicador_id = ind.id WHERE ind.tenant_id = $1 AND ind.telefone IS NOT NULL GROUP BY ind.telefone`,
    [tenantId],
  );
  const porTel = new Map(conta.map((c) => [c.telefone, c.n]));
  for (const r of respostas) { const v = varianteNonoDigito(r.telefone); r.qtd_indicados = (porTel.get(r.telefone) || 0) + (v ? (porTel.get(v) || 0) : 0); }
  const { rows: tent } = await pool.query(
    `SELECT t.indicado_id, t.n, t.resultado, t.obs, t.ligacao, t.feita_por, t.feita_em FROM ind_tentativas t JOIN ind_indicados i ON i.id = t.indicado_id WHERE i.tenant_id = $1 ORDER BY t.feita_em`,
    [tenantId],
  );
  const porId = new Map();
  for (const t of tent) { if (!porId.has(t.indicado_id)) porId.set(t.indicado_id, []); porId.get(t.indicado_id).push(t); }
  for (const r of rows) r.tentativas = porId.get(r.id) || [];
  return { indicados: rows, respostas };
}

export const RESULTADOS = {
  nao_atendeu: 'Não atendeu',
  agendou: 'Agendou',
  retornar: 'Pediu para retornar',
  sem_interesse: 'Sem interesse',
  numero_errado: 'Número errado',
};

// avanca sozinho pro quadro da proxima tentativa quando chega a data E a tentativa anterior foi registrada
// (mesma regra do Funil Follow Up: sem registrar a tentativa do dia, nao passa)
export async function avancarTentativas() {
  if (!pool) return;
  await tabelasProntas;
  await pool.query(`UPDATE ind_indicados SET etapa = 'tentativa1', atualizado_em = now() WHERE etapa = 'novo' AND t1_em <= now()`);
  await pool.query(`UPDATE ind_indicados i SET etapa = 'tentativa2', atualizado_em = now() WHERE etapa = 'tentativa1' AND t2_em <= now() AND EXISTS (SELECT 1 FROM ind_tentativas t WHERE t.indicado_id = i.id AND t.n = 1)`);
  await pool.query(`UPDATE ind_indicados i SET etapa = 'tentativa3', atualizado_em = now() WHERE etapa = 'tentativa2' AND t3_em <= now() AND EXISTS (SELECT 1 FROM ind_tentativas t WHERE t.indicado_id = i.id AND t.n = 2)`);
}
export function iniciarSchedulerIndicacoes() {
  const rodar = () => avancarTentativas().catch((err) => console.error('[indicacoes] avancar tentativas:', err.message));
  setTimeout(rodar, 25 * 1000).unref();
  setInterval(rodar, 60 * 1000).unref();
}

// registra a tentativa de contato (ligacao, mensagem...) e aplica o resultado
export async function registrarTentativa(tenantId, id, { resultado, obs, ligacao, duracaoSeg, retornoEm, autor }) {
  await tabelasProntas;
  if (!RESULTADOS[resultado]) throw new Error('Escolha o resultado da tentativa.');
  const { rows: [i] } = await pool.query('SELECT id, nome, telefone, etapa FROM ind_indicados WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!i) throw new Error('Indicado não encontrado.');
  if (['agendado', 'compareceu', 'sem_sucesso'].includes(i.etapa)) throw new Error('Esse indicado já está finalizado. Mova de etapa se precisar retomar.');
  const { rows: [c] } = await pool.query('SELECT count(*)::int AS n FROM ind_tentativas WHERE indicado_id = $1', [i.id]);
  const n = c.n + 1;
  if (n > 3) throw new Error('As 3 tentativas já foram registradas.');
  let retorno = null;
  if (resultado === 'retornar') {
    retorno = new Date(retornoEm);
    if (Number.isNaN(retorno.getTime()) || retorno.getTime() < Date.now() - 60000) throw new Error('Informe a data e hora do retorno (no futuro).');
  }
  await pool.query('INSERT INTO ind_tentativas (tenant_id, indicado_id, n, resultado, obs, ligacao, feita_por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tenantId, i.id, n, resultado, texto(obs, 1000), !!ligacao, texto(autor, 80)]);
  // proxima etapa
  let etapa = `tentativa${n}`;
  if (resultado === 'agendou') etapa = 'agendado';
  else if (resultado === 'sem_interesse' || resultado === 'numero_errado') etapa = 'sem_sucesso';
  else if (resultado === 'nao_atendeu' && n >= 3) etapa = 'sem_sucesso';
  await pool.query('UPDATE ind_indicados SET etapa = $3, atualizado_em = now(), retorno_em = $4, retorno_nota = $5 WHERE id = $1 AND tenant_id = $2', [i.id, tenantId, etapa, retorno, retorno ? texto(obs, 500) : null]);
  // ligacao feita pelo WhatsApp/celular entra no relatorio de ligacoes do numero responsavel
  if (ligacao) {
    const cfg = await obterConfig(tenantId);
    await chamadas.registrarChamadaManual(tenantId, {
      numero: i.telefone, nome: i.nome, direcao: 'feita', status: resultado === 'nao_atendeu' ? 'perdida' : 'atendida',
      duracaoSeg: Number(duracaoSeg) || 0, operadorNome: autor, obs: `Indicação - tentativa ${n}: ${RESULTADOS[resultado]}${obs ? ` - ${texto(obs, 200)}` : ''}`, instancia: cfg.instancia || 'manual',
    }).catch((err) => console.error('[indicacoes] registrar ligacao:', err.message));
  }
  return { ok: true, n, etapa };
}

// a IA da aba registra o resultado da conversa pra equipe (agendou / sem interesse / pedir retorno) + nota "IA: ..."
export async function registrarResultadoPelaIA(tenantId, id, { resultado, observacao, retornoEm }) {
  await tabelasProntas;
  const obs = texto(observacao, 500);
  const { rows: [i] } = await pool.query('SELECT id, etapa FROM ind_indicados WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!i) throw new Error('Indicado não encontrado.');
  let rotulo;
  if (resultado === 'agendou') { await pool.query(`UPDATE ind_indicados SET etapa = 'agendado', atualizado_em = now() WHERE id = $1`, [i.id]); rotulo = 'quer agendar'; }
  else if (resultado === 'sem_interesse') { await pool.query(`UPDATE ind_indicados SET etapa = 'sem_sucesso', atualizado_em = now() WHERE id = $1`, [i.id]); rotulo = 'sem interesse'; }
  else if (resultado === 'pedir_retorno') {
    const d = new Date(retornoEm);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 60000) throw new Error('Informe data e hora futuras para o retorno.');
    await pool.query('UPDATE ind_indicados SET retorno_em = $2, retorno_nota = $3, atualizado_em = now() WHERE id = $1', [i.id, d, obs]);
    rotulo = 'pediu retorno';
  } else throw new Error('Resultado inválido.');
  await pool.query('INSERT INTO ind_notas (tenant_id, indicado_id, autor_id, autor_nome, texto) VALUES ($1,$2,0,$3,$4)', [tenantId, i.id, 'IA', `Conversa com a IA: ${rotulo}${obs ? ` - ${obs}` : ''}`]);
  return { ok: true };
}

// alerta de retorno (como no CRM): data/hora combinada + nota; passa a destacar o card quando chega
export async function definirRetorno(tenantId, id, { retornoEm, nota }) {
  await tabelasProntas;
  const d = new Date(retornoEm);
  if (Number.isNaN(d.getTime())) throw new Error('Informe a data e hora do retorno.');
  const { rowCount } = await pool.query('UPDATE ind_indicados SET retorno_em = $3, retorno_nota = $4, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, d, texto(nota, 500)]);
  if (!rowCount) throw new Error('Indicado não encontrado.');
}
export async function limparRetorno(tenantId, id) {
  await tabelasProntas;
  await pool.query('UPDATE ind_indicados SET retorno_em = NULL, retorno_nota = NULL WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// ---------- anotacoes ----------
export async function listarNotas(tenantId, indicadoId) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, autor_id, autor_nome, texto, criado_em FROM ind_notas WHERE tenant_id = $1 AND indicado_id = $2 ORDER BY criado_em DESC, id DESC', [tenantId, Number(indicadoId)]);
  return rows;
}
export async function criarNota(tenantId, indicadoId, { texto: t, autorId, autorNome }) {
  await tabelasProntas;
  const corpo = String(t || '').trim().slice(0, 4000);
  if (!corpo) throw new Error('Escreva a anotação.');
  const { rows: [ok] } = await pool.query('SELECT 1 AS x FROM ind_indicados WHERE id = $1 AND tenant_id = $2', [Number(indicadoId), tenantId]);
  if (!ok) throw new Error('Indicado não encontrado.');
  const { rows: [n] } = await pool.query('INSERT INTO ind_notas (tenant_id, indicado_id, autor_id, autor_nome, texto) VALUES ($1,$2,$3,$4,$5) RETURNING id, autor_id, autor_nome, texto, criado_em', [tenantId, Number(indicadoId), Number(autorId) || 0, texto(autorNome, 80), corpo]);
  return n;
}
export async function apagarNota(tenantId, notaId, quemId) {
  await tabelasProntas;
  await pool.query('DELETE FROM ind_notas WHERE id = $1 AND tenant_id = $2 AND ($3::int = 0 OR autor_id = $3::int)', [Number(notaId), tenantId, Number(quemId) || 0]);
}

export async function moverEtapaResposta(tenantId, id, etapa) {
  if (!IDS_ETAPAS_RESP.has(etapa)) throw new Error('Etapa inválida.');
  await tabelasProntas;
  const { rowCount } = await pool.query('UPDATE ind_respostas SET etapa = $3, contatado = ($3 <> \'nova\' AND $3 <> \'atencao\') WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, etapa]);
  if (!rowCount) throw new Error('Resposta não encontrada.');
}
export async function listarNotasResposta(tenantId, id) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, autor_id, autor_nome, texto, criado_em FROM ind_notas WHERE tenant_id = $1 AND resposta_id = $2 ORDER BY criado_em DESC, id DESC', [tenantId, Number(id)]);
  return rows;
}
export async function criarNotaResposta(tenantId, id, { texto: t, autorId, autorNome }) {
  await tabelasProntas;
  const corpo = String(t || '').trim().slice(0, 4000);
  if (!corpo) throw new Error('Escreva a anotação.');
  const { rows: [ok] } = await pool.query('SELECT 1 AS x FROM ind_respostas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!ok) throw new Error('Resposta não encontrada.');
  const { rows: [n] } = await pool.query('INSERT INTO ind_notas (tenant_id, resposta_id, autor_id, autor_nome, texto) VALUES ($1,$2,$3,$4,$5) RETURNING id, autor_id, autor_nome, texto, criado_em', [tenantId, Number(id), Number(autorId) || 0, texto(autorNome, 80), corpo]);
  return n;
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
  let respostaId = null;
  await pool.query(
    'INSERT INTO ind_respostas (tenant_id, nome, telefone, nota, indicaria, comentario, etapa) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [t.id, nome, tel, nota, corpo.indicaria, texto(corpo?.comentario, 2000), nota <= 6 ? 'atencao' : 'nova'],
  ).then(async (r) => { respostaId = r.rows[0].id; });
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
  if (indicados > 0 && respostaId) await pool.query(`UPDATE ind_respostas SET etapa = 'indicou' WHERE id = $1`, [respostaId]);
  return { ok: true, indicados };
}
