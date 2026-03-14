import { create } from 'zustand';
import { persist, PersistStorage } from 'zustand/middleware';
import { encryptValue, decryptValue } from '@/utils/encryption';
import { AIProvider, PROVIDERS, ProviderConfig, ModelConfig } from '@/config/providers';
import { validateApiKey, ApiKeyValidationResult } from '@/services/core/apiKeyValidation';

export type { AIProvider } from '@/config/providers';
export type { ModelConfig } from '@/config/providers';

export interface ApiKeyConfig {
  id: string;
  provider: AIProvider;
  name: string;
  apiKey: string;
  baseUrl?: string;
  isEnabled: boolean;
  isValid?: boolean;
  isValidating?: boolean;
  models?: ModelConfig[];
  lastValidated?: number;
  error?: string;
}

export { PROVIDERS } from '@/config/providers';

export function getProviderConfig(provider: AIProvider): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === provider);
}

interface ApiKeyState {
  keys: ApiKeyConfig[];
  selectedModelId: string | null;
  selectedKeyId: string | null;
}

interface ApiKeyActions {
  addKey: (
    provider: AIProvider,
    apiKey: string,
    name?: string,
    baseUrl?: string
  ) => Promise<string>;
  updateKey: (id: string, updates: Partial<ApiKeyConfig>) => void;
  removeKey: (id: string) => void;
  toggleKey: (id: string) => void;
  validateKey: (id: string) => Promise<boolean>;
  setSelectedModel: (keyId: string, modelId: string) => void;
  getActiveKeys: () => ApiKeyConfig[];
  getAvailableModels: () => { key: ApiKeyConfig; model: ModelConfig }[];
  getCurrentConfig: () => { key: ApiKeyConfig; model: ModelConfig } | null;
  hasValidKey: () => boolean;
}

type ApiKeyStore = ApiKeyState & ApiKeyActions;

const encryptedStorage: PersistStorage<ApiKeyStore> = {
  getItem: async (name: string) => {
    const encrypted = localStorage.getItem(name);
    if (!encrypted) {
      return null;
    }

    try {
      const parsed = JSON.parse(encrypted);
      if (parsed.state?.keys) {
        const decryptedKeys = await Promise.all(
          parsed.state.keys.map(async (key: ApiKeyConfig) => ({
            ...key,
            apiKey: await decryptValue(key.apiKey),
          }))
        );
        return {
          ...parsed,
          state: {
            ...parsed.state,
            keys: decryptedKeys,
          },
        };
      }
      return parsed;
    } catch (error) {
      console.error('解密API密钥存储失败:', error);
      return null;
    }
  },
  setItem: async (name: string, value: { state: ApiKeyStore; version?: number }) => {
    try {
      if (value.state?.keys) {
        const encryptedKeys = await Promise.all(
          value.state.keys.map(async (key: ApiKeyConfig) => ({
            ...key,
            apiKey: await encryptValue(key.apiKey),
          }))
        );
        localStorage.setItem(
          name,
          JSON.stringify({
            ...value,
            state: {
              ...value.state,
              keys: encryptedKeys,
            },
          })
        );
        return;
      }
    } catch (error) {
      console.error('加密API密钥存储失败:', error);
      throw new Error('无法安全存储API密钥');
    }
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useApiKeyStore = create<ApiKeyStore>()(
  persist(
    (set, get) => ({
      keys: [],
      selectedModelId: null,
      selectedKeyId: null,

      addKey: async (provider, apiKey, name, baseUrl) => {
        const id = `key_${provider}_${Date.now()}`;
        const config = getProviderConfig(provider);
        const newKey: ApiKeyConfig = {
          id,
          provider,
          name: name || config?.name || provider,
          apiKey,
          baseUrl: baseUrl,
          isEnabled: true,
          isValid: undefined,
          models: config?.models || [],
        };
        set((state) => ({
          keys: [...state.keys, newKey],
        }));
        return id;
      },

      updateKey: (id, updates) => {
        set((state) => ({
          keys: state.keys.map((k) => (k.id === id ? { ...k, ...updates } : k)),
        }));
      },

      removeKey: (id) => {
        set((state) => ({
          keys: state.keys.filter((k) => k.id !== id),
          selectedKeyId: state.selectedKeyId === id ? null : state.selectedKeyId,
        }));
      },

      toggleKey: (id) => {
        set((state) => ({
          keys: state.keys.map((k) => (k.id === id ? { ...k, isEnabled: !k.isEnabled } : k)),
        }));
      },

      validateKey: async (id) => {
        const key = get().keys.find((k) => k.id === id);
        if (!key) {
          return false;
        }

        set((state) => ({
          keys: state.keys.map((k) =>
            k.id === id ? { ...k, isValidating: true, error: undefined } : k
          ),
        }));

        try {
          const result: ApiKeyValidationResult = await validateApiKey(key.provider, key.apiKey);

          if (result.valid) {
            set((state) => ({
              keys: state.keys.map((k) =>
                k.id === id
                  ? {
                      ...k,
                      isValid: true,
                      isValidating: false,
                      lastValidated: Date.now(),
                      error: undefined,
                      models: result.models && result.models.length > 0 
                        ? result.models.map(m => ({ id: m.id, name: m.name || m.id }))
                        : k.models,
                    }
                  : k
              ),
            }));
            return true;
          } else {
            set((state) => ({
              keys: state.keys.map((k) =>
                k.id === id
                  ? {
                      ...k,
                      isValid: false,
                      isValidating: false,
                      error: result.error || '验证失败',
                    }
                  : k
              ),
            }));
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '网络错误';
          set((state) => ({
            keys: state.keys.map((k) =>
              k.id === id
                ? {
                    ...k,
                    isValid: false,
                    isValidating: false,
                    error: errorMessage,
                  }
                : k
            ),
          }));
          return false;
        }
      },

      setSelectedModel: (keyId, modelId) => {
        set({ selectedKeyId: keyId, selectedModelId: modelId });
      },

      getActiveKeys: () => {
        return get().keys.filter((k) => k.isEnabled);
      },

      getAvailableModels: () => {
        const activeKeys = get().getActiveKeys();
        const models: { key: ApiKeyConfig; model: ModelConfig }[] = [];
        activeKeys.forEach((key) => {
          key.models?.forEach((model) => {
            models.push({ key, model });
          });
        });
        return models;
      },

      getCurrentConfig: () => {
        const { selectedKeyId, selectedModelId, keys } = get();
        if (!selectedKeyId || !selectedModelId) {
          const activeKeys = get().getActiveKeys();
          if (activeKeys.length > 0) {
            const firstKey = activeKeys[0];
            const firstModel = firstKey.models?.[0];
            if (firstModel) {
              return { key: firstKey, model: firstModel };
            }
          }
          return null;
        }

        const key = keys.find((k) => k.id === selectedKeyId);
        if (!key) {
          return null;
        }
        const model = key.models?.find((m) => m.id === selectedModelId);
        if (!model) {
          return null;
        }
        return { key, model };
      },

      hasValidKey: () => {
        return get().keys.some((k) => k.isEnabled);
      },
    }),
    {
      name: 'api-key-store',
      storage: encryptedStorage,
    }
  )
);
