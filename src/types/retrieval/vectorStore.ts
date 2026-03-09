export interface VectorDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
}

export interface DocumentMetadata {
  type: DocumentType;
  source: string;
  chapter?: string;
  character?: string;
  location?: string;
  timestamp?: number;
  tags?: string[];
}

export type DocumentType =
  | 'chapter'
  | 'character'
  | 'plot'
  | 'worldbuilding'
  | 'foreshadowing'
  | 'dialogue'
  | 'description'
  | 'setting'
  | 'note';

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filter?: SearchFilter;
}

export interface SearchFilter {
  type?: DocumentType | DocumentType[];
  chapter?: string;
  character?: string;
  tags?: string[];
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  batchSize: number;
}

export type EmbeddingProvider = 'openai' | 'local' | 'custom';

export interface VectorStoreConfig {
  persistEnabled: boolean;
  persistPath?: string;
  indexType: IndexType;
  metric: DistanceMetric;
}

export type IndexType = 'flat' | 'hnsw';
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot';

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 100,
};

export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  persistEnabled: true,
  indexType: 'flat',
  metric: 'cosine',
};
