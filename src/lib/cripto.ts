/**
 * Criptografia genérica de segredos em repouso (AES-256-GCM).
 * Usar APENAS em rotas de API server-side — nunca importar em componentes cliente.
 *
 * Configurar em .env.local (e na Vercel):
 *   SEGREDO_ENCRYPTION_KEY=<64 chars hex>   # gerar com: openssl rand -hex 32
 *
 * Formato de saída: "iv:tag:dados" em hex — compatível com whatsappCrypto.ts.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function obterChave(): Buffer {
  const hex = process.env.SEGREDO_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SEGREDO_ENCRYPTION_KEY ausente ou inválida. Gere com: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Criptografa um segredo antes de gravar no banco. Retorna "iv:tag:dados" (hex). */
export function encryptarSegredo(texto: string): string {
  const chave = obterChave();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, chave, iv);
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Descriptografa um segredo lido do banco. */
export function decryptarSegredo(ciphertext: string): string {
  const partes = ciphertext.split(':');
  if (partes.length !== 3) throw new Error('Formato de segredo criptografado inválido.');
  const [ivHex, tagHex, encryptedHex] = partes;
  const chave     = obterChave();
  const iv        = Buffer.from(ivHex, 'hex');
  const tag       = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, chave, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
