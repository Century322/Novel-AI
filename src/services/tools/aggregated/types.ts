import { ToolDefinition, ToolHandler } from '../toolRegistry';

export interface AggregatedToolDefinition extends ToolDefinition {
  handler: ToolHandler;
}

export type FileOpsAction = 'read' | 'write' | 'delete' | 'list' | 'search' | 'tree' | 'stats' | 'chapters';

export interface FileOpsArgs {
  action: FileOpsAction;
  path?: string;
  content?: string;
  recursive?: boolean;
  query?: string;
  maxResults?: number;
}

export type KnowledgeOpsAction = 'list' | 'search' | 'get' | 'read';

export interface KnowledgeOpsArgs {
  action: KnowledgeOpsAction;
  query?: string;
  file?: string;
  filename?: string;
  maxResults?: number;
}

export interface ProjectContextArgs {
  type: 'tree' | 'stats' | 'chapters';
}

export type StoryQueryType = 'character' | 'plot' | 'timeline' | 'world' | 'foreshadowing' | 'context' | 'guide' | 'style';

export interface StoryQueryArgs {
  type: StoryQueryType;
  id?: string;
  scope?: string;
}

export type StoryUpdateType = 'character' | 'plot' | 'timeline' | 'foreshadowing' | 'world' | 'timeline_event';
export type StoryUpdateAction = 'add' | 'update' | 'remove' | 'upsert' | 'build';

export interface StoryUpdateArgs {
  type: StoryUpdateType;
  action: StoryUpdateAction;
  data: Record<string, unknown>;
}

export type StoryGraphType = 'character_relations' | 'plot_dependencies' | 'timeline_flow';

export interface StoryGraphArgs {
  type: StoryGraphType;
  id?: string;
}

export type StorySummaryScope = 'chapter' | 'arc' | 'full';

export interface StoryStateSummaryArgs {
  scope: StorySummaryScope;
  chapterId?: string;
}

export type GenerateContentType = 'scene' | 'dialogue' | 'description' | 'chapter' | 'revise';

export interface GenerateContentArgs {
  type: GenerateContentType;
  prompt: string;
  constraints?: {
    style?: string;
    perspective?: string;
    length?: number;
    characters?: string[];
  };
}

export interface ContinueWritingArgs {
  text: string;
  style?: string;
  length?: number;
}

export type StyleOpsAction = 'learn' | 'analyze' | 'apply' | 'add_reference' | 'extract';

export interface StyleOpsArgs {
  action: StyleOpsAction;
  text?: string;
  style?: string;
  passage?: string;
}

export type StoryAnalysisType = 'quality' | 'structure' | 'consistency' | 'emotion' | 'pacing' | 'foreshadowing' | 'validation';

export interface StoryAnalysisArgs {
  type: StoryAnalysisType;
  text: string;
  scope?: 'paragraph' | 'scene' | 'chapter';
}

export type ReaderType = 'casual' | 'hardcore' | 'editor';

export interface ReaderSimulationArgs {
  text: string;
  reader_type?: ReaderType;
}

export interface ToolResult {
  toolCallId?: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
