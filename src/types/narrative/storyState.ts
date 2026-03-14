export interface StoryState {
  characters: CharacterStateMap;
  plot: PlotState;
  world: WorldState;
  timeline: TimelineState;
  foreshadowing: ForeshadowingState;
  lastUpdated: number;
}

export interface CharacterStateMap {
  [characterId: string]: CharacterState;
}

export interface CharacterState {
  id: string;
  name: string;
  currentLocation?: string;
  currentStatus: string;
  relationships: RelationshipState[];
  inventory: string[];
  attributes: Record<string, unknown>;
  arcProgress: number;
  lastAppearance?: number;
}

export interface RelationshipState {
  targetId: string;
  targetName: string;
  type: StoryRelationshipType;
  strength: number;
  lastInteraction?: number;
}

export type StoryRelationshipType =
  | 'family'
  | 'friend'
  | 'enemy'
  | 'lover'
  | 'ally'
  | 'rival'
  | 'neutral'
  | 'unknown';

export interface PlotState {
  currentArc: string;
  currentChapter: number;
  activePlotLines: string[];
  completedPlotLines: string[];
  pendingConflicts: ConflictState[];
}

export interface ConflictState {
  id: string;
  description: string;
  parties: string[];
  status: 'active' | 'resolved' | 'suspended';
  intensity: number;
}

export interface WorldState {
  currentLocation: string;
  timeOfDay?: string;
  weather?: string;
  activeEvents: string[];
  globalFlags: Record<string, boolean>;
  customState: Record<string, unknown>;
}

export interface TimelineState {
  currentTime: number;
  events: TimelineEventState[];
  lastEventId?: string;
}

export interface TimelineEventState {
  id: string;
  timestamp: number;
  description: string;
  participants: string[];
  location?: string;
  type: string;
}

export interface ForeshadowingState {
  planted: PlantedForeshadow[];
  resolved: string[];
}

export interface PlantedForeshadow {
  id: string;
  description: string;
  plantedAt: number;
  plantedIn: string;
  expectedResolution?: string;
  importance: 'critical' | 'major' | 'minor';
}

export interface StateChange {
  type: keyof StoryState;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  reason?: string;
}

export interface StateSnapshot {
  state: StoryState;
  changes: StateChange[];
  createdAt: number;
  label?: string;
}
