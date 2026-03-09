import {
  ToolChain,
  ToolChainTemplate,
  ChainStep,
  ChainExecutionResult,
  ChainVariable,
  BUILTIN_CHAIN_TEMPLATES,
  ChainStepStatus,
} from '@/types/tools/toolChain';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

type ToolExecutor = (
  args: Record<string, unknown>,
  context: Record<string, unknown>
) => Promise<unknown>;

export class ToolChainService {
  private projectPath: string;
  private chains: Map<string, ToolChain> = new Map();
  private templates: Map<string, ToolChainTemplate> = new Map();
  private toolExecutors: Map<string, ToolExecutor> = new Map();
  private currentChain: ToolChain | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadBuiltInTemplates();
    this.loadFromDisk();
  }

  private loadBuiltInTemplates(): void {
    for (const template of BUILTIN_CHAIN_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const chainsPath = `${this.projectPath}/.ai-workshop/chains.json`;
      const templatesPath = `${this.projectPath}/.ai-workshop/custom_chains.json`;

      const chainsContent = await workshopService.readFile(chainsPath);
      if (chainsContent) {
        const data: ToolChain[] = JSON.parse(chainsContent);
        this.chains = new Map(data.map((c) => [c.id, c]));
      }

      const templatesContent = await workshopService.readFile(templatesPath);
      if (templatesContent) {
        const data: ToolChainTemplate[] = JSON.parse(templatesContent);
        for (const template of data) {
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      logger.error('加载工具链数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const chainsPath = `${this.projectPath}/.ai-workshop/chains.json`;
      const templatesPath = `${this.projectPath}/.ai-workshop/custom_chains.json`;

      await workshopService.writeFile(
        chainsPath,
        JSON.stringify(Array.from(this.chains.values()), null, 2)
      );

      const customTemplates = Array.from(this.templates.values()).filter(
        (t) => !BUILTIN_CHAIN_TEMPLATES.some((b) => b.id === t.id)
      );
      await workshopService.writeFile(templatesPath, JSON.stringify(customTemplates, null, 2));
    } catch (error) {
      logger.error('保存工具链数据失败', { error });
    }
  }

  registerTool(name: string, executor: ToolExecutor): void {
    this.toolExecutors.set(name, executor);
  }

  getTemplates(): ToolChainTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): ToolChainTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category);
  }

  getTemplate(id: string): ToolChainTemplate | undefined {
    return this.templates.get(id);
  }

  createTemplate(template: Omit<ToolChainTemplate, 'id'>): ToolChainTemplate {
    const newTemplate: ToolChainTemplate = {
      ...template,
      id: `chain_custom_${uuidv4()}`,
    };
    this.templates.set(newTemplate.id, newTemplate);
    this.saveToDisk();
    return newTemplate;
  }

  updateTemplate(id: string, updates: Partial<ToolChainTemplate>): ToolChainTemplate | null {
    const template = this.templates.get(id);
    if (!template) {
      return null;
    }

    const updated = { ...template, ...updates };
    this.templates.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  deleteTemplate(id: string): boolean {
    if (BUILTIN_CHAIN_TEMPLATES.some((t) => t.id === id)) {
      return false;
    }
    const result = this.templates.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  createChain(templateId: string, variables: Record<string, unknown>): ToolChain | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const validation = this.validateVariables(template.variables, variables);
    if (!validation.valid) {
      logger.error('变量验证失败', { errors: validation.errors });
      return null;
    }

    const context = { ...variables };
    const steps: ChainStep[] = template.steps.map((step, index) => ({
      ...step,
      id: `step_${index}_${uuidv4()}`,
      status: 'pending' as ChainStepStatus,
    }));

    const chain: ToolChain = {
      id: `chain_${uuidv4()}`,
      name: template.name,
      description: template.description,
      steps,
      status: 'pending',
      createdAt: Date.now(),
      context,
      results: {},
    };

    this.chains.set(chain.id, chain);
    this.saveToDisk();
    return chain;
  }

  private validateVariables(
    variableDefs: ChainVariable[],
    values: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const varDef of variableDefs) {
      if (varDef.required && !(varDef.name in values)) {
        if (varDef.defaultValue === undefined) {
          errors.push(`缺少必需变量: ${varDef.name}`);
        }
      }

      if (varDef.name in values) {
        const value = values[varDef.name];
        const typeMatch = this.checkType(value, varDef.type);
        if (!typeMatch) {
          errors.push(`变量 ${varDef.name} 类型错误，期望 ${varDef.type}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private checkType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  async executeChain(chainId: string): Promise<ChainExecutionResult> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      return {
        chainId,
        success: false,
        steps: [],
        outputs: {},
        error: 'Chain not found',
        duration: 0,
      };
    }

    if (chain.status === 'running') {
      return {
        chainId,
        success: false,
        steps: chain.steps,
        outputs: chain.results,
        error: 'Chain is already running',
        duration: 0,
      };
    }

    this.currentChain = chain;
    chain.status = 'running';
    chain.startedAt = Date.now();
    const startTime = Date.now();

    try {
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];

        const shouldExecute = await this.evaluateCondition(step, chain);
        if (!shouldExecute) {
          step.status = 'skipped';
          continue;
        }

        step.status = 'running';
        step.startTime = Date.now();

        try {
          const resolvedArgs = this.resolveArgs(step.args, chain, i);
          const executor = this.toolExecutors.get(step.toolName);

          if (!executor) {
            throw new Error(`Tool not found: ${step.toolName}`);
          }

          const result = await this.executeWithTimeout(
            executor,
            resolvedArgs,
            chain.context,
            step.timeout || 60000
          );

          step.result = result;
          step.status = 'completed';
          step.endTime = Date.now();

          if (step.outputMapping) {
            for (const [key, path] of Object.entries(step.outputMapping)) {
              const value = this.extractValue(result, path as string);
              chain.results[key] = value;
            }
          }

          chain.results[`step_${i}`] = result;
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : String(error);
          step.endTime = Date.now();

          const retryCount = step.retryCount || 0;
          if (retryCount > 0) {
            i--;
            step.retryCount = retryCount - 1;
            step.status = 'pending';
            continue;
          }

          if (step.condition?.type !== 'on_failure') {
            chain.status = 'failed';
            chain.completedAt = Date.now();
            this.saveToDisk();

            return {
              chainId,
              success: false,
              steps: chain.steps,
              outputs: chain.results,
              error: `Step ${step.name} failed: ${step.error}`,
              duration: Date.now() - startTime,
            };
          }
        }
      }

      chain.status = 'completed';
      chain.completedAt = Date.now();
      this.saveToDisk();

      return {
        chainId,
        success: true,
        steps: chain.steps,
        outputs: chain.results,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      chain.status = 'failed';
      chain.completedAt = Date.now();
      this.saveToDisk();

      return {
        chainId,
        success: false,
        steps: chain.steps,
        outputs: chain.results,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    } finally {
      this.currentChain = null;
    }
  }

  private async evaluateCondition(step: ChainStep, chain: ToolChain): Promise<boolean> {
    if (!step.condition) {
      return true;
    }

    switch (step.condition.type) {
      case 'always':
        return true;

      case 'on_success': {
        const prevStep = chain.steps[chain.steps.findIndex((s) => s.id === step.id) - 1];
        return prevStep?.status === 'completed';
      }

      case 'on_failure': {
        const prevStep = chain.steps[chain.steps.findIndex((s) => s.id === step.id) - 1];
        return prevStep?.status === 'failed';
      }

      case 'custom':
        if (step.condition.expression) {
          return this.evaluateExpression(step.condition.expression, chain);
        }
        return true;

      default:
        return true;
    }
  }

  private evaluateExpression(expression: string, chain: ToolChain): boolean {
    try {
      const context = { ...chain.context, ...chain.results };
      const func = new Function('context', `return ${expression}`);
      return func(context);
    } catch {
      return false;
    }
  }

  private resolveArgs(
    args: Record<string, unknown>,
    chain: ToolChain,
    stepIndex: number
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      resolved[key] = this.resolveValue(value, chain, stepIndex);
    }

    return resolved;
  }

  private resolveValue(value: unknown, chain: ToolChain, stepIndex: number): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    if (value.startsWith('$var.')) {
      const varName = value.slice(5);
      return chain.context[varName];
    }

    if (value.startsWith('$step.')) {
      const path = value.slice(6);
      const [stepNum, ...rest] = path.split('.');
      const stepIdx = parseInt(stepNum, 10);
      if (!isNaN(stepIdx) && stepIdx < stepIndex) {
        const stepResult = chain.results[`step_${stepIdx}`];
        return this.extractValue(stepResult, rest.join('.'));
      }
    }

    if (value.startsWith('$result.')) {
      const resultKey = value.slice(8);
      return chain.results[resultKey];
    }

    if (value.includes('$var.') || value.includes('$step.') || value.includes('$result.')) {
      return this.interpolateString(value, chain, stepIndex);
    }

    return value;
  }

  private interpolateString(template: string, chain: ToolChain, _stepIndex: number): string {
    return template
      .replace(/\$var\.(\w+)/g, (_, name) => String(chain.context[name] || ''))
      .replace(/\$step\.(\d+)\.result(?:\.(\w+))?/g, (_, num, prop) => {
        const stepIdx = parseInt(num, 10);
        const stepResult = chain.results[`step_${stepIdx}`];
        if (prop && stepResult && typeof stepResult === 'object') {
          return String((stepResult as Record<string, unknown>)[prop] || '');
        }
        return String(stepResult || '');
      })
      .replace(/\$result\.(\w+)/g, (_, name) => String(chain.results[name] || ''));
  }

  private extractValue(obj: unknown, path: string): unknown {
    if (!obj || !path) {
      return obj;
    }

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private async executeWithTimeout(
    executor: ToolExecutor,
    args: Record<string, unknown>,
    context: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Tool execution timeout'));
      }, timeout);

      executor(args, context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  getChain(id: string): ToolChain | undefined {
    return this.chains.get(id);
  }

  getAllChains(): ToolChain[] {
    return Array.from(this.chains.values());
  }

  getRunningChains(): ToolChain[] {
    return Array.from(this.chains.values()).filter((c) => c.status === 'running');
  }

  cancelChain(chainId: string): boolean {
    const chain = this.chains.get(chainId);
    if (!chain || chain.status !== 'running') {
      return false;
    }

    chain.status = 'cancelled';
    chain.completedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  deleteChain(chainId: string): boolean {
    const result = this.chains.delete(chainId);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  async suggestChainForIntent(
    intent: string,
    context: Record<string, unknown>
  ): Promise<ToolChainTemplate | null> {
    const prompt = `分析以下用户意图，推荐最合适的工具链模板。

用户意图: ${intent}
上下文: ${JSON.stringify(context)}

可用模板:
${Array.from(this.templates.values())
  .map((t) => `- ${t.id}: ${t.name} - ${t.description}`)
  .join('\n')}

请返回最合适的模板ID，只返回ID，不要其他内容。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 100,
      });

      const templateId = response.content.trim();
      return this.templates.get(templateId) || null;
    } catch {
      return null;
    }
  }

  getCurrentChain(): ToolChain | null {
    return this.currentChain;
  }

  getChainProgress(chainId: string): {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    current: number;
  } | null {
    const chain = this.chains.get(chainId);
    if (!chain) {
      return null;
    }

    const total = chain.steps.length;
    const completed = chain.steps.filter((s) => s.status === 'completed').length;
    const failed = chain.steps.filter((s) => s.status === 'failed').length;
    const skipped = chain.steps.filter((s) => s.status === 'skipped').length;
    const current = chain.steps.findIndex((s) => s.status === 'running');

    return { total, completed, failed, skipped, current };
  }
}

export function createToolChainService(projectPath: string): ToolChainService {
  return new ToolChainService(projectPath);
}
