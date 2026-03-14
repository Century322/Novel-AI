import { workshopService } from '../core/workshopService';
import {
  SimpleStyleProfile,
  StyleFeature,
  SimpleStyleExample,
  StyleAnalysis,
  StyleMetric,
  EmotionalTone,
} from '@/types/writing/quality';
import { logger } from '../core/loggerService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class StyleLearningService {
  private projectPath: string;
  private profiles: Map<string, SimpleStyleProfile> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    await this.loadProfiles();
  }

  private async loadProfiles(): Promise<void> {
    const profilePath = `${this.projectPath}/.ai-workshop/styles/profiles.json`;

    if (await workshopService.pathExists(profilePath)) {
      try {
        const content = await workshopService.readFile(profilePath);
        const data = JSON.parse(content);

        for (const profile of data.profiles || []) {
          this.profiles.set(profile.id, profile);
        }
      } catch (error) {
        logger.error('加载风格档案失败', { error });
      }
    }
  }

  private async saveProfiles(): Promise<void> {
    const profilePath = `${this.projectPath}/.ai-workshop/styles/profiles.json`;
    const data = {
      profiles: Array.from(this.profiles.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(profilePath, JSON.stringify(data, null, 2));
  }

  async analyzeStyle(content: string): Promise<StyleAnalysis> {
    const sentenceLength = this.analyzeSentenceLength(content);
    const paragraphLength = this.analyzeParagraphLength(content);
    const dialogueRatio = this.calculateDialogueRatio(content);
    const descriptionRatio = this.calculateDescriptionRatio(content);
    const vocabularyRichness = this.calculateVocabularyRichness(content);
    const sentenceVariety = this.calculateSentenceVariety(content);
    const metaphorUsage = this.calculateMetaphorUsage(content);
    const emotionalTone = this.analyzeEmotionalTone(content);

    return {
      sentenceLength,
      paragraphLength,
      dialogueRatio,
      descriptionRatio,
      vocabularyRichness,
      sentenceVariety,
      metaphorUsage,
      emotionalTone,
    };
  }

  private analyzeSentenceLength(content: string): StyleMetric {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const lengths = sentences.map((s) => s.length);

    const average = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - average, 2), 0) /
      Math.max(lengths.length, 1);

    const distribution: number[] = [];
    const bins = [0, 10, 20, 30, 50, 80, 120, 200, Infinity];
    for (let i = 0; i < bins.length - 1; i++) {
      const count = lengths.filter((l) => l >= bins[i] && l < bins[i + 1]).length;
      distribution.push(count);
    }

    return { average, variance, distribution };
  }

  private analyzeParagraphLength(content: string): StyleMetric {
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    const lengths = paragraphs.map((p) => p.length);

    const average = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - average, 2), 0) /
      Math.max(lengths.length, 1);

    const distribution: number[] = [];
    const bins = [0, 50, 100, 200, 400, 800, Infinity];
    for (let i = 0; i < bins.length - 1; i++) {
      const count = lengths.filter((l) => l >= bins[i] && l < bins[i + 1]).length;
      distribution.push(count);
    }

    return { average, variance, distribution };
  }

  private calculateDialogueRatio(content: string): number {
    const dialogue = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
    const dialogueLength = dialogue.reduce((sum, d) => sum + d.length, 0);
    return dialogueLength / Math.max(content.length, 1);
  }

  private calculateDescriptionRatio(content: string): number {
    const descriptionPatterns = [
      /只见[^。！？]+/g,
      /看到[^。！？]+/g,
      /望去[^。！？]+/g,
      /身穿[^。！？]+/g,
      /四周[^。！？]+/g,
    ];

    let totalLength = 0;
    for (const pattern of descriptionPatterns) {
      const matches = content.match(pattern) || [];
      totalLength += matches.reduce((sum, m) => sum + m.length, 0);
    }

    return totalLength / Math.max(content.length, 1);
  }

  private calculateVocabularyRichness(content: string): number {
    const words = content.match(/[\u4e00-\u9fa5]+/g) || [];
    const uniqueWords = new Set(words);
    return uniqueWords.size / Math.max(words.length, 1);
  }

  private calculateSentenceVariety(content: string): number {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const structures = new Set<string>();

    for (const sentence of sentences) {
      const structure = this.getSentenceStructure(sentence);
      structures.add(structure);
    }

    return structures.size / Math.max(sentences.length, 1);
  }

  private getSentenceStructure(sentence: string): string {
    return sentence
      .replace(/[\u4e00-\u9fa5]{5,}/g, 'N')
      .replace(/[\u4e00-\u9fa5]{2,4}/g, 'n')
      .replace(/[0-9]+/g, 'D')
      .replace(/[a-zA-Z]+/g, 'W');
  }

  private calculateMetaphorUsage(content: string): number {
    const metaphors = content.match(/像|如同|仿佛|好似|宛如|犹如|好比/g) || [];
    return metaphors.length / Math.max(content.length / 100, 1);
  }

  private analyzeEmotionalTone(content: string): EmotionalTone {
    const toneKeywords: Record<string, string[]> = {
      紧张: ['紧张', '焦虑', '不安', '担心', '恐惧', '害怕', '惊恐', '忐忑'],
      温馨: ['温暖', '幸福', '感动', '甜蜜', '温馨', '柔和', '慈祥', '关爱'],
      悲伤: ['悲伤', '痛苦', '绝望', '失落', '哀伤', '凄凉', '忧伤', '心碎'],
      激昂: ['激动', '兴奋', '热血', '振奋', '激昂', '豪迈', '壮烈', '澎湃'],
      平静: ['平静', '安宁', '淡然', '从容', '宁静', '祥和', '恬淡', '悠闲'],
      愤怒: ['愤怒', '恼怒', '暴怒', '气愤', '愤恨', '怒火', '愤慨', '恼火'],
      幽默: ['幽默', '诙谐', '风趣', '搞笑', '滑稽', '逗趣', '调侃', '戏谑'],
    };

    const toneScores: Record<string, number> = {};

    for (const [tone, keywords] of Object.entries(toneKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'g');
        score += (content.match(regex) || []).length;
      }
      toneScores[tone] = score;
    }

    const sortedTones = Object.entries(toneScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    const primary = sortedTones[0]?.[0] || '平静';
    const secondary = sortedTones.slice(1, 3).map(([tone]) => tone);
    const totalScore = sortedTones.reduce((sum, [_, score]) => sum + score, 0);
    const intensity = totalScore / Math.max(content.length / 100, 1);

    return { primary, secondary, intensity };
  }

  async createProfile(
    name: string,
    description: string,
    sampleContents: string[]
  ): Promise<SimpleStyleProfile> {
    const allAnalysis: StyleAnalysis[] = [];

    for (const content of sampleContents) {
      const analysis = await this.analyzeStyle(content);
      allAnalysis.push(analysis);
    }

    const features = this.aggregateFeatures(allAnalysis);
    const examples: SimpleStyleExample[] = sampleContents.map((content, index) => ({
      content: content.substring(0, 500),
      analysis: `样本 ${index + 1} 分析`,
    }));

    const profile: SimpleStyleProfile = {
      id: generateId(),
      name,
      description,
      features,
      examples,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    await this.saveProfiles();

    return profile;
  }

  private aggregateFeatures(analyses: StyleAnalysis[]): StyleFeature[] {
    const features: StyleFeature[] = [];

    const avgSentenceLength =
      analyses.reduce((sum, a) => sum + a.sentenceLength.average, 0) / analyses.length;
    features.push({
      name: 'average_sentence_length',
      value: avgSentenceLength,
      description: `平均句长: ${avgSentenceLength.toFixed(1)} 字`,
    });

    const avgParagraphLength =
      analyses.reduce((sum, a) => sum + a.paragraphLength.average, 0) / analyses.length;
    features.push({
      name: 'average_paragraph_length',
      value: avgParagraphLength,
      description: `平均段落长度: ${avgParagraphLength.toFixed(1)} 字`,
    });

    const avgDialogueRatio =
      analyses.reduce((sum, a) => sum + a.dialogueRatio, 0) / analyses.length;
    features.push({
      name: 'dialogue_ratio',
      value: avgDialogueRatio,
      description: `对话比例: ${(avgDialogueRatio * 100).toFixed(1)}%`,
    });

    const avgDescriptionRatio =
      analyses.reduce((sum, a) => sum + a.descriptionRatio, 0) / analyses.length;
    features.push({
      name: 'description_ratio',
      value: avgDescriptionRatio,
      description: `描写比例: ${(avgDescriptionRatio * 100).toFixed(1)}%`,
    });

    const avgVocabularyRichness =
      analyses.reduce((sum, a) => sum + a.vocabularyRichness, 0) / analyses.length;
    features.push({
      name: 'vocabulary_richness',
      value: avgVocabularyRichness,
      description: `词汇丰富度: ${(avgVocabularyRichness * 100).toFixed(1)}%`,
    });

    const avgSentenceVariety =
      analyses.reduce((sum, a) => sum + a.sentenceVariety, 0) / analyses.length;
    features.push({
      name: 'sentence_variety',
      value: avgSentenceVariety,
      description: `句式多样性: ${(avgSentenceVariety * 100).toFixed(1)}%`,
    });

    const avgMetaphorUsage =
      analyses.reduce((sum, a) => sum + a.metaphorUsage, 0) / analyses.length;
    features.push({
      name: 'metaphor_usage',
      value: avgMetaphorUsage,
      description: `比喻使用频率: ${avgMetaphorUsage.toFixed(2)}`,
    });

    const primaryTones = analyses.map((a) => a.emotionalTone.primary);
    const toneCounts: Record<string, number> = {};
    for (const tone of primaryTones) {
      toneCounts[tone] = (toneCounts[tone] || 0) + 1;
    }
    const dominantTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '平静';
    features.push({
      name: 'dominant_tone',
      value: Object.keys(toneCounts).indexOf(dominantTone),
      description: `主要情感基调: ${dominantTone}`,
    });

    return features;
  }

  async compareStyles(
    content: string,
    profileId: string
  ): Promise<{
    similarity: number;
    differences: string[];
    suggestions: string[];
  }> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Style profile not found: ${profileId}`);
    }

    const analysis = await this.analyzeStyle(content);
    const differences: string[] = [];
    const suggestions: string[] = [];
    let totalDifference = 0;
    let featureCount = 0;

    for (const feature of profile.features) {
      const currentValue = this.getFeatureValue(analysis, feature.name);
      const diff = Math.abs(currentValue - feature.value);
      totalDifference += diff;
      featureCount++;

      if (diff > 0.1) {
        differences.push(
          `${feature.description} vs 当前: ${this.formatFeatureValue(feature.name, currentValue)}`
        );

        if (feature.name === 'average_sentence_length') {
          if (currentValue < feature.value) {
            suggestions.push('建议适当增加句子长度，增加细节描写');
          } else {
            suggestions.push('建议适当缩短句子，提高可读性');
          }
        } else if (feature.name === 'dialogue_ratio') {
          if (currentValue < feature.value) {
            suggestions.push('建议增加对话内容');
          } else {
            suggestions.push('建议减少对话，增加叙述描写');
          }
        } else if (feature.name === 'vocabulary_richness') {
          if (currentValue < feature.value) {
            suggestions.push('建议使用更丰富的词汇表达');
          }
        }
      }
    }

    const similarity = Math.max(0, 1 - totalDifference / featureCount);

    return {
      similarity,
      differences: differences.slice(0, 5),
      suggestions: suggestions.slice(0, 5),
    };
  }

  private getFeatureValue(analysis: StyleAnalysis, featureName: string): number {
    switch (featureName) {
      case 'average_sentence_length':
        return analysis.sentenceLength.average;
      case 'average_paragraph_length':
        return analysis.paragraphLength.average;
      case 'dialogue_ratio':
        return analysis.dialogueRatio;
      case 'description_ratio':
        return analysis.descriptionRatio;
      case 'vocabulary_richness':
        return analysis.vocabularyRichness;
      case 'sentence_variety':
        return analysis.sentenceVariety;
      case 'metaphor_usage':
        return analysis.metaphorUsage;
      case 'dominant_tone':
        return 0;
      default:
        return 0;
    }
  }

  private formatFeatureValue(featureName: string, value: number): string {
    if (
      featureName.includes('ratio') ||
      featureName.includes('richness') ||
      featureName.includes('variety')
    ) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(1);
  }

  getProfile(profileId: string): SimpleStyleProfile | undefined {
    return this.profiles.get(profileId);
  }

  getAllProfiles(): SimpleStyleProfile[] {
    return Array.from(this.profiles.values());
  }

  async updateProfile(profileId: string, updates: Partial<SimpleStyleProfile>): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return false;
    }

    const updated = {
      ...profile,
      ...updates,
      updatedAt: Date.now(),
    };

    this.profiles.set(profileId, updated);
    await this.saveProfiles();
    return true;
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    if (!this.profiles.has(profileId)) {
      return false;
    }

    this.profiles.delete(profileId);
    await this.saveProfiles();
    return true;
  }

  generateStylePrompt(profileId: string): string {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return '';
    }

    let prompt = `## 写作风格指南: ${profile.name}\n\n`;
    prompt += `${profile.description}\n\n`;
    prompt += '### 风格特征\n';

    for (const feature of profile.features) {
      prompt += `- ${feature.description}\n`;
    }

    if (profile.examples.length > 0) {
      prompt += '\n### 示例片段\n';
      prompt += `\`\`\`\n${profile.examples[0].content.substring(0, 300)}...\n\`\`\`\n`;
    }

    return prompt;
  }
}

export function createStyleLearningService(projectPath: string): StyleLearningService {
  return new StyleLearningService(projectPath);
}
