import { llmService } from '../ai/llmService';
import { WorldModelService } from '../world/worldModelService';
import { SettingExtractionService } from '../extraction/settingExtractionService';
import { logger } from '../core/loggerService';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { Foreshadowing } from '@/types/plot/foreshadowing';

export interface WorldBuildingProgress {
  stage:
    | 'extracting'
    | 'building_characters'
    | 'building_world'
    | 'generating_outline'
    | 'completed'
    | 'error';
  message: string;
  progress: number;
  details?: Record<string, unknown>;
}

export interface WorldBuildingResult {
  success: boolean;
  worldModel: {
    characters: number;
    locations: number;
    factions: number;
    rules: number;
    foreshadowing: number;
    outlineNodes: number;
  };
  outline?: {
    title: string;
    logline?: string;
    theme?: string;
    volumes: Array<{
      title: string;
      arc?: string;
      wordCount?: number;
      chapters: Array<{
        title: string;
        summary: string;
        plotPoints?: string[];
        characterAppearances?: string[];
        foreshadowing?: string[];
      }>;
    }>;
  };
  suggestions: string[];
  error?: string;
}

export type ProgressCallback = (progress: WorldBuildingProgress) => void;

const OUTLINE_GENERATION_PROMPT = `你是一个专业的网文大纲规划师。根据提供的设定信息，生成一个完整的小说大纲。

要求：
1. 结构清晰：分卷 -> 分章 -> 分节
2. 节奏合理：铺垫 -> 发展 -> 高潮 -> 结局
3. 爽点分布：每卷至少有一个小高潮
4. 伏笔布局：在早期埋下伏笔，后期回收

输出 JSON 格式：
{
  "title": "小说标题",
  "logline": "一句话简介",
  "theme": "核心主题",
  "volumes": [
    {
      "title": "第一卷标题",
      "arc": "本卷主线",
      "wordCount": 50000,
      "chapters": [
        {
          "title": "第1章标题",
          "summary": "章节概要（50-100字）",
          "plotPoints": ["情节点1", "情节点2"],
          "characterAppearances": ["人物1", "人物2"],
          "foreshadowing": ["伏笔1"]
        }
      ]
    }
  ]
}`;

const CHARACTER_PROFILE_PROMPT = `你是一个专业的人物设定师。根据提供的人物基本信息，生成详细的人物小传。

要求：
1. 外貌描写：具体、有特点
2. 性格特征：3-5个核心特质，有矛盾点更好
3. 背景故事：有戏剧性，能解释现状
4. 人物弧光：起点 -> 变化 -> 终点
5. 金手指/能力：有代价和限制

输出 JSON 格式：
{
  "name": "人物姓名",
  "fullDescription": "详细人物描述（200-300字）",
  "appearance": {
    "age": "年龄",
    "gender": "性别",
    "height": "身高",
    "build": "体型",
    "hair": "发型发色",
    "eyes": "眼睛",
    "distinctiveFeatures": ["显著特征1", "显著特征2"],
    "clothing": "穿着风格",
    "overallImpression": "整体印象"
  },
  "personality": {
    "traits": ["性格特质1", "性格特质2"],
    "virtues": ["优点1"],
    "flaws": ["缺点1"],
    "fears": ["恐惧1"],
    "desires": ["欲望1"],
    "habits": ["习惯1"],
    "quirks": ["怪癖1"],
    "speech": {
      "style": "说话风格",
      "catchphrases": ["口头禅1"],
      "vocabulary": "用词特点"
    }
  },
  "background": {
    "birthplace": "出生地",
    "family": {
      "parents": "父母情况",
      "siblings": "兄弟姐妹"
    },
    "childhood": "童年经历",
    "education": "教育背景",
    "occupation": "职业",
    "socialStatus": "社会地位",
    "significantEvents": [
      {"event": "重大事件", "age": "发生年龄", "impact": "影响"}
    ]
  },
  "abilities": {
    "skills": [{"name": "技能名", "level": "等级", "description": "描述"}],
    "powers": [{"name": "能力名", "type": "类型", "description": "描述", "limitations": "限制"}],
    "equipment": [{"name": "装备名", "description": "描述", "significance": "意义"}],
    "weaknesses": ["弱点1"]
  },
  "arc": {
    "startingPoint": {
      "state": "初始状态",
      "beliefs": ["初始信念"],
      "goals": ["初始目标"]
    },
    "journey": [
      {"stage": "development", "events": "经历事件", "internalChange": "内心变化", "externalChange": "外部变化"}
    ],
    "endPoint": {
      "state": "终点状态",
      "beliefs": ["终点信念"],
      "goals": ["终点目标"],
      "resolution": "最终结局"
    },
    "theme": "人物主题"
  },
  "motivations": {
    "consciousGoals": ["显性目标"],
    "unconsciousDesires": ["隐性欲望"],
    "fears": ["深层恐惧"],
    "values": ["核心价值观"],
    "internalConflict": "内心冲突",
    "externalConflict": "外部冲突"
  },
  "secrets": [
    {"content": "秘密内容", "type": "类型", "knownBy": ["知情者"], "impact": "影响"}
  ]
}`;

export class WorldBuildingService {
  private worldModelService: WorldModelService | null = null;
  private extractionService: SettingExtractionService | null = null;

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setExtractionService(service: SettingExtractionService): void {
    this.extractionService = service;
  }

  async buildWorldFromInput(
    input: string,
    options: {
      generateOutline?: boolean;
      generateCharacterProfiles?: boolean;
      targetWordCount?: number;
      onProgress?: ProgressCallback;
    } = {}
  ): Promise<WorldBuildingResult> {
    const {
      generateOutline = true,
      generateCharacterProfiles = true,
      targetWordCount = 100000,
      onProgress,
    } = options;

    const reportProgress = (progress: WorldBuildingProgress) => {
      logger.info('建世界进度', { ...progress });
      onProgress?.(progress);
    };

    try {
      reportProgress({
        stage: 'extracting',
        message: '正在分析用户输入，提取设定信息...',
        progress: 10,
      });

      if (!this.extractionService || !this.worldModelService) {
        throw new Error('服务未初始化');
      }

      const extractionReport = await this.extractionService.extractFromInput(input, {
        autoSave: true,
      });

      reportProgress({
        stage: 'building_characters',
        message: `正在完善 ${extractionReport.characters} 个人物设定...`,
        progress: 30,
        details: { characters: extractionReport.characters },
      });

      if (generateCharacterProfiles && extractionReport.characters > 0) {
        await this.enrichCharacterProfiles();
      }

      reportProgress({
        stage: 'building_world',
        message: '正在完善世界观设定...',
        progress: 50,
        details: {
          locations: extractionReport.locations,
          factions: extractionReport.factions,
          rules: extractionReport.rules,
        },
      });

      let outline: WorldBuildingResult['outline'] = undefined;

      if (generateOutline) {
        reportProgress({
          stage: 'generating_outline',
          message: '正在生成故事大纲...',
          progress: 70,
        });

        outline = await this.generateOutline(targetWordCount);

        if (outline) {
          await this.saveOutlineToModel(outline);
        }
      }

      reportProgress({
        stage: 'completed',
        message: '世界构建完成！',
        progress: 100,
      });

      const worldModel = this.worldModelService.getWorldModel();
      return {
        success: true,
        worldModel: {
          characters: worldModel?.characters.items.length || 0,
          locations: worldModel?.worldbuilding.locations.length || 0,
          factions: worldModel?.worldbuilding.factions.length || 0,
          rules: worldModel?.worldbuilding.rules.length || 0,
          foreshadowing: worldModel?.foreshadowing.items.length || 0,
          outlineNodes: worldModel?.outline.nodes.length || 0,
        },
        outline,
        suggestions: extractionReport.suggestions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      reportProgress({
        stage: 'error',
        message: `世界构建失败: ${errorMessage}`,
        progress: 0,
      });

      return {
        success: false,
        worldModel: {
          characters: 0,
          locations: 0,
          factions: 0,
          rules: 0,
          foreshadowing: 0,
          outlineNodes: 0,
        },
        suggestions: [],
        error: errorMessage,
      };
    }
  }

  private async enrichCharacterProfiles(): Promise<void> {
    if (!this.worldModelService) return;

    const characters = this.worldModelService.getCharacters();
    for (const char of characters) {
      if (char.notes && char.notes.length > 50) continue;

      try {
        const enrichedProfile = await this.generateCharacterProfile(char);
        if (enrichedProfile) {
          await this.worldModelService.updateCharacter(char.id, {
            appearance: enrichedProfile.appearance,
            personality: enrichedProfile.personality,
            background: enrichedProfile.background,
            abilities: enrichedProfile.abilities,
            arc: enrichedProfile.arc,
            motivations: enrichedProfile.motivations,
            secrets: enrichedProfile.secrets,
          });
        }
      } catch (error) {
        logger.warn(`完善人物 ${char.name} 失败`, { error: String(error) });
      }
    }
  }

  private async generateCharacterProfile(
    char: CharacterProfile
  ): Promise<Partial<CharacterProfile> | null> {
    const prompt = `${CHARACTER_PROFILE_PROMPT}

现有人物信息：
- 姓名：${char.name}
- 角色：${char.role}
- 简述：${char.notes || '暂无'}
- 性格：${char.personality.traits.join('、') || '暂无'}
- 背景：${char.background.childhood || '暂无'}
- 能力：${char.abilities.powers.map((p: { name: string }) => p.name).join('、') || '暂无'}
- 目标：${char.arc.startingPoint.goals.join('、') || '暂无'}

请生成完整的人物小传。`;

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: '你是一个专业的人物设定师。输出 JSON 格式。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 2048,
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as Partial<CharacterProfile>;
  }

  private async generateOutline(targetWordCount: number): Promise<WorldBuildingResult['outline']> {
    if (!this.worldModelService) return undefined;

    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) return undefined;

    const context = this.worldModelService.getContextForGeneration();

    const prompt = `${OUTLINE_GENERATION_PROMPT}

现有设定：
${context}

主要人物：
${worldModel.characters.items
  .slice(0, 5)
  .map((c: CharacterProfile) => `- ${c.name}（${c.role}）：${c.notes || '暂无描述'}`)
  .join('\n')}

目标字数：${targetWordCount} 字

请生成完整的大纲。`;

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: '你是一个专业的网文大纲规划师。输出 JSON 格式。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4096,
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return undefined;

    return JSON.parse(jsonMatch[0]) as WorldBuildingResult['outline'];
  }

  private async saveOutlineToModel(
    outline: NonNullable<WorldBuildingResult['outline']>
  ): Promise<void> {
    if (!this.worldModelService) return;

    const now = Date.now();
    let order = 0;

    const storyNode = await this.worldModelService.addOutlineNode({
      type: 'story',
      title: outline.title,
      summary: outline.logline || '',
      status: 'planned',
      order: order++,
      parentId: null,
      wordCount: {
        planned: outline.volumes.reduce((sum, v) => sum + (v.wordCount || 50000), 0),
        actual: 0,
      },
      plotPoints: [],
      characterAppearances: [],
      foreshadowingLinks: [],
      notes: `主题：${outline.theme || '暂无'}`,
    });

    for (const volume of outline.volumes) {
      const volumeNode = await this.worldModelService.addOutlineNode({
        type: 'volume',
        title: volume.title,
        summary: volume.arc || '',
        status: 'planned',
        order: order++,
        parentId: storyNode.id,
        wordCount: {
          planned: volume.wordCount || 50000,
          actual: 0,
        },
        plotPoints: [],
        characterAppearances: [],
        foreshadowingLinks: [],
        notes: '',
      });

      for (const chapter of volume.chapters) {
        await this.worldModelService.addOutlineNode({
          type: 'chapter',
          title: chapter.title,
          summary: chapter.summary,
          status: 'planned',
          order: order++,
          parentId: volumeNode.id,
          wordCount: {
            planned: 2000,
            actual: 0,
          },
          plotPoints: (chapter.plotPoints || []).map((p, i) => ({
            id: `pp_${now}_${i}`,
            type: 'setup' as const,
            description: p,
            emotionalBeat: '',
            characterIds: [],
            impact: 'minor' as const,
          })),
          characterAppearances: (chapter.characterAppearances || []).map((name, i) => ({
            characterId: '',
            characterName: name,
            role: 'major' as const,
            firstAppearanceInNode: i === 0,
            developmentNotes: '',
          })),
          foreshadowingLinks: (chapter.foreshadowing || []).map(() => ({
            foreshadowingId: '',
            action: 'plant' as const,
          })),
          notes: '',
        });
      }
    }
  }

  async checkWorldCompleteness(): Promise<{
    isComplete: boolean;
    score: number;
    missing: string[];
    suggestions: string[];
  }> {
    if (!this.extractionService) {
      return {
        isComplete: false,
        score: 0,
        missing: ['服务未初始化'],
        suggestions: [],
      };
    }

    const analysis = await this.extractionService.analyzeWorldModelCompleteness();

    return {
      isComplete: analysis.score >= 70,
      score: analysis.score,
      missing: analysis.missing,
      suggestions: analysis.suggestions,
    };
  }

  async suggestNextSteps(): Promise<string[]> {
    if (!this.worldModelService) return [];

    const worldModel = this.worldModelService.getWorldModel();
    if (!worldModel) return ['请先创建项目'];

    const suggestions: string[] = [];

    if (worldModel.characters.items.length === 0) {
      suggestions.push('添加主角人物：告诉我主角的名字、性格和背景');
    } else {
      const protagonist = worldModel.characters.items.find((c: CharacterProfile) => c.role === 'protagonist');
      if (!protagonist) {
        suggestions.push('标记主角：告诉我谁是故事的主角');
      } else if (!protagonist.notes || protagonist.notes.length < 50) {
        suggestions.push(`完善 ${protagonist.name} 的设定：告诉我更多关于TA的故事`);
      }
    }

    if (worldModel.worldbuilding.locations.length === 0) {
      suggestions.push('添加故事地点：故事发生在哪里？');
    }

    if (worldModel.worldbuilding.rules.length === 0) {
      suggestions.push('定义力量体系：这个世界有什么特殊规则或能力？');
    }

    if (worldModel.outline.nodes.length === 0) {
      suggestions.push('创建故事大纲：告诉我故事的主线是什么？');
    }

    const unresolvedForeshadows = worldModel.foreshadowing.items.filter(
      (f: Foreshadowing) => f.status === 'planted' || f.status === 'hinted'
    );
    if (unresolvedForeshadows.length > 3) {
      suggestions.push(`有 ${unresolvedForeshadows.length} 个伏笔待回收，考虑在后续章节中处理`);
    }

    return suggestions;
  }
}

export const worldBuildingService = new WorldBuildingService();
