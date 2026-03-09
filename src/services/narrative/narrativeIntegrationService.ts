import { narrativeEngine } from './narrativeEngine';
import { storyStateManager } from './storyStateManager';
import { vectorStoreService } from '../retrieval/vectorStoreService';
import type { CharacterState, TimelineEventState, PlantedForeshadow } from '@/types/narrative/storyState';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { PlotNode, PlotLine, TimelineEvent } from '@/types/plot/plotNode';
import type { Foreshadowing } from '@/types/plot/foreshadowing';
import { logger } from '../core/loggerService';

export class NarrativeIntegrationService {
  async initialize(projectPath: string): Promise<void> {
    logger.debug('Narrative integration initialized', { projectPath });
  }

  async syncCharacterFromProfile(profile: CharacterProfile): Promise<void> {
    const characterState: CharacterState = {
      id: profile.id,
      name: profile.name,
      currentLocation: profile.background?.birthplace || '',
      currentStatus: '正常',
      relationships: profile.relationships?.map((r) => ({
        targetId: r.targetId,
        targetName: r.targetName,
        type: this.mapRelationshipType(r.relationshipType),
        strength: r.currentStatus === 'friendly' ? 0.8 : r.currentStatus === 'hostile' ? 0.2 : 0.5,
        lastInteraction: undefined,
      })) || [],
      inventory: [],
      attributes: {
        role: profile.role,
        archetype: profile.archetype,
        age: profile.appearance?.age,
        gender: profile.appearance?.gender,
      },
      arcProgress: 0,
      lastAppearance: undefined,
    };

    await storyStateManager.updateCharacter(profile.id, characterState, 'synced_from_profile');

    await vectorStoreService.addDocument(
      this.characterToSearchableText(profile),
      {
        type: 'character',
        source: 'character_profile',
        character: profile.name,
        tags: [profile.role, profile.archetype, ...profile.aliases],
      }
    );

    logger.debug('Character synced to narrative engine', { name: profile.name });
  }

  async syncCharactersFromProfiles(profiles: CharacterProfile[]): Promise<void> {
    for (const profile of profiles) {
      await this.syncCharacterFromProfile(profile);
    }
  }

  async syncPlotNode(node: PlotNode, plotLine?: PlotLine): Promise<void> {
    await vectorStoreService.addDocument(
      this.plotNodeToSearchableText(node, plotLine),
      {
        type: 'plot',
        source: 'plot_node',
        chapter: node.estimatedChapter,
        tags: [node.type, node.status],
      }
    );

    if (plotLine) {
      await storyStateManager.updatePlot({
        currentArc: plotLine.name,
        activePlotLines: [plotLine.id],
      });
    }

    logger.debug('Plot node synced to narrative engine', { nodeId: node.id });
  }

  async syncTimelineEvent(event: TimelineEvent): Promise<void> {
    const timelineEvent: Omit<TimelineEventState, 'id'> = {
      timestamp: Date.now(),
      description: event.description,
      participants: event.characters || [],
      location: event.location,
      type: event.significance || 'event',
    };

    await storyStateManager.addTimelineEvent(timelineEvent);

    await vectorStoreService.addDocument(
      event.description,
      {
        type: 'plot',
        source: 'timeline_event',
        location: event.location,
        tags: event.characters,
      }
    );

    logger.debug('Timeline event synced', { eventId: event.id });
  }

  async syncForeshadowing(foreshadow: Foreshadowing): Promise<void> {
    const planted: Omit<PlantedForeshadow, 'id' | 'plantedAt'> = {
      description: foreshadow.content,
      plantedIn: foreshadow.plantedAt.chapter || '',
      expectedResolution: foreshadow.plannedResolution?.estimatedChapter,
      importance: this.mapForeshadowImportance(foreshadow.importance),
    };

    const id = await storyStateManager.plantForeshadow(planted);

    if (foreshadow.status === 'resolved') {
      await storyStateManager.resolveForeshadow(id);
    }

    await vectorStoreService.addDocument(
      `伏笔：${foreshadow.title} - ${foreshadow.content}`,
      {
        type: 'foreshadowing',
        source: 'foreshadowing',
        tags: [foreshadow.type, foreshadow.status, foreshadow.importance],
      }
    );

    logger.debug('Foreshadowing synced', { id: foreshadow.id });
  }

  async syncChapterContent(
    chapterNumber: number,
    content: string,
    metadata?: {
      title?: string;
      characters?: string[];
      location?: string;
    }
  ): Promise<void> {
    await narrativeEngine.indexChapter(chapterNumber, content, metadata);

    const characters = metadata?.characters || [];
    for (const charName of characters) {
      const state = storyStateManager.getState();
      const charState = Object.values(state.characters).find(
        (c) => c.name === charName || c.name.includes(charName)
      );
      if (charState) {
        await storyStateManager.updateCharacter(charState.id, {
          lastAppearance: Date.now(),
          currentLocation: metadata?.location || charState.currentLocation,
        });
      }
    }

    logger.debug('Chapter content synced', { chapterNumber, length: content.length });
  }

  async getWritingContext(
    currentScene: string,
    involvedCharacters: string[] = []
  ): Promise<{
    relevantHistory: string;
    characterStates: string;
    plotContext: string;
    worldContext: string;
    warnings: string[];
  }> {
    const context = await narrativeEngine.getNarrativeContext(currentScene);

    const relevantHistory = context.relevantContent
      .map((r) => `[相关内容: ${r.document.metadata.type}]\n${r.document.content}`)
      .join('\n\n---\n\n');

    const characterStates = involvedCharacters
      .map((name) => {
        const state = Object.values(context.currentState.characters).find(
          (c) => c.name === name || c.name.includes(name)
        );
        if (!state) return null;
        return `【${state.name}】
状态: ${state.currentStatus}
位置: ${state.currentLocation || '未知'}
关系: ${state.relationships.map((r) => `${r.targetName}(${r.type})`).join(', ') || '无'}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const plotContext = `当前剧情弧: ${context.plotContext.currentArc || '未设定'}
活跃冲突: ${context.plotContext.activeConflicts.join(', ') || '无'}
待回收伏笔: ${context.plotContext.pendingForeshadows.length}个`;

    const worldContext = `当前位置: ${context.worldContext.currentLocation || '未知'}
活跃事件: ${context.worldContext.activeEvents.join(', ') || '无'}`;

    const warnings: string[] = [];

    const unresolvedForeshadows = storyStateManager.getUnresolvedForeshadows();
    if (unresolvedForeshadows.length > 3) {
      warnings.push(`注意：有 ${unresolvedForeshadows.length} 个伏笔待回收`);
    }

    return {
      relevantHistory,
      characterStates,
      plotContext,
      worldContext,
      warnings,
    };
  }

  async checkContentConsistency(content: string): Promise<string[]> {
    return narrativeEngine.checkConsistency(content);
  }

  async findPlotHoles(): Promise<string[]> {
    return narrativeEngine.findPlotHoles();
  }

  async createCheckpoint(label: string): Promise<string> {
    const snapshotId = await storyStateManager.createSnapshot(label);
    logger.debug('Checkpoint created', { label, snapshotId });
    return snapshotId;
  }

  async restoreCheckpoint(snapshotId: string): Promise<boolean> {
    const success = await storyStateManager.restoreSnapshot(snapshotId);
    if (success) {
      logger.debug('Checkpoint restored', { snapshotId });
    }
    return success;
  }

  private characterToSearchableText(profile: CharacterProfile): string {
    const parts: string[] = [];

    parts.push(`【${profile.name}】`);
    parts.push(`角色: ${profile.role}`);
    parts.push(`原型: ${profile.archetype}`);

    if (profile.appearance) {
      parts.push(`外貌: ${profile.appearance.age || ''}岁, ${profile.appearance.gender || ''}`);
      if (profile.appearance.distinctiveFeatures?.length) {
        parts.push(`特征: ${profile.appearance.distinctiveFeatures.join(', ')}`);
      }
    }

    if (profile.personality) {
      if (profile.personality.traits?.length) {
        parts.push(`性格: ${profile.personality.traits.join(', ')}`);
      }
      if (profile.personality.flaws?.length) {
        parts.push(`缺点: ${profile.personality.flaws.join(', ')}`);
      }
    }

    if (profile.background?.childhood) {
      parts.push(`背景: ${profile.background.childhood}`);
    }

    if (profile.abilities?.skills?.length) {
      parts.push(`技能: ${profile.abilities.skills.map(s => s.name).join(', ')}`);
    }

    return parts.join('\n');
  }

  private plotNodeToSearchableText(node: PlotNode, plotLine?: PlotLine): string {
    const parts: string[] = [];

    parts.push(`【${node.title}】`);
    if (plotLine) {
      parts.push(`剧情线: ${plotLine.name}`);
    }
    parts.push(`类型: ${node.type}`);
    parts.push(`状态: ${node.status}`);
    if (node.description) {
      parts.push(`描述: ${node.description}`);
    }
    if (node.notes) {
      parts.push(`备注: ${node.notes}`);
    }

    return parts.join('\n');
  }

  private mapRelationshipType(type: string): 'family' | 'friend' | 'enemy' | 'lover' | 'ally' | 'rival' | 'neutral' | 'unknown' {
    const typeMap: Record<string, 'family' | 'friend' | 'enemy' | 'lover' | 'ally' | 'rival' | 'neutral' | 'unknown'> = {
      'family': 'family',
      'friend': 'friend',
      'enemy': 'enemy',
      'lover': 'lover',
      'ally': 'ally',
      'rival': 'rival',
      'neutral': 'neutral',
    };
    return typeMap[type] || 'unknown';
  }

  private mapForeshadowImportance(importance: string): 'critical' | 'major' | 'minor' {
    const map: Record<string, 'critical' | 'major' | 'minor'> = {
      'critical': 'critical',
      'major': 'major',
      'minor': 'minor',
    };
    return map[importance] || 'minor';
  }
}

export const narrativeIntegrationService = new NarrativeIntegrationService();
