import {
  StyleProfile,
  StylePattern,
  StyleLearningProgress,
  StyleApplication,
} from '@/types/style/styleLearning';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class DeepStyleLearningService {
  private projectPath: string;
  private profiles: Map<string, StyleProfile> = new Map();
  private patterns: Map<string, StylePattern> = new Map();
  private progress: StyleLearningProgress = {
    totalAnalyzed: 0,
    charactersProcessed: 0,
    patternsIdentified: 0,
    confidenceScore: 0,
    lastAnalyzed: 0,
  };

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const profilePath = `${this.projectPath}/设定/风格档案.json`;
      const patternPath = `${this.projectPath}/设定/风格模式.json`;
      const progressPath = `${this.projectPath}/设定/风格学习进度.json`;

      const profileContent = await workshopService.readFile(profilePath);
      if (profileContent) {
        const data = JSON.parse(profileContent);
        this.profiles = new Map(data.map((p: StyleProfile) => [p.id, p]));
      }

      const patternContent = await workshopService.readFile(patternPath);
      if (patternContent) {
        const data = JSON.parse(patternContent);
        this.patterns = new Map(data.map((p: StylePattern) => [p.id, p]));
      }

      const progressContent = await workshopService.readFile(progressPath);
      if (progressContent) {
        this.progress = JSON.parse(progressContent);
      }
    } catch (error) {
      logger.error('加载风格档案失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const profilePath = `${this.projectPath}/设定/风格档案.json`;
      const patternPath = `${this.projectPath}/设定/风格模式.json`;
      const progressPath = `${this.projectPath}/设定/风格学习进度.json`;

      await workshopService.writeFile(
        profilePath,
        JSON.stringify(Array.from(this.profiles.values()), null, 2)
      );
      await workshopService.writeFile(
        patternPath,
        JSON.stringify(Array.from(this.patterns.values()), null, 2)
      );
      await workshopService.writeFile(progressPath, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      logger.error('保存风格档案失败', { error });
    }
  }

  async analyzeText(text: string, source: string = 'unknown'): Promise<StyleProfile> {
    const analysis = await this.performDeepAnalysis(text);

    const profile: StyleProfile = {
      id: `style_${uuidv4()}`,
      name: `风格档案 - ${source}`,
      source,
      sentenceStyle: this.normalizeSentenceStyle(analysis.sentenceStyle),
      paragraphStyle: this.normalizeParagraphStyle(analysis.paragraphStyle),
      dialogueStyle: this.normalizeDialogueStyle(analysis.dialogueStyle),
      descriptionStyle: this.normalizeDescriptionStyle(analysis.descriptionStyle),
      narrationStyle: this.normalizeNarrationStyle(analysis.narrationStyle),
      emotionStyle: this.normalizeEmotionStyle(analysis.emotionStyle),
      actionStyle: this.normalizeActionStyle(analysis.actionStyle),
      vocabulary: this.normalizeVocabulary(analysis.vocabulary),
      tone: this.normalizeTone(analysis.tone),
      patterns: [],
      examples: analysis.examples || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    this.progress.totalAnalyzed++;
    this.progress.lastAnalyzed = Date.now();

    await this.saveToDisk();
    return profile;
  }

  private async performDeepAnalysis(text: string): Promise<Partial<StyleProfile>> {
    const systemPrompt = `你是一个专业的写作风格分析师。请深入分析以下文本的写作风格。

请从以下维度进行分析

1. 句式风格:
   - 平均句长
   - 长短句偏好
   - 句式结构特点
   - 标点符号使用习惯

2. 段落风格:
   - 平均段长
   - 段落结构偏好
   - 过渡方式

3. 对话风格:
   - 对话频率
   - 对话风格
   - 对话标签偏好
   - 语言特点

4. 描写风格:
   - 描写密度
   - 感官侧重
   - 比喻频率
   - 展示vs讲述比例

5. 叙述风格:
   - 叙述视角
   - 时态
   - 语态

6. 情感表达:
   - 直接表达程度
   - 展示vs讲述比例
   - 身体描写偏好

7. 动作描写:
   - 节奏
   - 动词选择偏好
   - 句式结构

8. 词汇特点:
   - 复杂度
   - 独特词汇
   - 重复短语
   - 领域术语

9. 基调氛围:
   - 整体基调
   - 情绪模式
   - 幽默程度
   - 黑暗程度

请以JSON格式返回分析结果，格式如下
{
  "sentenceStyle": { ... },
  "paragraphStyle": { ... },
  "dialogueStyle": { ... },
  "descriptionStyle": { ... },
  "narrationStyle": { ... },
  "emotionStyle": { ... },
  "actionStyle": { ... },
  "vocabulary": { ... },
  "tone": { ... },
  "examples": [
    { "original": "原文片段", "analysis": "分析", "category": "分类", "tags": ["标签"] }
  ]
}

只返回JSON，不要其他内容。`;

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultProfile();
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('风格分析失败', { error });
      return this.getDefaultProfile();
    }
  }

  private getDefaultProfile(): Partial<StyleProfile> {
    return {
      sentenceStyle: this.getDefaultSentenceStyle(),
      paragraphStyle: this.getDefaultParagraphStyle(),
      dialogueStyle: this.getDefaultDialogueStyle(),
      descriptionStyle: this.getDefaultDescriptionStyle(),
      narrationStyle: this.getDefaultNarrationStyle(),
      emotionStyle: this.getDefaultEmotionStyle(),
      actionStyle: this.getDefaultActionStyle(),
      vocabulary: this.getDefaultVocabulary(),
      tone: this.getDefaultTone(),
      examples: [],
    };
  }

  private getDefaultSentenceStyle(): StyleProfile['sentenceStyle'] {
    return {
      averageLength: 15,
      preferredLength: 'medium',
      structurePreference: ['主谓宾'],
      punctuationStyle: ['标准'],
    };
  }

  private getDefaultParagraphStyle(): StyleProfile['paragraphStyle'] {
    return {
      averageLength: 100,
      structurePreference: ['总分总'],
      transitionStyle: ['自然过渡'],
    };
  }

  private getDefaultDialogueStyle(): StyleProfile['dialogueStyle'] {
    return {
      frequency: 0.3,
      style: 'direct',
      tagPreference: ['说', '道'],
      speechPattern: ['自然'],
    };
  }

  private getDefaultDescriptionStyle(): StyleProfile['descriptionStyle'] {
    return {
      detail: 'moderate',
      sensoryFocus: ['视觉'],
      metaphorFrequency: 0.1,
      showVsTell: 0.5,
    };
  }

  private getDefaultNarrationStyle(): StyleProfile['narrationStyle'] {
    return {
      perspective: 'third-limited',
      tense: 'past',
      voice: 'active',
    };
  }

  private getDefaultEmotionStyle(): StyleProfile['emotionStyle'] {
    return {
      directExpression: 0.3,
      showVsTell: 0.6,
      physicalDescription: ['表情', '动作'],
    };
  }

  private getDefaultActionStyle(): StyleProfile['actionStyle'] {
    return {
      pacing: 'medium',
      verbChoice: ['动态动词'],
      sentenceStructure: ['短句为主'],
    };
  }

  private getDefaultVocabulary(): StyleProfile['vocabulary'] {
    return {
      complexity: 'moderate',
      uniqueWords: 0,
      repeatedPhrases: [],
      domainTerms: [],
    };
  }

  private getDefaultTone(): StyleProfile['tone'] {
    return {
      overall: ['中性'],
      moodPatterns: ['起伏'],
      humorLevel: 0.3,
      darknessLevel: 0.3,
    };
  }

  private normalizeSentenceStyle(raw: unknown): StyleProfile['sentenceStyle'] {
    const defaultStyle = this.getDefaultSentenceStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validLengths = ['medium', 'varied', 'short', 'long'] as const;
    const preferredLength =
      typeof data.preferredLength === 'string' &&
      validLengths.includes(data.preferredLength as (typeof validLengths)[number])
        ? (data.preferredLength as (typeof validLengths)[number])
        : defaultStyle.preferredLength;
    return {
      averageLength:
        typeof data.averageLength === 'number' ? data.averageLength : defaultStyle.averageLength,
      preferredLength,
      structurePreference: Array.isArray(data.structurePreference)
        ? data.structurePreference
        : defaultStyle.structurePreference,
      punctuationStyle: Array.isArray(data.punctuationStyle)
        ? data.punctuationStyle
        : defaultStyle.punctuationStyle,
    };
  }

  private normalizeParagraphStyle(raw: unknown): StyleProfile['paragraphStyle'] {
    const defaultStyle = this.getDefaultParagraphStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    return {
      averageLength:
        typeof data.averageLength === 'number' ? data.averageLength : defaultStyle.averageLength,
      structurePreference: Array.isArray(data.structurePreference)
        ? data.structurePreference
        : defaultStyle.structurePreference,
      transitionStyle: Array.isArray(data.transitionStyle)
        ? data.transitionStyle
        : defaultStyle.transitionStyle,
    };
  }

  private normalizeDialogueStyle(raw: unknown): StyleProfile['dialogueStyle'] {
    const defaultStyle = this.getDefaultDialogueStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validStyles = ['mixed', 'direct', 'indirect'] as const;
    const style =
      typeof data.style === 'string' &&
      validStyles.includes(data.style as (typeof validStyles)[number])
        ? (data.style as (typeof validStyles)[number])
        : defaultStyle.style;
    return {
      frequency: typeof data.frequency === 'number' ? data.frequency : defaultStyle.frequency,
      style,
      tagPreference: Array.isArray(data.tagPreference)
        ? data.tagPreference
        : defaultStyle.tagPreference,
      speechPattern: Array.isArray(data.speechPattern)
        ? data.speechPattern
        : defaultStyle.speechPattern,
    };
  }

  private normalizeDescriptionStyle(raw: unknown): StyleProfile['descriptionStyle'] {
    const defaultStyle = this.getDefaultDescriptionStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validDetails = ['dense', 'moderate', 'sparse'] as const;
    const detail =
      typeof data.detail === 'string' &&
      validDetails.includes(data.detail as (typeof validDetails)[number])
        ? (data.detail as (typeof validDetails)[number])
        : defaultStyle.detail;
    return {
      detail,
      sensoryFocus: Array.isArray(data.sensoryFocus)
        ? data.sensoryFocus
        : defaultStyle.sensoryFocus,
      metaphorFrequency:
        typeof data.metaphorFrequency === 'number'
          ? data.metaphorFrequency
          : defaultStyle.metaphorFrequency,
      showVsTell: typeof data.showVsTell === 'number' ? data.showVsTell : defaultStyle.showVsTell,
    };
  }

  private normalizeNarrationStyle(raw: unknown): StyleProfile['narrationStyle'] {
    const defaultStyle = this.getDefaultNarrationStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validPerspectives = ['first', 'third-limited', 'third-omniscient'] as const;
    const validTenses = ['mixed', 'past', 'present'] as const;
    const validVoices = ['passive', 'mixed', 'active'] as const;
    const perspective =
      typeof data.perspective === 'string' &&
      validPerspectives.includes(data.perspective as (typeof validPerspectives)[number])
        ? (data.perspective as (typeof validPerspectives)[number])
        : defaultStyle.perspective;
    const tense =
      typeof data.tense === 'string' &&
      validTenses.includes(data.tense as (typeof validTenses)[number])
        ? (data.tense as (typeof validTenses)[number])
        : defaultStyle.tense;
    const voice =
      typeof data.voice === 'string' &&
      validVoices.includes(data.voice as (typeof validVoices)[number])
        ? (data.voice as (typeof validVoices)[number])
        : defaultStyle.voice;
    return { perspective, tense, voice };
  }

  private normalizeEmotionStyle(raw: unknown): StyleProfile['emotionStyle'] {
    const defaultStyle = this.getDefaultEmotionStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    return {
      directExpression:
        typeof data.directExpression === 'number'
          ? data.directExpression
          : defaultStyle.directExpression,
      showVsTell: typeof data.showVsTell === 'number' ? data.showVsTell : defaultStyle.showVsTell,
      physicalDescription: Array.isArray(data.physicalDescription)
        ? data.physicalDescription
        : defaultStyle.physicalDescription,
    };
  }

  private normalizeActionStyle(raw: unknown): StyleProfile['actionStyle'] {
    const defaultStyle = this.getDefaultActionStyle();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validPacings = ['medium', 'fast', 'slow', 'varied'] as const;
    const pacing =
      typeof data.pacing === 'string' &&
      validPacings.includes(data.pacing as (typeof validPacings)[number])
        ? (data.pacing as (typeof validPacings)[number])
        : defaultStyle.pacing;
    return {
      pacing,
      verbChoice: Array.isArray(data.verbChoice) ? data.verbChoice : defaultStyle.verbChoice,
      sentenceStructure: Array.isArray(data.sentenceStructure)
        ? data.sentenceStructure
        : defaultStyle.sentenceStructure,
    };
  }

  private normalizeVocabulary(raw: unknown): StyleProfile['vocabulary'] {
    const defaultStyle = this.getDefaultVocabulary();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    const validComplexities = ['moderate', 'simple', 'complex'] as const;
    const complexity =
      typeof data.complexity === 'string' &&
      validComplexities.includes(data.complexity as (typeof validComplexities)[number])
        ? (data.complexity as (typeof validComplexities)[number])
        : defaultStyle.complexity;
    return {
      complexity,
      uniqueWords:
        typeof data.uniqueWords === 'number' ? data.uniqueWords : defaultStyle.uniqueWords,
      repeatedPhrases: Array.isArray(data.repeatedPhrases)
        ? data.repeatedPhrases
        : defaultStyle.repeatedPhrases,
      domainTerms: Array.isArray(data.domainTerms) ? data.domainTerms : defaultStyle.domainTerms,
    };
  }

  private normalizeTone(raw: unknown): StyleProfile['tone'] {
    const defaultStyle = this.getDefaultTone();
    if (!raw || typeof raw !== 'object') {
      return defaultStyle;
    }
    const data = raw as Record<string, unknown>;
    return {
      overall: Array.isArray(data.overall) ? data.overall : defaultStyle.overall,
      moodPatterns: Array.isArray(data.moodPatterns)
        ? data.moodPatterns
        : defaultStyle.moodPatterns,
      humorLevel: typeof data.humorLevel === 'number' ? data.humorLevel : defaultStyle.humorLevel,
      darknessLevel:
        typeof data.darknessLevel === 'number' ? data.darknessLevel : defaultStyle.darknessLevel,
    };
  }

  async identifyPatterns(_text: string, _profile: StyleProfile): Promise<StylePattern[]> {
    const identifiedPatterns: StylePattern[] = [];

    const sentencePattern = await this.identifySentencePatterns(_text);
    if (sentencePattern) {
      identifiedPatterns.push(sentencePattern);
    }

    const emotionPattern = await this.identifyEmotionPatterns(_text);
    if (emotionPattern) {
      identifiedPatterns.push(emotionPattern);
    }

    const actionPattern = await this.identifyActionPatterns(_text);
    if (actionPattern) {
      identifiedPatterns.push(actionPattern);
    }

    for (const pattern of identifiedPatterns) {
      this.patterns.set(pattern.id, pattern);
    }

    this.progress.patternsIdentified += identifiedPatterns.length;
    await this.saveToDisk();

    return identifiedPatterns;
  }

  private async identifySentencePatterns(text: string): Promise<StylePattern | null> {
    const sentences = text.split(/[。！？\n]/).filter((s) => s.trim());
    if (sentences.length < 5) {
      return null;
    }

    const lengths = sentences.map((s) => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;

    let patternType = 'varied';
    if (variance < 50) {
      patternType = 'consistent';
    } else if (avgLength < 15) {
      patternType = 'short-focused';
    } else if (avgLength > 30) {
      patternType = 'long-descriptive';
    }

    return {
      id: `pattern_sentence_${uuidv4()}`,
      name: '句式模式',
      description: `平均句长 ${avgLength.toFixed(1)} 字，方差 ${variance.toFixed(1)}`,
      pattern: patternType,
      matches: sentences.slice(0, 3),
      context: '句子结构',
      frequency: sentences.length,
    };
  }

  private async identifyEmotionPatterns(text: string): Promise<StylePattern | null> {
    const emotionKeywords = {
      positive: ['开心', '高兴', '快乐', '幸福', '满足', '欣慰'],
      negative: ['悲伤', '痛苦', '绝望', '愤怒', '恐惧', '焦虑'],
      neutral: ['平静', '淡然', '冷静', '沉默', '安静'],
    };

    const found: Record<string, string[]> = {};
    for (const [type, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          if (!found[type]) {
            found[type] = [];
          }
          found[type].push(keyword);
        }
      }
    }

    if (Object.keys(found).length === 0) {
      return null;
    }

    const dominantType = Object.entries(found).sort((a, b) => b[1].length - a[1].length)[0][0];

    return {
      id: `pattern_emotion_${uuidv4()}`,
      name: '情感基调',
      description: `检测到 ${Object.values(found).flat().length} 个情感关键词`,
      pattern: dominantType,
      matches: Object.values(found).flat().slice(0, 5),
      context: '情感表达',
      frequency: Object.values(found).flat().length,
    };
  }

  private async identifyActionPatterns(text: string): Promise<StylePattern | null> {
    const actionVerbs = ['冲', '跑', '跳', '打', '抓', '推', '拉', '转身', '抬头', '低头'];
    const found: string[] = [];

    for (const verb of actionVerbs) {
      const regex = new RegExp(verb + '[^，。！？]*', 'g');
      const matches = text.match(regex);
      if (matches) {
        found.push(...matches.slice(0, 2));
      }
    }

    if (found.length < 3) {
      return null;
    }

    return {
      id: `pattern_action_${uuidv4()}`,
      name: '动作描写风格',
      description: `检测到 ${found.length} 处动作描写`,
      pattern: 'action-oriented',
      matches: found.slice(0, 5),
      context: '动作场景',
      frequency: found.length,
    };
  }

  getProfile(id: string): StyleProfile | undefined {
    return this.profiles.get(id);
  }

  getAllProfiles(): StyleProfile[] {
    return Array.from(this.profiles.values());
  }

  getPattern(id: string): StylePattern | undefined {
    return this.patterns.get(id);
  }

  getAllPatterns(): StylePattern[] {
    return Array.from(this.patterns.values());
  }

  getProgress(): StyleLearningProgress {
    return { ...this.progress };
  }

  async applyStyle(content: string, profileId: string): Promise<StyleApplication> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Style profile ${profileId} not found`);
    }

    const appliedPatterns: string[] = [];
    const modifications: string[] = [];

    if (profile.sentenceStyle.preferredLength === 'short') {
      appliedPatterns.push('短句风格');
      modifications.push('倾向使用短句，保持节奏明快');
    } else if (profile.sentenceStyle.preferredLength === 'long') {
      appliedPatterns.push('长句风格');
      modifications.push('可以使用较长句子进行细腻描写');
    }

    if (profile.descriptionStyle.detail === 'sparse') {
      appliedPatterns.push('简洁描写');
      modifications.push('点到为止，留白给读者想象空间');
    } else if (profile.descriptionStyle.detail === 'dense') {
      appliedPatterns.push('详细描写');
      modifications.push('可以详细描写场景和细节');
    }

    if (profile.tone.overall.includes('幽默')) {
      appliedPatterns.push('幽默基调');
      modifications.push('可以适当加入轻松幽默元素');
    }

    return {
      profileId,
      content,
      appliedPatterns,
      modifications,
      result: `已应用 ${appliedPatterns.length} 个风格模式`,
    };
  }

  async compareStyles(
    profileId1: string,
    profileId2: string
  ): Promise<{
    similarities: string[];
    differences: string[];
    compatibility: number;
  }> {
    const profile1 = this.profiles.get(profileId1);
    const profile2 = this.profiles.get(profileId2);

    if (!profile1 || !profile2) {
      throw new Error('One or both profiles not found');
    }

    const similarities: string[] = [];
    const differences: string[] = [];

    if (profile1.sentenceStyle.preferredLength === profile2.sentenceStyle.preferredLength) {
      similarities.push(`句式长度偏好相同: ${profile1.sentenceStyle.preferredLength}`);
    } else {
      differences.push(
        `句式长度偏好不同: ${profile1.sentenceStyle.preferredLength} vs ${profile2.sentenceStyle.preferredLength}`
      );
    }

    if (profile1.descriptionStyle.detail === profile2.descriptionStyle.detail) {
      similarities.push(`描写密度相同: ${profile1.descriptionStyle.detail}`);
    } else {
      differences.push(
        `描写密度不同: ${profile1.descriptionStyle.detail} vs ${profile2.descriptionStyle.detail}`
      );
    }

    const commonTones = profile1.tone.overall.filter((t) => profile2.tone.overall.includes(t));
    if (commonTones.length > 0) {
      similarities.push(`共同基调: ${commonTones.join(', ')}`);
    }

    const compatibility = similarities.length / (similarities.length + differences.length);

    return { similarities, differences, compatibility };
  }

  deleteProfile(id: string): boolean {
    const result = this.profiles.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  reset(): void {
    this.profiles.clear();
    this.patterns.clear();
    this.progress = {
      totalAnalyzed: 0,
      charactersProcessed: 0,
      patternsIdentified: 0,
      confidenceScore: 0,
      lastAnalyzed: 0,
    };
    this.saveToDisk();
  }
}

export function createDeepStyleLearningService(projectPath: string): DeepStyleLearningService {
  return new DeepStyleLearningService(projectPath);
}
