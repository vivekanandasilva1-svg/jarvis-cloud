// estilos visuais prontos do editor - cada um define fonte, cores, tratamento de cor do video e o
// "temperamento" das animacoes. A IA so escolhe O QUE entra e QUANDO; o COMO (tipografia,
// cores, curvas de animacao) vem daqui, desenhado a mao - e isso que mantem o resultado com cara
// profissional em todo video, em vez de depender da IA acertar design do zero a cada vez.
import { loadFont as carregarMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as carregarPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as carregarInter } from '@remotion/google-fonts/Inter';
import { loadFont as carregarAnton } from '@remotion/google-fonts/Anton';
import { loadFont as carregarPlayfair } from '@remotion/google-fonts/PlayfairDisplay';

const SUBSETS = ['latin', 'latin-ext'];
const montserrat = carregarMontserrat('normal', { weights: ['800', '900'], subsets: SUBSETS }).fontFamily;
const poppins = carregarPoppins('normal', { weights: ['600', '800'], subsets: SUBSETS }).fontFamily;
const inter = carregarInter('normal', { weights: ['600', '800'], subsets: SUBSETS }).fontFamily;
const anton = carregarAnton('normal', { weights: ['400'], subsets: SUBSETS }).fontFamily;
const playfair = carregarPlayfair('normal', { weights: ['700', '900'], subsets: SUBSETS }).fontFamily;

export const ESTILOS = {
  // criador de conteudo classico: legenda branca grossa, palavra-chave amarela
  criador: {
    fonteLegenda: montserrat, pesoLegenda: 900, fonteTitulo: montserrat, pesoTitulo: 900,
    maiusculas: true, palavrasPorTela: 3,
    corTexto: '#FFFFFF', corDestaque: '#FFE14D', corSecundaria: '#FFFFFF',
    contorno: true, fundoLegenda: null, brilho: false,
    filtroVideo: 'contrast(1.06) saturate(1.12)', vinheta: 0.25, zoomSoco: 1.14,
  },
  // roxo/rosa com brilho - o visual dos videos de referencia
  neon: {
    fonteLegenda: poppins, pesoLegenda: 800, fonteTitulo: montserrat, pesoTitulo: 900,
    maiusculas: false, palavrasPorTela: 3,
    corTexto: '#FFFFFF', corDestaque: '#C77DFF', corSecundaria: '#FF5FD2',
    contorno: false, fundoLegenda: null, brilho: true,
    filtroVideo: 'contrast(1.08) saturate(1.15) hue-rotate(-4deg)', vinheta: 0.4, zoomSoco: 1.12,
  },
  // limpo e acolhedor - clinica, saude, servicos
  clinica: {
    fonteLegenda: inter, pesoLegenda: 800, fonteTitulo: inter, pesoTitulo: 800,
    maiusculas: false, palavrasPorTela: 4,
    corTexto: '#FFFFFF', corDestaque: '#5EEAD4', corSecundaria: '#FFFFFF',
    contorno: false, fundoLegenda: 'rgba(8, 20, 28, 0.72)', brilho: false,
    filtroVideo: 'contrast(1.03) saturate(1.05) brightness(1.03)', vinheta: 0.12, zoomSoco: 1.08,
  },
  // agressivo, fonte condensada, vermelho - vendas e ganchos fortes
  impacto: {
    fonteLegenda: anton, pesoLegenda: 400, fonteTitulo: anton, pesoTitulo: 400,
    maiusculas: true, palavrasPorTela: 2,
    corTexto: '#FFFFFF', corDestaque: '#FF3B3B', corSecundaria: '#FFFFFF',
    contorno: true, fundoLegenda: null, brilho: false,
    filtroVideo: 'contrast(1.12) saturate(1.1)', vinheta: 0.35, zoomSoco: 1.18,
  },
  // documentario: serifada, tons quentes, grao de filme
  documentario: {
    fonteLegenda: playfair, pesoLegenda: 700, fonteTitulo: playfair, pesoTitulo: 900,
    maiusculas: false, palavrasPorTela: 4,
    corTexto: '#F5EBDD', corDestaque: '#E9B872', corSecundaria: '#F5EBDD',
    contorno: false, fundoLegenda: null, brilho: false,
    filtroVideo: 'sepia(0.28) contrast(1.08) saturate(0.85)', vinheta: 0.5, zoomSoco: 1.06, grao: true,
  },
};

export function obterEstilo(nome, corDestaque) {
  const base = ESTILOS[nome] || ESTILOS.criador;
  return corDestaque ? { ...base, corDestaque } : base;
}
