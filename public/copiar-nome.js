// Clicar no nome do paciente/contato, em qualquer tela do app, copia o nome.
// Um unico ouvinte de clique no documento: nao muda a acao que o clique ja fazia (abrir conversa, editar...), so copia tambem.
// Para valer numa tela nova, basta o elemento do nome ter o atributo data-paciente (ou uma das classes abaixo).
(() => {
  const SELETORES = [
    '[data-paciente]',
    '.crm-card-nome',        // CRM, Funil Follow Up, Indicacoes, Resgate, Orcamentos em aberto
    '.aniv-nome',            // Aniversariantes
    'td.ct-nome',            // Contatos (tabela)
    '.cv-item-linha > strong', // Conversas (lista)
    '#cvNome',               // Conversas (cabecalho do chat)
    '#crmConversaNome',      // CRM (cabecalho da conversa)
  ].join(',');
  const IGNORAR = /^(sem nome|--|—|–)?$/i;

  function limparNome(el) {
    let t = (el.getAttribute('data-paciente') || el.textContent || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/^[↗↙]\s*/, '').replace(/\s*🎥$/, '').trim(); // marcas da lista de ligacoes
    return t;
  }

  async function copiar(texto) {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
    } catch { /* cai no plano B */ }
    try { // plano B (navegadores antigos / sem permissao)
      const ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  function aviso(msg, tipo) {
    if (typeof window.mostrarAviso === 'function') return window.mostrarAviso(msg, tipo);
    try { mostrarAviso(msg, tipo); } catch { /* sem aviso */ }
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.(SELETORES);
    if (el && !el.title) el.title = 'Clique para copiar o nome';
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest?.(SELETORES);
    if (!el) return;
    if (e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (String(window.getSelection?.() || '').trim()) return; // arrastou pra selecionar texto: nao copia
    const nome = limparNome(el);
    if (IGNORAR.test(nome)) return;
    const ok = await copiar(nome);
    aviso(ok ? `Nome copiado: ${nome}` : 'Não consegui copiar o nome', ok ? 'ok' : 'erro');
  });
})();
