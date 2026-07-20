// relatorios configuraveis (aba "Relatorios" do app): 1+ numeros de WhatsApp destinatarios,
// e 4 tipos de relatorio que podem ser ligados/desligados independentemente, cada um com sua
// propria frequencia de envio automatico. Cada gerador de relatorio monta o texto inteiro em
// codigo (nao pela Claude) - mesmo raciocinio do relatorioDiario.js: sai sempre identico,
// sem depender da IA estar disponivel pro envio automatico funcionar.
import { pool } from './db.js';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';
import { enviarMensagemTexto, enviarMensagemTextoPor } from './evolutionApi.js';

export const TIPOS_RELATORIO = ['ads_financeiro', 'ads_metricas', 'clinica_financeiro', 'clinica_agendamentos', 'ads_saldo_baixo'];
// as duas primeiras (X_horas) existem so pra fazer sentido no alerta de saldo baixo (precisa
// checar bem mais seguido que "diario") - nada impede escolher pros outros tipos tambem, so nao
// costuma fazer sentido pra um relatorio de metricas/financeiro mandar a cada 6h. Frequencias
// sub-diarias ignoram hora_envio (ver iniciarSchedulerRelatoriosProgramados) - nao tem uma
// "hora do dia" fixa, o intervalo e sempre relativo ao ultimo envio.
export const FREQUENCIAS = ['6_horas', '12_horas', 'diario', 'semanal', 'quinzenal', 'mensal', 'semestral', 'anual'];

const NOME_TIPO = {
  ads_financeiro: 'Meta Ads - Financeiro Completo',
  ads_metricas: 'Meta Ads - Todas as Metricas das Campanhas',
  clinica_financeiro: 'Clinica - Relatorio Financeiro Geral',
  clinica_agendamentos: 'Clinica - Relatorio de Agendamentos Completo',
  ads_saldo_baixo: 'Meta Ads - Alerta de Saldo Baixo',
};

const DIAS_POR_FREQUENCIA = {
  '6_horas': 0.25, '12_horas': 0.5,
  diario: 1, semanal: 7, quinzenal: 14, mensal: 30, semestral: 182, anual: 365,
};

// tipo -> frequencia inicial (quando a linha de config e criada pela primeira vez) - o alerta
// de saldo baixo precisa checar bem mais seguido que um relatorio normal, senao uma conta pode
// ficar horas parada por falta de saldo antes do dono ser avisado
const FREQUENCIA_PADRAO_POR_TIPO = { ads_saldo_baixo: '6_horas' };

// data (AAAA-MM-DD) no fuso de Maceio de um instante - usado pra comparar "quantos DIAS DE
// CALENDARIO se passaram" em vez de milissegundos exatos. Isso importa porque um envio manual
// ("Enviar agora") pode acontecer fora da janela do horario configurado (ex: as 22h de um
// relatorio configurado pras 07h) - se a checagem fosse por horas exatas (ultimoEnvio + 24h),
// o proximo vencimento cairia sempre as 22h tambem, nunca mais alinhando com a janela das 07h,
// e o envio automatico parava de disparar pra sempre. Comparando por dia de calendario, "ontem
// (qualquer hora)" + frequencia diaria ja conta como vencido hoje de manha, na janela certa.
function dataMaceioISO(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function diasCalendarioEntre(dataIsoAntiga, dataIsoNova) {
  const a = new Date(`${dataIsoAntiga}T00:00:00Z`);
  const b = new Date(`${dataIsoNova}T00:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

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
      hora_envio TEXT NOT NULL DEFAULT '07:00',
      ultimo_envio_em TIMESTAMPTZ,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // colunas novas - IF NOT EXISTS pra nao quebrar instalacoes que ja tinham essa tabela antes
  // dessas funcionalidades existirem
  await pool.query(`ALTER TABLE relatorio_configs ADD COLUMN IF NOT EXISTS hora_envio TEXT NOT NULL DEFAULT '07:00';`);
  // qual instancia/numero de WhatsApp usar pra ENVIAR cada tipo de relatorio - null = usa a
  // instancia ativa padrao (o mesmo numero que a Lumia usa no dia a dia)
  await pool.query(`ALTER TABLE relatorio_configs ADD COLUMN IF NOT EXISTS instancia TEXT;`);
  // garante que as linhas de config de todos os tipos sempre existam (mais facil de
  // consultar/atualizar do que checar existencia toda vez)
  for (const tipo of TIPOS_RELATORIO) {
    await pool.query(
      'INSERT INTO relatorio_configs (tipo, frequencia) VALUES ($1, $2) ON CONFLICT (tipo) DO NOTHING',
      [tipo, FREQUENCIA_PADRAO_POR_TIPO[tipo] || 'diario'],
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
  if (!pool) return TIPOS_RELATORIO.map((tipo) => ({ tipo, nome: NOME_TIPO[tipo], ativo: false, frequencia: FREQUENCIA_PADRAO_POR_TIPO[tipo] || 'diario', horaEnvio: '07:00', ultimoEnvioEm: null, instancia: null }));
  await tabelasProntas;
  const { rows } = await pool.query('SELECT tipo, ativo, frequencia, hora_envio, ultimo_envio_em, instancia FROM relatorio_configs');
  return TIPOS_RELATORIO.map((tipo) => {
    const r = rows.find((x) => x.tipo === tipo);
    return {
      tipo,
      nome: NOME_TIPO[tipo],
      ativo: r?.ativo || false,
      frequencia: r?.frequencia || FREQUENCIA_PADRAO_POR_TIPO[tipo] || 'diario',
      horaEnvio: r?.hora_envio || '07:00',
      ultimoEnvioEm: r?.ultimo_envio_em || null,
      instancia: r?.instancia || null,
    };
  });
}

async function obterConfigPorTipo(tipo) {
  const configs = await obterConfigs();
  return configs.find((c) => c.tipo === tipo);
}

function validarHoraEnvio(hora) {
  if (!hora) return '07:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error(`Horario invalido: "${hora}" (use o formato HH:MM)`);
  return hora;
}

export async function salvarConfig(tipo, { ativo, frequencia, horaEnvio, instancia }) {
  if (!TIPOS_RELATORIO.includes(tipo)) throw new Error(`Tipo de relatorio desconhecido: ${tipo}`);
  if (frequencia && !FREQUENCIAS.includes(frequencia)) throw new Error(`Frequencia desconhecida: ${frequencia}`);
  const horaValidada = validarHoraEnvio(horaEnvio);
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await tabelasProntas;
  await pool.query(
    `INSERT INTO relatorio_configs (tipo, ativo, frequencia, hora_envio, instancia, atualizado_em) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tipo) DO UPDATE SET ativo = $2, frequencia = $3, hora_envio = $4, instancia = $5, atualizado_em = now()`,
    [tipo, !!ativo, frequencia || FREQUENCIA_PADRAO_POR_TIPO[tipo] || 'diario', horaValidada, instancia || null],
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
  const todasContas = await metaAds.listAdAccounts();
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ontem = hoje.toISOString().slice(0, 10);

  const linhasContas = [];
  let saldoTotalDisponivel = 0;
  let faturaTotalAberta = 0;
  let campanhasAtivasTotal = 0;
  let campanhasPausadasTotal = 0;
  let gastoMedioDiarioTotal = 0;

  for (const c of todasContas) {
    let ativas = 0;
    let pausadas = 0;
    try {
      const campanhas = await metaAds.listCampaigns({ accountId: c.id });
      for (const camp of campanhas) {
        if (camp.effective_status === 'ACTIVE') ativas++;
        else pausadas++;
      }
    } catch { /* conta sem permissao/erro pontual - trata como sem campanha ativa, fica de fora */ }

    // "conta ativa" aqui significa TEM ANUNCIO RODANDO DE VERDADE (pelo menos 1 campanha com
    // effective_status ACTIVE) - nao e o status administrativo da conta na Meta. Pedido
    // explicito do usuario: conta sem nenhum anuncio ativo fica de fora pra nao gastar
    // chamada de API a toa nem poluir o relatorio/WhatsApp com conta parada.
    if (ativas === 0) continue;

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

    linhasContas.push(`* ${c.name} (${c.empresa}) — ${saldoLinha} | Campanhas ativas: ${ativas} | Pausadas: ${pausadas}${gastoMedioDiario != null ? ` | Gasto medio diario (7d): ${formatarReais(gastoMedioDiario)}` : ''}`);

    if (c.tipoConta === 'prepago') saldoTotalDisponivel += c.saldoDisponivel || 0;
    if (c.tipoConta === 'pos-pago (fatura)') faturaTotalAberta += c.valorEmAberto || 0;
    campanhasAtivasTotal += ativas;
    campanhasPausadasTotal += pausadas;
    if (gastoMedioDiario != null) gastoMedioDiarioTotal += gastoMedioDiario;
  }

  const linhas = [];
  linhas.push('💳 RELATÓRIO FINANCEIRO COMPLETO - META ADS 💳');
  linhas.push(`Gerado em: ${formatarDataHoraBR()}`);
  linhas.push(`Contas com anuncio ativo rodando: ${linhasContas.length} (de ${todasContas.length} contas no total - as demais estao sem nenhuma campanha ativa e ficaram de fora)`);
  linhas.push('');
  linhas.push(...linhasContas);
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

const LABEL_FREQUENCIA = {
  '6_horas': 'DIARIO', '12_horas': 'DIARIO',
  diario: 'DIARIO', semanal: 'SEMANAL', quinzenal: 'QUINZENAL', mensal: 'MENSAL', semestral: 'SEMESTRAL', anual: 'ANUAL',
};

function formatarDataBR(isoDate) {
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

// janela de datas (fuso Maceio) pro periodo do relatorio - pedido explicito do usuario:
// relatorio diario tem que medir de 00h ate 23h59 do dia de calendario, nao "ultimas 24h"
// corridas a partir do momento exato do envio.
function periodoDiasCalendario(frequencia) {
  const hoje = dataMaceioISO(new Date());
  // frequencias sub-diarias (6_horas/12_horas) nao fazem sentido pra janela de dia de
  // calendario - trata como diario (00h-23h59 de hoje) nesse caso
  const dias = Math.max(1, Math.round(DIAS_POR_FREQUENCIA[frequencia] || 1));
  const desdeDate = new Date(`${hoje}T00:00:00Z`);
  desdeDate.setUTCDate(desdeDate.getUTCDate() - (dias - 1));
  return { since: desdeDate.toISOString().slice(0, 10), until: hoje, hoje };
}

function extrairValorAcao(campo) {
  return Array.isArray(campo) && campo.length ? Number(campo[0].value || 0) : 0;
}

// dica de analise gerada por regra fixa (sem IA) - pedido explicito do usuario de nao
// depender da Claude pra relatorio agendado, pra sempre sair identico e nao falhar se a
// API da Anthropic estiver fora do ar na hora do envio automatico.
function gerarDicaAnalise({ freqAnuncio, resultados, gasto, videoViews50, videoViews95 }) {
  if (freqAnuncio >= 3.5) {
    return `frequencia esta em ${freqAnuncio.toFixed(2)} - o publico ja viu o anuncio varias vezes, o criativo pode estar cansando. Vale testar uma variacao nova.`;
  }
  if (gasto > 0 && resultados === 0) {
    return 'teve gasto no periodo mas nenhum resultado registrado - revise a oferta/pagina de destino ou o publico segmentado.';
  }
  if (videoViews50 > 0 && videoViews95 / videoViews50 < 0.15) {
    return 'boa parte de quem comeca o video sai antes da metade - os primeiros segundos do criativo podem nao estar prendendo atencao.';
  }
  return 'sem alerta relevante no periodo - campanha performando dentro do esperado.';
}

function montarBlocoCampanha({ conta, campanha, row, frequencia, hoje }) {
  const { resultados, custoPorResultado } = metaAds.extractResultsAndCPA(row);
  const cliquesLink = Number(row.inline_link_clicks || 0);
  const gasto = Number(row.spend || 0);
  const alcance = Number(row.reach || 0);
  const impressoes = Number(row.impressions || 0);
  const freqAnuncio = Number(row.frequency || 0);
  const visualizacoesTotais = extrairValorAcao(row.video_play_actions);
  const videoViews50 = extrairValorAcao(row.video_p50_watched_actions);
  const videoViews75 = extrairValorAcao(row.video_p75_watched_actions);
  const videoViews95 = extrairValorAcao(row.video_p95_watched_actions);
  const dica = gerarDicaAnalise({ freqAnuncio, resultados, gasto, videoViews50, videoViews95 });

  return [
    '📱 RELATÓRIO DE MÉTRICAS: META ADS 📱',
    `Campanha: ${campanha.name} (${conta.empresa || conta.name})`,
    `Data: ${formatarDataBR(hoje)} DAS 00H AS 23:59 Período de Análise: ${LABEL_FREQUENCIA[frequencia] || frequencia.toUpperCase()}`,
    '',
    '📥 1. FUNIL DE CONVERSÃO & VENDAS',
    'Métricas principais focadas em trazer clientes para o WhatsApp.',
    '',
    `* 💬 Conversas Iniciadas: ${resultados} resultados`,
    `* 💰 Custo por Conversa (CPR): ${formatarReais(custoPorResultado || 0)}`,
    `* 🖱️ Cliques no Link: ${cliquesLink} interesses diretos`,
    '',
    '👁️ 2. ALCANCE & ENTREGA DO ANÚNCIO',
    'Como o algoritmo está distribuindo as suas campanhas.',
    '',
    `* 👥 Alcance: ${alcance} (pessoas únicas que viram)`,
    `* 🔄 Impressões: ${impressoes} (total de vezes que o anúncio apareceu)`,
    `* 🔁 Frequência: ${freqAnuncio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (quantas vezes a mesma pessoa viu o anúncio, ex: 1.45)`,
    `* 📈 Visualizações Totais: ${visualizacoesTotais}`,
    '',
    '🎬 3. RETENÇÃO & ENGAJAMENTO DE VÍDEO (Vídeo Views)',
    'Comportamento do público assistindo aos seus criativos.',
    '',
    `* 🍿 Reproduções de 50% do Vídeo: ${videoViews50} pessoas`,
    `* ⏳ Reproduções de 75% do Vídeo: ${videoViews75} pessoas (público quente)`,
    `* 🔥 Reproduções de 95% do Vídeo: ${videoViews95} pessoas (público ultra-interessado)`,
    '',
    '🕵️‍♂️ ANÁLISE DO AGENTE DE IA',
    `💡 Dica de análise: ${dica}`,
    '',
    '🤖 Relatório de Métricas Avançadas gerado pela sua IA.',
  ].join('\n');
}

export async function gerarRelatorioAdsMetricasCompleto({ frequencia = 'diario' } = {}) {
  const { since, until, hoje } = periodoDiasCalendario(frequencia);
  const contas = await metaAds.listAdAccounts();
  const blocos = [];

  for (const c of contas) {
    let campanhas;
    try {
      campanhas = await metaAds.listCampaigns({ accountId: c.id, status: 'ACTIVE' });
    } catch { continue; }
    if (!campanhas.length) continue;

    for (const camp of campanhas) {
      // so entra no relatorio campanha que tem PELO MENOS 1 anuncio REALMENTE ativo agora
      // (effective_status ACTIVE) com dado no periodo - campanha marcada ACTIVE mas com todos
      // os anuncios pausados/parados ha mais de 1 dia fica de fora, pedido explicito do usuario.
      let analise;
      try {
        analise = await metaAds.analyzeCampaignAds({ campaignId: camp.id, since, until });
      } catch { continue; }
      if (!analise.anuncios.length) continue;

      // alcance/frequencia nao podem ser somados por anuncio (sobreposicao de publico) - pega
      // o agregado direto no nivel de campanha, que ja vem deduplicado pela Meta.
      let rows;
      try {
        rows = await metaAds.getInsights({ objectId: camp.id, objectType: 'campaign', level: 'campaign', since, until });
      } catch { continue; }
      const row = rows[0];
      if (!row || !(Number(row.spend) > 0 || Number(row.impressions) > 0)) continue;

      blocos.push(montarBlocoCampanha({ conta: c, campanha: camp, row, frequencia, hoje }));
    }
  }

  if (!blocos.length) {
    return [
      '📱 RELATÓRIO DE MÉTRICAS: META ADS 📱',
      `Data: ${formatarDataBR(hoje)} DAS 00H AS 23:59 Período de Análise: ${LABEL_FREQUENCIA[frequencia] || frequencia.toUpperCase()}`,
      '',
      'Nenhuma campanha com anuncio realmente ativo (rodando agora) e entrega no periodo. Campanhas pausadas/paradas ha mais de 1 dia nao entram nesse relatorio.',
    ].join('\n');
  }

  return blocos.join('\n\n═══════════════════════\n\n');
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

// ---------- 5. Meta Ads - Alerta de Saldo Baixo ----------

// mesmo limite usado no antigo scheduler fixo (cloudAgent.js) - ajustavel via env var
const LIMITE_SALDO_BAIXO_REAIS = Number(process.env.META_ADS_LIMITE_SALDO_BAIXO_REAIS) || 100;

// diferente dos outros 4 geradores, esse pode devolver null (nada pra reportar) - e
// interpretado por enviarRelatorioAgora/o scheduler como "nao manda nada dessa vez". So
// considera contas PREPAGAS com saldo baixo/esgotado E que tem pelo menos 1 campanha em
// effective_status ACTIVE - mesmo criterio de "conta ativa" usado em
// gerarRelatorioAdsFinanceiroCompleto (conta sem nenhum anuncio rodando fica de fora, saldo
// baixo la nao e urgente e so geraria ruido no WhatsApp).
export async function gerarAlertaSaldoBaixo() {
  const contas = await metaAds.listAdAccounts();
  const linhas = [];

  for (const c of contas) {
    if (c.tipoConta !== 'prepago' || c.saldoDisponivel == null) continue;
    const esgotado = c.saldoDisponivel <= 0;
    const baixo = c.saldoDisponivel > 0 && c.saldoDisponivel <= LIMITE_SALDO_BAIXO_REAIS;
    if (!esgotado && !baixo) continue;

    let ativas = 0;
    try {
      const campanhas = await metaAds.listCampaigns({ accountId: c.id, status: 'ACTIVE' });
      ativas = campanhas.length;
    } catch { continue; } // erro pontual na conta - nao arrisca alertar sem confirmar que tem campanha ativa

    if (ativas === 0) continue; // sem campanha ativa, saldo baixo aqui nao e urgente

    const saldoFormatado = formatarReais(c.saldoDisponivel);
    linhas.push(
      esgotado
        ? `🔴 Saldo ESGOTADO na conta "${c.name}" (${c.empresa}) - ${ativas} campanha(s) ativa(s) parada(s) por falta de saldo. Saldo atual: ${saldoFormatado}.`
        : `🟡 Saldo baixo na conta "${c.name}" (${c.empresa}): ${saldoFormatado} restantes, ${ativas} campanha(s) ativa(s) - recarregue logo pra nao parar de veicular.`,
    );
  }

  if (!linhas.length) return null;

  return [
    '💰 ALERTA DE SALDO BAIXO - META ADS 💰',
    `Verificado em: ${formatarDataHoraBR()}`,
    '',
    ...linhas,
  ].join('\n');
}

const GERADORES = {
  ads_financeiro: gerarRelatorioAdsFinanceiroCompleto,
  ads_metricas: gerarRelatorioAdsMetricasCompleto,
  clinica_financeiro: gerarRelatorioClinicaFinanceiroGeral,
  clinica_agendamentos: gerarRelatorioClinicaAgendamentosCompleto,
  ads_saldo_baixo: gerarAlertaSaldoBaixo,
};

export async function gerarRelatorioPorTipo(tipo, opts = {}) {
  const gerador = GERADORES[tipo];
  if (!gerador) throw new Error(`Tipo de relatorio desconhecido: ${tipo}`);
  return gerador(opts);
}

// manda um relatorio pra todos os destinatarios cadastrados - usado tanto pelo envio manual
// ("enviar agora" na aba) quanto pelo scheduler automatico. Alguns tipos (ads_saldo_baixo) so
// geram texto quando ha algo pra reportar - nesse caso nao manda nada e nao marca como
// enviado, pra o scheduler continuar checando no proximo ciclo em vez de esperar a frequencia
// inteira de novo.
export async function enviarRelatorioAgora(tipo) {
  const cfg = await obterConfigPorTipo(tipo);
  const texto = await gerarRelatorioPorTipo(tipo, { frequencia: cfg?.frequencia || 'diario' });
  if (!texto) return { destinatarios: 0, semNadaAReportar: true };

  const destinatarios = await listarDestinatarios();
  if (!destinatarios.length) throw new Error('Nenhum destinatario cadastrado pra receber relatorios.');

  const enviar = cfg?.instancia
    ? (numero, msg) => enviarMensagemTextoPor(cfg.instancia, numero, msg)
    : enviarMensagemTexto;

  for (const d of destinatarios) {
    await enviar(d.numero, texto).catch((err) => {
      console.error(`Erro mandando relatorio "${tipo}" pro numero ${d.numero}:`, err.message);
    });
  }
  await marcarEnviado(tipo);
  return { destinatarios: destinatarios.length };
}

// roda em segundo plano - checa a cada 5min (fuso Maceio) se algum relatorio configurado esta
// dentro da janela do SEU horario de envio (hora_envio, primeiros 5min dessa hora) E ja passou
// o intervalo da frequencia escolhida desde o ultimo envio - se sim, manda pros destinatarios
// cadastrados. Frequencias sub-diarias (6_horas/12_horas, ex: alerta de saldo baixo) nao tem
// "hora do dia" fixa - ignoram a janela de hora_envio e vencem por tempo absoluto decorrido
// desde o ultimo envio, checado em toda rodada (nao so nos primeiros 5min de uma hora
// especifica). So chamado uma vez, no boot do server.js.
export function iniciarSchedulerRelatoriosProgramados() {
  const checar = async () => {
    try {
      if (!pool) return;
      await tabelasProntas;
      const destinatarios = await listarDestinatarios();
      if (!destinatarios.length) return; // nada a fazer sem ninguem pra receber

      const agora = new Date();
      const horaAtual = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit', hour12: false });
      const [horaAtualH, horaAtualM] = horaAtual.split(':').map(Number);
      const dentroDaJanelaDeHora = horaAtualM < 5; // primeiros 5min de cada hora

      const configs = await obterConfigs();
      for (const cfg of configs) {
        if (!cfg.ativo) continue;
        const diasIntervalo = DIAS_POR_FREQUENCIA[cfg.frequencia] || 1;
        const subDiaria = diasIntervalo < 1;

        let venceu;
        if (subDiaria) {
          // sem hora fixa - so importa quanto tempo passou desde o ultimo envio
          venceu = !cfg.ultimoEnvioEm || (Date.now() - new Date(cfg.ultimoEnvioEm).getTime()) >= diasIntervalo * 24 * 60 * 60 * 1000;
        } else {
          if (!dentroDaJanelaDeHora) continue; // so dispara nos primeiros 5min de cada hora
          const [horaCfgH] = (cfg.horaEnvio || '07:00').split(':').map(Number);
          if (horaCfgH !== horaAtualH) continue; // nao e a hora configurada desse relatorio
          venceu = !cfg.ultimoEnvioEm || diasCalendarioEntre(dataMaceioISO(new Date(cfg.ultimoEnvioEm)), dataMaceioISO(agora)) >= diasIntervalo;
        }
        if (!venceu) continue;

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

  // checa a cada 5min - precisa ser <= a janela de 5min da hora configurada (senao pode pular
  // a janela inteira de algum relatorio); so dispara de fato quando algo vence
  setInterval(checar, 5 * 60 * 1000).unref();
}
