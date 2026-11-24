// Modo 3 da aba Resgate: Alertas de retorno (funil dos alertas do Clinicorp + conversa de WhatsApp espelhada).
// Usa helpers do app.js (resH, mostrarAviso, criarPainelNotas, resTel, ctLerCsv, ctGarantirSheetJs...) - carregado depois dele.
let retDados = { etapas: [], resultados: {}, pacientes: [], operadores: [], instancias: [], mensagem: '' };
let retVer = 'todos';
let retArrastando = null;
let retPacienteAtual = null;
let retImpCab = [];
let retImpLinhas = [];

function retEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}
const retData = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '');
const retDH = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const retSemAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RET_FINAIS = new Set(['retornou', 'sem_sucesso']);
const RET_ABERTAS = new Set(['novo', 'tentativa1', 'tentativa2', 'tentativa3']);

async function retChamar(url, metodo = 'GET', corpo) {
  const r = await fetch(url, { method: metodo, headers: resH(), body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro inesperado.');
  return d;
}
const retErro = (id, msg) => { const e = document.getElementById(id); e.textContent = msg || ''; e.hidden = !msg; };
function retFechavel(id) {
  const m = document.getElementById(id);
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest(`[data-fechar="${id}"]`)) m.hidden = true; });
  return m;
}

// ---------------------------------------------------------------- carregar e desenhar o quadro

async function retCarregar() {
  const board = document.getElementById('retBoard');
  try {
    retDados = await retChamar('/api/resgate/retorno');
    document.getElementById('retImportarBtn').hidden = !retDados.podeConfigurar;
    document.getElementById('retCfgBtn').hidden = !retDados.podeConfigurar;
    retDesenhar();
  } catch (err) {
    board.textContent = '';
    board.appendChild(retEl('p', 'agenda-vazia', `Não consegui carregar: ${err.message}`));
  }
}

function retPassa(p, q) {
  if (document.getElementById('retOcultarFora').checked && p.na_lista === false) return false;
  if (q && !retSemAcento(`${p.nome} ${p.telefone || ''} ${p.motivo || ''}`).includes(q)) return false;
  const ativo = !RET_FINAIS.has(p.etapa);
  if (retVer === 'atrasados') return ativo && p.dias_atraso > 0;
  if (retVer === 'responderam') return ativo && (p.nao_lida || (p.respondeu && RET_ABERTAS.has(p.etapa)));
  if (retVer === 'sem_conversa') return ativo && !p.contato_id;
  return true;
}

function retDesenhar() {
  const board = document.getElementById('retBoard');
  const q = retSemAcento(document.getElementById('retBusca').value.trim());
  const todos = retDados.pacientes.filter((p) => retPassa(p, q));
  board.textContent = '';
  for (const e of retDados.etapas) {
    const doEtapa = todos.filter((p) => p.etapa === e.id);
    if (RET_FINAIS.has(e.id)) doEtapa.sort((a, b) => new Date(b.concluido_em || 0) - new Date(a.concluido_em || 0));
    else doEtapa.sort((a, b) => (a.data_alerta || '9999') < (b.data_alerta || '9999') ? -1 : 1);
    const col = retEl('div', 'crm-coluna');
    retAtivarSoltar(col, e.id);
    const head = retEl('div', 'crm-coluna-header');
    head.append(retEl('span', '', e.nome), retEl('span', 'crm-coluna-contagem', String(doEtapa.length)));
    col.appendChild(head);
    const cards = retEl('div', 'crm-coluna-cards');
    if (!doEtapa.length) cards.appendChild(retEl('div', 'crm-coluna-vazia', 'Ninguém aqui'));
    for (const p of doEtapa.slice(0, 150)) cards.appendChild(retCriarCard(p));
    if (doEtapa.length > 150) cards.appendChild(retEl('div', 'crm-coluna-vazia', `+ ${doEtapa.length - 150} (use a busca para ver)`));
    col.appendChild(cards);
    board.appendChild(col);
  }
  const ativos = retDados.pacientes.filter((p) => !RET_FINAIS.has(p.etapa));
  const atrasados = ativos.filter((p) => p.dias_atraso > 0).length;
  const responderam = ativos.filter((p) => p.nao_lida || (p.respondeu && RET_ABERTAS.has(p.etapa))).length;
  const semConversa = ativos.filter((p) => p.telefone && !p.contato_id).length;
  const semTelefone = ativos.filter((p) => !p.telefone).length;
  const quando = retDados.ultimaImportacao ? `Última importação: ${retDH(retDados.ultimaImportacao)}.` : 'Nenhuma lista importada ainda.';
  const aviso = semConversa && !retDados.instancia ? ' Escolha o número de WhatsApp em Configurações para criar as conversas.' : '';
  document.getElementById('retResumo').textContent = `${ativos.length} em andamento · ${atrasados} com alerta atrasado · ${responderam} responderam · ${semConversa} aguardando conversa${semTelefone ? ` · ${semTelefone} sem telefone` : ''}. ${quando}${aviso}`;
}

// ---------------------------------------------------------------- arrastar entre colunas

function retAtivarArraste(card, id) {
  card.draggable = true;
  card.addEventListener('dragstart', (e) => { retArrastando = id; card.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; } catch { /* sem dataTransfer */ } });
  card.addEventListener('dragend', () => { card.classList.remove('dragging'); retArrastando = null; });
}
function retAtivarSoltar(coluna, etapaId) {
  coluna.addEventListener('dragover', (e) => { if (!retArrastando) return; e.preventDefault(); coluna.classList.add('drag-over'); });
  coluna.addEventListener('dragleave', () => coluna.classList.remove('drag-over'));
  coluna.addEventListener('drop', async (e) => {
    e.preventDefault(); coluna.classList.remove('drag-over');
    const id = retArrastando; if (!id) return;
    await retMover(id, etapaId);
  });
}
async function retMover(id, etapa) {
  try { await retChamar(`/api/resgate/retorno/${id}/etapa`, 'POST', { etapa }); } catch (err) { mostrarAviso(err.message, 'erro'); }
  retCarregar();
}

// ---------------------------------------------------------------- card

function retNomePrimeiro(p) { return String(p.nome || '').trim().split(/\s+/)[0] || ''; }

function retCriarCard(p) {
  const card = retEl('div', `crm-card ind-card${p.na_lista === false ? ' ret-fora' : ''}${p.nao_lida ? ' ret-nao-lida' : ''}`);
  retAtivarArraste(card, p.id);
  card.appendChild(retEl('div', 'crm-card-nome', p.nome || 'Sem nome'));
  card.appendChild(retEl('div', 'crm-card-numero', `${p.telefone ? resTel(p.telefone) : 'sem telefone'}${p.atendente_nome ? ` · ${p.atendente_nome}` : ''}`));
  if (p.motivo) card.appendChild(retEl('div', 'ret-motivo', p.motivo));
  const tags = retEl('div', 'ind-tags');
  if (p.data_alerta) {
    const atras = p.dias_atraso > 0 && !RET_FINAIS.has(p.etapa);
    tags.appendChild(retEl('span', `ind-tag${atras ? (p.dias_atraso >= 30 ? ' vermelho' : ' laranja') : ''}`, atras ? `Alerta de ${retData(p.data_alerta)} · há ${p.dias_atraso} dia(s)` : `Alerta de ${retData(p.data_alerta)}`));
  }
  if (p.nao_lida) tags.appendChild(retEl('span', 'ind-tag ok', 'Mensagem nova'));
  else if (p.respondeu && RET_ABERTAS.has(p.etapa)) tags.appendChild(retEl('span', 'ind-tag ok', 'Respondeu'));
  if (p.na_lista === false) tags.appendChild(retEl('span', 'ind-tag', 'Saiu da lista do Clinicorp'));
  if (!p.telefone) tags.appendChild(retEl('span', 'ind-tag laranja', 'Sem telefone'));
  else if (!p.contato_id) tags.appendChild(retEl('span', 'ind-tag laranja', 'Sem conversa (escolha o número em Configurações)'));
  card.appendChild(tags);
  if (p.ultima_mensagem) card.appendChild(retEl('div', 'ind-obs', `💬 ${String(p.ultima_mensagem).slice(0, 90)}${p.ultima_mensagem_em ? ` · ${retDH(p.ultima_mensagem_em)}` : ''}`));
  if ((p.tentativas || []).length) {
    card.appendChild(retEl('div', 'ind-obs', p.tentativas.map((t) => `${t.n}ª: ${retDados.resultados?.[t.resultado] || t.resultado} (${retData(t.feita_em)})`).join(' · ')));
  }
  if (p.retorno_em) {
    const d = new Date(p.retorno_em);
    const hoje = d.toDateString() === new Date().toDateString();
    const atras = d.getTime() < Date.now() && !hoje;
    card.appendChild(retEl('div', `ind-retorno${atras ? ' vencido' : hoje ? ' hoje' : ''}`, `⏰ Lembrete ${atras ? 'atrasado' : hoje ? 'hoje' : 'em'} ${retDH(p.retorno_em)}${p.retorno_nota ? ` · ${p.retorno_nota}` : ''}`));
  }

  const acoes = retEl('div', 'ffu-acoes');
  const sel = retEl('select', 'ind-etapa-sel'); sel.title = 'Mover para outra etapa';
  for (const e of retDados.etapas) sel.add(new Option(e.nome, e.id));
  sel.value = p.etapa;
  sel.addEventListener('change', () => retMover(p.id, sel.value));
  acoes.appendChild(sel);
  const conv = retEl('button', 'ffu-exec', p.nao_lida ? 'Conversa (nova)' : 'Conversa'); conv.type = 'button';
  conv.title = 'Abre a conversa de WhatsApp deste paciente na Lumia';
  conv.addEventListener('click', () => retAbrirConversa(p));
  acoes.appendChild(conv);
  const reg = retEl('button', '', 'Registrar contato'); reg.type = 'button';
  reg.addEventListener('click', () => retAbrirTentativa(p));
  acoes.appendChild(reg);
  if (p.telefone) {
    const wa = retEl('a', 'ind-btn', 'WhatsApp'); wa.target = '_blank'; wa.rel = 'noopener';
    wa.title = 'Abre o WhatsApp Web com a mensagem pronta (a conversa pela Lumia é o botão Conversa)';
    const msg = (retDados.mensagem || '').split('{nome}').join(retNomePrimeiro(p)).split('{motivo}').join(p.motivo ? ` (${p.motivo})` : '');
    wa.href = `https://wa.me/${p.telefone}?text=${encodeURIComponent(msg)}`;
    acoes.appendChild(wa);
  }
  const rb = retEl('button', '', p.retorno_em ? 'Lembrete' : 'Criar lembrete'); rb.type = 'button';
  rb.addEventListener('click', () => retAbrirLembrete(p));
  acoes.appendChild(rb);
  const nb = retEl('button', '', p.qtd_notas ? `📝 Anotações (${p.qtd_notas})` : '📝 Anotações'); nb.type = 'button';
  nb.addEventListener('click', () => retAbrirNotas(p));
  acoes.appendChild(nb);
  if (retDados.podeConfigurar) {
    const x = retEl('button', '', 'Remover'); x.type = 'button'; x.title = 'Tira do funil (o contato volta pro CRM normal)';
    x.addEventListener('click', async () => {
      if (!confirm(`Remover ${p.nome || 'este paciente'} do funil de alertas de retorno? A conversa continua em Conversas.`)) return;
      try { await retChamar(`/api/resgate/retorno/${p.id}`, 'DELETE'); } catch (err) { mostrarAviso(err.message, 'erro'); }
      retCarregar();
    });
    acoes.appendChild(x);
  }
  card.appendChild(acoes);
  return card;
}

// ---------------------------------------------------------------- conversa (mesma conversa do CRM / Conversas)

async function retAbrirConversa(p) {
  if (!p.contato_id) { mostrarAviso(p.telefone ? 'Este paciente ainda não tem conversa: escolha o número de WhatsApp em Configurações.' : 'Este paciente não tem telefone cadastrado.', 'erro'); return; }
  const emConversas = !tabBtnConversas.hidden;
  mudarAba(emConversas ? 'conversas' : 'crm');
  try {
    const res = await fetch('/api/crm/contatos', { headers: { 'x-app-password': appPassword } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Sem acesso às conversas.');
    const c = (data.contatos || []).find((x) => x.id === p.contato_id);
    if (c) (emConversas ? abrirConversa : abrirConversaCrm)(c);
    else mostrarAviso('A conversa ainda não apareceu na lista. Tente de novo em instantes.', 'erro');
  } catch (err) { mostrarAviso(err.message, 'erro'); }
}

// ---------------------------------------------------------------- registrar contato / lembrete / notas

const retTentModal = retFechavel('retTentModal');
function retAbrirTentativa(p) {
  retPacienteAtual = p;
  document.getElementById('retTentTitulo').textContent = `Registrar contato · ${p.nome || ''}`;
  const sel = document.getElementById('retTentResultado');
  sel.textContent = '';
  for (const [k, v] of Object.entries(retDados.resultados || {})) sel.add(new Option(v, k));
  document.getElementById('retTentObs').value = '';
  retErro('retTentErro', '');
  retTentModal.hidden = false;
}
document.getElementById('retTentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = document.getElementById('retTentSalvar'); b.disabled = true;
  try {
    await retChamar(`/api/resgate/retorno/${retPacienteAtual.id}/tentativa`, 'POST', { resultado: document.getElementById('retTentResultado').value, obs: document.getElementById('retTentObs').value });
    retTentModal.hidden = true;
    retCarregar();
  } catch (err) { retErro('retTentErro', err.message); }
  b.disabled = false;
});

const retRetModal = retFechavel('retRetModal');
const retParaInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function retAbrirLembrete(p) {
  retPacienteAtual = p;
  const amanha = new Date(Date.now() + 86400000); amanha.setHours(9, 0, 0, 0);
  document.getElementById('retRetData').value = retParaInput(p.retorno_em ? new Date(p.retorno_em) : amanha);
  document.getElementById('retRetNota').value = p.retorno_nota || '';
  document.getElementById('retRetRemover').hidden = !p.retorno_em;
  retErro('retRetErro', '');
  retRetModal.hidden = false;
}
document.getElementById('retRetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = document.getElementById('retRetData').value;
  if (!v) { retErro('retRetErro', 'Escolha a data e a hora.'); return; }
  try {
    await retChamar(`/api/resgate/retorno/${retPacienteAtual.id}/retorno`, 'POST', { retornoEm: new Date(v).toISOString(), nota: document.getElementById('retRetNota').value });
    retRetModal.hidden = true;
    retCarregar();
  } catch (err) { retErro('retRetErro', err.message); }
});
document.getElementById('retRetRemover').addEventListener('click', async () => {
  try { await retChamar(`/api/resgate/retorno/${retPacienteAtual.id}/retorno`, 'DELETE'); retRetModal.hidden = true; retCarregar(); } catch (err) { retErro('retRetErro', err.message); }
});

const retNotasModal = retFechavel('retNotasModal');
function retPainelNotas() {
  if (!retPainelNotas.p) {
    retPainelNotas.p = criarPainelNotas(document.getElementById('retNotasPainel'), (id, n) => { const x = retDados.pacientes.find((k) => k.id === id); if (x) x.qtd_notas = n; }, {
      fixo: true, urlLista: (id) => `/api/resgate/retorno/${id}/notas`, urlApagar: (id) => `/api/resgate/retorno/notas/${id}`,
    });
  }
  return retPainelNotas.p;
}
function retAbrirNotas(p) {
  if (!p.contato_id) { mostrarAviso('As anotações ficam na conversa do paciente: ele ainda não tem conversa (sem telefone ou sem número de WhatsApp escolhido).', 'erro'); return; }
  document.getElementById('retNotasTitulo').textContent = `Anotações · ${p.nome}`;
  retNotasModal.hidden = false;
  retPainelNotas().definirContato(p.id);
}
retNotasModal.addEventListener('click', (e) => { if (e.target === retNotasModal || e.target.closest('[data-fechar="retNotasModal"]')) retCarregar(); });

// ---------------------------------------------------------------- adicionar paciente na mao

const retAddModal = retFechavel('retAddModal');
document.getElementById('retAddBtn').addEventListener('click', () => {
  for (const id of ['retAddNome', 'retAddTel', 'retAddMotivo', 'retAddData']) document.getElementById(id).value = '';
  retErro('retAddErro', '');
  retAddModal.hidden = false;
});
document.getElementById('retAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = document.getElementById('retAddSalvar'); b.disabled = true;
  try {
    await retChamar('/api/resgate/retorno/manual', 'POST', { nome: document.getElementById('retAddNome').value, telefone: document.getElementById('retAddTel').value, motivo: document.getElementById('retAddMotivo').value, dataAlerta: document.getElementById('retAddData').value });
    retAddModal.hidden = true;
    retCarregar();
  } catch (err) { retErro('retAddErro', err.message); }
  b.disabled = false;
});

// ---------------------------------------------------------------- configuracoes

const retCfgModal = retFechavel('retCfgModal');
document.getElementById('retCfgBtn').addEventListener('click', () => {
  const si = document.getElementById('retCfgInstancia'); si.textContent = '';
  si.add(new Option(retDados.instancias.length ? 'Escolha o número...' : 'Nenhum número conectado nesta conta', ''));
  for (const i of retDados.instancias) si.add(new Option(i, i));
  si.value = retDados.instancia || (retDados.instancias.length === 1 ? retDados.instancias[0] : '');
  const so = document.getElementById('retCfgOperador'); so.textContent = '';
  so.add(new Option('Ninguém (qualquer operador com acesso)', ''));
  for (const o of retDados.operadores) so.add(new Option(o.nome, String(o.id)));
  so.value = retDados.operadorId === null || retDados.operadorId === undefined ? '' : String(retDados.operadorId);
  document.getElementById('retCfgMensagem').value = retDados.mensagem || '';
  retErro('retCfgErro', '');
  retCfgModal.hidden = false;
});
document.getElementById('retCfgForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = document.getElementById('retCfgSalvar'); b.disabled = true;
  try {
    const op = document.getElementById('retCfgOperador').value;
    await retChamar('/api/resgate/retorno/config', 'PUT', { instancia: document.getElementById('retCfgInstancia').value || null, operadorId: op === '' ? null : Number(op), mensagem: document.getElementById('retCfgMensagem').value });
    retCfgModal.hidden = true;
    mostrarAviso('Configurações salvas', 'ok');
    retCarregar();
  } catch (err) { retErro('retCfgErro', err.message); }
  b.disabled = false;
});

// ---------------------------------------------------------------- importar lista do Clinicorp

const retImpModal = retFechavel('retImpModal');
const RET_CAMPOS = [
  { id: 'nome', rotulo: 'Nome do paciente', dica: /paciente|nome/ },
  { id: 'telefone', rotulo: 'Telefone / celular', dica: /celular|whats|telefone|fone|contato/ },
  { id: 'dataAlerta', rotulo: 'Data do alerta de retorno', dica: /retorno|alerta|vencimento|previs|data/ },
  { id: 'motivo', rotulo: 'Motivo / procedimento', dica: /motivo|procedimento|tratamento|descri|servico|observ/ },
  { id: 'pacienteId', rotulo: 'ID do paciente (opcional)', dica: /^id$|codigo|prontuario|id paciente|patient/ },
];
let retImpMapa = {};

function retImpPasso(n) {
  document.getElementById('retImpPasso1').hidden = n !== 1;
  document.getElementById('retImpPasso2').hidden = n !== 2;
  document.getElementById('retImpResultado').hidden = n !== 3;
}
document.getElementById('retImportarBtn').addEventListener('click', () => {
  document.getElementById('retImpArquivo').value = '';
  retErro('retImpErro', '');
  retImpPasso(1);
  retImpModal.hidden = false;
});
document.getElementById('retImpVoltar').addEventListener('click', () => { document.getElementById('retImpArquivo').value = ''; retImpPasso(1); });

document.getElementById('retImpArquivo').addEventListener('change', async () => {
  const arquivo = document.getElementById('retImpArquivo').files?.[0];
  if (!arquivo) return;
  try {
    const buffer = await arquivo.arrayBuffer();
    let linhas;
    if (/\.(xlsx|xls)$/i.test(arquivo.name)) {
      const XLSX = await ctGarantirSheetJs();
      const livro = XLSX.read(buffer, { type: 'array' });
      // raw: datas do Excel chegam como numero de serie (o servidor entende), sem depender do formato de data do arquivo
      linhas = XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { header: 1, raw: true, defval: '' });
    } else {
      linhas = ctLerCsv(ctDecodificarTexto(buffer));
    }
    linhas = linhas.map((l) => l.map((v) => (typeof v === 'number' ? v : String(v ?? '').trim()))).filter((l) => l.some((v) => v !== ''));
    if (linhas.length < 2) throw new Error('A planilha precisa ter uma linha de cabeçalho e pelo menos um paciente.');
    retImpCab = linhas[0].map((v) => String(v));
    retImpLinhas = linhas.slice(1);
    retMontarMapa();
    document.getElementById('retImpInfo').textContent = `${arquivo.name}: ${retImpLinhas.length} ${retImpLinhas.length === 1 ? 'linha' : 'linhas'}. Confira qual coluna é cada informação:`;
    document.getElementById('retImpCompleta').checked = false;
    retErro('retImpErro', '');
    retImpPasso(2);
    retAtualizarPrevia();
  } catch (err) {
    retErro('retImpErro', `Não consegui ler a planilha: ${err.message}`);
    document.getElementById('retImpPasso2').hidden = false;
    document.getElementById('retImpPasso1').hidden = false;
    document.getElementById('retImpArquivo').value = '';
  }
});

function retMontarMapa() {
  const box = document.getElementById('retImpMapa');
  box.textContent = '';
  retImpMapa = {};
  const usadas = new Set();
  for (const c of RET_CAMPOS) {
    const lab = retEl('label', 'ct-campo', c.rotulo);
    const sel = document.createElement('select');
    sel.add(new Option('(não usar)', ''));
    retImpCab.forEach((h, i) => sel.add(new Option(h || `Coluna ${i + 1}`, String(i))));
    const achou = retImpCab.findIndex((h, i) => !usadas.has(i) && c.dica.test(retSemAcento(h)));
    if (achou >= 0) { sel.value = String(achou); usadas.add(achou); }
    sel.addEventListener('change', retAtualizarPrevia);
    lab.appendChild(sel);
    box.appendChild(lab);
    retImpMapa[c.id] = sel;
  }
}

// linhas no formato do servidor, conforme o mapeamento escolhido; o que nao foi mapeado vira "extras" (guardado no card)
function retLinhasMapeadas() {
  const idx = Object.fromEntries(Object.entries(retImpMapa).map(([k, s]) => [k, s.value === '' ? -1 : Number(s.value)]));
  const usadas = new Set(Object.values(idx).filter((i) => i >= 0));
  return retImpLinhas.map((l) => {
    const pega = (k) => (idx[k] >= 0 ? l[idx[k]] : '');
    const extras = {};
    retImpCab.forEach((h, i) => { if (!usadas.has(i) && h && l[i] !== '' && l[i] !== undefined) extras[h] = String(l[i]); });
    return { nome: String(pega('nome') ?? ''), telefone: String(pega('telefone') ?? ''), pacienteId: String(pega('pacienteId') ?? ''), motivo: String(pega('motivo') ?? ''), dataAlerta: pega('dataAlerta'), extras };
  });
}
function retAtualizarPrevia() {
  const box = document.getElementById('retImpPrevia');
  box.textContent = '';
  const tab = document.createElement('table'); tab.className = 'ret-imp-tab';
  const th = tab.insertRow();
  for (const t of ['Nome', 'Telefone', 'Data do alerta', 'Motivo']) th.appendChild(retEl('th', '', t));
  const amostra = retLinhasMapeadas().slice(0, 5);
  for (const l of amostra) {
    const r = tab.insertRow();
    const dataTxt = typeof l.dataAlerta === 'number' ? `nº ${l.dataAlerta}` : String(l.dataAlerta || '');
    for (const v of [l.nome, l.telefone, dataTxt, l.motivo]) r.insertCell().textContent = v || '—';
  }
  box.appendChild(retEl('div', 'dim', 'Prévia das primeiras linhas:'));
  box.appendChild(tab);
  const semNome = retImpMapa.nome.value === '' && retImpMapa.telefone.value === '';
  document.getElementById('retImpConfirmar').disabled = semNome;
  if (semNome) retErro('retImpErro', 'Indique pelo menos a coluna do nome ou a do telefone.'); else retErro('retImpErro', '');
}
document.getElementById('retImpConfirmar').addEventListener('click', async () => {
  const b = document.getElementById('retImpConfirmar'); b.disabled = true; b.textContent = 'Importando...';
  try {
    const { resumo } = await retChamar('/api/resgate/retorno/importar', 'POST', { linhas: retLinhasMapeadas(), listaCompleta: document.getElementById('retImpCompleta').checked });
    retMostrarResumo(resumo);
    retCarregar();
  } catch (err) { retErro('retImpErro', err.message); }
  b.disabled = false; b.textContent = 'Importar';
});
function retMostrarResumo(r) {
  const box = document.getElementById('retImpResultado');
  box.textContent = '';
  box.appendChild(retEl('p', 'ct-info', `Importação concluída: ${r.novos} novo(s), ${r.atualizados} atualizado(s)${r.reabertos ? `, ${r.reabertos} reaberto(s)` : ''}.`));
  const itens = [];
  if (r.criados) itens.push(`${r.criados} conversa(s) criada(s) no CRM para os pacientes novos.`);
  if (r.jaExistiam) itens.push(`${r.jaExistiam} paciente(s) já estavam no CRM e passaram para este funil (saíram do funil principal).`);
  if (r.semTelefone) itens.push(`${r.semTelefone} sem telefone válido: ficam no funil, mas sem conversa até você corrigir no Clinicorp e importar de novo.`);
  if (r.semNumero) itens.push(`${r.semNumero} aguardando o número de WhatsApp: escolha em Configurações para criar as conversas.`);
  if (r.foraDaLista) itens.push(`${r.foraDaLista} saíram da lista do Clinicorp (ficam marcados).`);
  if (r.ignorados) itens.push(`${r.ignorados} linha(s) ignorada(s) (vazias ou repetidas).`);
  const ul = document.createElement('ul');
  for (const t of itens) ul.appendChild(retEl('li', '', t));
  box.appendChild(ul);
  const fechar = retEl('button', 'relatorio-config-enviar', 'Fechar'); fechar.type = 'button';
  fechar.addEventListener('click', () => { retImpModal.hidden = true; });
  box.appendChild(fechar);
  retImpPasso(3);
}

// ---------------------------------------------------------------- controles do topo

document.getElementById('retRefresh').addEventListener('click', retCarregar);
document.getElementById('retBusca').addEventListener('input', () => { if (retDados.etapas.length) retDesenhar(); });
document.getElementById('retOcultarFora').addEventListener('change', () => { if (retDados.etapas.length) retDesenhar(); });
for (const b of document.querySelectorAll('.ret-ver')) {
  b.addEventListener('click', () => {
    retVer = b.dataset.ver;
    for (const x of document.querySelectorAll('.ret-ver')) x.classList.toggle('ativo', x === b);
    if (retDados.etapas.length) retDesenhar();
  });
}
