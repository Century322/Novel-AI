import {
  ParallelVisualization,
  VisualizationTrack,
  TrackDataPoint,
  TrackConnection,
  VisualizationFilter,
  VisualizationHighlight,
  VisualizationAnnotation,
  VisualizationConfig,
  SyncPoint,
  TrackType,
  ZoomLevel,
  VisualizationLayout,
  TRACK_TYPE_COLORS,
  DEFAULT_VISUALIZATION_CONFIG,
} from '@/types/plot/parallelVisualization';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ParallelVisualizationService {
  private projectPath: string;
  private visualizations: Map<string, ParallelVisualization> = new Map();
  private config: VisualizationConfig;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_VISUALIZATION_CONFIG };
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const vizPath = `${this.projectPath}/设定/可视化/可视化配置.json`;
      const content = await workshopService.readFile(vizPath);
      if (content) {
        const data: ParallelVisualization[] = JSON.parse(content);
        this.visualizations = new Map(data.map((v) => [v.id, v]));
      }
    } catch (error) {
      logger.error('加载可视化数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/可视化`;
      await workshopService.createDirectory(basePath);
      await workshopService.writeFile(
        `${basePath}/可视化配置.json`,
        JSON.stringify(Array.from(this.visualizations.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存可视化数据失败', { error });
    }
  }

  async createVisualization(
    name: string,
    description: string,
    layout: VisualizationLayout = 'timeline'
  ): Promise<ParallelVisualization> {
    const now = Date.now();
    const viz: ParallelVisualization = {
      id: `viz_${uuidv4()}`,
      name,
      description,
      layout,
      zoomLevel: 'chapter',
      tracks: [],
      connections: [],
      timeRange: { start: 0, end: 100, unit: 'day' },
      filters: [],
      highlights: [],
      annotations: [],
      createdAt: now,
      updatedAt: now,
    };

    this.visualizations.set(viz.id, viz);
    await this.saveToDisk();
    return viz;
  }

  async addTrack(
    visualizationId: string,
    name: string,
    type: TrackType,
    data?: Partial<TrackDataPoint>[]
  ): Promise<VisualizationTrack | null> {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const track: VisualizationTrack = {
      id: `track_${uuidv4()}`,
      name,
      type,
      color: TRACK_TYPE_COLORS[type],
      visible: true,
      collapsed: false,
      order: viz.tracks.length,
      data: [],
      style: {
        color: TRACK_TYPE_COLORS[type],
        opacity: 1,
        lineWidth: 2,
        nodeShape: 'circle',
        nodeSize: 10,
        showLabels: true,
        showConnections: true,
      },
    };

    if (data && data.length > 0) {
      track.data = data.map((d) => ({
        id: `point_${uuidv4()}`,
        trackId: track.id,
        title: d.title || '',
        description: d.description || '',
        startTime: d.startTime || 0,
        endTime: d.endTime || 0,
        displayTime: d.displayTime || '',
        position: { x: 0, y: 0, width: 100, height: 40 },
        connections: [],
        significance: d.significance || 'minor',
        status: d.status || 'planned',
        metadata: d.metadata || {},
      }));
    }

    viz.tracks.push(track);
    viz.updatedAt = Date.now();
    await this.saveToDisk();
    return track;
  }

  async addDataPoint(
    visualizationId: string,
    trackId: string,
    point: Omit<TrackDataPoint, 'id' | 'trackId' | 'position'>
  ): Promise<TrackDataPoint | null> {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const track = viz.tracks.find((t) => t.id === trackId);
    if (!track) {
      return null;
    }

    const newPoint: TrackDataPoint = {
      ...point,
      id: `point_${uuidv4()}`,
      trackId,
      position: { x: 0, y: 0, width: 100, height: 40 },
    };

    track.data.push(newPoint);
    track.data.sort((a, b) => a.startTime - b.startTime);

    this.calculatePositions(viz, track);

    viz.updatedAt = Date.now();
    await this.saveToDisk();
    return newPoint;
  }

  private calculatePositions(viz: ParallelVisualization, track: VisualizationTrack): void {
    const timeRange = viz.timeRange.end - viz.timeRange.start;
    if (timeRange <= 0) {
      return;
    }

    const trackIndex = viz.tracks.indexOf(track);
    const y = trackIndex * (this.config.trackHeight + this.config.trackSpacing);

    for (const point of track.data) {
      const xRatio = (point.startTime - viz.timeRange.start) / timeRange;
      point.position.x = xRatio * 1000;
      point.position.y = y;

      const duration = point.endTime - point.startTime;
      const widthRatio = duration / timeRange;
      point.position.width = Math.max(50, widthRatio * 1000);
    }
  }

  async addConnection(
    visualizationId: string,
    sourceTrackId: string,
    sourcePointId: string,
    targetTrackId: string,
    targetPointId: string,
    type: TrackConnection['type'],
    label: string = ''
  ): Promise<TrackConnection | null> {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const connection: TrackConnection = {
      id: `conn_${uuidv4()}`,
      sourceTrackId,
      sourcePointId,
      targetTrackId,
      targetPointId,
      type,
      strength: 'medium',
      label,
      color: '#6B7280',
    };

    const sourceTrack = viz.tracks.find((t) => t.id === sourceTrackId);
    const sourcePoint = sourceTrack?.data.find((p) => p.id === sourcePointId);
    if (sourcePoint) {
      sourcePoint.connections.push(connection.id);
    }

    const targetTrack = viz.tracks.find((t) => t.id === targetTrackId);
    const targetPoint = targetTrack?.data.find((p) => p.id === targetPointId);
    if (targetPoint) {
      targetPoint.connections.push(connection.id);
    }

    viz.connections.push(connection);
    viz.updatedAt = Date.now();
    await this.saveToDisk();
    return connection;
  }

  async addAnnotation(
    visualizationId: string,
    content: string,
    type: VisualizationAnnotation['type'],
    position: { x: number; y: number },
    trackId?: string,
    pointId?: string
  ): Promise<VisualizationAnnotation | null> {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const annotation: VisualizationAnnotation = {
      id: `ann_${uuidv4()}`,
      trackId,
      pointId,
      position,
      content,
      type,
      createdAt: Date.now(),
      createdBy: 'user',
    };

    viz.annotations.push(annotation);
    viz.updatedAt = Date.now();
    await this.saveToDisk();
    return annotation;
  }

  async addHighlight(
    visualizationId: string,
    type: VisualizationHighlight['type'],
    targetIds: string[],
    label: string,
    description: string,
    color: string = '#FBBF24'
  ): Promise<VisualizationHighlight | null> {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const highlight: VisualizationHighlight = {
      id: `high_${uuidv4()}`,
      type,
      targetIds,
      color,
      label,
      description,
    };

    viz.highlights.push(highlight);
    viz.updatedAt = Date.now();
    await this.saveToDisk();
    return highlight;
  }

  findSyncPoints(visualizationId: string): SyncPoint[] {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return [];
    }

    const syncPoints: SyncPoint[] = [];
    const timeMap = new Map<
      number,
      Array<{ trackId: string; pointId: string; description: string }>
    >();

    for (const track of viz.tracks) {
      for (const point of track.data) {
        const time = point.startTime;
        if (!timeMap.has(time)) {
          timeMap.set(time, []);
        }
        timeMap.get(time)!.push({
          trackId: track.id,
          pointId: point.id,
          description: point.title,
        });
      }
    }

    for (const [time, tracks] of timeMap) {
      if (tracks.length > 1) {
        syncPoints.push({
          id: `sync_${uuidv4()}`,
          time,
          displayTime: `时间点 ${time}`,
          tracks,
          type: tracks.length > 2 ? 'convergence' : 'parallel',
          significance: tracks.some((t) => {
            const track = viz.tracks.find((tr) => tr.id === t.trackId);
            const point = track?.data.find((p) => p.id === t.pointId);
            return point?.significance === 'critical';
          })
            ? 'critical'
            : 'major',
        });
      }
    }

    return syncPoints.sort((a, b) => a.time - b.time);
  }

  async autoGenerateFromProject(): Promise<ParallelVisualization | null> {
    const viz = await this.createVisualization(
      '项目总览',
      '自动从项目数据生成的可视化视图',
      'timeline'
    );

    const plotNodes = await this.loadPlotNodes();
    if (plotNodes.length > 0) {
      await this.addTrack(
        viz.id,
        '主线剧情',
        'main_plot',
        plotNodes.map((node: Record<string, unknown>) => ({
          title: (node.title as string) || '',
          description: (node.description as string) || '',
          startTime: (node.order as number) || 0,
          endTime: ((node.order as number) || 0) + 1,
          displayTime: `节点 ${node.order}`,
          significance: (node.significance as 'critical' | 'major' | 'minor') || 'major',
          status: (node.status as 'planned' | 'in_progress' | 'completed') || 'planned',
          metadata: { nodeId: node.id },
        }))
      );
    }

    const characters = await this.loadCharacters();
    for (const char of characters
      .filter((c: Record<string, unknown>) => c.role === 'protagonist' || c.role === 'major')
      .slice(0, 5)) {
      await this.addTrack(viz.id, `${(char as { name: string }).name}时间线`, 'character');
    }

    const subplots = await this.loadSubplots();
    for (const subplot of subplots.slice(0, 3)) {
      const subplotData = subplot as {
        name: string;
        nodes?: Array<{ title: string; description: string; sequence: number; status: string }>;
      };
      await this.addTrack(
        viz.id,
        subplotData.name,
        'subplot',
        subplotData.nodes?.map((node) => ({
          title: node.title,
          description: node.description,
          startTime: node.sequence,
          endTime: node.sequence + 1,
          displayTime: `节点 ${node.sequence}`,
          significance: 'minor' as const,
          status: (node.status || 'planned') as 'planned' | 'in_progress' | 'completed',
        })) || []
      );
    }

    return viz;
  }

  private async loadPlotNodes(): Promise<Array<Record<string, unknown>>> {
    try {
      const content = await workshopService.readFile(`${this.projectPath}/设定/情节节点.json`);
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  private async loadCharacters(): Promise<Array<Record<string, unknown>>> {
    try {
      const content = await workshopService.readFile(`${this.projectPath}/设定/人物档案.json`);
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  private async loadSubplots(): Promise<Array<Record<string, unknown>>> {
    try {
      const content = await workshopService.readFile(
        `${this.projectPath}/设定/支线管理/支线列表.json`
      );
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  setZoomLevel(visualizationId: string, level: ZoomLevel): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    viz.zoomLevel = level;
    this.config.zoomLevel = level;

    for (const track of viz.tracks) {
      this.calculatePositions(viz, track);
    }

    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  setLayout(visualizationId: string, layout: VisualizationLayout): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    viz.layout = layout;
    this.config.layout = layout;
    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  toggleTrackVisibility(visualizationId: string, trackId: string): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    const track = viz.tracks.find((t) => t.id === trackId);
    if (!track) {
      return false;
    }

    track.visible = !track.visible;
    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  toggleTrackCollapse(visualizationId: string, trackId: string): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    const track = viz.tracks.find((t) => t.id === trackId);
    if (!track) {
      return false;
    }

    track.collapsed = !track.collapsed;
    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  reorderTracks(visualizationId: string, trackIds: string[]): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    for (let i = 0; i < trackIds.length; i++) {
      const track = viz.tracks.find((t) => t.id === trackIds[i]);
      if (track) {
        track.order = i;
      }
    }

    viz.tracks.sort((a, b) => a.order - b.order);

    for (const track of viz.tracks) {
      this.calculatePositions(viz, track);
    }

    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  applyFilter(
    visualizationId: string,
    filter: Omit<VisualizationFilter, 'id'>
  ): VisualizationFilter | null {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return null;
    }

    const newFilter: VisualizationFilter = {
      id: `filter_${uuidv4()}`,
      ...filter,
    };

    viz.filters.push(newFilter);
    viz.updatedAt = Date.now();
    this.saveToDisk();
    return newFilter;
  }

  removeFilter(visualizationId: string, filterId: string): boolean {
    const viz = this.visualizations.get(visualizationId);
    if (!viz) {
      return false;
    }

    const index = viz.filters.findIndex((f) => f.id === filterId);
    if (index < 0) {
      return false;
    }

    viz.filters.splice(index, 1);
    viz.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  getVisualization(id: string): ParallelVisualization | undefined {
    return this.visualizations.get(id);
  }

  getAllVisualizations(): ParallelVisualization[] {
    return Array.from(this.visualizations.values());
  }

  deleteVisualization(id: string): boolean {
    const result = this.visualizations.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  exportVisualization(id: string): string | null {
    const viz = this.visualizations.get(id);
    if (!viz) {
      return null;
    }

    return JSON.stringify(viz, null, 2);
  }

  async importVisualization(json: string): Promise<ParallelVisualization | null> {
    try {
      const viz = JSON.parse(json) as ParallelVisualization;
      viz.id = `viz_${uuidv4()}`;
      viz.createdAt = Date.now();
      viz.updatedAt = Date.now();

      this.visualizations.set(viz.id, viz);
      await this.saveToDisk();
      return viz;
    } catch {
      return null;
    }
  }

  getConfig(): VisualizationConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getStats(): {
    totalVisualizations: number;
    totalTracks: number;
    totalConnections: number;
    byLayout: Record<VisualizationLayout, number>;
    byTrackType: Record<TrackType, number>;
  } {
    const all = this.getAllVisualizations();

    const byLayout: Record<VisualizationLayout, number> = {
      horizontal: 0,
      vertical: 0,
      grid: 0,
      timeline: 0,
      network: 0,
    };

    const byTrackType: Record<TrackType, number> = {
      main_plot: 0,
      subplot: 0,
      character: 0,
      world_event: 0,
      location: 0,
    };

    let totalTracks = 0;
    let totalConnections = 0;

    for (const viz of all) {
      byLayout[viz.layout]++;
      totalTracks += viz.tracks.length;
      totalConnections += viz.connections.length;

      for (const track of viz.tracks) {
        byTrackType[track.type]++;
      }
    }

    return {
      totalVisualizations: all.length,
      totalTracks,
      totalConnections,
      byLayout,
      byTrackType,
    };
  }
}

export function createParallelVisualizationService(
  projectPath: string
): ParallelVisualizationService {
  return new ParallelVisualizationService(projectPath);
}
