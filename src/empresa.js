// "Minha Empresa": dados reais pra animar o escritorio 3D (quem esta trabalhando agora e os
// numeros do dia). So leitura, sempre filtrada pelo tenant. Fase 1: atividade das IAs sai das
// mensagens que elas enviaram (crm_mensagens.autor = 'ia' | 'followup' | 'disparo').
import { pool } from './db.js';
import * as agenda from './agenda.js';

const FUSO = 'America/Maceio';

// de qual "autor" de mensagem cada agente vive (Bia/Liz dividem 'ia' ate a Fase 2 separar por etapa;
// Lua/Anne dividem 'followup'; Lorena = disparos/aniversariantes)
const AUTOR_DO_AGENTE = { liz: 'ia', bia: 'ia', lua: 'followup', anne: 'followup', lorena: 'disparo' };

export async function estado(tenantId) {
  const agora = new Date();
  const agentes = {};
  for (const k of Object.keys(AUTOR_DO_AGENTE)) agentes[k] = { hoje: 0, recentes: 0, ultimaEm: null, ativa: false };
  let pacientesHoje = null;
  if (!pool) return { agora: agora.toISOString(), agentes, pacientesHoje };

  try {
    const { rows } = await pool.query(
      `SELECT autor,
              count(*) FILTER (WHERE criado_em > now() - interval '10 minutes')::int AS recentes,
              count(*) FILTER (WHERE criado_em >= (date_trunc('day', now() AT TIME ZONE $2)) AT TIME ZONE $2)::int AS hoje,
              max(criado_em) AS ultima
         FROM crm_mensagens
        WHERE tenant_id = $1 AND direcao = 'saida' AND autor IN ('ia', 'followup', 'disparo')
          AND criado_em > now() - interval '2 days'
        GROUP BY autor`,
      [tenantId, FUSO],
    );
    const porAutor = new Map(rows.map((r) => [r.autor, r]));
    for (const [k, autor] of Object.entries(AUTOR_DO_AGENTE)) {
      const r = porAutor.get(autor);
      if (!r) continue;
      agentes[k] = {
        hoje: r.hoje, recentes: r.recentes, ultimaEm: r.ultima,
        ativa: !!r.ultima && Date.now() - new Date(r.ultima).getTime() < 3 * 60 * 1000, // mandou algo nos ultimos 3 min
      };
    }
  } catch (err) {
    console.error('Empresa: erro lendo atividade das IAs:', err.message);
  }

  try {
    const ini = new Date(agora.toLocaleDateString('en-CA', { timeZone: FUSO }) + 'T00:00:00-03:00');
    const fim = new Date(ini.getTime() + 24 * 3600 * 1000 - 1);
    pacientesHoje = (await agenda.listarEventos(tenantId, ini.toISOString(), fim.toISOString())).length;
  } catch {
    pacientesHoje = null; // agenda nao conectada: o escritorio so usa o fluxo ilustrativo
  }
  return { agora: agora.toISOString(), agentes, pacientesHoje };
}
