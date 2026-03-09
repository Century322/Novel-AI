import {
  ExtractionType,
  ExtractionResult,
  ExtractedInfo,
  ExtractedCharacter,
  ExtractedWorldbuilding,
  ExtractedPlot,
  ExtractedForeshadowing,
  ExtractedItem,
  ExtractedRelationship,
  ExtractedTimeline,
  ExtractedSetting,
  EXTRACTION_PROMPTS,
} from '@/types/knowledge/extraction';
import { llmService } from '../ai/llmService';
import { logger } from '../core/loggerService';

export class InfoExtractionService {
  async extractFromText(text: string, types?: ExtractionType[]): Promise<ExtractionResult> {
    const targetTypes = types || this.detectExtractionTypes(text);
    const extractions: ExtractedInfo[] = [];
    const suggestions: string[] = [];

    for (const type of targetTypes) {
      try {
        const extraction = await this.extractByType(text, type);
        if (extraction) {
          extractions.push(extraction);
        }
      } catch (error) {
        logger.error('信息提取失败', { type, error });
      }
    }

    const additionalSuggestions = this.generateSuggestions(extractions, text);
    suggestions.push(...additionalSuggestions);

    return {
      success: extractions.length > 0,
      extractions,
      confidence: this.calculateConfidence(extractions, text),
      rawText: text,
      suggestions,
    };
  }

  private detectExtractionTypes(text: string): ExtractionType[] {
    const types: ExtractionType[] = [];
    const lowerText = text.toLowerCase();

    if (this.containsCharacterKeywords(lowerText)) {
      types.push('character');
    }
    if (this.containsWorldbuildingKeywords(lowerText)) {
      types.push('worldbuilding');
    }
    if (this.containsPlotKeywords(lowerText)) {
      types.push('plot');
    }
    if (this.containsForeshadowingKeywords(lowerText)) {
      types.push('foreshadowing');
    }
    if (this.containsItemKeywords(lowerText)) {
      types.push('item');
    }
    if (this.containsRelationshipKeywords(lowerText)) {
      types.push('relationship');
    }
    if (this.containsTimelineKeywords(lowerText)) {
      types.push('timeline');
    }

    if (types.length === 0) {
      types.push('setting');
    }

    return types;
  }

  private containsCharacterKeywords(text: string): boolean {
    const keywords = ['主角', '人物', '角色', '性格', '外貌', '背景', '能力', '名字', '叫'];
    return keywords.some((k) => text.includes(k));
  }

  private containsWorldbuildingKeywords(text: string): boolean {
    const keywords = ['世界观', '设定', '体系', '势力', '宗门', '国家', '大陆', '规则', '力量'];
    return keywords.some((k) => text.includes(k));
  }

  private containsPlotKeywords(text: string): boolean {
    const keywords = ['剧情', '情节', '故事', '主线', '支线', '大纲', '发展', '高潮'];
    return keywords.some((k) => text.includes(k));
  }

  private containsForeshadowingKeywords(text: string): boolean {
    const keywords = ['伏笔', '埋下', '暗示', '铺垫', '悬念', '揭示', '回收'];
    return keywords.some((k) => text.includes(k));
  }

  private containsItemKeywords(text: string): boolean {
    const keywords = ['武器', '神器', '法宝', '物品', '道具', '宝物', '装备'];
    return keywords.some((k) => text.includes(k));
  }

  private containsRelationshipKeywords(text: string): boolean {
    const keywords = ['关系', '朋友', '敌人', '师徒', '恋人', '兄弟', '姐妹', '父子', '母女'];
    return keywords.some((k) => text.includes(k));
  }

  private containsTimelineKeywords(text: string): boolean {
    const keywords = ['时间线', '那年', '当天', '之后', '之前', '后来', '曾经', '历史'];
    return keywords.some((k) => text.includes(k));
  }

  private async extractByType(text: string, type: ExtractionType): Promise<ExtractedInfo | null> {
    const prompt = EXTRACTION_PROMPTS[type];

    const systemPrompt = `你是一个小说信息提取专家。${prompt}

请只返回 JSON 数据，不要有其他内容。JSON 应该包含一个 "data" 字段，里面是提取的信息。`;

    try {
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        maxTokens: 1000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const data = parsed.data || parsed;

      return this.wrapExtraction(type, data);
    } catch (error) {
      logger.error('提取失败', { type, error });
      return null;
    }
  }

  private wrapExtraction(type: ExtractionType, data: Record<string, unknown>): ExtractedInfo {
    switch (type) {
      case 'character':
        return {
          type: 'character',
          data: this.sanitizeCharacter(data as Partial<ExtractedCharacter>),
        };
      case 'worldbuilding':
        return {
          type: 'worldbuilding',
          data: this.sanitizeWorldbuilding(data as Partial<ExtractedWorldbuilding>),
        };
      case 'plot':
        return {
          type: 'plot',
          data: this.sanitizePlot(data as Partial<ExtractedPlot>),
        };
      case 'foreshadowing':
        return {
          type: 'foreshadowing',
          data: this.sanitizeForeshadowing(data as Partial<ExtractedForeshadowing>),
        };
      case 'item':
        return {
          type: 'item',
          data: this.sanitizeItem(data as Partial<ExtractedItem>),
        };
      case 'relationship':
        return {
          type: 'relationship',
          data: this.sanitizeRelationship(data as Partial<ExtractedRelationship>),
        };
      case 'timeline':
        return {
          type: 'timeline',
          data: this.sanitizeTimeline(data as Partial<ExtractedTimeline>),
        };
      case 'setting':
      default:
        return {
          type: 'setting',
          data: this.sanitizeSetting(data as Partial<ExtractedSetting>),
        };
    }
  }

  private sanitizeCharacter(data: Partial<ExtractedCharacter>): ExtractedCharacter {
    return {
      name: data.name || '未命名人物',
      role: data.role || 'supporting',
      description: data.description || '',
      personality: Array.isArray(data.personality) ? data.personality : [],
      appearance: data.appearance || '',
      background: data.background || '',
      abilities: Array.isArray(data.abilities) ? data.abilities : [],
      relationships: Array.isArray(data.relationships) ? data.relationships : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      secrets: Array.isArray(data.secrets) ? data.secrets : [],
    };
  }

  private sanitizeWorldbuilding(data: Partial<ExtractedWorldbuilding>): ExtractedWorldbuilding {
    return {
      name: data.name || '未命名设定',
      category: data.category || 'rules',
      description: data.description || '',
      details: data.details || {},
      relatedElements: Array.isArray(data.relatedElements) ? data.relatedElements : [],
    };
  }

  private sanitizePlot(data: Partial<ExtractedPlot>): ExtractedPlot {
    return {
      title: data.title || '未命名剧情',
      type: data.type || 'subplot',
      description: data.description || '',
      characters: Array.isArray(data.characters) ? data.characters : [],
      location: data.location || '',
      stage: data.stage || 'setup',
      foreshadowing: Array.isArray(data.foreshadowing) ? data.foreshadowing : [],
      consequences: Array.isArray(data.consequences) ? data.consequences : [],
    };
  }

  private sanitizeForeshadowing(data: Partial<ExtractedForeshadowing>): ExtractedForeshadowing {
    return {
      content: data.content || '',
      plantedAt: data.plantedAt || '当前',
      plannedResolution: data.plannedResolution || '',
      relatedCharacters: Array.isArray(data.relatedCharacters) ? data.relatedCharacters : [],
      importance: data.importance || 'minor',
      status: data.status || 'planted',
    };
  }

  private sanitizeItem(data: Partial<ExtractedItem>): ExtractedItem {
    return {
      name: data.name || '未命名物品',
      type: data.type || 'other',
      description: data.description || '',
      abilities: Array.isArray(data.abilities) ? data.abilities : [],
      origin: data.origin || '',
      currentOwner: data.currentOwner || '',
    };
  }

  private sanitizeRelationship(data: Partial<ExtractedRelationship>): ExtractedRelationship {
    return {
      character1: data.character1 || '',
      character2: data.character2 || '',
      relationshipType: data.relationshipType || '未知',
      description: data.description || '',
      development: Array.isArray(data.development) ? data.development : [],
    };
  }

  private sanitizeTimeline(data: Partial<ExtractedTimeline>): ExtractedTimeline {
    return {
      event: data.event || '',
      time: data.time || '',
      characters: Array.isArray(data.characters) ? data.characters : [],
      location: data.location || '',
      significance: data.significance || '',
    };
  }

  private sanitizeSetting(data: Partial<ExtractedSetting>): ExtractedSetting {
    return {
      key: data.key || '未命名设定',
      value: data.value || '',
      category: data.category || '通用',
      notes: data.notes || '',
    };
  }

  private calculateConfidence(extractions: ExtractedInfo[], _originalText: string): number {
    if (extractions.length === 0) {
      return 0;
    }

    let totalScore = 0;
    for (const extraction of extractions) {
      const data = extraction.data as unknown as Record<string, unknown>;
      const fields = Object.keys(data);
      const filledFields = fields.filter((f) => {
        const value = data[f];
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        if (typeof value === 'string') {
          return value.length > 0;
        }
        return value !== null && value !== undefined;
      });
      totalScore += filledFields.length / Math.max(fields.length, 1);
    }

    return Math.min(totalScore / extractions.length, 1);
  }

  private generateSuggestions(extractions: ExtractedInfo[], _originalText: string): string[] {
    const suggestions: string[] = [];

    for (const extraction of extractions) {
      switch (extraction.type) {
        case 'character': {
          const charData = extraction.data;
          if (!charData.background) {
            suggestions.push(`建议补充 ${charData.name} 的背景故事`);
          }
          if (charData.abilities.length === 0) {
            suggestions.push(`建议补充 ${charData.name} 的能力/技能`);
          }
          break;
        }

        case 'worldbuilding': {
          const worldData = extraction.data;
          if (!worldData.description) {
            suggestions.push(`建议详细描述 ${worldData.name} 的具体内容`);
          }
          break;
        }

        case 'plot': {
          const plotData = extraction.data;
          if (plotData.characters.length === 0) {
            suggestions.push(`建议为剧情 "${plotData.title}" 添加涉及的人物`);
          }
          break;
        }

        case 'foreshadowing': {
          const foreshadowData = extraction.data;
          if (!foreshadowData.plannedResolution) {
            suggestions.push('建议规划这个伏笔的回收方式');
          }
          break;
        }
      }
    }

    return suggestions;
  }

  async quickExtract(text: string): Promise<ExtractedInfo[]> {
    const types = this.detectExtractionTypes(text);
    const results: ExtractedInfo[] = [];

    for (const type of types) {
      const quickResult = this.quickExtractByType(text, type);
      if (quickResult) {
        results.push(quickResult);
      }
    }

    return results;
  }

  private quickExtractByType(text: string, type: ExtractionType): ExtractedInfo | null {
    switch (type) {
      case 'character':
        return this.quickExtractCharacter(text);
      case 'foreshadowing':
        return this.quickExtractForeshadowing(text);
      case 'item':
        return this.quickExtractItem(text);
      default:
        return null;
    }
  }

  private quickExtractCharacter(text: string): ExtractedInfo | null {
    const nameMatch = text.match(/(?:主角|人物|角色|叫)[：:]*\s*(\S+)/);
    if (nameMatch) {
      return {
        type: 'character',
        data: {
          name: nameMatch[1],
          role: text.includes('主角') ? 'protagonist' : 'supporting',
          description: '',
          personality: [],
          appearance: '',
          background: '',
          abilities: [],
          relationships: [],
          goals: [],
          secrets: [],
        },
      };
    }
    return null;
  }

  private quickExtractForeshadowing(text: string): ExtractedInfo | null {
    if (text.includes('伏笔')) {
      const contentMatch = text.match(/伏笔[：:]*\s*(.+)/);
      if (contentMatch) {
        return {
          type: 'foreshadowing',
          data: {
            content: contentMatch[1].trim(),
            plantedAt: '当前',
            plannedResolution: '',
            relatedCharacters: [],
            importance: 'minor',
            status: 'planted',
          },
        };
      }
    }
    return null;
  }

  private quickExtractItem(text: string): ExtractedInfo | null {
    const itemMatch = text.match(/(?:武器|法宝|神器|物品)[：:]*\s*(\S+)/);
    if (itemMatch) {
      return {
        type: 'item',
        data: {
          name: itemMatch[1],
          type: 'artifact',
          description: '',
          abilities: [],
          origin: '',
          currentOwner: '',
        },
      };
    }
    return null;
  }
}

export const infoExtractionService = new InfoExtractionService();
