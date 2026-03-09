import {
  Subplot,
  SubplotNode,
  ThreadWeave,
  PlotInterweave,
  SubplotAnalysis,
  SubplotGap,
  SubplotConflict,
  SubplotSuggestion,
  WeavingPattern,
  SubplotType,
  SubplotStatus,
  ThreadWeaveType,
  SUBPLOT_TYPE_LABELS,
} from '@/types/plot/subplotManagement';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class SubplotManagementService {
  private projectPath: string;
  private subplots: Map<string, Subplot> = new Map();
  private weaves: Map<string, ThreadWeave> = new Map();
  private interweaves: Map<string, PlotInterweave> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const subplotsPath = `${this.projectPath}/设定/支线管理/支线列表.json`;
      const weavesPath = `${this.projectPath}/设定/支线管理/线索交织.json`;
      const interweavesPath = `${this.projectPath}/设定/支线管理/剧情交织.json`;

      const subplotsContent = await workshopService.readFile(subplotsPath);
      if (subplotsContent) {
        const data: Subplot[] = JSON.parse(subplotsContent);
        this.subplots = new Map(data.map((s) => [s.id, s]));
      }

      const weavesContent = await workshopService.readFile(weavesPath);
      if (weavesContent) {
        const data: ThreadWeave[] = JSON.parse(weavesContent);
        this.weaves = new Map(data.map((w) => [w.id, w]));
      }

      const interweavesContent = await workshopService.readFile(interweavesPath);
      if (interweavesContent) {
        const data: PlotInterweave[] = JSON.parse(interweavesContent);
        this.interweaves = new Map(data.map((i) => [i.id, i]));
      }
    } catch (error) {
      logger.error('加载支线管理数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/支线管理`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/支线列表.json`,
        JSON.stringify(Array.from(this.subplots.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/线索交织.json`,
        JSON.stringify(Array.from(this.weaves.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/剧情交织.json`,
        JSON.stringify(Array.from(this.interweaves.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存支线管理数据失败', { error });
    }
  }

  async createSubplot(
    name: string,
    type: SubplotType,
    description: string,
    mainCharacterId: string,
    mainCharacterName: string
  ): Promise<Subplot> {
    const now = Date.now();
    const subplot: Subplot = {
      id: `subplot_${uuidv4()}`,
      name,
      type,
      description,
      status: 'planned',
      mainCharacterId,
      mainCharacterName,
      supportingCharacters: [],
      startNodeId: '',
      currentNodeId: null,
      endNodeId: null,
      nodes: [],
      relatedMainPlotNodes: [],
      dependencies: [],
      emotionalArc: {
        startEmotion: '平静',
        endEmotion: '释然',
        keyMoments: [],
        transformation: '',
      },
      pacing: {
        intensity: 'moderate',
        frequency: 0.3,
        distribution: [],
      },
      visibility: 'background',
      priority: 5,
      createdAt: now,
      updatedAt: now,
    };

    this.subplots.set(subplot.id, subplot);
    await this.saveToDisk();
    return subplot;
  }

  async addSubplotNode(
    subplotId: string,
    node: Omit<SubplotNode, 'id' | 'subplotId' | 'sequence'>
  ): Promise<SubplotNode | null> {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return null;
    }

    const newNode: SubplotNode = {
      ...node,
      id: `node_${uuidv4()}`,
      subplotId,
      sequence: subplot.nodes.length,
    };

    subplot.nodes.push(newNode);
    subplot.nodes.sort((a, b) => a.sequence - b.sequence);

    if (subplot.nodes.length === 1) {
      subplot.startNodeId = newNode.id;
    }
    if (newNode.type === 'resolution') {
      subplot.endNodeId = newNode.id;
    }

    subplot.updatedAt = Date.now();
    await this.saveToDisk();
    return newNode;
  }

  async updateSubplotNode(
    subplotId: string,
    nodeId: string,
    updates: Partial<SubplotNode>
  ): Promise<SubplotNode | null> {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return null;
    }

    const nodeIndex = subplot.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex < 0) {
      return null;
    }

    subplot.nodes[nodeIndex] = { ...subplot.nodes[nodeIndex], ...updates };
    subplot.updatedAt = Date.now();
    await this.saveToDisk();
    return subplot.nodes[nodeIndex];
  }

  async updateSubplotStatus(subplotId: string, status: SubplotStatus): Promise<boolean> {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return false;
    }

    subplot.status = status;
    subplot.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async addSupportingCharacter(
    subplotId: string,
    characterId: string,
    characterName: string,
    role: string
  ): Promise<boolean> {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return false;
    }

    if (subplot.supportingCharacters.some((c) => c.characterId === characterId)) {
      return false;
    }

    subplot.supportingCharacters.push({ characterId, characterName, role });
    subplot.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async createWeave(
    mainPlotNodeId: string,
    subplotNodeId: string,
    subplotId: string,
    type: ThreadWeaveType,
    description: string
  ): Promise<ThreadWeave> {
    const weave: ThreadWeave = {
      id: `weave_${uuidv4()}`,
      name: `交织点 ${this.weaves.size + 1}`,
      type,
      mainPlotNodeId,
      subplotNodeId,
      subplotId,
      description,
      impact: 'moderate',
      charactersInvolved: [],
      consequences: [],
      chapter: '',
      notes: '',
    };

    const subplot = this.subplots.get(subplotId);
    if (subplot) {
      subplot.relatedMainPlotNodes.push(mainPlotNodeId);
      subplot.updatedAt = Date.now();
    }

    this.weaves.set(weave.id, weave);
    await this.saveToDisk();
    return weave;
  }

  async updateWeave(weaveId: string, updates: Partial<ThreadWeave>): Promise<ThreadWeave | null> {
    const weave = this.weaves.get(weaveId);
    if (!weave) {
      return null;
    }

    Object.assign(weave, updates);
    await this.saveToDisk();
    return weave;
  }

  async deleteWeave(weaveId: string): Promise<boolean> {
    const weave = this.weaves.get(weaveId);
    if (!weave) {
      return false;
    }

    const subplot = this.subplots.get(weave.subplotId);
    if (subplot) {
      subplot.relatedMainPlotNodes = subplot.relatedMainPlotNodes.filter(
        (id) => id !== weave.mainPlotNodeId
      );
      subplot.updatedAt = Date.now();
    }

    this.weaves.delete(weaveId);
    await this.saveToDisk();
    return true;
  }

  async createInterweave(
    name: string,
    description: string,
    mainPlotSegment: { startNode: string; endNode: string },
    subplots: Array<{
      subplotId: string;
      startNode: string;
      endNode: string;
      weaveType: ThreadWeaveType;
    }>,
    patternType: WeavingPattern['type']
  ): Promise<PlotInterweave> {
    const interweave: PlotInterweave = {
      id: `interweave_${uuidv4()}`,
      name,
      description,
      mainPlotSegment,
      subplots,
      weavingPattern: {
        type: patternType,
        rhythm: [],
        description: '',
      },
      tensionFlow: [],
      createdAt: Date.now(),
    };

    this.interweaves.set(interweave.id, interweave);
    await this.saveToDisk();
    return interweave;
  }

  getSubplot(id: string): Subplot | undefined {
    return this.subplots.get(id);
  }

  getAllSubplots(): Subplot[] {
    return Array.from(this.subplots.values());
  }

  getActiveSubplots(): Subplot[] {
    return this.getAllSubplots().filter((s) => s.status === 'active');
  }

  getSubplotsByType(type: SubplotType): Subplot[] {
    return this.getAllSubplots().filter((s) => s.type === type);
  }

  getSubplotsByCharacter(characterId: string): Subplot[] {
    return this.getAllSubplots().filter(
      (s) =>
        s.mainCharacterId === characterId ||
        s.supportingCharacters.some((c) => c.characterId === characterId)
    );
  }

  getWeave(id: string): ThreadWeave | undefined {
    return this.weaves.get(id);
  }

  getAllWeaves(): ThreadWeave[] {
    return Array.from(this.weaves.values());
  }

  getWeavesBySubplot(subplotId: string): ThreadWeave[] {
    return this.getAllWeaves().filter((w) => w.subplotId === subplotId);
  }

  getWeavesByMainPlotNode(mainPlotNodeId: string): ThreadWeave[] {
    return this.getAllWeaves().filter((w) => w.mainPlotNodeId === mainPlotNodeId);
  }

  getInterweave(id: string): PlotInterweave | undefined {
    return this.interweaves.get(id);
  }

  getAllInterweaves(): PlotInterweave[] {
    return Array.from(this.interweaves.values());
  }

  async analyzeSubplots(): Promise<SubplotAnalysis> {
    const activeSubplots = this.getActiveSubplots();
    const allSubplots = this.getAllSubplots();
    const allWeaves = this.getAllWeaves();

    const weavingDensity = allSubplots.length > 0 ? allWeaves.length / allSubplots.length : 0;

    const mainPlotRatio = 0.6;
    const subplotRatio = 0.4;

    const gaps = await this.detectGaps();
    const conflicts = await this.detectConflicts();
    const suggestions = await this.generateSuggestions();

    return {
      activeSubplots: activeSubplots.length,
      weavingDensity,
      balance: { mainPlotRatio, subplotRatio },
      gaps,
      conflicts,
      suggestions,
    };
  }

  private async detectGaps(): Promise<SubplotGap[]> {
    const gaps: SubplotGap[] = [];

    for (const subplot of this.getAllSubplots()) {
      if (subplot.status !== 'active') {
        continue;
      }

      if (subplot.nodes.length < 3) {
        gaps.push({
          id: `gap_${uuidv4()}`,
          subplotId: subplot.id,
          subplotName: subplot.name,
          type: 'missing_development',
          description: `支线 "${subplot.name}" 节点数量不足，需要更多发展`,
          suggestedAction: '添加发展节点或转折点',
        });
      }

      const hasClimax = subplot.nodes.some((n) => n.type === 'climax');
      const hasResolution = subplot.nodes.some((n) => n.type === 'resolution');

      if (hasClimax && !hasResolution) {
        gaps.push({
          id: `gap_${uuidv4()}`,
          subplotId: subplot.id,
          subplotName: subplot.name,
          type: 'incomplete_arc',
          description: `支线 "${subplot.name}" 已有高潮但缺少结局`,
          suggestedAction: '添加结局节点完成支线',
        });
      }

      const writtenNodes = subplot.nodes.filter((n) => n.status === 'written');
      if (writtenNodes.length === 0 && subplot.nodes.length > 0) {
        gaps.push({
          id: `gap_${uuidv4()}`,
          subplotId: subplot.id,
          subplotName: subplot.name,
          type: 'missing_development',
          description: `支线 "${subplot.name}" 尚未开始写作`,
          suggestedAction: '开始撰写支线的第一个节点',
        });
      }
    }

    return gaps;
  }

  private async detectConflicts(): Promise<SubplotConflict[]> {
    const conflicts: SubplotConflict[] = [];
    const activeSubplots = this.getActiveSubplots();

    for (let i = 0; i < activeSubplots.length; i++) {
      for (let j = i + 1; j < activeSubplots.length; j++) {
        const subplot1 = activeSubplots[i];
        const subplot2 = activeSubplots[j];

        const commonCharacters = subplot1.supportingCharacters
          .filter((c) =>
            subplot2.supportingCharacters.some((c2) => c2.characterId === c.characterId)
          )
          .map((c) => c.characterId);

        if (subplot1.mainCharacterId === subplot2.mainCharacterId || commonCharacters.length > 0) {
          const overlappingNodes = this.findOverlappingNodes(subplot1, subplot2);

          if (overlappingNodes.length > 0) {
            conflicts.push({
              id: `conflict_${uuidv4()}`,
              type: 'character_conflict',
              subplotIds: [subplot1.id, subplot2.id],
              description: `支线 "${subplot1.name}" 和 "${subplot2.name}" 在同一时间段涉及相同角色`,
              severity: 'minor',
              suggestion: '检查角色时间安排，确保逻辑合理',
            });
          }
        }
      }
    }

    return conflicts;
  }

  private findOverlappingNodes(
    subplot1: Subplot,
    subplot2: Subplot
  ): Array<{ node1: SubplotNode; node2: SubplotNode }> {
    const overlapping: Array<{ node1: SubplotNode; node2: SubplotNode }> = [];

    for (const node1 of subplot1.nodes) {
      for (const node2 of subplot2.nodes) {
        if (node1.chapter && node1.chapter === node2.chapter) {
          overlapping.push({ node1, node2 });
        }
      }
    }

    return overlapping;
  }

  private async generateSuggestions(): Promise<SubplotSuggestion[]> {
    const suggestions: SubplotSuggestion[] = [];
    const analysis = await this.analyzeSubplots();

    if (analysis.activeSubplots === 0) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'introduce_subplot',
        description: '当前没有活跃的支线，建议引入一条支线丰富故事',
        relatedSubplots: [],
        priority: 'high',
      });
    }

    if (analysis.activeSubplots > 5) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'resolve_subplot',
        description: '支线数量较多，建议完成部分支线后再开启新的',
        relatedSubplots: this.getActiveSubplots()
          .filter((s) => s.nodes.some((n) => n.type === 'climax'))
          .map((s) => s.id)
          .slice(0, 2),
        priority: 'medium',
      });
    }

    const weaves = this.getAllWeaves();
    if (weaves.length < analysis.activeSubplots) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'add_weave',
        description: '部分支线与主线交织不够，建议增加交织点',
        relatedSubplots: this.getActiveSubplots()
          .filter((s) => !weaves.some((w) => w.subplotId === s.id))
          .map((s) => s.id),
        priority: 'medium',
      });
    }

    return suggestions;
  }

  async suggestWeavePoints(subplotId: string): Promise<
    Array<{
      mainPlotNodeId: string;
      reason: string;
      suggestedType: ThreadWeaveType;
    }>
  > {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return [];
    }

    const prompt = `分析以下支线，建议与主线交织的最佳节点：

支线名称: ${subplot.name}
支线类型: ${SUBPLOT_TYPE_LABELS[subplot.type]}
支线描述: ${subplot.description}

支线节点:
${subplot.nodes.map((n) => `- ${n.title} (${n.type})`).join('\n')}

请以JSON格式返回建议的交织点：
{
  "suggestions": [
    {
      "mainPlotNodeId": "主线节点ID（用序号表示，如 node_1）",
      "reason": "建议原因",
      "suggestedType": "convergence/divergence/parallel/intersection/crossover"
    }
  ]
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 500,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const data = JSON.parse(jsonMatch[0]);
      return data.suggestions || [];
    } catch {
      return [];
    }
  }

  async calculatePacing(subplotId: string): Promise<{
    currentIntensity: number;
    recommendedIntensity: number;
    distribution: number[];
  }> {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return { currentIntensity: 0, recommendedIntensity: 0, distribution: [] };
    }

    const tensionLevels = subplot.nodes.map((n) => n.tensionLevel);
    const currentIntensity =
      tensionLevels.length > 0
        ? tensionLevels.reduce((a, b) => a + b, 0) / tensionLevels.length
        : 0;

    const targetIntensity =
      subplot.pacing.intensity === 'slow' ? 2 : subplot.pacing.intensity === 'fast' ? 5 : 3.5;

    const distribution = this.calculateDistribution(subplot);

    return {
      currentIntensity,
      recommendedIntensity: targetIntensity,
      distribution,
    };
  }

  private calculateDistribution(subplot: Subplot): number[] {
    const distribution: number[] = [];
    const totalNodes = subplot.nodes.length;

    for (let i = 0; i < totalNodes; i++) {
      const node = subplot.nodes[i];
      const position = i / Math.max(totalNodes - 1, 1);

      let baseTension = node.tensionLevel;

      if (position < 0.3) {
        baseTension *= 0.8;
      } else if (position > 0.7) {
        baseTension *= 1.2;
      }

      distribution.push(Math.min(7, Math.max(1, baseTension)));
    }

    return distribution;
  }

  deleteSubplot(subplotId: string): boolean {
    const subplot = this.subplots.get(subplotId);
    if (!subplot) {
      return false;
    }

    for (const [weaveId, weave] of this.weaves) {
      if (weave.subplotId === subplotId) {
        this.weaves.delete(weaveId);
      }
    }

    this.subplots.delete(subplotId);
    this.saveToDisk();
    return true;
  }

  getStats(): {
    totalSubplots: number;
    activeSubplots: number;
    totalWeaves: number;
    byType: Record<SubplotType, number>;
    byStatus: Record<SubplotStatus, number>;
  } {
    const all = this.getAllSubplots();

    const byType: Record<SubplotType, number> = {
      romance: 0,
      mystery: 0,
      revenge: 0,
      growth: 0,
      conflict: 0,
      exploration: 0,
      political: 0,
      economic: 0,
      military: 0,
      personal: 0,
    };

    const byStatus: Record<SubplotStatus, number> = {
      planned: 0,
      active: 0,
      paused: 0,
      completed: 0,
      abandoned: 0,
    };

    for (const subplot of all) {
      byType[subplot.type]++;
      byStatus[subplot.status]++;
    }

    return {
      totalSubplots: all.length,
      activeSubplots: byStatus.active,
      totalWeaves: this.weaves.size,
      byType,
      byStatus,
    };
  }
}

export function createSubplotManagementService(projectPath: string): SubplotManagementService {
  return new SubplotManagementService(projectPath);
}
