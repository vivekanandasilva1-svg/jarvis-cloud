// pool unico do Postgres, compartilhado por todos os modulos que precisam persistir dado
// (conversas, lembretes, agenda, tokens do Google) - evita abrir uma conexao/pool separada por
// modulo, o que esgotaria conexoes a toa. Sem DATABASE_URL, fica null e cada modulo decide
// sozinho como se comportar sem persistencia (normalmente: RAM ou "recurso indisponivel").
import pg from 'pg';

export const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;
