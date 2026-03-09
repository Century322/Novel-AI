export type VisualizationLayout = 'horizontal' | 'vertical' | 'grid' | 'timeline' | 'network';

export type TrackType = 'main_plot' | 'subplot' | 'character' | 'world_event' | 'location';

export type ZoomLevel = 'overview' | 'arc' | 'chapter' | 'scene' | 'paragraph';

export interface VisualizationTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  visible: boolean;
  collapsed: boolean;
  order: number;

  data: TrackDataPoint[];

  style: TrackStyle;
}

export interface TrackDataPoint {
  id: string;
  trackId: string;
  title: string;
  description: string;

  startTime: number;
  endTime: number;
  displayTime: string;

  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  connections: string[];

  significance: 'critical' | 'major' | 'minor';
  status: 'planned' | 'in_progress' | 'completed';

  metadata: Record<string, unknown>;
}

export interface TrackStyle {
  color: string;
  opacity: number;
  lineWidth: number;
  nodeShape: 'circle' | 'square' | 'diamond' | 'hexagon';
  nodeSize: number;
  showLabels: boolean;
  showConnections: boolean;
}

export interface ParallelVisualization {
  id: string;
  name: string;
  description: string;

  layout: VisualizationLayout;
  zoomLevel: ZoomLevel;

  tracks: VisualizationTrack[];

  connections: TrackConnection[];

  timeRange: {
    start: number;
    end: number;
    unit: 'year' | 'month' | 'day' | 'hour';
  };

  filters: VisualizationFilter[];

  highlights: VisualizationHighlight[];

  annotations: VisualizationAnnotation[];

  createdAt: number;
  updatedAt: number;
}

export interface TrackConnection {
  id: string;
  sourceTrackId: string;
  sourcePointId: string;
  targetTrackId: string;
  targetPointId: string;

  type: 'causal' | 'temporal' | 'character' | 'thematic';
  strength: 'strong' | 'medium' | 'weak';

  label: string;
  color: string;
}

export interface VisualizationFilter {
  id: string;
  type: 'track_type' | 'significance' | 'status' | 'time_range' | 'character';
  value: unknown;
  enabled: boolean;
}

export interface VisualizationHighlight {
  id: string;
  type: 'region' | 'point' | 'connection';
  targetIds: string[];
  color: string;
  label: string;
  description: string;
}

export interface VisualizationAnnotation {
  id: string;
  trackId?: string;
  pointId?: string;

  position: {
    x: number;
    y: number;
  };

  content: string;
  type: 'note' | 'warning' | 'suggestion' | 'question';

  createdAt: number;
  createdBy: string;
}

export interface VisualizationConfig {
  layout: VisualizationLayout;
  zoomLevel: ZoomLevel;

  showConnections: boolean;
  showAnnotations: boolean;
  showTimeMarkers: boolean;

  trackHeight: number;
  trackSpacing: number;

  colorScheme: 'default' | 'pastel' | 'vibrant' | 'monochrome';

  animationEnabled: boolean;
  autoFit: boolean;
}

export interface SyncPoint {
  id: string;
  time: number;
  displayTime: string;

  tracks: Array<{
    trackId: string;
    pointId: string;
    description: string;
  }>;

  type: 'convergence' | 'divergence' | 'parallel';
  significance: 'critical' | 'major' | 'minor';
}

export const TRACK_TYPE_COLORS: Record<TrackType, string> = {
  main_plot: '#3B82F6',
  subplot: '#10B981',
  character: '#F59E0B',
  world_event: '#EF4444',
  location: '#8B5CF6',
};

export const TRACK_TYPE_LABELS: Record<TrackType, string> = {
  main_plot: '主线剧情',
  subplot: '支线剧情',
  character: '角色时间线',
  world_event: '世界事件',
  location: '地点时间线',
};

export const ZOOM_LEVEL_LABELS: Record<ZoomLevel, string> = {
  overview: '总览',
  arc: '篇章',
  chapter: '章节',
  scene: '场景',
  paragraph: '段落',
};

export const LAYOUT_LABELS: Record<VisualizationLayout, string> = {
  horizontal: '水平布局',
  vertical: '垂直布局',
  grid: '网格布局',
  timeline: '时间线布局',
  network: '网络布局',
};

export const DEFAULT_VISUALIZATION_CONFIG: VisualizationConfig = {
  layout: 'timeline',
  zoomLevel: 'chapter',
  showConnections: true,
  showAnnotations: true,
  showTimeMarkers: true,
  trackHeight: 60,
  trackSpacing: 20,
  colorScheme: 'default',
  animationEnabled: true,
  autoFit: true,
};
