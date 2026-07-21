// converte numero inteiro (ate trilhoes) pra portugues por extenso, seguindo a regra gramatical
// padrao: "e" entre centena e dezena/unidade, "e" antes do ultimo grupo (mil/milhao/...) so
// quando esse ultimo grupo vale menos de 100 ou e multiplo redondo de 100, senao usa virgula.
// Usado pra Lumia falar valores em dinheiro (ver moedaPorExtenso) do jeito que uma pessoa fala
// de verdade, em vez de ler os digitos crus ("duzentos e quarenta e sete mil e onze", nao
// "dois quatro sete zero um um").
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ESCALAS_SINGULAR = ['', 'mil', 'milhão', 'bilhão', 'trilhão'];
const ESCALAS_PLURAL = ['', 'mil', 'milhões', 'bilhões', 'trilhões'];

function grupoTresDigitos(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade === 0 ? DEZENAS[dezena] : `${DEZENAS[dezena]} e ${UNIDADES[unidade]}`);
    }
  }
  return partes.join(' e ');
}

export function numeroPorExtenso(valor) {
  const n = Math.round(Math.abs(valor));
  if (n === 0) return 'zero';

  // quebra em grupos de 3 digitos, do menos significativo pro mais significativo, depois
  // inverte - grupos[0] sempre acaba sendo o grupo de maior escala (milhoes/bilhoes/...)
  const grupos = [];
  let resto = n;
  while (resto > 0) {
    grupos.unshift(resto % 1000);
    resto = Math.floor(resto / 1000);
  }
  const escalaDoPrimeiro = grupos.length - 1;

  const partes = [];
  grupos.forEach((grupo, i) => {
    if (grupo === 0) return;
    const escala = escalaDoPrimeiro - i;
    let texto;
    if (escala === 0) {
      texto = grupoTresDigitos(grupo);
    } else if (escala === 1) {
      // "mil" nunca leva "um" na frente ("mil", nao "um mil") - diferente de milhao/bilhao
      texto = grupo === 1 ? 'mil' : `${grupoTresDigitos(grupo)} mil`;
    } else {
      texto = grupo === 1 ? `um ${ESCALAS_SINGULAR[escala]}` : `${grupoTresDigitos(grupo)} ${ESCALAS_PLURAL[escala]}`;
    }
    partes.push({ texto, valor: grupo });
  });

  let resultado = '';
  partes.forEach((p, i) => {
    if (i === 0) { resultado = p.texto; return; }
    const ultimo = i === partes.length - 1;
    const usaE = ultimo && (p.valor < 100 || p.valor % 100 === 0);
    resultado += (usaE ? ' e ' : ', ') + p.texto;
  });
  return resultado;
}

// "milhao"/"milhoes"/"bilhao"/etc SEMPRE pedem "de" antes do substantivo que vem depois ("um
// milhao DE reais", "dois milhoes DE reais") - "mil" e o numero comum (onze, cem...) NAO pedem
// ("cem mil reais", nunca "cem mil de reais"). So depende da ULTIMA palavra do numero por
// extenso: se for uma dessas escalas, entra o "de".
const ESCALAS_QUE_PEDEM_DE = new Set(['milhão', 'milhões', 'bilhão', 'bilhões', 'trilhão', 'trilhões']);
function comConectorDe(extenso) {
  const ultimaPalavra = extenso.split(' ').pop();
  return ESCALAS_QUE_PEDEM_DE.has(ultimaPalavra) ? `${extenso} de` : extenso;
}

// "247011,90" (formato BR: ponto de milhar, virgula decimal) -> "duzentos e quarenta e sete mil
// e onze reais e noventa centavos" - concordando singular/plural certo em real/reais e
// centavo/centavos, e omitindo a parte que for zero (nao fala "zero centavos" a toa)
export function moedaPorExtenso(valorStr, singular, plural) {
  const negativo = valorStr.trim().startsWith('-');
  const semSinal = valorStr.replace(/^-/, '').trim();
  const [parteInteiraStr, parteCentavosStr = ''] = semSinal.split(',');
  const inteiro = Number(parteInteiraStr.replace(/\./g, '')) || 0;
  const centavos = parteCentavosStr ? Number(parteCentavosStr.padEnd(2, '0').slice(0, 2)) : 0;

  const partes = [];
  if (inteiro > 0) partes.push(`${comConectorDe(numeroPorExtenso(inteiro))} ${inteiro === 1 ? singular : plural}`);
  if (centavos > 0) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) partes.push(`zero ${plural}`);
  return (negativo ? 'menos ' : '') + partes.join(' e ');
}
