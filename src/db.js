// pool unico do Postgres, compartilhado por todos os modulos que precisam persistir dado
// (conversas, lembretes, agenda, tokens do Google) - evita abrir uma conexao/pool separada por
// modulo, o que esgotaria conexoes a toa. Sem DATABASE_URL, fica null e cada modulo decide
// sozinho como se comportar sem persistencia (normalmente: RAM ou "recurso indisponivel").
import pg from 'pg';

export const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

// Sem isso, o Postgres reiniciando (manutencao, reboot da VPS) derrubava o processo INTEIRO do app:
// o pool emite 'error' numa conexao ociosa que caiu e, sem ouvinte, vira excecao nao tratada. O pool
// descarta a conexao ruim e abre outra sozinho na proxima query - so precisa nao morrer por isso.
if (pool) {
  pool.on('error', (err) => console.error('Postgres: conexao ociosa caiu (o pool reconecta sozinho):', err.message));
}

// Depois de um reboot da VPS o app as vezes sobe ANTES do Postgres ficar pronto. Cada modulo cria/
// migra as proprias tabelas no import - se o banco ainda nao respondia, essa etapa falhava uma unica
// vez, era so logada e nunca mais refeita (coluna nova faltando ate o proximo deploy). Como este
// modulo e importado por todos eles, esperar o banco AQUI (top-level await) garante que nenhuma
// migracao rode antes do banco existir. Passou do limite, segue mesmo assim (loga) em vez de ficar
// pendurado pra sempre - o Docker Swarm tambem reinicia o app se ele cair.
const ERROS_SEM_ESPERA = new Set(['28P01', '28000', '3D000']); // senha errada / sem acesso / banco inexistente: esperar nao resolve

async function sondarBanco() {
  let timer;
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('sem resposta do Postgres em 5s')), 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function aguardarBanco() {
  const limiteMs = (Number(process.env.DB_ESPERA_MAX_SEGUNDOS) || 180) * 1000;
  const inicio = Date.now();
  let avisou = false;
  for (;;) {
    try {
      await sondarBanco();
      if (avisou) console.log(`Postgres ficou disponivel apos ${Math.round((Date.now() - inicio) / 1000)}s - seguindo o boot.`);
      return;
    } catch (err) {
      if (ERROS_SEM_ESPERA.has(err.code)) {
        console.error(`Postgres recusou a conexao (${err.code}: ${err.message}) - nao adianta esperar, seguindo o boot.`);
        return;
      }
      if (Date.now() - inicio > limiteMs) {
        console.error(`Postgres nao respondeu em ${Math.round(limiteMs / 1000)}s (${err.message}) - seguindo o boot mesmo assim.`);
        return;
      }
      if (!avisou) {
        console.log(`Aguardando o Postgres ficar pronto... (${err.message})`);
        avisou = true;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

if (pool) await aguardarBanco();
