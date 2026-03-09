export type ReaderType =
  | 'casual'
  | 'avid'
  | 'critical'
  | 'genre_fan'
  | 'literary'
  | 'young_adult'
  | 'mature';

export type FeedbackCategory =
  | 'engagement'
  | 'clarity'
  | 'emotion'
  | 'pacing'
  | 'character'
  | 'plot'
  | 'style'
  | 'originality'
  | 'dialogue'
  | 'description'
  | 'worldbuilding'
  | 'satisfaction';

export type SentimentType = 'positive' | 'negative' | 'neutral' | 'mixed';

export type FeedbackImportance = 'critical' | 'important' | 'minor';

export interface ReaderPersona {
  id: string;
  type: ReaderType;

  demographics: {
    ageRange: string;
    readingExperience: string;
    preferredGenres: string[];
    readingFrequency: string;
  };

  preferences: {
    pacePreference: 'fast' | 'moderate' | 'slow' | 'varied';
    descriptionLevel: 'minimal' | 'moderate' | 'detailed';
    dialoguePreference: 'minimal' | 'moderate' | 'heavy';
    emotionalIntensity: 'light' | 'moderate' | 'intense';
    complexityLevel: 'simple' | 'moderate' | 'complex';
  };

  petPeeves: string[];
  favoriteElements: string[];

  attentionSpan: number;
  suspensionOfDisbelief: number;

  weightings: Record<FeedbackCategory, number>;
}

export interface ReaderFeedback {
  id: string;
  personaId: string;
  readerType: ReaderType;

  target: {
    type: 'chapter' | 'scene' | 'paragraph' | 'dialogue' | 'character';
    id: string;
    location: {
      chapter: number;
      startParagraph?: number;
      endParagraph?: number;
    };
  };

  category: FeedbackCategory;
  sentiment: SentimentType;
  importance: FeedbackImportance;

  summary: string;
  details: string;

  specificIssues: FeedbackIssue[];

  suggestions: string[];

  emotionalResponse: {
    primary: string;
    intensity: number;
    triggers: string[];
  };

  engagement: {
    attentionLevel: number;
    immersionLevel: number;
    wouldContinue: boolean;
    dropReason?: string;
  };

  createdAt: number;
}

export interface FeedbackIssue {
  id: string;
  type: 'confusion' | 'boredom' | 'disbelief' | 'frustration' | 'disappointment' | 'other';

  description: string;
  location: string;

  cause: string;
  impact: string;

  suggestedFix: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AggregateFeedback {
  id: string;
  targetId: string;
  targetType: string;

  totalReaders: number;
  feedbackCount: number;

  overallScore: number;
  categoryScores: Record<FeedbackCategory, number>;

  sentimentDistribution: Record<SentimentType, number>;

  commonIssues: Array<{
    issue: string;
    frequency: number;
    severity: number;
  }>;

  commonPraises: Array<{
    praise: string;
    frequency: number;
  }>;

  readerTypeBreakdown: Record<
    ReaderType,
    {
      score: number;
      mainIssues: string[];
      mainPraises: string[];
    }
  >;

  recommendations: AggregateRecommendation[];

  generatedAt: number;
}

export interface AggregateRecommendation {
  id: string;
  type: 'fix' | 'enhance' | 'maintain' | 'consider';
  priority: 'high' | 'medium' | 'low';

  description: string;
  reason: string;

  affectedReaders: ReaderType[];
  expectedImpact: string;

  implementation: string;
}

export interface ReaderSimulation {
  id: string;
  name: string;
  description: string;

  personas: ReaderPersona[];

  focusAreas: FeedbackCategory[];

  simulationConfig: {
    depth: 'surface' | 'moderate' | 'deep';
    includeEmotionalJourney: boolean;
    trackEngagement: boolean;
    identifyDropPoints: boolean;
  };

  results: SimulationResult[];

  createdAt: number;
}

export interface SimulationResult {
  id: string;
  simulationId: string;
  personaId: string;

  contentRange: {
    startChapter: number;
    endChapter: number;
  };

  overallExperience: {
    enjoyment: number;
    engagement: number;
    satisfaction: number;
    wouldRecommend: boolean;
  };

  feedback: ReaderFeedback[];

  emotionalJourney: Array<{
    chapter: number;
    emotion: string;
    intensity: number;
  }>;

  engagementCurve: Array<{
    chapter: number;
    attention: number;
    immersion: number;
  }>;

  dropPoints: Array<{
    chapter: number;
    reason: string;
    recoverable: boolean;
  }>;

  highlights: string[];
  lowlights: string[];

  summary: string;
}

export interface ReaderInsight {
  id: string;
  type: 'pattern' | 'trend' | 'anomaly' | 'opportunity';

  title: string;
  description: string;

  evidence: Array<{
    source: string;
    data: string;
  }>;

  implications: string[];
  actions: string[];

  confidence: number;
  importance: FeedbackImportance;

  createdAt: number;
}

export const READER_TYPE_LABELS: Record<ReaderType, string> = {
  casual: '休闲读者',
  avid: '资深读者',
  critical: '挑剔读者',
  genre_fan: '类型爱好者',
  literary: '文学读者',
  young_adult: '年轻读者',
  mature: '成熟读者',
};

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  engagement: '吸引力',
  clarity: '清晰度',
  emotion: '情感',
  pacing: '节奏',
  character: '人物',
  plot: '剧情',
  style: '风格',
  originality: '原创性',
  dialogue: '对话',
  description: '描写',
  worldbuilding: '世界观',
  satisfaction: '满足感',
};

export const DEFAULT_READER_PERSONAS: Partial<ReaderPersona>[] = [
  {
    type: 'casual',
    demographics: {
      ageRange: '25-35',
      readingExperience: '偶尔阅读',
      preferredGenres: ['都市', '言情'],
      readingFrequency: '每周1-2次',
    },
    preferences: {
      pacePreference: 'fast',
      descriptionLevel: 'minimal',
      dialoguePreference: 'moderate',
      emotionalIntensity: 'moderate',
      complexityLevel: 'simple',
    },
    petPeeves: ['冗长描写', '复杂设定', '慢节奏'],
    favoriteElements: ['轻松剧情', '有趣对话', '快节奏'],
    attentionSpan: 0.6,
    suspensionOfDisbelief: 0.8,
  },
  {
    type: 'avid',
    demographics: {
      ageRange: '20-40',
      readingExperience: '大量阅读',
      preferredGenres: ['玄幻', '仙侠', '科幻'],
      readingFrequency: '每天',
    },
    preferences: {
      pacePreference: 'varied',
      descriptionLevel: 'moderate',
      dialoguePreference: 'moderate',
      emotionalIntensity: 'intense',
      complexityLevel: 'complex',
    },
    petPeeves: ['逻辑漏洞', '人物崩坏', '烂尾'],
    favoriteElements: ['复杂世界观', '人物成长', '伏笔回收'],
    attentionSpan: 0.9,
    suspensionOfDisbelief: 0.7,
  },
  {
    type: 'critical',
    demographics: {
      ageRange: '30-50',
      readingExperience: '专业背景',
      preferredGenres: ['文学', '历史'],
      readingFrequency: '每周多次',
    },
    preferences: {
      pacePreference: 'moderate',
      descriptionLevel: 'detailed',
      dialoguePreference: 'moderate',
      emotionalIntensity: 'moderate',
      complexityLevel: 'complex',
    },
    petPeeves: ['陈词滥调', '人物单薄', '设定矛盾'],
    favoriteElements: ['深度人物', '精妙结构', '独特风格'],
    attentionSpan: 0.95,
    suspensionOfDisbelief: 0.5,
  },
  {
    type: 'genre_fan',
    demographics: {
      ageRange: '18-30',
      readingExperience: '类型专家',
      preferredGenres: ['玄幻', '仙侠'],
      readingFrequency: '每天',
    },
    preferences: {
      pacePreference: 'fast',
      descriptionLevel: 'moderate',
      dialoguePreference: 'heavy',
      emotionalIntensity: 'intense',
      complexityLevel: 'moderate',
    },
    petPeeves: ['套路重复', '升级太慢', '主角软弱'],
    favoriteElements: ['爽点', '升级', '打脸'],
    attentionSpan: 0.7,
    suspensionOfDisbelief: 0.9,
  },
];
