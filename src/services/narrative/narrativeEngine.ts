import { vectorStoreService } from '../retrieval/vectorStoreService';
import { storyStateManager } from './storyStateManager';
import { consistencyChecker } from './consistencyChecker';
import type { VectorDocument, SearchResult, SearchOptions } from '@/types/retrieval/vectorStore';
import type { StoryState, CharacterState, TimelineEventState } from '@/types/narrative/storyState';
import { logger } from '../core/loggerService';

export interface NarrativeContext {
  relevantContent: SearchResult[];
  currentState: StoryState;
  characterContext: CharacterContext[];
  plotContext: PlotContext;
  worldContext: WorldContext;
}

export interface CharacterContext {
  character: CharacterState;
  recentEvents: TimelineEventState[];
  activeRelationships: string[];
}

export interface PlotContext {
  currentArc: string;
  activeConflicts: string[];
  pendingForeshadows: string[];
}

export interface WorldContext {
  currentLocation: string;
  activeEvents: string[];
  relevantFlags: string[];
}

export interface IndexContentOptions {
  type: VectorDocument['metadata']['type'];
  content: string;
  chapter?: string;
  character?: string;
  location?: string;
  tags?: string[];
}

export class NarrativeEngine {
  async indexContent(options: IndexContentOptions): Promise<VectorDocument> {
    const { type, content, chapter, character, location, tags } = options;

    const document = await vectorStoreService.addDocument(content, {
      type,
      source: 'user_input',
      chapter,
      character,
      location,
      tags,
    });

    logger.debug('Content indexed', {
      documentId: document.id,
      type,
      contentLength: content.length,
    });

    return document;
  }

  async indexChapter(
    chapterNumber: number,
    content: string,
    metadata?: {
      title?: string;
      characters?: string[];
      location?: string;
    }
  ): Promise<VectorDocument[]> {
    const documents: VectorDocument[] = [];

    const chunks = this.splitContent(content, 1000);

    for (let i = 0; i < chunks.length; i++) {
      const doc = await this.indexContent({
        type: 'chapter',
        content: chunks[i],
        chapter: chapterNumber.toString(),
        location: metadata?.location,
        tags: metadata?.characters,
      });
      documents.push(doc);
    }

    logger.debug('Chapter indexed', {
      chapterNumber,
      chunksCount: chunks.length,
    });

    return documents;
  }

  async getNarrativeContext(query: string, options?: SearchOptions): Promise<NarrativeContext> {
    const relevantContent = await vectorStoreService.search(query, {
      topK: 10,
      minScore: 0.5,
      ...options,
    });

    const currentState = storyStateManager.getState();

    const characterContext = await this.buildCharacterContext(query, currentState);
    const plotContext = this.buildPlotContext(currentState);
    const worldContext = this.buildWorldContext(currentState);

    return {
      relevantContent,
      currentState,
      characterContext,
      plotContext,
      worldContext,
    };
  }

  async searchRelevantContent(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return vectorStoreService.search(query, options);
  }

  async findCharacterMentions(characterName: string): Promise<SearchResult[]> {
    return vectorStoreService.search(characterName, {
      topK: 20,
      filter: { character: characterName },
    });
  }

  async findPlotHoles(): Promise<string[]> {
    const state = storyStateManager.getState();
    const issues: string[] = [];

    const unresolvedForeshadows = state.foreshadowing.planted.filter(
      (f) => !state.foreshadowing.resolved.includes(f.id)
    );

    for (const f of unresolvedForeshadows) {
      const results = await vectorStoreService.search(f.description, {
        topK: 5,
        minScore: 0.7,
      });

      if (results.length === 0) {
        issues.push(`伏笔未回收: ${f.description}`);
      }
    }

    const activeConflicts = state.plot.pendingConflicts.filter((c) => c.status === 'active');
    for (const conflict of activeConflicts) {
      issues.push(`未解决的冲突: ${conflict.description}`);
    }

    return issues;
  }

  async checkConsistency(newContent: string): Promise<string[]> {
    const issues = await consistencyChecker.checkContent(newContent);
    return issues.map((issue) => issue.description);
  }

  async checkFullConsistency(): Promise<string[]> {
    const issues = await consistencyChecker.checkFullStory();
    return issues.map((issue) => issue.description);
  }

  getState(): StoryState {
    return storyStateManager.getState();
  }

  async updateCharacter(characterId: string, updates: Partial<CharacterState>): Promise<void> {
    await storyStateManager.updateCharacter(characterId, updates);
  }

  async addTimelineEvent(event: Omit<TimelineEventState, 'id'>): Promise<string> {
    return storyStateManager.addTimelineEvent(event);
  }

  async plantForeshadow(description: string, importance: 'critical' | 'major' | 'minor' = 'minor'): Promise<string> {
    return storyStateManager.plantForeshadow({
      description,
      plantedIn: '',
      importance,
    });
  }

  async resolveForeshadow(foreshadowId: string): Promise<void> {
    await storyStateManager.resolveForeshadow(foreshadowId);
  }

  async createSnapshot(label?: string): Promise<string> {
    return storyStateManager.createSnapshot(label);
  }

  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    return storyStateManager.restoreSnapshot(snapshotId);
  }

  private splitContent(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n\n+/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += paragraph + '\n\n';
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private async buildCharacterContext(
    query: string,
    state: StoryState
  ): Promise<CharacterContext[]> {
    const contexts: CharacterContext[] = [];

    const relevantChars = Object.values(state.characters).filter((char) =>
      query.toLowerCase().includes(char.name.toLowerCase())
    );

    for (const character of relevantChars) {
      const recentEvents = state.timeline.events
        .filter((e) => e.participants.includes(character.id))
        .slice(-5);

      const activeRelationships = character.relationships
        .filter((r) => r.strength > 0.5)
        .map((r) => r.targetName);

      contexts.push({
        character,
        recentEvents,
        activeRelationships,
      });
    }

    return contexts;
  }

  private buildPlotContext(state: StoryState): PlotContext {
    return {
      currentArc: state.plot.currentArc,
      activeConflicts: state.plot.pendingConflicts
        .filter((c) => c.status === 'active')
        .map((c) => c.description),
      pendingForeshadows: state.foreshadowing.planted
        .filter((f) => !state.foreshadowing.resolved.includes(f.id))
        .map((f) => f.description),
    };
  }

  private buildWorldContext(state: StoryState): WorldContext {
    const relevantFlags = Object.entries(state.world.globalFlags)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    return {
      currentLocation: state.world.currentLocation,
      activeEvents: state.world.activeEvents,
      relevantFlags,
    };
  }
}

export const narrativeEngine = new NarrativeEngine();
