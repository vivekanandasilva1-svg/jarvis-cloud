// Resgate de orcamentos (aba "Resgate de orcamentos"): acha, no Clinicorp, pacientes com orcamento APROVADO que
// ficou pela metade (parte dos procedimentos executados, o resto parado) - ou aprovado e nunca iniciado - e monta o
// funil pra CRM retomar o contato e fechar o restante. O Clinicorp informa por procedimento se foi executado
// (Executed = "X", ExecutedDate), entao a deteccao e automatica. So a EQUIPE atende (sem IA).
// Leitura no Clinicorp em lotes pequenos (limite de 25 requisicoes/hora): a cada rodada olha o periodo mais recente e
// avanca um pouco no historico (ate 12 meses). Tudo isolado por tenant.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { normalizarTelefone, varianteNonoDigito } from './crm.js';
import * as clinicorp from './clinicorp.js';
import * as tenantConfig from './tenantConfig.js';

export const ETAPAS = [
  { id: 'sem_inicio', nome: 'Aprovado sem iniciar' },
  { id: 'novo', nome: 'Inacabados (novos)' },
  { id: 'tentativa1', nome: '1ª tentativa' },
  { id: 'tentativa2', nome: '2ª tentativa' },
  { id: 'tentativa3', nome: '3ª tentativa' },
  { id: 'agendou', nome: 'Agendou retomada' },
  { id: 'retomou', nome: 'Retomou o tratamento' },
  { id: 'sem_sucesso', nome: 'Sem sucesso' },
];
const IDS_ETAPAS = new Set(ETAPAS.map((e) => e.id));
export const RESULTADOS = {
  nao_atendeu: 'Não atendeu',
  vai_pensar: 'Falou, vai pensar',
  retornar: 'Pediu para retornar',
  agendou: 'Agendou a retomada',
  sem_interesse: 'Sem interesse / não vai continuar',
  numero_errado: 'Número errado',
};
export const MSG_PADRAO = 'Olá, {nome}! Aqui é da clínica. Vimos que o seu tratamento ficou com etapas pendentes ({pendentes}) e queremos ajudar você a concluir com todo o cuidado. Posso te passar os horários disponíveis?';
const JANELAS_MESES = 12;
const DIA = 86400000;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS res_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      operador_id INT,
      msg_whatsapp TEXT,
      cursor_janela INT NOT NULL DEFAULT 1,
      ultima_sync TIMESTAMPTZ,
      ultimo_resumo TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS res_pacientes (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      orcamento_id TEXT NOT NULL,
      patient_id TEXT,
      nome TEXT,
      telefone TEXT,
      profissional TEXT,
      aprovado_em TIMESTAMPTZ,
      ultima_execucao_em TIMESTAMPTZ,
      procs_total INT NOT NULL DEFAULT 0,
      procs_feitos INT NOT NULL DEFAULT 0,
      valor_total NUMERIC NOT NULL DEFAULT 0,
      valor_pendente NUMERIC NOT NULL DEFAULT 0,
      feitos JSONB NOT NULL DEFAULT '[]'::jsonb,
      faltam JSONB NOT NULL DEFAULT '[]'::jsonb,
      categoria TEXT NOT NULL DEFAULT 'parcial',
      etapa TEXT NOT NULL DEFAULT 'novo',
      proxima_consulta_em TIMESTAMPTZ,
      retorno_em TIMESTAMPTZ,
      retorno_nota TEXT,
      retomou_em TIMESTAMPTZ,
      concluido_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, orcamento_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS res_pacientes_tenant_idx ON res_pacientes (tenant_id, etapa)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS res_tentativas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      resgate_id INT NOT NULL REFERENCES res_pacientes(id) ON DELETE CASCADE,
      n INT NOT NULL,
      resultado TEXT NOT NULL,
      obs TEXT,
      ligacao BOOLEAN NOT NULL DEFAULT false,
      feita_por TEXT,
      feita_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS res_notas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      resgate_id INT NOT NULL REFERENCES res_pacientes(id) ON DELETE CASCADE,
      autor_id INT NOT NULL DEFAULT 0,
      autor_nome TEXT,
      texto TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('[resgate] erro criando tabelas:', err.message));

const texto = (v, max) => { const t = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return t || null; };

// ---------- analise de um orcamento ----------
export function analisarOrcamento(o) {
  const procs = (o?.ProcedureList || []).filter((p) => !p.Deleted && !p.NotApproved);
  if (!procs.length) return null;
  const valor = (p) => Number(p.FinalAmount ?? p.Amount) || 0;
  const feitos = procs.filter((p) => p.Executed === 'X');
  const faltam = procs.filter((p) => p.Executed !== 'X');
  const datas = feitos.map((p) => new Date(p.ExecutedDate)).filter((d) => !Number.isNaN(d.getTime()));
  const valorPendente = faltam.reduce((a, p) => a + valor(p), 0);
  return {
    totalProcs: procs.length, feitosN: feitos.length, faltamN: faltam.length,
    valorTotal: procs.reduce((a, p) => a + valor(p), 0), valorPendente,
    ultimaExecucao: datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null,
    feitos: feitos.map((p) => ({ d: String(p.OperationDescription || '').slice(0, 120), data: p.ExecutedDate || null })),
    faltam: faltam.map((p) => ({ d: String(p.OperationDescription || '').slice(0, 120), v: valor(p) })),
    // sobrou so item de R$ 0 (ex.: tomografia de cortesia): nao e orcamento inacabado
    completo: faltam.length === 0 || valorPendente <= 0,
    categoria: feitos.length ? 'parcial' : 'sem_inicio',
  };
}

// grava/atualiza as linhas a partir dos orcamentos APROVADOS lidos do Clinicorp
async function processarOrcamentos(tenantId, aprovados) {
  const r = { novos: 0, atualizados: 0, retomaram: 0, concluidos: 0 };
  for (const o of aprovados) {
    const a = analisarOrcamento(o);
    if (!a) continue;
    const id = String(o.id);
    const { rows: [ex] } = await pool.query('SELECT id, etapa, procs_feitos, concluido_em FROM res_pacientes WHERE tenant_id = $1 AND orcamento_id = $2', [tenantId, id]);
    if (a.completo) {
      // terminou o tratamento: se estava no resgate, vai pra "Retomou" e para de contar como pendente
      if (ex && !ex.concluido_em) { await pool.query(`UPDATE res_pacientes SET concluido_em = now(), retomou_em = COALESCE(retomou_em, now()), etapa = 'retomou', valor_pendente = 0, procs_feitos = $2, atualizado_em = now() WHERE id = $1`, [ex.id, a.feitosN]); r.concluidos++; }
      continue;
    }
    const tel = normalizarTelefone(o.PatientMobilePhone);
    const dados = [String(o.PatientId || ''), texto(o.PatientName, 120), tel, texto(o.ProfessionalName, 120), o.ApprovedDate || o.Date || null, a.ultimaExecucao, a.totalProcs, a.feitosN, a.valorTotal, a.valorPendente, JSON.stringify(a.feitos), JSON.stringify(a.faltam), a.categoria];
    if (!ex) {
      await pool.query(
        `INSERT INTO res_pacientes (tenant_id, orcamento_id, patient_id, nome, telefone, profissional, aprovado_em, ultima_execucao_em, procs_total, procs_feitos, valor_total, valor_pendente, feitos, faltam, categoria, etapa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)`,
        [tenantId, id, ...dados, a.categoria === 'parcial' ? 'novo' : 'sem_inicio'],
      );
      r.novos++;
    } else {
      // executou algo NOVO depois que entrou no resgate = retomou o tratamento
      const retomou = a.feitosN > ex.procs_feitos && ex.etapa !== 'retomou';
      await pool.query(
        `UPDATE res_pacientes SET patient_id=$3, nome=$4, telefone=$5, profissional=$6, aprovado_em=$7, ultima_execucao_em=$8, procs_total=$9, procs_feitos=$10, valor_total=$11, valor_pendente=$12, feitos=$13::jsonb, faltam=$14::jsonb, categoria=$15,
                etapa = CASE WHEN $16 THEN 'retomou' ELSE etapa END, retomou_em = CASE WHEN $16 THEN now() ELSE retomou_em END, atualizado_em = now()
         WHERE id = $1 AND tenant_id = $2`,
        [ex.id, tenantId, ...dados, retomou],
      );
      r.atualizados++;
      if (retomou) r.retomaram++;
    }
  }
  return r;
}

// quem ja tem consulta marcada nos proximos 30 dias (casa por telefone)
async function marcarConsultas(tenantId) {
  const hoje = new Date(Date.now() - 3 * 3600000);
  const de = hoje.toISOString().slice(0, 10);
  const ate = new Date(hoje.getTime() + 30 * DIA).toISOString().slice(0, 10);
  const lista = await clinicorp.listAppointments(tenantId, { from: de, to: ate });
  const porTel = new Map();
  for (const a of lista) {
    if (a.Canceled || a.Deleted || !a.PatientName) continue;
    const tel = normalizarTelefone(a.MobilePhone);
    if (!tel) continue;
    const d = new Date(a.AtomicDate || a.date);
    if (Number.isNaN(d.getTime())) continue;
    const atual = porTel.get(tel);
    if (!atual || d < atual) porTel.set(tel, d);
  }
  await pool.query('UPDATE res_pacientes SET proxima_consulta_em = NULL WHERE tenant_id = $1', [tenantId]);
  for (const [tel, d] of porTel) {
    const v = varianteNonoDigito(tel);
    await pool.query('UPDATE res_pacientes SET proxima_consulta_em = $3 WHERE tenant_id = $1 AND telefone = ANY($2::text[])', [tenantId, v ? [tel, v] : [tel], d]);
  }
  return porTel.size;
}

// conta que divide o MESMO Clinicorp com outra conta de cliente nao sincroniza (evita puxar pacientes de outra clinica)
async function contaDonaDoClinicorp(tenantId) {
  const { rows } = await pool.query(
    `SELECT t.id FROM tenants t JOIN tenant_config c ON c.tenant_id = t.id
      WHERE t.id = $1 AND c.clinicorp_api_user IS NOT NULL AND c.clinicorp_ativo
        AND NOT EXISTS (SELECT 1 FROM tenants t2 JOIN tenant_config c2 ON c2.tenant_id = t2.id
           WHERE t2.id <> t.id AND t2.ativo AND c2.clinicorp_api_user IS NOT NULL AND c2.clinicorp_ativo AND c2.clinicorp_subscriber_id = c.clinicorp_subscriber_id
             AND ((t.super_admin AND NOT t2.super_admin) OR (t.super_admin = t2.super_admin AND t2.id < t.id)))`,
    [tenantId],
  );
  return rows.length > 0;
}

const emSync = new Set();
// uma rodada: periodo mais recente + alguns meses do historico (cursor circular) + agenda futura
export async function sincronizar(tenantId, { janelas = 3 } = {}) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  if (emSync.has(tenantId)) throw new Error('Já existe uma atualização em andamento. Aguarde um instante.');
  if (!(await tenantConfig.obterClinicorp(tenantId))) throw new Error('Esta conta não tem o Clinicorp conectado.');
  if (!(await contaDonaDoClinicorp(tenantId))) throw new Error('Esta conta divide o Clinicorp com outra conta, então a atualização roda só na conta dona dele.');
  emSync.add(tenantId);
  try {
    const cfg = await obterConfig(tenantId);
    const lista = [0];
    let cursor = cfg.cursor_janela || 1;
    while (lista.length < janelas) { lista.push(cursor); cursor = cursor >= JANELAS_MESES - 1 ? 1 : cursor + 1; }
    const hoje = new Date(Date.now() - 3 * 3600000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const aprovados = new Map();
    let erro = null;
    for (const k of lista) {
      const ate = new Date(hoje.getTime() - k * 31 * DIA), de = new Date(ate.getTime() - 30 * DIA);
      try {
        const orc = await clinicorp.listEstimates(tenantId, { from: iso(de), to: iso(ate) });
        for (const o of orc) if (o.Status === 'APPROVED') aprovados.set(String(o.id), o);
      } catch (err) { erro = err.message; break; }
      await new Promise((res) => setTimeout(res, 600));
    }
    const proc = await processarOrcamentos(tenantId, [...aprovados.values()]);
    let comConsulta = 0;
    if (!erro) { try { comConsulta = await marcarConsultas(tenantId); } catch (err) { erro = erro || err.message; } }
    const resumo = `${aprovados.size} orçamentos aprovados lidos (${lista.length} períodos): ${proc.novos} novos, ${proc.atualizados} atualizados, ${proc.retomaram} retomaram, ${proc.concluidos} concluídos${erro ? ` — parou com aviso: ${erro}` : ''}`;
    await pool.query('UPDATE res_config SET cursor_janela = $2, ultima_sync = now(), ultimo_resumo = $3 WHERE tenant_id = $1', [tenantId, cursor, resumo]);
    return { ...proc, lidos: aprovados.size, comConsulta, erro, resumo };
  } finally { emSync.delete(tenantId); }
}

export function iniciarSchedulerResgate() {
  const rodar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const { rows } = await pool.query('SELECT tenant_id FROM res_config');
      for (const { tenant_id: t } of rows) {
        try {
          const habilitadas = await tenantConfig.obterTabsHabilitadas(t);
          if (habilitadas && habilitadas.length && !habilitadas.includes('resgateOrcamentos')) continue; // aba nao liberada pra essa conta
          await sincronizar(t, { janelas: 3 });
        } catch (err) { if (!/Clinicorp|dona dele|andamento/.test(err.message)) console.error('[resgate] sync tenant', t, err.message); }
      }
    } catch (err) { console.error('[resgate] scheduler:', err.message); }
  };
  setTimeout(rodar, 3 * 60 * 1000).unref();
  setInterval(rodar, 30 * 60 * 1000).unref();
}

// ---------- configuracao ----------
export async function obterConfig(tenantId) {
  await tabelasProntas;
  await pool.query('INSERT INTO res_config (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING', [tenantId]);
  const { rows: [c] } = await pool.query('SELECT operador_id, msg_whatsapp, cursor_janela, ultima_sync, ultimo_resumo FROM res_config WHERE tenant_id = $1', [tenantId]);
  return c;
}
export async function definirOperador(tenantId, operadorId, operadoresDaConta) {
  await tabelasProntas;
  const op = operadorId === null || operadorId === undefined || operadorId === '' ? null : Number(operadorId);
  if (op !== null && !(operadoresDaConta || []).some((o) => o.id === op)) throw new Error('Operador não encontrado (ou desativado).');
  await obterConfig(tenantId);
  await pool.query('UPDATE res_config SET operador_id = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, op]);
}
export async function salvarMensagem(tenantId, msg) {
  await tabelasProntas;
  const m = String(msg ?? '').trim().slice(0, 1000) || null;
  await obterConfig(tenantId);
  await pool.query('UPDATE res_config SET msg_whatsapp = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, m]);
}

// ---------- quadro ----------
export async function listar(tenantId) {
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, orcamento_id, patient_id, nome, telefone, profissional, aprovado_em, ultima_execucao_em, procs_total, procs_feitos, valor_total::float AS valor_total, valor_pendente::float AS valor_pendente,
            feitos, faltam, categoria, etapa, proxima_consulta_em, retorno_em, retorno_nota, retomou_em, concluido_em, criado_em, atualizado_em,
            GREATEST(0, floor(extract(epoch FROM (now() - COALESCE(ultima_execucao_em, aprovado_em))) / 86400))::int AS dias_parado,
            (SELECT count(*)::int FROM res_notas n WHERE n.resgate_id = res_pacientes.id) AS qtd_notas
       FROM res_pacientes WHERE tenant_id = $1 ORDER BY valor_pendente DESC LIMIT 3000`,
    [tenantId],
  );
  const { rows: tent } = await pool.query(
    'SELECT t.resgate_id, t.n, t.resultado, t.obs, t.ligacao, t.feita_por, t.feita_em FROM res_tentativas t JOIN res_pacientes p ON p.id = t.resgate_id WHERE p.tenant_id = $1 ORDER BY t.feita_em',
    [tenantId],
  );
  const porId = new Map();
  for (const t of tent) { if (!porId.has(t.resgate_id)) porId.set(t.resgate_id, []); porId.get(t.resgate_id).push(t); }
  for (const r of rows) r.tentativas = porId.get(r.id) || [];
  return rows;
}

export async function moverEtapa(tenantId, id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error('Etapa inválida.');
  await tabelasProntas;
  const { rowCount } = await pool.query('UPDATE res_pacientes SET etapa = $3, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, etapa]);
  if (!rowCount) throw new Error('Paciente não encontrado.');
}

export async function registrarTentativa(tenantId, id, { resultado, obs, ligacao, retornoEm, autor }) {
  await tabelasProntas;
  if (!RESULTADOS[resultado]) throw new Error('Escolha o resultado do contato.');
  const { rows: [p] } = await pool.query('SELECT id, etapa FROM res_pacientes WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!p) throw new Error('Paciente não encontrado.');
  let retorno = null;
  if (resultado === 'retornar') {
    retorno = new Date(retornoEm);
    if (Number.isNaN(retorno.getTime()) || retorno.getTime() < Date.now() - 60000) throw new Error('Informe a data e hora do retorno (no futuro).');
  }
  const { rows: [c] } = await pool.query('SELECT count(*)::int AS n FROM res_tentativas WHERE resgate_id = $1', [p.id]);
  const n = c.n + 1;
  await pool.query('INSERT INTO res_tentativas (tenant_id, resgate_id, n, resultado, obs, ligacao, feita_por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tenantId, p.id, n, resultado, texto(obs, 1000), !!ligacao, texto(autor, 80)]);
  let etapa = `tentativa${Math.min(n, 3)}`;
  if (resultado === 'agendou') etapa = 'agendou';
  else if (resultado === 'sem_interesse' || resultado === 'numero_errado') etapa = 'sem_sucesso';
  if (p.etapa === 'retomou') etapa = 'retomou';
  await pool.query('UPDATE res_pacientes SET etapa = $3, retorno_em = $4, retorno_nota = $5, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [p.id, tenantId, etapa, retorno, retorno ? texto(obs, 500) : null]);
  return { ok: true, n, etapa };
}

export async function definirRetorno(tenantId, id, { retornoEm, nota }) {
  await tabelasProntas;
  const d = new Date(retornoEm);
  if (Number.isNaN(d.getTime())) throw new Error('Informe a data e hora do retorno.');
  const { rowCount } = await pool.query('UPDATE res_pacientes SET retorno_em = $3, retorno_nota = $4, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId, d, texto(nota, 500)]);
  if (!rowCount) throw new Error('Paciente não encontrado.');
}
export async function limparRetorno(tenantId, id) {
  await tabelasProntas;
  await pool.query('UPDATE res_pacientes SET retorno_em = NULL, retorno_nota = NULL WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

export async function listarNotas(tenantId, id) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, autor_id, autor_nome, texto, criado_em FROM res_notas WHERE tenant_id = $1 AND resgate_id = $2 ORDER BY criado_em DESC, id DESC', [tenantId, Number(id)]);
  return rows;
}
export async function criarNota(tenantId, id, { texto: t, autorId, autorNome }) {
  await tabelasProntas;
  const corpo = String(t || '').trim().slice(0, 4000);
  if (!corpo) throw new Error('Escreva a anotação.');
  const { rows: [ok] } = await pool.query('SELECT 1 AS x FROM res_pacientes WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
  if (!ok) throw new Error('Paciente não encontrado.');
  const { rows: [n] } = await pool.query('INSERT INTO res_notas (tenant_id, resgate_id, autor_id, autor_nome, texto) VALUES ($1,$2,$3,$4,$5) RETURNING id, autor_id, autor_nome, texto, criado_em', [tenantId, Number(id), Number(autorId) || 0, texto(autorNome, 80), corpo]);
  return n;
}
export async function apagarNota(tenantId, notaId, quemId) {
  await tabelasProntas;
  await pool.query('DELETE FROM res_notas WHERE id = $1 AND tenant_id = $2 AND ($3::int = 0 OR autor_id = $3::int)', [Number(notaId), tenantId, Number(quemId) || 0]);
}
