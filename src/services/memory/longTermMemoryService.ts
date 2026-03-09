import { llmService } from '../ai/llmService';
import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from '../world/worldModelService';

export type PreferenceCategory =
  | 'writing_style'
  | 'content'
  | 'character'
  | 'plot'
  | 'worldbuilding'
  | 'general';

export type PreferencePriority = 'must' | 'should' | 'prefer' | 'avoid' | 'never';

export interface ExtractedPreference {
  id: string;
  category: PreferenceCategory;
  key: string;
  value: string;
  description: string;
  priority: PreferencePriority;
  source: 'explicit' | 'inferred' | 'learned';
  confidence: number;
  context?: string;
  createdAt: number;
}

export interface ConversationMemory {
  id: string;
  timestamp: number;
  type: 'preference' | 'setting' | 'correction' | 'feedback';
  content: string;
  extractedInfo: ExtractedPreference[];
  confirmed: boolean;
  chapter?: string;
}

export interface LongTermMemory {
  preferences: ExtractedPreference[];
  conversationHistory: ConversationMemory[];
  learnedPatterns: LearnedPattern[];
  lastUpdated: number;
}

export interface LearnedPattern {
  id: string;
  pattern: string;
  examples: string[];
  frequency: number;
  category: PreferenceCategory;
  lastSeen: number;
}

const PREFERENCE_EXTRACTION_PROMPT = `你是一个专业的小说创作偏好分析助手。从用户的对话中提取偏好和设定信息。

请分析以下对话内容，提取：
1. 写作风格偏好（如：喜欢简洁/华丽、快节奏/慢节奏）
2. 内容偏好（如：喜欢的情节类型、人物类型）
3. 禁忌/避免的内容（如：不喜欢的写法、要避免的情节）
4. 强调的设定（如：反复提及的人物特点、世界观规则）

输出 JSON 格式：
{
  "preferences": [
    {
      "category": "writing_style/content/character/plot/worldbuilding/general",
      "key": "偏好键名",
      "value": "偏好值",
      "description": "详细描述",
      "priority": "must/should/prefer/avoid/never",
      "confidence": 0.9,
      "context": "原始对话片段"
    }
  ],
  "patterns": [
    {
      "pattern": "发现的模式",
      "examples": ["示例1", "示例2"],
      "category": "类别"
    }
  ]
}

优先级说明：
- must: 必须遵守，不可违反
- should: 强烈建议遵守
- prefer: 偏好，可以灵活处理
- avoid: 应该避免
- never: 绝对禁止`;

export class LongTermMemoryService {
  private projectPath: string;
  private worldModelService: WorldModelService | null = null;
  private memory: LongTermMemory | null = null;
  private pendingConfirmations: Map<string, ExtractedPreference> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  async initialize(): Promise<void> {
    await this.loadMemory();
    logger.info('长程记忆服务初始化完成');
  }

  private async loadMemory(): Promise<void> {
    const memoryPath = `${this.projectPath}/.ai-workshop/memory/longTermMemory.json`;

    if (await workshopService.pathExists(memoryPath)) {
      try {
        const content = await workshopService.readFile(memoryPath);
        this.memory = JSON.parse(content);
      } catch (error) {
        logger.error('加载长程记忆失败', { error: String(error) });
        this.memory = this.createEmptyMemory();
      }
    } else {
      this.memory = this.createEmptyMemory();
    }
  }

  private createEmptyMemory(): LongTermMemory {
    return {
      preferences: [],
      conversationHistory: [],
      learnedPatterns: [],
      lastUpdated: Date.now(),
    };
  }

  private async saveMemory(): Promise<void> {
    if (!this.memory) return;

    this.memory.lastUpdated = Date.now();
    const memoryPath = `${this.projectPath}/.ai-workshop/memory/longTermMemory.json`;
    await workshopService.writeFile(memoryPath, JSON.stringify(this.memory, null, 2));
  }

  async extractFromConversation(
    userMessage: string,
    assistantMessage: string,
    _context?: { chapter?: string }
  ): Promise<{
    preferences: ExtractedPreference[];
    patterns: LearnedPattern[];
  }> {
    const prompt = `${PREFERENCE_EXTRACTION_PROMPT}

用户消息：
${userMessage}

助手回复：
${assistantMessage}

请提取偏好和模式。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 1024,
      });

      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { preferences: [], patterns: [] };
      }

      const result = JSON.parse(jsonMatch[0]);
      const preferences: ExtractedPreference[] = (result.preferences || []).map(
        (p: Record<string, unknown>) => ({
          id: `pref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          category: p.category as PreferenceCategory,
          key: String(p.key),
          value: String(p.value),
          description: String(p.description || ''),
          priority: p.priority as PreferencePriority,
          source: 'inferred' as const,
          confidence: Number(p.confidence) || 0.5,
          context: String(p.context || ''),
          createdAt: Date.now(),
        })
      );

      const patterns: LearnedPattern[] = (result.patterns || []).map(
        (p: Record<string, unknown>) => ({
          id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          pattern: String(p.pattern),
          examples: (p.examples as string[]) || [],
          frequency: 1,
          category: p.category as PreferenceCategory,
          lastSeen: Date.now(),
        })
      );

      return { preferences, patterns };
    } catch (error) {
      logger.error('从对话提取偏好失败', { error: String(error) });
      return { preferences: [], patterns: [] };
    }
  }

  async processConversation(
    userMessage: string,
    assistantMessage: string,
    context?: { chapter?: string }
  ): Promise<{
    extracted: ExtractedPreference[];
    needsConfirmation: ExtractedPreference[];
  }> {
    if (!this.memory) {
      await this.initialize();
    }

    const { preferences, patterns } = await this.extractFromConversation(
      userMessage,
      assistantMessage,
      context
    );

    const conversationMemory: ConversationMemory = {
      id: `conv_${Date.now()}`,
      timestamp: Date.now(),
      type: 'preference',
      content: `${userMessage}\n\n${assistantMessage}`.substring(0, 500),
      extractedInfo: preferences,
      confirmed: false,
      chapter: context?.chapter,
    };

    this.memory!.conversationHistory.push(conversationMemory);

    const needsConfirmation: ExtractedPreference[] = [];
    const extracted: ExtractedPreference[] = [];

    for (const pref of preferences) {
      const existing = this.findSimilarPreference(pref);
      if (existing) {
        existing.frequency++;
        existing.lastSeen = Date.now();
      } else if (pref.confidence >= 0.8 && pref.priority === 'must') {
        this.memory!.preferences.push(pref);
        extracted.push(pref);
      } else if (pref.confidence >= 0.6) {
        this.pendingConfirmations.set(pref.id, pref);
        needsConfirmation.push(pref);
      }
    }

    for (const pattern of patterns) {
      const existing = this.memory!.learnedPatterns.find((p) => p.pattern === pattern.pattern);
      if (existing) {
        existing.frequency++;
        existing.examples = [...new Set([...existing.examples, ...pattern.examples])];
        existing.lastSeen = Date.now();
      } else {
        this.memory!.learnedPatterns.push(pattern);
      }
    }

    await this.saveMemory();

    return { extracted, needsConfirmation };
  }

  private findSimilarPreference(pref: ExtractedPreference): LearnedPattern | null {
    if (!this.memory) return null;

    const found = this.memory.learnedPatterns.find(
      (p) => p.category === pref.category && p.pattern.includes(pref.key)
    );
    return found || null;
  }

  async confirmPreference(preferenceId: string, confirmed: boolean): Promise<boolean> {
    const pending = this.pendingConfirmations.get(preferenceId);
    if (!pending) return false;

    if (confirmed && this.memory) {
      pending.source = 'explicit';
      this.memory.preferences.push(pending);
      await this.saveMemory();

      if (this.worldModelService) {
        await this.worldModelService.addPreference({
          category: pending.category,
          key: pending.key,
          value: pending.value,
          description: pending.description,
          priority: pending.priority,
          source: pending.source,
          confidence: pending.confidence,
        });
      }
    }

    this.pendingConfirmations.delete(preferenceId);
    return true;
  }

  getPendingConfirmations(): ExtractedPreference[] {
    return Array.from(this.pendingConfirmations.values());
  }

  getPreferences(): ExtractedPreference[] {
    return this.memory?.preferences || [];
  }

  getPreferencesByCategory(category: PreferenceCategory): ExtractedPreference[] {
    return this.memory?.preferences.filter((p) => p.category === category) || [];
  }

  getMustPreferences(): ExtractedPreference[] {
    return this.memory?.preferences.filter((p) => p.priority === 'must') || [];
  }

  getAvoidPreferences(): ExtractedPreference[] {
    return (
      this.memory?.preferences.filter((p) => p.priority === 'avoid' || p.priority === 'never') || []
    );
  }

  getLearnedPatterns(): LearnedPattern[] {
    return this.memory?.learnedPatterns || [];
  }

  getPreferencesForContext(): string {
    if (!this.memory || this.memory.preferences.length === 0) {
      return '';
    }

    const parts: string[] = [];

    const mustPrefs = this.getMustPreferences();
    if (mustPrefs.length > 0) {
      parts.push('## 必须遵守的偏好');
      for (const p of mustPrefs) {
        parts.push(`- ${p.key}: ${p.value}`);
        if (p.description) {
          parts.push(`  说明：${p.description}`);
        }
      }
    }

    const avoidPrefs = this.getAvoidPreferences();
    if (avoidPrefs.length > 0) {
      parts.push('\n## 需要避免的内容');
      for (const p of avoidPrefs) {
        parts.push(`- ${p.key}: ${p.value}`);
      }
    }

    const topPatterns = this.memory.learnedPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    if (topPatterns.length > 0) {
      parts.push('\n## 学习到的模式');
      for (const p of topPatterns) {
        parts.push(`- ${p.pattern}（出现 ${p.frequency} 次）`);
      }
    }

    return parts.join('\n');
  }

  async addExplicitPreference(
    category: PreferenceCategory,
    key: string,
    value: string,
    priority: PreferencePriority,
    description?: string
  ): Promise<ExtractedPreference> {
    if (!this.memory) {
      await this.initialize();
    }

    const pref: ExtractedPreference = {
      id: `pref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      key,
      value,
      description: description || '',
      priority,
      source: 'explicit',
      confidence: 1.0,
      createdAt: Date.now(),
    };

    this.memory!.preferences.push(pref);
    await this.saveMemory();

    return pref;
  }

  async updatePreference(id: string, updates: Partial<ExtractedPreference>): Promise<boolean> {
    if (!this.memory) return false;

    const index = this.memory.preferences.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.memory.preferences[index] = {
      ...this.memory.preferences[index],
      ...updates,
    };

    await this.saveMemory();
    return true;
  }

  async deletePreference(id: string): Promise<boolean> {
    if (!this.memory) return false;

    const index = this.memory.preferences.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.memory.preferences.splice(index, 1);
    await this.saveMemory();
    return true;
  }

  getConversationHistory(limit: number = 50): ConversationMemory[] {
    return (this.memory?.conversationHistory || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async clearHistory(): Promise<void> {
    if (!this.memory) return;

    this.memory.conversationHistory = [];
    await this.saveMemory();
  }

  async exportPreferences(): Promise<string> {
    return JSON.stringify(
      {
        preferences: this.memory?.preferences || [],
        patterns: this.memory?.learnedPatterns || [],
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  async importPreferences(jsonContent: string): Promise<number> {
    if (!this.memory) {
      await this.initialize();
    }

    try {
      const data = JSON.parse(jsonContent);
      let imported = 0;

      for (const pref of data.preferences || []) {
        const exists = this.memory!.preferences.some(
          (p) => p.key === pref.key && p.category === pref.category
        );
        if (!exists) {
          this.memory!.preferences.push({
            ...pref,
            id: `imported_${Date.now()}_${imported}`,
            source: 'learned',
          });
          imported++;
        }
      }

      for (const pattern of data.patterns || []) {
        const exists = this.memory!.learnedPatterns.some((p) => p.pattern === pattern.pattern);
        if (!exists) {
          this.memory!.learnedPatterns.push(pattern);
        }
      }

      await this.saveMemory();
      return imported;
    } catch (error) {
      logger.error('导入偏好失败', { error: String(error) });
      return 0;
    }
  }
}

export function createLongTermMemoryService(projectPath: string): LongTermMemoryService {
  return new LongTermMemoryService(projectPath);
}
