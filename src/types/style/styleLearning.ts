export type StyleCategory =
  | 'sentence'
  | 'paragraph'
  | 'dialogue'
  | 'description'
  | 'narration'
  | 'emotion'
  | 'action'
  | 'pacing'
  | 'vocabulary'
  | 'tone';

export type WritingStyle = {
  name: string;
  description: string;
  characteristics: StyleCharacteristic[];
  examples: StyleExample[];
  score: number;
};

export interface StyleCharacteristic {
  category: StyleCategory;
  name: string;
  description: string;
  frequency: number;
  examples: string[];
  rules: StyleRule[];
}

export interface StyleRule {
  condition: string;
  action: string;
  priority: 'always' | 'often' | 'sometimes' | 'avoid';
}

export interface StyleExample {
  original: string;
  analysis: string;
  category: StyleCategory;
  tags: string[];
}

export interface StyleProfile {
  id: string;
  name: string;
  source: string;

  sentenceStyle: {
    averageLength: number;
    preferredLength: 'short' | 'medium' | 'long' | 'varied';
    structurePreference: string[];
    punctuationStyle: string[];
  };

  paragraphStyle: {
    averageLength: number;
    structurePreference: string[];
    transitionStyle: string[];
  };

  dialogueStyle: {
    frequency: number;
    style: 'direct' | 'indirect' | 'mixed';
    tagPreference: string[];
    speechPattern: string[];
  };

  descriptionStyle: {
    detail: 'sparse' | 'moderate' | 'dense';
    sensoryFocus: string[];
    metaphorFrequency: number;
    showVsTell: number;
  };

  narrationStyle: {
    perspective: 'first' | 'third-limited' | 'third-omniscient';
    tense: 'past' | 'present' | 'mixed';
    voice: 'active' | 'passive' | 'mixed';
  };

  emotionStyle: {
    directExpression: number;
    showVsTell: number;
    physicalDescription: string[];
  };

  actionStyle: {
    pacing: 'fast' | 'medium' | 'slow' | 'varied';
    verbChoice: string[];
    sentenceStructure: string[];
  };

  vocabulary: {
    complexity: 'simple' | 'moderate' | 'complex';
    uniqueWords: number;
    repeatedPhrases: string[];
    domainTerms: string[];
  };

  tone: {
    overall: string[];
    moodPatterns: string[];
    humorLevel: number;
    darknessLevel: number;
  };

  patterns: StylePattern[];
  examples: StyleExample[];

  createdAt: number;
  updatedAt: number;
}

export interface StylePattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  matches: string[];
  context: string;
  frequency: number;
}

export interface StyleLearningProgress {
  totalAnalyzed: number;
  charactersProcessed: number;
  patternsIdentified: number;
  confidenceScore: number;
  lastAnalyzed: number;
}

export interface StyleApplication {
  profileId: string;
  content: string;
  appliedPatterns: string[];
  modifications: string[];
  result: string;
}

export const STYLE_CATEGORIES: Record<StyleCategory, { name: string; description: string }> = {
  sentence: { name: '句式风格', description: '句子的长度、结构和节奏' },
  paragraph: { name: '段落风格', description: '段落的组织和过渡' },
  dialogue: { name: '对话风格', description: '人物对话的写法' },
  description: { name: '描写风格', description: '场景和人物的描写方式' },
  narration: { name: '叙述风格', description: '故事的叙述视角和语态' },
  emotion: { name: '情感表达', description: '情感的表达方式' },
  action: { name: '动作描写', description: '动作场景的写法' },
  pacing: { name: '节奏控制', description: '故事节奏的快慢' },
  vocabulary: { name: '词汇选择', description: '用词的习惯和偏好' },
  tone: { name: '基调氛围', description: '整体的情感基调' },
};

export const SENTENCE_LENGTH_PREFERENCES = [
  { value: 'short', label: '短句为主', description: '节奏明快，适合动作场景' },
  { value: 'medium', label: '中等长度', description: '平衡节奏，适合大多数场景' },
  { value: 'long', label: '长句为主', description: '细腻描写，适合情感场景' },
  { value: 'varied', label: '长短结合', description: '节奏变化，适合复杂场景' },
];

export const DESCRIPTION_DENSITY = [
  { value: 'sparse', label: '简洁', description: '点到为止，留白多' },
  { value: 'moderate', label: '适中', description: '细节适度' },
  { value: 'dense', label: '详细', description: '描写细腻，信息量大' },
];

export const PACING_STYLES = [
  { value: 'fast', label: '快节奏', description: '紧张刺激，适合高潮' },
  { value: 'medium', label: '中等节奏', description: '平稳推进' },
  { value: 'slow', label: '慢节奏', description: '舒缓细腻' },
  { value: 'varied', label: '节奏变化', description: '快慢交替' },
];
