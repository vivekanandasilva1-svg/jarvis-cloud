// Orcamentos em aberto (modo 2 da aba "Resgate de orcamentos"): quadro igual ao CRC > "Orcamentos em aberto" do Clinicorp
// (Em aberto / Contato realizado / Retornar contato / Follow up / Aprovado). Os orcamentos vem das MESMAS leituras do Clinicorp
// que o Resgate ja faz (o /estimates/list devolve todos os status), entao nao gasta nenhuma consulta a mais do limite de 25/hora.
// A API do Clinicorp NAO diz em qual coluna do CRC o orcamento esta (so OPEN/FOLLOWUP/APPROVED...): a colocacao inicial vem do
// status e a equipe arrasta os cards; a posicao exata do Clinicorp entra por "Importar relatorio do Clinicorp". Tudo isolado por tenant.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import { normalizarTelefone } from './crm.js';

export const ETAPAS = [
  { id: 'em_aberto', nome: 'Em aberto' },
  { id: 'contato_realizado', nome: 'Contato realizado' },
  { id: 'retornar_contato', nome: 'Retornar contato' },
  { id: 'follow_up', nome: 'Follow up' },
  { id: 'aprovado', nome: 'Aprovado' },
];
const IDS_ETAPAS = new Set(ETAPAS.map((e) => e.id));
const ETAPAS_DE_CONTATO = new Set(['contato_realizado', 'retornar_contato', 'follow_up']);

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oa_orcamentos (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      orcamento_id TEXT NOT NULL,
      patient_id TEXT,
      nome TEXT,
      telefone TEXT,
      profissional TEXT,
      especialidades JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT,
      orcamento_em TIMESTAMPTZ,
      valor NUMERIC NOT NULL DEFAULT 0,
      etapa TEXT NOT NULL DEFAULT 'em_aberto',
      etapa_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
      interacao_em TIMESTAMPTZ,
      origem TEXT NOT NULL DEFAULT 'api',
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, orcamento_id)
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS oa_orcamentos_tenant_idx ON oa_orcamentos (tenant_id, ativo, etapa)');
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('[orcAbertos] erro criando tabelas:', err.message));

const texto = (v, max) => { const t = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return t || null; };
const dataValida = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// recebe a lista de orcamentos lida do Clinicorp (qualquer status) e atualiza o quadro.
// - OPEN entra em "Em aberto"; FOLLOWUP em "Follow up" (so enquanto a equipe nao tiver mexido no card)
// - APPROVED: so vai pra "Aprovado" se o orcamento JA estava no quadro (o Clinicorp so mostra ali o que veio do fluxo de aberto)
// - recusados saem do quadro
export async function processar(tenantId, lista, nomesEsp = new Map()) {
  if (!pool) return { novos: 0, atualizados: 0, aprovados: 0, sairam: 0 };
  await tabelasProntas;
  const r = { novos: 0, atualizados: 0, aprovados: 0, sairam: 0 };
  for (const o of lista || []) {
    const id = String(o?.id ?? '');
    const status = String(o?.Status || '');
    if (!id || !status) continue;
    const { rows: [ex] } = await pool.query('SELECT id, etapa, origem, ativo FROM oa_orcamentos WHERE tenant_id = $1 AND orcamento_id = $2', [tenantId, id]);
    if (status === 'OPEN' || status === 'FOLLOWUP' || status === 'APPROVED') {
      if (status === 'APPROVED' && !ex) continue;
      const procs = (o.ProcedureList || []).filter((p) => !p.Deleted && !p.NotApproved);
      const esp = [...new Set(procs.map((p) => nomesEsp.get(String(p.SpecialtyId ?? ''))).filter(Boolean))].sort();
      const dados = [String(o.PatientId || ''), texto(o.PatientName, 120), normalizarTelefone(o.PatientMobilePhone), texto(o.ProfessionalName, 120), JSON.stringify(esp), status, dataValida(o.Date || o.CreateDate), Number(o.Amount) || 0, dataValida(o.FollowUpUpdateDate)];
      const etapaApi = status === 'APPROVED' ? 'aprovado' : status === 'FOLLOWUP' ? 'follow_up' : 'em_aberto';
      if (!ex) {
        await pool.query(
          `INSERT INTO oa_orcamentos (tenant_id, orcamento_id, patient_id, nome, telefone, profissional, especialidades, status, orcamento_em, valor, interacao_em, etapa)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
          [tenantId, id, ...dados, etapaApi],
        );
        r.novos++;
      } else {
        // aprovou = vai pra "Aprovado" sempre; OPEN/FOLLOWUP so reposiciona o que a equipe ainda nao mexeu (origem 'api')
        const novaEtapa = status === 'APPROVED' ? 'aprovado' : (ex.origem === 'api' && (ex.etapa === 'em_aberto' || ex.etapa === 'follow_up') ? etapaApi : ex.etapa);
        const mudou = novaEtapa !== ex.etapa;
        await pool.query(
          `UPDATE oa_orcamentos SET patient_id=$3, nome=$4, telefone=$5, profissional=$6,
                  especialidades = CASE WHEN jsonb_array_length($7::jsonb) > 0 THEN $7::jsonb ELSE especialidades END,
                  status=$8, orcamento_em=COALESCE($9, orcamento_em), valor=$10, interacao_em=COALESCE($11, interacao_em),
                  etapa=$12, etapa_desde = CASE WHEN $13 THEN now() ELSE etapa_desde END, ativo = true, atualizado_em = now()
            WHERE id = $1 AND tenant_id = $2`,
          [ex.id, tenantId, ...dados, novaEtapa, mudou],
        );
        r.atualizados++;
        if (mudou && novaEtapa === 'aprovado') r.aprovados++;
      }
    } else if (ex && ex.ativo) {
      await pool.query('UPDATE oa_orcamentos SET ativo = false, status = $3, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [ex.id, tenantId, status]);
      r.sairam++;
    }
  }
  return r;
}

export async function listar(tenantId) {
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT id, orcamento_id, patient_id, nome, telefone, profissional, especialidades, status, orcamento_em, valor::float AS valor, etapa, etapa_desde, interacao_em, origem,
            GREATEST(0, floor(extract(epoch FROM (now() - etapa_desde)) / 86400))::int AS dias_na_etapa
       FROM oa_orcamentos WHERE tenant_id = $1 AND ativo ORDER BY orcamento_em DESC NULLS LAST LIMIT 5000`,
    [tenantId],
  );
  return rows;
}

export async function moverEtapa(tenantId, id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error('Etapa inválida.');
  await tabelasProntas;
  const { rowCount } = await pool.query(
    `UPDATE oa_orcamentos SET etapa = $3, origem = 'manual',
            etapa_desde = CASE WHEN etapa IS DISTINCT FROM $3 THEN now() ELSE etapa_desde END,
            interacao_em = CASE WHEN $4 AND etapa IS DISTINCT FROM $3 THEN now() ELSE interacao_em END,
            atualizado_em = now()
      WHERE id = $1 AND tenant_id = $2`,
    [Number(id), tenantId, etapa, ETAPAS_DE_CONTATO.has(etapa)],
  );
  if (!rowCount) throw new Error('Orçamento não encontrado.');
}
