import { llmService } from '../ai/llmService';
import { ToolRegistry, createToolRegistry } from '../tools/toolRegistry';
import { ContextCompressionService } from '../knowledge/contextCompressionService';
import { AuthorStyleLearningService } from '../style/authorStyleLearningService';
import { MemoryService } from '../knowledge/memoryService';
import { ExecutionController, createExecutionController, ExecutionState } from '../kernel';
import { logger } from '../core/loggerService';

export interface AgentConfig {
  maxIterations: number;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  enableTools: boolean;
  enableMemory: boolean;
  enableStyle: boolean;
  agentMode: boolean;
}

export interface AgentState {
  iteration: number;
  status:
    | 'idle'
    | 'planning'
    | 'thinking'
    | 'acting'
    | 'observing'
    | 'responding'
    | 'completed'
    | 'error'
    | 'paused';
  currentThought: string;
  currentAction: AgentAction | null;
  observations: string[];
  messages: AgentMessage[];
  tokensUsed: number;
  startTime: number;
  executionState?: ExecutionState;
}

export interface AgentAction {
  type: 'tool_call' | 'response' | 'decompose' | 'plan_execute';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  content?: string;
  subtasks?: string[];
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
  timestamp: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  response: string;
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
  iterations: number;
  tokensUsed: number;
  duration: number;
  error?: string;
  plan?: {
    goal: string;
    totalSteps: number;
    completedSteps: number;
  };
}

export interface TaskDecomposition {
  mainTask: string;
  subtasks: Array<{
    id: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 10,
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: `你是一个专业的AI小说写作助手。你有以下能力：

1. **写作能力**：续写、修改、优化小说内容
2. **分析能力**：分析人物、情节、风格、质量
3. **管理能力**：管理人物档案、时间线、伏笔、世界观
4. **学习能力**：学习作者的写作风格

当用户给你任务时，请：
1. 思考任务需要什么步骤
2. 选择合适的工具执行
3. 根据结果调整策略
4. 给出最终回复

你可以使用以下工具来完成复杂任务。请根据任务需要选择合适的工具。`,
  enableTools: true,
  enableMemory: true,
  enableStyle: true,
  agentMode: true,
};

export class AgentEngine {
  private projectPath: string;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private compressionService: ContextCompressionService | null = null;
  private styleService: AuthorStyleLearningService | null = null;
  private _memoryService: MemoryService | null = null;

  getMemoryService(): MemoryService | null {
    return this._memoryService;
  }
  private executionController: ExecutionController | null = null;
  private state: AgentState;

  constructor(projectPath: string = '', config: Partial<AgentConfig> = {}, externalToolRegistry?: ToolRegistry) {
    this.projectPath = projectPath || 'default';
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolRegistry = externalToolRegistry || createToolRegistry(this.projectPath);

    this.state = {
      iteration: 0,
      status: 'idle',
      currentThought: '',
      currentAction: null,
      observations: [],
      messages: [],
      tokensUsed: 0,
      startTime: Date.now(),
    };

    this.initExecutionController();
  }

  private initExecutionController(): void {
    this.executionController = createExecutionController(this.projectPath);

    this.executionController.setCallbacks({
      onStateChange: (execState) => {
        this.state.executionState = execState;
        switch (execState.status) {
          case 'planning':
            this.state.status = 'planning';
            break;
          case 'running':
            this.state.status = 'acting';
            break;
          case 'paused':
            this.state.status = 'paused';
            break;
          case 'completed':
            this.state.status = 'completed';
            break;
          case 'failed':
            this.state.status = 'error';
            break;
          case 'cancelled':
            this.state.status = 'idle';
            break;
        }
      },
      onStepStart: (step) => {
        this.state.currentAction = {
          type: 'tool_call',
          toolName: step.action,
          toolArgs: step.input,
        };
        this.state.observations.push(`开始执行: ${step.description}`);
      },
      onStepComplete: (step, _result) => {
        this.state.observations.push(`完成: ${step.description}`);
      },
      onStepError: (step, error) => {
        this.state.observations.push(`失败: ${step.description} - ${error}`);
      },
    });
  }

  setCompressionService(service: ContextCompressionService): void {
    this.compressionService = service;
    this.executionController?.setCompressionService(service);
  }

  setStyleService(service: AuthorStyleLearningService): void {
    this.styleService = service;
    this.executionController?.setStyleService(service);
  }

  setMemoryService(service: MemoryService): void {
    this._memoryService = service;
    this.executionController?.setMemoryService(service);
  }

  setAgentMode(enabled: boolean): void {
    this.config.agentMode = enabled;
    logger.info(`[AgentEngine] Agent模式已${enabled ? '开启' : '关闭'}`);
  }

  isAgentMode(): boolean {
    return this.config.agentMode;
  }

  async run(userMessage: string, onProgress?: (state: AgentState) => void): Promise<AgentResult> {
    this.state = {
      iteration: 0,
      status: 'thinking',
      currentThought: '',
      currentAction: null,
      observations: [],
      messages: [{ role: 'user', content: userMessage, timestamp: Date.now() }],
      tokensUsed: 0,
      startTime: Date.now(),
    };

    if (this.config.agentMode) {
      return this.runWithPlanning(userMessage, onProgress);
    } else {
      return this.runSimple(userMessage, onProgress);
    }
  }

  private async runWithPlanning(
    userMessage: string,
    _onProgress?: (state: AgentState) => void
  ): Promise<AgentResult> {
    logger.info('[AgentEngine] 使用规划模式执行', { userMessage });

    try {
      if (!this.executionController) {
        throw new Error('执行控制器未初始化');
      }

      const execState = await this.executionController.execute(userMessage);

      const plan = execState.plan
        ? {
            goal: execState.plan.goal,
            totalSteps: execState.plan.metadata.totalSteps,
            completedSteps: execState.plan.metadata.completedSteps,
          }
        : undefined;

      let response = '';
      if (execState.status === 'completed' && execState.plan) {
        const completedSteps = execState.plan.steps.filter((s) => s.status === 'completed');
        if (completedSteps.length > 0) {
          const lastStep = completedSteps[completedSteps.length - 1];
          if (
            lastStep.output &&
            typeof lastStep.output === 'object' &&
            'content' in lastStep.output
          ) {
            response = String((lastStep.output as { content?: string }).content || '');
          }
        }

        if (!response) {
          response =
            `任务完成！共执行 ${completedSteps.length} 个步骤。\n\n` +
            completedSteps.map((s) => `- ${s.description}`).join('\n');
        }
      } else if (execState.status === 'failed') {
        response = `任务执行失败: ${execState.error || '未知错误'}`;
      } else if (execState.status === 'cancelled') {
        response = '任务已取消';
      }

      return {
        success: execState.status === 'completed',
        response,
        toolCalls:
          execState.plan?.steps
            .filter((s) => s.status === 'completed' && s.output)
            .map((s) => ({
              name: s.action,
              args: s.input,
              result: s.output,
            })) || [],
        iterations: execState.plan?.steps.length || 0,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - this.state.startTime,
        error: execState.error || undefined,
        plan,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AgentEngine] 规划执行失败', { error: errorMessage });

      return {
        success: false,
        response: '',
        toolCalls: [],
        iterations: 0,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - this.state.startTime,
        error: errorMessage,
      };
    }
  }

  private async runSimple(
    userMessage: string,
    onProgress?: (state: AgentState) => void
  ): Promise<AgentResult> {
    logger.info('[AgentEngine] 使用简单模式执行', { userMessage });

    const toolCalls: AgentResult['toolCalls'] = [];

    try {
      while (this.state.iteration < this.config.maxIterations) {
        this.state.iteration++;
        onProgress?.(this.state);

        const thought = await this.think();
        this.state.currentThought = thought;
        this.state.status = 'acting';
        onProgress?.(this.state);

        const action = await this.decideAction(thought);
        this.state.currentAction = action;

        if (action.type === 'response') {
          this.state.status = 'responding';
          onProgress?.(this.state);

          return {
            success: true,
            response: action.content || '',
            toolCalls,
            iterations: this.state.iteration,
            tokensUsed: this.state.tokensUsed,
            duration: Date.now() - this.state.startTime,
          };
        }

        if (action.type === 'tool_call' && action.toolName) {
          this.state.status = 'acting';
          onProgress?.(this.state);

          const result = await this.executeTool(action.toolName, action.toolArgs || {});

          toolCalls.push({
            name: action.toolName,
            args: action.toolArgs || {},
            result: result.result,
          });

          this.state.observations.push(
            `工具 ${action.toolName} 返回: ${JSON.stringify(result.result).substring(0, 500)}`
          );

          this.state.messages.push({
            role: 'tool',
            content: JSON.stringify(result.result),
            toolCallId: `call_${Date.now()}`,
            timestamp: Date.now(),
          });
        }

        this.state.status = 'observing';
        onProgress?.(this.state);
      }

      return {
        success: false,
        response: '达到最大迭代次数，任务未完成',
        toolCalls,
        iterations: this.state.iteration,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - this.state.startTime,
        error: 'Max iterations reached',
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        toolCalls,
        iterations: this.state.iteration,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - this.state.startTime,
        error: String(error),
      };
    }
  }

  private async think(): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt();

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...this.state.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
      })),
    ];

    const response = await llmService.chat({
      messages,
      temperature: this.config.temperature,
      maxTokens: 1000,
    });

    this.state.tokensUsed += response.usage.totalTokens;

    return response.content;
  }

  private async decideAction(thought: string): Promise<AgentAction> {
    const toolPattern = /使用工具[：:]\s*(\w+)\s*\(([^)]*)\)/;
    const match = thought.match(toolPattern);

    if (match) {
      const toolName = match[1];
      let toolArgs: Record<string, unknown> = {};

      try {
        const argsStr = match[2].trim();
        if (argsStr) {
          toolArgs = JSON.parse(argsStr);
        }
      } catch {
        toolArgs = { input: match[2] };
      }

      return {
        type: 'tool_call',
        toolName,
        toolArgs,
      };
    }

    const responsePattern = /最终回答[：:]\s*([\s\S]*)/;
    const responseMatch = thought.match(responsePattern);

    if (responseMatch) {
      return {
        type: 'response',
        content: responseMatch[1].trim(),
      };
    }

    if (thought.includes('完成') || thought.includes('任务结束')) {
      return {
        type: 'response',
        content: thought,
      };
    }

    return {
      type: 'response',
      content: thought,
    };
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ result: unknown }> {
    const tool = this.toolRegistry.get(name);

    if (!tool) {
      return { result: { error: `工具 ${name} 不存在` } };
    }

    const result = await this.toolRegistry.execute(
      { id: `call_${Date.now()}`, name, arguments: args, status: 'pending', startTime: Date.now() },
      { projectPath: this.projectPath, sessionId: 'default' }
    );

    return { result: result.result };
  }

  private async buildSystemPrompt(): Promise<string> {
    let prompt = this.config.systemPrompt;

    if (this.config.enableStyle && this.styleService) {
      const stylePrompt = this.styleService.generateStylePrompt();
      if (stylePrompt) {
        prompt += '\n\n## 作者风格\n' + stylePrompt;
      }
    }

    if (this.config.enableMemory && this.compressionService) {
      const context = await this.compressionService.compress({ maxTokens: 1000 });
      if (context.summary) {
        prompt += '\n\n## 项目上下文\n' + context.summary;
      }
    }

    const { getKnowledgeService } = await import('../core/serviceInitializer');
    const knowledgeService = getKnowledgeService();
    if (knowledgeService) {
      const files = knowledgeService.getAllFiles();
      if (files.length > 0) {
        prompt += '\n\n## 资料库\n';
        prompt += `当前资料库中有 ${files.length} 个文件：\n`;
        for (const file of files.slice(0, 10)) {
          prompt += `- ${file.filename} (${file.type}, ${file.chunkCount}个分块)\n`;
        }
        if (files.length > 10) {
          prompt += `... 还有 ${files.length - 10} 个文件\n`;
        }
        prompt += '\n读取资料库内容的方法：\n';
        prompt += '使用工具: get_knowledge_content({"filename": "文件名"})\n';
        prompt += '使用工具: search_knowledge({"query": "关键词"})\n';
      }
    }

    if (this.config.enableTools) {
      const tools = this.toolRegistry.getDefinitions();
      prompt += '\n\n## 可用工具\n';
      for (const tool of tools) {
        prompt += `\n### ${tool.name}\n${tool.description}\n`;
        if (tool.parameters) {
          prompt += '参数:\n';
          for (const [key, param] of Object.entries(tool.parameters)) {
            prompt += `- ${key}: ${param.description}\n`;
          }
        }
      }

      prompt += '\n## 使用工具的格式\n';
      prompt += '使用工具: 工具名({"参数名": "参数值"})\n';
    }

    prompt += '\n\n## 当前任务\n';
    prompt += '请分析用户的需求，思考需要执行的步骤，然后选择合适的工具执行或直接回答。\n';
    prompt += '完成任务后，请以"最终回答："开头给出回复。\n';

    if (this.state.observations.length > 0) {
      prompt += '\n## 已执行的步骤\n';
      for (const obs of this.state.observations) {
        prompt += `- ${obs}\n`;
      }
    }

    return prompt;
  }

  pause(): void {
    if (this.executionController && this.state.status === 'acting') {
      this.executionController.pause();
      logger.info('[AgentEngine] 执行已暂停');
    }
  }

  resume(): void {
    if (this.executionController && this.state.status === 'paused') {
      this.executionController.resume();
      logger.info('[AgentEngine] 执行已恢复');
    }
  }

  cancel(): void {
    if (this.executionController) {
      this.executionController.cancel();
      logger.info('[AgentEngine] 执行已取消');
    }
  }

  getExecutionState(): ExecutionState | null {
    return this.state.executionState || null;
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getExecutionController(): ExecutionController | null {
    return this.executionController;
  }
}

export function createAgentEngine(
  projectPath: string,
  config?: Partial<AgentConfig>,
  toolRegistry?: ToolRegistry
): AgentEngine {
  return new AgentEngine(projectPath, config, toolRegistry);
}
