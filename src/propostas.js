// Guarda as personalizacoes da pagina de proposta comercial (public/proposta.html) num id
// curto, pra nao precisar mandar nome do doutor/clinica/preco tudo na query string do link
// (ficava enorme). Ferramenta de vendas do proprio Vivekananda pra fechar clinicas - sem
// tenant_id de proposito, nao e uma feature do produto Lumia em si.
import { pool } from './db.js';
import crypto from 'node:crypto';

async function garantirTabela() {
  if (!pool) return;
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
}
export const tabelasProntas = garantirTabela().catch((err) => {
  console.error('Erro criando tabela propostas_comerciais:', err.message);
});

// limites generosos so pra evitar linha absurda indo pro banco (a pagina e publica, sem login)
const LIMITES = { doctorName: 120, clinicName: 150, city: 100, specialty: 150, whatsappPhone: 30 };

function cortar(valor, max) {
  return typeof valor === 'string' ? valor.slice(0, max) : null;
}

function gerarId() {
  // 4 bytes em base64url = 6 caracteres, suficiente pra um link curto sem colidir na pratica
  return crypto.randomBytes(4).toString('base64url');
}

export async function criar(dados) {
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
  };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = gerarId();
    try {
      await pool.query(
        `INSERT INTO propostas_comerciais
           (id, doctor_name, clinic_name, city, specialty, base_price, videomaker_price, has_videomaker, whatsapp_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, linha.doctor_name, linha.clinic_name, linha.city, linha.specialty, linha.base_price, linha.videomaker_price, linha.has_videomaker, linha.whatsapp_phone]
      );
      return id;
    } catch (err) {
      if (err.code === '23505') continue; // colisao de id (raríssima) - tenta outro
      throw err;
    }
  }
  throw new Error('nao foi possivel gerar um id unico para a proposta');
}

export async function obter(id) {
  if (!pool) return null;
  await tabelasProntas;
  const { rows } = await pool.query(`SELECT * FROM propostas_comerciais WHERE id = $1`, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    doctorName: r.doctor_name,
    clinicName: r.clinic_name,
    city: r.city,
    specialty: r.specialty,
    basePrice: r.base_price != null ? Number(r.base_price) : null,
    videomakerPrice: r.videomaker_price != null ? Number(r.videomaker_price) : null,
    hasVideomaker: r.has_videomaker,
    whatsappPhone: r.whatsapp_phone,
  };
}
