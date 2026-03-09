import { narrativeEngine, narrativeIntegrationService } from '../narrative';
import { storyStateManager } from '../narrative/storyStateManager';
import { logger } from '../core/loggerService';

export interface WritingContext {
  relevantHistory: string;
  characterStates: string;
  plotContext: string;
  worldContext: string;
  foreshadowingReminders: string;
  consistencyWarnings: string[];
  suggestions: string[];
}

export interface NarrativeContextResult {
  context: WritingContext;
  tokenCount: number;
}

export class NarrativeContextService {
  private maxHistoryLength: number = 3000;
  private maxCharacterLength: number = 1500;
  private maxPlotLength: number = 800;
  private maxWorldLength: number = 500;
  private maxForeshadowLength: number = 500;

  async getWritingContext(
    currentScene: string,
    involvedCharacters: string[] = [],
    chapterNumber?: number
  ): Promise<NarrativeContextResult> {
    logger.debug('Building narrative context for writing', {
      sceneLength: currentScene.length,
      characterCount: involvedCharacters.length,
      chapterNumber,
    });

    const context = await narrativeIntegrationService.getWritingContext(
      currentScene,
      involvedCharacters
    );

    const foreshadowReminders = await this.getForeshadowingReminders();

    const consistencyWarnings = context.warnings;

    const suggestions = await this.generateSuggestions(currentScene, involvedCharacters);

    const writingContext: WritingContext = {
      relevantHistory: this.truncate(context.relevantHistory, this.maxHistoryLength),
      characterStates: this.truncate(context.characterStates, this.maxCharacterLength),
      plotContext: this.truncate(context.plotContext, this.maxPlotLength),
      worldContext: this.truncate(context.worldContext, this.maxWorldLength),
      foreshadowingReminders: this.truncate(foreshadowReminders, this.maxForeshadowLength),
      consistencyWarnings,
      suggestions,
    };

    const tokenCount = this.estimateTokenCount(writingContext);

    return { context: writingContext, tokenCount };
  }

  async buildSystemPrompt(
    currentScene: string,
    involvedCharacters: string[] = [],
    chapterNumber?: number
  ): Promise<string> {
    const { context } = await this.getWritingContext(
      currentScene,
      involvedCharacters,
      chapterNumber
    );

    const parts: string[] = [];

    if (context.relevantHistory) {
      parts.push(`【相关历史内容】
${context.relevantHistory}`);
    }

    if (context.characterStates) {
      parts.push(`【角色当前状态】
${context.characterStates}`);
    }

    if (context.plotContext) {
      parts.push(`【剧情上下文】
${context.plotContext}`);
    }

    if (context.worldContext) {
      parts.push(`【世界设定】
${context.worldContext}`);
    }

    if (context.foreshadowingReminders) {
      parts.push(`【伏笔提醒】
${context.foreshadowingReminders}`);
    }

    if (context.consistencyWarnings.length > 0) {
      parts.push(`【一致性警告】
${context.consistencyWarnings.map((w) => `- ${w}`).join('\n')}`);
    }

    if (context.suggestions.length > 0) {
      parts.push(`【写作建议】
${context.suggestions.map((s) => `- ${s}`).join('\n')}`);
    }

    return parts.join('\n\n---\n\n');
  }

  async indexWrittenContent(
    content: string,
    metadata: {
      type: 'chapter' | 'scene' | 'dialogue';
      chapterNumber?: number;
      sceneTitle?: string;
      characters?: string[];
      location?: string;
    }
  ): Promise<void> {
    await narrativeIntegrationService.syncChapterContent(
      metadata.chapterNumber || 1,
      content,
      {
        title: metadata.sceneTitle,
        characters: metadata.characters,
        location: metadata.location,
      }
    );

    logger.debug('Content indexed to narrative engine', {
      type: metadata.type,
      chapter: metadata.chapterNumber,
      characterCount: metadata.characters?.length || 0,
    });
  }

  async checkAndWarn(content: string): Promise<string[]> {
    const issues = await narrativeEngine.checkConsistency(content);
    return issues;
  }

  async createChapterCheckpoint(chapterNumber: number): Promise<string> {
    const snapshotId = await narrativeIntegrationService.createCheckpoint(
      `第${chapterNumber}章完成`
    );

    logger.debug('Chapter checkpoint created', { chapterNumber, snapshotId });
    return snapshotId;
  }

  private async getForeshadowingReminders(): Promise<string> {
    const state = storyStateManager.getState();
    const unresolved = state.foreshadowing.planted.filter(
      (f) => !state.foreshadowing.resolved.includes(f.id)
    );

    if (unresolved.length === 0) {
      return '';
    }

    const critical = unresolved.filter((f) => f.importance === 'critical');
    const major = unresolved.filter((f) => f.importance === 'major');

    const reminders: string[] = [];

    if (critical.length > 0) {
      reminders.push('重要伏笔待回收:');
      critical.forEach((f) => {
        reminders.push(`- ${f.description}`);
      });
    }

    if (major.length > 0 && major.length <= 3) {
      reminders.push('其他伏笔:');
      major.forEach((f) => {
        reminders.push(`- ${f.description}`);
      });
    }

    return reminders.join('\n');
  }

  private async generateSuggestions(
    _currentScene: string,
    _involvedCharacters: string[]
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const state = storyStateManager.getState();

    const recentCharacters = Object.values(state.characters)
      .filter((c) => {
        if (!c.lastAppearance) return false;
        const daysSince = (Date.now() - c.lastAppearance) / (1000 * 60 * 60 * 24);
        return daysSince > 3 && daysSince < 10;
      })
      .slice(0, 3);

    if (recentCharacters.length > 0) {
      suggestions.push(
        `以下角色有一段时间未出场：${recentCharacters.map((c) => c.name).join('、')}`
      );
    }

    const unresolvedForeshadows = state.foreshadowing.planted.filter(
      (f) => !state.foreshadowing.resolved.includes(f.id) && f.importance === 'critical'
    );

    if (unresolvedForeshadows.length > 0) {
      const randomForeshadow =
        unresolvedForeshadows[Math.floor(Math.random() * unresolvedForeshadows.length)];
      suggestions.push(`考虑回收伏笔：${randomForeshadow.description}`);
    }

    const activeConflicts = state.plot.pendingConflicts.filter((c) => c.status === 'active');
    if (activeConflicts.length > 2) {
      suggestions.push('当前有多个活跃冲突，考虑推进其中之一的解决');
    }

    return suggestions;
  }

  private truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  private estimateTokenCount(context: WritingContext): number {
    const totalLength =
      context.relevantHistory.length +
      context.characterStates.length +
      context.plotContext.length +
      context.worldContext.length +
      context.foreshadowingReminders.length;

    return Math.ceil(totalLength / 2);
  }
}

export const narrativeContextService = new NarrativeContextService();
