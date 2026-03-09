import { workshopService } from '../core/workshopService';
import { MemoryService } from '../knowledge/memoryService';
import {
  DistillationResult,
  DistillationType,
  ExtractedKnowledge,
  QualityAssessment,
} from '@/types/writing/quality';
import { KnowledgeService } from '../knowledge/knowledgeService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class DistillationService {
  private projectPath: string;
  private memoryService: MemoryService;

  constructor(
    projectPath: string,
    memoryService: MemoryService,
    _knowledgeService: KnowledgeService
  ) {
    this.projectPath = projectPath;
    this.memoryService = memoryService;
  }

  async distill(
    content: string,
    type: DistillationType,
    quality?: QualityAssessment
  ): Promise<DistillationResult> {
    let distilledContent: string;
    let extractedKnowledge: ExtractedKnowledge[] = [];

    switch (type) {
      case 'chapter_summary':
        distilledContent = await this.distillChapterSummary(content);
        extractedKnowledge = this.extractFromSummary(distilledContent, content);
        break;
      case 'character_profile':
        distilledContent = await this.distillCharacterProfile(content);
        extractedKnowledge = this.extractCharacterKnowledge(distilledContent);
        break;
      case 'plot_outline':
        distilledContent = await this.distillPlotOutline(content);
        extractedKnowledge = this.extractPlotKnowledge(distilledContent);
        break;
      case 'style_guide':
        distilledContent = await this.distillStyleGuide(content);
        extractedKnowledge = this.extractStyleKnowledge(distilledContent);
        break;
      case 'worldbuilding':
        distilledContent = await this.distillWorldbuilding(content);
        extractedKnowledge = this.extractWorldKnowledge(distilledContent);
        break;
      case 'lesson_learned':
        distilledContent = await this.distillLessonLearned(content, quality);
        extractedKnowledge = this.extractLessonKnowledge(distilledContent);
        break;
      default:
        distilledContent = content;
    }

    const result: DistillationResult = {
      id: generateId(),
      sourceContent: content.substring(0, 1000),
      distilledContent,
      timestamp: Date.now(),
      type,
      quality: quality || (await this.createBasicQuality(content)),
      extractedKnowledge,
    };

    await this.saveDistillationResult(result);
    await this.applyExtractedKnowledge(extractedKnowledge);

    return result;
  }

  private async distillChapterSummary(content: string): Promise<string> {
    const paragraphs = content.split(/\n\n+/);
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());

    const keySentences: string[] = [];

    for (const sentence of sentences) {
      const hasAction = /[说问道答笑哭喊叫走跑站坐]/.test(sentence);
      const hasEmotion = /[喜怒哀乐悲恐惊怒]/.test(sentence);
      const hasTurning = /[但是然而却突然终于]/.test(sentence);

      if ((hasAction && hasEmotion) || hasTurning) {
        keySentences.push(sentence.trim());
      }
    }

    const characters = this.extractCharacterNames(content);
    const locations = this.extractLocations(content);

    let summary = '## 章节摘要\n\n';

    if (characters.length > 0) {
      summary += `### 出场人物\n${characters.map((c) => `- ${c}`).join('\n')}\n\n`;
    }

    if (locations.length > 0) {
      summary += `### 场景地点\n${locations.map((l) => `- ${l}`).join('\n')}\n\n`;
    }

    summary += '### 关键情节\n';
    const plotPoints = keySentences.slice(0, 5);
    for (let i = 0; i < plotPoints.length; i++) {
      summary += `${i + 1}. ${plotPoints[i]}\n`;
    }

    summary += '\n### 段落结构\n';
    summary += `- 总段落数: ${paragraphs.length}\n`;
    summary += `- 总句数: ${sentences.length}\n`;
    summary += `- 字数: ${content.length}\n`;

    return summary;
  }

  private extractCharacterNames(content: string): string[] {
    const names = new Set<string>();

    const patterns = [
      /([\u4e00-\u9fa5]{2,4})(说|道|问|答|笑|哭|喊|叫|想|看)/g,
      /"([^"]+)"[，。]([\u4e00-\u9fa5]{2,4})说/g,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length >= 2 && match[1].length <= 4) {
          names.add(match[1]);
        }
      }
    }

    return Array.from(names);
  }

  private extractLocations(content: string): string[] {
    const locations = new Set<string>();

    const locationPatterns = [
      /在([\u4e00-\u9fa5]{2,6})(里|中|内|上|下|旁|边)/g,
      /来到([\u4e00-\u9fa5]{2,6})/g,
      /离开([\u4e00-\u9fa5]{2,6})/g,
      /回到([\u4e00-\u9fa5]{2,6})/g,
    ];

    for (const pattern of locationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          locations.add(match[1]);
        }
      }
    }

    return Array.from(locations);
  }

  private async distillCharacterProfile(content: string): Promise<string> {
    const characters = this.extractCharacterNames(content);
    const profiles: string[] = [];

    for (const charName of characters) {
      const charPattern = new RegExp(`${charName}[^。！？]{0,100}`, 'g');
      const charContexts = content.match(charPattern) || [];

      const traits = this.extractCharacterTraits(charContexts);
      const actions = this.extractCharacterActions(charContexts);

      let profile = `## ${charName}\n\n`;
      profile += '### 特征\n';
      for (const trait of traits) {
        profile += `- ${trait}\n`;
      }

      profile += '\n### 主要行为\n';
      for (const action of actions.slice(0, 5)) {
        profile += `- ${action}\n`;
      }

      profiles.push(profile);
    }

    return profiles.join('\n---\n\n');
  }

  private extractCharacterTraits(contexts: string[]): string[] {
    const traits = new Set<string>();

    const traitPatterns = [
      /(\w+)(的|地)(眼光|神态|语气|表情)/,
      /(冷静|温柔|勇敢|聪明|善良|冷酷|狡猾|豪爽|内向|外向)/,
    ];

    for (const context of contexts) {
      for (const pattern of traitPatterns) {
        const matches = context.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length >= 2) {
            traits.add(match[1]);
          }
        }
      }
    }

    return Array.from(traits);
  }

  private extractCharacterActions(contexts: string[]): string[] {
    const actions: string[] = [];

    for (const context of contexts) {
      const actionMatch = context.match(/[说问道答笑哭喊叫走跑站坐看想][^，。！？]*/);
      if (actionMatch) {
        actions.push(actionMatch[0]);
      }
    }

    return actions;
  }

  private async distillPlotOutline(content: string): Promise<string> {
    const paragraphs = content.split(/\n\n+/);

    let outline = '## 情节大纲\n\n';

    const scenes: { title: string; content: string }[] = [];
    let currentScene = '';
    let sceneIndex = 1;

    for (const para of paragraphs) {
      const hasSceneChange = /来到|离开|回到|进入|走出/.test(para);

      if (hasSceneChange && currentScene) {
        scenes.push({
          title: `场景 ${sceneIndex}`,
          content: currentScene,
        });
        currentScene = para;
        sceneIndex++;
      } else {
        currentScene += '\n' + para;
      }
    }

    if (currentScene) {
      scenes.push({
        title: `场景 ${sceneIndex}`,
        content: currentScene,
      });
    }

    for (const scene of scenes) {
      outline += `### ${scene.title}\n`;
      const keyPoints = this.extractKeyPoints(scene.content);
      for (const point of keyPoints) {
        outline += `- ${point}\n`;
      }
      outline += '\n';
    }

    const conflicts = this.extractConflicts(content);
    if (conflicts.length > 0) {
      outline += '### 冲突点\n';
      for (const conflict of conflicts) {
        outline += `- ${conflict}\n`;
      }
    }

    return outline;
  }

  private extractKeyPoints(content: string): string[] {
    const points: string[] = [];
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());

    for (const sentence of sentences) {
      const isKeyPoint =
        /[但是然而却突然终于]/.test(sentence) ||
        /[发现意识到明白]/.test(sentence) ||
        /[决定选择打算]/.test(sentence);

      if (isKeyPoint && sentence.length > 10 && sentence.length < 100) {
        points.push(sentence.trim());
      }
    }

    return points.slice(0, 5);
  }

  private extractConflicts(content: string): string[] {
    const conflicts: string[] = [];

    const conflictPatterns = [
      /([^。！？]+)与([^。！？]+)发生冲突/,
      /([^。！？]+)矛盾([^。！？]+)/,
      /([^。！？]+)争吵/,
      /([^。！？]+)对抗/,
    ];

    for (const pattern of conflictPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[0] && match[0].length < 100) {
          conflicts.push(match[0].trim());
        }
      }
    }

    return conflicts;
  }

  private async distillStyleGuide(content: string): Promise<string> {
    const analysis = this.analyzeStyle(content);

    let guide = '## 写作风格指南\n\n';

    guide += '### 句式特点\n';
    guide += `- 平均句长: ${analysis.sentenceLength.average.toFixed(1)} 字\n`;
    guide += `- 句长变化: ${analysis.sentenceLength.variance.toFixed(1)}\n`;
    guide += `- 句式多样性: ${(analysis.sentenceVariety * 100).toFixed(1)}%\n\n`;

    guide += '### 段落特点\n';
    guide += `- 平均段落长度: ${analysis.paragraphLength.average.toFixed(1)} 字\n`;
    guide += `- 段落长度变化: ${analysis.paragraphLength.variance.toFixed(1)}\n\n`;

    guide += '### 内容比例\n';
    guide += `- 对话比例: ${(analysis.dialogueRatio * 100).toFixed(1)}%\n`;
    guide += `- 描写比例: ${(analysis.descriptionRatio * 100).toFixed(1)}%\n\n`;

    guide += '### 词汇特点\n';
    guide += `- 词汇丰富度: ${(analysis.vocabularyRichness * 100).toFixed(1)}%\n`;
    guide += `- 比喻使用频率: ${(analysis.metaphorUsage * 100).toFixed(1)}%\n\n`;

    guide += '### 情感基调\n';
    guide += `- 主要基调: ${analysis.emotionalTone.primary}\n`;
    if (analysis.emotionalTone.secondary.length > 0) {
      guide += `- 次要基调: ${analysis.emotionalTone.secondary.join(', ')}\n`;
    }
    guide += `- 情感强度: ${analysis.emotionalTone.intensity.toFixed(2)}\n`;

    return guide;
  }

  private analyzeStyle(content: string): {
    sentenceLength: { average: number; variance: number; distribution: number[] };
    paragraphLength: { average: number; variance: number; distribution: number[] };
    dialogueRatio: number;
    descriptionRatio: number;
    vocabularyRichness: number;
    sentenceVariety: number;
    metaphorUsage: number;
    emotionalTone: { primary: string; secondary: string[]; intensity: number };
  } {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

    const sentenceLengths = sentences.map((s) => s.length);
    const avgSentenceLength =
      sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentences.length, 1);
    const sentenceVariance =
      sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0) /
      Math.max(sentences.length, 1);

    const paragraphLengths = paragraphs.map((p) => p.length);
    const avgParagraphLength =
      paragraphLengths.reduce((a, b) => a + b, 0) / Math.max(paragraphs.length, 1);
    const paragraphVariance =
      paragraphLengths.reduce((sum, len) => sum + Math.pow(len - avgParagraphLength, 2), 0) /
      Math.max(paragraphs.length, 1);

    const dialogue = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
    const dialogueLength = dialogue.reduce((sum, d) => sum + d.length, 0);
    const dialogueRatio = dialogueLength / Math.max(content.length, 1);

    const descriptions = content.match(/只见|看到|望去|身穿|四周|周围[^。！？]+/g) || [];
    const descriptionLength = descriptions.reduce((sum, d) => sum + d.length, 0);
    const descriptionRatio = descriptionLength / Math.max(content.length, 1);

    const words = content.match(/[\u4e00-\u9fa5]+/g) || [];
    const uniqueWords = new Set(words);
    const vocabularyRichness = uniqueWords.size / Math.max(words.length, 1);

    const structures = new Set(sentences.map((s) => s.length));
    const sentenceVariety = structures.size / Math.max(sentences.length, 1);

    const metaphors = content.match(/像|如同|仿佛|好似|宛如/g) || [];
    const metaphorUsage = metaphors.length / Math.max(content.length / 100, 1);

    const emotionalTone = this.analyzeEmotionalTone(content);

    return {
      sentenceLength: {
        average: avgSentenceLength,
        variance: sentenceVariance,
        distribution: sentenceLengths,
      },
      paragraphLength: {
        average: avgParagraphLength,
        variance: paragraphVariance,
        distribution: paragraphLengths,
      },
      dialogueRatio,
      descriptionRatio,
      vocabularyRichness,
      sentenceVariety,
      metaphorUsage,
      emotionalTone,
    };
  }

  private analyzeEmotionalTone(content: string): {
    primary: string;
    secondary: string[];
    intensity: number;
  } {
    const toneKeywords: Record<string, string[]> = {
      紧张: ['紧张', '焦虑', '不安', '担心', '恐惧'],
      温馨: ['温暖', '幸福', '感动', '甜蜜', '温馨'],
      悲伤: ['悲伤', '痛苦', '绝望', '失落', '哀伤'],
      激昂: ['激动', '兴奋', '热血', '振奋', '激昂'],
      平静: ['平静', '安宁', '淡然', '从容', '宁静'],
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
    const intensity = sortedTones.length > 0 ? sortedTones[0][1] / (content.length / 100) : 0;

    return { primary, secondary, intensity };
  }

  private async distillWorldbuilding(content: string): Promise<string> {
    const locations = this.extractLocations(content);
    const rules = this.extractWorldRules(content);
    const concepts = this.extractConcepts(content);

    let worldbuilding = '## 世界观设定\n\n';

    if (locations.length > 0) {
      worldbuilding += '### 地点\n';
      for (const loc of locations) {
        const locContext = this.getLocationContext(content, loc);
        worldbuilding += `- **${loc}**: ${locContext}\n`;
      }
      worldbuilding += '\n';
    }

    if (rules.length > 0) {
      worldbuilding += '### 规则/法则\n';
      for (const rule of rules) {
        worldbuilding += `- ${rule}\n`;
      }
      worldbuilding += '\n';
    }

    if (concepts.length > 0) {
      worldbuilding += '### 核心概念\n';
      for (const concept of concepts) {
        worldbuilding += `- ${concept}\n`;
      }
    }

    return worldbuilding;
  }

  private extractWorldRules(content: string): string[] {
    const rules: string[] = [];

    const rulePatterns = [
      /([^。！？]+)必须([^。！？]+)/g,
      /([^。！？]+)不能([^。！？]+)/g,
      /([^。！？]+)规则([^。！？]+)/g,
      /凡是([^。！？]+)/g,
    ];

    for (const pattern of rulePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[0] && match[0].length < 50 && match[0].length > 5) {
          rules.push(match[0].trim());
        }
      }
    }

    return [...new Set(rules)].slice(0, 10);
  }

  private extractConcepts(content: string): string[] {
    const concepts: string[] = [];

    const conceptPatterns = [
      /所谓([^，。！？]{2,10})/,
      /([^，。！？]{2,10})是指/,
      /([^，。！？]{2,10})的概念/,
    ];

    for (const pattern of conceptPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          concepts.push(match[1].trim());
        }
      }
    }

    return [...new Set(concepts)].slice(0, 10);
  }

  private getLocationContext(content: string, location: string): string {
    const pattern = new RegExp(`${location}[^。！？]{0,50}`, 'g');
    const matches = content.match(pattern);

    if (matches && matches.length > 0) {
      return matches[0].substring(location.length).trim().substring(0, 50);
    }

    return '暂无详细描述';
  }

  private async distillLessonLearned(
    content: string,
    quality?: QualityAssessment
  ): Promise<string> {
    let lesson = '## 经验教训\n\n';

    if (quality) {
      lesson += '### 质量评估总结\n';
      lesson += `- 总体评分: ${(quality.overallScore * 100).toFixed(1)}分\n`;

      const lowDimensions = quality.dimensions.filter((d) => d.score < 0.6);
      if (lowDimensions.length > 0) {
        lesson += `- 需改进维度: ${lowDimensions.map((d) => d.name).join(', ')}\n`;
      }

      lesson += '\n';
    }

    const issues = this.identifyCommonIssues(content);
    if (issues.length > 0) {
      lesson += '### 常见问题\n';
      for (const issue of issues) {
        lesson += `- ${issue}\n`;
      }
      lesson += '\n';
    }

    const improvements = this.suggestImprovements(content);
    if (improvements.length > 0) {
      lesson += '### 改进建议\n';
      for (const improvement of improvements) {
        lesson += `- ${improvement}\n`;
      }
    }

    return lesson;
  }

  private identifyCommonIssues(content: string): string[] {
    const issues: string[] = [];

    const dialogue = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
    const longDialogue = dialogue.filter((d) => d.length > 100);
    if (longDialogue.length > dialogue.length * 0.3) {
      issues.push('对话偏长，建议适当拆分');
    }

    const paragraphs = content.split(/\n\n+/);
    const longParagraphs = paragraphs.filter((p) => p.length > 300);
    if (longParagraphs.length > paragraphs.length * 0.3) {
      issues.push('段落偏长，建议适当分段');
    }

    const repeatedPhrases = this.findRepeatedPhrases(content);
    if (repeatedPhrases.length > 0) {
      issues.push(`存在重复表达: ${repeatedPhrases.slice(0, 3).join(', ')}`);
    }

    return issues;
  }

  private findRepeatedPhrases(content: string): string[] {
    const phrases: Map<string, number> = new Map();
    const fourCharPhrases = content.match(/[\u4e00-\u9fa5]{4,8}/g) || [];

    for (const phrase of fourCharPhrases) {
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }

    return Array.from(phrases.entries())
      .filter(([_, count]) => count > 2)
      .map(([phrase]) => phrase);
  }

  private suggestImprovements(content: string): string[] {
    const suggestions: string[] = [];

    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgLength < 15) {
      suggestions.push('句子偏短，可适当增加细节描写');
    } else if (avgLength > 50) {
      suggestions.push('句子偏长，可适当拆分以提高可读性');
    }

    const metaphorCount = (content.match(/像|如同|仿佛/g) || []).length;
    if (metaphorCount < content.length / 500) {
      suggestions.push('可适当增加比喻等修辞手法');
    }

    const emotionWords = content.match(/[喜怒哀乐悲恐惊]/g) || [];
    if (emotionWords.length < content.length / 300) {
      suggestions.push('可增加情感描写以增强感染力');
    }

    return suggestions;
  }

  private extractFromSummary(summary: string, _original: string): ExtractedKnowledge[] {
    const knowledge: ExtractedKnowledge[] = [];

    const charMatch = summary.match(/### 出场人物\n([\s\S]*?)(?=\n###|$)/);
    if (charMatch) {
      const characters = charMatch[1].match(/- (.+)/g) || [];
      for (const char of characters) {
        knowledge.push({
          type: 'character',
          content: char.replace('- ', ''),
          confidence: 0.9,
          source: 'chapter_summary',
        });
      }
    }

    const locMatch = summary.match(/### 场景地点\n([\s\S]*?)(?=\n###|$)/);
    if (locMatch) {
      const locations = locMatch[1].match(/- (.+)/g) || [];
      for (const loc of locations) {
        knowledge.push({
          type: 'location',
          content: loc.replace('- ', ''),
          confidence: 0.8,
          source: 'chapter_summary',
        });
      }
    }

    return knowledge;
  }

  private extractCharacterKnowledge(profile: string): ExtractedKnowledge[] {
    const knowledge: ExtractedKnowledge[] = [];

    const charMatches = profile.matchAll(/## (.+)\n\n### 特征\n([\s\S]*?)(?=\n##|\n---|$)/g);
    for (const match of charMatches) {
      knowledge.push({
        type: 'character_profile',
        content: `${match[1]}: ${match[2].replace(/\n/g, ' ')}`,
        confidence: 0.85,
        source: 'character_profile',
      });
    }

    return knowledge;
  }

  private extractPlotKnowledge(outline: string): ExtractedKnowledge[] {
    const knowledge: ExtractedKnowledge[] = [];

    const sceneMatches = outline.matchAll(/### (.+)\n([\s\S]*?)(?=\n###|\n##|$)/g);
    for (const match of sceneMatches) {
      knowledge.push({
        type: 'scene',
        content: `${match[1]}: ${match[2].replace(/\n/g, ' ').substring(0, 200)}`,
        confidence: 0.8,
        source: 'plot_outline',
      });
    }

    return knowledge;
  }

  private extractStyleKnowledge(guide: string): ExtractedKnowledge[] {
    return [
      {
        type: 'style_guide',
        content: guide,
        confidence: 0.9,
        source: 'style_analysis',
      },
    ];
  }

  private extractWorldKnowledge(worldbuilding: string): ExtractedKnowledge[] {
    const knowledge: ExtractedKnowledge[] = [];

    const locMatches = worldbuilding.matchAll(/- \*\*(.+?)\*\*: (.+)/g);
    for (const match of locMatches) {
      knowledge.push({
        type: 'location',
        content: `${match[1]}: ${match[2]}`,
        confidence: 0.85,
        source: 'worldbuilding',
      });
    }

    return knowledge;
  }

  private extractLessonKnowledge(lesson: string): ExtractedKnowledge[] {
    return [
      {
        type: 'lesson_learned',
        content: lesson,
        confidence: 0.9,
        source: 'quality_assessment',
      },
    ];
  }

  private async createBasicQuality(content: string): Promise<QualityAssessment> {
    return {
      id: generateId(),
      content: content.substring(0, 500),
      timestamp: Date.now(),
      overallScore: 0.7,
      dimensions: [],
      issues: [],
      suggestions: [],
    };
  }

  private async saveDistillationResult(result: DistillationResult): Promise<void> {
    const resultPath = `${this.projectPath}/.ai-workshop/distillation/${result.id}.json`;
    await workshopService.writeFile(resultPath, JSON.stringify(result, null, 2));
  }

  private async applyExtractedKnowledge(knowledge: ExtractedKnowledge[]): Promise<void> {
    for (const item of knowledge) {
      switch (item.type) {
        case 'character':
        case 'character_profile':
          await this.memoryService.addCharacterMemory({
            name: item.content.split(':')[0].trim(),
            aliases: [],
            role: 'supporting',
            description: item.content,
            traits: [],
            relationships: [],
            firstAppear: '蒸馏提取',
            lastMention: '蒸馏提取',
            arc: [],
          });
          break;
        case 'location':
          await this.memoryService.addWorldbuilding({
            category: 'location',
            name: item.content.split(':')[0].trim(),
            description: item.content,
            rules: [],
            connections: [],
          });
          break;
        case 'lesson_learned':
          await this.memoryService.addMemory('lesson_learned', item.content, {}, 0.7);
          break;
      }
    }
  }

  async getDistillationHistory(type?: DistillationType): Promise<DistillationResult[]> {
    const distillationPath = `${this.projectPath}/.ai-workshop/distillation`;

    if (!(await workshopService.pathExists(distillationPath))) {
      return [];
    }

    const files = await workshopService.readDirectory(distillationPath);
    const results: DistillationResult[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await workshopService.readFile(`${distillationPath}/${file.name}`);
          const result = JSON.parse(content);
          if (!type || result.type === type) {
            results.push(result);
          }
        } catch {
          continue;
        }
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export function createDistillationService(
  projectPath: string,
  memoryService: MemoryService,
  knowledgeService: KnowledgeService
): DistillationService {
  return new DistillationService(projectPath, memoryService, knowledgeService);
}
