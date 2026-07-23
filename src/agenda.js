// agenda interna do app - funciona 100% sozinha (Postgres), isolada por tenant. Quando o
// Google Agenda do tenant estiver conectado (ver googleCalendar.js), cada operacao tambem
// espelha pra la - mas se o Google falhar por qualquer motivo, o evento local ainda fica salvo
// (a sincronizacao e "best effort", nunca trava a agenda por causa de uma falha externa).
import { pool } from './db.js';
import * as googleCalendar from './googleCalendar.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabela() {
  if (!pool) return;
  await tenantsProntos; // tenants precisa existir antes (REFERENCES tenants(id) abaixo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agenda_eventos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      titulo TEXT NOT NULL,
      descricao TEXT,
      local TEXT,
      inicio TIMESTAMPTZ NOT NULL,
      fim TIMESTAMPTZ NOT NULL,
      google_event_id TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // instalacao que ja tinha essa tabela ANTES da conversao multi-tenant - o CREATE TABLE
  // acima e no-op nesse caso, adiciona a coluna por fora (nullable ate o backfill)
  await pool.query(`ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS agenda_eventos_tenant_idx ON agenda_eventos (tenant_id);`);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela agenda_eventos:', err.message);
});

function validarIntervalo(inicioISO, fimISO) {
  const inicio = new Date(inicioISO);
  const fim = new Date(fimISO);
  if (Number.isNaN(inicio.getTime())) throw new Error(`Data/hora de inicio invalida: "${inicioISO}"`);
  if (Number.isNaN(fim.getTime())) throw new Error(`Data/hora de fim invalida: "${fimISO}"`);
  if (fim <= inicio) throw new Error('O fim do evento precisa ser depois do inicio.');
  return { inicio, fim };
}

export async function criarEvento(tenantId, { titulo, descricao, local, inicio: inicioISO, fim: fimISO }) {
  if (!pool) throw new Error('Agenda precisa do Postgres configurado (DATABASE_URL) - nao disponivel neste ambiente.');
  if (!titulo) throw new Error('O evento precisa de um titulo.');
  await tabelaPronta;
  const { inicio, fim } = validarIntervalo(inicioISO, fimISO);

  let googleEventId = null;
  if (await googleCalendar.estaConectado(tenantId)) {
    try {
      googleEventId = await googleCalendar.criarEvento(tenantId, { titulo, descricao, local, inicio, fim });
    } catch (err) {
      console.error('Erro sincronizando evento com Google Agenda (evento local foi criado mesmo assim):', err.message);
    }
  }

  const { rows } = await pool.query(
    'INSERT INTO agenda_eventos (tenant_id, titulo, descricao, local, inicio, fim, google_event_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [tenantId, titulo, descricao || null, local || null, inicio, fim, googleEventId],
  );
  return { id: rows[0].id, sincronizadoComGoogle: !!googleEventId };
}

export async function listarEventos(tenantId, fromISO, toISO) {
  if (!pool) return [];
  await tabelaPronta;
  const from = fromISO ? new Date(fromISO) : new Date();
  const to = toISO ? new Date(toISO) : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    'SELECT id, titulo, descricao, local, inicio, fim, google_event_id FROM agenda_eventos WHERE tenant_id = $1 AND inicio >= $2 AND inicio <= $3 ORDER BY inicio ASC',
    [tenantId, from, to],
  );
  const locais = rows.map((r) => ({ ...r, origem: 'lumia' }));

  if (!(await googleCalendar.estaConectado(tenantId))) return locais;
  try {
    const googleEventos = await googleCalendar.listarEventos(tenantId, from, to);
    // nao duplica os que a propria Lumia criou (ja tem google_event_id salvo na tabela local)
    const idsJaSincronizados = new Set(rows.map((r) => r.google_event_id).filter(Boolean));
    const soDoGoogle = googleEventos
      .filter((e) => !idsJaSincronizados.has(e.id))
      .map((e) => ({
        id: null,
        titulo: e.summary || '(sem titulo)',
        descricao: e.description || null,
        local: e.location || null,
        inicio: e.start?.dateTime || e.start?.date,
        fim: e.end?.dateTime || e.end?.date,
        google_event_id: e.id,
        origem: 'google',
      }));
    return [...locais, ...soDoGoogle].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  } catch (err) {
    console.error('Erro lendo eventos do Google Agenda (mostrando so os locais):', err.message);
    return locais;
  }
}

export async function cancelarEvento(tenantId, id) {
  if (!pool) throw new Error('Agenda precisa do Postgres configurado.');
  await tabelaPronta;
  const { rows } = await pool.query('SELECT google_event_id FROM agenda_eventos WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!rows.length) throw new Error(`Nao achei nenhum evento com id ${id}.`);

  if (rows[0].google_event_id && (await googleCalendar.estaConectado(tenantId))) {
    try {
      await googleCalendar.cancelarEvento(tenantId, rows[0].google_event_id);
    } catch (err) {
      console.error('Erro cancelando evento no Google Agenda (removido localmente mesmo assim):', err.message);
    }
  }
  await pool.query('DELETE FROM agenda_eventos WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
}
