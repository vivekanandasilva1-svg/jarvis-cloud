// "diretor de edicao": o Claude le a transcricao (palavra por palavra, numerada) e decide o que
// cortar, o que destacar e onde entra cada animacao. Ele NAO escreve codigo nem desenha nada - so
// devolve um plano em JSON validado por schema, ancorado nos NUMEROS das palavras. O visual vem da
// biblioteca de componentes (remotion/), entao o resultado mantem padrao profissional e a IA nao
// consegue gerar algo que quebre a renderizacao.
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
    posicao_legenda: { type: 'string', enum: ['baixo', 'meio'] },
    legendas: { type: 'boolean', description: 'false quando o video ja tem legenda propria gravada na imagem' },
    altura_textos: { type: 'string', enum: ['alta', 'media'], description: 'onde ficam textos, numeros e listas: alta = topo da tela; media = logo abaixo do rosto' },
  },
  required: ['titulo', 'resumo', 'remover', 'destaques', 'zooms', 'textos', 'numeros', 'listas', 'posicao_legenda', 'legendas', 'altura_textos'],
};

const SISTEMA = `Voce e um editor de video senior especializado em videos curtos verticais (Reels, TikTok, Shorts) em portugues do Brasil. Voce recebe a transcricao de um video bruto, palavra por palavra, cada uma com seu numero [n] e o segundo em que e falada, e devolve o plano de edicao.

Como o plano funciona:
- Tudo e ancorado nos numeros das palavras. "de" e "ate" sao numeros de palavras (inclusive).
- remover: trechos a cortar. Corte vicios de fala ("é...", "hã", "tipo" sobrando), comecos falsos, frases repetidas e tomadas erradas (quando a pessoa repete a frase, mantenha a ULTIMA versao boa e remova as anteriores). Nunca corte conteudo que muda o sentido. Silencios entre palavras ja sao cortados automaticamente - nao precisa listar.
- destaques: palavras-chave que aparecem coloridas na legenda. Uma ou duas por frase, as que carregam o sentido (numeros, beneficios, a palavra mais forte). Nunca artigos ou conectivos.
- zooms: "soco" e um zoom rapido de enfase numa palavra forte; "lento" e uma aproximacao suave em momento emocional ou de revelacao. Um a cada 4-8 segundos, nunca dois em menos de 2 segundos.
- textos: sobreposicoes de texto. "impacto" e texto GRANDE no topo (ate 5 palavras) para o gancho e as ideias principais; "topo" e um titulo em caixa para marcar um assunto ou etapa; "etiqueta" e uma faixa lateral pequena (nome da pessoa, cargo, local, nome de produto).
- numeros: contador animado grande quando a pessoa fala um numero importante (porcentagem, preco, quantidade, prazo). valor numerico puro, prefixo tipo "R$ " e sufixo tipo "%" ou " mil" ou " dias" (strings vazias se nao tiver). rotulo curto do que o numero significa.
- listas: cartao com itens que aparecem um a um, quando a pessoa enumera coisas (passos, beneficios, dicas). Itens curtos (ate 5 palavras cada). O intervalo deve cobrir a fala da enumeracao inteira.

Regras de qualidade:
- O inicio decide tudo: coloque um texto "impacto" no gancho, comecando na palavra 0 (ou na primeira palavra que sobrar depois dos cortes), resumindo a promessa do video em poucas palavras fortes.
- Ritmo: algo visual novo a cada 3-6 segundos (zoom, texto, numero ou lista), mas sem poluir. Textos, numeros e listas NUNCA se sobrepoem no tempo entre si - um de cada vez.
- Cada texto/numero/lista precisa ficar na tela tempo suficiente pra ser lido (no minimo umas 4-5 palavras faladas).
- Escreva os textos sobrepostos com ortografia e acentuacao corretas, sem emojis.
- posicao_legenda: "baixo" no padrao; "meio" so se o pedido do cliente indicar.

Use os quadros do video bruto que vem junto:
- legendas: false se o video JA TEM legenda gravada na imagem (senao ficam duas legendas sobrepostas). Nesse caso compense com textos de impacto nas ideias principais.
- altura_textos: os textos grandes, numeros e listas ficam no topo da tela ("alta"). Se o rosto da pessoa estiver alto no quadro (cabeca encostando no topo), use "media", que coloca esses elementos na altura do peito, abaixo do rosto. Nunca deixe texto sobre os olhos.
- Veja tambem se ja existem textos, logos ou imagens gravados no video e evite colocar elementos por cima deles.

O que este editor ainda NAO faz: texto ou objetos 3D atras da pessoa, recorte/troca de fundo, efeitos de profundidade com camadas, inserir imagens ou videos de apoio (b-roll), musica de fundo. Se o cliente pedir algo disso, faca o melhor possivel com o que existe (textos de impacto, zooms, numeros, listas) e diga com gentileza no "resumo" o que nao foi possivel nesta versao.

- Siga as instrucoes do cliente quando houver - elas tem prioridade sobre o padrao.`;

function formatarTranscricao(palavras) {
  return palavras.map((p, n) => `[${n}] ${p.t} (${p.i.toFixed(2)}s)`).join('\n');
}

function validarIndices(plano, total) {
  const ok = (n) => Number.isInteger(n) && n >= 0 && n < total;
  const okIntervalo = (x) => ok(x.de) && ok(x.ate) && x.ate >= x.de;
  return {
    ...plano,
    remover: plano.remover.filter(okIntervalo),
    destaques: plano.destaques.filter(ok),
    zooms: plano.zooms.filter((z) => ok(z.palavra)),
    textos: plano.textos.filter((t) => okIntervalo(t) && t.texto.trim()),
    numeros: plano.numeros.filter((x) => okIntervalo(x) && Number.isFinite(x.valor)),
    listas: plano.listas.filter((l) => okIntervalo(l) && l.itens.length),
    legendas: plano.legendas !== false,
    altura_textos: plano.altura_textos === 'media' ? 'media' : 'alta',
  };
}

// quadros do video bruto pro diretor enxergar o enquadramento (onde esta o rosto, se ja tem
// legenda/texto gravado na imagem)
async function blocosQuadros(quadros = []) {
  const blocos = [];
  for (const q of quadros) {
    const dados = await fs.readFile(q.arquivo).catch(() => null);
    if (!dados) continue;
    blocos.push({ type: 'text', text: `Quadro do video bruto em ${q.segundo.toFixed(1)}s:` });
    blocos.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dados.toString('base64') } });
  }
  return blocos;
}

async function pedirPlano(conteudo, { esforco = 'high' } = {}) {
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: esforco, format: { type: 'json_schema', schema: SCHEMA_PLANO } },
    system: SISTEMA,
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  if (resposta.stop_reason === 'refusal') throw new Error('a IA recusou editar esse video');
  if (resposta.stop_reason === 'max_tokens') throw new Error('o plano de edicao ficou grande demais - tente um video mais curto');
  const texto = resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(texto);
}

function contexto({ palavras, meta, opcoes }) {
  return [
    `Video: ${meta.duracao.toFixed(1)} segundos, formato ${opcoes.formato}, estilo visual "${opcoes.estilo}".`,
    opcoes.instrucoes ? `Instrucoes do cliente: ${opcoes.instrucoes}` : 'O cliente nao deu instrucoes especificas.',
    '',
    'Transcricao:',
    formatarTranscricao(palavras),
  ].join('\n');
}

export async function planejar({ palavras, meta, opcoes, quadros }) {
  if (!palavras.length) {
    return { titulo: 'Vídeo sem fala', resumo: 'Não encontrei fala no vídeo, então apliquei só o tratamento de imagem e áudio.', remover: [], destaques: [], zooms: [], textos: [], numeros: [], listas: [], posicao_legenda: 'baixo', legendas: false, altura_textos: 'alta' };
  }
  const plano = await pedirPlano([...(await blocosQuadros(quadros)), { type: 'text', text: contexto({ palavras, meta, opcoes }) }]);
  return validarIndices(plano, palavras.length);
}

// ajuste pedido pelo cliente depois de ver o resultado ("tira o zoom do comeco", "poe uma lista
// com os 3 beneficios") - devolve o plano INTEIRO revisado, nao so a diferenca
export async function ajustar({ palavras, meta, opcoes, planoAtual, pedido, quadros }) {
  const texto = [
    contexto({ palavras, meta, opcoes }),
    '',
    'Plano de edicao atual:',
    JSON.stringify(planoAtual),
    '',
    `O cliente viu o video editado e pediu este ajuste: "${pedido}"`,
    'Devolva o plano completo revisado aplicando o pedido. Mantenha tudo que o cliente nao pediu pra mudar. No "resumo", conte em 1-2 frases o que mudou.',
  ].join('\n');
  const plano = await pedirPlano([...(await blocosQuadros(quadros)), { type: 'text', text: texto }]);
  return validarIndices(plano, palavras.length);
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

export async function revisarQuadros({ palavras, planoAtual, quadros }) {
  const conteudo = [];
  for (const q of quadros) {
    const dados = await fs.readFile(q.arquivo);
    conteudo.push({ type: 'text', text: `Quadro em ${q.segundo.toFixed(1)}s - ${q.descricao}` });
    conteudo.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dados.toString('base64') } });
  }
  conteudo.push({
    type: 'text',
    text: [
      'Acima estao quadros de previa do video editado. Plano usado:',
      JSON.stringify(planoAtual),
      '',
      `Transcricao (${palavras.length} palavras) para referencia dos numeros:`,
      formatarTranscricao(palavras),
      '',
      'Revise como um editor exigente olhando so o que da pra ver na imagem: texto sobreposto cobrindo o rosto, texto saindo da tela ou cortado, erro de ortografia, excesso de elementos ao mesmo tempo, legenda ilegivel, duas legendas sobrepostas (o video ja tinha legenda gravada). Se estiver bom, aprovado=true e plano=null. Se tiver problema que se resolve mudando o plano (encurtar texto, trocar estilo "impacto" por "topo", mover ou remover um elemento, mudar posicao_legenda, legendas=false, altura_textos), aprovado=false, liste os problemas e devolva o plano completo corrigido. Nao mude o que esta bom.',
    ].join('\n'),
  });
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA_REVISAO } },
    system: SISTEMA,
    messages: [{ role: 'user', content: conteudo }],
  });
  const resposta = await stream.finalMessage();
  if (resposta.stop_reason !== 'end_turn') return { aprovado: true, problemas: [], plano: null };
  const r = JSON.parse(resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  if (r.plano) r.plano = validarIndices(r.plano, palavras.length);
  return r;
}
