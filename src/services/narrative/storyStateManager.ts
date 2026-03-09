import type {
  StoryState,
  CharacterState,
  RelationshipState,
  ConflictState,
  TimelineEventState,
  PlantedForeshadow,
  StateChange,
  StateSnapshot,
} from '@/types/narrative/storyState';
import { narrativePersistenceService } from './narrativePersistenceService';
import { logger } from '../core/loggerService';
import { v4 as uuidv4 } from 'uuid';

export class StoryStateManager {
  private state: StoryState;
  private changeHistory: StateChange[] = [];
  private snapshots: StateSnapshot[] = [];
  private maxHistorySize: number = 1000;
  private maxSnapshots: number = 50;
  private isLoaded: boolean = false;

  constructor() {
    this.state = this.createInitialState();
  }

  async loadFromPersistence(): Promise<void> {
    if (this.isLoaded) return;

    try {
      await narrativePersistenceService.initialize();
      const savedState = await narrativePersistenceService.loadStoryState();
      const savedSnapshots = await narrativePersistenceService.loadSnapshots();
      const savedChanges = await narrativePersistenceService.loadChanges();

      if (savedState) {
        this.state = savedState;
      }
      this.snapshots = savedSnapshots;
      this.changeHistory = savedChanges;

      this.isLoaded = true;
      logger.debug('Story state loaded from persistence', {
        hasState: !!savedState,
        snapshotCount: this.snapshots.length,
        changeCount: this.changeHistory.length,
      });
    } catch (error) {
      logger.error('Failed to load story state from persistence', { error: String(error) });
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      await narrativePersistenceService.saveStoryState(this.state);
    } catch (error) {
      logger.error('Failed to save story state to persistence', { error: String(error) });
    }
  }

  private createInitialState(): StoryState {
    return {
      characters: {},
      plot: {
        currentArc: '',
        currentChapter: 1,
        activePlotLines: [],
        completedPlotLines: [],
        pendingConflicts: [],
      },
      world: {
        currentLocation: '',
        activeEvents: [],
        globalFlags: {},
        customState: {},
      },
      timeline: {
        currentTime: 0,
        events: [],
      },
      foreshadowing: {
        planted: [],
        resolved: [],
      },
      lastUpdated: Date.now(),
    };
  }

  getState(): StoryState {
    return { ...this.state };
  }

  async updateCharacter(
    characterId: string,
    updates: Partial<CharacterState>,
    reason?: string
  ): Promise<void> {
    await this.loadFromPersistence();

    const oldState = this.state.characters[characterId];
    const newState = { ...oldState, ...updates } as CharacterState;

    this.state.characters[characterId] = newState;
    this.state.lastUpdated = Date.now();

    this.recordChange('characters', characterId, oldState, newState, reason);
    await this.saveToPersistence();
  }

  async addCharacter(character: CharacterState): Promise<void> {
    await this.loadFromPersistence();

    this.state.characters[character.id] = character;
    this.state.lastUpdated = Date.now();

    this.recordChange('characters', character.id, undefined, character, 'character_added');
    await this.saveToPersistence();
  }

  async removeCharacter(characterId: string): Promise<void> {
    await this.loadFromPersistence();

    const oldState = this.state.characters[characterId];
    delete this.state.characters[characterId];
    this.state.lastUpdated = Date.now();

    this.recordChange('characters', characterId, oldState, undefined, 'character_removed');
    await this.saveToPersistence();
  }

  getCharacter(characterId: string): CharacterState | undefined {
    return this.state.characters[characterId];
  }

  getAllCharacters(): CharacterState[] {
    return Object.values(this.state.characters);
  }

  async updateRelationship(
    characterId: string,
    targetId: string,
    updates: Partial<RelationshipState>
  ): Promise<void> {
    await this.loadFromPersistence();

    const character = this.state.characters[characterId];
    if (!character) return;

    const oldRelationship = character.relationships.find((r) => r.targetId === targetId);
    const relationshipIndex = character.relationships.findIndex((r) => r.targetId === targetId);

    if (relationshipIndex >= 0) {
      character.relationships[relationshipIndex] = {
        ...oldRelationship,
        ...updates,
      } as RelationshipState;
    } else {
      character.relationships.push({
        targetId,
        targetName: updates.targetName || '',
        type: updates.type || 'neutral',
        strength: updates.strength || 0,
        ...updates,
      } as RelationshipState);
    }

    this.state.lastUpdated = Date.now();
    this.recordChange('characters', `${characterId}.relationships.${targetId}`, oldRelationship, updates, 'relationship_updated');
    await this.saveToPersistence();
  }

  async updatePlot(updates: Partial<StoryState['plot']>, reason?: string): Promise<void> {
    await this.loadFromPersistence();

    const oldState = { ...this.state.plot };
    this.state.plot = { ...this.state.plot, ...updates };
    this.state.lastUpdated = Date.now();

    this.recordChange('plot', 'plot', oldState, this.state.plot, reason);
    await this.saveToPersistence();
  }

  async addConflict(conflict: Omit<ConflictState, 'id'>): Promise<string> {
    await this.loadFromPersistence();

    const id = uuidv4();
    const newConflict: ConflictState = { ...conflict, id };

    this.state.plot.pendingConflicts.push(newConflict);
    this.state.lastUpdated = Date.now();

    this.recordChange('plot', 'conflicts', undefined, newConflict, 'conflict_added');
    await this.saveToPersistence();
    return id;
  }

  async resolveConflict(conflictId: string): Promise<void> {
    await this.loadFromPersistence();

    const conflict = this.state.plot.pendingConflicts.find((c) => c.id === conflictId);
    if (conflict) {
      conflict.status = 'resolved';
      this.state.plot.completedPlotLines.push(conflictId);
      this.state.plot.pendingConflicts = this.state.plot.pendingConflicts.filter(
        (c) => c.id !== conflictId
      );
      this.state.lastUpdated = Date.now();

      this.recordChange('plot', `conflicts.${conflictId}`, conflict, { status: 'resolved' }, 'conflict_resolved');
      await this.saveToPersistence();
    }
  }

  async updateWorld(updates: Partial<StoryState['world']>, reason?: string): Promise<void> {
    await this.loadFromPersistence();

    const oldState = { ...this.state.world };
    this.state.world = { ...this.state.world, ...updates };
    this.state.lastUpdated = Date.now();

    this.recordChange('world', 'world', oldState, this.state.world, reason);
    await this.saveToPersistence();
  }

  async setGlobalFlag(key: string, value: boolean): Promise<void> {
    await this.loadFromPersistence();

    const oldValue = this.state.world.globalFlags[key];
    this.state.world.globalFlags[key] = value;
    this.state.lastUpdated = Date.now();

    this.recordChange('world', `globalFlags.${key}`, oldValue, value, 'flag_set');
    await this.saveToPersistence();
  }

  getGlobalFlag(key: string): boolean | undefined {
    return this.state.world.globalFlags[key];
  }

  async addTimelineEvent(event: Omit<TimelineEventState, 'id'>): Promise<string> {
    await this.loadFromPersistence();

    const id = uuidv4();
    const newEvent: TimelineEventState = { ...event, id };

    this.state.timeline.events.push(newEvent);
    this.state.timeline.lastEventId = id;
    this.state.timeline.currentTime = event.timestamp;
    this.state.lastUpdated = Date.now();

    this.recordChange('timeline', 'events', undefined, newEvent, 'event_added');
    await this.saveToPersistence();
    return id;
  }

  getTimelineEvents(from?: number, to?: number): TimelineEventState[] {
    return this.state.timeline.events.filter((e) => {
      if (from !== undefined && e.timestamp < from) return false;
      if (to !== undefined && e.timestamp > to) return false;
      return true;
    });
  }

  async plantForeshadow(foreshadow: Omit<PlantedForeshadow, 'id' | 'plantedAt'>): Promise<string> {
    await this.loadFromPersistence();

    const id = uuidv4();
    const newForeshadow: PlantedForeshadow = {
      ...foreshadow,
      id,
      plantedAt: Date.now(),
    };

    this.state.foreshadowing.planted.push(newForeshadow);
    this.state.lastUpdated = Date.now();

    this.recordChange('foreshadowing', 'planted', undefined, newForeshadow, 'foreshadow_planted');
    await this.saveToPersistence();
    return id;
  }

  async resolveForeshadow(foreshadowId: string): Promise<void> {
    await this.loadFromPersistence();

    if (!this.state.foreshadowing.resolved.includes(foreshadowId)) {
      this.state.foreshadowing.resolved.push(foreshadowId);
      this.state.lastUpdated = Date.now();

      this.recordChange('foreshadowing', `resolved.${foreshadowId}`, false, true, 'foreshadow_resolved');
      await this.saveToPersistence();
    }
  }

  getUnresolvedForeshadows(): PlantedForeshadow[] {
    return this.state.foreshadowing.planted.filter(
      (f) => !this.state.foreshadowing.resolved.includes(f.id)
    );
  }

  async createSnapshot(label?: string): Promise<string> {
    await this.loadFromPersistence();

    const snapshot: StateSnapshot = {
      state: JSON.parse(JSON.stringify(this.state)),
      changes: [...this.changeHistory],
      createdAt: Date.now(),
      label,
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    await narrativePersistenceService.saveSnapshot(snapshot);

    logger.debug('Story state snapshot created', { label, totalSnapshots: this.snapshots.length });
    return snapshot.createdAt.toString();
  }

  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    await this.loadFromPersistence();

    const snapshot = this.snapshots.find((s) => s.createdAt.toString() === snapshotId);
    if (!snapshot) return false;

    this.state = JSON.parse(JSON.stringify(snapshot.state));
    this.changeHistory = [...snapshot.changes];

    await this.saveToPersistence();

    logger.debug('Story state restored from snapshot', { snapshotId });
    return true;
  }

  getSnapshots(): Array<{ id: string; label?: string; createdAt: number }> {
    return this.snapshots.map((s) => ({
      id: s.createdAt.toString(),
      label: s.label,
      createdAt: s.createdAt,
    }));
  }

  getChangeHistory(limit?: number): StateChange[] {
    const history = [...this.changeHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  private recordChange(
    type: keyof StoryState,
    path: string,
    oldValue: unknown,
    newValue: unknown,
    reason?: string
  ): void {
    const change: StateChange = {
      type,
      path,
      oldValue,
      newValue,
      timestamp: Date.now(),
      reason,
    };

    this.changeHistory.push(change);

    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  reset(): void {
    this.state = this.createInitialState();
    this.changeHistory = [];
    logger.debug('Story state reset');
  }

  exportState(): string {
    return JSON.stringify({
      state: this.state,
      history: this.changeHistory,
      snapshots: this.snapshots,
    });
  }

  importState(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.state = parsed.state;
      this.changeHistory = parsed.history || [];
      this.snapshots = parsed.snapshots || [];
      logger.debug('Story state imported');
    } catch (error) {
      logger.error('Failed to import story state', { error: String(error) });
      throw new Error('Invalid state data');
    }
  }
}

export const storyStateManager = new StoryStateManager();
