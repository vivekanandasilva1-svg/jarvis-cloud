// criptografia de credenciais de tenant (Clinicorp etc) guardadas no Postgres - AES-256-GCM
// no nivel da aplicacao, chave mestra so no processo (TENANT_SECRETS_KEY), nunca no banco.
// Diferente de pgcrypto (que passaria a chave como literal SQL, alcancavel de dentro do
// Postgres): um dump/snapshot do banco sozinho nao e o suficiente pra decifrar nada, precisa
// tambem da chave que so existe nas env vars do processo - mesmo principio ja usado pro
// SESSION_SECRET e pro segredo do webhook do WhatsApp.
import crypto from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12; // recomendado pro GCM

function chave() {
  const b64 = process.env.TENANT_SECRETS_KEY;
  if (!b64) throw new Error('TENANT_SECRETS_KEY nao configurado - obrigatorio pra guardar credenciais de tenant');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) throw new Error('TENANT_SECRETS_KEY precisa ser 32 bytes em base64 (gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")');
  return buf;
}

// devolve um Buffer unico (iv + authTag + ciphertext concatenados) pronto pra salvar numa
// coluna BYTEA - nao precisa de coluna separada pro iv/tag, tudo cabe num campo so
export function encrypt(textoPlano) {
  if (textoPlano == null) return null;
  const iv = crypto.randomBytes(TAMANHO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, chave(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decrypt(buffer) {
  if (buffer == null) return null;
  const iv = buffer.subarray(0, TAMANHO_IV);
  const authTag = buffer.subarray(TAMANHO_IV, TAMANHO_IV + 16);
  const ciphertext = buffer.subarray(TAMANHO_IV + 16);
  const decipher = crypto.createDecipheriv(ALGORITMO, chave(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
