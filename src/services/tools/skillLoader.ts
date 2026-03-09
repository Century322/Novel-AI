import { workshopService } from '../core/workshopService';
import {
  SkillDefinition,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillVariable,
} from '@/types/tools/skillDefinition';
import { WorkshopSkillCategory } from '@/types/core/workshop';
import { logger } from '../core/loggerService';

function generateId(): string {
  return `skill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class SkillLoader {
  private projectPath: string;
  private skills: Map<string, SkillDefinition> = new Map();
  private skillsByCategory: Map<WorkshopSkillCategory, Set<string>> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async loadAll(): Promise<SkillDefinition[]> {
    const skillsPath = `${this.projectPath}/.ai-workshop/skills`;
    const loadedSkills: SkillDefinition[] = [];

    const loadFromDir = async (dir: string) => {
      try {
        const entries = await workshopService.readDirectory(dir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            const skill = await this.load(`${dir}/${entry.name}`);
            if (skill) {
              loadedSkills.push(skill);
            }
          }
        }
      } catch (error) {
        logger.error('加载技能失败', { dir, error });
      }
    };

    await loadFromDir(`${skillsPath}/system`);
    await loadFromDir(`${skillsPath}/user`);

    for (const skill of loadedSkills) {
      this.skills.set(skill.id, skill);

      if (!this.skillsByCategory.has(skill.category)) {
        this.skillsByCategory.set(skill.category, new Set());
      }
      this.skillsByCategory.get(skill.category)!.add(skill.id);
    }

    return loadedSkills;
  }

  async load(skillPath: string): Promise<SkillDefinition | null> {
    try {
      const manifestPath = `${skillPath}/skill.yaml`;
      const promptPath = `${skillPath}/prompt.md`;
      const examplesPath = `${skillPath}/examples`;

      const manifestExists = await workshopService.pathExists(manifestPath);
      if (!manifestExists) {
        logger.warn('技能配置文件不存在', { manifestPath });
        return null;
      }

      const manifestContent = await workshopService.readFile(manifestPath);
      const manifest = workshopService.parseYaml(manifestContent);
      if (!manifest) {
        logger.warn('解析技能配置失败', { manifestPath });
        return null;
      }

      let prompt = { system: '' };
      const promptExists = await workshopService.pathExists(promptPath);
      if (promptExists) {
        const promptContent = await workshopService.readFile(promptPath);
        prompt = this.parsePromptFile(promptContent);
      }

      let examples: SkillDefinition['examples'] = [];
      const examplesExists = await workshopService.pathExists(examplesPath);
      if (examplesExists) {
        examples = await this.loadExamples(examplesPath);
      }

      const skill: SkillDefinition = {
        id: (manifest.id as string) || generateId(),
        name: (manifest.name as string) || '未命名Skill',
        version: (manifest.version as string) || '1.0.0',
        description: (manifest.description as string) || '',
        category: (manifest.category as WorkshopSkillCategory) || 'custom',
        tags: (manifest.tags as string[]) || [],
        author: manifest.author as string,
        requires: manifest.requires as string[] | undefined,
        provides: manifest.provides as string[] | undefined,
        conflicts: manifest.conflicts as string[] | undefined,
        tools: manifest.tools as string[] | undefined,
        enabled: (manifest.enabled as boolean) ?? true,
        priority: (manifest.priority as number) ?? 0,
        prompt,
        examples,
        chain: manifest.chain as SkillDefinition['chain'] | undefined,
        output: manifest.output as SkillDefinition['output'] | undefined,
        reviewers: manifest.reviewers as SkillDefinition['reviewers'] | undefined,
      };

      return skill;
    } catch (error) {
      logger.error('加载技能失败', { skillPath, error });
      return null;
    }
  }

  private parsePromptFile(content: string): SkillDefinition['prompt'] {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (frontmatterMatch) {
      const [, frontmatter, body] = frontmatterMatch;
      const parsed = workshopService.parseYaml(frontmatter);

      return {
        system: body.trim(),
        userTemplate: parsed?.userTemplate as string | undefined,
        variables: parsed?.variables as SkillVariable[] | undefined,
      };
    }

    return {
      system: content.trim(),
    };
  }

  private async loadExamples(examplesPath: string): Promise<SkillDefinition['examples']> {
    const examples: SkillDefinition['examples'] = [];

    try {
      const entries = await workshopService.readDirectory(examplesPath);

      for (const entry of entries) {
        if (!entry.isDirectory && entry.name.endsWith('.md')) {
          const content = await workshopService.readFile(`${examplesPath}/${entry.name}`);
          const parsed = this.parseExampleFile(content);
          if (parsed) {
            examples.push(parsed);
          }
        }
      }
    } catch (error) {
      logger.error('加载示例失败', { error });
    }

    return examples;
  }

  private parseExampleFile(
    content: string
  ): { input: string; output: string; explanation?: string } | null {
    const parts = content.split(/^---$/m);

    if (parts.length >= 2) {
      return {
        input: parts[0].trim(),
        output: parts[1].trim(),
        explanation: parts[2]?.trim(),
      };
    }

    return null;
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getByCategory(category: WorkshopSkillCategory): SkillDefinition[] {
    const ids = this.skillsByCategory.get(category);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((id) => this.skills.get(id)!)
      .filter(Boolean);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getEnabled(): SkillDefinition[] {
    return this.getAll()
      .filter((s) => s.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  resolveDependencies(skillId: string): string[] {
    const skill = this.get(skillId);
    if (!skill) {
      return [];
    }

    const resolved: string[] = [];
    const visited = new Set<string>();

    const resolve = (id: string) => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const s = this.get(id);
      if (s?.requires) {
        for (const dep of s.requires) {
          resolve(dep);
          if (!resolved.includes(dep)) {
            resolved.push(dep);
          }
        }
      }
    };

    resolve(skillId);
    resolved.push(skillId);

    return resolved;
  }

  checkConflicts(skillId: string): string[] {
    const skill = this.get(skillId);
    if (!skill?.conflicts) {
      return [];
    }

    const conflicts: string[] = [];
    for (const conflictId of skill.conflicts) {
      if (this.has(conflictId)) {
        conflicts.push(conflictId);
      }
    }

    return conflicts;
  }
}

export class SkillExecutor {
  private loader: SkillLoader;
  private callAI: (prompt: string, systemPrompt: string) => Promise<string>;

  constructor(
    loader: SkillLoader,
    callAI: (prompt: string, systemPrompt: string) => Promise<string>
  ) {
    this.loader = loader;
    this.callAI = callAI;
  }

  async execute(context: SkillExecutionContext): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const skill = this.loader.get(context.skillId);

    if (!skill) {
      return {
        skillId: context.skillId,
        success: false,
        output: '',
        error: `Skill not found: ${context.skillId}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      const systemPrompt = this.buildSystemPrompt(skill, context);
      const userPrompt = this.buildUserPrompt(skill, context);

      const output = await this.callAI(userPrompt, systemPrompt);

      return {
        skillId: context.skillId,
        success: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        skillId: context.skillId,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  async executeChain(
    skillIds: string[],
    context: Omit<SkillExecutionContext, 'skillId' | 'history'>
  ): Promise<SkillExecutionResult[]> {
    const results: SkillExecutionResult[] = [];
    const history: SkillExecutionContext['history'] = [];

    for (const skillId of skillIds) {
      const result = await this.execute({
        ...context,
        skillId,
        history: [...history],
      });

      results.push(result);

      if (result.success) {
        history.push({
          skillId,
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

  private buildSystemPrompt(skill: SkillDefinition, context: SkillExecutionContext): string {
    let prompt = skill.prompt.system;

    if (skill.examples && skill.examples.length > 0) {
      prompt += '\n\n## 示例\n\n';
      for (const example of skill.examples) {
        prompt += `### 输入\n${example.input}\n\n### 输出\n${example.output}\n\n`;
        if (example.explanation) {
          prompt += `### 说明\n${example.explanation}\n\n`;
        }
        prompt += '---\n\n';
      }
    }

    if (context.memory && Object.keys(context.memory).length > 0) {
      prompt += '\n\n## 项目记忆\n';
      prompt += JSON.stringify(context.memory, null, 2);
    }

    return prompt;
  }

  private buildUserPrompt(skill: SkillDefinition, context: SkillExecutionContext): string {
    if (skill.prompt.userTemplate) {
      let prompt = skill.prompt.userTemplate;

      for (const [key, value] of Object.entries(context.variables)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }

      prompt = prompt.replace('{input}', context.input);

      return prompt;
    }

    return context.input;
  }
}

export function createSkillLoader(projectPath: string): SkillLoader {
  return new SkillLoader(projectPath);
}

export function createSkillExecutor(
  loader: SkillLoader,
  callAI: (prompt: string, systemPrompt: string) => Promise<string>
): SkillExecutor {
  return new SkillExecutor(loader, callAI);
}
