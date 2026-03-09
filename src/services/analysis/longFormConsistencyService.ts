import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';
import type { ChapterSummaryService } from '../memory/chapterSummaryService';
import type { Foreshadowing } from '@/types/plot/foreshadowing';
import type { CharacterProfile } from '@/types/character/characterProfile';

export interface ForeshadowingStatus {
  id: string;
  title: string;
  content: string;
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned';
  importance: 'major' | 'minor' | 'subtle';
  plantedChapter?: number;
  hintedChapters: number[];
  resolvedChapter?: number;
  chaptersSincePlanted: number;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  suggestedResolutionChapter?: number;
}

export interface CharacterConsistencyReport {
  characterId: string;
  characterName: string;
  totalAppearances: number;
  consistencyScore: number;
  issues: Array<{
    type: 'behavior' | 'trait' | 'ability' | 'relationship';
    description: string;
    chapters: number[];
    severity: 'high' | 'medium' | 'low';
  }>;
  evolution: Array<{
    chapter: number;
    change: string;
  }>;
}

export interface VolumeSummary {
  volumeNumber: number;
  title: string;
  startChapter: number;
  endChapter: number;
  wordCount: number;
  summary: string;
  mainPlotProgress: string;
  characterArcs: Array<{
    characterName: string;
    arc: string;
  }>;
  foreshadowingPlanted: string[];
  foreshadowingResolved: string[];
}

export interface ContextWindowStrategy {
  type: 'summary' | 'key_passages' | 'hybrid';
  maxTokens: number;
  includeRecentChapters: number;
  includeKeyEvents: boolean;
  includeCharacterStates: boolean;
}

export class LongFormConsistencyService {
  private worldModelService: WorldModelService | null = null;
  private chapterSummaryService: ChapterSummaryService | null = null;

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setChapterSummaryService(service: ChapterSummaryService): void {
    this.chapterSummaryService = service;
  }

  async getForeshadowingStatus(): Promise<ForeshadowingStatus[]> {
    if (!this.worldModelService || !this.chapterSummaryService) {
      return [];
    }

    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) return [];

    const summaries = this.chapterSummaryService.getAllSummaries();
    const currentChapter =
      summaries.length > 0 ? Math.max(...summaries.map((s) => s.chapterNumber)) : 0;

    const statuses: ForeshadowingStatus[] = [];

    for (const f of worldModel.foreshadowing.items) {
      const plantedChapter = this.extractChapterNumber(f.plantedAt.description);
      const resolvedChapter = f.actualResolution
        ? this.extractChapterNumber(f.actualResolution.chapter)
        : undefined;

      const hintedChapters = this.findHintedChapters(f, summaries);

      const chaptersSincePlanted = plantedChapter ? currentChapter - plantedChapter : 0;

      const urgency = this.calculateUrgency(f, chaptersSincePlanted, currentChapter);

      statuses.push({
        id: f.id,
        title: f.title,
        content: f.content,
        status: f.status,
        importance: f.importance,
        plantedChapter,
        hintedChapters,
        resolvedChapter,
        chaptersSincePlanted,
        urgency,
        suggestedResolutionChapter: this.suggestResolutionChapter(
          f,
          currentChapter,
          chaptersSincePlanted
        ),
      });
    }

    return statuses.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }

  private extractChapterNumber(description: string): number | undefined {
    const match = description.match(/第(\d+)章/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private findHintedChapters(
    f: Foreshadowing,
    summaries: ReturnType<ChapterSummaryService['getAllSummaries']>
  ): number[] {
    const chapters: number[] = [];

    for (const summary of summaries) {
      const hasHint = summary.foreshadowingActivity.some(
        (a) => a.title === f.title || f.content.includes(a.title)
      );
      if (hasHint) {
        chapters.push(summary.chapterNumber);
      }
    }

    return chapters;
  }

  private calculateUrgency(
    f: Foreshadowing,
    chaptersSincePlanted: number,
    _currentChapter: number
  ): ForeshadowingStatus['urgency'] {
    if (f.status === 'resolved' || f.status === 'abandoned') {
      return 'low';
    }

    if (f.importance === 'major') {
      if (chaptersSincePlanted > 50) return 'critical';
      if (chaptersSincePlanted > 30) return 'high';
      if (chaptersSincePlanted > 15) return 'normal';
    }

    if (f.importance === 'minor') {
      if (chaptersSincePlanted > 30) return 'high';
      if (chaptersSincePlanted > 20) return 'normal';
    }

    return 'low';
  }

  private suggestResolutionChapter(
    f: Foreshadowing,
    currentChapter: number,
    chaptersSincePlanted: number
  ): number | undefined {
    if (f.status === 'resolved') return undefined;

    if (f.importance === 'major' && chaptersSincePlanted > 30) {
      return currentChapter + 5;
    }

    if (f.importance === 'minor' && chaptersSincePlanted > 20) {
      return currentChapter + 3;
    }

    return undefined;
  }

  async getPendingForeshadowingForChapter(chapterNumber: number): Promise<{
    toPlant: Foreshadowing[];
    toHint: Foreshadowing[];
    toResolve: Foreshadowing[];
  }> {
    const statuses = await this.getForeshadowingStatus();

    const toResolve = statuses
      .filter((s) => s.urgency === 'critical' || s.urgency === 'high')
      .filter(
        (s) => s.suggestedResolutionChapter && s.suggestedResolutionChapter <= chapterNumber + 5
      );

    const toHint = statuses
      .filter((s) => s.status === 'planted')
      .filter((s) => s.chaptersSincePlanted >= 5 && s.chaptersSincePlanted <= 15);

    const toPlant = statuses
      .filter((s) => s.status === 'planted' && s.importance === 'major')
      .slice(0, 2);

    return {
      toPlant: toPlant.map((s) => this.statusToForeshadowing(s)),
      toHint: toHint.map((s) => this.statusToForeshadowing(s)),
      toResolve: toResolve.map((s) => this.statusToForeshadowing(s)),
    };
  }

  private statusToForeshadowing(status: ForeshadowingStatus): Foreshadowing {
    return {
      id: status.id,
      title: status.title,
      content: status.content,
      type: 'other',
      status: status.status,
      importance: status.importance,
      plantedAt: { description: `第${status.plantedChapter}章` },
      plannedResolution: { description: '' },
      relatedCharacters: [],
      relatedItems: [],
      relatedEvents: [],
      hints: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async generateForeshadowingPrompt(chapterNumber: number): Promise<string> {
    const pending = await this.getPendingForeshadowingForChapter(chapterNumber);
    const parts: string[] = [];

    if (pending.toResolve.length > 0) {
      parts.push('## 需要回收的伏笔');
      for (const f of pending.toResolve) {
        parts.push(`- **${f.title}**: ${f.content}`);
        parts.push(`  埋设位置: ${f.plantedAt.description}`);
        parts.push(`  建议在本章或近期回收`);
      }
      parts.push('');
    }

    if (pending.toHint.length > 0) {
      parts.push('## 可以暗示的伏笔');
      for (const f of pending.toHint) {
        parts.push(`- **${f.title}**: ${f.content}`);
        parts.push(`  可以在本章中适当暗示，保持读者记忆`);
      }
      parts.push('');
    }

    if (pending.toPlant.length > 0) {
      parts.push('## 建议埋设的伏笔');
      for (const f of pending.toPlant) {
        parts.push(`- **${f.title}**: ${f.content}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  async checkCharacterConsistency(
    characterName: string
  ): Promise<CharacterConsistencyReport | null> {
    if (!this.worldModelService || !this.chapterSummaryService) {
      return null;
    }

    const characters = this.worldModelService.getCharacters();
    const character = characters.find((c) => c.name === characterName);
    if (!character) return null;

    const summaries = this.chapterSummaryService.getAllSummaries();
    const appearances = summaries
      .filter((s) => s.characterAppearances.some((a) => a.characterName === characterName))
      .map((s) => ({
        chapter: s.chapterNumber,
        appearance: s.characterAppearances.find((a) => a.characterName === characterName)!,
      }));

    const issues: CharacterConsistencyReport['issues'] = [];
    const evolution: CharacterConsistencyReport['evolution'] = [];

    for (let i = 1; i < appearances.length; i++) {
      const prev = appearances[i - 1];
      const curr = appearances[i];

      if (curr.appearance.development) {
        evolution.push({
          chapter: curr.chapter,
          change: curr.appearance.development,
        });
      }

      if (
        prev.appearance.emotionalState &&
        curr.appearance.emotionalState &&
        this.areContradictoryEmotions(
          prev.appearance.emotionalState,
          curr.appearance.emotionalState
        )
      ) {
        const hasTransition = this.hasEmotionalTransition(
          summaries.find((s) => s.chapterNumber === curr.chapter)?.summary || ''
        );
        if (!hasTransition) {
          issues.push({
            type: 'behavior',
            description: `情感状态从"${prev.appearance.emotionalState}"突然变为"${curr.appearance.emotionalState}"，缺乏过渡`,
            chapters: [prev.chapter, curr.chapter],
            severity: 'medium',
          });
        }
      }
    }

    const consistencyScore = Math.max(0, 100 - issues.length * 15);

    return {
      characterId: character.id,
      characterName: character.name,
      totalAppearances: appearances.length,
      consistencyScore,
      issues,
      evolution,
    };
  }

  private areContradictoryEmotions(emotion1: string, emotion2: string): boolean {
    const contradictions: Array<[string, string]> = [
      ['开心', '悲伤'],
      ['愤怒', '平静'],
      ['紧张', '放松'],
      ['兴奋', '沮丧'],
      ['快乐', '痛苦'],
      ['希望', '绝望'],
    ];

    const e1 = emotion1.toLowerCase();
    const e2 = emotion2.toLowerCase();

    for (const [a, b] of contradictions) {
      if ((e1.includes(a) && e2.includes(b)) || (e1.includes(b) && e2.includes(a))) {
        return true;
      }
    }
    return false;
  }

  private hasEmotionalTransition(summary: string): boolean {
    const transitionWords = ['渐渐', '慢慢', '逐渐', '转变', '变化', '经过', '思考后'];
    return transitionWords.some((w) => summary.includes(w));
  }

  async buildContextWindow(
    chapterNumber: number,
    strategy: ContextWindowStrategy = {
      type: 'hybrid',
      maxTokens: 4000,
      includeRecentChapters: 2,
      includeKeyEvents: true,
      includeCharacterStates: true,
    }
  ): Promise<string> {
    if (!this.chapterSummaryService || !this.worldModelService) {
      return '';
    }

    const parts: string[] = [];

    if (strategy.includeRecentChapters > 0) {
      const recentSummaries = this.chapterSummaryService.getSummariesRange(
        Math.max(1, chapterNumber - strategy.includeRecentChapters),
        chapterNumber - 1
      );

      if (recentSummaries.length > 0) {
        parts.push('## 近期章节摘要');
        for (const s of recentSummaries) {
          parts.push(`### 第${s.chapterNumber}章`);
          parts.push(s.summary);
          parts.push('');
        }
      }
    }

    if (strategy.includeKeyEvents) {
      const allSummaries = this.chapterSummaryService.getAllSummaries();
      const majorEvents = allSummaries
        .flatMap((s) => s.keyEvents.filter((e) => e.significance === 'major'))
        .slice(-5);

      if (majorEvents.length > 0) {
        parts.push('## 关键事件');
        for (const e of majorEvents) {
          parts.push(`- ${e.description}`);
        }
        parts.push('');
      }
    }

    if (strategy.includeCharacterStates) {
      const worldModel = this.worldModelService.getWorldModel();
      if (worldModel) {
        const mainCharacters = worldModel.characters.items.filter(
          (c: CharacterProfile) => c.role === 'protagonist' || c.role === 'antagonist'
        );

        if (mainCharacters.length > 0) {
          parts.push('## 主要人物当前状态');
          for (const char of mainCharacters) {
            parts.push(`**${char.name}**`);
            if (char.lastAppearance) {
              parts.push(`最后出现: ${char.lastAppearance}`);
            }
            if (char.notes) {
              parts.push(`状态: ${char.notes}`);
            }
            parts.push('');
          }
        }
      }
    }

    const foreshadowingPrompt = await this.generateForeshadowingPrompt(chapterNumber);
    if (foreshadowingPrompt) {
      parts.push(foreshadowingPrompt);
    }

    return parts.join('\n');
  }

  async generateVolumeSummary(
    volumeNumber: number,
    startChapter: number,
    endChapter: number
  ): Promise<VolumeSummary | null> {
    if (!this.chapterSummaryService || !this.worldModelService) {
      return null;
    }

    const summaries = this.chapterSummaryService.getSummariesRange(startChapter, endChapter);
    if (summaries.length === 0) return null;

    const totalWordCount = summaries.reduce((sum, s) => sum + s.wordCount, 0);

    const combinedSummary = summaries.map((s) => s.summary).join('\n');

    const prompt = `请为以下章节内容生成一卷的总结。

章节范围：第${startChapter}章 - 第${endChapter}章
总字数：${totalWordCount}

章节摘要：
${combinedSummary.substring(0, 3000)}

请输出 JSON 格式：
{
  "title": "卷标题",
  "summary": "本卷摘要（200-300字）",
  "mainPlotProgress": "主线剧情进展",
  "characterArcs": [
    { "characterName": "人物名", "arc": "人物弧光变化" }
  ]
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 1024,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultVolumeSummary(
          volumeNumber,
          startChapter,
          endChapter,
          totalWordCount
        );
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        volumeNumber,
        title: result.title || `第${volumeNumber}卷`,
        startChapter,
        endChapter,
        wordCount: totalWordCount,
        summary: result.summary || '',
        mainPlotProgress: result.mainPlotProgress || '',
        characterArcs: result.characterArcs || [],
        foreshadowingPlanted: [],
        foreshadowingResolved: [],
      };
    } catch (error) {
      logger.error('生成卷摘要失败', { error: String(error) });
      return this.createDefaultVolumeSummary(
        volumeNumber,
        startChapter,
        endChapter,
        totalWordCount
      );
    }
  }

  private createDefaultVolumeSummary(
    volumeNumber: number,
    startChapter: number,
    endChapter: number,
    wordCount: number
  ): VolumeSummary {
    return {
      volumeNumber,
      title: `第${volumeNumber}卷`,
      startChapter,
      endChapter,
      wordCount,
      summary: `第${startChapter}章至第${endChapter}章的内容`,
      mainPlotProgress: '',
      characterArcs: [],
      foreshadowingPlanted: [],
      foreshadowingResolved: [],
    };
  }
}

export const longFormConsistencyService = new LongFormConsistencyService();
