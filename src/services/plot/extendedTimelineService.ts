import {
  ExtendedTimelineEvent,
  CharacterTimelineTrack,
  WorldEventTrack,
  LocationTimelineTrack,
  TimelineSync,
  MultiTimelineView,
  TimelineAnalysis,
  TimelineGap,
  TimelineConflict,
  TimelineSuggestion,
  ParallelEventGroup,
  TimelineType,
  TimelineVisibility,
  TIMELINE_COLORS,
} from '@/types/plot/extendedTimeline';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ExtendedTimelineService {
  private projectPath: string;
  private events: Map<string, ExtendedTimelineEvent> = new Map();
  private characterTracks: Map<string, CharacterTimelineTrack> = new Map();
  private worldTracks: Map<string, WorldEventTrack> = new Map();
  private locationTracks: Map<string, LocationTimelineTrack> = new Map();
  private syncs: TimelineSync[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const eventsPath = `${this.projectPath}/设定/扩展时间线/事件.json`;
      const characterTracksPath = `${this.projectPath}/设定/扩展时间线/角色时间线.json`;
      const worldTracksPath = `${this.projectPath}/设定/扩展时间线/世界事件线.json`;
      const locationTracksPath = `${this.projectPath}/设定/扩展时间线/地点时间线.json`;
      const syncsPath = `${this.projectPath}/设定/扩展时间线/同步关系.json`;

      const eventsContent = await workshopService.readFile(eventsPath);
      if (eventsContent) {
        const data: ExtendedTimelineEvent[] = JSON.parse(eventsContent);
        this.events = new Map(data.map((e) => [e.id, e]));
      }

      const characterTracksContent = await workshopService.readFile(characterTracksPath);
      if (characterTracksContent) {
        const data: CharacterTimelineTrack[] = JSON.parse(characterTracksContent);
        this.characterTracks = new Map(data.map((t) => [t.characterId, t]));
      }

      const worldTracksContent = await workshopService.readFile(worldTracksPath);
      if (worldTracksContent) {
        const data: WorldEventTrack[] = JSON.parse(worldTracksContent);
        this.worldTracks = new Map(data.map((t) => [t.id, t]));
      }

      const locationTracksContent = await workshopService.readFile(locationTracksPath);
      if (locationTracksContent) {
        const data: LocationTimelineTrack[] = JSON.parse(locationTracksContent);
        this.locationTracks = new Map(data.map((t) => [t.locationId, t]));
      }

      const syncsContent = await workshopService.readFile(syncsPath);
      if (syncsContent) {
        this.syncs = JSON.parse(syncsContent);
      }
    } catch (error) {
      logger.error('加载扩展时间线数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/扩展时间线`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/事件.json`,
        JSON.stringify(Array.from(this.events.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/角色时间线.json`,
        JSON.stringify(Array.from(this.characterTracks.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/世界事件线.json`,
        JSON.stringify(Array.from(this.worldTracks.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/地点时间线.json`,
        JSON.stringify(Array.from(this.locationTracks.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/同步关系.json`,
        JSON.stringify(this.syncs, null, 2)
      );
    } catch (error) {
      logger.error('保存扩展时间线数据失败', { error });
    }
  }

  async addEvent(
    event: Omit<ExtendedTimelineEvent, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ExtendedTimelineEvent> {
    const newEvent: ExtendedTimelineEvent = {
      ...event,
      id: `event_${uuidv4()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.events.set(newEvent.id, newEvent);

    if (newEvent.characterId) {
      await this.addEventToCharacterTrack(newEvent);
    }

    if (newEvent.timelineType === 'world_event') {
      await this.addEventToWorldTrack(newEvent);
    }

    if (newEvent.locationId) {
      await this.addEventToLocationTrack(newEvent);
    }

    await this.saveToDisk();
    return newEvent;
  }

  private async addEventToCharacterTrack(event: ExtendedTimelineEvent): Promise<void> {
    if (!event.characterId) {
      return;
    }

    let track = this.characterTracks.get(event.characterId);

    if (!track) {
      track = {
        characterId: event.characterId,
        characterName: event.characterName || '未知角色',
        characterRole: 'supporting',
        events: [],
        currentState: {
          location: event.locationName || '',
          status: '正常',
          relationships: [],
          lastAppearance: Date.now(),
        },
        visibility: 'visible',
        color: TIMELINE_COLORS.supporting,
      };
      this.characterTracks.set(event.characterId, track);
    }

    const existingIndex = track.events.findIndex((e) => e.id === event.id);
    if (existingIndex >= 0) {
      track.events[existingIndex] = event;
    } else {
      track.events.push(event);
    }

    track.events.sort((a, b) => {
      const timeA = this.getEventTime(a);
      const timeB = this.getEventTime(b);
      return timeA - timeB;
    });

    track.currentState.lastAppearance = Date.now();
    if (event.locationName) {
      track.currentState.location = event.locationName;
    }
  }

  private async addEventToWorldTrack(event: ExtendedTimelineEvent): Promise<void> {
    const trackId = event.tags.find((t) => t.startsWith('world_')) || 'world_other';

    let track = this.worldTracks.get(trackId);

    if (!track) {
      const type = trackId.replace('world_', '') as WorldEventTrack['type'];
      track = {
        id: trackId,
        name: event.title,
        type,
        description: '',
        events: [],
        affectedRegions: [],
        affectedCharacters: [],
        visibility: 'visible',
        color:
          TIMELINE_COLORS[`world_${type}` as keyof typeof TIMELINE_COLORS] ||
          TIMELINE_COLORS.world_other,
      };
      this.worldTracks.set(trackId, track);
    }

    const existingIndex = track.events.findIndex((e) => e.id === event.id);
    if (existingIndex >= 0) {
      track.events[existingIndex] = event;
    } else {
      track.events.push(event);
    }

    track.events.sort((a, b) => {
      const timeA = this.getEventTime(a);
      const timeB = this.getEventTime(b);
      return timeA - timeB;
    });

    if (event.characterId && !track.affectedCharacters.includes(event.characterId)) {
      track.affectedCharacters.push(event.characterId);
    }
    if (event.locationId && !track.affectedRegions.includes(event.locationId)) {
      track.affectedRegions.push(event.locationId);
    }
  }

  private async addEventToLocationTrack(event: ExtendedTimelineEvent): Promise<void> {
    if (!event.locationId) {
      return;
    }

    let track = this.locationTracks.get(event.locationId);

    if (!track) {
      track = {
        locationId: event.locationId,
        locationName: event.locationName || '未知地点',
        locationType: 'unknown',
        events: [],
        currentOccupants: [],
        visibility: 'visible',
        color: '#6B7280',
      };
      this.locationTracks.set(event.locationId, track);
    }

    const existingIndex = track.events.findIndex((e) => e.id === event.id);
    if (existingIndex >= 0) {
      track.events[existingIndex] = event;
    } else {
      track.events.push(event);
    }

    track.events.sort((a, b) => {
      const timeA = this.getEventTime(a);
      const timeB = this.getEventTime(b);
      return timeA - timeB;
    });

    for (const participant of event.participants) {
      if (!track.currentOccupants.includes(participant.characterId)) {
        track.currentOccupants.push(participant.characterId);
      }
    }
  }

  private getEventTime(event: ExtendedTimelineEvent): number {
    const { year, month, day, hour } = event.storyTime;
    return (year || 0) * 1000000 + (month || 0) * 10000 + (day || 0) * 100 + (hour || 0);
  }

  async updateEvent(
    id: string,
    updates: Partial<ExtendedTimelineEvent>
  ): Promise<ExtendedTimelineEvent | null> {
    const event = this.events.get(id);
    if (!event) {
      return null;
    }

    const updated = {
      ...event,
      ...updates,
      updatedAt: Date.now(),
    };

    this.events.set(id, updated);

    if (event.characterId) {
      await this.addEventToCharacterTrack(updated);
    }
    if (event.timelineType === 'world_event') {
      await this.addEventToWorldTrack(updated);
    }
    if (event.locationId) {
      await this.addEventToLocationTrack(updated);
    }

    await this.saveToDisk();
    return updated;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const event = this.events.get(id);
    if (!event) {
      return false;
    }

    this.events.delete(id);

    if (event.characterId) {
      const track = this.characterTracks.get(event.characterId);
      if (track) {
        track.events = track.events.filter((e) => e.id !== id);
      }
    }

    if (event.timelineType === 'world_event') {
      for (const [, track] of this.worldTracks) {
        track.events = track.events.filter((e) => e.id !== id);
      }
    }

    if (event.locationId) {
      const track = this.locationTracks.get(event.locationId);
      if (track) {
        track.events = track.events.filter((e) => e.id !== id);
      }
    }

    this.syncs = this.syncs.filter((s) => s.sourceEventId !== id && s.targetEventId !== id);

    await this.saveToDisk();
    return true;
  }

  getEvent(id: string): ExtendedTimelineEvent | undefined {
    return this.events.get(id);
  }

  getAllEvents(): ExtendedTimelineEvent[] {
    return Array.from(this.events.values());
  }

  getEventsByType(type: TimelineType): ExtendedTimelineEvent[] {
    return this.getAllEvents().filter((e) => e.timelineType === type);
  }

  getEventsByCharacter(characterId: string): ExtendedTimelineEvent[] {
    return this.getAllEvents().filter((e) => e.characterId === characterId);
  }

  getEventsByLocation(locationId: string): ExtendedTimelineEvent[] {
    return this.getAllEvents().filter((e) => e.locationId === locationId);
  }

  getEventsByTimeRange(startYear: number, endYear: number): ExtendedTimelineEvent[] {
    return this.getAllEvents().filter((e) => {
      const year = e.storyTime.year;
      return year !== undefined && year >= startYear && year <= endYear;
    });
  }

  getCharacterTrack(characterId: string): CharacterTimelineTrack | undefined {
    return this.characterTracks.get(characterId);
  }

  getAllCharacterTracks(): CharacterTimelineTrack[] {
    return Array.from(this.characterTracks.values());
  }

  getWorldTrack(trackId: string): WorldEventTrack | undefined {
    return this.worldTracks.get(trackId);
  }

  getAllWorldTracks(): WorldEventTrack[] {
    return Array.from(this.worldTracks.values());
  }

  getLocationTrack(locationId: string): LocationTimelineTrack | undefined {
    return this.locationTracks.get(locationId);
  }

  getAllLocationTracks(): LocationTimelineTrack[] {
    return Array.from(this.locationTracks.values());
  }

  async createSync(
    sourceEventId: string,
    targetEventId: string,
    syncType: TimelineSync['syncType'],
    offset?: number
  ): Promise<TimelineSync> {
    const sync: TimelineSync = {
      sourceEventId,
      targetEventId,
      syncType,
      offset,
    };

    this.syncs.push(sync);
    await this.saveToDisk();
    return sync;
  }

  deleteSync(sourceEventId: string, targetEventId: string): boolean {
    const index = this.syncs.findIndex(
      (s) => s.sourceEventId === sourceEventId && s.targetEventId === targetEventId
    );
    if (index < 0) {
      return false;
    }

    this.syncs.splice(index, 1);
    this.saveToDisk();
    return true;
  }

  getMultiTimelineView(): MultiTimelineView {
    const protagonistTracks = Array.from(this.characterTracks.values())
      .filter((t) => t.characterRole === 'protagonist')
      .sort((a, b) => a.characterName.localeCompare(b.characterName));

    const otherCharacterTracks = Array.from(this.characterTracks.values())
      .filter((t) => t.characterRole !== 'protagonist')
      .sort((a, b) => {
        const roleOrder: Record<string, number> = {
          protagonist: 0,
          major: 1,
          supporting: 2,
          minor: 3,
        };
        return (roleOrder[a.characterRole] ?? 4) - (roleOrder[b.characterRole] ?? 4);
      });

    const currentTime = this.calculateCurrentTime();

    return {
      characterTracks: [...protagonistTracks, ...otherCharacterTracks],
      worldTracks: Array.from(this.worldTracks.values()),
      locationTracks: Array.from(this.locationTracks.values()),
      syncs: this.syncs,
      currentTime,
      zoomLevel: 'month',
    };
  }

  private calculateCurrentTime(): { storyTime: string; displayTime: string } {
    const events = this.getAllEvents();
    if (events.length === 0) {
      return { storyTime: '0', displayTime: '故事开始' };
    }

    const sortedEvents = events.sort((a, b) => this.getEventTime(b) - this.getEventTime(a));
    const latestEvent = sortedEvents[0];

    return {
      storyTime: String(this.getEventTime(latestEvent)),
      displayTime: latestEvent.storyTime.display,
    };
  }

  async analyzeTimeline(): Promise<TimelineAnalysis> {
    const gaps = await this.detectGaps();
    const conflicts = await this.detectConflicts();
    const suggestions = await this.generateSuggestions();
    const parallelEvents = this.detectParallelEvents();

    return {
      gaps,
      conflicts,
      suggestions,
      parallelEvents,
    };
  }

  private async detectGaps(): Promise<TimelineGap[]> {
    const gaps: TimelineGap[] = [];

    for (const [characterId, track] of this.characterTracks) {
      if (track.characterRole === 'protagonist' || track.characterRole === 'major') {
        const charEvents = track.events.sort((a, b) => this.getEventTime(a) - this.getEventTime(b));

        for (let i = 0; i < charEvents.length - 1; i++) {
          const current = charEvents[i];
          const next = charEvents[i + 1];
          const timeDiff = this.getEventTime(next) - this.getEventTime(current);

          if (timeDiff > 10000) {
            gaps.push({
              id: `gap_${uuidv4()}`,
              type: 'character_missing',
              description: `角色 ${track.characterName} 在时间段 ${current.storyTime.display} 到 ${next.storyTime.display} 缺少事件记录`,
              characterId,
              startTime: this.getEventTime(current),
              endTime: this.getEventTime(next),
              suggestedEvents: ['添加日常活动', '添加修炼/学习', '添加社交互动'],
            });
          }
        }
      }
    }

    return gaps;
  }

  private async detectConflicts(): Promise<TimelineConflict[]> {
    const conflicts: TimelineConflict[] = [];
    const events = this.getAllEvents();

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];

        if (event1.characterId && event1.characterId === event2.characterId) {
          const time1 = this.getEventTime(event1);
          const time2 = this.getEventTime(event2);

          if (Math.abs(time1 - time2) < 1 && event1.locationId !== event2.locationId) {
            conflicts.push({
              id: `conflict_${uuidv4()}`,
              type: 'location_conflict',
              description: `角色 ${event1.characterName} 同时出现在 ${event1.locationName} 和 ${event2.locationName}`,
              eventIds: [event1.id, event2.id],
              severity: 'major',
              suggestion: '请检查事件时间或位置设定',
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async generateSuggestions(): Promise<TimelineSuggestion[]> {
    const suggestions: TimelineSuggestion[] = [];
    const events = this.getAllEvents();

    const eventsWithoutLocation = events.filter(
      (e) => !e.locationId && e.timelineType !== 'world_event'
    );
    if (eventsWithoutLocation.length > 0) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'add_event',
        description: `有 ${eventsWithoutLocation.length} 个事件缺少地点信息`,
        relatedEvents: eventsWithoutLocation.map((e) => e.id).slice(0, 5),
        priority: 'medium',
      });
    }

    const eventsWithoutParticipants = events.filter(
      (e) => e.participants.length === 0 && e.timelineType !== 'world_event'
    );
    if (eventsWithoutParticipants.length > 0) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'add_event',
        description: `有 ${eventsWithoutParticipants.length} 个事件缺少参与者信息`,
        relatedEvents: eventsWithoutParticipants.map((e) => e.id).slice(0, 5),
        priority: 'low',
      });
    }

    return suggestions;
  }

  private detectParallelEvents(): ParallelEventGroup[] {
    const groups: ParallelEventGroup[] = [];
    const events = this.getAllEvents();

    const timeGroups = new Map<number, ExtendedTimelineEvent[]>();

    for (const event of events) {
      const timeKey = Math.floor(this.getEventTime(event) / 100);
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(event);
    }

    for (const [, groupEvents] of timeGroups) {
      if (groupEvents.length > 1) {
        const differentCharacters = new Set(groupEvents.map((e) => e.characterId));
        if (differentCharacters.size > 1) {
          groups.push({
            id: `parallel_${uuidv4()}`,
            name: `并行事件组 ${groups.length + 1}`,
            events: groupEvents,
            startTime: Math.min(...groupEvents.map((e) => this.getEventTime(e))),
            endTime: Math.max(...groupEvents.map((e) => this.getEventTime(e))),
            description: `${groupEvents.length} 个事件同时发生，涉及 ${differentCharacters.size} 个角色`,
          });
        }
      }
    }

    return groups;
  }

  async updateCharacterTrackVisibility(
    characterId: string,
    visibility: TimelineVisibility
  ): Promise<boolean> {
    const track = this.characterTracks.get(characterId);
    if (!track) {
      return false;
    }

    track.visibility = visibility;
    await this.saveToDisk();
    return true;
  }

  async updateWorldTrackVisibility(
    trackId: string,
    visibility: TimelineVisibility
  ): Promise<boolean> {
    const track = this.worldTracks.get(trackId);
    if (!track) {
      return false;
    }

    track.visibility = visibility;
    await this.saveToDisk();
    return true;
  }

  async setCharacterRole(
    characterId: string,
    role: CharacterTimelineTrack['characterRole']
  ): Promise<boolean> {
    const track = this.characterTracks.get(characterId);
    if (!track) {
      return false;
    }

    track.characterRole = role;
    track.color = TIMELINE_COLORS[role] || TIMELINE_COLORS.supporting;
    await this.saveToDisk();
    return true;
  }

  getStats(): {
    totalEvents: number;
    characterTracks: number;
    worldTracks: number;
    locationTracks: number;
    syncs: number;
    bySignificance: Record<string, number>;
  } {
    const events = this.getAllEvents();
    const bySignificance: Record<string, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      background: 0,
    };

    for (const event of events) {
      bySignificance[event.significance]++;
    }

    return {
      totalEvents: events.length,
      characterTracks: this.characterTracks.size,
      worldTracks: this.worldTracks.size,
      locationTracks: this.locationTracks.size,
      syncs: this.syncs.length,
      bySignificance,
    };
  }
}

export function createExtendedTimelineService(projectPath: string): ExtendedTimelineService {
  return new ExtendedTimelineService(projectPath);
}
