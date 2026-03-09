import {
  CharacterArc,
  ArcStage,
  CharacterState,
  Relationship,
  RelationshipMoment,
  RelationshipNetwork,
  RelationshipCluster,
  NetworkStats,
  ArcAnalysis,
  ArcGap,
  ArcSuggestion,
  ArcStageType,
  ArcStatus,
  RelationshipType,
  ARC_STAGE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from '@/types/character/characterArc';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class CharacterArcService {
  private projectPath: string;
  private arcs: Map<string, CharacterArc> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private networks: Map<string, RelationshipNetwork> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const arcsPath = `${this.projectPath}/设定/人物弧线/弧线列表.json`;
      const relationshipsPath = `${this.projectPath}/设定/人物弧线/关系网络.json`;

      const arcsContent = await workshopService.readFile(arcsPath);
      if (arcsContent) {
        const data: CharacterArc[] = JSON.parse(arcsContent);
        this.arcs = new Map(data.map((a) => [a.id, a]));
      }

      const relationshipsContent = await workshopService.readFile(relationshipsPath);
      if (relationshipsContent) {
        const data: Relationship[] = JSON.parse(relationshipsContent);
        this.relationships = new Map(data.map((r) => [r.id, r]));
      }
    } catch (error) {
      logger.error('加载人物弧线数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/人物弧线`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/弧线列表.json`,
        JSON.stringify(Array.from(this.arcs.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/关系网络.json`,
        JSON.stringify(Array.from(this.relationships.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存人物弧线数据失败', { error });
    }
  }

  async createArc(
    characterId: string,
    characterName: string,
    name: string,
    description: string,
    startingState: CharacterState
  ): Promise<CharacterArc> {
    const now = Date.now();
    const arc: CharacterArc = {
      id: `arc_${uuidv4()}`,
      characterId,
      characterName,
      name,
      description,
      status: 'planned',
      stages: [],
      startingState,
      endingState: { ...startingState },
      keyDecisions: [],
      lessons: [],
      transformation: '',
      relatedPlotNodes: [],
      relatedSubplots: [],
      createdAt: now,
      updatedAt: now,
    };

    this.arcs.set(arc.id, arc);
    await this.saveToDisk();
    return arc;
  }

  async addArcStage(
    arcId: string,
    type: ArcStageType,
    title: string,
    description: string
  ): Promise<ArcStage | null> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return null;
    }

    const stage: ArcStage = {
      id: `stage_${uuidv4()}`,
      arcId,
      sequence: arc.stages.length,
      type,
      title,
      description,
      internalConflict: '',
      externalConflict: '',
      emotionalState: '',
      belief: '',
      motivation: '',
      keyEvents: [],
      status: 'planned',
      notes: '',
    };

    arc.stages.push(stage);
    arc.stages.sort((a, b) => {
      const order: ArcStageType[] = [
        'setup',
        'catalyst',
        'resistance',
        'midpoint',
        'crisis',
        'climax',
        'resolution',
        'transformation',
      ];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });

    arc.updatedAt = Date.now();
    await this.saveToDisk();
    return stage;
  }

  async updateArcStage(
    arcId: string,
    stageId: string,
    updates: Partial<ArcStage>
  ): Promise<ArcStage | null> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return null;
    }

    const stageIndex = arc.stages.findIndex((s) => s.id === stageId);
    if (stageIndex < 0) {
      return null;
    }

    arc.stages[stageIndex] = { ...arc.stages[stageIndex], ...updates };
    arc.updatedAt = Date.now();
    await this.saveToDisk();
    return arc.stages[stageIndex];
  }

  async completeArcStage(arcId: string, stageId: string): Promise<boolean> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return false;
    }

    const stage = arc.stages.find((s) => s.id === stageId);
    if (!stage) {
      return false;
    }

    stage.status = 'written';
    arc.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async updateEndingState(arcId: string, endingState: Partial<CharacterState>): Promise<boolean> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return false;
    }

    arc.endingState = { ...arc.endingState, ...endingState };
    arc.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async addKeyDecision(
    arcId: string,
    stageId: string,
    decision: string,
    consequence: string
  ): Promise<boolean> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return false;
    }

    arc.keyDecisions.push({ stageId, decision, consequence });
    arc.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async createRelationship(
    sourceId: string,
    sourceName: string,
    targetId: string,
    targetName: string,
    type: RelationshipType,
    description: string
  ): Promise<Relationship> {
    const now = Date.now();
    const relationship: Relationship = {
      id: `rel_${uuidv4()}`,
      sourceId,
      sourceName,
      targetId,
      targetName,
      type,
      status: 'active',
      description,
      history: '',
      dynamics: [],
      keyMoments: [],
      conflicts: [],
      bonds: [],
      evolution: [],
      intimacy: 50,
      trust: 50,
      respect: 50,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };

    this.relationships.set(relationship.id, relationship);

    await this.createReverseRelationship(relationship);

    await this.saveToDisk();
    return relationship;
  }

  private async createReverseRelationship(source: Relationship): Promise<void> {
    const reverseType = this.getReverseRelationshipType(source.type);

    const existing = Array.from(this.relationships.values()).find(
      (r) => r.sourceId === source.targetId && r.targetId === source.sourceId
    );

    if (!existing) {
      const reverse: Relationship = {
        id: `rel_${uuidv4()}`,
        sourceId: source.targetId,
        sourceName: source.targetName,
        targetId: source.sourceId,
        targetName: source.sourceName,
        type: reverseType,
        status: source.status,
        description: source.description,
        history: source.history,
        dynamics: [],
        keyMoments: [],
        conflicts: source.conflicts,
        bonds: source.bonds,
        evolution: [],
        intimacy: source.intimacy,
        trust: source.trust,
        respect: source.respect,
        notes: source.notes,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      };

      this.relationships.set(reverse.id, reverse);
    }
  }

  private getReverseRelationshipType(type: RelationshipType): RelationshipType {
    const reverseMap: Partial<Record<RelationshipType, RelationshipType>> = {
      mentor: 'student',
      student: 'mentor',
      master: 'disciple',
      disciple: 'master',
      superior: 'subordinate',
      subordinate: 'superior',
    };
    return reverseMap[type] || type;
  }

  async updateRelationship(
    relationshipId: string,
    updates: Partial<Relationship>
  ): Promise<Relationship | null> {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      return null;
    }

    Object.assign(relationship, updates);
    relationship.updatedAt = Date.now();

    const reverse = Array.from(this.relationships.values()).find(
      (r) => r.sourceId === relationship.targetId && r.targetId === relationship.sourceId
    );
    if (reverse) {
      reverse.intimacy = relationship.intimacy;
      reverse.trust = relationship.trust;
      reverse.respect = relationship.respect;
      reverse.status = relationship.status;
      reverse.updatedAt = Date.now();
    }

    await this.saveToDisk();
    return relationship;
  }

  async addRelationshipMoment(
    relationshipId: string,
    chapter: string,
    event: string,
    impact: RelationshipMoment['impact'],
    description: string,
    intimacyChange: number = 0,
    trustChange: number = 0
  ): Promise<boolean> {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      return false;
    }

    relationship.keyMoments.push({
      chapter,
      event,
      impact,
      description,
      intimacyChange,
      trustChange,
    });

    relationship.intimacy = Math.max(0, Math.min(100, relationship.intimacy + intimacyChange));
    relationship.trust = Math.max(0, Math.min(100, relationship.trust + trustChange));

    relationship.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async evolveRelationship(
    relationshipId: string,
    chapter: string,
    newType: RelationshipType,
    reason: string
  ): Promise<boolean> {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      return false;
    }

    relationship.evolution.push({
      chapter,
      fromType: relationship.type,
      toType: newType,
      reason,
    });

    relationship.type = newType;
    relationship.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async addRelationshipDynamic(
    relationshipId: string,
    aspect: string,
    description: string,
    tension: number
  ): Promise<boolean> {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      return false;
    }

    relationship.dynamics.push({ aspect, description, tension });
    relationship.updatedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  getArc(id: string): CharacterArc | undefined {
    return this.arcs.get(id);
  }

  getArcsByCharacter(characterId: string): CharacterArc[] {
    return Array.from(this.arcs.values()).filter((a) => a.characterId === characterId);
  }

  getAllArcs(): CharacterArc[] {
    return Array.from(this.arcs.values());
  }

  getRelationship(id: string): Relationship | undefined {
    return this.relationships.get(id);
  }

  getRelationshipsByCharacter(characterId: string): Relationship[] {
    return Array.from(this.relationships.values()).filter(
      (r) => r.sourceId === characterId || r.targetId === characterId
    );
  }

  getAllRelationships(): Relationship[] {
    return Array.from(this.relationships.values());
  }

  getRelationshipBetween(characterId1: string, characterId2: string): Relationship | undefined {
    return Array.from(this.relationships.values()).find(
      (r) =>
        (r.sourceId === characterId1 && r.targetId === characterId2) ||
        (r.sourceId === characterId2 && r.targetId === characterId1)
    );
  }

  buildRelationshipNetwork(characterId: string): RelationshipNetwork {
    const relationships = this.getRelationshipsByCharacter(characterId);

    const clusters = this.identifyClusters(characterId, relationships);
    const centralCharacters = this.findCentralCharacters(relationships);
    const networkStats = this.calculateNetworkStats(characterId, relationships);

    const network: RelationshipNetwork = {
      characterId,
      characterName: relationships[0]?.sourceName || '未知',
      relationships,
      clusters,
      centralCharacters,
      networkStats,
    };

    this.networks.set(characterId, network);
    return network;
  }

  private identifyClusters(
    characterId: string,
    relationships: Relationship[]
  ): RelationshipCluster[] {
    const clusters: RelationshipCluster[] = [];
    const typeGroups = new Map<RelationshipType, string[]>();

    for (const rel of relationships) {
      const targetId = rel.sourceId === characterId ? rel.targetId : rel.sourceId;
      if (!typeGroups.has(rel.type)) {
        typeGroups.set(rel.type, []);
      }
      typeGroups.get(rel.type)!.push(targetId);
    }

    for (const [type, characterIds] of typeGroups) {
      if (characterIds.length > 1) {
        clusters.push({
          id: `cluster_${uuidv4()}`,
          name: `${RELATIONSHIP_TYPE_LABELS[type]}群体`,
          characterIds,
          type: type === 'family' ? 'family' : 'custom',
          description: `与角色有${RELATIONSHIP_TYPE_LABELS[type]}关系的角色群`,
        });
      }
    }

    return clusters;
  }

  private findCentralCharacters(relationships: Relationship[]): string[] {
    const connectionCount = new Map<string, number>();

    for (const rel of relationships) {
      connectionCount.set(rel.sourceId, (connectionCount.get(rel.sourceId) || 0) + 1);
      connectionCount.set(rel.targetId, (connectionCount.get(rel.targetId) || 0) + 1);
    }

    const sorted = Array.from(connectionCount.entries()).sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, 5).map(([id]) => id);
  }

  private calculateNetworkStats(characterId: string, relationships: Relationship[]): NetworkStats {
    const totalConnections = relationships.length;

    const distances = this.calculateDistances(characterId);
    const averageDistance =
      distances.size > 0
        ? Array.from(distances.values()).reduce((a, b) => a + b, 0) / distances.size
        : 0;

    const clustering = this.calculateClustering(characterId);

    const centrality = totalConnections / Math.max(this.relationships.size, 1);

    const bridges = this.findBridges(characterId);

    return {
      totalConnections,
      averageDistance,
      clustering,
      centrality,
      bridges,
    };
  }

  private calculateDistances(startId: string): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;

      for (const rel of this.relationships.values()) {
        let neighbor: string | null = null;
        if (rel.sourceId === id && !visited.has(rel.targetId)) {
          neighbor = rel.targetId;
        } else if (rel.targetId === id && !visited.has(rel.sourceId)) {
          neighbor = rel.sourceId;
        }

        if (neighbor) {
          visited.add(neighbor);
          distances.set(neighbor, distance + 1);
          queue.push({ id: neighbor, distance: distance + 1 });
        }
      }
    }

    return distances;
  }

  private calculateClustering(characterId: string): number {
    const neighbors = new Set<string>();

    for (const rel of this.relationships.values()) {
      if (rel.sourceId === characterId) {
        neighbors.add(rel.targetId);
      }
      if (rel.targetId === characterId) {
        neighbors.add(rel.sourceId);
      }
    }

    if (neighbors.size < 2) {
      return 0;
    }

    let triangles = 0;
    const neighborArray = Array.from(neighbors);

    for (let i = 0; i < neighborArray.length; i++) {
      for (let j = i + 1; j < neighborArray.length; j++) {
        const connected = Array.from(this.relationships.values()).some(
          (r) =>
            (r.sourceId === neighborArray[i] && r.targetId === neighborArray[j]) ||
            (r.sourceId === neighborArray[j] && r.targetId === neighborArray[i])
        );
        if (connected) {
          triangles++;
        }
      }
    }

    const possibleTriangles = (neighbors.size * (neighbors.size - 1)) / 2;
    return possibleTriangles > 0 ? triangles / possibleTriangles : 0;
  }

  private findBridges(characterId: string): string[] {
    const bridges: string[] = [];
    const neighbors = new Set<string>();

    for (const rel of this.relationships.values()) {
      if (rel.sourceId === characterId) {
        neighbors.add(rel.targetId);
      }
      if (rel.targetId === characterId) {
        neighbors.add(rel.sourceId);
      }
    }

    for (const neighbor of neighbors) {
      const neighborConnections = Array.from(this.relationships.values()).filter(
        (r) => r.sourceId === neighbor || r.targetId === neighbor
      ).length;

      if (neighborConnections <= 2) {
        bridges.push(neighbor);
      }
    }

    return bridges;
  }

  async analyzeArc(arcId: string): Promise<ArcAnalysis> {
    const arc = this.arcs.get(arcId);
    if (!arc) {
      return {
        completeness: 0,
        consistency: 0,
        emotionalJourney: [],
        gaps: [],
        suggestions: [],
      };
    }

    const completeness = this.calculateCompleteness(arc);
    const consistency = this.calculateConsistency(arc);
    const emotionalJourney = this.extractEmotionalJourney(arc);
    const gaps = this.identifyGaps(arc);
    const suggestions = await this.generateSuggestions(arc);

    return {
      completeness,
      consistency,
      emotionalJourney,
      gaps,
      suggestions,
    };
  }

  private calculateCompleteness(arc: CharacterArc): number {
    const requiredStages: ArcStageType[] = ['setup', 'catalyst', 'crisis', 'climax', 'resolution'];
    const existingTypes = new Set(arc.stages.map((s) => s.type));

    const completedStages = requiredStages.filter((t) => existingTypes.has(t));
    return completedStages.length / requiredStages.length;
  }

  private calculateConsistency(arc: CharacterArc): number {
    if (arc.stages.length < 2) {
      return 1;
    }

    let consistency = 1;

    for (let i = 1; i < arc.stages.length; i++) {
      const prev = arc.stages[i - 1];
      const curr = arc.stages[i];

      if (prev.emotionalState && curr.emotionalState) {
        const transitionValid = this.isValidEmotionalTransition(
          prev.emotionalState,
          curr.emotionalState
        );
        if (!transitionValid) {
          consistency *= 0.9;
        }
      }
    }

    return consistency;
  }

  private isValidEmotionalTransition(from: string, to: string): boolean {
    const emotionalGroups = [
      ['平静', '满足', '幸福'],
      ['紧张', '焦虑', '恐惧'],
      ['愤怒', '仇恨', '怨恨'],
      ['悲伤', '失落', '绝望'],
    ];

    for (const group of emotionalGroups) {
      if (group.includes(from) && group.includes(to)) {
        return true;
      }
    }

    return true;
  }

  private extractEmotionalJourney(arc: CharacterArc): string[] {
    return arc.stages.filter((s) => s.emotionalState).map((s) => s.emotionalState);
  }

  private identifyGaps(arc: CharacterArc): ArcGap[] {
    const gaps: ArcGap[] = [];

    const requiredStages: ArcStageType[] = ['setup', 'catalyst', 'crisis', 'climax', 'resolution'];
    for (const stageType of requiredStages) {
      if (!arc.stages.some((s) => s.type === stageType)) {
        gaps.push({
          id: `gap_${uuidv4()}`,
          type: 'missing_stage',
          description: `缺少"${ARC_STAGE_LABELS[stageType]}"阶段`,
          suggestedFix: `添加${ARC_STAGE_LABELS[stageType]}阶段的情节`,
        });
      }
    }

    for (const stage of arc.stages) {
      if (!stage.motivation && ['catalyst', 'crisis', 'climax'].includes(stage.type)) {
        gaps.push({
          id: `gap_${uuidv4()}`,
          type: 'unclear_motivation',
          description: `"${stage.title}"阶段缺少明确的动机`,
          suggestedFix: '明确角色在这个阶段的核心动机',
        });
      }
    }

    const transformationStages = arc.stages.filter((s) => s.type === 'transformation');
    if (transformationStages.length === 0 && arc.stages.some((s) => s.type === 'climax')) {
      gaps.push({
        id: `gap_${uuidv4()}`,
        type: 'rushed_transformation',
        description: '角色转变过于仓促',
        suggestedFix: '添加转变阶段的细节描述',
      });
    }

    return gaps;
  }

  private async generateSuggestions(arc: CharacterArc): Promise<ArcSuggestion[]> {
    const suggestions: ArcSuggestion[] = [];

    const crisisStage = arc.stages.find((s) => s.type === 'crisis');
    if (crisisStage && !crisisStage.internalConflict) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'add_conflict',
        description: '为危机阶段添加内心冲突',
        priority: 'high',
      });
    }

    const emotionalJourney = this.extractEmotionalJourney(arc);
    if (emotionalJourney.length < 3) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'deepen_emotion',
        description: '丰富情感变化的层次',
        priority: 'medium',
      });
    }

    if (arc.keyDecisions.length < 2) {
      suggestions.push({
        id: `suggestion_${uuidv4()}`,
        type: 'add_milestone',
        description: '添加关键决策点',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  async suggestArcTemplate(characterType: string): Promise<{
    stages: Array<{ type: ArcStageType; title: string; description: string }>;
  }> {
    const prompt = `为以下类型的角色生成人物弧线模板：

角色类型: ${characterType}

请以JSON格式返回弧线阶段建议：
{
  "stages": [
    {
      "type": "setup/catalyst/resistance/midpoint/crisis/climax/resolution/transformation",
      "title": "阶段标题",
      "description": "阶段描述"
    }
  ]
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 800,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultArcTemplate();
      }

      return JSON.parse(jsonMatch[0]);
    } catch {
      return this.getDefaultArcTemplate();
    }
  }

  private getDefaultArcTemplate(): {
    stages: Array<{ type: ArcStageType; title: string; description: string }>;
  } {
    return {
      stages: [
        { type: 'setup', title: '初始状态', description: '介绍角色的日常生活和内心世界' },
        { type: 'catalyst', title: '催化剂事件', description: '打破平衡，引发变化的事件' },
        { type: 'resistance', title: '抵抗与挣扎', description: '角色对变化的抵抗' },
        { type: 'midpoint', title: '中点转折', description: '角色开始意识到需要改变' },
        { type: 'crisis', title: '危机时刻', description: '角色面临最大的挑战' },
        { type: 'climax', title: '关键抉择', description: '角色做出决定性的选择' },
        { type: 'resolution', title: '新的平衡', description: '变化的结果' },
      ],
    };
  }

  deleteArc(arcId: string): boolean {
    const result = this.arcs.delete(arcId);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  deleteRelationship(relationshipId: string): boolean {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) {
      return false;
    }

    const reverse = Array.from(this.relationships.values()).find(
      (r) => r.sourceId === relationship.targetId && r.targetId === relationship.sourceId
    );

    this.relationships.delete(relationshipId);
    if (reverse) {
      this.relationships.delete(reverse.id);
    }

    this.saveToDisk();
    return true;
  }

  getStats(): {
    totalArcs: number;
    activeArcs: number;
    totalRelationships: number;
    byArcStatus: Record<ArcStatus, number>;
    byRelationshipType: Record<RelationshipType, number>;
  } {
    const arcs = this.getAllArcs();
    const relationships = this.getAllRelationships();

    const byArcStatus: Record<ArcStatus, number> = {
      planned: 0,
      in_progress: 0,
      completed: 0,
      abandoned: 0,
    };

    const byRelationshipType: Record<RelationshipType, number> = {
      family: 0,
      friend: 0,
      lover: 0,
      enemy: 0,
      rival: 0,
      ally: 0,
      mentor: 0,
      student: 0,
      colleague: 0,
      stranger: 0,
      acquaintance: 0,
      superior: 0,
      subordinate: 0,
      master: 0,
      disciple: 0,
      other: 0,
    };

    for (const arc of arcs) {
      byArcStatus[arc.status]++;
    }

    for (const rel of relationships) {
      byRelationshipType[rel.type]++;
    }

    return {
      totalArcs: arcs.length,
      activeArcs: byArcStatus.in_progress,
      totalRelationships: relationships.length,
      byArcStatus,
      byRelationshipType,
    };
  }
}

export function createCharacterArcService(projectPath: string): CharacterArcService {
  return new CharacterArcService(projectPath);
}
