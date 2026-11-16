// Monitor de saude das contas de anuncios do Meta (Meta Ads): avisa no sino do app e no WhatsApp do dono quando
//  - a conta GASTA mas deixou de gerar conversas/leads (o caso classico de numero do WhatsApp desvinculado da Pagina,
//    restricao de leads, pixel/formulario quebrado);
//  - o resultado CAI de forma forte em relacao a media dos dias anteriores;
//  - a conta tem status de restricao (desativada, nao liquidada, em analise de risco, encerramento...);
//  - a empresa (Business Manager) nao esta verificada ou ha saldo pendente de pagamento;
//  - ha anuncios ativos reprovados/com problema.
// So olha contas que gastaram nos ultimos dias (nao enche de alerta de conta parada). Roda a cada 3h; avisa por
// WhatsApp quando surge/piora e lembra 1x por dia (09h) enquanto continuar aberto. Somente LEITURA no Meta.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos } from './tenants.js';
import * as tenantConfig from './tenantConfig.js';
import * as whatsappInstances from './whatsappInstances.js';
import { enviarMensagemTexto } from './evolutionApi.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MIN_GASTO_DIA = 50;          // R$ gastos no dia pra considerar "gastou sem resultado"
const MIN_MEDIA_RESULTADOS = 3;    // so alerta se antes a conta rendia pelo menos isso por dia
const STATUS_CONTA = {
  1: 'ativa', 2: 'desativada', 3: 'com pagamento em atraso (não liquidada)', 7: 'em análise de risco',
  8: 'com liquidação pendente', 9: 'em período de carência de pagamento', 100: 'com encerramento pendente', 101: 'encerrada',
};
const MOTIVO_DESATIVACAO = {
  1: 'violação das políticas de integridade de anúncios', 2: 'violação das políticas da conta de anúncios', 3: 'violação de integridade do negócio',
  4: 'encerramento permanente', 5: 'conta sem uso', 6: 'acesso não autorizado suspeito', 7: 'revisão de risco', 8: 'problema de pagamento/ liquidação',
};

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_saude_alertas (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      conta_id TEXT NOT NULL,
      conta_nome TEXT,
      cliente TEXT,
      tipo TEXT NOT NULL,
      nivel TEXT NOT NULL,
      titulo TEXT NOT NULL,
      detalhe TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolvido_em TIMESTAMPTZ,
      ultimo_aviso_em TIMESTAMPTZ,
      UNIQUE (tenant_id, conta_id, tipo)
    );
  `);
  await pool.query(`CREATE TABLE IF NOT EXISTS meta_saude_execucao (tenant_id INT PRIMARY KEY REFERENCES tenants(id), ultima_em TIMESTAMPTZ, resumo TEXT)`);
}
const tabelasProntas = garantirTabelas().catch((err) => console.error('[metaSaude] erro criando tabelas:', err.message));

async function graph(token, path) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20000) });
  return r.json();
}

// conversas iniciadas e leads, separados (e sem contar os tipos duplicados que o Meta repete)
function resultadosDe(actions) {
  const v = (t) => Number((actions || []).find((a) => a.action_type === t)?.value || 0);
  return { conv: v('onsite_conversion.messaging_conversation_started_7d'), leads: v('lead') };
}
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso) => String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7);

async function listarContas(token) {
  const contas = [];
  let url = 'me/adaccounts?fields=name,account_status,disable_reason,balance,currency,business{id,name,verification_status}&limit=100';
  for (let i = 0; i < 5 && url; i++) {
    const r = await graph(token, url);
    if (r.error) break;
    contas.push(...(r.data || []));
    url = r.paging?.next ? r.paging.next.replace(`${GRAPH}/`, '').replace(/&?access_token=[^&]*/, '') : null;
  }
  return contas;
}

// devolve os alertas ATUAIS de uma conta (lista de { tipo, nivel, titulo, detalhe })
async function analisarConta(token, c) {
  const alertas = [];
  const cliente = c.business?.name || c.name;
  const hoje = new Date(Date.now() - 3 * 3600000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const ins = await graph(token, `${c.id}/insights?fields=spend,actions&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since: iso(new Date(hoje.getTime() - 9 * 86400000)), until: iso(hoje) }))}&limit=20`);
  const dias = (ins.data || []).map((d) => ({ dia: d.date_start, gasto: Number(d.spend || 0), ...resultadosDe(d.actions) }));
  const hojeStr = iso(hoje);
  const fechados = dias.filter((d) => d.dia < hojeStr); // dias completos
  const gastouRecente = fechados.slice(-3).some((d) => d.gasto > 0);
  if (!gastouRecente && Number(c.account_status) === 1) return { alertas, ativa: false, cliente };

  // 1) status da conta / desativacao
  if (Number(c.account_status) !== 1) {
    const motivo = Number(c.disable_reason) ? ` Motivo: ${MOTIVO_DESATIVACAO[c.disable_reason] || `código ${c.disable_reason}`}.` : '';
    alertas.push({ tipo: 'status_conta', nivel: 'critico', titulo: `Conta ${STATUS_CONTA[c.account_status] || `com status ${c.account_status}`}`, detalhe: `A conta de anúncios está ${STATUS_CONTA[c.account_status] || `com status ${c.account_status}`}.${motivo} Abra o Gerenciador de Negócios > Qualidade da conta para ver o motivo e pedir análise.` });
  }
  // 2) gasta sem gerar conversas/leads, ou resultado despenca (conversas e leads avaliados separadamente)
  if (fechados.length >= 3) {
    const ontem = fechados[fechados.length - 1];
    const anteontem = fechados[fechados.length - 2];
    const base = fechados.slice(0, -1).slice(-6);
    const media = (k) => (base.length ? base.reduce((x, d) => x + d[k], 0) / base.length : 0);
    const mConv = media('conv'), mLead = media('leads');
    if (ontem.gasto >= MIN_GASTO_DIA) {
      const zeroConv = mConv >= MIN_MEDIA_RESULTADOS && ontem.conv === 0;
      const zeroLead = mLead >= MIN_MEDIA_RESULTADOS && ontem.leads === 0;
      if (zeroConv || zeroLead) {
        const dois = (zeroConv ? anteontem.conv === 0 : anteontem.leads === 0) && anteontem.gasto >= MIN_GASTO_DIA;
        const oque = zeroConv && zeroLead ? 'conversas nem leads' : zeroConv ? 'iniciar nenhuma conversa' : 'gerar nenhum lead';
        alertas.push({ tipo: 'sem_resultado', nivel: 'critico', titulo: `Gastou ${brl(ontem.gasto)} sem ${oque}${dois ? ' (2 dias seguidos)' : ''}`, detalhe: `Em ${dataBr(ontem.dia)} a conta gastou ${brl(ontem.gasto)}: ${ontem.conv} conversas e ${ontem.leads} leads (média dos dias anteriores: ${mConv.toFixed(1)} conversas e ${mLead.toFixed(1)} leads por dia). Costuma ser: número do WhatsApp desvinculado da Página, restrição de leads, formulário/site com problema ou limitação da conta. Confira a Qualidade da conta e o vínculo do WhatsApp na Página.` });
      } else {
        const quedaConv = mConv >= 5 && ontem.conv < mConv * 0.3;
        const quedaLead = mLead >= 5 && ontem.leads < mLead * 0.3;
        if (quedaConv || quedaLead) {
          const partes = [];
          if (quedaConv) partes.push(`conversas ${ontem.conv} (média ${mConv.toFixed(1)})`);
          if (quedaLead) partes.push(`leads ${ontem.leads} (média ${mLead.toFixed(1)})`);
          alertas.push({ tipo: 'queda_resultado', nivel: 'atencao', titulo: 'Queda forte de resultados', detalhe: `Em ${dataBr(ontem.dia)}, gastando ${brl(ontem.gasto)}: ${partes.join(' e ')}. Vale checar entrega, público e o destino das mensagens.` });
        }
      }
    }
  }
  // 3) empresa nao verificada (limita recursos e pode restringir leads) - so pra conta que esta rodando
  if (c.business && c.business.verification_status && c.business.verification_status !== 'verified') {
    alertas.push({ tipo: 'empresa_nao_verificada', nivel: 'atencao', titulo: `Empresa "${c.business.name}" não verificada no Meta`, detalhe: 'O Meta pode limitar recursos e leads de empresas sem verificação. Faça em Configurações do negócio > Central de segurança > Iniciar verificação (CNPJ e documentos iguais ao cadastro). Costuma levar de 1 a 5 dias úteis.' });
  }
  // 4) saldo pendente de pagamento
  const saldo = Number(c.balance || 0) / 100;
  if (saldo >= 50) alertas.push({ tipo: 'saldo_pendente', nivel: Number(c.account_status) === 1 ? 'atencao' : 'critico', titulo: `Saldo pendente de ${brl(saldo)} para pagar`, detalhe: 'Há valor em aberto na conta. Pague em Cobrança e pagamentos e deixe uma forma de pagamento reserva, para o pagamento em atraso não pausar os anúncios.' });
  // 5) anuncios com problema/reprovados, so de campanhas ATIVAS (os de campanha pausada nao atrapalham)
  const ads = await graph(token, `${c.id}/ads?fields=name,effective_status,issues_info,campaign{effective_status}&effective_status=${encodeURIComponent('["DISAPPROVED","WITH_ISSUES"]')}&limit=100`);
  const ruins = (ads.data || []).filter((a) => a.campaign?.effective_status === 'ACTIVE' && (a.effective_status === 'DISAPPROVED' || a.effective_status === 'WITH_ISSUES'));
  if (ruins.length) {
    const motivos = [...new Set(ruins.flatMap((a) => (a.issues_info || []).map((i) => i.error_summary)).filter(Boolean))].slice(0, 2).join('; ');
    alertas.push({ tipo: 'anuncios_problema', nivel: 'atencao', titulo: `${ruins.length} anúncio(s) de campanha ativa com problema ou reprovado(s)`, detalhe: `${motivos ? `Motivo: ${motivos}. ` : ''}Abra o Gerenciador de Anúncios e filtre por "Com problemas".` });
  }
  return { alertas, ativa: true, cliente };
}

function horarioDeAviso() {
  const h = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', hour12: false }));
  return h >= 7 && h < 22;
}

async function avisarWhatsApp(tenantId, linhas) {
  if (!linhas.length) return false;
  const { numeroAdmin } = await whatsappInstances.obterConfig(tenantId);
  if (!numeroAdmin) return false;
  const texto = `📢 *Meta Ads - alerta*\n\n${linhas.join('\n\n')}\n\nVeja também no sino da Lumia.`;
  await enviarMensagemTexto(tenantId, numeroAdmin, texto.slice(0, 3500));
  return true;
}

const emExecucao = new Set();
// roda a verificacao de UM tenant. dryRun: nao grava nem avisa (so devolve o que encontrou)
export async function verificarTenant(tenantId, { dryRun = false } = {}) {
  if (!pool) return { contas: 0, alertas: [] };
  await tabelasProntas;
  if (emExecucao.has(tenantId)) return { contas: 0, alertas: [], ocupado: true };
  emExecucao.add(tenantId);
  try {
    const tokens = await tenantConfig.obterMetaAdsTokens(tenantId);
    const vistas = new Set();
    const achados = []; // { conta, cliente, alertas }
    let analisadas = 0;
    for (const tk of tokens) {
      let contas = [];
      try { contas = await listarContas(tk.token); } catch { continue; }
      for (const c of contas) {
        if (vistas.has(c.id)) continue;
        vistas.add(c.id);
        try {
          const r = await analisarConta(tk.token, c);
          if (r.ativa) analisadas++;
          achados.push({ conta: c, cliente: r.cliente, alertas: r.alertas, ativa: r.ativa });
        } catch (err) { console.error('[metaSaude] conta', c.id, err.message); }
      }
    }
    const lista = achados.flatMap((a) => a.alertas.map((al) => ({ conta_id: a.conta.id, conta_nome: a.conta.name, cliente: a.cliente, ...al })));
    if (dryRun) return { contas: vistas.size, analisadas, alertas: lista };

    const novos = []; // vai pro WhatsApp
    for (const a of achados) {
      const tiposAgora = new Set(a.alertas.map((x) => x.tipo));
      // o que nao vale mais = resolvido
      await pool.query(
        `UPDATE meta_saude_alertas SET resolvido_em = now() WHERE tenant_id = $1 AND conta_id = $2 AND resolvido_em IS NULL AND NOT (tipo = ANY($3::text[]))`,
        [tenantId, a.conta.id, [...tiposAgora]],
      );
      for (const al of a.alertas) {
        const { rows: [ex] } = await pool.query('SELECT id, nivel, resolvido_em, ultimo_aviso_em FROM meta_saude_alertas WHERE tenant_id = $1 AND conta_id = $2 AND tipo = $3', [tenantId, a.conta.id, al.tipo]);
        const reabriu = ex && ex.resolvido_em;
        const piorou = ex && !ex.resolvido_em && ex.nivel === 'atencao' && al.nivel === 'critico';
        await pool.query(
          `INSERT INTO meta_saude_alertas (tenant_id, conta_id, conta_nome, cliente, tipo, nivel, titulo, detalhe)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (tenant_id, conta_id, tipo) DO UPDATE SET conta_nome = $3, cliente = $4, nivel = $6, titulo = $7, detalhe = $8, atualizado_em = now(), resolvido_em = NULL`,
          [tenantId, a.conta.id, a.conta.name, a.cliente, al.tipo, al.nivel, al.titulo, al.detalhe],
        );
        if (!ex || reabriu || piorou) novos.push({ conta: a.conta, cliente: a.cliente, al });
      }
    }
    // aviso por WhatsApp: novos/pioraram agora (dentro do horario) + lembrete diario (09h) dos criticos ainda abertos
    const linhas = [];
    const idsAvisados = [];
    if (novos.length && horarioDeAviso()) {
      for (const n of novos.filter((x) => x.al.nivel === 'critico')) { idsAvisados.push([n.conta.id, n.al.tipo]); linhas.push(`${n.al.nivel === 'critico' ? '🔴' : '🟠'} *${n.cliente}* (${n.conta.name})\n${n.al.titulo}\n${n.al.detalhe}`); }
    }
    let avisou = false;
    if (linhas.length) {
      avisou = await avisarWhatsApp(tenantId, linhas).catch((err) => { console.error('[metaSaude] aviso WhatsApp:', err.message); return false; });
      if (avisou) for (const [cid, tipo] of idsAvisados) await pool.query('UPDATE meta_saude_alertas SET ultimo_aviso_em = now() WHERE tenant_id = $1 AND conta_id = $2 AND tipo = $3', [tenantId, cid, tipo]);
    }
    const abertos = lista.length;
    await pool.query(
      `INSERT INTO meta_saude_execucao (tenant_id, ultima_em, resumo) VALUES ($1, now(), $2) ON CONFLICT (tenant_id) DO UPDATE SET ultima_em = now(), resumo = $2`,
      [tenantId, `${vistas.size} contas vistas, ${analisadas} com gasto recente, ${abertos} alerta(s) aberto(s)${avisou ? ', WhatsApp enviado' : ''}`],
    );
    return { contas: vistas.size, analisadas, alertas: lista, avisou };
  } finally { emExecucao.delete(tenantId); }
}

export async function listarAbertos(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT conta_id, conta_nome, cliente, tipo, nivel, titulo, detalhe, criado_em, atualizado_em FROM meta_saude_alertas WHERE tenant_id = $1 AND resolvido_em IS NULL ORDER BY (nivel = 'critico') DESC, atualizado_em DESC`,
    [tenantId],
  );
  return rows;
}
export async function ultimaExecucao(tenantId) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query('SELECT ultima_em, resumo FROM meta_saude_execucao WHERE tenant_id = $1', [tenantId]);
  return rows[0] || null;
}

// lembrete diario (09h Maceio): lista o que continua aberto e critico - so le o banco, nao consulta o Meta
export async function lembreteDiario() {
  if (!pool) return;
  await tabelasProntas;
  const { rows: tenantsComAlerta } = await pool.query(
    `SELECT DISTINCT tenant_id FROM meta_saude_alertas WHERE resolvido_em IS NULL AND ((nivel = 'critico' AND (ultimo_aviso_em IS NULL OR ultimo_aviso_em < now() - interval '20 hours')) OR (nivel = 'atencao' AND (ultimo_aviso_em IS NULL OR ultimo_aviso_em < now() - interval '7 days')))`,
  );
  for (const { tenant_id: t } of tenantsComAlerta) {
    const { rows: crit } = await pool.query(`SELECT conta_id, tipo, conta_nome, cliente, titulo FROM meta_saude_alertas WHERE tenant_id = $1 AND resolvido_em IS NULL AND nivel = 'critico' AND (ultimo_aviso_em IS NULL OR ultimo_aviso_em < now() - interval '20 hours') ORDER BY atualizado_em DESC`, [t]);
    const { rows: aten } = await pool.query(`SELECT conta_id, tipo, conta_nome, cliente, titulo FROM meta_saude_alertas WHERE tenant_id = $1 AND resolvido_em IS NULL AND nivel = 'atencao' AND (ultimo_aviso_em IS NULL OR ultimo_aviso_em < now() - interval '7 days') ORDER BY cliente, atualizado_em DESC`, [t]);
    const linhas = [];
    if (crit.length) linhas.push('🔴 *Críticos ainda abertos*\n' + crit.map((r) => `• ${r.cliente} (${r.conta_nome}): ${r.titulo}`).join('\n'));
    if (aten.length) linhas.push('🟠 *Para ficar de olho*\n' + aten.slice(0, 15).map((r) => `• ${r.cliente}: ${r.titulo}`).join('\n') + (aten.length > 15 ? `\n… e mais ${aten.length - 15} (veja no sino da Lumia)` : ''));
    const enviou = await avisarWhatsApp(t, linhas).catch((err) => { console.error('[metaSaude] resumo diario:', err.message); return false; });
    if (enviou) for (const r of [...crit, ...aten.slice(0, 15)]) await pool.query('UPDATE meta_saude_alertas SET ultimo_aviso_em = now() WHERE tenant_id = $1 AND conta_id = $2 AND tipo = $3', [t, r.conta_id, r.tipo]);
  }
}

export function iniciarSchedulerMetaSaude() {
  let ultimoLembrete = '';
  setInterval(() => {
    const agora = new Date(Date.now() - 3 * 3600000);
    const dia = agora.toISOString().slice(0, 10);
    if (agora.getUTCHours() === 9 && ultimoLembrete !== dia) { ultimoLembrete = dia; lembreteDiario().catch((err) => console.error('[metaSaude] lembrete:', err.message)); }
  }, 10 * 60 * 1000).unref();
  const rodar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const { rows } = await pool.query(`SELECT t.id FROM tenants t JOIN tenant_config c ON c.tenant_id = t.id WHERE c.meta_ads_tokens_enc IS NOT NULL AND (t.ativo OR t.super_admin)`);
      for (const { id } of rows) {
        try { await verificarTenant(id); } catch (err) { console.error('[metaSaude] tenant', id, err.message); }
      }
    } catch (err) { console.error('[metaSaude] scheduler:', err.message); }
  };
  setTimeout(rodar, 2 * 60 * 1000).unref();
  setInterval(rodar, 3 * 60 * 60 * 1000).unref();
}
