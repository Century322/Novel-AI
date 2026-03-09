export { LongTermMemoryService, createLongTermMemoryService } from './longTermMemoryService';
export type {
  PreferenceCategory,
  PreferencePriority,
  ExtractedPreference,
  ConversationMemory,
  LongTermMemory,
  LearnedPattern,
} from './longTermMemoryService';

export { ChapterSummaryService, createChapterSummaryService } from './chapterSummaryService';
export type {
  ChapterSummary,
  KeyEvent,
  CharacterAppearance,
  ForeshadowingActivity,
  EmotionalArc,
  PlotProgress,
  SummaryOptions,
} from './chapterSummaryService';

export { ContextCompressionService } from '../knowledge/contextCompressionService';
export type { CompressionOptions, CompressedContext } from '../knowledge/contextCompressionService';
