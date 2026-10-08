// "Cerebro-mae": mantem o Cerebro do dono (tenants super_admin) sempre atualizado com TODO o
// historico do app - modulos, melhorias, correcoes e decisoes - lido de cerebro-mae/historico.json
// (que vai junto no deploy). Roda no boot e a cada 24h; e idempotente: cada entrada e identificada
// pela tag "mae:<chave>", so cria o que falta e so atualiza (e regera o embedding) o que mudou.
//
// Como o grafo se forma: raiz -> hubs dos modulos -> entradas do modulo, e cada entrada tambem se
// liga a anterior do MESMO modulo (a ordem do arquivo e a ordem da evolucao) - da pra seguir os
// avancos de cada modulo no grafo. Alem disso o proprio Cerebro liga por similaridade.
//
// Regra do projeto (CLAUDE.md): toda entrega nova adiciona uma entrada em historico.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import * as cerebro from './cerebro.js';

const ARQUIVO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cerebro-mae', 'historico.json');
const PROJETO = 'Lumia';

function tituloDe(e) {
  return e.data ? `[${e.data}] ${e.titulo}` : e.titulo;
}

// numeros reais do app agora - so contagens agregadas, nada de dado de cliente
async function gerarRetrato() {
  const um = async (sql) => Number((await pool.query(sql)).rows[0].n);
  const [clientes, assinantes, instancias, contatos, mensagens, autoAtivos, memorias, contas] = await Promise.all([
    um(`SELECT count(*) n FROM tenants t LEFT JOIN tenant_config c ON c.tenant_id = t.id WHERE t.ativo AND c.proposta_plano IS NULL AND NOT t.super_admin`),
    um(`SELECT count(*) n FROM tenants t JOIN tenant_config c ON c.tenant_id = t.id WHERE t.ativo AND c.proposta_plano IS NOT NULL`),
    um(`SELECT count(*) n FROM whatsapp_instance_tenant`),
    um(`SELECT count(*) n FROM crm_contatos`),
    um(`SELECT count(*) n FROM crm_mensagens`),
    um(`SELECT count(*) n FROM auto_atendimento_config WHERE ativo`),
    um(`SELECT count(*) n FROM cerebro_memorias WHERE NOT arquivada`),
    um(`SELECT count(*) n FROM sec_contas`).catch(() => 0),
  ]);
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });
  return `Retrato em ${hoje}: ${clientes} cliente(s) ativo(s) da Lumia (fora o dono) e ${assinantes} assinante(s) do Gerador de Propostas. ${instancias} número(s) de WhatsApp conectado(s) no Evolution; ${autoAtivos} Auto Atendimento(s) ligado(s). CRM: ${contatos} contatos e ${mensagens} mensagens espelhadas. Secretaria: ${contas} conta(s) lançada(s). Cérebro: ${memorias} memórias. O mapa de cada módulo e da evolução está nos nós-hub ligados à raiz.`;
}

async function sincronizarTenant(tenantId, entradas) {
  const { rows: existentes } = await pool.query(
    `SELECT m.id, m.titulo, m.conteudo, substr(tag, 5) AS chave
     FROM cerebro_memorias m, unnest(m.tags) tag
     WHERE m.tenant_id = $1 AND tag LIKE 'mae:%'`,
    [tenantId],
  );
  const porChave = new Map(existentes.map((r) => [r.chave, r]));
  const ids = new Map(existentes.map((r) => [r.chave, r.id]));
  const ultimoDoModulo = new Map();
  let criadas = 0;
  let atualizadas = 0;

  for (const e of entradas) {
    const conteudo = e.dinamico ? await gerarRetrato() : e.conteudo;
    const titulo = tituloDe(e);
    const atual = porChave.get(e.chave);
    if (atual) {
      if (atual.titulo !== titulo || atual.conteudo !== conteudo) {
        await cerebro.atualizarMemoria(tenantId, atual.id, { titulo, conteudo });
        atualizadas += 1;
      }
    } else {
      // liga ao hub do modulo, a entrada anterior do mesmo modulo, e (hub) a raiz
      const relacionadas = [];
      if (e.chave !== 'raiz') {
        const hub = ids.get(e.hub || e.modulo === 'raiz' ? 'raiz' : `mod:${e.modulo}`);
        if (hub) relacionadas.push(hub);
        const anterior = ultimoDoModulo.get(e.modulo);
        if (anterior && !e.hub) relacionadas.push(anterior);
      }
      const nova = await cerebro.salvarMemoria(tenantId, {
        titulo, conteudo, tipo: e.tipo, projeto: PROJETO, origem: 'claude',
        tags: [e.modulo, 'historico', e.hub ? 'hub' : 'evolucao', `mae:${e.chave}`],
        relacionadas,
      });
      ids.set(e.chave, nova.id);
      criadas += 1;
    }
    if (!e.hub && ids.get(e.chave)) ultimoDoModulo.set(e.modulo, ids.get(e.chave));
  }
  // o retrato conta as memorias do cerebro - regera no FIM, depois de tudo ja criado, senao
  // o numero sai defasado na primeira sincronizacao
  for (const e of entradas.filter((x) => x.dinamico)) {
    const id = ids.get(e.chave);
    if (!id) continue;
    const conteudo = await gerarRetrato();
    const { rows: [atual] } = await pool.query('SELECT conteudo FROM cerebro_memorias WHERE id = $1', [id]);
    if (atual && atual.conteudo !== conteudo) {
      await cerebro.atualizarMemoria(tenantId, id, { titulo: tituloDe(e), conteudo });
      atualizadas += 1;
    }
  }
  return { criadas, atualizadas, total: entradas.length };
}

let rodando = false;
export async function sincronizarCerebroMae() {
  if (rodando || !pool) return;
  rodando = true;
  try {
    await cerebro.tabelasProntas;
    const entradas = JSON.parse(await fs.readFile(ARQUIVO, 'utf8'));
    const { rows: admins } = await pool.query('SELECT id FROM tenants WHERE super_admin = true AND ativo = true');
    for (const { id } of admins) {
      const r = await sincronizarTenant(id, entradas);
      if (r.criadas || r.atualizadas) console.log(`Cerebro-mae (tenant ${id}): ${r.criadas} nova(s), ${r.atualizadas} atualizada(s) de ${r.total}.`);
    }
  } catch (err) {
    console.error('Erro sincronizando o Cerebro-mae:', err.message);
  } finally {
    rodando = false;
  }
}

export function iniciarCerebroMae() {
  if (!pool) return;
  setTimeout(sincronizarCerebroMae, 20 * 1000).unref(); // espera o boot assentar
  setInterval(sincronizarCerebroMae, 24 * 60 * 60 * 1000).unref();
}
