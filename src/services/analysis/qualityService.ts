import { workshopService } from '../core/workshopService';
import {
  QualityCheckResult,
  QualityDimension,
  QualityIssue,
  IssueType,
  AssessmentContext,
  DIMENSION_CONFIG,
  ISSUE_TYPE_CONFIG,
} from '@/types/writing/quality';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class QualityService {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async assessContent(
    content: string,
    context: AssessmentContext = { characters: [] }
  ): Promise<QualityCheckResult> {
    const dimensions = await this.assessDimensions(content, context);
    const issues = await this.detectIssues(content, context);
    const suggestions = this.generateSuggestions(issues);

    const overallScore = this.calculateOverallScore(dimensions);

    const assessment: QualityCheckResult = {
      id: generateId(),
      content: content.substring(0, 500),
      timestamp: Date.now(),
      overallScore,
      dimensions,
      issues,
      suggestions,
    };

    await this.saveAssessment(assessment);
    return assessment;
  }

  private async assessDimensions(
    content: string,
    context: AssessmentContext
  ): Promise<QualityDimension[]> {
    const dimensions: QualityDimension[] = [];

    dimensions.push(this.assessCoherence(content, context));
    dimensions.push(this.assessCreativity(content, context));
    dimensions.push(this.assessCharacterConsistency(content, context));
    dimensions.push(this.assessPlotLogic(content, context));
    dimensions.push(this.assessLanguageQuality(content, context));
    dimensions.push(this.assessPacing(content, context));
    dimensions.push(this.assessDialogue(content, context));
    dimensions.push(this.assessDescription(content, context));
    dimensions.push(this.assessEmotionalImpact(content, context));
    dimensions.push(this.assessOriginality(content, context));

    return dimensions;
  }

  private assessCoherence(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.coherence;
    let score = 0.7;

    const paragraphs = content.split(/\n\n+/);
    const transitionWords = ['然而', '但是', '因此', '于是', '接着', '随后', '此时', '这时'];
    let transitionCount = 0;

    for (const word of transitionWords) {
      const regex = new RegExp(word, 'g');
      transitionCount += (content.match(regex) || []).length;
    }

    const transitionDensity = transitionCount / Math.max(paragraphs.length, 1);
    if (transitionDensity > 0.3 && transitionDensity < 0.8) {
      score += 0.1;
    } else if (transitionDensity < 0.1) {
      score -= 0.1;
    }

    const sentences = content.split(/[。！？\n]+/).filter((s) => s.trim());
    let coherentSentences = 0;
    for (let i = 1; i < sentences.length; i++) {
      const prev = sentences[i - 1];
      const curr = sentences[i];
      if (this.hasSemanticConnection(prev, curr)) {
        coherentSentences++;
      }
    }
    const coherenceRatio = sentences.length > 1 ? coherentSentences / (sentences.length - 1) : 1;
    score = score * 0.5 + coherenceRatio * 0.5;

    return {
      name: 'coherence',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `过渡词密度: ${transitionDensity.toFixed(2)}, 句子连贯率: ${(coherenceRatio * 100).toFixed(1)}%`,
    };
  }

  private hasSemanticConnection(prev: string, curr: string): boolean {
    const prevWords = this.extractKeywords(prev);
    const currWords = this.extractKeywords(curr);

    for (const word of prevWords) {
      if (currWords.includes(word)) {
        return true;
      }
    }

    return false;
  }

  private extractKeywords(text: string): string[] {
    const words = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    return [...new Set(words)];
  }

  private assessCreativity(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.creativity;
    let score = 0.5;

    const metaphors = content.match(/像|如同|仿佛|好似|宛如/g) || [];
    const metaphorDensity = metaphors.length / (content.length / 100);
    score += Math.min(0.2, metaphorDensity * 0.05);

    const uniqueWords = new Set(content.match(/[\u4e00-\u9fa5]+/g) || []);
    const totalWords = (content.match(/[\u4e00-\u9fa5]+/g) || []).length;
    const vocabularyRichness = uniqueWords.size / Math.max(totalWords, 1);
    score += vocabularyRichness * 0.3;

    const sentenceStructures = this.analyzeSentenceStructures(content);
    const structureVariety = sentenceStructures.size / 10;
    score += Math.min(0.2, structureVariety * 0.02);

    return {
      name: 'creativity',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `比喻密度: ${metaphorDensity.toFixed(2)}, 词汇丰富度: ${(vocabularyRichness * 100).toFixed(1)}%`,
    };
  }

  private analyzeSentenceStructures(content: string): Set<string> {
    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const structures = new Set<string>();

    for (const sentence of sentences) {
      const structure = sentence
        .replace(/[\u4e00-\u9fa5]+/g, 'N')
        .replace(/[a-zA-Z]+/g, 'W')
        .replace(/\d+/g, 'D');
      structures.add(structure.substring(0, 20));
    }

    return structures;
  }

  private assessCharacterConsistency(
    content: string,
    context: AssessmentContext
  ): QualityDimension {
    const config = DIMENSION_CONFIG.character_consistency;
    let score = 0.8;

    if (context.projectMemory?.characters) {
      for (const char of context.projectMemory.characters) {
        const charPattern = new RegExp(char.name, 'g');
        const mentions = content.match(charPattern) || [];

        if (mentions.length > 0) {
          for (const trait of char.traits) {
            const traitPattern = new RegExp(trait, 'g');
            if (!content.match(traitPattern)) {
              score -= 0.05;
            }
          }
        }
      }
    }

    return {
      name: 'character_consistency',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `已检查 ${context.projectMemory?.characters?.length || 0} 个角色的一致性`,
    };
  }

  private assessPlotLogic(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.plot_logic;
    let score = 0.75;

    const causeEffectPatterns = [/因为.*所以/, /由于.*导致/, /为了.*于是/, /既然.*就/];

    let patternCount = 0;
    for (const pattern of causeEffectPatterns) {
      patternCount += (content.match(pattern) || []).length;
    }

    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const logicDensity = patternCount / Math.max(sentences.length, 1);

    if (logicDensity > 0.1 && logicDensity < 0.3) {
      score += 0.1;
    } else if (logicDensity > 0.5) {
      score -= 0.1;
    }

    return {
      name: 'plot_logic',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `因果逻辑密度: ${(logicDensity * 100).toFixed(1)}%`,
    };
  }

  private assessLanguageQuality(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.language_quality;
    let score = 0.7;

    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const avgLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / Math.max(sentences.length, 1);

    if (avgLength > 10 && avgLength < 50) {
      score += 0.1;
    } else if (avgLength > 80) {
      score -= 0.1;
    }

    const repeatedChars = content.match(/(.)\1{3,}/g) || [];
    score -= repeatedChars.length * 0.05;

    const punctuationIssues = content.match(/[，。]{2,}/g) || [];
    score -= punctuationIssues.length * 0.03;

    return {
      name: 'language_quality',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `平均句长: ${avgLength.toFixed(1)}, 标点问题: ${punctuationIssues.length}`,
    };
  }

  private assessPacing(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.pacing;
    let score = 0.7;

    const paragraphs = content.split(/\n\n+/);
    const paragraphLengths = paragraphs.map((p) => p.length);
    const avgLength = paragraphLengths.reduce((a, b) => a + b, 0) / Math.max(paragraphs.length, 1);

    const variance =
      paragraphLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      Math.max(paragraphs.length, 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev > 50 && stdDev < 200) {
      score += 0.15;
    } else if (stdDev < 20) {
      score -= 0.1;
    }

    const dialogueRatio = this.calculateDialogueRatio(content);
    if (dialogueRatio > 0.2 && dialogueRatio < 0.6) {
      score += 0.1;
    }

    return {
      name: 'pacing',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `段落长度标准差: ${stdDev.toFixed(1)}, 对话比例: ${(dialogueRatio * 100).toFixed(1)}%`,
    };
  }

  private calculateDialogueRatio(content: string): number {
    const dialogue = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
    const dialogueLength = dialogue.reduce((sum, d) => sum + d.length, 0);
    return dialogueLength / Math.max(content.length, 1);
  }

  private assessDialogue(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.dialogue;

    const dialogues = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];

    if (dialogues.length === 0) {
      return {
        name: 'dialogue',
        score: 0.5,
        weight: config.defaultWeight,
        details: '未检测到对话内容',
      };
    }

    let naturalDialogueCount = 0;
    for (const dialogue of dialogues) {
      const inner = dialogue.slice(1, -1);

      if (inner.length < 50 && inner.length > 2) {
        naturalDialogueCount++;
      }

      const hasEmotion = /[！？啊呀吧嘛]/.test(inner);
      if (hasEmotion) {
        naturalDialogueCount++;
      }
    }

    const score = (naturalDialogueCount / (dialogues.length * 2)) * 0.5 + 0.5;

    return {
      name: 'dialogue',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `对话数量: ${dialogues.length}, 自然度评分: ${(score * 100).toFixed(1)}%`,
    };
  }

  private assessDescription(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.description;
    let score = 0.65;

    const descriptionPatterns = [
      /只见|看到|望去|映入眼帘/,
      /身穿|身披|一身/,
      /四周|周围|眼前/,
      /声音|气息|味道/,
    ];

    let descriptionCount = 0;
    for (const pattern of descriptionPatterns) {
      descriptionCount += (content.match(pattern) || []).length;
    }

    const descriptionDensity = descriptionCount / (content.length / 100);
    if (descriptionDensity > 0.5 && descriptionDensity < 2) {
      score += 0.2;
    } else if (descriptionDensity < 0.2) {
      score -= 0.1;
    }

    const adjectives = content.match(/的[\u4e00-\u9fa5]{2,4}/g) || [];
    const adjectiveRatio = adjectives.length / Math.max(content.length / 100, 1);
    if (adjectiveRatio > 1 && adjectiveRatio < 5) {
      score += 0.1;
    }

    return {
      name: 'description',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `描写密度: ${descriptionDensity.toFixed(2)}, 形容词比例: ${adjectiveRatio.toFixed(2)}`,
    };
  }

  private assessEmotionalImpact(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.emotional_impact;
    let score = 0.6;

    const emotionalWords = {
      positive: ['高兴', '快乐', '幸福', '温暖', '感动', '欣慰'],
      negative: ['悲伤', '痛苦', '绝望', '愤怒', '恐惧', '孤独'],
      intense: ['震惊', '惊讶', '激动', '狂喜', '崩溃'],
    };

    let emotionalCount = 0;
    for (const category of Object.values(emotionalWords)) {
      for (const word of category) {
        const regex = new RegExp(word, 'g');
        emotionalCount += (content.match(regex) || []).length;
      }
    }

    const emotionalDensity = emotionalCount / (content.length / 100);
    if (emotionalDensity > 0.3 && emotionalDensity < 1.5) {
      score += 0.25;
    }

    const exclamations = (content.match(/！/g) || []).length;
    const exclamationRatio = exclamations / (content.length / 100);
    if (exclamationRatio > 0.5 && exclamationRatio < 3) {
      score += 0.1;
    }

    return {
      name: 'emotional_impact',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `情感词密度: ${emotionalDensity.toFixed(2)}, 感叹号比例: ${exclamationRatio.toFixed(2)}`,
    };
  }

  private assessOriginality(content: string, _context: AssessmentContext): QualityDimension {
    const config = DIMENSION_CONFIG.originality;
    let score = 0.6;

    const cliches = ['此时此刻', '恍然大悟', '不可思议', '难以置信', '众所周知', '不言而喻'];

    let clicheCount = 0;
    for (const cliche of cliches) {
      if (content.includes(cliche)) {
        clicheCount++;
      }
    }
    score -= clicheCount * 0.05;

    const uniquePhrases = this.extractUniquePhrases(content);
    score += Math.min(0.3, uniquePhrases.length * 0.03);

    return {
      name: 'originality',
      score: Math.min(1, Math.max(0, score)),
      weight: config.defaultWeight,
      details: `陈词滥调: ${clicheCount}, 独特表达: ${uniquePhrases.length}`,
    };
  }

  private extractUniquePhrases(content: string): string[] {
    const phrases: string[] = [];
    const fourCharPhrases = content.match(/[\u4e00-\u9fa5]{4}/g) || [];

    const commonPhrases = new Set(['这个时候', '那个地方', '这个人说', '那个人说']);

    for (const phrase of fourCharPhrases) {
      if (!commonPhrases.has(phrase)) {
        const count = (content.match(new RegExp(phrase, 'g')) || []).length;
        if (count === 1) {
          phrases.push(phrase);
        }
      }
    }

    return [...new Set(phrases)].slice(0, 20);
  }

  private async detectIssues(content: string, context: AssessmentContext): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    issues.push(...this.detectPlotHoles(content, context));
    issues.push(...this.detectCharacterInconsistencies(content, context));
    issues.push(...this.detectTimelineErrors(content, context));
    issues.push(...this.detectDialogueIssues(content, context));
    issues.push(...this.detectRedundantDescriptions(content, context));
    issues.push(...this.detectGrammarIssues(content, context));

    return issues;
  }

  private detectPlotHoles(content: string, _context: AssessmentContext): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const unresolvedPatterns = [
      { pattern: /突然.*却再也没有/, type: 'plot_hole' as IssueType },
      { pattern: /不知为何.*就这样/, type: 'plot_hole' as IssueType },
    ];

    for (const { pattern, type } of unresolvedPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          issues.push({
            type,
            severity: ISSUE_TYPE_CONFIG[type].defaultSeverity,
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: match[0],
            },
            description: '可能存在情节漏洞或未解释的转折',
            suggestion: '考虑补充情节转折的原因或背景',
          });
        }
      }
    }

    return issues;
  }

  private detectCharacterInconsistencies(
    content: string,
    context: AssessmentContext
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (context.projectMemory?.characters) {
      for (const char of context.projectMemory.characters) {
        const namePattern = new RegExp(`${char.name}[^。！？]{0,50}(说|道|想)`, 'g');
        const matches = content.matchAll(namePattern);

        for (const match of matches) {
          const speech = match[0];
          for (const trait of char.traits) {
            const oppositeTraits: Record<string, string[]> = {
              冷静: ['激动', '愤怒', '大喊'],
              温柔: ['冷酷', '无情', '凶狠'],
              勇敢: ['害怕', '恐惧', '退缩'],
            };

            if (oppositeTraits[trait]) {
              for (const opposite of oppositeTraits[trait]) {
                if (speech.includes(opposite)) {
                  issues.push({
                    type: 'character_inconsistency',
                    severity: 'medium',
                    location: {
                      start: match.index || 0,
                      end: (match.index || 0) + speech.length,
                      context: speech,
                    },
                    description: `${char.name}的行为可能与"${trait}"特质不符`,
                    suggestion: `检查${char.name}的行为是否符合其"${trait}"的人设`,
                  });
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  private detectTimelineErrors(content: string, _context: AssessmentContext): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const timePatterns = [/昨天.*今天/, /前天.*昨天/, /上午.*下午.*上午/];

    for (const pattern of timePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          issues.push({
            type: 'timeline_error',
            severity: 'medium',
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: match[0],
            },
            description: '可能存在时间线矛盾',
            suggestion: '检查时间顺序是否正确',
          });
        }
      }
    }

    return issues;
  }

  private detectDialogueIssues(content: string, _context: AssessmentContext): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const dialogues = content.matchAll(/[""「」『』]([^""「」『』]+)[""「」『』]/g);

    for (const match of dialogues) {
      const dialogue = match[1];

      if (dialogue.length > 100) {
        issues.push({
          type: 'dialogue_unnatural',
          severity: 'low',
          location: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
            context: match[0],
          },
          description: '对话过长，可能不够自然',
          suggestion: '考虑将长对话拆分或加入动作描写',
        });
      }

      const formalWords = ['因此', '然而', '综上所述', '由此可见'];
      for (const word of formalWords) {
        if (dialogue.includes(word)) {
          issues.push({
            type: 'dialogue_unnatural',
            severity: 'low',
            location: {
              start: match.index || 0,
              end: (match.index || 0) + match[0].length,
              context: match[0],
            },
            description: `对话中使用了书面语"${word}"`,
            suggestion: '口语对话应更口语化',
          });
        }
      }
    }

    return issues;
  }

  private detectRedundantDescriptions(
    content: string,
    _context: AssessmentContext
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const sentences = content.split(/[。！？]+/).filter((s) => s.trim());
    const seen = new Map<string, number>();

    for (let i = 0; i < sentences.length; i++) {
      const normalized = sentences[i].trim().replace(/\s+/g, '');
      if (normalized.length > 10) {
        if (seen.has(normalized)) {
          issues.push({
            type: 'description_redundant',
            severity: 'low',
            location: {
              start: 0,
              end: sentences[i].length,
              context: sentences[i],
            },
            description: '与之前的描写重复',
            suggestion: '删除重复描写或换一种表达方式',
          });
        } else {
          seen.set(normalized, i);
        }
      }
    }

    return issues;
  }

  private detectGrammarIssues(content: string, _context: AssessmentContext): QualityIssue[] {
    const issues: QualityIssue[] = [];

    const grammarPatterns = [
      { pattern: /的的了/g, desc: '重复使用"的"' },
      { pattern: /了了/g, desc: '重复使用"了"' },
      { pattern: /地地/g, desc: '重复使用"地"' },
      { pattern: /得得/g, desc: '重复使用"得"' },
    ];

    for (const { pattern, desc } of grammarPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          issues.push({
            type: 'grammar_error',
            severity: 'low',
            location: {
              start: match.index,
              end: match.index + match[0].length,
              context: match[0],
            },
            description: desc,
            suggestion: '修正语法错误',
          });
        }
      }
    }

    return issues;
  }

  private generateSuggestions(issues: QualityIssue[]): string[] {
    const suggestions: string[] = [];
    const suggestionSet = new Set<string>();

    for (const issue of issues) {
      if (!suggestionSet.has(issue.suggestion)) {
        suggestions.push(issue.suggestion);
        suggestionSet.add(issue.suggestion);
      }
    }

    const highSeverity = issues.filter((i) => i.severity === 'high');
    if (highSeverity.length > 0) {
      suggestions.unshift(`发现 ${highSeverity.length} 个高优先级问题需要优先处理`);
    }

    return suggestions.slice(0, 10);
  }

  private calculateOverallScore(dimensions: QualityDimension[]): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const dimension of dimensions) {
      totalWeight += dimension.weight;
      weightedScore += dimension.score * dimension.weight;
    }

    return weightedScore / Math.max(totalWeight, 1);
  }

  private async saveAssessment(assessment: QualityCheckResult): Promise<void> {
    const assessmentPath = `${this.projectPath}/.ai-workshop/quality/assessments/${assessment.id}.json`;
    await workshopService.writeFile(assessmentPath, JSON.stringify(assessment, null, 2));
  }

  async loadAssessment(assessmentId: string): Promise<QualityCheckResult | null> {
    const assessmentPath = `${this.projectPath}/.ai-workshop/quality/assessments/${assessmentId}.json`;

    if (await workshopService.pathExists(assessmentPath)) {
      const content = await workshopService.readFile(assessmentPath);
      return JSON.parse(content);
    }

    return null;
  }

  async getAssessmentHistory(limit: number = 20): Promise<QualityCheckResult[]> {
    const assessmentsPath = `${this.projectPath}/.ai-workshop/quality/assessments`;

    if (!(await workshopService.pathExists(assessmentsPath))) {
      return [];
    }

    const files = await workshopService.readDirectory(assessmentsPath);
    const assessments: QualityCheckResult[] = [];

    for (const file of files.slice(0, limit)) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await workshopService.readFile(`${assessmentsPath}/${file.name}`);
          assessments.push(JSON.parse(content));
        } catch {
          continue;
        }
      }
    }

    return assessments.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export function createQualityService(projectPath: string): QualityService {
  return new QualityService(projectPath);
}
