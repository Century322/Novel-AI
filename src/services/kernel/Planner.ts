import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';
import {
  TaskStep,
  TaskAction,
  PlannerInput,
  PlannerOutput,
  createTaskStep,
  createTaskPlan,
  TASK_ACTION_CONFIG,
} from '@/types/kernel/task';

const PLANNING_PROMPT = `你是一个专业的小说创作任务规划专家。你的职责是将用户的创作目标分解为具体的、可执行的步骤。

## 当前项目状态
- 是否有项目: {{hasProject}}
- 是否有世界观: {{hasWorld}}
- 是否有角色: {{hasCharacters}}
- 是否有大纲: {{hasOutline}}
- 已有章节数: {{chapterCount}}
- 已有角色数: {{characterCount}}

## 用户目标
{{userGoal}}

## 可用的任务类型
{{availableActions}}

## 规划要求
1. 根据项目当前状态，判断需要执行哪些步骤
2. 步骤之间要有合理的依赖关系（比如必须先有角色才能写章节）
3. 每个步骤要明确具体，便于执行
4. 不要生成不必要的步骤

## 输出格式
请以JSON格式输出任务计划：
\`\`\`json
{
  "reasoning": "规划思路说明",
  "steps": [
    {
      "action": "任务类型",
      "description": "任务描述",
      "input": {"参数名": "参数值"},
      "dependencies": ["依赖的任务序号，从0开始"],
      "priority": "critical/high/medium/low"
    }
  ],
  "warnings": ["需要注意的问题"]
}
\`\`\`

请开始规划：`;

export class Planner {
  async plan(input: PlannerInput): Promise<PlannerOutput> {
    logger.info('[Planner] 开始规划任务', { goal: input.userGoal });

    const prompt = this.buildPrompt(input);

    try {
      const response = await llmService.chat({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的小说创作任务规划专家。请严格按照JSON格式输出。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const parsed = this.parseResponse(response.content);

      if (!parsed) {
        logger.warn('[Planner] LLM规划失败，使用默认规划');
        return this.createDefaultPlan(input);
      }

      const steps = this.buildSteps(parsed.steps);
      const plan = createTaskPlan(
        input.userGoal,
        input.userGoal,
        steps,
        input.context.projectPath,
        `session_${Date.now()}`
      );

      logger.info('[Planner] 任务规划完成', {
        totalSteps: steps.length,
        actions: steps.map((s) => s.action),
      });

      return {
        plan,
        reasoning: parsed.reasoning,
        estimatedSteps: steps.length,
        warnings: parsed.warnings,
      };
    } catch (error) {
      logger.error('[Planner] 规划过程出错', { error: String(error) });
      return this.createDefaultPlan(input);
    }
  }

  private buildPrompt(input: PlannerInput): string {
    const ctx = input.context;
    const availableActions = Object.entries(TASK_ACTION_CONFIG)
      .map(([action, config]) => `- ${action}: ${config.label} - ${config.description}`)
      .join('\n');

    return PLANNING_PROMPT.replace('{{hasProject}}', String(ctx.hasProject))
      .replace('{{hasWorld}}', String(ctx.hasWorld))
      .replace('{{hasCharacters}}', String(ctx.hasCharacters))
      .replace('{{hasOutline}}', String(ctx.hasOutline))
      .replace('{{chapterCount}}', String(ctx.chapterCount))
      .replace('{{characterCount}}', String(ctx.characterCount))
      .replace('{{userGoal}}', input.userGoal)
      .replace('{{availableActions}}', availableActions);
  }

  private parseResponse(content: string): {
    reasoning: string;
    steps: Array<{
      action: string;
      description: string;
      input: Record<string, unknown>;
      dependencies: number[];
      priority: string;
    }>;
    warnings?: string[];
  } | null {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      const jsonObject = content.match(/\{[\s\S]*\}/);
      if (jsonObject) {
        return JSON.parse(jsonObject[0]);
      }

      return null;
    } catch (error) {
      logger.error('[Planner] 解析LLM响应失败', { error: String(error) });
      return null;
    }
  }

  private buildSteps(
    rawSteps: Array<{
      action: string;
      description: string;
      input: Record<string, unknown>;
      dependencies: number[];
      priority: string;
    }>
  ): TaskStep[] {
    const steps: TaskStep[] = [];
    const stepIdMap: Map<number, string> = new Map();

    for (let i = 0; i < rawSteps.length; i++) {
      const raw = rawSteps[i];
      const action = this.validateAction(raw.action);
      const priority = this.validatePriority(raw.priority);

      const dependencyIds = raw.dependencies
        .filter((depIdx) => depIdx >= 0 && depIdx < i)
        .map((depIdx) => stepIdMap.get(depIdx))
        .filter((id): id is string => id !== undefined);

      const step = createTaskStep(action, raw.description, raw.input, {
        dependencies: dependencyIds,
        priority,
      });

      stepIdMap.set(i, step.id);
      steps.push(step);
    }

    return steps;
  }

  private validateAction(action: string): TaskAction {
    const validActions = Object.keys(TASK_ACTION_CONFIG) as TaskAction[];
    return validActions.includes(action as TaskAction) ? (action as TaskAction) : 'custom';
  }

  private validatePriority(priority: string): 'critical' | 'high' | 'medium' | 'low' {
    const validPriorities = ['critical', 'high', 'medium', 'low'] as const;
    return validPriorities.includes(priority as (typeof validPriorities)[number])
      ? (priority as (typeof validPriorities)[number])
      : 'medium';
  }

  private createDefaultPlan(input: PlannerInput): PlannerOutput {
    logger.info('[Planner] 创建默认任务计划');

    const ctx = input.context;
    const steps: TaskStep[] = [];

    if (!ctx.hasProject) {
      steps.push(createTaskStep('create_project', '创建项目结构', {}, { priority: 'critical' }));
    }

    if (!ctx.hasWorld) {
      const deps = steps.length > 0 ? [steps[0].id] : [];
      steps.push(
        createTaskStep(
          'generate_world',
          '生成世界观设定',
          {},
          { dependencies: deps, priority: 'high' }
        )
      );
    }

    if (!ctx.hasCharacters) {
      const deps = steps.length > 0 ? [steps[steps.length - 1].id] : [];
      steps.push(
        createTaskStep(
          'generate_character',
          '生成主要角色',
          { role: 'protagonist' },
          { dependencies: deps, priority: 'high' }
        )
      );
    }

    if (!ctx.hasOutline) {
      const deps = steps.length > 0 ? [steps[steps.length - 1].id] : [];
      steps.push(
        createTaskStep(
          'generate_outline',
          '生成小说大纲',
          {},
          { dependencies: deps, priority: 'high' }
        )
      );
    }

    const plan = createTaskPlan(
      input.userGoal,
      input.userGoal,
      steps,
      input.context.projectPath,
      `session_${Date.now()}`
    );

    return {
      plan,
      reasoning: '基于项目当前状态生成的默认规划',
      estimatedSteps: steps.length,
      warnings: steps.length === 0 ? ['无法识别具体任务，将尝试直接响应用户'] : undefined,
    };
  }

  async analyzeGoal(userGoal: string): Promise<{
    type: 'creation' | 'modification' | 'query' | 'analysis' | 'chat';
    confidence: number;
    keywords: string[];
  }> {
    const prompt = `分析以下用户目标的类型：

用户目标: ${userGoal}

请判断这是哪种类型的任务：
- creation: 创建新内容（写章节、创建角色、生成大纲等）
- modification: 修改已有内容（修改章节、调整设定等）
- query: 查询信息（查询角色、查看时间线等）
- analysis: 分析内容（分析质量、检查一致性等）
- chat: 普通对话（闲聊、讨论、头脑风暴等）

以JSON格式返回：
{
  "type": "任务类型",
  "confidence": 0.0-1.0的置信度,
  "keywords": ["关键词1", "关键词2"]
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 200,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('[Planner] 分析目标类型失败', { error: String(error) });
    }

    return {
      type: 'chat',
      confidence: 0.5,
      keywords: [],
    };
  }
}

export const planner = new Planner();
