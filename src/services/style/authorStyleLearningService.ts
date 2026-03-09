import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';

export interface AuthorStyleProfile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sampleCount: number;
  features: AuthorStyleFeatures;
  preferences: AuthorPreferences;
  vocabulary: VocabularyProfile;
  sentencePatterns: SentencePattern[];
  commonExpressions: CommonExpression[];
  avoidExpressions: string[];
}

export interface AuthorStyleFeatures {
  avgSentenceLength: number;
  avgParagraphLength: number;
  dialogueRatio: number;
  descriptionRatio: number;
  metaphorFrequency: number;
  emotionalIntensity: number;
  pacingStyle: 'fast' | 'medium' | 'slow' | 'varied';
  narrativeVoice: 'first' | 'third-limited' | 'third-omniscient';
  descriptionStyle: 'minimal' | 'moderate' | 'detailed';
  dialogueStyle: 'realistic' | 'stylized' | 'mixed';
}

export interface AuthorPreferences {
  preferredGenres: string[];
  preferredThemes: string[];
  preferredPOV: string;
  preferredTense: 'past' | 'present';
  preferredTone: string[];
  avoidedTopics: string[];
}

export interface VocabularyProfile {
  richness: number;
  formality: number;
  modernity: number;
  regionalisms: string[];
  neologisms: string[];
  archaisms: string[];
  favoriteWords: FavoriteWord[];
  avoidedWords: string[];
}

export interface FavoriteWord {
  word: string;
  frequency: number;
  contexts: string[];
}

export interface SentencePattern {
  pattern: string;
  frequency: number;
  examples: string[];
}

export interface CommonExpression {
  expression: string;
  usage: string;
  examples: string[];
}

export interface StyleLearningSession {
  id: string;
  content: string;
  analyzedAt: number;
  extractedFeatures: Partial<AuthorStyleFeatures>;
  newVocabulary: string[];
  newPatterns: string[];
}

export class AuthorStyleLearningService {
  private projectPath: string;
  private profile: AuthorStyleProfile | null = null;
  private sessions: Map<string, StyleLearningSession> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    await this.loadProfile();
    await this.loadSessions();
  }

  private async loadProfile(): Promise<void> {
    const profilePath = `${this.projectPath}/.ai-workshop/author/profile.json`;

    if (await workshopService.pathExists(profilePath)) {
      try {
        const content = await workshopService.readFile(profilePath);
        this.profile = JSON.parse(content);
      } catch (error) {
        logger.error('加载作者档案失败', { error });
      }
    }
  }

  private async saveProfile(): Promise<void> {
    if (!this.profile) {
      return;
    }

    const profilePath = `${this.projectPath}/.ai-workshop/author/profile.json`;
    await workshopService.writeFile(profilePath, JSON.stringify(this.profile, null, 2));
  }

  private async loadSessions(): Promise<void> {
    const sessionsPath = `${this.projectPath}/.ai-workshop/author/sessions.json`;

    if (await workshopService.pathExists(sessionsPath)) {
      try {
        const content = await workshopService.readFile(sessionsPath);
        const data = JSON.parse(content);

        for (const session of data.sessions || []) {
          this.sessions.set(session.id, session);
        }
      } catch (error) {
        logger.error('加载学习会话失败', { error });
      }
    }
  }

  private async saveSessions(): Promise<void> {
    const sessionsPath = `${this.projectPath}/.ai-workshop/author/sessions.json`;
    const data = {
      sessions: Array.from(this.sessions.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(sessionsPath, JSON.stringify(data, null, 2));
  }

  async createProfile(name: string): Promise<AuthorStyleProfile> {
    this.profile = {
      id: `author_${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sampleCount: 0,
      features: {
        avgSentenceLength: 25,
        avgParagraphLength: 150,
        dialogueRatio: 0.3,
        descriptionRatio: 0.2,
        metaphorFrequency: 0.05,
        emotionalIntensity: 0.5,
        pacingStyle: 'medium',
        narrativeVoice: 'third-limited',
        descriptionStyle: 'moderate',
        dialogueStyle: 'realistic',
      },
      preferences: {
        preferredGenres: [],
        preferredThemes: [],
        preferredPOV: '第三人称限制视角',
        preferredTense: 'past',
        preferredTone: [],
        avoidedTopics: [],
      },
      vocabulary: {
        richness: 0.5,
        formality: 0.5,
        modernity: 0.7,
        regionalisms: [],
        neologisms: [],
        archaisms: [],
        favoriteWords: [],
        avoidedWords: [],
      },
      sentencePatterns: [],
      commonExpressions: [],
      avoidExpressions: [],
    };

    await this.saveProfile();
    return this.profile;
  }

  async learnFromContent(
    content: string,
    metadata?: {
      genre?: string;
      chapter?: string;
      isRevised?: boolean;
    }
  ): Promise<StyleLearningSession> {
    if (!this.profile) {
      await this.createProfile('默认作者');
    }

    const features = this.analyzeFeatures(content);
    const vocabulary = this.extractVocabulary(content);
    const patterns = this.extractPatterns(content);

    const session: StyleLearningSession = {
      id: `session_${Date.now()}`,
      content: content.substring(0, 500),
      analyzedAt: Date.now(),
      extractedFeatures: features,
      newVocabulary: vocabulary.newWords,
      newPatterns: patterns.newPatterns,
    };

    this.sessions.set(session.id, session);

    if (this.profile) {
      this.profile.sampleCount++;
      this.profile.updatedAt = Date.now();

      this.profile.features = this.mergeFeatures(
        this.profile.features,
        features,
        this.profile.sampleCount
      );

      this.updateVocabulary(content);
      this.updatePatterns(patterns.patterns);

      if (metadata?.genre && !this.profile.preferences.preferredGenres.includes(metadata.genre)) {
        this.profile.preferences.preferredGenres.push(metadata.genre);
      }

      await this.saveProfile();
    }

    await this.saveSessions();
    return session;
  }

  private analyzeFeatures(content: string): Partial<AuthorStyleFeatures> {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    const dialogues = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];

    const avgSentenceLength =
      sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length : 0;

    const avgParagraphLength =
      paragraphs.length > 0
        ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
        : 0;

    const dialogueLength = dialogues.reduce((sum, d) => sum + d.length, 0);
    const dialogueRatio = content.length > 0 ? dialogueLength / content.length : 0;

    const descriptionPatterns = [/只见/, /看到/, /望去/, /身穿/, /四周/];
    let descriptionLength = 0;
    for (const pattern of descriptionPatterns) {
      const matches = content.match(pattern) || [];
      descriptionLength += matches.length * 50;
    }
    const descriptionRatio = content.length > 0 ? descriptionLength / content.length : 0;

    const metaphors = content.match(/像|如同|仿佛|好似|宛如/g) || [];
    const metaphorFrequency = content.length > 0 ? metaphors.length / (content.length / 100) : 0;

    const emotionWords = content.match(/[喜怒哀乐悲恐惊怒爱恨]/g) || [];
    const emotionalIntensity =
      content.length > 0 ? emotionWords.length / (content.length / 100) : 0;

    let pacingStyle: 'fast' | 'medium' | 'slow' | 'varied' = 'medium';
    if (avgSentenceLength < 15 && dialogueRatio > 0.4) {
      pacingStyle = 'fast';
    } else if (avgSentenceLength > 40 && descriptionRatio > 0.3) {
      pacingStyle = 'slow';
    } else if (paragraphs.length > 5) {
      const lengths = paragraphs.map((p) => p.length);
      const variance =
        lengths.reduce((sum, l) => sum + Math.pow(l - avgParagraphLength, 2), 0) / lengths.length;
      if (Math.sqrt(variance) > 100) {
        pacingStyle = 'varied';
      }
    }

    let narrativeVoice: 'first' | 'third-limited' | 'third-omniscient' = 'third-limited';
    const firstPerson = (content.match(/我[^们]/g) || []).length;
    const thirdPerson = (content.match(/他|她|它/g) || []).length;
    if (firstPerson > thirdPerson * 2) {
      narrativeVoice = 'first';
    } else if (content.includes('众人') || content.includes('所有人')) {
      narrativeVoice = 'third-omniscient';
    }

    let descriptionStyle: 'minimal' | 'moderate' | 'detailed' = 'moderate';
    if (descriptionRatio < 0.1) {
      descriptionStyle = 'minimal';
    } else if (descriptionRatio > 0.3) {
      descriptionStyle = 'detailed';
    }

    let dialogueStyle: 'realistic' | 'stylized' | 'mixed' = 'realistic';
    const colloquialisms = dialogues.filter((d) => /[啊呀吧嘛呢]/.test(d)).length;
    if (colloquialisms > dialogues.length * 0.5) {
      dialogueStyle = 'realistic';
    } else if (colloquialisms < dialogues.length * 0.2) {
      dialogueStyle = 'stylized';
    } else {
      dialogueStyle = 'mixed';
    }

    return {
      avgSentenceLength,
      avgParagraphLength,
      dialogueRatio,
      descriptionRatio,
      metaphorFrequency,
      emotionalIntensity,
      pacingStyle,
      narrativeVoice,
      descriptionStyle,
      dialogueStyle,
    };
  }

  private mergeFeatures(
    current: AuthorStyleFeatures,
    newFeatures: Partial<AuthorStyleFeatures>,
    sampleCount: number
  ): AuthorStyleFeatures {
    const weight = 1 / (sampleCount + 1);

    return {
      avgSentenceLength: this.weightedAverage(
        current.avgSentenceLength,
        newFeatures.avgSentenceLength || current.avgSentenceLength,
        weight
      ),
      avgParagraphLength: this.weightedAverage(
        current.avgParagraphLength,
        newFeatures.avgParagraphLength || current.avgParagraphLength,
        weight
      ),
      dialogueRatio: this.weightedAverage(
        current.dialogueRatio,
        newFeatures.dialogueRatio || current.dialogueRatio,
        weight
      ),
      descriptionRatio: this.weightedAverage(
        current.descriptionRatio,
        newFeatures.descriptionRatio || current.descriptionRatio,
        weight
      ),
      metaphorFrequency: this.weightedAverage(
        current.metaphorFrequency,
        newFeatures.metaphorFrequency || current.metaphorFrequency,
        weight
      ),
      emotionalIntensity: this.weightedAverage(
        current.emotionalIntensity,
        newFeatures.emotionalIntensity || current.emotionalIntensity,
        weight
      ),
      pacingStyle: newFeatures.pacingStyle || current.pacingStyle,
      narrativeVoice: newFeatures.narrativeVoice || current.narrativeVoice,
      descriptionStyle: newFeatures.descriptionStyle || current.descriptionStyle,
      dialogueStyle: newFeatures.dialogueStyle || current.dialogueStyle,
    };
  }

  private weightedAverage(current: number, newValue: number, weight: number): number {
    return current * (1 - weight) + newValue * weight;
  }

  private extractVocabulary(content: string): { newWords: string[] } {
    const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const wordFreq: Map<string, number> = new Map();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    const newWords: string[] = [];
    const existingWords = new Set(this.profile?.vocabulary.favoriteWords.map((w) => w.word) || []);

    for (const [word, freq] of wordFreq.entries()) {
      if (freq >= 3 && !existingWords.has(word)) {
        newWords.push(word);
      }
    }

    return { newWords: newWords.slice(0, 20) };
  }

  private extractPatterns(content: string): { patterns: SentencePattern[]; newPatterns: string[] } {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const patternMap: Map<string, { count: number; examples: string[] }> = new Map();

    for (const sentence of sentences) {
      const pattern = this.extractSentencePattern(sentence);

      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, { count: 0, examples: [] });
      }

      const entry = patternMap.get(pattern)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(sentence.trim());
      }
    }

    const patterns: SentencePattern[] = [];
    const newPatterns: string[] = [];
    const existingPatterns = new Set(this.profile?.sentencePatterns.map((p) => p.pattern) || []);

    for (const [pattern, data] of patternMap.entries()) {
      if (data.count >= 2) {
        patterns.push({
          pattern,
          frequency: data.count,
          examples: data.examples,
        });

        if (!existingPatterns.has(pattern)) {
          newPatterns.push(pattern);
        }
      }
    }

    return { patterns, newPatterns: newPatterns.slice(0, 10) };
  }

  private extractSentencePattern(sentence: string): string {
    return sentence
      .replace(/[\u4e00-\u9fa5]{3,}/g, 'N')
      .replace(/[0-9]+/g, 'D')
      .replace(/[a-zA-Z]+/g, 'W')
      .replace(/[""「」『』]/g, 'Q');
  }

  private updateVocabulary(content: string): void {
    if (!this.profile) {
      return;
    }

    const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const wordFreq: Map<string, number> = new Map();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    for (const [word, freq] of wordFreq.entries()) {
      const existing = this.profile.vocabulary.favoriteWords.find((w) => w.word === word);

      if (existing) {
        existing.frequency += freq;
      } else if (freq >= 3) {
        this.profile.vocabulary.favoriteWords.push({
          word,
          frequency: freq,
          contexts: [],
        });
      }
    }

    this.profile.vocabulary.favoriteWords.sort((a, b) => b.frequency - a.frequency);
    this.profile.vocabulary.favoriteWords = this.profile.vocabulary.favoriteWords.slice(0, 100);

    const uniqueWords = new Set(words);
    const totalWords = words.length;
    this.profile.vocabulary.richness = uniqueWords.size / Math.max(totalWords, 1);
  }

  private updatePatterns(patterns: SentencePattern[]): void {
    if (!this.profile) {
      return;
    }

    for (const pattern of patterns) {
      const existing = this.profile.sentencePatterns.find((p) => p.pattern === pattern.pattern);

      if (existing) {
        existing.frequency += pattern.frequency;
        existing.examples = [...new Set([...existing.examples, ...pattern.examples])].slice(0, 5);
      } else {
        this.profile.sentencePatterns.push(pattern);
      }
    }

    this.profile.sentencePatterns.sort((a, b) => b.frequency - a.frequency);
    this.profile.sentencePatterns = this.profile.sentencePatterns.slice(0, 50);
  }

  getProfile(): AuthorStyleProfile | null {
    return this.profile;
  }

  async updatePreferences(preferences: Partial<AuthorPreferences>): Promise<void> {
    if (!this.profile) {
      return;
    }

    this.profile.preferences = {
      ...this.profile.preferences,
      ...preferences,
    };
    this.profile.updatedAt = Date.now();

    await this.saveProfile();
  }

  async addCommonExpression(expression: string, usage: string, example: string): Promise<void> {
    if (!this.profile) {
      return;
    }

    const existing = this.profile.commonExpressions.find((e) => e.expression === expression);

    if (existing) {
      if (!existing.examples.includes(example)) {
        existing.examples.push(example);
      }
    } else {
      this.profile.commonExpressions.push({
        expression,
        usage,
        examples: [example],
      });
    }

    await this.saveProfile();
  }

  async addAvoidExpression(expression: string): Promise<void> {
    if (!this.profile) {
      return;
    }

    if (!this.profile.avoidExpressions.includes(expression)) {
      this.profile.avoidExpressions.push(expression);
      await this.saveProfile();
    }
  }

  generateStylePrompt(): string {
    if (!this.profile) {
      return '';
    }

    const f = this.profile.features;
    const p = this.profile.preferences;
    const v = this.profile.vocabulary;

    let prompt = `# 作者风格指南

## 写作风格特征
- 平均句长: ${f.avgSentenceLength.toFixed(0)} 字
- 平均段落长度: ${f.avgParagraphLength.toFixed(0)} 字
- 对话比例: ${(f.dialogueRatio * 100).toFixed(0)}%
- 描写比例: ${(f.descriptionRatio * 100).toFixed(0)}%
- 比喻使用频率: ${f.metaphorFrequency.toFixed(2)} 次/百字
- 情感强度: ${(f.emotionalIntensity * 100).toFixed(0)}%
- 节奏风格: ${f.pacingStyle === 'fast' ? '快节奏' : f.pacingStyle === 'slow' ? '慢节奏' : f.pacingStyle === 'varied' ? '节奏多变' : '中等节奏'}
- 叙事视角: ${f.narrativeVoice === 'first' ? '第一人称' : f.narrativeVoice === 'third-omniscient' ? '第三人称全知' : '第三人称限制'}
- 描写风格: ${f.descriptionStyle === 'minimal' ? '简洁' : f.descriptionStyle === 'detailed' ? '详细' : '适中'}
- 对话风格: ${f.dialogueStyle === 'realistic' ? '口语化' : f.dialogueStyle === 'stylized' ? '书面化' : '混合'}

## 作者偏好
- 偏好类型: ${p.preferredGenres.join('、') || '未指定'}
- 偏好主题: ${p.preferredThemes.join('、') || '未指定'}
- 偏好视角: ${p.preferredPOV}
- 偏好时态: ${p.preferredTense === 'past' ? '过去时' : '现在时'}
- 偏好基调: ${p.preferredTone.join('、') || '未指定'}
${p.avoidedTopics.length > 0 ? `- 避免话题: ${p.avoidedTopics.join('、')}` : ''}

## 词汇特点
- 词汇丰富度: ${(v.richness * 100).toFixed(0)}%
- 正式程度: ${(v.formality * 100).toFixed(0)}%
- 现代程度: ${(v.modernity * 100).toFixed(0)}%

`;

    if (v.favoriteWords.length > 0) {
      prompt += `## 常用词汇
${v.favoriteWords
  .slice(0, 20)
  .map((w) => w.word)
  .join('、')}

`;
    }

    if (this.profile.commonExpressions.length > 0) {
      prompt += `## 常用表达
${this.profile.commonExpressions
  .slice(0, 10)
  .map((e) => `- ${e.expression}: ${e.usage}`)
  .join('\n')}

`;
    }

    if (this.profile.avoidExpressions.length > 0) {
      prompt += `## 避免使用
${this.profile.avoidExpressions.join('、')}

`;
    }

    return prompt;
  }

  compareWithContent(content: string): {
    similarity: number;
    differences: string[];
    suggestions: string[];
  } {
    if (!this.profile) {
      return { similarity: 0, differences: [], suggestions: ['请先创建作者风格档案'] };
    }

    const features = this.analyzeFeatures(content);
    const differences: string[] = [];
    const suggestions: string[] = [];
    let totalDiff = 0;
    let count = 0;

    const sentenceDiff = Math.abs(
      features.avgSentenceLength! - this.profile.features.avgSentenceLength
    );
    totalDiff += sentenceDiff / this.profile.features.avgSentenceLength;
    count++;
    if (sentenceDiff > 10) {
      differences.push(
        `句长差异: 当前 ${features.avgSentenceLength!.toFixed(0)} 字 vs 平均 ${this.profile.features.avgSentenceLength.toFixed(0)} 字`
      );
      if (features.avgSentenceLength! < this.profile.features.avgSentenceLength) {
        suggestions.push('建议适当增加句子长度，添加更多细节');
      } else {
        suggestions.push('建议适当缩短句子，提高可读性');
      }
    }

    const dialogueDiff = Math.abs(features.dialogueRatio! - this.profile.features.dialogueRatio);
    totalDiff += dialogueDiff;
    count++;
    if (dialogueDiff > 0.1) {
      differences.push(
        `对话比例差异: 当前 ${(features.dialogueRatio! * 100).toFixed(0)}% vs 平均 ${(this.profile.features.dialogueRatio * 100).toFixed(0)}%`
      );
    }

    const pacingMatch = features.pacingStyle === this.profile.features.pacingStyle;
    if (!pacingMatch) {
      differences.push(
        `节奏风格不同: 当前 ${features.pacingStyle} vs 偏好 ${this.profile.features.pacingStyle}`
      );
    }

    const similarity = Math.max(0, 1 - totalDiff / count);

    return { similarity, differences, suggestions };
  }

  getLearningStats(): {
    totalSessions: number;
    totalSamples: number;
    lastLearningTime: number | null;
    vocabularySize: number;
    patternCount: number;
  } {
    return {
      totalSessions: this.sessions.size,
      totalSamples: this.profile?.sampleCount || 0,
      lastLearningTime: this.profile?.updatedAt || null,
      vocabularySize: this.profile?.vocabulary.favoriteWords.length || 0,
      patternCount: this.profile?.sentencePatterns.length || 0,
    };
  }
}

export function createAuthorStyleLearningService(projectPath: string): AuthorStyleLearningService {
  return new AuthorStyleLearningService(projectPath);
}
