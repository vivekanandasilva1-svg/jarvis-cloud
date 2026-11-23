// Rolagem do app:
// 1) quadros (CRM, Indicacoes, Resgate, Funil Follow Up...) sao redesenhados a cada atualizacao e cada coluna nascia de novo no topo:
//    aqui a rolagem de cada coluna (e a lateral do quadro) e lembrada e devolvida depois do redesenho;
// 2) qualquer lista que volte ao topo SOZINHA (sem o usuario ter rolado/clicado) volta para onde estava;
// 3) setinha para voltar ao topo (pagina e colunas/listas);
// 4) barras de botoes que rolam de lado no celular/tablet: avisa com uma sombra enquanto ha mais botoes escondidos.
(() => {
  const BARRAS_H = '.crm-board-nav, .res-filtros, .res-modos, .res-rel-filtros, .ind-subnav, .ind-filtros, .cv-filtros, .aniv-nav, .ct-barra, .ct-acoes, .disp-botoes, .fui-topo';
  let ultimaAcaoUsuario = 0;
  let liberarTopoAte = 0; // quando o proprio botao "voltar ao topo" sobe, nao desfazer
  for (const ev of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'mousedown', 'keydown']) {
    document.addEventListener(ev, () => { ultimaAcaoUsuario = Date.now(); }, { capture: true, passive: true });
  }
  const acaoRecente = () => Date.now() - ultimaAcaoUsuario < 700 || Date.now() < liberarTopoAte;
  const raiz = () => document.scrollingElement || document.documentElement;
  const elDe = (t) => (t === document || t === window ? raiz() : t instanceof Element ? t : null);

  // ---------- 1) memoria da rolagem dos quadros ----------
  const memoria = new WeakMap(); // quadro -> { x, cols: {indice: scrollTop} }
  const memDe = (quadro) => { let m = memoria.get(quadro); if (!m) { m = { x: 0, cols: {} }; memoria.set(quadro, m); } return m; };
  document.addEventListener('scroll', (e) => {
    const t = elDe(e.target);
    if (!t || t === raiz()) return;
    const quadro = t.classList.contains('crm-board') ? t : t.closest('.crm-board');
    if (!quadro) return;
    const m = memDe(quadro);
    if (t === quadro) m.x = quadro.scrollLeft;
    else if (t.classList.contains('crm-coluna-cards')) {
      const col = t.parentElement;
      const i = [...quadro.children].indexOf(col);
      if (i >= 0) m.cols[i] = t.scrollTop;
    }
  }, true);
  const restaurarQuadro = (quadro) => {
    const m = memoria.get(quadro);
    if (!m) return;
    if (m.x && quadro.scrollLeft !== m.x) quadro.scrollLeft = m.x;
    [...quadro.children].forEach((col, i) => {
      const lista = col.querySelector?.('.crm-coluna-cards');
      const alvo = m.cols[i];
      if (lista && alvo && lista.scrollTop !== alvo) { lista.scrollTop = alvo; ultimoTopo.set(lista, lista.scrollTop); }
    });
  };
  new MutationObserver((muts) => {
    const quadros = new Set();
    for (const mu of muts) if (mu.type === 'childList' && mu.target.classList?.contains('crm-board') && mu.addedNodes.length) quadros.add(mu.target);
    quadros.forEach(restaurarQuadro);
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- 2) lista que volta ao topo sozinha ----------
  const ultimoTopo = new WeakMap();
  document.addEventListener('scroll', (e) => {
    const el = elDe(e.target);
    if (!el) return;
    const atual = el.scrollTop;
    const antes = ultimoTopo.get(el) || 0;
    if (antes > 120 && atual === 0 && !acaoRecente() && el.isConnected) { el.scrollTop = antes; return; } // foi sozinha: desfaz
    ultimoTopo.set(el, atual);
  }, true);

  // ---------- 3) setinha para voltar ao topo ----------
  const criarBotao = (classe, titulo) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = classe; b.title = titulo; b.setAttribute('aria-label', titulo); b.textContent = '↑'; b.hidden = true;
    document.body.appendChild(b);
    return b;
  };
  const btnPagina = criarBotao('voltar-topo', 'Voltar ao topo');
  const btnLista = criarBotao('voltar-topo voltar-topo-lista', 'Voltar ao topo desta lista');
  let alvoPagina = null, alvoLista = null;
  const ehPagina = (el) => el === raiz() || el.matches('.tab-crm, .window-body, .app-main, main') || el.clientHeight >= innerHeight * 0.5;
  const ehLista = (el) => el.classList.contains('crm-coluna-cards') || !ehPagina(el);

  function posicionarLista() {
    if (!alvoLista || !alvoLista.isConnected || alvoLista.scrollTop < 160) { btnLista.hidden = true; return; }
    const r = alvoLista.getBoundingClientRect();
    if (r.bottom < 40 || r.top > innerHeight - 40) { btnLista.hidden = true; return; }
    btnLista.hidden = false;
    btnLista.style.left = `${Math.max(8, Math.min(innerWidth - 40, r.right - 38))}px`;
    btnLista.style.top = `${Math.max(8, Math.min(innerHeight - 40, r.bottom - 38))}px`;
  }
  function posicionarPagina() {
    if (!alvoPagina || !alvoPagina.isConnected || alvoPagina.scrollTop < 320) { btnPagina.hidden = true; return; }
    btnPagina.hidden = false;
  }
  document.addEventListener('scroll', (e) => {
    const el = elDe(e.target);
    if (!el) return;
    if (el === raiz() || !ehLista(el)) { if (el.scrollHeight > el.clientHeight + 200) alvoPagina = el; posicionarPagina(); }
    else if (el.scrollHeight > el.clientHeight + 40) { alvoLista = el; posicionarLista(); }
  }, true);
  addEventListener('resize', () => { posicionarLista(); posicionarPagina(); });
  const subir = (el) => { liberarTopoAte = Date.now() + 1500; el.scrollTo({ top: 0, behavior: 'smooth' }); };
  btnPagina.addEventListener('click', () => { if (alvoPagina) subir(alvoPagina); });
  btnLista.addEventListener('click', () => { if (alvoLista) subir(alvoLista); });

  // ---------- 4) barras que rolam de lado (celular/tablet): sombra enquanto ha botoes escondidos ----------
  let pendente = false;
  function atualizarBarras() {
    pendente = false;
    document.querySelectorAll(BARRAS_H).forEach((el) => {
      const sobra = el.scrollWidth - el.clientWidth;
      el.classList.toggle('rolagem-h-tem-mais', sobra > 6 && el.scrollLeft < sobra - 6);
      el.classList.toggle('rolagem-h-tem-antes', sobra > 6 && el.scrollLeft > 6);
    });
  }
  const agendar = () => { if (!pendente) { pendente = true; requestAnimationFrame(atualizarBarras); } };
  document.addEventListener('scroll', (e) => { if (e.target instanceof Element && e.target.matches?.(BARRAS_H)) agendar(); }, true);
  addEventListener('resize', agendar);
  new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
  agendar();
})();
