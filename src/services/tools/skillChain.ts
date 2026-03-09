import { SkillExecutionContext, SkillExecutionResult } from '@/types/tools/skillDefinition';
import { SkillLoader, SkillExecutor } from '../tools/skillLoader';

export type ChainExecutionMode = 'sequential' | 'parallel' | 'conditional';

export interface ChainConfig {
  id: string;
  name: string;
  description: string;
  mode: ChainExecutionMode;
  skills: ChainStep[];
  onError: 'stop' | 'continue' | 'fallback';
  fallbackSkill?: string;
  maxRetries: number;
  timeout: number;
}

export interface ChainStep {
  skillId: string;
  condition?: string;
  variables?: Record<string, unknown>;
  onSuccess?: string[];
  onFailure?: string[];
  retryCount?: number;
}

export interface ChainExecutionResult {
  chainId: string;
  success: boolean;
  steps: StepResult[];
  totalDuration: number;
  finalOutput: string;
  errors: string[];
}

export interface StepResult {
  skillId: string;
  success: boolean;
  output: string;
  duration: number;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export class SkillChainExecutor {
  private loader: SkillLoader;
  private executor: SkillExecutor;
  private chains: Map<string, ChainConfig> = new Map();

  constructor(loader: SkillLoader, executor: SkillExecutor) {
    this.loader = loader;
    this.executor = executor;
  }

  registerChain(config: ChainConfig): void {
    this.chains.set(config.id, config);
  }

  unregisterChain(chainId: string): void {
    this.chains.delete(chainId);
  }

  getChain(chainId: string): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  async executeChain(
    chainId: string,
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now();
    const chain = this.chains.get(chainId);

    if (!chain) {
      return {
        chainId,
        success: false,
        steps: [],
        totalDuration: Date.now() - startTime,
        finalOutput: '',
        errors: [`Chain not found: ${chainId}`],
      };
    }

    const steps: StepResult[] = [];
    const errors: string[] = [];
    let finalOutput = '';
    const history: SkillExecutionContext['history'] = [];

    for (const step of chain.skills) {
      const stepResult = await this.executeStep(step, context, history, chain);
      steps.push(stepResult);

      if (stepResult.success) {
        history.push({
          skillId: step.skillId,
          input: context.input,
          output: stepResult.output,
          timestamp: Date.now(),
        });
        finalOutput = stepResult.output;
      } else {
        errors.push(`Step ${step.skillId} failed: ${stepResult.error}`);

        if (chain.onError === 'stop') {
          break;
        } else if (chain.onError === 'fallback' && chain.fallbackSkill) {
          const fallbackResult = await this.executeStep(
            { skillId: chain.fallbackSkill },
            context,
            history,
            chain
          );
          steps.push(fallbackResult);
          if (fallbackResult.success) {
            finalOutput = fallbackResult.output;
          }
          break;
        }
      }
    }

    return {
      chainId,
      success: errors.length === 0,
      steps,
      totalDuration: Date.now() - startTime,
      finalOutput,
      errors,
    };
  }

  private async executeStep(
    step: ChainStep,
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>,
    history: SkillExecutionContext['history'],
    chain: ChainConfig
  ): Promise<StepResult> {
    const startTime = Date.now();
    const skill = this.loader.get(step.skillId);

    if (!skill) {
      return {
        skillId: step.skillId,
        success: false,
        output: '',
        duration: Date.now() - startTime,
        error: `Skill not found: ${step.skillId}`,
      };
    }

    if (step.condition) {
      const conditionMet = this.evaluateCondition(step.condition, context, history);
      if (!conditionMet) {
        return {
          skillId: step.skillId,
          success: true,
          output: '',
          duration: 0,
          skipped: true,
          skipReason: `Condition not met: ${step.condition}`,
        };
      }
    }

    const mergedVariables = { ...context.variables, ...step.variables };
    const maxRetries = step.retryCount ?? chain.maxRetries ?? 0;
    let lastError: string | undefined;
    let lastOutput = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.executor.execute({
        ...context,
        skillId: step.skillId,
        variables: mergedVariables,
        history,
      });

      if (result.success) {
        return {
          skillId: step.skillId,
          success: true,
          output: result.output,
          duration: Date.now() - startTime,
        };
      }

      lastError = result.error;
      lastOutput = result.output;
    }

    return {
      skillId: step.skillId,
      success: false,
      output: lastOutput,
      duration: Date.now() - startTime,
      error: lastError,
    };
  }

  private evaluateCondition(
    condition: string,
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>,
    history: SkillExecutionContext['history']
  ): boolean {
    try {
      if (condition.startsWith('has_variable:')) {
        const varName = condition.substring('has_variable:'.length).trim();
        return varName in context.variables;
      }

      if (condition.startsWith('history_contains:')) {
        const skillId = condition.substring('history_contains:'.length).trim();
        return history.some((h) => h.skillId === skillId);
      }

      if (condition.startsWith('variable_equals:')) {
        const [varName, value] = condition.substring('variable_equals:'.length).split('=');
        return String(context.variables[varName.trim()]) === value.trim();
      }

      return true;
    } catch {
      return false;
    }
  }

  async executeParallel(
    skillIds: string[],
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>
  ): Promise<SkillExecutionResult[]> {
    const promises = skillIds.map((skillId) =>
      this.executor.execute({
        ...context,
        skillId,
        history: [],
      })
    );

    return Promise.all(promises);
  }

  async executeWithDependencies(
    skillId: string,
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>
  ): Promise<SkillExecutionResult[]> {
    const resolvedSkills = this.loader.resolveDependencies(skillId);
    const results: SkillExecutionResult[] = [];
    const history: SkillExecutionContext['history'] = [];

    for (const id of resolvedSkills) {
      const result = await this.executor.execute({
        ...context,
        skillId: id,
        history,
      });

      results.push(result);

      if (result.success) {
        history.push({
          skillId: id,
          input: context.input,
          output: result.output,
          timestamp: Date.now(),
        });
      } else {
        break;
      }
    }

    return results;
  }

  buildChainFromSkill(skillId: string): ChainConfig | null {
    const skill = this.loader.get(skillId);
    if (!skill || !skill.chain) {
      return null;
    }

    const steps: ChainStep[] = [];

    if (skill.chain.before) {
      for (const id of skill.chain.before) {
        steps.push({ skillId: id });
      }
    }

    steps.push({ skillId });

    if (skill.chain.after) {
      for (const id of skill.chain.after) {
        steps.push({ skillId: id });
      }
    }

    return {
      id: `auto_chain_${skillId}`,
      name: `Auto Chain: ${skill.name}`,
      description: `Automatically generated chain for ${skill.name}`,
      mode: 'sequential',
      skills: steps,
      onError: 'stop',
      maxRetries: 0,
      timeout: 60000,
    };
  }
}

export function createSkillChainExecutor(
  loader: SkillLoader,
  executor: SkillExecutor
): SkillChainExecutor {
  return new SkillChainExecutor(loader, executor);
}

export const DEFAULT_CHAINS: ChainConfig[] = [
  {
    id: 'write_chapter',
    name: '写章节流程',
    description: '完整的章节创作流程',
    mode: 'sequential',
    skills: [
      { skillId: 'character_card', condition: 'has_variable:characters' },
      { skillId: 'golden_three_chapters', condition: 'variable_equals:chapter=1' },
      { skillId: 'write_chapter_content' },
      { skillId: 'climax_checker' },
      { skillId: 'logic_police' },
    ],
    onError: 'continue',
    maxRetries: 1,
    timeout: 120000,
  },
  {
    id: 'create_outline',
    name: '创建大纲',
    description: '从零开始创建小说大纲',
    mode: 'sequential',
    skills: [
      { skillId: 'worldbuilding_template' },
      { skillId: 'character_card' },
      { skillId: 'outline_workflow' },
      { skillId: 'foreshadowing_planner' },
    ],
    onError: 'stop',
    maxRetries: 0,
    timeout: 180000,
  },
  {
    id: 'review_content',
    name: '内容审核',
    description: '多维度审核内容质量',
    mode: 'parallel',
    skills: [
      { skillId: 'logic_police' },
      { skillId: 'emotion_master' },
      { skillId: 'commercial_editor' },
      { skillId: 'style_guardian' },
    ],
    onError: 'continue',
    maxRetries: 0,
    timeout: 60000,
  },
];
