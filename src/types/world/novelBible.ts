export const NOVEL_BIBLE_VERSION = 1;

export type BibleCharacterRole =
  | 'protagonist'
  | 'deuteragonist'
  | 'antagonist'
  | 'supporting'
  | 'minor';

export type BibleCharacterStatus = 'active' | 'missing' | 'deceased' | 'retired';

export interface NovelBibleMetadata {
  version: number;
  projectId: string;
  projectName: string;
  title: string;
  genre: string;
  targetWordCount: number;
  targetChapterCount: number;
  logline: string;
  themes: string[];
  audience: string;
  tone: string;
  writingConstraints: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NovelBibleWorld {
  premise: string;
  worldview: string;
  powerSystem: string;
  regions: string[];
  factions: string[];
  rules: string[];
  taboo: string[];
  unresolvedQuestions: string[];
}

export interface NovelBibleCharacter {
  id: string;
  name: string;
  aliases: string[];
  role: BibleCharacterRole;
  summary: string;
  viewpoint: boolean;
  status: BibleCharacterStatus;
  goals: {
    shortTerm: string[];
    longTerm: string[];
  };
  arc: {
    start: string;
    midpoint: string;
    end: string;
  };
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NovelBibleRelationship {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: string;
  status: string;
  notes: string;
  updatedAt: number;
}

export type NovelTimelineTrackType = 'main' | 'subplot' | 'character' | 'faction' | 'world';

export type NovelTimelineEventPhase = 'setup' | 'rising' | 'climax' | 'fallout' | 'transition';

export type NovelTimelineEventStatus = 'planned' | 'drafted' | 'published' | 'retired';

export interface NovelBibleTimelineEvent {
  id: string;
  title: string;
  summary: string;
  phase: NovelTimelineEventPhase;
  timeLabel: string;
  chapterHint: string;
  povCharacterId?: string;
  participants: string[];
  dependencies: string[];
  status: NovelTimelineEventStatus;
  tags: string[];
  updatedAt: number;
}

export interface NovelBibleTimelineTrack {
  id: string;
  name: string;
  type: NovelTimelineTrackType;
  description: string;
  isActive: boolean;
  events: NovelBibleTimelineEvent[];
  updatedAt: number;
}

export type ForeshadowingStatus = 'seeded' | 'hinted' | 'paid_off' | 'discarded';

export interface NovelBibleForeshadowing {
  id: string;
  title: string;
  seed: string;
  payoffPlan: string;
  status: ForeshadowingStatus;
  plantedIn: string;
  payoffIn: string;
  relatedCharacterIds: string[];
  priority: 'high' | 'medium' | 'low';
  notes: string;
  updatedAt: number;
}

export interface NovelBible {
  metadata: NovelBibleMetadata;
  world: NovelBibleWorld;
  characters: NovelBibleCharacter[];
  relationships: NovelBibleRelationship[];
  timelineTracks: NovelBibleTimelineTrack[];
  foreshadowing: NovelBibleForeshadowing[];
  notes: string[];
}

export type NovelBibleSection =
  | 'metadata'
  | 'world'
  | 'characters'
  | 'relationships'
  | 'timelineTracks'
  | 'foreshadowing'
  | 'notes';

export interface NovelBibleValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path: string;
}

export interface NovelBibleValidationResult {
  valid: boolean;
  score: number;
  issues: NovelBibleValidationIssue[];
  summary: string;
}

export function createEmptyNovelBible(projectId: string, projectName: string): NovelBible {
  const now = Date.now();
  return {
    metadata: {
      version: NOVEL_BIBLE_VERSION,
      projectId,
      projectName,
      title: projectName,
      genre: '',
      targetWordCount: 100000,
      targetChapterCount: 100,
      logline: '',
      themes: [],
      audience: '',
      tone: '',
      writingConstraints: [],
      createdAt: now,
      updatedAt: now,
    },
    world: {
      premise: '',
      worldview: '',
      powerSystem: '',
      regions: [],
      factions: [],
      rules: [],
      taboo: [],
      unresolvedQuestions: [],
    },
    characters: [],
    relationships: [],
    timelineTracks: [],
    foreshadowing: [],
    notes: [],
  };
}
