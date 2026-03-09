export type TaskAction =
  | 'create_project'
  | 'create_directory'
  | 'generate_world'
  | 'generate_character'
  | 'generate_outline'
  | 'generate_chapter'
  | 'generate_scene'
  | 'write_file'
  | 'read_file'
  | 'modify_file'
  | 'analyze_content'
  | 'check_consistency'
  | 'learn_style'
  | 'chat'
  | 'custom';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TaskStep {
  id: string;
  action: TaskAction;
  description: string;
  input: Record<string, unknown>;
  output?: unknown;
  dependencies: string[];
  status: TaskStatus;
  priority: TaskPriority;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
}

export interface TaskPlan {
  id: string;
  goal: string;
  originalInput: string;
  steps: TaskStep[];
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata: {
    projectPath: string;
    sessionId: string;
    estimatedDuration?: number;
    totalSteps: number;
    completedSteps: number;
  };
}

export interface TaskNode {
  step: TaskStep;
  children: string[];
  parents: string[];
  level: number;
}

export interface TaskGraph {
  planId: string;
  nodes: Map<string, TaskNode>;
  adjacencyList: Map<string, string[]>;
  reverseAdjacencyList: Map<string, string[]>;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
}

export interface ProjectContext {
  projectPath: string;
  hasProject: boolean;
  hasWorld: boolean;
  hasCharacters: boolean;
  hasOutline: boolean;
  chapterCount: number;
  characterCount: number;
  existingFiles: string[];
  recentActivity?: string;
}

export interface PlannerInput {
  userGoal: string;
  context: ProjectContext;
  preferences?: {
    style?: string;
    genre?: string;
    targetLength?: number;
    chapterLength?: number;
  };
}

export interface PlannerOutput {
  plan: TaskPlan;
  reasoning: string;
  estimatedSteps: number;
  warnings?: string[];
}

export const TASK_ACTION_CONFIG: Record<
  TaskAction,
  {
    label: string;
    description: string;
    category: 'creation' | 'modification' | 'analysis' | 'management' | 'communication';
    defaultPriority: TaskPriority;
    requiresProject: boolean;
    estimatedTime: number;
  }
> = {
  create_project: {
    label: '创建项目',
    description: '创建新的小说项目结构',
    category: 'creation',
    defaultPriority: 'critical',
    requiresProject: false,
    estimatedTime: 5000,
  },
  create_directory: {
    label: '创建目录',
    description: '创建文件夹结构',
    category: 'management',
    defaultPriority: 'high',
    requiresProject: true,
    estimatedTime: 1000,
  },
  generate_world: {
    label: '生成世界观',
    description: '生成小说世界观设定',
    category: 'creation',
    defaultPriority: 'high',
    requiresProject: true,
    estimatedTime: 30000,
  },
  generate_character: {
    label: '生成角色',
    description: '生成小说角色设定',
    category: 'creation',
    defaultPriority: 'high',
    requiresProject: true,
    estimatedTime: 20000,
  },
  generate_outline: {
    label: '生成大纲',
    description: '生成小说大纲',
    category: 'creation',
    defaultPriority: 'high',
    requiresProject: true,
    estimatedTime: 25000,
  },
  generate_chapter: {
    label: '生成章节',
    description: '生成小说章节内容',
    category: 'creation',
    defaultPriority: 'medium',
    requiresProject: true,
    estimatedTime: 60000,
  },
  generate_scene: {
    label: '生成场景',
    description: '生成特定场景内容',
    category: 'creation',
    defaultPriority: 'medium',
    requiresProject: true,
    estimatedTime: 30000,
  },
  write_file: {
    label: '写入文件',
    description: '写入内容到文件',
    category: 'modification',
    defaultPriority: 'medium',
    requiresProject: true,
    estimatedTime: 2000,
  },
  read_file: {
    label: '读取文件',
    description: '读取文件内容',
    category: 'management',
    defaultPriority: 'low',
    requiresProject: true,
    estimatedTime: 1000,
  },
  modify_file: {
    label: '修改文件',
    description: '修改已有文件内容',
    category: 'modification',
    defaultPriority: 'medium',
    requiresProject: true,
    estimatedTime: 5000,
  },
  analyze_content: {
    label: '分析内容',
    description: '分析小说内容质量',
    category: 'analysis',
    defaultPriority: 'low',
    requiresProject: true,
    estimatedTime: 15000,
  },
  check_consistency: {
    label: '检查一致性',
    description: '检查内容一致性',
    category: 'analysis',
    defaultPriority: 'low',
    requiresProject: true,
    estimatedTime: 10000,
  },
  learn_style: {
    label: '学习风格',
    description: '学习写作风格',
    category: 'analysis',
    defaultPriority: 'low',
    requiresProject: false,
    estimatedTime: 20000,
  },
  chat: {
    label: '对话',
    description: '与用户对话交流',
    category: 'communication',
    defaultPriority: 'medium',
    requiresProject: false,
    estimatedTime: 5000,
  },
  custom: {
    label: '自定义任务',
    description: '自定义任务类型',
    category: 'creation',
    defaultPriority: 'medium',
    requiresProject: false,
    estimatedTime: 10000,
  },
};

export function createTaskStep(
  action: TaskAction,
  description: string,
  input: Record<string, unknown> = {},
  options: {
    dependencies?: string[];
    priority?: TaskPriority;
    maxRetries?: number;
  } = {}
): TaskStep {
  const config = TASK_ACTION_CONFIG[action];
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    action,
    description,
    input,
    dependencies: options.dependencies || [],
    status: 'pending',
    priority: options.priority || config.defaultPriority,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
  };
}

export function createTaskPlan(
  goal: string,
  originalInput: string,
  steps: TaskStep[],
  projectPath: string,
  sessionId: string
): TaskPlan {
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    goal,
    originalInput,
    steps,
    status: 'pending',
    createdAt: Date.now(),
    metadata: {
      projectPath,
      sessionId,
      totalSteps: steps.length,
      completedSteps: 0,
    },
  };
}
