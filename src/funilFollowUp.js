// Funil Follow Up (aba "Funil Follow Up"): funil proprio de 6 colunas (Dia 0 .. Dia 5). Cada lead
// que entra no Dia 0 ganha um "alerta de retorno" exclusivo: data e hora PROGRAMADAS pra ir pro
// Dia 1, 2, 3, 4 e 5. Cada dia tem uma tarefa que a equipe executa e confirma no botao
// "Tarefa executada". REGRA: o lead so avanca pro dia seguinte quando (1) a tarefa do dia atual foi
// marcada como executada E (2) a data/hora programada do proximo dia chegou. Sem a tarefa feita o
// card fica com alerta "pendente de execucao" e nao sai do lugar, mesmo passando da data.
// Tudo isolado por tenant.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

export const DIAS = [0, 1, 2, 3, 4, 5];
const TZ_OFFSET_H = 3; // Maceio = UTC-3 (sem horario de verao) - usado so pra montar o horario padrao
const HORA_PADRAO = 9;

export const TAREFAS_PADRAO = {
  0: 'Primeiro contato: apresentar a clínica e entender o que o paciente procura.',
  1: 'Retomar o contato: perguntar se ficou alguma dúvida e reforçar a proposta.',
  2: 'Enviar prova social (antes e depois, depoimento) ou material explicativo.',
  3: 'Ligar ou mandar áudio personalizado, oferecendo uma condição ou horário.',
  4: 'Último incentivo: criar senso de oportunidade e propor o agendamento.',
  5: 'Fechamento: perguntar se ainda tem interesse; se não, encerrar com cordialidade.',
};

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ffu_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      tarefas JSONB NOT NULL DEFAULT '{}'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ffu_leads (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      contato_id INT,
      instancia TEXT,
      numero TEXT,
      nome TEXT,
      dia INT NOT NULL DEFAULT 0,
      entrou_dia_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      concluido_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ffu_leads_tenant_idx ON ffu_leads (tenant_id)`);
  // 1 linha por (lead, dia): quando esse dia esta programado pra comecar e se a tarefa foi feita
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ffu_etapas (
      lead_id INT NOT NULL REFERENCES ffu_leads(id) ON DELETE CASCADE,
      dia INT NOT NULL,
      programado_em TIMESTAMPTZ,
      tarefa_feita_em TIMESTAMPTZ,
      tarefa_feita_por TEXT,
      PRIMARY KEY (lead_id, dia)
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('[ffu] erro criando tabelas:', err.message);
});

// horario padrao: N dias depois, as 09:00 de Maceio
function agendaPadrao() {
  const base = new Date();
  const out = [];
  for (let n = 1; n <= 5; n++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + n, HORA_PADRAO + TZ_OFFSET_H, 0, 0));
    out.push(d.toISOString());
  }
  return out;
}

// agenda = [iso dia1, iso dia2, ... iso dia5]; tem que estar em ordem crescente e no futuro
function validarAgenda(agenda, agora = Date.now(), aPartirDoDia = 1) {
  if (!Array.isArray(agenda) || agenda.length !== 5) throw new Error('Informe data e hora para os Dias 1 a 5.');
  let anterior = agora;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const dia = i + 1;
    const t = new Date(agenda[i]).getTime();
    if (!Number.isFinite(t)) throw new Error(`Data/hora do Dia ${dia} inválida.`);
    if (dia >= aPartirDoDia) {
      if (t <= anterior) throw new Error(`O Dia ${dia} precisa ser depois do ${dia === aPartirDoDia ? 'momento atual' : `Dia ${dia - 1}`}.`);
    }
    if (t > anterior) anterior = t;
    out.push(new Date(t).toISOString());
  }
  return out;
}

export async function obterTarefas(tenantId) {
  if (!pool) return { ...TAREFAS_PADRAO };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT tarefas FROM ffu_config WHERE tenant_id = $1', [tenantId]);
  const salvas = rows[0]?.tarefas || {};
  const out = {};
  for (const d of DIAS) out[d] = String(salvas[d] || '').trim() || TAREFAS_PADRAO[d];
  return out;
}

export async function salvarTarefas(tenantId, tarefas) {
  await tabelasProntas;
  const limpo = {};
  for (const d of DIAS) limpo[d] = String(tarefas?.[d] ?? '').trim().slice(0, 500);
  await pool.query(
    `INSERT INTO ffu_config (tenant_id, tarefas) VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET tarefas = $2, atualizado_em = now()`,
    [tenantId, JSON.stringify(limpo)],
  );
}

export async function adicionarLead(tenantId, { contatoId, numero, nome, instancia, agenda }) {
  await tabelasProntas;
  let num = String(numero || '').replace(/\D/g, '');
  let nm = String(nome || '').trim();
  let inst = instancia || null;
  if (contatoId) {
    const { rows } = await pool.query('SELECT id, numero, nome, instancia FROM crm_contatos WHERE id = $1 AND tenant_id = $2', [Number(contatoId), tenantId]);
    if (!rows[0]) throw new Error('Contato não encontrado.');
    num = rows[0].numero; nm = nm || rows[0].nome || ''; inst = inst || rows[0].instancia;
  }
  if (!nm && !num) throw new Error('Informe o nome ou o número do lead.');
  const datas = validarAgenda(agenda && agenda.length ? agenda : agendaPadrao());
  // o mesmo paciente nao entra duas vezes no funil enquanto ainda esta em andamento
  if (num) {
    const { rows: dup } = await pool.query(
      `SELECT id FROM ffu_leads WHERE tenant_id = $1 AND numero = $2 AND COALESCE(instancia,'') = COALESCE($3,'') AND concluido_em IS NULL`,
      [tenantId, num, inst],
    );
    if (dup.length) throw new Error('Esse paciente já está no Funil Follow Up.');
  }
  const { rows } = await pool.query(
    'INSERT INTO ffu_leads (tenant_id, contato_id, instancia, numero, nome) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [tenantId, contatoId ? Number(contatoId) : null, inst, num || null, nm || null],
  );
  const id = rows[0].id;
  await pool.query('INSERT INTO ffu_etapas (lead_id, dia, programado_em) VALUES ($1, 0, now())', [id]);
  for (let i = 0; i < 5; i++) await pool.query('INSERT INTO ffu_etapas (lead_id, dia, programado_em) VALUES ($1,$2,$3)', [id, i + 1, datas[i]]);
  return id;
}

// usado pelo CRM: contato entrou na etapa Follow Up (automatico ou manual) ou alguem clicou em
// "Adicionar ao Funil Follow Up". Entra no Dia 0 com a agenda padrao. Se ja esta em andamento no
// funil, nao duplica (devolve jaEstava: true).
export async function adicionarDoCrm(tenantId, contatoId) {
  try {
    const id = await adicionarLead(tenantId, { contatoId });
    return { ok: true, id, jaEstava: false };
  } catch (err) {
    if (/já está no Funil/.test(err.message)) return { ok: true, jaEstava: true };
    throw err;
  }
}

export async function listarLeads(tenantId, instancia) {
  await tabelasProntas;
  await avancarDoTenant(tenantId);
  const params = [tenantId];
  let filtro = '';
  if (instancia) { params.push(instancia); filtro = ` AND l.instancia = $${params.length}`; }
  const { rows: leads } = await pool.query(`SELECT * FROM ffu_leads l WHERE l.tenant_id = $1${filtro} ORDER BY l.entrou_dia_em ASC, l.id ASC`, params);
  if (!leads.length) return [];
  const { rows: etapas } = await pool.query('SELECT * FROM ffu_etapas WHERE lead_id = ANY($1::int[]) ORDER BY dia', [leads.map((l) => l.id)]);
  const porLead = new Map();
  for (const e of etapas) { if (!porLead.has(e.lead_id)) porLead.set(e.lead_id, []); porLead.get(e.lead_id).push(e); }
  const agora = Date.now();
  return leads.map((l) => {
    const es = porLead.get(l.id) || [];
    const atual = es.find((e) => e.dia === l.dia);
    const proxima = es.find((e) => e.dia === l.dia + 1);
    const tarefaFeita = !!atual?.tarefa_feita_em;
    const proximoEm = proxima?.programado_em ? new Date(proxima.programado_em).getTime() : null;
    return {
      id: l.id, contatoId: l.contato_id, instancia: l.instancia, numero: l.numero, nome: l.nome, dia: l.dia,
      entrouDiaEm: l.entrou_dia_em, concluidoEm: l.concluido_em,
      tarefaFeita, tarefaFeitaEm: atual?.tarefa_feita_em || null, tarefaFeitaPor: atual?.tarefa_feita_por || null,
      pendente: !l.concluido_em && !tarefaFeita,
      // passou da data programada do proximo dia e a tarefa nao foi feita: esta travado por causa da tarefa
      atrasado: !l.concluido_em && !tarefaFeita && proximoEm !== null && proximoEm <= agora,
      proximoDia: proxima ? l.dia + 1 : null, proximoEm: proxima?.programado_em || null,
      agenda: es.filter((e) => e.dia >= 1).map((e) => ({ dia: e.dia, programadoEm: e.programado_em, feita: !!e.tarefa_feita_em, feitaEm: e.tarefa_feita_em })),
    };
  });
}

// avanca (um dia por vez) os leads cuja tarefa do dia esta feita e cuja data do proximo dia chegou
async function avancarDoTenant(tenantId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.dia FROM ffu_leads l
       JOIN ffu_etapas atual ON atual.lead_id = l.id AND atual.dia = l.dia AND atual.tarefa_feita_em IS NOT NULL
       JOIN ffu_etapas prox ON prox.lead_id = l.id AND prox.dia = l.dia + 1 AND prox.programado_em <= now()
      WHERE l.tenant_id = $1 AND l.concluido_em IS NULL AND l.dia < 5`,
    [tenantId],
  );
  for (const r of rows) {
    await pool.query('UPDATE ffu_leads SET dia = dia + 1, entrou_dia_em = now() WHERE id = $1 AND dia = $2', [r.id, r.dia]);
  }
  return rows.length;
}

export async function executarTarefa(tenantId, leadId, quem) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, dia, concluido_em FROM ffu_leads WHERE id = $1 AND tenant_id = $2', [Number(leadId), tenantId]);
  const lead = rows[0];
  if (!lead) throw new Error('Lead não encontrado.');
  if (lead.concluido_em) throw new Error('Esse lead já concluiu o funil.');
  await pool.query(
    'UPDATE ffu_etapas SET tarefa_feita_em = COALESCE(tarefa_feita_em, now()), tarefa_feita_por = COALESCE(tarefa_feita_por, $3) WHERE lead_id = $1 AND dia = $2',
    [lead.id, lead.dia, String(quem || '').slice(0, 80) || null],
  );
  // Dia 5 com tarefa feita = fim do funil
  if (lead.dia === 5) await pool.query('UPDATE ffu_leads SET concluido_em = now() WHERE id = $1', [lead.id]);
  else await avancarDoTenant(tenantId);
}

// reprograma data/hora dos dias ainda NAO iniciados (o dia atual e os anteriores ficam como estao)
export async function reprogramar(tenantId, leadId, agenda) {
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, dia FROM ffu_leads WHERE id = $1 AND tenant_id = $2 AND concluido_em IS NULL', [Number(leadId), tenantId]);
  const lead = rows[0];
  if (!lead) throw new Error('Lead não encontrado.');
  const datas = validarAgenda(agenda, Date.now(), lead.dia + 1);
  for (let i = 0; i < 5; i++) {
    const dia = i + 1;
    if (dia > lead.dia) await pool.query('UPDATE ffu_etapas SET programado_em = $3 WHERE lead_id = $1 AND dia = $2', [lead.id, dia, datas[i]]);
  }
  await avancarDoTenant(tenantId);
}

export async function removerLead(tenantId, leadId) {
  await tabelasProntas;
  await pool.query('DELETE FROM ffu_leads WHERE id = $1 AND tenant_id = $2', [Number(leadId), tenantId]);
}

export function iniciarSchedulerFunilFollowUp() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const { rows } = await pool.query('SELECT DISTINCT tenant_id FROM ffu_leads WHERE concluido_em IS NULL');
      for (const { tenant_id: t } of rows) {
        try { await avancarDoTenant(t); } catch (err) { console.error('[ffu] tenant', t, err.message); }
      }
    } catch (err) {
      console.error('[ffu] scheduler:', err.message);
    }
  };
  setTimeout(checar, 20 * 1000).unref();
  setInterval(checar, 60 * 1000).unref();
}
