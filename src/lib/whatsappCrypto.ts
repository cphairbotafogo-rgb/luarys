/**
 * Criptografia de tokens WhatsApp em repouso (AES-256-GCM).
 * Usar apenas em rotas de API server-side — nunca importar em componentes cliente.
 *
 * Configurar em .env.local:
 *   WHATSAPP_TOKEN_ENCRYPTION_KEY=<64 chars hex>  # openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function obterChave(): Buffer {
  const hex = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'WHATSAPP_TOKEN_ENCRYPTION_KEY ausente ou inválida. ' +
      'Gere com: openssl rand -hex 32'
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Criptografa o token antes de salvar no banco. */
export function encryptarTokenWhatsapp(token: string): string {
  const chave = obterChave();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, chave, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Descriptografa o token para usar na chamada à API da Meta. */
export function decryptarTokenWhatsapp(ciphertext: string): string {
  const partes = ciphertext.split(':');
  if (partes.length !== 3) throw new Error('Formato de token criptografado inválido.');

  const [ivHex, tagHex, encryptedHex] = partes;
  const chave     = obterChave();
  const iv        = Buffer.from(ivHex, 'hex');
  const tag       = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, chave, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
