// imagens criadas PELO PROPRIO CLAUDE pra compor a edicao: ele desenha cada uma como arte vetorial
// (SVG) - ilustracoes, objetos com volume/luz de render 3D, icones e fundos inteiros - a partir do
// que a pessoa fala. O SVG e convertido em PNG aqui no servidor (pelo mesmo Chrome do video), com fundo
// transparente quando e um objeto que vai flutuar na cena.
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { rasterizarSvg } from './render.js';

const MODELO = 'claude-opus-5-5';
const client = new Anthropic();

const TAMANHOS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };

const ESTILO = {
  objeto_3d: 'um OBJETO unico com aparencia de render 3D: volume com gradientes radiais e lineares, luz de estudio vindo de cima/esquerda, brilho especular, sombras internas e reflexo sutil, perspectiva leve (3/4). Fundo TOTALMENTE transparente (nada desenhado atras do objeto, sem retangulo de fundo). Objeto centralizado ocupando ~80% da area.',
  icone: 'um ICONE moderno e limpo, com profundidade (gradiente + sombra suave), estilo app premium. Fundo TOTALMENTE transparente. Centralizado ocupando ~75% da area.',
  ilustracao: 'uma ILUSTRACAO editorial moderna e detalhada (cena completa, varios elementos, profundidade com planos de frente/meio/fundo, luz e sombra), cores harmonicas e sofisticadas, preenchendo toda a area.',
  fundo: 'um FUNDO de video (cenario) preenchendo toda a area: profundidade com camadas, luz ambiente, elementos desfocados ou suaves nas bordas e o CENTRO mais limpo (uma pessoa recortada vai ficar na frente). Nada de texto.',
};

const SISTEMA = `Voce e um ilustrador e motion designer senior que desenha em SVG. Responda SOMENTE com o codigo SVG completo (comecando em <svg e terminando em </svg>), sem explicacao, sem markdown.
Regras do SVG:
- xmlns="http://www.w3.org/2000/svg", com width, height e viewBox exatamente como pedido.
- Use gradientes (<linearGradient>, <radialGradient>), filtros (<feGaussianBlur>, <feDropShadow>), opacidades e formas bem construidas pra dar acabamento profissional: nada de desenho infantil ou chapado demais.
- PROIBIDO: <script>, <foreignObject>, <image>, links externos, fontes externas, animacoes. Nenhum texto/letra na imagem.
- Codigo enxuto mas rico em detalhe (ate ~400 elementos).`;

function rodar(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-300) || `${cmd} saiu com ${c}`))));
  });
}

// tira qualquer coisa que pudesse buscar arquivo/rede ao rasterizar - so desenho puro passa
function limparSvg(svg) {
  const inicio = svg.indexOf('<svg');
  const fim = svg.lastIndexOf('</svg>');
  if (inicio < 0 || fim < 0) throw new Error('o Claude nao devolveu um SVG valido');
  return svg.slice(inicio, fim + 6)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image\b[^>]*>/gi, '')
    .replace(/<(style)[^>]*>[\s\S]*?@import[\s\S]*?<\/style>/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*(["'])(?!#)[^"']*\1/gi, '')
    .replace(/url\(\s*(?!["']?#)[^)]*\)/gi, 'none');
}

export async function gerarImagem({ prompt, tipo, formato }, saidaPng, miniatura) {
  const transparente = tipo === 'objeto_3d' || tipo === 'icone';
  const [w, h] = transparente ? [1024, 1024] : (TAMANHOS[formato] || TAMANHOS['9:16']);
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Desenhe ${ESTILO[tipo] || ESTILO.ilustracao}\n\nO que desenhar: ${prompt}\n\nTamanho: width="${w}" height="${h}" viewBox="0 0 ${w} ${h}".`,
    }],
  });
  const resposta = await stream.finalMessage();
  if (resposta.stop_reason === 'refusal') throw new Error('o Claude recusou essa imagem');
  const svg = limparSvg(resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  const arquivoSvg = saidaPng.replace(/\.png$/, '.svg');
  await fs.writeFile(arquivoSvg, svg);
  await rasterizarSvg(svg, w, h, saidaPng);
  await rodar('ffmpeg', ['-y', '-i', saidaPng, '-vf', 'scale=360:-2', '-frames:v', '1', '-q:v', '4', miniatura]);
}
