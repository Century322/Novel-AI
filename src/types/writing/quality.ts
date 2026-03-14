export interface QualityCheckResult {
  id: string;
  content: string;
  timestamp: number;
  overallScore: number;
  dimensions: QualityDimension[];
  issues: QualityIssue[];
  suggestions: string[];
}

export interface QualityDimension {
  name: DimensionName;
  score: number;
  weight: number;
  details: string;
}

export type DimensionName =
  | 'coherence'
  | 'creativity'
  | 'character_consistency'
  | 'plot_logic'
  | 'language_quality'
  | 'pacing'
  | 'dialogue'
  | 'description'
  | 'emotional_impact'
  | 'originality';

export interface QualityIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high';
  location: IssueLocation;
  description: string;
  suggestion: string;
}

export type IssueType =
  | 'plot_hole'
  | 'character_inconsistency'
  | 'timeline_error'
  | 'dialogue_unnatural'
  | 'description_redundant'
  | 'pacing_issue'
  | 'grammar_error'
  | 'style_inconsistent'
  | 'foreshadowing_unresolved'
  | 'logic_flaw';

export interface IssueLocation {
  start: number;
  end: number;
  context: string;
}

export interface QualityRule {
  id: string;
  name: string;
  description: string;
  dimension: DimensionName;
  weight: number;
  check: (content: string, context: AssessmentContext) => RuleResult;
}

export interface RuleResult {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
}

export interface AssessmentContext {
  characters: string[];
  previousContent?: string;
  genre?: string;
  chapter?: string;
  projectMemory?: ProjectMemoryContext;
}

export interface ProjectMemoryContext {
  characters: QualityCharacterContext[];
  timeline: SimpleTimelineEvent[];
  foreshadowing: ForeshadowingContext[];
}

export interface QualityCharacterContext {
  name: string;
  traits: string[];
  relationships: string[];
}

export interface SimpleTimelineEvent {
  chapter: string;
  event: string;
}

export interface ForeshadowingContext {
  content: string;
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned';
}

export interface DistillationResult {
  id: string;
  sourceContent: string;
  distilledContent: string;
  timestamp: number;
  type: DistillationType;
  quality: QualityCheckResult;
  extractedKnowledge: ExtractedKnowledge[];
}

export type DistillationType =
  | 'chapter_summary'
  | 'character_profile'
  | 'plot_outline'
  | 'style_guide'
  | 'worldbuilding'
  | 'lesson_learned';

export interface ExtractedKnowledge {
  type: string;
  content: string;
  confidence: number;
  source: string;
}

export interface SimpleStyleProfile {
  id: string;
  name: string;
  description: string;
  features: StyleFeature[];
  examples: SimpleStyleExample[];
  createdAt: number;
  updatedAt: number;
}

export interface StyleFeature {
  name: string;
  value: number;
  description: string;
}

export interface SimpleStyleExample {
  content: string;
  analysis: string;
}

export interface StyleAnalysis {
  sentenceLength: StyleMetric;
  paragraphLength: StyleMetric;
  dialogueRatio: number;
  descriptionRatio: number;
  vocabularyRichness: number;
  sentenceVariety: number;
  metaphorUsage: number;
  emotionalTone: EmotionalTone;
}

export interface StyleMetric {
  average: number;
  variance: number;
  distribution: number[];
}

export interface EmotionalTone {
  primary: string;
  secondary: string[];
  intensity: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  affectedContent: string[];
  proposedChanges: ProposedChange[];
  rationale: string;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
}

export type SuggestionType =
  | 'consistency_fix'
  | 'plot_improvement'
  | 'character_development'
  | 'style_enhancement'
  | 'pacing_adjustment'
  | 'foreshadowing_setup';

export interface ProposedChange {
  location: IssueLocation;
  original: string;
  suggested: string;
  reason: string;
}

export const DIMENSION_CONFIG: Record<
  DimensionName,
  {
    label: string;
    description: string;
    defaultWeight: number;
  }
> = {
  coherence: { label: '连贯性', description: '故事情节和逻辑的连贯程度', defaultWeight: 1.0 },
  creativity: { label: '创意性', description: '情节和表达的创意程度', defaultWeight: 0.8 },
  character_consistency: {
    label: '人物一致性',
    description: '人物性格和行为的一致性',
    defaultWeight: 1.0,
  },
  plot_logic: { label: '情节逻辑', description: '情节发展的合理性和逻辑性', defaultWeight: 1.0 },
  language_quality: {
    label: '语言质量',
    description: '文字表达的准确性和优美程度',
    defaultWeight: 0.9,
  },
  pacing: { label: '节奏把控', description: '故事节奏的把控能力', defaultWeight: 0.7 },
  dialogue: { label: '对话质量', description: '对话的自然程度和功能性', defaultWeight: 0.8 },
  description: { label: '描写水平', description: '场景和人物描写的生动程度', defaultWeight: 0.7 },
  emotional_impact: { label: '情感冲击', description: '对读者情感的触动程度', defaultWeight: 0.8 },
  originality: { label: '原创性', description: '内容和表达的独特程度', defaultWeight: 0.6 },
};

export const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  {
    label: string;
    description: string;
    defaultSeverity: 'low' | 'medium' | 'high';
  }
> = {
  plot_hole: {
    label: '情节漏洞',
    description: '故事情节中存在的逻辑漏洞',
    defaultSeverity: 'high',
  },
  character_inconsistency: {
    label: '人物不一致',
    description: '人物性格或行为前后矛盾',
    defaultSeverity: 'high',
  },
  timeline_error: {
    label: '时间线错误',
    description: '时间线存在矛盾或错误',
    defaultSeverity: 'medium',
  },
  dialogue_unnatural: {
    label: '对话不自然',
    description: '对话内容不符合人物特点或过于生硬',
    defaultSeverity: 'medium',
  },
  description_redundant: {
    label: '描写冗余',
    description: '存在重复或不必要的描写',
    defaultSeverity: 'low',
  },
  pacing_issue: { label: '节奏问题', description: '故事节奏过快或过慢', defaultSeverity: 'medium' },
  grammar_error: { label: '语法错误', description: '存在语法或标点错误', defaultSeverity: 'low' },
  style_inconsistent: {
    label: '风格不一致',
    description: '写作风格前后不统一',
    defaultSeverity: 'medium',
  },
  foreshadowing_unresolved: {
    label: '伏笔未回收',
    description: '埋下的伏笔未得到回应',
    defaultSeverity: 'medium',
  },
  logic_flaw: { label: '逻辑缺陷', description: '推理或因果关系存在问题', defaultSeverity: 'high' },
};
