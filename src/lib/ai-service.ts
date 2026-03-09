import { streamText, generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { AIProvider } from '@/config/providers';

export type { AIProvider } from '@/config/providers';
export {
  PROVIDERS,
  getProviderById,
  getAllProviders,
  getModelsByProvider,
} from '@/config/providers';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
}

export interface StreamOptions extends AIConfig {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onChunk?: (chunk: string) => void;
  onError?: (error: Error) => void;
  onFinish?: (fullText: string) => void;
}

export interface GenerateOptions extends AIConfig {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

function getProviderModel(config: AIConfig) {
  const { provider, model, apiKey, baseUrl } = config;

  if (provider === 'gateway') {
    return gateway(model);
  }

  if (!apiKey) {
    throw new Error(`API key is required for provider: ${provider}`);
  }

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL: baseUrl })(model);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL: baseUrl })(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model);
    case 'xai':
      return createXai({ apiKey, baseURL: baseUrl })(model);
    case 'deepseek':
      return createDeepSeek({ apiKey, baseURL: baseUrl })(model);
    default:
      return gateway(`${provider}/${model}`);
  }
}

export async function* streamGenerate(options: StreamOptions): AsyncGenerator<string> {
  const { prompt, history = [], systemPrompt, onChunk, onError, onFinish } = options;

  const model = getProviderModel(options);

  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user' as const, content: prompt },
  ];

  try {
    const result = streamText({
      model,
      messages,
      system: systemPrompt,
    });

    let fullText = '';

    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk?.(chunk);
      yield chunk;
    }

    onFinish?.(fullText);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

export async function generate(options: GenerateOptions): Promise<string> {
  const { prompt, history = [], systemPrompt } = options;

  const model = getProviderModel(options);

  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user' as const, content: prompt },
  ];

  const result = await generateText({
    model,
    messages,
    system: systemPrompt,
  });

  return result.text;
}

export async function generateWithUsage(options: GenerateOptions): Promise<{
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const { prompt, history = [], systemPrompt } = options;

  const model = getProviderModel(options);

  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user' as const, content: prompt },
  ];

  const result = await generateText({
    model,
    messages,
    system: systemPrompt,
  });

  const usage = result.usage;

  return {
    text: result.text,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
      totalTokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
    },
  };
}
