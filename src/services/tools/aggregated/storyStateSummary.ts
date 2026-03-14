import { ToolContext } from '../toolRegistry';
import { StoryStateSummaryArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';

export const storyStateSummaryDefinition = {
  name: 'story_state_summary',
  description: `总结当前故事状态。在开始写作任务前，建议先调用此工具了解故事上下文。

支持的总结范围：
- chapter: 单章总结，- arc: 故事弧线总结
- full: 全书总结

返回内容包括：
- 角色状态概览
- 情节进展
- 未解决的伏笔
- 世界观完整性检查`,
  parameters: {
    scope: {
      type: 'string',
      description: '总结范围：chapter(单章) | arc(故事弧) | full(全书)',
      enum: ['chapter', 'arc', 'full'],
      required: true,
    },
    chapterId: {
      type: 'string',
      description: '章节ID（仅 chapter 范围需要）',
    },
  },
  category: 'story',
};

export async function storyStateSummaryHandler(args: StoryStateSummaryArgs, _context: ToolContext): Promise<ToolResult> {
  const { scope, chapterId } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    const summary: Record<string, unknown> = { scope };

    if (services.characterService) {
      const characters = services.characterService.getAllCharacters();
      summary.characters = {
        total: characters.length,
        protagonists: characters.filter(c => c.role === 'protagonist').map(c => c.name),
        antagonists: characters.filter(c => c.role === 'antagonist').map(c => c.name),
        supporting: characters.filter(c => c.role === 'supporting').length,
      };
    }

    if (services.timelineService) {
      const events = services.timelineService.getAllEvents();
      summary.timeline = {
        totalEvents: events.length,
        recentEvents: events.slice(-5).map(e => ({
          title: e.title,
          storyTime: e.storyTime,
          location: e.location,
        })),
      };
    }

    if (services.foreshadowingService) {
      const foreshadowings = services.foreshadowingService.getAllForeshadowings();
      const unresolved = foreshadowings.filter(f => f.status === 'planted');
      summary.foreshadowing = {
        total: foreshadowings.length,
        unresolved: unresolved.length,
        unresolvedItems: unresolved.slice(0, 5).map(f => ({
          title: f.title,
          type: f.type,
        })),
      };
    }

    if (services.novelBibleService) {
      const bible = services.novelBibleService.getNovelBible();
      if (bible) {
        summary.worldBuilding = {
          title: bible.metadata.title,
          characterCount: bible.characters.length,
          timelineTracks: bible.timelineTracks.length,
          foreshadowingCount: bible.foreshadowing.length,
        };
      }
    }

    if (scope === 'chapter' && chapterId) {
      summary.chapterId = chapterId;
    }

    return { success: true, result: summary };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}
