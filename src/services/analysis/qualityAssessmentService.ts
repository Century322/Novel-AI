import {
  QualityAssessment,
  QualityScore,
  QualityIssue,
  QualityRecommendation,
  QualityHistory,
  QualityDimension,
  QualityLevel,
  AssessmentType,
  QUALITY_DIMENSION_LABELS,
  QUALITY_LEVEL_LABELS,
  DIMENSION_WEIGHTS,
  DIMENSION_DESCRIPTIONS,
} from '@/types/writing/qualityAssessment';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class QualityAssessmentService {
  private projectPath: string;
  private assessments: Map<string, QualityAssessment> = new Map();
  private history: QualityHistory[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const assessmentsPath = `${this.projectPath}/设定/质量评估/评估记录.json`;
      const historyPath = `${this.projectPath}/设定/质量评估/历史记录.json`;

      const assessmentsContent = await workshopService.readFile(assessmentsPath);
      if (assessmentsContent) {
        const data: QualityAssessment[] = JSON.parse(assessmentsContent);
        this.assessments = new Map(data.map((a) => [a.id, a]));
      }

      const historyContent = await workshopService.readFile(historyPath);
      if (historyContent) {
        this.history = JSON.parse(historyContent);
      }
    } catch (error) {
      logger.error('加载质量评估数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/质量评估`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/评估记录.json`,
        JSON.stringify(Array.from(this.assessments.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/历史记录.json`,
        JSON.stringify(this.history, null, 2)
      );
    } catch (error) {
      logger.error('保存质量评估数据失败', { error });
    }
  }

  async assessContent(
    content: string,
    type: AssessmentType,
    targetId: string,
    targetName: string
  ): Promise<QualityAssessment> {
    const dimensionScores = await this.assessAllDimensions(content);

    const overallScore = this.calculateOverallScore(dimensionScores);
    const overallLevel = this.determineQualityLevel(overallScore);

    const summary = this.generateSummary(dimensionScores, overallScore);
    const highlights = this.extractHighlights(content, dimensionScores);
    const issues = this.identifyIssues(content, dimensionScores);
    const recommendations = this.generateRecommendations(dimensionScores, issues);

    const comparison = await this.getComparison(targetId, overallScore, dimensionScores);

    const assessment: QualityAssessment = {
      id: `assessment_${uuidv4()}`,
      type,
      targetId,
      targetName,
      overallScore,
      overallLevel,
      dimensionScores,
      summary,
      highlights,
      issues,
      comparison,
      recommendations,
      assessedAt: Date.now(),
      assessedBy: 'hybrid',
    };

    this.assessments.set(assessment.id, assessment);

    this.history.push({
      assessmentId: assessment.id,
      targetId,
      overallScore,
      dimensionScores: dimensionScores.reduce(
        (acc, s) => {
          acc[s.dimension] = s.score;
          return acc;
        },
        {} as Record<QualityDimension, number>
      ),
      assessedAt: assessment.assessedAt,
    });

    await this.saveToDisk();
    return assessment;
  }

  private async assessAllDimensions(content: string): Promise<QualityScore[]> {
    const dimensions: QualityDimension[] = [
      'plot',
      'character',
      'dialogue',
      'description',
      'emotion',
      'pacing',
      'style',
      'logic',
      'originality',
      'readability',
    ];

    const scores: QualityScore[] = [];

    for (const dimension of dimensions) {
      const score = await this.assessDimension(content, dimension);
      scores.push(score);
    }

    return scores;
  }

  private async assessDimension(
    content: string,
    dimension: QualityDimension
  ): Promise<QualityScore> {
    const ruleScore = this.ruleBasedAssessment(content, dimension);
    const aiScore = await this.aiBasedAssessment(content, dimension);

    const finalScore = Math.round(ruleScore * 0.4 + aiScore * 0.6);
    const level = this.determineQualityLevel(finalScore);

    const { strengths, weaknesses, details } = this.analyzeDimension(
      content,
      dimension,
      finalScore
    );

    return {
      dimension,
      score: finalScore,
      level,
      weight: DIMENSION_WEIGHTS[dimension],
      details,
      strengths,
      weaknesses,
    };
  }

  private ruleBasedAssessment(content: string, dimension: QualityDimension): number {
    switch (dimension) {
      case 'plot':
        return this.assessPlotRules(content);
      case 'character':
        return this.assessCharacterRules(content);
      case 'dialogue':
        return this.assessDialogueRules(content);
      case 'description':
        return this.assessDescriptionRules(content);
      case 'emotion':
        return this.assessEmotionRules(content);
      case 'pacing':
        return this.assessPacingRules(content);
      case 'style':
        return this.assessStyleRules(content);
      case 'logic':
        return this.assessLogicRules(content);
      case 'originality':
        return this.assessOriginalityRules(content);
      case 'readability':
        return this.assessReadabilityRules(content);
      default:
        return 60;
    }
  }

  private assessPlotRules(content: string): number {
    let score = 60;

    const hasConflict = /[冲突|矛盾|危机|挑战|困难]/.test(content);
    if (hasConflict) {
      score += 10;
    }

    const hasResolution = /[解决|化解|克服|战胜]/.test(content);
    if (hasResolution) {
      score += 5;
    }

    const paragraphs = content.split('\n\n').filter((p) => p.trim());
    if (paragraphs.length >= 3) {
      score += 5;
    }

    const hasTransition = /[于是|随后|接着|然而|但是|因此]/.test(content);
    if (hasTransition) {
      score += 5;
    }

    const eventDensity = this.countEvents(content);
    if (eventDensity >= 3 && eventDensity <= 10) {
      score += 10;
    } else if (eventDensity > 10) {
      score -= 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessCharacterRules(content: string): number {
    let score = 60;

    const hasDialogue = /["「『][^"」』]+["」』]/.test(content);
    if (hasDialogue) {
      score += 10;
    }

    const hasAction = /[走|跑|站|坐|看|说|笑|哭|转身|抬头|低头]/.test(content);
    if (hasAction) {
      score += 5;
    }

    const hasInnerThought = /[心想|心中|内心|觉得|感到]/.test(content);
    if (hasInnerThought) {
      score += 10;
    }

    const hasAppearance = /[脸|眼|手|身|穿着|相貌]/.test(content);
    if (hasAppearance) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessDialogueRules(content: string): number {
    let score = 60;

    const dialogues = content.match(/["「『][^"」』]+["」』]/g) || [];
    if (dialogues.length === 0) {
      return 50;
    }

    const avgLength = dialogues.reduce((sum, d) => sum + d.length, 0) / dialogues.length;
    if (avgLength >= 5 && avgLength <= 50) {
      score += 15;
    } else if (avgLength > 50) {
      score -= 5;
    }

    const hasDialogueTags = /[说|道|问|答|喊|叫|低声|轻声]/.test(content);
    if (hasDialogueTags) {
      score += 5;
    }

    const hasActionWithDialogue = dialogues.some((d) => {
      const index = content.indexOf(d);
      const context = content.substring(Math.max(0, index - 20), index + d.length + 20);
      return /[动作|神态|表情]/.test(context);
    });
    if (hasActionWithDialogue) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessDescriptionRules(content: string): number {
    let score = 60;

    const hasSensory = /[看|听|闻|触|尝|视觉|听觉|嗅觉|触觉|味觉]/.test(content);
    if (hasSensory) {
      score += 10;
    }

    const hasMetaphor = /[像|似|如|若|仿佛|宛如]/.test(content);
    if (hasMetaphor) {
      score += 10;
    }

    const hasDetail = content.length > 500 && (content.match(/[，]/g) || []).length > 10;
    if (hasDetail) {
      score += 5;
    }

    const descriptionRatio = this.calculateDescriptionRatio(content);
    if (descriptionRatio >= 0.2 && descriptionRatio <= 0.5) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessEmotionRules(content: string): number {
    let score = 60;

    const emotionKeywords = ['喜', '怒', '哀', '乐', '悲', '恐', '惊', '爱', '恨'];
    let emotionCount = 0;
    for (const keyword of emotionKeywords) {
      const regex = new RegExp(keyword, 'g');
      const matches = content.match(regex);
      if (matches) {
        emotionCount += matches.length;
      }
    }

    if (emotionCount >= 3 && emotionCount <= 15) {
      score += 15;
    } else if (emotionCount > 15) {
      score -= 5;
    }

    const hasPhysicalEmotion = /[心跳|颤抖|泪水|笑容|愤怒|悲伤]/.test(content);
    if (hasPhysicalEmotion) {
      score += 10;
    }

    const hasShowDontTell = !/(非常|很|十分|极其)(开心|难过|生气|害怕)/.test(content);
    if (hasShowDontTell) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessPacingRules(content: string): number {
    let score = 60;

    const sentences = content.split(/[。！？\n]/).filter((s) => s.trim());
    if (sentences.length < 3) {
      return 50;
    }

    const lengths = sentences.map((s) => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;

    if (variance >= 50 && variance <= 500) {
      score += 15;
    } else if (variance < 50) {
      score -= 5;
    }

    const paragraphCount = content.split('\n\n').filter((p) => p.trim()).length;
    if (paragraphCount >= 3 && paragraphCount <= 10) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessStyleRules(content: string): number {
    let score = 60;

    const hasLiterary = /[意境|氛围|韵味|格调]/.test(content);
    if (hasLiterary) {
      score += 10;
    }

    const sentences = content.split(/[。！？\n]/).filter((s) => s.trim());
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
      score += 10;
    }

    const hasRepetition = this.checkRepetition(content);
    if (!hasRepetition) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessLogicRules(content: string): number {
    let score = 70;

    const hasCausality = /[因为|所以|由于|因此|导致|结果]/.test(content);
    if (hasCausality) {
      score += 10;
    }

    const hasContradiction = this.checkContradiction(content);
    if (hasContradiction) {
      score -= 20;
    }

    const hasConsistency = !/(突然|忽然|莫名其妙|不知为何)[^。]{0,20}(出现|发生|变成)/.test(
      content
    );
    if (hasConsistency) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessOriginalityRules(content: string): number {
    let score = 60;

    const commonPhrases = ['突然', '忽然', '不知为何', '莫名其妙', '就在这时', '就在此刻'];
    let commonCount = 0;
    for (const phrase of commonPhrases) {
      if (content.includes(phrase)) {
        commonCount++;
      }
    }

    score -= commonCount * 3;

    const uniqueExpressions = this.countUniqueExpressions(content);
    score += Math.min(20, uniqueExpressions * 2);

    return Math.min(100, Math.max(0, score));
  }

  private assessReadabilityRules(content: string): number {
    let score = 60;

    const sentences = content.split(/[。！？\n]/).filter((s) => s.trim());
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgLength <= 25) {
      score += 15;
    } else if (avgLength <= 35) {
      score += 10;
    } else if (avgLength > 50) {
      score -= 10;
    }

    const hasComplexWords = /[生僻字|古文|专业术语]/.test(content);
    if (!hasComplexWords) {
      score += 10;
    }

    const paragraphs = content.split('\n\n').filter((p) => p.trim());
    if (paragraphs.length >= 2) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  private async aiBasedAssessment(content: string, dimension: QualityDimension): Promise<number> {
    const prompt = `请评估以下文本在"${QUALITY_DIMENSION_LABELS[dimension]}"维度的质量。

评估标准：${DIMENSION_DESCRIPTIONS[dimension]}

文本内容（前500字）：
${content.substring(0, 500)}

请返回一个0-100的分数，只返回数字，不要其他内容。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 10,
      });

      const score = parseInt(response.content.trim(), 10);
      if (!isNaN(score) && score >= 0 && score <= 100) {
        return score;
      }
    } catch (error) {
      logger.error('AI 评估失败', { dimension, error });
    }

    return 60;
  }

  private determineQualityLevel(score: number): QualityLevel {
    if (score >= 85) {
      return 'excellent';
    }
    if (score >= 70) {
      return 'good';
    }
    if (score >= 55) {
      return 'average';
    }
    if (score >= 40) {
      return 'below_average';
    }
    return 'poor';
  }

  private calculateOverallScore(scores: QualityScore[]): number {
    return Math.round(scores.reduce((sum, s) => sum + s.score * s.weight, 0));
  }

  private analyzeDimension(
    content: string,
    dimension: QualityDimension,
    _score: number
  ): { strengths: string[]; weaknesses: string[]; details: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const details: string[] = [];

    switch (dimension) {
      case 'plot':
        if (/[冲突|危机|挑战]/.test(content)) {
          strengths.push('存在明确的冲突');
        } else {
          weaknesses.push('缺少明确的冲突');
        }
        break;
      case 'dialogue': {
        const dialogues = content.match(/["「『][^"」』]+["」』]/g) || [];
        if (dialogues.length > 0) {
          strengths.push(`包含 ${dialogues.length} 处对话`);
          details.push(
            `对话平均长度: ${Math.round(dialogues.reduce((s: number, d: string) => s + d.length, 0) / dialogues.length)} 字符`
          );
        } else {
          weaknesses.push('缺少对话');
        }
        break;
      }
      case 'emotion':
        if (/[心跳|颤抖|泪水|笑容]/.test(content)) {
          strengths.push('通过身体反应表现情感');
        }
        if (/(非常|很|十分)(开心|难过|生气)/.test(content)) {
          weaknesses.push('存在直接描述情感的表述');
        }
        break;
    }

    return { strengths, weaknesses, details };
  }

  private generateSummary(scores: QualityScore[], overallScore: number): string {
    const level = QUALITY_LEVEL_LABELS[this.determineQualityLevel(overallScore)];
    const topDimensions = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => QUALITY_DIMENSION_LABELS[s.dimension]);
    const lowDimensions = scores
      .filter((s) => s.score < 60)
      .map((s) => QUALITY_DIMENSION_LABELS[s.dimension]);

    let summary = `整体质量${level}（${overallScore}分）。`;

    if (topDimensions.length > 0) {
      summary += `表现较好的方面：${topDimensions.join('、')}。`;
    }

    if (lowDimensions.length > 0) {
      summary += `需要改进：${lowDimensions.join('、')}。`;
    }

    return summary;
  }

  private extractHighlights(_content: string, scores: QualityScore[]): string[] {
    const highlights: string[] = [];

    for (const score of scores) {
      if (score.score >= 80 && score.strengths.length > 0) {
        highlights.push(`【${QUALITY_DIMENSION_LABELS[score.dimension]}】${score.strengths[0]}`);
      }
    }

    return highlights.slice(0, 5);
  }

  private identifyIssues(_content: string, scores: QualityScore[]): QualityIssue[] {
    const issues: QualityIssue[] = [];

    for (const score of scores) {
      if (score.score < 60) {
        for (const weakness of score.weaknesses) {
          issues.push({
            id: `issue_${uuidv4()}`,
            dimension: score.dimension,
            severity: score.score < 40 ? 'major' : 'minor',
            description: weakness,
            location: {
              start: 0,
              end: 0,
              excerpt: '',
            },
            suggestion: this.getSuggestionForDimension(score.dimension),
          });
        }
      }
    }

    return issues;
  }

  private getSuggestionForDimension(dimension: QualityDimension): string {
    const suggestions: Record<QualityDimension, string> = {
      plot: '增加情节冲突和转折，确保故事有明确的起承转合',
      character: '通过对话、动作和内心活动展现角色性格',
      dialogue: '让对话更自然，体现角色特色，避免说教式对话',
      description: '增加感官细节描写，使用比喻和象征增强画面感',
      emotion: '通过细节展示情感，避免直接描述"很伤心"等',
      pacing: '调整叙事节奏，长短句结合，张弛有度',
      style: '保持文字风格一致，避免重复表达',
      logic: '确保情节发展合理，因果关系清晰',
      originality: '避免陈词滥调，尝试独特的表达方式',
      readability: '简化复杂句子，保持段落适中长度',
    };

    return suggestions[dimension];
  }

  private generateRecommendations(
    scores: QualityScore[],
    _issues: QualityIssue[]
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    const lowScores = scores.filter((s) => s.score < 70).sort((a, b) => a.score - b.score);

    for (const score of lowScores.slice(0, 5)) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        dimension: score.dimension,
        priority: score.score < 50 ? 'high' : 'medium',
        description: this.getSuggestionForDimension(score.dimension),
        expectedImprovement: `预计可提升${QUALITY_DIMENSION_LABELS[score.dimension]}评分 ${70 - score.score} 分`,
      });
    }

    return recommendations;
  }

  private async getComparison(
    targetId: string,
    currentScore: number,
    _dimensionScores: QualityScore[]
  ): Promise<QualityAssessment['comparison']> {
    const previousAssessments = this.history
      .filter((h) => h.targetId === targetId)
      .sort((a, b) => b.assessedAt - a.assessedAt);

    if (previousAssessments.length === 0) {
      return undefined;
    }

    const previous = previousAssessments[0];
    const diff = currentScore - previous.overallScore;

    return {
      previousScore: previous.overallScore,
      trend: diff > 3 ? 'improved' : diff < -3 ? 'declined' : 'stable',
      benchmark: 70,
    };
  }

  private countEvents(content: string): number {
    const eventVerbs = [
      '到达',
      '离开',
      '开始',
      '结束',
      '发现',
      '决定',
      '战斗',
      '交谈',
      '获得',
      '失去',
    ];
    let count = 0;
    for (const verb of eventVerbs) {
      const regex = new RegExp(verb, 'g');
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  private calculateDescriptionRatio(content: string): number {
    const descriptionKeywords = ['看', '听', '闻', '感觉', '像', '似', '如'];
    let descriptionLength = 0;

    for (const keyword of descriptionKeywords) {
      const regex = new RegExp(`${keyword}[^。！？]{0,50}`, 'g');
      const matches = content.match(regex);
      if (matches) {
        descriptionLength += matches.reduce((sum, m) => sum + m.length, 0);
      }
    }

    return descriptionLength / content.length;
  }

  private checkRepetition(content: string): boolean {
    const phrases = content.match(/[\u4e00-\u9fa5]{4,10}/g) || [];
    const counts = new Map<string, number>();

    for (const phrase of phrases) {
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }

    for (const [, count] of counts) {
      if (count > 3) {
        return true;
      }
    }

    return false;
  }

  private checkContradiction(content: string): boolean {
    const contradictionPatterns = [
      { a: /活着/, b: /死了/ },
      { a: /在.*里/, b: /在.*外/ },
      { a: /白天/, b: /夜晚/ },
    ];

    for (const pattern of contradictionPatterns) {
      if (pattern.a.test(content) && pattern.b.test(content)) {
        return true;
      }
    }

    return false;
  }

  private countUniqueExpressions(content: string): number {
    const uniquePatterns = [/[^\u4e00-\u9fa5a-zA-Z0-9，。！？、；：""''（）【】《》\s]{3,}/g];

    let count = 0;
    for (const pattern of uniquePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  getAssessment(id: string): QualityAssessment | undefined {
    return this.assessments.get(id);
  }

  getAssessmentsByTarget(targetId: string): QualityAssessment[] {
    return Array.from(this.assessments.values())
      .filter((a) => a.targetId === targetId)
      .sort((a, b) => b.assessedAt - a.assessedAt);
  }

  getAllAssessments(): QualityAssessment[] {
    return Array.from(this.assessments.values()).sort((a, b) => b.assessedAt - a.assessedAt);
  }

  getHistory(targetId?: string): QualityHistory[] {
    if (targetId) {
      return this.history.filter((h) => h.targetId === targetId);
    }
    return [...this.history].sort((a, b) => b.assessedAt - a.assessedAt);
  }

  getStats(): {
    totalAssessments: number;
    averageScore: number;
    byLevel: Record<QualityLevel, number>;
    dimensionAverages: Record<QualityDimension, number>;
  } {
    const assessments = this.getAllAssessments();

    const byLevel: Record<QualityLevel, number> = {
      excellent: 0,
      good: 0,
      average: 0,
      below_average: 0,
      poor: 0,
    };

    const dimensionTotals: Record<QualityDimension, number> = {
      plot: 0,
      character: 0,
      dialogue: 0,
      description: 0,
      emotion: 0,
      pacing: 0,
      style: 0,
      logic: 0,
      originality: 0,
      readability: 0,
    };

    let totalScore = 0;

    for (const assessment of assessments) {
      totalScore += assessment.overallScore;
      byLevel[assessment.overallLevel]++;

      for (const score of assessment.dimensionScores) {
        dimensionTotals[score.dimension] += score.score;
      }
    }

    const dimensionAverages: Record<QualityDimension, number> = {} as Record<
      QualityDimension,
      number
    >;
    for (const [dim, total] of Object.entries(dimensionTotals)) {
      dimensionAverages[dim as QualityDimension] =
        assessments.length > 0 ? Math.round(total / assessments.length) : 0;
    }

    return {
      totalAssessments: assessments.length,
      averageScore: assessments.length > 0 ? Math.round(totalScore / assessments.length) : 0,
      byLevel,
      dimensionAverages,
    };
  }
}

export function createQualityAssessmentService(projectPath: string): QualityAssessmentService {
  return new QualityAssessmentService(projectPath);
}
