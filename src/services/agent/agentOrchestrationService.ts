import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';
import type { ChapterSummaryService } from '../memory/chapterSummaryService';
import type { LongTermMemoryService } from '../memory/longTermMemoryService';
import type { EnhancedStyleAnalysisService } from '../style/enhancedStyleAnalysisService';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { Foreshadowing } from '@/types/plot/foreshadowing';
import type { ExtendedTimelineEvent } from '@/types/plot/extendedTimeline';
import type { WorldLocation, WorldFaction, WorldRule, OutlineNode } from '@/types/world/worldModel';

export type WorkflowStage =
  | 'init'
  | 'setup_world'
  | 'create_outline'
  | 'create_detailed_outline'
  | 'write_chapter'
  | 'review'
  | 'complete';

export type WorkflowAction =
  | 'extract_settings'
  | 'build_world'
  | 'generate_outline'
  | 'generate_detailed_outline'
  | 'write_chapter'
  | 'check_consistency'
  | 'ask_user'
  | 'suggest'
  | 'wait_for_input';

export interface WorkflowStep {
  id: string;
  stage: WorkflowStage;
  action: WorkflowAction;
  description: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowPlan {
  id: string;
  goal: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface OrchestrationWritingContext {
  characters: Array<{
    name: string;
    role: string;
    description: string;
    currentStatus?: string;
  }>;
  timeline: Array<{
    event: string;
    time: string;
    chapter?: number;
  }>;
  foreshadowing: Array<{
    title: string;
    status: string;
    description: string;
  }>;
  worldbuilding: {
    locations: string[];
    factions: string[];
    rules: string[];
  };
  outline: {
    currentChapter: number;
    chapterTitle?: string;
    chapterSummary?: string;
    previousChapterSummary?: string;
  };
  preferences: {
    must: string[];
    avoid: string[];
    style: string[];
  };
  stylePrompt?: string;
}

const PLANNING_PROMPT = `你是一个专业的小说创作规划师。根据用户的请求，制定一个清晰的创作工作流。

工作流阶段：
1. init - 初始化，检查项目状态
2. setup_world - 建立世界设定（人物、世界观、大纲）
3. create_outline - 创建故事大纲
4. create_detailed_outline - 创建细纲
5. write_chapter - 撰写章节
6. review - 审查一致性
7. complete - 完成

可用动作：
- extract_settings: 从用户输入提取设定
- build_world: 构建完整世界
- generate_outline: 生成大纲
- generate_detailed_outline: 生成细纲
- write_chapter: 撰写章节
- check_consistency: 检查一致性
- ask_user: 询问用户
- suggest: 提供建议
- wait_for_input: 等待用户输入

请分析用户请求，输出 JSON 格式的工作流计划：
{
  "goal": "用户目标描述",
  "steps": [
    {
      "stage": "阶段名",
      "action": "动作名",
      "description": "步骤描述",
      "parameters": { "key": "value" },
      "dependencies": ["依赖的步骤id"]
    }
  ]
}`;

export class AgentOrchestrationService {
  private worldModelService: WorldModelService | null = null;
  private chapterSummaryService: ChapterSummaryService | null = null;
  private longTermMemoryService: LongTermMemoryService | null = null;
  private styleAnalysisService: EnhancedStyleAnalysisService | null = null;
  private currentPlan: WorkflowPlan | null = null;

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setChapterSummaryService(service: ChapterSummaryService): void {
    this.chapterSummaryService = service;
  }

  setLongTermMemoryService(service: LongTermMemoryService): void {
    this.longTermMemoryService = service;
  }

  setStyleAnalysisService(service: EnhancedStyleAnalysisService): void {
    this.styleAnalysisService = service;
  }

  async planWorkflow(userRequest: string): Promise<WorkflowPlan> {
    const prompt = `${PLANNING_PROMPT}

用户请求：${userRequest}

当前项目状态：
- 人物数量：${this.worldModelService?.getCharacters().length || 0}
- 地点数量：${this.worldModelService?.getLocations().length || 0}
- 大纲节点：${this.worldModelService?.getOutlineNodes().length || 0}
- 已写章节：${this.chapterSummaryService?.getAllSummaries().length || 0}

请制定工作流计划。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2048,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析工作流计划');
      }

      const result = JSON.parse(jsonMatch[0]);
      const planId = `plan_${Date.now()}`;

      const plan: WorkflowPlan = {
        id: planId,
        goal: result.goal,
        steps: result.steps.map((s: Record<string, unknown>, i: number) => ({
          id: `step_${planId}_${i}`,
          stage: s.stage as WorkflowStage,
          action: s.action as WorkflowAction,
          description: String(s.description),
          parameters: (s.parameters as Record<string, unknown>) || {},
          dependencies: (s.dependencies as string[]) || [],
          status: 'pending',
        })),
        currentStepIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.currentPlan = plan;
      logger.info('创建工作流计划', { planId, steps: plan.steps.length });
      return plan;
    } catch (error) {
      logger.error('规划工作流失败', { error: String(error) });
      return this.getDefaultPlan(userRequest);
    }
  }

  private getDefaultPlan(userRequest: string): WorkflowPlan {
    const planId = `plan_${Date.now()}`;
    return {
      id: planId,
      goal: userRequest,
      steps: [
        {
          id: `step_${planId}_0`,
          stage: 'init',
          action: 'wait_for_input',
          description: '等待用户提供更多信息',
          parameters: {},
          dependencies: [],
          status: 'pending',
        },
      ],
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  getCurrentPlan(): WorkflowPlan | null {
    return this.currentPlan;
  }

  async executeNextStep(): Promise<{
    step: WorkflowStep;
    result: Record<string, unknown>;
    needsUserInput: boolean;
    question?: string;
  }> {
    if (!this.currentPlan) {
      throw new Error('没有活动的工作流计划');
    }

    const step = this.getNextExecutableStep();
    if (!step) {
      throw new Error('没有可执行的步骤');
    }

    step.status = 'in_progress';
    this.currentPlan.updatedAt = Date.now();

    try {
      const result = await this.executeStep(step);
      step.status = 'completed';
      step.result = result;
      this.currentPlan.currentStepIndex++;

      return {
        step,
        result,
        needsUserInput: step.action === 'ask_user' || step.action === 'wait_for_input',
        question: result.question as string | undefined,
      };
    } catch (error) {
      step.status = 'failed';
      step.error = String(error);
      throw error;
    }
  }

  private getNextExecutableStep(): WorkflowStep | null {
    if (!this.currentPlan) return null;

    for (const step of this.currentPlan.steps) {
      if (step.status === 'pending') {
        const allDependenciesMet = step.dependencies.every((depId) => {
          const dep = this.currentPlan!.steps.find((s) => s.id === depId);
          return dep && dep.status === 'completed';
        });
        if (allDependenciesMet) {
          return step;
        }
      }
    }
    return null;
  }

  private async executeStep(step: WorkflowStep): Promise<Record<string, unknown>> {
    switch (step.action) {
      case 'extract_settings':
        return this.executeExtractSettings(step.parameters);
      case 'build_world':
        return this.executeBuildWorld(step.parameters);
      case 'generate_outline':
        return this.executeGenerateOutline(step.parameters);
      case 'write_chapter':
        return this.executeWriteChapter(step.parameters);
      case 'check_consistency':
        return this.executeCheckConsistency(step.parameters);
      case 'ask_user':
        return { question: step.parameters.question || '请提供更多信息' };
      case 'wait_for_input':
        return { waiting: true };
      default:
        return { action: step.action, status: 'unknown' };
    }
  }

  private async executeExtractSettings(
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const input = params.input as string;
    if (!input) {
      throw new Error('缺少输入内容');
    }

    const { settingExtractionService } = await import('../extraction/settingExtractionService');
    const result = await settingExtractionService.extractFromInput(input, { autoSave: true });
    return { extracted: result };
  }

  private async executeBuildWorld(
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const input = params.input as string;
    if (!input) {
      throw new Error('缺少输入内容');
    }

    const { worldBuildingService } = await import('../worldbuilding/worldBuildingService');
    const result = await worldBuildingService.buildWorldFromInput(input, {
      generateOutline: true,
    });
    return { worldModel: result.worldModel, outline: result.outline };
  }

  private async executeGenerateOutline(
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.worldModelService) {
      throw new Error('WorldModelService 未设置');
    }

    const context = this.worldModelService.getContextForGeneration();
    const targetWordCount = (params.targetWordCount as number) || 100000;

    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的网文大纲规划师。根据提供的设定，生成完整的故事大纲。',
        },
        {
          role: 'user',
          content: `设定：\n${context}\n\n目标字数：${targetWordCount}\n\n请生成大纲。`,
        },
      ],
      temperature: 0.7,
      maxTokens: 4096,
    });

    return { outline: response.content };
  }

  private async executeWriteChapter(
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const chapterNumber = params.chapterNumber as number;
    if (!chapterNumber) {
      throw new Error('缺少章节号');
    }

    const context = await this.buildWritingContext(chapterNumber);

    const prompt = this.buildChapterPrompt(context, params);

    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的网文作家。根据提供的上下文和要求，撰写章节内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 4096,
    });

    return { content: response.content, chapterNumber };
  }

  async buildWritingContext(chapterNumber: number): Promise<OrchestrationWritingContext> {
    const context: OrchestrationWritingContext = {
      characters: [],
      timeline: [],
      foreshadowing: [],
      worldbuilding: { locations: [], factions: [], rules: [] },
      outline: { currentChapter: chapterNumber },
      preferences: { must: [], avoid: [], style: [] },
    };

    if (this.worldModelService) {
      const worldModel = this.worldModelService.getWorldModel();
      if (worldModel) {
        context.characters = worldModel.characters.items.map((c: CharacterProfile) => ({
          name: c.name,
          role: c.role,
          description: c.notes || '',
          currentStatus: c.lastAppearance,
        }));

        context.timeline = worldModel.timeline.events.slice(-10).map((e: ExtendedTimelineEvent) => ({
          event: e.title,
          time: e.storyTime.display || '',
          chapter: undefined,
        }));

        context.foreshadowing = worldModel.foreshadowing.items.map((f: Foreshadowing) => ({
          title: f.title,
          status: f.status,
          description: f.content,
        }));

        context.worldbuilding = {
          locations: worldModel.worldbuilding.locations.map((l: WorldLocation) => l.name),
          factions: worldModel.worldbuilding.factions.map((f: WorldFaction) => f.name),
          rules: worldModel.worldbuilding.rules.map((r: WorldRule) => r.name),
        };

        const outlineNodes = worldModel.outline.nodes;
        const chapterNode = outlineNodes.find(
          (n: OutlineNode) => n.type === 'chapter' && n.title.includes(`第${chapterNumber}章`)
        );
        if (chapterNode) {
          context.outline.chapterTitle = chapterNode.title;
          context.outline.chapterSummary = chapterNode.summary;
        }
      }
    }

    if (this.chapterSummaryService && chapterNumber > 1) {
      const prevSummary = this.chapterSummaryService.getSummary(chapterNumber - 1);
      if (prevSummary) {
        context.outline.previousChapterSummary = prevSummary.summary;
      }
    }

    if (this.longTermMemoryService) {
      const mustPrefs = this.longTermMemoryService.getMustPreferences();
      const avoidPrefs = this.longTermMemoryService.getAvoidPreferences();

      context.preferences.must = mustPrefs.map((p) => `${p.key}: ${p.value}`);
      context.preferences.avoid = avoidPrefs.map((p) => `${p.key}: ${p.value}`);
    }

    if (this.styleAnalysisService) {
      const stylePrompt = await this.styleAnalysisService.buildStylePrompt(
        'description',
        ['advance_plot', 'develop_character'],
        context.outline.chapterSummary
      );
      context.stylePrompt = stylePrompt;
    }

    return context;
  }

  private buildChapterPrompt(context: OrchestrationWritingContext, params: Record<string, unknown>): string {
    const parts: string[] = [];

    parts.push(`## 当前任务：撰写第 ${context.outline.currentChapter} 章\n`);

    if (context.outline.chapterTitle) {
      parts.push(`章节标题：${context.outline.chapterTitle}\n`);
    }

    if (context.outline.chapterSummary) {
      parts.push(`章节概要：${context.outline.chapterSummary}\n`);
    }

    if (context.outline.previousChapterSummary) {
      parts.push(`\n## 前情提要\n${context.outline.previousChapterSummary}\n`);
    }

    if (context.characters.length > 0) {
      parts.push('\n## 相关人物\n');
      for (const char of context.characters.slice(0, 5)) {
        parts.push(`- ${char.name}（${char.role}）：${char.description}\n`);
      }
    }

    if (context.preferences.must.length > 0) {
      parts.push('\n## 必须遵守\n');
      for (const p of context.preferences.must) {
        parts.push(`- ${p}\n`);
      }
    }

    if (context.preferences.avoid.length > 0) {
      parts.push('\n## 需要避免\n');
      for (const p of context.preferences.avoid) {
        parts.push(`- ${p}\n`);
      }
    }

    if (context.stylePrompt) {
      parts.push(`\n${context.stylePrompt}`);
    }

    const targetWordCount = (params.targetWordCount as number) || 2000;
    parts.push(`\n## 要求\n`);
    parts.push(`- 字数：约 ${targetWordCount} 字\n`);
    parts.push(`- 风格：网文风格，节奏明快\n`);
    parts.push(`- 注意：保持人物性格一致，情节连贯\n`);

    return parts.join('');
  }

  private async executeCheckConsistency(
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const content = params.content as string;
    if (!content) {
      throw new Error('缺少检查内容');
    }

    const issues: Array<{
      type: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    if (this.worldModelService) {
      const characters = this.worldModelService.getCharacters();
      for (const char of characters) {
        if (content.includes(char.name)) {
          if (char.notes && !content.includes(char.notes.substring(0, 20))) {
            issues.push({
              type: 'character',
              description: `人物 ${char.name} 的描述可能与设定不一致`,
              severity: 'medium',
            });
          }
        }
      }
    }

    return { issues, checkedAt: Date.now() };
  }

  async detectCurrentStage(): Promise<WorkflowStage> {
    if (!this.worldModelService) {
      return 'init';
    }

    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) {
      return 'init';
    }

    const hasCharacters = worldModel.characters.items.length > 0;
    const hasOutline = worldModel.outline.nodes.length > 0;
    const hasChapters = this.chapterSummaryService
      ? this.chapterSummaryService.getAllSummaries().length > 0
      : false;

    if (!hasCharacters) {
      return 'setup_world';
    }

    if (!hasOutline) {
      return 'create_outline';
    }

    if (hasChapters) {
      return 'write_chapter';
    }

    return 'create_detailed_outline';
  }

  async suggestNextAction(): Promise<{
    stage: WorkflowStage;
    action: WorkflowAction;
    reason: string;
  }> {
    const currentStage = await this.detectCurrentStage();

    switch (currentStage) {
      case 'init':
        return {
          stage: 'setup_world',
          action: 'build_world',
          reason: '项目刚创建，需要先建立世界设定',
        };
      case 'setup_world':
        return {
          stage: 'setup_world',
          action: 'extract_settings',
          reason: '需要添加更多人物和世界观设定',
        };
      case 'create_outline':
        return {
          stage: 'create_outline',
          action: 'generate_outline',
          reason: '世界设定已完成，可以开始创建大纲',
        };
      case 'create_detailed_outline':
        return {
          stage: 'create_detailed_outline',
          action: 'generate_detailed_outline',
          reason: '大纲已创建，可以细化章节内容',
        };
      case 'write_chapter':
        return {
          stage: 'write_chapter',
          action: 'write_chapter',
          reason: '准备工作已完成，可以开始撰写章节',
        };
      default:
        return {
          stage: 'complete',
          action: 'suggest',
          reason: '当前阶段已完成',
        };
    }
  }

  updatePlanStep(stepId: string, updates: Partial<WorkflowStep>): boolean {
    if (!this.currentPlan) return false;

    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    Object.assign(step, updates);
    this.currentPlan.updatedAt = Date.now();
    return true;
  }

  cancelPlan(): void {
    this.currentPlan = null;
  }
}

export const agentOrchestrationService = new AgentOrchestrationService();
