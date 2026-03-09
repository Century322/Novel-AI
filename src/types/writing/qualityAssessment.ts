export type QualityDimension =
  | 'plot'
  | 'character'
  | 'dialogue'
  | 'description'
  | 'emotion'
  | 'pacing'
  | 'style'
  | 'logic'
  | 'originality'
  | 'readability';

export type QualityLevel = 'excellent' | 'good' | 'average' | 'below_average' | 'poor';

export type AssessmentType = 'chapter' | 'section' | 'dialogue' | 'scene' | 'full_work';

export interface QualityScore {
  dimension: QualityDimension;
  score: number;
  level: QualityLevel;
  weight: number;
  details: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface QualityAssessment {
  id: string;
  type: AssessmentType;
  targetId: string;
  targetName: string;

  overallScore: number;
  overallLevel: QualityLevel;

  dimensionScores: QualityScore[];

  summary: string;
  highlights: string[];
  issues: QualityIssue[];

  comparison?: {
    previousScore: number;
    trend: 'improved' | 'declined' | 'stable';
    benchmark: number;
  };

  recommendations: QualityRecommendation[];

  assessedAt: number;
  assessedBy: 'ai' | 'rule' | 'hybrid';
}

export interface QualityIssue {
  id: string;
  dimension: QualityDimension;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  location: {
    start: number;
    end: number;
    excerpt: string;
  };
  suggestion: string;
}

export interface QualityRecommendation {
  id: string;
  dimension: QualityDimension;
  priority: 'high' | 'medium' | 'low';
  description: string;
  example?: string;
  expectedImprovement: string;
}

export interface QualityBenchmark {
  dimension: QualityDimension;
  excellent: number;
  good: number;
  average: number;
  belowAverage: number;
}

export interface QualityHistory {
  assessmentId: string;
  targetId: string;
  overallScore: number;
  dimensionScores: Record<QualityDimension, number>;
  assessedAt: number;
}

export const QUALITY_DIMENSION_LABELS: Record<QualityDimension, string> = {
  plot: '剧情',
  character: '人物',
  dialogue: '对话',
  description: '描写',
  emotion: '情感',
  pacing: '节奏',
  style: '风格',
  logic: '逻辑',
  originality: '创意',
  readability: '可读性',
};

export const QUALITY_LEVEL_LABELS: Record<QualityLevel, string> = {
  excellent: '优秀',
  good: '良好',
  average: '一般',
  below_average: '较差',
  poor: '差',
};

export const QUALITY_BENCHMARKS: QualityBenchmark[] = [
  { dimension: 'plot', excellent: 90, good: 75, average: 60, belowAverage: 45 },
  { dimension: 'character', excellent: 88, good: 73, average: 58, belowAverage: 43 },
  { dimension: 'dialogue', excellent: 85, good: 70, average: 55, belowAverage: 40 },
  { dimension: 'description', excellent: 85, good: 70, average: 55, belowAverage: 40 },
  { dimension: 'emotion', excellent: 90, good: 75, average: 60, belowAverage: 45 },
  { dimension: 'pacing', excellent: 88, good: 73, average: 58, belowAverage: 43 },
  { dimension: 'style', excellent: 85, good: 70, average: 55, belowAverage: 40 },
  { dimension: 'logic', excellent: 95, good: 80, average: 65, belowAverage: 50 },
  { dimension: 'originality', excellent: 88, good: 73, average: 58, belowAverage: 43 },
  { dimension: 'readability', excellent: 90, good: 75, average: 60, belowAverage: 45 },
];

export const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  plot: 0.15,
  character: 0.12,
  dialogue: 0.1,
  description: 0.1,
  emotion: 0.12,
  pacing: 0.1,
  style: 0.08,
  logic: 0.1,
  originality: 0.08,
  readability: 0.05,
};

export const DIMENSION_DESCRIPTIONS: Record<QualityDimension, string> = {
  plot: '剧情的连贯性、合理性和吸引力',
  character: '人物形象的丰满度和行为的一致性',
  dialogue: '对话的自然度和角色特色',
  description: '描写的生动性和画面感',
  emotion: '情感表达的真实性和感染力',
  pacing: '叙事节奏的把控和张力变化',
  style: '文字风格的一致性和独特性',
  logic: '情节逻辑的严密性和合理性',
  originality: '创意的新颖度和独特性',
  readability: '文字的流畅度和易读性',
};
