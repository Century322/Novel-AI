import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';

export interface CreativeIntent {
  id: string;
  timestamp: number;
  type: IntentType;
  content: string;
  context: IntentContext;
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  relatedIntents: string[];
  result?: string;
  feedback?: string;
}

export type IntentType =
  | 'continue_writing'
  | 'revise_content'
  | 'add_character'
  | 'develop_plot'
  | 'add_description'
  | 'add_dialogue'
  | 'resolve_foreshadowing'
  | 'change_style'
  | 'fix_inconsistency'
  | 'expand_scene'
  | 'condense_content'
  | 'change_pov'
  | 'add_emotion'
  | 'other';

export interface IntentContext {
  targetFile?: string;
  targetPosition?: number;
  targetCharacters?: string[];
  targetLocation?: string;
  previousIntent?: string;
  sessionContext?: string;
  projectPhase?: 'beginning' | 'middle' | 'climax' | 'ending';
}

export interface IntentChain {
  id: string;
  name: string;
  createdAt: number;
  intents: string[];
  status: 'active' | 'completed' | 'abandoned';
  goal: string;
  progress: number;
}

export interface IntentAnalysis {
  detectedType: IntentType;
  confidence: number;
  extractedEntities: ExtractedEntities;
  suggestedActions: SuggestedAction[];
  relatedPastIntents: string[];
}

export interface ExtractedEntities {
  characters: string[];
  locations: string[];
  actions: string[];
  emotions: string[];
  objects: string[];
  timeReferences: string[];
}

export interface SuggestedAction {
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTokens: number;
}

export class CreativeIntentService {
  private projectPath: string;
  private intents: Map<string, CreativeIntent> = new Map();
  private chains: Map<string, IntentChain> = new Map();
  private currentChain: IntentChain | null = null;
  private recentIntents: CreativeIntent[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    await this.loadIntents();
    await this.loadChains();
  }

  private async loadIntents(): Promise<void> {
    const intentsPath = `${this.projectPath}/.ai-workshop/intents/intents.json`;

    if (await workshopService.pathExists(intentsPath)) {
      try {
        const content = await workshopService.readFile(intentsPath);
        const data = JSON.parse(content);

        for (const intent of data.intents || []) {
          this.intents.set(intent.id, intent);
        }

        this.recentIntents = (data.intents || [])
          .sort((a: CreativeIntent, b: CreativeIntent) => b.timestamp - a.timestamp)
          .slice(0, 10);
      } catch (error) {
        logger.error('加载意图数据失败', { error });
      }
    }
  }

  private async saveIntents(): Promise<void> {
    const intentsPath = `${this.projectPath}/.ai-workshop/intents/intents.json`;
    const data = {
      intents: Array.from(this.intents.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(intentsPath, JSON.stringify(data, null, 2));
  }

  private async loadChains(): Promise<void> {
    const chainsPath = `${this.projectPath}/.ai-workshop/intents/chains.json`;

    if (await workshopService.pathExists(chainsPath)) {
      try {
        const content = await workshopService.readFile(chainsPath);
        const data = JSON.parse(content);

        for (const chain of data.chains || []) {
          this.chains.set(chain.id, chain);
          if (chain.status === 'active') {
            this.currentChain = chain;
          }
        }
      } catch (error) {
        logger.error('加载意图链数据失败', { error });
      }
    }
  }

  private async saveChains(): Promise<void> {
    const chainsPath = `${this.projectPath}/.ai-workshop/intents/chains.json`;
    const data = {
      chains: Array.from(this.chains.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(chainsPath, JSON.stringify(data, null, 2));
  }

  analyzeIntent(userInput: string): IntentAnalysis {
    const detectedType = this.detectIntentType(userInput);
    const extractedEntities = this.extractEntities(userInput);
    const relatedPastIntents = this.findRelatedIntents(userInput, detectedType);
    const suggestedActions = this.generateSuggestedActions(detectedType, extractedEntities);

    return {
      detectedType,
      confidence: this.calculateConfidence(userInput, detectedType),
      extractedEntities,
      suggestedActions,
      relatedPastIntents,
    };
  }

  private detectIntentType(input: string): IntentType {
    const patterns: { type: IntentType; patterns: RegExp[] }[] = [
      {
        type: 'continue_writing',
        patterns: [/继续写|续写|接着写|往下写/, /写下去|继续/, /下一章|下一节/],
      },
      {
        type: 'revise_content',
        patterns: [/修改|改一下|改改/, /重写|改写/, /这里不对|这里有问题/],
      },
      {
        type: 'add_character',
        patterns: [/添加人物|新增人物|加入人物/, /创建角色|新角色/, /人物设定|角色设定/],
      },
      {
        type: 'develop_plot',
        patterns: [/发展情节|推进剧情/, /增加冲突|制造冲突/, /转折|反转/],
      },
      {
        type: 'add_description',
        patterns: [/添加描写|增加描写/, /描写一下|描述一下/, /详细写|写得详细/],
      },
      {
        type: 'add_dialogue',
        patterns: [/添加对话|增加对话/, /写对话|对话/, /让他们对话|人物对话/],
      },
      {
        type: 'resolve_foreshadowing',
        patterns: [/回收伏笔|解决伏笔/, /回应伏笔|伏笔/, /揭示|揭晓/],
      },
      {
        type: 'change_style',
        patterns: [/改变风格|换种风格/, /文风|风格/, /语气|语调/],
      },
      {
        type: 'fix_inconsistency',
        patterns: [/修复|修正|纠正/, /不一致|矛盾/, /前后不符/],
      },
      {
        type: 'expand_scene',
        patterns: [/扩展|展开/, /详细写|扩写/, /丰富|充实/],
      },
      {
        type: 'condense_content',
        patterns: [/压缩|精简|简化/, /缩短|删减/, /太长了|啰嗦/],
      },
      {
        type: 'change_pov',
        patterns: [/换视角|改变视角/, /第一人称|第三人称/, /视角转换/],
      },
      {
        type: 'add_emotion',
        patterns: [/增加情感|添加情感/, /情感|情绪/, /感动|情感描写/],
      },
    ];

    for (const { type, patterns: typePatterns } of patterns) {
      for (const pattern of typePatterns) {
        if (pattern.test(input)) {
          return type;
        }
      }
    }

    return 'other';
  }

  private extractEntities(input: string): ExtractedEntities {
    const characters = this.extractCharacters(input);
    const locations = this.extractLocations(input);
    const actions = this.extractActions(input);
    const emotions = this.extractEmotions(input);
    const objects = this.extractObjects(input);
    const timeReferences = this.extractTimeReferences(input);

    return {
      characters,
      locations,
      actions,
      emotions,
      objects,
      timeReferences,
    };
  }

  private extractCharacters(input: string): string[] {
    const characters: string[] = [];
    const charPattern = /[\u4e00-\u9fa5]{2,4}(说|道|问|答|笑|哭|喊|叫|想|看)/g;
    const matches = input.matchAll(charPattern);

    for (const match of matches) {
      if (match[0]) {
        characters.push(match[0].replace(/[说问道答笑哭喊叫想看]/g, ''));
      }
    }

    const quotedNames = input.match(/[""「」『』]([^""「」『』]+)[""「」『』]/g) || [];
    for (const quoted of quotedNames) {
      const name = quoted.slice(1, -1);
      if (name.length >= 2 && name.length <= 4) {
        characters.push(name);
      }
    }

    return [...new Set(characters)];
  }

  private extractLocations(input: string): string[] {
    const locations: string[] = [];
    const patterns = [
      /在([\u4e00-\u9fa5]{2,6})(里|中|内|上|下|旁|边)/g,
      /来到([\u4e00-\u9fa5]{2,6})/g,
      /离开([\u4e00-\u9fa5]{2,6})/g,
    ];

    for (const pattern of patterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          locations.push(match[1]);
        }
      }
    }

    return [...new Set(locations)];
  }

  private extractActions(input: string): string[] {
    const actions: string[] = [];
    const actionPattern = /(写|改|删|加|创建|删除|修改|添加|续写|重写)[\u4e00-\u9fa5]*/g;
    const matches = input.matchAll(actionPattern);

    for (const match of matches) {
      if (match[0]) {
        actions.push(match[0]);
      }
    }

    return [...new Set(actions)];
  }

  private extractEmotions(input: string): string[] {
    const emotionWords = [
      '高兴',
      '悲伤',
      '愤怒',
      '恐惧',
      '惊讶',
      '期待',
      '失望',
      '感动',
      '紧张',
      '放松',
    ];
    const found: string[] = [];

    for (const emotion of emotionWords) {
      if (input.includes(emotion)) {
        found.push(emotion);
      }
    }

    return found;
  }

  private extractObjects(input: string): string[] {
    const objects: string[] = [];
    const objectPattern = /[""「」『』]([^""「」『』]+)[""「」『』]/g;
    const matches = input.matchAll(objectPattern);

    for (const match of matches) {
      if (match[1] && match[1].length >= 2) {
        objects.push(match[1]);
      }
    }

    return [...new Set(objects)];
  }

  private extractTimeReferences(input: string): string[] {
    const timePatterns = [
      /昨天|今天|明天/,
      /上午|下午|晚上|深夜|凌晨/,
      /第[一二三四五六七八九十百千万\d]+[章节回]/,
      /\d+年前|\d+年后/,
    ];

    const references: string[] = [];
    for (const pattern of timePatterns) {
      const matches = input.match(pattern);
      if (matches) {
        references.push(...matches);
      }
    }

    return references;
  }

  private calculateConfidence(input: string, type: IntentType): number {
    if (type === 'other') {
      return 0.3;
    }

    const typeKeywords: Record<IntentType, string[]> = {
      continue_writing: ['继续', '续写', '接着', '往下'],
      revise_content: ['修改', '改', '重写'],
      add_character: ['人物', '角色', '添加'],
      develop_plot: ['情节', '剧情', '发展'],
      add_description: ['描写', '描述', '详细'],
      add_dialogue: ['对话', '说话'],
      resolve_foreshadowing: ['伏笔', '回收', '揭示'],
      change_style: ['风格', '文风', '语气'],
      fix_inconsistency: ['不一致', '矛盾', '修复'],
      expand_scene: ['扩展', '展开', '详细'],
      condense_content: ['压缩', '精简', '缩短'],
      change_pov: ['视角', '人称'],
      add_emotion: ['情感', '情绪', '感动'],
      other: [],
    };

    const keywords = typeKeywords[type] || [];
    let matchCount = 0;

    for (const keyword of keywords) {
      if (input.includes(keyword)) {
        matchCount++;
      }
    }

    return Math.min(0.9, 0.5 + matchCount * 0.15);
  }

  private findRelatedIntents(input: string, _type: IntentType): string[] {
    const related: string[] = [];
    const keywords = input.match(/[\u4e00-\u9fa5]{2,4}/g) || [];

    for (const intent of this.recentIntents) {
      for (const keyword of keywords) {
        if (intent.content.includes(keyword)) {
          related.push(intent.id);
          break;
        }
      }
    }

    return related.slice(0, 5);
  }

  private generateSuggestedActions(
    type: IntentType,
    entities: ExtractedEntities
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    switch (type) {
      case 'continue_writing':
        actions.push({
          type: 'generate_continuation',
          description: '基于当前内容生成续写',
          priority: 'high',
          estimatedTokens: 500,
        });
        if (entities.characters.length > 0) {
          actions.push({
            type: 'focus_character',
            description: `聚焦于 ${entities.characters.join('、')} 的视角续写`,
            priority: 'medium',
            estimatedTokens: 600,
          });
        }
        break;

      case 'revise_content':
        actions.push({
          type: 'analyze_issues',
          description: '分析当前内容的问题',
          priority: 'high',
          estimatedTokens: 300,
        });
        actions.push({
          type: 'suggest_revisions',
          description: '提供修改建议',
          priority: 'high',
          estimatedTokens: 400,
        });
        break;

      case 'add_character':
        actions.push({
          type: 'create_character_profile',
          description: '创建人物档案',
          priority: 'high',
          estimatedTokens: 400,
        });
        actions.push({
          type: 'introduce_character',
          description: '设计人物出场方式',
          priority: 'medium',
          estimatedTokens: 300,
        });
        break;

      case 'develop_plot':
        actions.push({
          type: 'analyze_current_plot',
          description: '分析当前情节发展',
          priority: 'high',
          estimatedTokens: 300,
        });
        actions.push({
          type: 'suggest_plot_points',
          description: '建议情节发展方向',
          priority: 'high',
          estimatedTokens: 400,
        });
        break;

      case 'add_description':
        actions.push({
          type: 'identify_description_opportunities',
          description: '识别可添加描写的位置',
          priority: 'medium',
          estimatedTokens: 200,
        });
        actions.push({
          type: 'generate_description',
          description: '生成环境/人物描写',
          priority: 'high',
          estimatedTokens: 400,
        });
        break;

      default:
        actions.push({
          type: 'general_assistance',
          description: '提供一般性帮助',
          priority: 'medium',
          estimatedTokens: 300,
        });
    }

    return actions;
  }

  async recordIntent(userInput: string, context: IntentContext = {}): Promise<CreativeIntent> {
    const analysis = this.analyzeIntent(userInput);

    const intent: CreativeIntent = {
      id: `intent_${Date.now()}`,
      timestamp: Date.now(),
      type: analysis.detectedType,
      content: userInput,
      context: {
        ...context,
        previousIntent: this.recentIntents[0]?.id,
      },
      status: 'pending',
      relatedIntents: analysis.relatedPastIntents,
    };

    this.intents.set(intent.id, intent);
    this.recentIntents.unshift(intent);
    this.recentIntents = this.recentIntents.slice(0, 20);

    if (this.currentChain) {
      this.currentChain.intents.push(intent.id);
      await this.saveChains();
    }

    await this.saveIntents();
    return intent;
  }

  async updateIntentStatus(
    intentId: string,
    status: CreativeIntent['status'],
    result?: string,
    feedback?: string
  ): Promise<boolean> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return false;
    }

    intent.status = status;
    if (result) {
      intent.result = result;
    }
    if (feedback) {
      intent.feedback = feedback;
    }

    await this.saveIntents();
    return true;
  }

  async startChain(name: string, goal: string): Promise<IntentChain> {
    const chain: IntentChain = {
      id: `chain_${Date.now()}`,
      name,
      createdAt: Date.now(),
      intents: [],
      status: 'active',
      goal,
      progress: 0,
    };

    this.chains.set(chain.id, chain);
    this.currentChain = chain;
    await this.saveChains();

    return chain;
  }

  async endChain(chainId?: string): Promise<boolean> {
    const chain = chainId ? this.chains.get(chainId) : this.currentChain;
    if (!chain) {
      return false;
    }

    chain.status = 'completed';
    chain.progress = 100;

    if (this.currentChain?.id === chain.id) {
      this.currentChain = null;
    }

    await this.saveChains();
    return true;
  }

  getIntentHistory(limit: number = 20): CreativeIntent[] {
    return Array.from(this.intents.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getIntentChain(chainId: string): IntentChain | undefined {
    return this.chains.get(chainId);
  }

  getActiveChain(): IntentChain | null {
    return this.currentChain;
  }

  getIntentContext(intentId: string): string {
    const intent = this.intents.get(intentId);
    if (!intent) {
      return '';
    }

    let context = '# 创作意图上下文\n\n';
    context += '## 当前意图\n';
    context += `- 类型: ${this.getIntentTypeLabel(intent.type)}\n`;
    context += `- 内容: ${intent.content}\n`;
    context += `- 状态: ${intent.status}\n\n`;

    if (intent.relatedIntents.length > 0) {
      context += '## 相关意图\n';
      for (const relatedId of intent.relatedIntents) {
        const related = this.intents.get(relatedId);
        if (related) {
          context += `- ${this.getIntentTypeLabel(related.type)}: ${related.content.substring(0, 50)}...\n`;
        }
      }
      context += '\n';
    }

    if (this.currentChain) {
      context += `## 当前任务链: ${this.currentChain.name}\n`;
      context += `目标: ${this.currentChain.goal}\n`;
      context += `进度: ${this.currentChain.progress}%\n\n`;
    }

    return context;
  }

  private getIntentTypeLabel(type: IntentType): string {
    const labels: Record<IntentType, string> = {
      continue_writing: '续写',
      revise_content: '修改',
      add_character: '添加人物',
      develop_plot: '发展情节',
      add_description: '添加描写',
      add_dialogue: '添加对话',
      resolve_foreshadowing: '回收伏笔',
      change_style: '改变风格',
      fix_inconsistency: '修复不一致',
      expand_scene: '扩展场景',
      condense_content: '精简内容',
      change_pov: '转换视角',
      add_emotion: '添加情感',
      other: '其他',
    };
    return labels[type] || type;
  }

  predictNextIntent(): IntentType | null {
    if (this.recentIntents.length < 2) {
      return null;
    }

    const recentTypes = this.recentIntents.slice(0, 5).map((i) => i.type);

    const patterns: { sequence: IntentType[]; next: IntentType }[] = [
      { sequence: ['add_character', 'add_dialogue'], next: 'develop_plot' },
      { sequence: ['develop_plot', 'add_description'], next: 'continue_writing' },
      { sequence: ['continue_writing', 'revise_content'], next: 'continue_writing' },
      { sequence: ['add_character', 'add_character'], next: 'develop_plot' },
    ];

    for (const pattern of patterns) {
      const matches = pattern.sequence.every((type, index) => recentTypes[index] === type);
      if (matches) {
        return pattern.next;
      }
    }

    return null;
  }

  getIntentStats(): {
    totalIntents: number;
    byType: Record<IntentType, number>;
    byStatus: Record<string, number>;
    averageCompletionTime: number;
    activeChains: number;
  } {
    const intents = Array.from(this.intents.values());

    const byType: Record<IntentType, number> = {} as Record<IntentType, number>;
    const byStatus: Record<string, number> = {};

    for (const intent of intents) {
      byType[intent.type] = (byType[intent.type] || 0) + 1;
      byStatus[intent.status] = (byStatus[intent.status] || 0) + 1;
    }

    const completedIntents = intents.filter((i) => i.status === 'completed');
    const totalCompletionTime = completedIntents.reduce((sum, i) => {
      const createdIntent = intents.find((intent) => intent.id === i.relatedIntents[0]);
      if (createdIntent) {
        return sum + (i.timestamp - createdIntent.timestamp);
      }
      return sum;
    }, 0);

    return {
      totalIntents: intents.length,
      byType,
      byStatus,
      averageCompletionTime:
        completedIntents.length > 0 ? totalCompletionTime / completedIntents.length : 0,
      activeChains: Array.from(this.chains.values()).filter((c) => c.status === 'active').length,
    };
  }
}

export function createCreativeIntentService(projectPath: string): CreativeIntentService {
  return new CreativeIntentService(projectPath);
}
