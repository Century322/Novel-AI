import { llmService } from '../ai/llmService';
import { WorldModelService } from '../world/worldModelService';
import { logger } from '../core/loggerService';
import {
  ExtractedCharacter,
  ExtractedWorldbuilding,
  ExtractedForeshadowing,
  ExtractedInfo,
} from '@/types/knowledge/extraction';
import type { UserPreference } from '@/types/world/worldModel';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { Foreshadowing } from '@/types/plot/foreshadowing';

export interface ExtractionOptions {
  extractCharacters?: boolean;
  extractWorldbuilding?: boolean;
  extractForeshadowing?: boolean;
  extractPreferences?: boolean;
  extractPlotPoints?: boolean;
  autoSave?: boolean;
}

export interface ExtractionReport {
  characters: number;
  locations: number;
  factions: number;
  rules: number;
  foreshadowing: number;
  preferences: number;
  plotPoints: number;
  rawExtractions: ExtractedInfo[];
  suggestions: string[];
}

const EXTRACTION_SYSTEM_PROMPT = `你是一个专业的网文设定抽取助手。你的任务是从用户的灵感描述中提取结构化的小说设定。

请仔细分析用户输入，提取以下类型的信息：

1. **人物设定**：
   - 姓名、角色定位（主角/反派/配角）
   - 外貌、性格、背景
   - 能力/金手指
   - 目标、秘密
   - 人际关系

2. **世界观设定**：
   - 地点/场景
   - 势力/组织
   - 力量体系/规则
   - 历史背景

3. **剧情要点**：
   - 高潮点/爽点
   - 伏笔
   - 冲突点

4. **风格偏好**：
   - 写作风格偏好
   - 禁忌/避免的内容
   - 强调的元素

输出格式要求：
- 使用 JSON 格式输出
- 每个类型使用数组
- 未提及的信息使用空值或空数组
- 保持原始描述的精髓`;

export class SettingExtractionService {
  private worldModelService: WorldModelService | null = null;

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  async extractFromInput(
    input: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionReport> {
    const {
      extractCharacters = true,
      extractWorldbuilding = true,
      extractForeshadowing = true,
      extractPreferences = true,
      extractPlotPoints = true,
      autoSave = false,
    } = options;

    logger.info('开始设定抽取', { inputLength: input.length, options });

    const extractionPrompt = this.buildExtractionPrompt(input, {
      extractCharacters,
      extractWorldbuilding,
      extractForeshadowing,
      extractPreferences,
      extractPlotPoints,
    });

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.3,
        maxTokens: 4096,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从响应中提取 JSON');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      const report = this.processExtractions(extracted);

      if (autoSave && this.worldModelService) {
        await this.saveExtractions(report);
      }

      logger.info('设定抽取完成', {
        characters: report.characters,
        locations: report.locations,
        factions: report.factions,
        rules: report.rules,
        foreshadowing: report.foreshadowing,
        preferences: report.preferences,
      });

      return report;
    } catch (error) {
      logger.error('设定抽取失败', { error });
      throw error;
    }
  }

  private buildExtractionPrompt(
    input: string,
    options: {
      extractCharacters: boolean;
      extractWorldbuilding: boolean;
      extractForeshadowing: boolean;
      extractPreferences: boolean;
      extractPlotPoints: boolean;
    }
  ): string {
    const sections: string[] = [];

    sections.push('请从以下内容中提取小说设定：\n');
    sections.push('---');
    sections.push(input);
    sections.push('---\n');

    sections.push('请提取以下类型的设定：');
    if (options.extractCharacters) {
      sections.push('- 人物设定（姓名、角色、外貌、性格、背景、能力、目标、关系）');
    }
    if (options.extractWorldbuilding) {
      sections.push('- 世界观设定（地点、势力、力量体系/规则）');
    }
    if (options.extractForeshadowing) {
      sections.push('- 伏笔（内容、计划回收方式、相关人物）');
    }
    if (options.extractPreferences) {
      sections.push('- 风格偏好（写作风格、禁忌、强调元素）');
    }
    if (options.extractPlotPoints) {
      sections.push('- 剧情要点（高潮点、冲突点、转折点）');
    }

    sections.push('\n请以 JSON 格式输出，包含以下字段：');
    sections.push('- characters: 人物数组');
    sections.push('- locations: 地点数组');
    sections.push('- factions: 势力数组');
    sections.push('- rules: 规则数组');
    sections.push('- foreshadowing: 伏笔数组');
    sections.push('- plotPoints: 剧情要点数组');
    sections.push('- preferences: 偏好数组');
    sections.push('- suggestions: 建议数组（给用户的补充建议）');

    return sections.join('\n');
  }

  private processExtractions(extracted: Record<string, unknown>): ExtractionReport {
    const report: ExtractionReport = {
      characters: 0,
      locations: 0,
      factions: 0,
      rules: 0,
      foreshadowing: 0,
      preferences: 0,
      plotPoints: 0,
      rawExtractions: [],
      suggestions: (extracted.suggestions as string[]) || [],
    };

    if (Array.isArray(extracted.characters)) {
      for (const char of extracted.characters) {
        report.rawExtractions.push({ type: 'character', data: char as ExtractedCharacter });
        report.characters++;
      }
    }

    if (Array.isArray(extracted.locations)) {
      for (const loc of extracted.locations) {
        report.rawExtractions.push({
          type: 'worldbuilding',
          data: {
            name: (loc as { name?: string }).name || '',
            category: 'geography',
            description: (loc as { description?: string }).description || '',
            details: {},
            relatedElements: [],
          } as ExtractedWorldbuilding,
        });
        report.locations++;
      }
    }

    if (Array.isArray(extracted.factions)) {
      for (const faction of extracted.factions) {
        report.rawExtractions.push({
          type: 'worldbuilding',
          data: {
            name: (faction as { name?: string }).name || '',
            category: 'faction',
            description: (faction as { description?: string }).description || '',
            details: {},
            relatedElements: [],
          } as ExtractedWorldbuilding,
        });
        report.factions++;
      }
    }

    if (Array.isArray(extracted.rules)) {
      for (const rule of extracted.rules) {
        report.rawExtractions.push({
          type: 'worldbuilding',
          data: {
            name: (rule as { name?: string }).name || '',
            category: 'rules',
            description: (rule as { description?: string }).description || '',
            details: {},
            relatedElements: [],
          } as ExtractedWorldbuilding,
        });
        report.rules++;
      }
    }

    if (Array.isArray(extracted.foreshadowing)) {
      for (const f of extracted.foreshadowing) {
        report.rawExtractions.push({ type: 'foreshadowing', data: f as ExtractedForeshadowing });
        report.foreshadowing++;
      }
    }

    if (Array.isArray(extracted.plotPoints)) {
      report.plotPoints = extracted.plotPoints.length;
    }

    if (Array.isArray(extracted.preferences)) {
      for (const pref of extracted.preferences) {
        report.rawExtractions.push({
          type: 'setting',
          data: {
            key: (pref as { key?: string }).key || '',
            value: String((pref as { value?: unknown }).value || ''),
            category: (pref as { category?: string }).category || 'general',
            notes: (pref as { description?: string }).description || '',
          },
        });
        report.preferences++;
      }
    }

    return report;
  }

  async saveExtractions(report: ExtractionReport): Promise<void> {
    if (!this.worldModelService) {
      throw new Error('WorldModelService 未设置');
    }

    for (const extraction of report.rawExtractions) {
      switch (extraction.type) {
        case 'character':
          await this.saveCharacter(extraction.data as ExtractedCharacter);
          break;
        case 'worldbuilding':
          await this.saveWorldbuilding(extraction.data as ExtractedWorldbuilding);
          break;
        case 'foreshadowing':
          await this.saveForeshadowing(extraction.data as ExtractedForeshadowing);
          break;
        case 'setting':
          await this.savePreference(
            extraction.data as { key: string; value: string; category: string; notes: string }
          );
          break;
      }
    }
  }

  private async saveCharacter(char: ExtractedCharacter): Promise<void> {
    if (!this.worldModelService) return;

    const existing = this.worldModelService.getCharacters().find((c) => c.name === char.name);
    if (existing) {
      await this.worldModelService.updateCharacter(existing.id, {
        notes: char.description,
        personality: {
          ...existing.personality,
          traits: char.personality || existing.personality.traits,
        },
        background: {
          ...existing.background,
          childhood: char.background || existing.background.childhood,
        },
      });
      return;
    }

    await this.worldModelService.addCharacter({
      name: char.name,
      role: char.role || 'minor',
      notes: char.description,
      appearance: {
        age: '',
        gender: '',
        distinctiveFeatures: [],
        clothing: '',
        overallImpression: char.appearance || '',
      },
      personality: {
        traits: char.personality || [],
        virtues: [],
        flaws: [],
        fears: [],
        desires: char.goals || [],
        habits: [],
        quirks: [],
        speech: { style: '', catchphrases: [], vocabulary: '' },
      },
      background: {
        birthplace: '',
        family: { parents: '', siblings: '' },
        childhood: char.background || '',
        education: '',
        occupation: '',
        socialStatus: '',
        significantEvents: [],
      },
      abilities: {
        skills: [],
        powers: (char.abilities || []).map((a) => ({
          name: a,
          type: 'other',
          description: a,
          limitations: '',
        })),
        equipment: [],
        weaknesses: [],
      },
      relationships: (char.relationships || []).map((r) => ({
        targetId: '',
        targetName: r.targetName,
        relationshipType: r.relationshipType,
        description: '',
        history: '',
        currentStatus: 'neutral' as const,
        development: [],
      })),
      arc: {
        startingPoint: { state: '', beliefs: [], goals: char.goals || [] },
        journey: [],
        endPoint: { state: '', beliefs: [], goals: [], resolution: '' },
        theme: '',
      },
      secrets: (char.secrets || []).map((s: string, i: number) => ({
        id: `secret_${i}`,
        content: s,
        type: 'other' as const,
        knownBy: [],
        impact: '',
      })),
      motivations: {
        consciousGoals: char.goals || [],
        unconsciousDesires: [],
        fears: [],
        values: [],
        internalConflict: '',
        externalConflict: '',
      },
      firstAppearance: '',
      totalAppearances: 0,
      tags: [],
    });
  }

  private async saveWorldbuilding(data: ExtractedWorldbuilding): Promise<void> {
    if (!this.worldModelService) return;

    switch (data.category) {
      case 'geography':
        const existingLoc = this.worldModelService.getLocations().find((l) => l.name === data.name);
        if (!existingLoc) {
          await this.worldModelService.addLocation({
            name: data.name,
            type: 'other',
            description: data.description,
            atmosphere: data.details?.atmosphere || '',
            notableFeatures: [],
            history: '',
            currentStatus: '',
            relatedCharacters: data.relatedElements || [],
            tags: [],
          });
        }
        break;

      case 'faction':
        const existingFaction = this.worldModelService
          .getFactions()
          .find((f) => f.name === data.name);
        if (!existingFaction) {
          await this.worldModelService.addFaction({
            name: data.name,
            type: 'organization',
            description: data.description,
            goals: [],
            resources: [],
            territory: [],
            relationships: [],
            history: '',
            secrets: [],
            tags: [],
          });
        }
        break;

      case 'rules':
        const existingRule = this.worldModelService.getRules().find((r) => r.name === data.name);
        if (!existingRule) {
          await this.worldModelService.addRule({
            name: data.name,
            category: 'magic',
            description: data.description,
            limitations: [],
            costs: [],
            requirements: [],
            exceptions: [],
            examples: [],
            relatedRules: [],
          });
        }
        break;
    }
  }

  private async saveForeshadowing(data: ExtractedForeshadowing): Promise<void> {
    if (!this.worldModelService) return;

    const existing = this.worldModelService
      .getForeshadowing()
      .find((f) => f.content === data.content);
    if (!existing) {
      await this.worldModelService.addForeshadowing({
        title: data.content.substring(0, 30),
        content: data.content,
        type: 'other',
        status: 'planted',
        importance: data.importance || 'minor',
        plantedAt: { description: '' },
        plannedResolution: { description: data.plannedResolution || '' },
        relatedCharacters: data.relatedCharacters || [],
        relatedItems: [],
        relatedEvents: [],
        hints: [],
        notes: '',
      });
    }
  }

  private async savePreference(data: {
    key: string;
    value: string;
    category: string;
    notes: string;
  }): Promise<void> {
    if (!this.worldModelService) return;

    await this.worldModelService.addPreference({
      category: (data.category as UserPreference['category']) || 'general',
      key: data.key,
      value: data.value,
      description: data.notes,
      priority: 'prefer',
      source: 'explicit',
      confidence: 1.0,
    });
  }

  async analyzeWorldModelCompleteness(): Promise<{
    score: number;
    missing: string[];
    suggestions: string[];
  }> {
    if (!this.worldModelService) {
      return { score: 0, missing: ['WorldModelService 未设置'], suggestions: [] };
    }

    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) {
      return { score: 0, missing: ['世界模型未初始化'], suggestions: ['请先创建项目'] };
    }

    const missing: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    if (worldModel.characters.items.length === 0) {
      missing.push('缺少主角人物设定');
      suggestions.push('添加主角的基本信息：姓名、性格、背景、目标');
    } else {
      const protagonist = worldModel.characters.items.find((c: CharacterProfile) => c.role === 'protagonist');
      if (!protagonist) {
        missing.push('缺少主角标记');
        suggestions.push('请将主要人物标记为主角');
      } else {
        score += 20;
        if (!protagonist.notes && protagonist.personality.traits.length === 0) {
          missing.push('主角缺少详细描述');
          suggestions.push('完善主角的性格特征和背景故事');
        }
      }
    }

    if (worldModel.worldbuilding.locations.length === 0) {
      missing.push('缺少地点设定');
      suggestions.push('添加故事发生的主要地点');
    } else {
      score += 15;
    }

    if (worldModel.worldbuilding.rules.length === 0) {
      missing.push('缺少力量体系/规则设定');
      suggestions.push('定义故事中的力量体系或特殊规则');
    } else {
      score += 15;
    }

    if (worldModel.outline.nodes.length === 0) {
      missing.push('缺少大纲');
      suggestions.push('创建故事大纲，规划主要剧情走向');
    } else {
      score += 20;
    }

    if (worldModel.timeline.events.length === 0) {
      missing.push('缺少时间线');
      suggestions.push('添加关键事件到时间线');
    } else {
      score += 10;
    }

    const unresolvedForeshadows = worldModel.foreshadowing.items.filter(
      (f: Foreshadowing) => f.status === 'planted' || f.status === 'hinted'
    );
    if (unresolvedForeshadows.length > 0) {
      score += 10;
    }

    if (worldModel.preferences.length > 0) {
      score += 10;
    }

    return { score, missing, suggestions };
  }

  async generateOutlineFromExtractions(
    extractions: ExtractedInfo[],
    targetWordCount: number = 100000
  ): Promise<{
    title: string;
    volumes: Array<{
      title: string;
      chapters: Array<{ title: string; summary: string }>;
    }>;
  }> {
    const prompt = `基于以下设定，生成一个网文大纲。

设定信息：
${JSON.stringify(extractions, null, 2)}

目标字数：${targetWordCount} 字

请生成：
1. 故事标题
2. 分卷规划（每卷约 20-30 章）
3. 每章的标题和简要内容

输出 JSON 格式：
{
  "title": "故事标题",
  "volumes": [
    {
      "title": "第一卷标题",
      "chapters": [
        { "title": "第1章标题", "summary": "章节内容概要" }
      ]
    }
  ]
}`;

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: '你是一个专业的网文大纲规划师。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4096,
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从响应中提取大纲 JSON');
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export const settingExtractionService = new SettingExtractionService();
