// gera o "Relatorio de Gestao Diaria" (saldo das contas de anuncio + resumo Clinicorp) no
// formato exato que o usuario pediu - montado em codigo (nao pela IA) pra garantir a MESMA
// formatacao todo santo dia, sem depender da Claude reproduzir um template complexo igual
// toda vez. So os NUMEROS mudam, a estrutura e sempre identica.
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';

// mesmo limite usado pelo alerta de saldo (cloudAgent.js) - ajustavel via env var, sem
// precisar mexer no codigo se o usuario achar o valor errado
const LIMITE_SALDO_BAIXO_REAIS = Number(process.env.META_ADS_LIMITE_SALDO_BAIXO_REAIS) || 100;
// fatura em aberto acima disso ganha a tag "(Valor alto)" no relatorio
const LIMITE_FATURA_ALTA_REAIS = Number(process.env.META_ADS_LIMITE_FATURA_ALTA_REAIS) || 1000;

function formatarReais(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataBR(isoDate) {
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}`;
}

export async function gerarRelatorioDiario(tenantId, { diasClinicorp = 30 } = {}) {
  const agora = new Date();
  const hojeFormatado = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });

  const contas = await metaAds.listAdAccounts(tenantId);

  const esgotadas = [];
  const criticas = [];
  const saudaveis = [];

  for (const c of contas) {
    if (c.tipoConta === 'prepago' && c.saldoDisponivel != null) {
      if (c.saldoDisponivel <= 0) esgotadas.push(c);
      else if (c.saldoDisponivel <= LIMITE_SALDO_BAIXO_REAIS) criticas.push({ ...c, quaseZerando: true });
      else saudaveis.push(c);
    } else if (c.tipoConta === 'pos-pago (fatura)' && c.valorEmAberto != null) {
      if (c.valorEmAberto > 0) criticas.push({ ...c, valorAlto: c.valorEmAberto > LIMITE_FATURA_ALTA_REAIS });
      else saudaveis.push(c);
    }
    // conta sem tipoConta reconhecido (nao prepago nem pos-pago identificado) fica de fora do
    // relatorio de proposito - melhor omitir do que classificar errado
  }

  const prepagoSaudaveis = saudaveis.filter((c) => c.tipoConta === 'prepago');
  const maisFolgadaId = prepagoSaudaveis.length
    ? prepagoSaudaveis.reduce((max, c) => (c.saldoDisponivel > max.saldoDisponivel ? c : max)).id
    : null;

  const linhas = [];
  linhas.push('📊 RELATÓRIO DE GESTÃO DIÁRIA 📊');
  linhas.push(`Data: ${hojeFormatado}`);
  linhas.push('💳 1. SALDO DAS CONTAS DE ANÚNCIO (Meta Ads)');
  linhas.push('⚠️ Atenção redobrada com as contas zeradas ou com faturas altas pendentes para não pausar os anúncios.');
  linhas.push('');
  linhas.push('🔴 CONTAS ESGOTADAS / ZERADAS (Ação Imediata)');
  linhas.push('');
  if (esgotadas.length) {
    for (const c of esgotadas) linhas.push(`* 🛑 ${c.name} (${c.empresa}): R$ 0,00 (Saldo Esgotado)`);
  } else {
    linhas.push('* Nenhuma conta esgotada no momento. ✅');
  }
  linhas.push('');
  linhas.push('');
  linhas.push('🟡 CONTAS COM FATURA EM ABERTO / CRÍTICAS');
  linhas.push('');
  if (criticas.length) {
    for (const c of criticas) {
      if (c.quaseZerando) {
        linhas.push(`* 📉 ${c.name} (${c.empresa}): ${formatarReais(c.saldoDisponivel)} disponível ⚠️ (Quase zerando)`);
      } else {
        linhas.push(`* 💸 ${c.name} (${c.empresa}): ${formatarReais(c.valorEmAberto)} em aberto${c.valorAlto ? ' ⚠️ (Valor alto)' : ''}`);
      }
    }
  } else {
    linhas.push('* Nenhuma conta crítica no momento. ✅');
  }
  linhas.push('');
  linhas.push('');
  linhas.push('🟢 CONTAS SAUDÁVEIS / COM SALDO');
  linhas.push('');
  if (saudaveis.length) {
    for (const c of saudaveis) {
      if (c.tipoConta === 'prepago') {
        const tag = c.id === maisFolgadaId ? ' 🚀 (A mais folgada)' : '';
        linhas.push(`* ✅ ${c.name} (${c.empresa}): ${formatarReais(c.saldoDisponivel)} disponível${tag}`);
      } else {
        linhas.push(`* ✅ ${c.name} (${c.empresa}): Fatura em R$ 0`);
      }
    }
  } else {
    linhas.push('* Nenhuma conta saudável no momento.');
  }
  linhas.push('');
  linhas.push('');

  const desde = new Date(agora.getTime() - diasClinicorp * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ate = agora.toISOString().slice(0, 10);
  const [fin, infoAgenda] = await Promise.all([
    clinicorp.getFinancialSummary(tenantId, { from: desde, to: ate }),
    clinicorp.getAppointmentInfo(tenantId, { from: desde, to: ate }),
  ]);
  const lucroBruto = (fin.TotalSales || 0) - (fin.TotalExpenses || 0);
  const taxaFaltas = infoAgenda.ScheduledTotal
    ? ((infoAgenda.MissedAppointmentTotal / infoAgenda.ScheduledTotal) * 100).toFixed(1).replace('.', ',')
    : '0,0';

  linhas.push(`🏥 2. RESUMO CLINICORP (Últimos ${diasClinicorp} dias — ${formatarDataBR(desde)} a ${formatarDataBR(ate)})`);
  linhas.push('Indicadores financeiros e operacionais da clínica.');
  linhas.push('💰 Financeiro:');
  linhas.push('');
  linhas.push(`* 📈 Vendas Totais: ${formatarReais(fin.TotalSales)}`);
  linhas.push(`* 📥 Total Recebido: ${formatarReais(fin.TotalIncome)}`);
  linhas.push(`* 📉 Despesas Gerais: ${formatarReais(fin.TotalExpenses)}`);
  linhas.push(`* 🎯 Lucro Bruto Estimado: ${formatarReais(lucroBruto)}`);
  linhas.push('');
  linhas.push('🗓️ Agenda & Operação:');
  linhas.push('');
  linhas.push(`* 📅 Total de Agendamentos: ${infoAgenda.ScheduledTotal || 0}`);
  linhas.push(`* ❌ Faltas: ${infoAgenda.MissedAppointmentTotal || 0} (Taxa de ${taxaFaltas}%)`);
  linhas.push(`* 🚨 Cancelamentos: ${infoAgenda.CanceledAppointment || 0} ‼️`);

  return linhas.join('\n');
}
