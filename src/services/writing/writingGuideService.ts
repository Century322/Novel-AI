import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export type GuideType =
  | 'plot_structure'
  | 'character_development'
  | 'dialogue_writing'
  | 'scene_description'
  | 'pacing_control'
  | 'emotion_expression'
  | 'world_building'
  | 'theme_development';

export type GuidePriority = 'high' | 'medium' | 'low';

export interface WritingGuide {
  id: string;
  type: GuideType;
  title: string;
  description: string;
  principles: string[];
  examples: string[];
  commonMistakes: string[];
  tips: string[];
  relatedGuides: string[];
}

export interface GuideSuggestion {
  id: string;
  guideType: GuideType;
  priority: GuidePriority;
  context: string;
  suggestion: string;
  reason: string;
  examples: string[];
  createdAt: number;
}

export interface WritingSession {
  id: string;
  startTime: number;
  endTime?: number;
  chapter: number;
  wordCount: number;
  guidesUsed: string[];
  suggestions: GuideSuggestion[];
  achievements: string[];
}

const DEFAULT_GUIDES: WritingGuide[] = [
  {
    id: 'guide_plot_structure',
    type: 'plot_structure',
    title: '情节结构指导',
    description: '如何构建引人入胜的情节结构',
    principles: [
      '开篇要抓住读者注意力',
      '冲突是推动故事发展的核心动力',
      '高潮前的铺垫要充分',
      '结局要合理且令人满意',
    ],
    examples: ['《三体》开篇通过科学家自杀制造悬念', '《哈利波特》通过伏地魔的威胁建立核心冲突'],
    commonMistakes: ['开篇节奏过慢', '冲突不够强烈', '结局仓促或强行'],
    tips: ['使用"钩子"开篇', '每章结尾设置悬念', '确保主线清晰'],
    relatedGuides: ['guide_pacing_control', 'guide_theme_development'],
  },
  {
    id: 'guide_character_development',
    type: 'character_development',
    title: '角色塑造指导',
    description: '如何塑造立体丰满的角色',
    principles: [
      '角色要有明确的动机和目标',
      '角色需要有缺点和成长空间',
      '通过行动而非描述来展现性格',
      '角色之间的关系要有层次',
    ],
    examples: ['林黛玉的多愁善感与才华横溢形成对比', '韦小宝的市井气与重情义并存'],
    commonMistakes: ['角色过于完美', '所有角色说话方式相同', '角色行为前后矛盾'],
    tips: ['为角色创建详细档案', '让角色在压力下展现真实性格', '通过对话展现角色特点'],
    relatedGuides: ['guide_dialogue_writing', 'guide_emotion_expression'],
  },
  {
    id: 'guide_dialogue_writing',
    type: 'dialogue_writing',
    title: '对话写作指导',
    description: '如何写出自然生动的对话',
    principles: [
      '对话要推动情节或展现角色',
      '每句话要有说话者的特点',
      '避免信息倾倒式对话',
      '适当使用潜台词',
    ],
    examples: [
      '"你来了。"她没有抬头，只是轻轻搅动杯中的茶。',
      '"我本不想来的。"他顿了顿，"但有些事，总要有人做。"',
    ],
    commonMistakes: ['对话过于书面化', '所有角色说话方式相同', '对话内容与情节无关'],
    tips: ['大声朗读对话检查自然度', '为不同角色设计独特的说话习惯', '用动作和表情丰富对话'],
    relatedGuides: ['guide_character_development', 'guide_scene_description'],
  },
  {
    id: 'guide_scene_description',
    type: 'scene_description',
    title: '场景描写指导',
    description: '如何营造身临其境的场景',
    principles: [
      '调动读者的多种感官',
      '描写要服务于情节和氛围',
      '避免过度描写',
      '用细节而非形容词来展现',
    ],
    examples: [
      '空气中弥漫着潮湿的泥土气息，远处传来隐约的雷声。',
      '破旧的木门发出吱呀声，灰尘在透过缝隙的阳光中飞舞。',
    ],
    commonMistakes: ['堆砌形容词', '描写与情节脱节', '忽略感官细节'],
    tips: ['选择最能传达氛围的细节', '将描写融入角色行动', '使用比喻和象征'],
    relatedGuides: ['guide_emotion_expression', 'guide_world_building'],
  },
  {
    id: 'guide_pacing_control',
    type: 'pacing_control',
    title: '节奏控制指导',
    description: '如何把控故事的节奏',
    principles: [
      '紧张与舒缓交替',
      '重要场景放慢节奏',
      '过渡场景简洁处理',
      '根据情节需要调整段落长度',
    ],
    examples: ['战斗场景使用短句增加紧张感', '情感场景使用长句营造氛围'],
    commonMistakes: ['全程高能导致读者疲劳', '节奏过于平缓', '高潮处理仓促'],
    tips: ['用句式长度控制节奏', '在紧张处留白', '高潮前适当铺垫'],
    relatedGuides: ['guide_plot_structure', 'guide_emotion_expression'],
  },
  {
    id: 'guide_emotion_expression',
    type: 'emotion_expression',
    title: '情感表达指导',
    description: '如何让读者感同身受',
    principles: ['展示而非讲述情感', '通过细节传达情绪', '情感变化要有铺垫', '避免过度煽情'],
    examples: ['她的手微微颤抖，茶水溅出几滴落在桌面上。', '他沉默了许久，最后只是轻轻叹了口气。'],
    commonMistakes: ['直接告诉读者角色感受', '情感转折突兀', '过度使用感叹号'],
    tips: ['用身体反应表现情感', '通过环境烘托情绪', '让读者自己体会'],
    relatedGuides: ['guide_character_development', 'guide_scene_description'],
  },
  {
    id: 'guide_world_building',
    type: 'world_building',
    title: '世界观构建指导',
    description: '如何构建可信的故事世界',
    principles: ['设定要内在一致', '从角色视角展现世界', '避免设定倾倒', '细节决定真实感'],
    examples: ['《指环王》的中土世界有完整的历史和语言', '《三体》的科幻设定基于真实物理学'],
    commonMistakes: ['设定前后矛盾', '过度解释设定', '忽略日常生活细节'],
    tips: ['创建世界设定文档', '让角色与世界观互动', '保留一些神秘感'],
    relatedGuides: ['guide_scene_description', 'guide_plot_structure'],
  },
  {
    id: 'guide_theme_development',
    type: 'theme_development',
    title: '主题深化指导',
    description: '如何让故事有深度',
    principles: ['主题通过故事自然展现', '避免说教', '多层次的主题更耐人寻味', '角色成长体现主题'],
    examples: ['《老人与海》通过老人的抗争展现人类尊严', '《1984》通过极权社会探讨自由与控制'],
    commonMistakes: ['主题过于直白', '故事与主题脱节', '强行升华'],
    tips: ['让角色面临道德选择', '用象征和隐喻', '结局呼应主题'],
    relatedGuides: ['guide_plot_structure', 'guide_character_development'],
  },
];

export class WritingGuideService {
  private projectPath: string;
  private guides: Map<string, WritingGuide> = new Map();
  private suggestions: Map<string, GuideSuggestion[]> = new Map();
  private sessions: Map<string, WritingSession> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.initializeDefaultGuides();
    this.loadFromDisk();
  }

  private initializeDefaultGuides(): void {
    for (const guide of DEFAULT_GUIDES) {
      this.guides.set(guide.id, guide);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/写作指导`;

      const customGuidesContent = await workshopService.readFile(`${basePath}/自定义指导.json`);
      if (customGuidesContent) {
        const customGuides: WritingGuide[] = JSON.parse(customGuidesContent);
        for (const guide of customGuides) {
          this.guides.set(guide.id, guide);
        }
      }

      const suggestionsContent = await workshopService.readFile(`${basePath}/建议记录.json`);
      if (suggestionsContent) {
        const data: Record<string, GuideSuggestion[]> = JSON.parse(suggestionsContent);
        for (const [chapter, chapterSuggestions] of Object.entries(data)) {
          this.suggestions.set(chapter, chapterSuggestions);
        }
      }

      const sessionsContent = await workshopService.readFile(`${basePath}/写作会话.json`);
      if (sessionsContent) {
        const data: WritingSession[] = JSON.parse(sessionsContent);
        this.sessions = new Map(data.map((s) => [s.id, s]));
      }
    } catch (error) {
      logger.error('加载写作指南数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/写作指导`;
      await workshopService.createDirectory(basePath);

      const customGuides = Array.from(this.guides.values()).filter(
        (g) => !DEFAULT_GUIDES.some((d) => d.id === g.id)
      );
      await workshopService.writeFile(
        `${basePath}/自定义指导.json`,
        JSON.stringify(customGuides, null, 2)
      );

      const suggestionsObj: Record<string, GuideSuggestion[]> = {};
      for (const [chapter, chapterSuggestions] of this.suggestions) {
        suggestionsObj[chapter] = chapterSuggestions;
      }
      await workshopService.writeFile(
        `${basePath}/建议记录.json`,
        JSON.stringify(suggestionsObj, null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/写作会话.json`,
        JSON.stringify(Array.from(this.sessions.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存写作指南数据失败', { error });
    }
  }

  getGuide(id: string): WritingGuide | undefined {
    return this.guides.get(id);
  }

  getGuidesByType(type: GuideType): WritingGuide[] {
    return Array.from(this.guides.values()).filter((g) => g.type === type);
  }

  getAllGuides(): WritingGuide[] {
    return Array.from(this.guides.values());
  }

  addGuide(guide: Omit<WritingGuide, 'id'>): WritingGuide {
    const newGuide: WritingGuide = {
      id: `guide_${uuidv4()}`,
      ...guide,
    };
    this.guides.set(newGuide.id, newGuide);
    this.saveToDisk();
    return newGuide;
  }

  updateGuide(id: string, updates: Partial<WritingGuide>): WritingGuide | null {
    const guide = this.guides.get(id);
    if (!guide) {
      return null;
    }

    const updated = { ...guide, ...updates };
    this.guides.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  deleteGuide(id: string): boolean {
    if (DEFAULT_GUIDES.some((g) => g.id === id)) {
      return false;
    }
    const result = this.guides.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  async analyzeContent(
    content: string,
    chapter: number,
    context?: string
  ): Promise<GuideSuggestion[]> {
    const suggestions: GuideSuggestion[] = [];

    const prompt = `分析以下小说内容，提供写作指导建议：

内容：
${content.substring(0, 1000)}

${context ? `上下文：${context}` : ''}

请分析以下方面并提供改进建议：
1. 情节结构
2. 角色塑造
3. 对话写作
4. 场景描写
5. 节奏控制
6. 情感表达

以JSON格式返回建议数组：
[
  {
    "guideType": "plot_structure|character_development|dialogue_writing|scene_description|pacing_control|emotion_expression|world_building|theme_development",
    "priority": "high|medium|low",
    "context": "相关上下文",
    "suggestion": "具体建议",
    "reason": "建议原因",
    "examples": ["示例1", "示例2"]
  }
]`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 1000,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const item of parsed) {
          suggestions.push({
            id: `suggestion_${uuidv4()}`,
            guideType: item.guideType,
            priority: item.priority,
            context: item.context,
            suggestion: item.suggestion,
            reason: item.reason,
            examples: item.examples || [],
            createdAt: Date.now(),
          });
        }
      }
    } catch (error) {
      logger.error('分析内容失败', { error });
    }

    const chapterKey = `chapter_${chapter}`;
    if (!this.suggestions.has(chapterKey)) {
      this.suggestions.set(chapterKey, []);
    }
    this.suggestions.get(chapterKey)!.push(...suggestions);
    await this.saveToDisk();

    return suggestions;
  }

  getSuggestionsByChapter(chapter: number): GuideSuggestion[] {
    return this.suggestions.get(`chapter_${chapter}`) || [];
  }

  startWritingSession(chapter: number): WritingSession {
    const session: WritingSession = {
      id: `session_${uuidv4()}`,
      startTime: Date.now(),
      chapter,
      wordCount: 0,
      guidesUsed: [],
      suggestions: [],
      achievements: [],
    };
    this.sessions.set(session.id, session);
    this.saveToDisk();
    return session;
  }

  updateWritingSession(
    sessionId: string,
    updates: { wordCount?: number; guidesUsed?: string[] }
  ): WritingSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (updates.wordCount !== undefined) {
      session.wordCount = updates.wordCount;
    }
    if (updates.guidesUsed) {
      session.guidesUsed = [...new Set([...session.guidesUsed, ...updates.guidesUsed])];
    }

    this.saveToDisk();
    return session;
  }

  endWritingSession(sessionId: string): WritingSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.endTime = Date.now();

    if (session.wordCount >= 1000) {
      session.achievements.push('千字达人');
    }
    if (session.wordCount >= 3000) {
      session.achievements.push('勤奋写手');
    }
    if (session.guidesUsed.length >= 3) {
      session.achievements.push('学习达人');
    }

    this.saveToDisk();
    return session;
  }

  getSession(id: string): WritingSession | undefined {
    return this.sessions.get(id);
  }

  getRecentSessions(count: number = 10): WritingSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, count);
  }

  getStats(): {
    totalGuides: number;
    customGuides: number;
    totalSuggestions: number;
    totalSessions: number;
    totalWordCount: number;
    byGuideType: Record<GuideType, number>;
  } {
    const allSuggestions = Array.from(this.suggestions.values()).flat();
    const allSessions = Array.from(this.sessions.values());

    const byGuideType: Record<GuideType, number> = {
      plot_structure: 0,
      character_development: 0,
      dialogue_writing: 0,
      scene_description: 0,
      pacing_control: 0,
      emotion_expression: 0,
      world_building: 0,
      theme_development: 0,
    };

    for (const suggestion of allSuggestions) {
      byGuideType[suggestion.guideType]++;
    }

    return {
      totalGuides: this.guides.size,
      customGuides: this.guides.size - DEFAULT_GUIDES.length,
      totalSuggestions: allSuggestions.length,
      totalSessions: allSessions.length,
      totalWordCount: allSessions.reduce((sum, s) => sum + s.wordCount, 0),
      byGuideType,
    };
  }
}

export function createWritingGuideService(projectPath: string): WritingGuideService {
  return new WritingGuideService(projectPath);
}

export const writingGuideService = new WritingGuideService('');
