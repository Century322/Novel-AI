import React, { useState, useEffect, useRef } from 'react';
import {
  useTerminalStore,
  PROBLEM_SEVERITY_LABELS,
  LOG_SOURCE_LABELS,
  NovelProblem,
} from '@/store/terminalStore';
import {
  ScrollText,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Cpu,
  Trash2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomPanelProps {
  height: number;
  onDragStart: (e: React.MouseEvent) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

type PanelTab = 'logs' | 'output' | 'problems';

export const BottomPanel: React.FC<BottomPanelProps> = ({
  height,
  onDragStart,
  isCollapsed,
  onToggle,
}) => {
  const {
    getRecentLogs,
    getRecentOutputs,
    getUnresolvedProblems,
    getProblemStats,
    resolveProblem,
    clearLogs,
  } = useTerminalStore();

  const [activeTab, setActiveTab] = useState<PanelTab>('logs');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const logs = getRecentLogs(20);
  const outputs = getRecentOutputs(5);
  const problems = getUnresolvedProblems();
  const problemStats = getProblemStats();

  useEffect(() => {
    if (logsEndRef.current && activeTab === 'logs') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const criticalCount = problemStats.bySeverity.critical || 0;
  const majorCount = problemStats.bySeverity.major || 0;
  const totalProblems = problemStats.unresolved || 0;

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'logs', label: '日志', icon: <ScrollText size={12} /> },
    { id: 'output', label: '输出', icon: <FileText size={12} /> },
    { id: 'problems', label: '问题', icon: <AlertCircle size={12} />, badge: totalProblems },
  ];

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle size={12} className="text-red-500" />;
      case 'warn':
        return <AlertTriangle size={12} className="text-yellow-500" />;
      case 'debug':
        return <Info size={12} className="text-blue-400" />;
      default:
        return <Info size={12} className="text-zinc-400" />;
    }
  };

  const getProblemIcon = (type: NovelProblem['type']) => {
    switch (type) {
      case 'plot_conflict':
        return <AlertCircle size={14} className="text-orange-500" />;
      case 'character_inconsistency':
        return <AlertTriangle size={14} className="text-purple-500" />;
      case 'timeline_issue':
        return <Clock size={14} className="text-blue-500" />;
      case 'foreshadowing':
        return <Zap size={14} className="text-yellow-500" />;
      case 'setting_conflict':
        return <AlertCircle size={14} className="text-red-500" />;
      default:
        return <Info size={14} className="text-zinc-400" />;
    }
  };

  const getSeverityColor = (severity: NovelProblem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10';
      case 'major':
        return 'text-orange-500 bg-orange-500/10';
      case 'minor':
        return 'text-yellow-500 bg-yellow-500/10';
    }
  };

  if (isCollapsed) {
    return (
      <div className="pt-1 shrink-0">
        <div
          className="h-8 flex items-center justify-between px-3 border-t-2 border-l-2 border-r-2 shrink-0 cursor-pointer rounded-lg bg-[#1a1a1a] border-white/5"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab.id);
                  onToggle();
                }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs transition-colors relative text-zinc-500 hover:text-zinc-300"
              >
                {tab.icon}
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1 rounded-full text-[10px]',
                      tab.id === 'problems' && criticalCount > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-400 text-white'
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <ChevronUp size={14} className="text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1 shrink-0">
      <div
        className="flex flex-col border-t-2 border-l-2 border-r-2 shrink-0 relative rounded-lg bg-[#1a1a1a] border-white/5"
        style={{ height: `${height}px` }}
      >
        <div className="h-8 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs transition-colors relative text-zinc-500 hover:text-zinc-300"
              >
                {tab.icon}
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1 rounded-full text-[10px]',
                      tab.id === 'problems' && criticalCount > 0
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-400 text-white'
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded transition-colors hover:bg-white/10 text-zinc-500"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {activeTab === 'logs' && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">最近 {logs.length} 条日志</span>
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors hover:bg-white/10 text-zinc-500"
                >
                  <Trash2 size={10} />
                  清空
                </button>
              </div>
              {logs.length === 0 ? (
                <div className="font-mono text-xs opacity-50 text-zinc-400">暂无日志</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 font-mono text-xs py-0.5">
                    <span className="shrink-0 text-zinc-500">[{formatTime(log.timestamp)}]</span>
                    {getLevelIcon(log.level)}
                    <span className="shrink-0 text-zinc-500">
                      [{LOG_SOURCE_LABELS[log.source]}]
                    </span>
                    <span
                      className={cn(
                        'flex-1',
                        log.level === 'error'
                          ? 'text-red-500'
                          : log.level === 'warn'
                            ? 'text-yellow-500'
                            : 'text-zinc-400'
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}

          {activeTab === 'output' && (
            <div className="space-y-2">
              {outputs.length === 0 ? (
                <div className="flex items-center gap-2 text-xs opacity-50 text-zinc-400">
                  <Cpu size={14} />
                  <span>暂无生成记录</span>
                </div>
              ) : (
                outputs.map((output) => (
                  <div
                    key={output.id}
                    className="p-2 rounded border text-xs bg-white/5 border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {output.success ? (
                          <CheckCircle2 size={12} className="text-green-500" />
                        ) : (
                          <XCircle size={12} className="text-red-500" />
                        )}
                        <span className="font-medium text-zinc-300">
                          {output.type === 'generate'
                            ? '生成'
                            : output.type === 'refine'
                              ? '优化'
                              : output.type === 'analyze'
                                ? '分析'
                                : '工具调用'}
                        </span>
                      </div>
                      <span className="text-zinc-500">{formatTime(output.timestamp)}</span>
                    </div>
                    <div className="mb-1 text-zinc-400">{output.summary}</div>
                    <div className="flex items-center gap-3">
                      {output.tokenUsage && (
                        <span className="text-zinc-500">Token: {output.tokenUsage.total}</span>
                      )}
                      <span className="text-zinc-500">耗时: {formatDuration(output.duration)}</span>
                      {output.model && <span className="text-zinc-500">模型: {output.model}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'problems' && (
            <div className="space-y-1">
              {problems.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span>没有发现小说问题</span>
                </div>
              ) : (
                <>
                  {(criticalCount > 0 || majorCount > 0) && (
                    <div
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded text-xs mb-2',
                        criticalCount > 0
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-orange-500/10 text-orange-500'
                      )}
                    >
                      <AlertTriangle size={12} />
                      {criticalCount > 0
                        ? `${criticalCount} 个严重问题需要立即处理`
                        : `${majorCount} 个重要问题待解决`}
                    </div>
                  )}
                  {problems.slice(0, 5).map((problem) => (
                    <div
                      key={problem.id}
                      className="flex items-start gap-2 p-2 rounded border text-xs bg-white/5 border-white/5"
                    >
                      {getProblemIcon(problem.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-300">{problem.title}</span>
                          <span
                            className={cn(
                              'px-1 rounded text-[10px]',
                              getSeverityColor(problem.severity)
                            )}
                          >
                            {PROBLEM_SEVERITY_LABELS[problem.severity]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-zinc-400">{problem.description}</div>
                        {problem.location && (
                          <div className="mt-1 text-[10px] text-zinc-500">
                            {problem.location.chapter && `第${problem.location.chapter}章`}
                            {problem.location.scene && ` · ${problem.location.scene}`}
                            {problem.location.character && ` · ${problem.location.character}`}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => resolveProblem(problem.id)}
                        className="p-1 rounded shrink-0 hover:bg-green-500/10 text-green-400"
                        title="标记为已解决"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))}
                  {problems.length > 5 && (
                    <div className="text-center text-xs py-1 text-zinc-500">
                      还有 {problems.length - 5} 个问题...
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-10"
          onMouseDown={onDragStart}
        />
      </div>
    </div>
  );
};
