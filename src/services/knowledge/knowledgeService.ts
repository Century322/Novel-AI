import { workshopService } from '../core/workshopService';
import {
  KnowledgeFile,
  KnowledgeChunk,
  SearchResult,
  SearchOptions,
  IndexingOptions,
  DEFAULT_INDEXING_OPTIONS,
  ChunkMetadata,
} from '@/types/knowledge/knowledge';
import { logger } from '../core/loggerService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const KNOWLEDGE_DIR = '.ai-workshop/knowledge';

export class KnowledgeService {
  private files: Map<string, KnowledgeFile> = new Map();
  private chunks: Map<string, KnowledgeChunk[]> = new Map();
  private index: Map<string, Set<string>> = new Map();

  async initialize(): Promise<void> {
    await this.loadIndex();
  }

  private async loadIndex(): Promise<void> {
    const indexPath = `${KNOWLEDGE_DIR}/index.json`;
    const exists = await workshopService.pathExists(indexPath);

    if (exists) {
      try {
        const content = await workshopService.readFile(indexPath);
        const data = JSON.parse(content);

        for (const file of data.files || []) {
          this.files.set(file.id, file);

          const chunksPath = `${KNOWLEDGE_DIR}/chunks/${file.id}.json`;
          if (await workshopService.pathExists(chunksPath)) {
            const chunksContent = await workshopService.readFile(chunksPath);
            const chunks = JSON.parse(chunksContent);
            this.chunks.set(file.id, chunks);

            for (const chunk of chunks) {
              this.indexChunk(chunk);
            }
          }
        }
      } catch (error) {
        logger.error('加载知识索引失败', { error });
      }
    }
  }

  private async saveIndex(): Promise<void> {
    const indexPath = `${KNOWLEDGE_DIR}/index.json`;
    const data = {
      files: Array.from(this.files.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(indexPath, JSON.stringify(data, null, 2));
  }

  async addFile(
    sourcePath: string,
    type: KnowledgeFile['type'],
    content?: string,
    options: Partial<IndexingOptions> = {}
  ): Promise<KnowledgeFile | null> {
    const opts = { ...DEFAULT_INDEXING_OPTIONS, ...options };

    try {
      let fileContent = content;
      if (!fileContent) {
        fileContent = await workshopService.readFile(sourcePath);
      }
      const filename = sourcePath.split('/').pop() || 'unknown';

      const fileId = generateId();
      const chunks = this.chunkContent(fileContent, opts.chunkSize, opts.chunkOverlap);

      const knowledgeChunks: KnowledgeChunk[] = chunks.map((chunk, index) => ({
        id: `${fileId}_${index}`,
        fileId,
        content: chunk,
        tokens: this.estimateTokens(chunk),
        position: index,
        metadata: opts.extractEntities ? this.extractMetadata(chunk) : { keywords: [] },
      }));

      const knowledgeFile: KnowledgeFile = {
        id: fileId,
        filename,
        path: sourcePath,
        type,
        size: fileContent.length,
        chunkCount: knowledgeChunks.length,
        totalTokens: knowledgeChunks.reduce((sum, c) => sum + c.tokens, 0),
        indexedAt: Date.now(),
        metadata: {
          tags: [],
        },
      };

      this.files.set(fileId, knowledgeFile);
      this.chunks.set(fileId, knowledgeChunks);

      for (const chunk of knowledgeChunks) {
        this.indexChunk(chunk);
      }

      await this.saveChunks(fileId, knowledgeChunks);
      await this.saveIndex();

      return knowledgeFile;
    } catch (error) {
      logger.error('添加知识文件失败', { error });
      return null;
    }
  }

  private chunkContent(content: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = currentChunk.slice(-overlap) + '\n' + paragraph;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars =
      text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length;

    return Math.ceil(chineseChars * 0.5 + englishWords * 1.3 + otherChars * 0.3);
  }

  private extractMetadata(content: string): ChunkMetadata {
    const keywords: string[] = [];

    const quotedTerms = content.match(/[""「」『』]([^""「」『』]+)[""「」『』]/g);
    if (quotedTerms) {
      keywords.push(...quotedTerms.map((t) => t.slice(1, -1)));
    }

    const characterPatterns = [
      /([\\u4e00-\\u9fa5]{2,4})(说|道|问|答|笑|哭|喊|叫)/g,
      /"([^"]+)"[，。]([^说道问答笑哭喊叫]{2,4})说/g,
    ];

    const characters: string[] = [];
    for (const pattern of characterPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length >= 2 && match[1].length <= 4) {
          characters.push(match[1]);
        }
      }
    }

    const chapterMatch = content.match(/第([一二三四五六七八九十百千万零\\d]+)[章节回]/);
    const chapter = chapterMatch ? chapterMatch[0] : undefined;

    return {
      chapter,
      characters: [...new Set(characters)].slice(0, 10),
      keywords: [...new Set(keywords)].slice(0, 20),
    };
  }

  private indexChunk(chunk: KnowledgeChunk): void {
    const terms = this.tokenize(chunk.content);

    for (const term of terms) {
      if (!this.index.has(term)) {
        this.index.set(term, new Set());
      }
      this.index.get(term)!.add(chunk.id);
    }
  }

  private tokenize(text: string): string[] {
    const terms: string[] = [];

    const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];

    for (const word of words) {
      if (word.length >= 2) {
        terms.push(word.toLowerCase());
      }

      if (word.length >= 4 && /[\u4e00-\u9fa5]/.test(word)) {
        for (let i = 0; i <= word.length - 2; i++) {
          terms.push(word.substring(i, i + 2));
        }
      }
    }

    return [...new Set(terms)];
  }

  private async saveChunks(fileId: string, chunks: KnowledgeChunk[]): Promise<void> {
    await workshopService.createDirectory(`${KNOWLEDGE_DIR}/chunks`);
    const chunksPath = `${KNOWLEDGE_DIR}/chunks/${fileId}.json`;
    await workshopService.writeFile(chunksPath, JSON.stringify(chunks, null, 2));
  }

  async removeFile(fileId: string): Promise<boolean> {
    const file = this.files.get(fileId);
    if (!file) {
      return false;
    }

    const chunks = this.chunks.get(fileId) || [];
    for (const chunk of chunks) {
      this.unindexChunk(chunk);
    }

    this.files.delete(fileId);
    this.chunks.delete(fileId);

    const chunksPath = `${KNOWLEDGE_DIR}/chunks/${fileId}.json`;
    await workshopService.deleteFile(chunksPath);
    await this.saveIndex();

    return true;
  }

  private unindexChunk(chunk: KnowledgeChunk): void {
    const terms = this.tokenize(chunk.content);
    for (const term of terms) {
      this.index.get(term)?.delete(chunk.id);
    }
  }

  search(options: SearchOptions): SearchResult[] {
    const { query, limit = 10, minScore = 0.1, fileTypes, tags, characters } = options;

    const queryTerms = this.tokenize(query);
    const chunkScores = new Map<string, number>();

    for (const term of queryTerms) {
      const matchingChunkIds = this.index.get(term);
      if (matchingChunkIds) {
        for (const chunkId of matchingChunkIds) {
          chunkScores.set(chunkId, (chunkScores.get(chunkId) || 0) + 1);
        }
      }
    }

    const results: SearchResult[] = [];
    const maxScore = Math.max(...Array.from(chunkScores.values()), 1);

    for (const [chunkId, score] of chunkScores.entries()) {
      const normalizedScore = score / maxScore;

      if (normalizedScore < minScore) {
        continue;
      }

      const chunk = this.findChunk(chunkId);
      if (!chunk) {
        continue;
      }

      const file = this.files.get(chunk.fileId);
      if (!file) {
        continue;
      }

      if (fileTypes && !fileTypes.includes(file.type)) {
        continue;
      }
      if (tags && !tags.some((t) => file.metadata.tags.includes(t))) {
        continue;
      }
      if (characters && chunk.metadata.characters) {
        if (!characters.some((c) => chunk.metadata.characters?.includes(c))) {
          continue;
        }
      }

      const highlights = this.extractHighlights(chunk.content, queryTerms);

      results.push({
        chunk,
        score: normalizedScore,
        highlights,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private findChunk(chunkId: string): KnowledgeChunk | null {
    for (const chunks of this.chunks.values()) {
      const chunk = chunks.find((c) => c.id === chunkId);
      if (chunk) {
        return chunk;
      }
    }
    return null;
  }

  private extractHighlights(content: string, queryTerms: string[]): string[] {
    const highlights: string[] = [];
    const sentences = content.split(/[。！？\n]+/);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      const hasMatch = queryTerms.some((term) => sentenceLower.includes(term));

      if (hasMatch && sentence.trim().length > 10) {
        highlights.push(sentence.trim().substring(0, 200));
        if (highlights.length >= 3) {
          break;
        }
      }
    }

    return highlights;
  }

  getFile(fileId: string): KnowledgeFile | undefined {
    return this.files.get(fileId);
  }

  getAllFiles(): KnowledgeFile[] {
    return Array.from(this.files.values());
  }

  getFilesByType(type: KnowledgeFile['type']): KnowledgeFile[] {
    return this.getAllFiles().filter((f) => f.type === type);
  }

  getChunks(fileId: string): KnowledgeChunk[] {
    return this.chunks.get(fileId) || [];
  }

  getStats(): {
    totalFiles: number;
    totalChunks: number;
    totalTokens: number;
    byType: Record<string, number>;
  } {
    const stats = {
      totalFiles: this.files.size,
      totalChunks: 0,
      totalTokens: 0,
      byType: {} as Record<string, number>,
    };

    for (const file of this.files.values()) {
      stats.totalChunks += file.chunkCount;
      stats.totalTokens += file.totalTokens;
      stats.byType[file.type] = (stats.byType[file.type] || 0) + 1;
    }

    return stats;
  }

  async rebuildIndex(): Promise<void> {
    this.index.clear();

    for (const chunks of this.chunks.values()) {
      for (const chunk of chunks) {
        this.indexChunk(chunk);
      }
    }
  }
}

export function createKnowledgeService(): KnowledgeService {
  return new KnowledgeService();
}
