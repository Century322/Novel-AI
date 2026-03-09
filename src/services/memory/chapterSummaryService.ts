import { llmService } from '../ai/llmService';
import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';

export interface ChapterSummary {
  id: string;
  chapterNumber: number;
  title: string;
  wordCount: number;
  summary: string;
  keyEvents: KeyEvent[];
  characterAppearances: CharacterAppearance[];
  foreshadowingActivity: ForeshadowingActivity[];
  emotionalArc: EmotionalArc;
  plotProgress: PlotProgress;
  generatedAt: number;
  updatedAt: number;
}

export interface KeyEvent {
  id: string;
  description: string;
  significance: 'major' | 'minor';
  characters: string[];
  location?: string;
}

export interface CharacterAppearance {
  characterId: string;
  characterName: string;
  role: 'viewpoint' | 'major' | 'minor' | 'mentioned';
  actions: string[];
  development: string;
  emotionalState?: string;
}

export interface ForeshadowingActivity {
  foreshadowingId: string;
  title: string;
  action: 'planted' | 'hinted' | 'resolved';
  details: string;
}

export interface EmotionalArc {
  startMood: string;
  endMood: string;
  peakMoment?: string;
  tensionLevel: number;
}

export interface PlotProgress {
  mainPlotAdvance: string;
  subplotsAffected: string[];
  newMysteries: string[];
  resolvedMysteries: string[];
}

export interface SummaryOptions {
  detailLevel: 'brief' | 'standard' | 'detailed';
  includeAnalysis: boolean;
  trackCharacters: boolean;
  trackForeshadowing: boolean;
}

const SUMMARY_GENERATION_PROMPT = `你是一个专业的小说章节分析专家。请为以下章节生成结构化摘要。

分析要求：
1. 提取关键事件（按重要性分类）
2. 记录人物出场和变化
3. 追踪伏笔活动
4. 分析情感曲线
5. 评估剧情进展

输出 JSON 格式：
{
  "summary": "章节摘要（100-200字）",
  "keyEvents": [
    {
      "description": "事件描述",
      "significance": "major/minor",
      "characters": ["涉及人物"],
      "location": "地点"
    }
  ],
  "characterAppearances": [
    {
      "characterName": "人物名",
      "role": "viewpoint/major/minor/mentioned",
      "actions": ["主要行为"],
      "development": "人物发展",
      "emotionalState": "情感状态"
    }
  ],
  "foreshadowingActivity": [
    {
      "title": "伏笔标题",
      "action": "planted/hinted/resolved",
      "details": "详情"
    }
  ],
  "emotionalArc": {
    "startMood": "起始情绪",
    "endMood": "结束情绪",
    "peakMoment": "情绪高潮点",
    "tensionLevel": 0.7
  },
  "plotProgress": {
    "mainPlotAdvance": "主线进展",
    "subplotsAffected": ["受影响的支线"],
    "newMysteries": ["新悬念"],
    "resolvedMysteries": ["解决的悬念"]
  }
}`;

export class ChapterSummaryService {
  private projectPath: string;
  private worldModelService: WorldModelService | null = null;
  private summaries: Map<string, ChapterSummary> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  async initialize(): Promise<void> {
    await this.loadSummaries();
  }

  private async loadSummaries(): Promise<void> {
    const summaryPath = `${this.projectPath}/.ai-workshop/memory/chapterSummaries.json`;

    if (await workshopService.pathExists(summaryPath)) {
      try {
        const content = await workshopService.readFile(summaryPath);
        const data = JSON.parse(content);

        for (const summary of data.summaries || []) {
          this.summaries.set(summary.id, summary);
        }
      } catch (error) {
        logger.error('加载章节摘要失败', { error: String(error) });
      }
    }
  }

  private async saveSummaries(): Promise<void> {
    const summaryPath = `${this.projectPath}/.ai-workshop/memory/chapterSummaries.json`;
    const data = {
      summaries: Array.from(this.summaries.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(summaryPath, JSON.stringify(data, null, 2));
  }

  async generateSummary(
    chapterNumber: number,
    content: string,
    title?: string,
    options: Partial<SummaryOptions> = {}
  ): Promise<ChapterSummary> {
    const opts: SummaryOptions = {
      detailLevel: 'standard',
      includeAnalysis: true,
      trackCharacters: true,
      trackForeshadowing: true,
      ...options,
    };

    const prompt = `${SUMMARY_GENERATION_PROMPT}

章节标题：${title || `第${chapterNumber}章`}
章节内容：
${content.substring(0, 8000)}

请生成章节摘要。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2048,
      });

      const responseContent = response.content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析摘要 JSON');
      }

      const result = JSON.parse(jsonMatch[0]);

      const summary: ChapterSummary = {
        id: `summary_ch${chapterNumber}_${Date.now()}`,
        chapterNumber,
        title: title || `第${chapterNumber}章`,
        wordCount: content.length,
        summary: result.summary || '',
        keyEvents: (result.keyEvents || []).map((e: Record<string, unknown>, i: number) => ({
          id: `event_${chapterNumber}_${i}`,
          description: String(e.description),
          significance: e.significance as 'major' | 'minor',
          characters: (e.characters as string[]) || [],
          location: e.location as string | undefined,
        })),
        characterAppearances: (result.characterAppearances || []).map(
          (c: Record<string, unknown>) => ({
            characterId: '',
            characterName: String(c.characterName),
            role: c.role as 'viewpoint' | 'major' | 'minor' | 'mentioned',
            actions: (c.actions as string[]) || [],
            development: String(c.development || ''),
            emotionalState: c.emotionalState as string | undefined,
          })
        ),
        foreshadowingActivity: (result.foreshadowingActivity || []).map(
          (f: Record<string, unknown>) => ({
            foreshadowingId: '',
            title: String(f.title),
            action: f.action as 'planted' | 'hinted' | 'resolved',
            details: String(f.details),
          })
        ),
        emotionalArc: result.emotionalArc || {
          startMood: '',
          endMood: '',
          tensionLevel: 0.5,
        },
        plotProgress: result.plotProgress || {
          mainPlotAdvance: '',
          subplotsAffected: [],
          newMysteries: [],
          resolvedMysteries: [],
        },
        generatedAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.summaries.set(summary.id, summary);
      await this.saveSummaries();

      if (opts.trackCharacters && this.worldModelService) {
        await this.updateCharacterAppearances(summary);
      }

      if (opts.trackForeshadowing && this.worldModelService) {
        await this.updateForeshadowingStatus(summary);
      }

      logger.info(`生成章节摘要: 第${chapterNumber}章`);
      return summary;
    } catch (error) {
      logger.error('生成章节摘要失败', { error: String(error) });
      throw error;
    }
  }

  private async updateCharacterAppearances(summary: ChapterSummary): Promise<void> {
    if (!this.worldModelService) return;

    for (const appearance of summary.characterAppearances) {
      const characters = this.worldModelService.getCharacters();
      const character = characters.find((c) => c.name === appearance.characterName);

      if (character) {
        await this.worldModelService.updateCharacter(character.id, {
          lastAppearance: `第${summary.chapterNumber}章`,
          totalAppearances: (character.totalAppearances || 0) + 1,
        });
      } else if (appearance.role !== 'mentioned') {
        await this.worldModelService.addCharacter({
          name: appearance.characterName,
          role: appearance.role === 'viewpoint' ? 'protagonist' : 'minor',
          notes: `首次出现于第${summary.chapterNumber}章`,
          firstAppearance: `第${summary.chapterNumber}章`,
          totalAppearances: 1,
        });
      }
    }
  }

  private async updateForeshadowingStatus(summary: ChapterSummary): Promise<void> {
    if (!this.worldModelService) return;

    for (const activity of summary.foreshadowingActivity) {
      const foreshadowings = this.worldModelService.getForeshadowing();
      const existing = foreshadowings.find(
        (f) => f.title === activity.title || f.content.includes(activity.title)
      );

      if (existing) {
        if (activity.action === 'resolved') {
          await this.worldModelService.updateForeshadowing(existing.id, {
            status: 'resolved',
            actualResolution: {
              plotNodeId: summary.id,
              chapter: `第${summary.chapterNumber}章`,
              storyTime: '',
              description: activity.details,
            },
          });
        } else if (activity.action === 'hinted' && existing.status === 'planted') {
          await this.worldModelService.updateForeshadowing(existing.id, {
            status: 'hinted',
          });
        }
      } else if (activity.action === 'planted') {
        await this.worldModelService.addForeshadowing({
          title: activity.title,
          content: activity.details,
          type: 'other',
          status: 'planted',
          importance: 'minor',
          plantedAt: {
            description: `第${summary.chapterNumber}章`,
          },
        });
      }
    }
  }

  getSummary(chapterNumber: number): ChapterSummary | undefined {
    return Array.from(this.summaries.values()).find((s) => s.chapterNumber === chapterNumber);
  }

  getAllSummaries(): ChapterSummary[] {
    return Array.from(this.summaries.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  getSummariesRange(start: number, end: number): ChapterSummary[] {
    return this.getAllSummaries().filter((s) => s.chapterNumber >= start && s.chapterNumber <= end);
  }

  async updateSummary(chapterNumber: number, updates: Partial<ChapterSummary>): Promise<boolean> {
    const summary = this.getSummary(chapterNumber);
    if (!summary) return false;

    Object.assign(summary, updates, { updatedAt: Date.now() });
    await this.saveSummaries();
    return true;
  }

  async deleteSummary(chapterNumber: number): Promise<boolean> {
    const summary = this.getSummary(chapterNumber);
    if (!summary) return false;

    this.summaries.delete(summary.id);
    await this.saveSummaries();
    return true;
  }

  getContextForChapter(chapterNumber: number, range: number = 3): string {
    const summaries = this.getSummariesRange(Math.max(1, chapterNumber - range), chapterNumber - 1);

    if (summaries.length === 0) return '';

    const parts: string[] = ['## 前情提要\n'];

    for (const s of summaries) {
      parts.push(`### 第${s.chapterNumber}章：${s.title}`);
      parts.push(s.summary);
      parts.push('');

      if (s.keyEvents.length > 0) {
        const majorEvents = s.keyEvents.filter((e) => e.significance === 'major');
        if (majorEvents.length > 0) {
          parts.push('关键事件：');
          for (const e of majorEvents) {
            parts.push(`- ${e.description}`);
          }
          parts.push('');
        }
      }
    }

    return parts.join('\n');
  }

  getCharacterArcAcrossChapters(characterName: string): {
    appearances: Array<{ chapter: number; development: string }>;
    emotionalJourney: string[];
  } {
    const appearances: Array<{ chapter: number; development: string }> = [];
    const emotionalJourney: string[] = [];

    for (const summary of this.getAllSummaries()) {
      const appearance = summary.characterAppearances.find(
        (a) => a.characterName === characterName
      );
      if (appearance) {
        appearances.push({
          chapter: summary.chapterNumber,
          development: appearance.development,
        });
        if (appearance.emotionalState) {
          emotionalJourney.push(`第${summary.chapterNumber}章: ${appearance.emotionalState}`);
        }
      }
    }

    return { appearances, emotionalJourney };
  }

  getForeshadowingTimeline(): Array<{
    chapter: number;
    activities: ForeshadowingActivity[];
  }> {
    const timeline: Array<{ chapter: number; activities: ForeshadowingActivity[] }> = [];

    for (const summary of this.getAllSummaries()) {
      if (summary.foreshadowingActivity.length > 0) {
        timeline.push({
          chapter: summary.chapterNumber,
          activities: summary.foreshadowingActivity,
        });
      }
    }

    return timeline;
  }

  async generateBatchSummaries(
    chapters: Array<{ number: number; content: string; title?: string }>,
    options?: Partial<SummaryOptions>
  ): Promise<ChapterSummary[]> {
    const results: ChapterSummary[] = [];

    for (const chapter of chapters) {
      try {
        const summary = await this.generateSummary(
          chapter.number,
          chapter.content,
          chapter.title,
          options
        );
        results.push(summary);
      } catch (error) {
        logger.error(`生成第${chapter.number}章摘要失败`, { error: String(error) });
      }
    }

    return results;
  }

  async exportSummaries(): Promise<string> {
    return JSON.stringify(
      {
        summaries: this.getAllSummaries(),
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }
}

export function createChapterSummaryService(projectPath: string): ChapterSummaryService {
  return new ChapterSummaryService(projectPath);
}
