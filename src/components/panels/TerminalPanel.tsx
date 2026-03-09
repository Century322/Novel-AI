import React, { useState, useMemo } from 'react';
import {
  useTerminalStore,
  PROBLEM_TYPE_LABELS,
  PROBLEM_SEVERITY_LABELS,
  LOG_LEVEL_LABELS,
  LOG_SOURCE_LABELS,
  LogLevel,
  LogSource,
  NovelProblem,
} from '@/store/terminalStore';
import {
  ScrollText,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Cpu,
  Search,
  Trash2,
  Check,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelTab = 'logs' | 'output' | 'problems';

interface FilterState {
  logLevel: LogLevel | 'all';
  logSource: LogSource | 'all';
  problemType: NovelProblem['type'] | 'all';
  problemSeverity: NovelProblem['severity'] | 'all';
  showResolved: boolean;
}

export const TerminalPanel: React.FC = () => {
  const {
    logs,
    outputs,
    problems,
    getProblemStats,
    resolveProblem,
    clearLogs,
    clearOutputs,
    clearProblems,
  } = useTerminalStore();

  const [activeTab, setActiveTab] = useState<PanelTab>('logs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    logLevel: 'all',
    logSource: 'all',
    problemType: 'all',
    problemSeverity: 'all',
    showResolved: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);

  const problemStats = getProblemStats();

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'logs', label: '日志', icon: <ScrollText size={16} />, badge: logs.length },
    { id: 'output', label: '输出', icon: <FileText size={16} />, badge: outputs.length },
    {
      id: 'problems',
      label: '问题',
      icon: <AlertCircle size={16} />,
      badge: problemStats.unresolved,
    },
  ];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filters.logLevel !== 'all' && log.level !== filters.logLevel) {
        return false;
      }
      if (filters.logSource !== 'all' && log.source !== filters.logSource) {
        return false;
      }
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, filters, searchQuery]);

  const filteredOutputs = useMemo(() => {
    return outputs.filter((output) => {
      if (searchQuery && !output.summary.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [outputs, searchQuery]);

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      if (filters.problemType !== 'all' && problem.type !== filters.problemType) {
        return false;
      }
      if (filters.problemSeverity !== 'all' && problem.severity !== filters.problemSeverity) {
        return false;
      }
      if (!filters.showResolved && problem.isResolved) {
        return false;
      }
      if (
        searchQuery &&
        !problem.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !problem.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [problems, filters, searchQuery]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <XCircle size={14} className="text-red-500" />;
      case 'warn':
        return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'debug':
        return <Info size={14} className="text-blue-400" />;
      default:
        return <Info size={14} className="text-zinc-400" />;
    }
  };

  const getProblemIcon = (type: NovelProblem['type']) => {
    switch (type) {
      case 'plot_conflict':
        return <AlertCircle size={16} className="text-orange-500" />;
      case 'character_inconsistency':
        return <AlertTriangle size={16} className="text-purple-500" />;
      case 'timeline_issue':
        return <Clock size={16} className="text-blue-500" />;
      case 'foreshadowing':
        return <Zap size={16} className="text-yellow-500" />;
      case 'setting_conflict':
        return <AlertCircle size={16} className="text-red-500" />;
      default:
        return <Info size={16} className="text-zinc-400" />;
    }
  };

  const getSeverityColor = (severity: NovelProblem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'major':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'minor':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    }
  };

  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      logs: logs.slice(-100),
      outputs: outputs.slice(-50),
      problems: problems.slice(-100),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 border-white/5 bg-black/20">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors relative',
                activeTab === tab.id
                  ? 'bg-white/10 text-blue-400'
                  : 'text-zinc-400 hover:bg-white/5'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-zinc-400'
                  )}
                >
                  {tab.badge > 999 ? '999+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/20 border border-white/10">
            <Search size={14} className="text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="bg-transparent border-none outline-none text-sm w-32 text-zinc-300 placeholder:text-zinc-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors',
              showFilters ? 'bg-blue-500 text-white' : 'hover:bg-white/5 text-zinc-400'
            )}
          >
            <Filter size={14} />
            过滤
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors hover:bg-white/5 text-zinc-400"
          >
            <Download size={14} />
            导出
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="px-4 py-2 border-b shrink-0 border-white/5 bg-black/10">
          {activeTab === 'logs' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">级别:</span>
                <select
                  value={filters.logLevel}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, logLevel: e.target.value as LogLevel | 'all' }))
                  }
                  className="px-2 py-1 rounded text-xs bg-black/20 border border-white/10 text-zinc-300"
                >
                  <option value="all">全部</option>
                  {Object.entries(LOG_LEVEL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">来源:</span>
                <select
                  value={filters.logSource}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, logSource: e.target.value as LogSource | 'all' }))
                  }
                  className="px-2 py-1 rounded text-xs bg-black/20 border border-white/10 text-zinc-300"
                >
                  <option value="all">全部</option>
                  {Object.entries(LOG_SOURCE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={clearLogs}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={12} />
                清空日志
              </button>
            </div>
          )}

          {activeTab === 'output' && (
            <div className="flex items-center gap-4">
              <button
                onClick={clearOutputs}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={12} />
                清空输出
              </button>
            </div>
          )}

          {activeTab === 'problems' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">类型:</span>
                <select
                  value={filters.problemType}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      problemType: e.target.value as NovelProblem['type'] | 'all',
                    }))
                  }
                  className="px-2 py-1 rounded text-xs bg-black/20 border border-white/10 text-zinc-300"
                >
                  <option value="all">全部</option>
                  {Object.entries(PROBLEM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">严重程度:</span>
                <select
                  value={filters.problemSeverity}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      problemSeverity: e.target.value as NovelProblem['severity'] | 'all',
                    }))
                  }
                  className="px-2 py-1 rounded text-xs bg-black/20 border border-white/10 text-zinc-300"
                >
                  <option value="all">全部</option>
                  {Object.entries(PROBLEM_SEVERITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.showResolved}
                  onChange={(e) => setFilters((f) => ({ ...f, showResolved: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-zinc-400">显示已解决</span>
              </label>
              <button
                onClick={clearProblems}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors text-red-500 hover:bg-red-500/10"
              >
                <Trash2 size={12} />
                清空问题
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'logs' && (
          <div className="space-y-0.5 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <ScrollText size={32} className="mx-auto mb-2 opacity-30" />
                <p>暂无日志记录</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 py-1 px-2 rounded hover:bg-white/5"
                >
                  <span className="shrink-0 text-zinc-500">{formatTime(log.timestamp)}</span>
                  {getLevelIcon(log.level)}
                  <span className="shrink-0 px-1 rounded text-[10px] bg-white/5 text-zinc-400">
                    {LOG_SOURCE_LABELS[log.source]}
                  </span>
                  <span
                    className={cn(
                      'flex-1',
                      log.level === 'error'
                        ? 'text-red-500'
                        : log.level === 'warn'
                          ? 'text-yellow-500'
                          : 'text-zinc-300'
                    )}
                  >
                    {log.message}
                  </span>
                  {log.details && (
                    <span className="text-[10px] text-zinc-500">{JSON.stringify(log.details)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="space-y-3">
            {filteredOutputs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Cpu size={32} className="mx-auto mb-2 opacity-30" />
                <p>暂无生成记录</p>
              </div>
            ) : (
              filteredOutputs.map((output) => (
                <div
                  key={output.id}
                  className="rounded-lg border overflow-hidden bg-white/5 border-white/10"
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
                    onClick={() =>
                      setExpandedOutput(expandedOutput === output.id ? null : output.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      {output.success ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <div>
                        <div className="font-medium text-sm text-zinc-300">
                          {output.type === 'generate'
                            ? '内容生成'
                            : output.type === 'refine'
                              ? '内容优化'
                              : output.type === 'analyze'
                                ? '内容分析'
                                : '工具调用'}
                        </div>
                        <div className="text-xs mt-0.5 text-zinc-400">{output.summary}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-right text-zinc-500">
                        <div>{formatTime(output.timestamp)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {output.tokenUsage && <span>{output.tokenUsage.total} tokens</span>}
                          <span>{formatDuration(output.duration)}</span>
                        </div>
                      </div>
                      {expandedOutput === output.id ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </div>
                  </div>

                  {expandedOutput === output.id && output.content && (
                    <div className="px-3 pb-3 border-t border-white/5 bg-black/20">
                      <pre className="text-xs whitespace-pre-wrap mt-2 p-2 rounded bg-black/20">
                        {output.content.substring(0, 500)}
                        {output.content.length > 500 && '...'}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="space-y-2">
            {filteredProblems.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500 opacity-50" />
                <p>没有发现小说问题</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-white/5">
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-500">
                      {problemStats.bySeverity.critical || 0}
                    </div>
                    <div className="text-xs text-zinc-400">严重</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-500">
                      {problemStats.bySeverity.major || 0}
                    </div>
                    <div className="text-xs text-zinc-400">重要</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-500">
                      {problemStats.bySeverity.minor || 0}
                    </div>
                    <div className="text-xs text-zinc-400">轻微</div>
                  </div>
                  <div className="flex-1" />
                  <div className="text-right">
                    <div className="text-sm text-zinc-300">
                      共 {problemStats.unresolved} 个未解决问题
                    </div>
                  </div>
                </div>

                {filteredProblems.map((problem) => (
                  <div
                    key={problem.id}
                    className={cn(
                      'rounded-lg border p-4',
                      problem.isResolved
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-white/5 border-white/10'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getProblemIcon(problem.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'font-medium',
                              problem.isResolved ? 'text-green-600 line-through' : 'text-zinc-300'
                            )}
                          >
                            {problem.title}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs border',
                              getSeverityColor(problem.severity)
                            )}
                          >
                            {PROBLEM_SEVERITY_LABELS[problem.severity]}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-zinc-400">
                            {PROBLEM_TYPE_LABELS[problem.type]}
                          </span>
                          {problem.isResolved && (
                            <span className="px-2 py-0.5 rounded text-xs bg-green-500 text-white">
                              已解决
                            </span>
                          )}
                        </div>
                        <div className="text-sm mb-2 text-zinc-400">{problem.description}</div>
                        <div className="flex items-center gap-4">
                          {problem.location && (
                            <div className="text-xs text-zinc-500">
                              {problem.location.chapter && `第${problem.location.chapter}章`}
                              {problem.location.scene && ` · ${problem.location.scene}`}
                              {problem.location.character && ` · ${problem.location.character}`}
                            </div>
                          )}
                          {problem.suggestion && (
                            <div className="text-xs text-blue-400">建议: {problem.suggestion}</div>
                          )}
                        </div>
                      </div>
                      {!problem.isResolved && (
                        <button
                          onClick={() => resolveProblem(problem.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors bg-green-500 text-white hover:bg-green-600"
                        >
                          <Check size={12} />
                          标记解决
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
