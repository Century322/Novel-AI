export type SubplotStatus = 'planned' | 'active' | 'paused' | 'completed' | 'abandoned';

export type SubplotType =
  | 'romance'
  | 'mystery'
  | 'revenge'
  | 'growth'
  | 'conflict'
  | 'exploration'
  | 'political'
  | 'economic'
  | 'military'
  | 'personal';

export type ThreadWeaveType =
  | 'convergence'
  | 'divergence'
  | 'parallel'
  | 'intersection'
  | 'crossover';

export interface Subplot {
  id: string;
  name: string;
  type: SubplotType;
  description: string;
  status: SubplotStatus;

  mainCharacterId: string;
  mainCharacterName: string;
  supportingCharacters: Array<{
    characterId: string;
    characterName: string;
    role: string;
  }>;

  startNodeId: string;
  currentNodeId: string | null;
  endNodeId: string | null;
  nodes: SubplotNode[];

  relatedMainPlotNodes: string[];
  dependencies: string[];

  emotionalArc: EmotionalArc;
  pacing: SubplotPacing;

  visibility: 'foreground' | 'background' | 'hidden';
  priority: number;

  createdAt: number;
  updatedAt: number;
}

export interface SubplotNode {
  id: string;
  subplotId: string;
  sequence: number;
  title: string;
  description: string;

  type: 'setup' | 'development' | 'complication' | 'climax' | 'resolution';

  mainPlotSyncPoint?: string;
  weaveType?: ThreadWeaveType;

  characters: string[];
  location: string;

  emotionalBeat: string;
  tensionLevel: number;

  chapter?: string;
  status: 'planned' | 'written' | 'revised';

  notes: string;
}

export interface EmotionalArc {
  startEmotion: string;
  endEmotion: string;
  keyMoments: Array<{
    nodeId: string;
    emotion: string;
    description: string;
  }>;
  transformation: string;
}

export interface SubplotPacing {
  intensity: 'slow' | 'moderate' | 'fast';
  frequency: number;
  distribution: Array<{
    chapter: number;
    presence: boolean;
    intensity: number;
  }>;
}

export interface ThreadWeave {
  id: string;
  name: string;
  type: ThreadWeaveType;

  mainPlotNodeId: string;
  subplotNodeId: string;
  subplotId: string;

  description: string;
  impact: 'major' | 'moderate' | 'minor';

  charactersInvolved: string[];
  consequences: string[];

  chapter: string;
  notes: string;
}

export interface PlotInterweave {
  id: string;
  name: string;
  description: string;

  mainPlotSegment: {
    startNode: string;
    endNode: string;
  };

  subplots: Array<{
    subplotId: string;
    startNode: string;
    endNode: string;
    weaveType: ThreadWeaveType;
  }>;

  weavingPattern: WeavingPattern;
  tensionFlow: number[];

  createdAt: number;
}

export interface WeavingPattern {
  type: 'alternating' | 'nested' | 'parallel' | 'convergent' | 'divergent';
  rhythm: number[];
  description: string;
}

export interface SubplotAnalysis {
  activeSubplots: number;
  weavingDensity: number;
  balance: {
    mainPlotRatio: number;
    subplotRatio: number;
  };
  gaps: SubplotGap[];
  conflicts: SubplotConflict[];
  suggestions: SubplotSuggestion[];
}

export interface SubplotGap {
  id: string;
  subplotId: string;
  subplotName: string;
  type: 'missing_development' | 'long_absence' | 'incomplete_arc';
  description: string;
  suggestedAction: string;
}

export interface SubplotConflict {
  id: string;
  type: 'timeline_conflict' | 'character_conflict' | 'location_conflict';
  subplotIds: string[];
  description: string;
  severity: 'major' | 'minor';
  suggestion: string;
}

export interface SubplotSuggestion {
  id: string;
  type: 'add_weave' | 'adjust_pacing' | 'resolve_subplot' | 'introduce_subplot';
  description: string;
  relatedSubplots: string[];
  priority: 'high' | 'medium' | 'low';
}

export const SUBPLOT_TYPE_LABELS: Record<SubplotType, string> = {
  romance: '感情线',
  mystery: '悬疑线',
  revenge: '复仇线',
  growth: '成长线',
  conflict: '冲突线',
  exploration: '探索线',
  political: '政治线',
  economic: '经济线',
  military: '军事线',
  personal: '个人线',
};

export const WEAVE_TYPE_LABELS: Record<ThreadWeaveType, string> = {
  convergence: '汇聚',
  divergence: '分叉',
  parallel: '并行',
  intersection: '交叉',
  crossover: '穿越',
};

export const SUBPLOT_STATUS_LABELS: Record<SubplotStatus, string> = {
  planned: '计划中',
  active: '进行中',
  paused: '暂停',
  completed: '已完成',
  abandoned: '已放弃',
};

export const WEAVING_PATTERN_DESCRIPTIONS: Record<WeavingPattern['type'], string> = {
  alternating: '主线与支线交替出现',
  nested: '支线嵌套在主线之中',
  parallel: '主线支线同时推进',
  convergent: '多条线汇聚到一点',
  divergent: '从一点分出多条线',
};
