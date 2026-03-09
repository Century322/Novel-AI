import {
  Conflict,
  ConflictType,
  ConflictSeverity,
  ConflictSource,
  ConflictStatus,
  FixResult,
  FileChange,
  UpdatePropagation,
  AffectedFile,
  FieldChange,
  RelationDefinition,
  BUILTIN_RELATIONS,
} from '@/types/plot/conflictDetection';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ConflictDetectionService {
  private projectPath: string;
  private conflicts: Map<string, Conflict> = new Map();
  private relations: RelationDefinition[] = [...BUILTIN_RELATIONS];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const conflictPath = `${this.projectPath}/设定/冲突检测.json`;
      const content = await workshopService.readFile(conflictPath);
      if (content) {
        const data: Conflict[] = JSON.parse(content);
        this.conflicts = new Map(data.map((c) => [c.id, c]));
      }
    } catch (error) {
      logger.error('加载冲突数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const conflictPath = `${this.projectPath}/设定/冲突检测.json`;
      await workshopService.writeFile(
        conflictPath,
        JSON.stringify(Array.from(this.conflicts.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存冲突数据失败', { error });
    }
  }

  async loadAllData(): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};

    const dataSources = [
      { key: 'characters', path: '设定/人物档案.json' },
      { key: 'timeline', path: '设定/时间线.json' },
      { key: 'settings', path: '设定/世界观设定.json' },
      { key: 'plotNodes', path: '设定/情节节点.json' },
      { key: 'foreshadowing', path: '设定/伏笔管理.json' },
      { key: 'chapters', path: '正文' },
    ];

    for (const source of dataSources) {
      try {
        if (source.key === 'chapters') {
          const entries = await workshopService.readDirectory(`${this.projectPath}/${source.path}`);
          const chapters: unknown[] = [];
          for (const entry of entries.filter((e) => !e.isDirectory)) {
            const content = await workshopService.readFile(
              `${this.projectPath}/${source.path}/${entry.name}`
            );
            if (content) {
              chapters.push({ name: entry.name, content });
            }
          }
          data[source.key] = chapters;
        } else {
          const content = await workshopService.readFile(`${this.projectPath}/${source.path}`);
          if (content) {
            data[source.key] = JSON.parse(content);
          }
        }
      } catch {
        data[source.key] = [];
      }
    }

    return data;
  }

  async runAllChecks(): Promise<Conflict[]> {
    const data = await this.loadAllData();
    const newConflicts: Conflict[] = [];

    const checks = [
      this.checkCharacterConsistency(data),
      this.checkTimelineConflicts(data),
      this.checkSettingContradictions(data),
      this.checkPlotHoles(data),
      this.checkRelationshipConflicts(data),
      this.checkPowerLevelConsistency(data),
      this.checkLocationMismatches(data),
      this.checkNameConflicts(data),
    ];

    const results = await Promise.all(checks);
    for (const conflicts of results) {
      newConflicts.push(...conflicts);
    }

    for (const conflict of newConflicts) {
      this.conflicts.set(conflict.id, conflict);
    }

    await this.saveToDisk();
    return newConflicts;
  }

  private async checkCharacterConsistency(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const characters = (data.characters || []) as Array<Record<string, unknown>>;

    for (let i = 0; i < characters.length; i++) {
      for (let j = i + 1; j < characters.length; j++) {
        const char1 = characters[i];
        const char2 = characters[j];

        if (char1.name === char2.name && char1.id !== char2.id) {
          conflicts.push(
            this.createConflict({
              type: 'character_inconsistency',
              severity: 'major',
              title: '角色名称重复',
              description: `发现两个不同的角色使用了相同的名称: ${char1.name}`,
              source: { type: 'character', id: String(char1.id), name: String(char1.name) },
              conflictingWith: [
                { type: 'character', id: String(char2.id), name: String(char2.name) },
              ],
              suggestion: '请检查是否为同一角色，或修改其中一个角色的名称',
              autoFixable: false,
            })
          );
        }

        if (char1.age && char2.age && char1.birthYear && char2.birthYear) {
          const age1 = Number(char1.age);
          const age2 = Number(char2.age);
          const birthYear1 = Number(char1.birthYear);
          const birthYear2 = Number(char2.birthYear);

          if (!isNaN(age1) && !isNaN(age2) && !isNaN(birthYear1) && !isNaN(birthYear2)) {
            if (Math.abs(age1 - age2) !== Math.abs(birthYear1 - birthYear2)) {
              conflicts.push(
                this.createConflict({
                  type: 'character_inconsistency',
                  severity: 'minor',
                  title: '角色年龄与出生年份不匹配',
                  description: `角色 ${char1.name} 的年龄差与出生年份差不一致`,
                  source: {
                    type: 'character',
                    id: String(char1.id),
                    name: String(char1.name),
                    field: 'age',
                  },
                  conflictingWith: [
                    {
                      type: 'character',
                      id: String(char2.id),
                      name: String(char2.name),
                      field: 'birthYear',
                    },
                  ],
                  suggestion: '请检查角色的年龄和出生年份设定',
                  autoFixable: false,
                })
              );
            }
          }
        }
      }
    }

    return conflicts;
  }

  private async checkTimelineConflicts(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const timeline = (data.timeline || []) as Array<Record<string, unknown>>;

    const sortedEvents = [...timeline].sort((a, b) => {
      const timeA = Number(a.timestamp || a.order || 0);
      const timeB = Number(b.timestamp || b.order || 0);
      return timeA - timeB;
    });

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const event1 = sortedEvents[i];
      const event2 = sortedEvents[i + 1];

      if (event1.characterId && event1.characterId === event2.characterId) {
        const loc1 = event1.location;
        const loc2 = event2.location;

        if (loc1 && loc2 && loc1 !== loc2) {
          const time1 = Number(event1.timestamp || event1.order || 0);
          const time2 = Number(event2.timestamp || event2.order || 0);
          const timeDiff = Math.abs(time2 - time1);

          if (timeDiff < 1) {
            conflicts.push(
              this.createConflict({
                type: 'timeline_conflict',
                severity: 'major',
                title: '角色位置瞬移',
                description: `角色在极短时间内从 ${loc1} 移动到 ${loc2}`,
                source: {
                  type: 'timeline',
                  id: String(event1.id),
                  name: String(event1.title || '事件'),
                  location: String(loc1),
                },
                conflictingWith: [
                  {
                    type: 'timeline',
                    id: String(event2.id),
                    name: String(event2.title || '事件'),
                    location: String(loc2),
                  },
                ],
                suggestion: '请检查事件时间安排，或添加移动过程描述',
                autoFixable: false,
              })
            );
          }
        }
      }
    }

    return conflicts;
  }

  private async checkSettingContradictions(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const settings = (data.settings || []) as Array<Record<string, unknown>>;

    if (settings.length === 0) {
      return conflicts;
    }

    const powerLevels = settings.find((s) => s.powerLevels || s.power_levels);
    const characters = (data.characters || []) as Array<Record<string, unknown>>;

    if (powerLevels && characters.length > 0) {
      const levels = (powerLevels.powerLevels || powerLevels.power_levels || []) as Array<{
        name: string;
        rank: number;
      }>;
      const levelNames = levels.map((l) => l.name);

      for (const char of characters) {
        const charLevel = char.powerLevel || char.power_level;
        if (charLevel && !levelNames.includes(String(charLevel))) {
          conflicts.push(
            this.createConflict({
              type: 'setting_contradiction',
              severity: 'minor',
              title: '角色等级不在设定范围内',
              description: `角色 ${char.name} 的等级 "${charLevel}" 不在力量体系设定中`,
              source: {
                type: 'character',
                id: String(char.id),
                name: String(char.name),
                field: 'powerLevel',
                value: charLevel,
              },
              conflictingWith: [{ type: 'setting', id: 'power_levels', name: '力量体系' }],
              suggestion: `请将角色等级修改为设定中的等级: ${levelNames.join('、')}`,
              autoFixable: false,
            })
          );
        }
      }
    }

    return conflicts;
  }

  private async checkPlotHoles(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const plotNodes = (data.plotNodes || []) as Array<Record<string, unknown>>;
    const foreshadowing = (data.foreshadowing || []) as Array<Record<string, unknown>>;

    for (const node of plotNodes) {
      if (node.status === 'completed' && node.requiredForeshadowing) {
        const required = node.requiredForeshadowing as string[];
        for (const foreshadowingId of required) {
          const foreshadow = foreshadowing.find((f) => f.id === foreshadowingId);
          if (foreshadow && foreshadow.status !== 'resolved') {
            conflicts.push(
              this.createConflict({
                type: 'plot_hole',
                severity: 'major',
                title: '伏笔未回收',
                description: `情节节点 "${node.title}" 已完成，但依赖的伏笔 "${foreshadow.name}" 尚未回收`,
                source: { type: 'plot', id: String(node.id), name: String(node.title) },
                conflictingWith: [
                  {
                    type: 'foreshadowing',
                    id: String(foreshadow.id),
                    name: String(foreshadow.name),
                  },
                ],
                suggestion: '请回收该伏笔，或修改情节节点的依赖关系',
                autoFixable: false,
              })
            );
          }
        }
      }
    }

    for (const f of foreshadowing) {
      if (f.status === 'planted' || f.status === 'hinted') {
        const plantedAt = Number(f.plantedAt || f.createdAt);
        const daysSince = (Date.now() - plantedAt) / (1000 * 60 * 60 * 24);

        if (daysSince > 30) {
          conflicts.push(
            this.createConflict({
              type: 'plot_hole',
              severity: 'minor',
              title: '伏笔长期未处理',
              description: `伏笔 "${f.name}" 已埋设 ${Math.floor(daysSince)} 天，状态: ${f.status}`,
              source: { type: 'foreshadowing', id: String(f.id), name: String(f.name) },
              conflictingWith: [],
              suggestion: '考虑在近期章节中暗示或回收此伏笔',
              autoFixable: false,
            })
          );
        }
      }
    }

    return conflicts;
  }

  private async checkRelationshipConflicts(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const characters = (data.characters || []) as Array<Record<string, unknown>>;

    for (const char of characters) {
      const relationships = (char.relationships || []) as Array<{ targetId: string; type: string }>;

      for (const rel of relationships) {
        const target = characters.find((c) => c.id === rel.targetId);
        if (!target) {
          conflicts.push(
            this.createConflict({
              type: 'relationship_conflict',
              severity: 'minor',
              title: '关系目标不存在',
              description: `角色 "${char.name}" 有一个指向不存在角色的关系: ${rel.type}`,
              source: {
                type: 'character',
                id: String(char.id),
                name: String(char.name),
                field: 'relationships',
              },
              conflictingWith: [],
              suggestion: '请删除无效的关系，或创建目标角色',
              autoFixable: true,
            })
          );
          continue;
        }

        const targetRels = (target.relationships || []) as Array<{
          targetId: string;
          type: string;
        }>;
        const reverseRel = targetRels.find((r) => r.targetId === char.id);

        if (!reverseRel) {
          conflicts.push(
            this.createConflict({
              type: 'relationship_conflict',
              severity: 'suggestion',
              title: '关系未双向定义',
              description: `角色 "${char.name}" 对 "${target.name}" 有关系，但反向关系未定义`,
              source: { type: 'character', id: String(char.id), name: String(char.name) },
              conflictingWith: [
                { type: 'character', id: String(target.id), name: String(target.name) },
              ],
              suggestion: '建议为关系添加双向定义，以保持一致性',
              autoFixable: true,
            })
          );
        }
      }
    }

    return conflicts;
  }

  private async checkPowerLevelConsistency(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const characters = (data.characters || []) as Array<Record<string, unknown>>;
    const timeline = (data.timeline || []) as Array<Record<string, unknown>>;

    const charPowerLevels: Map<string, Array<{ time: number; level: string }>> = new Map();

    for (const event of timeline) {
      if (event.characterId && event.powerLevel) {
        const charId = String(event.characterId);
        if (!charPowerLevels.has(charId)) {
          charPowerLevels.set(charId, []);
        }
        charPowerLevels.get(charId)!.push({
          time: Number(event.timestamp || 0),
          level: String(event.powerLevel),
        });
      }
    }

    for (const [charId, levels] of charPowerLevels) {
      const sortedLevels = levels.sort((a, b) => a.time - b.time);
      const char = characters.find((c) => c.id === charId);

      for (let i = 0; i < sortedLevels.length - 1; i++) {
        const current = sortedLevels[i];
        const next = sortedLevels[i + 1];

        if (current.level !== next.level) {
          const timeDiff = next.time - current.time;
          if (timeDiff < 1 && char) {
            conflicts.push(
              this.createConflict({
                type: 'power_level_inconsistency',
                severity: 'minor',
                title: '战力突变',
                description: `角色 "${char.name}" 的战力在短时间内从 ${current.level} 变为 ${next.level}`,
                source: {
                  type: 'character',
                  id: charId,
                  name: String(char.name),
                  field: 'powerLevel',
                },
                conflictingWith: [],
                suggestion: '请添加战力变化的解释或过渡',
                autoFixable: false,
              })
            );
          }
        }
      }
    }

    return conflicts;
  }

  private async checkLocationMismatches(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const settings = (data.settings || []) as Array<Record<string, unknown>>;
    const timeline = (data.timeline || []) as Array<Record<string, unknown>>;

    const locations = settings.flatMap(
      (s) => (s.locations || []) as Array<{ name: string; parent?: string }>
    );
    const locationNames = locations.map((l) => l.name);

    for (const event of timeline) {
      if (event.location && !locationNames.includes(String(event.location))) {
        conflicts.push(
          this.createConflict({
            type: 'location_mismatch',
            severity: 'suggestion',
            title: '地点未在设定中定义',
            description: `事件 "${event.title || event.id}" 使用的地点 "${event.location}" 未在世界观设定中定义`,
            source: {
              type: 'timeline',
              id: String(event.id),
              name: String(event.title || '事件'),
              location: String(event.location),
            },
            conflictingWith: [],
            suggestion: '请将该地点添加到世界观设定中',
            autoFixable: false,
          })
        );
      }
    }

    return conflicts;
  }

  private async checkNameConflicts(data: Record<string, unknown[]>): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const nameMap: Map<string, Array<{ type: string; id: string; name: string }>> = new Map();

    const characters = (data.characters || []) as Array<Record<string, unknown>>;
    for (const char of characters) {
      const name = String(char.name);
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name)!.push({ type: 'character', id: String(char.id), name });
    }

    const settings = (data.settings || []) as Array<Record<string, unknown>>;
    for (const setting of settings) {
      const locations = (setting.locations || []) as Array<{ name: string; id?: string }>;
      for (const loc of locations) {
        if (!nameMap.has(loc.name)) {
          nameMap.set(loc.name, []);
        }
        nameMap.get(loc.name)!.push({ type: 'location', id: loc.id || loc.name, name: loc.name });
      }
    }

    for (const [name, items] of nameMap) {
      if (items.length > 1 && items.some((i) => i.type !== items[0].type)) {
        conflicts.push(
          this.createConflict({
            type: 'name_conflict',
            severity: 'minor',
            title: '名称跨类型重复',
            description: `名称 "${name}" 同时用于: ${items.map((i) => i.type).join('、')}`,
            source: items[0] as ConflictSource,
            conflictingWith: items.slice(1) as ConflictSource[],
            suggestion: '建议使用不同的名称以避免混淆',
            autoFixable: false,
          })
        );
      }
    }

    return conflicts;
  }

  private createConflict(params: {
    type: ConflictType;
    severity: ConflictSeverity;
    title: string;
    description: string;
    source: ConflictSource;
    conflictingWith: ConflictSource[];
    suggestion: string;
    autoFixable: boolean;
  }): Conflict {
    return {
      id: `conflict_${uuidv4()}`,
      ...params,
      status: 'detected',
      createdAt: Date.now(),
    };
  }

  async propagateUpdate(
    sourceType: string,
    sourceId: string,
    sourceField: string,
    oldValue: unknown,
    newValue: unknown
  ): Promise<UpdatePropagation> {
    const affectedFiles: AffectedFile[] = [];
    const data = await this.loadAllData();

    for (const relation of this.relations) {
      if (relation.sourceType === sourceType && relation.sourceField === sourceField) {
        const targetData = data[relation.targetType] || [];

        for (const target of targetData as Array<Record<string, unknown>>) {
          if (relation.relationType === 'one_to_many' || relation.relationType === 'many_to_many') {
            const targetValue = target[relation.targetField];
            if (Array.isArray(targetValue) && targetValue.includes(oldValue)) {
              const changes: FieldChange[] = [];

              if (relation.onUpdate === 'cascade') {
                const newArray = targetValue.map((v) => (v === oldValue ? newValue : v));
                changes.push({
                  field: relation.targetField,
                  oldValue: targetValue,
                  newValue: newArray,
                  reason: `级联更新: ${sourceType}.${sourceField} 从 "${oldValue}" 变为 "${newValue}"`,
                });
              }

              if (changes.length > 0) {
                affectedFiles.push({
                  path: this.getPathForType(relation.targetType, String(target.id)),
                  type: relation.targetType,
                  changes,
                });
              }
            }
          }
        }
      }
    }

    return {
      sourceType,
      sourceId,
      sourceField,
      oldValue,
      newValue,
      affectedFiles,
    };
  }

  private getPathForType(type: string, _id: string): string {
    const paths: Record<string, string> = {
      character: '设定/人物档案.json',
      timeline: '设定/时间线.json',
      setting: '设定/世界观设定.json',
      plot: '设定/情节节点.json',
      foreshadowing: '设定/伏笔管理.json',
    };
    return paths[type] || `设定/${type}.json`;
  }

  async applyPropagation(propagation: UpdatePropagation): Promise<FixResult> {
    const changes: FileChange[] = [];

    for (const affected of propagation.affectedFiles) {
      try {
        const content = await workshopService.readFile(`${this.projectPath}/${affected.path}`);
        if (!content) {
          continue;
        }

        let data = JSON.parse(content);

        for (const change of affected.changes) {
          data = this.applyChangeToData(data, change);
          changes.push({
            path: affected.path,
            type: 'update',
            oldValue: change.oldValue,
            newValue: change.newValue,
          });
        }

        await workshopService.writeFile(
          `${this.projectPath}/${affected.path}`,
          JSON.stringify(data, null, 2)
        );
      } catch (error) {
        logger.error('应用更改失败', { path: affected.path, error });
      }
    }

    return {
      success: changes.length > 0,
      changes,
      message: `已更新 ${changes.length} 个文件`,
    };
  }

  private applyChangeToData(data: unknown, change: FieldChange): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          if (obj[change.field] === change.oldValue) {
            return { ...obj, [change.field]: change.newValue };
          }
          if (Array.isArray(obj[change.field])) {
            const arr = obj[change.field] as unknown[];
            if (JSON.stringify(arr) === JSON.stringify(change.oldValue)) {
              return { ...obj, [change.field]: change.newValue };
            }
          }
        }
        return item;
      });
    }
    return data;
  }

  getConflict(id: string): Conflict | undefined {
    return this.conflicts.get(id);
  }

  getAllConflicts(): Conflict[] {
    return Array.from(this.conflicts.values());
  }

  getConflictsByType(type: ConflictType): Conflict[] {
    return this.getAllConflicts().filter((c) => c.type === type);
  }

  getConflictsBySeverity(severity: ConflictSeverity): Conflict[] {
    return this.getAllConflicts().filter((c) => c.severity === severity);
  }

  getUnresolvedConflicts(): Conflict[] {
    return this.getAllConflicts().filter(
      (c) => c.status === 'detected' || c.status === 'acknowledged'
    );
  }

  async acknowledgeConflict(id: string): Promise<boolean> {
    const conflict = this.conflicts.get(id);
    if (!conflict) {
      return false;
    }

    conflict.status = 'acknowledged';
    await this.saveToDisk();
    return true;
  }

  async resolveConflict(id: string, resolution: string): Promise<boolean> {
    const conflict = this.conflicts.get(id);
    if (!conflict) {
      return false;
    }

    conflict.status = 'resolved';
    conflict.resolution = resolution;
    conflict.resolvedAt = Date.now();
    await this.saveToDisk();
    return true;
  }

  async ignoreConflict(id: string): Promise<boolean> {
    const conflict = this.conflicts.get(id);
    if (!conflict) {
      return false;
    }

    conflict.status = 'ignored';
    await this.saveToDisk();
    return true;
  }

  async autoFixConflict(id: string): Promise<FixResult> {
    const conflict = this.conflicts.get(id);
    if (!conflict || !conflict.autoFixable) {
      return { success: false, changes: [], message: '该冲突无法自动修复' };
    }

    const data = await this.loadAllData();

    if (conflict.type === 'relationship_conflict') {
      if (conflict.description.includes('未双向定义')) {
        const sourceId = conflict.source.id;
        const targetId = conflict.conflictingWith[0]?.id;

        if (targetId) {
          const characters = (data.characters || []) as Array<Record<string, unknown>>;
          const targetChar = characters.find((c) => c.id === targetId);

          if (targetChar) {
            const relationships = (targetChar.relationships || []) as Array<{
              targetId: string;
              type: string;
            }>;
            relationships.push({ targetId: sourceId, type: '相关' });
            targetChar.relationships = relationships;

            await workshopService.writeFile(
              `${this.projectPath}/设定/人物档案.json`,
              JSON.stringify(characters, null, 2)
            );

            conflict.status = 'resolved';
            conflict.resolution = '自动添加反向关系';
            conflict.resolvedAt = Date.now();
            await this.saveToDisk();

            return {
              success: true,
              changes: [
                {
                  path: '设定/人物档案.json',
                  type: 'update',
                  oldValue: null,
                  newValue: { targetId: sourceId, type: '相关' },
                },
              ],
              message: '已自动添加反向关系',
            };
          }
        }
      }
    }

    return { success: false, changes: [], message: '无法自动修复此类型冲突' };
  }

  addRelation(relation: RelationDefinition): void {
    this.relations.push(relation);
  }

  getRelations(): RelationDefinition[] {
    return [...this.relations];
  }

  getStats(): {
    total: number;
    byType: Record<ConflictType, number>;
    bySeverity: Record<ConflictSeverity, number>;
    byStatus: Record<ConflictStatus, number>;
  } {
    const all = this.getAllConflicts();

    const byType: Record<ConflictType, number> = {
      character_inconsistency: 0,
      timeline_conflict: 0,
      setting_contradiction: 0,
      plot_hole: 0,
      relationship_conflict: 0,
      power_level_inconsistency: 0,
      location_mismatch: 0,
      name_conflict: 0,
    };

    const bySeverity: Record<ConflictSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      suggestion: 0,
    };

    const byStatus: Record<ConflictStatus, number> = {
      detected: 0,
      acknowledged: 0,
      resolved: 0,
      ignored: 0,
    };

    for (const conflict of all) {
      byType[conflict.type]++;
      bySeverity[conflict.severity]++;
      byStatus[conflict.status]++;
    }

    return { total: all.length, byType, bySeverity, byStatus };
  }
}

export function createConflictDetectionService(projectPath: string): ConflictDetectionService {
  return new ConflictDetectionService(projectPath);
}
