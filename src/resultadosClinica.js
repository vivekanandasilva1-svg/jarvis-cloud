// Aba Resultados - etapa 2: visao completa da clinica (agenda, recuperacao de dinheiro, origem dos
// leads, anuncios e metas do mes). Tudo filtrado por tenant. Cada bloco roda isolado: se um modulo
// nao tem dados (ou a tabela nao existe ainda), so ele vem como indisponivel e o resto aparece.
import { pool } from './db.js';
import { indicadoresDoIntervalo } from './crm.js';
import * as metaAds from './metaads.js';

const MS_DIA = 86400000;

function intervalo(de, ate) {
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + MS_DIA);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) throw new Error('Periodo invalido.');
  if (fim - inicio > 400 * MS_DIA) throw new Error('Escolha um periodo de no maximo 1 ano.');
  return { inicio, fim };
}

// roda um bloco; erro vira { disponivel: false } em vez de derrubar a resposta inteira
async function bloco(fn) {
  try {
    return { disponivel: true, ...(await fn()) };
  } catch (err) {
    return { disponivel: false, motivo: String(err.message || err).slice(0, 160) };
  }
}

const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function agenda(tenantId, inicio, fim) {
  const [cont, proximos, eventosDia] = await Promise.all([
    q(
      `SELECT etapa, count(DISTINCT contato_id)::int AS total FROM crm_etapa_eventos
       WHERE tenant_id = $1 AND etapa IN ('pre_agendado','agendado','compareceu','nao_compareceu','comprou','nao_comprou') AND em >= $2 AND em < $3
       GROUP BY etapa`,
      [tenantId, inicio, fim],
    ),
    // compromissos da agenda (Google/Agenda do app) nos proximos 7 dias, por dia
    q(
      `SELECT to_char((inicio AT TIME ZONE 'America/Maceio')::date, 'YYYY-MM-DD') AS dia, count(*)::int AS total
       FROM agenda_eventos WHERE tenant_id = $1 AND inicio >= now() AND inicio < now() + interval '7 days' GROUP BY 1 ORDER BY 1`,
      [tenantId],
    ),
    q(
      `SELECT count(*)::int AS total FROM agenda_eventos WHERE tenant_id = $1 AND inicio >= $2 AND inicio < $3`,
      [tenantId, inicio, fim],
    ),
  ]);
  const n = (id) => cont.find((c) => c.etapa === id)?.total || 0;
  const compareceu = n('compareceu');
  const faltou = n('nao_compareceu');
  return {
    preAgendados: n('pre_agendado'),
    agendados: n('agendado'),
    compareceu,
    faltou,
    comprou: n('comprou'),
    naoComprou: n('nao_comprou'),
    taxaComparecimento: compareceu + faltou ? Math.round((compareceu / (compareceu + faltou)) * 100) : null,
    taxaFechamento: n('comprou') + n('nao_comprou') ? Math.round((n('comprou') / (n('comprou') + n('nao_comprou'))) * 100) : null,
    proximos7: proximos,
    compromissosNoPeriodo: eventosDia[0]?.total || 0,
  };
}

async function recuperacao(tenantId, inicio, fim) {
  const res = {};
  const partes = await Promise.all([
    // orcamentos em aberto (Clinicorp) e aprovados no periodo
    bloco(async () => {
      const [aberto, porEtapa, aprov, parados] = await Promise.all([
        q(`SELECT count(*)::int AS qtd, COALESCE(sum(valor),0)::float AS valor FROM oa_orcamentos WHERE tenant_id = $1 AND ativo = true AND etapa <> 'aprovado'`, [tenantId]),
        q(`SELECT etapa, count(*)::int AS qtd, COALESCE(sum(valor),0)::float AS valor FROM oa_orcamentos WHERE tenant_id = $1 AND ativo = true AND etapa <> 'aprovado' GROUP BY etapa`, [tenantId]),
        q(`SELECT count(*)::int AS qtd, COALESCE(sum(valor),0)::float AS valor FROM oa_orcamentos WHERE tenant_id = $1 AND etapa = 'aprovado' AND etapa_desde >= $2 AND etapa_desde < $3`, [tenantId, inicio, fim]),
        q(`SELECT count(*)::int AS qtd, COALESCE(sum(valor),0)::float AS valor FROM oa_orcamentos WHERE tenant_id = $1 AND ativo = true AND etapa <> 'aprovado' AND orcamento_em < now() - interval '30 days'`, [tenantId]),
      ]);
      return { emAberto: aberto[0], porEtapa, aprovadosNoPeriodo: aprov[0], parados30: parados[0] };
    }),
    // resgate de orcamentos aprovados e nao concluidos
    bloco(async () => {
      const [pend, porEtapa, retomou, tent] = await Promise.all([
        q(`SELECT count(*)::int AS qtd, COALESCE(sum(valor_pendente),0)::float AS valor FROM res_pacientes WHERE tenant_id = $1 AND etapa NOT IN ('retomou','sem_sucesso')`, [tenantId]),
        q(`SELECT etapa, count(*)::int AS qtd FROM res_pacientes WHERE tenant_id = $1 GROUP BY etapa`, [tenantId]),
        q(`SELECT count(*)::int AS qtd, COALESCE(sum(valor_pendente),0)::float AS valor FROM res_pacientes WHERE tenant_id = $1 AND retomou_em >= $2 AND retomou_em < $3`, [tenantId, inicio, fim]),
        q(`SELECT count(*)::int AS total FROM res_tentativas WHERE tenant_id = $1 AND feita_em >= $2 AND feita_em < $3`, [tenantId, inicio, fim]),
      ]);
      return { pendente: pend[0], porEtapa, retomouNoPeriodo: retomou[0], tentativas: tent[0].total };
    }),
    // retorno / manutencao
    bloco(async () => {
      const [porEtapa, retornou, tent] = await Promise.all([
        q(`SELECT etapa, count(*)::int AS qtd FROM ret_pacientes WHERE tenant_id = $1 AND na_lista = true AND arquivado = false GROUP BY etapa`, [tenantId]),
        q(`SELECT count(*)::int AS qtd FROM ret_pacientes WHERE tenant_id = $1 AND etapa IN ('agendou','retornou') AND etapa_desde >= $2 AND etapa_desde < $3`, [tenantId, inicio, fim]),
        q(`SELECT count(*)::int AS total FROM ret_tentativas t JOIN ret_pacientes p ON p.id = t.ret_id WHERE p.tenant_id = $1 AND t.feita_em >= $2 AND t.feita_em < $3`, [tenantId, inicio, fim]),
      ]);
      return { porEtapa, recuperadosNoPeriodo: retornou[0].qtd, tentativas: tent[0].total };
    }),
    // indicacoes
    bloco(async () => {
      const [novos, porEtapa, indicadores] = await Promise.all([
        q(`SELECT count(*)::int AS total FROM ind_indicados WHERE tenant_id = $1 AND criado_em >= $2 AND criado_em < $3`, [tenantId, inicio, fim]),
        q(`SELECT etapa, count(*)::int AS qtd FROM ind_indicados WHERE tenant_id = $1 AND criado_em >= $2 AND criado_em < $3 GROUP BY etapa`, [tenantId, inicio, fim]),
        q(`SELECT count(*)::int AS total FROM ind_indicadores WHERE tenant_id = $1`, [tenantId]),
      ]);
      const n = (id) => porEtapa.find((e) => e.etapa === id)?.qtd || 0;
      return { novos: novos[0].total, agendados: n('agendado'), compareceram: n('compareceu'), indicadores: indicadores[0].total };
    }),
    // follow-up automatico: quantos entraram, quantas mensagens e quantos voltaram a responder
    bloco(async () => {
      const [exec, msgs, resp] = await Promise.all([
        q(`SELECT count(*)::int AS entraram, (count(*) FILTER (WHERE enviados > 0))::int AS atingidos FROM fui_execucoes WHERE tenant_id = $1 AND entrou_em >= $2 AND entrou_em < $3`, [tenantId, inicio, fim]),
        q(`SELECT count(*)::int AS total, count(DISTINCT numero || '|' || instancia)::int AS contatos FROM crm_mensagens WHERE tenant_id = $1 AND direcao = 'saida' AND autor = 'followup' AND criado_em >= $2 AND criado_em < $3`, [tenantId, inicio, fim]),
        q(
          `SELECT count(DISTINCT f.numero || '|' || f.instancia)::int AS total FROM crm_mensagens f
           WHERE f.tenant_id = $1 AND f.direcao = 'saida' AND f.autor = 'followup' AND f.criado_em >= $2 AND f.criado_em < $3
             AND EXISTS (SELECT 1 FROM crm_mensagens e WHERE e.tenant_id = f.tenant_id AND e.numero = f.numero AND e.instancia = f.instancia
                         AND e.direcao = 'entrada' AND e.criado_em > f.criado_em AND e.criado_em <= f.criado_em + interval '3 days')`,
          [tenantId, inicio, fim],
        ),
      ]);
      // modo resgate: leads reativados que ganharam a etiqueta, e quantos agendaram / compareceram depois disso
      const resgate = await q(
        `SELECT count(*)::int AS resgatados,
                (count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_etapa_eventos e WHERE e.tenant_id = r.tenant_id AND e.contato_id = r.contato_id AND e.etapa = 'agendado' AND e.em > r.resgatado_em)))::int AS agendaram,
                (count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_etapa_eventos e WHERE e.tenant_id = r.tenant_id AND e.contato_id = r.contato_id AND e.etapa = 'compareceu' AND e.em > r.resgatado_em)))::int AS compareceram
           FROM follow_up_resgates r WHERE r.tenant_id = $1 AND r.resgatado_em >= $2 AND r.resgatado_em < $3`,
        [tenantId, inicio, fim],
      ).then((r2) => r2[0]).catch(() => null);
      // faltosos: quem entrou em "Nao compareceu" no periodo, quantos voltaram a escrever e quantos remarcaram (pre-agendado/agendado)
      const faltosos = await q(
        `WITH f AS (SELECT e.contato_id, min(e.em) AS faltou_em FROM crm_etapa_eventos e WHERE e.tenant_id = $1 AND e.etapa = 'nao_compareceu' AND e.em >= $2 AND e.em < $3 GROUP BY e.contato_id)
         SELECT count(*)::int AS faltaram,
                (count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_contatos c JOIN crm_mensagens m ON m.tenant_id = c.tenant_id AND m.numero = c.numero AND m.instancia = c.instancia
                                                  WHERE c.id = f.contato_id AND c.tenant_id = $1 AND m.direcao = 'entrada' AND m.criado_em > f.faltou_em)))::int AS voltaram,
                (count(*) FILTER (WHERE EXISTS (SELECT 1 FROM crm_etapa_eventos e2 WHERE e2.tenant_id = $1 AND e2.contato_id = f.contato_id AND e2.etapa IN ('pre_agendado', 'agendado') AND e2.em > f.faltou_em)))::int AS remarcaram
           FROM f`,
        [tenantId, inicio, fim],
      ).then((r3) => r3[0]).catch(() => null);
      return { entraram: exec[0].entraram, atingidos: exec[0].atingidos, mensagens: msgs[0].total, contatos: msgs[0].contatos, voltaramAResponder: resp[0].total, resgate, faltosos };
    }),
    // aniversariantes
    bloco(async () => {
      const r = await q(`SELECT count(*)::int AS total FROM aniversariantes_envios WHERE tenant_id = $1 AND status = 'enviado' AND enviado_em >= $2 AND enviado_em < $3`, [tenantId, inicio, fim]);
      return { enviados: r[0].total };
    }),
  ]);
  [res.orcamentos, res.resgate, res.retorno, res.indicacoes, res.followUp, res.aniversariantes] = partes;
  // destaque: dinheiro que voltou no periodo (so soma o que o app tem como registrado)
  const aprovado = res.orcamentos.disponivel ? res.orcamentos.aprovadosNoPeriodo.valor : 0;
  const retomado = res.resgate.disponivel ? res.resgate.retomouNoPeriodo.valor : 0;
  res.dinheiroRecuperado = { valor: aprovado + retomado, orcamentosAprovados: aprovado, resgatesRetomados: retomado };
  return res;
}

async function origem(tenantId, inicio, fim) {
  const rows = await q(
    `SELECT COALESCE(NULLIF(origem_campanha, ''), NULLIF(origem_titulo, ''), NULLIF(origem_fonte, ''), 'Sem origem identificada') AS origem,
            (origem_anuncio_id IS NOT NULL) AS anuncio,
            count(*)::int AS leads,
            (count(*) FILTER (WHERE etapa IN ('agendado','compareceu','comprou')))::int AS convertidos,
            (count(*) FILTER (WHERE etapa = 'comprou'))::int AS comprou
     FROM crm_contatos WHERE tenant_id = $1 AND oculto = false AND origem = 'whatsapp' AND criado_em >= $2 AND criado_em < $3
     GROUP BY 1, 2 ORDER BY leads DESC LIMIT 40`,
    [tenantId, inicio, fim],
  );
  // junta linhas da mesma origem (anuncio e nao anuncio)
  const mapa = new Map();
  for (const r of rows) {
    const m = mapa.get(r.origem) || { origem: r.origem, anuncio: false, leads: 0, convertidos: 0, comprou: 0 };
    m.leads += r.leads; m.convertidos += r.convertidos; m.comprou += r.comprou; m.anuncio = m.anuncio || r.anuncio;
    mapa.set(r.origem, m);
  }
  const lista = [...mapa.values()].sort((a, b) => b.leads - a.leads).slice(0, 12);
  const total = lista.reduce((s, o) => s + o.leads, 0);
  const deAnuncio = lista.filter((o) => o.anuncio).reduce((s, o) => s + o.leads, 0);
  return { lista, total, deAnuncio };
}

export async function resultadosClinica(tenantId, { de, ate }) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  const { inicio, fim } = intervalo(de, ate);
  const [a, r, o] = await Promise.all([
    bloco(() => agenda(tenantId, inicio, fim)),
    bloco(() => recuperacao(tenantId, inicio, fim)),
    bloco(() => origem(tenantId, inicio, fim)),
  ]);
  return { periodo: { de, ate }, agenda: a, recuperacao: r, origem: o };
}

// ---------- anuncios (Meta Ads) - separado porque depende de chamada externa e pode demorar ----------
export async function resultadosAnuncios(tenantId, { de, ate }) {
  intervalo(de, ate);
  let contas;
  try {
    ({ contas } = await metaAds.listAdAccountsDetalhado(tenantId, { apenasAtivas: true }));
  } catch (err) {
    if (/nenhuma conta/i.test(err.message)) return { conectado: false };
    return { conectado: true, erro: String(err.message).slice(0, 200), contas: [] };
  }
  const alvo = (contas || []).slice(0, 12);
  const saidas = await Promise.allSettled(alvo.map((c) => metaAds.getInsights(tenantId, { objectId: c.id, objectType: 'account', since: de, until: ate })));
  const lista = [];
  const falhas = [];
  saidas.forEach((s, i) => {
    const c = alvo[i];
    if (s.status !== 'fulfilled') { falhas.push({ nome: c.name || c.id, erro: String(s.reason?.message || s.reason).slice(0, 120) }); return; }
    const linha = s.value?.[0];
    if (!linha) return;
    const rc = metaAds.extractResultsAndCPA(linha);
    lista.push({
      nome: c.name || c.id,
      gasto: Number(linha.spend || 0), impressoes: Number(linha.impressions || 0), cliques: Number(linha.clicks || 0),
      resultados: rc.resultados, tipoResultado: rc.tipo, custoPorResultado: rc.custoPorResultado,
    });
  });
  const gasto = lista.reduce((s, c) => s + c.gasto, 0);
  const resultados = lista.reduce((s, c) => s + c.resultados, 0);
  return {
    conectado: true,
    contas: lista.sort((x, y) => y.gasto - x.gasto),
    falhas,
    totais: { gasto, impressoes: lista.reduce((s, c) => s + c.impressoes, 0), cliques: lista.reduce((s, c) => s + c.cliques, 0), resultados, custoPorResultado: resultados ? gasto / resultados : null },
  };
}

// ---------- metas do mes (o dono define; o progresso e do mes corrente, nao do periodo do filtro) ----------
const METAS_CHAVES = ['novos', 'agendamentos', 'pct5', 'recuperado'];
let metasProntas = null;
function garantirMetas() {
  if (!metasProntas) {
    metasProntas = pool.query(`CREATE TABLE IF NOT EXISTS rs_metas (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      metas JSONB NOT NULL DEFAULT '{}'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`).catch((e) => { metasProntas = null; throw e; });
  }
  return metasProntas;
}

export async function salvarMetas(tenantId, metas) {
  await garantirMetas();
  const limpas = {};
  for (const k of METAS_CHAVES) {
    const v = Number(metas?.[k]);
    if (Number.isFinite(v) && v > 0) limpas[k] = k === 'pct5' ? Math.min(100, Math.round(v)) : Math.round(v * 100) / 100;
  }
  await pool.query(
    `INSERT INTO rs_metas (tenant_id, metas) VALUES ($1, $2::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET metas = EXCLUDED.metas, atualizado_em = now()`,
    [tenantId, JSON.stringify(limpas)],
  );
  return limpas;
}

export async function metasDoMes(tenantId) {
  await garantirMetas();
  const { rows: [cfg] } = await pool.query('SELECT metas FROM rs_metas WHERE tenant_id = $1', [tenantId]);
  const metas = cfg?.metas || {};
  const hoje = new Date(Date.now() - 3 * 3600000); // Maceio (UTC-3 fixo)
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const diasMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const diaAtual = hoje.getUTCDate();
  const iso = (d) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const inicio = new Date(`${iso(1)}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + diasMes * MS_DIA);
  const ind = await indicadoresDoIntervalo(tenantId, inicio, fim, null);
  let recuperado = 0;
  try {
    const [o, r] = await Promise.all([
      q(`SELECT COALESCE(sum(valor),0)::float AS v FROM oa_orcamentos WHERE tenant_id = $1 AND etapa = 'aprovado' AND etapa_desde >= $2 AND etapa_desde < $3`, [tenantId, inicio, fim]),
      q(`SELECT COALESCE(sum(valor_pendente),0)::float AS v FROM res_pacientes WHERE tenant_id = $1 AND retomou_em >= $2 AND retomou_em < $3`, [tenantId, inicio, fim]),
    ]);
    recuperado = o[0].v + r[0].v;
  } catch { /* modulos sem dados: fica 0 */ }
  const pct5 = ind.contatos_iniciados ? Math.round((ind.em_5min / ind.contatos_iniciados) * 100) : null;
  const atual = { novos: ind.novos, agendamentos: ind.agendamentos, pct5, recuperado };
  return {
    mes: { ano, mes: mes + 1, diasMes, diaAtual },
    metas,
    atual,
    // projecao linear ate o fim do mes (so faz sentido pra metas de volume)
    projecao: {
      novos: Math.round((ind.novos / diaAtual) * diasMes),
      agendamentos: Math.round((ind.agendamentos / diaAtual) * diasMes),
      recuperado: Math.round((recuperado / diaAtual) * diasMes),
    },
  };
}
