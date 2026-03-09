import {
  IntentCategory,
  SpecificIntent,
  IntentResult,
  ToolRecommendation,
  IntentContext,
  INTENT_TOOL_MAPPING,
  INTENT_EXAMPLES,
} from '@/types/ai/intent';
import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';

export class IntentUnderstandingService {
  constructor(_projectPath: string) {}

  async analyzeIntent(userMessage: string, context: IntentContext): Promise<IntentResult> {
    const quickResult = this.quickIntentDetection(userMessage);
    if (quickResult.confidence > 0.9) {
      return quickResult;
    }

    const aiResult = await this.aiIntentAnalysis(userMessage, context);

    if (quickResult.confidence > 0.6 && aiResult.confidence < 0.5) {
      return quickResult;
    }

    return aiResult.confidence > quickResult.confidence ? aiResult : quickResult;
  }

  private quickIntentDetection(userMessage: string): IntentResult {
    const lowerMsg = userMessage.toLowerCase();

    const intentScores: Array<{ intent: SpecificIntent; score: number; category: IntentCategory }> =
      [];

    for (const [intent, examples] of Object.entries(INTENT_EXAMPLES)) {
      let maxScore = 0;
      for (const example of examples) {
        if (lowerMsg.includes(example.toLowerCase())) {
          maxScore = Math.max(maxScore, example.length / lowerMsg.length + 0.5);
        }
      }
      if (maxScore > 0) {
        const category = this.getCategoryFromIntent(intent as SpecificIntent);
        intentScores.push({ intent: intent as SpecificIntent, score: maxScore, category });
      }
    }

    if (intentScores.length === 0) {
      return {
        category: 'chat',
        specificIntent: 'discussion',
        confidence: 0.3,
        tools: [],
        context: {},
        reasoning: '未检测到明确意图，可能是普通对话',
      };
    }

    intentScores.sort((a, b) => b.score - a.score);
    const topIntent = intentScores[0];

    const tools = this.getToolRecommendations(topIntent.intent, userMessage);

    return {
      category: topIntent.category,
      specificIntent: topIntent.intent,
      confidence: Math.min(topIntent.score, 0.95),
      tools,
      context: this.extractContext(userMessage),
      reasoning: `基于关键词匹配检测到意图: ${topIntent.intent}`,
    };
  }

  private async aiIntentAnalysis(
    userMessage: string,
    context: IntentContext
  ): Promise<IntentResult> {
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      return this.parseAIResponse(response.content, userMessage);
    } catch (error) {
      logger.error('AI 意图分析失败', { error });
      return this.quickIntentDetection(userMessage);
    }
  }

  private buildSystemPrompt(context: IntentContext): string {
    const characters = context.existingCharacters.slice(0, 10).join('、') || '暂无';
    const chapters = context.existingChapters.slice(0, 10).join('、') || '暂无';

    return `你是一个小说创作助手的意图识别系统。你需要分析用户的消息，理解他们的真实意图。

## 可用的意图类型

### 创作类 (creation)
- write_chapter: 写章节内容
- continue_writing: 续写内容
- write_outline: 写大纲
- write_character: 写人物设定
- write_worldbuilding: 写世界观设定
- write_scene: 写场景
- write_dialogue: 写对话

### 查询类 (query)
- get_character_info: 查询人物信息
- get_timeline: 查询时间线
- get_plot_info: 查询剧情信息
- get_worldbuilding: 查询世界观设定
- search_content: 搜索内容
- get_foreshadowing: 查询伏笔

### 修改类 (modification)
- revise_content: 修改内容
- polish_content: 润色内容
- expand_content: 扩写内容
- shorten_content: 缩写内容
- change_style: 改变风格

### 管理类 (management)
- add_character: 添加人物
- update_character: 更新人物
- add_plot_event: 添加剧情事件
- add_foreshadowing: 添加伏笔
- resolve_foreshadowing: 回收伏笔
- add_worldbuilding: 添加世界观设定

### 分析类 (analysis)
- analyze_content: 分析内容质量
- analyze_character: 分析人物
- analyze_plot: 分析剧情
- analyze_style: 分析风格
- check_consistency: 检查一致性

### 学习类 (learning)
- learn_style: 学习风格
- learn_from_reference: 从参考学习
- analyze_reference: 分析参考作品

### 闲聊类 (chat)
- greeting: 打招呼
- question: 提问
- discussion: 讨论
- brainstorm: 头脑风暴

## 当前项目上下文
- 已有人物: ${characters}
- 已有章节: ${chapters}
- 当前剧情阶段: ${context.currentPlotStage || '未知'}

## 输出格式
请以 JSON 格式返回分析结果：
{
  "category": "意图大类",
  "specificIntent": "具体意图",
  "confidence": 0.0-1.0的置信度,
  "reasoning": "判断理由",
  "context": {
    "characters": ["涉及的人物"],
    "chapters": ["涉及的章节"],
    "topics": ["涉及的主题"]
  }
}

只返回 JSON，不要其他内容。`;
  }

  private parseAIResponse(response: string, originalMessage: string): IntentResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.quickIntentDetection(originalMessage);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const category = this.validateCategory(parsed.category);
      const specificIntent = this.validateSpecificIntent(parsed.specificIntent);

      const tools = this.getToolRecommendations(specificIntent, originalMessage);

      return {
        category,
        specificIntent,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        tools,
        context: {
          characters: parsed.context?.characters || [],
          chapters: parsed.context?.chapters || [],
          topics: parsed.context?.topics || [],
        },
        reasoning: parsed.reasoning || 'AI 分析结果',
      };
    } catch (error) {
      logger.error('解析 AI 响应失败', { error });
      return this.quickIntentDetection(originalMessage);
    }
  }

  private getCategoryFromIntent(intent: SpecificIntent): IntentCategory {
    for (const [category, intents] of Object.entries(INTENT_TOOL_MAPPING)) {
      if (intent in intents) {
        return category as IntentCategory;
      }
    }
    return 'unknown';
  }

  private validateCategory(category: string): IntentCategory {
    const validCategories: IntentCategory[] = [
      'creation',
      'query',
      'modification',
      'management',
      'analysis',
      'learning',
      'chat',
      'unknown',
    ];
    return validCategories.includes(category as IntentCategory)
      ? (category as IntentCategory)
      : 'unknown';
  }

  private validateSpecificIntent(intent: string): SpecificIntent {
    const allIntents = Object.keys(INTENT_EXAMPLES);
    return allIntents.includes(intent) ? (intent as SpecificIntent) : 'discussion';
  }

  private getToolRecommendations(
    intent: SpecificIntent,
    userMessage: string
  ): ToolRecommendation[] {
    const category = this.getCategoryFromIntent(intent);
    const toolNames = INTENT_TOOL_MAPPING[category]?.[intent] || [];

    if (toolNames.length === 0) {
      return [];
    }

    const recommendations: ToolRecommendation[] = [];
    const args = this.extractToolArgs(intent, userMessage);

    toolNames.forEach((toolName, index) => {
      recommendations.push({
        toolName,
        priority: index === 0 ? 'primary' : 'secondary',
        args: args[toolName] || {},
        reason: `意图 ${intent} 推荐使用工具 ${toolName}`,
      });
    });

    return recommendations;
  }

  private extractToolArgs(
    intent: SpecificIntent,
    userMessage: string
  ): Record<string, Record<string, unknown>> {
    const args: Record<string, Record<string, unknown>> = {};

    switch (intent) {
      case 'continue_writing':
        args.continue_writing = {
          context: userMessage.replace(/续写|继续写|接着写/g, '').trim() || '前文',
          length: 500,
        };
        break;

      case 'polish_content':
        args.revise_content = {
          content: userMessage.replace(/润色|优化|修饰/g, '').trim(),
          instructions: '润色优化文字，使其更加流畅自然',
        };
        break;

      case 'revise_content':
        args.revise_content = {
          content: userMessage.replace(/修改|改一下/g, '').trim(),
          instructions: '根据用户要求修改内容',
        };
        break;

      case 'get_character_info': {
        const charMatch = userMessage.match(/(?:人物|角色|主角)[：:]\s*(\S+)/);
        args.get_character_info = {
          name: charMatch?.[1] || '',
        };
        break;
      }

      case 'add_character': {
        const nameMatch = userMessage.match(/(?:添加|新建|创建)人物[：:]?\s*(\S+)/);
        args.add_character = {
          name: nameMatch?.[1] || '新人物',
        };
        break;
      }
      case 'add_foreshadowing': {
        const contentMatch = userMessage.match(/伏笔[：:]\s*(.+)/);
        args.add_foreshadowing = {
          content: contentMatch?.[1] || '',
          plantedAt: '当前',
        };
        break;
      }
      case 'learn_style':
        args.learn_style = {
          content: userMessage.replace(/学习风格|分析风格|学习这种写法/g, '').trim(),
        };
        break;

      case 'analyze_content':
        args.analyze_content = {
          content: userMessage.replace(/分析|评估|检查/g, '').trim(),
        };
        break;
      case 'write_chapter': {
        const chapterMatch = userMessage.match(/第(\d+)章/);
        args.generate_content = {
          prompt: userMessage,
          length: 2000,
        };
        args.write_file = {
          path: chapterMatch ? `正文/第${chapterMatch[1]}章.md` : '正文/新章节.md',
          content: '',
        };
        break;
      }

      default:
        break;
    }

    return args;
  }

  private extractContext(userMessage: string): {
    characters?: string[];
    chapters?: string[];
    topics?: string[];
  } {
    const characters: string[] = [];
    const chapters: string[] = [];
    const topics: string[] = [];

    const chapterPattern = /第(\d+)章/g;
    let chapterMatch;
    while ((chapterMatch = chapterPattern.exec(userMessage)) !== null) {
      chapters.push(`第${chapterMatch[1]}章`);
    }

    const keywords = ['主角', '反派', '配角', '女主', '男主'];
    for (const keyword of keywords) {
      if (userMessage.includes(keyword)) {
        topics.push(keyword);
      }
    }

    const result: { characters?: string[]; chapters?: string[]; topics?: string[] } = {};
    if (characters.length > 0) {
      result.characters = characters;
    }
    if (chapters.length > 0) {
      result.chapters = chapters;
    }
    if (topics.length > 0) {
      result.topics = topics;
    }

    return result;
  }

  async getIntentWithFollowUp(
    userMessage: string,
    context: IntentContext
  ): Promise<IntentResult & { followUpQuestions?: string[] }> {
    const result = await this.analyzeIntent(userMessage, context);

    const followUpQuestions = this.generateFollowUpQuestions(result, userMessage);

    return {
      ...result,
      followUpQuestions,
    };
  }

  private generateFollowUpQuestions(result: IntentResult, userMessage: string): string[] {
    const questions: string[] = [];

    if (result.category === 'creation' && result.tools.length > 0) {
      if (result.specificIntent === 'write_chapter') {
        if (!userMessage.includes('第')) {
          questions.push('这是第几章的内容？');
        }
        if (!userMessage.includes('大纲') && !userMessage.includes('剧情')) {
          questions.push('需要我参考已有大纲来写吗？');
        }
      }

      if (result.specificIntent === 'continue_writing') {
        questions.push('续写多少字？(300/500/1000)');
      }
    }

    if (result.category === 'management') {
      if (result.specificIntent === 'add_character' && !result.context.characters?.length) {
        questions.push('人物的名字是什么？');
        questions.push('这个人物的角色定位是什么？(主角/配角/反派)');
      }
    }

    if (result.category === 'chat' && result.specificIntent === 'brainstorm') {
      questions.push('你想要什么类型的灵感？(剧情/人物/设定)');
    }

    return questions;
  }

  async suggestNextAction(context: IntentContext): Promise<string | null> {
    if (context.existingCharacters.length === 0) {
      return '你还没有创建任何人物，要开始创建主角吗？';
    }

    if (context.existingChapters.length === 0) {
      return '你还没有写任何章节，要开始写第一章吗？';
    }

    return null;
  }
}

export function createIntentUnderstandingService(projectPath: string): IntentUnderstandingService {
  return new IntentUnderstandingService(projectPath);
}
