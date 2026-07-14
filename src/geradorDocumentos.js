// geracao de arquivos (PDF, Word, Excel, grafico em SVG) - tudo via bibliotecas locais, sem
// nenhuma chamada de API externa, entao nao tem custo nenhum de saldo/cota por uso.
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import ExcelJS from 'exceljs';

// formatacao bem simples: linha comecando com "## " vira subtitulo, linha vazia vira
// espacamento, o resto e paragrafo normal - da pra escrever um relatorio/roteiro decente sem
// precisar de markdown completo nem de logica de parser pesada
function dividirConteudo(conteudo) {
  return (conteudo || '').split('\n');
}

export function gerarPdf(titulo, conteudo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(titulo || 'Documento', { align: 'left' });
    doc.moveDown();
    doc.fontSize(12);

    for (const linha of dividirConteudo(conteudo)) {
      if (linha.startsWith('## ')) {
        doc.moveDown(0.5).fontSize(15).text(linha.slice(3)).fontSize(12);
      } else if (linha.trim() === '') {
        doc.moveDown(0.5);
      } else {
        doc.text(linha);
      }
    }
    doc.end();
  });
}

export async function gerarWord(titulo, conteudo) {
  const paragraphs = [new Paragraph({ text: titulo || 'Documento', heading: HeadingLevel.TITLE })];
  for (const linha of dividirConteudo(conteudo)) {
    if (linha.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: linha.slice(3), heading: HeadingLevel.HEADING_1 }));
    } else if (linha.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else {
      paragraphs.push(new Paragraph({ text: linha }));
    }
  }
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

export async function gerarExcel(titulo, colunas, linhas) {
  const workbook = new ExcelJS.Workbook();
  const nomeAba = (titulo || 'Planilha').slice(0, 31).replace(/[[\]*?/\\:]/g, ' ') || 'Planilha';
  const sheet = workbook.addWorksheet(nomeAba);
  if (colunas?.length) {
    sheet.addRow(colunas);
    sheet.getRow(1).font = { bold: true };
  }
  for (const linha of linhas || []) sheet.addRow(linha);
  sheet.columns.forEach((col) => { col.width = 18; });
  return workbook.xlsx.writeBuffer();
}

function escaparXml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

const CORES_GRAFICO = ['#d4af37', '#c0c0c0', '#8ecae6', '#ffb703', '#e76f51', '#2a9d8f', '#9d4edd', '#f4a261'];

function gerarGraficoBarraOuLinha(titulo, rotulos, valores, tipo) {
  const largura = 720, altura = 440, margemEsq = 60, margemDir = 40, margemTopo = 60, margemBase = 70;
  const areaW = largura - margemEsq - margemDir;
  const areaH = altura - margemTopo - margemBase;
  const max = Math.max(...valores, 1);
  const passo = valores.length > 1 ? areaW / (valores.length - 1 || 1) : areaW;
  const espaco = areaW / valores.length;

  let conteudoSvg = '';
  if (tipo === 'linha') {
    const pontos = valores.map((v, i) => {
      const x = margemEsq + (valores.length > 1 ? i * passo : areaW / 2);
      const y = margemTopo + (areaH - (v / max) * areaH);
      return [x, y];
    });
    const path = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    conteudoSvg += `<path d="${path}" fill="none" stroke="#d4af37" stroke-width="3"/>`;
    pontos.forEach(([x, y], i) => {
      conteudoSvg += `<circle cx="${x}" cy="${y}" r="4" fill="#d4af37"/>`;
      conteudoSvg += `<text x="${x}" y="${y - 12}" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif">${valores[i]}</text>`;
      conteudoSvg += `<text x="${x}" y="${altura - margemBase + 22}" font-size="12" fill="#ccc" text-anchor="middle" font-family="sans-serif">${escaparXml(rotulos[i] ?? '')}</text>`;
    });
  } else {
    const larguraBarra = espaco * 0.6;
    valores.forEach((v, i) => {
      const h = (v / max) * areaH;
      const x = margemEsq + i * espaco + (espaco - larguraBarra) / 2;
      const y = margemTopo + (areaH - h);
      conteudoSvg += `<rect x="${x}" y="${y}" width="${larguraBarra}" height="${h}" fill="${CORES_GRAFICO[i % CORES_GRAFICO.length]}" rx="4"/>`;
      conteudoSvg += `<text x="${x + larguraBarra / 2}" y="${y - 8}" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif">${v}</text>`;
      conteudoSvg += `<text x="${x + larguraBarra / 2}" y="${altura - margemBase + 22}" font-size="12" fill="#ccc" text-anchor="middle" font-family="sans-serif">${escaparXml(rotulos[i] ?? '')}</text>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}">
    <rect width="${largura}" height="${altura}" fill="#0d0d0d"/>
    <text x="${largura / 2}" y="36" font-size="20" fill="#d4af37" text-anchor="middle" font-family="sans-serif">${escaparXml(titulo)}</text>
    <line x1="${margemEsq}" y1="${altura - margemBase}" x2="${largura - margemDir}" y2="${altura - margemBase}" stroke="#555"/>
    ${conteudoSvg}
  </svg>`;
}

function gerarGraficoPizza(titulo, rotulos, valores) {
  const largura = 720, altura = 440;
  const cx = 260, cy = altura / 2 + 10, raio = 150;
  const total = valores.reduce((s, v) => s + v, 0) || 1;
  let anguloAtual = -Math.PI / 2;
  let fatias = '';
  let legenda = '';
  valores.forEach((v, i) => {
    const fracao = v / total;
    const anguloFim = anguloAtual + fracao * Math.PI * 2;
    const x1 = cx + raio * Math.cos(anguloAtual), y1 = cy + raio * Math.sin(anguloAtual);
    const x2 = cx + raio * Math.cos(anguloFim), y2 = cy + raio * Math.sin(anguloFim);
    const grandeArco = fracao > 0.5 ? 1 : 0;
    const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];
    fatias += `<path d="M${cx},${cy} L${x1},${y1} A${raio},${raio} 0 ${grandeArco} 1 ${x2},${y2} Z" fill="${cor}" stroke="#0d0d0d" stroke-width="2"/>`;
    const legY = 70 + i * 28;
    legenda += `<rect x="540" y="${legY - 14}" width="16" height="16" fill="${cor}"/>`;
    legenda += `<text x="562" y="${legY}" font-size="13" fill="#eee" font-family="sans-serif">${escaparXml(rotulos[i] ?? '')} (${Math.round(fracao * 100)}%)</text>`;
    anguloAtual = anguloFim;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}">
    <rect width="${largura}" height="${altura}" fill="#0d0d0d"/>
    <text x="${largura / 2}" y="36" font-size="20" fill="#d4af37" text-anchor="middle" font-family="sans-serif">${escaparXml(titulo)}</text>
    ${fatias}
    ${legenda}
  </svg>`;
}

// grafico simples em SVG (nao precisa de nenhuma lib de imagem nem chamada de API - so
// geometria) - cobre os 3 tipos mais usados no dia a dia (barra, linha, pizza)
export function gerarGraficoSvg(titulo, tipo, rotulos, valores) {
  if (!Array.isArray(valores) || !valores.length) throw new Error('precisa de pelo menos um valor pro grafico');
  if (tipo === 'pizza') return gerarGraficoPizza(titulo || 'Grafico', rotulos || [], valores);
  return gerarGraficoBarraOuLinha(titulo || 'Grafico', rotulos || [], valores, tipo === 'linha' ? 'linha' : 'barra');
}
