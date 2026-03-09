import { workshopService } from '../core/workshopService';
import {
  AgentDefinition,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentPlan,
  PlanStep,
  ToolHandler,
} from '@/types/ai/agentDefinition';
import { logger } from '../core/loggerService';

function generateId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class AgentLoader {
  private projectPath: string;
  private agents: Map<string, AgentDefinition> = new Map();
  private agentsByType: Map<string, Set<string>> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async loadAll(): Promise<AgentDefinition[]> {
    const agentsPath = `${this.projectPath}/.ai-workshop/agents`;
    const loadedAgents: AgentDefinition[] = [];

    const loadFromDir = async (dir: string) => {
      try {
        const entries = await workshopService.readDirectory(dir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            const agent = await this.load(`${dir}/${entry.name}`);
            if (agent) {
              loadedAgents.push(agent);
            }
          }
        }
      } catch (error) {
        logger.error('加载 Agent 失败', { dir, error });
      }
    };

    await loadFromDir(`${agentsPath}/system`);
    await loadFromDir(`${agentsPath}/user`);

    for (const agent of loadedAgents) {
      this.agents.set(agent.id, agent);

      if (!this.agentsByType.has(agent.type)) {
        this.agentsByType.set(agent.type, new Set());
      }
      this.agentsByType.get(agent.type)!.add(agent.id);
    }

    return loadedAgents;
  }

  async load(agentPath: string): Promise<AgentDefinition | null> {
    try {
      const manifestPath = `${agentPath}/agent.yaml`;
      const promptPath = `${agentPath}/prompt.md`;

      const manifestExists = await workshopService.pathExists(manifestPath);
      if (!manifestExists) {
        logger.warn('Agent 配置文件不存在', { manifestPath });
        return null;
      }

      const manifestContent = await workshopService.readFile(manifestPath);
      const manifest = workshopService.parseYaml(manifestContent);
      if (!manifest) {
        logger.warn('解析 Agent 配置失败', { manifestPath });
        return null;
      }

      let prompt = { system: '' };
      const promptExists = await workshopService.pathExists(promptPath);
      if (promptExists) {
        const promptContent = await workshopService.readFile(promptPath);
        prompt = this.parsePromptFile(promptContent);
      }

      const agent: AgentDefinition = {
        id: (manifest.id as string) || generateId(),
        name: (manifest.name as string) || '未命名Agent',
        version: (manifest.version as string) || '1.0.0',
        description: (manifest.description as string) || '',
        type: (manifest.type as AgentDefinition['type']) || 'custom',
        prompt,
        triggers: (manifest.triggers as AgentDefinition['triggers']) || [],
        tools: (manifest.tools as string[]) || [],
        enabled: (manifest.enabled as boolean) ?? true,
        priority: (manifest.priority as number) ?? 0,
        maxIterations: (manifest.maxIterations as number) ?? 3,
        timeout: (manifest.timeout as number) ?? 60000,
        outputFormat: (manifest.outputFormat as AgentDefinition['outputFormat']) || {
          type: 'text',
        },
        hooks: manifest.hooks as AgentDefinition['hooks'] | undefined,
        metadata: manifest.metadata as Record<string, unknown> | undefined,
      };

      return agent;
    } catch (error) {
      logger.error('加载 Agent 失败', { agentPath, error });
      return null;
    }
  }

  private parsePromptFile(content: string): AgentDefinition['prompt'] {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (frontmatterMatch) {
      const [, frontmatter, body] = frontmatterMatch;
      const parsed = workshopService.parseYaml(frontmatter);

      return {
        system: body.trim(),
        userTemplate: parsed?.userTemplate as string | undefined,
        variables: parsed?.variables as AgentDefinition['prompt']['variables'] | undefined,
      };
    }

    return { system: content.trim() };
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  getByType(type: AgentDefinition['type']): AgentDefinition[] {
    const ids = this.agentsByType.get(type);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((id) => this.agents.get(id)!)
      .filter(Boolean);
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  getEnabled(): AgentDefinition[] {
    return this.getAll()
      .filter((a) => a.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  getByTrigger(trigger: AgentDefinition['triggers'][0]['type']): AgentDefinition[] {
    return this.getAll()
      .filter((a) => a.enabled && a.triggers.some((t) => t.type === trigger))
      .sort((a, b) => {
        const aTrigger = a.triggers.find((t) => t.type === trigger);
        const bTrigger = b.triggers.find((t) => t.type === trigger);
        return (bTrigger?.priority || 0) - (aTrigger?.priority || 0);
      });
  }
}

export class AgentExecutor {
  private loader: AgentLoader;
  private tools: Map<string, ToolHandler> = new Map();
  private callAI: (prompt: string, systemPrompt: string) => Promise<string>;

  constructor(
    loader: AgentLoader,
    callAI: (prompt: string, systemPrompt: string) => Promise<string>
  ) {
    this.loader = loader;
    this.callAI = callAI;
    this.registerBuiltinTools();
  }

  private registerBuiltinTools(): void {
    this.registerTool({
      name: 'read_file',
      description: '读取文件内容',
      handler: async (params) => {
        const content = await workshopService.readFile(params.path as string);
        return { content };
      },
      schema: {
        input: {
          path: { type: 'string', description: '文件路径', required: true },
        },
        output: {
          content: { type: 'string', description: '文件内容', required: true },
        },
      },
    });

    this.registerTool({
      name: 'write_file',
      description: '写入文件内容',
      handler: async (params) => {
        await workshopService.writeFile(params.path as string, params.content as string);
        return { success: true };
      },
      schema: {
        input: {
          path: { type: 'string', description: '文件路径', required: true },
          content: { type: 'string', description: '文件内容', required: true },
        },
        output: {
          success: { type: 'boolean', description: '是否成功', required: true },
        },
      },
    });

    this.registerTool({
      name: 'list_files',
      description: '列出目录下的文件',
      handler: async (params) => {
        const files = await workshopService.readDirectory(params.path as string);
        return { files };
      },
      schema: {
        input: {
          path: { type: 'string', description: '目录路径', required: true },
        },
        output: {
          files: { type: 'array', description: '文件列表', required: true },
        },
      },
    });
  }

  registerTool(tool: ToolHandler): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  getTool(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  async execute(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const agent = this.loader.get(context.agentId);

    if (!agent) {
      return {
        agentId: context.agentId,
        success: false,
        output: '',
        error: `Agent not found: ${context.agentId}`,
        duration: Date.now() - startTime,
        iterations: 0,
      };
    }

    try {
      const systemPrompt = this.buildSystemPrompt(agent, context);
      const userPrompt = this.buildUserPrompt(agent, context);

      let output = '';
      let iterations = 0;
      let success = false;

      for (let i = 0; i < agent.maxIterations; i++) {
        iterations++;

        const response = await this.callAI(userPrompt, systemPrompt);
        output = response;

        const toolCalls = this.extractToolCalls(response);
        if (toolCalls.length > 0) {
          const toolResults = await this.executeTools(toolCalls, context);
          const toolResultsStr = toolResults.map((r) => JSON.stringify(r)).join('\n');
          output = `${response}\n\n工具执行结果:\n${toolResultsStr}`;
        }

        if (this.shouldTerminate(output, agent)) {
          success = true;
          break;
        }
      }

      const structuredOutput = this.parseOutput(output, agent);

      return {
        agentId: context.agentId,
        success,
        output,
        structuredOutput,
        duration: Date.now() - startTime,
        iterations,
      };
    } catch (error) {
      return {
        agentId: context.agentId,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        iterations: 0,
      };
    }
  }

  private buildSystemPrompt(agent: AgentDefinition, context: AgentExecutionContext): string {
    let prompt = agent.prompt.system;

    if (agent.tools.length > 0) {
      prompt += '\n\n## 可用工具\n\n';
      for (const toolName of agent.tools) {
        const tool = this.tools.get(toolName);
        if (tool) {
          prompt += `### ${tool.name}\n${tool.description}\n输入: ${JSON.stringify(tool.schema.input)}\n\n`;
        }
      }
    }

    if (context.memory && Object.keys(context.memory).length > 0) {
      prompt += '\n\n## 项目记忆\n';
      prompt += JSON.stringify(context.memory, null, 2);
    }

    return prompt;
  }

  private buildUserPrompt(agent: AgentDefinition, context: AgentExecutionContext): string {
    if (agent.prompt.userTemplate) {
      let prompt = agent.prompt.userTemplate;

      for (const [key, value] of Object.entries(context.variables)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }

      prompt = prompt.replace('{input}', context.input);

      return prompt;
    }

    return context.input;
  }

  private extractToolCalls(
    output: string
  ): Array<{ name: string; params: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const regex = /@tool:\s*(\w+)\s*\n\s*```json\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(output)) !== null) {
      try {
        toolCalls.push({
          name: match[1],
          params: JSON.parse(match[2]),
        });
      } catch {
        logger.warn('解析工具调用失败', { params: match[2] });
      }
    }

    return toolCalls;
  }

  private async executeTools(
    toolCalls: Array<{ name: string; params: Record<string, unknown> }>,
    context: AgentExecutionContext
  ): Promise<unknown[]> {
    const results: unknown[] = [];

    for (const call of toolCalls) {
      const tool = this.tools.get(call.name);
      if (tool) {
        try {
          const result = await tool.handler(call.params, context);
          results.push({ name: call.name, success: true, result });
        } catch (error) {
          results.push({
            name: call.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        results.push({ name: call.name, success: false, error: 'Tool not found' });
      }
    }

    return results;
  }

  private shouldTerminate(output: string, _agent: AgentDefinition): boolean {
    return output.includes('[DONE]') || output.includes('[COMPLETE]');
  }

  private parseOutput(output: string, agent: AgentDefinition): Record<string, unknown> | undefined {
    if (agent.outputFormat.type === 'json') {
      const jsonMatch = output.match(/```json\n([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          return undefined;
        }
      }
    }

    if (agent.outputFormat.type === 'structured' && agent.outputFormat.schema) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(agent.outputFormat.schema || {})) {
        const regex = new RegExp(`## ${key}\\n([\\s\\S]*?)(?=##|$)`);
        const match = output.match(regex);
        if (match) {
          result[key] = match[1].trim();
        }
      }
      return result;
    }

    return undefined;
  }
}

export class AgentOrchestrator {
  private loader: AgentLoader;
  private executor: AgentExecutor;

  constructor(loader: AgentLoader, executor: AgentExecutor) {
    this.loader = loader;
    this.executor = executor;
  }

  async plan(
    input: string,
    context: Omit<AgentExecutionContext, 'agentId' | 'history'>
  ): Promise<AgentPlan> {
    const plannerAgents = this.loader.getByType('planner');

    if (plannerAgents.length === 0) {
      return this.createDefaultPlan(input);
    }

    const planner = plannerAgents[0];
    const result = await this.executor.execute({
      ...context,
      agentId: planner.id,
      history: [],
    });

    if (result.success && result.structuredOutput) {
      return this.parsePlan(result.structuredOutput as Record<string, unknown>);
    }

    return this.createDefaultPlan(input);
  }

  private createDefaultPlan(input: string): AgentPlan {
    return {
      id: generateId(),
      agentId: 'planner',
      steps: [
        { id: 'step_1', type: 'call_agent', target: 'executor', input, status: 'pending' },
        { id: 'step_2', type: 'call_agent', target: 'reviewer', status: 'pending' },
      ],
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  private parsePlan(output: Record<string, unknown>): AgentPlan {
    const steps: PlanStep[] = [];
    const rawSteps = (output.steps as Array<Record<string, unknown>>) || [];

    for (let i = 0; i < rawSteps.length; i++) {
      const step = rawSteps[i];
      steps.push({
        id: `step_${i + 1}`,
        type: step.type as PlanStep['type'],
        target: step.target as string,
        input: step.input as string | undefined,
        condition: step.condition as string | undefined,
        status: 'pending',
      });
    }

    return {
      id: generateId(),
      agentId: 'planner',
      steps,
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  async executePlan(
    plan: AgentPlan,
    context: Omit<AgentExecutionContext, 'agentId' | 'history'>
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];
    const history: AgentExecutionContext['history'] = [];

    plan.status = 'executing';

    for (const step of plan.steps) {
      if (step.status === 'skipped') {
        continue;
      }

      step.status = 'running';

      try {
        let result: AgentExecutionResult | null = null;

        switch (step.type) {
          case 'call_agent':
            result = await this.executor.execute({
              ...context,
              agentId: step.target,
              input: step.input || context.input,
              history: [...history],
            });
            break;

          case 'call_skill':
            result = await this.executor.execute({
              ...context,
              agentId: 'skill_executor',
              input: step.input || context.input,
              history: [...history],
              variables: { skillId: step.target },
            });
            break;

          case 'condition': {
            const conditionMet = this.evaluateCondition(step.condition || '', context);
            if (!conditionMet) {
              step.status = 'skipped';
              continue;
            }
            break;
          }

          case 'wait':
            await new Promise((resolve) => setTimeout(resolve, 1000));
            break;
        }

        if (result) {
          results.push(result);
          history.push({
            agentId: step.target,
            input: step.input || context.input,
            output: result.output,
            success: result.success,
            timestamp: Date.now(),
            duration: result.duration,
          });

          if (result.success) {
            step.status = 'completed';
            step.result = result.structuredOutput || result.output;
          } else {
            step.status = 'failed';
            plan.status = 'failed';
            break;
          }
        } else {
          step.status = 'completed';
        }
      } catch {
        step.status = 'failed';
        plan.status = 'failed';
        break;
      }
    }

    if (plan.status === 'executing') {
      plan.status = 'completed';
    }

    return results;
  }

  private evaluateCondition(
    condition: string,
    context: Omit<AgentExecutionContext, 'agentId' | 'history'>
  ): boolean {
    try {
      if (condition.startsWith('has_variable:')) {
        const varName = condition.substring('has_variable:'.length).trim();
        return varName in context.variables;
      }
      return true;
    } catch {
      return false;
    }
  }

  async runAgentLoop(
    input: string,
    context: Omit<AgentExecutionContext, 'agentId' | 'history'>,
    maxIterations: number = 5
  ): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];

    for (let i = 0; i < maxIterations; i++) {
      const plan = await this.plan(input, context);
      const planResults = await this.executePlan(plan, context);
      results.push(...planResults);

      const lastResult = planResults[planResults.length - 1];
      if (lastResult?.success && this.isTaskComplete(lastResult.output)) {
        break;
      }

      input = `继续优化:\n${lastResult?.output || ''}`;
    }

    return results;
  }

  private isTaskComplete(output: string): boolean {
    return (
      output.includes('[DONE]') || output.includes('[COMPLETE]') || output.includes('任务完成')
    );
  }
}

export function createAgentLoader(projectPath: string): AgentLoader {
  return new AgentLoader(projectPath);
}

export function createAgentExecutor(
  loader: AgentLoader,
  callAI: (prompt: string, systemPrompt: string) => Promise<string>
): AgentExecutor {
  return new AgentExecutor(loader, callAI);
}

export function createAgentOrchestrator(
  loader: AgentLoader,
  executor: AgentExecutor
): AgentOrchestrator {
  return new AgentOrchestrator(loader, executor);
}
