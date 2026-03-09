import { llmService } from '../ai/llmService';
import {
  AuthorStyleLearningService,
  AuthorStyleProfile,
} from '../style/authorStyleLearningService';
import { logger } from '../core/loggerService';
import { workshopService } from '../core/workshopService';

export type SceneType =
  | 'action'
  | 'dialogue'
  | 'description'
  | 'emotion'
  | 'transition'
  | 'climax'
  | 'exposition'
  | 'foreshadowing'
  | 'revelation'
  | 'daily_life'
  | 'combat'
  | 'romance'
  | 'mystery'
  | 'humor';

export type WritingIntent =
  | 'advance_plot'
  | 'develop_character'
  | 'build_atmosphere'
  | 'express_emotion'
  | 'create_tension'
  | 'reveal_information'
  | 'plant_foreshadowing'
  | 'resolve_conflict'
  | 'transition'
  | 'worldbuilding';

export interface SceneAnalysis {
  sceneType: SceneType;
  confidence: number;
  characteristics: {
    pacing: 'fast' | 'medium' | 'slow';
    emotionalIntensity: number;
    dialogueRatio: number;
    descriptionRatio: number;
    actionRatio: number;
  };
  writingIntents: Array<{
    intent: WritingIntent;
    confidence: number;
    evidence: string;
  }>;
  styleMarkers: StyleMarker[];
  suggestions: string[];
}

export interface StyleMarker {
  type: 'sentence' | 'vocabulary' | 'rhetoric' | 'structure';
  pattern: string;
  examples: string[];
  frequency: number;
  effectiveness: number;
}

export interface AnnotatedContent {
  original: string;
  annotations: Array<{
    start: number;
    end: number;
    type: 'scene' | 'intent' | 'style';
    label: string;
    confidence: number;
    notes?: string;
  }>;
  overallAnalysis: {
    primarySceneType: SceneType;
    primaryIntents: WritingIntent[];
    styleScore: number;
    readabilityScore: number;
  };
}

export interface StyleConstraint {
  category: string;
  rule: string;
  examples: string[];
  priority: 'required' | 'preferred' | 'optional';
}

export interface ReferencePassage {
  id: string;
  content: string;
  sceneType: SceneType;
  intents: WritingIntent[];
  styleMarkers: StyleMarker[];
  source: string;
  metadata: {
    chapter?: string;
    genre?: string;
    author?: string;
  };
  embedding?: number[];
}

const SCENE_TYPE_PROMPT = `你是一个专业的网文场景分析专家。分析以下文本片段，判断其场景类型和写作意图。

场景类型包括：
- action: 动作/战斗场景
- dialogue: 对话为主的场景
- description: 描写为主的场景（环境/人物）
- emotion: 情感表达为主的场景
- transition: 过渡场景
- climax: 高潮场景
- exposition: 说明/背景介绍
- foreshadowing: 埋伏笔
- revelation: 揭示/揭秘
- daily_life: 日常生活
- combat: 战斗场景
- romance: 感情戏
- mystery: 悬疑场景
- humor: 幽默场景

写作意图包括：
- advance_plot: 推动剧情发展
- develop_character: 塑造人物形象
- build_atmosphere: 营造氛围
- express_emotion: 表达情感
- create_tension: 制造紧张感
- reveal_information: 揭示信息
- plant_foreshadowing: 埋下伏笔
- resolve_conflict: 解决冲突
- transition: 场景过渡
- worldbuilding: 世界观构建

请分析并输出 JSON 格式：
{
  "sceneType": "场景类型",
  "confidence": 0.95,
  "characteristics": {
    "pacing": "fast/medium/slow",
    "emotionalIntensity": 0.8,
    "dialogueRatio": 0.3,
    "descriptionRatio": 0.2,
    "actionRatio": 0.5
  },
  "writingIntents": [
    {
      "intent": "意图类型",
      "confidence": 0.9,
      "evidence": "具体文本证据"
    }
  ],
  "styleMarkers": [
    {
      "type": "sentence/vocabulary/rhetoric/structure",
      "pattern": "模式描述",
      "examples": ["示例1"],
      "frequency": 0.5,
      "effectiveness": 0.8
    }
  ],
  "suggestions": ["改进建议"]
}`;

const STYLE_CONSTRAINT_PROMPT = `基于以下参考范文，提取风格约束规则。

参考范文：
{referenceContent}

请提取以下类型的约束：
1. 句式约束：句子长度偏好、结构特点
2. 词汇约束：用词风格、修辞偏好
3. 节奏约束：段落节奏、场景节奏
4. 描写约束：描写密度、感官侧重

输出 JSON 格式：
{
  "constraints": [
    {
      "category": "sentence/vocabulary/pacing/description",
      "rule": "约束规则描述",
      "examples": ["示例"],
      "priority": "required/preferred/optional"
    }
  ]
}`;

export class EnhancedStyleAnalysisService {
  private projectPath: string;
  private styleLearningService: AuthorStyleLearningService | null = null;
  private referencePassages: Map<string, ReferencePassage> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  setStyleLearningService(service: AuthorStyleLearningService): void {
    this.styleLearningService = service;
  }

  async initialize(): Promise<void> {
    await this.loadReferencePassages();
  }

  private async loadReferencePassages(): Promise<void> {
    const passagesPath = `${this.projectPath}/.ai-workshop/style/passages.json`;

    if (await workshopService.pathExists(passagesPath)) {
      try {
        const content = await workshopService.readFile(passagesPath);
        const data = JSON.parse(content);

        for (const passage of data.passages || []) {
          this.referencePassages.set(passage.id, passage);
        }
      } catch (error) {
        logger.error('加载参考范文失败', { error: String(error) });
      }
    }
  }

  private async saveReferencePassages(): Promise<void> {
    const passagesPath = `${this.projectPath}/.ai-workshop/style/passages.json`;
    const data = {
      passages: Array.from(this.referencePassages.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(passagesPath, JSON.stringify(data, null, 2));
  }

  async analyzeScene(content: string): Promise<SceneAnalysis> {
    const prompt = `${SCENE_TYPE_PROMPT}

${content.substring(0, 2000)}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1024,
      });

      const content_response = response.content || '';
      const jsonMatch = content_response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultSceneAnalysis(content);
      }

      return JSON.parse(jsonMatch[0]) as SceneAnalysis;
    } catch (error) {
      logger.error('场景分析失败', { error: String(error) });
      return this.getDefaultSceneAnalysis(content);
    }
  }

  private getDefaultSceneAnalysis(content: string): SceneAnalysis {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const avgLength =
      sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
        : 25;

    const dialogues = (content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || []).length;
    const dialogueRatio = content.length > 0 ? (dialogues * 20) / content.length : 0;

    return {
      sceneType: 'description',
      confidence: 0.5,
      characteristics: {
        pacing: avgLength < 20 ? 'fast' : avgLength > 40 ? 'slow' : 'medium',
        emotionalIntensity: 0.5,
        dialogueRatio,
        descriptionRatio: 1 - dialogueRatio,
        actionRatio: 0,
      },
      writingIntents: [{ intent: 'advance_plot', confidence: 0.5, evidence: '默认推断' }],
      styleMarkers: [],
      suggestions: [],
    };
  }

  async annotateContent(content: string): Promise<AnnotatedContent> {
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    const annotations: AnnotatedContent['annotations'] = [];

    let currentPos = 0;

    for (const paragraph of paragraphs) {
      const start = content.indexOf(paragraph, currentPos);
      const end = start + paragraph.length;

      const analysis = await this.analyzeScene(paragraph);

      annotations.push({
        start,
        end,
        type: 'scene',
        label: analysis.sceneType,
        confidence: analysis.confidence,
        notes: analysis.writingIntents.map((i) => i.intent).join(', '),
      });

      for (const intent of analysis.writingIntents) {
        annotations.push({
          start,
          end,
          type: 'intent',
          label: intent.intent,
          confidence: intent.confidence,
          notes: intent.evidence,
        });
      }

      currentPos = end;
    }

    const overallAnalysis = await this.analyzeOverallContent(content);

    return {
      original: content,
      annotations,
      overallAnalysis,
    };
  }

  private async analyzeOverallContent(
    content: string
  ): Promise<AnnotatedContent['overallAnalysis']> {
    const analysis = await this.analyzeScene(content);

    return {
      primarySceneType: analysis.sceneType,
      primaryIntents: analysis.writingIntents.slice(0, 3).map((i) => i.intent),
      styleScore: 0.7,
      readabilityScore: 0.7,
    };
  }

  async addReferencePassage(
    content: string,
    metadata: {
      sceneType?: SceneType;
      intents?: WritingIntent[];
      source?: string;
      chapter?: string;
      genre?: string;
    }
  ): Promise<ReferencePassage> {
    const analysis = await this.analyzeScene(content);

    const passage: ReferencePassage = {
      id: `passage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      content,
      sceneType: metadata.sceneType || analysis.sceneType,
      intents: metadata.intents || analysis.writingIntents.map((i) => i.intent),
      styleMarkers: analysis.styleMarkers,
      source: metadata.source || 'user_upload',
      metadata: {
        chapter: metadata.chapter,
        genre: metadata.genre,
      },
    };

    this.referencePassages.set(passage.id, passage);
    await this.saveReferencePassages();

    if (this.styleLearningService) {
      await this.styleLearningService.learnFromContent(content, {
        genre: metadata.genre,
        chapter: metadata.chapter,
      });
    }

    logger.info('添加参考范文', { id: passage.id, sceneType: passage.sceneType });
    return passage;
  }

  async getReferencePassagesForScene(
    sceneType: SceneType,
    intents?: WritingIntent[],
    limit: number = 3
  ): Promise<ReferencePassage[]> {
    const passages = Array.from(this.referencePassages.values());

    const scored = passages.map((p) => {
      let score = 0;

      if (p.sceneType === sceneType) {
        score += 0.5;
      }

      if (intents) {
        const matchingIntents = p.intents.filter((i) => intents.includes(i));
        score += (matchingIntents.length / intents.length) * 0.5;
      }

      return { passage: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.passage);
  }

  async generateStyleConstraints(
    sceneType: SceneType,
    intents?: WritingIntent[]
  ): Promise<StyleConstraint[]> {
    const references = await this.getReferencePassagesForScene(sceneType, intents, 3);

    if (references.length === 0) {
      return this.getDefaultConstraints(sceneType);
    }

    const referenceContent = references
      .map((r, i) => `【范文${i + 1}】\n${r.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `${STYLE_CONSTRAINT_PROMPT.replace('{referenceContent}', referenceContent)}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1024,
      });

      const content_response = response.content || '';
      const jsonMatch = content_response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultConstraints(sceneType);
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.constraints as StyleConstraint[];
    } catch (error) {
      logger.error('生成风格约束失败', { error: String(error) });
      return this.getDefaultConstraints(sceneType);
    }
  }

  private getDefaultConstraints(sceneType: SceneType): StyleConstraint[] {
    const baseConstraints: StyleConstraint[] = [];

    const sceneConstraints: Partial<Record<SceneType, StyleConstraint[]>> = {
      action: [
        {
          category: 'pacing',
          rule: '使用短句，保持快节奏',
          examples: ['剑光一闪', '身形暴退'],
          priority: 'preferred',
        },
        {
          category: 'vocabulary',
          rule: '使用有力的动词',
          examples: ['劈', '斩', '刺', '闪'],
          priority: 'preferred',
        },
      ],
      dialogue: [
        {
          category: 'structure',
          rule: '对话简洁，符合人物性格',
          examples: ['"你说什么？"', '"我什么都不知道。"'],
          priority: 'required',
        },
      ],
      description: [
        {
          category: 'description',
          rule: '调动多种感官',
          examples: ['空气中弥漫着淡淡的花香', '阳光透过树叶洒下斑驳的光影'],
          priority: 'preferred',
        },
      ],
      emotion: [
        {
          category: 'vocabulary',
          rule: '通过细节展现情感',
          examples: ['她的手微微颤抖', '他深吸一口气'],
          priority: 'preferred',
        },
      ],
      combat: [
        {
          category: 'pacing',
          rule: '战斗场景节奏紧凑',
          examples: ['剑气纵横', '身形交错'],
          priority: 'preferred',
        },
      ],
      climax: [
        {
          category: 'pacing',
          rule: '高潮场景张力拉满',
          examples: ['关键时刻', '生死一线'],
          priority: 'preferred',
        },
      ],
    };

    return sceneConstraints[sceneType] || baseConstraints;
  }

  async buildStylePrompt(
    sceneType: SceneType,
    intents: WritingIntent[],
    context?: string
  ): Promise<string> {
    const constraints = await this.generateStyleConstraints(sceneType, intents);
    const references = await this.getReferencePassagesForScene(sceneType, intents, 2);

    const parts: string[] = [];

    parts.push('## 风格要求\n');

    if (constraints.length > 0) {
      parts.push('请遵循以下风格约束：\n');
      for (const constraint of constraints) {
        const priorityLabel = {
          required: '【必须】',
          preferred: '【推荐】',
          optional: '【可选】',
        };
        parts.push(`${priorityLabel[constraint.priority]} ${constraint.rule}\n`);
        if (constraint.examples.length > 0) {
          parts.push(`示例：${constraint.examples.join('、')}\n`);
        }
      }
    }

    if (references.length > 0) {
      parts.push('\n## 参考范文\n');
      for (let i = 0; i < references.length; i++) {
        parts.push(`### 参考${i + 1}\n`);
        parts.push(`${references[i].content.substring(0, 300)}...\n\n`);
      }
    }

    if (context) {
      parts.push('\n## 当前上下文\n');
      parts.push(`${context}\n`);
    }

    return parts.join('');
  }

  getReferencePassages(): ReferencePassage[] {
    return Array.from(this.referencePassages.values());
  }

  async deleteReferencePassage(id: string): Promise<boolean> {
    const deleted = this.referencePassages.delete(id);
    if (deleted) {
      await this.saveReferencePassages();
    }
    return deleted;
  }

  async getStyleProfile(): Promise<AuthorStyleProfile | null> {
    return this.styleLearningService?.getProfile() || null;
  }
}

export function createEnhancedStyleAnalysisService(
  projectPath: string
): EnhancedStyleAnalysisService {
  return new EnhancedStyleAnalysisService(projectPath);
}

let globalStyleAnalysisService: EnhancedStyleAnalysisService | null = null;

export function initGlobalStyleAnalysisService(projectPath: string): EnhancedStyleAnalysisService {
  globalStyleAnalysisService = new EnhancedStyleAnalysisService(projectPath);
  return globalStyleAnalysisService;
}

export function getGlobalStyleAnalysisService(): EnhancedStyleAnalysisService | null {
  return globalStyleAnalysisService;
}

export const enhancedStyleAnalysisService = {
  async analyzeScene(content: string): Promise<SceneAnalysis> {
    if (!globalStyleAnalysisService) {
      throw new Error('StyleAnalysisService not initialized');
    }
    return globalStyleAnalysisService.analyzeScene(content);
  },

  async addReferencePassage(
    content: string,
    metadata: {
      sceneType?: SceneType;
      intents?: WritingIntent[];
      source?: string;
      chapter?: string;
      genre?: string;
    }
  ): Promise<ReferencePassage> {
    if (!globalStyleAnalysisService) {
      throw new Error('StyleAnalysisService not initialized');
    }
    return globalStyleAnalysisService.addReferencePassage(content, metadata);
  },

  async generateStyleConstraints(
    sceneType: SceneType,
    intents?: WritingIntent[]
  ): Promise<StyleConstraint[]> {
    if (!globalStyleAnalysisService) {
      throw new Error('StyleAnalysisService not initialized');
    }
    return globalStyleAnalysisService.generateStyleConstraints(sceneType, intents);
  },

  async buildStylePrompt(
    sceneType: SceneType,
    intents: WritingIntent[],
    context?: string
  ): Promise<string> {
    if (!globalStyleAnalysisService) {
      throw new Error('StyleAnalysisService not initialized');
    }
    return globalStyleAnalysisService.buildStylePrompt(sceneType, intents, context);
  },

  getReferencePassages(): ReferencePassage[] {
    if (!globalStyleAnalysisService) {
      return [];
    }
    return globalStyleAnalysisService.getReferencePassages();
  },
};
