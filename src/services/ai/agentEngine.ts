import { llmService, LLMMessage, ToolDefinition } from '../ai/llmService';
import { LLMToolCall } from '@/types/core/llm';
import { ToolRegistry } from '../tools/toolRegistry';
import { createAggregatedToolRegistry } from '../tools/aggregated';
import { ContextCompressionService } from '../knowledge/contextCompressionService';
import { AuthorStyleLearningService } from '../style/authorStyleLearningService';
import { MemoryService } from '../knowledge/memoryService';
import { ExecutionController, createExecutionController, ExecutionState } from '../kernel';
import { logger } from '../core/loggerService';
import { DEFAULT_AGENT_MAX_ITERATIONS } from '@/store/agentStore';

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
  terminationReason?: 'max_iterations' | 'final_answer' | 'error' | 'user_abort' | 'tool_loop';
}

export interface AgentAction {
  type: 'tool_call' | 'response' | 'continue';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  content?: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LLMToolCall[];
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
    success: boolean;
    error?: string;
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
  terminationReason?: 'max_iterations' | 'final_answer' | 'error' | 'user_abort' | 'tool_loop';
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
  maxIterations: DEFAULT_AGENT_MAX_ITERATIONS,
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: `你是一个专业的AI小说写作助手。

## 重要概念区分
- **资料库/知识库**：用户上传的参考文档（如小说、设定、大纲等）
- **文件系统**：项目的文件目录（章节文件、设定文件等）

## 工作方式
根据用户需求调用合适的工具完成任务。如果不需要调用工具，直接回答用户问题即可。`,
  enableTools: true,
  enableMemory: true,
  enableStyle: true,
  agentMode: true,
};

const MAX_CONTEXT_MESSAGES = 12;
const MAX_SAME_TOOL_CALLS = 3;

export class AgentEngine {
  private projectPath: string;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private compressionService: ContextCompressionService | null = null;
  private styleService: AuthorStyleLearningService | null = null;
  private _memoryService: MemoryService | null = null;
  private executionController: ExecutionController | null = null;
  private state: AgentState;
  private abortRequested: boolean = false;
  private toolCallCounts: Map<string, number> = new Map();

  getMemoryService(): MemoryService | null {
    return this._memoryService;
  }

  constructor(projectPath: string = '', config: Partial<AgentConfig> = {}, externalToolRegistry?: ToolRegistry) {
    this.projectPath = projectPath || 'default';
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolRegistry = externalToolRegistry || createAggregatedToolRegistry(this.projectPath);

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
    this.abortRequested = false;
    this.toolCallCounts.clear();
    
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

    logger.info('[AgentEngine] 开始执行ReAct循环', { 
      userMessage: userMessage.substring(0, 100),
      maxIterations: this.config.maxIterations,
      agentMode: this.config.agentMode 
    });

    if (this.config.agentMode) {
      return this.runReActLoop(userMessage, onProgress);
    } else {
      return this.runSimpleChat(userMessage, onProgress);
    }
  }

  private checkToolLoop(toolName: string): boolean {
    const count = this.toolCallCounts.get(toolName) || 0;
    if (count >= MAX_SAME_TOOL_CALLS) {
      return true;
    }
    this.toolCallCounts.set(toolName, count + 1);
    return false;
  }

  private async runReActLoop(
    _userMessage: string,
    onProgress?: (state: AgentState) => void
  ): Promise<AgentResult> {
    const toolCalls: AgentResult['toolCalls'] = [];
    const startTime = Date.now();

    try {
      while (this.state.iteration < this.config.maxIterations) {
        if (this.abortRequested) {
          logger.info('[AgentEngine] 用户请求中止');
          return this.createResult(toolCalls, startTime, 'user_abort', '用户中止');
        }

        this.state.iteration++;
        this.state.status = 'thinking';
        onProgress?.(this.state);

        logger.info(`[AgentEngine] ========== 迭代 ${this.state.iteration}/${this.config.maxIterations} ==========`);
        logger.debug('[AgentEngine] 当前消息历史', { 
          messageCount: this.state.messages.length,
          lastMessageRole: this.state.messages[this.state.messages.length - 1]?.role 
        });

        const thought = await this.think();
        this.state.currentThought = thought.content;

        logger.info('[AgentEngine] LLM思考结果', {
          contentPreview: thought.content.substring(0, 200),
          hasToolCalls: !!(thought.toolCalls && thought.toolCalls.length > 0),
          toolCallCount: thought.toolCalls?.length || 0,
          toolCallNames: thought.toolCalls?.map(tc => tc.function.name) || []
        });

        if (thought.toolCalls && thought.toolCalls.length > 0) {
          this.state.messages.push({
            role: 'assistant',
            content: thought.content,
            toolCalls: thought.toolCalls,
            timestamp: Date.now(),
          });

          for (const toolCall of thought.toolCalls) {
            if (this.abortRequested) {
              return this.createResult(toolCalls, startTime, 'user_abort', '用户中止');
            }

            const toolName = toolCall.function.name;
            
            if (this.checkToolLoop(toolName)) {
              logger.warn('[AgentEngine] 检测到工具循环', { toolName, callCount: MAX_SAME_TOOL_CALLS });
              return this.createResult(
                toolCalls, 
                startTime, 
                'tool_loop', 
                `检测到工具循环：${toolName} 已连续调用 ${MAX_SAME_TOOL_CALLS} 次。请尝试其他方法或直接回答用户。`
              );
            }

            let toolArgs: Record<string, unknown> = {};
            
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
              logger.warn('[AgentEngine] 工具参数解析失败', { 
                toolName, 
                rawArgs: toolCall.function.arguments,
                error: String(parseError)
              });
              toolArgs = {};
            }

            logger.info('[AgentEngine] >>> 执行工具', { toolName, args: toolArgs });

            this.state.status = 'acting';
            this.state.currentAction = {
              type: 'tool_call',
              toolName,
              toolArgs,
            };
            onProgress?.(this.state);

            const executionResult = await this.executeTool(toolName, toolArgs);
            
            const toolResult = {
              name: toolName,
              args: toolArgs,
              result: executionResult.result,
              success: !executionResult.error,
              error: executionResult.error,
            };
            toolCalls.push(toolResult);

            const resultPreview = typeof executionResult.result === 'string'
              ? executionResult.result.substring(0, 300)
              : JSON.stringify(executionResult.result).substring(0, 300);

            logger.info('[AgentEngine] <<< 工具返回', { 
              toolName, 
              success: toolResult.success,
              resultPreview,
              error: executionResult.error
            });

            this.state.observations.push(
              `[工具 ${toolName}] ${executionResult.error || resultPreview}`
            );

            const toolContent = executionResult.error 
              ? `Tool error:\n${JSON.stringify({ error: executionResult.error }, null, 2)}`
              : `Tool result:\n${JSON.stringify(executionResult.result, null, 2)}`;

            this.state.messages.push({
              role: 'tool',
              content: toolContent,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            });
          }

          this.state.status = 'observing';
          onProgress?.(this.state);
          
          logger.info('[AgentEngine] 工具执行完成，继续下一轮迭代');
          continue;
        }

        this.state.messages.push({
          role: 'assistant',
          content: thought.content,
          timestamp: Date.now(),
        });

        logger.info('[AgentEngine] 无工具调用，视为最终回答，结束循环');
        
        this.state.status = 'responding';
        onProgress?.(this.state);
        
        return this.createResult(
          toolCalls, 
          startTime, 
          'final_answer', 
          thought.content
        );
      }

      logger.info('[AgentEngine] 达到最大迭代次数', { 
        iterations: this.state.iteration,
        maxIterations: this.config.maxIterations 
      });

      const lastAssistantMessage = [...this.state.messages]
        .reverse()
        .find(m => m.role === 'assistant');

      const response = lastAssistantMessage?.content || '任务执行完成，但未能生成最终回答。';
      
      return this.createResult(toolCalls, startTime, 'max_iterations', response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AgentEngine] 执行错误', { error: errorMessage, stack: (error as Error)?.stack });
      
      return {
        success: false,
        response: '',
        toolCalls,
        iterations: this.state.iteration,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - startTime,
        error: errorMessage,
        terminationReason: 'error',
      };
    }
  }

  private async runSimpleChat(
    _userMessage: string,
    onProgress?: (state: AgentState) => void
  ): Promise<AgentResult> {
    const startTime = Date.now();
    
    logger.info('[AgentEngine] 使用简单聊天模式');
    
    try {
      const thought = await this.think();
      
      this.state.status = 'responding';
      onProgress?.(this.state);
      
      return {
        success: true,
        response: thought.content,
        toolCalls: [],
        iterations: 1,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - startTime,
        terminationReason: 'final_answer',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        response: '',
        toolCalls: [],
        iterations: 1,
        tokensUsed: this.state.tokensUsed,
        duration: Date.now() - startTime,
        error: errorMessage,
        terminationReason: 'error',
      };
    }
  }

  private createResult(
    toolCalls: AgentResult['toolCalls'],
    startTime: number,
    terminationReason: AgentResult['terminationReason'],
    response: string
  ): AgentResult {
    const duration = Date.now() - startTime;
    
    this.state.terminationReason = terminationReason;
    this.state.status = terminationReason === 'error' ? 'error' : 'completed';

    logger.info('[AgentEngine] ========== 执行结束 ==========', {
      terminationReason,
      iterations: this.state.iteration,
      toolCallsCount: toolCalls.length,
      tokensUsed: this.state.tokensUsed,
      duration: `${duration}ms`,
      responseLength: response.length
    });

    return {
      success: terminationReason !== 'error' && terminationReason !== 'tool_loop',
      response,
      toolCalls,
      iterations: this.state.iteration,
      tokensUsed: this.state.tokensUsed,
      duration,
      terminationReason,
      error: terminationReason === 'error' ? response : undefined,
    };
  }

  private async think(): Promise<{ content: string; toolCalls?: LLMToolCall[] }> {
    const systemPrompt = await this.buildSystemPrompt();

    const history = this.state.messages.slice(-MAX_CONTEXT_MESSAGES);

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
        toolCallId: m.toolCallId,
        toolCalls: m.toolCalls,
      })),
    ];

    const tools = this.getToolDefinitions();

    logger.debug('[AgentEngine] 调用LLM', {
      messageCount: messages.length,
      historyCount: history.length,
      toolCount: tools.length,
      hasTools: tools.length > 0
    });

    const response = await llmService.chat({
      messages,
      temperature: this.config.temperature,
      maxTokens: 1000,
      tools: tools.length > 0 ? tools : undefined,
      toolChoice: tools.length > 0 ? 'auto' : undefined,
    });

    this.state.tokensUsed += response.usage.totalTokens;

    return {
      content: response.content,
      toolCalls: response.toolCalls,
    };
  }

  private getToolDefinitions(): ToolDefinition[] {
    const tools = this.toolRegistry.getAll();
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.definition.name,
        description: tool.definition.description,
        parameters: {
          type: 'object',
          properties: tool.definition.parameters,
          required: tool.definition.required || [],
        },
      },
    }));
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ result: unknown; error?: string }> {
    const tool = this.toolRegistry.get(name);

    if (!tool) {
      const error = `工具 "${name}" 不存在`;
      logger.error('[AgentEngine] 工具不存在', { toolName: name });
      return { result: null, error };
    }

    try {
      const result = await this.toolRegistry.execute(
        { id: `call_${Date.now()}`, name, arguments: args, status: 'pending', startTime: Date.now() },
        { projectPath: this.projectPath, sessionId: 'default' }
      );

      if (!result.success) {
        return { result: null, error: result.error || '工具执行失败' };
      }

      return { result: result.result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AgentEngine] 工具执行异常', { toolName: name, error: errorMessage });
      return { result: null, error: errorMessage };
    }
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
      }
    }

    prompt += '\n\n## 当前状态\n';
    prompt += `迭代: ${this.state.iteration}/${this.config.maxIterations}\n`;
    
    if (this.state.observations.length > 0) {
      prompt += '\n## 已执行的步骤\n';
      for (const obs of this.state.observations.slice(-5)) {
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
    this.abortRequested = true;
    if (this.executionController) {
      this.executionController.cancel();
    }
    logger.info('[AgentEngine] 执行已取消');
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
