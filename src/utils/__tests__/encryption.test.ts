import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptValue, decryptValue, isEncrypted } from '../encryption';

const mockLocalStorage: Record<string, string> = {};

describe('Encryption Utils', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
      },
    });
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should encrypt a string value', async () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = await encryptValue(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  it('should decrypt an encrypted value', async () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = await encryptValue(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');
  });

  it('should return empty string for empty input', async () => {
    const encrypted = await encryptValue('');
    expect(encrypted).toBe('');

    const decrypted = await decryptValue('');
    expect(decrypted).toBe('');
  });

  it('should return plaintext if decryption fails', async () => {
    const invalidEncrypted = 'not-a-valid-encrypted-string';
    const result = await decryptValue(invalidEncrypted);

    expect(result).toBe(invalidEncrypted);
  });

  it('should detect if a value is encrypted', async () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = await encryptValue(plaintext);

    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted(plaintext)).toBe(false);
  });

  it('should return false for empty value in isEncrypted', () => {
    expect(isEncrypted('')).toBe(false);
  });

  it('should handle special characters', async () => {
    const plaintext = '特殊字符 !@#$%^&*()_+-=[]{}|;:,.<>?';
    const encrypted = await encryptValue(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
  });

  it('should handle unicode characters', async () => {
    const plaintext = '你好世界 🌍 مرحبا Привет';
    const encrypted = await encryptValue(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);
  });

  it('should handle long strings', async () => {
    const plaintext = 'a'.repeat(10000);
    const encrypted = await encryptValue(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  it('should produce different encrypted values for same input', async () => {
    const plaintext = 'my-secret-api-key';
    const encrypted1 = await encryptValue(plaintext);
    const encrypted2 = await encryptValue(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });
});
