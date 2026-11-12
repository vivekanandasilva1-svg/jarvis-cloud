// Monitoramento de ligacoes do WhatsApp. IMPORTANTE (limite real do WhatsApp): nao existe API que
// deixe um app FAZER ligacao de voz/video pelo numero do WhatsApp - o Evolution/Baileys so AVISA
// que uma chamada aconteceu (tocou, atendida, recusada, perdida, encerrada). Entao aqui a gente
// REGISTRA e mede: quantas ligacoes, que horas, quanto tempo durou, quantas foram perdidas.
// Ligacao feita por fora (celular, telefone comum) pode ser registrada na mao.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_chamadas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      instancia TEXT NOT NULL,
      numero TEXT NOT NULL,
      nome TEXT,
      direcao TEXT NOT NULL,
      video BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'tocando',
      inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
      atendida_em TIMESTAMPTZ,
      fim TIMESTAMPTZ,
      duracao_seg INT,
      call_id TEXT,
      origem TEXT NOT NULL DEFAULT 'whatsapp',
      operador_nome TEXT,
      obs TEXT
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS crm_chamadas_call_idx ON crm_chamadas (tenant_id, instancia, call_id) WHERE call_id IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS crm_chamadas_tenant_inicio_idx ON crm_chamadas (tenant_id, inicio DESC);`);
}
export const tabelasProntas = garantirTabelas().catch((err) => console.error('Erro criando tabelas de chamadas:', err.message));

const digitos = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

// evento de chamada do Evolution (webhook "call"): chega 1 evento por mudanca de estado
// (offer/ringing -> accept -> terminate, ou reject/timeout), cada um com o id da chamada.
export async function registrarEventoChamada(tenantId, instancia, evento) {
  if (!pool || !evento) return;
  await tabelasProntas;
  const callId = evento.id ? String(evento.id) : null;
  const status = String(evento.status || '').toLowerCase();
  const quando = evento.date ? new Date(typeof evento.date === 'number' && evento.date < 1e12 ? evento.date * 1000 : evento.date) : new Date();
  const qd = Number.isNaN(quando.getTime()) ? new Date() : quando;
  // contato = o outro lado: em chamada recebida chatId e from sao o mesmo numero; em chamada feita
  // pelo celular, from e o proprio numero da conta e chatId e o contato
  const peer = digitos(evento.chatId) || digitos(evento.from);
  if (!peer || /@g\.us|@broadcast/.test(String(evento.chatId || ''))) return;
  const direcao = evento.chatId && evento.from && digitos(evento.from) !== digitos(evento.chatId) ? 'feita' : 'recebida';
  const video = !!evento.isVideo;

  if (status === 'offer' || status === 'ringing') {
    await pool.query(
      `INSERT INTO crm_chamadas (tenant_id, instancia, numero, direcao, video, status, inicio, call_id)
       VALUES ($1, $2, $3, $4, $5, 'tocando', $6, $7) ON CONFLICT (tenant_id, instancia, call_id) WHERE call_id IS NOT NULL DO NOTHING`,
      [tenantId, instancia, peer, direcao, video, qd, callId],
    );
    return;
  }
  // os demais estados atualizam a chamada ja aberta (ou criam uma se o "offer" nao chegou)
  await pool.query(
    `INSERT INTO crm_chamadas (tenant_id, instancia, numero, direcao, video, status, inicio, call_id)
     VALUES ($1, $2, $3, $4, $5, 'tocando', $6, $7) ON CONFLICT (tenant_id, instancia, call_id) WHERE call_id IS NOT NULL DO NOTHING`,
    [tenantId, instancia, peer, direcao, video, qd, callId],
  );
  if (status === 'accept') {
    await pool.query(`UPDATE crm_chamadas SET status = 'atendida', atendida_em = COALESCE(atendida_em, $4) WHERE tenant_id = $1 AND instancia = $2 AND call_id = $3`, [tenantId, instancia, callId, qd]);
  } else if (status === 'reject') {
    await pool.query(`UPDATE crm_chamadas SET status = 'recusada', fim = $4 WHERE tenant_id = $1 AND instancia = $2 AND call_id = $3 AND fim IS NULL`, [tenantId, instancia, callId, qd]);
  } else if (status === 'timeout') {
    await pool.query(`UPDATE crm_chamadas SET status = 'perdida', fim = $4 WHERE tenant_id = $1 AND instancia = $2 AND call_id = $3 AND fim IS NULL`, [tenantId, instancia, callId, qd]);
  } else if (status === 'terminate') {
    await pool.query(
      `UPDATE crm_chamadas SET fim = $4,
         duracao_seg = CASE WHEN atendida_em IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM ($4 - atendida_em))::int) ELSE NULL END,
         status = CASE WHEN atendida_em IS NOT NULL THEN 'atendida' WHEN status = 'tocando' THEN 'perdida' ELSE status END
       WHERE tenant_id = $1 AND instancia = $2 AND call_id = $3 AND fim IS NULL`,
      [tenantId, instancia, callId, qd],
    );
  }
}

// registro manual: ligacao feita/recebida por fora do WhatsApp (celular, telefone) - fica junto no relatorio
export async function registrarChamadaManual(tenantId, { numero, nome, direcao, status, quando, duracaoSeg, operadorNome, obs, instancia }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const n = String(numero || '').replace(/\D/g, '');
  if (n.length < 8) throw new Error('Informe o telefone (com DDD).');
  const dir = direcao === 'recebida' ? 'recebida' : 'feita';
  const st = ['atendida', 'perdida', 'recusada'].includes(status) ? status : 'atendida';
  const inicio = quando ? new Date(quando) : new Date();
  if (Number.isNaN(inicio.getTime())) throw new Error('Data/hora invalida.');
  const dur = st === 'atendida' ? Math.max(0, Math.round(Number(duracaoSeg) || 0)) : null;
  const fim = dur !== null ? new Date(inicio.getTime() + dur * 1000) : inicio;
  const { rows } = await pool.query(
    `INSERT INTO crm_chamadas (tenant_id, instancia, numero, nome, direcao, status, inicio, atendida_em, fim, duracao_seg, origem, operador_nome, obs)
     VALUES ($1, $12, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', $10, $11) RETURNING id`,
    [tenantId, n, String(nome || '').trim().slice(0, 120) || null, dir, st, inicio, st === 'atendida' ? inicio : null, fim, dur, String(operadorNome || '').slice(0, 120) || null, String(obs || '').trim().slice(0, 500) || null, String(instancia || 'manual').slice(0, 120)],
  );
  return rows[0].id;
}

export async function apagarChamada(tenantId, id) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query('DELETE FROM crm_chamadas WHERE id = $1 AND tenant_id = $2', [Number(id), tenantId]);
}

// de/ate 'YYYY-MM-DD' (Maceio, UTC-3): resumo + lista + volume por hora
export async function relatorioChamadas(tenantId, { de, ate, instancia }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86400000);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) throw new Error('Periodo invalido.');
  const p = [tenantId, inicio, fim];
  // filtro opcional por numero de WhatsApp (ex.: so as ligacoes do numero responsavel pelas Indicacoes)
  const fi = instancia ? ` AND instancia = $${p.push(String(instancia))}` : '';
  const fiCh = instancia ? ` AND ch.instancia = $${p.length}` : '';
  const [{ rows: [r] }, { rows: horas }, { rows: lista }] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total,
              (count(*) FILTER (WHERE status = 'atendida'))::int AS atendidas,
              (count(*) FILTER (WHERE status IN ('perdida', 'recusada') AND direcao = 'recebida'))::int AS perdidas,
              (count(*) FILTER (WHERE direcao = 'recebida'))::int AS recebidas,
              (count(*) FILTER (WHERE direcao = 'feita'))::int AS feitas,
              COALESCE(sum(duracao_seg), 0)::int AS segundos_total,
              COALESCE(avg(duracao_seg) FILTER (WHERE duracao_seg > 0), 0)::int AS segundos_medio
       FROM crm_chamadas WHERE tenant_id = $1 AND inicio >= $2 AND inicio < $3${fi}`, p),
    pool.query(
      `SELECT extract(hour FROM inicio AT TIME ZONE 'America/Maceio')::int AS hora, count(*)::int AS total
       FROM crm_chamadas WHERE tenant_id = $1 AND inicio >= $2 AND inicio < $3${fi} GROUP BY 1 ORDER BY 1`, p),
    pool.query(
      `SELECT ch.id, ch.numero, COALESCE(ch.nome, c.nome) AS nome, ch.direcao, ch.video, ch.status, ch.inicio, ch.duracao_seg, ch.origem, ch.operador_nome, ch.obs
       FROM crm_chamadas ch LEFT JOIN crm_contatos c ON c.tenant_id = ch.tenant_id AND c.numero = ch.numero AND c.instancia = ch.instancia
       WHERE ch.tenant_id = $1 AND ch.inicio >= $2 AND ch.inicio < $3${fiCh} ORDER BY ch.inicio DESC LIMIT 300`, p),
  ]);
  return { resumo: r, porHora: horas, chamadas: lista };
}
