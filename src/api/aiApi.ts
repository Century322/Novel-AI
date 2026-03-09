import { AIProvider } from '@/store/apiKeyStore';

interface GenerateOptions {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  history?: Array<{ role: string; content: string }>;
  systemContext?: string;
  enableSearch?: boolean;
  onStream?: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

interface EmbedOptions {
  text: string;
  apiKey: string;
  provider?: AIProvider;
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

function getActualModel(model: string): string {
  if (model.includes('/')) {
    return model.split('/').pop() || model;
  }
  return model;
}

export async function generateContent(options: GenerateOptions): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    prompt,
    history = [],
    systemContext,
    onStream,
    abortSignal,
  } = options;

  const actualModel = getActualModel(model);
  const endpoint = API_ENDPOINTS[provider] || API_ENDPOINTS['openai'];

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

    const url = `${endpoint.proxy}${endpoint.path}/${actualModel}:generateContent?key=${apiKey}`;

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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text from Gemini.';
  }

  const messages = [
    ...(systemContext ? [{ role: 'system', content: systemContext }] : []),
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    { role: 'user', content: prompt },
  ];

  if (onStream) {
    const response = await fetch(`${endpoint.proxy}${endpoint.path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: actualModel,
        messages,
        stream: true,
      }),
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
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    return fullContent || '閺冪姵纭堕悽鐔稿灇閸ョ偛顦查妴';
  }

  const response = await fetchWithTimeout(
    `${endpoint.proxy}${endpoint.path}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: actualModel,
        messages,
        stream: false,
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
  return data.choices?.[0]?.message?.content || '閺冪姵纭堕悽鐔稿灇閸ョ偛顦查妴';
}

export async function generateEmbedding(options: EmbedOptions): Promise<number[]> {
  const { text, apiKey, provider = 'google' } = options;
  const endpoint = API_ENDPOINTS[provider] || API_ENDPOINTS['openai'];

  if (provider === 'google') {
    const url = `${endpoint.proxy}/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
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
    const response = await fetchWithTimeout(`${endpoint.proxy}/v4/embeddings`, {
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

  const response = await fetchWithTimeout(`${endpoint.proxy}/v1/embeddings`, {
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
    const endpoint = API_ENDPOINTS[provider] || API_ENDPOINTS['openai'];

    if (provider === 'google') {
      const url = `${endpoint.proxy}/v1beta/models?key=${apiKey}`;
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
        `${endpoint.proxy}${endpoint.path}`,
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
      `${endpoint.proxy}/v1/models`,
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
