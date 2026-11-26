// Rotina do gestor: checklist diario por setor, dia da semana de cada setor, CRCs, metas em faixas
// (baixo/medio/alto) e resultados do setor Comercial. Logica pura sobre um "repo" (Postgres na Lumia,
// memoria no modo demonstracao), sempre por tenant. ESTE ARQUIVO E COPIADO IGUAL NA LUMIA
// (src/gestaoRotina.js), a partir do app lumia-gestao/src/rotina.js: mudou num, copie no outro.
//
// repo: obterConfig(t, chave, padrao), salvarConfig(t, chave, valor),
//       marcasChecklist(t, setor|null, de, ate) -> [{ setor, dia, item, em }], marcarChecklist(t, setor, dia, item, feito),
//       diarioDoPeriodo(t, setor, de, ate) -> [{ dia, crc, indicador, valor }], salvarDiario(t, setor, dia, crc, indicador, valor|null)

export const SETORES_ROTINA = [
  { id: 'vendas', nome: 'Comercial (CRMs)', diaPadrao: 1 },
  { id: 'recepcao', nome: 'Recepção', diaPadrao: 2 },
  { id: 'asbs', nome: 'ASBs', diaPadrao: 3 },
  { id: 'laboratorio', nome: 'Laboratório protético', diaPadrao: 4 },
  { id: 'financeiro', nome: 'Financeiro', diaPadrao: 5 },
];
export const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const CHECKLIST_PADRAO = {
  vendas: [
    { id: 'v1', texto: 'Leads das CRCs: quantidade de leads, agendamentos, comparecimentos, faltas e ligações' },
    { id: 'v2', texto: 'As faltas já foram reagendadas?' },
    { id: 'v3', texto: 'As CRCs estão colocando descrição e informações importantes na ficha do lead?' },
    { id: 'v4', texto: 'Acompanhamento no setor: preencher o quadro com as metas e enviar as métricas do dia no WhatsApp' },
    { id: 'v5', texto: 'Conferir a meta diária de cada CRC (ligações, agendamentos e comparecimentos)' },
    { id: 'v6', texto: 'IA: está respondendo bem? Precisa de ajuste? Como estão os resultados?' },
  ],
  recepcao: [],
  asbs: [],
  laboratorio: [],
  financeiro: [],
};

export const INDICADORES_COMERCIAL = {
  individual: [
    { id: 'ligacoes', rotulo: 'Ligações' },
    { id: 'leadsTrabalhados', rotulo: 'Leads trabalhados' },
    { id: 'leadsFalados', rotulo: 'Leads falados' },
    { id: 'agendamentos', rotulo: 'Agendamentos' },
  ],
  geral: [
    { id: 'agendamentos', rotulo: 'Agendamentos' },
    { id: 'comparecimentos', rotulo: 'Comparecimentos' },
    { id: 'fechamentos', rotulo: 'Fechamentos / vendas' },
  ],
};
const f = (baixo, medio, alto) => ({ baixo, medio, alto });
export const METAS_PADRAO = {
  individual: { ligacoes: f(180, 220, 320), leadsTrabalhados: f(63, 100, 120), leadsFalados: f(20, 30, 40), agendamentos: f(6, 10, 13) },
  diaria: { agendamentos: f(16, 20, 25), comparecimentos: f(6, 8, 11), fechamentos: f(2, 4, 6) },
  mensal: { agendamentos: f(384, 480, 500), comparecimentos: f(154, 192, 200), fechamentos: f(46, 58, 60) },
};
const GRUPO_INDICADORES = { individual: INDICADORES_COMERCIAL.individual, diaria: INDICADORES_COMERCIAL.geral, mensal: INDICADORES_COMERCIAL.geral };

// faixa de desempenho: abaixo (nao chegou no baixo), baixo, medio, alto
export function faixa(valor, m) {
  if (valor === null || valor === undefined || !m) return 'sem_dados';
  if (valor >= m.alto) return 'alto';
  if (valor >= m.medio) return 'medio';
  if (valor >= m.baixo) return 'baixo';
  return 'abaixo';
}
const PONTOS_FAIXA = { alto: 3, medio: 2, baixo: 1, abaixo: 0, sem_dados: 0 };
export const NIVEIS = [
  { min: 0, nome: 'Iniciante' }, { min: 60, nome: 'Bronze' }, { min: 120, nome: 'Prata' }, { min: 200, nome: 'Ouro' }, { min: 300, nome: 'Diamante' },
];

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const hojeMaceio = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Maceio' });
export const somarDias = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export const diaSemanaDe = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const ultimoDiaDoMes = (iso) => { const d = new Date(`${iso.slice(0, 8)}01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const novoId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ehUtil = (iso) => diaSemanaDe(iso) !== 0; // segunda a sabado contam como dia de trabalho

function checarSetor(setor) { if (!SETORES_ROTINA.some((s) => s.id === setor)) throw new Error('Setor inválido.'); }

export function criarRotina(repo, { hoje = hojeMaceio } = {}) {
  const checarDia = (iso) => {
    const h = hoje();
    if (!DATA_RE.test(iso || '')) throw new Error('Data inválida (use AAAA-MM-DD).');
    if (iso > h) throw new Error('Esse dia ainda não chegou.');
    if (iso < somarDias(h, -400)) throw new Error('Data antiga demais.');
    return iso;
  };

  // ---------- dia da semana de cada setor ----------
  async function dias(t) {
    const salvo = (await repo.obterConfig(t, 'rotina_dias', {})) || {};
    return Object.fromEntries(SETORES_ROTINA.map((s) => [s.id, Number.isInteger(salvo[s.id]) ? salvo[s.id] : s.diaPadrao]));
  }
  async function salvarDia(t, setor, dia) {
    checarSetor(setor);
    const n = Number(dia);
    if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error('Dia da semana inválido.');
    const atual = await dias(t);
    atual[setor] = n;
    await repo.salvarConfig(t, 'rotina_dias', atual);
    return atual;
  }

  // ---------- checklist ----------
  async function itens(t, setor) {
    checarSetor(setor);
    const salvo = await repo.obterConfig(t, `checklist_itens_${setor}`, null);
    return Array.isArray(salvo) ? salvo : CHECKLIST_PADRAO[setor].map((x) => ({ ...x }));
  }
  async function salvarItens(t, setor, lista) {
    checarSetor(setor);
    if (!Array.isArray(lista)) throw new Error('Envie a lista de itens.');
    if (lista.length > 30) throw new Error('No máximo 30 itens por checklist.');
    const existentes = new Set((await itens(t, setor)).map((i) => i.id));
    const novos = lista.map((i) => {
      const texto = String(i?.texto || '').trim();
      if (!texto) throw new Error('Item do checklist sem texto.');
      if (texto.length > 240) throw new Error('Item do checklist com mais de 240 caracteres.');
      return { id: i.id && existentes.has(i.id) ? i.id : novoId('i'), texto };
    });
    await repo.salvarConfig(t, `checklist_itens_${setor}`, novos);
    return novos;
  }
  async function checklist(t, setor, diaIso) {
    checarSetor(setor);
    const d = checarDia(diaIso || hoje());
    const [its, marcas, ds] = await Promise.all([itens(t, setor), repo.marcasChecklist(t, setor, d, d), dias(t)]);
    const feitos = new Map(marcas.map((m) => [m.item, m.em]));
    return {
      setor, dia: d, hoje: hoje(), diaAgendado: ds[setor], ehDiaAgendado: diaSemanaDe(d) === ds[setor],
      itens: its.map((i) => ({ ...i, feito: feitos.has(i.id), feitoEm: feitos.get(i.id) || null })),
    };
  }
  async function marcar(t, setor, diaIso, item, feito) {
    checarSetor(setor);
    const d = checarDia(diaIso || hoje());
    if (!(await itens(t, setor)).some((i) => i.id === item)) throw new Error('Item do checklist não encontrado.');
    await repo.marcarChecklist(t, setor, d, item, !!feito);
    return checklist(t, setor, d);
  }

  // ---------- CRCs ----------
  async function crcs(t) {
    const l = await repo.obterConfig(t, 'comercial_crcs', []);
    return Array.isArray(l) ? l : [];
  }
  // CRC que sai da lista nao some: fica desativado (o historico dele continua contando no mes)
  async function salvarCrcs(t, lista) {
    if (!Array.isArray(lista)) throw new Error('Envie a lista de CRCs.');
    if (lista.length > 50) throw new Error('No máximo 50 CRCs.');
    const atuais = await crcs(t);
    const ids = new Set(atuais.map((c) => c.id));
    const nomes = new Set();
    const nova = lista.map((c) => {
      const nome = String(c?.nome || '').trim().replace(/\s+/g, ' ');
      if (!nome) throw new Error('Informe o nome do CRC.');
      if (nome.length > 60) throw new Error('Nome do CRC muito longo.');
      if (nomes.has(nome.toLowerCase())) throw new Error(`O nome "${nome}" está repetido.`);
      nomes.add(nome.toLowerCase());
      return { id: c.id && ids.has(c.id) ? c.id : novoId('c'), nome, ativo: c.ativo !== false };
    });
    const ficaram = new Set(nova.map((c) => c.id));
    for (const c of atuais) if (!ficaram.has(c.id)) nova.push({ ...c, ativo: false });
    await repo.salvarConfig(t, 'comercial_crcs', nova);
    return nova;
  }

  // ---------- metas em faixas ----------
  async function metas(t) {
    const salvo = (await repo.obterConfig(t, 'comercial_metas', {})) || {};
    const out = {};
    for (const [g, inds] of Object.entries(METAS_PADRAO)) {
      out[g] = {};
      for (const [i, m] of Object.entries(inds)) out[g][i] = { ...m, ...(salvo[g]?.[i] || {}) };
    }
    return out;
  }
  async function salvarMeta(t, { grupo, indicador, baixo, medio, alto }) {
    if (!GRUPO_INDICADORES[grupo]) throw new Error('Grupo de meta inválido.');
    if (!GRUPO_INDICADORES[grupo].some((i) => i.id === indicador)) throw new Error('Indicador inválido.');
    const v = [baixo, medio, alto].map(Number);
    if (v.some((n) => !Number.isFinite(n) || n < 0 || n > 1e6)) throw new Error('As metas precisam ser números entre 0 e 1.000.000.');
    if (!(v[0] <= v[1] && v[1] <= v[2])) throw new Error('A ordem precisa ser baixo ≤ médio ≤ alto.');
    const salvo = (await repo.obterConfig(t, 'comercial_metas', {})) || {};
    salvo[grupo] = { ...(salvo[grupo] || {}), [indicador]: { baixo: v[0], medio: v[1], alto: v[2] } };
    await repo.salvarConfig(t, 'comercial_metas', salvo);
    return metas(t);
  }

  // ---------- lancamentos diarios do Comercial ----------
  async function lancar(t, { dia, crc = '', indicador, valor }) {
    const d = checarDia(dia || hoje());
    const c = String(crc || '');
    if (c) {
      if (!(await crcs(t)).some((x) => x.id === c)) throw new Error('CRC não encontrado.');
      if (!INDICADORES_COMERCIAL.individual.some((i) => i.id === indicador)) throw new Error('Indicador inválido.');
    } else if (!INDICADORES_COMERCIAL.geral.some((i) => i.id === indicador)) throw new Error('Indicador inválido.');
    let v = null;
    if (valor !== null && valor !== undefined && valor !== '') {
      v = Number(valor);
      if (!Number.isInteger(v) || v < 0 || v > 100000) throw new Error('Informe um número inteiro entre 0 e 100.000.');
    }
    await repo.salvarDiario(t, 'vendas', d, c, indicador, v);
  }

  async function comercial(t, diaIso) {
    const d = checarDia(diaIso || hoje());
    const de = `${d.slice(0, 8)}01`;
    const fimMes = ultimoDiaDoMes(d);
    const [lista, ms, linhas] = await Promise.all([crcs(t), metas(t), repo.diarioDoPeriodo(t, 'vendas', de, d)]);
    const porDia = {};
    for (const l of linhas) ((porDia[l.dia] ||= {})[l.crc] ||= {})[l.indicador] = Number(l.valor);

    // geral do dia: o lancado; se agendamentos nao foi lancado, usa a soma dos CRCs
    const geralDoDia = (dia) => {
      const x = porDia[dia] || {};
      const out = {};
      for (const { id } of INDICADORES_COMERCIAL.geral) {
        if (x['']?.[id] !== undefined) out[id] = { valor: x[''][id], origem: 'lancado' };
        else if (id === 'agendamentos') {
          const vals = Object.entries(x).filter(([c]) => c).map(([, v]) => v.agendamentos).filter((v) => v !== undefined);
          out[id] = vals.length ? { valor: vals.reduce((s, v) => s + v, 0), origem: 'somaCrcs' } : { valor: null, origem: null };
        } else out[id] = { valor: null, origem: null };
      }
      return out;
    };

    const geralHoje = geralDoDia(d);
    const geral = Object.fromEntries(INDICADORES_COMERCIAL.geral.map(({ id }) => [id, { ...geralHoje[id], faixa: faixa(geralHoje[id].valor, ms.diaria[id]) }]));

    const diasDoMes = [];
    for (let x = de; x <= d; x = somarDias(x, 1)) diasDoMes.push(x);
    let diasUteis = 0;
    for (let x = de; x <= fimMes; x = somarDias(x, 1)) if (ehUtil(x)) diasUteis += 1;
    const diasPassados = diasDoMes.filter(ehUtil).length;
    const restantes = Math.max(0, diasUteis - diasPassados);
    const serie = diasDoMes.map((dia) => {
      const g = geralDoDia(dia);
      return { dia, diaSemana: diaSemanaDe(dia), agendamentos: g.agendamentos.valor, comparecimentos: g.comparecimentos.valor, fechamentos: g.fechamentos.valor };
    });
    const mesGeral = {};
    for (const { id } of INDICADORES_COMERCIAL.geral) {
      const lancados = serie.filter((s) => s[id] !== null);
      const total = lancados.reduce((s, x) => s + x[id], 0);
      const projecao = diasPassados ? Math.round((total / diasPassados) * diasUteis) : null;
      const m = ms.mensal[id];
      const falta = Math.max(0, m.medio - total);
      mesGeral[id] = {
        valor: total, diasLancados: lancados.length, faixa: faixa(total, m), projecao, faixaProjecao: faixa(projecao, m),
        faltaParaMedio: falta, porDiaParaMedio: restantes ? Math.ceil(falta / restantes) : null,
      };
    }

    const somaMesCrc = (crcId, ind) => diasDoMes.reduce((s, dia) => s + (porDia[dia]?.[crcId]?.[ind] ?? 0), 0);
    const porCrc = lista
      .filter((c) => c.ativo || porDia[d]?.[c.id])
      .map((c) => {
        const valores = {};
        let pontos = 0;
        for (const { id } of INDICADORES_COMERCIAL.individual) {
          const v = porDia[d]?.[c.id]?.[id] ?? null;
          const fx = faixa(v, ms.individual[id]);
          pontos += PONTOS_FAIXA[fx];
          valores[id] = { valor: v, faixa: fx };
        }
        const mes = Object.fromEntries(INDICADORES_COMERCIAL.individual.map(({ id }) => [id, somaMesCrc(c.id, id)]));
        return { id: c.id, nome: c.nome, ativo: c.ativo, valores, mes, pontos };
      });

    return {
      dia: d, hoje: hoje(), indicadores: INDICADORES_COMERCIAL, metas: ms, crcs: lista, porCrc, geral,
      mes: { de, ate: d, fimMes, diasUteis, diasPassados, restantes, geral: mesGeral },
      serie,
    };
  }

  // ---------- painel do gestor (visao geral) ----------
  async function painel(t) {
    const h = hoje();
    const dow = diaSemanaDe(h);
    const ds = await dias(t);
    const [listaItens, marcas, com] = await Promise.all([
      Promise.all(SETORES_ROTINA.map((s) => itens(t, s.id))),
      repo.marcasChecklist(t, null, somarDias(h, -100), h),
      comercial(t, h),
    ]);
    const idsValidos = Object.fromEntries(SETORES_ROTINA.map((s, i) => [s.id, new Set(listaItens[i].map((x) => x.id))]));
    const feitosPor = {}; // setor -> dia -> qtd
    for (const m of marcas) if (idsValidos[m.setor]?.has(m.item)) ((feitosPor[m.setor] ||= {})[m.dia] = (feitosPor[m.setor]?.[m.dia] || 0) + 1);
    const feitos = (setor, dia) => feitosPor[setor]?.[dia] || 0;

    const setores = SETORES_ROTINA.map((s, i) => ({
      id: s.id, nome: s.nome, dia: ds[s.id], diaNome: DIAS_NOME[ds[s.id]], ehHoje: ds[s.id] === dow,
      total: listaItens[i].length, feitosHoje: feitos(s.id, h),
      // ultimo dia agendado (hoje, se for o dia dele) e como ficou o checklist naquele dia
      ultimoDia: (() => { let x = h; while (diaSemanaDe(x) !== ds[s.id]) x = somarDias(x, -1); return { dia: x, feitos: feitos(s.id, x) }; })(),
    }));

    const segunda = somarDias(h, -((dow + 6) % 7));
    const semana = Array.from({ length: 6 }, (_, i) => {
      const dia = somarDias(segunda, i);
      const dw = diaSemanaDe(dia);
      return {
        dia, diaSemana: dw, nome: DIAS_NOME[dw], futuro: dia > h, hoje: dia === h,
        setores: setores.filter((s) => s.dia === dw).map((s) => ({ id: s.id, nome: s.nome, total: s.total, feitos: feitos(s.id, dia) })),
      };
    });

    // sequencia: dias agendados seguidos com o checklist completo (hoje so conta se ja completou)
    let sequencia = 0;
    for (let i = 0; i <= 100; i += 1) {
      const dia = somarDias(h, -i);
      const doDia = setores.filter((s) => s.dia === diaSemanaDe(dia) && s.total > 0);
      if (!doDia.length) continue;
      const completo = doDia.every((s) => feitos(s.id, dia) >= s.total);
      if (i === 0 && !completo) continue;
      if (!completo) break;
      sequencia += 1;
    }

    const itensFeitosHoje = setores.reduce((s, x) => s + x.feitosHoje, 0);
    const pontosChecklist = itensFeitosHoje * 10;
    const pontosMetas = Object.values(com.geral).reduce((s, g) => s + PONTOS_FAIXA[g.faixa] * 10, 0);
    const pontosCrcs = com.porCrc.reduce((s, c) => s + c.pontos * 2, 0);
    const pontos = pontosChecklist + pontosMetas + pontosCrcs + Math.min(sequencia, 10) * 5;
    let nivelIdx = 0;
    NIVEIS.forEach((n, i) => { if (pontos >= n.min) nivelIdx = i; });
    const prox = NIVEIS[nivelIdx + 1] || null;

    return {
      hoje: h, diaSemana: dow, diaNome: DIAS_NOME[dow],
      setores, semana, sequencia,
      pontuacao: {
        pontos, checklist: pontosChecklist, metas: pontosMetas, crcs: pontosCrcs, sequencia: Math.min(sequencia, 10) * 5,
        nivel: NIVEIS[nivelIdx].nome, proximoNivel: prox?.nome || null, faltam: prox ? prox.min - pontos : 0,
        progressoNivel: prox ? Math.round(((pontos - NIVEIS[nivelIdx].min) / (prox.min - NIVEIS[nivelIdx].min)) * 100) : 100,
      },
      comercial: { geral: com.geral, mes: com.mes, metas: com.metas, serie: com.serie, ranking: [...com.porCrc].filter((c) => c.ativo).sort((a, b) => b.pontos - a.pontos || (b.valores.agendamentos.valor || 0) - (a.valores.agendamentos.valor || 0)), indicadores: com.indicadores },
    };
  }

  return { dias, salvarDia, itens, salvarItens, checklist, marcar, crcs, salvarCrcs, metas, salvarMeta, lancar, comercial, painel };
}

// rotas da rotina (mesmo formato no app e na Lumia). caminho sem o prefixo, ex: "checklist/vendas".
// Devolve undefined quando a rota nao e da rotina.
export async function rotearRotina(rotina, t, metodo, caminho, query = {}, corpo = {}) {
  const b = corpo || {};
  let m;
  if (caminho === 'dias') {
    if (metodo === 'GET') return { dias: await rotina.dias(t) };
    if (metodo === 'PUT') return { dias: await rotina.salvarDia(t, b.setor, b.dia) };
  }
  if ((m = caminho.match(/^checklist\/([a-z]+)$/))) {
    if (metodo === 'GET') return rotina.checklist(t, m[1], query.dia);
    if (metodo === 'PUT') return rotina.marcar(t, m[1], b.dia, b.item, b.feito);
  }
  if ((m = caminho.match(/^checklist\/([a-z]+)\/itens$/)) && metodo === 'PUT') return { itens: await rotina.salvarItens(t, m[1], b.itens) };
  if (caminho === 'comercial' && metodo === 'GET') return rotina.comercial(t, query.dia);
  if (caminho === 'comercial/lancamento' && metodo === 'PUT') { await rotina.lancar(t, b); return { ok: true }; }
  if (caminho === 'comercial/crcs' && metodo === 'PUT') return { crcs: await rotina.salvarCrcs(t, b.crcs) };
  if (caminho === 'comercial/metas' && metodo === 'PUT') return { metas: await rotina.salvarMeta(t, b) };
  if (caminho === 'painel' && metodo === 'GET') return rotina.painel(t);
  return undefined;
}
export const ROTA_ROTINA_RE = /^(dias|checklist\/[a-z]+(\/itens)?|comercial(\/(lancamento|crcs|metas))?|painel)$/;
