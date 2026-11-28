// Lembretes da consulta agendada - secao dentro da aba "Follow Up Inteligente" (src/lembretesConsulta.js).
// Usa helpers do app.js (appPassword, arquivoParaBase64, mostrarAviso, marcarSalvo) - carregado depois dele.
const lcH = () => ({ 'x-app-password': appPassword, 'Content-Type': 'application/json' });
let lcEstado = { config: null, arquivos: [], consultas: [] };

function lcEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

const LC_MOMENTOS = [
  { marco: 'conf', titulo: 'Na hora em que a IA agenda — confirmação', dica: 'Sai na hora, com data, hora e o nome da doutora.', campos: [['conf', 'Texto']] },
  { marco: 'd96', titulo: '96h antes — depoimento ou antes e depois', dica: 'Anexe aqui o depoimento ou as fotos aprovadas. Só use antes e depois com autorização do paciente e dentro das regras do CFO.', campos: [['d96', 'Texto']] },
  { marco: 'd72', titulo: '72h antes — história de transformação', dica: 'A Lumia usa a versão feminina ou masculina conforme o nome do paciente. Conte só histórias reais e autorizadas, ou mantenha o relato geral.', campos: [['d72f', 'Versão para mulher'], ['d72m', 'Versão para homem']] },
  { marco: null, titulo: 'Nos outros dias — mensagem leve diária', dica: 'A IA escreve uma mensagem curta e diferente por dia, seguindo estas instruções. Os dias de 96h, 72h, 24h e o dia da consulta usam os textos próprios.', campos: [['diaria', 'Instruções para a IA']] },
  { marco: 'd24', titulo: '24h antes — pedir confirmação de presença', dica: '', campos: [['d24', 'Texto']] },
  { marco: 'dia', titulo: 'No dia da consulta — lembrete + áudio da doutora + endereço', dica: 'Anexe aqui o ÁUDIO da doutora (gravado por ela). Logo depois do áudio sai o endereço, o ponto de referência e o link do mapa preenchidos acima.', campos: [['dia', 'Texto do lembrete']] },
];

async function lcCarregar() {
  const raiz = document.getElementById('lcSecao');
  if (!raiz) return;
  try {
    const r = await fetch('/api/fu-inteligente/lembretes', { headers: lcH() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
    lcEstado = d;
    lcDesenhar(raiz);
  } catch (err) {
    raiz.textContent = '';
    raiz.appendChild(lcEl('p', 'agenda-erro', `Não consegui carregar os lembretes da consulta: ${err.message}`));
  }
}

function lcCampoTexto(rotulo, valor, { tipo = 'text', placeholder = '' } = {}) {
  const wrap = lcEl('div');
  wrap.appendChild(lcEl('label', 'auto-label', rotulo));
  const inp = lcEl('input');
  inp.type = tipo; inp.value = valor || ''; inp.placeholder = placeholder;
  wrap.appendChild(inp);
  return { wrap, inp };
}

function lcAnexos(marco) {
  const caixa = lcEl('div', 'lc-anexos');
  const lista = lcEl('div');
  const desenharLista = () => {
    lista.textContent = '';
    for (const a of lcEstado.arquivos.filter((x) => x.marco === marco)) {
      const linha = lcEl('div', 'fui-anexo');
      linha.appendChild(lcEl('span', '', `📎 ${a.nome} (${Math.max(1, Math.round(a.tamanho / 1024))} KB)`));
      const x = lcEl('button', 'crm-btn-secundario', '✕');
      x.type = 'button';
      x.addEventListener('click', async () => {
        const r = await fetch(`/api/fu-inteligente/lembretes/arquivos/${a.id}`, { method: 'DELETE', headers: lcH() });
        if (r.ok) { lcEstado.arquivos = lcEstado.arquivos.filter((y) => y.id !== a.id); desenharLista(); } else mostrarAviso('Não consegui remover o anexo.', 'erro');
      });
      linha.appendChild(x);
      lista.appendChild(linha);
    }
  };
  const input = lcEl('input');
  input.type = 'file'; input.hidden = true; input.accept = 'audio/*,image/*,video/*,.pdf,application/pdf';
  const btn = lcEl('button', 'crm-btn-secundario', '📎 Anexar áudio, foto ou vídeo');
  btn.type = 'button';
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return mostrarAviso('Arquivo grande demais - o máximo é 12 MB.', 'erro');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const base64 = await arquivoParaBase64(file);
      const r = await fetch('/api/fu-inteligente/lembretes/arquivos', {
        method: 'POST', headers: lcH(),
        body: JSON.stringify({ marco, nomeArquivo: file.name, mediaType: file.type || 'application/octet-stream', base64 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      lcEstado.arquivos.push(d.arquivo);
      desenharLista();
    } catch (err) {
      mostrarAviso(`Não consegui anexar: ${err.message}`, 'erro');
    } finally {
      btn.disabled = false; btn.textContent = '📎 Anexar áudio, foto ou vídeo';
    }
  });
  desenharLista();
  caixa.append(lista, btn, input);
  return caixa;
}

const LC_NOME_MARCO = { conf: 'Confirmação', d96: '96h', d72: '72h', d24: '24h', dia: 'Dia da consulta' };

function lcDesenhar(raiz) {
  raiz.textContent = '';
  const c = lcEstado.config;
  raiz.appendChild(lcEl('label', 'auto-label', 'Lembretes da consulta agendada'));
  raiz.appendChild(lcEl('div', 'auto-aviso',
    'Quando a Lumia agenda um paciente (direto, pré-agendamento ou agenda interna), ela acompanha até o dia da consulta: confirmação na hora, depois mensagens contadas de trás para frente a partir da data marcada (96h, 72h, 24h, e no dia). Para sozinha se a consulta for cancelada ou remarcada. Use [NOME], [DATA], [HORA], [MEDICA] e [CLINICA] nos textos.'));

  const tg = lcEl('div', 'auto-toggle-row');
  const sw = lcEl('label', 'auto-switch');
  const ativo = lcEl('input'); ativo.type = 'checkbox'; ativo.checked = !!c.ativo;
  sw.append(ativo, lcEl('span', 'auto-switch-track'));
  sw.lastChild.appendChild(lcEl('span', 'auto-switch-thumb'));
  const rotuloAtivo = lcEl('span', '', c.ativo ? 'Ativado' : 'Desativado');
  ativo.addEventListener('change', () => { rotuloAtivo.textContent = ativo.checked ? 'Ativado' : 'Desativado'; });
  tg.append(sw, rotuloAtivo);
  raiz.appendChild(tg);

  const clinica = lcCampoTexto('Nome da clínica', c.clinica, { placeholder: 'Ex: White Clinic' });
  const medica = lcCampoTexto('Doutora/doutor da avaliação (nome usado se o agendamento não trouxer)', c.medica, { placeholder: 'Ex: Dra. Luanny Calheiros' });
  const endereco = lcCampoTexto('Endereço', c.endereco);
  const referencia = lcCampoTexto('Ponto de referência', c.pontoReferencia);
  const mapa = lcCampoTexto('Link da localização (mapa)', c.linkMapa, { placeholder: 'https://...' });
  const hIni = lcCampoTexto('Enviar a partir das', c.horaInicio, { tipo: 'time' });
  const hFim = lcCampoTexto('Enviar até às', c.horaFim, { tipo: 'time' });
  const hDia = lcCampoTexto('Lembrete do dia sai às', c.horaDia, { tipo: 'time' });
  const hDiaria = lcCampoTexto('Mensagem leve diária sai às', c.horaDiaria, { tipo: 'time' });
  for (const f of [clinica, medica, endereco, referencia, mapa]) raiz.appendChild(f.wrap);
  const linhaHoras = lcEl('div', 'auto-upload-row');
  for (const f of [hIni, hFim]) linhaHoras.appendChild(f.wrap);
  raiz.appendChild(linhaHoras);
  const linhaHoras2 = lcEl('div', 'auto-upload-row');
  for (const f of [hDia, hDiaria]) linhaHoras2.appendChild(f.wrap);
  raiz.appendChild(linhaHoras2);

  const tgD = lcEl('label', 'auto-checkbox-row');
  const diaria = lcEl('input'); diaria.type = 'checkbox'; diaria.checked = c.diariaAtiva !== false;
  tgD.append(diaria, lcEl('span', '', 'Mandar uma mensagem leve nos outros dias, todos os dias até a consulta'));
  raiz.appendChild(tgD);

  const areas = {};
  for (const m of LC_MOMENTOS) {
    const bloco = lcEl('div', 'lc-bloco');
    bloco.appendChild(lcEl('label', 'auto-label', m.titulo));
    if (m.dica) bloco.appendChild(lcEl('p', 'agenda-vazia', m.dica));
    for (const [chave, rotulo] of m.campos) {
      if (m.campos.length > 1) bloco.appendChild(lcEl('p', 'agenda-vazia', rotulo));
      const ta = lcEl('textarea');
      ta.rows = 5; ta.value = c.textos[chave] || '';
      areas[chave] = ta;
      bloco.appendChild(ta);
    }
    if (m.marco) bloco.appendChild(lcAnexos(m.marco));
    raiz.appendChild(bloco);
  }

  const salvar = lcEl('button', '', 'Salvar lembretes da consulta');
  salvar.type = 'button';
  const erro = lcEl('p', 'agenda-erro'); erro.hidden = true;
  salvar.addEventListener('click', async () => {
    erro.hidden = true; salvar.disabled = true;
    try {
      const textos = {};
      for (const k of Object.keys(areas)) textos[k] = areas[k].value;
      const r = await fetch('/api/fu-inteligente/lembretes', {
        method: 'POST', headers: lcH(),
        body: JSON.stringify({
          ativo: ativo.checked, clinica: clinica.inp.value, medica: medica.inp.value, endereco: endereco.inp.value, pontoReferencia: referencia.inp.value, linkMapa: mapa.inp.value,
          horaInicio: hIni.inp.value, horaFim: hFim.inp.value, horaDia: hDia.inp.value, horaDiaria: hDiaria.inp.value, diariaAtiva: diaria.checked, textos,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'erro desconhecido');
      marcarSalvo(salvar, 'Lembretes da consulta salvos');
      lcCarregar();
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false;
    } finally {
      salvar.disabled = false;
    }
  });
  raiz.append(salvar, erro);

  // acompanhamento: consultas que a Lumia esta seguindo
  raiz.appendChild(lcEl('label', 'auto-label', 'Consultas em acompanhamento'));
  if (!lcEstado.consultas.length) {
    raiz.appendChild(lcEl('p', 'agenda-vazia', 'Nenhuma consulta agendada pela Lumia ainda.'));
  } else {
    const rotulos = { ativa: 'em acompanhamento', cancelada: 'cancelada', remarcada: 'remarcada', concluida: 'concluída' };
    for (const q of lcEstado.consultas) {
      const linha = lcEl('div', 'fui-anexo');
      const quando = new Date(q.inicio).toLocaleString('pt-BR', { timeZone: 'America/Maceio', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const enviados = q.enviados.filter((k) => LC_NOME_MARCO[k]).map((k) => LC_NOME_MARCO[k]);
      const diarias = q.enviados.filter((k) => k.startsWith('diaria')).length;
      linha.appendChild(lcEl('span', '', `${q.nome || q.numero} — ${quando}${q.medico ? ` — ${q.medico}` : ''} — ${rotulos[q.status] || q.status}${enviados.length ? ` — enviados: ${enviados.join(', ')}` : ''}${diarias ? ` + ${diarias} diária(s)` : ''}`));
      raiz.appendChild(linha);
    }
  }
}
window.lcCarregar = lcCarregar;
