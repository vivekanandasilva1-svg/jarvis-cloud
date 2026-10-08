// "diretor de edicao": o Claude le a transcricao (palavra por palavra, numerada), ve quadros do
// video, as midias de apoio enviadas e o perfil de estilo da referencia (se houver), e decide o que
// cortar, o que destacar e onde entra cada animacao/insercao. Ele NAO escreve codigo nem desenha
// nada - so devolve um plano em JSON validado por schema, ancorado nos NUMEROS das palavras. O
// visual vem da biblioteca de componentes (remotion/), entao o resultado mantem padrao
// profissional e a IA nao consegue gerar algo que quebre a renderizacao.
import fs from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5-5';
const client = new Anthropic();

const intervalo = (extra = {}) => ({
  type: 'object', additionalProperties: false,
  properties: { de: { type: 'integer' }, ate: { type: 'integer' }, ...extra },
  required: ['de', 'ate', ...Object.keys(extra)],
});

const SCHEMA_PLANO = {
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string', description: 'nome curto do video (ate 6 palavras)' },
    resumo: { type: 'string', description: 'o que voce fez na edicao, em 1-3 frases para o cliente ler' },
    remover: { type: 'array', items: intervalo({ motivo: { type: 'string' } }) },
    destaques: { type: 'array', items: { type: 'integer' } },
    zooms: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { palavra: { type: 'integer' }, tipo: { type: 'string', enum: ['soco', 'lento'] } },
        required: ['palavra', 'tipo'],
      },
    },
    textos: { type: 'array', items: intervalo({ texto: { type: 'string' }, estilo: { type: 'string', enum: ['impacto', 'topo', 'etiqueta'] } }) },
    numeros: {
      type: 'array',
      items: intervalo({ valor: { type: 'number' }, prefixo: { type: 'string' }, sufixo: { type: 'string' }, rotulo: { type: 'string' } }),
    },
    listas: { type: 'array', items: intervalo({ titulo: { type: 'string' }, itens: { type: 'array', items: { type: 'string' } } }) },
    insercoes: {
      type: 'array',
      description: 'imagens/videos de apoio enviados pelo cliente, mostrados enquanto a pessoa fala do assunto',
      items: intervalo({ midia: { type: 'string' }, modo: { type: 'string', enum: ['tela_cheia', 'janela'] } }),
    },
    trilha: { type: 'string', description: 'id da midia de audio usada como trilha de fundo, ou string vazia para nenhuma' },
    posicao_legenda: { type: 'string', enum: ['baixo', 'meio'] },
    legendas: { type: 'boolean', description: 'false quando o video ja tem legenda propria gravada na imagem' },
    altura_textos: { type: 'string', enum: ['alta', 'media'], description: 'onde ficam textos, numeros e listas: alta = topo da tela; media = logo abaixo do rosto' },
  },
  required: ['titulo', 'resumo', 'remover', 'destaques', 'zooms', 'textos', 'numeros', 'listas', 'insercoes', 'trilha', 'posicao_legenda', 'legendas', 'altura_textos'],
};

const SISTEMA = `Voce e um editor de video senior especializado em videos curtos verticais (Reels, TikTok, Shorts) em portugues do Brasil. Voce recebe a transcricao de um video bruto, palavra por palavra, cada uma com seu numero [n] e o segundo em que e falada, e devolve o plano de edicao.

Como o plano funciona:
- Tudo e ancorado nos numeros das palavras. "de" e "ate" sao numeros de palavras (inclusive).
- remover: trechos a cortar. Corte vicios de fala ("é...", "hã", "tipo" sobrando), comecos falsos, frases repetidas e tomadas erradas (quando a pessoa repete a frase, mantenha a ULTIMA versao boa e remova as anteriores). Nunca corte conteudo que muda o sentido. Silencios entre palavras ja sao cortados automaticamente - nao precisa listar.
- destaques: palavras-chave que aparecem coloridas na legenda. Uma ou duas por frase, as que carregam o sentido (numeros, beneficios, a palavra mais forte). Nunca artigos ou conectivos.
- zooms: "soco" e um zoom rapido de enfase numa palavra forte; "lento" e uma aproximacao suave em momento emocional ou de revelacao. Um a cada 4-8 segundos, nunca dois em menos de 2 segundos.
- textos: sobreposicoes de texto. "impacto" e texto GRANDE (ate 5 palavras) para o gancho e as ideias principais; "topo" e um titulo em caixa para marcar um assunto ou etapa; "etiqueta" e uma faixa lateral pequena (nome da pessoa, cargo, local, nome de produto).
- numeros: contador animado grande quando a pessoa fala um numero importante (porcentagem, preco, quantidade, prazo). valor numerico puro, prefixo tipo "R$ " e sufixo tipo "%" ou " mil" ou " dias" (strings vazias se nao tiver). rotulo curto do que o numero significa.
- listas: cartao com itens que aparecem um a um, quando a pessoa enumera coisas (passos, beneficios, dicas). Itens curtos (ate 5 palavras cada). O intervalo deve cobrir a fala da enumeracao inteira.
- insercoes: se o cliente enviou midias de apoio (imagens/videos, listadas com id), mostre cada uma no trecho em que a fala combina com ela. "tela_cheia" cobre o video inteiro (bom pra mostrar resultado, produto, ambiente); "janela" mostra a midia num cartao na parte de cima com a pessoa ainda visivel. Entre 1,5 e 6 segundos cada (umas 4-15 palavras). Use cada midia no maximo uma vez e nunca duas insercoes ao mesmo tempo. Use o id exatamente como informado. Se nenhuma combinar com a fala, pode deixar de fora.
- trilha: se houver midia de audio, use o id dela como trilha de fundo (o volume abaixa sozinho quando a pessoa fala). String vazia se nao houver ou nao combinar.

Regras de qualidade:
- O inicio decide tudo: coloque um texto "impacto" no gancho, comecando na palavra 0 (ou na primeira palavra que sobrar depois dos cortes), resumindo a promessa do video em poucas palavras fortes.
- Ritmo: algo visual novo a cada 3-6 segundos (zoom, texto, numero, lista ou insercao), mas sem poluir. Textos, numeros e listas NUNCA se sobrepoem no tempo entre si - um de cada vez.
- Cada texto/numero/lista precisa ficar na tela tempo suficiente pra ser lido (no minimo umas 4-5 palavras faladas).
- Escreva os textos sobrepostos com ortografia e acentuacao corretas, sem emojis.
- posicao_legenda: "baixo" no padrao; "meio" so se o pedido do cliente indicar.

Use os quadros do video bruto que vem junto:
- legendas: false se o video JA TEM legenda gravada na imagem (senao ficam duas legendas sobrepostas). Nesse caso compense com textos de impacto nas ideias principais.
- altura_textos: os textos grandes, numeros e listas ficam no topo da tela ("alta"). Se o rosto da pessoa estiver alto no quadro (cabeca encostando no topo), use "media", que coloca esses elementos na altura do peito, abaixo do rosto. Nunca deixe texto sobre os olhos.
- Veja tambem se ja existem textos, logos ou imagens gravados no video e evite colocar elementos por cima deles.

Se vier um PERFIL DE ESTILO de um video referencia, imite o jeito de editar dele: ritmo, quantidade de elementos, tipo de texto, uso de zoom. As cores, fontes e transicoes da referencia ja sao aplicadas automaticamente - voce cuida do conteudo e do ritmo.

O que este editor ainda NAO faz: texto ou objetos 3D atras da pessoa, recorte/troca de fundo, efeitos de profundidade com camadas. Se o cliente pedir algo disso, faca o melhor possivel com o que existe e diga com gentileza no "resumo" o que nao foi possivel nesta versao.

- Siga as instrucoes do cliente quando houver - elas tem prioridade sobre o padrao.`;

function formatarTranscricao(palavras) {
  return palavras.map((p, n) => `[${n}] ${p.t} (${p.i.toFixed(2)}s)`).join('\n');
}

function validarIndices(plano, total, idsMidia = new Set()) {
  const ok = (n) => Number.isInteger(n) && n >= 0 && n < total;
  const okIntervalo = (x) => ok(x.de) && ok(x.ate) && x.ate >= x.de;
  return {
    ...plano,
    remover: (plano.remover || []).filter(okIntervalo),
    destaques: (plano.destaques || []).filter(ok),
    zooms: (plano.zooms || []).filter((z) => ok(z.palavra)),
    textos: (plano.textos || []).filter((t) => okIntervalo(t) && t.texto.trim()),
    numeros: (plano.numeros || []).filter((x) => okIntervalo(x) && Number.isFinite(x.valor)),
    listas: (plano.listas || []).filter((l) => okIntervalo(l) && l.itens.length),
    insercoes: (plano.insercoes || []).filter((x) => okIntervalo(x) && idsMidia.has(x.midia)),
    trilha: idsMidia.has(plano.trilha) ? plano.trilha : '',
    legendas: plano.legendas !== false,
    altura_textos: plano.altura_textos === 'media' ? 'media' : 'alta',
  };
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
    blocos.push(...(await imagem(m.miniatura, `Midia de apoio id "${m.id}" (${m.kind === 'video' ? `video de ${m.duracao?.toFixed(1)}s` : 'imagem'}, arquivo "${m.nome}"):`)));
  }
  return blocos;
}

function contexto({ palavras, meta, opcoes, apoio = [], referencia }) {
  const linhas = [
    `Video: ${meta.duracao.toFixed(1)} segundos, formato ${opcoes.formato}, estilo visual "${opcoes.estilo}".`,
    opcoes.instrucoes ? `Instrucoes do cliente: ${opcoes.instrucoes}` : 'O cliente nao deu instrucoes especificas.',
  ];
  if (apoio.length) {
    linhas.push('', 'Midias de apoio enviadas pelo cliente:');
    for (const m of apoio) linhas.push(`- id "${m.id}": ${m.kind}${m.duracao ? ` de ${m.duracao.toFixed(1)}s` : ''}, arquivo "${m.nome}"`);
  } else {
    linhas.push('', 'Nenhuma midia de apoio enviada (insercoes vazio, trilha "").');
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
    system: SISTEMA,
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  if (resposta.stop_reason === 'refusal') throw new Error('a IA recusou editar esse video');
  if (resposta.stop_reason === 'max_tokens') throw new Error('o plano de edicao ficou grande demais - tente um video mais curto');
  return JSON.parse(resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

const PLANO_VAZIO = { titulo: 'Vídeo sem fala', resumo: 'Não encontrei fala no vídeo, então apliquei só o tratamento de imagem e áudio.', remover: [], destaques: [], zooms: [], textos: [], numeros: [], listas: [], insercoes: [], trilha: '', posicao_legenda: 'baixo', legendas: false, altura_textos: 'alta' };

export async function planejar({ palavras, meta, opcoes, quadros, apoio = [], referencia = null }) {
  const ids = new Set(apoio.map((m) => m.id));
  if (!palavras.length) {
    const trilha = apoio.find((m) => m.kind === 'audio')?.id || '';
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
      'Revise como um editor exigente olhando so o que da pra ver na imagem: texto sobreposto cobrindo o rosto, texto saindo da tela ou cortado, erro de ortografia, excesso de elementos ao mesmo tempo, legenda ilegivel, duas legendas sobrepostas (o video ja tinha legenda gravada). Se estiver bom, aprovado=true e plano=null. Se tiver problema que se resolve mudando o plano (encurtar texto, trocar estilo "impacto" por "topo", mover ou remover um elemento, mudar posicao_legenda, legendas=false, altura_textos, trocar o modo de uma insercao), aprovado=false, liste os problemas e devolva o plano completo corrigido. Nao mude o que esta bom.',
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
