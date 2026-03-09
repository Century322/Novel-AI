import { logger } from '@/services/core/loggerService';

const ENCRYPTION_KEY_NAME = 'app_encryption_key';

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);

  if (storedKey) {
    const keyData = Uint8Array.from(atob(storedKey), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  localStorage.setItem(ENCRYPTION_KEY_NAME, keyBase64);

  return key;
}

export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) {
    return '';
  }

  try {
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch {
    logger.warn('加密失败，将以明文存储');
    return plaintext;
  }
}

export async function decryptValue(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    return '';
  }

  if (!ciphertext.includes('=') && !ciphertext.includes('+') && !ciphertext.includes('/')) {
    return ciphertext;
  }

  try {
    const key = await getOrCreateEncryptionKey();
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    return ciphertext;
  }
}

export function isEncrypted(value: string): boolean {
  if (!value) {
    return false;
  }
  try {
    const combined = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return combined.length > 12;
  } catch {
    return false;
  }
}
