// "diretor de edicao": o Claude le a transcricao (palavra por palavra, numerada), ve quadros do
// video, as midias enviadas e o perfil de estilo da referencia (se houver), e devolve o plano de
// edicao completo - cortes, textos (inclusive 3D e por tras da pessoa), imagens a gerar com IA,
// elementos, fundos, tela dividida, efeitos e transicoes. Ele NAO escreve codigo: o plano e um JSON
// validado por schema, ancorado nos NUMEROS das palavras, e o visual vem da biblioteca de
// componentes (remotion/) - o resultado mantem padrao profissional e nao quebra o render.
// O repertorio e as regras de oficio ficam em manualEdicao.js.
import fs from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { MANUAL } from './manualEdicao.js';

const MODELO = 'claude-opus-5-5';
const client = new Anthropic();

const intervalo = (extra = {}) => ({
  type: 'object', additionalProperties: false,
  properties: { de: { type: 'integer' }, ate: { type: 'integer' }, ...extra },
  required: ['de', 'ate', ...Object.keys(extra)],
});
const enumStr = (valores) => ({ type: 'string', enum: valores });

export const TIPOS_EFEITO = ['preto_branco', 'desfoque_fundo', 'glitch', 'tremor', 'cor_quente', 'cor_fria', 'alto_contraste', 'granulado', 'brilho_sonho', 'vinheta_forte'];
export const TIPOS_TRANSICAO = ['flash', 'whip', 'zoom', 'glitch', 'luz', 'giro', 'desfoque', 'queimado'];

const SCHEMA_PLANO = {
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string', description: 'nome curto do video (ate 6 palavras)' },
    resumo: { type: 'string', description: 'as escolhas criativas principais, em 2-4 frases para o cliente ler' },
    remover: { type: 'array', items: intervalo({ motivo: { type: 'string' } }) },
    destaques: { type: 'array', items: { type: 'integer' } },
    zooms: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { palavra: { type: 'integer' }, tipo: enumStr(['soco', 'lento', 'dramatico']) }, required: ['palavra', 'tipo'] },
    },
    transicoes: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { palavra: { type: 'integer' }, tipo: enumStr(TIPOS_TRANSICAO) }, required: ['palavra', 'tipo'] },
    },
    textos: { type: 'array', items: intervalo({ texto: { type: 'string' }, estilo: enumStr(['impacto', '3d', 'topo', 'etiqueta']) }) },
    textos_atras: { type: 'array', items: intervalo({ texto: { type: 'string' }, movimento: enumStr(['deslizar', 'subir', 'zoom', 'giro3d']) }) },
    numeros: { type: 'array', items: intervalo({ valor: { type: 'number' }, prefixo: { type: 'string' }, sufixo: { type: 'string' }, rotulo: { type: 'string' } }) },
    listas: { type: 'array', items: intervalo({ titulo: { type: 'string' }, itens: { type: 'array', items: { type: 'string' } } }) },
    gerar_imagens: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { id: { type: 'string' }, prompt: { type: 'string' }, tipo: enumStr(['foto', 'render_3d', 'ilustracao', 'fundo']), recortar: { type: 'boolean' } },
        required: ['id', 'prompt', 'tipo', 'recortar'],
      },
    },
    insercoes: { type: 'array', items: intervalo({ midia: { type: 'string' }, modo: enumStr(['tela_cheia', 'janela']) }) },
    elementos: {
      type: 'array',
      items: intervalo({ imagem: { type: 'string' }, camada: enumStr(['atras', 'frente']), posicao: enumStr(['esquerda', 'direita', 'centro', 'topo']), movimento: enumStr(['flutuar', 'girar', 'entrar']) }),
    },
    fundos: { type: 'array', items: intervalo({ tipo: enumStr(['imagem', 'gradiente', 'desfocado', 'escuro']), imagem: { type: 'string' } }) },
    divisoes: { type: 'array', items: intervalo({ midia: { type: 'string' }, layout: enumStr(['cima_baixo', 'lado_a_lado', 'janela_pessoa']) }) },
    efeitos: { type: 'array', items: intervalo({ tipo: enumStr(TIPOS_EFEITO) }) },
    trilha: { type: 'string', description: 'id da midia de audio usada como trilha de fundo, ou string vazia' },
    posicao_legenda: enumStr(['baixo', 'meio']),
    legendas: { type: 'boolean', description: 'false quando o video ja tem legenda propria gravada na imagem' },
    altura_textos: { type: 'string', enum: ['alta', 'media'], description: 'alta = topo da tela; media = logo abaixo do rosto' },
  },
  required: ['titulo', 'resumo', 'remover', 'destaques', 'zooms', 'transicoes', 'textos', 'textos_atras', 'numeros', 'listas', 'gerar_imagens', 'insercoes', 'elementos', 'fundos', 'divisoes', 'efeitos', 'trilha', 'posicao_legenda', 'legendas', 'altura_textos'],
};

const SISTEMA = MANUAL;

function formatarTranscricao(palavras) {
  return palavras.map((p, n) => `[${n}] ${p.t} (${p.i.toFixed(2)}s)`).join('\n');
}

const MAX_IMAGENS = 6;

// descarta o que aponta pra palavra/midia inexistente - o plano que chega no render e sempre valido.
// idsMidia = midias enviadas pelo cliente; idsGeradas = imagens ja geradas em rodadas anteriores
function validarIndices(plano, total, idsMidia = new Set(), idsGeradas = new Set()) {
  const ok = (n) => Number.isInteger(n) && n >= 0 && n < total;
  const okIntervalo = (x) => ok(x.de) && ok(x.ate) && x.ate >= x.de;
  const gerar = (plano.gerar_imagens || [])
    .filter((g) => /^[a-zA-Z0-9_-]{1,20}$/.test(g.id) && g.prompt?.trim() && !idsMidia.has(g.id) && !idsGeradas.has(g.id))
    .slice(0, MAX_IMAGENS);
  const visuais = new Set([...idsMidia, ...idsGeradas, ...gerar.map((g) => g.id)]);
  return {
    ...plano,
    remover: (plano.remover || []).filter(okIntervalo),
    destaques: (plano.destaques || []).filter(ok),
    zooms: (plano.zooms || []).filter((z) => ok(z.palavra)),
    transicoes: (plano.transicoes || []).filter((t) => ok(t.palavra)),
    textos: (plano.textos || []).filter((t) => okIntervalo(t) && t.texto.trim()),
    textos_atras: (plano.textos_atras || []).filter((t) => okIntervalo(t) && t.texto.trim()),
    numeros: (plano.numeros || []).filter((x) => okIntervalo(x) && Number.isFinite(x.valor)),
    listas: (plano.listas || []).filter((l) => okIntervalo(l) && l.itens.length),
    gerar_imagens: gerar,
    insercoes: (plano.insercoes || []).filter((x) => okIntervalo(x) && visuais.has(x.midia)),
    elementos: (plano.elementos || []).filter((x) => okIntervalo(x) && visuais.has(x.imagem)),
    fundos: (plano.fundos || []).filter((x) => okIntervalo(x) && (x.tipo !== 'imagem' || visuais.has(x.imagem))),
    divisoes: (plano.divisoes || []).filter((x) => okIntervalo(x) && visuais.has(x.midia)),
    efeitos: (plano.efeitos || []).filter(okIntervalo),
    trilha: idsMidia.has(plano.trilha) ? plano.trilha : '',
    legendas: plano.legendas !== false,
    altura_textos: plano.altura_textos === 'media' ? 'media' : 'alta',
  };
}

// tira do plano o que depende de uma imagem que nao foi gerada (falha no Gemini)
export function semImagens(plano, faltando) {
  if (!faltando.size) return plano;
  return {
    ...plano,
    insercoes: plano.insercoes.filter((x) => !faltando.has(x.midia)),
    elementos: plano.elementos.filter((x) => !faltando.has(x.imagem)),
    fundos: plano.fundos.filter((x) => !faltando.has(x.imagem)),
    divisoes: plano.divisoes.filter((x) => !faltando.has(x.midia)),
  };
}

// o plano usa algo que exige a pessoa recortada?
export function precisaRecorte(plano) {
  return (plano.textos_atras || []).length > 0 || (plano.fundos || []).length > 0
    || (plano.elementos || []).some((e) => e.camada === 'atras') || (plano.efeitos || []).some((e) => e.tipo === 'desfoque_fundo');
}

async function imagem(arquivo, legenda) {
  const dados = await fs.readFile(arquivo).catch(() => null);
  if (!dados) return [];
  return [
    { type: 'text', text: legenda },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dados.toString('base64') } },
  ];
}

// contexto visual: quadros do video bruto + miniaturas das midias de apoio
async function blocosVisuais({ quadros = [], apoio = [] }) {
  const blocos = [];
  for (const q of quadros) blocos.push(...(await imagem(q.arquivo, `Quadro do video bruto em ${q.segundo.toFixed(1)}s:`)));
  for (const m of apoio) {
    if (m.kind === 'audio') continue;
    blocos.push(...(await imagem(m.miniatura, m.tipo === 'gerada' ? `Imagem gerada por IA antes, id "${m.id}" (pode reutilizar):` : `Midia de apoio id "${m.id}" (${m.kind === 'video' ? `video de ${m.duracao?.toFixed(1)}s` : 'imagem'}, arquivo "${m.nome}"):`)));
  }
  return blocos;
}

function contexto({ palavras, meta, opcoes, apoio = [], referencia }) {
  const linhas = [
    `Video: ${meta.duracao.toFixed(1)} segundos, formato ${opcoes.formato}, estilo visual "${opcoes.estilo}".`,
    opcoes.instrucoes ? `Instrucoes do cliente: ${opcoes.instrucoes}` : 'O cliente nao deu instrucoes especificas.',
  ];
  if (apoio.length) {
    linhas.push('', 'Midias disponiveis (enviadas pelo cliente ou ja geradas por IA):');
    for (const m of apoio) linhas.push(`- id "${m.id}": ${m.tipo === 'gerada' ? `imagem gerada por IA (${m.nome})` : `${m.kind}${m.duracao ? ` de ${m.duracao.toFixed(1)}s` : ''}, arquivo "${m.nome}"`}`);
  } else {
    linhas.push('', 'Nenhuma midia enviada pelo cliente - se precisar de imagem, gere com gerar_imagens. trilha "".');
  }
  if (referencia) {
    linhas.push('', 'PERFIL DE ESTILO do video referencia (imite o jeito de editar):', JSON.stringify(referencia));
  }
  linhas.push('', 'Transcricao:', formatarTranscricao(palavras));
  return linhas.join('\n');
}

async function chamar(conteudo, schema, esforco) {
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: esforco, format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  if (resposta.stop_reason === 'refusal') throw new Error('a IA recusou editar esse video');
  if (resposta.stop_reason === 'max_tokens') throw new Error('o plano de edicao ficou grande demais - tente um video mais curto');
  return JSON.parse(resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

const PLANO_VAZIO = { titulo: 'Vídeo sem fala', resumo: 'Não encontrei fala no vídeo, então apliquei só o tratamento de imagem e áudio.', remover: [], destaques: [], zooms: [], transicoes: [], textos: [], textos_atras: [], numeros: [], listas: [], gerar_imagens: [], insercoes: [], elementos: [], fundos: [], divisoes: [], efeitos: [], trilha: '', posicao_legenda: 'baixo', legendas: false, altura_textos: 'alta' };

export async function planejar({ palavras, meta, opcoes, quadros, apoio = [], referencia = null }) {
  const ids = new Set(apoio.map((m) => m.id));
  if (!palavras.length) {
    const trilha = apoio.find((m) => m.kind === 'audio' && m.tipo !== 'gerada')?.id || '';
    return { ...PLANO_VAZIO, trilha };
  }
  const conteudo = [...(await blocosVisuais({ quadros, apoio })), { type: 'text', text: contexto({ palavras, meta, opcoes, apoio, referencia }) }];
  return validarIndices(await chamar(conteudo, SCHEMA_PLANO, 'high'), palavras.length, ids);
}

// ajuste pedido pelo cliente depois de ver o resultado ("tira o zoom do comeco", "poe uma lista
// com os 3 beneficios") - devolve o plano INTEIRO revisado, nao so a diferenca
export async function ajustar({ palavras, meta, opcoes, planoAtual, pedido, quadros, apoio = [], referencia = null }) {
  const texto = [
    contexto({ palavras, meta, opcoes, apoio, referencia }),
    '',
    'Plano de edicao atual:',
    JSON.stringify(planoAtual),
    '',
    `O cliente viu o video editado e pediu este ajuste: "${pedido}"`,
    'Devolva o plano completo revisado aplicando o pedido. Mantenha tudo que o cliente nao pediu pra mudar. No "resumo", conte em 1-2 frases o que mudou.',
  ].join('\n');
  const conteudo = [...(await blocosVisuais({ quadros, apoio })), { type: 'text', text: texto }];
  return validarIndices(await chamar(conteudo, SCHEMA_PLANO, 'high'), palavras.length, new Set(apoio.map((m) => m.id)));
}

// revisao de qualidade ANTES da renderizacao final: o Claude olha quadros de previa nos momentos
// com sobreposicao e confere o que so da pra ver na imagem (texto em cima do rosto, texto cortado,
// poluicao). Se achar problema, devolve o plano corrigido; senao, null.
const SCHEMA_REVISAO = {
  type: 'object', additionalProperties: false,
  properties: {
    aprovado: { type: 'boolean' },
    problemas: { type: 'array', items: { type: 'string' } },
    plano: { anyOf: [SCHEMA_PLANO, { type: 'null' }] },
  },
  required: ['aprovado', 'problemas', 'plano'],
};

export async function revisarQuadros({ palavras, planoAtual, quadros, apoio = [] }) {
  const conteudo = [];
  for (const q of quadros) conteudo.push(...(await imagem(q.arquivo, `Quadro em ${q.segundo.toFixed(1)}s - ${q.descricao}`)));
  conteudo.push({
    type: 'text',
    text: [
      'Acima estao quadros de previa do video editado. Plano usado:',
      JSON.stringify(planoAtual),
      '',
      `Transcricao (${palavras.length} palavras) para referencia dos numeros:`,
      formatarTranscricao(palavras),
      '',
      'Revise como um editor exigente olhando so o que da pra ver na imagem: texto sobreposto cobrindo o rosto, texto saindo da tela ou cortado, erro de ortografia, excesso de elementos ao mesmo tempo, legenda ilegivel, duas legendas sobrepostas (o video ja tinha legenda gravada). Se estiver bom, aprovado=true e plano=null. Se tiver problema que se resolve mudando o plano (encurtar texto, trocar estilo "impacto" por "topo", mover ou remover um elemento, mudar posicao_legenda, legendas=false, altura_textos, trocar o modo de uma insercao, mover um elemento ou texto atras pra outra posicao, tirar um efeito que ficou feio), aprovado=false, liste os problemas e devolva o plano completo corrigido. Nao mude o que esta bom.',
    ].join('\n'),
  });
  const r = await chamar(conteudo, SCHEMA_REVISAO, 'medium').catch(() => ({ aprovado: true, problemas: [], plano: null }));
  if (r.plano) r.plano = validarIndices(r.plano, palavras.length, new Set(apoio.map((m) => m.id)));
  return r;
}

// ---------- estudo do video referencia ----------

export const SCHEMA_PERFIL = {
  type: 'object', additionalProperties: false,
  properties: {
    resumo: { type: 'string', description: 'descricao curta do estilo de edicao, para o cliente ler (1-2 frases)' },
    estilo_base: { type: 'string', enum: ['criador', 'neon', 'clinica', 'impacto', 'documentario'] },
    cor_destaque: { type: 'string', description: 'hex #RRGGBB da cor de destaque das legendas/textos' },
    cor_texto: { type: 'string', description: 'hex #RRGGBB da cor principal do texto' },
    fonte: { type: 'string', enum: ['montserrat', 'poppins', 'inter', 'anton', 'playfair'], description: 'a fonte disponivel mais parecida com a da referencia' },
    maiusculas: { type: 'boolean' },
    palavras_por_tela: { type: 'integer', description: 'quantas palavras a legenda mostra por vez (1 a 5)' },
    legenda_com_fundo: { type: 'boolean', description: 'legenda dentro de uma caixa/tarja escura' },
    contorno: { type: 'boolean', description: 'texto com contorno/sombra forte' },
    brilho: { type: 'boolean', description: 'texto com brilho neon' },
    posicao_legenda: { type: 'string', enum: ['baixo', 'meio'] },
    altura_textos: { type: 'string', enum: ['alta', 'media'] },
    transicao: { type: 'string', enum: ['corte_seco', 'zoom', 'flash', 'deslize'] },
    ritmo: { type: 'string', enum: ['calmo', 'medio', 'rapido'] },
    intensidade_zoom: { type: 'string', enum: ['sutil', 'medio', 'forte'] },
    densidade_elementos: { type: 'string', enum: ['pouca', 'media', 'muita'] },
    tratamento_cor: { type: 'string', enum: ['natural', 'quente', 'frio', 'contraste', 'pb_suave'] },
    fontes_desc: { type: 'string', description: 'como sao as fontes da referencia, em poucas palavras' },
    composicao_desc: { type: 'string', description: 'como os elementos ficam dispostos na tela, em poucas palavras' },
    transicoes_desc: { type: 'string', description: 'como sao as transicoes, em poucas palavras' },
    diretrizes: { type: 'string', description: 'instrucoes para outro editor reproduzir esse estilo em outro video (o que destacar, frequencia de textos/zooms, tom)' },
  },
  required: ['resumo', 'estilo_base', 'cor_destaque', 'cor_texto', 'fonte', 'maiusculas', 'palavras_por_tela', 'legenda_com_fundo', 'contorno', 'brilho', 'posicao_legenda', 'altura_textos', 'transicao', 'ritmo', 'intensidade_zoom', 'densidade_elementos', 'tratamento_cor', 'fontes_desc', 'composicao_desc', 'transicoes_desc', 'diretrizes'],
};

export async function estudarReferencia({ quadros, cortesPorMinuto, duracao }) {
  const conteudo = [];
  for (const q of quadros) conteudo.push(...(await imagem(q.arquivo, `Quadro da referencia em ${q.segundo.toFixed(1)}s:`)));
  conteudo.push({
    type: 'text',
    text: `Estes sao quadros de um video REFERENCIA (${duracao.toFixed(0)}s, com cerca de ${cortesPorMinuto.toFixed(0)} cortes de cena por minuto, medidos automaticamente). O cliente quer que o video DELE seja editado no mesmo estilo. Estude o estilo de edicao (nao o conteudo): legendas (fonte, peso, caixa alta, cores, quantas palavras por vez, posicao, se tem tarja), textos sobrepostos, cores, tratamento de imagem, ritmo dos cortes, transicoes e composicao. Escolha os valores mais proximos entre as opcoes disponiveis. Nao copie textos nem marcas da referencia.`,
  });
  const perfil = await chamar(conteudo, SCHEMA_PERFIL, 'medium');
  const hex = (c, padrao) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : padrao);
  return {
    ...perfil,
    cor_destaque: hex(perfil.cor_destaque, '#FFE14D'),
    cor_texto: hex(perfil.cor_texto, '#FFFFFF'),
    palavras_por_tela: Math.min(5, Math.max(1, Math.round(perfil.palavras_por_tela || 3))),
    cortes_por_minuto: Math.round(cortesPorMinuto),
  };
}
