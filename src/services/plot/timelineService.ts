import { TimelineEvent, CharacterTimeline } from '@/types/plot/plotNode';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

interface TimePoint {
  storyTime: string;
  events: TimelineEvent[];
}

interface TimelineState {
  events: Map<string, TimelineEvent>;
  characterPositions: Map<string, string>;
}

export class TimelineService {
  private projectPath: string;
  private state: TimelineState;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.state = {
      events: new Map(),
      characterPositions: new Map(),
    };
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const timelinePath = `${this.projectPath}/设定/时间线.json`;
      const content = await workshopService.readFile(timelinePath);
      if (content) {
        const data = JSON.parse(content);
        this.state.events = new Map(data.map((e: TimelineEvent) => [e.id, e]));
      }
    } catch (error) {
      logger.error('加载时间线失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const timelinePath = `${this.projectPath}/设定/时间线.json`;
      await workshopService.writeFile(
        timelinePath,
        JSON.stringify(Array.from(this.state.events.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存时间线失败', { error });
    }
  }

  addEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    const id = `event_${uuidv4()}`;
    const newEvent: TimelineEvent = { ...event, id };

    this.state.events.set(id, newEvent);

    for (const char of event.characters) {
      this.state.characterPositions.set(char, event.location);
    }

    this.saveToDisk();
    return newEvent;
  }

  updateEvent(id: string, updates: Partial<TimelineEvent>): TimelineEvent | undefined {
    const event = this.state.events.get(id);
    if (!event) {
      return undefined;
    }

    const updated = { ...event, ...updates };
    this.state.events.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  deleteEvent(id: string): boolean {
    const result = this.state.events.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  getEvent(id: string): TimelineEvent | undefined {
    return this.state.events.get(id);
  }

  getAllEvents(): TimelineEvent[] {
    return Array.from(this.state.events.values()).sort(
      (a, b) => this.parseStoryTime(a.storyTime) - this.parseStoryTime(b.storyTime)
    );
  }

  private parseStoryTime(time: string): number {
    const match = time.match(/第?(\d+)[年月日章节]?/);
    return match ? parseInt(match[1], 10) : 0;
  }

  getEventsByCharacter(characterName: string): TimelineEvent[] {
    return this.getAllEvents().filter((e) => e.characters.includes(characterName));
  }

  getEventsByLocation(location: string): TimelineEvent[] {
    return this.getAllEvents().filter((e) => e.location === location);
  }

  getEventsByTimeRange(startTime: string, endTime: string): TimelineEvent[] {
    const start = this.parseStoryTime(startTime);
    const end = this.parseStoryTime(endTime);

    return this.getAllEvents().filter((e) => {
      const time = this.parseStoryTime(e.storyTime);
      return time >= start && time <= end;
    });
  }

  getCharacterTimeline(characterName: string): CharacterTimeline {
    const events = this.getEventsByCharacter(characterName);
    const lastEvent = events[events.length - 1];

    return {
      characterId: characterName,
      characterName,
      events,
      currentState: lastEvent?.description || '未知',
      location: lastEvent?.location || '未知',
    };
  }

  getAllCharacterTimelines(): CharacterTimeline[] {
    const characters = new Set<string>();

    for (const event of this.state.events.values()) {
      for (const char of event.characters) {
        characters.add(char);
      }
    }

    return Array.from(characters).map((name) => this.getCharacterTimeline(name));
  }

  getTimelineByStoryTime(): TimePoint[] {
    const timeMap = new Map<string, TimelineEvent[]>();

    for (const event of this.state.events.values()) {
      const existing = timeMap.get(event.storyTime) || [];
      existing.push(event);
      timeMap.set(event.storyTime, existing);
    }

    return Array.from(timeMap.entries())
      .map(([storyTime, events]) => ({ storyTime, events }))
      .sort((a, b) => this.parseStoryTime(a.storyTime) - this.parseStoryTime(b.storyTime));
  }

  getCurrentCharacterLocation(characterName: string): string {
    return this.state.characterPositions.get(characterName) || '未知';
  }

  getCharactersAtLocation(location: string): string[] {
    const characters: string[] = [];

    for (const [char, loc] of this.state.characterPositions) {
      if (loc === location) {
        characters.push(char);
      }
    }

    return characters;
  }

  linkEvents(eventId1: string, eventId2: string): boolean {
    const event1 = this.state.events.get(eventId1);
    const event2 = this.state.events.get(eventId2);

    if (!event1 || !event2) {
      return false;
    }

    if (!event1.relatedEvents.includes(eventId2)) {
      event1.relatedEvents.push(eventId2);
    }
    if (!event2.relatedEvents.includes(eventId1)) {
      event2.relatedEvents.push(eventId1);
    }

    this.saveToDisk();
    return true;
  }

  addConsequence(eventId: string, consequence: string): boolean {
    const event = this.state.events.get(eventId);
    if (!event) {
      return false;
    }

    event.consequences.push(consequence);
    this.saveToDisk();
    return true;
  }

  getMajorEvents(): TimelineEvent[] {
    return this.getAllEvents().filter((e) => e.significance === 'major');
  }

  getEventSummary(): {
    total: number;
    major: number;
    minor: number;
    background: number;
    characters: string[];
    locations: string[];
  } {
    const events = this.getAllEvents();
    const characters = new Set<string>();
    const locations = new Set<string>();

    for (const event of events) {
      for (const char of event.characters) {
        characters.add(char);
      }
      locations.add(event.location);
    }

    return {
      total: events.length,
      major: events.filter((e) => e.significance === 'major').length,
      minor: events.filter((e) => e.significance === 'minor').length,
      background: events.filter((e) => e.significance === 'background').length,
      characters: Array.from(characters),
      locations: Array.from(locations),
    };
  }

  detectTimelineConflicts(): Array<{
    type: string;
    description: string;
    events: TimelineEvent[];
  }> {
    const conflicts: Array<{
      type: string;
      description: string;
      events: TimelineEvent[];
    }> = [];

    const charLocations = new Map<
      string,
      Array<{ time: string; location: string; event: TimelineEvent }>
    >();

    for (const event of this.state.events.values()) {
      for (const char of event.characters) {
        if (!charLocations.has(char)) {
          charLocations.set(char, []);
        }
        charLocations.get(char)!.push({
          time: event.storyTime,
          location: event.location,
          event,
        });
      }
    }

    for (const [char, locations] of charLocations) {
      const sorted = locations.sort(
        (a, b) => this.parseStoryTime(a.time) - this.parseStoryTime(b.time)
      );

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (prev.time === curr.time && prev.location !== curr.location) {
          conflicts.push({
            type: 'location_conflict',
            description: `角色 "${char}" 在同一时间出现在不同地点`,
            events: [prev.event, curr.event],
          });
        }
      }
    }

    return conflicts;
  }

  exportTimeline(): TimelineEvent[] {
    return this.getAllEvents();
  }

  importTimeline(events: TimelineEvent[]): void {
    for (const event of events) {
      this.state.events.set(event.id, event);
    }
    this.saveToDisk();
  }
}

export function createTimelineService(projectPath: string): TimelineService {
  return new TimelineService(projectPath);
}
