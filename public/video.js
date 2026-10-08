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
  ETAPAS.gerando_imagens = 'IA criando as imagens';
  ETAPAS.recortando = 'Recortando a pessoa (profundidade)';
  ETAPAS.aplicando_edicao = 'Aplicando suas edições';
  const ORDEM = ['na_fila', 'aplicando_edicao', 'preparando', 'transcrevendo', 'estudando_referencia', 'preparando_midias', 'dirigindo', 'gerando_imagens', 'recortando', 'revisando', 'renderizando', 'finalizando', 'pronto'];
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
        max-width: none !important; border-radius: 0 !important; background: #0a0a0a; overflow: hidden; }
      .video-aba[hidden] { display: none !important; }
      .ve-app { position: absolute; inset: 0; display: grid; grid-template-columns: 290px minmax(0, 1fr) 360px; grid-template-rows: 54px minmax(0, 1fr) 300px;
        grid-template-areas: "topo topo topo" "esq palco dir" "tempo tempo tempo"; color: #f0ede4; font-family: inherit;
        background: radial-gradient(ellipse at 50% 0%, #1c1810 0%, #0a0a0a 60%); }
      .ve-app * { box-sizing: border-box; }
      .ve-topo { grid-area: topo; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid rgba(212,175,55,.14); background: rgba(10,10,10,.75); }
      .ve-marca { font-weight: 800; font-size: 15px; letter-spacing: .3px; display: flex; align-items: center; gap: 8px; }
      .ve-marca i { width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg, #f5d576, #b8860b); display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 13px; color: #14110a; }
      .ve-nome { flex: 1; min-width: 0; font-size: 13px; color: #b8b4a8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ve-nome b { color: #f0ede4; font-weight: 600; }
      .ve-chip { font-size: 11px; padding: 4px 10px; border-radius: 999px; background: rgba(212,175,55,.16); color: #f5d576; white-space: nowrap; }
      .ve-chip.pronto { background: rgba(34,197,94,.14); color: #86efac; } .ve-chip.erro { background: rgba(239,68,68,.14); color: #fca5a5; }
      .ve-btn { background: rgba(212,175,55,.18); border: 1px solid rgba(212,175,55,.35); color: #f5d576; border-radius: 9px; padding: 7px 13px;
        font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
      .ve-btn:hover:not(:disabled) { background: rgba(212,175,55,.3); }
      .ve-btn:disabled { opacity: .4; cursor: default; }
      .ve-btn.forte { background: linear-gradient(135deg, #f5d576 0%, #d4af37 45%, #a8841f 100%); border-color: transparent; color: #14110a; }
      .ve-btn.sec { background: transparent; border-color: rgba(255,255,255,.12); color: #b8b4a8; font-weight: 600; }
      .ve-btn.perigo { background: transparent; border-color: rgba(239,68,68,.35); color: #fca5a5; font-weight: 600; }
      .ve-col { min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .ve-esq { grid-area: esq; border-right: 1px solid rgba(212,175,55,.1); }
      .ve-dir { grid-area: dir; border-left: 1px solid rgba(212,175,55,.1); }
      .ve-palco { grid-area: palco; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 14px; position: relative; }
      .ve-tela { position: relative; height: 100%; max-width: 100%; aspect-ratio: 9 / 16; border-radius: 14px; overflow: hidden; background: #000;
        box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(212,175,55,.18); display: flex; align-items: center; justify-content: center; }
      .ve-tela video, .ve-tela img { width: 100%; height: 100%; object-fit: contain; background: #000; }
      .ve-tela-vazia { color: #706c62; font-size: 13px; text-align: center; padding: 24px; line-height: 1.6; }
      .ve-processando { position: absolute; inset: 0; background: rgba(10,10,10,.75); backdrop-filter: blur(3px); display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
      .ve-anel { width: 74px; height: 74px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
      .ve-processando small { color: #b8b4a8; font-size: 12px; max-width: 240px; line-height: 1.5; }
      .ve-alterna { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: rgba(10,10,10,.82);
        border: 1px solid rgba(212,175,55,.2); border-radius: 999px; padding: 3px; z-index: 2; }
      .ve-alterna button { background: none; border: none; color: #b8b4a8; font-size: 11.5px; font-weight: 700; padding: 5px 12px; border-radius: 999px; cursor: pointer; font-family: inherit; }
      .ve-alterna button.ativo { background: rgba(212,175,55,.35); color: #fff; }
      .ve-card { border: 1px solid rgba(212,175,55,.14); border-radius: 14px; padding: 13px; background: rgba(18,17,14,.82); display: flex; flex-direction: column; gap: 10px; }
      .ve-rot { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: #9a968a; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ve-abas { display: flex; gap: 4px; background: rgba(255,255,255,.03); border-radius: 10px; padding: 3px; }
      .ve-abas button { flex: 1; background: none; border: none; color: #9a968a; font-size: 12px; font-weight: 700; padding: 7px; border-radius: 8px; cursor: pointer; font-family: inherit; }
      .ve-abas button.ativo { background: rgba(212,175,55,.22); color: #f5f5f0; }
      .ve-drop { border: 1.5px dashed rgba(212,175,55,.35); border-radius: 12px; padding: 14px 10px; text-align: center; cursor: pointer; color: #9a968a;
        font-size: 12px; line-height: 1.5; transition: background .15s, border-color .15s; }
      .ve-drop:hover, .ve-drop.arrastando { background: rgba(212,175,55,.08); border-color: #d4af37; }
      .ve-drop b { color: #f0ede4; display: block; font-size: 12.5px; }
      .ve-arquivo { display: flex; gap: 10px; align-items: center; border: 1px solid rgba(212,175,55,.16); border-radius: 12px; padding: 8px; background: rgba(255,255,255,.02); }
      .ve-arquivo .min { width: 46px; height: 62px; border-radius: 8px; background: #000 center / cover no-repeat; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .ve-arquivo .info { min-width: 0; flex: 1; font-size: 12px; }
      .ve-arquivo .info b { display: block; color: #f0ede4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
      .ve-arquivo .info span { color: #9a968a; font-size: 11px; }
      .ve-x { background: none; border: none; color: #9a968a; cursor: pointer; font-size: 16px; padding: 4px; }
      .ve-x:hover { color: #fca5a5; }
      .ve-grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      .ve-midia { position: relative; aspect-ratio: 1; border-radius: 9px; background: #141310 center / cover no-repeat; border: 1px solid rgba(212,175,55,.16);
        display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; }
      .ve-midia small { position: absolute; left: 4px; bottom: 3px; font-size: 9.5px; background: rgba(0,0,0,.65); padding: 1px 5px; border-radius: 4px; color: #ddd; }
      .ve-midia .ve-x { position: absolute; top: 0; right: 0; background: rgba(0,0,0,.55); border-radius: 0 0 0 8px; font-size: 12px; padding: 2px 6px; }
      .ve-midia.add { border-style: dashed; color: #d4af37; cursor: pointer; font-size: 24px; }
      .ve-barra { height: 4px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; }
      .ve-barra > div { height: 100%; background: linear-gradient(90deg, #d4af37, #f5d576); transition: width .3s; }
      .ve-dica { font-size: 11.5px; color: #9a968a; line-height: 1.5; }
      .ve-proj { display: flex; gap: 9px; align-items: center; border: 1px solid rgba(212,175,55,.12); border-radius: 12px; padding: 7px; cursor: pointer; background: rgba(255,255,255,.02); }
      .ve-proj.ativo { border-color: #d4af37; background: rgba(212,175,55,.12); }
      .ve-proj .min { width: 38px; height: 52px; border-radius: 7px; background: #141310 center / cover no-repeat; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #706c62; }
      .ve-proj .info { min-width: 0; flex: 1; }
      .ve-proj .info b { display: block; font-size: 12.5px; color: #f0ede4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
      .ve-proj .info span { font-size: 11px; color: #9a968a; }
      .ve-pede { display: flex; gap: 8px; align-items: flex-end; }
      .ve-pede textarea { flex: 1; min-height: 70px; max-height: 180px; resize: vertical; background: transparent; border: none; color: #f0ede4; font-size: 14px;
        font-family: inherit; line-height: 1.45; outline: none; padding: 0; }
      .ve-pede textarea::placeholder { color: #706c62; }
      .ve-pede .ref { width: 40px; height: 54px; border-radius: 7px; background: #141310 center / cover no-repeat; flex-shrink: 0; border: 1px solid rgba(212,175,55,.3); }
      .ve-enviar { width: 36px; height: 36px; border-radius: 50%; border: none; background: linear-gradient(135deg, #f5d576 0%, #d4af37 45%, #a8841f 100%); color: #14110a; font-weight: 800; font-size: 17px; cursor: pointer; flex-shrink: 0; }
      .ve-enviar:disabled { opacity: .4; cursor: default; }
      .ve-checks { display: flex; flex-direction: column; gap: 9px; }
      .ve-check { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; color: #706c62; }
      .ve-check i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #4a463c; flex-shrink: 0; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; }
      .ve-check.fazendo { color: #f5d576; } .ve-check.fazendo i { border-color: #d4af37; border-top-color: transparent; animation: veGira .8s linear infinite; }
      .ve-check.feito { color: #f0ede4; } .ve-check.feito i { background: #d4af37; border-color: #d4af37; color: #14110a; font-weight: 800; }
      .ve-check small { display: block; color: #9a968a; font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
      @keyframes veGira { to { transform: rotate(360deg); } }
      .ve-opcoes { display: flex; flex-wrap: wrap; gap: 5px; }
      .ve-op { font-size: 11.5px; padding: 5px 9px; border-radius: 999px; border: 1px solid rgba(212,175,55,.18); color: #d6d3c8; cursor: pointer; background: rgba(255,255,255,.02); display: inline-flex; gap: 5px; align-items: center; }
      .ve-op i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .ve-op.ativo { border-color: #d4af37; background: rgba(212,175,55,.2); color: #fff; }
      .ve-linha-op { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #d6d3c8; cursor: pointer; }
      .ve-linha-op input[type=color] { width: 26px; height: 20px; border: none; background: none; padding: 0; cursor: pointer; }
      .ve-texto { font-size: 12.5px; color: #d6d3c8; line-height: 1.55; }
      .ve-ajuste { border-left: 2px solid #d4af37; padding: 2px 0 2px 9px; font-size: 12px; }
      .ve-ajuste b { display: block; color: #f0ede4; font-weight: 600; } .ve-ajuste span { color: #9a968a; }
      /* linha do tempo */
      .ve-tempo { grid-area: tempo; border-top: 1px solid rgba(212,175,55,.16); background: rgba(12,11,9,.94); display: flex; flex-direction: column; min-height: 0; }
      .ve-tempo-barra { display: flex; align-items: center; gap: 10px; padding: 6px 12px; font-size: 11.5px; color: #9a968a; border-bottom: 1px solid rgba(212,175,55,.08); }
      .ve-tempo-barra b { color: #f0ede4; font-variant-numeric: tabular-nums; }
      .ve-zoom { margin-left: auto; display: flex; gap: 4px; }
      .ve-zoom button { width: 24px; height: 22px; border-radius: 6px; border: 1px solid rgba(212,175,55,.2); background: none; color: #f5d576; cursor: pointer; font-weight: 700; }
      .ve-tempo-corpo { flex: 1; min-height: 0; display: flex; }
      .ve-trilhas-rot { width: 74px; flex-shrink: 0; padding-top: 22px; }
      .ve-trilhas-rot div { height: 31px; display: flex; align-items: center; font-size: 9.5px; letter-spacing: 1.3px; color: #706c62; font-weight: 800; padding-left: 12px; }
      .ve-trilhas { flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; position: relative; }
      .ve-trilhas-in { position: relative; height: 100%; min-width: 100%; cursor: pointer; }
      .ve-regua { height: 22px; position: relative; border-bottom: 1px solid rgba(255,255,255,.05); }
      .ve-regua span { position: absolute; top: 4px; font-size: 9.5px; color: #706c62; transform: translateX(-50%); font-variant-numeric: tabular-nums; }
      .ve-trilha { height: 31px; position: relative; border-bottom: 1px solid rgba(255,255,255,.035); }
      .ve-bloco { position: absolute; top: 4px; height: 23px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #fff; padding: 0 6px; display: flex;
        align-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; letter-spacing: .3px; }
      .ve-bloco.leg { background: #c9ccd1; opacity: .8; border-radius: 4px; padding: 0; }
      .ve-bloco.txt { background: linear-gradient(135deg, #f5d576, #d4af37); color: #14110a; text-transform: uppercase; }
      .ve-bloco.num { background: linear-gradient(135deg, #f5f5f0, #c9ccd1); color: #14110a; }
      .ve-bloco.lst { background: linear-gradient(135deg, #b8860b, #e0b84a); color: #04222a; }
      .ve-bloco.ins { background: #1e1c14 center / cover no-repeat; border: 1px solid #f59e0b; color: #fde68a; text-shadow: 0 1px 3px #000; }
      .ve-bloco.mus { background: rgba(34,197,94,.22); border: 1px solid rgba(34,197,94,.5); color: #86efac; }
      .ve-video-faixa { position: absolute; top: 3px; bottom: 3px; left: 0; right: 0; border-radius: 6px; background-size: 100% 100%; background-repeat: no-repeat; opacity: .9; }
      .ve-corte { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(10,10,10,.9); }
      .ve-marca-fx { position: absolute; top: 9px; width: 12px; height: 12px; transform: translateX(-6px) rotate(45deg); background: #facc15; border-radius: 2px; }
      .ve-marca-fx.lento { background: #60a5fa; }
      .ve-marca-fx.tr { background: #fff; transform: translateX(-2px); width: 4px; height: 23px; top: 4px; border-radius: 2px; }
      .ve-onda { position: absolute; inset: 2px 0; width: 100%; height: 27px; }
      .ve-cursor { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 8px rgba(255,255,255,.6); pointer-events: none; z-index: 3; }
      .ve-cursor::before { content: ''; position: absolute; top: 0; left: -5px; border: 6px solid transparent; border-top-color: #fff; }
      .ve-tempo-vazio { flex: 1; display: flex; align-items: center; justify-content: center; color: #706c62; font-size: 12.5px; text-align: center; padding: 16px; }
      .ve-aviso { position: absolute; left: 50%; bottom: 316px; transform: translateX(-50%); z-index: 10; padding: 10px 16px; border-radius: 10px; font-size: 13px;
        background: #1f2937; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: veSobe .25s ease-out; max-width: 90%; }
      .ve-aviso.erro { background: #7f1d1d; }

      .ve-add { display: flex; gap: 4px; flex-wrap: wrap; }
      .ve-add button { background: rgba(212,175,55,.1); border: 1px solid rgba(212,175,55,.28); color: #f5d576; border-radius: 7px; padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; }
      .ve-add button:hover { background: rgba(212,175,55,.22); }
      .ve-bloco { cursor: grab; user-select: none; touch-action: none; }
      .ve-bloco:active { cursor: grabbing; }
      .ve-bloco span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; flex: 1; min-width: 0; }
      .ve-bloco .al { position: absolute; top: 0; bottom: 0; width: 7px; cursor: ew-resize; }
      .ve-bloco .al.e { left: 0; } .ve-bloco .al.d { right: 0; }
      .ve-bloco:hover .al { background: rgba(255,255,255,.35); }
      .ve-bloco.sel { outline: 2px solid #fff; outline-offset: 1px; z-index: 2; box-shadow: 0 0 12px rgba(245,213,118,.6); }
      .ve-bloco.atr { background: linear-gradient(135deg, #2a2618, #4a3f1c); border: 1px solid #d4af37; color: #f5d576; }
      .ve-bloco.fnd { background: repeating-linear-gradient(45deg, #1e1c14, #1e1c14 6px, #2a2618 6px, #2a2618 12px); border: 1px solid #9a968a; color: #f0ede4; }
      .ve-bloco.ele { background-color: #1e1c14; background-size: cover; background-position: center; border: 1px solid #f5d576; color: #fff; text-shadow: 0 1px 3px #000; }
      .ve-bloco.div { background-color: #1e1c14; background-size: cover; background-position: center; border: 1px dashed #c9ccd1; color: #fff; text-shadow: 0 1px 3px #000; }
      .ve-bloco.efx { background: linear-gradient(135deg, #3a3a3a, #6b6b6b); color: #f5f5f0; border: 1px solid #c9ccd1; }
      .ve-bloco.leg.sel { outline-offset: 0; }
      .ve-bloco.leg-off { background: transparent; border: 1px dashed #706c62; color: #9a968a; font-weight: 600; cursor: pointer; }
      .ve-marca-fx { cursor: grab; z-index: 1; }
      .ve-marca-fx.soco { background: #f5d576; } .ve-marca-fx.lento { background: #c9ccd1; } .ve-marca-fx.dramatico { background: #fff; box-shadow: 0 0 6px #f5d576; }
      .ve-marca-fx.sel { outline: 2px solid #fff; outline-offset: 2px; }
      .ve-regua { cursor: pointer; }
      .ve-inspetor { border-color: rgba(245,213,118,.5); box-shadow: 0 0 0 1px rgba(245,213,118,.15), 0 10px 30px rgba(0,0,0,.4); }
      .ve-campo { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: #9a968a; }
      .ve-campo input, .ve-campo select, .ve-campo textarea, .ve-palavra input[type=text] { background: rgba(255,255,255,.04); border: 1px solid rgba(212,175,55,.25); border-radius: 8px;
        padding: 7px 9px; color: #f0ede4; font-size: 13px; font-family: inherit; width: 100%; }
      .ve-campo select option { background: #121110; }
      .ve-tempos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .ve-palavra { display: flex; gap: 8px; align-items: center; }
      .ve-palavra label { font-size: 11px; color: #9a968a; white-space: nowrap; display: flex; gap: 4px; align-items: center; }
      .ve-midia.gerada { border-color: rgba(245,213,118,.45); }
      .ve-tempo-barra { flex-wrap: wrap; }
      @keyframes veSobe { from { opacity: 0; transform: translate(-50%, 8px); } }
      @media (max-width: 1100px) { .ve-app { grid-template-columns: 250px minmax(0, 1fr) 310px; } }
      @media (max-width: 860px) {
        .video-aba { overflow-y: auto; }
        .ve-app { position: relative; inset: auto; min-height: 100%; display: flex; flex-direction: column; }
        .ve-topo { position: sticky; top: 0; z-index: 5; min-height: 54px; flex-wrap: wrap; padding: 8px 12px; }
        .ve-palco { order: 1; height: 62vh; }
        .ve-dir { order: 2; border: none; overflow: visible; }
        .ve-tempo { order: 3; height: 330px; flex-shrink: 0; }
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
          <button class="ve-btn sec" type="button" data-r="fecharProj" title="Fechar este projeto (ele continua salvo em Projetos)" hidden>✕ Fechar projeto</button>
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
    el.novo.addEventListener('click', fecharProjeto);
    el.fecharProj.addEventListener('click', fecharProjeto);
    raiz.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { abaLateral = b.dataset.aba; renderEsquerda(); }));
    document.addEventListener('keydown', (e) => {
      if (raiz.hidden || e.target.closest?.('textarea, input, select')) return;
      if (e.code === 'Space' && el.player) { e.preventDefault(); el.player.paused ? el.player.play() : el.player.pause(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && ed) { e.preventDefault(); desfazer(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionado && selecionado.k !== 'legenda' && ed) {
        e.preventDefault();
        guardar();
        ed[selecionado.k].splice(selecionado.i, 1);
        selecionado = null;
        renderLinhaDoTempo();
        renderInspetor();
      }
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
    if (atual && atual.id !== id && ed && sujo() && !confirm('Você tem mudanças na linha do tempo que não foram aplicadas. Sair mesmo assim?')) return;
    try {
      const anterior = atual;
      atual = await api(`/api/video/edicoes/${id}`);
      const mudouProjeto = anterior?.id !== atual.id;
      const ficouPronto = atual.status === 'pronto' && (mudouProjeto || anterior?.status !== 'pronto'
        || (anterior?.ajustes || []).length !== (atual.ajustes || []).length || anterior?.edicoesManuais !== atual.edicoesManuais);
      if (mudouProjeto) { linha = null; ed = null; }
      if (mudouProjeto || ficouPronto) modoTela = 'editado';
      if (ficouPronto) {
        linha = await api(`/api/video/edicoes/${id}/linha-do-tempo`).catch(() => null);
        iniciarEdicaoLocal();
      } else if (atual.status !== 'pronto') {
        linha = mudouProjeto ? null : linha;
      }
      renderTudo({ recriarPlayer: mudouProjeto || ficouPronto || !silencioso });
    } catch (err) {
      aviso(err.message, 'erro');
    }
    agendarPolling();
  }

  async function comecarComArquivo(arquivo) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(arquivo.name)) {
      aviso('Escolha um arquivo de vídeo.', 'erro');
      return;
    }
    try {
      const p = await api('/api/video/edicoes', { method: 'POST', body: JSON.stringify({ nome: arquivo.name }) });
      await carregarProjetos();
      await abrirProjeto(p.id);
      await enviarArquivo('principal', arquivo);
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  // "fechar" o projeto atual sem apagar - volta pra tela limpa
  function fecharProjeto() {
    clearTimeout(timerPolling);
    el.player?.pause();
    atual = null;
    linha = null;
    abaLateral = 'midias';
    renderTudo({ recriarPlayer: true });
  }

  async function apagarProjeto() {
    if (!atual || !confirm(`Apagar o projeto "${atual.titulo || atual.nomeArquivo}"? Os vídeos e mídias serão excluídos.`)) return;
    try {
      await api(`/api/video/edicoes/${atual.id}`, { method: 'DELETE' });
      atual = null;
      linha = null;
      await carregarProjetos();
      fecharProjeto();
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
    el.fecharProj.hidden = !atual;
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
      // editor abre limpo: escolher o video ja cria o projeto (os anteriores ficam na aba Projetos)
      p.innerHTML = `<div class="ve-card"><div class="ve-rot">Vídeo a editar</div>
        <div class="ve-drop" data-a="drop"><b>Envie o vídeo bruto pra começar</b>MP4 ou MOV, até 10 min e 1 GB</div>
        <div class="ve-dica">Depois você pode enviar um vídeo de referência e imagens, vídeos e áudios pra compor a edição. Seus projetos anteriores ficam na aba Projetos.</div></div>`;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'video/*'; input.hidden = true;
      p.appendChild(input);
      const drop = p.querySelector('[data-a=drop]');
      drop.addEventListener('click', () => input.click());
      input.addEventListener('change', () => input.files[0] && comecarComArquivo(input.files[0]));
      ligarArrastar(drop, (files) => comecarComArquivo(files[0]));
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

    // imagens que a IA criou (fotos, objetos 3D recortados, fundos) - reaproveitaveis nos ajustes
    const geradas = atual.midias.filter((m) => m.tipo === 'gerada');
    if (geradas.length) {
      const cg = document.createElement('div');
      cg.className = 've-card';
      cg.innerHTML = `<div class="ve-rot">Desenhadas pelo Claude <span style="text-transform:none;letter-spacing:0;font-weight:600">${geradas.length}</span></div><div class="ve-grade" data-a="geradas"></div>`;
      const g = cg.querySelector('[data-a=geradas]');
      for (const m of geradas) {
        const d = document.createElement('div');
        d.className = 've-midia gerada';
        d.style.backgroundImage = `url('${url(`midias/${m.id}/miniatura`)}')`;
        d.title = m.prompt || m.nome;
        d.innerHTML = `<small>${m.recortada ? '3D' : 'IA'}</small>${bloqueado ? '' : '<button class="ve-x" type="button" title="Remover">✕</button>'}`;
        d.querySelector('.ve-x')?.addEventListener('click', (e) => { e.stopPropagation(); removerMidia(m); });
        g.appendChild(d);
      }
      p.appendChild(cg);
    }

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
        ${bloqueado ? '' : '<button class="ve-x" type="button" title="Trocar por outro">⟳</button><button class="ve-x" type="button" data-a="rm" title="Remover">✕</button>'}`;
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
        tela.innerHTML = '<div class="ve-tela-vazia">Envie o vídeo que será editado<br>na coluna da esquerda.</div>';
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
        sobre.innerHTML = `<div class="ve-anel" style="background:conic-gradient(#d4af37 ${pct * 3.6}deg, rgba(255,255,255,.08) 0)"><div style="width:62px;height:62px;border-radius:50%;background:#121110;display:flex;align-items:center;justify-content:center">${pct}%</div></div>
          <b>${esc(atual.status === 'na_fila' && atual.posicaoFila > 1 ? `Na fila (${atual.posicaoFila}º)` : ETAPAS[atual.etapa] || 'Processando')}</b>
          <small>${atual.ajustePendente ? `Aplicando: "${esc(atual.ajustePendente)}"` : 'Pode fechar o editor. A edição continua no servidor.'}</small>
          ${atual.duracaoOriginal ? `<small>Vídeo de ${tempo(atual.duracaoOriginal)} · tempo total estimado: ~${Math.max(5, Math.round((atual.duracaoOriginal / 60) * 16))} min</small>` : ''}`;
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
      <div class="ve-card ve-inspetor" data-a="inspetor" hidden></div>
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
    renderInspetor();
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
    const geradas = atual.midias.filter((m) => m.tipo === 'gerada').length;
    itens.push(['Imagens e 3D desenhados pelo Claude', estado('gerando_imagens', 'gerando_imagens'),
      pronto ? (c.imagensGeradas || geradas ? `${c.imagensGeradas || geradas} imagem(ns) criadas · ${c.elementos || 0} elementos` : 'não precisou criar imagens') : 'desenha objetos 3D, ícones, ilustrações e fundos ligados à fala']);
    itens.push(['Profundidade e camadas', estado('recortando', 'recortando'),
      pronto ? `${c.recorte ? 'pessoa recortada · ' : ''}${c.textosAtras || 0} textos atrás · ${c.fundos || 0} fundos · ${c.divisoes || 0} telas divididas · ${c.efeitos || 0} efeitos` : 'texto atrás da pessoa, fundo novo, tela dividida, efeitos']);
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
      <label class="ve-linha-op"><input type="checkbox" data-a="usarCor" ${op.corDestaque ? 'checked' : ''}/> Cor de destaque própria <input type="color" data-a="cor" value="${op.corDestaque || '#d4af37'}"/></label>
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

  // ---------- linha do tempo (interativa: mover, esticar, editar, apagar, zoom com Ctrl+rodinha) ----------
  // "ed" e a copia local editavel das camadas; as mudancas so vao pro video quando a pessoa clica
  // em "Aplicar edições" (re-render no servidor, sem IA)
  let ed = null;
  let historico = [];
  let selecionado = null; // { k: 'textos', i: 2 } | { k: 'legenda', pagina: [...] }
  const LISTAS_EDITAVEIS = ['textos', 'textosAtras', 'numeros', 'listas', 'insercoes', 'elementos', 'fundos', 'divisoes', 'efeitos', 'zooms', 'transicoes'];
  const NOMES = {
    textos: 'Texto', textosAtras: 'Texto atrás', numeros: 'Número', listas: 'Lista', insercoes: 'Mídia', elementos: 'Elemento',
    fundos: 'Fundo', divisoes: 'Tela dividida', efeitos: 'Efeito', zooms: 'Zoom', transicoes: 'Transição',
  };
  const OPCOES = {
    estiloTexto: { impacto: 'Impacto', '3d': 'Texto 3D', topo: 'Título no topo', etiqueta: 'Etiqueta lateral' },
    movimento: { deslizar: 'Deslizar', subir: 'Subir', zoom: 'Crescer', giro3d: 'Giro 3D' },
    modo: { tela_cheia: 'Tela cheia', janela: 'Janela' },
    camada: { atras: 'Atrás da pessoa', frente: 'Na frente' },
    posicao: { esquerda: 'Esquerda', direita: 'Direita', centro: 'Centro', topo: 'Topo' },
    movElemento: { flutuar: 'Flutuar', girar: 'Girar 3D', entrar: 'Entrar com zoom' },
    tipoFundo: { desfocado: 'Fundo desfocado', gradiente: 'Gradiente animado', escuro: 'Escuro com luz', imagem: 'Imagem' },
    layout: { cima_baixo: 'Cima e baixo', lado_a_lado: 'Lado a lado', janela_pessoa: 'Pessoa na janela' },
    efeito: {
      preto_branco: 'Preto e branco', desfoque_fundo: 'Desfoque do fundo', glitch: 'Glitch', tremor: 'Tremor', cor_quente: 'Cor quente',
      cor_fria: 'Cor fria', alto_contraste: 'Alto contraste', granulado: 'Granulado', brilho_sonho: 'Brilho de sonho', vinheta_forte: 'Vinheta forte',
    },
    zoom: { soco: 'Soco', lento: 'Lento', dramatico: 'Dramático' },
    transicao: { flash: 'Flash', whip: 'Chicote', zoom: 'Zoom', glitch: 'Glitch', luz: 'Luz vazando', giro: 'Giro', desfoque: 'Desfoque', queimado: 'Queimado de filme' },
  };
  const clonar = (o) => JSON.parse(JSON.stringify(o));

  function iniciarEdicaoLocal() {
    if (!linha) { ed = null; return; }
    ed = {};
    for (const k of LISTAS_EDITAVEIS) ed[k] = clonar(linha[k] || []);
    ed.palavras = clonar(linha.palavras || []);
    ed.legendas = linha.legendas !== false;
    historico = [];
    selecionado = null;
  }
  const sujo = () => historico.length > 0;
  function guardar() {
    historico.push(JSON.stringify(ed));
    if (historico.length > 80) historico.shift();
  }
  function desfazer() {
    if (!historico.length) return;
    ed = JSON.parse(historico.pop());
    selecionado = null;
    renderLinhaDoTempo();
    renderInspetor();
  }

  function paginarLegendas(palavras, porTela = 3) {
    const paginas = [];
    let atualPg = [];
    const fechar = () => { if (atualPg.length) paginas.push(atualPg); atualPg = []; };
    palavras.forEach((p, i) => {
      const anterior = palavras[i - 1];
      const chars = atualPg.reduce((n, w) => n + w.t.length + 1, 0);
      if (atualPg.length >= porTela || (anterior && p.i - anterior.f > 0.45) || chars + p.t.length > 18) fechar();
      atualPg.push({ ...p, idx: i });
      if (/[.!?…]$/.test(p.t)) fechar();
    });
    fechar();
    return paginas;
  }

  // cada faixa: quais listas aparecem nela
  function trilhasDef() {
    return [
      { nome: 'VÍDEO', tipo: 'video' },
      { nome: 'LEGENDA', tipo: 'legenda' },
      { nome: 'TEXTO', itens: [['textos'], ['numeros'], ['listas']] },
      { nome: 'PROFUND.', itens: [['textosAtras'], ['fundos'], ['elementos', (e) => e.camada === 'atras']] },
      { nome: 'MÍDIA', itens: [['insercoes'], ['divisoes'], ['elementos', (e) => e.camada !== 'atras']] },
      { nome: 'EFEITOS', itens: [['efeitos']], marcas: true },
      { nome: 'ÁUDIO', tipo: 'audio' },
    ];
  }

  function rotuloBloco(k, o) {
    const m = (id) => atual.midias.find((x) => x.id === id);
    switch (k) {
      case 'textos': return `${OPCOES.estiloTexto[o.estilo] || 'Texto'} · ${o.texto}`;
      case 'textosAtras': return `Atrás · ${o.texto}`;
      case 'numeros': return `${o.prefixo || ''}${o.valor}${o.sufixo || ''}`;
      case 'listas': return `Lista · ${o.titulo || ''}`;
      case 'insercoes': return `${OPCOES.modo[o.modo] || ''}`;
      case 'divisoes': return `Dividida · ${OPCOES.layout[o.layout] || ''}`;
      case 'elementos': return `${o.camada === 'atras' ? 'Atrás' : 'Frente'} · ${OPCOES.movElemento[o.movimento] || ''}`;
      case 'fundos': return OPCOES.tipoFundo[o.tipo] || 'Fundo';
      case 'efeitos': return OPCOES.efeito[o.tipo] || o.tipo;
      default: return m(o.midia)?.nome || '';
    }
  }
  const CLASSE = { textos: 'txt', numeros: 'num', listas: 'lst', textosAtras: 'atr', fundos: 'fnd', elementos: 'ele', insercoes: 'ins', divisoes: 'div', efeitos: 'efx' };

  function renderLinhaDoTempo() {
    const t = el.tempo;
    if (!linha || !ed || atual?.status !== 'pronto') {
      t.innerHTML = `<div class="ve-tempo-barra"><span>Linha do tempo</span></div><div class="ve-tempo-vazio">${
        !atual ? 'Envie um vídeo pra começar.'
          : EM_ANDAMENTO(atual.status) ? 'A linha do tempo com as camadas aparece quando a edição terminar.'
            : 'Envie o vídeo e clique em ↑ pra IA editar. As camadas da edição aparecem aqui.'}</div>`;
      return;
    }
    const L = linha;
    const fps = L.fps || 30;
    const dur = L.duracaoFrames / fps;
    const scrollAntes = el.scroll?.scrollLeft || 0;
    const trilhas = trilhasDef();
    const nEdicoes = historico.length;
    t.innerHTML = `
      <div class="ve-tempo-barra">
        <span><b data-a="relogio">0:00</b> / ${tempo(dur)}</span>
        <div class="ve-add">
          <button type="button" data-add="texto">+ Texto</button><button type="button" data-add="3d">+ Texto 3D</button>
          <button type="button" data-add="atras">+ Texto atrás</button><button type="button" data-add="efeito">+ Efeito</button>
          <button type="button" data-add="zoom">+ Zoom</button><button type="button" data-add="transicao">+ Transição</button>
          <button type="button" data-add="midia">+ Mídia</button>
        </div>
        <span class="ve-dica" style="margin-left:auto">Ctrl + rodinha: zoom · arraste pra mover · bordas pra esticar</span>
        <div class="ve-zoom"><button type="button" data-z="-" title="Diminuir">−</button><button type="button" data-z="0" title="Caber na tela">⤢</button><button type="button" data-z="+" title="Aumentar">+</button></div>
        ${nEdicoes ? `<button class="ve-btn sec" type="button" data-a="desfazer" title="Ctrl+Z">↶ Desfazer</button>
          <button class="ve-btn sec" type="button" data-a="descartar">Descartar</button>
          <button class="ve-btn forte" type="button" data-a="aplicar">Aplicar edições (${nEdicoes})</button>` : ''}
      </div>
      <div class="ve-tempo-corpo">
        <div class="ve-trilhas-rot">${trilhas.map((tr) => `<div>${tr.nome}</div>`).join('')}</div>
        <div class="ve-trilhas" data-a="scroll"><div class="ve-trilhas-in" data-a="in"></div></div>
      </div>`;
    const scroll = t.querySelector('[data-a=scroll]');
    const inn = t.querySelector('[data-a=in]');
    const larguraVisivel = scroll.clientWidth || 800;
    const pps = pxPorSeg || Math.max(4, (larguraVisivel - 10) / dur);
    inn.style.width = `${Math.max(larguraVisivel, dur * pps + 10)}px`;
    const x = (seg) => seg * pps;
    const xf = (frame) => (frame / fps) * pps;
    const sel = (k, i) => selecionado && selecionado.k === k && selecionado.i === i;
    let html = '';

    const passo = [0.5, 1, 2, 5, 10, 15, 30, 60].find((p) => p * pps >= 54) || 60;
    html += '<div class="ve-regua" data-a="regua">';
    for (let s = 0; s <= dur; s += passo) html += `<span style="left:${x(s)}px">${tempo(s)}${passo < 1 && s % 1 ? '.5' : ''}</span>`;
    html += '</div>';

    for (const tr of trilhas) {
      html += '<div class="ve-trilha">';
      if (tr.tipo === 'video') {
        html += `<div class="ve-video-faixa" style="width:${x(dur)}px;${L.temTira ? `background-image:url('${url('tira')}')` : 'background:#2a2618'}"></div>`;
        for (const s of L.segmentos.slice(1)) html += `<div class="ve-corte" style="left:${xf(s.outInicio)}px"></div>`;
      } else if (tr.tipo === 'legenda') {
        if (ed.legendas) {
          paginarLegendas(ed.palavras, L.estiloCustom?.palavrasPorTela || 3).forEach((pg, n) => {
            const a = pg[0].i;
            const b = pg[pg.length - 1].f;
            const ativo = selecionado?.k === 'legenda' && selecionado.n === n;
            html += `<div class="ve-bloco leg${ativo ? ' sel' : ''}" data-k="legenda" data-n="${n}" title="${esc(pg.map((p) => p.t).join(' '))}" style="left:${x(a)}px;width:${Math.max(3, x(b - a) - 1)}px"></div>`;
          });
        } else {
          html += '<div class="ve-bloco leg-off" data-k="legenda-off" style="left:0;width:180px">legenda desligada · clique pra ligar</div>';
        }
      } else if (tr.tipo === 'audio') {
        html += `${L.trilha ? `<div class="ve-bloco mus" style="left:0;width:${x(dur)}px;opacity:.45"></div>` : ''}<canvas class="ve-onda" data-a="onda"></canvas>`;
      } else {
        // empilha em "pistas" quando os itens se sobrepoem
        const itens = [];
        for (const [k, filtro] of tr.itens) (ed[k] || []).forEach((o, i) => { if (!filtro || filtro(o)) itens.push({ k, i, o }); });
        itens.sort((a, b) => a.o.inicio - b.o.inicio);
        const fimPista = [];
        for (const it of itens) {
          let p = fimPista.findIndex((f) => f <= it.o.inicio);
          if (p < 0) { p = fimPista.length; fimPista.push(0); }
          fimPista[p] = it.o.fim;
          it.p = p;
        }
        const pistas = Math.max(1, Math.min(3, fimPista.length));
        const alt = (27 - (pistas - 1) * 2) / pistas;
        for (const it of itens) {
          const p = Math.min(it.p, pistas - 1);
          const m = it.o.midia && atual.midias.find((mm) => mm.id === it.o.midia);
          const fundo = m && m.kind !== 'audio' ? `background-image:url('${url(`midias/${m.id}/miniatura`)}');` : '';
          html += `<div class="ve-bloco ${CLASSE[it.k] || ''}${sel(it.k, it.i) ? ' sel' : ''}" data-k="${it.k}" data-i="${it.i}" title="${esc(rotuloBloco(it.k, it.o))}"
            style="left:${xf(it.o.inicio)}px;width:${Math.max(8, xf(it.o.fim - it.o.inicio))}px;top:${2 + p * (alt + 2)}px;height:${alt}px;${fundo}">
            <i class="al e"></i><span>${esc(rotuloBloco(it.k, it.o))}</span><i class="al d"></i></div>`;
        }
        if (tr.marcas) {
          ed.zooms.forEach((z, i) => { html += `<div class="ve-marca-fx ${z.tipo}${sel('zooms', i) ? ' sel' : ''}" data-k="zooms" data-i="${i}" title="Zoom ${esc(OPCOES.zoom[z.tipo] || '')}" style="left:${xf(z.frame)}px"></div>`; });
          ed.transicoes.forEach((tt, i) => { html += `<div class="ve-marca-fx tr${sel('transicoes', i) ? ' sel' : ''}" data-k="transicoes" data-i="${i}" title="Transição: ${esc(OPCOES.transicao[tt.tipo] || '')}" style="left:${xf(tt.frame)}px"></div>`; });
        }
      }
      html += '</div>';
    }
    html += '<div class="ve-cursor" data-a="cursor" style="left:0"></div>';
    inn.innerHTML = html;
    desenharOnda(inn.querySelector('[data-a=onda]'), L.ondas || [], x(dur));

    el.cursor = inn.querySelector('[data-a=cursor]');
    el.relogio = t.querySelector('[data-a=relogio]');
    el.scroll = scroll;
    el.pps = pps;
    scroll.scrollLeft = scrollAntes;
    if (el.player) moverCursor(el.player.currentTime, false);
    ligarInteracoes(t, inn, scroll, { fps, dur, pps });
  }

  function ligarInteracoes(t, inn, scroll, { fps, dur, pps }) {
    const segDoEvento = (e) => Math.max(0, Math.min(dur, (e.clientX - inn.getBoundingClientRect().left) / pps));
    const irPara = (seg) => { if (el.player) { el.player.currentTime = seg; moverCursor(seg); } };

    // zoom com Ctrl + rodinha (ancorado no ponteiro, como no CapCut); rodinha sozinha rola pro lado
    scroll.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const segMouse = segDoEvento(e);
        const offsetTela = e.clientX - scroll.getBoundingClientRect().left;
        const base = pxPorSeg || pps;
        pxPorSeg = Math.min(600, Math.max(2, base * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
        renderLinhaDoTempo();
        el.scroll.scrollLeft = Math.max(0, segMouse * pxPorSeg - offsetTela);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        scroll.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    t.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const base = pxPorSeg || pps;
      pxPorSeg = b.dataset.z === '0' ? 0 : Math.min(600, Math.max(2, b.dataset.z === '+' ? base * 1.5 : base / 1.5));
      renderLinhaDoTempo();
    }));
    t.querySelector('[data-a=desfazer]')?.addEventListener('click', desfazer);
    t.querySelector('[data-a=descartar]')?.addEventListener('click', () => {
      if (confirm('Descartar as mudanças feitas na linha do tempo?')) { iniciarEdicaoLocal(); renderLinhaDoTempo(); renderInspetor(); }
    });
    t.querySelector('[data-a=aplicar]')?.addEventListener('click', aplicarEdicoes);
    t.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => adicionar(b.dataset.add, fps)));

    // arrastar: mover o item, esticar pelas bordas, ou arrastar o cursor na regua
    inn.addEventListener('pointerdown', (e) => {
      const alvo = e.target.closest('[data-k]');
      if (!alvo) {
        // clique/arraste em area vazia ou na regua = mexe o cursor do video
        irPara(segDoEvento(e));
        const mover = (ev) => irPara(segDoEvento(ev));
        const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
        return;
      }
      const k = alvo.dataset.k;
      if (k === 'legenda-off') { guardar(); ed.legendas = true; renderLinhaDoTempo(); return; }
      if (k === 'legenda') {
        const pg = paginarLegendas(ed.palavras, linha.estiloCustom?.palavrasPorTela || 3)[Number(alvo.dataset.n)];
        selecionado = { k: 'legenda', n: Number(alvo.dataset.n), idxs: pg.map((p) => p.idx) };
        irPara(pg[0].i + 0.01);
        renderLinhaDoTempo();
        renderInspetor();
        return;
      }
      const i = Number(alvo.dataset.i);
      const o = ed[k][i];
      const marca = k === 'zooms' || k === 'transicoes';
      const r = alvo.getBoundingClientRect();
      const modo = marca ? 'mover' : e.clientX - r.left < 7 ? 'inicio' : r.right - e.clientX < 7 ? 'fim' : 'mover';
      const x0 = e.clientX;
      const orig = { ...o };
      let mexeu = false;
      try { alvo.setPointerCapture(e.pointerId); } catch { /* sem captura o arraste segue pelo proprio bloco */ }
      const mover = (ev) => {
        const df = Math.round(((ev.clientX - x0) / pps) * fps);
        if (!mexeu && Math.abs(ev.clientX - x0) < 3) return;
        if (!mexeu) { guardar(); mexeu = true; }
        const total = linha.duracaoFrames;
        if (marca) {
          o.frame = Math.max(1, Math.min(total - 2, orig.frame + df));
          alvo.style.left = `${(o.frame / fps) * pps}px`;
          return;
        }
        if (modo === 'mover') {
          const d = orig.fim - orig.inicio;
          o.inicio = Math.max(0, Math.min(total - d, orig.inicio + df));
          o.fim = o.inicio + d;
        } else if (modo === 'inicio') {
          o.inicio = Math.max(0, Math.min(orig.fim - 6, orig.inicio + df));
        } else {
          o.fim = Math.min(total, Math.max(orig.inicio + 6, orig.fim + df));
        }
        alvo.style.left = `${(o.inicio / fps) * pps}px`;
        alvo.style.width = `${Math.max(8, ((o.fim - o.inicio) / fps) * pps)}px`;
      };
      const soltar = () => {
        alvo.removeEventListener('pointermove', mover);
        alvo.removeEventListener('pointerup', soltar);
        selecionado = { k, i };
        if (!mexeu) irPara((marca ? o.frame : o.inicio) / fps + 0.01);
        renderLinhaDoTempo();
        renderInspetor();
      };
      alvo.addEventListener('pointermove', mover);
      alvo.addEventListener('pointerup', soltar);
    });
  }

  // novo item na posicao do cursor
  function adicionar(tipo, fps) {
    const agora = Math.round((el.player?.currentTime || 0) * fps);
    const total = linha.duracaoFrames;
    const ini = Math.min(agora, total - fps * 2);
    const fim = Math.min(total, ini + fps * 2.5);
    guardar();
    let k;
    if (tipo === 'texto') { k = 'textos'; ed.textos.push({ inicio: ini, fim, texto: 'Seu texto', estilo: 'impacto' }); }
    if (tipo === '3d') { k = 'textos'; ed.textos.push({ inicio: ini, fim, texto: 'DESTAQUE', estilo: '3d' }); }
    if (tipo === 'atras') { k = 'textosAtras'; ed.textosAtras.push({ inicio: ini, fim: Math.min(total, ini + fps * 3), texto: 'TEXTO', movimento: 'deslizar' }); }
    if (tipo === 'efeito') { k = 'efeitos'; ed.efeitos.push({ inicio: ini, fim, tipo: 'preto_branco' }); }
    if (tipo === 'zoom') { k = 'zooms'; ed.zooms.push({ frame: Math.max(1, agora), tipo: 'soco' }); }
    if (tipo === 'transicao') { k = 'transicoes'; ed.transicoes.push({ frame: Math.max(1, agora), tipo: 'flash' }); }
    if (tipo === 'midia') {
      const m = atual.midias.find((mm) => (mm.tipo === 'apoio' || mm.tipo === 'gerada') && mm.kind !== 'audio');
      if (!m) { historico.pop(); aviso('Envie uma imagem ou vídeo em "Mídias para compor" primeiro.', 'erro'); return; }
      k = 'insercoes';
      ed.insercoes.push({ inicio: ini, fim, midia: m.id, modo: 'janela', kind: m.kind });
    }
    selecionado = { k, i: ed[k].length - 1 };
    renderLinhaDoTempo();
    renderInspetor();
  }

  async function aplicarEdicoes() {
    if (!confirm('Aplicar as mudanças? O vídeo é renderizado de novo (leva alguns minutos, sem gastar IA).')) return;
    try {
      const corpo = { legendas: ed.legendas, palavras: ed.palavras.map((p) => ({ t: p.t, d: !!p.d })) };
      for (const k of LISTAS_EDITAVEIS) corpo[k] = ed[k];
      atual = await api(`/api/video/edicoes/${atual.id}/edicao`, { method: 'POST', body: JSON.stringify(corpo) });
      selecionado = null;
      historico = [];
      renderTudo({ recriarPlayer: true });
      agendarPolling();
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }

  // ---------- inspetor: edita o item selecionado na linha do tempo ----------
  function renderInspetor() {
    const caixa = el.dir?.querySelector('[data-a=inspetor]');
    if (!caixa) return;
    if (!selecionado || !ed) { caixa.hidden = true; caixa.innerHTML = ''; return; }
    caixa.hidden = false;
    const fps = linha.fps || 30;
    const campo = (rot, html) => `<label class="ve-campo"><span>${rot}</span>${html}</label>`;
    const sel = (nome, opcoes, valor) => `<select data-c="${nome}">${Object.entries(opcoes).map(([v, n]) => `<option value="${v}"${v === valor ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const inp = (nome, valor, tipo = 'text', extra = '') => `<input type="${tipo}" data-c="${nome}" value="${esc(valor)}" ${extra}/>`;
    const opcoesMidia = (soImagem) => Object.fromEntries(atual.midias.filter((m) => (m.tipo === 'apoio' || m.tipo === 'gerada') && m.kind !== 'audio' && (!soImagem || m.kind === 'imagem')).map((m) => [m.id, `${m.tipo === 'gerada' ? '✦ ' : ''}${m.nome.slice(0, 40)}`]));

    if (selecionado.k === 'legenda') {
      const palavras = selecionado.idxs.map((i) => ({ i, p: ed.palavras[i] }));
      caixa.innerHTML = `<div class="ve-rot">Legenda <button class="ve-x" type="button" data-a="fechar">✕</button></div>
        ${palavras.map(({ i, p }) => `<div class="ve-palavra"><input type="text" data-p="${i}" value="${esc(p.t)}"/><label title="Destacar"><input type="checkbox" data-d="${i}" ${p.d ? 'checked' : ''}/> destaque</label></div>`).join('')}
        <div class="ve-linha-op"><button class="ve-btn sec" type="button" data-a="desligar">Desligar legendas</button></div>`;
      caixa.querySelectorAll('[data-p]').forEach((n) => n.addEventListener('change', () => { guardar(); ed.palavras[Number(n.dataset.p)].t = n.value.trim() || ed.palavras[Number(n.dataset.p)].t; renderLinhaDoTempo(); }));
      caixa.querySelectorAll('[data-d]').forEach((n) => n.addEventListener('change', () => { guardar(); ed.palavras[Number(n.dataset.d)].d = n.checked; renderLinhaDoTempo(); }));
      caixa.querySelector('[data-a=desligar]').addEventListener('click', () => { guardar(); ed.legendas = false; selecionado = null; renderLinhaDoTempo(); renderInspetor(); });
      caixa.querySelector('[data-a=fechar]').addEventListener('click', () => { selecionado = null; renderLinhaDoTempo(); renderInspetor(); });
      return;
    }

    const { k, i } = selecionado;
    const o = ed[k]?.[i];
    if (!o) { selecionado = null; caixa.hidden = true; return; }
    const marca = k === 'zooms' || k === 'transicoes';
    let campos = '';
    if (k === 'textos') campos = campo('Texto', inp('texto', o.texto, 'text', 'maxlength="80"')) + campo('Estilo', sel('estilo', OPCOES.estiloTexto, o.estilo));
    if (k === 'textosAtras') campos = campo('Texto (curto)', inp('texto', o.texto, 'text', 'maxlength="30"')) + campo('Movimento', sel('movimento', OPCOES.movimento, o.movimento));
    if (k === 'numeros') campos = campo('Valor', inp('valor', o.valor, 'number', 'step="any"')) + campo('Antes', inp('prefixo', o.prefixo || '')) + campo('Depois', inp('sufixo', o.sufixo || '')) + campo('Rótulo', inp('rotulo', o.rotulo || ''));
    if (k === 'listas') campos = campo('Título', inp('titulo', o.titulo || '')) + campo('Itens (um por linha)', `<textarea data-c="itens" rows="4">${esc((o.itens || []).join('\n'))}</textarea>`);
    if (k === 'insercoes') campos = campo('Mídia', sel('midia', opcoesMidia(false), o.midia)) + campo('Modo', sel('modo', OPCOES.modo, o.modo));
    if (k === 'divisoes') campos = campo('Mídia', sel('midia', opcoesMidia(false), o.midia)) + campo('Layout', sel('layout', OPCOES.layout, o.layout));
    if (k === 'elementos') campos = campo('Imagem', sel('midia', opcoesMidia(true), o.midia)) + campo('Camada', sel('camada', OPCOES.camada, o.camada)) + campo('Posição', sel('posicao', OPCOES.posicao, o.posicao)) + campo('Movimento', sel('movimento', OPCOES.movElemento, o.movimento));
    if (k === 'fundos') campos = campo('Tipo', sel('tipo', OPCOES.tipoFundo, o.tipo)) + (o.tipo === 'imagem' ? campo('Imagem', sel('midia', opcoesMidia(false), o.midia)) : '');
    if (k === 'efeitos') campos = campo('Efeito', sel('tipo', OPCOES.efeito, o.tipo));
    if (k === 'zooms') campos = campo('Tipo', sel('tipo', OPCOES.zoom, o.tipo));
    if (k === 'transicoes') campos = campo('Tipo', sel('tipo', OPCOES.transicao, o.tipo));
    const tempos = marca
      ? campo('Em (s)', inp('frame', (o.frame / fps).toFixed(2), 'number', 'step="0.1" min="0"'))
      : `<div class="ve-tempos">${campo('Início (s)', inp('inicio', (o.inicio / fps).toFixed(2), 'number', 'step="0.1" min="0"'))}${campo('Fim (s)', inp('fim', (o.fim / fps).toFixed(2), 'number', 'step="0.1" min="0"'))}</div>`;
    caixa.innerHTML = `<div class="ve-rot">${esc(NOMES[k] || 'Item')} <button class="ve-x" type="button" data-a="fechar">✕</button></div>
      ${campos}${tempos}
      <div class="ve-linha-op"><button class="ve-btn perigo" type="button" data-a="apagar">Apagar</button><button class="ve-btn sec" type="button" data-a="duplicar">Duplicar</button></div>`;
    caixa.querySelectorAll('[data-c]').forEach((n) => n.addEventListener('change', () => {
      guardar();
      const c = n.dataset.c;
      if (c === 'inicio' || c === 'fim' || c === 'frame') o[c] = Math.max(0, Math.min(linha.duracaoFrames, Math.round(Number(n.value) * fps)));
      else if (c === 'valor') o.valor = Number(n.value) || 0;
      else if (c === 'itens') o.itens = n.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else o[c] = n.value;
      if (!marca && o.fim <= o.inicio) o.fim = Math.min(linha.duracaoFrames, o.inicio + 6);
      if (c === 'tipo' && k === 'fundos' && o.tipo === 'imagem' && !o.midia) o.midia = Object.keys(opcoesMidia(false))[0] || '';
      renderLinhaDoTempo();
      if (c === 'tipo') renderInspetor();
    }));
    caixa.querySelector('[data-a=apagar]').addEventListener('click', () => { guardar(); ed[k].splice(i, 1); selecionado = null; renderLinhaDoTempo(); renderInspetor(); });
    caixa.querySelector('[data-a=duplicar]').addEventListener('click', () => {
      guardar();
      const copia = clonar(o);
      if (marca) copia.frame = Math.min(linha.duracaoFrames - 2, o.frame + fps);
      else { const d = o.fim - o.inicio; copia.inicio = Math.min(linha.duracaoFrames - d, o.fim); copia.fim = copia.inicio + d; }
      ed[k].push(copia);
      selecionado = { k, i: ed[k].length - 1 };
      renderLinhaDoTempo();
      renderInspetor();
    });
    caixa.querySelector('[data-a=fechar]').addEventListener('click', () => { selecionado = null; renderLinhaDoTempo(); renderInspetor(); });
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
    grad.addColorStop(0, '#d4af37');
    grad.addColorStop(1, '#f5f5f0');
    ctx.fillStyle = grad;
    const passo = canvas.width / Math.max(1, picos.length);
    const barra = Math.max(1, passo * 0.6);
    picos.forEach((v, i) => {
      const alt = Math.max(1, v * (canvas.height - 2));
      ctx.fillRect(i * passo, meio - alt / 2, barra, alt);
    });
  }

  function moverCursor(seg, acompanhar = true) {
    if (!el.cursor || !el.pps) return;
    const px = seg * el.pps;
    el.cursor.style.left = `${px}px`;
    if (el.relogio) el.relogio.textContent = tempo(seg);
    const s = el.scroll;
    // so rola sozinho enquanto o video toca (nao briga com quem esta navegando na linha do tempo)
    if (acompanhar && el.player && !el.player.paused && s && (px < s.scrollLeft || px > s.scrollLeft + s.clientWidth - 30)) {
      s.scrollLeft = Math.max(0, px - s.clientWidth / 3);
    }
  }

  // ---------- entrada/saida ----------
  window.videoAbrir = async (container, tokenApp) => {
    raiz = container;
    token = tokenApp;
    injetarEstilo();
    if (!montado) { montar(); montado = true; }
    await carregarProjetos();
    if (atual) await abrirProjeto(atual.id);
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
