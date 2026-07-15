// biblioteca de arquivos de referencia do Auto Atendimento - PDFs, imagens, videos ou audios
// que o usuario sobe uma vez e a Lumia pode escolher mandar pra um contato durante a conversa
// (ex: catalogo, tabela de precos, video institucional). Guardado no Postgres como bytea -
// simples e consistente com o resto do app, sem precisar de storage externo.
import { pool } from './db.js';

async function garantirTabela() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auto_atendimento_arquivos (
      id SERIAL PRIMARY KEY,
      nome_arquivo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      media_type TEXT NOT NULL,
      conteudo BYTEA NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
const tabelaPronta = garantirTabela().catch((err) => {
  console.error('Erro criando tabela auto_atendimento_arquivos:', err.message);
});

export async function salvarArquivo(nomeArquivo, descricao, buffer, mediaType) {
  if (!pool) throw new Error('Precisa do Postgres configurado (DATABASE_URL) pra guardar arquivos de referencia.');
  await tabelaPronta;
  const { rows } = await pool.query(
    'INSERT INTO auto_atendimento_arquivos (nome_arquivo, descricao, media_type, conteudo) VALUES ($1,$2,$3,$4) RETURNING id',
    [nomeArquivo, descricao, mediaType, buffer],
  );
  return rows[0].id;
}

// sem o campo "conteudo" (bytea grande) - usado pra listar na tela e pro prompt da IA saber o
// que tem disponivel, sem carregar o binario inteiro a toa
export async function listarArquivos() {
  if (!pool) return [];
  await tabelaPronta;
  const { rows } = await pool.query(
    'SELECT id, nome_arquivo, descricao, media_type, octet_length(conteudo) AS tamanho, criado_em FROM auto_atendimento_arquivos ORDER BY criado_em DESC',
  );
  return rows;
}

export async function obterArquivo(id) {
  if (!pool) return null;
  await tabelaPronta;
  const { rows } = await pool.query('SELECT nome_arquivo, descricao, media_type, conteudo FROM auto_atendimento_arquivos WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function apagarArquivo(id) {
  if (!pool) throw new Error('Precisa do Postgres configurado.');
  await pool.query('DELETE FROM auto_atendimento_arquivos WHERE id = $1', [id]);
}
