import { workshopService } from '../core/workshopService';
import { KnowledgeService } from '../knowledge/knowledgeService';
import {
  SearchResult,
  SearchOptions,
  MemoryEntry,
  MemoryType,
  CharacterMemory,
  TimelineMemory,
  ForeshadowingMemory,
  WorldbuildingMemory,
  CharacterRelationship,
} from '@/types/knowledge/knowledge';

export type { CharacterMemory, TimelineMemory, ForeshadowingMemory, WorldbuildingMemory };
import { logger } from '../core/loggerService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const MEMORY_VERSION = 1;

interface MemoryData {
  version?: number;
  memories: MemoryEntry[];
  lastUpdated: number;
}

function validateMemoryEntry(memory: unknown): memory is MemoryEntry {
  if (!memory || typeof memory !== 'object') return false;
  const m = memory as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.type === 'string' &&
    typeof m.content === 'string' &&
    typeof m.importance === 'number' &&
    typeof m.createdAt === 'number'
  );
}

function migrateMemoryData(data: unknown, version: number): MemoryData {
  const migrated: MemoryData = {
    version: MEMORY_VERSION,
    memories: [],
    lastUpdated: Date.now(),
  };

  if (!data || typeof data !== 'object') {
    return migrated;
  }

  const d = data as Record<string, unknown>;

  if (Array.isArray(d.memories)) {
    for (const memory of d.memories) {
      if (validateMemoryEntry(memory)) {
        migrated.memories.push({
          ...memory,
          updatedAt: memory.updatedAt || memory.createdAt,
          accessCount: memory.accessCount || 0,
          lastAccessedAt: memory.lastAccessedAt || memory.createdAt,
        });
      }
    }
  }

  if (typeof d.lastUpdated === 'number') {
    migrated.lastUpdated = d.lastUpdated;
  }

  logger.info(
    `记忆数据迁移完成: 版本 ${version} -> ${MEMORY_VERSION}, 有效记忆 ${migrated.memories.length} 条`
  );
  return migrated;
}

export class MemoryService {
  private projectPath: string;
  private memories: Map<string, MemoryEntry> = new Map();
  private memoriesByType: Map<MemoryType, Set<string>> = new Map();
  private initialized: boolean = false;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadMemories();
    this.initialized = true;
    logger.info(`记忆服务初始化完成，共加载 ${this.memories.size} 条记忆`);
  }

  private async loadMemories(): Promise<void> {
    const memoryPath = `${this.projectPath}/.ai-workshop/memory/memory.json`;
    const exists = await workshopService.pathExists(memoryPath);

    if (exists) {
      try {
        const content = await workshopService.readFile(memoryPath);
        const rawData = JSON.parse(content);
        const version = typeof rawData.version === 'number' ? rawData.version : 0;

        const data =
          version < MEMORY_VERSION ? migrateMemoryData(rawData, version) : (rawData as MemoryData);

        for (const memory of data.memories || []) {
          if (validateMemoryEntry(memory)) {
            this.memories.set(memory.id, memory);

            if (!this.memoriesByType.has(memory.type)) {
              this.memoriesByType.set(memory.type, new Set());
            }
            this.memoriesByType.get(memory.type)!.add(memory.id);
          }
        }

        if (version < MEMORY_VERSION) {
          await this.saveMemories();
        }
      } catch (error) {
        logger.error('加载记忆数据失败，将使用空数据', { error });
        this.memories.clear();
        this.memoriesByType.clear();
      }
    }
  }

  private async saveMemories(): Promise<void> {
    const memoryPath = `${this.projectPath}/.ai-workshop/memory/memory.json`;
    const data = {
      memories: Array.from(this.memories.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(memoryPath, JSON.stringify(data, null, 2));
  }

  async addMemory(
    type: MemoryType,
    content: string,
    metadata: Record<string, unknown> = {},
    importance: number = 0.5
  ): Promise<MemoryEntry> {
    const memory: MemoryEntry = {
      id: generateId(),
      type,
      content,
      importance,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
    };

    this.memories.set(memory.id, memory);

    if (!this.memoriesByType.has(type)) {
      this.memoriesByType.set(type, new Set());
    }
    this.memoriesByType.get(type)!.add(memory.id);

    await this.saveMemories();
    return memory;
  }

  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<boolean> {
    const memory = this.memories.get(id);
    if (!memory) {
      return false;
    }

    const updated = {
      ...memory,
      ...updates,
      updatedAt: Date.now(),
    };

    if (updates.type && updates.type !== memory.type) {
      this.memoriesByType.get(memory.type)?.delete(id);

      if (!this.memoriesByType.has(updates.type)) {
        this.memoriesByType.set(updates.type, new Set());
      }
      this.memoriesByType.get(updates.type)!.add(id);
    }

    this.memories.set(id, updated);
    await this.saveMemories();
    return true;
  }

  async deleteMemory(id: string): Promise<boolean> {
    const memory = this.memories.get(id);
    if (!memory) {
      return false;
    }

    this.memoriesByType.get(memory.type)?.delete(id);
    this.memories.delete(id);
    await this.saveMemories();
    return true;
  }

  getMemory(id: string): MemoryEntry | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessedAt = Date.now();
    }
    return memory;
  }

  getMemoriesByType(type: MemoryType): MemoryEntry[] {
    const ids = this.memoriesByType.get(type);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((id) => this.memories.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.importance - a.importance);
  }

  getAllMemories(): MemoryEntry[] {
    return Array.from(this.memories.values()).sort((a, b) => b.importance - a.importance);
  }

  searchMemories(query: string, types?: MemoryType[]): MemoryEntry[] {
    const lowerQuery = query.toLowerCase();
    const memories = types
      ? types.flatMap((t) => this.getMemoriesByType(t))
      : this.getAllMemories();

    return memories
      .filter(
        (m) =>
          m.content.toLowerCase().includes(lowerQuery) ||
          JSON.stringify(m.metadata).toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, query);
        const bScore = this.calculateRelevanceScore(b, query);
        return bScore - aScore;
      });
  }

  private calculateRelevanceScore(memory: MemoryEntry, query: string): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerContent = memory.content.toLowerCase();

    if (lowerContent.includes(lowerQuery)) {
      score += 0.5;
    }

    const queryWords = lowerQuery.split(/\s+/);
    for (const word of queryWords) {
      if (lowerContent.includes(word)) {
        score += 0.1;
      }
    }

    score += memory.importance * 0.2;

    const recency = (Date.now() - memory.updatedAt) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 0.3 - recency * 0.01);

    return score;
  }

  async addCharacterMemory(character: Omit<CharacterMemory, 'id'>): Promise<MemoryEntry> {
    const existing = this.findCharacterByName(character.name);

    if (existing) {
      const existingAliases = (existing.metadata.aliases as string[]) || [];
      const existingRelationships =
        (existing.metadata.relationships as CharacterRelationship[]) || [];
      const updated = {
        ...existing.metadata,
        ...character,
        aliases: [...new Set([...existingAliases, ...character.aliases])],
        relationships: [...existingRelationships, ...character.relationships],
      } as Record<string, unknown>;
      await this.updateMemory(existing.id, { metadata: updated });
      return existing;
    }

    const id = generateId();
    const characterMemory: CharacterMemory = { ...character, id };

    return this.addMemory(
      'character',
      character.description,
      characterMemory as unknown as Record<string, unknown>,
      0.8
    );
  }

  private findCharacterByName(name: string): MemoryEntry | undefined {
    const characters = this.getMemoriesByType('character');
    return characters.find(
      (c) => c.metadata.name === name || (c.metadata.aliases as string[])?.includes(name)
    );
  }

  async addTimelineEvent(event: Omit<TimelineMemory, 'id'>): Promise<MemoryEntry> {
    const id = generateId();
    const timelineMemory: TimelineMemory = { ...event, id };

    return this.addMemory(
      'timeline',
      event.event,
      timelineMemory as unknown as Record<string, unknown>,
      event.importance === 'major' ? 0.7 : 0.4
    );
  }

  async addForeshadowing(foreshadow: Omit<ForeshadowingMemory, 'id'>): Promise<MemoryEntry> {
    const id = generateId();
    const foreshadowMemory: ForeshadowingMemory = { ...foreshadow, id };

    return this.addMemory(
      'foreshadowing',
      foreshadow.content,
      foreshadowMemory as unknown as Record<string, unknown>,
      foreshadow.importance
    );
  }

  async updateForeshadowingStatus(
    id: string,
    status: ForeshadowingMemory['status'],
    resolvedAt?: string
  ): Promise<boolean> {
    return this.updateMemory(id, {
      metadata: {
        ...this.memories.get(id)?.metadata,
        status,
        resolvedAt,
      },
    });
  }

  async addWorldbuilding(world: Omit<WorldbuildingMemory, 'id'>): Promise<MemoryEntry> {
    const id = generateId();
    const worldMemory: WorldbuildingMemory = { ...world, id };

    return this.addMemory(
      'worldbuilding',
      world.description,
      worldMemory as unknown as Record<string, unknown>,
      0.6
    );
  }

  getCharacters(): CharacterMemory[] {
    return this.getMemoriesByType('character').map((m) => m.metadata as unknown as CharacterMemory);
  }

  getTimeline(): TimelineMemory[] {
    return this.getMemoriesByType('timeline')
      .map((m) => m.metadata as unknown as TimelineMemory)
      .sort((a, b) => {
        if (a.chapter < b.chapter) {
          return -1;
        }
        if (a.chapter > b.chapter) {
          return 1;
        }
        return 0;
      });
  }

  getForeshadowing(status?: ForeshadowingMemory['status']): ForeshadowingMemory[] {
    let foreshadows = this.getMemoriesByType('foreshadowing').map(
      (m) => m.metadata as unknown as ForeshadowingMemory
    );

    if (status) {
      foreshadows = foreshadows.filter((f) => f.status === status);
    }

    return foreshadows;
  }

  getWorldbuilding(): WorldbuildingMemory[] {
    return this.getMemoriesByType('worldbuilding').map(
      (m) => m.metadata as unknown as WorldbuildingMemory
    );
  }

  async extractFromContent(content: string, chapter?: string): Promise<void> {
    const characterPattern = /([\u4e00-\u9fa5]{2,4})(说|道|问|答|笑|哭|喊|叫|想|看)/g;
    const characters = new Set<string>();

    let match;
    while ((match = characterPattern.exec(content)) !== null) {
      characters.add(match[1]);
    }

    for (const charName of characters) {
      const existing = this.findCharacterByName(charName);
      if (!existing) {
        await this.addCharacterMemory({
          name: charName,
          aliases: [],
          role: 'minor',
          description: `在${chapter || '未知章节'}首次出现`,
          traits: [],
          relationships: [],
          firstAppear: chapter || '未知',
          lastMention: chapter || '未知',
          arc: [],
        });
      } else {
        await this.updateMemory(existing.id, {
          metadata: {
            ...existing.metadata,
            lastMention: chapter || existing.metadata.lastMention,
          },
        });
      }
    }
  }

  getProjectSummary(): string {
    const characters = this.getCharacters();
    const timeline = this.getTimeline();
    const foreshadows = this.getForeshadowing();
    const worldbuilding = this.getWorldbuilding();

    let summary = '# 项目记忆摘要\n\n';

    if (characters.length > 0) {
      summary += '## 主要人物\n';
      for (const char of characters.filter(
        (c) => c.role === 'protagonist' || c.role === 'antagonist'
      )) {
        summary += `- **${char.name}**: ${char.description}\n`;
      }
      summary += '\n';
    }

    if (timeline.length > 0) {
      summary += '## 时间线\n';
      for (const event of timeline.slice(-5)) {
        summary += `- ${event.chapter}: ${event.event}\n`;
      }
      summary += '\n';
    }

    if (foreshadows.filter((f) => f.status === 'planted').length > 0) {
      summary += '## 未回收伏笔\n';
      for (const f of foreshadows.filter((f) => f.status === 'planted')) {
        summary += `- ${f.content} (埋设于: ${f.plantedAt})\n`;
      }
      summary += '\n';
    }

    if (worldbuilding.length > 0) {
      summary += '## 世界观\n';
      for (const world of worldbuilding) {
        summary += `- **${world.name}**: ${world.description}\n`;
      }
    }

    return summary;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const memory of this.memories.values()) {
      if (memory.expiresAt && memory.expiresAt < now) {
        toDelete.push(memory.id);
      }
    }

    for (const id of toDelete) {
      await this.deleteMemory(id);
    }
  }
}

export class SearchEngine {
  private knowledgeService: KnowledgeService;
  private memoryService: MemoryService;

  constructor(knowledgeService: KnowledgeService, memoryService: MemoryService) {
    this.knowledgeService = knowledgeService;
    this.memoryService = memoryService;
  }

  search(options: SearchOptions): SearchResult[] {
    return this.knowledgeService.search(options);
  }

  searchMemories(query: string, types?: MemoryType[]): MemoryEntry[] {
    return this.memoryService.searchMemories(query, types);
  }

  searchAll(
    query: string,
    options: Partial<SearchOptions> = {}
  ): {
    knowledge: SearchResult[];
    memories: MemoryEntry[];
  } {
    const knowledge = this.knowledgeService.search({ query, ...options });
    const memories = this.memoryService.searchMemories(query);

    return { knowledge, memories };
  }

  getContextForQuery(query: string, maxTokens: number = 4000): string {
    const { knowledge, memories } = this.searchAll(query, { limit: 5 });

    let context = '';
    let tokens = 0;

    for (const memory of memories.slice(0, 3)) {
      const content = `[${memory.type}] ${memory.content}\n`;
      const contentTokens = this.estimateTokens(content);

      if (tokens + contentTokens > maxTokens) {
        break;
      }

      context += content;
      tokens += contentTokens;
    }

    for (const result of knowledge.slice(0, 3)) {
      const content = `[知识库] ${result.chunk.content}\n`;
      const contentTokens = this.estimateTokens(content);

      if (tokens + contentTokens > maxTokens) {
        break;
      }

      context += content;
      tokens += contentTokens;
    }

    return context;
  }

  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars * 0.5 + englishWords * 1.3);
  }
}

export function createMemoryService(projectPath: string): MemoryService {
  return new MemoryService(projectPath);
}

export function createSearchEngine(
  knowledgeService: KnowledgeService,
  memoryService: MemoryService
): SearchEngine {
  return new SearchEngine(knowledgeService, memoryService);
}
