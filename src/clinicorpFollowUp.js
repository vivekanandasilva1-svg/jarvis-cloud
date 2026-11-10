// Sincronizacao Clinicorp -> CRM: todo orcamento que a equipe (ex: a Vania) move pra coluna "Follow Up"
// do CRC do Clinicorp ("CRC - Orcamentos em aberto") faz o paciente entrar sozinho na coluna "Follow Up"
// do CRM da Lumia. Vale por padrao pra qualquer tenant com Clinicorp conectado.
//
// Como o Clinicorp expoe isso: /estimates/list devolve o orcamento com Status "FOLLOWUP" (vs OPEN,
// APPROVED, REJECTED), FollowUpDate (data marcada do retorno - e ela que vira a "Date" do orcamento
// na listagem) e FollowUpUpdateDate (quando alguem marcou).
//
// Regras: cada orcamento entra UMA vez (tabela clinicorp_followup_sync) - se o dono tirar o paciente da
// coluna depois, nao volta sozinho; paciente achado pelo telefone (com/sem o 9); se nao existir no CRM,
// e criado; nunca mexe em "Contatos pessoais". Na primeira rodada de um tenant, so importa o que foi
// marcado nos ultimos 7 dias - o historico antigo fica registrado como "ja visto" (nao dispara cadencia
// de mensagem pra dezenas de pacientes de uma vez).
import { pool } from './db.js';
import * as clinicorp from './clinicorp.js';
import * as crm from './crm.js';
import * as followUp from './followUp.js';
import * as whatsappInstances from './whatsappInstances.js';
import * as tenantConfig from './tenantConfig.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';

const DIA_MS = 86400000;
const DIAS_IMPORTAR_NA_PRIMEIRA = 7;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinicorp_followup_sync (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      orcamento_id TEXT NOT NULL,
      contato_id INT,
      acao TEXT NOT NULL,
      paciente TEXT,
      em TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, orcamento_id)
    );
    -- botao "Follow Up Inteligente" do CRM: liga/desliga a automacao por numero de WhatsApp (sem linha = ligado)
    CREATE TABLE IF NOT EXISTS clinicorp_followup_config (
      tenant_id INT NOT NULL REFERENCES tenants(id),
      instancia TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      ativado_em TIMESTAMPTZ,
      PRIMARY KEY (tenant_id, instancia)
    );
  `);
  // operador que recebe os leads que entram na coluna Follow Up por esse numero (cada operador tem o seu funil)
  await pool.query(`ALTER TABLE clinicorp_followup_config ADD COLUMN IF NOT EXISTS operador_id INT`);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('Erro criando tabela de sync Clinicorp->Follow Up:', err.message));

const iso = (d) => d.toISOString().slice(0, 10);

// o Clinicorp so aceita periodos de ate 31 dias e a "Date" de um orcamento em Follow Up e a data marcada
// pro retorno (pode ser futura) - entao olha o ultimo mes e os proximos dois
async function buscarOrcamentosFollowUp(tenantId) {
  const hoje = new Date(Date.now() - 3 * 3600000);
  const janelas = [
    [new Date(hoje.getTime() - 30 * DIA_MS), hoje],
    [new Date(hoje.getTime() + DIA_MS), new Date(hoje.getTime() + 31 * DIA_MS)],
    [new Date(hoje.getTime() + 32 * DIA_MS), new Date(hoje.getTime() + 62 * DIA_MS)],
  ];
  const porId = new Map();
  for (const [de, ate] of janelas) {
    const lista = await clinicorp.listEstimates(tenantId, { from: iso(de), to: iso(ate) });
    for (const o of lista) if (o.Status === 'FOLLOWUP') porId.set(String(o.id), o);
  }
  return [...porId.values()];
}

export async function obterAtivacao(tenantId, instancia) {
  if (!pool) return { ativo: true, ativadoEm: null, operadorId: null };
  await tabelasProntas;
  const { rows } = await pool.query('SELECT ativo, ativado_em, operador_id FROM clinicorp_followup_config WHERE tenant_id = $1 AND instancia = $2', [tenantId, instancia]);
  // sem linha = ligado (padrao pra todo cliente com Clinicorp integrado); o dono pode desligar por numero
    return rows[0] ? { ativo: rows[0].ativo, ativadoEm: rows[0].ativado_em, operadorId: rows[0].operador_id } : { ativo: true, ativadoEm: null, operadorId: null };
}

// ao religar, o que ja estava na coluna do Clinicorp nao entra de uma vez: so vale o que for marcado depois
export async function definirAtivacao(tenantId, instancia, ativo) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO clinicorp_followup_config (tenant_id, instancia, ativo, ativado_em) VALUES ($1, $2, $3, CASE WHEN $3 THEN now() END)
     ON CONFLICT (tenant_id, instancia) DO UPDATE SET ativo = $3, ativado_em = CASE WHEN $3 THEN now() ELSE clinicorp_followup_config.ativado_em END`,
    [tenantId, String(instancia), !!ativo],
  );
}

// define quem recebe os leads da coluna Follow Up desse numero e ja entrega a ele os que estao sem operador
export async function definirOperadorFollowUp(tenantId, instancia, operadorId) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  const op = operadorId === null || operadorId === undefined || operadorId === '' ? null : Number(operadorId);
  await pool.query(
    `INSERT INTO clinicorp_followup_config (tenant_id, instancia, ativo, operador_id) VALUES ($1, $2, true, $3)
     ON CONFLICT (tenant_id, instancia) DO UPDATE SET operador_id = $3`,
    [tenantId, String(instancia), op],
  );
  let entregues = 0;
  if (op !== null) {
    const { rows } = await pool.query(
      `SELECT id FROM crm_contatos WHERE tenant_id = $1 AND instancia = $2 AND etapa = 'follow_up' AND atendente_id IS NULL AND oculto = false`,
      [tenantId, String(instancia)],
    );
    for (const r of rows) { await crm.definirAtendente(tenantId, r.id, op); entregues++; }
  }
  return { entregues };
}

export async function sincronizarTenant(tenantId) {
  if (!pool) return { novos: 0 };
  await tabelasProntas;
  const cfg = await tenantConfig.obterClinicorp(tenantId);
  if (!cfg) return { novos: 0, semClinicorp: true };

  const orcamentos = await buscarOrcamentosFollowUp(tenantId);
  const { rows: vistos } = await pool.query('SELECT orcamento_id FROM clinicorp_followup_sync WHERE tenant_id = $1', [tenantId]);
  const jaVistos = new Set(vistos.map((v) => v.orcamento_id));
  const primeiraRodada = vistos.length === 0;
  const { instanciaAtiva } = await whatsappInstances.obterConfig(tenantId);

  const resultado = { novos: 0, movidos: 0, criados: 0, baseline: 0, semTelefone: 0, ignorados: 0, desligados: 0 };
  const cacheAtiv = new Map();
  const ativacaoDe = async (inst) => {
    if (!cacheAtiv.has(inst)) cacheAtiv.set(inst, await obterAtivacao(tenantId, inst));
    return cacheAtiv.get(inst);
  };
  for (const o of orcamentos) {
    const id = String(o.id);
    if (jaVistos.has(id)) continue;
    const registrar = (acao, contatoId = null) => pool.query(
      `INSERT INTO clinicorp_followup_sync (tenant_id, orcamento_id, contato_id, acao, paciente) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [tenantId, id, contatoId, acao, o.PatientName || null],
    );

    try {
      const numero = crm.normalizarTelefone(o.PatientMobilePhone);
      if (!numero) { resultado.novos++; await registrar('sem_telefone'); resultado.semTelefone++; continue; }

      const existente = await crm.acharContatoPorTelefone(tenantId, numero);
      // o numero (setor) dono do lead: o do contato que ja existe, senao o WhatsApp ativo do tenant
      const instancia = existente?.instancia || instanciaAtiva;
      if (!instancia) { console.error(`Clinicorp->Follow Up (tenant ${tenantId}): sem numero de WhatsApp ativo pra criar o contato de ${o.PatientName}`); continue; }
      const ativ = await ativacaoDe(instancia);
      if (!ativ.ativo) { resultado.desligados++; continue; } // automacao desligada nesse numero: nao registra, vale se ligar depois

      resultado.novos++;
      // historico antigo: na primeira rodada, ou marcado antes de o botao ser religado - so registra
      const marcadoEm = new Date(o.LastChange_Date || o.FollowUpUpdateDate || 0).getTime();
      const historico = (ativ.ativadoEm && marcadoEm < new Date(ativ.ativadoEm).getTime()) || (primeiraRodada && Date.now() - marcadoEm > DIAS_IMPORTAR_NA_PRIMEIRA * DIA_MS);
      if (historico) resultado.baseline++;

      let contatoId;
      let acao;
      if (existente) {
        if (existente.etapa === 'contatos_pessoais') { await registrar('ignorado_pessoal', existente.id); resultado.ignorados++; continue; }
        contatoId = existente.id;
        acao = existente.etapa === 'follow_up' ? 'ja_estava' : 'movido';
        if (existente.etapa !== 'follow_up') await crm.moverEtapa(tenantId, contatoId, 'follow_up');
      } else {
        contatoId = await crm.criarContatoDoClinicorp(tenantId, { numero, nome: o.PatientName, instancia, etapa: 'follow_up' });
        acao = 'criado';
      }
      if (ativ.operadorId !== null && ativ.operadorId !== undefined) await crm.atribuirSeLivre(tenantId, contatoId, ativ.operadorId).catch(() => {});
      if (acao !== 'ja_estava' && !historico) await followUp.iniciarAcompanhamento(tenantId, contatoId);
      await registrar(acao, contatoId);
      if (acao === 'movido') resultado.movidos++;
      if (acao === 'criado') resultado.criados++;
    } catch (err) {
      console.error(`Erro sincronizando orcamento ${id} do Clinicorp (tenant ${tenantId}):`, err.message);
    }
  }
  return resultado;
}

// roda a cada 10min pra todo tenant ativo com Clinicorp conectado. So chamado no boot do server.js.
export function iniciarSchedulerClinicorpFollowUp() {
  const rodar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      // toda conta com Clinicorp integrado. Se duas contas usam o MESMO Clinicorp (mesmo subscriber), so a dona roda:
      // conta de cliente ganha da conta admin; empate = a mais antiga (senao o paciente era criado nas duas)
      const { rows } = await pool.query(`
        SELECT t.id FROM tenants t JOIN tenant_config c ON c.tenant_id = t.id
         WHERE c.clinicorp_api_user IS NOT NULL AND c.clinicorp_ativo AND (t.ativo OR t.super_admin)
           AND NOT EXISTS (
             SELECT 1 FROM tenants t2 JOIN tenant_config c2 ON c2.tenant_id = t2.id
              WHERE t2.id <> t.id AND t2.ativo AND c2.clinicorp_api_user IS NOT NULL AND c2.clinicorp_ativo
                AND c2.clinicorp_subscriber_id = c.clinicorp_subscriber_id
                AND ((t.super_admin AND NOT t2.super_admin) OR (t.super_admin = t2.super_admin AND t2.id < t.id))
           )`);
      for (const { id } of rows) {
        try {
          const r = await sincronizarTenant(id);
          if (r.novos) console.log(`Clinicorp->Follow Up (tenant ${id}):`, JSON.stringify(r));
        } catch (err) {
          console.error(`Erro no sync Clinicorp->Follow Up do tenant ${id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro no sync Clinicorp->Follow Up:', err.message);
    }
  };
  setTimeout(rodar, 90 * 1000).unref();
  setInterval(rodar, 10 * 60 * 1000).unref();
}
