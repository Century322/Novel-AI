export type ArtisticTechnique =
  | 'white_space'
  | 'implication'
  | 'contrast'
  | 'metaphor'
  | 'symbolism'
  | 'rhythm'
  | 'repetition'
  | 'perspective_shift'
  | 'sensory_detail'
  | 'show_dont_tell';

export type EmotionType =
  | 'joy'
  | 'sorrow'
  | 'anger'
  | 'fear'
  | 'love'
  | 'hate'
  | 'hope'
  | 'despair'
  | 'surprise'
  | 'anticipation'
  | 'nostalgia'
  | 'melancholy'
  | 'excitement'
  | 'peace'
  | 'tension'
  | 'relief';

export type EmotionIntensity = 'subtle' | 'moderate' | 'strong' | 'overwhelming';

export interface WhiteSpacePattern {
  id: string;
  name: string;
  type:
    | 'narrative_gap'
    | 'emotional_pause'
    | 'scene_transition'
    | 'dialogue_silence'
    | 'description_omission';
  description: string;

  beforeContext: string;
  afterContext: string;
  theBlank: string;

  effect: string;
  readerEmotion: string;

  examples: Array<{
    original: string;
    analysis: string;
  }>;

  usageGuidelines: string[];
}

export interface EmotionTransmission {
  id: string;
  emotion: EmotionType;
  intensity: EmotionIntensity;

  techniques: EmotionTechnique[];

  physicalManifestations: string[];
  behavioralCues: string[];
  environmentalReflections: string[];

  dialoguePatterns: string[];
  internalMonologue: string[];

  buildUp: EmotionBuildUp[];

  examples: Array<{
    text: string;
    analysis: string;
    effectiveness: number;
  }>;
}

export interface EmotionTechnique {
  type: 'physical' | 'behavioral' | 'environmental' | 'dialogue' | 'internal' | 'metaphorical';
  description: string;
  examples: string[];
}

export interface EmotionBuildUp {
  stage: number;
  description: string;
  intensity: number;
  technique: string;
}

export interface ArtisticStyleProfile {
  id: string;
  name: string;
  description: string;

  whiteSpaceUsage: {
    frequency: number;
    types: Array<{ type: string; count: number }>;
    effectiveness: number;
  };

  emotionTransmission: {
    dominantEmotions: EmotionType[];
    averageIntensity: number;
    techniques: Array<{ technique: string; frequency: number }>;
  };

  artisticTechniques: Array<{
    technique: ArtisticTechnique;
    frequency: number;
    effectiveness: number;
    examples: string[];
  }>;

  strengths: string[];
  areasToImprove: string[];

  createdAt: number;
  updatedAt: number;
}

export interface StyleAnalysisResult {
  whiteSpacePatterns: WhiteSpacePattern[];
  emotionTransmissions: EmotionTransmission[];
  artisticTechniques: Array<{
    technique: ArtisticTechnique;
    instances: number;
    examples: string[];
    effectiveness: number;
  }>;

  overallScore: number;
  recommendations: StyleRecommendation[];
}

export interface StyleRecommendation {
  id: string;
  type: 'add_white_space' | 'enhance_emotion' | 'improve_technique' | 'reduce_overuse';
  priority: 'high' | 'medium' | 'low';
  description: string;
  example: string;
  expectedImprovement: string;
}

export interface ArtisticExample {
  id: string;
  source: string;
  author?: string;
  category: ArtisticTechnique | EmotionType;
  text: string;
  analysis: string;
  tags: string[];
  rating: number;
}

export const ARTISTIC_TECHNIQUE_LABELS: Record<ArtisticTechnique, string> = {
  white_space: '留白艺术',
  implication: '暗示手法',
  contrast: '对比手法',
  metaphor: '比喻修辞',
  symbolism: '象征手法',
  rhythm: '节奏控制',
  repetition: '重复强调',
  perspective_shift: '视角转换',
  sensory_detail: '感官细节',
  show_dont_tell: '展示而非讲述',
};

export const EMOTION_LABELS: Record<EmotionType, string> = {
  joy: '喜悦',
  sorrow: '悲伤',
  anger: '愤怒',
  fear: '恐惧',
  love: '爱',
  hate: '恨',
  hope: '希望',
  despair: '绝望',
  surprise: '惊讶',
  anticipation: '期待',
  nostalgia: '怀旧',
  melancholy: '忧郁',
  excitement: '兴奋',
  peace: '平静',
  tension: '紧张',
  relief: '释然',
};

export const EMOTION_INTENSITY_LABELS: Record<EmotionIntensity, string> = {
  subtle: '微妙',
  moderate: '中等',
  strong: '强烈',
  overwhelming: '压倒性',
};

export const WHITE_SPACE_TYPE_LABELS = {
  narrative_gap: '叙事留白',
  emotional_pause: '情感停顿',
  scene_transition: '场景过渡',
  dialogue_silence: '对话沉默',
  description_omission: '描写省略',
};
