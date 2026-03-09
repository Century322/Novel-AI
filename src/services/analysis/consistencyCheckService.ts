import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';
import type { ChapterSummaryService } from '../memory/chapterSummaryService';
import type { Foreshadowing } from '@/types/plot/foreshadowing';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueType =
  | 'character_inconsistency'
  | 'timeline_conflict'
  | 'foreshadowing_unresolved'
  | 'setting_contradiction'
  | 'plot_hole'
  | 'style_inconsistency'
  | 'pacing_issue'
  | 'dialogue_issue';

export interface ConsistencyIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  location: {
    chapter?: number;
    character?: string;
    event?: string;
  };
  evidence: string[];
  suggestion: string;
  autoFixAvailable: boolean;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  checkedAt?: number;
  checkedRange?: {
    startChapter: number;
    endChapter: number;
  };
}

export interface CharacterConsistencyCheck {
  characterId: string;
  characterName: string;
  appearances: Array<{
    chapter: number;
    description: string;
    traits: string[];
    emotionalState?: string;
  }>;
  inconsistencies: Array<{
    type: 'trait' | 'behavior' | 'relationship' | 'ability';
    description: string;
    chapters: number[];
  }>;
}

const CONSISTENCY_CHECK_PROMPT = `你是一个专业的小说一致性检查专家。检查以下内容是否存在一致性问题。

检查类型：
1. 人物一致性：性格、外貌、能力、关系是否前后一致
2. 时间线一致性：事件顺序是否合理，时间跨度是否正确
3. 伏笔一致性：伏笔是否被遗忘或矛盾
4. 设定一致性：世界观规则是否被违反
5. 情节连贯性：是否有逻辑漏洞或矛盾

输出 JSON 格式：
{
  "issues": [
    {
      "type": "character_inconsistency/timeline_conflict/...",
      "severity": "critical/high/medium/low",
      "description": "问题描述",
      "location": { "chapter": 1, "character": "人物名" },
      "evidence": ["证据1", "证据2"],
      "suggestion": "修复建议",
      "autoFixAvailable": false
    }
  ]
}`;

export class ConsistencyCheckService {
  private worldModelService: WorldModelService | null = null;
  private chapterSummaryService: ChapterSummaryService | null = null;

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setChapterSummaryService(service: ChapterSummaryService): void {
    this.chapterSummaryService = service;
  }

  async checkContent(content: string, chapterNumber?: number): Promise<ConsistencyReport> {
    const context = await this.buildCheckContext(content, chapterNumber);

    const prompt = `${CONSISTENCY_CHECK_PROMPT}

待检查内容：
${content.substring(0, 4000)}

上下文信息：
${context}

请检查一致性问题。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 2048,
      });

      const responseContent = response.content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createEmptyReport();
      }

      const result = JSON.parse(jsonMatch[0]);
      const issues: ConsistencyIssue[] = (result.issues || []).map(
        (i: Record<string, unknown>) => ({
          id: `issue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: i.type as IssueType,
          severity: i.severity as IssueSeverity,
          description: String(i.description),
          location: (i.location as ConsistencyIssue['location']) || {},
          evidence: (i.evidence as string[]) || [],
          suggestion: String(i.suggestion || ''),
          autoFixAvailable: Boolean(i.autoFixAvailable),
        })
      );

      return this.createReport(issues, chapterNumber);
    } catch (error) {
      logger.error('一致性检查失败', { error: String(error) });
      return this.createEmptyReport();
    }
  }

  async checkCharacterConsistency(
    characterName: string
  ): Promise<CharacterConsistencyCheck | null> {
    if (!this.worldModelService || !this.chapterSummaryService) {
      return null;
    }

    const characters = this.worldModelService.getCharacters();
    const character = characters.find((c) => c.name === characterName);
    if (!character) return null;

    const summaries = this.chapterSummaryService.getAllSummaries();
    const appearances: CharacterConsistencyCheck['appearances'] = [];

    for (const summary of summaries) {
      const appearance = summary.characterAppearances.find(
        (a) => a.characterName === characterName
      );
      if (appearance) {
        appearances.push({
          chapter: summary.chapterNumber,
          description: appearance.development,
          traits: appearance.actions,
          emotionalState: appearance.emotionalState,
        });
      }
    }

    const inconsistencies: CharacterConsistencyCheck['inconsistencies'] = [];

    if (appearances.length > 1) {
      for (let i = 1; i < appearances.length; i++) {
        const prev = appearances[i - 1];
        const curr = appearances[i];

        if (
          prev.emotionalState &&
          curr.emotionalState &&
          this.areOppositeEmotions(prev.emotionalState, curr.emotionalState)
        ) {
          inconsistencies.push({
            type: 'behavior',
            description: `情感状态从"${prev.emotionalState}"突然变为"${curr.emotionalState}"，可能缺乏过渡`,
            chapters: [prev.chapter, curr.chapter],
          });
        }
      }
    }

    return {
      characterId: character.id,
      characterName: character.name,
      appearances,
      inconsistencies,
    };
  }

  private areOppositeEmotions(emotion1: string, emotion2: string): boolean {
    const opposites: Array<[string, string]> = [
      ['开心', '悲伤'],
      ['愤怒', '平静'],
      ['紧张', '放松'],
      ['兴奋', '沮丧'],
      ['happy', 'sad'],
      ['angry', 'calm'],
    ];

    const e1 = emotion1.toLowerCase();
    const e2 = emotion2.toLowerCase();

    for (const [a, b] of opposites) {
      if ((e1.includes(a) && e2.includes(b)) || (e1.includes(b) && e2.includes(a))) {
        return true;
      }
    }
    return false;
  }

  async checkTimelineConsistency(): Promise<ConsistencyIssue[]> {
    if (!this.worldModelService) return [];

    const issues: ConsistencyIssue[] = [];
    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) return issues;

    const events = worldModel.timeline.events;

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];

      const prevTime = this.calculateTimeValue(prev.storyTime);
      const currTime = this.calculateTimeValue(curr.storyTime);

      if (prevTime !== null && currTime !== null && prevTime > currTime) {
        issues.push({
          id: `timeline_${i}_${Date.now()}`,
          type: 'timeline_conflict',
          severity: 'high',
          description: `事件"${curr.title}"的时间早于"${prev.title}"，但顺序相反`,
          location: { event: curr.title },
          evidence: [
            `"${prev.title}" 时间: ${prev.storyTime.display}`,
            `"${curr.title}" 时间: ${curr.storyTime.display}`,
          ],
          suggestion: '调整事件顺序或时间设定',
          autoFixAvailable: false,
        });
      }
    }

    return issues;
  }

  async checkForeshadowingConsistency(): Promise<ConsistencyIssue[]> {
    if (!this.worldModelService) return [];

    const issues: ConsistencyIssue[] = [];
    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) return issues;

    const unresolvedForeshadows = worldModel.foreshadowing.items.filter(
      (f: Foreshadowing) => f.status === 'planted' || f.status === 'hinted'
    );

    for (const f of unresolvedForeshadows) {
      if (f.importance === 'major') {
        const plantedChapter = f.plantedAt.description;
        issues.push({
          id: `foreshadow_${f.id}`,
          type: 'foreshadowing_unresolved',
          severity: 'medium',
          description: `重要伏笔"${f.title}"尚未回收`,
          location: { event: f.title },
          evidence: [`埋设位置: ${plantedChapter}`, `内容: ${f.content}`],
          suggestion: f.plannedResolution.description || '考虑在后续章节回收此伏笔',
          autoFixAvailable: false,
        });
      }
    }

    return issues;
  }

  async runFullCheck(startChapter?: number, endChapter?: number): Promise<ConsistencyReport> {
    const allIssues: ConsistencyIssue[] = [];

    const timelineIssues = await this.checkTimelineConsistency();
    allIssues.push(...timelineIssues);

    const foreshadowIssues = await this.checkForeshadowingConsistency();
    allIssues.push(...foreshadowIssues);

    if (this.worldModelService) {
      const characters = this.worldModelService.getCharacters();
      for (const char of characters.slice(0, 5)) {
        const charCheck = await this.checkCharacterConsistency(char.name);
        if (charCheck && charCheck.inconsistencies.length > 0) {
          for (const inc of charCheck.inconsistencies) {
            allIssues.push({
              id: `char_${char.id}_${Date.now()}`,
              type: 'character_inconsistency',
              severity: 'medium',
              description: `${char.name}: ${inc.description}`,
              location: { character: char.name, chapter: inc.chapters[0] },
              evidence: [],
              suggestion: '检查人物行为是否合理',
              autoFixAvailable: false,
            });
          }
        }
      }
    }

    return this.createReport(allIssues, undefined, startChapter, endChapter);
  }

  private async buildCheckContext(_content: string, chapterNumber?: number): Promise<string> {
    const parts: string[] = [];

    if (this.worldModelService) {
      const worldModel = this.worldModelService.getWorldModel();
      if (worldModel) {
        parts.push('## 已知人物设定');
        for (const char of worldModel.characters.items.slice(0, 5)) {
          parts.push(`- ${char.name}（${char.role}）: ${char.notes || '暂无描述'}`);
        }

        parts.push('\n## 世界观规则');
        for (const rule of worldModel.worldbuilding.rules.slice(0, 3)) {
          parts.push(`- ${rule.name}: ${rule.description}`);
        }
      }
    }

    if (this.chapterSummaryService && chapterNumber && chapterNumber > 1) {
      const prevSummary = this.chapterSummaryService.getSummary(chapterNumber - 1);
      if (prevSummary) {
        parts.push('\n## 上一章摘要');
        parts.push(prevSummary.summary);
      }
    }

    return parts.join('\n');
  }

  private createReport(
    issues: ConsistencyIssue[],
    chapterNumber?: number,
    startChapter?: number,
    endChapter?: number
  ): ConsistencyReport {
    return {
      issues,
      summary: {
        total: issues.length,
        critical: issues.filter((i) => i.severity === 'critical').length,
        high: issues.filter((i) => i.severity === 'high').length,
        medium: issues.filter((i) => i.severity === 'medium').length,
        low: issues.filter((i) => i.severity === 'low').length,
      },
      checkedAt: Date.now(),
      checkedRange:
        startChapter && endChapter
          ? { startChapter, endChapter }
          : chapterNumber
            ? { startChapter: chapterNumber, endChapter: chapterNumber }
            : undefined,
    };
  }

  private createEmptyReport(): ConsistencyReport {
    return {
      issues: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    };
  }

  private calculateTimeValue(storyTime: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    display: string;
  }): number | null {
    if (storyTime.year === undefined) return null;
    return (
      storyTime.year * 1000000 +
      (storyTime.month || 1) * 10000 +
      (storyTime.day || 1) * 100 +
      (storyTime.hour || 0)
    );
  }

  async generateFixSuggestion(issue: ConsistencyIssue): Promise<string> {
    const prompt = `你是一个专业的小说编辑。针对以下一致性问题，提供详细的修复建议。

问题类型：${issue.type}
严重程度：${issue.severity}
问题描述：${issue.description}
证据：${issue.evidence.join('；')}

请提供：
1. 问题分析
2. 修复方案（至少2个选项）
3. 修复后的效果`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 1024,
      });

      return response.content || issue.suggestion;
    } catch (error) {
      logger.error('生成修复建议失败', { error: String(error) });
      return issue.suggestion;
    }
  }
}

export const consistencyCheckService = new ConsistencyCheckService();
