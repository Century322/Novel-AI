import { PersistStorage } from 'zustand/middleware';
import { encryptValue, decryptValue } from '@/utils/encryption';
import { logger } from '@/services/core/loggerService';

interface EncryptedStorageOptions {
  encryptFields?: string[];
  excludeFields?: string[];
}

export function createEncryptedStorage<T>(
  options: EncryptedStorageOptions = {}
): PersistStorage<T> {
  const { encryptFields, excludeFields = [] } = options;

  async function encryptObject(obj: unknown): Promise<unknown> {
    if (typeof obj === 'string') {
      return await encryptValue(obj);
    }

    if (Array.isArray(obj)) {
      return await Promise.all(obj.map((item) => encryptObject(item)));
    }

    if (obj !== null && typeof obj === 'object') {
      const encrypted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (excludeFields.includes(key)) {
          encrypted[key] = value;
        } else if (encryptFields) {
          encrypted[key] = encryptFields.includes(key) ? await encryptObject(value) : value;
        } else {
          encrypted[key] = await encryptObject(value);
        }
      }
      return encrypted;
    }

    return obj;
  }

  async function decryptObject(obj: unknown): Promise<unknown> {
    if (typeof obj === 'string') {
      return await decryptValue(obj);
    }

    if (Array.isArray(obj)) {
      return await Promise.all(obj.map((item) => decryptObject(item)));
    }

    if (obj !== null && typeof obj === 'object') {
      const decrypted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (excludeFields.includes(key)) {
          decrypted[key] = value;
        } else if (encryptFields) {
          decrypted[key] = encryptFields.includes(key) ? await decryptObject(value) : value;
        } else {
          decrypted[key] = await decryptObject(value);
        }
      }
      return decrypted;
    }

    return obj;
  }

  return {
    getItem: async (name: string) => {
      const stored = localStorage.getItem(name);
      if (!stored) return null;

      try {
        const parsed = JSON.parse(stored);
        if (parsed.state) {
          const decryptedState = await decryptObject(parsed.state);
          return { ...parsed, state: decryptedState };
        }
        return parsed;
      } catch (error) {
        logger.error('解密存储数据失败', { error, storeName: name });
        return null;
      }
    },

    setItem: async (name: string, value: { state: T; version?: number }) => {
      try {
        const encryptedState = await encryptObject(value.state);
        localStorage.setItem(
          name,
          JSON.stringify({
            ...value,
            state: encryptedState,
          })
        );
      } catch (error) {
        logger.error('加密存储数据失败', { error, storeName: name });
        localStorage.setItem(name, JSON.stringify(value));
      }
    },

    removeItem: (name: string) => {
      localStorage.removeItem(name);
    },
  };
}
