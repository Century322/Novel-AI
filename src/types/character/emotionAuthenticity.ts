export type EmotionCategory =
  | 'joy'
  | 'sorrow'
  | 'anger'
  | 'fear'
  | 'love'
  | 'hate'
  | 'surprise'
  | 'anticipation'
  | 'trust'
  | 'disgust'
  | 'neutral'
  | 'mixed'
  | 'any';

export type EmotionIntensity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type EmotionTransitionType =
  | 'gradual'
  | 'sudden'
  | 'oscillating'
  | 'suppressed'
  | 'intensifying';

export type AuthenticityLevel = 'high' | 'medium' | 'low' | 'artificial';

export interface EmotionState {
  id: string;
  characterId: string;
  characterName: string;

  primaryEmotion: EmotionCategory;
  secondaryEmotions: Array<{
    emotion: EmotionCategory;
    weight: number;
  }>;

  intensity: EmotionIntensity;
  displayIntensity: EmotionIntensity;

  triggers: string[];
  suppressed: boolean;

  physicalManifestations: string[];
  behavioralCues: string[];
  verbalExpressions: string[];

  duration: number;
  startTime: number;
  endTime?: number;

  location: {
    chapter: number;
    paragraph?: number;
    excerpt: string;
  };
}

export interface EmotionTransition {
  id: string;
  characterId: string;

  fromState: EmotionState;
  toState: EmotionState;

  transitionType: EmotionTransitionType;

  trigger: {
    type: 'external_event' | 'internal_thought' | 'dialogue' | 'memory' | 'realization';
    description: string;
  };

  duration: number;

  plausibility: number;
  authenticity: AuthenticityLevel;

  issues: EmotionIssue[];

  location: {
    chapter: number;
    startParagraph?: number;
    endParagraph?: number;
  };
}

export interface EmotionIssue {
  id: string;
  type:
    | 'inconsistent'
    | 'too_sudden'
    | 'too_slow'
    | 'unjustified'
    | 'suppressed_too_long'
    | 'wrong_intensity';
  severity: 'critical' | 'major' | 'minor';

  description: string;
  location: string;

  suggestion: string;
}

export interface EmotionArc {
  id: string;
  characterId: string;
  characterName: string;

  chapter: number;

  states: EmotionState[];
  transitions: EmotionTransition[];

  dominantEmotion: EmotionCategory;
  emotionalRange: EmotionCategory[];

  arcType: 'flat' | 'rising' | 'falling' | 'wave' | 'complex';

  authenticityScore: number;
  consistencyScore: number;

  issues: EmotionIssue[];
}

export interface EmotionAuthenticityAnalysis {
  characterId: string;
  characterName: string;

  overallAuthenticity: number;
  overallConsistency: number;

  arcs: EmotionArc[];

  commonIssues: Array<{
    type: EmotionIssue['type'];
    count: number;
    examples: string[];
  }>;

  strengths: string[];
  improvements: string[];

  recommendations: EmotionRecommendation[];
}

export interface EmotionRecommendation {
  id: string;
  type:
    | 'add_transition'
    | 'adjust_intensity'
    | 'add_trigger'
    | 'show_physically'
    | 'extend_duration';
  priority: 'high' | 'medium' | 'low';

  location: {
    chapter: number;
    paragraph?: number;
  };

  currentDescription: string;
  suggestedImprovement: string;

  reason: string;
  example?: string;
}

export interface CharacterEmotionProfile {
  characterId: string;
  characterName: string;

  baselineEmotion: EmotionCategory;
  emotionalRange: EmotionCategory[];

  typicalIntensity: EmotionIntensity;
  expressiveness: 'high' | 'medium' | 'low' | 'selective';

  triggers: Array<{
    emotion: EmotionCategory;
    triggers: string[];
  }>;

  suppressionPatterns: string[];

  physicalManifestations: Record<EmotionCategory, string[]>;

  emotionalGrowth: Array<{
    from: EmotionCategory;
    to: EmotionCategory;
    reason: string;
    chapter: number;
  }>;
}

export const EMOTION_LABELS: Record<EmotionCategory, string> = {
  joy: '喜悦',
  sorrow: '悲伤',
  anger: '愤怒',
  fear: '恐惧',
  love: '爱',
  hate: '恨',
  surprise: '惊讶',
  anticipation: '期待',
  trust: '信任',
  disgust: '厌恶',
  neutral: '平静',
  mixed: '复杂',
  any: '任意',
};

export const EMOTION_INTENSITY_LABELS: Record<EmotionIntensity, string> = {
  1: '微弱',
  2: '轻微',
  3: '一般',
  4: '中等',
  5: '较强',
  6: '强烈',
  7: '非常强烈',
  8: '极度',
  9: '爆发性',
  10: '压倒性',
};

export const AUTHENTICITY_LABELS: Record<AuthenticityLevel, string> = {
  high: '真实自然',
  medium: '基本合理',
  low: '略显生硬',
  artificial: '不自然',
};

export const TRANSITION_TYPE_LABELS: Record<EmotionTransitionType, string> = {
  gradual: '渐进',
  sudden: '突变',
  oscillating: '波动',
  suppressed: '压抑',
  intensifying: '增强',
};

export const EMOTION_OPPOSITES: Partial<Record<EmotionCategory, EmotionCategory>> = {
  joy: 'sorrow',
  sorrow: 'joy',
  love: 'hate',
  hate: 'love',
  trust: 'disgust',
  disgust: 'trust',
  anticipation: 'surprise',
  surprise: 'anticipation',
};

export const EMOTION_COMPATIBILITY: Record<EmotionCategory, EmotionCategory[]> = {
  joy: ['love', 'trust', 'anticipation'],
  sorrow: ['fear', 'anger', 'neutral'],
  anger: ['hate', 'disgust', 'fear'],
  fear: ['sorrow', 'anger', 'surprise'],
  love: ['joy', 'trust', 'anticipation'],
  hate: ['anger', 'disgust', 'fear'],
  surprise: ['fear', 'joy', 'anticipation'],
  anticipation: ['joy', 'fear', 'neutral'],
  trust: ['love', 'joy', 'neutral'],
  disgust: ['hate', 'anger', 'fear'],
  neutral: ['anticipation', 'trust', 'any'],
  mixed: ['any'],
  any: [
    'joy',
    'sorrow',
    'anger',
    'fear',
    'love',
    'hate',
    'surprise',
    'anticipation',
    'trust',
    'disgust',
    'neutral',
    'mixed',
  ],
};
