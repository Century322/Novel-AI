export type IterationPhase = 'generate' | 'evaluate' | 'revise' | 'verify' | 'complete';

export type IterationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type RevisionType =
  | 'quality_improvement'
  | 'style_adjustment'
  | 'content_expansion'
  | 'content_reduction'
  | 'logic_fix'
  | 'character_consistency'
  | 'pacing_adjustment';

export interface IterationCycle {
  id: string;
  name: string;
  description: string;
  status: IterationStatus;

  target: {
    type: 'chapter' | 'section' | 'scene' | 'dialogue';
    id: string;
    name: string;
  };

  phases: IterationPhaseData[];
  currentPhase: IterationPhase;
  currentIteration: number;
  maxIterations: number;

  config: IterationConfig;

  results: IterationResult[];
  finalOutput: string | null;

  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface IterationPhaseData {
  phase: IterationPhase;
  status: IterationStatus;
  startedAt?: number;
  completedAt?: number;
  input: string;
  output: string;
  metrics?: Record<string, number>;
  notes: string;
}

export interface IterationConfig {
  qualityThreshold: number;
  maxIterations: number;
  focusDimensions: string[];
  revisionTypes: RevisionType[];
  autoApply: boolean;
  preserveOriginal: boolean;
  feedbackStyle: 'detailed' | 'concise' | 'minimal';
}

export interface IterationResult {
  iteration: number;
  phase: IterationPhase;

  input: string;
  output: string;

  qualityScore: number;
  dimensionScores: Record<string, number>;

  issues: IterationIssue[];
  improvements: string[];

  revisionApplied: string;
  timeTaken: number;
}

export interface IterationIssue {
  id: string;
  type: RevisionType;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  location: {
    start: number;
    end: number;
    excerpt: string;
  };
  suggestedFix: string;
  applied: boolean;
}

export interface RevisionPlan {
  id: string;
  cycleId: string;
  iteration: number;

  issues: IterationIssue[];
  priorities: Array<{
    issueId: string;
    priority: number;
    reason: string;
  }>;

  strategy: RevisionStrategy;
  estimatedImpact: number;
}

export interface RevisionStrategy {
  type: RevisionType;
  approach: string;
  steps: string[];
  examples: string[];
}

export interface IterationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;

  config: Partial<IterationConfig>;
  phases: Array<{
    phase: IterationPhase;
    enabled: boolean;
    customPrompt?: string;
  }>;

  successCriteria: Array<{
    dimension: string;
    minScore: number;
    required: boolean;
  }>;
}

export const ITERATION_PHASE_LABELS: Record<IterationPhase, string> = {
  generate: '生成',
  evaluate: '评估',
  revise: '修改',
  verify: '验证',
  complete: '完成',
};

export const REVISION_TYPE_LABELS: Record<RevisionType, string> = {
  quality_improvement: '质量提升',
  style_adjustment: '风格调整',
  content_expansion: '内容扩充',
  content_reduction: '内容精简',
  logic_fix: '逻辑修正',
  character_consistency: '人物一致性',
  pacing_adjustment: '节奏调整',
};

export const DEFAULT_ITERATION_CONFIG: IterationConfig = {
  qualityThreshold: 75,
  maxIterations: 3,
  focusDimensions: ['plot', 'character', 'dialogue', 'emotion'],
  revisionTypes: ['quality_improvement', 'style_adjustment', 'logic_fix'],
  autoApply: false,
  preserveOriginal: true,
  feedbackStyle: 'detailed',
};

export const BUILTIN_ITERATION_TEMPLATES: IterationTemplate[] = [
  {
    id: 'template_quick_polish',
    name: '快速润色',
    description: '快速提升文本质量，适合小范围修改',
    category: 'quick',
    config: {
      qualityThreshold: 70,
      maxIterations: 2,
      feedbackStyle: 'concise',
    },
    phases: [
      { phase: 'generate', enabled: false },
      { phase: 'evaluate', enabled: true },
      { phase: 'revise', enabled: true },
      { phase: 'verify', enabled: true },
    ],
    successCriteria: [
      { dimension: 'readability', minScore: 70, required: true },
      { dimension: 'style', minScore: 65, required: false },
    ],
  },
  {
    id: 'template_deep_optimize',
    name: '深度优化',
    description: '全面优化文本质量，适合重要章节',
    category: 'thorough',
    config: {
      qualityThreshold: 80,
      maxIterations: 5,
      feedbackStyle: 'detailed',
    },
    phases: [
      { phase: 'generate', enabled: false },
      { phase: 'evaluate', enabled: true },
      { phase: 'revise', enabled: true },
      { phase: 'verify', enabled: true },
    ],
    successCriteria: [
      { dimension: 'plot', minScore: 75, required: true },
      { dimension: 'character', minScore: 75, required: true },
      { dimension: 'dialogue', minScore: 70, required: false },
      { dimension: 'emotion', minScore: 75, required: false },
    ],
  },
  {
    id: 'template_style_match',
    name: '风格匹配',
    description: '调整文本以匹配特定风格档案',
    category: 'style',
    config: {
      qualityThreshold: 75,
      maxIterations: 3,
      revisionTypes: ['style_adjustment'],
    },
    phases: [
      { phase: 'evaluate', enabled: true },
      { phase: 'revise', enabled: true },
      { phase: 'verify', enabled: true },
    ],
    successCriteria: [{ dimension: 'style', minScore: 80, required: true }],
  },
];
