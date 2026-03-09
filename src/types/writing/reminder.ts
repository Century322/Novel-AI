export type ReminderType =
  | 'foreshadowing'
  | 'character'
  | 'plot'
  | 'setting'
  | 'style'
  | 'quality'
  | 'timeline'
  | 'consistency';

export type ReminderPriority = 'critical' | 'high' | 'medium' | 'low';

export type ReminderStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface Reminder {
  id: string;
  type: ReminderType;
  priority: ReminderPriority;
  title: string;
  description: string;
  context: string;
  suggestion: string;
  relatedIds: string[];
  status: ReminderStatus;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
}

export interface ForeshadowingReminder extends Reminder {
  type: 'foreshadowing';
  foreshadowingId: string;
  urgency: 'overdue' | 'urgent' | 'normal';
  plantedAt: number;
  expectedResolution?: number;
}

export interface CharacterReminder extends Reminder {
  type: 'character';
  characterId: string;
  issueType: 'underdeveloped' | 'inconsistent' | 'missing_arc' | 'forgotten';
}

export interface PlotReminder extends Reminder {
  type: 'plot';
  nodeId?: string;
  issueType: 'stalled' | 'inconsistent' | 'missing_connection' | 'timeline_conflict';
}

export interface SettingReminder extends Reminder {
  type: 'setting';
  settingType: 'worldbuilding' | 'power_system' | 'geography' | 'history' | 'culture';
  missingElements: string[];
}

export interface StyleReminder extends Reminder {
  type: 'style';
  issueType: 'inconsistent' | 'deviation' | 'missing_profile';
  profileId?: string;
}

export interface QualityReminder extends Reminder {
  type: 'quality';
  issueType: 'pacing' | 'dialogue' | 'description' | 'emotion';
  score: number;
  threshold: number;
}

export interface ReminderConfig {
  enabledTypes: ReminderType[];
  priorityThreshold: ReminderPriority;
  autoAcknowledge: boolean;
  maxPending: number;
  checkInterval: number;
}

export interface ReminderStats {
  total: number;
  pending: number;
  critical: number;
  byType: Record<ReminderType, number>;
  byPriority: Record<ReminderPriority, number>;
  oldestPending?: number;
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabledTypes: [
    'foreshadowing',
    'character',
    'plot',
    'setting',
    'style',
    'quality',
    'timeline',
    'consistency',
  ],
  priorityThreshold: 'medium',
  autoAcknowledge: false,
  maxPending: 50,
  checkInterval: 60000,
};

export const PRIORITY_WEIGHTS: Record<ReminderPriority, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  foreshadowing: '伏笔提醒',
  character: '角色提醒',
  plot: '剧情提醒',
  setting: '设定提醒',
  style: '风格提醒',
  quality: '质量提醒',
  timeline: '时间线提醒',
  consistency: '一致性提醒',
};

export const PRIORITY_LABELS: Record<ReminderPriority, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};
