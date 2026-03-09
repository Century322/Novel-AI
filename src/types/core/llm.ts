export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'zhipu'
  | 'moonshot'
  | 'ollama'
  | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  id: string;
  content: string;
  role: 'assistant';
  toolCalls?: LLMToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

export interface StreamChunk {
  id: string;
  delta: string;
}

export const PROVIDER_CONFIGS: Record<
  LLMProvider,
  {
    name: string;
    defaultBaseUrl: string;
    models: string[];
  }
> = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  zhipu: {
    name: '智谱 AI',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
  },
  moonshot: {
    name: 'Moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  ollama: {
    name: 'Ollama (本地)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2', 'mistral'],
  },
  custom: {
    name: '自定义',
    defaultBaseUrl: '',
    models: [],
  },
};
