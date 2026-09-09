// Guarda as personalizacoes da pagina de proposta comercial (public/proposta.html) num id
// curto, pra nao precisar mandar nome do doutor/clinica/preco tudo na query string do link
// (ficava enorme). Agora e multi-tenant: virou o "Gerador de Propostas" que outros assinantes
// usam pra criar propostas pros PROPRIOS clientes deles (ver tenantConfig.js pro plano/marca de
// cada assinante - "branded" usa a marca fixa do Vivekananda, "white_label" usa a marca do
// proprio assinante). tenant_id fica nullable pra nao quebrar propostas antigas (criadas antes
// dessa mudanca, sem dono).
import { pool } from './db.js';
import crypto from 'node:crypto';
import { tabelasProntas as tenantsProntos } from './tenants.js';

async function garantirTabela() {
  if (!pool) return;
  await tenantsProntos;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS propostas_comerciais (
      id TEXT PRIMARY KEY,
      doctor_name TEXT,
      clinic_name TEXT,
      city TEXT,
      specialty TEXT,
      base_price NUMERIC,
      videomaker_price NUMERIC,
      has_videomaker BOOLEAN NOT NULL DEFAULT false,
      whatsapp_phone TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // tenant dono da proposta (quem a criou) - nullable pra nao quebrar linhas antigas, criadas
  // antes do gerador virar multi-tenant
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS propostas_comerciais_tenant_idx ON propostas_comerciais (tenant_id);`);
  // snapshot da marca de quem vendeu (plano do tenant no momento da criacao) - guardado na
  // propria linha pra a proposta ja enviada nao mudar de marca se o tenant trocar de plano ou
  // editar o proprio nome/logo depois
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'branded';`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS brand_name TEXT;`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS brand_subtitle TEXT;`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS logo_text TEXT;`);
}
export const tabelasProntas = garantirTabela().catch((err) => {
  console.error('Erro criando tabela propostas_comerciais:', err.message);
});

// limites generosos so pra evitar linha absurda indo pro banco (a pagina publica de leitura
// nao tem login, so a de CRIAR uma proposta exige tenant autenticado)
const LIMITES = {
  doctorName: 120, clinicName: 150, city: 100, specialty: 150, whatsappPhone: 30,
  brandName: 120, brandSubtitle: 150, logoText: 4,
};

function cortar(valor, max) {
  return typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, max) : null;
}

function gerarId() {
  // 4 bytes em base64url = 6 caracteres, suficiente pra um link curto sem colidir na pratica
  return crypto.randomBytes(4).toString('base64url');
}

// tenantId: dono da proposta. marca: snapshot { plano, brandName, brandSubtitle, logoText } -
// pra "branded" fica tudo null (a pagina publica cai nos valores fixos do Vivekananda)
export async function criar(tenantId, dados, marca = {}) {
  if (!pool) throw new Error('banco de dados nao configurado');
  await tabelasProntas;

  const linha = {
    doctor_name: cortar(dados.doctorName, LIMITES.doctorName),
    clinic_name: cortar(dados.clinicName, LIMITES.clinicName),
    city: cortar(dados.city, LIMITES.city),
    specialty: cortar(dados.specialty, LIMITES.specialty),
    base_price: Number.isFinite(Number(dados.basePrice)) ? Number(dados.basePrice) : null,
    videomaker_price: Number.isFinite(Number(dados.videomakerPrice)) ? Number(dados.videomakerPrice) : null,
    has_videomaker: !!dados.hasVideomaker,
    whatsapp_phone: cortar(dados.whatsappPhone, LIMITES.whatsappPhone),
    plano: marca.plano === 'white_label' ? 'white_label' : 'branded',
    brand_name: cortar(marca.brandName, LIMITES.brandName),
    brand_subtitle: cortar(marca.brandSubtitle, LIMITES.brandSubtitle),
    logo_text: cortar(marca.logoText, LIMITES.logoText),
  };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = gerarId();
    try {
      await pool.query(
        `INSERT INTO propostas_comerciais
           (id, tenant_id, doctor_name, clinic_name, city, specialty, base_price, videomaker_price, has_videomaker, whatsapp_phone, plano, brand_name, brand_subtitle, logo_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, tenantId || null, linha.doctor_name, linha.clinic_name, linha.city, linha.specialty, linha.base_price, linha.videomaker_price, linha.has_videomaker, linha.whatsapp_phone, linha.plano, linha.brand_name, linha.brand_subtitle, linha.logo_text]
      );
      return id;
    } catch (err) {
      if (err.code === '23505') continue; // colisao de id (raríssima) - tenta outro
      throw err;
    }
  }
  throw new Error('nao foi possivel gerar um id unico para a proposta');
}

function mapearLinha(r) {
  return {
    id: r.id,
    doctorName: r.doctor_name,
    clinicName: r.clinic_name,
    city: r.city,
    specialty: r.specialty,
    basePrice: r.base_price != null ? Number(r.base_price) : null,
    videomakerPrice: r.videomaker_price != null ? Number(r.videomaker_price) : null,
    hasVideomaker: r.has_videomaker,
    whatsappPhone: r.whatsapp_phone,
    plano: r.plano,
    brandName: r.brand_name,
    brandSubtitle: r.brand_subtitle,
    logoText: r.logo_text,
    criadoEm: r.criado_em,
  };
}

// leitura publica (pagina /p/:id, sem login) - devolve tambem a marca (snapshot) pra pagina
// saber de quem e essa proposta
export async function obter(id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT * FROM propostas_comerciais WHERE id = $1`, [id]);
  if (!rows.length) return null;
  return mapearLinha(rows[0]);
}

// "minhas propostas" - lista as que o tenant logado criou, mais recente primeiro
export async function listarPorTenant(tenantId) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    `SELECT * FROM propostas_comerciais WHERE tenant_id = $1 ORDER BY criado_em DESC LIMIT 200`,
    [tenantId]
  );
  return rows.map(mapearLinha);
}
