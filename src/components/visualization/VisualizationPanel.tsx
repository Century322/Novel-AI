import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  Clock,
  Users,
  GitBranch,
  Heart,
  AlertTriangle,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import { useProjectStore } from '@/store';
import { workshopService } from '@/services/core/workshopService';
import { logger } from '@/services/core/loggerService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface VisualizationPanelProps {
  type: 'timeline' | 'characters' | 'relationships' | 'foreshadowing' | 'emotion_arc' | 'conflicts';
  data: Record<string, unknown>;
}

const chartColors = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(20, 184, 166, 0.8)',
  'rgba(249, 115, 22, 0.8)',
];

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ type, data }) => {
  const [activeView, setActiveView] = useState<'chart' | 'list'>('chart');

  const renderTimelineVisualization = () => {
    const events =
      (data.events as Array<{
        id: string;
        title?: string;
        description?: string;
        storyTime?: string;
        chapter?: number;
      }>) || [];

    const timelineData = {
      labels: events.map((e, i) => e.storyTime || e.title || `事件 ${i + 1}`),
      datasets: [
        {
          label: '时间线事件',
          data: events.map((_, i) => i + 1),
          borderColor: chartColors[0],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: '故事时间线', color: '#a1a1aa' },
      },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };

    return (
      <div className="h-64">
        <Line data={timelineData} options={options} />
        <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
          {events.slice(0, 10).map((event, i) => (
            <div
              key={event.id || i}
              className="flex items-center gap-2 text-xs p-2 rounded bg-white/5"
            >
              <span className="text-zinc-500">{event.storyTime || `第${event.chapter}章`}</span>
              <span className="text-zinc-300">
                {event.title || event.description?.substring(0, 30)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCharactersVisualization = () => {
    const characters =
      (data.characters as Array<{
        id: string;
        name: string;
        role?: string;
        importance?: number;
      }>) || [];

    const roleCounts: Record<string, number> = {};
    characters.forEach((c) => {
      const role = c.role || '未知';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    const pieData = {
      labels: Object.keys(roleCounts),
      datasets: [
        {
          data: Object.values(roleCounts),
          backgroundColor: chartColors.slice(0, Object.keys(roleCounts).length),
          borderWidth: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' as const, labels: { color: '#a1a1aa', boxWidth: 12 } },
        title: { display: true, text: '角色分布', color: '#a1a1aa' },
      },
    };

    return (
      <div className="h-64">
        <Pie data={pieData} options={options} />
        <div className="mt-4 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {characters.slice(0, 8).map((char, i) => (
            <div
              key={char.id || i}
              className="flex items-center gap-2 text-xs p-2 rounded bg-white/5"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: chartColors[i % chartColors.length] }}
              />
              <span className="text-zinc-300">{char.name}</span>
              <span className="text-zinc-500 text-[10px]">{char.role}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderForeshadowingVisualization = () => {
    const planted = (data.planted as number) || 0;
    const resolved = (data.resolved as number) || 0;
    const total = (data.total as number) || 0;
    const hinted = total - planted - resolved;

    const barData = {
      labels: ['已埋设', '已暗示', '已回收'],
      datasets: [
        {
          label: '伏笔数量',
          data: [planted, hinted, resolved],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)',
          ],
          borderWidth: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: '伏笔状态分布', color: '#a1a1aa' },
      },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };

    return (
      <div className="h-64">
        <Bar data={barData} options={options} />
        <div className="mt-4 flex justify-around text-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">{planted}</div>
            <div className="text-xs text-zinc-500">已埋设</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">{hinted}</div>
            <div className="text-xs text-zinc-500">已暗示</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{resolved}</div>
            <div className="text-xs text-zinc-500">已回收</div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmotionArcVisualization = () => {
    const stats = data.stats as {
      totalStates?: number;
      totalTransitions?: number;
      totalArcs?: number;
      averageAuthenticity?: number;
      byEmotion?: Record<string, number>;
    } | null;

    if (!stats) {
      return (
        <div className="h-64 flex items-center justify-center text-zinc-500">暂无情感数据</div>
      );
    }

    const emotionLabels: Record<string, string> = {
      joy: '喜悦',
      sorrow: '悲伤',
      anger: '愤怒',
      fear: '恐惧',
      love: '爱',
      hate: '恨',
      surprise: '惊讶',
      anticipation: '期待',
      trust: '信任',
      disgust: '厌恶',
      neutral: '平静',
      mixed: '复杂',
      any: '其他',
    };

    const emotionData = stats.byEmotion || {};
    const labels = Object.keys(emotionData).filter((k) => emotionData[k] > 0);
    const values = labels.map((k) => emotionData[k]);

    const pieData = {
      labels: labels.map((l) => emotionLabels[l] || l),
      datasets: [
        {
          data: values,
          backgroundColor: chartColors.slice(0, labels.length),
          borderWidth: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' as const, labels: { color: '#a1a1aa', boxWidth: 12 } },
        title: { display: true, text: '情感分布', color: '#a1a1aa' },
      },
    };

    return (
      <div className="h-64">
        <Pie data={pieData} options={options} />
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded bg-white/5">
            <div className="text-lg font-bold text-zinc-300">{stats.totalStates || 0}</div>
            <div className="text-xs text-zinc-500">情感状态</div>
          </div>
          <div className="p-2 rounded bg-white/5">
            <div className="text-lg font-bold text-zinc-300">
              {stats.averageAuthenticity ? (stats.averageAuthenticity * 100).toFixed(0) : 100}%
            </div>
            <div className="text-xs text-zinc-500">真实性评分</div>
          </div>
        </div>
      </div>
    );
  };

  const renderConflictsVisualization = () => {
    const conflicts =
      (data.conflicts as Array<{
        id: string;
        type?: string;
        severity?: string;
        description?: string;
      }>) || [];

    const severityCounts: Record<string, number> = {};
    conflicts.forEach((c) => {
      const severity = c.severity || 'unknown';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    });

    const barData = {
      labels: ['严重', '重要', '轻微'],
      datasets: [
        {
          label: '冲突数量',
          data: [
            severityCounts['critical'] || 0,
            severityCounts['major'] || 0,
            severityCounts['minor'] || 0,
          ],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(59, 130, 246, 0.8)',
          ],
          borderWidth: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: '冲突严重程度', color: '#a1a1aa' },
      },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };

    return (
      <div className="h-64">
        <Bar data={barData} options={options} />
        <div className="mt-4 space-y-1 max-h-32 overflow-y-auto">
          {conflicts.slice(0, 5).map((conflict, i) => (
            <div
              key={conflict.id || i}
              className="flex items-center gap-2 text-xs p-2 rounded bg-white/5"
            >
              <AlertTriangle
                size={12}
                className={
                  conflict.severity === 'critical'
                    ? 'text-red-400'
                    : conflict.severity === 'major'
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                }
              />
              <span className="text-zinc-300 truncate">
                {conflict.description?.substring(0, 40) || '未知冲突'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRelationshipsVisualization = () => {
    const relationships =
      (data.relationships as Array<{
        id: string;
        type?: string;
        source?: string;
        target?: string;
      }>) || [];

    return (
      <div className="h-64">
        <div className="text-center text-zinc-400 mb-4">角色关系网络</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {relationships.length > 0 ? (
            relationships.slice(0, 10).map((rel, i) => (
              <div
                key={rel.id || i}
                className="flex items-center gap-1 text-xs p-2 rounded bg-white/5"
              >
                <span className="text-blue-400">{rel.source}</span>
                <span className="text-zinc-500">→</span>
                <span className="text-green-400">{rel.target}</span>
                <span className="text-zinc-500 text-[10px]">({rel.type})</span>
              </div>
            ))
          ) : (
            <div className="text-zinc-500">暂无关系数据</div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'timeline':
        return renderTimelineVisualization();
      case 'characters':
        return renderCharactersVisualization();
      case 'relationships':
        return renderRelationshipsVisualization();
      case 'foreshadowing':
        return renderForeshadowingVisualization();
      case 'emotion_arc':
        return renderEmotionArcVisualization();
      case 'conflicts':
        return renderConflictsVisualization();
      default:
        return <div className="text-zinc-500">未知可视化类型</div>;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'timeline':
        return <Clock size={16} />;
      case 'characters':
        return <Users size={16} />;
      case 'relationships':
        return <GitBranch size={16} />;
      case 'foreshadowing':
        return <TrendingUp size={16} />;
      case 'emotion_arc':
        return <Heart size={16} />;
      case 'conflicts':
        return <AlertTriangle size={16} />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'timeline':
        return '时间线';
      case 'characters':
        return '角色';
      case 'relationships':
        return '关系';
      case 'foreshadowing':
        return '伏笔';
      case 'emotion_arc':
        return '情感';
      case 'conflicts':
        return '冲突';
      default:
        return '可视化';
    }
  };

  return (
    <div className="rounded-lg border border-white/5 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-zinc-300">
          {getIcon()}
          <span className="font-medium">{getTitle()}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveView('chart')}
            className={`px-2 py-1 text-xs rounded ${activeView === 'chart' ? 'bg-white/10 text-zinc-300' : 'text-zinc-500'}`}
          >
            图表
          </button>
          <button
            onClick={() => setActiveView('list')}
            className={`px-2 py-1 text-xs rounded ${activeView === 'list' ? 'bg-white/10 text-zinc-300' : 'text-zinc-500'}`}
          >
            列表
          </button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export const VisualizationDashboard: React.FC = () => {
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectPath = currentProject?.path;
  const [visualizations, setVisualizations] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVisualizationData = async () => {
      if (!projectPath) {
        setLoading(false);
        setVisualizations({});
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data: Record<string, Record<string, unknown>> = {};

        try {
          const timelinePath = `${projectPath}/设定/时间线.json`;
          const timelineContent = await workshopService.readFile(timelinePath);
          if (timelineContent) {
            const timelineData = JSON.parse(timelineContent);
            data.timeline = {
              events: Array.isArray(timelineData) ? timelineData : timelineData.events || [],
            };
          }
        } catch {
          /* ignore */
        }

        if (!data.timeline) {
          data.timeline = { events: [] };
        }

        try {
          const charactersPath = `${projectPath}/设定/角色档案.json`;
          const charactersContent = await workshopService.readFile(charactersPath);
          if (charactersContent) {
            const charactersData = JSON.parse(charactersContent);
            data.characters = {
              characters: Array.isArray(charactersData)
                ? charactersData
                : charactersData.characters || [],
            };
          }
        } catch {
          /* ignore */
        }

        if (!data.characters) {
          data.characters = { characters: [] };
        }

        try {
          const foreshadowingPath = `${projectPath}/设定/伏笔.json`;
          const foreshadowingContent = await workshopService.readFile(foreshadowingPath);
          if (foreshadowingContent) {
            const foreshadowingData = JSON.parse(foreshadowingContent);
            const items = Array.isArray(foreshadowingData)
              ? foreshadowingData
              : foreshadowingData.foreshadowings || [];
            const planted = items.filter((f: { status?: string }) => f.status === 'planted').length;
            const resolved = items.filter(
              (f: { status?: string }) => f.status === 'resolved'
            ).length;
            data.foreshadowing = { planted, resolved, total: items.length, foreshadowings: items };
          }
        } catch {
          /* ignore */
        }

        if (!data.foreshadowing) {
          data.foreshadowing = { planted: 0, resolved: 0, total: 0, foreshadowings: [] };
        }

        try {
          const emotionPath = `${projectPath}/设定/情感分析.json`;
          const emotionContent = await workshopService.readFile(emotionPath);
          if (emotionContent) {
            const emotionData = JSON.parse(emotionContent);
            data.emotion_arc = { stats: emotionData.stats || emotionData };
          }
        } catch {
          /* ignore */
        }

        if (!data.emotion_arc) {
          data.emotion_arc = { stats: null };
        }

        try {
          const conflictsPath = `${projectPath}/设定/冲突检测.json`;
          const conflictsContent = await workshopService.readFile(conflictsPath);
          if (conflictsContent) {
            const conflictsData = JSON.parse(conflictsContent);
            const conflicts = Array.isArray(conflictsData)
              ? conflictsData
              : conflictsData.conflicts || [];
            data.conflicts = { conflicts, total: conflicts.length };
          }
        } catch {
          /* ignore */
        }

        if (!data.conflicts) {
          data.conflicts = { conflicts: [], total: 0 };
        }

        setVisualizations(data);
      } catch (err) {
        logger.error('加载可视化数据失败', { error: err });
        setError('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadVisualizationData();
  }, [projectPath]);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 gap-4">
        <FolderOpen size={64} className="opacity-30" />
        <div className="text-center">
          <p className="text-lg font-medium">请先打开一个项目</p>
          <p className="text-sm mt-2 opacity-60">可视化需要项目数据支持</p>
          <p className="text-xs mt-1 opacity-40">点击左上角"项目"菜单创建或打开项目</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-zinc-500">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full mx-auto mb-4"></div>
          <p>加载可视化数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-red-400">
        <div className="text-center">
          <p className="text-lg">{error}</p>
          <p className="text-sm mt-2 opacity-60">请检查项目文件是否完整</p>
        </div>
      </div>
    );
  }

  const hasData = Object.values(visualizations).some((v) => {
    const d = v as Record<string, unknown>;
    return (
      (d.events as unknown[])?.length > 0 ||
      (d.characters as unknown[])?.length > 0 ||
      (d.foreshadowings as unknown[])?.length > 0 ||
      (d.total as number) > 0
    );
  });

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-zinc-500 gap-4">
        <FolderOpen size={64} className="opacity-30" />
        <div className="text-center">
          <p className="text-lg font-medium">暂无可视化数据</p>
          <p className="text-sm mt-2 opacity-60">开始创作后，数据将自动显示在这里</p>
          <p className="text-xs mt-1 opacity-40">与 AI 对话创建角色、时间线、伏笔等内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-transparent min-h-full">
      <VisualizationPanel
        type="timeline"
        data={(visualizations.timeline || { events: [] }) as Record<string, unknown>}
      />
      <VisualizationPanel
        type="characters"
        data={(visualizations.characters || { characters: [] }) as Record<string, unknown>}
      />
      <VisualizationPanel
        type="foreshadowing"
        data={
          (visualizations.foreshadowing || { planted: 0, resolved: 0, total: 0 }) as Record<
            string,
            unknown
          >
        }
      />
      <VisualizationPanel
        type="emotion_arc"
        data={(visualizations.emotion_arc || { stats: null }) as Record<string, unknown>}
      />
    </div>
  );
};

export default VisualizationPanel;
