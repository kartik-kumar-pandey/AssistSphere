/**
 * encryption.service.ts
 *
 * AES-256-GCM encryption for recording files.
 *
 * Design:
 *  - Each recording gets a unique random 256-bit data key (DEK).
 *  - The DEK is encrypted with a master key (KEK) from RECORDING_MASTER_KEY env var.
 *  - The encrypted DEK, IV, and GCM auth tag are stored in the database.
 *  - The on-disk file contains only ciphertext — unreadable without the DEK + master key.
 *
 * Security properties:
 *  - Storage provider cannot read recordings (no plaintext on disk).
 *  - Application owner cannot read recordings without the RECORDING_MASTER_KEY env var.
 *  - Each recording has an independent key — compromise of one does not affect others.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12;  // 96-bit IV (recommended for GCM)
const KEY_BYTES  = 32;  // 256-bit key

/** Returns a 32-byte master key (KEK) from the environment variable. */
function getMasterKey(): Buffer {
  const raw = process.env.RECORDING_MASTER_KEY ?? '';
  if (raw.length < 16) {
    throw new Error(
      'RECORDING_MASTER_KEY is missing or too short. ' +
      'Set a 64-char hex string in your .env file.'
    );
  }
  // Accept 64-char hex directly; otherwise derive via SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Generates a fresh random 256-bit data encryption key (DEK). */
export function generateDataKey(): Buffer {
  return crypto.randomBytes(KEY_BYTES);
}

/**
 * Wraps (encrypts) a DEK with the master key using AES-256-GCM.
 * Returns hex-encoded encryptedKey, iv, and auth tag.
 */
export function wrapKey(dek: Buffer): {
  encryptedKeyHex: string;
  ivHex: string;
  tagHex: string;
} {
  const kek = getMasterKey();
  const iv  = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedKeyHex: encrypted.toString('hex'),
    ivHex:           iv.toString('hex'),
    tagHex:          tag.toString('hex'),
  };
}

/**
 * Unwraps (decrypts) a DEK that was wrapped by wrapKey().
 * Throws if the auth tag fails — i.e. wrong master key or tampered data.
 */
export function unwrapKey(
  encryptedKeyHex: string,
  ivHex: string,
  tagHex: string
): Buffer {
  const kek          = getMasterKey();
  const iv           = Buffer.from(ivHex, 'hex');
  const tag          = Buffer.from(tagHex, 'hex');
  const encryptedKey = Buffer.from(encryptedKeyHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
}

/**
 * Encrypts a plaintext Buffer using AES-256-GCM with the given DEK.
 * Returns the ciphertext and the hex-encoded IV + auth tag needed for decryption.
 */
export function encryptBuffer(
  plaintext: Buffer,
  dek: Buffer
): { ciphertext: Buffer; ivHex: string; tagHex: string } {
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher     = crypto.createCipheriv(ALGORITHM, dek, iv) as crypto.CipherGCM;
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag        = cipher.getAuthTag();

  return {
    ciphertext,
    ivHex:  iv.toString('hex'),
    tagHex: tag.toString('hex'),
  };
}

/**
 * Decrypts a ciphertext Buffer using AES-256-GCM with the given DEK.
 * Throws if the GCM authentication tag verification fails (tampered or wrong key).
 */
export function decryptBuffer(
  ciphertext: Buffer,
  dek: Buffer,
  ivHex: string,
  tagHex: string
): Buffer {
  const iv  = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
