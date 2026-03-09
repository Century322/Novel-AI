import {
  Reminder,
  ReminderType,
  ReminderPriority,
  ReminderConfig,
  ReminderStats,
  DEFAULT_REMINDER_CONFIG,
  PRIORITY_WEIGHTS,
  ForeshadowingReminder,
  CharacterReminder,
  PlotReminder,
  SettingReminder,
  StyleReminder,
  QualityReminder,
} from '@/types/writing/reminder';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ReminderService {
  private projectPath: string;
  private reminders: Map<string, Reminder> = new Map();
  private config: ReminderConfig;
  private checkTimer?: ReturnType<typeof setInterval>;

  constructor(projectPath: string, config: Partial<ReminderConfig> = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_REMINDER_CONFIG, ...config };
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const reminderPath = `${this.projectPath}/设定/提醒列表.json`;
      const content = await workshopService.readFile(reminderPath);
      if (content) {
        const data: Reminder[] = JSON.parse(content);
        this.reminders = new Map(data.map((r) => [r.id, r]));
      }
    } catch (error) {
      logger.error('加载提醒数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const reminderPath = `${this.projectPath}/设定/提醒列表.json`;
      await workshopService.writeFile(
        reminderPath,
        JSON.stringify(Array.from(this.reminders.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存提醒数据失败', { error });
    }
  }

  startAutoCheck(): void {
    if (this.checkTimer) {
      return;
    }
    this.checkTimer = setInterval(() => {
      this.runAllChecks();
    }, this.config.checkInterval);
  }

  stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  async runAllChecks(): Promise<Reminder[]> {
    const newReminders: Reminder[] = [];

    if (this.config.enabledTypes.includes('foreshadowing')) {
      const foreshadowingReminders = await this.checkForeshadowing();
      newReminders.push(...foreshadowingReminders);
    }

    if (this.config.enabledTypes.includes('character')) {
      const characterReminders = await this.checkCharacters();
      newReminders.push(...characterReminders);
    }

    if (this.config.enabledTypes.includes('plot')) {
      const plotReminders = await this.checkPlot();
      newReminders.push(...plotReminders);
    }

    if (this.config.enabledTypes.includes('setting')) {
      const settingReminders = await this.checkSettings();
      newReminders.push(...settingReminders);
    }

    if (this.config.enabledTypes.includes('style')) {
      const styleReminders = await this.checkStyle();
      newReminders.push(...styleReminders);
    }

    if (this.config.enabledTypes.includes('quality')) {
      const qualityReminders = await this.checkQuality();
      newReminders.push(...qualityReminders);
    }

    for (const reminder of newReminders) {
      this.reminders.set(reminder.id, reminder);
    }

    if (newReminders.length > 0) {
      await this.saveToDisk();
    }

    return newReminders;
  }

  private async checkForeshadowing(): Promise<ForeshadowingReminder[]> {
    const reminders: ForeshadowingReminder[] = [];

    try {
      const foreshadowingPath = `${this.projectPath}/设定/伏笔管理.json`;
      const content = await workshopService.readFile(foreshadowingPath);
      if (!content) {
        return reminders;
      }

      const foreshadowings = JSON.parse(content);
      const now = Date.now();

      for (const f of foreshadowings) {
        if (f.status === 'planted' || f.status === 'hinted') {
          const plantedDays = Math.floor((now - f.plantedAt) / (1000 * 60 * 60 * 24));
          let urgency: 'overdue' | 'urgent' | 'normal' = 'normal';
          let priority: ReminderPriority = 'medium';

          if (f.urgency === 'critical' || plantedDays > 30) {
            urgency = 'overdue';
            priority = 'critical';
          } else if (f.urgency === 'high' || plantedDays > 14) {
            urgency = 'urgent';
            priority = 'high';
          }

          reminders.push({
            id: `reminder_foreshadowing_${uuidv4()}`,
            type: 'foreshadowing',
            priority,
            title: `伏笔待处理: ${f.name}`,
            description: `伏笔"${f.name}"已埋设 ${plantedDays} 天，当前状态: ${f.status}`,
            context: f.description || '',
            suggestion:
              f.status === 'planted' ? '考虑在后续情节中暗示此伏笔' : '考虑在近期章节中揭示此伏笔',
            relatedIds: [f.id],
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            foreshadowingId: f.id,
            urgency,
            plantedAt: f.plantedAt,
            expectedResolution: f.expectedResolution,
          });
        }
      }
    } catch (error) {
      logger.error('检查伏笔失败', { error });
    }

    return reminders;
  }

  private async checkCharacters(): Promise<CharacterReminder[]> {
    const reminders: CharacterReminder[] = [];

    try {
      const charactersPath = `${this.projectPath}/设定/人物档案.json`;
      const content = await workshopService.readFile(charactersPath);
      if (!content) {
        return reminders;
      }

      const characters = JSON.parse(content);
      const now = Date.now();

      for (const char of characters) {
        const lastMentioned = char.lastMentionedAt || char.createdAt;
        const daysSinceMention = Math.floor((now - lastMentioned) / (1000 * 60 * 60 * 24));

        if (char.role === 'protagonist' || char.role === 'major') {
          if (daysSinceMention > 10) {
            reminders.push({
              id: `reminder_character_${uuidv4()}`,
              type: 'character',
              priority: char.role === 'protagonist' ? 'high' : 'medium',
              title: `主要角色久未出场: ${char.name}`,
              description: `${char.role === 'protagonist' ? '主角' : '重要角色'}"${char.name}"已 ${daysSinceMention} 天未出场`,
              context: char.description || '',
              suggestion: '考虑让该角色在近期情节中出场，或说明其去向',
              relatedIds: [char.id],
              status: 'pending',
              createdAt: now,
              updatedAt: now,
              characterId: char.id,
              issueType: 'forgotten',
            });
          }

          if (!char.arc || char.arc.length === 0) {
            reminders.push({
              id: `reminder_character_${uuidv4()}`,
              type: 'character',
              priority: 'medium',
              title: `角色缺少成长弧: ${char.name}`,
              description: `角色"${char.name}"尚未设置角色成长弧`,
              context: char.description || '',
              suggestion: '为角色设计成长弧，包括目标、障碍和转变',
              relatedIds: [char.id],
              status: 'pending',
              createdAt: now,
              updatedAt: now,
              characterId: char.id,
              issueType: 'missing_arc',
            });
          }
        }
      }
    } catch (error) {
      logger.error('检查人物失败', { error });
    }

    return reminders;
  }

  private async checkPlot(): Promise<PlotReminder[]> {
    const reminders: PlotReminder[] = [];

    try {
      const plotNodesPath = `${this.projectPath}/设定/情节节点.json`;
      const content = await workshopService.readFile(plotNodesPath);
      if (!content) {
        return reminders;
      }

      const nodes = JSON.parse(content);
      const now = Date.now();

      const activeNodes = nodes.filter(
        (n: { status: string }) => n.status === 'in_progress' || n.status === 'pending'
      );

      if (activeNodes.length > 5) {
        reminders.push({
          id: `reminder_plot_${uuidv4()}`,
          type: 'plot',
          priority: 'medium',
          title: '活跃情节节点过多',
          description: `当前有 ${activeNodes.length} 个活跃的情节节点，可能造成叙事分散`,
          context: '建议聚焦主要情节线',
          suggestion: '考虑完成部分情节节点后再开启新的支线',
          relatedIds: activeNodes.map((n: { id: string }) => n.id).slice(0, 5),
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          issueType: 'stalled',
        });
      }

      for (const node of activeNodes) {
        const startedAt = node.startedAt || node.createdAt;
        const daysInProgress = Math.floor((now - startedAt) / (1000 * 60 * 60 * 24));

        if (daysInProgress > 14 && node.status === 'in_progress') {
          reminders.push({
            id: `reminder_plot_${uuidv4()}`,
            type: 'plot',
            priority: 'medium',
            title: `情节节点进展缓慢: ${node.title}`,
            description: `情节节点"${node.title}"已进行 ${daysInProgress} 天`,
            context: node.description || '',
            suggestion: '考虑加快此情节线的进展，或分解为更小的节点',
            relatedIds: [node.id],
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            nodeId: node.id,
            issueType: 'stalled',
          });
        }
      }
    } catch (error) {
      logger.error('检查剧情失败', { error });
    }

    return reminders;
  }

  private async checkSettings(): Promise<SettingReminder[]> {
    const reminders: SettingReminder[] = [];

    try {
      const worldbuildingPath = `${this.projectPath}/设定/世界观设定.json`;
      const content = await workshopService.readFile(worldbuildingPath);
      const worldbuilding = content ? JSON.parse(content) : {};

      const now = Date.now();
      const missingElements: string[] = [];

      if (!worldbuilding.powerSystem || Object.keys(worldbuilding.powerSystem || {}).length === 0) {
        missingElements.push('力量体系');
      }
      if (!worldbuilding.geography || Object.keys(worldbuilding.geography || {}).length === 0) {
        missingElements.push('地理设定');
      }
      if (!worldbuilding.history || Object.keys(worldbuilding.history || {}).length === 0) {
        missingElements.push('历史背景');
      }
      if (!worldbuilding.culture || Object.keys(worldbuilding.culture || {}).length === 0) {
        missingElements.push('文化设定');
      }

      if (missingElements.length >= 2) {
        reminders.push({
          id: `reminder_setting_${uuidv4()}`,
          type: 'setting',
          priority: 'medium',
          title: '世界观设定不完整',
          description: `缺少以下设定: ${missingElements.join('、')}`,
          context: '完整的世界观设定有助于保持故事一致性',
          suggestion: '建议补充缺失的世界观设定',
          relatedIds: [],
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          settingType: 'worldbuilding',
          missingElements,
        });
      }
    } catch (error) {
      logger.error('检查设定失败', { error });
    }

    return reminders;
  }

  private async checkStyle(): Promise<StyleReminder[]> {
    const reminders: StyleReminder[] = [];

    try {
      const stylePath = `${this.projectPath}/设定/风格档案.json`;
      const content = await workshopService.readFile(stylePath);

      const now = Date.now();

      if (!content) {
        reminders.push({
          id: `reminder_style_${uuidv4()}`,
          type: 'style',
          priority: 'low',
          title: '尚未建立风格档案',
          description: '还没有创建写作风格档案，AI无法学习您的写作风格',
          context: '风格档案可以帮助保持全文风格一致',
          suggestion: '上传一段您满意的正文，让AI学习您的写作风格',
          relatedIds: [],
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          issueType: 'missing_profile',
        });
      }
    } catch (error) {
      logger.error('检查风格失败', { error });
    }

    return reminders;
  }

  private async checkQuality(): Promise<QualityReminder[]> {
    const reminders: QualityReminder[] = [];

    try {
      const contentPath = `${this.projectPath}/正文`;
      const entries = await workshopService.readDirectory(contentPath);

      if (!entries || entries.length === 0) {
        return reminders;
      }

      const files = entries.filter((e) => !e.isDirectory).map((e) => e.name);
      const recentFiles = files.slice(-3);
      const now = Date.now();

      for (const file of recentFiles) {
        const content = await workshopService.readFile(`${contentPath}/${file}`);
        if (!content || content.length < 500) {
          continue;
        }

        const quality = await this.analyzeQuality(content);

        if (quality.pacingScore < 0.6) {
          reminders.push({
            id: `reminder_quality_${uuidv4()}`,
            type: 'quality',
            priority: 'medium',
            title: `节奏问题: ${file}`,
            description: `文件"${file}"的节奏评分较低 (${(quality.pacingScore * 100).toFixed(0)}%)`,
            context: '节奏过快或过慢都会影响阅读体验',
            suggestion: '检查段落长度分布，适当调整叙事节奏',
            relatedIds: [],
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            issueType: 'pacing',
            score: quality.pacingScore,
            threshold: 0.6,
          });
        }

        if (quality.dialogueScore < 0.5) {
          reminders.push({
            id: `reminder_quality_${uuidv4()}`,
            type: 'quality',
            priority: 'low',
            title: `对话问题: ${file}`,
            description: `文件"${file}"的对话评分较低 (${(quality.dialogueScore * 100).toFixed(0)}%)`,
            context: '对话质量影响角色塑造和情节推进',
            suggestion: '检查对话是否自然，是否符合角色性格',
            relatedIds: [],
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            issueType: 'dialogue',
            score: quality.dialogueScore,
            threshold: 0.5,
          });
        }
      }
    } catch (error) {
      logger.error('检查质量失败', { error });
    }

    return reminders;
  }

  private async analyzeQuality(content: string): Promise<{
    pacingScore: number;
    dialogueScore: number;
    descriptionScore: number;
  }> {
    const sentences = content.split(/[。！？\n]/).filter((s) => s.trim());
    const paragraphs = content.split('\n\n').filter((p) => p.trim());
    const dialogues = content.match(/["「『"][^"」』]*["」』"]/g) || [];

    const avgSentenceLength =
      sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length : 0;

    const avgParagraphLength =
      paragraphs.length > 0
        ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
        : 0;

    const dialogueRatio = dialogues.length / Math.max(sentences.length, 1);

    const lengthVariance =
      sentences.length > 1
        ? sentences.reduce((sum, s) => sum + Math.pow(s.length - avgSentenceLength, 2), 0) /
          sentences.length
        : 0;

    let pacingScore = 0.5;
    if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
      pacingScore += 0.2;
    }
    if (lengthVariance >= 50 && lengthVariance <= 300) {
      pacingScore += 0.2;
    }
    if (avgParagraphLength >= 50 && avgParagraphLength <= 300) {
      pacingScore += 0.1;
    }

    let dialogueScore = 0.5;
    if (dialogueRatio >= 0.1 && dialogueRatio <= 0.4) {
      dialogueScore += 0.3;
    }
    if (dialogues.some((d) => d.length > 5 && d.length < 50)) {
      dialogueScore += 0.2;
    }

    const descriptionScore = Math.min(1, avgParagraphLength / 150);

    return {
      pacingScore: Math.min(1, Math.max(0, pacingScore)),
      dialogueScore: Math.min(1, Math.max(0, dialogueScore)),
      descriptionScore: Math.min(1, Math.max(0, descriptionScore)),
    };
  }

  async createReminder(
    type: ReminderType,
    priority: ReminderPriority,
    title: string,
    description: string,
    suggestion: string,
    relatedIds: string[] = []
  ): Promise<Reminder> {
    const now = Date.now();
    const reminder: Reminder = {
      id: `reminder_${uuidv4()}`,
      type,
      priority,
      title,
      description,
      context: '',
      suggestion,
      relatedIds,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.reminders.set(reminder.id, reminder);
    await this.saveToDisk();

    return reminder;
  }

  async acknowledgeReminder(id: string): Promise<boolean> {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      return false;
    }

    reminder.status = 'acknowledged';
    reminder.acknowledgedAt = Date.now();
    reminder.updatedAt = Date.now();

    await this.saveToDisk();
    return true;
  }

  async resolveReminder(id: string): Promise<boolean> {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      return false;
    }

    reminder.status = 'resolved';
    reminder.resolvedAt = Date.now();
    reminder.updatedAt = Date.now();

    await this.saveToDisk();
    return true;
  }

  async dismissReminder(id: string): Promise<boolean> {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      return false;
    }

    reminder.status = 'dismissed';
    reminder.updatedAt = Date.now();

    await this.saveToDisk();
    return true;
  }

  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  getAllReminders(): Reminder[] {
    return Array.from(this.reminders.values());
  }

  getPendingReminders(): Reminder[] {
    return this.getAllReminders()
      .filter((r) => r.status === 'pending')
      .sort((a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]);
  }

  getRemindersByType(type: ReminderType): Reminder[] {
    return this.getAllReminders().filter((r) => r.type === type);
  }

  getRemindersByPriority(priority: ReminderPriority): Reminder[] {
    return this.getAllReminders().filter((r) => r.priority === priority);
  }

  getStats(): ReminderStats {
    const all = this.getAllReminders();
    const pending = all.filter((r) => r.status === 'pending');

    const byType: Record<ReminderType, number> = {
      foreshadowing: 0,
      character: 0,
      plot: 0,
      setting: 0,
      style: 0,
      quality: 0,
      timeline: 0,
      consistency: 0,
    };

    const byPriority: Record<ReminderPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const reminder of pending) {
      byType[reminder.type]++;
      byPriority[reminder.priority]++;
    }

    const oldestPending =
      pending.length > 0 ? Math.min(...pending.map((r) => r.createdAt)) : undefined;

    return {
      total: all.length,
      pending: pending.length,
      critical: byPriority.critical,
      byType,
      byPriority,
      oldestPending,
    };
  }

  async clearResolved(olderThanDays: number = 7): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const toRemove: string[] = [];

    for (const [id, reminder] of this.reminders) {
      if (
        (reminder.status === 'resolved' || reminder.status === 'dismissed') &&
        reminder.updatedAt < cutoff
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.reminders.delete(id);
    }

    if (toRemove.length > 0) {
      await this.saveToDisk();
    }

    return toRemove.length;
  }

  updateConfig(config: Partial<ReminderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ReminderConfig {
    return { ...this.config };
  }
}

export function createReminderService(
  projectPath: string,
  config?: Partial<ReminderConfig>
): ReminderService {
  return new ReminderService(projectPath, config);
}
