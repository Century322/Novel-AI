import {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  StreamChunk,
  LLMToolCall,
  LLMProvider,
  PROVIDER_CONFIGS,
} from '@/types/core/llm';
import { logger } from '../core/loggerService';

export type { LLMMessage, LLMToolCall } from '@/types/core/llm';

export interface LLMServiceConfig {
  defaultProvider: LLMProvider;
  defaultModel: string;
  maxRetries: number;
  timeout: number;
  streamEnabled: boolean;
}

export interface ChatCompletionOptions {
  messages: LLMMessage[];
  provider?: LLMProvider;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none';
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  stream?: boolean;
  model?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
          default?: unknown;
        }
      >;
      required: string[];
    };
  };
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class LLMService {
  private config: LLMServiceConfig;
  private providers: Map<LLMProvider, LLMConfig> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: Partial<LLMServiceConfig> = {}) {
    this.config = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
      maxRetries: 3,
      timeout: 60000,
      streamEnabled: true,
      ...config,
    };
  }

  registerProvider(provider: LLMProvider, config: LLMConfig): void {
    this.providers.set(provider, {
      provider,
      model: config.model || PROVIDER_CONFIGS[provider]?.models[0] || 'default',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || PROVIDER_CONFIGS[provider]?.defaultBaseUrl,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      topP: config.topP ?? 1,
    });
  }

  setApiKey(provider: LLMProvider, apiKey: string): void {
    const existingConfig = this.providers.get(provider);
    if (existingConfig) {
      this.providers.set(provider, { ...existingConfig, apiKey });
    }
  }

  setDefaultProvider(provider: LLMProvider): void {
    this.config.defaultProvider = provider;
  }

  private getProviderConfig(provider: LLMProvider): LLMConfig {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }
    return config;
  }

  async chat(options: ChatCompletionOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const provider = options.provider || this.config.defaultProvider;
    const providerConfig = this.getProviderConfig(provider);
    const model = options.model || providerConfig.model;

    logger.ai('开始调用 LLM', { model, provider });

    const messages = this.buildMessages(options.messages);

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? providerConfig.temperature,
      max_tokens: options.maxTokens ?? providerConfig.maxTokens,
      stream: false,
    };

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools.map((t) => ({
        type: t.type,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      }));
      logger.info('[LLMService] 传入工具定义', { 
        toolCount: options.tools.length, 
        toolNames: options.tools.map(t => t.function.name) 
      });
    }

    if (options.stopSequences) {
      requestBody.stop = options.stopSequences;
    }

    try {
      const response = await this.makeRequest(provider, requestBody);
      const duration = Date.now() - startTime;

      logger.ai('LLM 调用完成', {
        model,
        tokens: response.usage.totalTokens,
        duration: `${duration}ms`,
      });

      logger.generation(
        'generate',
        `生成内容 (${response.content.length} 字符)`,
        response.content.substring(0, 500),
        {
          input: response.usage.promptTokens,
          output: response.usage.completionTokens,
          total: response.usage.totalTokens,
        },
        duration,
        model,
        true
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.aiError('LLM 调用失败', { model, error: String(error), duration: `${duration}ms` });
      throw error;
    }
  }

  private buildMessages(messages: LLMMessage[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      const built: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        built.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        }));
      }

      if (msg.role === 'tool' && msg.toolCallId) {
        built.tool_call_id = msg.toolCallId;
      }

      return built;
    });
  }

  private async makeRequest(
    provider: LLMProvider,
    body: Record<string, unknown>
  ): Promise<LLMResponse> {
    const config = this.getProviderConfig(provider);
    const requestId = generateId();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(provider, config, body, requestId);
        return response;
      } catch (error) {
        if (attempt === this.config.maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async executeRequest(
    provider: LLMProvider,
    config: LLMConfig,
    body: Record<string, unknown>,
    requestId: string
  ): Promise<LLMResponse> {
    const providerConfig = PROVIDER_CONFIGS[provider];
    const baseUrl = config.baseUrl || providerConfig?.defaultBaseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(provider, config),
    };

    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API request failed: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      return this.parseResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  private getAuthHeaders(provider: LLMProvider, config: LLMConfig): Record<string, string> {
    switch (provider) {
      case 'openai':
        return { Authorization: `Bearer ${config.apiKey}` };
      case 'anthropic':
        return {
          'x-api-key': config.apiKey!,
          'anthropic-version': '2023-06-01',
        };
      case 'deepseek':
      case 'zai':
      case 'moonshot':
      case 'google':
      case 'alibaba':
      case 'bytedance':
      case 'minimax':
      case 'vercel':
      case 'xai':
      case 'gateway':
        return { Authorization: `Bearer ${config.apiKey}` };
      default:
        return { Authorization: `Bearer ${config.apiKey}` };
    }
  }

  private parseResponse(data: Record<string, unknown>): LLMResponse {
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;
    const usage = data.usage as Record<string, unknown> | undefined;

    const toolCalls = this.parseToolCalls(message?.tool_calls);
    
    logger.info('[LLMService] 解析响应', {
      hasContent: !!message?.content,
      contentLength: String(message?.content || '').length,
      hasToolCalls: !!toolCalls,
      toolCallCount: toolCalls?.length || 0,
      finishReason: choice?.finish_reason,
    });

    return {
      id: String(data.id || generateId()),
      content: String(message?.content || ''),
      role: 'assistant',
      toolCalls,
      usage: {
        promptTokens: Number(usage?.prompt_tokens || 0),
        completionTokens: Number(usage?.completion_tokens || 0),
        totalTokens: Number(usage?.total_tokens || 0),
      },
      finishReason: (choice?.finish_reason as LLMResponse['finishReason']) || null,
    };
  }

  private parseToolCalls(toolCalls: unknown): LLMToolCall[] | undefined {
    if (!toolCalls || !Array.isArray(toolCalls)) {
      return undefined;
    }

    return toolCalls.map((tc: Record<string, unknown>) => ({
      id: String(tc.id || generateId()),
      type: 'function' as const,
      function: {
        name: String((tc.function as Record<string, unknown>)?.name || ''),
        arguments: String((tc.function as Record<string, unknown>)?.arguments || '{}'),
      },
    }));
  }

  async *chatStream(options: ChatCompletionOptions): AsyncGenerator<StreamChunk> {
    const provider = options.provider || this.config.defaultProvider;
    const providerConfig = this.getProviderConfig(provider);

    const messages = this.buildMessages(options.messages);

    const requestBody: Record<string, unknown> = {
      model: options.model || providerConfig.model,
      messages,
      temperature: options.temperature ?? providerConfig.temperature,
      max_tokens: options.maxTokens ?? providerConfig.maxTokens,
      stream: true,
    };

    const requestId = generateId();
    const providerConfig_ = PROVIDER_CONFIGS[provider];
    const baseUrl = providerConfig.baseUrl || providerConfig_?.defaultBaseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(provider, providerConfig),
    };

    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data:')) {
            continue;
          }

          const dataStr = line.replace('data:', '').trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;
            const choices = data.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;

            if (delta?.content) {
              yield {
                id: String(data.id || generateId()),
                delta: String(delta.content),
              };
            }
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    this.abortControllers.delete(requestId);
  }

  abort(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  countTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - chineseChars - englishWords;

    return Math.ceil(chineseChars * 0.5 + englishWords * 1.3 + otherChars * 0.3);
  }
}

export const llmService = new LLMService({
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
  maxRetries: 3,
  timeout: 60000,
  streamEnabled: true,
});
