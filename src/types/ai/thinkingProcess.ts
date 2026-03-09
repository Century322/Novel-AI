export type ThinkingStepType =
  | 'thinking'
  | 'analyzing'
  | 'searching'
  | 'reading'
  | 'planning'
  | 'executing'
  | 'tool_call'
  | 'writing'
  | 'reviewing'
  | 'completed'
  | 'error';

export interface ThinkingStep {
  id: string;
  type: ThinkingStepType;
  title: string;
  description?: string;
  details?: string;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  subSteps?: ThinkingStep[];
  metadata?: Record<string, unknown>;
}

export interface ThinkingProcess {
  steps: ThinkingStep[];
  currentStepIndex: number;
  totalDuration: number;
  startTime: number;
  endTime?: number;
}

export const THINKING_STEP_CONFIG: Record<
  ThinkingStepType,
  {
    icon: string;
    label: string;
    color: string;
  }
> = {
  thinking: { icon: '🤔', label: '思考中', color: 'text-purple-400' },
  analyzing: { icon: '🔍', label: '分析中', color: 'text-blue-400' },
  searching: { icon: '🔎', label: '查找中', color: 'text-cyan-400' },
  reading: { icon: '📖', label: '阅读中', color: 'text-green-400' },
  planning: { icon: '📋', label: '规划中', color: 'text-yellow-400' },
  executing: { icon: '⚡', label: '执行中', color: 'text-orange-400' },
  tool_call: { icon: '🔧', label: '调用工具', color: 'text-indigo-400' },
  writing: { icon: '✍️', label: '写作中', color: 'text-pink-400' },
  reviewing: { icon: '👁️', label: '审核中', color: 'text-amber-400' },
  completed: { icon: '✅', label: '完成', color: 'text-green-500' },
  error: { icon: '❌', label: '错误', color: 'text-red-500' },
};
