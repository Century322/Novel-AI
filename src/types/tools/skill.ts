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

export interface SkillPrompt {
  system: string;
  userTemplate?: string;
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

export interface SkillOutput {
  format: 'text' | 'json' | 'markdown';
  schema?: Record<string, unknown>;
  template?: string;
}

export interface SkillChain {
  before?: string[];
  after?: string[];
  parallel?: string[];
}

export interface SkillKnowledge {
  required?: string[];
  optional?: string[];
  autoIngest?: boolean;
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

export interface SkillReviewer {
  id: string;
  name: string;
  prompt: string;
  weight: number;
  isActive: boolean;
}

export interface ProjectAnalysis {
  characters: CharacterInfo[];
  timeline: TimelineEvent[];
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

export interface TimelineEvent {
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
