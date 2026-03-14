import type { AIProvider } from './types';

export type LLMProvider = AIProvider;

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

export const PROVIDER_CONFIGS: Partial<
  Record<
    LLMProvider,
    {
      name: string;
      defaultBaseUrl: string;
      models: string[];
    }
  >
> = {
  gateway: {
    name: 'Vercel AI Gateway',
    defaultBaseUrl: 'https://gateway.ai.vercel.com/v1',
    models: [],
  },
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
  google: {
    name: 'Google (Gemini)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  alibaba: {
    name: 'Alibaba (Qwen)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-3-30b', 'qwen-3-235b', 'qwen-3-14b'],
  },
  bytedance: {
    name: 'ByteDance (Seed)',
    defaultBaseUrl: 'https://api.bytedance.com/v1',
    models: ['seed-1.6', 'seed-1.8'],
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-v3'],
  },
  minimax: {
    name: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    models: ['minimax-m2.5', 'minimax-m2.1', 'minimax-m2'],
  },
  moonshot: {
    name: 'Moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  vercel: {
    name: 'Vercel (V0)',
    defaultBaseUrl: 'https://api.vercel.ai/v1',
    models: ['v0-1.5-md', 'v0-1.0-md'],
  },
  xai: {
    name: 'xAI (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3', 'grok-3-fast'],
  },
  zai: {
    name: 'Z.AI (GLM)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5', 'glm-4.7', 'glm-4.6'],
  },
};
