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
  // addon de video em 2 niveis (basico/plus com social media) - "addon_nivel" e a fonte de
  // verdade; has_videomaker/videomaker_price ficam so por compatibilidade com leitura de linhas
  // criadas antes dessa mudanca (ver mapearLinha)
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS addon_nivel TEXT NOT NULL DEFAULT 'nenhum';`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS videomaker_plus_price NUMERIC;`);
  // Automacao LumIA - servico a parte, com valor de implementacao (pagamento unico) e
  // mensalidade definidos caso a caso (podem ficar em branco = "sob consulta", ate o estudo
  // estrategico do negocio do cliente definir um numero)
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS has_lumia BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS lumia_implementation_price NUMERIC;`);
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS lumia_monthly_price NUMERIC;`);
  // snapshot do modelo de conteudo do tenant (ver tenantConfig.js proposta_template_html) no
  // momento da criacao - so preenchido pra assinantes white_label que ja tem um modelo salvo;
  // fica null pra "branded" (usa o conteudo padrao fixo do Vivekananda)
  await pool.query(`ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS template_html TEXT;`);
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

function numeroOuNulo(valor) {
  return Number.isFinite(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
}

// tenantId: dono da proposta. marca: snapshot { plano, brandName, brandSubtitle, logoText } -
// pra "branded" fica tudo null (a pagina publica cai nos valores fixos do Vivekananda)
export async function criar(tenantId, dados, marca = {}) {
  if (!pool) throw new Error('banco de dados nao configurado');
  await tabelasProntas;

  // addonNivel e a fonte de verdade ('nenhum'|'basico'|'plus'); aceita o hasVideomaker antigo
  // como fallback pra nao quebrar nenhuma chamada que ainda mande so o campo velho
  let addonNivel = ['nenhum', 'basico', 'plus'].includes(dados.addonNivel) ? dados.addonNivel : null;
  if (!addonNivel) addonNivel = dados.hasVideomaker ? 'basico' : 'nenhum';

  const linha = {
    doctor_name: cortar(dados.doctorName, LIMITES.doctorName),
    clinic_name: cortar(dados.clinicName, LIMITES.clinicName),
    city: cortar(dados.city, LIMITES.city),
    specialty: cortar(dados.specialty, LIMITES.specialty),
    base_price: Number.isFinite(Number(dados.basePrice)) ? Number(dados.basePrice) : null,
    videomaker_price: Number.isFinite(Number(dados.videomakerPrice)) ? Number(dados.videomakerPrice) : null,
    videomaker_plus_price: Number.isFinite(Number(dados.videomakerPlusPrice)) ? Number(dados.videomakerPlusPrice) : null,
    addon_nivel: addonNivel,
    has_videomaker: addonNivel !== 'nenhum',
    has_lumia: !!dados.hasLumia,
    lumia_implementation_price: numeroOuNulo(dados.lumiaImplementationPrice),
    lumia_monthly_price: numeroOuNulo(dados.lumiaMonthlyPrice),
    whatsapp_phone: cortar(dados.whatsappPhone, LIMITES.whatsappPhone),
    plano: marca.plano === 'white_label' ? 'white_label' : 'branded',
    brand_name: cortar(marca.brandName, LIMITES.brandName),
    brand_subtitle: cortar(marca.brandSubtitle, LIMITES.brandSubtitle),
    logo_text: cortar(marca.logoText, LIMITES.logoText),
    // so leva o modelo de conteudo pra propostas white_label - "branded" sempre usa o
    // conteudo padrao fixo, mesmo que o campo venha preenchido por engano
    template_html: marca.plano === 'white_label' && typeof marca.templateHtml === 'string' ? marca.templateHtml : null,
  };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = gerarId();
    try {
      await pool.query(
        `INSERT INTO propostas_comerciais
           (id, tenant_id, doctor_name, clinic_name, city, specialty, base_price, videomaker_price, videomaker_plus_price, addon_nivel, has_videomaker, has_lumia, lumia_implementation_price, lumia_monthly_price, whatsapp_phone, plano, brand_name, brand_subtitle, logo_text, template_html)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [id, tenantId || null, linha.doctor_name, linha.clinic_name, linha.city, linha.specialty, linha.base_price, linha.videomaker_price, linha.videomaker_plus_price, linha.addon_nivel, linha.has_videomaker, linha.has_lumia, linha.lumia_implementation_price, linha.lumia_monthly_price, linha.whatsapp_phone, linha.plano, linha.brand_name, linha.brand_subtitle, linha.logo_text, linha.template_html]
      );
      return id;
    } catch (err) {
      if (err.code === '23505') continue; // colisao de id (raríssima) - tenta outro
      throw err;
    }
  }
  throw new Error('nao foi possivel gerar um id unico para a proposta');
}

function mapearLinha(r, { incluirTemplate = false } = {}) {
  // linhas criadas antes do addon_nivel existir tem o default 'nenhum' mesmo com
  // has_videomaker=true - cai pro "basico" nesse caso pra nao perder o addon que já tinham
  const addonNivel = r.addon_nivel && r.addon_nivel !== 'nenhum'
    ? r.addon_nivel
    : (r.has_videomaker ? 'basico' : 'nenhum');
  const linha = {
    id: r.id,
    doctorName: r.doctor_name,
    clinicName: r.clinic_name,
    city: r.city,
    specialty: r.specialty,
    basePrice: r.base_price != null ? Number(r.base_price) : null,
    videomakerPrice: r.videomaker_price != null ? Number(r.videomaker_price) : null,
    videomakerPlusPrice: r.videomaker_plus_price != null ? Number(r.videomaker_plus_price) : null,
    addonNivel,
    hasVideomaker: r.has_videomaker,
    hasLumia: r.has_lumia,
    lumiaImplementationPrice: r.lumia_implementation_price != null ? Number(r.lumia_implementation_price) : null,
    lumiaMonthlyPrice: r.lumia_monthly_price != null ? Number(r.lumia_monthly_price) : null,
    whatsappPhone: r.whatsapp_phone,
    plano: r.plano,
    brandName: r.brand_name,
    brandSubtitle: r.brand_subtitle,
    logoText: r.logo_text,
    criadoEm: r.criado_em,
  };
  // o HTML do modelo pode ser grande (ate ~300kb) - so entra na resposta quando quem pediu
  // realmente precisa renderizar a proposta (obter por id); a listagem "minhas propostas" fica
  // leve de proposito, sem esse campo
  if (incluirTemplate) linha.templateHtml = r.template_html || null;
  return linha;
}

// leitura publica (pagina /p/:id, sem login) - devolve tambem a marca (snapshot) pra pagina
// saber de quem e essa proposta, incluindo o modelo de conteudo customizado (se houver)
export async function obter(id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT * FROM propostas_comerciais WHERE id = $1`, [id]);
  if (!rows.length) return null;
  return mapearLinha(rows[0], { incluirTemplate: true });
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
