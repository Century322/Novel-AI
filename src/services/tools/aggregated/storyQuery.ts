import { ToolContext } from '../toolRegistry';
import { StoryQueryArgs, ToolResult } from './types';
import { getServiceRegistry, ServiceRegistry } from '../../core/serviceInitializer';

export const storyQueryDefinition = {
  name: 'story_query',
  description: `查询小说状态信息。这是故事状态系统的核心查询工具。

支持的查询类型：
- character: 查询角色信息，id 为角色名
- plot: 查询情节状态，id 为情节线标识
- timeline: 查询时间线
- world: 查询世界观设定
- foreshadowing: 查询伏笔状态
- context: 获取写作上下文
- guide: 获取写作指南
- style: 获取风格约束

使用示例：
- story_query({ type: "character", id: "主角" })
- story_query({ type: "timeline" })
- story_query({ type: "world" })`,
  parameters: {
    type: {
      type: 'string',
      description: '查询类型：character | plot | timeline | world | foreshadowing | context | guide | style',
      enum: ['character', 'plot', 'timeline', 'world', 'foreshadowing', 'context', 'guide', 'style'],
      required: true,
    },
    id: {
      type: 'string',
      description: '查询对象的标识（如角色名、情节线ID）',
    },
    scope: {
      type: 'string',
      description: '查询范围（可选）',
    },
  },
  category: 'story',
};

export async function storyQueryHandler(args: StoryQueryArgs, context: ToolContext): Promise<ToolResult> {
  const { type, id, scope } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    switch (type) {
      case 'character':
        return await queryCharacter(services, id);
      case 'plot':
        return await queryPlot(services, id);
      case 'timeline':
        return await queryTimeline(services, scope);
      case 'world':
        return await queryWorld(services);
      case 'foreshadowing':
        return await queryForeshadowing(services);
      case 'context':
        return await queryContext(services, context);
      case 'guide':
        return await queryGuide(services);
      case 'style':
        return await queryStyle(services);
      default:
        return { success: false, error: `未知查询类型: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function queryCharacter(services: ServiceRegistry, id?: string): Promise<ToolResult> {
  const characterService = services.characterService;
  if (!characterService) {
    return { success: false, error: '角色服务未初始化' };
  }

  if (id) {
    const character = characterService.getCharacterByName(id) || characterService.getCharacter(id);
    if (!character) {
      return { success: false, error: `角色 "${id}" 不存在` };
    }
    return { success: true, result: character };
  }

  const characters = characterService.getAllCharacters();
  return { success: true, result: { total: characters.length, characters } };
}

async function queryPlot(services: ServiceRegistry, id?: string): Promise<ToolResult> {
  const timelineService = services.timelineService;
  if (!timelineService) {
    return { success: false, error: '时间线服务未初始化' };
  }

  const events = timelineService.getAllEvents();
  
  if (id) {
    const filtered = events.filter(e => e.storyTime?.includes(id));
    return { success: true, result: { plotLine: id, events: filtered } };
  }

  return { success: true, result: { total: events.length, events } };
}

async function queryTimeline(services: ServiceRegistry, scope?: string): Promise<ToolResult> {
  const timelineService = services.timelineService;
  if (!timelineService) {
    return { success: false, error: '时间线服务未初始化' };
  }

  const events = timelineService.getAllEvents();
  
  if (scope) {
    const filtered = events.filter(e => 
      e.storyTime?.includes(scope) || e.location?.includes(scope)
    );
    return { success: true, result: { scope, events: filtered } };
  }

  return { success: true, result: { total: events.length, events } };
}

async function queryWorld(services: ServiceRegistry): Promise<ToolResult> {
  const novelBibleService = services.novelBibleService;
  if (!novelBibleService) {
    return { success: false, error: '世界观服务未初始化' };
  }

  const bible = novelBibleService.getNovelBible();
  return { success: true, result: bible };
}

async function queryForeshadowing(services: ServiceRegistry): Promise<ToolResult> {
  const foreshadowingService = services.foreshadowingService;
  if (!foreshadowingService) {
    return { success: false, error: '伏笔服务未初始化' };
  }

  const foreshadowings = foreshadowingService.getAllForeshadowings();
  return { success: true, result: { total: foreshadowings.length, foreshadowings } };
}

async function queryContext(services: ServiceRegistry, context: ToolContext): Promise<ToolResult> {
  const memoryService = services.memoryService;
  const compressionService = services.compressionService;

  const result: Record<string, unknown> = {};

  if (compressionService) {
    const compressed = await compressionService.compress({ maxTokens: 2000 });
    result.context = compressed.summary;
  }

  if (memoryService) {
    const memories = memoryService.getAllMemories();
    result.memories = memories;
  }

  result.projectPath = context.projectPath;

  return { success: true, result };
}

async function queryGuide(services: ServiceRegistry): Promise<ToolResult> {
  const reminderService = services.reminderService;
  if (!reminderService) {
    return { success: false, error: '写作指南服务未初始化' };
  }

  const guides = reminderService.getAllReminders();
  return { success: true, result: { guides } };
}

async function queryStyle(services: ServiceRegistry): Promise<ToolResult> {
  const styleService = services.styleService;
  if (!styleService) {
    return { success: false, error: '风格服务未初始化' };
  }

  const profile = styleService.getProfile();
  return { success: true, result: { profile } };
}
