import {
  IterationCycle,
  IterationPhase,
  IterationPhaseData,
  IterationConfig,
  IterationResult,
  IterationIssue,
  RevisionPlan,
  RevisionType,
  IterationTemplate,
  DEFAULT_ITERATION_CONFIG,
  BUILTIN_ITERATION_TEMPLATES,
  REVISION_TYPE_LABELS,
} from '@/types/ecosystem/iterationCycle';
import { QualityAssessment } from '@/types/writing/qualityAssessment';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import {
  QualityAssessmentService,
  createQualityAssessmentService,
} from '../analysis/qualityAssessmentService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class IterationOptimizationService {
  private projectPath: string;
  private cycles: Map<string, IterationCycle> = new Map();
  private templates: Map<string, IterationTemplate> = new Map();
  private qualityService: QualityAssessmentService;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.qualityService = createQualityAssessmentService(projectPath);
    this.loadBuiltInTemplates();
    this.loadFromDisk();
  }

  private loadBuiltInTemplates(): void {
    for (const template of BUILTIN_ITERATION_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const cyclesPath = `${this.projectPath}/设定/迭代优化/优化周期.json`;
      const templatesPath = `${this.projectPath}/设定/迭代优化/自定义模板.json`;

      const cyclesContent = await workshopService.readFile(cyclesPath);
      if (cyclesContent) {
        const data: IterationCycle[] = JSON.parse(cyclesContent);
        this.cycles = new Map(data.map((c) => [c.id, c]));
      }

      const templatesContent = await workshopService.readFile(templatesPath);
      if (templatesContent) {
        const data: IterationTemplate[] = JSON.parse(templatesContent);
        for (const template of data) {
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      logger.error('加载迭代优化数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/迭代优化`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/优化周期.json`,
        JSON.stringify(Array.from(this.cycles.values()), null, 2)
      );

      const customTemplates = Array.from(this.templates.values()).filter(
        (t) => !BUILTIN_ITERATION_TEMPLATES.some((b) => b.id === t.id)
      );
      await workshopService.writeFile(
        `${basePath}/自定义模板.json`,
        JSON.stringify(customTemplates, null, 2)
      );
    } catch (error) {
      logger.error('保存迭代优化数据失败', { error });
    }
  }

  createCycle(
    name: string,
    description: string,
    targetType: IterationCycle['target']['type'],
    targetId: string,
    targetName: string,
    config: Partial<IterationConfig> = {}
  ): IterationCycle {
    const fullConfig: IterationConfig = { ...DEFAULT_ITERATION_CONFIG, ...config };

    const phases: IterationPhaseData[] = [
      { phase: 'generate', status: 'pending', input: '', output: '', notes: '' },
      { phase: 'evaluate', status: 'pending', input: '', output: '', notes: '' },
      { phase: 'revise', status: 'pending', input: '', output: '', notes: '' },
      { phase: 'verify', status: 'pending', input: '', output: '', notes: '' },
      { phase: 'complete', status: 'pending', input: '', output: '', notes: '' },
    ];

    const cycle: IterationCycle = {
      id: `cycle_${uuidv4()}`,
      name,
      description,
      status: 'pending',
      target: { type: targetType, id: targetId, name: targetName },
      phases,
      currentPhase: 'generate',
      currentIteration: 0,
      maxIterations: fullConfig.maxIterations,
      config: fullConfig,
      results: [],
      finalOutput: null,
      createdAt: Date.now(),
    };

    this.cycles.set(cycle.id, cycle);
    this.saveToDisk();
    return cycle;
  }

  async runCycle(
    cycleId: string,
    initialContent: string,
    onProgress?: (phase: IterationPhase, progress: number) => void
  ): Promise<IterationCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error('Cycle not found');
    }

    cycle.status = 'in_progress';
    cycle.startedAt = Date.now();
    let currentContent = initialContent;

    for (let iteration = 0; iteration < cycle.maxIterations; iteration++) {
      cycle.currentIteration = iteration;

      onProgress?.('evaluate', 0.2);
      const evaluation = await this.runEvaluationPhase(cycle, currentContent);

      if (evaluation.overallScore >= cycle.config.qualityThreshold) {
        cycle.finalOutput = currentContent;
        break;
      }

      onProgress?.('revise', 0.5);
      const revisionPlan = await this.createRevisionPlan(cycle, evaluation);

      onProgress?.('revise', 0.7);
      currentContent = await this.runRevisionPhase(cycle, currentContent, revisionPlan);

      onProgress?.('verify', 0.9);
      const verification = await this.runVerificationPhase(cycle, currentContent);

      if (verification.overallScore <= evaluation.overallScore && iteration > 0) {
        break;
      }
    }

    cycle.status = 'completed';
    cycle.completedAt = Date.now();
    cycle.finalOutput = currentContent;

    await this.saveToDisk();
    return cycle;
  }

  private async runEvaluationPhase(
    cycle: IterationCycle,
    content: string
  ): Promise<QualityAssessment> {
    const phaseIndex = cycle.phases.findIndex((p) => p.phase === 'evaluate');
    const phase = cycle.phases[phaseIndex];

    phase.status = 'in_progress';
    phase.startedAt = Date.now();
    phase.input = content.substring(0, 500);

    const assessment = await this.qualityService.assessContent(
      content,
      cycle.target.type === 'chapter' ? 'chapter' : 'section',
      cycle.target.id,
      cycle.target.name
    );

    phase.output = `质量评分: ${assessment.overallScore}`;
    phase.metrics = {
      overallScore: assessment.overallScore,
      issueCount: assessment.issues.length,
    };
    phase.status = 'completed';
    phase.completedAt = Date.now();

    const result: IterationResult = {
      iteration: cycle.currentIteration,
      phase: 'evaluate',
      input: content,
      output: assessment.summary,
      qualityScore: assessment.overallScore,
      dimensionScores: assessment.dimensionScores.reduce(
        (acc, s) => {
          acc[s.dimension] = s.score;
          return acc;
        },
        {} as Record<string, number>
      ),
      issues: assessment.issues.map((issue) => ({
        id: issue.id,
        type: 'quality_improvement' as RevisionType,
        severity: issue.severity,
        description: issue.description,
        location: issue.location,
        suggestedFix: issue.suggestion,
        applied: false,
      })),
      improvements: [],
      revisionApplied: '',
      timeTaken: Date.now() - (phase.startedAt || 0),
    };

    cycle.results.push(result);

    return assessment;
  }

  private async createRevisionPlan(
    cycle: IterationCycle,
    assessment: QualityAssessment
  ): Promise<RevisionPlan> {
    const issues = assessment.issues.map((issue) => ({
      id: issue.id,
      type: this.mapDimensionToRevisionType(issue.dimension),
      severity: issue.severity,
      description: issue.description,
      location: issue.location,
      suggestedFix: issue.suggestion,
      applied: false,
    }));

    const priorities = issues.map((issue, index) => ({
      issueId: issue.id,
      priority:
        issue.severity === 'critical'
          ? 100 - index
          : issue.severity === 'major'
            ? 50 - index
            : 25 - index,
      reason: `${issue.severity}级别问题: ${issue.description}`,
    }));

    const strategy = await this.determineRevisionStrategy(cycle, issues);

    return {
      id: `plan_${uuidv4()}`,
      cycleId: cycle.id,
      iteration: cycle.currentIteration,
      issues,
      priorities,
      strategy,
      estimatedImpact: this.estimateImpact(issues),
    };
  }

  private mapDimensionToRevisionType(dimension: string): RevisionType {
    const mapping: Record<string, RevisionType> = {
      plot: 'logic_fix',
      character: 'character_consistency',
      dialogue: 'style_adjustment',
      description: 'content_expansion',
      emotion: 'quality_improvement',
      pacing: 'pacing_adjustment',
      style: 'style_adjustment',
      logic: 'logic_fix',
      originality: 'quality_improvement',
      readability: 'quality_improvement',
    };
    return mapping[dimension] || 'quality_improvement';
  }

  private async determineRevisionStrategy(
    _cycle: IterationCycle,
    issues: IterationIssue[]
  ): Promise<RevisionPlan['strategy']> {
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const majorIssues = issues.filter((i) => i.severity === 'major');

    let type: RevisionType = 'quality_improvement';
    if (criticalIssues.length > 0) {
      type = this.mapDimensionToRevisionType(criticalIssues[0].type);
    } else if (majorIssues.length > 0) {
      type = this.mapDimensionToRevisionType(majorIssues[0].type);
    }

    const approach = this.getRevisionApproach(type);
    const steps = this.generateRevisionSteps(type, issues);
    const examples = await this.generateRevisionExamples(type, issues);

    return { type, approach, steps, examples };
  }

  private getRevisionApproach(type: RevisionType): string {
    const approaches: Record<RevisionType, string> = {
      quality_improvement: '通过优化语言表达和细节描写提升整体质量',
      style_adjustment: '调整文字风格以匹配目标风格档案',
      content_expansion: '扩充细节描写，增加场景深度',
      content_reduction: '精简冗余内容，提高叙事效率',
      logic_fix: '修复情节逻辑问题，确保因果关系合理',
      character_consistency: '调整人物行为以保持性格一致性',
      pacing_adjustment: '调整叙事节奏，优化阅读体验',
    };
    return approaches[type];
  }

  private generateRevisionSteps(type: RevisionType, issues: IterationIssue[]): string[] {
    const steps: string[] = [];

    for (const issue of issues.slice(0, 3)) {
      steps.push(`修复: ${issue.description}`);
      if (issue.suggestedFix) {
        steps.push(`建议: ${issue.suggestedFix}`);
      }
    }

    const typeSteps: Record<RevisionType, string[]> = {
      quality_improvement: ['优化句式结构', '增强细节描写', '改善情感表达'],
      style_adjustment: ['分析目标风格特征', '调整用词习惯', '统一表达方式'],
      content_expansion: ['添加环境描写', '增加人物内心活动', '丰富对话细节'],
      content_reduction: ['删除冗余描写', '精简对话', '加快叙事节奏'],
      logic_fix: ['梳理因果关系', '补充必要铺垫', '修正矛盾之处'],
      character_consistency: ['检查人物性格', '调整行为描写', '统一对话风格'],
      pacing_adjustment: ['调整段落长度', '平衡快慢节奏', '增加过渡'],
    };

    steps.push(...typeSteps[type]);

    return steps;
  }

  private async generateRevisionExamples(
    type: RevisionType,
    issues: IterationIssue[]
  ): Promise<string[]> {
    if (issues.length === 0) {
      return [];
    }

    const prompt = `为以下写作问题生成修改示例：

问题类型: ${REVISION_TYPE_LABELS[type]}
问题描述: ${issues[0].description}
建议修改: ${issues[0].suggestedFix}

请生成一个修改前后的对比示例，格式如下：
修改前: [原文]
修改后: [修改后的文本]`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 300,
      });

      return [response.content];
    } catch {
      return [];
    }
  }

  private estimateImpact(issues: IterationIssue[]): number {
    const severityWeights = { critical: 15, major: 8, minor: 3 };
    return issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
  }

  private async runRevisionPhase(
    cycle: IterationCycle,
    content: string,
    plan: RevisionPlan
  ): Promise<string> {
    const phaseIndex = cycle.phases.findIndex((p) => p.phase === 'revise');
    const phase = cycle.phases[phaseIndex];

    phase.status = 'in_progress';
    phase.startedAt = Date.now();
    phase.input = content.substring(0, 500);

    const revisedContent = await this.applyRevisions(content, plan);

    phase.output = `应用了 ${plan.issues.length} 个修改`;
    phase.status = 'completed';
    phase.completedAt = Date.now();

    return revisedContent;
  }

  private async applyRevisions(content: string, plan: RevisionPlan): Promise<string> {
    const topIssues = plan.priorities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)
      .map((p) => plan.issues.find((i) => i.id === p.issueId))
      .filter(Boolean) as IterationIssue[];

    if (topIssues.length === 0) {
      return content;
    }

    const prompt = `请根据以下问题修改文本：

原文:
${content}

需要修改的问题:
${topIssues
  .map(
    (issue, i) => `${i + 1}. ${issue.description}
   建议: ${issue.suggestedFix}`
  )
  .join('\n')}

修改策略: ${plan.strategy.approach}

请输出修改后的完整文本，不要添加任何解释。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: content.length + 500,
      });

      return response.content;
    } catch {
      return content;
    }
  }

  private async runVerificationPhase(
    cycle: IterationCycle,
    content: string
  ): Promise<QualityAssessment> {
    const phaseIndex = cycle.phases.findIndex((p) => p.phase === 'verify');
    const phase = cycle.phases[phaseIndex];

    phase.status = 'in_progress';
    phase.startedAt = Date.now();

    const assessment = await this.qualityService.assessContent(
      content,
      cycle.target.type === 'chapter' ? 'chapter' : 'section',
      cycle.target.id,
      cycle.target.name
    );

    phase.output = `验证评分: ${assessment.overallScore}`;
    phase.metrics = {
      overallScore: assessment.overallScore,
      improvement:
        assessment.overallScore - (cycle.results[cycle.results.length - 1]?.qualityScore || 0),
    };
    phase.status = 'completed';
    phase.completedAt = Date.now();

    return assessment;
  }

  createTemplate(template: Omit<IterationTemplate, 'id'>): IterationTemplate {
    const newTemplate: IterationTemplate = {
      ...template,
      id: `template_${uuidv4()}`,
    };
    this.templates.set(newTemplate.id, newTemplate);
    this.saveToDisk();
    return newTemplate;
  }

  getTemplate(id: string): IterationTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): IterationTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): IterationTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  getCycle(id: string): IterationCycle | undefined {
    return this.cycles.get(id);
  }

  getAllCycles(): IterationCycle[] {
    return Array.from(this.cycles.values());
  }

  getActiveCycles(): IterationCycle[] {
    return this.getAllCycles().filter((c) => c.status === 'in_progress');
  }

  cancelCycle(cycleId: string): boolean {
    const cycle = this.cycles.get(cycleId);
    if (!cycle || cycle.status !== 'in_progress') {
      return false;
    }

    cycle.status = 'cancelled';
    cycle.completedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  deleteCycle(cycleId: string): boolean {
    const result = this.cycles.delete(cycleId);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  deleteTemplate(templateId: string): boolean {
    if (BUILTIN_ITERATION_TEMPLATES.some((t) => t.id === templateId)) {
      return false;
    }
    const result = this.templates.delete(templateId);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  getStats(): {
    totalCycles: number;
    completedCycles: number;
    averageIterations: number;
    averageImprovement: number;
    byStatus: Record<string, number>;
  } {
    const cycles = this.getAllCycles();
    const completed = cycles.filter((c) => c.status === 'completed');

    const averageIterations =
      completed.length > 0
        ? completed.reduce((sum, c) => sum + c.currentIteration + 1, 0) / completed.length
        : 0;

    const averageImprovement =
      completed.length > 0
        ? completed.reduce((sum, c) => {
            const first = c.results[0]?.qualityScore || 0;
            const last = c.results[c.results.length - 1]?.qualityScore || 0;
            return sum + (last - first);
          }, 0) / completed.length
        : 0;

    const byStatus: Record<string, number> = {};
    for (const cycle of cycles) {
      byStatus[cycle.status] = (byStatus[cycle.status] || 0) + 1;
    }

    return {
      totalCycles: cycles.length,
      completedCycles: completed.length,
      averageIterations,
      averageImprovement,
      byStatus,
    };
  }
}

export function createIterationOptimizationService(
  projectPath: string
): IterationOptimizationService {
  return new IterationOptimizationService(projectPath);
}
