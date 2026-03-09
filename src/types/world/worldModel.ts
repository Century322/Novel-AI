import type { CharacterProfile } from '../character/characterProfile';
import type { Foreshadowing } from '../plot/foreshadowing';
import type { ExtendedTimelineEvent } from '../plot/extendedTimeline';

export type { CharacterProfile } from '../character/characterProfile';
export type { Foreshadowing } from '../plot/foreshadowing';
export type { ExtendedTimelineEvent } from '../plot/extendedTimeline';

export type OutlineNodeType = 'story' | 'volume' | 'arc' | 'chapter' | 'scene' | 'beat';

export type OutlineStatus = 'planned' | 'drafting' | 'revised' | 'completed' | 'published';

export interface ForeshadowingLink {
  foreshadowingId: string;
  action: 'plant' | 'hint' | 'resolve';
}

export interface PlotPoint {
  id: string;
  type: 'setup' | 'conflict' | 'climax' | 'resolution' | 'twist' | 'revelation';
  description: string;
  emotionalBeat: string;
  characterIds: string[];
  impact: 'major' | 'minor';
}

export interface CharacterAppearance {
  characterId: string;
  characterName: string;
  role: 'viewpoint' | 'major' | 'minor' | 'mentioned';
  firstAppearanceInNode: boolean;
  developmentNotes: string;
}

export interface OutlineNode {
  id: string;
  type: OutlineNodeType;
  title: string;
  summary: string;
  status: OutlineStatus;
  order: number;
  parentId: string | null;
  children: string[];
  wordCount: {
    planned: number;
    actual: number;
  };
  plotPoints: PlotPoint[];
  characterAppearances: CharacterAppearance[];
  foreshadowingLinks: ForeshadowingLink[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldLocation {
  id: string;
  name: string;
  type: 'city' | 'region' | 'building' | 'landmark' | 'country' | 'realm' | 'other';
  description: string;
  parentLocationId: string | null;
  subLocations: string[];
  atmosphere: string;
  notableFeatures: string[];
  history: string;
  currentStatus: string;
  relatedCharacters: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldFaction {
  id: string;
  name: string;
  type: 'kingdom' | 'organization' | 'guild' | 'family' | 'cult' | 'military' | 'commercial' | 'other';
  description: string;
  leaderId: string | null;
  leaderName: string | null;
  members: FactionMember[];
  goals: string[];
  resources: string[];
  territory: string[];
  relationships: FactionRelationship[];
  history: string;
  secrets: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FactionMember {
  characterId: string;
  characterName: string;
  role: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'exiled' | 'deceased';
}

export interface FactionRelationship {
  targetFactionId: string;
  targetFactionName: string;
  type: 'ally' | 'enemy' | 'neutral' | 'vassal' | 'overlord' | 'rival';
  description: string;
}

export interface WorldRule {
  id: string;
  category: 'magic' | 'technology' | 'society' | 'nature' | 'economy' | 'other';
  name: string;
  description: string;
  limitations: string[];
  costs: string[];
  requirements: string[];
  exceptions: string[];
  examples: string[];
  relatedRules: string[];
  createdAt: number;
  updatedAt: number;
}

export interface UserPreference {
  id: string;
  category: 'writing_style' | 'content' | 'character' | 'plot' | 'worldbuilding' | 'general';
  key: string;
  value: string | string[] | number | boolean;
  description: string;
  priority: 'must' | 'should' | 'prefer' | 'avoid' | 'never';
  source: 'explicit' | 'inferred' | 'learned';
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorldModel {
  version: number;
  projectId: string;
  projectName: string;
  characters: {
    items: CharacterProfile[];
    relationships: CharacterRelationshipSummary[];
  };
  timeline: {
    events: ExtendedTimelineEvent[];
    currentTime: {
      storyTime: string;
      displayTime: string;
    };
  };
  foreshadowing: {
    items: Foreshadowing[];
    stats: ForeshadowingStats;
  };
  worldbuilding: {
    locations: WorldLocation[];
    factions: WorldFaction[];
    rules: WorldRule[];
    concepts: WorldConcept[];
  };
  outline: {
    rootId: string | null;
    nodes: OutlineNode[];
    stats: OutlineStats;
  };
  preferences: UserPreference[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    lastSyncAt: number;
    versionHistory: VersionEntry[];
  };
}

export interface CharacterRelationshipSummary {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  type: string;
  evolution: RelationshipEvolution[];
}

export interface RelationshipEvolution {
  chapter: string;
  change: string;
  newStatus: string;
}

export interface ForeshadowingStats {
  total: number;
  planted: number;
  hinted: number;
  resolved: number;
  abandoned: number;
  overdueCount: number;
}

export interface OutlineStats {
  totalNodes: number;
  totalWordCount: {
    planned: number;
    actual: number;
  };
  completionPercentage: number;
  averageChapterLength: number;
}

export interface WorldConcept {
  id: string;
  name: string;
  category: string;
  description: string;
  relatedConcepts: string[];
  examples: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface VersionEntry {
  version: number;
  timestamp: number;
  changes: string[];
  trigger: 'manual' | 'auto' | 'import';
}

export const WORLD_MODEL_VERSION = 1;

export const OUTLINE_STATUS_LABELS: Record<OutlineStatus, { label: string; color: string }> = {
  planned: { label: '计划中', color: '#6B7280' },
  drafting: { label: '草稿中', color: '#F59E0B' },
  revised: { label: '已修订', color: '#3B82F6' },
  completed: { label: '已完成', color: '#10B981' },
  published: { label: '已发布', color: '#8B5CF6' },
};

export const OUTLINE_TYPE_LABELS: Record<OutlineNodeType, { label: string; icon: string }> = {
  story: { label: '故事', icon: 'book' },
  volume: { label: '卷', icon: 'book-open' },
  arc: { label: '篇章', icon: 'layers' },
  chapter: { label: '章节', icon: 'file-text' },
  scene: { label: '场景', icon: 'image' },
  beat: { label: '节拍', icon: 'activity' },
};

export const PREFERENCE_PRIORITY_LABELS: Record<UserPreference['priority'], { label: string; weight: number }> = {
  must: { label: '必须', weight: 1.0 },
  should: { label: '应该', weight: 0.8 },
  prefer: { label: '偏好', weight: 0.6 },
  avoid: { label: '避免', weight: -0.5 },
  never: { label: '禁止', weight: -1.0 },
};

export function createEmptyWorldModel(projectId: string, projectName: string): WorldModel {
  const now = Date.now();
  return {
    version: WORLD_MODEL_VERSION,
    projectId,
    projectName,
    characters: {
      items: [],
      relationships: [],
    },
    timeline: {
      events: [],
      currentTime: {
        storyTime: '',
        displayTime: '故事开始',
      },
    },
    foreshadowing: {
      items: [],
      stats: {
        total: 0,
        planted: 0,
        hinted: 0,
        resolved: 0,
        abandoned: 0,
        overdueCount: 0,
      },
    },
    worldbuilding: {
      locations: [],
      factions: [],
      rules: [],
      concepts: [],
    },
    outline: {
      rootId: null,
      nodes: [],
      stats: {
        totalNodes: 0,
        totalWordCount: { planned: 0, actual: 0 },
        completionPercentage: 0,
        averageChapterLength: 0,
      },
    },
    preferences: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      lastSyncAt: now,
      versionHistory: [
        {
          version: 1,
          timestamp: now,
          changes: ['初始化世界模型'],
          trigger: 'manual',
        },
      ],
    },
  };
}
