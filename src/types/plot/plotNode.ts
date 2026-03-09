export type PlotNodeType =
  | 'opening'
  | 'inciting_incident'
  | 'rising_action'
  | 'midpoint'
  | 'climax'
  | 'falling_action'
  | 'resolution'
  | 'subplot_start'
  | 'subplot_end'
  | 'turning_point'
  | 'revelation'
  | 'conflict'
  | 'custom';

export type PlotNodeStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export type PlotLineType = 'main' | 'subplot';

export interface PlotNode {
  id: string;
  title: string;
  type: PlotNodeType;
  description: string;
  status: PlotNodeStatus;

  plotLineId: string;
  plotLineType: PlotLineType;

  sequence: number;
  estimatedChapter?: string;
  actualChapter?: string;

  characters: string[];
  location: string;

  dependencies: string[];
  dependents: string[];

  foreshadowingPlanted: string[];
  foreshadowingResolved: string[];

  emotionalBeat: string;
  tensionLevel: number;

  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlotLine {
  id: string;
  name: string;
  type: PlotLineType;
  description: string;
  nodes: string[];
  status: PlotNodeStatus;
  color: string;
  priority: number;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;

  storyTime: string;
  realTime?: string;

  characters: string[];
  location: string;

  plotNodeId?: string;
  significance: 'major' | 'minor' | 'background';

  consequences: string[];
  relatedEvents: string[];
}

export interface CharacterTimeline {
  characterId: string;
  characterName: string;
  events: TimelineEvent[];
  currentState: string;
  location: string;
}

export interface PlotStructure {
  mainPlot: PlotLine;
  subplots: PlotLine[];
  currentNodeId: string | null;
  overallProgress: number;
}

export const PLOT_NODE_TYPES: Record<
  PlotNodeType,
  { name: string; description: string; typicalPosition: number }
> = {
  opening: { name: '开篇', description: '故事开始，介绍世界观和主角', typicalPosition: 5 },
  inciting_incident: {
    name: '激励事件',
    description: '打破平衡，引发故事的事件',
    typicalPosition: 10,
  },
  rising_action: { name: '上升动作', description: '冲突升级，推动剧情发展', typicalPosition: 30 },
  midpoint: { name: '中点', description: '故事转折点，主角面临重大抉择', typicalPosition: 50 },
  climax: { name: '高潮', description: '冲突达到顶点', typicalPosition: 80 },
  falling_action: { name: '下降动作', description: '高潮后的余波', typicalPosition: 90 },
  resolution: { name: '结局', description: '故事收尾', typicalPosition: 100 },
  subplot_start: { name: '支线开始', description: '支线剧情开始', typicalPosition: 20 },
  subplot_end: { name: '支线结束', description: '支线剧情结束', typicalPosition: 85 },
  turning_point: { name: '转折点', description: '剧情重大转折', typicalPosition: 60 },
  revelation: { name: '揭示', description: '真相或秘密揭示', typicalPosition: 70 },
  conflict: { name: '冲突', description: '主要冲突发生', typicalPosition: 40 },
  custom: { name: '自定义', description: '自定义节点', typicalPosition: 50 },
};

export const EMOTIONAL_BEATS = [
  { value: 'hope', label: '希望', description: '充满希望和期待' },
  { value: 'fear', label: '恐惧', description: '紧张和不安' },
  { value: 'joy', label: '喜悦', description: '开心和满足' },
  { value: 'sadness', label: '悲伤', description: '失落和悲伤' },
  { value: 'anger', label: '愤怒', description: '愤怒和不公' },
  { value: 'surprise', label: '惊讶', description: '意外和震惊' },
  { value: 'tension', label: '紧张', description: '悬念和紧张' },
  { value: 'relief', label: '释然', description: '放松和释然' },
  { value: 'romance', label: '浪漫', description: '爱情和温馨' },
  { value: 'epic', label: '史诗', description: '宏大和壮阔' },
];

export const TENSION_LEVELS = [
  { value: 1, label: '平静', description: '日常和平静' },
  { value: 2, label: '轻微', description: '轻微的紧张感' },
  { value: 3, label: '中等', description: '有一定的紧张感' },
  { value: 4, label: '较高', description: '紧张感明显' },
  { value: 5, label: '高度', description: '高度紧张' },
  { value: 6, label: '极限', description: '紧张感达到极限' },
  { value: 7, label: '爆发', description: '情感爆发点' },
];

export const PLOT_LINE_COLORS = [
  '#3B82F6', // blue - main
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];
