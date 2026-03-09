import { AgentType, AgentTrigger } from '@/types/core/workshop';

export interface AgentDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  type: AgentType;

  prompt: AgentPrompt;

  triggers: AgentTriggerConfig[];

  tools: string[];

  enabled: boolean;
  priority: number;

  maxIterations: number;
  timeout: number;

  outputFormat: AgentOutputFormat;

  hooks?: AgentHooks;

  metadata?: Record<string, unknown>;
}

export interface AgentPrompt {
  system: string;
  userTemplate?: string;
  variables?: AgentVariable[];
}

export interface AgentVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface AgentTriggerConfig {
  type: AgentTrigger;
  condition?: string;
  priority?: number;
}

export interface AgentOutputFormat {
  type: 'text' | 'json' | 'markdown' | 'structured';
  schema?: Record<string, unknown>;
  template?: string;
}

export interface AgentHooks {
  beforeExecute?: string;
  afterExecute?: string;
  onError?: string;
  onSuccess?: string;
}

export interface AgentExecutionContext {
  agentId: string;
  input: string;
  variables: Record<string, unknown>;
  history: AgentExecutionHistory[];
  projectPath: string;
  memory: Record<string, unknown>;
  tools: Record<string, ToolHandler>;
}

export interface AgentExecutionHistory {
  agentId: string;
  input: string;
  output: string;
  success: boolean;
  timestamp: number;
  duration: number;
}

export interface AgentExecutionResult {
  agentId: string;
  success: boolean;
  output: string;
  structuredOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
  duration: number;
  iterations: number;
}

export interface ToolHandler {
  name: string;
  description: string;
  handler: (params: Record<string, unknown>, context: AgentExecutionContext) => Promise<unknown>;
  schema: ToolSchema;
}

export interface ToolSchema {
  input: Record<string, ToolParameter>;
  output: Record<string, ToolParameter>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface AgentPlan {
  id: string;
  agentId: string;
  steps: PlanStep[];
  createdAt: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface PlanStep {
  id: string;
  type: 'call_agent' | 'use_tool' | 'call_skill' | 'wait' | 'condition';
  target: string;
  input?: string;
  condition?: string;
  onSuccess?: string;
  onFailure?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
}

export const AGENT_TYPE_CONFIG: Record<
  AgentType,
  {
    label: string;
    icon: string;
    color: string;
    description: string;
  }
> = {
  planner: {
    label: '规划器',
    icon: 'brain',
    color: 'blue',
    description: '负责任务分解和规划',
  },
  executor: {
    label: '执行器',
    icon: 'play',
    color: 'green',
    description: '负责执行具体任务',
  },
  reviewer: {
    label: '审核员',
    icon: 'check-circle',
    color: 'red',
    description: '负责审核和评估输出',
  },
  analyzer: {
    label: '分析器',
    icon: 'analytics',
    color: 'cyan',
    description: '负责分析和提取信息',
  },
  custom: {
    label: '自定义',
    icon: 'custom',
    color: 'gray',
    description: '用户自定义的Agent类型',
  },
};

export const TRIGGER_CONFIG: Record<
  AgentTrigger,
  {
    label: string;
    description: string;
  }
> = {
  before_generation: {
    label: '生成前',
    description: '在内容生成前触发',
  },
  after_generation: {
    label: '生成后',
    description: '在内容生成后触发',
  },
  on_user_request: {
    label: '用户请求时',
    description: '当用户明确请求时触发',
  },
  on_file_change: {
    label: '文件变更时',
    description: '当文件发生变化时触发',
  },
  on_schedule: {
    label: '定时触发',
    description: '按计划定时触发',
  },
};
