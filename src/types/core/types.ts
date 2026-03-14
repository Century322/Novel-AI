export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

export interface SimpleAgentConfig {
  enabled: boolean;
  maxIterations: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'reviewer';
  content: string;
  timestamp: number;
  metadata?: {
    type?: 'draft' | 'critique' | 'plan';
    reviewerName?: string;
    status?: 'pending_approval' | 'approved' | 'rejected';
  };
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  workspace: FileNode[];
  knowledgeBase: FileNode[];
  createdAt: number;
}

export interface Task {
  id: string;
  type: 'generate' | 'refine' | 'critique' | 'batch_generate';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  result?: string;
  error?: string;
  progress?: number;
  createdAt: number;
}

export type SkillType = 'style' | 'structure' | 'setting' | 'technique' | 'workflow' | 'review';

export type SkillCategory =
  | 'style'
  | 'outline'
  | 'chapter'
  | 'volume'
  | 'character'
  | 'worldbuilding'
  | 'faction'
  | 'dialogue'
  | 'pacing'
  | 'climax'
  | 'foreshadowing'
  | 'description'
  | 'opening'
  | 'ending'
  | 'revision'
  | 'custom';

export interface StyleConfig {
  pace: string;
  hooks: string[];
  sentenceStyle: string;
  forbidden: string[];
  dialogueStyle?: string;
  descriptionStyle?: string;
}

export interface StructureConfig {
  opening: string;
  development: string;
  climax: string;
  ending: string;
  chapterTemplate?: string;
  volumeTemplate?: string;
}

export interface SettingConfig {
  template: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'multiselect';
    options?: string[];
    required?: boolean;
    placeholder?: string;
  }>;
  outputFormat: string;
}

export interface TechniqueConfig {
  name: string;
  description: string;
  examples: string[];
  rules: string[];
  triggers?: string[];
}

export interface WorkflowConfig {
  steps: Array<{
    id: string;
    name: string;
    description: string;
    prompt: string;
    outputType: 'file' | 'text' | 'analysis';
    outputPath?: string;
  }>;
  autoSave: boolean;
  requireApproval: boolean;
}

export interface ReviewConfig {
  dimensions: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
    criteria: string[];
  }>;
  scoring: {
    enabled: boolean;
    maxScore: number;
    passingScore: number;
  };
  outputFormat: 'report' | 'scorecard' | 'inline';
}

export interface WordCountConfig {
  chapterMin: number;
  chapterMax: number;
  totalTarget: number;
}

export interface SkillBase {
  id: string;
  name: string;
  type: SkillType;
  category: SkillCategory;
  description: string;
  isCustom?: boolean;
  tags?: string[];
  author?: string;
  version?: string;
}

export interface StyleSkill extends SkillBase {
  type: 'style';
  platform: string;
  genre: string;
  config: {
    style: StyleConfig;
    structure: StructureConfig;
    wordCount: WordCountConfig;
  };
}

export interface StructureSkill extends SkillBase {
  type: 'structure';
  config: {
    structure: StructureConfig;
    wordCount?: WordCountConfig;
  };
}

export interface SettingSkill extends SkillBase {
  type: 'setting';
  config: SettingConfig;
}

export interface TechniqueSkill extends SkillBase {
  type: 'technique';
  config: TechniqueConfig;
}

export interface WorkflowSkill extends SkillBase {
  type: 'workflow';
  config: WorkflowConfig;
}

export interface ReviewSkill extends SkillBase {
  type: 'review';
  config: ReviewConfig;
}

export type Skill =
  | StyleSkill
  | StructureSkill
  | SettingSkill
  | TechniqueSkill
  | WorkflowSkill
  | ReviewSkill;

export interface SkillGroup {
  type: SkillType;
  label: string;
  icon: string;
  description: string;
  skills: Skill[];
}

export interface ProjectState {
  knowledgeBase: FileNode[];
  outputWorkspace: FileNode[];
  sessions: ChatSession[];
  currentSessionId: string;
  selectedFileId: string | null;
  isProcessing: boolean;
  agentConfig?: SimpleAgentConfig;
  tasks: Task[];
}

export interface ApiKey {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  isEnabled: boolean;
  isValidating?: boolean;
  createdAt: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

export type AIProvider =
  | 'gateway'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'alibaba'
  | 'bytedance'
  | 'deepseek'
  | 'minimax'
  | 'moonshot'
  | 'vercel'
  | 'xai'
  | 'zai';

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  npmPackage?: string;
  requiresApiKey: boolean;
  gatewayOnly?: boolean;
  models: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  contextLength?: number;
  isFree?: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
}
