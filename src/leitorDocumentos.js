// extracao de texto/tabelas de arquivos que o usuario ANEXA na conversa (Word, Excel) - o
// contrario de geradorDocumentos.js, que CRIA esses arquivos. Ao contrario de PDF e imagem,
// a API da Claude nao aceita .docx/.xlsx como bloco nativo, entao a gente extrai o conteudo
// aqui e manda como texto simples (mesmo esquema ja usado pra transcricao de audio).
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

export async function extrairTextoWord(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

export async function extrairTextoExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const partes = [];
  workbook.eachSheet((sheet) => {
    partes.push(`## Planilha: ${sheet.name}`);
    sheet.eachRow((row) => {
      const valores = row.values
        .slice(1)
        .map((v) => {
          if (v == null) return '';
          if (typeof v === 'object' && v.text != null) return String(v.text);
          if (typeof v === 'object' && v.result != null) return String(v.result);
          return String(v);
        })
        .join(' | ');
      partes.push(valores);
    });
  });
  return partes.join('\n').trim();
}
