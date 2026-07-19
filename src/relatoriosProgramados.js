// relatorios configuraveis (aba "Relatorios" do app): 1+ numeros de WhatsApp destinatarios,
// e 4 tipos de relatorio que podem ser ligados/desligados independentemente, cada um com sua
// propria frequencia de envio automatico. Cada gerador de relatorio monta o texto inteiro em
// codigo (nao pela Claude) - mesmo raciocinio do relatorioDiario.js: sai sempre identico,
// sem depender da IA estar disponivel pro envio automatico funcionar.
import { pool } from './db.js';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';
import { enviarMensagemTexto } from './evolutionApi.js';

export const TIPOS_RELATORIO = ['ads_financeiro', 'ads_metricas', 'clinica_financeiro', 'clinica_agendamentos'];
export const FREQUENCIAS = ['diario', 'semanal', 'quinzenal', 'mensal', 'semestral', 'anual'];

const NOME_TIPO = {
  ads_financeiro: 'Meta Ads - Financeiro Completo',
  ads_metricas: 'Meta Ads - Todas as Metricas das Campanhas',
  clinica_financeiro: 'Clinica - Relatorio Financeiro Geral',
  clinica_agendamentos: 'Clinica - Relatorio de Agendamentos Completo',
};

const DIAS_POR_FREQUENCIA = { diario: 1, semanal: 7, quinzenal: 14, mensal: 30, semestral: 182, anual: 365 };

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relatorio_destinatarios (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relatorio_configs (
      tipo TEXT PRIMARY KEY,
      ativo BOOLEAN NOT NULL DEFAULT false,
      frequencia TEXT NOT NULL DEFAULT 'diario',
      ultimo_envio_em TIMESTAMPTZ,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // garante que as 4 linhas de config sempre existam (mais facil de consultar/atualizar do
  // que checar existencia toda vez)
  for (const tipo of TIPOS_RELATORIO) {
    await pool.query(
      'INSERT INTO relatorio_configs (tipo) VALUES ($1) ON CONFLICT (tipo) DO NOTHING',
      [tipo],
    );
  }
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas de relatorios programados:', err.message);
});

// ---------- destinatarios (numeros de WhatsApp que recebem os relatorios ativos) ----------

export async function listarDestinatarios() {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query('SELECT id, numero FROM relatorio_destinatarios ORDER BY criado_em ASC');
  return rows;
}

export async function adicionarDestinatario(numero) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar isso.');
  const limpo = (numero || '').replace(/\D/g, '');
  if (!limpo) throw new Error('Numero invalido.');
  await tabelasProntas;
  const { rows } = await pool.query(
    'INSERT INTO relatorio_destinatarios (numero) VALUES ($1) ON CONFLICT (numero) DO NOTHING RETURNING id',
    [limpo],
  );
  return rows[0]?.id || null;
}

export async function removerDestinatario(id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query('DELETE FROM relatorio_destinatarios WHERE id = $1', [id]);
}

// ---------- configs (quais relatorios estao ativos e com que frequencia) ----------

export async function obterConfigs() {
  if (!pool) return TIPOS_RELATORIO.map((tipo) => ({ tipo, nome: NOME_TIPO[tipo], ativo: false, frequencia: 'diario', ultimoEnvioEm: null }));
  await tabelasProntas;
  const { rows } = await pool.query('SELECT tipo, ativo, frequencia, ultimo_envio_em FROM relatorio_configs');
  return TIPOS_RELATORIO.map((tipo) => {
    const r = rows.find((x) => x.tipo === tipo);
    return {
      tipo,
      nome: NOME_TIPO[tipo],
      ativo: r?.ativo || false,
      frequencia: r?.frequencia || 'diario',
      ultimoEnvioEm: r?.ultimo_envio_em || null,
    };
  });
}

export async function salvarConfig(tipo, { ativo, frequencia }) {
  if (!TIPOS_RELATORIO.includes(tipo)) throw new Error(`Tipo de relatorio desconhecido: ${tipo}`);
  if (frequencia && !FREQUENCIAS.includes(frequencia)) throw new Error(`Frequencia desconhecida: ${frequencia}`);
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO relatorio_configs (tipo, ativo, frequencia, atualizado_em) VALUES ($1, $2, $3, now())
     ON CONFLICT (tipo) DO UPDATE SET ativo = $2, frequencia = $3, atualizado_em = now()`,
    [tipo, !!ativo, frequencia || 'diario'],
  );
}

async function marcarEnviado(tipo) {
  if (!pool) return;
  await pool.query('UPDATE relatorio_configs SET ultimo_envio_em = now() WHERE tipo = $1', [tipo]);
}

// ---------- helpers de formatacao ----------

function formatarReais(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarPct(valor) {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function formatarDataHoraBR() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' });
}

// ---------- 1. Meta Ads - Financeiro Completo ----------

export async function gerarRelatorioAdsFinanceiroCompleto() {
  const contas = await metaAds.listAdAccounts();
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ontem = hoje.toISOString().slice(0, 10);

  const linhas = [];
  linhas.push('💳 RELATÓRIO FINANCEIRO COMPLETO - META ADS 💳');
  linhas.push(`Gerado em: ${formatarDataHoraBR()}`);
  linhas.push(`Contas gerenciadas: ${contas.length}`);
  linhas.push('');

  let saldoTotalDisponivel = 0;
  let faturaTotalAberta = 0;
  let campanhasAtivasTotal = 0;
  let campanhasPausadasTotal = 0;
  let gastoMedioDiarioTotal = 0;

  for (const c of contas) {
    let ativas = 0;
    let pausadas = 0;
    try {
      const campanhas = await metaAds.listCampaigns({ accountId: c.id });
      for (const camp of campanhas) {
        if (camp.effective_status === 'ACTIVE') ativas++;
        else pausadas++;
      }
    } catch { /* conta sem permissao/erro pontual - segue sem contagem de campanha */ }

    let gastoMedioDiario = null;
    try {
      const relatorio = await metaAds.getSpendReport({ accountId: c.id, since: seteDiasAtras, until: ontem, timeIncrement: '1' });
      const dias = relatorio[0]?.porPeriodo || [];
      if (dias.length) gastoMedioDiario = dias.reduce((s, d) => s + d.gasto, 0) / dias.length;
    } catch { /* segue sem media se der erro */ }

    const saldoLinha = c.tipoConta === 'prepago'
      ? `Saldo: ${formatarReais(c.saldoDisponivel)}`
      : c.tipoConta === 'pos-pago (fatura)'
        ? `Fatura pendente: ${formatarReais(c.valorEmAberto)}`
        : 'Saldo: indisponivel';

    linhas.push(`* ${c.name} (${c.empresa}) — ${saldoLinha} | Campanhas ativas: ${ativas} | Pausadas: ${pausadas}${gastoMedioDiario != null ? ` | Gasto medio diario (7d): ${formatarReais(gastoMedioDiario)}` : ''}`);

    if (c.tipoConta === 'prepago') saldoTotalDisponivel += c.saldoDisponivel || 0;
    if (c.tipoConta === 'pos-pago (fatura)') faturaTotalAberta += c.valorEmAberto || 0;
    campanhasAtivasTotal += ativas;
    campanhasPausadasTotal += pausadas;
    if (gastoMedioDiario != null) gastoMedioDiarioTotal += gastoMedioDiario;
  }

  linhas.push('');
  linhas.push('RESUMO GERAL:');
  linhas.push(`* 💰 Saldo total disponivel (contas prepagas): ${formatarReais(saldoTotalDisponivel)}`);
  linhas.push(`* 💸 Total de faturas em aberto (contas pos-pagas): ${formatarReais(faturaTotalAberta)}`);
  linhas.push(`* 📢 Campanhas ativas no total: ${campanhasAtivasTotal}`);
  linhas.push(`* ⏸️ Campanhas pausadas no total: ${campanhasPausadasTotal}`);
  linhas.push(`* 📉 Gasto medio diario total (soma de todas as contas, ultimos 7 dias): ${formatarReais(gastoMedioDiarioTotal)}`);

  return linhas.join('\n');
}

// ---------- 2. Meta Ads - Todas as Metricas das Campanhas ----------

const SUGESTAO_POR_ALERTA = {
  'CTR bem abaixo da media do grupo (possivel criativo cansado)': 'teste um criativo novo, esse pode estar saturado.',
  'CPC bem acima da media do grupo': 'revise segmentacao/criativo, o custo por clique esta alto pro grupo.',
  'Custo por resultado bem acima da media do grupo': 'considere pausar ou ajustar - custo por resultado desproporcional.',
  'Teve impressoes relevantes mas nenhum resultado': 'revise pagina de destino/oferta - tem alcance mas nao esta convertendo.',
};

export async function gerarRelatorioAdsMetricasCompleto() {
  const contas = await metaAds.listAdAccounts();
  const hoje = new Date().toISOString().slice(0, 10);
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const linhas = [];
  linhas.push('📈 RELATÓRIO DE MÉTRICAS DAS CAMPANHAS - META ADS 📈');
  linhas.push(`Gerado em: ${formatarDataHoraBR()}`);
  linhas.push('Periodo analisado: ultimos 7 dias, campanhas ativas');
  linhas.push('');

  let totalAnalisados = 0;
  let totalComAlerta = 0;

  for (const c of contas) {
    let campanhas;
    try {
      campanhas = await metaAds.listCampaigns({ accountId: c.id, status: 'ACTIVE' });
    } catch { continue; }
    if (!campanhas.length) continue;

    const blocosConta = [];
    for (const camp of campanhas) {
      let analise;
      try {
        analise = await metaAds.analyzeCampaignAds({ campaignId: camp.id, since: seteDiasAtras, until: hoje });
      } catch { continue; }
      if (!analise.anuncios.length) continue;

      for (const a of analise.anuncios) {
        totalAnalisados++;
        const linhaAnuncio = [`* ${camp.name} / ${a.nome}: gasto ${formatarReais(a.gasto)}, CTR ${formatarPct(a.ctr)}%, CPC ${formatarReais(a.cpc)}, resultados: ${a.resultados}${a.custoPorResultado ? ` (custo/resultado: ${formatarReais(a.custoPorResultado)})` : ''}`];
        if (a.alertas.length) {
          totalComAlerta++;
          for (const alerta of a.alertas) {
            const sugestao = SUGESTAO_POR_ALERTA[alerta] || 'vale revisar esse anuncio.';
            linhaAnuncio.push(`  ⚠️ Sugestao: ${sugestao}`);
          }
        }
        blocosConta.push(linhaAnuncio.join('\n'));
      }
    }
    if (blocosConta.length) {
      linhas.push(`--- ${c.name} (${c.empresa}) ---`);
      linhas.push(...blocosConta);
      linhas.push('');
    }
  }

  linhas.push('');
  linhas.push(`RESUMO: ${totalAnalisados} anuncio(s) com dados no periodo, ${totalComAlerta} com alerta de atencao.`);

  return linhas.join('\n');
}

// ---------- 3. Clinica - Relatorio Financeiro Geral ----------

export async function gerarRelatorioClinicaFinanceiroGeral({ dias = 30 } = {}) {
  const hoje = new Date();
  const desde = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ate = hoje.toISOString().slice(0, 10);

  const [resumo, conversao, receitaEspecialidade, metasVendas, metasFaltas, parcelamento] = await Promise.all([
    clinicorp.getFinancialSummary({ from: desde, to: ate }),
    clinicorp.getSalesConversion({ from: desde, to: ate }).catch(() => null),
    clinicorp.getExpertiseRevenue({ from: desde, to: ate }).catch(() => null),
    clinicorp.listSalesGoals({ from: desde, to: ate }).catch(() => null),
    clinicorp.listMissesGoals({ from: desde, to: ate }).catch(() => null),
    clinicorp.getAverageInstallments({ from: desde, to: ate }).catch(() => null),
  ]);

  const linhas = [];
  linhas.push('🏥 RELATÓRIO FINANCEIRO GERAL - CLÍNICA 🏥');
  linhas.push(`Periodo: ultimos ${dias} dias (${desde} a ${ate})`);
  linhas.push('');
  linhas.push('💰 Financeiro:');
  linhas.push(`* 📈 Vendas Totais: ${formatarReais(resumo.TotalSales)}`);
  linhas.push(`* 📥 Total Recebido: ${formatarReais(resumo.TotalIncome)}`);
  linhas.push(`* 📉 Despesas Gerais: ${formatarReais(resumo.TotalExpenses)}`);
  linhas.push(`* 🎯 Lucro Bruto Estimado: ${formatarReais((resumo.TotalSales || 0) - (resumo.TotalExpenses || 0))}`);

  if (parcelamento && typeof parcelamento === 'object' && !parcelamento.erro) {
    linhas.push(`* 💳 Parcelamento medio: ${JSON.stringify(parcelamento).slice(0, 200)}`);
  }

  if (conversao) {
    linhas.push('');
    linhas.push('📋 Conversao de orcamentos:');
    for (const [status, dado] of Object.entries(conversao)) {
      if (!dado || !dado.TotalEstimates) continue;
      const nomeStatus = { APPROVED: 'Aprovados', REJECTED: 'Recusados', OPEN: 'Em aberto', FOLLOWUP: 'Em follow-up', REJECTED_OPPORTUNITY: 'Oportunidade perdida' }[status] || status;
      linhas.push(`* ${nomeStatus}: ${dado.TotalEstimates} orcamento(s), total ${formatarReais(dado.TotalEstimatesAmount)}, ticket medio ${formatarReais(dado.AverageTicket)}`);
    }
  }

  if (Array.isArray(receitaEspecialidade) && receitaEspecialidade.length) {
    linhas.push('');
    linhas.push('🦷 Receita por especialidade:');
    const totalPorEspecialidade = {};
    for (const mes of receitaEspecialidade) {
      for (const [chave, valor] of Object.entries(mes)) {
        if (chave === 'month' || typeof valor !== 'number') continue;
        totalPorEspecialidade[chave] = (totalPorEspecialidade[chave] || 0) + valor;
      }
    }
    const ordenadas = Object.entries(totalPorEspecialidade).sort((a, b) => b[1] - a[1]);
    for (const [especialidade, valor] of ordenadas) {
      linhas.push(`* ${especialidade}: ${formatarReais(valor)}`);
    }
  }

  if (Array.isArray(metasVendas) && metasVendas.length) {
    linhas.push('');
    linhas.push('🎯 Metas de vendas (por mes):');
    for (const m of metasVendas) {
      linhas.push(`* ${m.month}: faturado ${formatarReais(m.TotalRevenueAmount)}${m.Goal ? `, meta ${formatarReais(m.Goal)}` : ''}, projecao ${formatarReais(m.Projection)}`);
    }
  }

  if (Array.isArray(metasFaltas) && metasFaltas.length) {
    linhas.push('');
    linhas.push('🚫 Metas de faltas (por mes):');
    for (const m of metasFaltas) {
      linhas.push(`* ${m.month}: ${m.Misses} falta(s)${m.Goal ? `, meta ${m.Goal}` : ''}`);
    }
  }

  return linhas.join('\n');
}

// ---------- 4. Clinica - Relatorio de Agendamentos Completo (por profissional) ----------

export async function gerarRelatorioClinicaAgendamentosCompleto({ dias = 30 } = {}) {
  const hoje = new Date();
  const desde = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ate = hoje.toISOString().slice(0, 10);

  const [agendamentos, statusList, profissionais] = await Promise.all([
    clinicorp.listAppointments({ from: desde, to: ate, includeCanceled: 'X' }),
    clinicorp.getAppointmentStatusList(),
    clinicorp.listProfessionals(),
  ]);

  const statusPorId = new Map(statusList.map((s) => [String(s.id), s.Description]));
  const nomePorProfissionalId = new Map(profissionais.map((p) => [String(p.id), p.name]));

  const porProfissional = new Map();
  for (const a of agendamentos) {
    const chave = String(a.Dentist_PersonId);
    if (!porProfissional.has(chave)) {
      porProfissional.set(chave, { total: 0, faltas: 0, atendidos: 0, cancelados: 0 });
    }
    const acc = porProfissional.get(chave);
    acc.total++;
    if (a.Canceled === 'X') acc.cancelados++;
    const status = statusPorId.get(String(a.StatusId)) || '';
    if (status.includes('Faltou')) acc.faltas++;
    if (status.includes('Atendido')) acc.atendidos++;
  }

  const linhas = [];
  linhas.push('🗓️ RELATÓRIO DE AGENDAMENTOS COMPLETO - CLÍNICA 🗓️');
  linhas.push(`Periodo: ultimos ${dias} dias (${desde} a ${ate})`);
  linhas.push('Por profissional:');
  linhas.push('');

  const linhasPorProfissional = Array.from(porProfissional.entries())
    .map(([id, dados]) => ({ nome: nomePorProfissionalId.get(id) || `Profissional ${id}`, ...dados }))
    .sort((a, b) => b.total - a.total);

  for (const p of linhasPorProfissional) {
    const taxaFaltas = p.total ? formatarPct((p.faltas / p.total) * 100) : '0,0';
    linhas.push(`* ${p.nome}: ${p.total} agendamento(s) — ✅ ${p.atendidos} comparecido(s), ❌ ${p.faltas} falta(s) (${taxaFaltas}%), 🚫 ${p.cancelados} cancelado(s)`);
  }

  const totalGeral = linhasPorProfissional.reduce((s, p) => s + p.total, 0);
  const totalFaltas = linhasPorProfissional.reduce((s, p) => s + p.faltas, 0);
  const totalAtendidos = linhasPorProfissional.reduce((s, p) => s + p.atendidos, 0);
  const totalCancelados = linhasPorProfissional.reduce((s, p) => s + p.cancelados, 0);

  linhas.push('');
  linhas.push('RESUMO GERAL:');
  linhas.push(`* 📅 Total de agendamentos: ${totalGeral}`);
  linhas.push(`* ✅ Comparecidos: ${totalAtendidos}`);
  linhas.push(`* ❌ Faltas: ${totalFaltas} (${totalGeral ? formatarPct((totalFaltas / totalGeral) * 100) : '0,0'}%)`);
  linhas.push(`* 🚫 Cancelamentos: ${totalCancelados}`);

  return linhas.join('\n');
}

const GERADORES = {
  ads_financeiro: gerarRelatorioAdsFinanceiroCompleto,
  ads_metricas: gerarRelatorioAdsMetricasCompleto,
  clinica_financeiro: gerarRelatorioClinicaFinanceiroGeral,
  clinica_agendamentos: gerarRelatorioClinicaAgendamentosCompleto,
};

export async function gerarRelatorioPorTipo(tipo) {
  const gerador = GERADORES[tipo];
  if (!gerador) throw new Error(`Tipo de relatorio desconhecido: ${tipo}`);
  return gerador();
}

// manda um relatorio pra todos os destinatarios cadastrados - usado tanto pelo envio manual
// ("enviar agora" na aba) quanto pelo scheduler automatico
export async function enviarRelatorioAgora(tipo) {
  const texto = await gerarRelatorioPorTipo(tipo);
  const destinatarios = await listarDestinatarios();
  if (!destinatarios.length) throw new Error('Nenhum destinatario cadastrado pra receber relatorios.');
  for (const d of destinatarios) {
    await enviarMensagemTexto(d.numero, texto).catch((err) => {
      console.error(`Erro mandando relatorio "${tipo}" pro numero ${d.numero}:`, err.message);
    });
  }
  await marcarEnviado(tipo);
  return { destinatarios: destinatarios.length };
}

// roda em segundo plano - checa 1x por dia se algum relatorio configurado esta "vencido"
// (passou o intervalo da frequencia escolhida desde o ultimo envio) e manda pros destinatarios
// cadastrados. So chamado uma vez, no boot do server.js.
export function iniciarSchedulerRelatoriosProgramados() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const destinatarios = await listarDestinatarios();
      if (!destinatarios.length) return; // nada a fazer sem ninguem pra receber

      const configs = await obterConfigs();
      for (const cfg of configs) {
        if (!cfg.ativo) continue;
        const diasIntervalo = DIAS_POR_FREQUENCIA[cfg.frequencia] || 1;
        const venceEm = cfg.ultimoEnvioEm
          ? new Date(cfg.ultimoEnvioEm).getTime() + diasIntervalo * 24 * 60 * 60 * 1000
          : 0; // nunca enviado - vence na hora
        if (Date.now() < venceEm) continue;

        try {
          await enviarRelatorioAgora(cfg.tipo);
        } catch (err) {
          console.error(`Erro no envio automatico do relatorio "${cfg.tipo}":`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando relatorios programados:', err.message);
    }
  };

  // checa a cada 15min - so dispara de fato quando algo realmente vence (checagem de datas
  // acima), entao rodar com frequencia nao manda nada duplicado
  setInterval(checar, 15 * 60 * 1000).unref();
}
