// Aba "Cerebro" (memoria compartilhada entre as IAs - ver src/cerebro.js). Arquivo separado do
// app.js de proposito: so e baixado na primeira vez que a aba e aberta (app.js -> abrirCerebro),
// e a biblioteca do grafo 3D (que embute o three.js, ~1MB) so vem depois disso, do CDN. Quem
// nunca abre a aba nao baixa nada disso.
(() => {
  const LIB_GRAFO = 'https://cdn.jsdelivr.net/npm/3d-force-graph@1.77.0/dist/3d-force-graph.min.js';
  // plano B quando o navegador nao libera WebGL (aceleracao grafica desligada/bloqueada): mesmo
  // grafo, desenhado em 2D num canvas comum - o cerebro nunca some
  const LIB_GRAFO_2D = 'https://cdn.jsdelivr.net/npm/force-graph@1.51.4/dist/force-graph.min.js';
  // three.js separado: os neuronios sao desenhados com objetos 3D proprios
  const LIB_THREE = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
  const ATUALIZAR_CADA_MS = 30000;
  const DESTAQUE_NOVO_MS = 12000;

  const ORIGENS = {
    claude: { nome: 'Claude', cor: '#ff7a3d' },
    chatgpt: { nome: 'ChatGPT', cor: '#19e08f' },
    cursor: { nome: 'Cursor', cor: '#3d8bff' },
    gemini: { nome: 'Gemini', cor: '#b07cff' },
    lumia: { nome: 'Lumia', cor: '#ffd23f' },
    manual: { nome: 'Manual', cor: '#35e0ea' },
    outra: { nome: 'Outra', cor: '#ff4fa3' },
  };
  const TIPOS = { decisao: 'Decisão', fato: 'Fato', preferencia: 'Preferência', tarefa: 'Tarefa', contexto: 'Contexto', aprendizado: 'Aprendizado' };

  let raiz = null;
  let token = '';
  let grafo = null;
  let dados = { nos: [], links: [], total: 0, limite: 0 };
  let filtroOrigens = new Set(Object.keys(ORIGENS));
  let filtroProjeto = '';
  let destaque = null; // Set de ids em destaque (resultado de busca) ou null
  let selecionado = null;
  let libCarregando = null;
  let enquadrado = false;
  let modo2d = false;
  let timerAtualizar = null;
  let primeiraCarga = true;
  const novos = new Map(); // id -> ate quando fica em destaque (memoria que acabou de chegar)
  const el = {};

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const corOrigem = (o) => (ORIGENS[o] || ORIGENS.outra).cor;
  const dataBr = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  async function api(caminho, opcoes = {}) {
    const res = await fetch(caminho, {
      ...opcoes,
      headers: { 'Content-Type': 'application/json', 'x-app-password': token, ...(opcoes.headers || {}) },
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `erro ${res.status}`);
    return d;
  }

  function injetarEstilo() {
    if (document.getElementById('cerebroEstilo')) return;
    const st = document.createElement('style');
    st.id = 'cerebroEstilo';
    st.textContent = `
      .cerebro-aba { display: flex !important; flex-direction: column; min-height: 0; padding: 14px; gap: 12px; overflow: hidden; }
      .cerebro-aba[hidden] { display: none !important; }
      .crb-topo { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .crb-titulo { font-size: 15px; font-weight: 700; color: var(--gold-bright); letter-spacing: .3px; margin-right: 6px; }
      .crb-stats { display: flex; gap: 14px; font-size: 12px; color: var(--text-dim); }
      .crb-stats b { color: var(--text); font-weight: 600; }
      .crb-busca { flex: 1 1 220px; min-width: 0; display: flex; gap: 6px; }
      .crb-busca input, .crb-painel input, .crb-painel textarea, .crb-painel select, .crb-topo select {
        background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px;
        color: var(--text); font-size: 13px; font-family: inherit; min-width: 0; }
      .crb-busca input { flex: 1; }
      .crb-btn { background: rgba(212,175,55,.14); border: 1px solid var(--border); color: var(--gold-bright); border-radius: 8px;
        padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
      .crb-btn:hover { background: rgba(212,175,55,.24); }
      .crb-btn.sec { background: transparent; color: var(--text-dim); }
      .crb-btn.perigo { background: rgba(220,38,38,.14); border-color: rgba(220,38,38,.45); color: #f87171; }
      .crb-filtros { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .crb-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 9px; border-radius: 999px;
        border: 1px solid var(--border-soft); color: var(--text); cursor: pointer; user-select: none; background: rgba(255,255,255,.02); }
      .crb-chip i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .crb-chip.off { opacity: .35; }
      .crb-corpo { flex: 1 1 auto; min-height: 0; display: flex; gap: 12px; }
      .crb-grafo { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; border: 1px solid var(--border-soft); border-radius: 12px;
        overflow: hidden; background: radial-gradient(ellipse at 30% 20%, #1c1240 0%, #0b0720 45%, #04030a 80%); }
      /* o 3D desenha num div PROPRIO: a biblioteca apaga tudo que estiver dentro do container dela,
         e levava junto a mensagem de "cerebro vazio" que fica por cima */
      .crb-grafo-tela { position: absolute; inset: 0; }
      .crb-legenda { position: absolute; left: 12px; top: 12px; z-index: 2; pointer-events: none; display: flex; flex-direction: column; gap: 3px;
        font-size: 11px; color: var(--text-dim); background: rgba(10,9,20,0.55); border: 1px solid var(--border-soft); border-radius: 10px; padding: 8px 10px; backdrop-filter: blur(4px); }
      .crb-legenda b { color: var(--text); font-size: 11px; margin-bottom: 2px; }
      .crb-legenda i { font-style: normal; display: inline-block; width: 16px; color: var(--gold-bright); }
      .crb-legenda small { opacity: .6; }
      .crb-aviso-2d { position: absolute; left: 12px; bottom: 12px; right: 12px; z-index: 2; pointer-events: none; font-size: 12px;
        color: var(--text-dim); background: rgba(20,20,28,0.75); border: 1px solid var(--border-soft); border-radius: 8px; padding: 6px 10px; }
      .crb-grafo-vazio[hidden] { display: none !important; }
      .crb-grafo-vazio { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center;
        padding: 24px; color: var(--text-dim); font-size: 13px; line-height: 1.6; pointer-events: none; }
      .crb-painel { flex: 0 0 340px; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
        border: 1px solid var(--border-soft); border-radius: 12px; padding: 14px; background: var(--panel-flat); }
      .crb-painel h4 { margin: 0; font-size: 13px; color: var(--gold-bright); }
      .crb-painel p { margin: 0; font-size: 12px; color: var(--text-dim); line-height: 1.5; }
      .crb-painel label { font-size: 11px; color: var(--text-dim); }
      .crb-painel textarea { min-height: 110px; resize: vertical; }
      .crb-mem { border: 1px solid var(--border-soft); border-radius: 10px; padding: 10px; cursor: pointer; background: rgba(255,255,255,.02); }
      .crb-mem:hover { border-color: var(--border); }
      .crb-mem-cab { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-dim); margin-bottom: 4px; flex-wrap: wrap; }
      .crb-mem-cab i { width: 8px; height: 8px; border-radius: 50%; }
      .crb-mem-tit { font-size: 13px; color: var(--text); font-weight: 600; margin-bottom: 3px; }
      .crb-mem-txt { font-size: 12px; color: var(--text-dim); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
      .crb-conteudo { font-size: 13px; color: var(--text); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
      .crb-linha { display: flex; gap: 6px; flex-wrap: wrap; }
      .crb-codigo { font-family: ui-monospace, Consolas, monospace; font-size: 11px; background: rgba(0,0,0,.35); border: 1px solid var(--border-soft);
        border-radius: 8px; padding: 8px; color: var(--gold-bright); word-break: break-all; user-select: all; }
      .crb-passo { font-size: 12px; color: var(--text); line-height: 1.55; }
      .crb-passo b { color: var(--gold-bright); }
      .crb-token { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text);
        border: 1px solid var(--border-soft); border-radius: 8px; padding: 8px 10px; }
      .crb-token small { display: block; color: var(--text-dim); font-size: 11px; }
      .crb-tooltip { background: rgba(10,9,7,.92); border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; font-size: 12px;
        color: #f0ede4; max-width: 260px; font-family: inherit; }
      @media (max-width: 860px) {
        .cerebro-aba { overflow-y: auto; }
        .crb-corpo { flex-direction: column; }
        .crb-grafo { flex: 0 0 52vh; }
        .crb-painel { flex: 0 0 auto; }
      }
    `;
    document.head.appendChild(st);
  }

  function montar() {
    raiz.innerHTML = `
      <div class="crb-topo">
        <span class="crb-titulo">Cérebro</span>
        <div class="crb-stats"><span><b data-r="nMem">0</b> memórias</span><span><b data-r="nLig">0</b> ligações</span><span><b data-r="nIas">0</b> IAs conectadas</span></div>
        <form class="crb-busca" data-r="formBusca">
          <input type="search" data-r="busca" placeholder="Buscar por significado (ex: o que decidimos sobre o follow up?)" />
          <button class="crb-btn" type="submit">Buscar</button>
        </form>
        <select data-r="projeto"><option value="">Todos os projetos</option></select>
        <button class="crb-btn" type="button" data-r="btnNova">+ Memória</button>
        <button class="crb-btn" type="button" data-r="btnConectar">Conectar IAs</button>
      </div>
      <div class="crb-filtros" data-r="filtros"></div>
      <div class="crb-corpo">
        <div class="crb-grafo"><div class="crb-grafo-tela" data-r="grafo"></div><div class="crb-legenda" data-r="legenda"></div><div class="crb-grafo-vazio" data-r="vazio">Carregando o cérebro...</div></div>
        <div class="crb-painel" data-r="painel"></div>
      </div>`;
    raiz.querySelectorAll('[data-r]').forEach((n) => { el[n.dataset.r] = n; });

    for (const [chave, o] of Object.entries(ORIGENS)) {
      const chip = document.createElement('span');
      chip.className = 'crb-chip';
      chip.innerHTML = `<i style="background:${o.cor};box-shadow:0 0 6px ${o.cor}"></i>${esc(o.nome)}`;
      chip.addEventListener('click', () => {
        if (filtroOrigens.has(chave)) filtroOrigens.delete(chave); else filtroOrigens.add(chave);
        chip.classList.toggle('off', !filtroOrigens.has(chave));
        aplicarFiltros();
      });
      el.filtros.appendChild(chip);
    }
    el.legenda.innerHTML = '<b>Formato = tipo da memória</b>' + Object.entries(FORMAS).map(([k, f]) => `<span><i>${f.glifo}</i>${f.nome} <small>${f.desc}</small></span>`).join('');
    el.formBusca.addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
    el.busca.addEventListener('input', () => { if (!el.busca.value.trim() && destaque) { destaque = null; atualizarCores(); painelInicial(); } });
    el.projeto.addEventListener('change', () => { filtroProjeto = el.projeto.value; aplicarFiltros(); });
    el.btnNova.addEventListener('click', () => painelNova());
    el.btnConectar.addEventListener('click', () => painelConectar());
  }

  function carregarLib() {
    if (window.ForceGraph3D && window.THREE) return Promise.resolve();
    if (!libCarregando) {
      libCarregando = (async () => {
        if (!window.THREE) await baixarScript(LIB_THREE, 'não consegui baixar o motor 3D');
        if (!window.ForceGraph3D) await baixarScript(LIB_GRAFO, 'não consegui baixar o visualizador 3D');
      })().catch((e) => { libCarregando = null; throw e; });
    }
    return libCarregando;
  }

  function baixarScript(src, erro) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(erro));
      document.head.appendChild(s);
    });
  }

  function webglOk() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { return false; }
  }

  // ---------- dados / grafo ----------

  function nosVisiveis() {
    return dados.nos.filter((n) => filtroOrigens.has(ORIGENS[n.origem] ? n.origem : 'outra') && (!filtroProjeto || n.projeto === filtroProjeto));
  }

  function aplicarFiltros() {
    if (!grafo) return;
    const nos = nosVisiveis();
    const ids = new Set(nos.map((n) => n.id));
    const idDe = (x) => (typeof x === 'object' ? x.id : x);
    const links = dados.links.filter((l) => ids.has(idDe(l.source)) && ids.has(idDe(l.target)));
    grafo.graphData({ nodes: nos, links });
    el.vazio.hidden = nos.length > 0;
    for (const [k, l] of Object.entries(lobos)) { const tem = nos.some((n) => chaveOrigem(n.origem) === k); l.neb.visible = tem; l.rotulo.visible = tem; }
    if (!nos.length) el.vazio.textContent = dados.nos.length ? 'Nenhuma memória com esses filtros.' : 'O cérebro ainda está vazio. Conecte uma IA em "Conectar IAs" (ela vai salvando sozinha o que for importante) ou crie a primeira memória em "+ Memória".';
  }

  const rotuloNo = (n) => `<div class="crb-tooltip"><b>${esc(n.titulo || TIPOS[n.tipo] || 'Memória')}</b><br><span style="color:${corOrigem(n.origem)}">● ${esc((ORIGENS[n.origem] || ORIGENS.outra).nome)}</span> · ${esc(TIPOS[n.tipo] || n.tipo)}<br>${esc(n.resumo)}</div>`;
  const ehNovo = (n) => (novos.get(n.id) || 0) > Date.now();

  function corNo(n) {
    if (destaque && !destaque.has(n.id)) return 'rgba(120,120,140,0.18)';
    if (selecionado === n.id || ehNovo(n)) return '#ffffff';
    return corOrigem(n.origem);
  }
  const tamanhoNo = (n) => (1.5 + Math.min(n.grau || 0, 12) * 0.6) * (ehNovo(n) ? 2.4 : 1);

  function atualizarCores() {
    if (!grafo) return;
    if (modo2d) { configurarLigacoes(grafo); return; }
    for (const n of grafo.graphData().nodes) { const g = cacheNeuronio.get(n.id); if (g) estilizarNeuronio(n, g); }
    configurarLigacoes(grafo);
  }

  async function carregarDados() {
    const [g, t, p] = await Promise.all([
      api('/api/cerebro/grafo'),
      api('/api/cerebro/tokens').catch(() => ({ tokens: [] })),
      api('/api/cerebro/buscar').catch(() => ({ memorias: [] })),
    ]);
    // grau de cada no (quantas ligacoes) define o tamanho - memorias "centrais" ficam maiores
    const grau = new Map();
    for (const l of g.links) {
      grau.set(l.source, (grau.get(l.source) || 0) + 1);
      grau.set(l.target, (grau.get(l.target) || 0) + 1);
    }
    for (const n of g.nos) n.grau = grau.get(n.id) || 0;
    // reaproveita a posicao de quem ja estava na tela - sem isso o cerebro inteiro "explodia" e
    // se reorganizava do zero toda vez que a aba atualiza
    const antigos = new Map(dados.nos.map((n) => [n.id, n]));
    for (const n of g.nos) {
      const a = antigos.get(n.id);
      if (a && a.x != null) Object.assign(n, { x: a.x, y: a.y, z: a.z });
      // memoria que nao estava na tela da ultima vez = acabou de chegar: fica maior e branca uns
      // segundos, pra dar pra ver o cerebro crescendo
      if (!a && !primeiraCarga) novos.set(n.id, Date.now() + DESTAQUE_NOVO_MS);
    }
    primeiraCarga = false;
    dados = g;
    el.nMem.textContent = g.total;
    el.nLig.textContent = g.links.length;
    el.nIas.textContent = new Set((t.tokens || []).map((x) => x.origem)).size;
    const projetos = [...new Set(g.nos.map((n) => n.projeto).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    el.projeto.innerHTML = '<option value="">Todos os projetos</option>' + projetos.map((pr) => `<option value="${esc(pr)}">${esc(pr)}</option>`).join('');
    if (projetos.includes(filtroProjeto)) el.projeto.value = filtroProjeto; else filtroProjeto = '';
    recentes = p.memorias || [];
  }
  let recentes = [];

  // ---------- neuronios (visual realista: cada memoria e um neuronio) ----------
  // cor = IA que salvou · formato = tipo da memoria · lobo = regiao do cerebro de cada IA
  const FORMAS = {
    decisao: { nome: 'Decisão', glifo: '▲', desc: 'piramidal' },
    fato: { nome: 'Fato', glifo: '✺', desc: 'estrelado' },
    preferencia: { nome: 'Preferência', glifo: '⬬', desc: 'bipolar' },
    tarefa: { nome: 'Tarefa', glifo: '◆', desc: 'multipolar' },
    contexto: { nome: 'Contexto', glifo: '✳', desc: 'glia' },
    aprendizado: { nome: 'Aprendizado', glifo: '❂', desc: 'Purkinje (leque)' },
  };
  // centro de cada "lobo" no espaco. Cada IA fica na sua regiao, bem separada das outras
  const CENTROS = {
    claude: [-85, 38, 30], chatgpt: [85, 38, 30], cursor: [-72, -42, -30], gemini: [72, -42, -30],
    lumia: [0, 72, -10], manual: [0, -62, 45], outra: [0, 6, -88],
  };
  const chaveOrigem = (o) => (ORIGENS[o] ? o : 'outra');
  const cacheArvore = new Map();
  const cacheNeuronio = new Map();
  const cacheGeoSoma = {};
  const lobos = {};
  let animando = false;

  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // dendritos ramificados (sempre a mesma arvore pro mesmo neuronio). Unidade: raio do soma = 1
  function arvore(tipo, id) {
    const chave = `${tipo}:${id}`;
    if (cacheArvore.has(chave)) return cacheArvore.get(chave);
    const rng = mulberry32((Number(id) || 1) * 2654435761);
    const seg = [];
    const pontas = [];
    const unit = () => { const u = rng() * 2 - 1; const t = rng() * Math.PI * 2; const s = Math.sqrt(1 - u * u); return [s * Math.cos(t), u, s * Math.sin(t)]; };
    const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const mix = (d, q) => { const u = unit(); return norm([d[0] + u[0] * q, d[1] + u[1] * q, d[2] + u[2] * q]); };
    const mult = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
    function ramo(p, dir, comp, nivel, maxN, abre, plano) {
      let q = p;
      let d = dir;
      for (let i = 0; i < 3; i++) {
        d = mix(d, 0.3);
        const r = [q[0] + d[0] * comp / 3, q[1] + d[1] * comp / 3, q[2] + d[2] * comp / 3];
        seg.push(q[0], q[1], q[2], r[0], r[1], r[2]);
        q = r;
      }
      if (nivel < maxN) {
        const filhos = nivel === 0 ? 2 : (rng() < 0.7 ? 2 : 1);
        for (let k = 0; k < filhos; k++) {
          const nd = mix(d, abre);
          if (plano) nd[2] *= 0.25;
          ramo(q, norm(nd), comp * 0.62, nivel + 1, maxN, abre, plano);
        }
      } else pontas.push(q);
    }
    if (tipo === 'decisao') { // piramidal: um dendrito apical longo + basais
      ramo([0, 0.8, 0], [0, 1, 0], 5.2, 0, 2, 0.6);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + rng(); const d = norm([Math.cos(a), -0.5 - rng() * 0.3, Math.sin(a)]); ramo(mult(d, 0.8), d, 3, 0, 1, 0.7); }
    } else if (tipo === 'preferencia') { // bipolar: dois polos opostos
      ramo([0, 1, 0], [0, 1, 0], 4.8, 0, 2, 0.55);
      ramo([0, -1, 0], [0, -1, 0], 4.8, 0, 2, 0.55);
    } else if (tipo === 'tarefa') { // multipolar: poucos bracos grossos
      for (let i = 0; i < 5; i++) { const d = unit(); ramo(mult(d, 1.05), d, 3.9, 0, 2, 0.6); }
    } else if (tipo === 'contexto') { // glia: muitos filamentos curtos
      for (let i = 0; i < 14; i++) { const d = unit(); ramo(mult(d, 0.8), d, 2.3, 0, 1, 0.9); }
    } else if (tipo === 'aprendizado') { // Purkinje: leque achatado
      ramo([0, 0.9, 0], [0, 1, 0], 3.4, 0, 3, 0.95, true);
      ramo([0.3, 0.8, 0], norm([0.5, 1, 0]), 2.6, 0, 2, 0.9, true);
    } else { // fato: estrelado
      for (let i = 0; i < 9; i++) { const d = unit(); ramo(mult(d, 1), d, 2.7, 0, 1, 0.7); }
    }
    const ax = unit(); // axonio longo
    ramo(mult(ax, 1), ax, 6.5, 0, 0, 0);
    const r = { seg, pontas };
    cacheArvore.set(chave, r);
    return r;
  }

  const raioNo = (n) => 1.6 + Math.cbrt(tamanhoNo(n)) * 1.1;
  const hexA = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; };
  const clarear = (hex, k) => { const v = parseInt(hex.slice(1), 16); const f = (c) => Math.round(c + (255 - c) * k); return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`; };

  // estado visual do no: cor, apagado (fora da busca) e destaque (selecionado / acabou de chegar)
  function estadoNo(n) {
    const dim = !!(destaque && !destaque.has(n.id));
    const forte = selecionado === n.id || ehNovo(n);
    return { cor: dim ? '#7a7a8c' : corOrigem(n.origem), dim, forte };
  }

  function geoSoma(tipo) {
    const T = window.THREE;
    if (cacheGeoSoma[tipo]) return cacheGeoSoma[tipo];
    let g;
    if (tipo === 'decisao') g = new T.ConeGeometry(0.95, 1.8, 14);
    else if (tipo === 'preferencia') { g = new T.SphereGeometry(0.8, 18, 14); g.scale(0.75, 1.35, 0.75); }
    else if (tipo === 'tarefa') g = new T.OctahedronGeometry(1.15);
    else if (tipo === 'contexto') g = new T.IcosahedronGeometry(0.85, 0);
    else if (tipo === 'aprendizado') g = new T.DodecahedronGeometry(1);
    else g = new T.SphereGeometry(1, 20, 16);
    cacheGeoSoma[tipo] = g;
    return g;
  }

  let texGlow = null;
  function texturaGlow() {
    if (texGlow) return texGlow;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    texGlow = new window.THREE.CanvasTexture(c);
    return texGlow;
  }

  function construirNeuronio(n) {
    const T = window.THREE;
    const g = new T.Group();
    const arv = arvore(n.tipo, n.id);
    const soma = new T.Mesh(geoSoma(n.tipo), new T.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55, shininess: 70, transparent: true, opacity: 0.96 }));
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(arv.seg, 3));
    const linhas = new T.LineSegments(geo, new T.LineBasicMaterial({ transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    const gp = new T.BufferGeometry();
    gp.setAttribute('position', new T.Float32BufferAttribute(arv.pontas.flat(), 3));
    const botoes = new T.Points(gp, new T.PointsMaterial({ size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }));
    const glow = new T.Sprite(new T.SpriteMaterial({ map: texturaGlow(), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
    // area de clique/hover maior que o soma (os fios sao finos demais pra acertar)
    const area = new T.Mesh(new T.SphereGeometry(1.7, 8, 6), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    g.add(glow, linhas, botoes, soma, area);
    g.userData = { soma, linhas, botoes, glow, fase: (Number(n.id) % 97) * 0.37, glowBase: 7 };
    return g;
  }

  function estilizarNeuronio(n, g) {
    const { cor, dim, forte } = estadoNo(n);
    const u = g.userData;
    const base = forte ? '#ffffff' : cor;
    u.soma.material.color.set(base);
    u.soma.material.emissive.set(base);
    u.soma.material.opacity = dim ? 0.18 : 0.96;
    u.linhas.material.color.set(forte ? '#ffffff' : clarear(cor, 0.3));
    u.linhas.material.opacity = dim ? 0.08 : 0.85;
    u.botoes.material.color.set(clarear(cor, 0.55));
    u.botoes.material.opacity = dim ? 0.1 : 0.95;
    u.glow.material.color.set(base);
    u.glowBase = forte ? 11 : 7;
    u.glow.material.opacity = dim ? 0.05 : (forte ? 0.8 : 0.5);
    u.dim = dim;
    g.scale.setScalar(raioNo(n));
  }

  function objetoNo(n) {
    let g = cacheNeuronio.get(n.id);
    if (!g) { g = construirNeuronio(n); cacheNeuronio.set(n.id, g); }
    estilizarNeuronio(n, g);
    return g;
  }

  // pulso lento de cada neuronio (cerebro "vivo")
  function animarNeuronios() {
    if (animando) return;
    animando = true;
    const passo = () => {
      requestAnimationFrame(passo);
      if (!grafo || modo2d || document.hidden || !raiz || raiz.offsetParent === null) return;
      const t = performance.now() / 1000;
      for (const g of cacheNeuronio.values()) {
        const u = g.userData;
        const s = 0.5 + 0.5 * Math.sin(t * 1.5 + u.fase);
        const gb = u.glowBase * (1 + 0.14 * s);
        u.glow.scale.set(gb, gb, 1);
        if (!u.dim) u.soma.material.emissiveIntensity = 0.4 + 0.35 * s;
      }
      for (const l of Object.values(lobos)) l.neb.material.rotation += 0.0006;
    };
    passo();
  }

  function criarLobos() {
    const T = window.THREE;
    const cena = grafo.scene();
    for (const [k, c] of Object.entries(CENTROS)) {
      const cor = ORIGENS[k].cor;
      const neb = new T.Sprite(new T.SpriteMaterial({ map: texturaGlow(), color: cor, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
      neb.scale.set(190, 190, 1);
      neb.position.set(c[0], c[1], c[2]);
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      const x = cv.getContext('2d');
      x.font = '700 64px system-ui, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.shadowColor = cor; x.shadowBlur = 24;
      x.fillStyle = cor;
      x.fillText(ORIGENS[k].nome.toUpperCase(), 256, 64);
      const rotulo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), transparent: true, opacity: 0.85, depthWrite: false }));
      rotulo.scale.set(64, 16, 1);
      rotulo.position.set(c[0], c[1] + 62, c[2]);
      cena.add(neb, rotulo);
      lobos[k] = { neb, rotulo };
    }
  }

  function forcaLobos() {
    let ns = [];
    const f = (alpha) => {
      const k = 0.25 * alpha;
      for (const n of ns) {
        const c = CENTROS[chaveOrigem(n.origem)];
        n.vx += (c[0] - n.x) * k;
        n.vy += (c[1] - n.y) * k;
        if (n.vz !== undefined) n.vz += (c[2] - n.z) * k;
      }
    };
    f.initialize = (x) => { ns = x; };
    return f;
  }

  const origemDoLink = (l, ponta) => {
    const x = l[ponta];
    const n = typeof x === 'object' ? x : dados.nos.find((m) => m.id === x);
    return n ? corOrigem(n.origem) : '#9a8cff';
  };

  function configurarLigacoes(g) {
    g.linkColor((l) => hexA(origemDoLink(l, 'source'), destaque ? 0.06 : 0.38))
      .linkCurvature(0.14)
      .linkDirectionalParticles((l) => (l.peso >= 0.85 ? 3 : 1))
      .linkDirectionalParticleColor((l) => clarear(origemDoLink(l, 'target'), 0.5))
      .linkDirectionalParticleSpeed((l) => 0.003 + (l.peso || 0.5) * 0.005);
  }

  function desenharNeuronio2D(n, ctx, escala) {
    if (n.x == null) return;
    const { cor, dim, forte } = estadoNo(n);
    const R = raioNo(n) * 0.9;
    const arv = arvore(n.tipo, n.id);
    const fase = (Number(n.id) % 97) * 0.37;
    const s = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 1.5 + fase);
    const base = forte ? '#ffffff' : cor;
    const rg = R * 3.4 * (1 + 0.12 * s);
    const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rg);
    gr.addColorStop(0, hexA(base, dim ? 0.05 : 0.45));
    gr.addColorStop(1, hexA(base, 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(n.x, n.y, rg, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dim ? 'rgba(120,120,140,0.15)' : hexA(cor, 0.85);
    ctx.lineWidth = Math.max(0.5, 1.1 / escala);
    ctx.beginPath();
    for (let i = 0; i < arv.seg.length; i += 6) {
      ctx.moveTo(n.x + arv.seg[i] * R * 0.8, n.y - arv.seg[i + 1] * R * 0.8);
      ctx.lineTo(n.x + arv.seg[i + 3] * R * 0.8, n.y - arv.seg[i + 4] * R * 0.8);
    }
    ctx.stroke();
    ctx.fillStyle = dim ? 'rgba(150,150,170,0.2)' : clarear(cor, 0.55);
    for (const p of arv.pontas) { ctx.beginPath(); ctx.arc(n.x + p[0] * R * 0.8, n.y - p[1] * R * 0.8, Math.max(0.5, 0.5 / escala + 0.3), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = dim ? 'rgba(120,120,140,0.3)' : base;
    ctx.strokeStyle = dim ? 'rgba(120,120,140,0.3)' : clarear(cor, 0.6);
    ctx.lineWidth = Math.max(0.4, 0.8 / escala);
    ctx.beginPath();
    const poli = (lados, rot = 0) => { for (let i = 0; i < lados; i++) { const a = rot + (i / lados) * Math.PI * 2; const px = n.x + Math.cos(a) * R; const py = n.y + Math.sin(a) * R; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); };
    if (n.tipo === 'decisao') poli(3, -Math.PI / 2);
    else if (n.tipo === 'tarefa') poli(4, Math.PI / 4);
    else if (n.tipo === 'contexto') poli(6);
    else if (n.tipo === 'aprendizado') poli(5, -Math.PI / 2);
    else if (n.tipo === 'preferencia') ctx.ellipse(n.x, n.y, R * 0.7, R * 1.2, 0, 0, Math.PI * 2);
    else ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  function criarGrafo() {
    const largura = () => el.grafo.clientWidth;
    const altura = () => el.grafo.clientHeight;
    grafo = window.ForceGraph3D({ controlType: 'orbit' })(el.grafo)
      .backgroundColor('rgba(0,0,0,0)')
      .showNavInfo(false)
      .width(largura()).height(altura())
      .nodeId('id')
      .nodeVal(tamanhoNo)
      .nodeThreeObject(objetoNo)
      .nodeThreeObjectExtend(false)
      .nodeLabel(rotuloNo)
      .linkWidth(0)
      .linkOpacity(0.7)
      .linkDirectionalParticleWidth(1.6)
      .cooldownTicks(220)
      .warmupTicks(40)
      .onNodeClick((n) => selecionar(n.id))
      // enquadra o cerebro inteiro na tela quando o layout assenta (so na primeira vez - depois
      // respeita o zoom/angulo que o usuario escolheu)
      .onEngineStop(() => enquadrar())
      .onBackgroundClick(() => { selecionado = null; atualizarCores(); if (!destaque) painelInicial(); });
    configurarLigacoes(grafo);
    criarLobos();
    animarNeuronios();
    // rotacao lenta automatica (o efeito "cerebro vivo"); para quando o usuario mexe na camera
    const controles = grafo.controls();
    if (controles) {
      controles.autoRotate = true;
      controles.autoRotateSpeed = 0.6;
      controles.addEventListener('start', () => { controles.autoRotate = false; });
    }
    // distanceMax: sem limite, memoria sem ligacao nenhuma era empurrada pra longe pra sempre e
    // ficava perdida fora da tela
    grafo.d3Force('charge').strength(-70).distanceMax(150);
    grafo.d3Force('link').distance(60).strength(0.015);
    grafo.d3Force('lobos', forcaLobos());
    new ResizeObserver(() => { if (grafo && largura() && altura()) grafo.width(largura()).height(altura()); }).observe(el.grafo);
  }

  function criarGrafo2D() {
    modo2d = true;
    const largura = () => el.grafo.clientWidth;
    const altura = () => el.grafo.clientHeight;
    grafo = window.ForceGraph()(el.grafo)
      .backgroundColor('rgba(0,0,0,0)')
      .width(largura()).height(altura())
      .nodeId('id')
      .nodeVal(tamanhoNo)
      .nodeCanvasObjectMode(() => 'replace')
      .nodeCanvasObject(desenharNeuronio2D)
      .nodePointerAreaPaint((n, cor, ctx) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(n.x, n.y, raioNo(n) * 1.7, 0, Math.PI * 2); ctx.fill(); })
      .autoPauseRedraw(false)
      .nodeLabel(rotuloNo)
      .linkWidth(0.8)
      .linkDirectionalParticleWidth(2)
      .cooldownTicks(220)
      .onNodeClick((n) => selecionar(n.id))
      .onEngineStop(() => enquadrar())
      .onBackgroundClick(() => { selecionado = null; atualizarCores(); if (!destaque) painelInicial(); });
    configurarLigacoes(grafo);
    grafo.d3Force('charge').strength(-70).distanceMax(150);
    grafo.d3Force('link').distance(60).strength(0.015);
    grafo.d3Force('lobos', forcaLobos());
    new ResizeObserver(() => { if (grafo && largura() && altura()) grafo.width(largura()).height(altura()); }).observe(el.grafo);
    const aviso = document.createElement('div');
    aviso.className = 'crb-aviso-2d';
    aviso.textContent = 'Modo 2D: a aceleração gráfica do navegador está desligada. Ligue em Configurações → Sistema → "Usar aceleração gráfica" para ver em 3D.';
    el.grafo.appendChild(aviso);
  }

  // 3D quando der; se o navegador recusar WebGL (ou a lib 3D falhar), cai pro 2D
  async function montarGrafo() {
    if (webglOk()) {
      try {
        await carregarLib();
        criarGrafo();
        return;
      } catch (err) {
        console.warn('Cerebro: 3D indisponivel, usando 2D:', err.message);
        grafo = null;
        el.grafo.querySelector('canvas')?.remove();
      }
    }
    if (!window.ForceGraph) await baixarScript(LIB_GRAFO_2D, 'não consegui baixar o visualizador do cérebro');
    criarGrafo2D();
  }

  // busca de novo o que as IAs salvaram (a aba aberta parada tambem acompanha)
  function agendarAtualizacao() {
    clearInterval(timerAtualizar);
    timerAtualizar = setInterval(() => {
      if (!raiz || !raiz.isConnected || raiz.offsetParent === null || document.hidden) return;
      const estavaNoInicio = !selecionado && !destaque;
      recarregar().then(() => { if (estavaNoInicio) painelInicial(); }).catch(() => {});
    }, ATUALIZAR_CADA_MS);
  }
  // depois que o destaque das memorias novas vence, volta o tamanho/cor normal
  setInterval(() => {
    if (!grafo || !novos.size) return;
    const agora = Date.now();
    let mudou = false;
    for (const [id, ate] of novos) if (ate <= agora) { novos.delete(id); mudou = true; }
    if (mudou) { grafo.nodeVal(tamanhoNo); atualizarCores(); }
  }, 2000);

  // o zoomToFit da biblioteca encaixa so o CENTRO das bolinhas (fica perto demais com poucas
  // memorias) - aqui a distancia sai do tamanho real do cerebro, com folga pras bolinhas
  function enquadrar() {
    if (!grafo || enquadrado || !grafo.graphData().nodes.length) return;
    if (modo2d) { enquadrado = true; grafo.zoomToFit(700, 50); return; }
    // calcula na mao a partir das posicoes - o getGraphBbox() da biblioteca devolvia uma caixa
    // errada (minuscula) nessa versao
    const nos = grafo.graphData().nodes.filter((n) => Number.isFinite(n.x));
    if (!nos.length) return;
    enquadrado = true;
    const centro = { x: 0, y: 0, z: 0 };
    for (const n of nos) { centro.x += n.x / nos.length; centro.y += n.y / nos.length; centro.z += n.z / nos.length; }
    // percentil 90 em vez do maximo - uma memoria solta (sem ligacao) longe do resto nao pode
    // decidir o zoom do cerebro inteiro
    const dists = nos.map((n) => Math.hypot(n.x - centro.x, n.y - centro.y, n.z - centro.z)).sort((a, b) => a - b);
    const raio = dists[Math.floor((dists.length - 1) * 0.9)] || 30;
    // tela em pe (celular): o campo de visao da camera e vertical, entao afasta na proporcao
    // pra nao cortar as laterais
    const proporcao = Math.max(1, el.grafo.clientHeight / Math.max(el.grafo.clientWidth, 1));
    grafo.cameraPosition({ x: centro.x, y: centro.y, z: centro.z + (raio * 2.7 + 50) * proporcao }, centro, 800);
  }

  function focar(id) {
    if (!grafo) return;
    const n = grafo.graphData().nodes.find((x) => x.id === id);
    if (!n || n.x == null) return;
    if (modo2d) { grafo.centerAt(n.x, n.y, 800); grafo.zoom(3.5, 800); return; }
    const dist = 90;
    const r = 1 + dist / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
    const c = grafo.controls();
    if (c) c.autoRotate = false;
    grafo.cameraPosition({ x: n.x * r, y: n.y * r, z: n.z * r }, n, 900);
  }

  // ---------- painel lateral ----------

  function cartaoMemoria(m) {
    const d = document.createElement('div');
    d.className = 'crb-mem';
    d.innerHTML = `
      <div class="crb-mem-cab"><i style="background:${corOrigem(m.origem)}"></i>${esc((ORIGENS[m.origem] || ORIGENS.outra).nome)}
        · ${esc(TIPOS[m.tipo] || m.tipo)}${m.projeto ? ` · ${esc(m.projeto)}` : ''} · ${dataBr(m.criado_em)}</div>
      ${m.titulo ? `<div class="crb-mem-tit">${esc(m.titulo)}</div>` : ''}
      <div class="crb-mem-txt">${esc((m.conteudo || m.resumo || '').slice(0, 220))}</div>`;
    d.addEventListener('click', () => selecionar(m.id, true));
    return d;
  }

  function painelInicial() {
    el.painel.innerHTML = `<h4>Memórias recentes</h4>
      <p>Clique num ponto do cérebro pra ver a memória. Cada cor é a IA que salvou (cada uma tem a sua região do cérebro), o formato do neurônio é o tipo da memória, e as sinapses ligam memórias sobre o mesmo assunto.</p>`;
    if (!recentes.length) {
      el.painel.insertAdjacentHTML('beforeend', '<p>Nenhuma memória ainda.</p>');
      return;
    }
    for (const m of recentes.slice(0, 15)) el.painel.appendChild(cartaoMemoria(m));
  }

  async function selecionar(id, comFoco = false) {
    selecionado = id;
    atualizarCores();
    if (comFoco) focar(id);
    el.painel.innerHTML = '<p>Carregando...</p>';
    try {
      const m = await api(`/api/cerebro/memorias/${id}`);
      if (selecionado !== id) return;
      el.painel.innerHTML = `
        <div class="crb-mem-cab"><i style="width:9px;height:9px;border-radius:50%;background:${corOrigem(m.origem)}"></i>
          #${m.id} · salvo por ${esc((ORIGENS[m.origem] || ORIGENS.outra).nome)} · ${esc(TIPOS[m.tipo] || m.tipo)} · ${dataBr(m.criado_em)}</div>
        ${m.titulo ? `<h4>${esc(m.titulo)}</h4>` : ''}
        ${m.projeto ? `<p>Projeto: <b style="color:var(--text)">${esc(m.projeto)}</b></p>` : ''}
        <div class="crb-conteudo">${esc(m.conteudo)}</div>
        ${m.tags?.length ? `<p>Tags: ${m.tags.map(esc).join(', ')}</p>` : ''}
        <div class="crb-linha"><button class="crb-btn sec" data-a="editar">Editar</button><button class="crb-btn perigo" data-a="arquivar">Arquivar</button></div>
        ${m.relacionadas.length ? '<h4 style="margin-top:6px">Ligada a</h4>' : ''}`;
      for (const r of m.relacionadas) el.painel.appendChild(cartaoMemoria(r));
      el.painel.querySelector('[data-a="editar"]').addEventListener('click', () => painelNova(m));
      el.painel.querySelector('[data-a="arquivar"]').addEventListener('click', async () => {
        if (!confirm('Arquivar essa memória? Ela some das buscas e do cérebro.')) return;
        try {
          await api(`/api/cerebro/memorias/${m.id}`, { method: 'DELETE' });
          selecionado = null;
          await recarregar();
          painelInicial();
        } catch (err) { alert(err.message); }
      });
    } catch (err) {
      el.painel.innerHTML = `<p>Erro: ${esc(err.message)}</p>`;
    }
  }

  async function buscar() {
    const q = el.busca.value.trim();
    if (!q) return;
    el.painel.innerHTML = '<p>Buscando...</p>';
    try {
      const params = new URLSearchParams({ q });
      if (filtroProjeto) params.set('projeto', filtroProjeto);
      const { memorias } = await api(`/api/cerebro/buscar?${params}`);
      destaque = new Set(memorias.map((m) => m.id));
      atualizarCores();
      el.painel.innerHTML = `<h4>${memorias.length} resultado${memorias.length === 1 ? '' : 's'}</h4>
        <p>Os pontos que acenderam no cérebro são as memórias encontradas. Apague a busca pra voltar.</p>`;
      for (const m of memorias) el.painel.appendChild(cartaoMemoria(m));
      if (memorias[0]) focar(memorias[0].id);
    } catch (err) {
      el.painel.innerHTML = `<p>Erro: ${esc(err.message)}</p>`;
    }
  }

  function painelNova(existente = null) {
    const tiposOpts = Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${existente?.tipo === k ? 'selected' : ''}>${v}</option>`).join('');
    el.painel.innerHTML = `
      <h4>${existente ? `Editar memória #${existente.id}` : 'Nova memória'}</h4>
      <label>Título (opcional)</label><input data-f="titulo" maxlength="200" value="${esc(existente?.titulo || '')}" />
      <label>O que lembrar</label><textarea data-f="conteudo">${esc(existente?.conteudo || '')}</textarea>
      <label>Tipo</label><select data-f="tipo">${tiposOpts}</select>
      <label>Projeto (opcional)</label><input data-f="projeto" maxlength="80" list="crbProjetos" value="${esc(existente?.projeto || '')}" />
      <datalist id="crbProjetos">${[...el.projeto.options].filter((o) => o.value).map((o) => `<option value="${esc(o.value)}">`).join('')}</datalist>
      <label>Tags (separadas por vírgula)</label><input data-f="tags" value="${esc((existente?.tags || []).join(', '))}" />
      <div class="crb-linha"><button class="crb-btn" data-a="salvar">Salvar</button><button class="crb-btn sec" data-a="cancelar">Cancelar</button></div>`;
    const f = (k) => el.painel.querySelector(`[data-f="${k}"]`);
    el.painel.querySelector('[data-a="cancelar"]').addEventListener('click', () => (existente ? selecionar(existente.id) : painelInicial()));
    el.painel.querySelector('[data-a="salvar"]').addEventListener('click', async (e) => {
      const corpo = {
        titulo: f('titulo').value, conteudo: f('conteudo').value, tipo: f('tipo').value, projeto: f('projeto').value,
        tags: f('tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (!corpo.conteudo.trim()) return alert('Escreva o que lembrar.');
      e.target.disabled = true;
      try {
        const m = existente
          ? await api(`/api/cerebro/memorias/${existente.id}`, { method: 'PUT', body: JSON.stringify(corpo) })
          : await api('/api/cerebro/memorias', { method: 'POST', body: JSON.stringify(corpo) });
        await recarregar();
        selecionar(m.id, true);
      } catch (err) {
        e.target.disabled = false;
        alert(err.message);
      }
    });
    f('conteudo').focus();
  }

  async function painelConectar(novo = null) {
    const opts = Object.entries(ORIGENS).filter(([k]) => k !== 'manual').map(([k, o]) => `<option value="${k}">${o.nome}</option>`).join('');
    el.painel.innerHTML = '<h4>Conectar IAs</h4>';
    if (novo) {
      const url = `${location.origin}/mcp/${novo.token}`;
      el.painel.insertAdjacentHTML('beforeend', `
        <p style="color:#f5d576"><b>Copie agora:</b> por segurança esse endereço só aparece esta vez.</p>
        <div class="crb-codigo">${esc(url)}</div>
        <div class="crb-linha"><button class="crb-btn" data-a="copiar">Copiar endereço</button></div>
        <div class="crb-passo"><b>Claude (site ou app):</b> Configurações → Conectores → Adicionar conector personalizado → cole o endereço.</div>
        <div class="crb-passo"><b>Claude Code:</b></div>
        <div class="crb-codigo">claude mcp add --transport http cerebro ${esc(url)}</div>
        <div class="crb-passo"><b>ChatGPT:</b> Configurações → Apps e conectores → Avançado → ative o modo desenvolvedor → Criar → cole o endereço (autenticação: nenhuma).</div>
        <div class="crb-passo"><b>Cursor:</b> Settings → MCP → Add new MCP server, ou no arquivo <code>~/.cursor/mcp.json</code>:</div>
        <div class="crb-codigo">{ "mcpServers": { "cerebro": { "url": "${esc(url)}" } } }</div>
        <hr style="border:none;border-top:1px solid var(--border-soft);width:100%">`);
      el.painel.querySelector('[data-a="copiar"]').addEventListener('click', async (e) => {
        try { await navigator.clipboard.writeText(url); e.target.textContent = 'Copiado!'; } catch { e.target.textContent = 'Selecione e copie acima'; }
      });
    } else {
      el.painel.insertAdjacentHTML('beforeend', '<p>Crie uma conexão pra cada IA. Cada uma recebe um endereço próprio, e o que ela salvar aparece no cérebro com a cor dela.</p>');
    }
    el.painel.insertAdjacentHTML('beforeend', `
      <label>Nome da conexão</label><input data-f="nome" placeholder="ex: Claude do notebook" maxlength="60" />
      <label>Qual IA</label><select data-f="origem">${opts}</select>
      <div class="crb-linha"><button class="crb-btn" data-a="criar">Gerar endereço de conexão</button></div>
      <h4 style="margin-top:6px">Conexões ativas</h4><div data-r2="lista"><p>Carregando...</p></div>`);
    el.painel.querySelector('[data-a="criar"]').addEventListener('click', async (e) => {
      const nome = el.painel.querySelector('[data-f="nome"]').value.trim();
      const origem = el.painel.querySelector('[data-f="origem"]').value;
      if (!nome) return alert('Dê um nome pra conexão.');
      e.target.disabled = true;
      try {
        const r = await api('/api/cerebro/tokens', { method: 'POST', body: JSON.stringify({ nome, origem }) });
        painelConectar(r);
        carregarDados().catch(() => {});
      } catch (err) { e.target.disabled = false; alert(err.message); }
    });
    const lista = el.painel.querySelector('[data-r2="lista"]');
    try {
      const { tokens } = await api('/api/cerebro/tokens');
      lista.innerHTML = tokens.length ? '' : '<p>Nenhuma IA conectada ainda.</p>';
      for (const t of tokens) {
        const item = document.createElement('div');
        item.className = 'crb-token';
        item.innerHTML = `<div><span style="color:${corOrigem(t.origem)}">●</span> ${esc(t.nome)}
          <small>${esc((ORIGENS[t.origem] || ORIGENS.outra).nome)} · ${t.ultimo_uso_em ? `último uso ${dataBr(t.ultimo_uso_em)}` : 'nunca usada'}</small></div>
          <button class="crb-btn perigo">Desconectar</button>`;
        item.querySelector('button').addEventListener('click', async () => {
          if (!confirm(`Desconectar "${t.nome}"? Essa IA perde o acesso ao cérebro na hora (as memórias que ela salvou continuam).`)) return;
          try { await api(`/api/cerebro/tokens/${t.id}`, { method: 'DELETE' }); painelConectar(); carregarDados().catch(() => {}); } catch (err) { alert(err.message); }
        });
        lista.appendChild(item);
      }
    } catch (err) {
      lista.innerHTML = `<p>Erro: ${esc(err.message)}</p>`;
    }
  }

  async function recarregar() {
    await carregarDados();
    aplicarFiltros();
    if (grafo) { grafo.nodeVal(tamanhoNo); atualizarCores(); }
  }

  // ---------- entrada (chamado pelo app.js) ----------

  let iniciado = false;
  window.cerebroAbrir = async (container, tokenApp) => {
    token = tokenApp;
    if (!iniciado || raiz !== container) {
      iniciado = true;
      raiz = container;
      injetarEstilo();
      montar();
      painelInicial();
      try {
        await carregarDados();
        painelInicial();
        agendarAtualizacao();
        await montarGrafo();
        aplicarFiltros();
        // garantia caso o layout demore a "assentar" (onEngineStop so dispara no fim)
        setTimeout(enquadrar, 5000);
      } catch (err) {
        el.vazio.hidden = false;
        el.vazio.textContent = `Erro carregando o cérebro: ${err.message}`;
      }
      return;
    }
    // reabrindo a aba: retoma a animacao e atualiza com o que as IAs salvaram nesse meio tempo
    if (grafo) grafo.resumeAnimation();
    agendarAtualizacao();
    recarregar().then(() => { if (!selecionado && !destaque) painelInicial(); }).catch(() => {});
  };
  window.cerebroPausar = () => { if (grafo) grafo.pauseAnimation(); };
})();
