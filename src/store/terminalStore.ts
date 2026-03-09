import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'system' | 'ai' | 'tool' | 'api' | 'user';

export interface TerminalLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: Record<string, unknown>;
}

export interface GenerationOutput {
  id: string;
  timestamp: number;
  type: 'generate' | 'refine' | 'analyze' | 'tool';
  summary: string;
  content?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
  model?: string;
  success: boolean;
}

export interface NovelProblem {
  id: string;
  timestamp: number;
  type:
    | 'plot_conflict'
    | 'character_inconsistency'
    | 'timeline_issue'
    | 'foreshadowing'
    | 'setting_conflict'
    | 'style_issue'
    | 'other';
  severity: 'critical' | 'major' | 'minor';
  title: string;
  description: string;
  location?: {
    chapter?: number;
    scene?: string;
    character?: string;
  };
  suggestion?: string;
  isResolved: boolean;
  resolvedAt?: number;
}

export interface ToolCallRecord {
  id: string;
  timestamp: number;
  toolName: string;
  toolType: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  success: boolean;
  duration: number;
  error?: string;
}

interface TerminalState {
  logs: TerminalLog[];
  outputs: GenerationOutput[];
  problems: NovelProblem[];
  toolCalls: ToolCallRecord[];

  maxLogs: number;
  maxOutputs: number;
  maxProblems: number;
}

interface TerminalActions {
  addLog: (log: Omit<TerminalLog, 'id' | 'timestamp'>) => void;
  addOutput: (output: Omit<GenerationOutput, 'id' | 'timestamp'>) => void;
  addProblem: (problem: Omit<NovelProblem, 'id' | 'timestamp' | 'isResolved'>) => void;
  addToolCall: (toolCall: Omit<ToolCallRecord, 'id' | 'timestamp'>) => void;

  resolveProblem: (id: string) => void;

  clearLogs: () => void;
  clearOutputs: () => void;
  clearProblems: () => void;
  clearAll: () => void;

  getLogsByLevel: (level: LogLevel) => TerminalLog[];
  getLogsBySource: (source: LogSource) => TerminalLog[];
  getProblemsByType: (type: NovelProblem['type']) => NovelProblem[];
  getProblemsBySeverity: (severity: NovelProblem['severity']) => NovelProblem[];
  getUnresolvedProblems: () => NovelProblem[];

  getProblemStats: () => {
    total: number;
    unresolved: number;
    byType: Record<NovelProblem['type'], number>;
    bySeverity: Record<NovelProblem['severity'], number>;
  };

  getRecentLogs: (count?: number) => TerminalLog[];
  getRecentOutputs: (count?: number) => GenerationOutput[];
}

type TerminalStore = TerminalState & TerminalActions;

const initialState: TerminalState = {
  logs: [],
  outputs: [],
  problems: [],
  toolCalls: [],
  maxLogs: 1000,
  maxOutputs: 100,
  maxProblems: 500,
};

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addLog: (log) => {
        const newLog: TerminalLog = {
          id: uuidv4(),
          timestamp: Date.now(),
          ...log,
        };
        set((state) => ({
          logs: [...state.logs.slice(-state.maxLogs + 1), newLog],
        }));
      },

      addOutput: (output) => {
        const newOutput: GenerationOutput = {
          id: uuidv4(),
          timestamp: Date.now(),
          ...output,
        };
        set((state) => ({
          outputs: [...state.outputs.slice(-state.maxOutputs + 1), newOutput],
        }));
      },

      addProblem: (problem) => {
        const newProblem: NovelProblem = {
          id: uuidv4(),
          timestamp: Date.now(),
          isResolved: false,
          ...problem,
        };
        set((state) => ({
          problems: [...state.problems.slice(-state.maxProblems + 1), newProblem],
        }));
      },

      addToolCall: (toolCall) => {
        const newToolCall: ToolCallRecord = {
          id: uuidv4(),
          timestamp: Date.now(),
          ...toolCall,
        };
        set((state) => ({
          toolCalls: [...state.toolCalls, newToolCall].slice(-100),
        }));

        get().addLog({
          level: toolCall.success ? 'info' : 'error',
          source: 'tool',
          message: toolCall.success
            ? `工具调用成功: ${toolCall.toolName}`
            : `工具调用失败: ${toolCall.toolName} - ${toolCall.error}`,
          details: {
            toolName: toolCall.toolName,
            toolType: toolCall.toolType,
            duration: toolCall.duration,
          },
        });
      },

      resolveProblem: (id) => {
        set((state) => ({
          problems: state.problems.map((p) =>
            p.id === id ? { ...p, isResolved: true, resolvedAt: Date.now() } : p
          ),
        }));
      },

      clearLogs: () => set({ logs: [] }),
      clearOutputs: () => set({ outputs: [] }),
      clearProblems: () => set({ problems: [] }),
      clearAll: () => set({ logs: [], outputs: [], problems: [], toolCalls: [] }),

      getLogsByLevel: (level) => get().logs.filter((l) => l.level === level),
      getLogsBySource: (source) => get().logs.filter((l) => l.source === source),
      getProblemsByType: (type) => get().problems.filter((p) => p.type === type),
      getProblemsBySeverity: (severity) => get().problems.filter((p) => p.severity === severity),
      getUnresolvedProblems: () => get().problems.filter((p) => !p.isResolved),

      getProblemStats: () => {
        const problems = get().problems;
        const unresolved = problems.filter((p) => !p.isResolved);

        const byType: Record<NovelProblem['type'], number> = {
          plot_conflict: 0,
          character_inconsistency: 0,
          timeline_issue: 0,
          foreshadowing: 0,
          setting_conflict: 0,
          style_issue: 0,
          other: 0,
        };

        const bySeverity: Record<NovelProblem['severity'], number> = {
          critical: 0,
          major: 0,
          minor: 0,
        };

        for (const p of unresolved) {
          byType[p.type]++;
          bySeverity[p.severity]++;
        }

        return {
          total: problems.length,
          unresolved: unresolved.length,
          byType,
          bySeverity,
        };
      },

      getRecentLogs: (count = 50) => get().logs.slice(-count),
      getRecentOutputs: (count = 10) => get().outputs.slice(-count),
    }),
    {
      name: 'terminal-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        logs: state.logs.slice(-100),
        outputs: state.outputs.slice(-20),
        problems: state.problems.filter((p) => !p.isResolved),
        toolCalls: state.toolCalls.slice(-20),
      }),
    }
  )
);

export const PROBLEM_TYPE_LABELS: Record<NovelProblem['type'], string> = {
  plot_conflict: '情节矛盾',
  character_inconsistency: '人物不一致',
  timeline_issue: '时间线问题',
  foreshadowing: '伏笔问题',
  setting_conflict: '设定冲突',
  style_issue: '风格问题',
  other: '其他问题',
};

export const PROBLEM_SEVERITY_LABELS: Record<NovelProblem['severity'], string> = {
  critical: '严重',
  major: '重要',
  minor: '轻微',
};

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  debug: '调试',
  info: '信息',
  warn: '警告',
  error: '错误',
};

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  system: '系统',
  ai: 'AI',
  tool: '工具',
  api: 'API',
  user: '用户',
};
