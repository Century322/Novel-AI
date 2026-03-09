import { workshopService } from '../core/workshopService';
import { MemoryService } from '../knowledge/memoryService';
import { QualityService } from '../analysis/qualityService';
import { OptimizationSuggestion, SuggestionType, IssueLocation } from '@/types/writing/quality';
import { logger } from '../core/loggerService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class OptimizationService {
  private projectPath: string;
  private memoryService: MemoryService;
  private suggestions: Map<string, OptimizationSuggestion> = new Map();

  constructor(projectPath: string, memoryService: MemoryService, _qualityService: QualityService) {
    this.projectPath = projectPath;
    this.memoryService = memoryService;
  }

  async initialize(): Promise<void> {
    await this.loadSuggestions();
  }

  private async loadSuggestions(): Promise<void> {
    const suggestionPath = `${this.projectPath}/.ai-workshop/optimization/suggestions.json`;

    if (await workshopService.pathExists(suggestionPath)) {
      try {
        const content = await workshopService.readFile(suggestionPath);
        const data = JSON.parse(content);

        for (const suggestion of data.suggestions || []) {
          this.suggestions.set(suggestion.id, suggestion);
        }
      } catch (error) {
        logger.error('加载优化建议失败', { error });
      }
    }
  }

  private async saveSuggestions(): Promise<void> {
    const suggestionPath = `${this.projectPath}/.ai-workshop/optimization/suggestions.json`;
    const data = {
      suggestions: Array.from(this.suggestions.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(suggestionPath, JSON.stringify(data, null, 2));
  }

  async analyzeAndSuggest(content: string, filePath?: string): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    suggestions.push(...(await this.checkConsistency(content, filePath)));
    suggestions.push(...(await this.checkPlotImprovements(content, filePath)));
    suggestions.push(...(await this.checkCharacterDevelopment(content, filePath)));
    suggestions.push(...(await this.checkStyleEnhancements(content, filePath)));
    suggestions.push(...(await this.checkPacingAdjustments(content, filePath)));
    suggestions.push(...(await this.checkForeshadowingSetup(content, filePath)));

    for (const suggestion of suggestions) {
      this.suggestions.set(suggestion.id, suggestion);
    }

    await this.saveSuggestions();
    return suggestions;
  }

  private async checkConsistency(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const characters = this.memoryService.getCharacters();

    for (const char of characters) {
      const charPattern = new RegExp(char.name, 'g');
      const mentions = content.match(charPattern) || [];

      if (mentions.length > 0) {
        for (const trait of char.traits) {
          const traitPattern = new RegExp(trait, 'g');
          if (!content.match(traitPattern)) {
            const location = this.findCharacterContext(content, char.name);

            suggestions.push({
              id: generateId(),
              type: 'consistency_fix',
              priority: 'medium',
              title: `${char.name} 的特质一致性`,
              description: `${char.name}在本文中出现，但未体现其"${trait}"特质`,
              affectedContent: filePath ? [filePath] : [],
              proposedChanges: [
                {
                  location,
                  original: content.substring(location.start, location.end),
                  suggested: `建议在此处体现${char.name}的"${trait}"特质`,
                  reason: '保持人物特质一致性',
                },
              ],
              rationale: '人物特质的一致性是塑造立体角色的关键',
              status: 'pending',
            });
          }
        }
      }
    }

    return suggestions;
  }

  private findCharacterContext(content: string, charName: string): IssueLocation {
    const pattern = new RegExp(`${charName}[^。！？]{0,100}`, 'g');
    const match = content.match(pattern);

    if (match && match[0]) {
      const index = content.indexOf(match[0]);
      return {
        start: index,
        end: index + match[0].length,
        context: match[0],
      };
    }

    return {
      start: 0,
      end: 50,
      context: content.substring(0, 50),
    };
  }

  private async checkPlotImprovements(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const avgLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / Math.max(sentences.length, 1);

    if (avgLength < 15) {
      suggestions.push({
        id: generateId(),
        type: 'plot_improvement',
        priority: 'low',
        title: '增加情节细节',
        description: '当前文本句子较短，可能缺乏细节描写',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: [
          {
            location: { start: 0, end: 0, context: '' },
            original: '',
            suggested: '考虑在关键情节处增加环境描写、心理活动或动作细节',
            reason: '丰富情节细节可以增强读者的沉浸感',
          },
        ],
        rationale: '细节描写是小说创作的重要元素',
        status: 'pending',
      });
    }

    const turningPoints = content.match(/但是|然而|却|突然|终于/g) || [];
    if (turningPoints.length < content.length / 500) {
      suggestions.push({
        id: generateId(),
        type: 'plot_improvement',
        priority: 'low',
        title: '增加情节转折',
        description: '当前文本转折点较少，情节可能较为平淡',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: [
          {
            location: { start: 0, end: 0, context: '' },
            original: '',
            suggested: '考虑在适当位置增加情节转折或冲突',
            reason: '情节转折可以增加故事的吸引力',
          },
        ],
        rationale: '适当的情节转折能保持读者的阅读兴趣',
        status: 'pending',
      });
    }

    return suggestions;
  }

  private async checkCharacterDevelopment(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const characters = this.memoryService.getCharacters();

    const dialoguePattern = /[""「」『』]([^""「」『』]+)[""「」『』]/g;
    const dialogues = content.match(dialoguePattern) || [];

    for (const char of characters) {
      if (char.role === 'protagonist' || char.role === 'antagonist') {
        const charDialoguePattern = new RegExp(
          `${char.name}[^。！？]{0,30}[""「」『』]([^""「」『』]+)[""「」『』]`,
          'g'
        );
        const charDialogues = content.match(charDialoguePattern) || [];

        if (dialogues.length > 5 && charDialogues.length === 0) {
          suggestions.push({
            id: generateId(),
            type: 'character_development',
            priority: 'medium',
            title: `${char.name} 缺少对话`,
            description: `主要角色${char.name}在本文中没有对话，可能影响角色塑造`,
            affectedContent: filePath ? [filePath] : [],
            proposedChanges: [
              {
                location: { start: 0, end: 0, context: '' },
                original: '',
                suggested: `考虑为${char.name}添加对话或内心独白`,
                reason: '对话是展现角色性格的重要手段',
              },
            ],
            rationale: '主要角色应该有足够的对话来展现其性格',
            status: 'pending',
          });
        }
      }
    }

    return suggestions;
  }

  private async checkStyleEnhancements(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    const metaphors = content.match(/像|如同|仿佛|好似|宛如/g) || [];
    const metaphorDensity = metaphors.length / (content.length / 100);

    if (metaphorDensity < 0.3) {
      suggestions.push({
        id: generateId(),
        type: 'style_enhancement',
        priority: 'low',
        title: '增加修辞手法',
        description: '当前文本比喻等修辞手法使用较少',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: [
          {
            location: { start: 0, end: 0, context: '' },
            original: '',
            suggested: '考虑在描写处添加比喻、拟人等修辞手法',
            reason: '修辞手法可以增强文本的表现力',
          },
        ],
        rationale: '适当的修辞手法能让文字更加生动',
        status: 'pending',
      });
    }

    const repeatedPhrases = this.findRepeatedPhrases(content);
    if (repeatedPhrases.length > 0) {
      suggestions.push({
        id: generateId(),
        type: 'style_enhancement',
        priority: 'medium',
        title: '避免重复表达',
        description: `发现重复使用的表达: ${repeatedPhrases.slice(0, 3).join(', ')}`,
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: repeatedPhrases.slice(0, 3).map((phrase) => ({
          location: this.findPhraseLocation(content, phrase),
          original: phrase,
          suggested: '使用同义表达或重新组织句子',
          reason: '避免重复表达提高文字质量',
        })),
        rationale: '重复表达会让读者感到单调',
        status: 'pending',
      });
    }

    return suggestions;
  }

  private findRepeatedPhrases(content: string): string[] {
    const phrases: Map<string, number> = new Map();
    const fourCharPhrases = content.match(/[\u4e00-\u9fa5]{4,8}/g) || [];

    for (const phrase of fourCharPhrases) {
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }

    return Array.from(phrases.entries())
      .filter(([_, count]) => count > 2)
      .map(([phrase]) => phrase);
  }

  private findPhraseLocation(content: string, phrase: string): IssueLocation {
    const index = content.indexOf(phrase);
    return {
      start: Math.max(0, index),
      end: Math.min(content.length, index + phrase.length),
      context: content.substring(
        Math.max(0, index - 20),
        Math.min(content.length, index + phrase.length + 20)
      ),
    };
  }

  private async checkPacingAdjustments(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    const paragraphs = content.split(/\n\n+/);
    const paragraphLengths = paragraphs.map((p) => p.length);
    const avgLength = paragraphLengths.reduce((a, b) => a + b, 0) / Math.max(paragraphs.length, 1);
    const variance =
      paragraphLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      Math.max(paragraphs.length, 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev < 30) {
      suggestions.push({
        id: generateId(),
        type: 'pacing_adjustment',
        priority: 'low',
        title: '调整段落节奏',
        description: '段落长度过于均匀，可能影响阅读节奏',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: [
          {
            location: { start: 0, end: 0, context: '' },
            original: '',
            suggested: '在关键情节处使用短段落加快节奏，在描写处使用长段落放慢节奏',
            reason: '段落长度变化可以控制阅读节奏',
          },
        ],
        rationale: '合理的段落节奏能增强阅读体验',
        status: 'pending',
      });
    }

    const dialogue = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
    const dialogueRatio = dialogue.reduce((sum, d) => sum + d.length, 0) / content.length;

    if (dialogueRatio > 0.6) {
      suggestions.push({
        id: generateId(),
        type: 'pacing_adjustment',
        priority: 'medium',
        title: '平衡对话与叙述',
        description: '对话比例过高，可能缺少必要的叙述描写',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: [
          {
            location: { start: 0, end: 0, context: '' },
            original: '',
            suggested: '适当增加环境描写、心理活动或动作描写',
            reason: '平衡对话与叙述可以丰富文本层次',
          },
        ],
        rationale: '对话与叙述的平衡是小说创作的基本要求',
        status: 'pending',
      });
    }

    return suggestions;
  }

  private async checkForeshadowingSetup(
    content: string,
    filePath?: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const foreshadows = this.memoryService.getForeshadowing('planted');

    for (const foreshadow of foreshadows) {
      const foreshadowPattern = new RegExp(foreshadow.content.substring(0, 10), 'g');
      const mentions = content.match(foreshadowPattern) || [];

      if (mentions.length > 0) {
        suggestions.push({
          id: generateId(),
          type: 'foreshadowing_setup',
          priority: 'high',
          title: `伏笔提示: ${foreshadow.content.substring(0, 20)}...`,
          description: '已埋设的伏笔在本文中被提及，考虑是否需要回应或推进',
          affectedContent: filePath ? [filePath] : [],
          proposedChanges: [
            {
              location: { start: 0, end: 0, context: '' },
              original: '',
              suggested: `考虑在此处回应伏笔: ${foreshadow.content}`,
              reason: '伏笔的回应能增强故事的完整性',
            },
          ],
          rationale: `该伏笔埋设于: ${foreshadow.plantedAt}`,
          status: 'pending',
        });
      }
    }

    const potentialForeshadows = this.detectPotentialForeshadowing(content);
    if (potentialForeshadows.length > 0) {
      suggestions.push({
        id: generateId(),
        type: 'foreshadowing_setup',
        priority: 'low',
        title: '潜在伏笔建议',
        description: '检测到可能适合埋设伏笔的内容',
        affectedContent: filePath ? [filePath] : [],
        proposedChanges: potentialForeshadows.slice(0, 3).map((pf) => ({
          location: pf.location,
          original: pf.content,
          suggested: '考虑在此处埋设伏笔，在后续章节回应',
          reason: '伏笔可以增加故事的深度和连贯性',
        })),
        rationale: '良好的伏笔设置能提升读者的阅读体验',
        status: 'pending',
      });
    }

    return suggestions;
  }

  private detectPotentialForeshadowing(
    content: string
  ): Array<{ content: string; location: IssueLocation }> {
    const potentials: Array<{ content: string; location: IssueLocation }> = [];

    const patterns = [/不知为何[^。！？]+/, /似乎[^。！？]+/, /隐约[^。！？]+/, /莫名[^。！？]+/];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined && match[0].length > 5) {
          potentials.push({
            content: match[0],
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: match[0],
            },
          });
        }
      }
    }

    return potentials;
  }

  getSuggestion(suggestionId: string): OptimizationSuggestion | undefined {
    return this.suggestions.get(suggestionId);
  }

  getPendingSuggestions(): OptimizationSuggestion[] {
    return Array.from(this.suggestions.values())
      .filter((s) => s.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  getAllSuggestions(): OptimizationSuggestion[] {
    return Array.from(this.suggestions.values()).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return false;
    }

    suggestion.status = 'accepted';
    await this.saveSuggestions();
    return true;
  }

  async rejectSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return false;
    }

    suggestion.status = 'rejected';
    await this.saveSuggestions();
    return true;
  }

  async applySuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion) {
      return false;
    }

    suggestion.status = 'applied';
    await this.saveSuggestions();
    return true;
  }

  async dismissAllSuggestions(): Promise<void> {
    for (const suggestion of this.suggestions.values()) {
      if (suggestion.status === 'pending') {
        suggestion.status = 'rejected';
      }
    }
    await this.saveSuggestions();
  }

  getSuggestionsByType(type: SuggestionType): OptimizationSuggestion[] {
    return Array.from(this.suggestions.values())
      .filter((s) => s.type === type)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  getSuggestionStats(): {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    applied: number;
    byType: Record<SuggestionType, number>;
    byPriority: Record<string, number>;
  } {
    const stats = {
      total: this.suggestions.size,
      pending: 0,
      accepted: 0,
      rejected: 0,
      applied: 0,
      byType: {} as Record<SuggestionType, number>,
      byPriority: { high: 0, medium: 0, low: 0 },
    };

    for (const suggestion of this.suggestions.values()) {
      stats[suggestion.status]++;
      stats.byType[suggestion.type] = (stats.byType[suggestion.type] || 0) + 1;
      stats.byPriority[suggestion.priority]++;
    }

    return stats;
  }
}

export function createOptimizationService(
  projectPath: string,
  memoryService: MemoryService,
  qualityService: QualityService
): OptimizationService {
  return new OptimizationService(projectPath, memoryService, qualityService);
}
