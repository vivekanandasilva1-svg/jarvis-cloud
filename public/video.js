// Editor de Video (ver src/videoEditor.js e video-worker/). Abre em TELA CHEIA por cima do app
// inteiro: projetos e midias a esquerda, player no centro, "Voce pede" / "A IA edita" a direita e
// a linha do tempo com as camadas da edicao embaixo. Arquivo separado do app.js de proposito: so e
// baixado na primeira vez que a aba e aberta (app.js -> abrirVideo).
(() => {
  const ESTILOS = {
    criador: { nome: 'Criador', desc: 'Legenda branca forte, destaque amarelo', cores: ['#FFFFFF', '#FFE14D'], fonte: 'Montserrat' },
    neon: { nome: 'Neon', desc: 'Roxo e rosa com brilho', cores: ['#C77DFF', '#FF5FD2'], fonte: 'Poppins' },
    clinica: { nome: 'Clínica', desc: 'Limpo e acolhedor', cores: ['#5EEAD4', '#0F2A33'], fonte: 'Inter' },
    impacto: { nome: 'Impacto', desc: 'Condensada, vermelho, agressivo', cores: ['#FF3B3B', '#FFFFFF'], fonte: 'Anton' },
    documentario: { nome: 'Documentário', desc: 'Serifado, quente, grão de filme', cores: ['#E9B872', '#5A4632'], fonte: 'Playfair' },
  };
  const FORMATOS = { '9:16': 'Reels / TikTok', '4:5': 'Feed', '1:1': 'Quadrado', '16:9': 'YouTube' };
  const ETAPAS = {
    rascunho: 'Rascunho', na_fila: 'Na fila', preparando: 'Preparando o vídeo e tratando o áudio',
    transcrevendo: 'Ouvindo cada palavra', estudando_referencia: 'Estudando o vídeo referência',
    preparando_midias: 'Preparando as mídias de apoio', dirigindo: 'IA montando a edição', revisando: 'IA revisando a qualidade',
    renderizando: 'Renderizando', finalizando: 'Finalizando', pronto: 'Pronto', erro: 'Erro', expirado: 'Expirado',
  };
  const ORDEM = ['na_fila', 'preparando', 'transcrevendo', 'estudando_referencia', 'preparando_midias', 'dirigindo', 'revisando', 'renderizando', 'finalizando', 'pronto'];
  const EM_ANDAMENTO = (s) => s === 'na_fila' || s === 'processando';

  let raiz = null;
  let token = '';
  let montado = false;
  let projetos = [];
  let atual = null; // projeto aberto (detalhe completo)
  let linha = null; // dados da linha do tempo do projeto aberto
  let timerPolling = null;
  let pxPorSeg = 0; // 0 = ajustar a largura
  let rafPlayhead = null;
  let abaLateral = 'midias';
  const enviosAtivos = new Map(); // tipo -> progresso 0..1
  const el = {};

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tempo = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
  const url = (caminho, extra = '') => `/api/video/edicoes/${atual?.id}/${caminho}?senha=${encodeURIComponent(token)}${extra}`;
  const urlDe = (id, caminho) => `/api/video/edicoes/${id}/${caminho}?senha=${encodeURIComponent(token)}`;

  async function api(caminho, opcoes = {}) {
    const res = await fetch(caminho, { ...opcoes, headers: { 'Content-Type': 'application/json', 'x-app-password': token, ...(opcoes.headers || {}) } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `erro ${res.status}`);
    return d;
  }

  function aviso(texto, tipo = 'ok') {
    const n = document.createElement('div');
    n.className = `ve-aviso ${tipo}`;
    n.textContent = texto;
    raiz.appendChild(n);
    setTimeout(() => n.remove(), 4200);
  }

  // ---------- estilo ----------
  function injetarEstilo() {
    if (document.getElementById('videoEstilo2')) return;
    const st = document.createElement('style');
    st.id = 'videoEstilo2';
    st.textContent = `
      .video-aba { position: fixed !important; inset: 0; z-index: 3000; display: block !important; padding: 0 !important; margin: 0 !important;
        max-width: none !important; border-radius: 0 !important; background: #0b0a10; overflow: hidden; }
      .video-aba[hidden] { display: none !important; }
      .ve-app { position: absolute; inset: 0; display: grid; grid-template-columns: 290px minmax(0, 1fr) 360px; grid-template-rows: 54px minmax(0, 1fr) 236px;
        grid-template-areas: "topo topo topo" "esq palco dir" "tempo tempo tempo"; color: #ece9f5; font-family: inherit;
        background: radial-gradient(ellipse at 50% 0%, #1d1530 0%, #0b0a10 60%); }
      .ve-app * { box-sizing: border-box; }
      .ve-topo { grid-area: topo; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid rgba(167,139,250,.14); background: rgba(11,10,16,.7); }
      .ve-marca { font-weight: 800; font-size: 15px; letter-spacing: .3px; display: flex; align-items: center; gap: 8px; }
      .ve-marca i { width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg, #8b5cf6, #ec4899); display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 13px; }
      .ve-nome { flex: 1; min-width: 0; font-size: 13px; color: #a8a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ve-nome b { color: #ece9f5; font-weight: 600; }
      .ve-chip { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: rgba(139,92,246,.16); color: #c4b5fd; white-space: nowrap; }
      .ve-chip.pronto { background: rgba(34,197,94,.14); color: #86efac; } .ve-chip.erro { background: rgba(239,68,68,.14); color: #fca5a5; }
      .ve-btn { background: rgba(139,92,246,.18); border: 1px solid rgba(167,139,250,.35); color: #ddd6fe; border-radius: 9px; padding: 7px 13px;
        font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
      .ve-btn:hover:not(:disabled) { background: rgba(139,92,246,.3); }
      .ve-btn:disabled { opacity: .4; cursor: default; }
      .ve-btn.forte { background: linear-gradient(135deg, #7c3aed, #db2777); border-color: transparent; color: #fff; }
      .ve-btn.sec { background: transparent; border-color: rgba(255,255,255,.12); color: #a8a3b8; font-weight: 600; }
      .ve-btn.perigo { background: transparent; border-color: rgba(239,68,68,.35); color: #fca5a5; font-weight: 600; }
      .ve-col { min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .ve-esq { grid-area: esq; border-right: 1px solid rgba(167,139,250,.1); }
      .ve-dir { grid-area: dir; border-left: 1px solid rgba(167,139,250,.1); }
      .ve-palco { grid-area: palco; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 14px; position: relative; }
      .ve-tela { position: relative; height: 100%; max-width: 100%; aspect-ratio: 9 / 16; border-radius: 14px; overflow: hidden; background: #000;
        box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(167,139,250,.18); display: flex; align-items: center; justify-content: center; }
      .ve-tela video, .ve-tela img { width: 100%; height: 100%; object-fit: contain; background: #000; }
      .ve-tela-vazia { color: #6f6a80; font-size: 13px; text-align: center; padding: 24px; line-height: 1.6; }
      .ve-processando { position: absolute; inset: 0; background: rgba(11,10,16,.72); backdrop-filter: blur(3px); display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
      .ve-anel { width: 74px; height: 74px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
      .ve-processando small { color: #a8a3b8; font-size: 12px; max-width: 240px; line-height: 1.5; }
      .ve-alterna { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: rgba(11,10,16,.8);
        border: 1px solid rgba(167,139,250,.2); border-radius: 999px; padding: 3px; z-index: 2; }
      .ve-alterna button { background: none; border: none; color: #a8a3b8; font-size: 11.5px; font-weight: 700; padding: 5px 12px; border-radius: 999px; cursor: pointer; font-family: inherit; }
      .ve-alterna button.ativo { background: rgba(139,92,246,.35); color: #fff; }
      .ve-card { border: 1px solid rgba(167,139,250,.14); border-radius: 14px; padding: 13px; background: rgba(22,18,34,.75); display: flex; flex-direction: column; gap: 10px; }
      .ve-rot { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #8b84a0; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ve-abas { display: flex; gap: 4px; background: rgba(255,255,255,.03); border-radius: 10px; padding: 3px; }
      .ve-abas button { flex: 1; background: none; border: none; color: #8b84a0; font-size: 12px; font-weight: 700; padding: 7px; border-radius: 8px; cursor: pointer; font-family: inherit; }
      .ve-abas button.ativo { background: rgba(139,92,246,.22); color: #ede9fe; }
      .ve-drop { border: 1.5px dashed rgba(167,139,250,.35); border-radius: 12px; padding: 14px 10px; text-align: center; cursor: pointer; color: #8b84a0;
        font-size: 12px; line-height: 1.5; transition: background .15s, border-color .15s; }
      .ve-drop:hover, .ve-drop.arrastando { background: rgba(139,92,246,.08); border-color: #a78bfa; }
      .ve-drop b { color: #ece9f5; display: block; font-size: 12.5px; }
      .ve-arquivo { display: flex; gap: 10px; align-items: center; border: 1px solid rgba(167,139,250,.16); border-radius: 12px; padding: 8px; background: rgba(255,255,255,.02); }
      .ve-arquivo .min { width: 46px; height: 62px; border-radius: 8px; background: #000 center / cover no-repeat; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .ve-arquivo .info { min-width: 0; flex: 1; font-size: 12px; }
      .ve-arquivo .info b { display: block; color: #ece9f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
      .ve-arquivo .info span { color: #8b84a0; font-size: 11px; }
      .ve-x { background: none; border: none; color: #8b84a0; cursor: pointer; font-size: 16px; padding: 4px; }
      .ve-x:hover { color: #fca5a5; }
      .ve-grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .ve-midia { position: relative; aspect-ratio: 1; border-radius: 9px; background: #120f1c center / cover no-repeat; border: 1px solid rgba(167,139,250,.16);
        display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; }
      .ve-midia small { position: absolute; left: 4px; bottom: 3px; font-size: 9.5px; background: rgba(0,0,0,.65); padding: 1px 5px; border-radius: 4px; color: #ddd; }
      .ve-midia .ve-x { position: absolute; top: 0; right: 0; background: rgba(0,0,0,.55); border-radius: 0 0 0 8px; font-size: 12px; padding: 2px 6px; }
      .ve-midia.add { border-style: dashed; color: #a78bfa; cursor: pointer; font-size: 24px; }
      .ve-barra { height: 4px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; }
      .ve-barra > div { height: 100%; background: linear-gradient(90deg, #8b5cf6, #ec4899); transition: width .3s; }
      .ve-dica { font-size: 11.5px; color: #8b84a0; line-height: 1.5; }
      .ve-proj { display: flex; gap: 9px; align-items: center; border: 1px solid rgba(167,139,250,.12); border-radius: 12px; padding: 7px; cursor: pointer; background: rgba(255,255,255,.02); }
      .ve-proj.ativo { border-color: #a78bfa; background: rgba(139,92,246,.12); }
      .ve-proj .min { width: 38px; height: 52px; border-radius: 7px; background: #120f1c center / cover no-repeat; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #6f6a80; }
      .ve-proj .info { min-width: 0; flex: 1; }
      .ve-proj .info b { display: block; font-size: 12.5px; color: #ece9f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
      .ve-proj .info span { font-size: 11px; color: #8b84a0; }
      .ve-pede { display: flex; gap: 8px; align-items: flex-end; }
      .ve-pede textarea { flex: 1; min-height: 70px; max-height: 180px; resize: vertical; background: transparent; border: none; color: #ece9f5; font-size: 14px;
        font-family: inherit; line-height: 1.45; outline: none; padding: 0; }
      .ve-pede textarea::placeholder { color: #6f6a80; }
      .ve-pede .ref { width: 40px; height: 54px; border-radius: 7px; background: #120f1c center / cover no-repeat; flex-shrink: 0; border: 1px solid rgba(167,139,250,.3); }
      .ve-enviar { width: 36px; height: 36px; border-radius: 50%; border: none; background: linear-gradient(135deg, #7c3aed, #db2777); color: #fff; font-size: 17px; cursor: pointer; flex-shrink: 0; }
      .ve-enviar:disabled { opacity: .4; cursor: default; }
      .ve-checks { display: flex; flex-direction: column; gap: 9px; }
      .ve-check { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; color: #6f6a80; }
      .ve-check i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #4b4560; flex-shrink: 0; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; }
      .ve-check.fazendo { color: #ddd6fe; } .ve-check.fazendo i { border-color: #a78bfa; border-top-color: transparent; animation: veGira .8s linear infinite; }
      .ve-check.feito { color: #ece9f5; } .ve-check.feito i { background: #8b5cf6; border-color: #8b5cf6; color: #fff; }
      .ve-check small { display: block; color: #8b84a0; font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
      @keyframes veGira { to { transform: rotate(360deg); } }
      .ve-opcoes { display: flex; flex-wrap: wrap; gap: 5px; }
      .ve-op { font-size: 11.5px; padding: 5px 9px; border-radius: 999px; border: 1px solid rgba(167,139,250,.18); color: #c9c4d8; cursor: pointer; background: rgba(255,255,255,.02); display: inline-flex; gap: 5px; align-items: center; }
      .ve-op i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .ve-op.ativo { border-color: #a78bfa; background: rgba(139,92,246,.2); color: #fff; }
      .ve-linha-op { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #c9c4d8; cursor: pointer; }
      .ve-linha-op input[type=color] { width: 26px; height: 20px; border: none; background: none; padding: 0; cursor: pointer; }
      .ve-texto { font-size: 12.5px; color: #c9c4d8; line-height: 1.55; }
      .ve-ajuste { border-left: 2px solid #8b5cf6; padding: 2px 0 2px 9px; font-size: 12px; }
      .ve-ajuste b { display: block; color: #ece9f5; font-weight: 600; } .ve-ajuste span { color: #8b84a0; }
      /* linha do tempo */
      .ve-tempo { grid-area: tempo; border-top: 1px solid rgba(167,139,250,.16); background: rgba(13,11,20,.92); display: flex; flex-direction: column; min-height: 0; }
      .ve-tempo-barra { display: flex; align-items: center; gap: 10px; padding: 6px 12px; font-size: 11.5px; color: #8b84a0; border-bottom: 1px solid rgba(167,139,250,.08); }
      .ve-tempo-barra b { color: #ece9f5; font-variant-numeric: tabular-nums; }
      .ve-zoom { margin-left: auto; display: flex; gap: 4px; }
      .ve-zoom button { width: 24px; height: 22px; border-radius: 6px; border: 1px solid rgba(167,139,250,.2); background: none; color: #c4b5fd; cursor: pointer; font-weight: 700; }
      .ve-tempo-corpo { flex: 1; min-height: 0; display: flex; }
      .ve-trilhas-rot { width: 74px; flex-shrink: 0; padding-top: 22px; }
      .ve-trilhas-rot div { height: 31px; display: flex; align-items: center; font-size: 9.5px; letter-spacing: 1.3px; color: #6f6a80; font-weight: 800; padding-left: 12px; }
      .ve-trilhas { flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; position: relative; }
      .ve-trilhas-in { position: relative; height: 100%; min-width: 100%; cursor: pointer; }
      .ve-regua { height: 22px; position: relative; border-bottom: 1px solid rgba(255,255,255,.05); }
      .ve-regua span { position: absolute; top: 4px; font-size: 9.5px; color: #6f6a80; transform: translateX(-50%); font-variant-numeric: tabular-nums; }
      .ve-trilha { height: 31px; position: relative; border-bottom: 1px solid rgba(255,255,255,.035); }
      .ve-bloco { position: absolute; top: 4px; height: 23px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #fff; padding: 0 6px; display: flex;
        align-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; letter-spacing: .3px; }
      .ve-bloco.leg { background: #7c3aed; opacity: .85; border-radius: 4px; padding: 0; }
      .ve-bloco.txt { background: linear-gradient(135deg, #8b5cf6, #a855f7); text-transform: uppercase; }
      .ve-bloco.num { background: linear-gradient(135deg, #db2777, #f472b6); }
      .ve-bloco.lst { background: linear-gradient(135deg, #0891b2, #22d3ee); color: #04222a; }
      .ve-bloco.ins { background: #1e1830 center / cover no-repeat; border: 1px solid #f59e0b; color: #fde68a; text-shadow: 0 1px 3px #000; }
      .ve-bloco.mus { background: rgba(34,197,94,.22); border: 1px solid rgba(34,197,94,.5); color: #86efac; }
      .ve-video-faixa { position: absolute; top: 3px; bottom: 3px; left: 0; right: 0; border-radius: 6px; background-size: 100% 100%; background-repeat: no-repeat; opacity: .9; }
      .ve-corte { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(11,10,16,.9); }
      .ve-marca-fx { position: absolute; top: 9px; width: 12px; height: 12px; transform: translateX(-6px) rotate(45deg); background: #facc15; border-radius: 2px; }
      .ve-marca-fx.lento { background: #60a5fa; }
      .ve-marca-fx.tr { background: #fff; transform: translateX(-2px); width: 4px; height: 23px; top: 4px; border-radius: 2px; }
      .ve-onda { position: absolute; inset: 2px 0; width: 100%; height: 27px; }
      .ve-cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 8px rgba(255,255,255,.6); pointer-events: none; z-index: 3; }
      .ve-cursor::before { content: ''; position: absolute; top: 0; left: -5px; border: 6px solid transparent; border-top-color: #fff; }
      .ve-tempo-vazio { flex: 1; display: flex; align-items: center; justify-content: center; color: #6f6a80; font-size: 12.5px; text-align: center; padding: 16px; }
      .ve-aviso { position: absolute; left: 50%; bottom: 250px; transform: translateX(-50%); z-index: 10; padding: 10px 16px; border-radius: 10px; font-size: 13px;
        background: #1f2937; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: veSobe .25s ease-out; max-width: 90%; }
      .ve-aviso.erro { background: #7f1d1d; }
      @keyframes veSobe { from { opacity: 0; transform: translate(-50%, 8px); } }
      @media (max-width: 1100px) { .ve-app { grid-template-columns: 250px minmax(0, 1fr) 310px; } }
      @media (max-width: 860px) {
        .video-aba { overflow-y: auto; }
        .ve-app { position: relative; inset: auto; min-height: 100%; display: flex; flex-direction: column; }
        .ve-topo { position: sticky; top: 0; z-index: 5; min-height: 54px; flex-wrap: wrap; padding: 8px 12px; }
        .ve-palco { order: 1; height: 62vh; }
        .ve-dir { order: 2; border: none; overflow: visible; }
        .ve-tempo { order: 3; height: 236px; flex-shrink: 0; }
        .ve-esq { order: 4; border: none; overflow: visible; }
        .ve-nome { display: none; }
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- estrutura ----------
  function montar() {
    raiz.innerHTML = `
      <div class="ve-app">
        <div class="ve-topo">
          <button class="ve-btn sec" type="button" data-r="fechar" title="Voltar ao app">← Voltar</button>
          <span class="ve-marca"><i>▶</i>Editor de Vídeo IA</span>
          <span class="ve-nome" data-r="nome"></span>
          <span class="ve-chip" data-r="chip" hidden></span>
          <a class="ve-btn" data-r="baixar" hidden download>⬇ Baixar MP4</a>
          <button class="ve-btn forte" type="button" data-r="novo">+ Novo projeto</button>
        </div>
        <div class="ve-col ve-esq">
          <div class="ve-abas"><button type="button" data-aba="midias">Mídias</button><button type="button" data-aba="projetos">Projetos</button></div>
          <div data-r="painelEsq"></div>
        </div>
        <div class="ve-palco" data-r="palco"></div>
        <div class="ve-col ve-dir" data-r="dir"></div>
        <div class="ve-tempo" data-r="tempo"></div>
      </div>`;
    raiz.querySelectorAll('[data-r]').forEach((n) => { el[n.dataset.r] = n; });
    el.fechar.addEventListener('click', () => window.lumiaFecharVideo?.());
    el.novo.addEventListener('click', novoProjeto);
    raiz.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { abaLateral = b.dataset.aba; renderEsquerda(); }));
    document.addEventListener('keydown', (e) => {
      if (raiz.hidden || e.target.closest('textarea, input')) return;
      if (e.code === 'Space' && el.player) { e.preventDefault(); el.player.paused ? el.player.play() : el.player.pause(); }
    });
  }

  // ---------- projetos ----------
  async function carregarProjetos() {
    try {
      projetos = (await api('/api/video/edicoes')).edicoes || [];
    } catch (err) {
      projetos = [];
      aviso(err.message, 'erro');
    }
  }

  async function abrirProjeto(id, { silencioso = false } = {}) {
    try {
      const anterior = atual;
      atual = await api(`/api/video/edicoes/${id}`);
      const mudouProjeto = anterior?.id !== atual.id;
      const ficouPronto = atual.status === 'pronto' && (mudouProjeto || anterior?.status !== 'pronto' || (anterior?.ajustes || []).length !== (atual.ajustes || []).length);
      if (mudouProjeto) linha = null;
      if (mudouProjeto || ficouPronto) modoTela = 'editado';
      if (ficouPronto) {
        linha = await api(`/api/video/edicoes/${id}/linha-do-tempo`).catch(() => null);
      } else if (atual.status !== 'pronto') {
        linha = mudouProjeto ? null : linha;
      }
      renderTudo({ recriarPlayer: mudouProjeto || ficouPronto || !silencioso });
    } catch (err) {
      aviso(err.message, 'erro');
    }
    agendarPolling();
  }

  async function novoProjeto() {
    try {
      const p = await api('/api/video/edicoes', { method: 'POST', body: JSON.stringify({ nome: 'Novo projeto', opcoes: atual?.opcoes ? { estilo: atual.opcoes.estilo, formato: atual.opcoes.formato } : {} }) });
      await carregarProjetos();
      abaLateral = 'midias';
      await abrirProjeto(p.id);
      aviso('Projeto criado. Envie o vídeo que será editado.');
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  async function apagarProjeto() {
    if (!atual || !confirm(`Apagar o projeto "${atual.titulo || atual.nomeArquivo}"? Os vídeos e mídias serão excluídos.`)) return;
    try {
      await api(`/api/video/edicoes/${atual.id}`, { method: 'DELETE' });
      atual = null;
      linha = null;
      await carregarProjetos();
      if (projetos[0]) await abrirProjeto(projetos[0].id); else renderTudo({ recriarPlayer: true });
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  function agendarPolling() {
    clearTimeout(timerPolling);
    if (raiz?.hidden || !atual || !EM_ANDAMENTO(atual.status)) return;
    timerPolling = setTimeout(async () => {
      await abrirProjeto(atual.id, { silencioso: true });
      if (!EM_ANDAMENTO(atual.status)) { await carregarProjetos(); renderEsquerda(); }
    }, 3000);
  }

  // ---------- render geral ----------
  function renderTudo({ recriarPlayer = false } = {}) {
    renderTopo();
    renderEsquerda();
    renderPalco(recriarPlayer);
    renderDireita();
    renderLinhaDoTempo();
  }

  function renderTopo() {
    el.nome.innerHTML = atual ? `<b>${esc(atual.titulo || atual.nomeArquivo || 'Projeto')}</b>${atual.duracaoFinal ? ` · ${tempo(atual.duracaoFinal)}` : ''}` : '';
    const chip = el.chip;
    if (!atual) { chip.hidden = true; el.baixar.hidden = true; return; }
    chip.hidden = false;
    chip.className = `ve-chip ${atual.status}`;
    chip.textContent = EM_ANDAMENTO(atual.status) ? `${ETAPAS[atual.etapa] || 'Processando'}${atual.progresso ? ` · ${Math.round(atual.progresso * 100)}%` : ''}` : (ETAPAS[atual.status] || atual.status);
    el.baixar.hidden = atual.status !== 'pronto';
    if (atual.status === 'pronto') el.baixar.href = url('video', '&baixar=1');
  }

  // ---------- coluna esquerda: midias / projetos ----------
  function renderEsquerda() {
    raiz.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === abaLateral));
    const p = el.painelEsq;
    if (abaLateral === 'projetos') {
      p.innerHTML = projetos.length ? '' : '<div class="ve-dica">Nenhum projeto ainda.</div>';
      const lista = document.createElement('div');
      lista.style.cssText = 'display:flex;flex-direction:column;gap:7px';
      for (const pr of projetos) {
        const d = document.createElement('div');
        d.className = `ve-proj${pr.id === atual?.id ? ' ativo' : ''}`;
        const capa = pr.status === 'pronto' ? `style="background-image:url('${urlDe(pr.id, 'capa')}')"` : '';
        d.innerHTML = `<div class="min" ${capa}>${pr.status === 'pronto' ? '' : '▶'}</div>
          <div class="info"><b>${esc(pr.titulo || pr.nomeArquivo || 'Projeto')}</b><span>${esc(ETAPAS[pr.status] || ETAPAS[pr.etapa] || pr.status)}</span></div>`;
        d.addEventListener('click', () => abrirProjeto(pr.id));
        lista.appendChild(d);
      }
      p.appendChild(lista);
      return;
    }
    if (!atual) {
      p.innerHTML = '<div class="ve-card"><div class="ve-dica">Crie um projeto pra começar. Você envia o vídeo, um vídeo de referência (opcional) e imagens, vídeos e áudios pra compor a edição.</div><button class="ve-btn forte" type="button" data-a="novo">+ Novo projeto</button></div>';
      p.querySelector('[data-a=novo]').addEventListener('click', novoProjeto);
      return;
    }
    const bloqueado = EM_ANDAMENTO(atual.status);
    const principal = atual.midias.find((m) => m.tipo === 'principal');
    const referencia = atual.midias.find((m) => m.tipo === 'referencia');
    const apoio = atual.midias.filter((m) => m.tipo === 'apoio');
    p.innerHTML = '';

    p.appendChild(caixaArquivo({
      titulo: 'Vídeo a editar', tipo: 'principal', midia: principal, aceita: 'video/*', bloqueado,
      vazio: '<b>Envie o vídeo bruto</b>MP4 ou MOV, até 10 min e 1 GB',
    }));
    p.appendChild(caixaArquivo({
      titulo: 'Vídeo referência', tipo: 'referencia', midia: referencia, aceita: 'video/*', bloqueado, opcional: true,
      vazio: '<b>Envie um vídeo modelo</b>A IA estuda o ritmo dos cortes, as transições, as fontes e a composição e edita o seu no mesmo estilo',
    }));

    const card = document.createElement('div');
    card.className = 've-card';
    card.innerHTML = `<div class="ve-rot">Mídias para compor <span style="text-transform:none;letter-spacing:0;font-weight:600">${apoio.length}/15</span></div>
      <div class="ve-grade" data-a="grade"></div>
      <div class="ve-dica">Imagens e vídeos entram nos momentos certos da fala. Áudio vira trilha de fundo que abaixa sozinha quando a pessoa fala.</div>`;
    const grade = card.querySelector('[data-a=grade]');
    for (const m of apoio) {
      const d = document.createElement('div');
      d.className = 've-midia';
      const icone = m.kind === 'audio' ? '♪' : '';
      if (m.kind !== 'audio') d.style.backgroundImage = `url('${url(`midias/${m.id}/miniatura`)}')`;
      d.title = m.nome;
      d.innerHTML = `${icone}<small>${m.kind === 'audio' ? 'áudio' : m.kind === 'video' ? `vídeo ${tempo(m.duracao)}` : 'imagem'}</small>${bloqueado ? '' : '<button class="ve-x" type="button" title="Remover">✕</button>'}`;
      d.querySelector('.ve-x')?.addEventListener('click', (e) => { e.stopPropagation(); removerMidia(m); });
      grade.appendChild(d);
    }
    const prog = enviosAtivos.get('apoio');
    if (prog != null) {
      const d = document.createElement('div');
      d.className = 've-midia';
      d.innerHTML = `<small>${Math.round(prog * 100)}%</small>`;
      grade.appendChild(d);
    }
    if (!bloqueado && apoio.length < 15) {
      const add = document.createElement('div');
      add.className = 've-midia add';
      add.textContent = '+';
      add.title = 'Adicionar imagens, vídeos ou áudios';
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true; input.accept = 'image/*,video/*,audio/*'; input.hidden = true;
      add.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => { for (const f of input.files) await enviarArquivo('apoio', f); });
      ligarArrastar(add, async (files) => { for (const f of files) await enviarArquivo('apoio', f); });
      grade.appendChild(add);
      card.appendChild(input);
    }
    p.appendChild(card);

    const fim = document.createElement('div');
    fim.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    fim.innerHTML = '<button class="ve-btn perigo" type="button">Apagar projeto</button>';
    fim.querySelector('button').addEventListener('click', apagarProjeto);
    p.appendChild(fim);
  }

  function caixaArquivo({ titulo, tipo, midia, aceita, bloqueado, vazio, opcional }) {
    const card = document.createElement('div');
    card.className = 've-card';
    card.innerHTML = `<div class="ve-rot">${titulo}${opcional ? '<span style="text-transform:none;letter-spacing:0;font-weight:600">opcional</span>' : ''}</div>`;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = aceita; input.hidden = true;
    input.addEventListener('change', () => input.files[0] && enviarArquivo(tipo, input.files[0]));
    card.appendChild(input);
    const prog = enviosAtivos.get(tipo);
    if (prog != null) {
      card.insertAdjacentHTML('beforeend', `<div class="ve-dica">Enviando... ${Math.round(prog * 100)}%</div><div class="ve-barra"><div style="width:${prog * 100}%"></div></div>`);
      return card;
    }
    if (midia) {
      const d = document.createElement('div');
      d.className = 've-arquivo';
      d.innerHTML = `<div class="min" style="background-image:url('${url(`midias/${midia.id}/miniatura`)}')"></div>
        <div class="info"><b title="${esc(midia.nome)}">${esc(midia.nome)}</b><span>${tempo(midia.duracao)} · ${(midia.tamanho / 1024 / 1024).toFixed(1)} MB</span></div>
        ${bloqueado ? '' : '<button class="ve-x" type="button" title="Trocar">⟳</button>'}${bloqueado || !opcional ? '' : '<button class="ve-x" type="button" data-a="rm" title="Remover">✕</button>'}`;
      d.querySelector('.ve-x')?.addEventListener('click', () => input.click());
      d.querySelector('[data-a=rm]')?.addEventListener('click', () => removerMidia(midia));
      if (!bloqueado) ligarArrastar(d, (files) => enviarArquivo(tipo, files[0]));
      card.appendChild(d);
    } else {
      const drop = document.createElement('div');
      drop.className = 've-drop';
      drop.innerHTML = vazio;
      if (bloqueado) drop.style.opacity = '.5';
      else {
        drop.addEventListener('click', () => input.click());
        ligarArrastar(drop, (files) => enviarArquivo(tipo, files[0]));
      }
      card.appendChild(drop);
    }
    return card;
  }

  function ligarArrastar(alvo, aoSoltar) {
    alvo.addEventListener('dragover', (e) => { e.preventDefault(); alvo.classList.add('arrastando'); });
    alvo.addEventListener('dragleave', () => alvo.classList.remove('arrastando'));
    alvo.addEventListener('drop', (e) => {
      e.preventDefault();
      alvo.classList.remove('arrastando');
      if (e.dataTransfer.files.length) aoSoltar([...e.dataTransfer.files]);
    });
  }

  // XMLHttpRequest (e nao fetch) so pra ter a barra de progresso do envio
  function enviarArquivo(tipo, arquivo) {
    if (!atual || !arquivo) return Promise.resolve();
    if (arquivo.size > 1024 * 1024 * 1024) { aviso('O arquivo passa de 1 GB.', 'erro'); return Promise.resolve(); }
    if (tipo !== 'apoio' && !arquivo.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(arquivo.name)) {
      aviso('Escolha um arquivo de vídeo.', 'erro');
      return Promise.resolve();
    }
    const id = atual.id;
    enviosAtivos.set(tipo, 0);
    renderEsquerda();
    return new Promise((resolve) => {
      const q = new URLSearchParams({ tipo, nome: arquivo.name, mime: arquivo.type || '' });
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/video/edicoes/${id}/midias?${q}`);
      xhr.setRequestHeader('x-app-password', token);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      let ultimo = 0;
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        enviosAtivos.set(tipo, e.loaded / e.total);
        if (Date.now() - ultimo > 400) { ultimo = Date.now(); renderEsquerda(); }
      };
      const fim = async (ok, msg) => {
        enviosAtivos.delete(tipo);
        if (!ok) aviso(msg, 'erro');
        if (atual?.id === id) await abrirProjeto(id);
        if (ok && tipo === 'principal') { await carregarProjetos(); renderEsquerda(); }
        resolve();
      };
      xhr.onload = () => {
        let d = {};
        try { d = JSON.parse(xhr.responseText); } catch { /* vazio */ }
        if (xhr.status >= 200 && xhr.status < 300) fim(true);
        else fim(false, `Não consegui enviar "${arquivo.name}": ${d.erro || xhr.status}`);
      };
      xhr.onerror = () => fim(false, 'A conexão caiu durante o envio. Tente de novo.');
      xhr.send(arquivo);
    });
  }

  async function removerMidia(m) {
    try {
      await api(`/api/video/edicoes/${atual.id}/midias/${m.id}`, { method: 'DELETE' });
      await abrirProjeto(atual.id);
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  // ---------- palco: player ----------
  let modoTela = 'editado';
  function renderPalco(recriar) {
    const palco = el.palco;
    const formato = atual?.opcoes?.formato || atual?.formato || '9:16';
    const [w, h] = formato.split(':').map(Number);
    const principal = atual?.midias?.find((m) => m.tipo === 'principal');
    const temFinal = atual?.status === 'pronto';
    if (!temFinal) modoTela = 'original';
    if (recriar || !palco.querySelector('.ve-tela')) {
      cancelAnimationFrame(rafPlayhead);
      palco.innerHTML = '';
      el.player = null;
      if (temFinal && principal) {
        const alt = document.createElement('div');
        alt.className = 've-alterna';
        alt.innerHTML = '<button type="button" data-m="editado">Editado</button><button type="button" data-m="original">Original</button>';
        alt.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { modoTela = b.dataset.m; renderPalco(true); }));
        alt.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b.dataset.m === modoTela));
        palco.appendChild(alt);
      }
      const tela = document.createElement('div');
      tela.className = 've-tela';
      tela.style.aspectRatio = `${w} / ${h}`;
      if (w > h) { tela.style.height = 'auto'; tela.style.width = '100%'; }
      if (temFinal && modoTela === 'editado') {
        const v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = url('video');
        tela.appendChild(v);
        el.player = v;
        ligarPlayer(v);
      } else if (principal) {
        const v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = url(`midias/${principal.id}/arquivo`);
        v.poster = url(`midias/${principal.id}/miniatura`);
        tela.appendChild(v);
      } else {
        tela.innerHTML = `<div class="ve-tela-vazia">${atual ? 'Envie o vídeo que será editado<br>na coluna da esquerda.' : 'Crie um projeto pra começar.'}</div>`;
      }
      const sobre = document.createElement('div');
      sobre.className = 've-processando';
      sobre.hidden = true;
      tela.appendChild(sobre);
      palco.appendChild(tela);
    }
    const sobre = palco.querySelector('.ve-processando');
    if (sobre) {
      sobre.hidden = !EM_ANDAMENTO(atual?.status);
      if (!sobre.hidden) {
        const pct = Math.round((atual.progresso || 0) * 100);
        sobre.innerHTML = `<div class="ve-anel" style="background:conic-gradient(#a855f7 ${pct * 3.6}deg, rgba(255,255,255,.08) 0)"><div style="width:62px;height:62px;border-radius:50%;background:#14111d;display:flex;align-items:center;justify-content:center">${pct}%</div></div>
          <b>${esc(atual.status === 'na_fila' && atual.posicaoFila > 1 ? `Na fila (${atual.posicaoFila}º)` : ETAPAS[atual.etapa] || 'Processando')}</b>
          <small>${atual.ajustePendente ? `Aplicando: "${esc(atual.ajustePendente)}"` : 'Pode fechar o editor. A edição continua no servidor.'}</small>`;
      }
    }
  }

  function ligarPlayer(v) {
    const tick = () => {
      moverCursor(v.currentTime);
      if (!v.paused) rafPlayhead = requestAnimationFrame(tick);
    };
    v.addEventListener('play', () => { cancelAnimationFrame(rafPlayhead); rafPlayhead = requestAnimationFrame(tick); });
    v.addEventListener('seeked', () => moverCursor(v.currentTime));
    v.addEventListener('timeupdate', () => { if (v.paused) moverCursor(v.currentTime); });
  }

  // ---------- coluna direita: voce pede / a IA edita / estilo ----------
  function renderDireita() {
    const d = el.dir;
    if (!atual) { d.innerHTML = ''; return; }
    const bloqueado = EM_ANDAMENTO(atual.status);
    const jaEditou = ['pronto', 'erro'].includes(atual.status) && (atual.duracaoFinal || (atual.ajustes || []).length);
    const principal = atual.midias.find((m) => m.tipo === 'principal');
    const referencia = atual.midias.find((m) => m.tipo === 'referencia');
    const valorAntigo = d.querySelector('[data-a=pedido]')?.value || '';
    d.innerHTML = `
      <div class="ve-card">
        <div class="ve-rot">Você pede</div>
        <div class="ve-pede">
          <textarea data-a="pedido" maxlength="2000" placeholder="${jaEditou ? 'Ex: tira o zoom do começo, coloca a imagem do consultório quando eu falar da estrutura' : referencia ? '“edita meu vídeo no estilo dessa referência”' : 'Ex: corte as gaguejadas, destaque os preços e mostre as fotos quando eu falar dos resultados'}"></textarea>
          ${referencia ? `<div class="ref" title="Referência: ${esc(referencia.nome)}" style="background-image:url('${url(`midias/${referencia.id}/miniatura`)}')"></div>` : ''}
          <button class="ve-enviar" type="button" data-a="enviar" title="${jaEditou ? 'Aplicar ajuste' : 'Editar com IA'}" ${bloqueado || (!principal && !jaEditou) ? 'disabled' : ''}>↑</button>
        </div>
        ${jaEditou && !bloqueado ? '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="ve-btn sec" type="button" data-a="refazer">Refazer do zero</button><span class="ve-dica" style="align-self:center">use depois de trocar a referência ou as mídias</span></div>' : ''}
        ${!principal && !jaEditou ? '<div class="ve-dica">Envie o vídeo a editar pra liberar.</div>' : ''}
      </div>
      <div class="ve-card"><div class="ve-rot">A IA edita</div><div class="ve-checks" data-a="checks"></div></div>
      ${atual.resumo || (atual.ajustes || []).length || atual.erro ? `<div class="ve-card"><div class="ve-rot">O que foi feito</div>
        ${atual.erro && atual.status === 'erro' ? `<div class="ve-texto" style="color:#fca5a5">${esc(atual.erro)}</div>` : ''}
        ${atual.resumo ? `<div class="ve-texto">${esc(atual.resumo)}</div>` : ''}
        ${(atual.problemasCorrigidos || []).length ? `<div class="ve-dica">A revisão corrigiu: ${atual.problemasCorrigidos.map(esc).join(' · ')}</div>` : ''}
        ${(atual.ajustes || []).map((a) => `<div class="ve-ajuste"><b>${esc(a.pedido)}</b><span>${esc(a.resumo || '')}</span></div>`).join('')}
      </div>` : ''}
      <div class="ve-card" data-a="estilo"></div>`;
    const ta = d.querySelector('[data-a=pedido]');
    ta.value = valorAntigo;
    ta.disabled = bloqueado;
    const enviar = d.querySelector('[data-a=enviar]');
    enviar.addEventListener('click', () => (jaEditou ? ajustar(ta.value) : iniciar(ta.value)));
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !enviar.disabled) enviar.click(); });
    d.querySelector('[data-a=refazer]')?.addEventListener('click', () => {
      if (confirm('Refazer a edição do zero com as mídias, referência e estilo atuais? Os ajustes anteriores serão substituídos.')) iniciar(ta.value);
    });
    renderChecks(d.querySelector('[data-a=checks]'));
    renderEstilo(d.querySelector('[data-a=estilo]'), bloqueado);
  }

  function renderChecks(box) {
    const c = atual.contagem || {};
    const ref = atual.referencia;
    const apoio = atual.midias.filter((m) => m.tipo === 'apoio');
    const temRef = atual.midias.some((m) => m.tipo === 'referencia');
    const pronto = atual.status === 'pronto';
    const idx = ORDEM.indexOf(atual.etapa);
    const estado = (inicio, fim) => {
      if (pronto) return 'feito';
      if (!EM_ANDAMENTO(atual.status)) return '';
      const a = ORDEM.indexOf(inicio);
      const b = ORDEM.indexOf(fim);
      if (idx > b) return 'feito';
      if (idx >= a) return 'fazendo';
      return '';
    };
    const fonteEstilo = ESTILOS[atual.opcoes?.estilo]?.fonte || '';
    const itens = [
      ['Ritmo dos cortes', estado(temRef ? 'estudando_referencia' : 'dirigindo', 'dirigindo'),
        pronto ? `${c.cortes ?? 0} cortes · ${tempo(atual.duracaoOriginal)} → ${tempo(atual.duracaoFinal)}${ref ? ` · ritmo ${ref.ritmo} como a referência` : ''}` : ref ? `ritmo ${ref.ritmo} (${ref.cortes_por_minuto} cortes/min na referência)` : 'tira pausas, gaguejadas e repetições'],
      ['Transições', estado(temRef ? 'estudando_referencia' : 'dirigindo', 'dirigindo'),
        ref ? `${ref.transicoes_desc}${pronto ? ` · ${c.transicoes || 0} aplicadas` : ''}` : 'cortes secos com reenquadramento e zooms'],
      ['Fontes', estado(temRef ? 'estudando_referencia' : 'dirigindo', 'dirigindo'), ref ? ref.fontes_desc : `${fonteEstilo} · estilo ${ESTILOS[atual.opcoes?.estilo]?.nome || ''}`],
      ['Composição', estado('dirigindo', 'revisando'),
        ref && !pronto ? ref.composicao_desc : pronto ? `${(c.textos || 0) + (c.numeros || 0) + (c.listas || 0)} elementos, ${c.zooms || 0} zooms, textos ${c.alturaTextos === 'media' ? 'abaixo do rosto' : 'no topo'}, legenda ${c.legendas === false ? 'desligada' : 'animada'}` : 'títulos, números, listas e legenda sem cobrir o rosto'],
    ];
    if (apoio.length) {
      itens.push(['Mídias e trilha', estado('preparando_midias', 'dirigindo'),
        pronto ? `${c.insercoes || 0} inserções${c.trilha ? ' · trilha com volume automático' : ''}` : `${apoio.length} mídia(s) pra encaixar na fala`]);
    }
    itens.push(['Revisão de qualidade', estado('revisando', 'revisando'), pronto ? ((atual.problemasCorrigidos || []).length ? `${atual.problemasCorrigidos.length} correção(ões) antes de renderizar` : 'aprovada sem correções') : 'IA olha quadros de prévia e corrige antes do render']);
    if (EM_ANDAMENTO(atual.status) && ['renderizando', 'finalizando'].includes(atual.etapa)) {
      itens.push(['Renderização', 'fazendo', `${Math.round((atual.progresso || 0) * 100)}%`]);
    }
    box.innerHTML = itens.map(([t, est, det]) => `<div class="ve-check ${est}"><i>${est === 'feito' ? '✓' : ''}</i><div>${esc(t)}<small>${esc(det || '')}</small></div></div>`).join('');
  }

  function renderEstilo(card, bloqueado) {
    const op = atual.opcoes || {};
    const temRef = atual.midias.some((m) => m.tipo === 'referencia');
    card.innerHTML = `<div class="ve-rot">Estilo e formato</div>
      ${temRef ? '<div class="ve-dica">Com vídeo referência, as cores, fontes e transições vêm dela. O estilo abaixo vale quando não há referência.</div>' : ''}
      <div class="ve-opcoes" data-a="estilos"></div>
      <div class="ve-opcoes" data-a="formatos"></div>
      <label class="ve-linha-op"><input type="checkbox" data-a="usarCor" ${op.corDestaque ? 'checked' : ''}/> Cor de destaque própria <input type="color" data-a="cor" value="${op.corDestaque || '#a855f7'}"/></label>
      <label class="ve-linha-op"><input type="checkbox" data-a="legendas" ${op.legendas !== false ? 'checked' : ''}/> Legendas animadas</label>
      <label class="ve-linha-op"><input type="checkbox" data-a="revisao" ${op.revisaoAutomatica !== false ? 'checked' : ''}/> Revisão automática de qualidade</label>`;
    const est = card.querySelector('[data-a=estilos]');
    for (const [k, e] of Object.entries(ESTILOS)) {
      const b = document.createElement('span');
      b.className = `ve-op${op.estilo === k ? ' ativo' : ''}`;
      b.title = e.desc;
      b.innerHTML = `${e.cores.map((c) => `<i style="background:${c}"></i>`).join('')}${esc(e.nome)}`;
      b.addEventListener('click', () => !bloqueado && salvarOpcoes({ estilo: k }));
      est.appendChild(b);
    }
    const fmt = card.querySelector('[data-a=formatos]');
    for (const [k, nome] of Object.entries(FORMATOS)) {
      const b = document.createElement('span');
      b.className = `ve-op${op.formato === k ? ' ativo' : ''}`;
      b.textContent = `${k} ${nome}`;
      b.addEventListener('click', () => !bloqueado && salvarOpcoes({ formato: k }));
      fmt.appendChild(b);
    }
    const usarCor = card.querySelector('[data-a=usarCor]');
    const cor = card.querySelector('[data-a=cor]');
    usarCor.addEventListener('change', () => salvarOpcoes({ corDestaque: usarCor.checked ? cor.value : null }));
    cor.addEventListener('change', () => { usarCor.checked = true; salvarOpcoes({ corDestaque: cor.value }); });
    card.querySelector('[data-a=legendas]').addEventListener('change', (e) => salvarOpcoes({ legendas: e.target.checked }));
    card.querySelector('[data-a=revisao]').addEventListener('change', (e) => salvarOpcoes({ revisaoAutomatica: e.target.checked }));
    card.querySelectorAll('input').forEach((i) => { i.disabled = bloqueado; });
  }

  async function salvarOpcoes(mudancas) {
    try {
      atual = { ...atual, ...(await api(`/api/video/edicoes/${atual.id}/opcoes`, { method: 'PATCH', body: JSON.stringify(mudancas) })) };
      renderDireita();
      if (mudancas.formato) renderPalco(true);
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  async function iniciar(instrucoes) {
    try {
      atual = await api(`/api/video/edicoes/${atual.id}/iniciar`, { method: 'POST', body: JSON.stringify({ instrucoes: instrucoes.trim() }) });
      linha = null;
      el.dir.querySelector('[data-a=pedido]').value = '';
      renderTudo({ recriarPlayer: true });
      agendarPolling();
      carregarProjetos();
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  async function ajustar(pedido) {
    if (!pedido.trim()) { aviso('Escreva o ajuste que você quer.', 'erro'); return; }
    try {
      atual = await api(`/api/video/edicoes/${atual.id}/ajustar`, { method: 'POST', body: JSON.stringify({ pedido }) });
      el.dir.querySelector('[data-a=pedido]').value = '';
      renderTudo({ recriarPlayer: true });
      agendarPolling();
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  // ---------- linha do tempo ----------
  function paginarLegendas(palavras, porTela = 3) {
    const paginas = [];
    let atualPg = [];
    const fechar = () => { if (atualPg.length) paginas.push(atualPg); atualPg = []; };
    palavras.forEach((p, i) => {
      const anterior = palavras[i - 1];
      const chars = atualPg.reduce((n, w) => n + w.t.length + 1, 0);
      if (atualPg.length >= porTela || (anterior && p.i - anterior.f > 0.45) || chars + p.t.length > 18) fechar();
      atualPg.push(p);
      if (/[.!?…]$/.test(p.t)) fechar();
    });
    fechar();
    return paginas;
  }

  function renderLinhaDoTempo() {
    const t = el.tempo;
    if (!linha || atual?.status !== 'pronto') {
      t.innerHTML = `<div class="ve-tempo-barra"><span>Linha do tempo</span></div><div class="ve-tempo-vazio">${
        !atual ? 'Crie um projeto pra começar.'
          : EM_ANDAMENTO(atual.status) ? 'A linha do tempo com as camadas aparece quando a edição terminar.'
            : 'Envie o vídeo e clique em ↑ pra IA editar. As camadas da edição aparecem aqui.'}</div>`;
      return;
    }
    const L = linha;
    const fps = L.fps || 30;
    const dur = L.duracaoFrames / fps;
    const trilhas = ['VÍDEO', 'LEGENDA', 'EDIÇÃO', 'MÍDIA', 'EFEITOS', 'ÁUDIO'];
    t.innerHTML = `
      <div class="ve-tempo-barra"><span>Tempo <b data-a="relogio">0:00</b> / ${tempo(dur)}</span>
        <span>${L.segmentos.length - 1} cortes · ${L.textos.length + L.numeros.length + L.listas.length} elementos · ${(L.insercoes || []).length} mídias</span>
        <div class="ve-zoom"><button type="button" data-z="-">−</button><button type="button" data-z="0" title="Ajustar">⤢</button><button type="button" data-z="+">+</button></div></div>
      <div class="ve-tempo-corpo">
        <div class="ve-trilhas-rot">${trilhas.map((n) => `<div>${n}</div>`).join('')}</div>
        <div class="ve-trilhas" data-a="scroll"><div class="ve-trilhas-in" data-a="in"></div></div>
      </div>`;
    const scroll = t.querySelector('[data-a=scroll]');
    const inn = t.querySelector('[data-a=in]');
    const larguraVisivel = scroll.clientWidth || 800;
    const pps = pxPorSeg || Math.max(4, (larguraVisivel - 10) / dur);
    const largura = Math.max(larguraVisivel, dur * pps + 10);
    inn.style.width = `${largura}px`;
    const x = (seg) => seg * pps;
    const xf = (frame) => (frame / fps) * pps;
    let html = '';

    // regua
    const passo = [1, 2, 5, 10, 15, 30, 60].find((p) => p * pps >= 54) || 60;
    html += '<div class="ve-regua">';
    for (let s = 0; s <= dur; s += passo) html += `<span style="left:${x(s)}px">${tempo(s)}</span>`;
    html += '</div>';

    // video: tira de miniaturas + marcas de corte
    html += `<div class="ve-trilha"><div class="ve-video-faixa" style="width:${x(dur)}px;${L.temTira ? `background-image:url('${url('tira')}')` : 'background:#2a2140'}"></div>`;
    for (const s of L.segmentos.slice(1)) html += `<div class="ve-corte" style="left:${xf(s.outInicio)}px"></div>`;
    html += '</div>';

    // legenda
    html += '<div class="ve-trilha">';
    if (L.legendas !== false) {
      for (const pg of paginarLegendas(L.palavras || [], L.estiloCustom?.palavrasPorTela || 3)) {
        const a = pg[0].i;
        const b = pg[pg.length - 1].f;
        html += `<div class="ve-bloco leg" title="${esc(pg.map((p) => p.t).join(' '))}" style="left:${x(a)}px;width:${Math.max(3, x(b - a) - 1)}px"></div>`;
      }
    }
    html += '</div>';

    // edicao: textos, numeros, listas
    html += '<div class="ve-trilha">';
    const rotTexto = { impacto: 'Título', topo: 'Topo', etiqueta: 'Etiqueta' };
    for (const o of L.textos) html += `<div class="ve-bloco txt" title="${esc(o.texto)}" style="left:${xf(o.inicio)}px;width:${Math.max(6, xf(o.fim - o.inicio))}px">${esc(rotTexto[o.estilo] || 'Texto')} · ${esc(o.texto)}</div>`;
    for (const o of L.numeros) html += `<div class="ve-bloco num" title="${esc(o.rotulo)}" style="left:${xf(o.inicio)}px;width:${Math.max(6, xf(o.fim - o.inicio))}px">${esc(o.prefixo)}${o.valor}${esc(o.sufixo)}</div>`;
    for (const o of L.listas) html += `<div class="ve-bloco lst" title="${esc(o.itens.join(', '))}" style="left:${xf(o.inicio)}px;width:${Math.max(6, xf(o.fim - o.inicio))}px">Lista · ${esc(o.titulo)}</div>`;
    html += '</div>';

    // midias de apoio + trilha
    html += '<div class="ve-trilha">';
    for (const o of L.insercoes || []) {
      const m = atual.midias.find((mm) => mm.id === o.midia);
      html += `<div class="ve-bloco ins" title="${esc(m?.nome || '')}" style="left:${xf(o.inicio)}px;width:${Math.max(6, xf(o.fim - o.inicio))}px;${m ? `background-image:url('${url(`midias/${m.id}/miniatura`)}')` : ''}">${o.modo === 'janela' ? '▢' : '■'}</div>`;
    }
    if (L.trilha && !(L.insercoes || []).length) {
      const m = atual.midias.find((mm) => mm.id === L.trilha.midia);
      html += `<div class="ve-bloco mus" style="left:0;width:${x(dur)}px">♪ ${esc(m?.nome || 'trilha de fundo')}</div>`;
    }
    html += '</div>';

    // efeitos: zooms e transicoes
    html += '<div class="ve-trilha">';
    for (const z of L.zooms) html += `<div class="ve-marca-fx ${z.tipo === 'lento' ? 'lento' : ''}" title="zoom ${esc(z.tipo)}" style="left:${xf(z.frame)}px"></div>`;
    for (const tr of L.transicoes || []) html += `<div class="ve-marca-fx tr" title="transição ${esc(tr.tipo)}" style="left:${xf(tr.frame)}px"></div>`;
    html += '</div>';

    // audio: forma de onda (+ faixa da trilha, se houver)
    html += `<div class="ve-trilha">${L.trilha && (L.insercoes || []).length ? `<div class="ve-bloco mus" style="left:0;width:${x(dur)}px;opacity:.5"></div>` : ''}<canvas class="ve-onda" data-a="onda"></canvas></div>`;
    html += '<div class="ve-cursor" data-a="cursor" style="left:0"></div>';
    inn.innerHTML = html;

    desenharOnda(inn.querySelector('[data-a=onda]'), L.ondas || [], x(dur));
    inn.addEventListener('click', (e) => {
      if (!el.player) return;
      const r = inn.getBoundingClientRect();
      el.player.currentTime = Math.max(0, Math.min(dur, (e.clientX - r.left) / pps));
    });
    t.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const base = pxPorSeg || pps;
      pxPorSeg = b.dataset.z === '0' ? 0 : Math.min(400, Math.max(4, b.dataset.z === '+' ? base * 1.6 : base / 1.6));
      renderLinhaDoTempo();
      if (el.player) moverCursor(el.player.currentTime);
    }));
    el.cursor = inn.querySelector('[data-a=cursor]');
    el.relogio = t.querySelector('[data-a=relogio]');
    el.scroll = scroll;
    el.pps = pps;
  }

  function desenharOnda(canvas, picos, largura) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${largura}px`;
    canvas.width = Math.max(1, Math.floor(largura * dpr));
    canvas.height = Math.floor(27 * dpr);
    const ctx = canvas.getContext('2d');
    const meio = canvas.height / 2;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#a78bfa');
    grad.addColorStop(1, '#f0abfc');
    ctx.fillStyle = grad;
    const passo = canvas.width / Math.max(1, picos.length);
    const barra = Math.max(1, passo * 0.6);
    picos.forEach((v, i) => {
      const alt = Math.max(1, v * (canvas.height - 2));
      ctx.fillRect(i * passo, meio - alt / 2, barra, alt);
    });
  }

  function moverCursor(seg) {
    if (!el.cursor || !el.pps) return;
    const px = seg * el.pps;
    el.cursor.style.left = `${px}px`;
    if (el.relogio) el.relogio.textContent = tempo(seg);
    const s = el.scroll;
    if (s && (px < s.scrollLeft || px > s.scrollLeft + s.clientWidth - 30)) s.scrollLeft = Math.max(0, px - s.clientWidth / 3);
  }

  // ---------- entrada/saida ----------
  window.videoAbrir = async (container, tokenApp) => {
    raiz = container;
    token = tokenApp;
    injetarEstilo();
    if (!montado) { montar(); montado = true; }
    await carregarProjetos();
    if (atual) await abrirProjeto(atual.id);
    else if (projetos[0]) await abrirProjeto(projetos[0].id);
    else renderTudo({ recriarPlayer: true });
  };
  window.videoPausar = () => {
    clearTimeout(timerPolling);
    cancelAnimationFrame(rafPlayhead);
    el.player?.pause();
  };
  let ultimaLargura = 0;
  window.addEventListener('resize', () => {
    if (!raiz || raiz.hidden || pxPorSeg || !linha) return;
    const w = el.tempo?.clientWidth || 0;
    if (Math.abs(w - ultimaLargura) < 40) return;
    ultimaLargura = w;
    renderLinhaDoTempo();
    if (el.player) moverCursor(el.player.currentTime);
  });
})();
