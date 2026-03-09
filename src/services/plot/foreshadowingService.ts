import {
  Foreshadowing,
  ForeshadowingHint,
  ForeshadowingStatus,
  ForeshadowingImportance,
  ForeshadowingType,
  ForeshadowingReminder,
  ForeshadowingAnalysis,
} from '@/types/plot/foreshadowing';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ForeshadowingService {
  private projectPath: string;
  private foreshadowings: Map<string, Foreshadowing> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const filePath = `${this.projectPath}/设定/伏笔.json`;
      const content = await workshopService.readFile(filePath);
      if (content) {
        const data = JSON.parse(content);
        this.foreshadowings = new Map(data.map((f: Foreshadowing) => [f.id, f]));
      }
    } catch (error) {
      logger.error('加载伏笔数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const filePath = `${this.projectPath}/设定/伏笔.json`;
      await workshopService.writeFile(
        filePath,
        JSON.stringify(Array.from(this.foreshadowings.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存伏笔数据失败', { error });
    }
  }

  createForeshadowing(data: {
    title: string;
    content: string;
    type: ForeshadowingType;
    importance: ForeshadowingImportance;
    plantedAt: Foreshadowing['plantedAt'];
    plannedResolution: Foreshadowing['plannedResolution'];
    relatedCharacters?: string[];
    relatedItems?: string[];
    notes?: string;
  }): Foreshadowing {
    const id = `foreshadow_${uuidv4()}`;
    const now = Date.now();

    const foreshadowing: Foreshadowing = {
      id,
      title: data.title,
      content: data.content,
      type: data.type,
      status: 'planted',
      importance: data.importance,
      plantedAt: data.plantedAt,
      plannedResolution: data.plannedResolution,
      relatedCharacters: data.relatedCharacters || [],
      relatedItems: data.relatedItems || [],
      relatedEvents: [],
      hints: [],
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.foreshadowings.set(id, foreshadowing);
    this.saveToDisk();
    return foreshadowing;
  }

  getForeshadowing(id: string): Foreshadowing | undefined {
    return this.foreshadowings.get(id);
  }

  getAllForeshadowings(): Foreshadowing[] {
    return Array.from(this.foreshadowings.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getByStatus(status: ForeshadowingStatus): Foreshadowing[] {
    return this.getAllForeshadowings().filter((f) => f.status === status);
  }

  getByType(type: ForeshadowingType): Foreshadowing[] {
    return this.getAllForeshadowings().filter((f) => f.type === type);
  }

  getByCharacter(characterName: string): Foreshadowing[] {
    return this.getAllForeshadowings().filter((f) => f.relatedCharacters.includes(characterName));
  }

  updateForeshadowing(id: string, updates: Partial<Foreshadowing>): Foreshadowing | undefined {
    const foreshadowing = this.foreshadowings.get(id);
    if (!foreshadowing) {
      return undefined;
    }

    const updated: Foreshadowing = {
      ...foreshadowing,
      ...updates,
      updatedAt: Date.now(),
    };

    this.foreshadowings.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  addHint(
    foreshadowingId: string,
    hint: Omit<ForeshadowingHint, 'id' | 'foreshadowingId'>
  ): ForeshadowingHint | undefined {
    const foreshadowing = this.foreshadowings.get(foreshadowingId);
    if (!foreshadowing) {
      return undefined;
    }

    const newHint: ForeshadowingHint = {
      id: `hint_${uuidv4()}`,
      foreshadowingId,
      ...hint,
    };

    foreshadowing.hints.push(newHint);
    foreshadowing.status = 'hinted';
    foreshadowing.updatedAt = Date.now();

    this.foreshadowings.set(foreshadowingId, foreshadowing);
    this.saveToDisk();
    return newHint;
  }

  resolveForeshadowing(
    id: string,
    resolution: {
      plotNodeId: string;
      chapter: string;
      storyTime: string;
      description: string;
    }
  ): Foreshadowing | undefined {
    const foreshadowing = this.foreshadowings.get(id);
    if (!foreshadowing) {
      return undefined;
    }

    const updated = this.updateForeshadowing(id, {
      status: 'resolved',
      actualResolution: resolution,
    });

    return updated;
  }

  abandonForeshadowing(id: string, reason: string): Foreshadowing | undefined {
    return this.updateForeshadowing(id, {
      status: 'abandoned',
      notes: `放弃原因: ${reason}`,
    });
  }

  deleteForeshadowing(id: string): boolean {
    const result = this.foreshadowings.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  getReminders(): ForeshadowingReminder[] {
    const reminders: ForeshadowingReminder[] = [];
    const unresolved = this.getByStatus('planted').concat(this.getByStatus('hinted'));

    for (const f of unresolved) {
      const urgency = this.calculateUrgency(f);
      reminders.push({
        foreshadowingId: f.id,
        title: f.title,
        status: f.status,
        plantedAt: f.plantedAt.description,
        plannedResolution: f.plannedResolution.description,
        urgency,
        suggestedAction: this.generateSuggestedAction(f, urgency),
      });
    }

    return reminders.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }

  private calculateUrgency(f: Foreshadowing): 'high' | 'medium' | 'low' {
    if (f.importance === 'major' && f.status === 'planted') {
      return 'high';
    }
    if (f.importance === 'major' || f.hints.length > 2) {
      return 'medium';
    }
    return 'low';
  }

  private generateSuggestedAction(f: Foreshadowing, urgency: 'high' | 'medium' | 'low'): string {
    if (urgency === 'high') {
      return `重要伏笔"${f.title}"需要尽快安排回收`;
    }
    if (f.status === 'planted') {
      return `可以考虑为"${f.title}"添加一些暗示`;
    }
    return `伏笔"${f.title}"状态良好，按计划推进即可`;
  }

  analyze(): ForeshadowingAnalysis {
    const all = this.getAllForeshadowings();
    const planted = all.filter((f) => f.status === 'planted');
    const hinted = all.filter((f) => f.status === 'hinted');
    const resolved = all.filter((f) => f.status === 'resolved');
    const abandoned = all.filter((f) => f.status === 'abandoned');

    const overdueResolutions = this.findOverdueResolutions();
    const unresolved = planted.concat(hinted);

    const suggestions = this.generateSuggestions(all, overdueResolutions);

    return {
      total: all.length,
      planted: planted.length,
      hinted: hinted.length,
      resolved: resolved.length,
      abandoned: abandoned.length,
      overdueResolutions,
      unresolved,
      suggestions,
    };
  }

  private findOverdueResolutions(): Foreshadowing[] {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    return this.getAllForeshadowings().filter((f) => {
      if (f.status === 'resolved' || f.status === 'abandoned') {
        return false;
      }

      const daysSincePlanted = (now - f.createdAt) / day;

      if (f.importance === 'major' && daysSincePlanted > 7) {
        return true;
      }
      if (f.importance === 'minor' && daysSincePlanted > 14) {
        return true;
      }
      if (f.importance === 'subtle' && daysSincePlanted > 30) {
        return true;
      }

      return false;
    });
  }

  private generateSuggestions(all: Foreshadowing[], overdue: Foreshadowing[]): string[] {
    const suggestions: string[] = [];

    if (overdue.length > 0) {
      suggestions.push(`有 ${overdue.length} 个伏笔超过预期时间未回收，建议检查`);
    }

    const majorUnresolved = all.filter(
      (f) => f.importance === 'major' && f.status !== 'resolved' && f.status !== 'abandoned'
    );
    if (majorUnresolved.length > 3) {
      suggestions.push('重要伏笔较多，建议优先处理');
    }

    const noHints = all.filter((f) => f.status === 'planted' && f.hints.length === 0);
    if (noHints.length > 0) {
      suggestions.push(`有 ${noHints.length} 个伏笔还没有添加暗示，可以考虑添加`);
    }

    return suggestions;
  }

  checkResolutionAtPlotNode(plotNodeId: string): Foreshadowing[] {
    return this.getAllForeshadowings().filter(
      (f) =>
        f.plannedResolution.plotNodeId === plotNodeId ||
        f.actualResolution?.plotNodeId === plotNodeId
    );
  }

  getForeshadowingsPlantedAtPlotNode(plotNodeId: string): Foreshadowing[] {
    return this.getAllForeshadowings().filter((f) => f.plantedAt.plotNodeId === plotNodeId);
  }

  exportData(): Foreshadowing[] {
    return this.getAllForeshadowings();
  }

  importData(data: Foreshadowing[]): void {
    for (const f of data) {
      this.foreshadowings.set(f.id, f);
    }
    this.saveToDisk();
  }
}

export function createForeshadowingService(projectPath: string): ForeshadowingService {
  return new ForeshadowingService(projectPath);
}
