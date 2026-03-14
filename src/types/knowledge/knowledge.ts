export interface KnowledgeFile {
  id: string;
  filename: string;
  path: string;
  type: KnowledgeFileType;
  size: number;
  chunkCount: number;
  totalTokens: number;
  indexedAt: number;
  metadata: KnowledgeMetadata;
}

export type KnowledgeFileType =
  | 'novel'
  | 'reference'
  | 'style_guide'
  | 'research'
  | 'character_card'
  | 'worldbuilding'
  | 'outline'
  | 'chapter'
  | 'custom';

export interface KnowledgeMetadata {
  author?: string;
  genre?: string;
  tags: string[];
  source?: string;
  language?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface KnowledgeChunk {
  id: string;
  fileId: string;
  content: string;
  tokens: number;
  position: number;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  chapter?: string;
  characters?: string[];
  location?: string;
  time?: string;
  keywords: string[];
}

export interface SearchResult {
  chunk: KnowledgeChunk;
  score: number;
  highlights: string[];
}

export interface SearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  fileTypes?: KnowledgeFileType[];
  tags?: string[];
  characters?: string[];
  useSemantic?: boolean;
}

export interface IndexingOptions {
  chunkSize: number;
  chunkOverlap: number;
  generateEmbeddings: boolean;
  extractEntities: boolean;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  expiresAt?: number;
}

export type MemoryType =
  | 'character'
  | 'timeline'
  | 'foreshadowing'
  | 'worldbuilding'
  | 'style_rule'
  | 'lesson_learned'
  | 'user_preference'
  | 'project_summary'
  | 'session_context'
  | 'custom';

export interface CharacterMemory {
  id: string;
  name: string;
  aliases: string[];
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  traits: string[];
  relationships: CharacterRelationshipMemory[];
  firstAppear: string;
  lastMention: string;
  arc: CharacterArcMemory[];
}

export interface CharacterRelationshipMemory {
  targetId: string;
  targetName: string;
  type: string;
  description?: string;
}

export interface CharacterArcMemory {
  chapter: string;
  event: string;
  development: string;
}

export interface TimelineMemory {
  id: string;
  chapter: string;
  time: string;
  event: string;
  characters: string[];
  location?: string;
  importance: 'major' | 'minor';
  relatedEvents: string[];
}

export interface ForeshadowingMemory {
  id: string;
  content: string;
  plantedAt: string;
  resolvedAt?: string;
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned';
  relatedCharacters: string[];
  importance: number;
}

export interface WorldbuildingMemory {
  id: string;
  category:
    | 'location'
    | 'faction'
    | 'magic_system'
    | 'technology'
    | 'culture'
    | 'history'
    | 'other';
  name: string;
  description: string;
  rules: string[];
  connections: string[];
}

export const DEFAULT_INDEXING_OPTIONS: IndexingOptions = {
  chunkSize: 500,
  chunkOverlap: 50,
  generateEmbeddings: false,
  extractEntities: true,
};

export const MEMORY_TYPE_CONFIG: Record<
  MemoryType,
  {
    label: string;
    icon: string;
    ttl?: number;
  }
> = {
  character: { label: '人物', icon: 'user', ttl: undefined },
  timeline: { label: '时间线', icon: 'clock', ttl: undefined },
  foreshadowing: { label: '伏笔', icon: 'alert-circle', ttl: undefined },
  worldbuilding: { label: '世界观', icon: 'globe', ttl: undefined },
  style_rule: { label: '风格规则', icon: 'palette', ttl: undefined },
  lesson_learned: { label: '经验教训', icon: 'book', ttl: undefined },
  user_preference: { label: '用户偏好', icon: 'settings', ttl: undefined },
  project_summary: { label: '项目总结', icon: 'file-text', ttl: undefined },
  session_context: { label: '会话上下文', icon: 'message-circle', ttl: 3600000 },
  custom: { label: '自定义', icon: 'custom', ttl: undefined },
};
