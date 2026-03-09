import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';
import type { LongTermMemoryService } from '../memory/longTermMemoryService';
import type { Foreshadowing } from '@/types/plot/foreshadowing';

export type InteractionType =
  | 'question'
  | 'suggestion'
  | 'confirmation'
  | 'reminder'
  | 'warning'
  | 'info';

export type InteractionPriority = 'urgent' | 'high' | 'normal' | 'low';

export type UserIntent =
  | 'create_content'
  | 'modify_content'
  | 'query_info'
  | 'set_preference'
  | 'casual_chat'
  | 'get_help'
  | 'unknown';

export interface InteractionOption {
  id: string;
  label: string;
  value: string;
  description?: string;
  isDefault?: boolean;
}

export interface AgentInteraction {
  id: string;
  type: InteractionType;
  priority: InteractionPriority;
  title: string;
  message: string;
  options?: InteractionOption[];
  allowCustomInput?: boolean;
  placeholder?: string;
  timeout?: number;
  context?: {
    chapter?: number;
    character?: string;
    setting?: string;
  };
  onConfirm?: string;
  onSkip?: string;
  createdAt: number;
  expiresAt?: number;
  status: 'pending' | 'confirmed' | 'skipped' | 'expired';
  response?: string;
}

export interface IntentAnalysis {
  intent: UserIntent;
  confidence: number;
  entities: Array<{
    type: 'character' | 'chapter' | 'setting' | 'action' | 'preference';
    value: string;
    confidence: number;
  }>;
  suggestedWorkflow?: string;
  isTaskOriented: boolean;
  requiresContext: boolean;
}

const INTENT_ANALYSIS_PROMPT = `你是一个专业的意图分析助手。分析用户输入，判断用户意图。

意图类型：
- create_content: 创建内容（写章节、写大纲、添加人物等）
- modify_content: 修改内容（修改章节、调整设定等）
- query_info: 查询信息（询问人物、查询设定等）
- set_preference: 设置偏好（表达喜好、禁忌等）
- casual_chat: 闲聊（打招呼、闲谈等）
- get_help: 获取帮助（询问功能、使用方法等）
- unknown: 无法判断

输出 JSON 格式：
{
  "intent": "意图类型",
  "confidence": 0.9,
  "entities": [
    { "type": "character/chapter/setting/action/preference", "value": "实体值", "confidence": 0.8 }
  ],
  "suggestedWorkflow": "建议的工作流",
  "isTaskOriented": true,
  "requiresContext": false
}`;

const INTERACTION_GENERATION_PROMPT = `你是一个专业的小说创作助手。根据当前状态，生成需要与用户交互的内容。

交互类型：
- question: 需要用户回答的问题
- suggestion: 给用户的建议
- confirmation: 需要用户确认
- reminder: 提醒用户
- warning: 警告用户
- info: 信息通知

输出 JSON 格式：
{
  "type": "交互类型",
  "priority": "urgent/high/normal/low",
  "title": "标题",
  "message": "详细内容",
  "options": [
    { "label": "选项标签", "value": "选项值", "description": "选项描述", "isDefault": false }
  ],
  "allowCustomInput": true,
  "placeholder": "输入提示"
}`;

export class AgentInteractionService {
  private worldModelService: WorldModelService | null = null;
  private longTermMemoryService: LongTermMemoryService | null = null;
  private pendingInteractions: Map<string, AgentInteraction> = new Map();
  private interactionHistory: AgentInteraction[] = [];

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setLongTermMemoryService(service: LongTermMemoryService): void {
    this.longTermMemoryService = service;
  }

  async analyzeIntent(userInput: string): Promise<IntentAnalysis> {
    const prompt = `${INTENT_ANALYSIS_PROMPT}

用户输入：${userInput}

请分析用户意图。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 512,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultIntent(userInput);
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        intent: result.intent as UserIntent,
        confidence: result.confidence || 0.5,
        entities: (result.entities || []).map((e: Record<string, unknown>) => ({
          type: e.type as IntentAnalysis['entities'][0]['type'],
          value: String(e.value),
          confidence: Number(e.confidence) || 0.5,
        })),
        suggestedWorkflow: result.suggestedWorkflow,
        isTaskOriented: Boolean(result.isTaskOriented),
        requiresContext: Boolean(result.requiresContext),
      };
    } catch (error) {
      logger.error('意图分析失败', { error: String(error) });
      return this.getDefaultIntent(userInput);
    }
  }

  private getDefaultIntent(userInput: string): IntentAnalysis {
    const input = userInput.toLowerCase();
    let intent: UserIntent = 'unknown';
    let isTaskOriented = false;

    if (input.includes('写') || input.includes('创作') || input.includes('生成')) {
      intent = 'create_content';
      isTaskOriented = true;
    } else if (input.includes('修改') || input.includes('改') || input.includes('调整')) {
      intent = 'modify_content';
      isTaskOriented = true;
    } else if (input.includes('什么') || input.includes('查询') || input.includes('查看')) {
      intent = 'query_info';
    } else if (input.includes('不要') || input.includes('喜欢') || input.includes('讨厌')) {
      intent = 'set_preference';
    } else if (input.includes('你好') || input.includes('在吗') || input.length < 10) {
      intent = 'casual_chat';
    } else if (input.includes('帮助') || input.includes('怎么') || input.includes('如何')) {
      intent = 'get_help';
    }

    return {
      intent,
      confidence: 0.6,
      entities: [],
      isTaskOriented,
      requiresContext: isTaskOriented,
    };
  }

  async generateQuestion(
    context: string,
    questionType: 'missing_info' | 'clarification' | 'preference' | 'confirmation'
  ): Promise<AgentInteraction> {
    const prompt = `${INTERACTION_GENERATION_PROMPT}

上下文：${context}
问题类型：${questionType}

请生成交互内容。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 512,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultQuestion(context);
      }

      const result = JSON.parse(jsonMatch[0]);
      return this.createInteraction(result);
    } catch (error) {
      logger.error('生成问题失败', { error: String(error) });
      return this.createDefaultQuestion(context);
    }
  }

  private createInteraction(data: Record<string, unknown>): AgentInteraction {
    const id = `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      id,
      type: data.type as InteractionType,
      priority: (data.priority as InteractionPriority) || 'normal',
      title: String(data.title || ''),
      message: String(data.message || ''),
      options: ((data.options as Array<Record<string, unknown>>) || []).map((o, i) => ({
        id: `option_${i}`,
        label: String(o.label || ''),
        value: String(o.value || ''),
        description: o.description as string | undefined,
        isDefault: Boolean(o.isDefault),
      })),
      allowCustomInput: Boolean(data.allowCustomInput),
      placeholder: data.placeholder as string | undefined,
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  private createDefaultQuestion(context: string): AgentInteraction {
    return {
      id: `interaction_${Date.now()}`,
      type: 'question',
      priority: 'normal',
      title: '需要更多信息',
      message: `请提供更多关于 "${context.substring(0, 50)}" 的信息`,
      allowCustomInput: true,
      placeholder: '请输入...',
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  async checkAndGenerateReminders(): Promise<AgentInteraction[]> {
    const reminders: AgentInteraction[] = [];

    if (this.worldModelService) {
      const worldModel = this.worldModelService.getWorldModel();
      if (worldModel) {
        if (worldModel.characters.items.length === 0) {
          reminders.push({
            id: `reminder_chars_${Date.now()}`,
            type: 'reminder',
            priority: 'high',
            title: '缺少人物设定',
            message: '当前项目还没有人物设定，建议先添加主角和主要人物。',
            options: [
              { id: 'opt1', label: '现在添加', value: 'add_character' },
              { id: 'opt2', label: '稍后再说', value: 'later' },
            ],
            createdAt: Date.now(),
            status: 'pending',
          });
        }

        if (worldModel.outline.nodes.length === 0) {
          reminders.push({
            id: `reminder_outline_${Date.now()}`,
            type: 'suggestion',
            priority: 'normal',
            title: '建议创建大纲',
            message: '创建大纲可以帮助你更好地规划故事走向。',
            options: [
              { id: 'opt1', label: '生成大纲', value: 'generate_outline' },
              { id: 'opt2', label: '跳过', value: 'skip' },
            ],
            createdAt: Date.now(),
            status: 'pending',
          });
        }

        const unresolvedForeshadows = worldModel.foreshadowing.items.filter(
          (f: Foreshadowing) => f.status === 'planted' && f.importance === 'major'
        );
        if (unresolvedForeshadows.length > 3) {
          reminders.push({
            id: `reminder_foreshadow_${Date.now()}`,
            type: 'warning',
            priority: 'normal',
            title: '伏笔待回收',
            message: `有 ${unresolvedForeshadows.length} 个重要伏笔尚未回收，建议在后续章节中处理。`,
            options: [
              { id: 'opt1', label: '查看详情', value: 'view_foreshadowing' },
              { id: 'opt2', label: '知道了', value: 'acknowledge' },
            ],
            createdAt: Date.now(),
            status: 'pending',
          });
        }
      }
    }

    if (this.longTermMemoryService) {
      const pending = this.longTermMemoryService.getPendingConfirmations();
      if (pending.length > 0) {
        const first = pending[0];
        reminders.push({
          id: `reminder_pref_${Date.now()}`,
          type: 'confirmation',
          priority: 'high',
          title: '确认偏好设置',
          message: `检测到可能的偏好设置：${first.key} = ${first.value}`,
          options: [
            { id: 'opt1', label: '确认保存', value: 'confirm' },
            { id: 'opt2', label: '忽略', value: 'ignore' },
          ],
          context: { setting: first.key },
          createdAt: Date.now(),
          status: 'pending',
        });
      }
    }

    for (const reminder of reminders) {
      this.pendingInteractions.set(reminder.id, reminder);
    }

    return reminders;
  }

  async generateChapterCompleteInteraction(
    chapterNumber: number,
    wordCount: number
  ): Promise<AgentInteraction> {
    return {
      id: `chapter_complete_${Date.now()}`,
      type: 'question',
      priority: 'normal',
      title: `第${chapterNumber}章已完成`,
      message: `本章共 ${wordCount} 字。你对这一章满意吗？`,
      options: [
        { id: 'opt1', label: '满意，继续下一章', value: 'next_chapter', isDefault: true },
        { id: 'opt2', label: '需要修改', value: 'modify' },
        { id: 'opt3', label: '查看一致性检查', value: 'check_consistency' },
      ],
      context: { chapter: chapterNumber },
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  async generateSuggestion(
    context: string,
    suggestionType: 'plot' | 'character' | 'style' | 'pacing'
  ): Promise<AgentInteraction> {
    const prompt = `${INTERACTION_GENERATION_PROMPT}

上下文：${context}
建议类型：${suggestionType}

请生成建议内容。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 512,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultSuggestion(suggestionType);
      }

      const result = JSON.parse(jsonMatch[0]);
      const interaction = this.createInteraction(result);
      interaction.type = 'suggestion';
      return interaction;
    } catch (error) {
      logger.error('生成建议失败', { error: String(error) });
      return this.createDefaultSuggestion(suggestionType);
    }
  }

  private createDefaultSuggestion(type: string): AgentInteraction {
    const suggestions: Record<string, string> = {
      plot: '考虑在下一章增加一个转折点，让故事更有张力。',
      character: '可以深入描写主角的内心变化，增强人物立体感。',
      style: '尝试使用更多感官描写，让场景更加生动。',
      pacing: '当前节奏较为平缓，可以考虑加快情节推进。',
    };

    return {
      id: `suggestion_${Date.now()}`,
      type: 'suggestion',
      priority: 'low',
      title: '写作建议',
      message: suggestions[type] || '继续加油！',
      options: [
        { id: 'opt1', label: '采纳', value: 'accept' },
        { id: 'opt2', label: '忽略', value: 'ignore' },
      ],
      createdAt: Date.now(),
      status: 'pending',
    };
  }

  getPendingInteractions(): AgentInteraction[] {
    const now = Date.now();
    const valid: AgentInteraction[] = [];

    for (const [id, interaction] of this.pendingInteractions) {
      if (interaction.expiresAt && interaction.expiresAt < now) {
        interaction.status = 'expired';
        this.interactionHistory.push(interaction);
        this.pendingInteractions.delete(id);
      } else if (interaction.status === 'pending') {
        valid.push(interaction);
      }
    }

    return valid.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async respondToInteraction(
    interactionId: string,
    response: string
  ): Promise<{ success: boolean; followUp?: AgentInteraction }> {
    const interaction = this.pendingInteractions.get(interactionId);
    if (!interaction) {
      return { success: false };
    }

    interaction.status = 'confirmed';
    interaction.response = response;
    this.interactionHistory.push(interaction);
    this.pendingInteractions.delete(interactionId);

    if (this.longTermMemoryService && interaction.type === 'confirmation') {
      if (response === 'confirm' && interaction.context?.setting) {
        await this.longTermMemoryService.confirmPreference(interaction.context.setting, true);
      }
    }

    let followUp: AgentInteraction | undefined;
    if (response === 'next_chapter' && interaction.context?.chapter) {
      followUp = await this.generateQuestion(
        `准备写第${interaction.context.chapter + 1}章`,
        'missing_info'
      );
    }

    return { success: true, followUp };
  }

  skipInteraction(interactionId: string): boolean {
    const interaction = this.pendingInteractions.get(interactionId);
    if (!interaction) return false;

    interaction.status = 'skipped';
    this.interactionHistory.push(interaction);
    this.pendingInteractions.delete(interactionId);
    return true;
  }

  getInteractionHistory(limit: number = 50): AgentInteraction[] {
    return this.interactionHistory.slice(-limit);
  }

  clearPendingInteractions(): void {
    for (const interaction of this.pendingInteractions.values()) {
      interaction.status = 'expired';
      this.interactionHistory.push(interaction);
    }
    this.pendingInteractions.clear();
  }
}

export const agentInteractionService = new AgentInteractionService();
