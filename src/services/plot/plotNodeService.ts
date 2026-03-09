import {
  PlotNode,
  PlotNodeType,
  PlotNodeStatus,
  PlotLine,
  PlotLineType,
  TimelineEvent,
  PLOT_NODE_TYPES,
  PLOT_LINE_COLORS,
} from '@/types/plot/plotNode';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class PlotNodeService {
  private projectPath: string;
  private nodes: Map<string, PlotNode> = new Map();
  private plotLines: Map<string, PlotLine> = new Map();
  private timelineEvents: Map<string, TimelineEvent> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const nodesPath = `${this.projectPath}/设定/剧情节点.json`;
      const linesPath = `${this.projectPath}/设定/剧情线.json`;
      const timelinePath = `${this.projectPath}/设定/时间线.json`;

      const nodesContent = await workshopService.readFile(nodesPath);
      if (nodesContent) {
        const data = JSON.parse(nodesContent);
        this.nodes = new Map(data.map((n: PlotNode) => [n.id, n]));
      }

      const linesContent = await workshopService.readFile(linesPath);
      if (linesContent) {
        const data = JSON.parse(linesContent);
        this.plotLines = new Map(data.map((l: PlotLine) => [l.id, l]));
      }

      const timelineContent = await workshopService.readFile(timelinePath);
      if (timelineContent) {
        const data = JSON.parse(timelineContent);
        this.timelineEvents = new Map(data.map((t: TimelineEvent) => [t.id, t]));
      }
    } catch (error) {
      logger.error('加载剧情节点失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const nodesPath = `${this.projectPath}/设定/剧情节点.json`;
      const linesPath = `${this.projectPath}/设定/剧情线.json`;
      const timelinePath = `${this.projectPath}/设定/时间线.json`;

      await workshopService.writeFile(
        nodesPath,
        JSON.stringify(Array.from(this.nodes.values()), null, 2)
      );
      await workshopService.writeFile(
        linesPath,
        JSON.stringify(Array.from(this.plotLines.values()), null, 2)
      );
      await workshopService.writeFile(
        timelinePath,
        JSON.stringify(Array.from(this.timelineEvents.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存剧情节点失败', { error });
    }
  }

  createPlotLine(name: string, type: PlotLineType, description: string): PlotLine {
    const id = `plotline_${uuidv4()}`;
    const colors = Object.values(PLOT_LINE_COLORS);
    const color = colors[Math.floor(Math.random() * colors.length)];

    const plotLine: PlotLine = {
      id,
      name,
      type,
      description,
      nodes: [],
      status: 'planned',
      color,
      priority: type === 'main' ? 0 : 1,
    };

    this.plotLines.set(id, plotLine);
    this.saveToDisk();
    return plotLine;
  }

  getPlotLine(id: string): PlotLine | undefined {
    return this.plotLines.get(id);
  }

  getAllPlotLines(): PlotLine[] {
    return Array.from(this.plotLines.values()).sort((a, b) => a.priority - b.priority);
  }

  getMainPlotLine(): PlotLine | undefined {
    return Array.from(this.plotLines.values()).find((l) => l.type === 'main');
  }

  createPlotNode(node: Omit<PlotNode, 'id' | 'createdAt' | 'updatedAt'>): PlotNode {
    const id = `node_${uuidv4()}`;
    const now = Date.now();

    const newNode: PlotNode = {
      ...node,
      id,
      status: node.status || 'planned',
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(id, newNode);

    if (node.plotLineId) {
      const plotLine = this.plotLines.get(node.plotLineId);
      if (plotLine) {
        plotLine.nodes.push(id);
      }
    }

    this.saveToDisk();
    return newNode;
  }

  getPlotNode(id: string): PlotNode | undefined {
    return this.nodes.get(id);
  }

  getAllPlotNodes(): PlotNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.sequence - b.sequence);
  }

  getNodesByPlotLine(plotLineId: string): PlotNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.plotLineId === plotLineId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  getNodesByStatus(status: PlotNodeStatus): PlotNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.status === status)
      .sort((a, b) => a.sequence - b.sequence);
  }

  updatePlotNode(id: string, updates: Partial<PlotNode>): PlotNode | undefined {
    const node = this.nodes.get(id);
    if (!node) {
      return undefined;
    }

    const updatedNode: PlotNode = {
      ...node,
      ...updates,
      updatedAt: Date.now(),
    };

    this.nodes.set(id, updatedNode);
    this.saveToDisk();
    return updatedNode;
  }

  completeNode(id: string, actualChapter?: string): PlotNode | undefined {
    const node = this.nodes.get(id);
    if (!node) {
      return undefined;
    }

    const updates: Partial<PlotNode> = {
      status: 'completed',
      actualChapter,
    };

    if (node.foreshadowingPlanted.length > 0) {
      for (const foreshadowId of node.foreshadowingPlanted) {
        this.checkForeshadowingResolution(foreshadowId);
      }
    }

    return this.updatePlotNode(id, updates);
  }

  private checkForeshadowingResolution(foreshadowingId: string): void {
    for (const node of this.nodes.values()) {
      if (node.foreshadowingResolved.includes(foreshadowingId)) {
        logger.debug('伏笔已解决', { foreshadowingId, nodeId: node.id });
      }
    }
  }

  deletePlotNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) {
      return false;
    }

    if (node.plotLineId) {
      const plotLine = this.plotLines.get(node.plotLineId);
      if (plotLine) {
        plotLine.nodes = plotLine.nodes.filter((n) => n !== id);
      }
    }

    this.nodes.delete(id);
    this.saveToDisk();
    return true;
  }

  getNextNode(plotLineId?: string): PlotNode | undefined {
    const nodes = plotLineId ? this.getNodesByPlotLine(plotLineId) : this.getAllPlotNodes();

    return nodes.find((n) => n.status === 'planned' || n.status === 'in_progress');
  }

  getCurrentProgress(): {
    totalNodes: number;
    completedNodes: number;
    inProgressNodes: number;
    plannedNodes: number;
    percentage: number;
    currentPlotLine?: PlotLine;
    nextNode?: PlotNode;
  } {
    const nodes = this.getAllPlotNodes();
    const totalNodes = nodes.length;
    const completedNodes = nodes.filter((n) => n.status === 'completed').length;
    const inProgressNodes = nodes.filter((n) => n.status === 'in_progress').length;
    const plannedNodes = nodes.filter((n) => n.status === 'planned').length;

    const percentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    const mainPlotLine = this.getMainPlotLine();
    const nextNode = this.getNextNode();

    return {
      totalNodes,
      completedNodes,
      inProgressNodes,
      plannedNodes,
      percentage,
      currentPlotLine: mainPlotLine,
      nextNode,
    };
  }

  suggestNextPlotNode(): {
    suggestion: string;
    type: PlotNodeType;
    reason: string;
  } | null {
    const mainLine = this.getMainPlotLine();

    if (!mainLine) {
      return {
        suggestion: '创建主线剧情',
        type: 'opening',
        reason: '还没有主线剧情，建议先创建主线',
      };
    }

    const nodes = this.getNodesByPlotLine(mainLine.id);
    const completedCount = nodes.filter((n) => n.status === 'completed').length;

    if (completedCount === 0) {
      return {
        suggestion: '创建开篇节点',
        type: 'opening',
        reason: '主线剧情还没有任何节点，建议从开篇开始',
      };
    }

    const lastCompleted = nodes
      .filter((n) => n.status === 'completed')
      .sort((a, b) => b.sequence - a.sequence)
      .pop();
    if (lastCompleted) {
      const nextTypes = this.getNextNodeType(lastCompleted.type);
      return {
        suggestion: `创建${PLOT_NODE_TYPES[nextTypes[0]].name}节点`,
        type: nextTypes[0],
        reason: `上一个完成的节点是"${lastCompleted.title}"，建议继续推进剧情`,
      };
    }

    return null;
  }

  private getNextNodeType(currentType: PlotNodeType): PlotNodeType[] {
    const sequence: Record<PlotNodeType, PlotNodeType[]> = {
      opening: ['inciting_incident'],
      inciting_incident: ['rising_action', 'subplot_start'],
      rising_action: ['midpoint', 'turning_point', 'conflict'],
      midpoint: ['climax', 'subplot_end'],
      climax: ['falling_action'],
      falling_action: ['resolution'],
      resolution: [],
      subplot_start: ['subplot_end'],
      subplot_end: [],
      turning_point: ['climax', 'revelation'],
      revelation: ['climax'],
      conflict: ['turning_point', 'climax'],
      custom: [],
    };

    return sequence[currentType] || ['custom'];
  }

  addForeshadowingToNode(nodeId: string, foreshadowingId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    node.foreshadowingPlanted.push(foreshadowingId);
    this.updatePlotNode(nodeId, { foreshadowingPlanted: node.foreshadowingPlanted });
    return true;
  }

  resolveForeshadowingAtNode(nodeId: string, foreshadowingId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    node.foreshadowingResolved.push(foreshadowingId);
    this.updatePlotNode(nodeId, { foreshadowingResolved: node.foreshadowingResolved });
    return true;
  }

  getUnresolvedForeshadowing(): Array<{ nodeId: string; foreshadowingId: string; node: PlotNode }> {
    const unresolved: Array<{ nodeId: string; foreshadowingId: string; node: PlotNode }> = [];

    for (const node of this.nodes.values()) {
      for (const foreshadowingId of node.foreshadowingPlanted) {
        let resolved = false;
        for (const n of this.nodes.values()) {
          if (n.foreshadowingResolved.includes(foreshadowingId)) {
            resolved = true;
            break;
          }
        }
        if (!resolved) {
          unresolved.push({ nodeId: node.id, foreshadowingId, node });
        }
      }
    }

    return unresolved;
  }

  createTimelineEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    const id = `timeline_${uuidv4()}`;
    const newEvent: TimelineEvent = {
      ...event,
      id,
    };

    this.timelineEvents.set(id, newEvent);
    this.saveToDisk();
    return newEvent;
  }

  getTimelineEvents(): TimelineEvent[] {
    return Array.from(this.timelineEvents.values());
  }

  getTimelineEventsByCharacter(characterName: string): TimelineEvent[] {
    return Array.from(this.timelineEvents.values()).filter((e) =>
      e.characters.includes(characterName)
    );
  }

  exportPlotStructure(): {
    plotLines: PlotLine[];
    nodes: PlotNode[];
    timeline: TimelineEvent[];
  } {
    return {
      plotLines: this.getAllPlotLines(),
      nodes: this.getAllPlotNodes(),
      timeline: this.getTimelineEvents(),
    };
  }
}

export function createPlotNodeService(projectPath: string): PlotNodeService {
  return new PlotNodeService(projectPath);
}
