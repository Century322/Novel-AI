export type ContradictionType =
  | 'character_behavior'
  | 'character_ability'
  | 'timeline'
  | 'setting'
  | 'relationship'
  | 'plot_logic'
  | 'world_rule'
  | 'dialogue';

export type ContradictionSeverity = 'critical' | 'major' | 'minor' | 'potential';

export type PacingIssueType =
  | 'too_fast'
  | 'too_slow'
  | 'uneven'
  | 'monotonous'
  | 'rushed_ending'
  | 'slow_start';

export type PacingPhase = 'opening' | 'rising' | 'climax' | 'falling' | 'resolution';

export interface Contradiction {
  id: string;
  type: ContradictionType;
  severity: ContradictionSeverity;

  title: string;
  description: string;

  location1: ContradictionLocation;
  location2: ContradictionLocation;

  conflict: string;
  resolution: string;

  autoFixable: boolean;
  suggestedFixes: string[];

  detectedAt: number;
  status: 'detected' | 'acknowledged' | 'resolved' | 'ignored';
}

export interface ContradictionLocation {
  type: 'chapter' | 'paragraph' | 'dialogue' | 'setting_file' | 'character_file';
  reference: string;
  content: string;
  line?: number;
}

export interface PacingAnalysis {
  overallPacing: PacingIssueType | null;
  averageSpeed: number;

  phases: PacingPhaseAnalysis[];

  issues: PacingIssue[];

  tensionCurve: number[];
  emotionCurve: number[];

  recommendations: PacingRecommendation[];
}

export interface PacingPhaseAnalysis {
  phase: PacingPhase;
  startChapter: number;
  endChapter: number;
  speed: number;
  tensionLevel: number;
  eventCount: number;
  issues: string[];
}

export interface PacingIssue {
  id: string;
  type: PacingIssueType;
  location: {
    startChapter: number;
    endChapter: number;
  };
  description: string;
  impact: string;
  suggestion: string;
}

export interface PacingRecommendation {
  id: string;
  type: 'add_content' | 'remove_content' | 'rearrange' | 'adjust_tension' | 'add_transition';
  priority: 'high' | 'medium' | 'low';
  location: {
    chapter: number;
    position?: string;
  };
  description: string;
  example?: string;
  expectedEffect: string;
}

export interface SmartReminder {
  id: string;
  type: 'contradiction' | 'pacing' | 'quality' | 'suggestion';
  priority: 'critical' | 'high' | 'medium' | 'low';

  title: string;
  description: string;

  relatedData: {
    contradictionId?: string;
    pacingIssueId?: string;
    chapterRange?: [number, number];
    characterIds?: string[];
  };

  action: {
    type: 'fix' | 'review' | 'consider' | 'info';
    suggestions: string[];
  };

  createdAt: number;
  expiresAt?: number;
  dismissed: boolean;
}

export interface ContradictionRule {
  id: string;
  name: string;
  type: ContradictionType;
  description: string;
  checkFunction: string;
  severity: ContradictionSeverity;
  autoFixAvailable: boolean;
}

export const CONTRADICTION_TYPE_LABELS: Record<ContradictionType, string> = {
  character_behavior: '人物行为矛盾',
  character_ability: '人物能力矛盾',
  timeline: '时间线矛盾',
  setting: '设定矛盾',
  relationship: '关系矛盾',
  plot_logic: '剧情逻辑矛盾',
  world_rule: '世界规则矛盾',
  dialogue: '对话矛盾',
};

export const CONTRADICTION_SEVERITY_LABELS: Record<ContradictionSeverity, string> = {
  critical: '严重',
  major: '重要',
  minor: '轻微',
  potential: '潜在',
};

export const PACING_ISSUE_LABELS: Record<PacingIssueType, string> = {
  too_fast: '节奏过快',
  too_slow: '节奏过慢',
  uneven: '节奏不均',
  monotonous: '节奏单调',
  rushed_ending: '结局仓促',
  slow_start: '开头拖沓',
};

export const PACING_PHASE_LABELS: Record<PacingPhase, string> = {
  opening: '开篇',
  rising: '上升',
  climax: '高潮',
  falling: '下降',
  resolution: '结局',
};

export const BUILTIN_CONTRADICTION_RULES: ContradictionRule[] = [
  {
    id: 'rule_character_power',
    name: '战力一致性检查',
    type: 'character_ability',
    description: '检查角色战力是否在短时间内不合理变化',
    checkFunction: 'checkPowerConsistency',
    severity: 'major',
    autoFixAvailable: false,
  },
  {
    id: 'rule_character_location',
    name: '位置一致性检查',
    type: 'timeline',
    description: '检查角色是否同时出现在不同地点',
    checkFunction: 'checkLocationConsistency',
    severity: 'critical',
    autoFixAvailable: false,
  },
  {
    id: 'rule_character_relationship',
    name: '关系一致性检查',
    type: 'relationship',
    description: '检查角色关系是否前后矛盾',
    checkFunction: 'checkRelationshipConsistency',
    severity: 'major',
    autoFixAvailable: false,
  },
  {
    id: 'rule_world_rule',
    name: '世界规则检查',
    type: 'world_rule',
    description: '检查是否违反已设定的世界规则',
    checkFunction: 'checkWorldRuleConsistency',
    severity: 'critical',
    autoFixAvailable: false,
  },
  {
    id: 'rule_dialogue_character',
    name: '对话风格检查',
    type: 'dialogue',
    description: '检查对话是否符合角色性格设定',
    checkFunction: 'checkDialogueConsistency',
    severity: 'minor',
    autoFixAvailable: false,
  },
];
