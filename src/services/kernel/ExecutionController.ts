import { logger } from '../core/loggerService';
import { workshopService } from '../core/workshopService';
import { TaskGraph, createTaskGraph } from './TaskGraph';
import { planner } from './Planner';
import { ToolRegistry } from '../tools/toolRegistry';
import { createAggregatedToolRegistry } from '../tools/aggregated';
import { llmService } from '../ai/llmService';
import { MemoryService } from '../knowledge/memoryService';
import { ContextCompressionService } from '../knowledge/contextCompressionService';
import { AuthorStyleLearningService } from '../style/authorStyleLearningService';
import { TaskPlan, TaskStep, ProjectContext, PlannerInput } from '@/types/kernel/task';

export type ExecutionStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionState {
  status: ExecutionStatus;
  currentStep: TaskStep | null;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  plan: TaskPlan | null;
  startTime: number | null;
  endTime: number | null;
  error: string | null;
}

export interface ExecutionCallbacks {
  onStateChange?: (state: ExecutionState) => void;
  onStepStart?: (step: TaskStep) => void;
  onStepComplete?: (step: TaskStep, result: unknown) => void;
  onStepError?: (step: TaskStep, error: string) => void;
  onPlanComplete?: (plan: TaskPlan) => void;
  onAllComplete?: (state: ExecutionState) => void;
}

export class ExecutionController {
  private projectPath: string;
  private toolRegistry: ToolRegistry;
  private taskGraph: TaskGraph | null = null;
  private memoryService: MemoryService | null = null;
  private compressionService: ContextCompressionService | null = null;
  private styleService: AuthorStyleLearningService | null = null;

  private state: ExecutionState = {
    status: 'idle',
    currentStep: null,
    progress: { total: 0, completed: 0, percentage: 0 },
    plan: null,
    startTime: null,
    endTime: null,
    error: null,
  };

  private callbacks: ExecutionCallbacks = {};
  private abortController: AbortController | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.toolRegistry = createAggregatedToolRegistry(projectPath);
  }

  setMemoryService(service: MemoryService): void {
    this.memoryService = service;
  }

  setCompressionService(service: ContextCompressionService): void {
    this.compressionService = service;
  }

  setStyleService(service: AuthorStyleLearningService): void {
    this.styleService = service;
  }

  setCallbacks(callbacks: ExecutionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState(): ExecutionState {
    return { ...this.state };
  }

  async execute(userGoal: string): Promise<ExecutionState> {
    if (this.state.status === 'running') {
      logger.warn('[ExecutionController] 已有任务在执行中');
      return this.state;
    }

    this.abortController = new AbortController();
    this.updateState({ status: 'planning', startTime: Date.now(), error: null });

    try {
      const context = await this.getProjectContext();

      const plannerInput: PlannerInput = {
        userGoal,
        context,
      };

      const plannerOutput = await planner.plan(plannerInput);

      this.taskGraph = createTaskGraph(plannerOutput.plan);
      this.updateState({
        plan: plannerOutput.plan,
        progress: this.taskGraph.getProgress(),
      });

      this.callbacks.onPlanComplete?.(plannerOutput.plan);

      if (plannerOutput.warnings && plannerOutput.warnings.length > 0) {
        logger.warn('[ExecutionController] 规划警告', { warnings: plannerOutput.warnings });
      }

      if (plannerOutput.plan.steps.length === 0) {
        return await this.handleChatOnly(userGoal);
      }

      this.updateState({ status: 'running' });

      return await this.runExecutionLoop();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[ExecutionController] 执行失败', { error: errorMessage });
      this.updateState({ status: 'failed', error: errorMessage, endTime: Date.now() });
      return this.state;
    }
  }

  private async runExecutionLoop(): Promise<ExecutionState> {
    if (!this.taskGraph) {
      throw new Error('任务图未初始化');
    }

    while (!this.taskGraph.isComplete()) {
      if (this.abortController?.signal.aborted) {
        this.updateState({ status: 'cancelled', endTime: Date.now() });
        return this.state;
      }

      if (this.state.status === 'paused') {
        await this.waitForResume();
      }

      const step = this.taskGraph.nextReady();
      if (!step) {
        if (this.taskGraph.hasFailed()) {
          this.updateState({ status: 'failed', error: '任务执行失败', endTime: Date.now() });
          return this.state;
        }
        await this.delay(100);
        continue;
      }

      this.updateState({ currentStep: step });
      this.callbacks.onStepStart?.(step);
      this.taskGraph.updateStepStatus(step.id, 'running');

      try {
        const result = await this.executeStep(step);
        this.taskGraph.setStepOutput(step.id, result);
        this.taskGraph.updateStepStatus(step.id, 'completed');
        this.callbacks.onStepComplete?.(step, result);
        logger.info('[ExecutionController] 任务步骤完成', {
          stepId: step.id,
          action: step.action,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (step.retryCount < step.maxRetries) {
          this.taskGraph.retryStep(step.id);
          logger.warn('[ExecutionController] 任务步骤失败，准备重试', {
            stepId: step.id,
            error: errorMessage,
            retryCount: step.retryCount + 1,
          });
        } else {
          this.taskGraph.updateStepStatus(step.id, 'failed', errorMessage);
          this.callbacks.onStepError?.(step, errorMessage);
          logger.error('[ExecutionController] 任务步骤失败', {
            stepId: step.id,
            error: errorMessage,
          });
        }
      }

      this.updateState({ progress: this.taskGraph.getProgress() });
    }

    const finalProgress = this.taskGraph.getProgress();
    const finalStatus = finalProgress.failed > 0 ? 'failed' : 'completed';

    this.updateState({
      status: finalStatus,
      currentStep: null,
      endTime: Date.now(),
      error: finalStatus === 'failed' ? `${finalProgress.failed} 个任务失败` : null,
    });

    this.callbacks.onAllComplete?.(this.state);
    return this.state;
  }

  private async executeStep(step: TaskStep): Promise<unknown> {
    logger.info('[ExecutionController] 执行任务步骤', {
      action: step.action,
      description: step.description,
    });

    switch (step.action) {
      case 'create_project':
        return this.executeCreateProject(step);

      case 'create_directory':
        return this.executeCreateDirectory(step);

      case 'generate_world':
        return this.executeGenerateWorld(step);

      case 'generate_character':
        return this.executeGenerateCharacter(step);

      case 'generate_outline':
        return this.executeGenerateOutline(step);

      case 'generate_chapter':
        return this.executeGenerateChapter(step);

      case 'generate_scene':
        return this.executeGenerateScene(step);

      case 'write_file':
        return this.executeWriteFile(step);

      case 'read_file':
        return this.executeReadFile(step);

      case 'modify_file':
        return this.executeModifyFile(step);

      case 'analyze_content':
        return this.executeAnalyzeContent(step);

      case 'check_consistency':
        return this.executeCheckConsistency(step);

      case 'learn_style':
        return this.executeLearnStyle(step);

      case 'chat':
        return this.executeChat(step);

      case 'custom':
        return this.executeCustom(step);

      default:
        throw new Error(`未知的任务类型: ${step.action}`);
    }
  }

  private async executeCreateProject(step: TaskStep): Promise<unknown> {
    const dirs = ['world', 'characters', 'outline', 'chapters', 'notes'];
    const results: string[] = [];

    for (const dir of dirs) {
      const dirPath = `${this.projectPath}/${dir}`;
      await workshopService.createDirectory(dirPath);
      results.push(dir);
    }

    const projectConfig = {
      name: step.input.name || '未命名小说',
      createdAt: Date.now(),
      genre: step.input.genre || '未知',
      targetLength: step.input.targetLength || 100000,
    };

    await workshopService.writeFile(
      `${this.projectPath}/project.json`,
      JSON.stringify(projectConfig, null, 2)
    );

    return { created: results, config: projectConfig };
  }

  private async executeCreateDirectory(step: TaskStep): Promise<unknown> {
    const path = step.input.path as string;
    const fullPath = `${this.projectPath}/${path}`;
    await workshopService.createDirectory(fullPath);
    return { path };
  }

  private async executeGenerateWorld(step: TaskStep): Promise<unknown> {
    const context = await this.buildGenerationContext(step);

    const prompt = `请为小说生成世界观设定。

${context}

要求：
1. 包含世界背景、历史、地理、势力等
2. 设定要自洽且有深度
3. 适合小说的叙事需求

请以Markdown格式输出完整的世界观设定。`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
    });

    const worldContent = response.content;
    await workshopService.writeFile(`${this.projectPath}/world/设定.md`, worldContent);

    return { content: worldContent, path: 'world/设定.md' };
  }

  private async executeGenerateCharacter(step: TaskStep): Promise<unknown> {
    const context = await this.buildGenerationContext(step);
    const role = step.input.role || 'protagonist';

    const prompt = `请为小说生成${role === 'protagonist' ? '主角' : role === 'antagonist' ? '反派' : '配角'}角色设定。

${context}

要求：
1. 包含姓名、年龄、外貌、性格、背景、目标等
2. 角色要有立体感和成长空间
3. 与故事主题相契合

请以Markdown格式输出完整的角色设定。`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    const characterContent = response.content;
    const characterName = this.extractCharacterName(characterContent) || `角色_${Date.now()}`;

    await workshopService.writeFile(
      `${this.projectPath}/characters/${characterName}.md`,
      characterContent
    );

    if (this.memoryService) {
      await this.memoryService.addCharacterMemory({
        name: characterName,
        role: role as 'protagonist' | 'antagonist' | 'supporting' | 'minor',
        description: characterContent.substring(0, 500),
        aliases: [],
        traits: [],
        relationships: [],
        firstAppear: '角色创建',
        lastMention: '角色创建',
        arc: [],
      });
    }

    return {
      content: characterContent,
      name: characterName,
      path: `characters/${characterName}.md`,
    };
  }

  private async executeGenerateOutline(step: TaskStep): Promise<unknown> {
    const context = await this.buildGenerationContext(step);
    const chapterCount = (step.input.chapterCount as number) || 10;

    const prompt = `请为小说生成大纲，共${chapterCount}章。

${context}

要求：
1. 每章要有明确的情节推进
2. 要有起承转合的结构
3. 要设置伏笔和高潮

请以Markdown格式输出完整的大纲，每章包含：
- 章节标题
- 主要情节
- 关键事件
- 涉及角色`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4000,
    });

    const outlineContent = response.content;
    await workshopService.writeFile(`${this.projectPath}/outline/大纲.md`, outlineContent);

    return { content: outlineContent, chapterCount, path: 'outline/大纲.md' };
  }

  private async executeGenerateChapter(step: TaskStep): Promise<unknown> {
    const context = await this.buildGenerationContext(step);
    const chapterNumber = (step.input.chapterNumber as number) || 1;
    const chapterTitle = (step.input.chapterTitle as string) || `第${chapterNumber}章`;

    const prompt = `请撰写小说的第${chapterNumber}章：${chapterTitle}

${context}

要求：
1. 内容要与前文连贯
2. 情节要有吸引力
3. 字数在2000-5000字之间

请直接输出章节正文内容。`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 5000,
    });

    const chapterContent = response.content;
    const fileName = `第${String(chapterNumber).padStart(3, '0')}章_${chapterTitle}.md`;

    await workshopService.writeFile(
      `${this.projectPath}/chapters/${fileName}`,
      `# ${chapterTitle}\n\n${chapterContent}`
    );

    return { content: chapterContent, chapterNumber, path: `chapters/${fileName}` };
  }

  private async executeGenerateScene(step: TaskStep): Promise<unknown> {
    const context = await this.buildGenerationContext(step);
    const sceneDescription = (step.input.description as string) || '场景';

    const prompt = `请撰写以下场景：

${sceneDescription}

${context}

要求：
1. 场景描写要生动具体
2. 要有画面感和氛围感
3. 字数在500-2000字之间

请直接输出场景内容。`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    return { content: response.content, description: sceneDescription };
  }

  private async executeWriteFile(step: TaskStep): Promise<unknown> {
    const path = step.input.path as string;
    const content = step.input.content as string;

    await workshopService.writeFile(`${this.projectPath}/${path}`, content);

    return { path, size: content.length };
  }

  private async executeReadFile(step: TaskStep): Promise<unknown> {
    const path = step.input.path as string;
    const content = await workshopService.readFile(`${this.projectPath}/${path}`);
    return { path, content };
  }

  private async executeModifyFile(step: TaskStep): Promise<unknown> {
    const path = step.input.path as string;
    const instructions = step.input.instructions as string;

    const originalContent = await workshopService.readFile(`${this.projectPath}/${path}`);

    const prompt = `请根据以下指令修改文件内容：

原内容：
${originalContent}

修改指令：
${instructions}

请输出修改后的完整内容：`;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 5000,
    });

    await workshopService.writeFile(`${this.projectPath}/${path}`, response.content);

    return { path, modified: true };
  }

  private async executeAnalyzeContent(step: TaskStep): Promise<unknown> {
    const content = step.input.content as string;

    const result = await this.toolRegistry.execute(
      {
        id: 'analyze',
        name: 'story_analysis',
        arguments: { type: 'structure', text: content },
        status: 'pending',
        startTime: Date.now(),
      },
      { projectPath: this.projectPath, sessionId: 'execution' }
    );

    return result.result;
  }

  private async executeCheckConsistency(step: TaskStep): Promise<unknown> {
    const result = await this.toolRegistry.execute(
      {
        id: 'check',
        name: 'story_analysis',
        arguments: { type: 'consistency', text: step.input.content as string || '', scope: 'chapter' },
        status: 'pending',
        startTime: Date.now(),
      },
      { projectPath: this.projectPath, sessionId: 'execution' }
    );

    return result.result;
  }

  private async executeLearnStyle(step: TaskStep): Promise<unknown> {
    const content = step.input.content as string;

    const result = await this.toolRegistry.execute(
      {
        id: 'learn',
        name: 'style_ops',
        arguments: { action: 'learn', text: content },
        status: 'pending',
        startTime: Date.now(),
      },
      { projectPath: this.projectPath, sessionId: 'execution' }
    );

    return result.result;
  }

  private async executeChat(step: TaskStep): Promise<unknown> {
    const message = (step.input.message as string) || step.description;

    const response = await llmService.chat({
      messages: [{ role: 'user', content: message }],
      maxTokens: 2000,
    });

    return { response: response.content };
  }

  private async executeCustom(step: TaskStep): Promise<unknown> {
    const toolName = step.input.tool as string;

    if (toolName && this.toolRegistry.has(toolName)) {
      const result = await this.toolRegistry.execute(
        {
          id: 'custom',
          name: toolName,
          arguments: (step.input.args as Record<string, unknown>) || {},
          status: 'pending',
          startTime: Date.now(),
        },
        { projectPath: this.projectPath, sessionId: 'execution' }
      );
      return result.result;
    }

    return await this.executeChat(step);
  }

  private async handleChatOnly(userGoal: string): Promise<ExecutionState> {
    const response = await llmService.chat({
      messages: [{ role: 'user', content: userGoal }],
      maxTokens: 2000,
    });

    const plan = this.taskGraph?.getPlan();
    if (plan && plan.steps.length === 0) {
      plan.steps.push({
        id: 'chat_step',
        action: 'chat',
        description: userGoal,
        input: { message: userGoal },
        output: response.content,
        dependencies: [],
        status: 'completed',
        priority: 'medium',
        retryCount: 0,
        maxRetries: 0,
      });
    }

    this.updateState({
      status: 'completed',
      endTime: Date.now(),
      progress: { total: 1, completed: 1, percentage: 100 },
    });

    return this.state;
  }

  private async buildGenerationContext(step: TaskStep): Promise<string> {
    const parts: string[] = [];

    if (this.compressionService) {
      try {
        const compressed = await this.compressionService.compress({ maxTokens: 2000 });
        if (compressed.summary) {
          parts.push('## 项目上下文\n' + compressed.summary);
        }
      } catch (error) {
        logger.warn('[ExecutionController] 获取压缩上下文失败', { error: String(error) });
      }
    }

    if (this.styleService) {
      const stylePrompt = this.styleService.generateStylePrompt();
      if (stylePrompt) {
        parts.push('## 写作风格\n' + stylePrompt);
      }
    }

    if (step.input.context) {
      parts.push('## 额外上下文\n' + String(step.input.context));
    }

    return parts.join('\n\n');
  }

  private async getProjectContext(): Promise<ProjectContext> {
    const exists = await workshopService.pathExists(this.projectPath);

    if (!exists) {
      return {
        projectPath: this.projectPath,
        hasProject: false,
        hasWorld: false,
        hasCharacters: false,
        hasOutline: false,
        chapterCount: 0,
        characterCount: 0,
        existingFiles: [],
      };
    }

    const files = await workshopService.readDirectory(this.projectPath);
    const existingFiles = files.map((f) => f.name);

    const hasWorld = await workshopService.pathExists(`${this.projectPath}/world`);
    const hasCharacters = await workshopService.pathExists(`${this.projectPath}/characters`);
    const hasOutline = await workshopService.pathExists(`${this.projectPath}/outline`);
    const hasChapters = await workshopService.pathExists(`${this.projectPath}/chapters`);

    let chapterCount = 0;
    let characterCount = 0;

    if (hasChapters) {
      const chapterFiles = await workshopService.readDirectory(`${this.projectPath}/chapters`);
      chapterCount = chapterFiles.filter((f) => f.name.endsWith('.md')).length;
    }

    if (hasCharacters) {
      const characterFiles = await workshopService.readDirectory(`${this.projectPath}/characters`);
      characterCount = characterFiles.filter((f) => f.name.endsWith('.md')).length;
    }

    return {
      projectPath: this.projectPath,
      hasProject: true,
      hasWorld,
      hasCharacters,
      hasOutline,
      chapterCount,
      characterCount,
      existingFiles,
    };
  }

  private extractCharacterName(content: string): string | null {
    const nameMatch = content.match(/(?:姓名|名字|名称)[：:]\s*([^\n]+)/);
    if (nameMatch) {
      return nameMatch[1].trim().replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
    }

    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim().replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
    }

    return null;
  }

  private updateState(partial: Partial<ExecutionState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks.onStateChange?.(this.state);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForResume(): Promise<void> {
    while (this.state.status === 'paused') {
      await this.delay(100);
    }
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.updateState({ status: 'paused' });
      logger.info('[ExecutionController] 执行已暂停');
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.updateState({ status: 'running' });
      logger.info('[ExecutionController] 执行已恢复');
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.updateState({ status: 'cancelled', endTime: Date.now() });
    logger.info('[ExecutionController] 执行已取消');
  }

  getTaskGraph(): TaskGraph | null {
    return this.taskGraph;
  }
}

export function createExecutionController(projectPath: string): ExecutionController {
  return new ExecutionController(projectPath);
}
