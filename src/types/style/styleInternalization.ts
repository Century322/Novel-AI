export type StyleMasteryLevel = 'novice' | 'apprentice' | 'competent' | 'proficient' | 'master';

export type StyleElement =
  | 'sentence_structure'
  | 'vocabulary_choice'
  | 'rhythm'
  | 'imagery'
  | 'tone'
  | 'voice'
  | 'pacing'
  | 'dialogue_style'
  | 'description_technique'
  | 'narrative_distance';

export type InnovationType =
  | 'technique_fusion'
  | 'pattern_breaking'
  | 'perspective_experiment'
  | 'structure_innovation'
  | 'language_experiment'
  | 'genre_blending';

export interface StyleElementMastery {
  element: StyleElement;
  level: StyleMasteryLevel;
  score: number;

  learnedPatterns: string[];
  appliedPatterns: string[];
  innovatedPatterns: string[];

  strengths: string[];
  weaknesses: string[];

  practiceHistory: Array<{
    date: number;
    exercise: string;
    score: number;
    feedback: string;
  }>;
}

export interface StyleInternalization {
  id: string;
  profileId: string;

  overallMastery: StyleMasteryLevel;
  overallScore: number;

  elementMastery: StyleElementMastery[];

  internalizedPatterns: InternalizedPattern[];

  innovationCapability: InnovationCapability;

  adaptationSkills: AdaptationSkill[];

  createdAt: number;
  updatedAt: number;
}

export interface InternalizedPattern {
  id: string;
  patternType: StyleElement;

  originalForm: string;
  internalizedForm: string;

  understanding: {
    surface: string;
    deep: string;
    contextual: string;
  };

  applications: Array<{
    context: string;
    result: string;
    effectiveness: number;
  }>;

  masteryLevel: StyleMasteryLevel;

  canInnovate: boolean;
  innovationExamples: string[];
}

export interface InnovationCapability {
  overallPotential: number;

  byType: Array<{
    type: InnovationType;
    capability: number;
    examples: string[];
    attempted: number;
    successful: number;
  }>;

  recentInnovations: Array<{
    id: string;
    type: InnovationType;
    description: string;
    effectiveness: number;
    feedback: string;
  }>;

  suggestions: string[];
}

export interface AdaptationSkill {
  contextType: string;
  adaptability: number;

  transformations: Array<{
    from: string;
    to: string;
    example: string;
  }>;

  challenges: string[];
  improvements: string[];
}

export interface StyleInternalizationProgress {
  id: string;
  profileId: string;

  totalExposure: number;
  uniquePatternsLearned: number;
  patternsInternalized: number;
  patternsInnovated: number;

  learningCurve: Array<{
    date: number;
    masteryScore: number;
    newPatterns: number;
    appliedPatterns: number;
  }>;

  milestones: Array<{
    date: number;
    milestone: string;
    achievement: string;
  }>;

  nextGoals: string[];

  recommendations: string[];
}

export interface StyleExercise {
  id: string;
  type: 'imitation' | 'variation' | 'innovation' | 'analysis';

  targetElement: StyleElement;
  description: string;

  instructions: string[];
  example?: string;

  difficulty: 1 | 2 | 3 | 4 | 5;

  evaluationCriteria: Array<{
    criterion: string;
    weight: number;
  }>;

  timeLimit?: number;
}

export interface ExerciseResult {
  id: string;
  exerciseId: string;
  profileId: string;

  input: string;
  output: string;

  score: number;
  feedback: string;

  criteriaScores: Array<{
    criterion: string;
    score: number;
    comment: string;
  }>;

  improvements: string[];

  completedAt: number;
}

export const STYLE_ELEMENT_LABELS: Record<StyleElement, string> = {
  sentence_structure: '句式结构',
  vocabulary_choice: '词汇选择',
  rhythm: '节奏韵律',
  imagery: '意象运用',
  tone: '语调风格',
  voice: '叙述声音',
  pacing: '叙事节奏',
  dialogue_style: '对话风格',
  description_technique: '描写技法',
  narrative_distance: '叙述距离',
};

export const MASTERY_LEVEL_LABELS: Record<StyleMasteryLevel, string> = {
  novice: '初学',
  apprentice: '入门',
  competent: '熟练',
  proficient: '精通',
  master: '大师',
};

export const INNOVATION_TYPE_LABELS: Record<InnovationType, string> = {
  technique_fusion: '技法融合',
  pattern_breaking: '模式突破',
  perspective_experiment: '视角实验',
  structure_innovation: '结构创新',
  language_experiment: '语言实验',
  genre_blending: '类型融合',
};

export const DEFAULT_STYLE_EXERCISES: StyleExercise[] = [
  {
    id: 'exercise_imitation_1',
    type: 'imitation',
    targetElement: 'sentence_structure',
    description: '句式模仿练习',
    instructions: ['阅读给定的范例句子', '分析其句式结构特点', '用相同的句式结构创作新句子'],
    difficulty: 2,
    evaluationCriteria: [
      { criterion: '结构相似度', weight: 0.4 },
      { criterion: '语义连贯性', weight: 0.3 },
      { criterion: '创意表达', weight: 0.3 },
    ],
  },
  {
    id: 'exercise_variation_1',
    type: 'variation',
    targetElement: 'imagery',
    description: '意象变奏练习',
    instructions: ['分析给定意象的构成', '保留核心特征，变换表达方式', '创造新的意象组合'],
    difficulty: 3,
    evaluationCriteria: [
      { criterion: '意象一致性', weight: 0.3 },
      { criterion: '表达新颖性', weight: 0.4 },
      { criterion: '情感传递', weight: 0.3 },
    ],
  },
  {
    id: 'exercise_innovation_1',
    type: 'innovation',
    targetElement: 'tone',
    description: '语调创新练习',
    instructions: ['识别现有语调模式', '尝试打破常规表达', '创造独特的叙述声音'],
    difficulty: 4,
    evaluationCriteria: [
      { criterion: '创新程度', weight: 0.4 },
      { criterion: '可读性', weight: 0.3 },
      { criterion: '风格一致性', weight: 0.3 },
    ],
  },
];
