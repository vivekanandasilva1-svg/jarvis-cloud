// Aba "Editor de Vídeo" (ver src/videoEditor.js e video-worker/). Arquivo separado do app.js de
// proposito: so e baixado na primeira vez que a aba e aberta (app.js -> abrirVideo).
(() => {
  const ESTILOS = {
    criador: { nome: 'Criador', desc: 'Legenda branca forte, destaque amarelo', cores: ['#FFFFFF', '#FFE14D'] },
    neon: { nome: 'Neon', desc: 'Roxo e rosa com brilho', cores: ['#C77DFF', '#FF5FD2'] },
    clinica: { nome: 'Clínica', desc: 'Limpo e acolhedor', cores: ['#5EEAD4', '#0F2A33'] },
    impacto: { nome: 'Impacto', desc: 'Fonte condensada, vermelho, agressivo', cores: ['#FF3B3B', '#FFFFFF'] },
    documentario: { nome: 'Documentário', desc: 'Serifado, tons quentes, grão de filme', cores: ['#E9B872', '#5A4632'] },
  };
  const FORMATOS = { '9:16': 'Reels / TikTok', '4:5': 'Feed', '1:1': 'Quadrado', '16:9': 'YouTube' };
  const ETAPAS = {
    enviando: 'Enviando', recebendo: 'Recebendo', na_fila: 'Na fila', preparando: 'Preparando o vídeo e tratando o áudio',
    transcrevendo: 'Ouvindo e transcrevendo cada palavra', dirigindo: 'IA planejando a edição', revisando: 'IA revisando a qualidade',
    renderizando: 'Renderizando o vídeo final', pronto: 'Pronto', erro: 'Erro', expirado: 'Expirado',
  };
  const EM_ANDAMENTO = (s) => !['pronto', 'erro', 'expirado'].includes(s);

  let raiz = null;
  let token = '';
  let montado = false;
  let edicoes = [];
  let selecionadaId = null;
  let timerPolling = null;
  let enviando = false;
  const escolha = { estilo: 'criador', formato: '9:16', arquivo: null };
  const el = {};

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tempo = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
  const dataBr = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const urlArquivo = (id, tipo, extra = '') => `/api/video/edicoes/${id}/${tipo}?senha=${encodeURIComponent(token)}${extra}`;

  async function api(caminho, opcoes = {}) {
    const res = await fetch(caminho, { ...opcoes, headers: { 'Content-Type': 'application/json', 'x-app-password': token, ...(opcoes.headers || {}) } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `erro ${res.status}`);
    return d;
  }

  function injetarEstilo() {
    if (document.getElementById('videoEstilo')) return;
    const st = document.createElement('style');
    st.id = 'videoEstilo';
    st.textContent = `
      .video-aba { display: flex !important; flex-direction: column; min-height: 0; padding: 14px; gap: 12px; overflow: hidden; }
      .video-aba[hidden] { display: none !important; }
      .vd-topo { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
      .vd-titulo { font-size: 15px; font-weight: 700; color: var(--gold-bright); letter-spacing: .3px; }
      .vd-sub { font-size: 12px; color: var(--text-dim); }
      .vd-corpo { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 12px; }
      .vd-col { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
      .vd-card { border: 1px solid var(--border-soft); border-radius: 12px; padding: 14px; background: var(--panel-flat); display: flex; flex-direction: column; gap: 10px; }
      .vd-card h4 { margin: 0; font-size: 13px; color: var(--gold-bright); }
      .vd-rotulo { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .6px; }
      .vd-drop { border: 1.5px dashed var(--border); border-radius: 12px; padding: 22px 14px; text-align: center; cursor: pointer; color: var(--text-dim);
        font-size: 13px; line-height: 1.5; transition: background .15s, border-color .15s; }
      .vd-drop:hover, .vd-drop.arrastando { background: rgba(212,175,55,.07); border-color: var(--gold); }
      .vd-drop b { color: var(--text); display: block; font-size: 14px; margin-bottom: 2px; word-break: break-all; }
      .vd-estilos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .vd-estilo { border: 1px solid var(--border-soft); border-radius: 10px; padding: 8px 9px; cursor: pointer; background: rgba(255,255,255,.02); }
      .vd-estilo.ativo { border-color: var(--gold); background: rgba(212,175,55,.1); }
      .vd-estilo-nome { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--text); }
      .vd-estilo-nome i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
      .vd-estilo small { display: block; font-size: 10.5px; color: var(--text-dim); margin-top: 3px; line-height: 1.35; }
      .vd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .vd-chip { font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border-soft); color: var(--text); cursor: pointer; background: rgba(255,255,255,.02); }
      .vd-chip small { color: var(--text-dim); margin-left: 4px; }
      .vd-chip.ativo { border-color: var(--gold); background: rgba(212,175,55,.12); color: var(--gold-bright); }
      .vd-card textarea, .vd-card input[type=text] { background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px;
        color: var(--text); font-size: 13px; font-family: inherit; min-width: 0; width: 100%; box-sizing: border-box; }
      .vd-card textarea { min-height: 84px; resize: vertical; }
      .vd-opcao { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text); cursor: pointer; }
      .vd-opcao input[type=color] { width: 30px; height: 24px; border: none; background: none; padding: 0; cursor: pointer; }
      .vd-btn { background: rgba(212,175,55,.16); border: 1px solid var(--border); color: var(--gold-bright); border-radius: 9px;
        padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .vd-btn:hover:not(:disabled) { background: rgba(212,175,55,.26); }
      .vd-btn:disabled { opacity: .45; cursor: default; }
      .vd-btn.sec { background: transparent; color: var(--text-dim); font-weight: 600; }
      .vd-btn.perigo { background: rgba(220,38,38,.12); border-color: rgba(220,38,38,.45); color: #f87171; font-weight: 600; }
      .vd-barra { height: 6px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; }
      .vd-barra > div { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-bright)); transition: width .4s; }
      .vd-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
      .vd-item { border: 1px solid var(--border-soft); border-radius: 12px; overflow: hidden; cursor: pointer; background: rgba(255,255,255,.02); display: flex; flex-direction: column; }
      .vd-item.ativo { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
      .vd-capa { aspect-ratio: 9 / 12; background: #0c0b09 center / cover no-repeat; display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 11px; text-align: center; padding: 8px; }
      .vd-item-info { padding: 8px 9px; display: flex; flex-direction: column; gap: 5px; }
      .vd-item-tit { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .vd-status { font-size: 11px; color: var(--text-dim); }
      .vd-status.pronto { color: #4ade80; } .vd-status.erro { color: #f87171; }
      .vd-detalhe { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 14px; align-items: start; }
      .vd-player { width: 100%; max-height: 64vh; border-radius: 12px; background: #000; border: 1px solid var(--border-soft); }
      .vd-texto { font-size: 13px; color: var(--text); line-height: 1.55; }
      .vd-dim { font-size: 12px; color: var(--text-dim); line-height: 1.5; }
      .vd-numeros { display: flex; flex-wrap: wrap; gap: 6px; }
      .vd-numeros span { font-size: 11px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--border-soft); color: var(--text-dim); }
      .vd-numeros b { color: var(--text); }
      .vd-ajuste { border-left: 2px solid var(--gold); padding: 4px 0 4px 10px; }
      .vd-ajuste b { display: block; font-size: 12px; color: var(--text); }
      .vd-ajuste span { font-size: 11.5px; color: var(--text-dim); }
      .vd-linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .vd-vazio { color: var(--text-dim); font-size: 13px; text-align: center; padding: 30px 12px; line-height: 1.6; }
      @media (max-width: 980px) {
        .video-aba { overflow-y: auto; }
        .vd-corpo { display: flex; flex-direction: column; }
        .vd-col { overflow: visible; }
        .vd-detalhe { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(st);
  }

  function montar() {
    raiz.innerHTML = `
      <div class="vd-topo">
        <span class="vd-titulo">Editor de Vídeo com IA</span>
        <span class="vd-sub">Envie o vídeo bruto. A IA corta as pausas e os erros, coloca legenda animada, títulos, zooms e números, e trata o áudio.</span>
      </div>
      <div class="vd-corpo">
        <div class="vd-col">
          <div class="vd-card">
            <h4>Nova edição</h4>
            <div class="vd-drop" data-r="drop"><b data-r="dropNome">Clique ou arraste o vídeo aqui</b>MP4 ou MOV, até 10 minutos e 1 GB</div>
            <input type="file" accept="video/*" data-r="arquivo" hidden />
            <span class="vd-rotulo">Estilo</span>
            <div class="vd-estilos" data-r="estilos"></div>
            <span class="vd-rotulo">Formato</span>
            <div class="vd-chips" data-r="formatos"></div>
            <span class="vd-rotulo">O que você quer (opcional)</span>
            <textarea data-r="instrucoes" maxlength="2000" placeholder="Ex: corte as partes em que eu gaguejo, destaque os preços e coloque uma lista com os 3 benefícios do tratamento"></textarea>
            <label class="vd-opcao"><input type="checkbox" data-r="usarCor" /> Cor de destaque própria <input type="color" data-r="cor" value="#d4af37" /></label>
            <label class="vd-opcao"><input type="checkbox" data-r="legendas" checked /> Legendas animadas</label>
            <label class="vd-opcao"><input type="checkbox" data-r="revisao" checked /> Revisão automática de qualidade pela IA</label>
            <div class="vd-barra" data-r="barraEnvio" hidden><div style="width:0%"></div></div>
            <button class="vd-btn" type="button" data-r="btnEnviar" disabled>Editar com IA</button>
          </div>
        </div>
        <div class="vd-col">
          <div class="vd-card" data-r="detalhe" hidden></div>
          <div class="vd-card">
            <h4>Suas edições</h4>
            <div class="vd-lista" data-r="lista"><div class="vd-vazio">Carregando...</div></div>
          </div>
        </div>
      </div>`;
    raiz.querySelectorAll('[data-r]').forEach((n) => { el[n.dataset.r] = n; });

    for (const [chave, e] of Object.entries(ESTILOS)) {
      const d = document.createElement('div');
      d.className = `vd-estilo${chave === escolha.estilo ? ' ativo' : ''}`;
      d.innerHTML = `<div class="vd-estilo-nome">${e.cores.map((c) => `<i style="background:${c}"></i>`).join('')}${esc(e.nome)}</div><small>${esc(e.desc)}</small>`;
      d.addEventListener('click', () => {
        escolha.estilo = chave;
        el.estilos.querySelectorAll('.vd-estilo').forEach((x) => x.classList.toggle('ativo', x === d));
      });
      el.estilos.appendChild(d);
    }
    for (const [chave, nome] of Object.entries(FORMATOS)) {
      const c = document.createElement('span');
      c.className = `vd-chip${chave === escolha.formato ? ' ativo' : ''}`;
      c.innerHTML = `${chave}<small>${esc(nome)}</small>`;
      c.addEventListener('click', () => {
        escolha.formato = chave;
        el.formatos.querySelectorAll('.vd-chip').forEach((x) => x.classList.toggle('ativo', x === c));
      });
      el.formatos.appendChild(c);
    }

    el.drop.addEventListener('click', () => el.arquivo.click());
    el.arquivo.addEventListener('change', () => escolherArquivo(el.arquivo.files[0]));
    el.drop.addEventListener('dragover', (e) => { e.preventDefault(); el.drop.classList.add('arrastando'); });
    el.drop.addEventListener('dragleave', () => el.drop.classList.remove('arrastando'));
    el.drop.addEventListener('drop', (e) => {
      e.preventDefault();
      el.drop.classList.remove('arrastando');
      escolherArquivo(e.dataTransfer.files[0]);
    });
    el.cor.addEventListener('input', () => { el.usarCor.checked = true; });
    el.btnEnviar.addEventListener('click', enviar);
  }

  function escolherArquivo(arquivo) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(arquivo.name)) {
      alert('Escolha um arquivo de vídeo.');
      return;
    }
    if (arquivo.size > 1024 * 1024 * 1024) {
      alert('O vídeo passa de 1 GB. Envie um arquivo menor.');
      return;
    }
    escolha.arquivo = arquivo;
    el.dropNome.textContent = arquivo.name;
    el.btnEnviar.disabled = false;
  }

  // XMLHttpRequest (e nao fetch) so pra ter a barra de progresso do envio
  function enviar() {
    if (!escolha.arquivo || enviando) return;
    enviando = true;
    el.btnEnviar.disabled = true;
    el.btnEnviar.textContent = 'Enviando...';
    el.barraEnvio.hidden = false;
    const q = new URLSearchParams({
      estilo: escolha.estilo, formato: escolha.formato, nome: escolha.arquivo.name,
      instrucoes: el.instrucoes.value.trim(),
      legendas: el.legendas.checked ? '1' : '0', revisao: el.revisao.checked ? '1' : '0',
    });
    if (el.usarCor.checked) q.set('cor', el.cor.value);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/video/edicoes?${q}`);
    xhr.setRequestHeader('x-app-password', token);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) el.barraEnvio.firstElementChild.style.width = `${(e.loaded / e.total) * 100}%`;
    };
    const terminar = () => {
      enviando = false;
      el.btnEnviar.textContent = 'Editar com IA';
      el.barraEnvio.hidden = true;
      el.barraEnvio.firstElementChild.style.width = '0%';
    };
    xhr.onload = () => {
      terminar();
      let d = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* resposta vazia */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        escolha.arquivo = null;
        el.arquivo.value = '';
        el.dropNome.textContent = 'Clique ou arraste o vídeo aqui';
        el.instrucoes.value = '';
        selecionadaId = d.id;
        carregar();
      } else {
        el.btnEnviar.disabled = false;
        alert(`Não consegui enviar: ${d.erro || xhr.status}`);
      }
    };
    xhr.onerror = () => {
      terminar();
      el.btnEnviar.disabled = false;
      alert('A conexão caiu durante o envio. Tente de novo.');
    };
    xhr.send(escolha.arquivo);
  }

  function textoStatus(e) {
    if (e.status === 'na_fila' && e.posicaoFila > 1) return `Na fila (${e.posicaoFila}º)`;
    if (EM_ANDAMENTO(e.status)) {
      const pct = e.progresso != null ? ` · ${Math.round(e.progresso * 100)}%` : '';
      return `${ETAPAS[e.etapa] || ETAPAS[e.status] || 'Processando'}${pct}`;
    }
    if (e.status === 'pronto') return `Pronto${e.duracaoFinal ? ` · ${tempo(e.duracaoFinal)}` : ''}`;
    return ETAPAS[e.status] || e.status;
  }

  function renderLista() {
    if (!edicoes.length) {
      el.lista.innerHTML = '<div class="vd-vazio">Nenhuma edição ainda. Envie seu primeiro vídeo ao lado.</div>';
      return;
    }
    el.lista.innerHTML = '';
    for (const e of edicoes) {
      const item = document.createElement('div');
      item.className = `vd-item${e.id === selecionadaId ? ' ativo' : ''}`;
      const capa = e.status === 'pronto' ? `style="background-image:url('${urlArquivo(e.id, 'capa')}')"` : '';
      item.innerHTML = `
        <div class="vd-capa" ${capa}>${e.status === 'pronto' ? '' : esc(ETAPAS[e.status] || '')}</div>
        <div class="vd-item-info">
          <div class="vd-item-tit" title="${esc(e.titulo || e.nomeArquivo)}">${esc(e.titulo || e.nomeArquivo)}</div>
          ${EM_ANDAMENTO(e.status) ? `<div class="vd-barra"><div style="width:${Math.round((e.progresso || 0.02) * 100)}%"></div></div>` : ''}
          <div class="vd-status ${esc(e.status)}">${esc(textoStatus(e))}</div>
        </div>`;
      item.addEventListener('click', () => { selecionadaId = e.id; renderLista(); renderDetalhe(); });
      el.lista.appendChild(item);
    }
  }

  let detalheRenderizado = null; // evita recriar o <video> (e perder a posicao) a cada polling
  function renderDetalhe() {
    const e = edicoes.find((x) => x.id === selecionadaId);
    if (!e) { el.detalhe.hidden = true; detalheRenderizado = null; return; }
    el.detalhe.hidden = false;
    const chave = `${e.id}|${e.status}|${e.etapa}|${Math.round((e.progresso || 0) * 50)}|${(e.ajustes || []).length}`;
    if (chave === detalheRenderizado) return;
    detalheRenderizado = chave;

    const titulo = esc(e.titulo || e.nomeArquivo);
    if (EM_ANDAMENTO(e.status)) {
      el.detalhe.innerHTML = `
        <h4>${titulo}</h4>
        <div class="vd-texto">${esc(textoStatus(e))}</div>
        <div class="vd-barra"><div style="width:${Math.round((e.progresso || 0.02) * 100)}%"></div></div>
        ${e.ajustePendente ? `<div class="vd-dim">Aplicando o ajuste: "${esc(e.ajustePendente)}"</div>` : ''}
        <div class="vd-dim">Pode sair desta tela. A edição continua no servidor e aparece aqui quando terminar.</div>`;
      return;
    }
    if (e.status !== 'pronto') {
      el.detalhe.innerHTML = `
        <h4>${titulo}</h4>
        <div class="vd-texto">${e.status === 'expirado' ? 'Os arquivos desta edição já foram apagados (ficam guardados por 30 dias).' : `Não deu certo: ${esc(e.erro || 'erro desconhecido')}`}</div>
        <div class="vd-linha"><button class="vd-btn perigo" type="button" data-a="apagar">Remover da lista</button></div>`;
      el.detalhe.querySelector('[data-a=apagar]').addEventListener('click', () => apagar(e));
      return;
    }
    const c = e.contagem || {};
    el.detalhe.innerHTML = `
      <div class="vd-detalhe">
        <video class="vd-player" controls playsinline preload="metadata" src="${urlArquivo(e.id, 'video')}"></video>
        <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
          <h4>${titulo}</h4>
          ${e.resumo ? `<div class="vd-texto">${esc(e.resumo)}</div>` : ''}
          <div class="vd-numeros">
            ${e.duracaoOriginal ? `<span><b>${tempo(e.duracaoOriginal)}</b> → <b>${tempo(e.duracaoFinal)}</b></span>` : ''}
            <span><b>${c.cortes ?? 0}</b> cortes</span><span><b>${c.zooms ?? 0}</b> zooms</span>
            <span><b>${(c.textos ?? 0) + (c.numeros ?? 0) + (c.listas ?? 0)}</b> animações</span>
          </div>
          ${(e.problemasCorrigidos || []).length ? `<div class="vd-dim">A revisão da IA corrigiu: ${e.problemasCorrigidos.map(esc).join('; ')}</div>` : ''}
          ${(e.ajustes || []).map((a) => `<div class="vd-ajuste"><b>${esc(a.pedido)}</b><span>${esc(a.resumo || '')}</span></div>`).join('')}
          <span class="vd-rotulo">Pedir ajuste</span>
          <textarea data-a="pedido" maxlength="2000" placeholder="Ex: tira o zoom do começo, deixa a legenda maior, coloca o preço R$ 290 em destaque quando eu falar"></textarea>
          <div class="vd-linha">
            <button class="vd-btn" type="button" data-a="ajustar">Aplicar ajuste</button>
            <a class="vd-btn sec" href="${urlArquivo(e.id, 'video', '&baixar=1')}" download>Baixar MP4</a>
            <button class="vd-btn perigo" type="button" data-a="apagar">Apagar</button>
          </div>
          <div class="vd-dim">${esc(ESTILOS[e.estilo]?.nome || e.estilo || '')} · ${esc(e.formato || '')} · enviado em ${esc(dataBr(e.criadoEm))}</div>
        </div>
      </div>`;
    el.detalhe.querySelector('[data-a=apagar]').addEventListener('click', () => apagar(e));
    el.detalhe.querySelector('[data-a=ajustar]').addEventListener('click', async (ev) => {
      const pedido = el.detalhe.querySelector('[data-a=pedido]').value.trim();
      if (!pedido) return;
      ev.target.disabled = true;
      try {
        await api(`/api/video/edicoes/${e.id}/ajustar`, { method: 'POST', body: JSON.stringify({ pedido }) });
        await carregar();
      } catch (err) {
        alert(err.message);
        ev.target.disabled = false;
      }
    });
  }

  async function apagar(e) {
    if (!confirm(`Apagar "${e.titulo || e.nomeArquivo}"? O vídeo editado será excluído.`)) return;
    try {
      await api(`/api/video/edicoes/${e.id}`, { method: 'DELETE' });
      if (selecionadaId === e.id) selecionadaId = null;
      await carregar();
    } catch (err) {
      alert(err.message);
    }
  }

  async function carregar() {
    try {
      const d = await api('/api/video/edicoes');
      edicoes = d.edicoes || [];
      if (selecionadaId && !edicoes.some((e) => e.id === selecionadaId)) selecionadaId = null;
      if (!selecionadaId && edicoes.length) selecionadaId = edicoes[0].id;
      renderLista();
      renderDetalhe();
    } catch (err) {
      el.lista.innerHTML = `<div class="vd-vazio">${esc(err.message)}</div>`;
    }
    agendarPolling();
  }

  function agendarPolling() {
    clearTimeout(timerPolling);
    if (raiz?.hidden || !edicoes.some((e) => EM_ANDAMENTO(e.status))) return;
    timerPolling = setTimeout(carregar, 4000);
  }

  window.videoAbrir = (container, tokenApp) => {
    raiz = container;
    token = tokenApp;
    injetarEstilo();
    if (!montado) { montar(); montado = true; }
    carregar();
  };
  window.videoPausar = () => clearTimeout(timerPolling);
})();
