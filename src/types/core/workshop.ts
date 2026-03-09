export type WorkshopSkillCategory =
  | 'style'
  | 'structure'
  | 'setting'
  | 'technique'
  | 'workflow'
  | 'review'
  | 'analysis'
  | 'custom';

export interface WorkshopConfig {
  version: string;
  project: {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
  };
  settings: {
    defaultModel: string;
    defaultSkillChain: string[];
    ragEnabled: boolean;
    autoAnalyze: boolean;
    analyzeInterval: number;
    contextWindow: number;
    maxIterations: number;
  };
  /** 技能模板：按类别选中的技能 ID，与 skillStore 共用 */
  selectedSkills?: Record<WorkshopSkillCategory, string | null>;
  /** 已激活的审核员 ID 列表，与 skillStore 共用 */
  activeReviewers?: string[];
  paths: {
    skills: string;
    agents: string;
    knowledge: string;
    memory: string;
    tools: string;
    works: string;
  };
  updatedAt?: number;
}

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: WorkshopSkillCategory | string;
  tags: string[];
  author?: string;
  requires?: string[];
  provides?: string[];
  tools?: string[];
  enabled: boolean;
  priority: number;
}

export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: AgentType;
  triggers: AgentTrigger[];
  tools: string[];
  enabled: boolean;
  priority: number;
}

export type AgentType = 'planner' | 'executor' | 'reviewer' | 'analyzer' | 'custom';

export type AgentTrigger =
  | 'before_generation'
  | 'after_generation'
  | 'on_user_request'
  | 'on_file_change'
  | 'on_schedule';

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'builtin' | 'custom';
  handler: string;
  schema: ToolSchema;
  enabled: boolean;
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

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  relevanceScore: number;
}

export type MemoryType =
  | 'character'
  | 'timeline'
  | 'foreshadowing'
  | 'worldbuilding'
  | 'style_rule'
  | 'lesson_learned'
  | 'user_preference'
  | 'project_summary';

export interface KnowledgeIndex {
  id: string;
  filename: string;
  type: 'novel' | 'reference' | 'style_guide' | 'research';
  chunkCount: number;
  totalTokens: number;
  indexedAt: number;
  metadata: {
    author?: string;
    genre?: string;
    tags?: string[];
  };
}

export interface WorkshopStructure {
  configPath: string;
  skillsPath: string;
  agentsPath: string;
  knowledgePath: string;
  memoryPath: string;
  toolsPath: string;
  worksPath: string;
}

const DEFAULT_SELECTED_SKILLS: Record<WorkshopSkillCategory, string | null> = {
  style: null,
  structure: null,
  setting: null,
  technique: null,
  workflow: null,
  review: null,
  analysis: null,
  custom: null,
};

export const DEFAULT_WORKSHOP_CONFIG: Omit<WorkshopConfig, 'project'> = {
  version: '1.0.0',
  settings: {
    defaultModel: 'gpt-4',
    defaultSkillChain: [],
    ragEnabled: true,
    autoAnalyze: true,
    analyzeInterval: 300000,
    contextWindow: 8000,
    maxIterations: 3,
  },
  selectedSkills: DEFAULT_SELECTED_SKILLS,
  activeReviewers: [],
  paths: {
    skills: '.ai-workshop/skills',
    agents: '.ai-workshop/agents',
    knowledge: '.ai-workshop/knowledge',
    memory: '.ai-workshop/memory',
    tools: '.ai-workshop/tools',
    works: 'works',
  },
};

export const WORKSHOP_DIRS = [
  '.ai-workshop',
  '.ai-workshop/skills',
  '.ai-workshop/skills/system',
  '.ai-workshop/skills/user',
  '.ai-workshop/agents',
  '.ai-workshop/agents/system',
  '.ai-workshop/agents/user',
  '.ai-workshop/knowledge',
  '.ai-workshop/knowledge/files',
  '.ai-workshop/knowledge/chunks',
  '.ai-workshop/memory',
  '.ai-workshop/tools',
  '.ai-workshop/tools/custom',
  'works',
  'works/outline',
  'works/characters',
  'works/chapters',
  'works/settings',
];
