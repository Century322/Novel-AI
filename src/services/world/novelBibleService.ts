import { workshopService } from '../core/workshopService';
import { fileSystemService } from '../core/fileSystemService';
import { logger } from '../core/loggerService';
import type { WorldModelService } from './worldModelService';
import type { ExtendedTimelineEvent } from '@/types/plot/extendedTimeline';
import type {
  NovelBible,
  NovelBibleCharacter,
  NovelBibleForeshadowing,
  NovelBibleMetadata,
  NovelBibleRelationship,
  NovelBibleTimelineEvent,
  NovelBibleTimelineTrack,
  NovelBibleValidationIssue,
  NovelBibleValidationResult,
  NovelBibleWorld,
} from '@/types/world/novelBible';
import { createEmptyNovelBible, NOVEL_BIBLE_VERSION } from '@/types/world/novelBible';

const NOVEL_BIBLE_PATH = '.ai-workshop/world/novelBible.json';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class NovelBibleService {
  private novelBible: NovelBible | null = null;
  private initialized = false;
  private worldModelService: WorldModelService | null = null;

  constructor(_projectPath: string) {}

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadNovelBible();
    this.initialized = true;
    logger.info('小说圣经服务初始化完成', {
      title: this.novelBible?.metadata.title || '',
      characterCount: this.novelBible?.characters.length || 0,
    });
  }

  getNovelBible(): NovelBible | null {
    return this.novelBible ? clone(this.novelBible) : null;
  }

  async updateMetadata(updates: Partial<NovelBibleMetadata>): Promise<NovelBibleMetadata> {
    const bible = this.requireNovelBible();
    bible.metadata = {
      ...bible.metadata,
      ...updates,
      version: NOVEL_BIBLE_VERSION,
      themes: normalizeStringArray(updates.themes ?? bible.metadata.themes),
      writingConstraints: normalizeStringArray(
        updates.writingConstraints ?? bible.metadata.writingConstraints
      ),
      updatedAt: Date.now(),
    };
    await this.saveNovelBible();
    return clone(bible.metadata);
  }

  async updateWorld(updates: Partial<NovelBibleWorld>): Promise<NovelBibleWorld> {
    const bible = this.requireNovelBible();
    bible.world = {
      ...bible.world,
      ...updates,
      regions: normalizeStringArray(updates.regions ?? bible.world.regions),
      factions: normalizeStringArray(updates.factions ?? bible.world.factions),
      rules: normalizeStringArray(updates.rules ?? bible.world.rules),
      taboo: normalizeStringArray(updates.taboo ?? bible.world.taboo),
      unresolvedQuestions: normalizeStringArray(
        updates.unresolvedQuestions ?? bible.world.unresolvedQuestions
      ),
    };
    bible.metadata.updatedAt = Date.now();
    await this.saveNovelBible();
    return clone(bible.world);
  }

  async upsertCharacter(input: Partial<NovelBibleCharacter> & { name: string }): Promise<NovelBibleCharacter> {
    const bible = this.requireNovelBible();
    const name = input.name.trim();
    if (!name) {
      throw new Error('角色名称不能为空');
    }

    const now = Date.now();
    const index = bible.characters.findIndex((character) => character.id === input.id || character.name === name);

    if (index >= 0) {
      const existing = bible.characters[index];
      const merged: NovelBibleCharacter = {
        ...existing,
        ...input,
        name,
        aliases: normalizeStringArray(input.aliases ?? existing.aliases),
        goals: {
          shortTerm: normalizeStringArray(input.goals?.shortTerm ?? existing.goals.shortTerm),
          longTerm: normalizeStringArray(input.goals?.longTerm ?? existing.goals.longTerm),
        },
        arc: {
          start: normalizeString(input.arc?.start, existing.arc.start),
          midpoint: normalizeString(input.arc?.midpoint, existing.arc.midpoint),
          end: normalizeString(input.arc?.end, existing.arc.end),
        },
        tags: normalizeStringArray(input.tags ?? existing.tags),
        updatedAt: now,
      };
      bible.characters[index] = merged;
      bible.metadata.updatedAt = now;
      await this.saveNovelBible();
      return clone(merged);
    }

    const created: NovelBibleCharacter = {
      id: input.id || generateId('char'),
      name,
      aliases: normalizeStringArray(input.aliases),
      role: input.role || 'minor',
      summary: normalizeString(input.summary),
      viewpoint: Boolean(input.viewpoint),
      status: input.status || 'active',
      goals: {
        shortTerm: normalizeStringArray(input.goals?.shortTerm),
        longTerm: normalizeStringArray(input.goals?.longTerm),
      },
      arc: {
        start: normalizeString(input.arc?.start),
        midpoint: normalizeString(input.arc?.midpoint),
        end: normalizeString(input.arc?.end),
      },
      tags: normalizeStringArray(input.tags),
      createdAt: now,
      updatedAt: now,
    };

    bible.characters.push(created);
    bible.metadata.updatedAt = now;
    await this.saveNovelBible();
    return clone(created);
  }

  async upsertRelationship(
    input: Partial<NovelBibleRelationship> & {
      sourceCharacterId: string;
      targetCharacterId: string;
      type: string;
    }
  ): Promise<NovelBibleRelationship> {
    const bible = this.requireNovelBible();
    const now = Date.now();
    const sourceCharacterId = normalizeString(input.sourceCharacterId);
    const targetCharacterId = normalizeString(input.targetCharacterId);
    const type = normalizeString(input.type);
    if (!sourceCharacterId || !targetCharacterId || !type) {
      throw new Error('关系信息不完整');
    }

    const index = bible.relationships.findIndex(
      (item) =>
        item.id === input.id ||
        (item.sourceCharacterId === sourceCharacterId &&
          item.targetCharacterId === targetCharacterId &&
          item.type === type)
    );

    if (index >= 0) {
      const existing = bible.relationships[index];
      const merged: NovelBibleRelationship = {
        ...existing,
        ...input,
        sourceCharacterId,
        targetCharacterId,
        type,
        status: normalizeString(input.status, existing.status),
        notes: normalizeString(input.notes, existing.notes),
        updatedAt: now,
      };
      bible.relationships[index] = merged;
      bible.metadata.updatedAt = now;
      await this.saveNovelBible();
      return clone(merged);
    }

    const created: NovelBibleRelationship = {
      id: input.id || generateId('rel'),
      sourceCharacterId,
      targetCharacterId,
      type,
      status: normalizeString(input.status, 'active'),
      notes: normalizeString(input.notes),
      updatedAt: now,
    };
    bible.relationships.push(created);
    bible.metadata.updatedAt = now;
    await this.saveNovelBible();
    return clone(created);
  }

  async upsertTimelineTrack(input: Partial<NovelBibleTimelineTrack> & { name: string }): Promise<NovelBibleTimelineTrack> {
    const bible = this.requireNovelBible();
    const name = input.name.trim();
    if (!name) {
      throw new Error('时间线名称不能为空');
    }

    const now = Date.now();
    const index = bible.timelineTracks.findIndex((track) => track.id === input.id || track.name === name);

    if (index >= 0) {
      const existing = bible.timelineTracks[index];
      const merged: NovelBibleTimelineTrack = {
        ...existing,
        ...input,
        name,
        description: normalizeString(input.description, existing.description),
        isActive: input.isActive ?? existing.isActive,
        events: Array.isArray(input.events) ? input.events.map((event) => this.normalizeEvent(event)) : existing.events,
        updatedAt: now,
      };
      bible.timelineTracks[index] = merged;
      bible.metadata.updatedAt = now;
      await this.saveNovelBible();
      return clone(merged);
    }

    const created: NovelBibleTimelineTrack = {
      id: input.id || generateId('track'),
      name,
      type: input.type || 'subplot',
      description: normalizeString(input.description),
      isActive: input.isActive ?? true,
      events: Array.isArray(input.events) ? input.events.map((event) => this.normalizeEvent(event)) : [],
      updatedAt: now,
    };
    bible.timelineTracks.push(created);
    bible.metadata.updatedAt = now;
    await this.saveNovelBible();
    return clone(created);
  }

  async upsertTimelineEvent(
    trackId: string,
    input: Partial<NovelBibleTimelineEvent> & { title: string }
  ): Promise<NovelBibleTimelineEvent> {
    const bible = this.requireNovelBible();
    const track = bible.timelineTracks.find((item) => item.id === trackId);
    if (!track) {
      throw new Error(`时间线不存在: ${trackId}`);
    }

    const title = input.title.trim();
    if (!title) {
      throw new Error('时间线事件标题不能为空');
    }

    const now = Date.now();
    const index = track.events.findIndex((event) => event.id === input.id);
    if (index >= 0) {
      const merged = this.normalizeEvent({
        ...track.events[index],
        ...input,
        title,
        updatedAt: now,
      });
      track.events[index] = merged;
      track.updatedAt = now;
      bible.metadata.updatedAt = now;
      await this.saveNovelBible();
      return clone(merged);
    }

    const created = this.normalizeEvent({
      ...input,
      id: input.id || generateId('event'),
      title,
      updatedAt: now,
    });
    track.events.push(created);
    track.updatedAt = now;
    bible.metadata.updatedAt = now;
    await this.saveNovelBible();
    return clone(created);
  }

  async upsertForeshadowing(
    input: Partial<NovelBibleForeshadowing> & { title: string; seed: string }
  ): Promise<NovelBibleForeshadowing> {
    const bible = this.requireNovelBible();
    const title = input.title.trim();
    const seed = input.seed.trim();
    if (!title || !seed) {
      throw new Error('伏笔标题和内容不能为空');
    }

    const now = Date.now();
    const index = bible.foreshadowing.findIndex((item) => item.id === input.id || item.title === title);
    if (index >= 0) {
      const existing = bible.foreshadowing[index];
      const merged: NovelBibleForeshadowing = {
        ...existing,
        ...input,
        title,
        seed,
        payoffPlan: normalizeString(input.payoffPlan, existing.payoffPlan),
        status: input.status || existing.status,
        plantedIn: normalizeString(input.plantedIn, existing.plantedIn),
        payoffIn: normalizeString(input.payoffIn, existing.payoffIn),
        relatedCharacterIds: normalizeStringArray(input.relatedCharacterIds ?? existing.relatedCharacterIds),
        priority: input.priority || existing.priority,
        notes: normalizeString(input.notes, existing.notes),
        updatedAt: now,
      };
      bible.foreshadowing[index] = merged;
      bible.metadata.updatedAt = now;
      await this.saveNovelBible();
      return clone(merged);
    }

    const created: NovelBibleForeshadowing = {
      id: input.id || generateId('foreshadow'),
      title,
      seed,
      payoffPlan: normalizeString(input.payoffPlan),
      status: input.status || 'seeded',
      plantedIn: normalizeString(input.plantedIn),
      payoffIn: normalizeString(input.payoffIn),
      relatedCharacterIds: normalizeStringArray(input.relatedCharacterIds),
      priority: input.priority || 'medium',
      notes: normalizeString(input.notes),
      updatedAt: now,
    };
    bible.foreshadowing.push(created);
    bible.metadata.updatedAt = now;
    await this.saveNovelBible();
    return clone(created);
  }

  validate(): NovelBibleValidationResult {
    const bible = this.requireNovelBible();
    const issues: NovelBibleValidationIssue[] = [];
    const addIssue = (severity: NovelBibleValidationIssue['severity'], code: string, message: string, path: string) => {
      issues.push({ severity, code, message, path });
    };

    if (!bible.metadata.title.trim()) {
      addIssue('warning', 'MISSING_TITLE', '缺少小说标题', 'metadata.title');
    }

    if (bible.characters.filter((character) => character.role === 'protagonist').length === 0) {
      addIssue('error', 'NO_PROTAGONIST', '缺少主角角色', 'characters');
    }

    const characterIds = new Set(bible.characters.map((character) => character.id));
    for (const relation of bible.relationships) {
      if (!characterIds.has(relation.sourceCharacterId)) {
        addIssue('error', 'RELATION_SOURCE_MISSING', `关系源角色不存在: ${relation.sourceCharacterId}`, 'relationships');
      }
      if (!characterIds.has(relation.targetCharacterId)) {
        addIssue('error', 'RELATION_TARGET_MISSING', `关系目标角色不存在: ${relation.targetCharacterId}`, 'relationships');
      }
    }

    for (const track of bible.timelineTracks) {
      if (track.events.length === 0) {
        addIssue('info', 'EMPTY_TRACK', `时间线为空: ${track.name}`, 'timelineTracks');
      }
      for (const event of track.events) {
        if (event.povCharacterId && !characterIds.has(event.povCharacterId)) {
          addIssue('warning', 'EVENT_POV_MISSING', `事件 POV 角色不存在: ${event.povCharacterId}`, 'timelineTracks');
        }
      }
    }

    for (const foreshadow of bible.foreshadowing) {
      if (foreshadow.status !== 'discarded' && !foreshadow.payoffPlan.trim()) {
        addIssue('warning', 'FORESHADOW_NO_PAYOFF', `伏笔缺少回收计划: ${foreshadow.title}`, 'foreshadowing');
      }
    }

    if (!bible.world.powerSystem.trim()) {
      addIssue('warning', 'MISSING_POWER_SYSTEM', '尚未定义力量体系', 'world.powerSystem');
    }

    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    const infoCount = issues.filter((issue) => issue.severity === 'info').length;
    const score = Math.max(0, 100 - errorCount * 12 - warningCount * 5 - infoCount * 2);

    return {
      valid: errorCount === 0,
      score,
      issues,
      summary:
        errorCount > 0
          ? `发现 ${errorCount} 个严重问题，${warningCount} 个警告。`
          : warningCount > 0
            ? `结构可用，但有 ${warningCount} 个警告需要处理。`
            : '小说圣经结构完整，可用于继续创作。',
    };
  }

  getGenerationBrief(options: { maxCharacters?: number; maxTracks?: number; maxForeshadowing?: number } = {}): string {
    const bible = this.requireNovelBible();
    const maxCharacters = options.maxCharacters ?? 6;
    const maxTracks = options.maxTracks ?? 3;
    const maxForeshadowing = options.maxForeshadowing ?? 5;

    let context = '';
    context += `# 小说圣经\n`;
    context += `- 标题: ${bible.metadata.title || bible.metadata.projectName}\n`;
    context += `- 类型: ${bible.metadata.genre || '未指定'}\n`;
    context += `- 目标字数: ${bible.metadata.targetWordCount}\n`;
    if (bible.metadata.logline.trim()) {
      context += `- 梗概: ${bible.metadata.logline}\n`;
    }

    if (bible.world.premise.trim() || bible.world.powerSystem.trim()) {
      context += '\n## 世界设定\n';
      if (bible.world.premise.trim()) {
        context += `- 前提: ${bible.world.premise}\n`;
      }
      if (bible.world.powerSystem.trim()) {
        context += `- 力量体系: ${bible.world.powerSystem}\n`;
      }
    }

    const characters = bible.characters.slice(0, Math.max(1, maxCharacters));
    if (characters.length > 0) {
      context += '\n## 核心角色\n';
      for (const character of characters) {
        const goal = character.goals.longTerm[0] || character.goals.shortTerm[0] || '暂无目标';
        context += `- ${character.name}(${character.role}): ${character.summary || '暂无描述'} | 目标: ${goal}\n`;
      }
    }

    const tracks = bible.timelineTracks.slice(0, Math.max(1, maxTracks));
    if (tracks.length > 0) {
      context += '\n## 时间线\n';
      for (const track of tracks) {
        const lastEvent = track.events[track.events.length - 1];
        context += `- ${track.name}: ${lastEvent ? lastEvent.title : '暂无事件'}\n`;
      }
    }

    const pendingForeshadowing = bible.foreshadowing
      .filter((item) => item.status === 'seeded' || item.status === 'hinted')
      .slice(0, Math.max(1, maxForeshadowing));
    if (pendingForeshadowing.length > 0) {
      context += '\n## 待回收伏笔\n';
      for (const item of pendingForeshadowing) {
        context += `- ${item.title}: ${item.seed}\n`;
      }
    }

    return context.trim();
  }

  private async loadNovelBible(): Promise<void> {
    const exists = await workshopService.pathExists(NOVEL_BIBLE_PATH);
    if (exists) {
      try {
        const content = await workshopService.readFile(NOVEL_BIBLE_PATH);
        const parsed = JSON.parse(content) as Partial<NovelBible>;
        this.novelBible = this.normalizeBible(parsed);
        await this.saveNovelBible();
        return;
      } catch (error) {
        logger.error('加载小说圣经失败，改为重建', { error: String(error) });
      }
    }

    this.novelBible = this.migrateFromWorldModel();
    await this.saveNovelBible();
  }

  private migrateFromWorldModel(): NovelBible {
    const projectName = fileSystemService.getProjectName();
    const bible = createEmptyNovelBible(projectName, projectName);
    const worldModel = this.worldModelService?.getWorldModel();
    if (!worldModel) {
      return bible;
    }

    bible.metadata.projectId = worldModel.projectId || projectName;
    bible.metadata.projectName = worldModel.projectName || projectName;
    bible.metadata.title = worldModel.projectName || projectName;
    bible.characters = worldModel.characters.items.map((character) => {
      const role =
        character.role === 'protagonist' ||
        character.role === 'deuteragonist' ||
        character.role === 'antagonist' ||
        character.role === 'supporting' ||
        character.role === 'minor'
          ? character.role
          : 'minor';
      return {
        id: character.id || generateId('char'),
        name: character.name,
        aliases: character.aliases || [],
        role,
        summary: character.notes || character.personality.traits.join('、'),
        viewpoint: role === 'protagonist' || role === 'deuteragonist',
        status: 'active',
        goals: {
          shortTerm: character.arc.startingPoint.goals || [],
          longTerm: character.arc.endPoint.goals || [],
        },
        arc: {
          start: character.arc.startingPoint.state || '',
          midpoint: character.arc.journey[0]?.internalChange || '',
          end: character.arc.endPoint.state || '',
        },
        tags: character.tags || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    bible.relationships = worldModel.characters.relationships.map((relation) => ({
      id: generateId('rel'),
      sourceCharacterId: relation.sourceId,
      targetCharacterId: relation.targetId,
      type: relation.type,
      status: relation.evolution.at(-1)?.newStatus || 'active',
      notes: relation.evolution.map((item) => `${item.chapter}: ${item.change}`).join('；'),
      updatedAt: Date.now(),
    }));

    bible.timelineTracks = this.groupTimeline(worldModel.timeline.events);
    bible.world.regions = worldModel.worldbuilding.locations.map((location) => location.name);
    bible.world.factions = worldModel.worldbuilding.factions.map((faction) => faction.name);
    bible.world.rules = worldModel.worldbuilding.rules.map((rule) => rule.name);
    return bible;
  }

  private groupTimeline(events: ExtendedTimelineEvent[]): NovelBibleTimelineTrack[] {
    if (events.length === 0) {
      return [];
    }
    const groups = new Map<string, NovelBibleTimelineTrack>();
    for (const event of events) {
      const key = String(event.timelineType || 'main_character');
      if (!groups.has(key)) {
        groups.set(key, {
          id: generateId('track'),
          name: key,
          type: key.includes('main') ? 'main' : 'subplot',
          description: '',
          isActive: true,
          events: [],
          updatedAt: Date.now(),
        });
      }
      const track = groups.get(key);
      if (!track) {
        continue;
      }
      track.events.push(
        this.normalizeEvent({
          id: event.id,
          title: event.title,
          summary: event.description,
          phase: event.significance === 'critical' ? 'climax' : event.significance === 'major' ? 'rising' : 'setup',
          timeLabel: event.storyTime.display || '',
          chapterHint: event.chapterId || '',
          povCharacterId: event.characterId,
          participants: event.participants
            .map((participant) => participant.characterId)
            .filter((id): id is string => Boolean(id)),
          dependencies: event.relatedEvents || [],
          status: 'planned',
          tags: event.tags || [],
          updatedAt: Date.now(),
        })
      );
      track.updatedAt = Date.now();
    }
    return Array.from(groups.values());
  }

  private normalizeEvent(input: Partial<NovelBibleTimelineEvent>): NovelBibleTimelineEvent {
    return {
      id: normalizeString(input.id, generateId('event')),
      title: normalizeString(input.title, '未命名事件'),
      summary: normalizeString(input.summary),
      phase: input.phase || 'setup',
      timeLabel: normalizeString(input.timeLabel),
      chapterHint: normalizeString(input.chapterHint),
      povCharacterId: normalizeString(input.povCharacterId),
      participants: normalizeStringArray(input.participants),
      dependencies: normalizeStringArray(input.dependencies),
      status: input.status || 'planned',
      tags: normalizeStringArray(input.tags),
      updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
    };
  }

  private normalizeBible(raw: Partial<NovelBible>): NovelBible {
    const projectName = normalizeString(raw.metadata?.projectName, fileSystemService.getProjectName());
    const projectId = normalizeString(raw.metadata?.projectId, projectName);
    const base = createEmptyNovelBible(projectId, projectName);
    return {
      metadata: {
        ...base.metadata,
        ...raw.metadata,
        version: NOVEL_BIBLE_VERSION,
        projectId,
        projectName,
        title: normalizeString(raw.metadata?.title, base.metadata.title),
        genre: normalizeString(raw.metadata?.genre, base.metadata.genre),
        targetWordCount:
          typeof raw.metadata?.targetWordCount === 'number'
            ? raw.metadata.targetWordCount
            : base.metadata.targetWordCount,
        targetChapterCount:
          typeof raw.metadata?.targetChapterCount === 'number'
            ? raw.metadata.targetChapterCount
            : base.metadata.targetChapterCount,
        logline: normalizeString(raw.metadata?.logline, base.metadata.logline),
        themes: normalizeStringArray(raw.metadata?.themes),
        audience: normalizeString(raw.metadata?.audience, base.metadata.audience),
        tone: normalizeString(raw.metadata?.tone, base.metadata.tone),
        writingConstraints: normalizeStringArray(raw.metadata?.writingConstraints),
        createdAt: typeof raw.metadata?.createdAt === 'number' ? raw.metadata.createdAt : base.metadata.createdAt,
        updatedAt: typeof raw.metadata?.updatedAt === 'number' ? raw.metadata.updatedAt : base.metadata.updatedAt,
      },
      world: {
        ...base.world,
        ...raw.world,
        premise: normalizeString(raw.world?.premise, base.world.premise),
        worldview: normalizeString(raw.world?.worldview, base.world.worldview),
        powerSystem: normalizeString(raw.world?.powerSystem, base.world.powerSystem),
        regions: normalizeStringArray(raw.world?.regions),
        factions: normalizeStringArray(raw.world?.factions),
        rules: normalizeStringArray(raw.world?.rules),
        taboo: normalizeStringArray(raw.world?.taboo),
        unresolvedQuestions: normalizeStringArray(raw.world?.unresolvedQuestions),
      },
      characters: Array.isArray(raw.characters)
        ? raw.characters.map((character) =>
            this.normalizeCharacter({
              ...(character as Partial<NovelBibleCharacter>),
              name: normalizeString((character as Partial<NovelBibleCharacter>).name, '未命名角色'),
            })
          )
        : [],
      relationships: Array.isArray(raw.relationships)
        ? raw.relationships.map((item) => ({
            id: normalizeString((item as Partial<NovelBibleRelationship>).id, generateId('rel')),
            sourceCharacterId: normalizeString(
              (item as Partial<NovelBibleRelationship>).sourceCharacterId
            ),
            targetCharacterId: normalizeString(
              (item as Partial<NovelBibleRelationship>).targetCharacterId
            ),
            type: normalizeString((item as Partial<NovelBibleRelationship>).type, 'unknown'),
            status: normalizeString((item as Partial<NovelBibleRelationship>).status, 'active'),
            notes: normalizeString((item as Partial<NovelBibleRelationship>).notes),
            updatedAt:
              typeof (item as Partial<NovelBibleRelationship>).updatedAt === 'number'
                ? (item as Partial<NovelBibleRelationship>).updatedAt as number
                : Date.now(),
          }))
        : [],
      timelineTracks: Array.isArray(raw.timelineTracks)
        ? raw.timelineTracks.map((item) => ({
            id: normalizeString((item as Partial<NovelBibleTimelineTrack>).id, generateId('track')),
            name: normalizeString((item as Partial<NovelBibleTimelineTrack>).name, '未命名时间线'),
            type: (item as Partial<NovelBibleTimelineTrack>).type || 'subplot',
            description: normalizeString((item as Partial<NovelBibleTimelineTrack>).description),
            isActive: (item as Partial<NovelBibleTimelineTrack>).isActive ?? true,
            events: Array.isArray((item as Partial<NovelBibleTimelineTrack>).events)
              ? ((item as Partial<NovelBibleTimelineTrack>).events as NovelBibleTimelineEvent[]).map((event) =>
                  this.normalizeEvent(event)
                )
              : [],
            updatedAt:
              typeof (item as Partial<NovelBibleTimelineTrack>).updatedAt === 'number'
                ? (item as Partial<NovelBibleTimelineTrack>).updatedAt as number
                : Date.now(),
          }))
        : [],
      foreshadowing: Array.isArray(raw.foreshadowing)
        ? raw.foreshadowing.map((item) => ({
            id: normalizeString((item as Partial<NovelBibleForeshadowing>).id, generateId('foreshadow')),
            title: normalizeString((item as Partial<NovelBibleForeshadowing>).title, '未命名伏笔'),
            seed: normalizeString((item as Partial<NovelBibleForeshadowing>).seed),
            payoffPlan: normalizeString((item as Partial<NovelBibleForeshadowing>).payoffPlan),
            status: (item as Partial<NovelBibleForeshadowing>).status || 'seeded',
            plantedIn: normalizeString((item as Partial<NovelBibleForeshadowing>).plantedIn),
            payoffIn: normalizeString((item as Partial<NovelBibleForeshadowing>).payoffIn),
            relatedCharacterIds: normalizeStringArray(
              (item as Partial<NovelBibleForeshadowing>).relatedCharacterIds
            ),
            priority: (item as Partial<NovelBibleForeshadowing>).priority || 'medium',
            notes: normalizeString((item as Partial<NovelBibleForeshadowing>).notes),
            updatedAt:
              typeof (item as Partial<NovelBibleForeshadowing>).updatedAt === 'number'
                ? (item as Partial<NovelBibleForeshadowing>).updatedAt as number
                : Date.now(),
          }))
        : [],
      notes: normalizeStringArray(raw.notes),
    };
  }

  private normalizeCharacter(input: Partial<NovelBibleCharacter> & { name: string }): NovelBibleCharacter {
    const now = Date.now();
    return {
      id: normalizeString(input.id, generateId('char')),
      name: input.name,
      aliases: normalizeStringArray(input.aliases),
      role: input.role || 'minor',
      summary: normalizeString(input.summary),
      viewpoint: Boolean(input.viewpoint),
      status: input.status || 'active',
      goals: {
        shortTerm: normalizeStringArray(input.goals?.shortTerm),
        longTerm: normalizeStringArray(input.goals?.longTerm),
      },
      arc: {
        start: normalizeString(input.arc?.start),
        midpoint: normalizeString(input.arc?.midpoint),
        end: normalizeString(input.arc?.end),
      },
      tags: normalizeStringArray(input.tags),
      createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
      updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
    };
  }

  private async saveNovelBible(): Promise<void> {
    if (!this.novelBible) {
      return;
    }
    this.novelBible.metadata.updatedAt = Date.now();
    this.novelBible.metadata.version = NOVEL_BIBLE_VERSION;
    const worldDir = '.ai-workshop/world';
    const dirExists = await workshopService.pathExists(worldDir);
    if (!dirExists) {
      await workshopService.createDirectory(worldDir);
    }
    await workshopService.writeFile(NOVEL_BIBLE_PATH, JSON.stringify(this.novelBible, null, 2));
  }

  private requireNovelBible(): NovelBible {
    if (!this.novelBible) {
      throw new Error('小说圣经未初始化');
    }
    return this.novelBible;
  }
}

export function createNovelBibleService(projectPath: string): NovelBibleService {
  return new NovelBibleService(projectPath);
}
