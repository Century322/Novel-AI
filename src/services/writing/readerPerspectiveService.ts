import {
  ReaderPersona,
  ReaderFeedback,
  AggregateFeedback,
  ReaderSimulation,
  SimulationResult,
  ReaderInsight,
  FeedbackCategory,
  ReaderType,
  SentimentType,
  AggregateRecommendation,
  READER_TYPE_LABELS,
  DEFAULT_READER_PERSONAS,
} from '@/types/writing/readerPerspective';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ReaderPerspectiveService {
  private projectPath: string;
  private personas: Map<string, ReaderPersona> = new Map();
  private feedbacks: Map<string, ReaderFeedback[]> = new Map();
  private simulations: Map<string, ReaderSimulation> = new Map();
  private insights: Map<string, ReaderInsight> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.initializeDefaultPersonas();
    this.loadFromDisk();
  }

  private initializeDefaultPersonas(): void {
    for (const defaultPersona of DEFAULT_READER_PERSONAS) {
      const persona: ReaderPersona = {
        id: `persona_${defaultPersona.type}`,
        ...defaultPersona,
        weightings: this.getDefaultWeightings(),
      } as ReaderPersona;
      this.personas.set(persona.id, persona);
    }
  }

  private getDefaultWeightings(): Record<FeedbackCategory, number> {
    return {
      engagement: 1.0,
      clarity: 0.8,
      emotion: 0.9,
      pacing: 0.8,
      character: 0.9,
      plot: 1.0,
      style: 0.7,
      originality: 0.6,
      dialogue: 0.7,
      description: 0.6,
      worldbuilding: 0.7,
      satisfaction: 1.0,
    };
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/读者视角`;

      const personasContent = await workshopService.readFile(`${basePath}/读者画像.json`);
      if (personasContent) {
        const data: ReaderPersona[] = JSON.parse(personasContent);
        for (const persona of data) {
          this.personas.set(persona.id, persona);
        }
      }

      const feedbacksContent = await workshopService.readFile(`${basePath}/反馈记录.json`);
      if (feedbacksContent) {
        const data: Record<string, ReaderFeedback[]> = JSON.parse(feedbacksContent);
        for (const [targetId, targetFeedbacks] of Object.entries(data)) {
          this.feedbacks.set(targetId, targetFeedbacks);
        }
      }

      const simulationsContent = await workshopService.readFile(`${basePath}/模拟记录.json`);
      if (simulationsContent) {
        const data: ReaderSimulation[] = JSON.parse(simulationsContent);
        this.simulations = new Map(data.map((s) => [s.id, s]));
      }

      const insightsContent = await workshopService.readFile(`${basePath}/洞察记录.json`);
      if (insightsContent) {
        const data: ReaderInsight[] = JSON.parse(insightsContent);
        this.insights = new Map(data.map((i) => [i.id, i]));
      }
    } catch (error) {
      logger.error('加载读者视角数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/读者视角`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/读者画像.json`,
        JSON.stringify(Array.from(this.personas.values()), null, 2)
      );

      const feedbacksObj: Record<string, ReaderFeedback[]> = {};
      for (const [targetId, targetFeedbacks] of this.feedbacks) {
        feedbacksObj[targetId] = targetFeedbacks;
      }
      await workshopService.writeFile(
        `${basePath}/反馈记录.json`,
        JSON.stringify(feedbacksObj, null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/模拟记录.json`,
        JSON.stringify(Array.from(this.simulations.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/洞察记录.json`,
        JSON.stringify(Array.from(this.insights.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存读者视角数据失败', { error });
    }
  }

  createPersona(persona: Omit<ReaderPersona, 'id'>): ReaderPersona {
    const newPersona: ReaderPersona = {
      id: `persona_${uuidv4()}`,
      ...persona,
    };
    this.personas.set(newPersona.id, newPersona);
    this.saveToDisk();
    return newPersona;
  }

  async simulateReader(
    personaId: string,
    content: string,
    chapter: number
  ): Promise<ReaderFeedback> {
    const persona = this.personas.get(personaId);
    if (!persona) {
      throw new Error('Persona not found');
    }

    const analysis = await this.analyzeContentForReader(content, persona);

    const feedback: ReaderFeedback = {
      id: `feedback_${uuidv4()}`,
      personaId,
      readerType: persona.type,
      target: {
        type: 'chapter',
        id: `chapter_${chapter}`,
        location: { chapter },
      },
      category: this.determinePrimaryCategory(analysis),
      sentiment: this.determineSentiment(analysis),
      importance: this.determineImportance(analysis),
      summary: analysis.summary,
      details: analysis.details,
      specificIssues: analysis.issues.map((issue) => ({
        id: `issue_${uuidv4()}`,
        type: issue.type,
        description: issue.description,
        location: issue.location,
        cause: issue.cause,
        impact: issue.impact,
        suggestedFix: issue.suggestedFix,
        priority: issue.priority,
      })),
      suggestions: analysis.suggestions,
      emotionalResponse: {
        primary: analysis.emotionalResponse.primary,
        intensity: analysis.emotionalResponse.intensity,
        triggers: analysis.emotionalResponse.triggers,
      },
      engagement: {
        attentionLevel: analysis.engagement.attention,
        immersionLevel: analysis.engagement.immersion,
        wouldContinue: analysis.engagement.wouldContinue,
        dropReason: analysis.engagement.dropReason,
      },
      createdAt: Date.now(),
    };

    const targetId = `chapter_${chapter}`;
    if (!this.feedbacks.has(targetId)) {
      this.feedbacks.set(targetId, []);
    }
    this.feedbacks.get(targetId)!.push(feedback);

    await this.saveToDisk();
    return feedback;
  }

  private async analyzeContentForReader(
    content: string,
    persona: ReaderPersona
  ): Promise<{
    summary: string;
    details: string;
    issues: Array<{
      type: 'confusion' | 'boredom' | 'disbelief' | 'frustration' | 'disappointment' | 'other';
      description: string;
      location: string;
      cause: string;
      impact: string;
      suggestedFix: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    suggestions: string[];
    emotionalResponse: {
      primary: string;
      intensity: number;
      triggers: string[];
    };
    engagement: {
      attention: number;
      immersion: number;
      wouldContinue: boolean;
      dropReason?: string;
    };
    scores: Record<FeedbackCategory, number>;
  }> {
    const prompt = `作为一个${READER_TYPE_LABELS[persona.type]}类型的读者，评价以下小说内容：

读者特点：
- 阅读偏好：${persona.preferences.pacePreference}节奏，${persona.preferences.descriptionLevel}描写
- 讨厌元素：${persona.petPeeves.join('、')}
- 喜欢元素：${persona.favoriteElements.join('、')}
- 注意力：${persona.attentionSpan * 100}%
- 悬置怀疑：${persona.suspensionOfDisbelief * 100}%

内容（前800字）：
${content.substring(0, 800)}

请以JSON格式返回评价：
{
  "summary": "总体评价（一句话）",
  "details": "详细评价",
  "issues": [
    {
      "type": "confusion/boredom/disbelief/frustration/disappointment/other",
      "description": "问题描述",
      "location": "位置",
      "cause": "原因",
      "impact": "影响",
      "suggestedFix": "建议修复",
      "priority": "high/medium/low"
    }
  ],
  "suggestions": ["建议1", "建议2"],
  "emotionalResponse": {
    "primary": "主要情感",
    "intensity": 0.8,
    "triggers": ["触发因素"]
  },
  "engagement": {
    "attention": 0.7,
    "immersion": 0.6,
    "wouldContinue": true,
    "dropReason": null
  },
  "scores": {
    "engagement": 0.7,
    "clarity": 0.8,
    "emotion": 0.6,
    "pacing": 0.7,
    "character": 0.8,
    "plot": 0.7,
    "style": 0.6,
    "originality": 0.5,
    "dialogue": 0.7,
    "description": 0.6,
    "worldbuilding": 0.7,
    "satisfaction": 0.7
  }
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 800,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('读者分析失败', { error });
    }

    return {
      summary: '内容评价',
      details: '详细分析',
      issues: [],
      suggestions: [],
      emotionalResponse: { primary: '中性', intensity: 0.5, triggers: [] },
      engagement: { attention: 0.5, immersion: 0.5, wouldContinue: true },
      scores: this.getDefaultWeightings(),
    };
  }

  private determinePrimaryCategory(analysis: {
    scores: Record<FeedbackCategory, number>;
  }): FeedbackCategory {
    let minCategory: FeedbackCategory = 'engagement';
    let minScore = 1;

    for (const [category, score] of Object.entries(analysis.scores)) {
      if (score < minScore) {
        minScore = score;
        minCategory = category as FeedbackCategory;
      }
    }

    return minCategory;
  }

  private determineSentiment(analysis: {
    scores: Record<FeedbackCategory, number>;
  }): SentimentType {
    const avgScore = Object.values(analysis.scores).reduce((a, b) => a + b, 0) / 12;

    if (avgScore >= 0.7) {
      return 'positive';
    }
    if (avgScore >= 0.5) {
      return 'mixed';
    }
    if (avgScore >= 0.3) {
      return 'neutral';
    }
    return 'negative';
  }

  private determineImportance(analysis: {
    issues: Array<{ priority: string }>;
  }): ReaderFeedback['importance'] {
    const highPriority = analysis.issues.filter((i) => i.priority === 'high').length;

    if (highPriority >= 2) {
      return 'critical';
    }
    if (highPriority >= 1) {
      return 'important';
    }
    return 'minor';
  }

  async runSimulation(
    name: string,
    description: string,
    personaIds: string[],
    contentRange: { startChapter: number; endChapter: number },
    config: ReaderSimulation['simulationConfig']
  ): Promise<ReaderSimulation> {
    const personas = personaIds
      .map((id) => this.personas.get(id))
      .filter(Boolean) as ReaderPersona[];

    const simulation: ReaderSimulation = {
      id: `sim_${uuidv4()}`,
      name,
      description,
      personas,
      focusAreas: ['engagement', 'emotion', 'pacing', 'character', 'plot'],
      simulationConfig: config,
      results: [],
      createdAt: Date.now(),
    };

    for (const persona of personas) {
      const result = await this.runPersonaSimulation(simulation.id, persona, contentRange, config);
      simulation.results.push(result);
    }

    this.simulations.set(simulation.id, simulation);
    await this.saveToDisk();
    return simulation;
  }

  private async runPersonaSimulation(
    simulationId: string,
    persona: ReaderPersona,
    contentRange: { startChapter: number; endChapter: number },
    config: ReaderSimulation['simulationConfig']
  ): Promise<SimulationResult> {
    const chapters = await this.loadChapters(contentRange.startChapter, contentRange.endChapter);

    const feedback: ReaderFeedback[] = [];
    const emotionalJourney: SimulationResult['emotionalJourney'] = [];
    const engagementCurve: SimulationResult['engagementCurve'] = [];
    const dropPoints: SimulationResult['dropPoints'] = [];
    const highlights: string[] = [];
    const lowlights: string[] = [];

    for (const chapter of chapters) {
      const chapterFeedback = await this.simulateReader(
        persona.id,
        chapter.content,
        chapter.number
      );
      feedback.push(chapterFeedback);

      if (config.includeEmotionalJourney) {
        emotionalJourney.push({
          chapter: chapter.number,
          emotion: chapterFeedback.emotionalResponse.primary,
          intensity: chapterFeedback.emotionalResponse.intensity,
        });
      }

      if (config.trackEngagement) {
        engagementCurve.push({
          chapter: chapter.number,
          attention: chapterFeedback.engagement.attentionLevel,
          immersion: chapterFeedback.engagement.immersionLevel,
        });

        if (!chapterFeedback.engagement.wouldContinue && config.identifyDropPoints) {
          dropPoints.push({
            chapter: chapter.number,
            reason: chapterFeedback.engagement.dropReason || '未说明',
            recoverable: chapterFeedback.engagement.attentionLevel > 0.3,
          });
        }
      }

      if (chapterFeedback.sentiment === 'positive') {
        highlights.push(`第${chapter.number}章: ${chapterFeedback.summary}`);
      } else if (chapterFeedback.sentiment === 'negative') {
        lowlights.push(`第${chapter.number}章: ${chapterFeedback.summary}`);
      }
    }

    const overallExperience = this.calculateOverallExperience(feedback);

    return {
      id: `result_${uuidv4()}`,
      simulationId,
      personaId: persona.id,
      contentRange,
      overallExperience,
      feedback,
      emotionalJourney,
      engagementCurve,
      dropPoints,
      highlights,
      lowlights,
      summary: this.generateSimulationSummary(feedback, overallExperience),
    };
  }

  private async loadChapters(
    start: number,
    end: number
  ): Promise<Array<{ number: number; content: string }>> {
    const chapters: Array<{ number: number; content: string }> = [];

    for (let i = start; i <= end; i++) {
      try {
        const content = await workshopService.readFile(`${this.projectPath}/正文/第${i}章.md`);
        if (content) {
          chapters.push({ number: i, content });
        }
      } catch {
        continue;
      }
    }

    return chapters;
  }

  private calculateOverallExperience(
    feedback: ReaderFeedback[]
  ): SimulationResult['overallExperience'] {
    if (feedback.length === 0) {
      return { enjoyment: 0.5, engagement: 0.5, satisfaction: 0.5, wouldRecommend: false };
    }

    const avgAttention =
      feedback.reduce((sum, f) => sum + f.engagement.attentionLevel, 0) / feedback.length;
    const avgImmersion =
      feedback.reduce((sum, f) => sum + f.engagement.immersionLevel, 0) / feedback.length;
    const avgEmotion =
      feedback.reduce((sum, f) => sum + f.emotionalResponse.intensity, 0) / feedback.length;
    const continueRate =
      feedback.filter((f) => f.engagement.wouldContinue).length / feedback.length;

    return {
      enjoyment: (avgAttention + avgEmotion) / 2,
      engagement: avgImmersion,
      satisfaction: continueRate,
      wouldRecommend: continueRate > 0.7,
    };
  }

  private generateSimulationSummary(
    feedback: ReaderFeedback[],
    experience: SimulationResult['overallExperience']
  ): string {
    const positiveCount = feedback.filter((f) => f.sentiment === 'positive').length;
    const negativeCount = feedback.filter((f) => f.sentiment === 'negative').length;

    return (
      `共${feedback.length}章反馈，${positiveCount}章正面，${negativeCount}章负面。` +
      `整体满意度${(experience.satisfaction * 100).toFixed(0)}%，` +
      `${experience.wouldRecommend ? '会推荐' : '不推荐'}。`
    );
  }

  aggregateFeedback(targetId: string): AggregateFeedback | null {
    const feedbacks = this.feedbacks.get(targetId);
    if (!feedbacks || feedbacks.length === 0) {
      return null;
    }

    const categoryScores: Record<FeedbackCategory, number> = {
      engagement: 0,
      clarity: 0,
      emotion: 0,
      pacing: 0,
      character: 0,
      plot: 0,
      style: 0,
      originality: 0,
      dialogue: 0,
      description: 0,
      worldbuilding: 0,
      satisfaction: 0,
    };

    const sentimentDistribution: Record<SentimentType, number> = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };

    const readerTypeBreakdown: Record<
      ReaderType,
      {
        score: number;
        mainIssues: string[];
        mainPraises: string[];
      }
    > = {} as Record<ReaderType, { score: number; mainIssues: string[]; mainPraises: string[] }>;

    const issueCounts = new Map<string, number>();
    const praiseCounts = new Map<string, number>();

    for (const feedback of feedbacks) {
      sentimentDistribution[feedback.sentiment]++;

      for (const issue of feedback.specificIssues) {
        const key = issue.description;
        issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
      }

      if (feedback.sentiment === 'positive') {
        praiseCounts.set(feedback.summary, (praiseCounts.get(feedback.summary) || 0) + 1);
      }

      if (!readerTypeBreakdown[feedback.readerType]) {
        readerTypeBreakdown[feedback.readerType] = {
          score: 0,
          mainIssues: [],
          mainPraises: [],
        };
      }
    }

    const overallScore = sentimentDistribution.positive / Math.max(1, feedbacks.length);

    const commonIssues = Array.from(issueCounts.entries())
      .map(([issue, frequency]) => ({
        issue,
        frequency,
        severity: frequency / feedbacks.length,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const commonPraises = Array.from(praiseCounts.entries())
      .map(([praise, frequency]) => ({ praise, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const recommendations = this.generateAggregateRecommendations(commonIssues, feedbacks);

    return {
      id: `agg_${uuidv4()}`,
      targetId,
      targetType: 'chapter',
      totalReaders: new Set(feedbacks.map((f) => f.personaId)).size,
      feedbackCount: feedbacks.length,
      overallScore,
      categoryScores,
      sentimentDistribution,
      commonIssues,
      commonPraises,
      readerTypeBreakdown,
      recommendations,
      generatedAt: Date.now(),
    };
  }

  private generateAggregateRecommendations(
    issues: Array<{ issue: string; frequency: number }>,
    _feedbacks: ReaderFeedback[]
  ): AggregateRecommendation[] {
    return issues.slice(0, 3).map((issue, index) => ({
      id: `rec_${uuidv4()}`,
      type: 'fix' as const,
      priority: index === 0 ? 'high' : 'medium',
      description: `解决: ${issue.issue}`,
      reason: `${issue.frequency}位读者反馈此问题`,
      affectedReaders: [],
      expectedImpact: '提升读者满意度',
      implementation: '根据具体问题调整内容',
    }));
  }

  generateInsights(): ReaderInsight[] {
    const insights: ReaderInsight[] = [];

    const allFeedbacks = Array.from(this.feedbacks.values()).flat();

    const dropReasons = allFeedbacks
      .filter((f) => f.engagement.dropReason)
      .map((f) => f.engagement.dropReason!);

    const dropReasonCounts = new Map<string, number>();
    for (const reason of dropReasons) {
      dropReasonCounts.set(reason, (dropReasonCounts.get(reason) || 0) + 1);
    }

    if (dropReasonCounts.size > 0) {
      const topReason = Array.from(dropReasonCounts.entries()).sort((a, b) => b[1] - a[1])[0];

      insights.push({
        id: `insight_${uuidv4()}`,
        type: 'pattern',
        title: '读者流失主要原因',
        description: `"${topReason[0]}"是最常见的流失原因，出现${topReason[1]}次`,
        evidence: [{ source: '反馈分析', data: topReason[0] }],
        implications: ['需要重点关注此问题', '可能影响整体留存率'],
        actions: ['分析具体章节', '制定改进方案'],
        confidence: 0.8,
        importance: 'critical',
        createdAt: Date.now(),
      });
    }

    for (const insight of insights) {
      this.insights.set(insight.id, insight);
    }

    this.saveToDisk();
    return insights;
  }

  getPersona(id: string): ReaderPersona | undefined {
    return this.personas.get(id);
  }

  getAllPersonas(): ReaderPersona[] {
    return Array.from(this.personas.values());
  }

  getPersonasByType(type: ReaderType): ReaderPersona[] {
    return this.getAllPersonas().filter((p) => p.type === type);
  }

  getFeedback(id: string): ReaderFeedback | undefined {
    for (const feedbacks of this.feedbacks.values()) {
      const found = feedbacks.find((f) => f.id === id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  getFeedbacksByTarget(targetId: string): ReaderFeedback[] {
    return this.feedbacks.get(targetId) || [];
  }

  getSimulation(id: string): ReaderSimulation | undefined {
    return this.simulations.get(id);
  }

  getAllSimulations(): ReaderSimulation[] {
    return Array.from(this.simulations.values());
  }

  getInsight(id: string): ReaderInsight | undefined {
    return this.insights.get(id);
  }

  getAllInsights(): ReaderInsight[] {
    return Array.from(this.insights.values());
  }

  getStats(): {
    totalPersonas: number;
    totalFeedbacks: number;
    totalSimulations: number;
    averageSatisfaction: number;
    byReaderType: Record<ReaderType, number>;
  } {
    const allFeedbacks = Array.from(this.feedbacks.values()).flat();

    const byReaderType: Record<ReaderType, number> = {
      casual: 0,
      avid: 0,
      critical: 0,
      genre_fan: 0,
      literary: 0,
      young_adult: 0,
      mature: 0,
    };

    for (const feedback of allFeedbacks) {
      byReaderType[feedback.readerType]++;
    }

    const avgSatisfaction =
      allFeedbacks.length > 0
        ? allFeedbacks.filter((f) => f.engagement.wouldContinue).length / allFeedbacks.length
        : 0;

    return {
      totalPersonas: this.personas.size,
      totalFeedbacks: allFeedbacks.length,
      totalSimulations: this.simulations.size,
      averageSatisfaction: avgSatisfaction,
      byReaderType,
    };
  }
}

export function createReaderPerspectiveService(projectPath: string): ReaderPerspectiveService {
  return new ReaderPerspectiveService(projectPath);
}
