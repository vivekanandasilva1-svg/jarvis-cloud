// Aba "Cerebro" (memoria compartilhada entre as IAs - ver src/cerebro.js). Arquivo separado do
// app.js de proposito: so e baixado na primeira vez que a aba e aberta (app.js -> abrirCerebro),
// e a biblioteca do grafo 3D (que embute o three.js, ~1MB) so vem depois disso, do CDN. Quem
// nunca abre a aba nao baixa nada disso.
(() => {
  const LIB_GRAFO = 'https://cdn.jsdelivr.net/npm/3d-force-graph@1.77.0/dist/3d-force-graph.min.js';

  const ORIGENS = {
    claude: { nome: 'Claude', cor: '#e8834a' },
    chatgpt: { nome: 'ChatGPT', cor: '#19c37d' },
    cursor: { nome: 'Cursor', cor: '#4f8cff' },
    gemini: { nome: 'Gemini', cor: '#a78bfa' },
    lumia: { nome: 'Lumia', cor: '#f5d576' },
    manual: { nome: 'Manual', cor: '#c9ccd1' },
    outra: { nome: 'Outra', cor: '#e45bbf' },
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
        overflow: hidden; background: radial-gradient(ellipse at center, #15122a 0%, #07060d 70%); }
      /* o 3D desenha num div PROPRIO: a biblioteca apaga tudo que estiver dentro do container dela,
         e levava junto a mensagem de "cerebro vazio" que fica por cima */
      .crb-grafo-tela { position: absolute; inset: 0; }
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
        <div class="crb-grafo"><div class="crb-grafo-tela" data-r="grafo"></div><div class="crb-grafo-vazio" data-r="vazio">Carregando o cérebro...</div></div>
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
    el.formBusca.addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
    el.busca.addEventListener('input', () => { if (!el.busca.value.trim() && destaque) { destaque = null; atualizarCores(); painelInicial(); } });
    el.projeto.addEventListener('change', () => { filtroProjeto = el.projeto.value; aplicarFiltros(); });
    el.btnNova.addEventListener('click', () => painelNova());
    el.btnConectar.addEventListener('click', () => painelConectar());
  }

  function carregarLib() {
    if (window.ForceGraph3D) return Promise.resolve();
    if (!libCarregando) {
      libCarregando = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIB_GRAFO;
        s.onload = resolve;
        s.onerror = () => { libCarregando = null; reject(new Error('não consegui baixar o visualizador 3D')); };
        document.head.appendChild(s);
      });
    }
    return libCarregando;
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
    if (!nos.length) el.vazio.textContent = dados.nos.length ? 'Nenhuma memória com esses filtros.' : 'O cérebro ainda está vazio. Conecte uma IA em "Conectar IAs" (ela vai salvando sozinha o que for importante) ou crie a primeira memória em "+ Memória".';
  }

  function corNo(n) {
    if (destaque && !destaque.has(n.id)) return 'rgba(120,120,140,0.18)';
    if (selecionado === n.id) return '#ffffff';
    return corOrigem(n.origem);
  }

  function atualizarCores() {
    if (!grafo) return;
    grafo.nodeColor(corNo).linkColor((l) => (destaque ? 'rgba(160,140,255,0.05)' : 'rgba(150,140,255,0.22)'));
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
    }
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

  function criarGrafo() {
    const largura = () => el.grafo.clientWidth;
    const altura = () => el.grafo.clientHeight;
    grafo = window.ForceGraph3D({ controlType: 'orbit' })(el.grafo)
      .backgroundColor('rgba(0,0,0,0)')
      .showNavInfo(false)
      .width(largura()).height(altura())
      .nodeId('id')
      .nodeVal((n) => 1.5 + Math.min(n.grau || 0, 12) * 0.6)
      .nodeRelSize(4.5)
      .nodeResolution(10)
      .nodeOpacity(0.92)
      .nodeLabel((n) => `<div class="crb-tooltip"><b>${esc(n.titulo || TIPOS[n.tipo] || 'Memória')}</b><br>${esc(n.resumo)}</div>`)
      .linkWidth(0)
      .linkOpacity(0.6)
      .linkDirectionalParticles((l) => (l.peso >= 0.85 ? 1 : 0))
      .linkDirectionalParticleWidth(1.2)
      .linkDirectionalParticleSpeed(0.004)
      .cooldownTicks(180)
      .warmupTicks(40)
      .onNodeClick((n) => selecionar(n.id))
      // enquadra o cerebro inteiro na tela quando o layout assenta (so na primeira vez - depois
      // respeita o zoom/angulo que o usuario escolheu)
      .onEngineStop(() => enquadrar())
      .onBackgroundClick(() => { selecionado = null; atualizarCores(); if (!destaque) painelInicial(); });
    atualizarCores();
    // rotacao lenta automatica (o efeito "cerebro vivo"); para quando o usuario mexe na camera
    const controles = grafo.controls();
    if (controles) {
      controles.autoRotate = true;
      controles.autoRotateSpeed = 0.6;
      controles.addEventListener('start', () => { controles.autoRotate = false; });
    }
    // distanceMax: sem limite, memoria sem ligacao nenhuma era empurrada pra longe pra sempre e
    // ficava perdida fora da tela
    grafo.d3Force('charge').strength(-40).distanceMax(140);
    new ResizeObserver(() => { if (grafo && largura() && altura()) grafo.width(largura()).height(altura()); }).observe(el.grafo);
  }

  // o zoomToFit da biblioteca encaixa so o CENTRO das bolinhas (fica perto demais com poucas
  // memorias) - aqui a distancia sai do tamanho real do cerebro, com folga pras bolinhas
  function enquadrar() {
    if (!grafo || enquadrado || !grafo.graphData().nodes.length) return;
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
      <p>Clique num ponto do cérebro pra ver a memória. Cada cor é a IA que salvou, e as linhas ligam memórias sobre o mesmo assunto.</p>`;
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
        if (!webglOk()) {
          el.vazio.textContent = 'Este aparelho não suporta o cérebro 3D. A busca e a lista ao lado funcionam normalmente.';
          return;
        }
        await carregarLib();
        criarGrafo();
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
    recarregar().catch(() => {});
  };
  window.cerebroPausar = () => { if (grafo) grafo.pauseAnimation(); };
})();
