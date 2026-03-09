import type {
  VectorDocument,
  SearchResult,
  SearchOptions,
  SearchFilter,
  VectorStoreConfig,
} from '@/types/retrieval/vectorStore';
import { DEFAULT_VECTOR_STORE_CONFIG } from '@/types/retrieval/vectorStore';
import { embeddingService } from './embeddingService';
import { narrativePersistenceService } from '../narrative/narrativePersistenceService';
import { logger } from '../core/loggerService';
import { v4 as uuidv4 } from 'uuid';

export class VectorStoreService {
  private config: VectorStoreConfig;
  private documents: Map<string, VectorDocument> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private isLoaded: boolean = false;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...config };
  }

  async loadFromPersistence(): Promise<void> {
    if (this.isLoaded) return;

    try {
      await narrativePersistenceService.initialize();
      const documents = await narrativePersistenceService.getAllVectorDocuments();

      for (const doc of documents) {
        this.documents.set(doc.id, doc);
        if (doc.embedding) {
          this.embeddings.set(doc.id, doc.embedding);
        } else {
          const savedEmbedding = await narrativePersistenceService.getEmbedding(doc.id);
          if (savedEmbedding) {
            this.embeddings.set(doc.id, savedEmbedding);
          }
        }
      }

      this.isLoaded = true;
      logger.debug('Vector store loaded from persistence', {
        documentCount: this.documents.size,
      });
    } catch (error) {
      logger.error('Failed to load vector store from persistence', { error: String(error) });
    }
  }

  async addDocument(
    content: string,
    metadata: VectorDocument['metadata']
  ): Promise<VectorDocument> {
    await this.loadFromPersistence();

    const id = uuidv4();
    const now = Date.now();

    const embedding = await embeddingService.embed(content);

    const document: VectorDocument = {
      id,
      content,
      metadata,
      embedding,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(id, document);
    this.embeddings.set(id, embedding);

    if (this.config.persistEnabled) {
      await narrativePersistenceService.saveVectorDocument(document);
      await narrativePersistenceService.saveEmbedding(id, embedding);
    }

    logger.debug('Document added to vector store', {
      id,
      type: metadata.type,
      contentLength: content.length,
    });

    return document;
  }

  async addDocuments(
    items: Array<{ content: string; metadata: VectorDocument['metadata'] }>
  ): Promise<VectorDocument[]> {
    const results: VectorDocument[] = [];

    for (const item of items) {
      const doc = await this.addDocument(item.content, item.metadata);
      results.push(doc);
    }

    return results;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.loadFromPersistence();

    const { topK = 5, minScore = 0.5, filter } = options;

    const queryEmbedding = await embeddingService.embed(query);

    let candidates = Array.from(this.documents.values());

    if (filter) {
      candidates = this.applyFilter(candidates, filter);
    }

    const scored: SearchResult[] = candidates
      .map((doc) => {
        const docEmbedding = this.embeddings.get(doc.id);
        if (!docEmbedding) return null;

        const score = this.calculateSimilarity(queryEmbedding, docEmbedding);
        return { document: doc, score };
      })
      .filter((result): result is SearchResult => result !== null && result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.debug('Vector search completed', {
      query: query.slice(0, 50),
      totalDocs: this.documents.size,
      results: scored.length,
    });

    return scored;
  }

  async searchByEmbedding(
    embedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0.5, filter } = options;

    let candidates = Array.from(this.documents.values());

    if (filter) {
      candidates = this.applyFilter(candidates, filter);
    }

    return candidates
      .map((doc) => {
        const docEmbedding = this.embeddings.get(doc.id);
        if (!docEmbedding) return null;

        const score = this.calculateSimilarity(embedding, docEmbedding);
        return { document: doc, score };
      })
      .filter((result): result is SearchResult => result !== null && result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getDocument(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  updateDocument(id: string, updates: Partial<VectorDocument>): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    const updated = { ...doc, ...updates, updatedAt: Date.now() };
    this.documents.set(id, updated);

    if (updates.content && updates.content !== doc.content) {
      embeddingService.embed(updates.content).then((embedding) => {
        this.embeddings.set(id, embedding);
      });
    }

    return true;
  }

  deleteDocument(id: string): boolean {
    if (!this.documents.has(id)) return false;

    this.documents.delete(id);
    this.embeddings.delete(id);
    return true;
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  clear(): void {
    this.documents.clear();
    this.embeddings.clear();
  }

  exportData(): { documents: VectorDocument[]; embeddings: Array<[string, number[]]> } {
    return {
      documents: Array.from(this.documents.values()),
      embeddings: Array.from(this.embeddings.entries()),
    };
  }

  importData(data: { documents: VectorDocument[]; embeddings: Array<[string, number[]]> }): void {
    data.documents.forEach((doc) => {
      this.documents.set(doc.id, doc);
    });
    data.embeddings.forEach(([id, embedding]) => {
      this.embeddings.set(id, embedding);
    });
  }

  private applyFilter(documents: VectorDocument[], filter: SearchFilter): VectorDocument[] {
    return documents.filter((doc) => {
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(doc.metadata.type)) return false;
      }

      if (filter.chapter && doc.metadata.chapter !== filter.chapter) {
        return false;
      }

      if (filter.character && doc.metadata.character !== filter.character) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const docTags = doc.metadata.tags || [];
        if (!filter.tags.some((tag: string) => docTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  private calculateSimilarity(a: number[], b: number[]): number {
    const metric = this.config.metric;

    switch (metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean':
        return 1 / (1 + this.euclideanDistance(a, b));
      case 'dot':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotSum = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotSum += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotSum / denominator;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }

    return Math.sqrt(sum);
  }

  private dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }
}

export const vectorStoreService = new VectorStoreService();
