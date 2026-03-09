export type TimelineType =
  | 'main_character'
  | 'supporting_character'
  | 'world_event'
  | 'location_event';

export type TimelineVisibility = 'visible' | 'hidden' | 'collapsed';

export interface ExtendedTimelineEvent {
  id: string;
  title: string;
  description: string;

  timelineType: TimelineType;

  storyTime: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    display: string;
  };
  realTime?: number;

  characterId?: string;
  characterName?: string;
  locationId?: string;
  locationName?: string;

  plotNodeId?: string;
  chapterId?: string;

  significance: 'critical' | 'major' | 'minor' | 'background';
  emotionalBeat?: string;

  participants: EventParticipant[];
  consequences: string[];
  relatedEvents: string[];

  tags: string[];
  notes: string;

  createdAt: number;
  updatedAt: number;
}

export interface EventParticipant {
  characterId: string;
  characterName: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'observer' | 'victim' | 'beneficiary';
  perspective: boolean;
}

export interface CharacterTimelineTrack {
  characterId: string;
  characterName: string;
  characterRole: 'protagonist' | 'major' | 'supporting' | 'minor';
  events: ExtendedTimelineEvent[];
  currentState: CharacterTimelineState;
  visibility: TimelineVisibility;
  color: string;
}

export interface CharacterTimelineState {
  location: string;
  status: string;
  powerLevel?: string;
  emotionalState?: string;
  relationships: Array<{ targetId: string; type: string }>;
  lastAppearance: number;
}

export interface WorldEventTrack {
  id: string;
  name: string;
  type: 'political' | 'military' | 'natural' | 'economic' | 'cultural' | 'mystical' | 'other';
  description: string;
  events: ExtendedTimelineEvent[];
  affectedRegions: string[];
  affectedCharacters: string[];
  visibility: TimelineVisibility;
  color: string;
}

export interface LocationTimelineTrack {
  locationId: string;
  locationName: string;
  locationType: string;
  events: ExtendedTimelineEvent[];
  currentOccupants: string[];
  visibility: TimelineVisibility;
  color: string;
}

export interface TimelineSync {
  sourceEventId: string;
  targetEventId: string;
  syncType: 'simultaneous' | 'before' | 'after' | 'during';
  offset?: number;
}

export interface MultiTimelineView {
  characterTracks: CharacterTimelineTrack[];
  worldTracks: WorldEventTrack[];
  locationTracks: LocationTimelineTrack[];
  syncs: TimelineSync[];
  currentTime: {
    storyTime: string;
    displayTime: string;
  };
  zoomLevel: 'decade' | 'year' | 'month' | 'week' | 'day' | 'hour';
}

export interface TimelineAnalysis {
  gaps: TimelineGap[];
  conflicts: TimelineConflict[];
  suggestions: TimelineSuggestion[];
  parallelEvents: ParallelEventGroup[];
}

export interface TimelineGap {
  id: string;
  type: 'character_missing' | 'world_event_gap' | 'location_undefined';
  description: string;
  characterId?: string;
  locationId?: string;
  startTime: number;
  endTime: number;
  suggestedEvents: string[];
}

export interface TimelineConflict {
  id: string;
  type: 'location_conflict' | 'character_conflict' | 'time_conflict';
  description: string;
  eventIds: string[];
  severity: 'critical' | 'major' | 'minor';
  suggestion: string;
}

export interface TimelineSuggestion {
  id: string;
  type: 'add_event' | 'merge_events' | 'split_event' | 'reorder';
  description: string;
  relatedEvents: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ParallelEventGroup {
  id: string;
  name: string;
  events: ExtendedTimelineEvent[];
  startTime: number;
  endTime: number;
  description: string;
}

export const TIMELINE_COLORS = {
  protagonist: '#3B82F6',
  major: '#10B981',
  supporting: '#F59E0B',
  minor: '#6B7280',
  world_political: '#EF4444',
  world_military: '#DC2626',
  world_natural: '#059669',
  world_economic: '#D97706',
  world_cultural: '#7C3AED',
  world_mystical: '#8B5CF6',
  world_other: '#6B7280',
};

export const EVENT_SIGNIFICANCE_LABELS = {
  critical: '关键事件',
  major: '重要事件',
  minor: '次要事件',
  background: '背景事件',
};

export const PARTICIPANT_ROLE_LABELS = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
  observer: '旁观者',
  victim: '受害者',
  beneficiary: '受益者',
};

export const WORLD_EVENT_TYPE_LABELS = {
  political: '政治事件',
  military: '军事事件',
  natural: '自然灾害',
  economic: '经济事件',
  cultural: '文化事件',
  mystical: '神秘事件',
  other: '其他事件',
};
