import { AIProvider, ProviderConfig, ModelConfig } from '@/types';

export type { AIProvider, ProviderConfig, ModelConfig };

const OPENAI_MODELS: ModelConfig[] = [
  { id: 'o4-mini', name: 'O4 Mini', supportsTools: true, supportsStreaming: true },
  { id: 'o3-mini', name: 'O3 Mini', supportsTools: true, supportsStreaming: true },
  {
    id: 'o3-deep-research',
    name: 'O3 Deep Research',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'o3-pro', name: 'O3 Pro', supportsTools: true, supportsStreaming: true },
  { id: 'o3', name: 'O3', supportsTools: true, supportsStreaming: true },
  { id: 'o1', name: 'O1', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-oss-safeguard-20b',
    name: 'GPT-OSS Safeguard 20B',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'gpt-oss-20b', name: 'GPT-OSS 20B', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-5.1-instant', name: 'GPT-5.1 Instant', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-3.5-turbo-instruct',
    name: 'GPT-3.5 Turbo Instruct',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    supportsTools: true,
    supportsStreaming: true,
    isFree: true,
  },
  { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', supportsTools: true, supportsStreaming: true },
  { id: 'gpt-5.2-chat', name: 'GPT-5.2 Chat', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-5.1-thinking',
    name: 'GPT-5.1 Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'gpt-5-chat', name: 'GPT-5 Chat', supportsTools: true, supportsStreaming: true },
  {
    id: 'gpt-4o-mini-search-preview',
    name: 'GPT-4o Mini Search',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'codex-mini', name: 'Codex Mini', supportsTools: true, supportsStreaming: true },
];

const ANTHROPIC_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-opus-4-1',
    name: 'Claude Opus 4.1',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet (20240620)',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
];

const GOOGLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro Image',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Gemini 3.1 Flash Image',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash Preview',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-flash-lite-preview-09-2025',
    name: 'Gemini 2.5 Flash Lite Preview',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isFree: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    isFree: true,
  },
];

const ALIBABA_MODELS: ModelConfig[] = [
  { id: 'qwen-3-30b', name: 'Qwen 3 30B', supportsTools: true, supportsStreaming: true },
  { id: 'qwen-3-235b', name: 'Qwen 3 235B', supportsTools: true, supportsStreaming: true },
  { id: 'qwen-3-14b', name: 'Qwen 3 14B', supportsTools: true, supportsStreaming: true },
  {
    id: 'qwen3-vl-thinking',
    name: 'Qwen3 VL Thinking',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-vl-instruct',
    name: 'Qwen3 VL Instruct',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-next-80b-a3b-thinking',
    name: 'Qwen3 Next 80B Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-next-80b-a3b-instruct',
    name: 'Qwen3 Next 80B Instruct',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-max-preview',
    name: 'Qwen3 Max Preview',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'qwen3-max', name: 'Qwen3 Max', supportsTools: true, supportsStreaming: true },
  {
    id: 'qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-coder-next',
    name: 'Qwen3 Coder Next',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'qwen3-coder', name: 'Qwen3 Coder', supportsTools: true, supportsStreaming: true },
  {
    id: 'qwen3-235b-a22b-thinking',
    name: 'Qwen3 235B Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', supportsTools: true, supportsStreaming: true },
  { id: 'qwen3.5-flash', name: 'Qwen3.5 Flash', supportsTools: true, supportsStreaming: true },
  {
    id: 'qwen3-max-thinking',
    name: 'Qwen3 Max Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'qwen3-coder-30b-a3b',
    name: 'Qwen3 Coder 30B',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'qwen-3-32b', name: 'Qwen 3 32B', supportsTools: true, supportsStreaming: true },
];

const BYTEDANCE_MODELS: ModelConfig[] = [
  { id: 'seed-1.6', name: 'Seed 1.6', supportsTools: true, supportsStreaming: true },
  { id: 'seed-1.8', name: 'Seed 1.8', supportsTools: true, supportsStreaming: true },
];

const DEEPSEEK_MODELS: ModelConfig[] = [
  { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', supportsTools: true, supportsStreaming: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', supportsTools: true, supportsStreaming: true },
  {
    id: 'deepseek-v3.2-thinking',
    name: 'DeepSeek V3.2 Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', supportsTools: true, supportsStreaming: true },
  {
    id: 'deepseek-v3.1-terminus',
    name: 'DeepSeek V3.1 Terminus',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'deepseek-v3', name: 'DeepSeek V3', supportsTools: true, supportsStreaming: true },
];

const MINIMAX_MODELS: ModelConfig[] = [
  { id: 'minimax-m2.5', name: 'MiniMax M2.5', supportsTools: true, supportsStreaming: true },
  {
    id: 'minimax-m2.1-lightning',
    name: 'MiniMax M2.1 Lightning',
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'minimax-m2.1', name: 'MiniMax M2.1', supportsTools: true, supportsStreaming: true },
  { id: 'minimax-m2', name: 'MiniMax M2', supportsTools: true, supportsStreaming: true },
];

const MOONSHOT_MODELS: ModelConfig[] = [
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'kimi-k2-turbo',
    name: 'Kimi K2 Turbo',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'kimi-k2-thinking-turbo',
    name: 'Kimi K2 Thinking Turbo',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'kimi-k2-0905',
    name: 'Kimi K2 0905',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
];

const VERCEL_MODELS: ModelConfig[] = [
  { id: 'v0-1.5-md', name: 'V0 1.5 MD', supportsStreaming: true },
  { id: 'v0-1.0-md', name: 'V0 1.0 MD', supportsStreaming: true },
];

const XAI_MODELS: ModelConfig[] = [
  {
    id: 'grok-code-fast-1',
    name: 'Grok Code Fast 1',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-4.1-fast-reasoning',
    name: 'Grok 4.1 Fast Reasoning',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-4.1-fast-non-reasoning',
    name: 'Grok 4.1 Fast Non-Reasoning',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-4-fast-reasoning',
    name: 'Grok 4 Fast Reasoning',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-4-fast-non-reasoning',
    name: 'Grok 4 Fast Non-Reasoning',
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-4',
    name: 'Grok 4',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-3-mini-fast',
    name: 'Grok 3 Mini Fast',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-3-fast',
    name: 'Grok 3 Fast',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'grok-2-vision',
    name: 'Grok 2 Vision',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
];

const ZAI_MODELS: ModelConfig[] = [
  { id: 'glm-5', name: 'GLM 5', supportsTools: true, supportsStreaming: true },
  {
    id: 'glm-4.6v-flash',
    name: 'GLM 4.6V Flash',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'glm-4.6v',
    name: 'GLM 4.6V',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'glm-4.5', name: 'GLM 4.5', supportsTools: true, supportsStreaming: true },
  { id: 'glm-4.7-flashx', name: 'GLM 4.7 FlashX', supportsTools: true, supportsStreaming: true },
  { id: 'glm-4.7', name: 'GLM 4.7', supportsTools: true, supportsStreaming: true },
  { id: 'glm-4.6', name: 'GLM 4.6', supportsTools: true, supportsStreaming: true },
  {
    id: 'glm-4.5v',
    name: 'GLM 4.5V',
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
  },
  { id: 'glm-4.5-air', name: 'GLM 4.5 Air', supportsTools: true, supportsStreaming: true },
];

function addPrefix(models: ModelConfig[], prefix: string): ModelConfig[] {
  return models.map((m) => ({ ...m, id: `${prefix}/${m.id}` }));
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gateway',
    name: 'Vercel AI Gateway',
    requiresApiKey: true,
    models: [
      ...addPrefix(OPENAI_MODELS, 'openai'),
      ...addPrefix(ANTHROPIC_MODELS, 'anthropic'),
      ...addPrefix(GOOGLE_MODELS, 'google'),
      ...addPrefix(ALIBABA_MODELS, 'alibaba'),
      ...addPrefix(BYTEDANCE_MODELS, 'bytedance'),
      ...addPrefix(DEEPSEEK_MODELS, 'deepseek'),
      ...addPrefix(MINIMAX_MODELS, 'minimax'),
      ...addPrefix(MOONSHOT_MODELS, 'moonshot'),
      ...addPrefix(VERCEL_MODELS, 'vercel'),
      ...addPrefix(XAI_MODELS, 'xai'),
      ...addPrefix(ZAI_MODELS, 'zai'),
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    npmPackage: '@ai-sdk/openai',
    requiresApiKey: true,
    models: OPENAI_MODELS,
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    npmPackage: '@ai-sdk/anthropic',
    requiresApiKey: true,
    models: ANTHROPIC_MODELS,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    npmPackage: '@ai-sdk/google',
    requiresApiKey: true,
    models: GOOGLE_MODELS,
  },
  {
    id: 'alibaba',
    name: 'Alibaba (Qwen)',
    requiresApiKey: true,
    gatewayOnly: true,
    models: ALIBABA_MODELS,
  },
  {
    id: 'bytedance',
    name: 'ByteDance (Seed)',
    requiresApiKey: true,
    gatewayOnly: true,
    models: BYTEDANCE_MODELS,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    npmPackage: '@ai-sdk/deepseek',
    requiresApiKey: true,
    models: DEEPSEEK_MODELS,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    requiresApiKey: true,
    gatewayOnly: true,
    models: MINIMAX_MODELS,
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    requiresApiKey: true,
    gatewayOnly: true,
    models: MOONSHOT_MODELS,
  },
  {
    id: 'vercel',
    name: 'Vercel (V0)',
    requiresApiKey: true,
    gatewayOnly: true,
    models: VERCEL_MODELS,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    npmPackage: '@ai-sdk/xai',
    requiresApiKey: true,
    models: XAI_MODELS,
  },
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    requiresApiKey: true,
    gatewayOnly: true,
    models: ZAI_MODELS,
  },
];

export function getProviderById(id: AIProvider): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS;
}

export function getAllModels(): { provider: AIProvider; model: ModelConfig }[] {
  const result: { provider: AIProvider; model: ModelConfig }[] = [];
  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      result.push({ provider: provider.id, model });
    }
  }
  return result;
}

export function getModelsByProvider(providerId: AIProvider): ModelConfig[] {
  const provider = getProviderById(providerId);
  return provider?.models ?? [];
}
