export type ArcStageType =
  | 'setup'
  | 'catalyst'
  | 'resistance'
  | 'midpoint'
  | 'crisis'
  | 'climax'
  | 'resolution'
  | 'transformation';

export type ArcStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export type RelationshipType =
  | 'family'
  | 'friend'
  | 'lover'
  | 'enemy'
  | 'rival'
  | 'ally'
  | 'mentor'
  | 'student'
  | 'colleague'
  | 'stranger'
  | 'acquaintance'
  | 'superior'
  | 'subordinate'
  | 'master'
  | 'disciple'
  | 'other';

export type RelationshipStatus = 'active' | 'strained' | 'broken' | 'healed' | 'evolved';

export interface CharacterArc {
  id: string;
  characterId: string;
  characterName: string;
  name: string;
  description: string;
  status: ArcStatus;

  stages: ArcStage[];

  startingState: CharacterState;
  endingState: CharacterState;

  keyDecisions: Array<{
    stageId: string;
    decision: string;
    consequence: string;
  }>;

  lessons: string[];
  transformation: string;

  relatedPlotNodes: string[];
  relatedSubplots: string[];

  createdAt: number;
  updatedAt: number;
}

export interface ArcStage {
  id: string;
  arcId: string;
  sequence: number;
  type: ArcStageType;
  title: string;
  description: string;

  internalConflict: string;
  externalConflict: string;

  emotionalState: string;
  belief: string;
  motivation: string;

  keyEvents: string[];
  chapter?: string;

  status: 'planned' | 'written' | 'revised';
  notes: string;
}

export interface CharacterState {
  beliefs: string[];
  values: string[];
  fears: string[];
  desires: string[];
  flaws: string[];
  strengths: string[];
  emotionalBaseline: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;

  type: RelationshipType;
  subtype?: string;
  status: RelationshipStatus;

  description: string;
  history: string;

  startChapter?: string;
  currentChapter?: string;

  dynamics: RelationshipDynamic[];
  keyMoments: RelationshipMoment[];

  conflicts: string[];
  bonds: string[];

  evolution: RelationshipEvolution[];

  intimacy: number;
  trust: number;
  respect: number;

  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipDynamic {
  aspect: string;
  description: string;
  tension: number;
}

export interface RelationshipMoment {
  chapter: string;
  event: string;
  impact: 'positive' | 'negative' | 'neutral' | 'transformative';
  description: string;
  intimacyChange: number;
  trustChange: number;
}

export interface RelationshipEvolution {
  chapter: string;
  fromType: RelationshipType;
  toType: RelationshipType;
  reason: string;
}

export interface RelationshipNetwork {
  characterId: string;
  characterName: string;
  relationships: Relationship[];

  clusters: RelationshipCluster[];
  centralCharacters: string[];

  networkStats: NetworkStats;
}

export interface RelationshipCluster {
  id: string;
  name: string;
  characterIds: string[];
  type: 'family' | 'faction' | 'location' | 'profession' | 'custom';
  description: string;
}

export interface NetworkStats {
  totalConnections: number;
  averageDistance: number;
  clustering: number;
  centrality: number;
  bridges: string[];
}

export interface ArcAnalysis {
  completeness: number;
  consistency: number;
  emotionalJourney: string[];
  gaps: ArcGap[];
  suggestions: ArcSuggestion[];
}

export interface ArcGap {
  id: string;
  type: 'missing_stage' | 'unclear_motivation' | 'rushed_transformation';
  description: string;
  suggestedFix: string;
}

export interface ArcSuggestion {
  id: string;
  type: 'add_conflict' | 'deepen_emotion' | 'clarify_motivation' | 'add_milestone';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export const ARC_STAGE_LABELS: Record<ArcStageType, string> = {
  setup: '铺垫',
  catalyst: '催化剂',
  resistance: '抵抗',
  midpoint: '中点转折',
  crisis: '危机',
  climax: '高潮',
  resolution: '解决',
  transformation: '转变',
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  family: '家人',
  friend: '朋友',
  lover: '恋人',
  enemy: '敌人',
  rival: '对手',
  ally: '盟友',
  mentor: '导师',
  student: '学生',
  colleague: '同事',
  stranger: '陌生人',
  acquaintance: '熟人',
  superior: '上级',
  subordinate: '下属',
  master: '师父',
  disciple: '弟子',
  other: '其他',
};

export const RELATIONSHIP_STATUS_LABELS: Record<RelationshipStatus, string> = {
  active: '正常',
  strained: '紧张',
  broken: '破裂',
  healed: '修复',
  evolved: '演变',
};

export const ARC_STAGE_DESCRIPTIONS: Record<ArcStageType, string> = {
  setup: '介绍角色的初始状态和世界观',
  catalyst: '打破平衡，引发角色变化的事件',
  resistance: '角色对变化的抵抗和挣扎',
  midpoint: '角色开始意识到需要改变',
  crisis: '角色面临最大的挑战和选择',
  climax: '角色做出关键决定并采取行动',
  resolution: '变化的结果和新的平衡',
  transformation: '角色完成内在转变',
};
