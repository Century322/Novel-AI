import { workshopService } from '../core/workshopService';
import { fileSystemService } from '../core/fileSystemService';
import { logger } from '../core/loggerService';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { Foreshadowing } from '@/types/plot/foreshadowing';
import type { ExtendedTimelineEvent } from '@/types/plot/extendedTimeline';
import type {
  WorldModel,
  WorldLocation,
  WorldFaction,
  WorldRule,
  OutlineNode,
  UserPreference,
  ForeshadowingStats,
  OutlineStats,
  CharacterRelationshipSummary,
} from '@/types/world/worldModel';
import { createEmptyWorldModel } from '@/types/world/worldModel';
import type {
  CharacterMemory,
  TimelineMemory,
  ForeshadowingMemory,
  WorldbuildingMemory,
} from '@/types/knowledge/knowledge';
import { MemoryService } from '../knowledge/memoryService';

const WORLD_MODEL_PATH = '.ai-workshop/world/worldModel.json';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class WorldModelService {
  private worldModel: WorldModel | null = null;
  private initialized: boolean = false;
  private memoryService: MemoryService | null = null;

  constructor(_projectPath: string) {}

  setMemoryService(memoryService: MemoryService): void {
    this.memoryService = memoryService;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadWorldModel();
    this.initialized = true;
    logger.info(`世界模型服务初始化完成,项目: ${this.worldModel?.projectName || '未知'}`);
  }

  private async loadWorldModel(): Promise<void> {
    const exists = await workshopService.pathExists(WORLD_MODEL_PATH);

    if (exists) {
      try {
        const content = await workshopService.readFile(WORLD_MODEL_PATH);
        const data = JSON.parse(content);

        if (data.version && data.version >= 1) {
          this.worldModel = data as WorldModel;
          logger.info(`加载世界模型成功,版本: ${data.version}`);
          return;
        }
      } catch (error) {
        logger.error('加载世界模型失败，将尝试迁移', { error });
      }
    }

    this.worldModel = await this.migrateFromMemory();
    await this.saveWorldModel();
  }

  private async migrateFromMemory(): Promise<WorldModel> {
    const projectName = fileSystemService.getProjectName();
    const worldModel = createEmptyWorldModel(projectName, projectName);

    if (this.memoryService) {
      await this.memoryService.initialize();

      const characters = this.memoryService.getCharacters();
      for (const char of characters) {
        const profile = this.convertCharacterMemoryToProfile(char);
        worldModel.characters.items.push(profile);
      }

      const timeline = this.memoryService.getTimeline();
      for (const event of timeline) {
        const extendedEvent = this.convertTimelineMemoryToEvent(event);
        worldModel.timeline.events.push(extendedEvent);
      }

      const foreshadows = this.memoryService.getForeshadowing();
      for (const f of foreshadows) {
        const foreshadowing = this.convertForeshadowingMemory(f);
        worldModel.foreshadowing.items.push(foreshadowing);
      }

      const worldbuilding = this.memoryService.getWorldbuilding();
      for (const w of worldbuilding) {
        const location = this.convertWorldbuildingToLocation(w);
        if (location) {
          worldModel.worldbuilding.locations.push(location);
        }
      }

      worldModel.foreshadowing.stats = this.calculateForeshadowingStats(
        worldModel.foreshadowing.items
      );
      worldModel.outline.stats = this.calculateOutlineStats(worldModel.outline.nodes);

      logger.info('从 MemoryService 迁移数据完成', {
        characters: worldModel.characters.items.length,
        timeline: worldModel.timeline.events.length,
        foreshadowing: worldModel.foreshadowing.items.length,
        locations: worldModel.worldbuilding.locations.length,
      });
    }

    return worldModel;
  }

  private convertCharacterMemoryToProfile(char: CharacterMemory): CharacterProfile {
    return {
      id: char.id || generateId(),
      name: char.name,
      aliases: char.aliases || [],
      role: this.mapCharacterRole(char.role),
      archetype: 'custom',
      appearance: {
        age: '',
        gender: '',
        distinctiveFeatures: [],
        clothing: '',
        overallImpression: '',
      },
      personality: {
        traits: char.traits || [],
        virtues: [],
        flaws: [],
        fears: [],
        desires: [],
        habits: [],
        quirks: [],
        speech: {
          style: '',
          catchphrases: [],
          vocabulary: '',
        },
      },
      background: {
        birthplace: '',
        family: {
          parents: '',
          siblings: '',
        },
        childhood: '',
        education: '',
        occupation: '',
        socialStatus: '',
        significantEvents: [],
      },
      abilities: {
        skills: [],
        powers: [],
        equipment: [],
        weaknesses: [],
      },
      relationships: (char.relationships || []).map((r) => ({
        targetId: r.targetId || '',
        targetName: r.targetName,
        relationshipType: r.type,
        description: r.description || '',
        history: '',
        currentStatus: 'neutral' as const,
        development: [],
      })),
      arc: {
        startingPoint: {
          state: '',
          beliefs: [],
          goals: [],
        },
        journey: (char.arc || []).map((a) => ({
          stage: 'development' as const,
          events: a.event,
          internalChange: a.development,
          externalChange: '',
        })),
        endPoint: {
          state: '',
          beliefs: [],
          goals: [],
          resolution: '',
        },
        theme: '',
      },
      secrets: [],
      motivations: {
        consciousGoals: [],
        unconsciousDesires: [],
        fears: [],
        values: [],
        internalConflict: '',
        externalConflict: '',
      },
      firstAppearance: char.firstAppear || '',
      lastAppearance: char.lastMention,
      totalAppearances: 0,
      notes: char.description || '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private mapCharacterRole(role: string): CharacterProfile['role'] {
    const roleMap: Record<string, CharacterProfile['role']> = {
      protagonist: 'protagonist',
      antagonist: 'antagonist',
      supporting: 'supporting',
      minor: 'minor',
    };
    return roleMap[role] || 'minor';
  }

  private convertTimelineMemoryToEvent(event: TimelineMemory): ExtendedTimelineEvent {
    return {
      id: event.id || generateId(),
      title: event.event.substring(0, 50),
      description: event.event,
      timelineType: 'main_character',
      storyTime: {
        display: event.time || '',
      },
      characterId: event.characters[0] || undefined,
      characterName: event.characters[0] || undefined,
      significance: event.importance === 'major' ? 'major' : 'minor',
      participants: event.characters.map((c) => ({
        characterId: '',
        characterName: c,
        role: 'supporting' as const,
        perspective: false,
      })),
      consequences: [],
      relatedEvents: event.relatedEvents || [],
      tags: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private convertForeshadowingMemory(f: ForeshadowingMemory): Foreshadowing {
    return {
      id: f.id || generateId(),
      title: f.content.substring(0, 30),
      content: f.content,
      type: 'other',
      status: f.status,
      importance: f.importance > 0.7 ? 'major' : f.importance > 0.3 ? 'minor' : 'subtle',
      plantedAt: {
        description: f.plantedAt || '',
      },
      plannedResolution: {
        description: '',
      },
      relatedCharacters: f.relatedCharacters || [],
      relatedItems: [],
      relatedEvents: [],
      hints: [],
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private convertWorldbuildingToLocation(w: WorldbuildingMemory): WorldLocation | null {
    if (w.category !== 'location') {
      return null;
    }
    return {
      id: w.id || generateId(),
      name: w.name,
      type: 'other',
      description: w.description,
      parentLocationId: null,
      subLocations: [],
      atmosphere: '',
      notableFeatures: [],
      history: '',
      currentStatus: '',
      relatedCharacters: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private async saveWorldModel(): Promise<void> {
    if (!this.worldModel) {
      return;
    }

    this.worldModel.metadata.updatedAt = Date.now();
    
    const worldDir = '.ai-workshop/world';
    const dirExists = await workshopService.pathExists(worldDir);
    if (!dirExists) {
      await workshopService.createDirectory(worldDir);
    }
    
    await workshopService.writeFile(WORLD_MODEL_PATH, JSON.stringify(this.worldModel, null, 2));
    logger.debug('世界模型已保存');
  }

  getWorldModel(): WorldModel | null {
    return this.worldModel;
  }

  async addCharacter(character: Partial<CharacterProfile>): Promise<CharacterProfile> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newCharacter: CharacterProfile = {
      id: character.id || generateId(),
      name: character.name || '未命名角色',
      aliases: character.aliases || [],
      role: character.role || 'minor',
      archetype: character.archetype || 'custom',
      appearance: character.appearance || {
        age: '',
        gender: '',
        distinctiveFeatures: [],
        clothing: '',
        overallImpression: '',
      },
      personality: character.personality || {
        traits: [],
        virtues: [],
        flaws: [],
        fears: [],
        desires: [],
        habits: [],
        quirks: [],
        speech: { style: '', catchphrases: [], vocabulary: '' },
      },
      background: character.background || {
        birthplace: '',
        family: { parents: '', siblings: '' },
        childhood: '',
        education: '',
        occupation: '',
        socialStatus: '',
        significantEvents: [],
      },
      abilities: character.abilities || {
        skills: [],
        powers: [],
        equipment: [],
        weaknesses: [],
      },
      relationships: character.relationships || [],
      arc: character.arc || {
        startingPoint: { state: '', beliefs: [], goals: [] },
        journey: [],
        endPoint: { state: '', beliefs: [], goals: [], resolution: '' },
        theme: '',
      },
      secrets: character.secrets || [],
      motivations: character.motivations || {
        consciousGoals: [],
        unconsciousDesires: [],
        fears: [],
        values: [],
        internalConflict: '',
        externalConflict: '',
      },
      firstAppearance: character.firstAppearance || '',
      lastAppearance: character.lastAppearance,
      totalAppearances: character.totalAppearances || 0,
      notes: character.notes || '',
      tags: character.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.characters.items.push(newCharacter);
    await this.saveWorldModel();
    return newCharacter;
  }

  async updateCharacter(id: string, updates: Partial<CharacterProfile>): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.characters.items.findIndex((c: CharacterProfile) => c.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.characters.items[index] = {
      ...this.worldModel.characters.items[index],
      ...updates,
      updatedAt: Date.now(),
    };

    await this.saveWorldModel();
    return true;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.characters.items.findIndex((c: CharacterProfile) => c.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.characters.items.splice(index, 1);
    this.worldModel.characters.relationships = this.worldModel.characters.relationships.filter(
      (r: CharacterRelationshipSummary) => r.sourceId !== id && r.targetId !== id
    );

    await this.saveWorldModel();
    return true;
  }

  getCharacter(id: string): CharacterProfile | undefined {
    return this.worldModel?.characters.items.find((c: CharacterProfile) => c.id === id);
  }

  getCharacters(): CharacterProfile[] {
    return this.worldModel?.characters.items || [];
  }

  async addTimelineEvent(event: Partial<ExtendedTimelineEvent>): Promise<ExtendedTimelineEvent> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newEvent: ExtendedTimelineEvent = {
      id: event.id || generateId(),
      title: event.title || '未命名事件',
      description: event.description || '',
      timelineType: event.timelineType || 'main_character',
      storyTime: event.storyTime || { display: '' },
      realTime: event.realTime,
      characterId: event.characterId,
      characterName: event.characterName,
      locationId: event.locationId,
      locationName: event.locationName,
      plotNodeId: event.plotNodeId,
      chapterId: event.chapterId,
      significance: event.significance || 'minor',
      emotionalBeat: event.emotionalBeat,
      participants: event.participants || [],
      consequences: event.consequences || [],
      relatedEvents: event.relatedEvents || [],
      tags: event.tags || [],
      notes: event.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.timeline.events.push(newEvent);
    this.sortTimelineEvents();
    await this.saveWorldModel();
    return newEvent;
  }

  async updateTimelineEvent(id: string, updates: Partial<ExtendedTimelineEvent>): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.timeline.events.findIndex((e: ExtendedTimelineEvent) => e.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.timeline.events[index] = {
      ...this.worldModel.timeline.events[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.sortTimelineEvents();
    await this.saveWorldModel();
    return true;
  }

  async deleteTimelineEvent(id: string): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.timeline.events.findIndex((e: ExtendedTimelineEvent) => e.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.timeline.events.splice(index, 1);
    await this.saveWorldModel();
    return true;
  }

  private sortTimelineEvents(): void {
    if (!this.worldModel) return;

    this.worldModel.timeline.events.sort((a: ExtendedTimelineEvent, b: ExtendedTimelineEvent) => {
      const timeA = a.realTime || 0;
      const timeB = b.realTime || 0;
      return timeA - timeB;
    });
  }

  getTimelineEvents(): ExtendedTimelineEvent[] {
    return this.worldModel?.timeline.events || [];
  }

  async addForeshadowing(f: Partial<Foreshadowing>): Promise<Foreshadowing> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newForeshadowing: Foreshadowing = {
      id: f.id || generateId(),
      title: f.title || '未命名伏笔',
      content: f.content || '',
      type: f.type || 'other',
      status: f.status || 'planted',
      importance: f.importance || 'minor',
      plantedAt: f.plantedAt || { description: '' },
      plannedResolution: f.plannedResolution || { description: '' },
      actualResolution: f.actualResolution,
      relatedCharacters: f.relatedCharacters || [],
      relatedItems: f.relatedItems || [],
      relatedEvents: f.relatedEvents || [],
      hints: f.hints || [],
      notes: f.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.foreshadowing.items.push(newForeshadowing);
    this.worldModel.foreshadowing.stats = this.calculateForeshadowingStats(
      this.worldModel.foreshadowing.items
    );
    await this.saveWorldModel();
    return newForeshadowing;
  }

  async updateForeshadowing(id: string, updates: Partial<Foreshadowing>): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.foreshadowing.items.findIndex((f: Foreshadowing) => f.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.foreshadowing.items[index] = {
      ...this.worldModel.foreshadowing.items[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.worldModel.foreshadowing.stats = this.calculateForeshadowingStats(
      this.worldModel.foreshadowing.items
    );
    await this.saveWorldModel();
    return true;
  }

  async deleteForeshadowing(id: string): Promise<boolean> {
    if (!this.worldModel) {
      return false;
    }

    const index = this.worldModel.foreshadowing.items.findIndex((f: Foreshadowing) => f.id === id);
    if (index === -1) {
      return false;
    }

    this.worldModel.foreshadowing.items.splice(index, 1);
    this.worldModel.foreshadowing.stats = this.calculateForeshadowingStats(
      this.worldModel.foreshadowing.items
    );
    await this.saveWorldModel();
    return true;
  }

  getForeshadowing(): Foreshadowing[] {
    return this.worldModel?.foreshadowing.items || [];
  }

  getUnresolvedForeshadowing(): Foreshadowing[] {
    return (
      this.worldModel?.foreshadowing.items.filter(
        (f: Foreshadowing) => f.status === 'planted' || f.status === 'hinted'
      ) || []
    );
  }

  private calculateForeshadowingStats(items: Foreshadowing[]): ForeshadowingStats {
    return {
      total: items.length,
      planted: items.filter((f: Foreshadowing) => f.status === 'planted').length,
      hinted: items.filter((f: Foreshadowing) => f.status === 'hinted').length,
      resolved: items.filter((f: Foreshadowing) => f.status === 'resolved').length,
      abandoned: items.filter((f: Foreshadowing) => f.status === 'abandoned').length,
      overdueCount: 0,
    };
  }

  async addLocation(location: Partial<WorldLocation>): Promise<WorldLocation> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newLocation: WorldLocation = {
      id: location.id || generateId(),
      name: location.name || '未命名地点',
      type: location.type || 'other',
      description: location.description || '',
      parentLocationId: location.parentLocationId || null,
      subLocations: location.subLocations || [],
      atmosphere: location.atmosphere || '',
      notableFeatures: location.notableFeatures || [],
      history: location.history || '',
      currentStatus: location.currentStatus || '',
      relatedCharacters: location.relatedCharacters || [],
      tags: location.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.worldbuilding.locations.push(newLocation);
    await this.saveWorldModel();
    return newLocation;
  }

  getLocations(): WorldLocation[] {
    return this.worldModel?.worldbuilding.locations || [];
  }

  async addFaction(faction: Partial<WorldFaction>): Promise<WorldFaction> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newFaction: WorldFaction = {
      id: faction.id || generateId(),
      name: faction.name || '未命名势力',
      type: faction.type || 'other',
      description: faction.description || '',
      leaderId: faction.leaderId || null,
      leaderName: faction.leaderName || null,
      members: faction.members || [],
      goals: faction.goals || [],
      resources: faction.resources || [],
      territory: faction.territory || [],
      relationships: faction.relationships || [],
      history: faction.history || '',
      secrets: faction.secrets || [],
      tags: faction.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.worldbuilding.factions.push(newFaction);
    await this.saveWorldModel();
    return newFaction;
  }

  getFactions(): WorldFaction[] {
    return this.worldModel?.worldbuilding.factions || [];
  }

  async addRule(rule: Partial<WorldRule>): Promise<WorldRule> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newRule: WorldRule = {
      id: rule.id || generateId(),
      category: rule.category || 'other',
      name: rule.name || '未命名规则',
      description: rule.description || '',
      limitations: rule.limitations || [],
      costs: rule.costs || [],
      requirements: rule.requirements || [],
      exceptions: rule.exceptions || [],
      examples: rule.examples || [],
      relatedRules: rule.relatedRules || [],
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.worldbuilding.rules.push(newRule);
    await this.saveWorldModel();
    return newRule;
  }

  getRules(): WorldRule[] {
    return this.worldModel?.worldbuilding.rules || [];
  }

  async addOutlineNode(node: Partial<OutlineNode>): Promise<OutlineNode> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newNode: OutlineNode = {
      id: node.id || generateId(),
      type: node.type || 'chapter',
      title: node.title || '未命名节点',
      summary: node.summary || '',
      status: node.status || 'planned',
      order: node.order ?? this.worldModel.outline.nodes.length,
      parentId: node.parentId || null,
      children: node.children || [],
      wordCount: node.wordCount || { planned: 0, actual: 0 },
      plotPoints: node.plotPoints || [],
      characterAppearances: node.characterAppearances || [],
      foreshadowingLinks: node.foreshadowingLinks || [],
      notes: node.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.worldModel.outline.nodes.push(newNode);

    if (newNode.parentId) {
      const parent = this.worldModel.outline.nodes.find((n: OutlineNode) => n.id === newNode.parentId);
      if (parent && !parent.children.includes(newNode.id)) {
        parent.children.push(newNode.id);
      }
    } else if (!this.worldModel.outline.rootId) {
      this.worldModel.outline.rootId = newNode.id;
    }

    this.worldModel.outline.stats = this.calculateOutlineStats(this.worldModel.outline.nodes);
    await this.saveWorldModel();
    return newNode;
  }

  getOutlineNodes(): OutlineNode[] {
    return this.worldModel?.outline.nodes || [];
  }

  getOutlineTree(): OutlineNode | null {
    if (!this.worldModel || !this.worldModel.outline.rootId) {
      return null;
    }

    const buildTree = (nodeId: string): OutlineNode | null => {
      const node = this.worldModel!.outline.nodes.find((n: OutlineNode) => n.id === nodeId);
      if (!node) return null;

      return {
        ...node,
        children: node.children,
      };
    };

    return buildTree(this.worldModel.outline.rootId);
  }

  private calculateOutlineStats(nodes: OutlineNode[]): OutlineStats {
    const chapters = nodes.filter((n: OutlineNode) => n.type === 'chapter');
    const totalPlanned = nodes.reduce((sum: number, n: OutlineNode) => sum + n.wordCount.planned, 0);
    const totalActual = nodes.reduce((sum: number, n: OutlineNode) => sum + n.wordCount.actual, 0);

    return {
      totalNodes: nodes.length,
      totalWordCount: {
        planned: totalPlanned,
        actual: totalActual,
      },
      completionPercentage: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
      averageChapterLength: chapters.length > 0 ? Math.round(totalActual / chapters.length) : 0,
    };
  }

  async addPreference(preference: Partial<UserPreference>): Promise<UserPreference> {
    if (!this.worldModel) {
      throw new Error('世界模型未初始化');
    }

    const now = Date.now();
    const newPreference: UserPreference = {
      id: preference.id || generateId(),
      category: preference.category || 'general',
      key: preference.key || '',
      value: preference.value ?? '',
      description: preference.description || '',
      priority: preference.priority || 'prefer',
      source: preference.source || 'explicit',
      confidence: preference.confidence ?? 1.0,
      createdAt: now,
      updatedAt: now,
    };

    const existingIndex = this.worldModel.preferences.findIndex(
      (p: UserPreference) => p.category === newPreference.category && p.key === newPreference.key
    );

    if (existingIndex >= 0) {
      this.worldModel.preferences[existingIndex] = {
        ...this.worldModel.preferences[existingIndex],
        ...newPreference,
        updatedAt: now,
      };
    } else {
      this.worldModel.preferences.push(newPreference);
    }

    await this.saveWorldModel();
    return newPreference;
  }

  getPreferences(): UserPreference[] {
    return this.worldModel?.preferences || [];
  }

  getPreferencesByCategory(category: UserPreference['category']): UserPreference[] {
    return this.worldModel?.preferences.filter((p: UserPreference) => p.category === category) || [];
  }

  getContextForGeneration(_chapterId?: string): string {
    if (!this.worldModel) {
      return '';
    }

    let context = '';

    const protagonists = this.worldModel.characters.items.filter(
      (c: CharacterProfile) => c.role === 'protagonist' || c.role === 'deuteragonist'
    );
    if (protagonists.length > 0) {
      context += '## 主要人物\n';
      for (const char of protagonists) {
        context += `- **${char.name}**: ${char.notes || char.personality.traits.join('、')}\n`;
      }
      context += '\n';
    }

    const unresolvedForeshadows = this.getUnresolvedForeshadowing();
    if (unresolvedForeshadows.length > 0) {
      context += '## 待回收伏笔\n';
      for (const f of unresolvedForeshadows.slice(0, 5)) {
        context += `- ${f.title}: ${f.content.substring(0, 100)}\n`;
      }
      context += '\n';
    }

    const recentEvents = this.worldModel.timeline.events.slice(-5);
    if (recentEvents.length > 0) {
      context += '## 近期事件\n';
      for (const event of recentEvents) {
        context += `- ${event.title}\n`;
      }
      context += '\n';
    }

    const mustPreferences = this.worldModel.preferences.filter((p: UserPreference) => p.priority === 'must');
    if (mustPreferences.length > 0) {
      context += '## 必须遵守\n';
      for (const p of mustPreferences) {
        context += `- ${p.description || p.key}: ${String(p.value)}\n`;
      }
      context += '\n';
    }

    return context;
  }

  async syncFromMemory(): Promise<void> {
    if (!this.memoryService) {
      logger.warn('MemoryService 未设置，无法同步');
      return;
    }

    await this.memoryService.initialize();
    this.worldModel = await this.migrateFromMemory();
    await this.saveWorldModel();
    logger.info('从 MemoryService 同步完成');
  }
}

export function createWorldModelService(projectPath: string): WorldModelService {
  return new WorldModelService(projectPath);
}
