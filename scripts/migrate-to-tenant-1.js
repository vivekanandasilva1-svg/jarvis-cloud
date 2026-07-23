// Migra a instalacao atual (env vars + dados existentes de UM cliente so) pro novo formato
// multi-tenant: cria o tenant 1 com as credenciais atuais, move os segredos (Clinicorp, Meta
// Ads) das env vars pro banco (cifrados), mapeia a instancia de WhatsApp atual pro tenant 1, e
// faz backfill de tenant_id em toda linha ja existente em toda tabela.
//
// SEGURO DE RODAR MAIS DE UMA VEZ (idempotente): se o tenant 1 ja existe, reaproveita; linhas
// que ja tem tenant_id preenchido sao puladas no backfill.
//
// Uso:
//   node scripts/migrate-to-tenant-1.js --dry-run   (so mostra o que faria, nao escreve nada)
//   node scripts/migrate-to-tenant-1.js             (aplica de verdade)
//
// IMPORTANTE: rode isso ANTES de subir o codigo novo do server.js em producao (a nova auth
// exige que exista pelo menos 1 tenant - sem isso o login do dono quebraria na hora). O jeito
// mais seguro: puxa o codigo novo no servidor (git pull), roda esse script direto por SSH
// enquanto o CONTAINER ANTIGO ainda esta rodando e atendendo trafego normal, confere que saiu
// tudo certo, so DEPOIS builda e reinicia o container com o codigo novo.
//
// Teste primeiro com --dry-run contra uma COPIA do banco de producao (pg_dump/restore), nunca
// direto em producao sem antes conferir as contagens.
import 'dotenv/config';
import { pool } from '../src/db.js';
import * as tenants from '../src/tenants.js';
import * as tenantConfig from '../src/tenantConfig.js';
// importados so pelo efeito colateral do carregamento (cada um cria/ajusta as proprias
// tabelas assim que o modulo e importado) - garante que o schema novo (colunas tenant_id,
// indices) ja existe antes do backfill abaixo mexer nelas
import '../src/whatsappInstances.js';
import '../src/googleCalendar.js';
import '../src/autoAtendimento.js';
import '../src/cloudAgent.js';
import '../src/crm.js';
import '../src/agenda.js';
import '../src/autoAtendimentoArquivos.js';
import '../src/relatoriosProgramados.js';

const DRY_RUN = process.argv.includes('--dry-run');

const TABELAS_PARA_BACKFILL = [
  'sessions', 'learned_instructions', 'lembretes', 'anexos_lidos',
  'crm_contatos', 'crm_mensagens', 'crm_seguranca', 'agenda_eventos',
  'auto_atendimento_sessions', 'auto_atendimento_arquivos',
  'relatorio_destinatarios', 'relatorio_configs',
  'whatsapp_config', 'google_calendar_tokens', 'auto_atendimento_config',
];

// espera ativa ate a coluna tenant_id existir em todas as tabelas acima - os modulos
// importados criam isso no proprio carregamento (assincrono), entao precisa confirmar que
// terminou antes de rodar qualquer UPDATE contra elas
async function esperarSchemaPronto() {
  const prazo = Date.now() + 20000;
  for (const tabela of TABELAS_PARA_BACKFILL) {
    for (;;) {
      const { rows } = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id'`,
        [tabela],
      );
      if (rows.length) break;
      if (Date.now() > prazo) throw new Error(`Timeout esperando a coluna tenant_id aparecer em "${tabela}" - o schema novo nao terminou de ser criado.`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

async function main() {
  if (!pool) {
    console.error('DATABASE_URL nao configurado no ambiente - preciso do Postgres pra migrar.');
    process.exit(1);
  }

  console.log(DRY_RUN ? '=== MODO DRY-RUN (nao escreve nada no banco) ===\n' : '=== MIGRACAO DE VERDADE ===\n');

  console.log('Esperando o schema novo (colunas tenant_id) terminar de ser criado...');
  await esperarSchemaPronto();
  console.log('Schema ok.\n');

  // ---------- 1. tenant 1 ----------
  const { rows: tenantsExistentes } = await pool.query('SELECT id, username FROM tenants');
  const username = process.env.ADMIN_USERNAME || 'Admin';
  const senha = process.env.APP_PASSWORD;

  let tenantId;
  const existente = tenantsExistentes.find((t) => t.username === username);
  if (existente) {
    tenantId = existente.id;
    console.log(`Tenant ja existe (id=${tenantId}, username="${username}") - reaproveitando, nao mexe na senha.`);
  } else {
    if (!senha) {
      console.error('APP_PASSWORD nao configurado no ambiente - preciso dele pra criar a senha do tenant 1 (so na primeira vez).');
      process.exit(1);
    }
    console.log(`Vou criar o tenant 1: slug="tenant-1", username="${username}" (senha = APP_PASSWORD atual).`);
    if (!DRY_RUN) {
      tenantId = await tenants.criarTenant({ slug: 'tenant-1', nome: 'Tenant 1 (migrado)', username, senha });
      console.log(`Tenant criado, id=${tenantId}.`);
    } else {
      tenantId = 1; // so pra continuar o dry-run mostrando os proximos passos com um id plausivel
    }
  }
  console.log('');

  // ---------- 2. credenciais do Clinicorp ----------
  const clinicorpUser = process.env.CLINICORP_API_USER;
  const clinicorpToken = process.env.CLINICORP_API_TOKEN;
  const clinicorpSubscriber = process.env.CLINICORP_SUBSCRIBER_ID;
  const clinicorpBusiness = process.env.CLINICORP_DEFAULT_BUSINESS_ID;
  if (clinicorpUser && clinicorpToken) {
    console.log(`Vou salvar as credenciais do Clinicorp (usuario "${clinicorpUser}") pro tenant ${tenantId}, cifradas.`);
    if (!DRY_RUN) {
      await tenantConfig.salvarClinicorp(tenantId, { apiUser: clinicorpUser, apiToken: clinicorpToken, subscriberId: clinicorpSubscriber, defaultBusinessId: clinicorpBusiness });
    }
  } else {
    console.log('CLINICORP_API_USER/CLINICORP_API_TOKEN nao configurados no ambiente - pulando (esse tenant fica sem Clinicorp).');
  }
  console.log('');

  // ---------- 3. tokens do Meta Ads (CRITICO - eram compartilhados globalmente antes) ----------
  const metaAdsTokensRaw = process.env.META_ADS_TOKENS;
  if (metaAdsTokensRaw) {
    let tokensList = null;
    try {
      tokensList = JSON.parse(metaAdsTokensRaw);
    } catch {
      console.error('META_ADS_TOKENS no ambiente nao e um JSON valido - pulando (confira manualmente).');
    }
    if (tokensList) {
      console.log(`Vou salvar ${tokensList.length} conjunto(s) de token do Meta Ads pro tenant ${tenantId}: ${tokensList.map((t) => t.label).join(', ')}`);
      if (!DRY_RUN) await tenantConfig.salvarMetaAdsTokens(tenantId, tokensList);
    }
  } else {
    console.log('META_ADS_TOKENS nao configurado no ambiente - pulando.');
  }
  console.log('');

  // ---------- 4. instancia de WhatsApp ativa + numero admin ----------
  // instalacao que ja tem uso real (schema antigo "id INT PK DEFAULT 1") JA TEM uma linha
  // aqui com os valores reais de producao - nao faz sentido sobrescrever com o valor da env
  // var (que pode nem bater mais). So insere do zero se a tabela estiver genuinamente vazia
  // (instalacao nova); senao so deixa o backfill do passo 5 preencher o tenant_id dessa linha.
  const instanciaAtiva = process.env.EVOLUTION_INSTANCE || 'Lumia';
  const numeroAdmin = process.env.LUMIA_WHATSAPP_ADMIN || null;
  const { rows: whatsappConfigExistente } = await pool.query('SELECT 1 FROM whatsapp_config LIMIT 1');
  if (whatsappConfigExistente.length) {
    console.log(`whatsapp_config ja tem uma linha (dado real de producao) - o backfill do passo 5 so vai preencher o tenant_id dela, sem mexer em instancia_ativa/numero_admin ja configurados.`);
  } else {
    console.log(`whatsapp_config esta vazia - vou criar a linha do tenant ${tenantId} com instancia_ativa="${instanciaAtiva}", numero_admin="${numeroAdmin || '(nenhum)'}" (valores das env vars atuais).`);
    if (!DRY_RUN) {
      await pool.query(
        `INSERT INTO whatsapp_config (tenant_id, instancia_ativa, numero_admin, atualizado_em) VALUES ($1,$2,$3,now())`,
        [tenantId, instanciaAtiva, numeroAdmin],
      );
    }
  }
  console.log(`Vou mapear a instancia "${instanciaAtiva}" pro tenant ${tenantId} (roteamento do webhook do WhatsApp).`);
  if (!DRY_RUN) await tenants.mapearInstanciaParaTenant(instanciaAtiva, tenantId);
  console.log('');

  // ---------- 5. backfill: toda linha existente sem tenant_id vira desse tenant ----------
  console.log('Backfill de tenant_id nas tabelas existentes:');
  for (const tabela of TABELAS_PARA_BACKFILL) {
    const { rows } = await pool.query(`SELECT count(*) FROM ${tabela} WHERE tenant_id IS NULL`);
    const pendentes = Number(rows[0].count);
    if (pendentes === 0) {
      console.log(`  ${tabela}: nada pra migrar (0 linhas sem tenant_id).`);
      continue;
    }
    console.log(`  ${tabela}: ${pendentes} linha(s) sem tenant_id -> vou marcar como tenant ${tenantId}.`);
    if (!DRY_RUN) {
      const { rowCount } = await pool.query(`UPDATE ${tabela} SET tenant_id = $1 WHERE tenant_id IS NULL`, [tenantId]);
      console.log(`    -> ${rowCount} linha(s) atualizada(s).`);
    }
  }

  console.log(DRY_RUN
    ? '\n=== FIM DO DRY-RUN - nada foi escrito. Confere os numeros acima e roda sem --dry-run pra aplicar de verdade. ==='
    : '\n=== MIGRACAO CONCLUIDA ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro na migracao:', err);
  process.exit(1);
});
