import { ToolContext } from '../toolRegistry';
import { StoryUpdateArgs, ToolResult } from './types';
import { getServiceRegistry, ServiceRegistry } from '../../core/serviceInitializer';
import type { CharacterArchetype } from '@/types/character/characterProfile';
import type { ForeshadowingType, ForeshadowingImportance } from '@/types/plot/foreshadowing';
import type { NovelBibleTimelineEvent } from '@/types/world/novelBible';

export const storyUpdateDefinition = {
  name: 'story_update',
  description: `更新小说状态信息。这是故事状态系统的核心更新工具。

支持的更新类型：
- character: 添加/更新/删除角色
- plot: 添加/更新情节事件
- timeline: 更新时间线
- foreshadowing: 添加/更新伏笔
- world: 更新世界观设定

操作类型：
- add: 添加新元素
- update: 更新现有元素
- remove: 删除元素
- upsert: 添加或更新

使用示例：
- story_update({ type: "character", action: "add", data: { name: "主角", role: "protagonist" } })
- story_update({ type: "plot", action: "add", data: { event: "战斗", description: "..." } })`,
  parameters: {
    type: {
      type: 'string',
      description: '更新类型：character | plot | timeline | foreshadowing | world | timeline_event',
      enum: ['character', 'plot', 'timeline', 'foreshadowing', 'world', 'timeline_event'],
      required: true,
    },
    action: {
      type: 'string',
      description: '操作类型：add | update | remove | upsert | build',
      enum: ['add', 'update', 'remove', 'upsert', 'build'],
      required: true,
    },
    data: {
      type: 'object',
      description: '更新数据，具体结构取决于 type',
      required: true,
    },
  },
  category: 'story',
};

export async function storyUpdateHandler(args: StoryUpdateArgs, _context: ToolContext): Promise<ToolResult> {
  const { type, action, data } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    switch (type) {
      case 'character':
        return await updateCharacter(services, action, data);
      case 'plot':
        return await updatePlot(services, action, data);
      case 'timeline':
        return await updateTimeline(services, action, data);
      case 'foreshadowing':
        return await updateForeshadowing(services, action, data);
      case 'world':
        return await updateWorld(services, action, data);
      case 'timeline_event':
        return await updateTimelineEvent(services, action, data);
      default:
        return { success: false, error: `未知更新类型: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function updateCharacter(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const characterService = services.characterService;
  if (!characterService) {
    return { success: false, error: '角色服务未初始化' };
  }

  switch (action) {
    case 'add':
    case 'upsert':
      const name = data.name as string;
      if (!name) {
        return { success: false, error: '角色名称不能为空' };
      }
      const character = characterService.createCharacter({
        name,
        role: (data.role as 'protagonist' | 'antagonist' | 'supporting' | 'minor') || 'supporting',
        archetype: (data.archetype as CharacterArchetype) || 'hero',
        aliases: data.aliases as string[],
        notes: data.description as string,
      });
      return { success: true, result: { action: 'added', character: character.id, name } };

    case 'update':
      const charId = data.id as string || characterService.getCharacterByName(data.name as string)?.id;
      if (!charId) {
        return { success: false, error: '找不到要更新的角色' };
      }
      characterService.updateCharacter(charId, data as Partial<import('@/types/character/characterProfile').CharacterProfile>);
      return { success: true, result: { action: 'updated', character: charId } };

    case 'remove':
      const removeId = data.id as string || characterService.getCharacterByName(data.name as string)?.id;
      if (!removeId) {
        return { success: false, error: '找不到要删除的角色' };
      }
      characterService.deleteCharacter(removeId);
      return { success: true, result: { action: 'removed', character: removeId } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}

async function updatePlot(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const timelineService = services.timelineService;
  if (!timelineService) {
    return { success: false, error: '时间线服务未初始化' };
  }

  switch (action) {
    case 'add':
      const event = timelineService.addEvent({
        title: (data.title as string) || (data.event as string) || '',
        description: data.description as string || '',
        storyTime: data.storyTime as string || '',
        characters: (data.characters as string[]) || [],
        location: data.location as string || '',
        significance: 'minor',
        consequences: [],
        relatedEvents: [],
      });
      return { success: true, result: { action: 'added', event: event.id } };

    case 'update':
      timelineService.updateEvent(data.id as string, data as Partial<import('@/types/plot/plotNode').TimelineEvent>);
      return { success: true, result: { action: 'updated', event: data.id } };

    case 'remove':
      timelineService.deleteEvent(data.id as string);
      return { success: true, result: { action: 'removed', event: data.id } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}

async function updateTimeline(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const novelBibleService = services.novelBibleService;
  if (!novelBibleService) {
    return { success: false, error: '小说圣经服务未初始化' };
  }

  switch (action) {
    case 'upsert':
      const track = await novelBibleService.upsertTimelineTrack({
        id: data.id as string,
        name: data.name as string,
        events: [],
      });
      return { success: true, result: { action: 'upserted', track: track.id } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}

async function updateForeshadowing(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const foreshadowingService = services.foreshadowingService;
  const novelBibleService = services.novelBibleService;

  switch (action) {
    case 'add':
      if (!foreshadowingService) {
        return { success: false, error: '伏笔服务未初始化' };
      }
      const foreshadowing = foreshadowingService.createForeshadowing({
        title: (data.title as string) || (data.description as string),
        content: data.content as string || '',
        type: (data.type as ForeshadowingType) || 'plot_twist',
        importance: (data.importance as ForeshadowingImportance) || 'minor',
        plantedAt: {
          chapter: data.plantedChapter as string || '',
          description: '',
        },
        plannedResolution: {
          estimatedChapter: data.resolvedChapter as string || '',
          description: '',
        },
        relatedCharacters: data.relatedCharacters as string[],
      });
      return { success: true, result: { action: 'added', foreshadowing: foreshadowing.id } };

    case 'upsert':
      if (!novelBibleService) {
        return { success: false, error: '小说圣经服务未初始化' };
      }
      const upserted = await novelBibleService.upsertForeshadowing({
        id: data.id as string,
        title: data.title as string,
        seed: data.seed as string || '',
        status: (data.status as 'seeded' | 'hinted' | 'paid_off' | 'discarded') || 'seeded',
      });
      return { success: true, result: { action: 'upserted', foreshadowing: upserted.id } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}

async function updateWorld(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const novelBibleService = services.novelBibleService;
  const worldModelService = services.worldModelService;

  switch (action) {
    case 'build':
      if (!worldModelService) {
        return { success: false, error: '世界模型服务未初始化' };
      }
      return { success: true, result: { action: 'built', message: '世界构建功能需要更多参数' } };

    case 'update':
      if (!novelBibleService) {
        return { success: false, error: '小说圣经服务未初始化' };
      }
      await novelBibleService.updateMetadata(data as Partial<import('@/types/world/novelBible').NovelBibleMetadata>);
      return { success: true, result: { action: 'updated', meta: data } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}

async function updateTimelineEvent(
  services: ServiceRegistry,
  action: string,
  data: Record<string, unknown>
): Promise<ToolResult> {
  const novelBibleService = services.novelBibleService;
  if (!novelBibleService) {
    return { success: false, error: '小说圣经服务未初始化' };
  }

  switch (action) {
    case 'upsert':
      const trackId = data.trackId as string;
      const eventData: Omit<NovelBibleTimelineEvent, 'id'> = {
        title: data.title as string || '',
        summary: data.description as string || '',
        phase: 'setup',
        timeLabel: data.storyTime as string || '',
        chapterHint: data.chapter as string || '',
        participants: (data.characters as string[]) || [],
        dependencies: [],
        status: 'planned',
        tags: [],
        updatedAt: Date.now(),
      };
      const event = await novelBibleService.upsertTimelineEvent(trackId, eventData);
      return { success: true, result: { action: 'upserted', event: event.id } };

    default:
      return { success: false, error: `未知操作: ${action}` };
  }
}
