// Alertas de retorno (modo 3 da aba "Resgate"): espelha a lista "CRM > Alertas de retorno" do Clinicorp num funil proprio,
// pra CRM acompanhar tudo dentro da Lumia. O Clinicorp NAO expoe os alertas de retorno por API (spec publica: 49 caminhos,
// nenhum de alerta/CRM), entao a lista entra por IMPORTACAO do relatorio exportado (colunas mapeadas na tela) ou cadastro manual.
// Cada paciente com telefone vira (ou reaproveita) um CONTATO DO CRM marcado com funil = 'retorno': assim notas, operador,
// midia, historico e o espelho do WhatsApp sao os mesmos do CRM - o paciente some do quadro principal do CRM e das contagens
// de leads, mas a conversa continua aparecendo em Conversas. IA e follow-ups automaticos ficam desligados (auto_pausado):
// so a EQUIPE atende. Quando o paciente chega numa etapa final (retornou / sem sucesso) ele volta pro fluxo normal do CRM.
// Tudo isolado por tenant.
import { pool } from './db.js';
import { tabelasProntas as tenantsProntos, listarInstanciasDoTenant } from './tenants.js';
import * as crm from './crm.js';
import * as whatsappInstances from './whatsappInstances.js';
import * as clinicorp from './clinicorp.js';

// colunas iguais as do quadro CRC > Alerta de retorno do Clinicorp (+ "Retornou" no fim, pra quem voltou de fato)
export const ETAPAS = [
  { id: 'novo', nome: 'A contatar' },
  { id: 'em_contato', nome: 'Em contato' },
  { id: 'retornar_novamente', nome: 'Retornar novamente' },
  { id: 'agendou', nome: 'Agendado' },
  { id: 'retornou', nome: 'Retornou' },
  { id: 'sem_sucesso', nome: 'Retorno recusado' },
];
const IDS_ETAPAS = new Set(ETAPAS.map((e) => e.id));
const FINAIS = new Set(['retornou', 'sem_sucesso']);
export const RESULTADOS = {
  nao_atendeu: 'Não atendeu',
  vai_pensar: 'Falou, vai pensar',
  retornar: 'Pediu para retornar depois',
  agendou: 'Agendou o retorno',
  sem_interesse: 'Sem interesse (retorno recusado)',
  numero_errado: 'Número errado',
};
export const MSG_PADRAO = 'Olá, {nome}! Aqui é da clínica. Está chegando a hora do seu retorno{motivo}. Posso te passar os horários disponíveis?';
const LIMITE_IMPORTACAO = 2000;

async function garantirTabelas() {
  if (!pool) return;
  await tenantsProntos;
  await crm.crmTabelasProntas; // coluna funil em crm_contatos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ret_config (
      tenant_id INT PRIMARY KEY REFERENCES tenants(id),
      operador_id INT,
      instancia TEXT,
      msg_whatsapp TEXT,
      ultima_importacao TIMESTAMPTZ,
      ultimo_resumo TEXT,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ret_pacientes (
      id SERIAL PRIMARY KEY,
      tenant_id INT NOT NULL REFERENCES tenants(id),
      chave TEXT NOT NULL,
      patient_id TEXT,
      nome TEXT,
      telefone TEXT NOT NULL DEFAULT '',
      motivo TEXT,
      data_alerta DATE,
      extras JSONB NOT NULL DEFAULT '{}'::jsonb,
      etapa TEXT NOT NULL DEFAULT 'novo',
      etapa_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
      contato_id INT,
      na_lista BOOLEAN NOT NULL DEFAULT true,
      arquivado BOOLEAN NOT NULL DEFAULT false,
      retorno_em TIMESTAMPTZ,
      retorno_nota TEXT,
      concluido_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, chave)
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ret_pacientes_tenant_idx ON ret_pacientes (tenant_id, arquivado, etapa)');
  // nome sem acento/caixa (acha o mesmo paciente vindo de outra planilha ou da tela colada) e controle da busca de telefone pelo nome
  await pool.query('ALTER TABLE ret_pacientes ADD COLUMN IF NOT EXISTS nome_chave TEXT');
  await pool.query('ALTER TABLE ret_pacientes ADD COLUMN IF NOT EXISTS fone_busca_em TIMESTAMPTZ');
  await pool.query('ALTER TABLE ret_pacientes ADD COLUMN IF NOT EXISTS fone_busca_resultado TEXT');
  await pool.query('CREATE INDEX IF NOT EXISTS ret_pacientes_nome_chave_idx ON ret_pacientes (tenant_id, nome_chave)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ret_tentativas (
      id SERIAL PRIMARY KEY,
      ret_id INT NOT NULL REFERENCES ret_pacientes(id) ON DELETE CASCADE,
      n INT NOT NULL,
      resultado TEXT NOT NULL,
      obs TEXT,
      feita_por TEXT,
      feita_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
const tabelasProntas = garantirTabelas().then(() => migrarAntigos()).catch((err) => console.error('[retorno] erro criando tabelas:', err.message));

// 1a versao tinha 1a/2a/3a tentativa e "Em conversa": agora tudo isso e a coluna "Em contato" (as tentativas ficam no card)
export async function migrarAntigos() {
  if (!pool) return;
  await pool.query(`UPDATE ret_pacientes SET etapa = 'em_contato' WHERE etapa IN ('tentativa1', 'tentativa2', 'tentativa3', 'em_conversa')`);
  const { rows } = await pool.query(`SELECT id, nome FROM ret_pacientes WHERE nome_chave IS NULL AND nome IS NOT NULL`);
  for (const p of rows) await pool.query('UPDATE ret_pacientes SET nome_chave = $2 WHERE id = $1', [p.id, slug(p.nome)]);
}

// ---------- leitura tolerante das linhas importadas ----------

const texto = (v, max) => { const t = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return t || null; };
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// aceita AAAA-MM-DD, DD/MM/AAAA (com ou sem hora) e numero de serie do Excel; devolve 'AAAA-MM-DD' ou null
export function lerData(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}
function valida(a, m, d) {
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? dt.toISOString().slice(0, 10) : null;
}

function limparLinha(l) {
  if (!l || typeof l !== 'object') return null;
  const nome = texto(l.nome, 120);
  const telefone = crm.normalizarTelefone(l.telefone) || '';
  const pacienteId = texto(l.pacienteId, 60);
  if (!nome && !telefone) return null;
  const extras = {};
  if (l.extras && typeof l.extras === 'object') for (const [k, v] of Object.entries(l.extras).slice(0, 20)) { const t = texto(v, 200); if (t) extras[String(k).slice(0, 60)] = t; }
  const etapa = IDS_ETAPAS.has(l.etapa) ? l.etapa : null;
  return { nome, telefone, pacienteId, motivo: texto(l.motivo, 200), dataAlerta: lerData(l.dataAlerta), extras, etapa, vencida: typeof l.vencida === 'boolean' ? l.vencida : undefined };
}
// com ID do Clinicorp a chave e o ID; sem ID, telefone + nome (pessoas da mesma familia que dividem o numero NAO viram a mesma)
const chaveDe = (l) => (l.pacienteId ? `id:${l.pacienteId}` : l.telefone ? `tel:${l.telefone}:${slug(l.nome)}` : `nome:${slug(l.nome)}`);

// ---------- configuracao ----------

export async function obterConfig(tenantId) {
  await tabelasProntas;
  await pool.query('INSERT INTO ret_config (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING', [tenantId]);
  const { rows: [c] } = await pool.query('SELECT operador_id, instancia, msg_whatsapp, ultima_importacao, ultimo_resumo FROM ret_config WHERE tenant_id = $1', [tenantId]);
  return c;
}

// numero de WhatsApp usado pelas conversas desse funil (so os conectados DESSA conta) e operador padrao dos novos alertas
export async function salvarConfig(tenantId, { operadorId, instancia, mensagem }, operadoresDaConta = []) {
  await tabelasProntas;
  await obterConfig(tenantId);
  if (operadorId !== undefined) {
    const op = operadorId === null || operadorId === '' ? null : Number(operadorId);
    if (op !== null && !operadoresDaConta.some((o) => o.id === op)) throw new Error('Operador não encontrado (ou desativado).');
    await pool.query('UPDATE ret_config SET operador_id = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, op]);
  }
  if (instancia !== undefined) {
    const inst = instancia ? String(instancia) : null;
    if (inst && !(await listarInstanciasDoTenant(tenantId)).includes(inst)) throw new Error('Esse número de WhatsApp não é desta conta.');
    await pool.query('UPDATE ret_config SET instancia = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, inst]);
  }
  if (mensagem !== undefined) {
    await pool.query('UPDATE ret_config SET msg_whatsapp = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, texto(mensagem, 1000)]);
  }
  if (instancia !== undefined) await vincularContatos(tenantId).catch((err) => console.error('[retorno] vincular:', err.message));
}

// ---------- vinculo com o CRM ----------

// garante que cada paciente (com telefone) em andamento tenha um contato do CRM marcado como funil 'retorno'
export async function vincularContatos(tenantId) {
  await tabelasProntas;
  const cfg = await obterConfig(tenantId);
  const instanciaPadrao = cfg.instancia || (await whatsappInstances.obterConfig(tenantId).catch(() => ({}))).instanciaAtiva || null;
  const { rows } = await pool.query(
    `SELECT id, nome, telefone, contato_id FROM ret_pacientes WHERE tenant_id = $1 AND arquivado = false AND telefone <> '' AND etapa <> ALL($2::text[])`,
    [tenantId, [...FINAIS]],
  );
  const r = { vinculados: 0, criados: 0, jaExistiam: 0, semNumero: 0 };
  for (const p of rows) {
    let contatoId = null;
    if (p.contato_id) {
      const { rows: ok } = await pool.query('SELECT id FROM crm_contatos WHERE id = $1 AND tenant_id = $2', [p.contato_id, tenantId]);
      contatoId = ok[0]?.id || null;
    }
    let existente = false;
    if (!contatoId) {
      const achado = await crm.acharContatoPorTelefone(tenantId, p.telefone);
      if (achado) { contatoId = achado.id; existente = true; }
      else if (instanciaPadrao) { contatoId = await crm.criarContatoDoClinicorp(tenantId, { numero: p.telefone, nome: p.nome, instancia: instanciaPadrao, etapa: 'em_atendimento' }); r.criados++; }
      else { r.semNumero++; continue; }
    }
    const { rows: marcado } = await pool.query(
      `UPDATE crm_contatos SET funil = 'retorno', auto_pausado = true WHERE id = $1 AND tenant_id = $2 AND (funil IS DISTINCT FROM 'retorno' OR auto_pausado = false) RETURNING id`,
      [contatoId, tenantId],
    );
    if (existente && marcado.length) r.jaExistiam++;
    if (p.contato_id !== contatoId) {
      await pool.query('UPDATE ret_pacientes SET contato_id = $2, atualizado_em = now() WHERE id = $1', [p.id, contatoId]);
      r.vinculados++;
    }
    if (cfg.operador_id) {
      const { rows: [c] } = await pool.query('SELECT atendente_id FROM crm_contatos WHERE id = $1 AND tenant_id = $2', [contatoId, tenantId]);
      if (c && (c.atendente_id === null || c.atendente_id === undefined)) await crm.definirAtendente(tenantId, contatoId, cfg.operador_id).catch(() => {});
    }
  }
  return r;
}

// paciente chegou numa etapa final: devolve o contato pro fluxo normal do CRM (so a marca de funil; a conversa fica como esta)
async function liberarContato(tenantId, contatoId) {
  if (!contatoId) return;
  await pool.query(`UPDATE crm_contatos SET funil = NULL WHERE id = $1 AND tenant_id = $2 AND funil = 'retorno'`, [contatoId, tenantId]);
}
async function prenderContato(tenantId, contatoId) {
  if (!contatoId) return;
  await pool.query(`UPDATE crm_contatos SET funil = 'retorno', auto_pausado = true WHERE id = $1 AND tenant_id = $2`, [contatoId, tenantId]);
}

// ---------- importacao ----------

// linhas: [{ nome, telefone, pacienteId, motivo, dataAlerta, extras }] ja mapeadas pela tela.
// listaCompleta = true: o arquivo e a lista INTEIRA do Clinicorp; quem estava no funil e nao veio fica marcado "fora da lista do Clinicorp".
export async function importar(tenantId, linhas, { listaCompleta = false, usarEtapaClinicorp = false } = {}) {
  await tabelasProntas;
  if (!Array.isArray(linhas) || !linhas.length) throw new Error('Nenhuma linha para importar.');
  if (linhas.length > LIMITE_IMPORTACAO) throw new Error(`Importe no máximo ${LIMITE_IMPORTACAO} pacientes por vez.`);
  const r = { total: linhas.length, novos: 0, atualizados: 0, reabertos: 0, semTelefone: 0, ignorados: 0, foraDaLista: 0 };
  const vistas = new Set();
  for (const bruta of linhas) {
    const l = limparLinha(bruta);
    if (!l) { r.ignorados++; continue; }
    const chave = chaveDe(l);
    if (vistas.has(chave)) { r.ignorados++; continue; }
    vistas.add(chave);
    if (!l.telefone) r.semTelefone++;
    if (l.vencida === true) l.extras.Vencida = 'sim';
    const nomeChave = l.nome ? slug(l.nome) : null;
    let { rows: [ex] } = await pool.query('SELECT id, etapa, concluido_em, arquivado FROM ret_pacientes WHERE tenant_id = $1 AND chave = $2', [tenantId, chave]);
    // outra planilha pode trazer o mesmo paciente com outra forma de identificar (com/sem ID): acha pelo ID do Clinicorp
    // ou pelo mesmo telefone + mesmo nome, e atualiza o que ja existe em vez de duplicar
    if (!ex && l.pacienteId) ({ rows: [ex] } = await pool.query('SELECT id, etapa, concluido_em, arquivado FROM ret_pacientes WHERE tenant_id = $1 AND patient_id = $2 ORDER BY id LIMIT 1', [tenantId, l.pacienteId]));
    // tela colada do Clinicorp nao traz telefone nem ID: acha pelo nome (so se houver UM paciente com esse nome)
    if (!ex && !l.telefone && !l.pacienteId && nomeChave) {
      const { rows: mesmoNome } = await pool.query('SELECT id, etapa, concluido_em, arquivado FROM ret_pacientes WHERE tenant_id = $1 AND nome_chave = $2', [tenantId, nomeChave]);
      if (mesmoNome.length === 1) ex = mesmoNome[0];
    }
    if (!ex && l.telefone && l.nome) {
      const { rows: mesmoFone } = await pool.query('SELECT id, nome, etapa, concluido_em, arquivado FROM ret_pacientes WHERE tenant_id = $1 AND telefone = $2', [tenantId, l.telefone]);
      ex = mesmoFone.find((x) => slug(x.nome) === slug(l.nome));
    }
    if (!ex) {
      await pool.query(
        `INSERT INTO ret_pacientes (tenant_id, chave, patient_id, nome, nome_chave, telefone, motivo, data_alerta, extras, etapa, concluido_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10, CASE WHEN $10 = ANY($11::text[]) THEN now() END)`,
        [tenantId, chave, l.pacienteId, l.nome, nomeChave, l.telefone, l.motivo, l.dataAlerta, JSON.stringify(l.extras), l.etapa || 'novo', [...FINAIS]],
      );
      r.novos++;
      continue;
    }
    // ja existia: atualiza os dados do alerta sem tocar no andamento (etapa, tentativas, notas, operador)
    // - exceto reabrir quem ja tinha terminado quando chega um alerta MAIS NOVO que a conclusao
    const reabrir = FINAIS.has(ex.etapa) && l.dataAlerta && (!ex.concluido_em || l.dataAlerta > ex.concluido_em.toISOString().slice(0, 10));
    await pool.query(
      `UPDATE ret_pacientes SET nome = COALESCE($3, nome), telefone = CASE WHEN $4 <> '' THEN $4 ELSE telefone END, patient_id = COALESCE($5, patient_id),
              motivo = COALESCE($6, motivo), data_alerta = COALESCE($7, data_alerta), extras = (extras || $8::jsonb)${l.vencida === false ? " - 'Vencida'" : ''}, na_lista = true, arquivado = false,
              nome_chave = COALESCE($9, nome_chave),
              ${reabrir ? "etapa = 'novo', etapa_desde = now(), concluido_em = NULL," : ''} atualizado_em = now()
       WHERE id = $1 AND tenant_id = $2`,
      [ex.id, tenantId, l.nome, l.telefone, l.pacienteId, l.motivo, l.dataAlerta, JSON.stringify(l.extras), nomeChave],
    );
    // espelhar a coluna do Clinicorp tambem pra quem ja estava no funil (so se o usuario escolher; senao vale o andamento feito na Lumia)
    if (usarEtapaClinicorp && l.etapa && !reabrir && ex.etapa !== l.etapa) await moverEtapa(tenantId, ex.id, l.etapa);
    if (reabrir) r.reabertos++; else r.atualizados++;
  }
  if (listaCompleta) {
    const { rowCount } = await pool.query(
      `UPDATE ret_pacientes SET na_lista = false, atualizado_em = now() WHERE tenant_id = $1 AND na_lista = true AND arquivado = false AND etapa <> ALL($2::text[]) AND NOT (chave = ANY($3::text[]))`,
      [tenantId, [...FINAIS], [...vistas]],
    );
    r.foraDaLista = rowCount;
  }
  const v = await vincularContatos(tenantId);
  const resumo = { ...r, ...v };
  await obterConfig(tenantId);
  await pool.query('UPDATE ret_config SET ultima_importacao = now(), ultimo_resumo = $2, atualizado_em = now() WHERE tenant_id = $1', [tenantId, JSON.stringify(resumo)]);
  return resumo;
}

// ---------- quadro ----------

export async function listar(tenantId) {
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT p.id, p.chave, p.patient_id, p.nome, p.telefone, p.motivo, to_char(p.data_alerta, 'YYYY-MM-DD') AS data_alerta, p.extras, p.etapa, p.etapa_desde,
            p.contato_id, p.na_lista, p.retorno_em, p.retorno_nota, p.concluido_em, p.criado_em, p.fone_busca_resultado,
            GREATEST(0, (now() AT TIME ZONE 'America/Maceio')::date - p.data_alerta)::int AS dias_atraso,
            c.numero, c.instancia, c.ultima_mensagem, c.ultima_mensagem_em, c.ultima_entrada_em, c.atendente_id, c.atendente_nome,
            (c.ultima_entrada_em IS NOT NULL AND (c.lido_em IS NULL OR c.ultima_entrada_em > c.lido_em)) AS nao_lida,
            (c.ultima_entrada_em IS NOT NULL AND c.ultima_entrada_em > p.etapa_desde) AS respondeu,
            (SELECT count(*)::int FROM crm_notas n WHERE n.contato_id = c.id) AS qtd_notas
       FROM ret_pacientes p LEFT JOIN crm_contatos c ON c.id = p.contato_id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1 AND p.arquivado = false
      ORDER BY p.data_alerta ASC NULLS LAST, p.id LIMIT 3000`,
    [tenantId],
  );
  const { rows: tent } = await pool.query(
    'SELECT t.ret_id, t.n, t.resultado, t.obs, t.feita_por, t.feita_em FROM ret_tentativas t JOIN ret_pacientes p ON p.id = t.ret_id WHERE p.tenant_id = $1 ORDER BY t.feita_em',
    [tenantId],
  );
  const porId = new Map();
  for (const t of tent) { if (!porId.has(t.ret_id)) porId.set(t.ret_id, []); porId.get(t.ret_id).push(t); }
  for (const r of rows) r.tentativas = porId.get(r.id) || [];
  return rows;
}

async function obter(tenantId, id) {
  await tabelasProntas;
  const { rows: [p] } = await pool.query('SELECT id, etapa, contato_id FROM ret_pacientes WHERE id = $1 AND tenant_id = $2 AND arquivado = false', [Number(id), tenantId]);
  if (!p) throw new Error('Paciente não encontrado.');
  return p;
}

export async function moverEtapa(tenantId, id, etapa) {
  if (!IDS_ETAPAS.has(etapa)) throw new Error('Etapa inválida.');
  const p = await obter(tenantId, id);
  if (p.etapa === etapa) return;
  await pool.query(`UPDATE ret_pacientes SET etapa = $3, etapa_desde = now(), concluido_em = ${FINAIS.has(etapa) ? 'now()' : 'NULL'}, atualizado_em = now() WHERE id = $1 AND tenant_id = $2`, [p.id, tenantId, etapa]);
  if (FINAIS.has(etapa)) await liberarContato(tenantId, p.contato_id);
  else await prenderContato(tenantId, p.contato_id);
}

// registra uma tentativa de contato e leva o card pra etapa que o resultado indica
export async function registrarTentativa(tenantId, id, { resultado, obs, autor }) {
  if (!RESULTADOS[resultado]) throw new Error('Escolha o resultado da tentativa.');
  const p = await obter(tenantId, id);
  const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM ret_tentativas WHERE ret_id = $1', [p.id]);
  const num = n + 1;
  await pool.query('INSERT INTO ret_tentativas (ret_id, n, resultado, obs, feita_por) VALUES ($1,$2,$3,$4,$5)', [p.id, num, resultado, texto(obs, 500), texto(autor, 80)]);
  const destino = resultado === 'agendou' ? 'agendou'
    : (resultado === 'sem_interesse' || resultado === 'numero_errado') ? 'sem_sucesso'
      : resultado === 'retornar' ? 'retornar_novamente'
        : 'em_contato';
  await moverEtapa(tenantId, p.id, destino);
  return { n: num, etapa: destino };
}

export async function definirRetorno(tenantId, id, { retornoEm, nota }) {
  const p = await obter(tenantId, id);
  const d = new Date(retornoEm);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) throw new Error('A data/hora do lembrete precisa ser no futuro.');
  await pool.query('UPDATE ret_pacientes SET retorno_em = $3, retorno_nota = $4, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [p.id, tenantId, d, texto(nota, 500)]);
}
export async function limparRetorno(tenantId, id) {
  const p = await obter(tenantId, id);
  await pool.query('UPDATE ret_pacientes SET retorno_em = NULL, retorno_nota = NULL, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [p.id, tenantId]);
}

// tira o paciente do funil (some da tela) e devolve o contato pro CRM normal
export async function arquivar(tenantId, id) {
  const p = await obter(tenantId, id);
  await pool.query('UPDATE ret_pacientes SET arquivado = true, atualizado_em = now() WHERE id = $1 AND tenant_id = $2', [p.id, tenantId]);
  await liberarContato(tenantId, p.contato_id);
}

// notas e operador usam o proprio CRM (mesma anotacao aparece na conversa)
export async function listarNotas(tenantId, id) {
  const p = await obter(tenantId, id);
  return p.contato_id ? crm.listarNotas(tenantId, p.contato_id) : [];
}
export async function criarNota(tenantId, id, dados) {
  const p = await obter(tenantId, id);
  if (!p.contato_id) throw new Error('Esse paciente ainda não tem conversa vinculada (sem telefone ou sem número de WhatsApp escolhido).');
  return crm.criarNota(tenantId, p.contato_id, dados);
}
export async function apagarNota(tenantId, notaId, quemId) {
  return crm.apagarNota(tenantId, notaId, quemId);
}
export async function definirAtendente(tenantId, id, operadorId) {
  const p = await obter(tenantId, id);
  if (!p.contato_id) throw new Error('Esse paciente ainda não tem conversa vinculada.');
  await crm.definirAtendente(tenantId, p.contato_id, operadorId === '' ? null : operadorId);
}

// ---------- tela colada do Clinicorp (CRC > Alerta de retorno) ----------

const COLUNAS_CLINICORP = [['a contatar', 'novo'], ['em contato', 'em_contato'], ['retornar novamente', 'retornar_novamente'], ['agendado', 'agendou'], ['retorno recusado', 'sem_sucesso']];
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ehChipDeTempo = (n) => /^(\d+\s*(d|h|min|m|s|sem|mes|meses|dias?|horas?))$/.test(n) || /^(no prazo|atrasad[oa]|vencid[oa]|hoje|amanha)$/.test(n);

// Texto copiado da tela (Ctrl+A / Ctrl+C na tela "Alerta de Retorno"): cada card tem nome, "Previsão de retorno" + data,
// "Profissional" + nome, "Motivo" + texto e o tempo ("11d", "No prazo"). A coluna vem do titulo (A contatar, Em contato...);
// os cards depois de "Vencidas" sao as vencidas daquela coluna.
export function lerTextoClinicorp(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let etapa = 'novo';
  let vencida = false;
  const out = [];
  const porColuna = {};
  let truncados = 0;
  for (let i = 0; i < linhas.length; i++) {
    const n = semAcento(linhas[i]);
    const col = COLUNAS_CLINICORP.find(([nome]) => n === nome);
    if (col) { etapa = col[1]; vencida = false; continue; }
    if (n === 'vencidas') { vencida = true; continue; }
    if (n !== 'previsao de retorno') continue;
    // card: o nome e a linha logo acima do rotulo
    let nome = linhas[i - 1] || '';
    const anterior = semAcento(nome);
    if (!nome || anterior === 'previsao de retorno' || anterior === 'motivo' || anterior === 'profissional' || ehChipDeTempo(anterior) || /^\d+$/.test(anterior)) continue;
    let j = i + 1;
    let dataAlerta = null;
    if (j < linhas.length && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(linhas[j])) { dataAlerta = linhas[j]; j++; }
    let profissional = null;
    let motivo = null;
    while (j < linhas.length) {
      const m = semAcento(linhas[j]);
      if (m === 'previsao de retorno' || COLUNAS_CLINICORP.some(([c]) => c === m) || m === 'vencidas') break;
      if (m === 'profissional') { profissional = linhas[j + 1] || null; j += 2; continue; }
      if (m === 'motivo') {
        const partes = [];
        j++;
        while (j < linhas.length && !ehChipDeTempo(semAcento(linhas[j])) && !/^(profissional|motivo|previsao de retorno)$/.test(semAcento(linhas[j]))) {
          // o proximo card comeca pelo nome seguido do rotulo: se a linha seguinte for o rotulo, esta linha e o nome do proximo
          if (semAcento(linhas[j + 1] || '') === 'previsao de retorno') break;
          partes.push(linhas[j]); j++;
        }
        motivo = partes.join(' ') || null;
        continue;
      }
      if (ehChipDeTempo(m)) { j++; break; }
      if (semAcento(linhas[j + 1] || '') === 'previsao de retorno') break; // nome do proximo card
      j++;
    }
    const nomeTruncado = /(\.\.\.|…)$/.test(nome);
    if (nomeTruncado) truncados++;
    out.push({ nome, dataAlerta, motivo, etapa, vencida, extras: profissional ? { Profissional: profissional } : {} });
    porColuna[etapa] = (porColuna[etapa] || 0) + 1;
    i = Math.max(i, j - 1);
  }
  return { linhas: out, total: out.length, porColuna, vencidas: out.filter((l) => l.vencida).length, truncados };
}

// ---------- telefone pelo cadastro do Clinicorp (a tela colada nao traz telefone) ----------

const CAMPOS_TELEFONE = ['MobilePhone', 'CellPhone', 'Cellphone', 'Mobile', 'WhatsApp', 'Whatsapp', 'Phone', 'Telephone', 'PhoneNumber', 'Celular', 'Telefone'];
function pegar(obj, nomes) {
  if (!obj || typeof obj !== 'object') return undefined;
  const mapa = new Map(Object.keys(obj).map((k) => [k.toLowerCase().replace(/[_\s-]/g, ''), k]));
  for (const n of nomes) {
    const k = mapa.get(n.toLowerCase().replace(/[_\s-]/g, ''));
    if (k !== undefined && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') return obj[k];
  }
  return undefined;
}
const listaDeResposta = (r) => (Array.isArray(r) ? r : Array.isArray(r?.list) ? r.list : Array.isArray(r?.patients) ? r.patients : Array.isArray(r?.Patients) ? r.Patients : r?.Patient ? [r.Patient] : r && typeof r === 'object' ? [r] : []);

const completando = new Set();

// Procura no Clinicorp (por nome) o telefone dos pacientes que entraram sem telefone e cria a conversa. So aceita quando ha
// UM paciente com exatamente esse nome. Respeita o limite de consultas do Clinicorp: automatico = para antes de gastar a reserva do uso manual.
export async function completarTelefones(tenantId, { limite = 8, automatico = false } = {}) {
  await tabelasProntas;
  if (completando.has(tenantId)) return { ocupado: true };
  completando.add(tenantId);
  const res = { processados: 0, encontrados: 0, naoEncontrados: 0, ambiguos: 0, semTelefone: 0, truncados: 0, limiteAtingido: false, semClinicorp: false, restantes: 0 };
  try {
    const rodar = async () => {
      const { rows } = await pool.query(
        `SELECT id, nome FROM ret_pacientes WHERE tenant_id = $1 AND arquivado = false AND telefone = '' AND nome IS NOT NULL AND etapa <> ALL($2::text[])
            AND (fone_busca_resultado IS NULL OR fone_busca_resultado = 'erro') ORDER BY id LIMIT $3`,
        [tenantId, [...FINAIS], Math.max(1, Math.min(Number(limite) || 8, 30))],
      );
      let errosSeguidos = 0;
      for (const p of rows) {
        if (/(\.\.\.|…)$/.test(p.nome)) {
          await pool.query(`UPDATE ret_pacientes SET fone_busca_resultado = 'nome_truncado', fone_busca_em = now() WHERE id = $1`, [p.id]);
          res.truncados++; res.processados++;
          continue;
        }
        let resultado;
        let telefone = '';
        let patientId = null;
        try {
          const lista = listaDeResposta(await clinicorp.findPatient(tenantId, { name: p.nome }));
          const iguais = lista.filter((c) => slug(pegar(c, ['Name', 'PatientName', 'FullName', 'Nome'])) === slug(p.nome));
          if (iguais.length > 1) resultado = 'ambiguo';
          else if (!iguais.length) resultado = 'nao_encontrado';
          else {
            for (const campo of CAMPOS_TELEFONE) { telefone = crm.normalizarTelefone(pegar(iguais[0], [campo])) || ''; if (telefone) break; }
            const id = pegar(iguais[0], ['PatientId', 'Patient_Id', 'PersonId', 'Id']);
            patientId = id === undefined ? null : String(id);
            resultado = telefone ? 'encontrado' : 'sem_telefone';
          }
          errosSeguidos = 0;
        } catch (err) {
          if (err.codigo === 'CLINICORP_LIMITE') { res.limiteAtingido = true; break; }
          if (/nao tem o Clinicorp conectado|não tem o Clinicorp conectado/i.test(err.message)) { res.semClinicorp = true; break; }
          await pool.query(`UPDATE ret_pacientes SET fone_busca_resultado = 'erro', fone_busca_em = now() WHERE id = $1`, [p.id]);
          res.processados++;
          if (++errosSeguidos >= 3) break;
          continue;
        }
        await pool.query(
          `UPDATE ret_pacientes SET telefone = CASE WHEN $2 <> '' THEN $2 ELSE telefone END, patient_id = COALESCE($3, patient_id), fone_busca_resultado = $4, fone_busca_em = now(), atualizado_em = now() WHERE id = $1`,
          [p.id, telefone, patientId, resultado],
        );
        res.processados++;
        if (resultado === 'encontrado') res.encontrados++;
        else if (resultado === 'ambiguo') res.ambiguos++;
        else if (resultado === 'sem_telefone') res.semTelefone++;
        else res.naoEncontrados++;
      }
    };
    await (automatico ? clinicorp.comoAutomatico(rodar) : rodar());
    if (res.encontrados) await vincularContatos(tenantId);
    const { rows: [{ n }] } = await pool.query(
      `SELECT count(*)::int AS n FROM ret_pacientes WHERE tenant_id = $1 AND arquivado = false AND telefone = '' AND nome IS NOT NULL AND etapa <> ALL($2::text[]) AND (fone_busca_resultado IS NULL OR fone_busca_resultado = 'erro')`,
      [tenantId, [...FINAIS]],
    );
    res.restantes = n;
    return res;
  } finally {
    completando.delete(tenantId);
  }
}

// a cada 20 min completa alguns telefones pendentes (em lotes pequenos, pra nao gastar o limite de consultas do Clinicorp)
export function iniciarSchedulerRetorno() {
  if (!pool) return;
  const rodada = async () => {
    try {
      await tabelasProntas;
      const { rows } = await pool.query(
        `SELECT DISTINCT p.tenant_id FROM ret_pacientes p JOIN tenants t ON t.id = p.tenant_id
          WHERE p.arquivado = false AND p.telefone = '' AND p.nome IS NOT NULL AND (p.fone_busca_resultado IS NULL OR p.fone_busca_resultado = 'erro') AND (t.ativo OR t.super_admin)`,
      );
      for (const { tenant_id: tenantId } of rows) {
        const r = await completarTelefones(tenantId, { limite: 8, automatico: true }).catch((err) => { console.error('[retorno] completar telefones:', err.message); return null; });
        if (r && r.limiteAtingido) continue;
      }
    } catch (err) {
      console.error('[retorno] agendador:', err.message);
    }
  };
  setTimeout(rodada, 60 * 1000).unref();
  setInterval(rodada, 20 * 60 * 1000).unref();
}
