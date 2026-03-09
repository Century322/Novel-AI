import {
  NovelType,
  NovelTypeInfo,
  NovelTypeDetectionResult,
  AudienceType,
  NovelTheme,
  SettingRequirement,
  NOVEL_TYPES,
  AUDIENCE_KEYWORDS,
} from '@/types/ecosystem/novelType';
import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';

export class NovelTypeService {
  async detectNovelType(
    description: string,
    additionalContext?: string
  ): Promise<NovelTypeDetectionResult> {
    const quickResult = this.quickDetect(description);

    if (quickResult.confidence > 0.8) {
      return quickResult;
    }

    const aiResult = await this.aiDetect(description, additionalContext);

    return aiResult.confidence > quickResult.confidence ? aiResult : quickResult;
  }

  private quickDetect(description: string): NovelTypeDetectionResult {
    const lowerDesc = description.toLowerCase();
    const scores: Map<NovelType, number> = new Map();

    for (const [type, info] of Object.entries(NOVEL_TYPES)) {
      if (type === 'other') {
        continue;
      }

      let score = 0;

      for (const keyword of info.keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      for (const alias of info.aliases) {
        if (lowerDesc.includes(alias.toLowerCase())) {
          score += 3;
        }
      }

      for (const element of info.commonElements) {
        if (lowerDesc.includes(element.toLowerCase())) {
          score += 1;
        }
      }

      scores.set(type as NovelType, score);
    }

    let maxType: NovelType = 'other';
    let maxScore = 0;

    for (const [type, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }

    const confidence = maxScore > 0 ? Math.min(maxScore / 20, 0.95) : 0.1;
    const typeInfo = NOVEL_TYPES[maxType];
    const audienceType = this.detectAudience(description);

    return {
      detectedType: maxType,
      confidence,
      audienceType,
      suggestedThemes: typeInfo.typicalThemes.slice(0, 3) as NovelTheme[],
      requiredSettings: typeInfo.requiredSettings,
      recommendedSettings: typeInfo.optionalSettings,
      analysis: `基于关键词匹配检测到 ${typeInfo.name} 类型，置信度 ${Math.round(confidence * 100)}%`,
    };
  }

  private async aiDetect(
    description: string,
    additionalContext?: string
  ): Promise<NovelTypeDetectionResult> {
    const systemPrompt = `你是一个小说类型识别专家。根据用户描述，判断小说类型。

## 可用类型
${Object.values(NOVEL_TYPES)
  .filter((t) => t.type !== 'other')
  .map((t) => `- ${t.type}: ${t.name} - ${t.description}`)
  .join('\n')}

## 输出格式
返回 JSON：
{
  "type": "类型代码",
  "confidence": 0.0-1.0,
  "audience": "male/female/general",
  "themes": ["主题1", "主题2"],
  "analysis": "分析理由"
}`;

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${description}\n\n${additionalContext || ''}` },
        ],
        temperature: 0.2,
        maxTokens: 500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.quickDetect(description);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const typeInfo = NOVEL_TYPES[parsed.type as NovelType] || NOVEL_TYPES.other;

      return {
        detectedType: parsed.type as NovelType,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        audienceType: (parsed.audience as AudienceType) || 'general',
        suggestedThemes: (parsed.themes || typeInfo.typicalThemes) as NovelTheme[],
        requiredSettings: typeInfo.requiredSettings,
        recommendedSettings: typeInfo.optionalSettings,
        analysis: parsed.analysis || 'AI 分析结果',
      };
    } catch (error) {
      logger.error('AI 类型检测失败', { error });
      return this.quickDetect(description);
    }
  }

  private detectAudience(description: string): AudienceType {
    const lowerDesc = description.toLowerCase();
    const scores: Record<AudienceType, number> = { male: 0, female: 0, general: 0 };

    for (const [audience, keywords] of Object.entries(AUDIENCE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          scores[audience as AudienceType] += 1;
        }
      }
    }

    let maxAudience: AudienceType = 'general';
    let maxScore = 0;

    for (const [audience, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxAudience = audience as AudienceType;
      }
    }

    return maxAudience;
  }

  getTypeInfo(type: NovelType): NovelTypeInfo {
    return NOVEL_TYPES[type] || NOVEL_TYPES.other;
  }

  getRecommendedSettings(type: NovelType): {
    required: SettingRequirement[];
    recommended: SettingRequirement[];
  } {
    const typeInfo = this.getTypeInfo(type);
    return {
      required: typeInfo.requiredSettings,
      recommended: typeInfo.optionalSettings,
    };
  }

  getSettingTemplate(type: NovelType): Record<string, string> {
    const typeInfo = this.getTypeInfo(type);
    const template: Record<string, string> = {};

    for (const setting of typeInfo.requiredSettings) {
      template[setting.name] = this.generateSettingTemplate(setting);
    }

    for (const setting of typeInfo.optionalSettings) {
      template[setting.name] = this.generateSettingTemplate(setting);
    }

    return template;
  }

  private generateSettingTemplate(setting: SettingRequirement): string {
    let template = `# ${setting.name}\n\n`;
    template += `${setting.description}\n\n`;

    if (setting.examples.length > 0) {
      template += '## 示例\n';
      for (const example of setting.examples) {
        template += `- ${example}\n`;
      }
    }

    return template;
  }

  async analyzeReferenceNovel(
    content: string,
    sampleSize: number = 5000
  ): Promise<{
    detectedType: NovelType;
    styleCharacteristics: string[];
    commonVocabulary: string[];
    plotPatterns: string[];
  }> {
    const sample = content.slice(0, sampleSize);
    const detection = await this.detectNovelType(sample);

    const typeInfo = this.getTypeInfo(detection.detectedType);

    return {
      detectedType: detection.detectedType,
      styleCharacteristics: this.extractStyleCharacteristics(sample),
      commonVocabulary: this.extractVocabulary(sample),
      plotPatterns: typeInfo.plotPatterns,
    };
  }

  private extractStyleCharacteristics(text: string): string[] {
    const characteristics: string[] = [];

    const avgSentenceLength =
      text
        .split(/[。！？\n]/)
        .filter((s) => s.trim())
        .reduce((sum, s) => sum + s.length, 0) /
      text.split(/[。！？\n]/).filter((s) => s.trim()).length;

    if (avgSentenceLength < 20) {
      characteristics.push('短句为主，节奏明快');
    } else if (avgSentenceLength > 40) {
      characteristics.push('长句为主，描写细腻');
    } else {
      characteristics.push('长短句结合，节奏适中');
    }

    const dialogueCount = (text.match(/["「『]/g) || []).length;
    if (dialogueCount > text.length / 100) {
      characteristics.push('对话丰富');
    }

    const descriptionKeywords = ['只见', '只见得', '看去', '望去', '只见那'];
    for (const keyword of descriptionKeywords) {
      if (text.includes(keyword)) {
        characteristics.push('注重场景描写');
        break;
      }
    }

    return characteristics;
  }

  private extractVocabulary(text: string): string[] {
    const words: Map<string, number> = new Map();

    const patterns = [/[\u4e00-\u9fa5]{2,4}/g];

    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        words.set(match, (words.get(match) || 0) + 1);
      }
    }

    return Array.from(words.entries())
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word]) => word);
  }

  suggestNextSetting(type: NovelType, completedSettings: string[]): SettingRequirement | null {
    const typeInfo = this.getTypeInfo(type);

    for (const setting of typeInfo.requiredSettings) {
      if (!completedSettings.includes(setting.name)) {
        return setting;
      }
    }

    for (const setting of typeInfo.optionalSettings) {
      if (!completedSettings.includes(setting.name)) {
        return setting;
      }
    }

    return null;
  }

  getAllTypes(): NovelTypeInfo[] {
    return Object.values(NOVEL_TYPES).filter((t) => t.type !== 'other');
  }

  getTypeByKeyword(keyword: string): NovelType | null {
    const lowerKeyword = keyword.toLowerCase();

    for (const [type, info] of Object.entries(NOVEL_TYPES)) {
      if (info.keywords.some((k) => k.toLowerCase() === lowerKeyword)) {
        return type as NovelType;
      }
      if (info.aliases.some((a) => a.toLowerCase() === lowerKeyword)) {
        return type as NovelType;
      }
      if (info.name.toLowerCase() === lowerKeyword) {
        return type as NovelType;
      }
    }

    return null;
  }
}

export const novelTypeService = new NovelTypeService();
