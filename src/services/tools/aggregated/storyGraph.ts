import { ToolContext } from '../toolRegistry';
import { StoryGraphArgs, ToolResult } from './types';
import { getServiceRegistry, ServiceRegistry } from '../../core/serviceInitializer';

export const storyGraphDefinition = {
  name: 'story_graph',
  description: `获取小说的结构关系图。用于分析角色关系、情节依赖和时间线流程。

支持的图类型：
- character_relations: 角色关系图，显示角色之间的互动关系
- plot_dependencies: 情节依赖图，显示事件之间的因果关系
- timeline_flow: 时间线流程图，显示事件的时序排列

这是高级分析工具，用于理解小说的整体结构。`,
  parameters: {
    type: {
      type: 'string' as const,
      description: '图类型：character_relations | plot_dependencies | timeline_flow',
      enum: ['character_relations', 'plot_dependencies', 'timeline_flow'],
      required: true,
    },
    id: {
      type: 'string' as const,
      description: '可选的节点ID，用于获取子图',
    },
  },
  category: 'story',
};

export async function storyGraphHandler(args: StoryGraphArgs, _context: ToolContext): Promise<ToolResult> {
  const { type, id } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    switch (type) {
      case 'character_relations':
        return await getCharacterRelations(services, id);
      case 'plot_dependencies':
        return await getPlotDependencies(services, id);
      case 'timeline_flow':
        return await getTimelineFlow(services, id);
      default:
        return { success: false, error: `未知图类型: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  data?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  type: string;
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function getCharacterRelations(
  services: ServiceRegistry,
  id?: string
): Promise<ToolResult> {
  const characterService = services.characterService;
  if (!characterService) {
    return { success: false, error: '角色服务未初始化' };
  }

  const characters = characterService.getAllCharacters();
  const graph: GraphResult = { nodes: [], edges: [] };

  for (const char of characters) {
    if (id && char.name !== id) continue;

    graph.nodes.push({
      id: char.name,
      label: char.name,
      type: 'character',
      data: {
        role: char.role,
        archetype: char.archetype,
        traits: char.personality?.traits || [],
      },
    });

    if (char.relationships && Array.isArray(char.relationships)) {
      for (const rel of char.relationships) {
        const targetName = rel.targetName || rel.targetId;
        graph.edges.push({
          source: char.name,
          target: targetName,
          label: rel.relationshipType,
          type: 'relation',
        });

        if (!graph.nodes.find(n => n.id === targetName)) {
          graph.nodes.push({
            id: targetName,
            label: targetName,
            type: 'character',
          });
        }
      }
    }
  }

  return { success: true, result: { type: 'character_relations', graph } };
}

async function getPlotDependencies(
  services: ServiceRegistry,
  id?: string
): Promise<ToolResult> {
  const timelineService = services.timelineService;
  const foreshadowingService = services.foreshadowingService;

  const graph: GraphResult = { nodes: [], edges: [] };

  if (timelineService) {
    const events = timelineService.getAllEvents();

    for (const event of events) {
      if (id && event.id !== id) continue;

      graph.nodes.push({
        id: event.id || event.title,
        label: event.title,
        type: 'event',
        data: {
          storyTime: event.storyTime,
          location: event.location,
          significance: event.significance,
        },
      });

      if (event.consequences && Array.isArray(event.consequences)) {
        for (const consequence of event.consequences) {
          graph.edges.push({
            source: event.id || event.title,
            target: consequence,
            label: '导致',
            type: 'causality',
          });
        }
      }
    }
  }

  if (foreshadowingService) {
    const foreshadowings = foreshadowingService.getAllForeshadowings();

    for (const f of foreshadowings) {
      graph.nodes.push({
        id: f.id,
        label: f.title,
        type: 'foreshadowing',
        data: {
          status: f.status,
          type: f.type,
          plantedAt: f.plantedAt?.chapter,
          resolvedAt: f.actualResolution?.chapter,
        },
      });

      if (f.plantedAt?.chapter && f.actualResolution?.chapter) {
        graph.edges.push({
          source: f.plantedAt.chapter,
          target: f.actualResolution.chapter,
          label: '伏笔',
          type: 'foreshadowing',
        });
      }
    }
  }

  return { success: true, result: { type: 'plot_dependencies', graph } };
}

async function getTimelineFlow(
  services: ServiceRegistry,
  id?: string
): Promise<ToolResult> {
  const timelineService = services.timelineService;
  if (!timelineService) {
    return { success: false, error: '时间线服务未初始化' };
  }

  const events = timelineService.getAllEvents();
  const graph: GraphResult = { nodes: [], edges: [] };

  const sortedEvents = [...events].sort((a, b) => {
    const aTime = a.storyTime || '0';
    const bTime = b.storyTime || '0';
    return aTime.localeCompare(bTime);
  });

  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    if (id && event.id !== id) continue;

    graph.nodes.push({
      id: event.id || `event_${i}`,
      label: event.title,
      type: 'event',
      data: {
        storyTime: event.storyTime,
        location: event.location,
        significance: event.significance,
        order: i,
      },
    });

    if (i > 0) {
      const prevEvent = sortedEvents[i - 1];
      graph.edges.push({
        source: prevEvent.id || `event_${i - 1}`,
        target: event.id || `event_${i}`,
        label: '之后',
        type: 'sequence',
      });
    }
  }

  return { success: true, result: { type: 'timeline_flow', graph } };
}
