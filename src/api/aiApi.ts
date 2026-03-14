import { AIProvider } from '@/store/apiKeyStore';
import { logger } from '@/services/core/loggerService';

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length';
}

interface GenerateOptions {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  history?: Array<{ role: string; content: string; toolCalls?: ToolCall[]; toolCallId?: string }>;
  systemContext?: string;
  enableSearch?: boolean;
  onStream?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  tools?: ToolDefinition[];
}

interface EmbedOptions {
  text: string;
  apiKey: string;
  provider?: AIProvider;
}

const IS_DEV = import.meta.env.DEV;

const API_BASE_URLS: Record<AIProvider, string> = {
  gateway: 'https://api.openai.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  alibaba: 'https://dashscope.aliyuncs.com',
  bytedance: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  minimax: 'https://api.minimax.chat',
  moonshot: 'https://api.moonshot.cn',
  vercel: 'https://api.openai.com',
  xai: 'https://api.x.ai',
  zai: 'https://open.bigmodel.cn',
};

const API_PATHS: Record<AIProvider, string> = {
  gateway: '/v1/chat/completions',
  openai: '/v1/chat/completions',
  anthropic: '/v1/messages',
  google: '/v1beta/models',
  alibaba: '/compatible-mode/v1/chat/completions',
  bytedance: '/v1/chat/completions',
  deepseek: '/v1/chat/completions',
  minimax: '/v1/chat/completions',
  moonshot: '/v1/chat/completions',
  vercel: '/v1/chat/completions',
  xai: '/v1/chat/completions',
  zai: '/api/paas/v4/chat/completions',
};

const PROXY_PATHS: Record<AIProvider, string> = {
  gateway: '/api/openai',
  openai: '/api/openai',
  anthropic: '/api/anthropic',
  google: '/api/google',
  alibaba: '/api/alibaba',
  bytedance: '/api/openai',
  deepseek: '/api/deepseek',
  minimax: '/api/minimax',
  moonshot: '/api/moonshot',
  vercel: '/api/openai',
  xai: '/api/xai',
  zai: '/api/zai',
};

function getApiUrl(provider: AIProvider): string {
  if (IS_DEV) {
    return PROXY_PATHS[provider];
  }
  return API_BASE_URLS[provider];
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 120000) => {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  const id = setTimeout(() => controller.abort(), timeout);

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
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};

function getActualModel(model: string): string {
  if (model.includes('/')) {
    return model.split('/').pop() || model;
  }
  return model;
}

export async function generateContent(options: GenerateOptions): Promise<GenerateResult> {
  const {
    provider,
    apiKey,
    model,
    prompt,
    history = [],
    systemContext,
    onStream,
    abortSignal,
    tools,
  } = options;

  const actualModel = getActualModel(model);
  const baseUrl = getApiUrl(provider);
  const apiPath = API_PATHS[provider];

  if (provider === 'google') {
    const contents = [
      ...history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const url = `${baseUrl}${apiPath}/${actualModel}:generateContent?key=${apiKey}`;

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(systemContext && { systemInstruction: { parts: [{ text: systemContext }] } }),
        }),
        signal: abortSignal,
      },
      120000
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text from Gemini.' };
  }

  const messages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }> = [
    ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
        }
        if (m.toolCalls && m.toolCalls.length > 0) {
          return { role: 'assistant', content: null, tool_calls: m.toolCalls };
        }
        return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content };
      }),
    { role: 'user', content: prompt },
  ];

  const url = `${baseUrl}${apiPath}`;

  const requestBody: Record<string, unknown> = {
    model: actualModel,
    messages,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  if (onStream && !tools) {
    requestBody.stream = true;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onStream(content);
            }
          } catch (parseError) {
            logger.warn('流式响应JSON解析失败', { 
              data: data.substring(0, 100), 
              error: parseError instanceof Error ? parseError.message : String(parseError) 
            });
          }
        }
      }
    }

    return { content: fullContent || '无响应内容' };
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    },
    120000
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;
  
  const result: GenerateResult = {
    content: message?.content || '',
    finishReason,
  };

  if (message?.tool_calls && message.tool_calls.length > 0) {
    result.toolCalls = message.tool_calls;
  }

  return result;
}

export async function generateEmbedding(options: EmbedOptions): Promise<number[]> {
  const { text, apiKey, provider = 'google' } = options;
  const baseUrl = getApiUrl(provider);

  if (provider === 'google') {
    const url = `${baseUrl}/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }

    const data = await response.json();
    return data.embedding?.values || [];
  }

  if (provider === 'zai') {
    const response = await fetchWithTimeout(`${baseUrl}/api/paas/v4/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model: 'embedding-3' }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  const response = await fetchWithTimeout(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: text, model: 'text-embedding-ada-002' }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}

export async function checkApiHealth(): Promise<boolean> {
  return true;
}

export async function validateApiKey(
  provider: AIProvider,
  apiKey: string,
  _baseUrl?: string
): Promise<{ valid: boolean; models?: Array<{ id: string; name: string }>; error?: string }> {
  try {
    const baseUrl = getApiUrl(provider);
    const apiPath = API_PATHS[provider];

    if (provider === 'google') {
      const url = `${baseUrl}/v1beta/models?key=${apiKey}`;
      const response = await fetchWithTimeout(url, { method: 'GET' }, 30000);

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || [])
          .slice(0, 10)
          .map((m: { name?: string; displayName?: string }) => ({
            id: m.name?.replace('models/', '') || m.name,
            name: m.displayName || m.name,
          }));
        return { valid: true, models };
      }
      return { valid: false, error: 'Invalid API key' };
    }

    if (provider === 'zai') {
      const response = await fetchWithTimeout(
        `${baseUrl}${apiPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'glm-4-flash',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
        },
        30000
      );

      if (response.ok || response.status === 400) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid API key' };
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/v1/models`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      30000
    );

    if (response.ok) {
      const data = await response.json();
      const models = (data.data || []).slice(0, 10).map((m: { id: string }) => ({
        id: m.id,
        name: m.id,
      }));
      return { valid: true, models };
    }

    return { valid: false, error: 'Invalid API key' };
  } catch {
    return { valid: false, error: 'Network error' };
  }
}
