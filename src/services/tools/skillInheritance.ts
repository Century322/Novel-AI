import { SkillDefinition, SkillPrompt, SkillVariable } from '@/types/tools/skillDefinition';
import { WorkshopSkillCategory } from '@/types/core/workshop';
import { SkillLoader } from '../tools/skillLoader';

export interface SkillInheritanceConfig {
  extends?: string;
  mixins?: string[];
  overrides?: Partial<SkillDefinition>;
}

export interface SkillComposition {
  id: string;
  name: string;
  description: string;
  skills: CompositionSkill[];
  mergeStrategy: 'append' | 'prepend' | 'replace' | 'interleave';
  variables?: Record<string, unknown>;
}

export interface CompositionSkill {
  skillId: string;
  weight?: number;
  section?: 'system' | 'user' | 'examples';
  transform?: string;
}

export class SkillInheritance {
  private loader: SkillLoader;
  private inheritanceCache: Map<string, SkillDefinition> = new Map();

  constructor(loader: SkillLoader) {
    this.loader = loader;
  }

  resolveInheritance(skillId: string): SkillDefinition | null {
    if (this.inheritanceCache.has(skillId)) {
      return this.inheritanceCache.get(skillId)!;
    }

    const baseSkill = this.loader.get(skillId);
    if (!baseSkill) {
      return null;
    }

    const resolved = this.resolveSkill(baseSkill);
    this.inheritanceCache.set(skillId, resolved);
    return resolved;
  }

  private resolveSkill(skill: SkillDefinition): SkillDefinition {
    const inheritanceConfig = this.extractInheritanceConfig(skill);

    if (!inheritanceConfig.extends && !inheritanceConfig.mixins?.length) {
      return skill;
    }

    let resolved: SkillDefinition = { ...skill };

    if (inheritanceConfig.extends) {
      const parentSkill = this.resolveInheritance(inheritanceConfig.extends);
      if (parentSkill) {
        resolved = this.mergeSkills(parentSkill, resolved);
      }
    }

    if (inheritanceConfig.mixins && inheritanceConfig.mixins.length > 0) {
      for (const mixinId of inheritanceConfig.mixins) {
        const mixinSkill = this.resolveInheritance(mixinId);
        if (mixinSkill) {
          resolved = this.mergeSkills(resolved, mixinSkill, 'merge');
        }
      }
    }

    if (inheritanceConfig.overrides) {
      resolved = { ...resolved, ...inheritanceConfig.overrides };
    }

    return resolved;
  }

  private extractInheritanceConfig(skill: SkillDefinition): SkillInheritanceConfig {
    const config: SkillInheritanceConfig = {};

    const extendsMatch = skill.prompt.system.match(/@extends:\s*(\S+)/);
    if (extendsMatch) {
      config.extends = extendsMatch[1];
    }

    const mixinsMatch = skill.prompt.system.match(/@mixins:\s*\[([^\]]+)\]/);
    if (mixinsMatch) {
      config.mixins = mixinsMatch[1].split(',').map((s) => s.trim());
    }

    return config;
  }

  private mergeSkills(
    base: SkillDefinition,
    derived: SkillDefinition,
    mode: 'extend' | 'merge' = 'extend'
  ): SkillDefinition {
    const merged: SkillDefinition = {
      id: derived.id,
      name: derived.name,
      version: derived.version,
      description: derived.description || base.description,
      category: derived.category,
      tags: [...new Set([...base.tags, ...derived.tags])],
      author: derived.author || base.author,
      enabled: derived.enabled,
      priority: derived.priority,
      prompt: this.mergePrompts(base.prompt, derived.prompt, mode),
    };

    if (base.requires || derived.requires) {
      merged.requires = [...new Set([...(base.requires || []), ...(derived.requires || [])])];
    }

    if (base.provides || derived.provides) {
      merged.provides = [...new Set([...(base.provides || []), ...(derived.provides || [])])];
    }

    if (base.tools || derived.tools) {
      merged.tools = [...new Set([...(base.tools || []), ...(derived.tools || [])])];
    }

    if (base.examples || derived.examples) {
      merged.examples = [...(base.examples || []), ...(derived.examples || [])];
    }

    if (base.chain || derived.chain) {
      merged.chain = {
        before: [...(base.chain?.before || []), ...(derived.chain?.before || [])],
        after: [...(base.chain?.after || []), ...(derived.chain?.after || [])],
        parallel: [...(base.chain?.parallel || []), ...(derived.chain?.parallel || [])],
      };
    }

    if (base.reviewers || derived.reviewers) {
      merged.reviewers = [...(base.reviewers || []), ...(derived.reviewers || [])];
    }

    return merged;
  }

  private mergePrompts(
    base: SkillPrompt,
    derived: SkillPrompt,
    mode: 'extend' | 'merge'
  ): SkillPrompt {
    const merged: SkillPrompt = {
      system: '',
    };

    if (mode === 'extend') {
      merged.system = base.system;
      if (derived.system && derived.system !== base.system) {
        const derivedOnly = this.removeInheritanceDirectives(derived.system);
        if (derivedOnly.trim()) {
          merged.system += '\n\n' + derivedOnly;
        }
      }
    } else {
      merged.system = base.system + '\n\n' + derived.system;
    }

    if (derived.userTemplate) {
      merged.userTemplate = derived.userTemplate;
    } else if (base.userTemplate) {
      merged.userTemplate = base.userTemplate;
    }

    if (base.variables || derived.variables) {
      merged.variables = this.mergeVariables(base.variables || [], derived.variables || []);
    }

    return merged;
  }

  private mergeVariables(base: SkillVariable[], derived: SkillVariable[]): SkillVariable[] {
    const merged = new Map<string, SkillVariable>();

    for (const v of base) {
      merged.set(v.name, v);
    }

    for (const v of derived) {
      const existing = merged.get(v.name);
      if (existing) {
        merged.set(v.name, {
          ...existing,
          ...v,
          description: v.description || existing.description,
        });
      } else {
        merged.set(v.name, v);
      }
    }

    return Array.from(merged.values());
  }

  private removeInheritanceDirectives(content: string): string {
    return content
      .replace(/@extends:\s*\S+\n?/g, '')
      .replace(/@mixins:\s*\[[^\]]+\]\n?/g, '')
      .trim();
  }

  clearCache(): void {
    this.inheritanceCache.clear();
  }
}

export class SkillComposer {
  private inheritance: SkillInheritance;

  constructor(loader: SkillLoader) {
    this.inheritance = new SkillInheritance(loader);
  }

  compose(composition: SkillComposition): SkillDefinition | null {
    const skills: SkillDefinition[] = [];

    for (const compSkill of composition.skills) {
      const resolved = this.inheritance.resolveInheritance(compSkill.skillId);
      if (resolved) {
        skills.push(resolved);
      }
    }

    if (skills.length === 0) {
      return null;
    }

    const composed: SkillDefinition = {
      id: composition.id,
      name: composition.name,
      version: '1.0.0',
      description: composition.description,
      category: 'custom' as WorkshopSkillCategory,
      tags: [],
      enabled: true,
      priority: 0,
      prompt: this.composePrompts(skills, composition.mergeStrategy, composition.skills),
    };

    const allTags = new Set<string>();
    for (const s of skills) {
      s.tags.forEach((t) => allTags.add(t));
    }
    composed.tags = Array.from(allTags);

    const allRequires = new Set<string>();
    for (const s of skills) {
      s.requires?.forEach((r) => allRequires.add(r));
    }
    if (allRequires.size > 0) {
      composed.requires = Array.from(allRequires);
    }

    const allTools = new Set<string>();
    for (const s of skills) {
      s.tools?.forEach((t) => allTools.add(t));
    }
    if (allTools.size > 0) {
      composed.tools = Array.from(allTools);
    }

    return composed;
  }

  private composePrompts(
    skills: SkillDefinition[],
    strategy: SkillComposition['mergeStrategy'],
    compSkills: CompositionSkill[]
  ): SkillPrompt {
    const sections: string[] = [];

    switch (strategy) {
      case 'append':
        for (let i = 0; i < skills.length; i++) {
          const skill = skills[i];
          const weight = compSkills[i]?.weight || 1;
          if (weight > 0) {
            sections.push(`## ${skill.name}\n\n${skill.prompt.system}`);
          }
        }
        break;

      case 'prepend':
        for (let i = skills.length - 1; i >= 0; i--) {
          const skill = skills[i];
          sections.push(`## ${skill.name}\n\n${skill.prompt.system}`);
        }
        break;

      case 'interleave':
        const systemParts: string[] = [];
        const exampleParts: string[] = [];

        for (const skill of skills) {
          systemParts.push(skill.prompt.system);
          if (skill.examples?.length) {
            exampleParts.push(
              `### ${skill.name} 示例\n${skill.examples.map((e) => `输入: ${e.input}\n输出: ${e.output}`).join('\n\n')}`
            );
          }
        }

        sections.push(systemParts.join('\n\n---\n\n'));
        if (exampleParts.length > 0) {
          sections.push('\n\n## 示例\n\n' + exampleParts.join('\n\n'));
        }
        break;

      case 'replace':
      default:
        if (skills.length > 0) {
          sections.push(skills[skills.length - 1].prompt.system);
        }
        break;
    }

    return {
      system: sections.join('\n\n'),
    };
  }

  createComposition(
    name: string,
    skillIds: string[],
    options: Partial<Omit<SkillComposition, 'id' | 'name' | 'skills'>> = {}
  ): SkillComposition {
    return {
      id: `composition_${Date.now()}`,
      name,
      description: options.description || `组合技能: ${name}`,
      skills: skillIds.map((skillId) => ({ skillId })),
      mergeStrategy: options.mergeStrategy || 'append',
      variables: options.variables,
    };
  }

  async composeAndExecute(
    composition: SkillComposition,
    _input: string,
    _variables: Record<string, unknown> = {}
  ): Promise<string> {
    const composed = this.compose(composition);
    if (!composed) {
      throw new Error('Failed to compose skills');
    }

    return composed.prompt.system;
  }
}

export function createSkillInheritance(loader: SkillLoader): SkillInheritance {
  return new SkillInheritance(loader);
}

export function createSkillComposer(loader: SkillLoader): SkillComposer {
  return new SkillComposer(loader);
}

export const DEFAULT_COMPOSITIONS: SkillComposition[] = [
  {
    id: 'novel_writing_suite',
    name: '小说创作套件',
    description: '完整的小说创作工具集',
    skills: [
      { skillId: 'style_template', weight: 1 },
      { skillId: 'structure_template', weight: 1 },
      { skillId: 'technique_template', weight: 0.8 },
    ],
    mergeStrategy: 'append',
  },
  {
    id: 'quality_review_suite',
    name: '质量审核套件',
    description: '多维度质量检查',
    skills: [
      { skillId: 'logic_police', weight: 1, section: 'system' },
      { skillId: 'emotion_master', weight: 1, section: 'system' },
      { skillId: 'commercial_editor', weight: 0.8, section: 'system' },
    ],
    mergeStrategy: 'interleave',
  },
];
