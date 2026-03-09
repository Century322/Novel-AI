export type BehaviorCheckType =
  | 'personality_consistency'
  | 'value_alignment'
  | 'motivation_logic'
  | 'emotional_appropriateness'
  | 'social_behavior'
  | 'decision_rationality'
  | 'speech_pattern'
  | 'habit_consistency';

export type BehaviorSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export type BehaviorStatus = 'detected' | 'confirmed' | 'false_positive' | 'resolved';

export interface CharacterBehavior {
  id: string;
  characterId: string;
  characterName: string;

  action: string;
  context: string;
  location: {
    chapter: number;
    paragraph?: number;
    excerpt: string;
  };

  timestamp: number;
  emotionalState?: string;
  motivation?: string;
}

export interface BehaviorRule {
  id: string;
  characterId: string;
  ruleType: BehaviorCheckType;

  condition: {
    type: 'always' | 'context' | 'emotional' | 'relational';
    description: string;
    triggers: string[];
  };

  expectedBehavior: {
    type: string;
    description: string;
    examples: string[];
  };

  forbiddenBehavior: {
    type: string;
    description: string;
    examples: string[];
  };

  priority: number;
  source: 'character_profile' | 'user_defined' | 'learned';
}

export interface BehaviorViolation {
  id: string;
  checkType: BehaviorCheckType;
  severity: BehaviorSeverity;
  status: BehaviorStatus;

  characterId: string;
  characterName: string;

  behavior: CharacterBehavior;
  rule: BehaviorRule;

  violation: {
    expected: string;
    actual: string;
    deviation: string;
  };

  context: {
    precedingBehaviors: CharacterBehavior[];
    emotionalContext: string;
    situationalFactors: string[];
  };

  explanation: string;
  suggestedFix: string;

  detectedAt: number;
  resolvedAt?: number;
  resolution?: string;
}

export interface BehaviorPattern {
  id: string;
  characterId: string;
  characterName: string;

  patternType: 'habit' | 'preference' | 'avoidance' | 'reaction';

  description: string;
  frequency: number;

  triggers: string[];
  responses: string[];

  consistency: number;

  examples: Array<{
    location: string;
    behavior: string;
  }>;

  firstObserved: number;
  lastObserved: number;
}

export interface BehaviorAnalysis {
  characterId: string;
  characterName: string;

  totalBehaviors: number;
  violations: BehaviorViolation[];
  patterns: BehaviorPattern[];

  consistencyScore: number;

  personalityAlignment: {
    trait: string;
    expected: string;
    observed: string;
    alignment: number;
  }[];

  recommendations: BehaviorRecommendation[];
}

export interface BehaviorRecommendation {
  id: string;
  type: 'fix_violation' | 'establish_pattern' | 'adjust_profile' | 'add_context';
  priority: 'high' | 'medium' | 'low';

  description: string;
  reason: string;

  affectedBehaviors: string[];
  suggestedActions: string[];

  expectedImprovement: string;
}

export const BEHAVIOR_CHECK_LABELS: Record<BehaviorCheckType, string> = {
  personality_consistency: '性格一致性',
  value_alignment: '价值观对齐',
  motivation_logic: '动机逻辑',
  emotional_appropriateness: '情感适当性',
  social_behavior: '社交行为',
  decision_rationality: '决策合理性',
  speech_pattern: '语言模式',
  habit_consistency: '习惯一致性',
};

export const BEHAVIOR_SEVERITY_LABELS: Record<BehaviorSeverity, string> = {
  critical: '严重',
  major: '重要',
  minor: '轻微',
  suggestion: '建议',
};

export const DEFAULT_BEHAVIOR_RULES: Array<Omit<BehaviorRule, 'id' | 'characterId'>> = [
  {
    ruleType: 'personality_consistency',
    condition: {
      type: 'always',
      description: '角色行为应符合其核心性格特征',
      triggers: ['任何场景'],
    },
    expectedBehavior: {
      type: 'consistent',
      description: '行为与性格设定一致',
      examples: [],
    },
    forbiddenBehavior: {
      type: 'contradictory',
      description: '与性格设定明显矛盾的行为',
      examples: [],
    },
    priority: 10,
    source: 'character_profile',
  },
  {
    ruleType: 'speech_pattern',
    condition: {
      type: 'always',
      description: '角色语言风格应保持一致',
      triggers: ['对话场景'],
    },
    expectedBehavior: {
      type: 'consistent_voice',
      description: '语言风格符合角色设定',
      examples: [],
    },
    forbiddenBehavior: {
      type: 'out_of_character',
      description: '使用不符合角色身份的语言',
      examples: [],
    },
    priority: 8,
    source: 'character_profile',
  },
  {
    ruleType: 'emotional_appropriateness',
    condition: {
      type: 'emotional',
      description: '情感反应应与情境相符',
      triggers: ['情感场景'],
    },
    expectedBehavior: {
      type: 'appropriate',
      description: '情感反应强度和类型适当',
      examples: [],
    },
    forbiddenBehavior: {
      type: 'disproportionate',
      description: '情感反应过度或不足',
      examples: [],
    },
    priority: 7,
    source: 'character_profile',
  },
];
