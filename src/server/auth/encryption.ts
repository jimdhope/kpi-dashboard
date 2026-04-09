import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (64 hex characters)
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return key;
}

// Alias for backwards compatibility
export const ENCRYPTION_KEY = getEncryptionKey();
export const ENCRYPTION_ALGORITHM = ALGORITHM;

/**
 * Encrypt a string value
 * Returns: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(value: string): string {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string value
 * Expects: base64(iv):base64(authTag):base64(ciphertext)
 */
export function decrypt(encryptedValue: string): string {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const [ivBase64, authTagBase64, ciphertextBase64] = encryptedValue.split(':');
  
  if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error('Invalid encrypted value format');
  }
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash a value (one-way)
 * Uses SHA-256
 */
export function hash(value: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex').slice(0, length);
}
