import {
  CharacterBehavior,
  BehaviorRule,
  BehaviorViolation,
  BehaviorPattern,
  BehaviorAnalysis,
  BehaviorRecommendation,
  BehaviorCheckType,
  BehaviorSeverity,
  DEFAULT_BEHAVIOR_RULES,
} from '@/types/character/behaviorConsistency';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class BehaviorConsistencyService {
  private projectPath: string;
  private behaviors: Map<string, CharacterBehavior> = new Map();
  private rules: Map<string, BehaviorRule[]> = new Map();
  private violations: Map<string, BehaviorViolation> = new Map();
  private patterns: Map<string, BehaviorPattern[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/行为一致性`;

      const behaviorsContent = await workshopService.readFile(`${basePath}/行为记录.json`);
      if (behaviorsContent) {
        const data: CharacterBehavior[] = JSON.parse(behaviorsContent);
        this.behaviors = new Map(data.map((b) => [b.id, b]));
      }

      const rulesContent = await workshopService.readFile(`${basePath}/行为规则.json`);
      if (rulesContent) {
        const data: Record<string, BehaviorRule[]> = JSON.parse(rulesContent);
        for (const [charId, charRules] of Object.entries(data)) {
          this.rules.set(charId, charRules);
        }
      }

      const violationsContent = await workshopService.readFile(`${basePath}/违规记录.json`);
      if (violationsContent) {
        const data: BehaviorViolation[] = JSON.parse(violationsContent);
        this.violations = new Map(data.map((v) => [v.id, v]));
      }

      const patternsContent = await workshopService.readFile(`${basePath}/行为模式.json`);
      if (patternsContent) {
        const data: Record<string, BehaviorPattern[]> = JSON.parse(patternsContent);
        for (const [charId, charPatterns] of Object.entries(data)) {
          this.patterns.set(charId, charPatterns);
        }
      }
    } catch (error) {
      logger.error('加载行为数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/行为一致性`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/行为记录.json`,
        JSON.stringify(Array.from(this.behaviors.values()), null, 2)
      );

      const rulesObj: Record<string, BehaviorRule[]> = {};
      for (const [charId, charRules] of this.rules) {
        rulesObj[charId] = charRules;
      }
      await workshopService.writeFile(
        `${basePath}/行为规则.json`,
        JSON.stringify(rulesObj, null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/违规记录.json`,
        JSON.stringify(Array.from(this.violations.values()), null, 2)
      );

      const patternsObj: Record<string, BehaviorPattern[]> = {};
      for (const [charId, charPatterns] of this.patterns) {
        patternsObj[charId] = charPatterns;
      }
      await workshopService.writeFile(
        `${basePath}/行为模式.json`,
        JSON.stringify(patternsObj, null, 2)
      );
    } catch (error) {
      logger.error('保存行为数据失败', { error });
    }
  }

  async initializeCharacterRules(
    characterId: string,
    characterProfile: {
      name: string;
      personality: string[];
      values: string[];
      speechStyle: string;
      habits: string[];
    }
  ): Promise<BehaviorRule[]> {
    const rules: BehaviorRule[] = [];

    for (const defaultRule of DEFAULT_BEHAVIOR_RULES) {
      rules.push({
        id: `rule_${uuidv4()}`,
        characterId,
        ...defaultRule,
      });
    }

    if (characterProfile.personality && characterProfile.personality.length > 0) {
      rules.push({
        id: `rule_${uuidv4()}`,
        characterId,
        ruleType: 'personality_consistency',
        condition: {
          type: 'always',
          description: `角色应表现出: ${characterProfile.personality.join('、')}`,
          triggers: ['任何场景'],
        },
        expectedBehavior: {
          type: 'personality_traits',
          description: characterProfile.personality.join('、'),
          examples: [],
        },
        forbiddenBehavior: {
          type: 'opposite_traits',
          description: '与性格特征相反的行为',
          examples: [],
        },
        priority: 10,
        source: 'character_profile',
      });
    }

    if (characterProfile.speechStyle) {
      rules.push({
        id: `rule_${uuidv4()}`,
        characterId,
        ruleType: 'speech_pattern',
        condition: {
          type: 'always',
          description: `语言风格: ${characterProfile.speechStyle}`,
          triggers: ['对话场景'],
        },
        expectedBehavior: {
          type: 'speech_style',
          description: characterProfile.speechStyle,
          examples: [],
        },
        forbiddenBehavior: {
          type: 'different_style',
          description: '与设定不符的语言风格',
          examples: [],
        },
        priority: 8,
        source: 'character_profile',
      });
    }

    this.rules.set(characterId, rules);
    await this.saveToDisk();
    return rules;
  }

  recordBehavior(
    characterId: string,
    characterName: string,
    action: string,
    context: string,
    location: { chapter: number; paragraph?: number; excerpt: string },
    emotionalState?: string,
    motivation?: string
  ): CharacterBehavior {
    const behavior: CharacterBehavior = {
      id: `behavior_${uuidv4()}`,
      characterId,
      characterName,
      action,
      context,
      location,
      timestamp: Date.now(),
      emotionalState,
      motivation,
    };

    this.behaviors.set(behavior.id, behavior);
    this.saveToDisk();
    return behavior;
  }

  async checkBehavior(behaviorId: string): Promise<BehaviorViolation[]> {
    const behavior = this.behaviors.get(behaviorId);
    if (!behavior) {
      return [];
    }

    const violations: BehaviorViolation[] = [];
    const charRules = this.rules.get(behavior.characterId) || [];

    for (const rule of charRules) {
      const violation = await this.checkRule(behavior, rule);
      if (violation) {
        violations.push(violation);
        this.violations.set(violation.id, violation);
      }
    }

    await this.saveToDisk();
    return violations;
  }

  private async checkRule(
    behavior: CharacterBehavior,
    rule: BehaviorRule
  ): Promise<BehaviorViolation | null> {
    let isViolation = false;
    let deviation = '';

    switch (rule.ruleType) {
      case 'personality_consistency':
        isViolation = await this.checkPersonalityConsistency(behavior, rule);
        if (isViolation) {
          deviation = '行为与性格设定不一致';
        }
        break;

      case 'speech_pattern':
        isViolation = await this.checkSpeechPattern(behavior, rule);
        if (isViolation) {
          deviation = '语言风格与设定不符';
        }
        break;

      case 'emotional_appropriateness':
        isViolation = await this.checkEmotionalAppropriateness(behavior, rule);
        if (isViolation) {
          deviation = '情感反应与情境不匹配';
        }
        break;

      case 'decision_rationality':
        isViolation = await this.checkDecisionRationality(behavior, rule);
        if (isViolation) {
          deviation = '决策缺乏合理动机';
        }
        break;

      default:
        break;
    }

    if (!isViolation) {
      return null;
    }

    const precedingBehaviors = this.getPrecedingBehaviors(
      behavior.characterId,
      behavior.location.chapter,
      3
    );

    return {
      id: `violation_${uuidv4()}`,
      checkType: rule.ruleType,
      severity: rule.priority >= 9 ? 'critical' : rule.priority >= 7 ? 'major' : 'minor',
      status: 'detected',
      characterId: behavior.characterId,
      characterName: behavior.characterName,
      behavior,
      rule,
      violation: {
        expected: rule.expectedBehavior.description,
        actual: behavior.action,
        deviation,
      },
      context: {
        precedingBehaviors,
        emotionalContext: behavior.emotionalState || '',
        situationalFactors: [],
      },
      explanation: `${behavior.characterName}的行为"${behavior.action}"违反了规则: ${rule.condition.description}`,
      suggestedFix: this.generateFixSuggestion(behavior, rule),
      detectedAt: Date.now(),
    };
  }

  private async checkPersonalityConsistency(
    behavior: CharacterBehavior,
    rule: BehaviorRule
  ): Promise<boolean> {
    const expectedTraits = rule.expectedBehavior.description.split('、');

    const prompt = `分析以下角色行为是否符合性格特征：

角色性格: ${expectedTraits.join('、')}
行为描述: ${behavior.action}
情境: ${behavior.context}

请判断行为是否与性格一致，只返回 true 或 false。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 10,
      });

      return response.content.trim().toLowerCase() === 'false';
    } catch {
      return false;
    }
  }

  private async checkSpeechPattern(
    behavior: CharacterBehavior,
    rule: BehaviorRule
  ): Promise<boolean> {
    const expectedStyle = rule.expectedBehavior.description;

    const dialogueMatch = behavior.action.match(/["「『][^"」』]+["」』]/);
    if (!dialogueMatch) {
      return false;
    }

    const prompt = `分析以下对话是否符合角色的语言风格：

角色语言风格: ${expectedStyle}
对话内容: ${dialogueMatch[0]}

请判断对话风格是否一致，只返回 true 或 false。`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 10,
      });

      return response.content.trim().toLowerCase() === 'false';
    } catch {
      return false;
    }
  }

  private async checkEmotionalAppropriateness(
    _behavior: CharacterBehavior,
    _rule: BehaviorRule
  ): Promise<boolean> {
    return false;
  }

  private async checkDecisionRationality(
    behavior: CharacterBehavior,
    _rule: BehaviorRule
  ): Promise<boolean> {
    if (behavior.motivation) {
      return false;
    }

    const importantActions = ['决定', '选择', '放弃', '接受', '拒绝'];
    const hasImportantAction = importantActions.some((a) => behavior.action.includes(a));

    return hasImportantAction;
  }

  private getPrecedingBehaviors(
    characterId: string,
    chapter: number,
    count: number
  ): CharacterBehavior[] {
    return Array.from(this.behaviors.values())
      .filter((b) => b.characterId === characterId && b.location.chapter <= chapter)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  private generateFixSuggestion(behavior: CharacterBehavior, rule: BehaviorRule): string {
    const suggestions: Record<BehaviorCheckType, string> = {
      personality_consistency: `建议修改行为以符合${behavior.characterName}的性格设定: ${rule.expectedBehavior.description}`,
      speech_pattern: `建议调整对话风格以符合${behavior.characterName}的语言特点`,
      emotional_appropriateness: '建议调整情感反应的强度或类型',
      decision_rationality: '建议为决策添加合理的动机说明',
      value_alignment: '建议调整行为以符合角色的价值观',
      motivation_logic: '建议补充行为背后的动机',
      social_behavior: '建议调整社交行为以符合角色身份',
      habit_consistency: '建议保持角色习惯的一致性',
    };

    return suggestions[rule.ruleType] || '建议检查行为一致性';
  }

  async analyzeCharacter(characterId: string): Promise<BehaviorAnalysis> {
    const charBehaviors = Array.from(this.behaviors.values()).filter(
      (b) => b.characterId === characterId
    );

    const charViolations = Array.from(this.violations.values()).filter(
      (v) => v.characterId === characterId
    );

    const charPatterns = this.patterns.get(characterId) || [];

    const consistencyScore = this.calculateConsistencyScore(charBehaviors, charViolations);

    const personalityAlignment = await this.analyzePersonalityAlignment(characterId, charBehaviors);

    const recommendations = this.generateRecommendations(charViolations, charPatterns);

    return {
      characterId,
      characterName: charBehaviors[0]?.characterName || '未知角色',
      totalBehaviors: charBehaviors.length,
      violations: charViolations,
      patterns: charPatterns,
      consistencyScore,
      personalityAlignment,
      recommendations,
    };
  }

  private calculateConsistencyScore(
    behaviors: CharacterBehavior[],
    violations: BehaviorViolation[]
  ): number {
    if (behaviors.length === 0) {
      return 100;
    }

    const criticalCount = violations.filter((v) => v.severity === 'critical').length;
    const majorCount = violations.filter((v) => v.severity === 'major').length;
    const minorCount = violations.filter((v) => v.severity === 'minor').length;

    const penalty = criticalCount * 20 + majorCount * 10 + minorCount * 3;

    return Math.max(0, 100 - penalty);
  }

  private async analyzePersonalityAlignment(
    characterId: string,
    _behaviors: CharacterBehavior[]
  ): Promise<Array<{ trait: string; expected: string; observed: string; alignment: number }>> {
    const rules = this.rules.get(characterId) || [];
    const personalityRule = rules.find((r) => r.ruleType === 'personality_consistency');

    if (!personalityRule) {
      return [];
    }

    const traits = personalityRule.expectedBehavior.description.split('、');

    return traits.map((trait) => ({
      trait,
      expected: `表现出${trait}`,
      observed: '需要分析',
      alignment: 0.7,
    }));
  }

  private generateRecommendations(
    violations: BehaviorViolation[],
    _patterns: BehaviorPattern[]
  ): BehaviorRecommendation[] {
    const recommendations: BehaviorRecommendation[] = [];

    const criticalViolations = violations.filter((v) => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'fix_violation',
        priority: 'high',
        description: `修复 ${criticalViolations.length} 个严重行为不一致问题`,
        reason: '严重不一致会破坏角色可信度',
        affectedBehaviors: criticalViolations.map((v) => v.behavior.id),
        suggestedActions: criticalViolations.map((v) => v.suggestedFix),
        expectedImprovement: '提升角色一致性评分',
      });
    }

    return recommendations;
  }

  async detectPatterns(characterId: string): Promise<BehaviorPattern[]> {
    const behaviors = Array.from(this.behaviors.values()).filter(
      (b) => b.characterId === characterId
    );

    if (behaviors.length < 5) {
      return [];
    }

    const patterns: BehaviorPattern[] = [];

    const actionCounts = new Map<string, number>();
    for (const behavior of behaviors) {
      const keyWords = behavior.action.split(/[，。！？]/).filter((w) => w.length > 2);
      for (const word of keyWords) {
        actionCounts.set(word, (actionCounts.get(word) || 0) + 1);
      }
    }

    for (const [action, count] of actionCounts) {
      if (count >= 3) {
        const matchingBehaviors = behaviors.filter((b) => b.action.includes(action));

        patterns.push({
          id: `pattern_${uuidv4()}`,
          characterId,
          characterName: behaviors[0].characterName,
          patternType: 'habit',
          description: `经常${action}`,
          frequency: count,
          triggers: matchingBehaviors.map((b) => b.context).slice(0, 3),
          responses: [action],
          consistency: count / behaviors.length,
          examples: matchingBehaviors.slice(0, 3).map((b) => ({
            location: `第${b.location.chapter}章`,
            behavior: b.action,
          })),
          firstObserved: matchingBehaviors[0].timestamp,
          lastObserved: matchingBehaviors[matchingBehaviors.length - 1].timestamp,
        });
      }
    }

    this.patterns.set(characterId, patterns);
    await this.saveToDisk();
    return patterns;
  }

  resolveViolation(violationId: string, resolution: string): boolean {
    const violation = this.violations.get(violationId);
    if (!violation) {
      return false;
    }

    violation.status = 'resolved';
    violation.resolution = resolution;
    violation.resolvedAt = Date.now();

    this.saveToDisk();
    return true;
  }

  markFalsePositive(violationId: string): boolean {
    const violation = this.violations.get(violationId);
    if (!violation) {
      return false;
    }

    violation.status = 'false_positive';
    this.saveToDisk();
    return true;
  }

  getBehavior(id: string): CharacterBehavior | undefined {
    return this.behaviors.get(id);
  }

  getBehaviorsByCharacter(characterId: string): CharacterBehavior[] {
    return Array.from(this.behaviors.values()).filter((b) => b.characterId === characterId);
  }

  getViolation(id: string): BehaviorViolation | undefined {
    return this.violations.get(id);
  }

  getViolationsByCharacter(characterId: string): BehaviorViolation[] {
    return Array.from(this.violations.values()).filter((v) => v.characterId === characterId);
  }

  getUnresolvedViolations(): BehaviorViolation[] {
    return Array.from(this.violations.values()).filter((v) => v.status === 'detected');
  }

  getStats(): {
    totalBehaviors: number;
    totalViolations: number;
    unresolvedViolations: number;
    byCheckType: Record<BehaviorCheckType, number>;
    bySeverity: Record<BehaviorSeverity, number>;
  } {
    const violations = Array.from(this.violations.values());

    const byCheckType: Record<BehaviorCheckType, number> = {
      personality_consistency: 0,
      value_alignment: 0,
      motivation_logic: 0,
      emotional_appropriateness: 0,
      social_behavior: 0,
      decision_rationality: 0,
      speech_pattern: 0,
      habit_consistency: 0,
    };

    const bySeverity: Record<BehaviorSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      suggestion: 0,
    };

    for (const v of violations) {
      byCheckType[v.checkType]++;
      bySeverity[v.severity]++;
    }

    return {
      totalBehaviors: this.behaviors.size,
      totalViolations: violations.length,
      unresolvedViolations: violations.filter((v) => v.status === 'detected').length,
      byCheckType,
      bySeverity,
    };
  }
}

export function createBehaviorConsistencyService(projectPath: string): BehaviorConsistencyService {
  return new BehaviorConsistencyService(projectPath);
}
