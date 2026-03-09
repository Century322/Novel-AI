import { generateEmbedding } from '@/api/aiApi';
import { useApiKeyStore } from '@/store/apiKeyStore';
import {
  EmbeddingConfig,
  DEFAULT_EMBEDDING_CONFIG,
} from '@/types/retrieval/vectorStore';
import { logger } from '../core/loggerService';

export class EmbeddingService {
  private config: EmbeddingConfig;
  private cache: Map<string, number[]> = new Map();
  private pendingRequests: Map<string, Promise<number[]>> = new Map();

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  }

  async embed(text: string): Promise<number[]> {
    const normalizedText = this.normalizeText(text);
    const cacheKey = this.getCacheKey(normalizedText);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const promise = this.doEmbed(normalizedText);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const embedding = await promise;
      this.cache.set(cacheKey, embedding);
      return embedding;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((text) => this.embed(text)));
      results.push(...batchResults);
    }

    return results;
  }

  private async doEmbed(text: string): Promise<number[]> {
    const apiKeyStore = useApiKeyStore.getState();
    const activeKeys = apiKeyStore.getActiveKeys();
    
    const googleKey = activeKeys.find((k) => k.provider === 'google');
    const openaiKey = activeKeys.find((k) => k.provider === 'openai');
    
    const activeKey = googleKey || openaiKey;
    
    if (!activeKey) {
      throw new Error('No API key configured for embedding');
    }

    const provider = activeKey.provider;

    try {
      const embedding = await generateEmbedding({
        text,
        apiKey: activeKey.apiKey,
        provider,
      });

      logger.debug('Embedding generated', {
        textLength: text.length,
        dimensions: embedding.length,
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error: String(error) });
      throw error;
    }
  }

  private normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').slice(0, 8000);
  }

  private getCacheKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${this.config.model}_${hash}`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const embeddingService = new EmbeddingService();
