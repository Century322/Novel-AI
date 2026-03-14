export type SkillCategoryType =
  | 'style'
  | 'structure'
  | 'setting'
  | 'technique'
  | 'workflow'
  | 'review'
  | 'analysis'
  | 'custom';

export interface SkillMeta {
  id: string;
  name: string;
  version: string;
  author?: string;
  description: string;
  category: SkillCategoryType;
  tags: string[];
}

export interface SkillVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  options?: string[];
}

export interface SkillPrompt {
  system: string;
  userTemplate?: string;
  variables?: SkillVariable[];
  examples?: string[];
}

export interface SkillTool {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: string;
      description: string;
      required: boolean;
    }
  >;
}

export interface SkillExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface SkillOutput {
  format: 'text' | 'json' | 'markdown' | 'files';
  schema?: Record<string, unknown>;
  template?: string;
  validate?: string;
}

export interface SkillChain {
  before?: string[];
  after?: string[];
  parallel?: string[];
  fallback?: string;
}

export interface SkillKnowledge {
  required?: string[];
  optional?: string[];
  autoIngest?: boolean;
}

export interface SkillReviewer {
  id: string;
  name: string;
  prompt: string;
  weight: number;
  isActive: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategoryType;
  tags: string[];
  author?: string;

  requires?: string[];
  provides?: string[];
  conflicts?: string[];

  tools?: string[];

  enabled: boolean;
  priority: number;

  prompt: SkillPrompt;

  examples?: SkillExample[];

  chain?: SkillChain;

  output?: SkillOutput;

  reviewers?: SkillReviewer[];
}

export interface SkillFile {
  meta: SkillMeta;
  prompt: SkillPrompt;
  tools?: SkillTool[];
  output?: SkillOutput;
  chain?: SkillChain;
  knowledge?: SkillKnowledge;
  reviewers?: SkillReviewer[];
  rawContent: string;
  filePath: string;
}

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: SkillCategoryType;
  template: string;
  variables: SkillVariable[];
}

export interface SkillExecutionContext {
  skillId: string;
  variables: Record<string, unknown>;
  input: string;
  history: Array<{
    skillId: string;
    input: string;
    output: string;
    timestamp: number;
  }>;
  projectPath: string;
  memory: Record<string, unknown>;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  output: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  metadata?: Record<string, unknown>;
  error?: string;
  duration: number;
}

export interface ProjectAnalysis {
  characters: CharacterInfo[];
  timeline: SkillTimelineEvent[];
  foreshadowing: ForeshadowingItem[];
  worldbuilding: WorldbuildingInfo;
  lastAnalyzed: number;
}

export interface CharacterInfo {
  id: string;
  name: string;
  aliases: string[];
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  traits: string[];
  relationships: Array<{ target: string; relation: string }>;
  firstAppear: string;
  lastMention: string;
}

export interface SkillTimelineEvent {
  id: string;
  chapter: string;
  time: string;
  event: string;
  characters: string[];
  importance: 'major' | 'minor';
}

export interface ForeshadowingItem {
  id: string;
  content: string;
  plantedAt: string;
  resolvedAt?: string;
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned';
  relatedCharacters: string[];
}

export interface WorldbuildingInfo {
  setting: string;
  rules: string[];
  locations: Array<{ name: string; description: string }>;
  factions: Array<{ name: string; description: string; members: string[] }>;
  magicSystem?: string;
  technology?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  selectedSkills: Record<SkillCategoryType, string | null>;
  activeReviewers: string[];
  knowledgeFiles: KnowledgeFile[];
  settings: {
    autoAnalyze: boolean;
    analyzeInterval: number;
    contextWindow: number;
  };
}

export interface KnowledgeFile {
  id: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: number;
  type: 'reference' | 'style' | 'template' | 'research';
  tags: string[];
}

export const SKILL_CATEGORY_CONFIG: Record<
  SkillCategoryType,
  {
    label: string;
    icon: string;
    color: string;
    description: string;
  }
> = {
  style: {
    label: '风格模板',
    icon: 'palette',
    color: 'purple',
    description: '定义写作风格、语言风格、叙事风格',
  },
  structure: {
    label: '结构模板',
    icon: 'layout',
    color: 'blue',
    description: '定义故事结构、章节结构、情节结构',
  },
  setting: {
    label: '设定模板',
    icon: 'settings',
    color: 'green',
    description: '定义人物设定、世界观设定、势力设定',
  },
  technique: {
    label: '技巧模板',
    icon: 'zap',
    color: 'yellow',
    description: '定义写作技巧、爽点设计、伏笔技巧',
  },
  workflow: {
    label: '工作流程',
    icon: 'workflow',
    color: 'orange',
    description: '定义创作流程、审核流程、发布流程',
  },
  review: {
    label: '审核模板',
    icon: 'check-circle',
    color: 'red',
    description: '定义审核规则、评分标准、修改建议',
  },
  analysis: {
    label: '分析模板',
    icon: 'analytics',
    color: 'cyan',
    description: '定义分析规则、提取规则、统计规则',
  },
  custom: {
    label: '自定义',
    icon: 'custom',
    color: 'gray',
    description: '用户自定义的模板类型',
  },
};

export const DEFAULT_SKILL_VARIABLES: SkillVariable[] = [
  {
    name: 'chapter',
    type: 'number',
    description: '章节编号',
    required: false,
  },
  {
    name: 'title',
    type: 'string',
    description: '章节标题',
    required: false,
  },
  {
    name: 'characters',
    type: 'array',
    description: '涉及的人物列表',
    required: false,
  },
  {
    name: 'context',
    type: 'string',
    description: '上下文信息',
    required: false,
  },
  {
    name: 'style',
    type: 'string',
    description: '风格要求',
    required: false,
  },
];
