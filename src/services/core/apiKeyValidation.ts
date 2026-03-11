import { AIProvider } from '@/store/apiKeyStore';
import { logger } from '@/services/core/loggerService';

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  provider?: AIProvider;
  models?: Array<{ id: string; name: string }>;
  latency?: number;
}

export interface ApiKeyValidationOptions {
  testModels?: boolean;
  timeout?: number;
}

const PROVIDER_KEY_PATTERNS: Partial<Record<AIProvider, RegExp>> = {
  openai: /^sk-/,
  anthropic: /^sk-ant-/,
  google: /^AIza/,
  deepseek: /^sk-/,
  xai: /^xai-/,
  zai: /^[\w.-]+/,
  moonshot: /^sk-/,
  alibaba: /^sk-/,
  bytedance: /^sk-/,
  minimax: /^sk-/,
};

const API_ENDPOINTS: Record<AIProvider, { proxy: string; path: string }> = {
  gateway: { proxy: '/api/openai', path: '/v1/chat/completions' },
  openai: { proxy: '/api/openai', path: '/v1/chat/completions' },
  anthropic: { proxy: '/api/anthropic', path: '/v1/messages' },
  google: { proxy: '/api/google', path: '/v1beta/models' },
  alibaba: { proxy: '/api/alibaba', path: '/compatible-mode/v1/chat/completions' },
  bytedance: { proxy: '/api/openai', path: '/v1/chat/completions' },
  deepseek: { proxy: '/api/deepseek', path: '/v1/chat/completions' },
  minimax: { proxy: '/api/minimax', path: '/v1/chat/completions' },
  moonshot: { proxy: '/api/moonshot', path: '/v1/chat/completions' },
  vercel: { proxy: '/api/openai', path: '/v1/chat/completions' },
  xai: { proxy: '/api/xai', path: '/v1/chat/completions' },
  zai: { proxy: '/api/zai', path: '/api/paas/v4/chat/completions' },
};

const DEFAULT_TIMEOUT = 30000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export class ApiKeyValidator {
  validateFormat(provider: AIProvider, apiKey: string): boolean {
    const pattern = PROVIDER_KEY_PATTERNS[provider];
    if (!pattern) {
      return true;
    }
    return pattern.test(apiKey);
  }

  async testConnectivity(
    provider: AIProvider,
    apiKey: string,
    _options: ApiKeyValidationOptions = {}
  ): Promise<ApiKeyValidationResult> {
    const startTime = Date.now();
    const endpoint = API_ENDPOINTS[provider] || API_ENDPOINTS['openai'];

    try {
      if (provider === 'google') {
        return await this.testGoogleKey(apiKey, endpoint);
      }

      if (provider === 'zai') {
        return await this.testZaiKey(apiKey, endpoint);
      }

      return await this.testOpenAICompatible(provider, apiKey, endpoint);
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('API Key validation failed', {
        provider,
        error: error instanceof Error ? error.message : String(error),
        latency,
      });

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error',
        provider,
        latency,
      };
    }
  }

  private async testGoogleKey(
    apiKey: string,
    endpoint: { proxy: string; path: string }
  ): Promise<ApiKeyValidationResult> {
    const url = `${endpoint.proxy}${endpoint.path}?key=${apiKey}`;
    const response = await fetchWithTimeout(url, { method: 'GET' });

    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP ${response.status}`,
        provider: 'google',
      };
    }

    const data = await response.json();
    const models = (data.models || [])
      .slice(0, 10)
      .map((m: { name?: string; displayName?: string }) => ({
        id: m.name?.replace('models/', '') || m.name || '',
        name: m.displayName || m.name || '',
      }));

    return {
      valid: true,
      provider: 'google',
      models,
    };
  }

  private async testZaiKey(
    apiKey: string,
    endpoint: { proxy: string; path: string }
  ): Promise<ApiKeyValidationResult> {
    const response = await fetchWithTimeout(
      `${endpoint.proxy}${endpoint.path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      }
    );

    if (response.ok || response.status === 400) {
      return { valid: true, provider: 'zai' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: errorData.error?.message || `HTTP ${response.status}`,
      provider: 'zai',
    };
  }

  private async testOpenAICompatible(
    provider: AIProvider,
    apiKey: string,
    endpoint: { proxy: string; path: string }
  ): Promise<ApiKeyValidationResult> {
    const response = await fetchWithTimeout(
      `${endpoint.proxy}/v1/models`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
        provider,
      };
    }

    const data = await response.json();
    const models = (data.data || [])
      .slice(0, 10)
      .map((m: { id: string }) => ({
        id: m.id,
        name: m.id,
      }));

    return {
      valid: true,
      provider,
      models,
    };
  }

  async validate(
    provider: AIProvider,
    apiKey: string,
    options: ApiKeyValidationOptions = {}
  ): Promise<ApiKeyValidationResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        valid: false,
        error: 'API Key is required',
        provider,
      };
    }

    if (!this.validateFormat(provider, apiKey)) {
      return {
        valid: false,
        error: `Invalid API Key format for ${provider}`,
        provider,
      };
    }

    return this.testConnectivity(provider, apiKey, options);
  }

  async validateBatch(
    keys: Array<{ provider: AIProvider; apiKey: string }>
  ): Promise<Map<string, ApiKeyValidationResult>> {
    const results = new Map<string, ApiKeyValidationResult>();

    await Promise.all(
      keys.map(async ({ provider, apiKey }, index) => {
        const result = await this.validate(provider, apiKey);
        results.set(`${provider}_${index}`, result);
      })
    );

    return results;
  }
}

export const apiKeyValidator = new ApiKeyValidator();

export async function validateApiKey(
  provider: AIProvider,
  apiKey: string,
  options?: ApiKeyValidationOptions
): Promise<ApiKeyValidationResult> {
  return apiKeyValidator.validate(provider, apiKey, options);
}
