// integracao com Google Sheets - usa a MESMA conexao Google da Agenda (googleAuth.js), entao
// so funciona se o usuario ja tiver conectado o Google na aba Agenda do app (com o escopo de
// planilhas incluso). Cada funcao aceita tanto o ID puro da planilha quanto a URL inteira que o
// usuario costuma colar (ex: "https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0").
import { tokenValido } from './googleAuth.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function idDaPlanilha(urlOuId) {
  const match = String(urlOuId).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOuId;
}

async function chamarApi(tenantId, method, path, body) {
  const token = await tokenValido(tenantId);
  const res = await fetch(`${SHEETS_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `Google Sheets API erro ${res.status}`);
  return data;
}

// lista as abas (paginas/planilhas dentro do arquivo) - util pra descobrir o nome certo antes
// de ler/escrever um intervalo especifico (ex: "Laboratorio!A1:F50")
export async function listarAbas(tenantId, planilha) {
  const id = idDaPlanilha(planilha);
  const data = await chamarApi(tenantId, 'GET', `/${id}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`);
  return {
    nomeArquivo: data.properties?.title,
    abas: (data.sheets || []).map((s) => ({
      id: s.properties.sheetId,
      nome: s.properties.title,
      linhas: s.properties.gridProperties?.rowCount,
      colunas: s.properties.gridProperties?.columnCount,
    })),
  };
}

// intervalo no formato do Google Sheets, ex: "Laboratorio!A1:F50" ou so "A1:F50" (usa a
// primeira aba). Devolve uma matriz (array de linhas, cada linha um array de celulas) - linhas/
// colunas vazias no final simplesmente nao vem, do jeito que a API do Google ja devolve.
export async function lerIntervalo(tenantId, { planilha, intervalo }) {
  const id = idDaPlanilha(planilha);
  const data = await chamarApi(tenantId, 'GET', `/${id}/values/${encodeURIComponent(intervalo)}`);
  return data.values || [];
}

// sobrescreve um intervalo especifico com os valores passados (matriz: array de linhas, cada
// linha um array de celulas, na mesma ordem/tamanho das colunas do intervalo)
export async function escreverIntervalo(tenantId, { planilha, intervalo, valores }) {
  const id = idDaPlanilha(planilha);
  await chamarApi(tenantId, 'PUT', `/${id}/values/${encodeURIComponent(intervalo)}?valueInputOption=USER_ENTERED`, {
    values: valores,
  });
  return { ok: true };
}

// adiciona uma linha nova no FIM da tabela de dados de uma aba - nao precisa saber em qual
// linha exata cai, o Google Sheets acha o fim da tabela sozinho (API de "append")
export async function adicionarLinha(tenantId, { planilha, aba, valores }) {
  const id = idDaPlanilha(planilha);
  await chamarApi(tenantId, 'POST', `/${id}/values/${encodeURIComponent(aba)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    values: [valores],
  });
  return { ok: true };
}
