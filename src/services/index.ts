export { llmService } from './ai/llmService';
export { workshopService } from './core/workshopService';
export { skillService } from './tools/skillService';
export { fileSystemService } from './core/fileSystemService';
export { logger } from './core/loggerService';

export { embeddingService, EmbeddingService } from './retrieval/embeddingService';
export { vectorStoreService, VectorStoreService } from './retrieval/vectorStoreService';
export { storyStateManager, StoryStateManager } from './narrative/storyStateManager';
export { narrativeEngine, NarrativeEngine } from './narrative/narrativeEngine';
export { narrativeContextService, NarrativeContextService } from './narrative/narrativeContextService';
export { consistencyChecker, ConsistencyChecker } from './narrative/consistencyChecker';

export {
  IntentUnderstandingService,
  createIntentUnderstandingService,
} from './ai/intentUnderstandingService';
export { InfoExtractionService } from './analysis/infoExtractionService';
export { CreationFlowService } from './writing/creationFlowService';
export { NovelTypeService } from './analysis/novelTypeService';
export { PlotNodeService } from './plot/plotNodeService';
export { ForeshadowingService } from './plot/foreshadowingService';
export { CharacterService } from './character/characterService';
export { StyleLearningService } from './style/styleLearningService';
export { TimelineService } from './plot/timelineService';
export { ReminderService } from './writing/reminderService';

export {
  AuthorStyleLearningService,
  createAuthorStyleLearningService,
} from './style/authorStyleLearningService';
export {
  DeepStyleLearningService,
  createDeepStyleLearningService,
} from './style/deepStyleLearningService';
export { ContextCompressionService } from './knowledge/contextCompressionService';
export { DocumentGeneratorService } from './writing/documentGeneratorService';
export { CreativeIntentService } from './ai/creativeIntentService';

export { ToolChainService, createToolChainService } from './tools/toolChainService';
export {
  ConflictDetectionService,
  createConflictDetectionService,
} from './plot/conflictDetectionService';
export {
  ExtendedTimelineService,
  createExtendedTimelineService,
} from './plot/extendedTimelineService';
export {
  SubplotManagementService,
  createSubplotManagementService,
} from './plot/subplotManagementService';
export { CharacterArcService, createCharacterArcService } from './character/characterArcService';
export { ArtisticStyleService, createArtisticStyleService } from './style/artisticStyleService';
export { SmartReminderService, createSmartReminderService } from './writing/smartReminderService';
export {
  QualityAssessmentService,
  createQualityAssessmentService,
} from './analysis/qualityAssessmentService';
export {
  IterationOptimizationService,
  createIterationOptimizationService,
} from './analysis/iterationOptimizationService';

export {
  ParallelVisualizationService,
  createParallelVisualizationService,
} from './plot/parallelVisualizationService';
export {
  PerspectiveSwitchService,
  createPerspectiveSwitchService,
} from './writing/perspectiveSwitchService';
export {
  BehaviorConsistencyService,
  createBehaviorConsistencyService,
} from './character/behaviorConsistencyService';
export {
  EmotionAuthenticityService,
  createEmotionAuthenticityService,
} from './character/emotionAuthenticityService';
export {
  StyleInternalizationService,
  createStyleInternalizationService,
} from './style/styleInternalizationService';
export {
  ReaderPerspectiveService,
  createReaderPerspectiveService,
} from './writing/readerPerspectiveService';

export { WritingGuideService, createWritingGuideService } from './writing/writingGuideService';

export { MemoryService } from './knowledge/memoryService';
export { KnowledgeService } from './knowledge/knowledgeService';
export { QualityService } from './analysis/qualityService';
export { AgentEngine } from './ai/agentEngine';
export { ToolRegistry, createToolRegistry } from './tools/toolRegistry';

export { OptimizationService } from './analysis/optimizationService';
export { VersionService } from './core/versionService';
export { DistillationService } from './ai/distillationService';

import {
  IntentUnderstandingService,
  createIntentUnderstandingService,
} from './ai/intentUnderstandingService';
import { InfoExtractionService } from './analysis/infoExtractionService';
import { CreationFlowService } from './writing/creationFlowService';
import { NovelTypeService } from './analysis/novelTypeService';
import { PlotNodeService } from './plot/plotNodeService';
import { ForeshadowingService } from './plot/foreshadowingService';
import { CharacterService } from './character/characterService';
import { StyleLearningService } from './style/styleLearningService';
import { TimelineService } from './plot/timelineService';
import { ReminderService } from './writing/reminderService';
import { ToolChainService, createToolChainService } from './tools/toolChainService';
import {
  ConflictDetectionService,
  createConflictDetectionService,
} from './plot/conflictDetectionService';
import {
  ExtendedTimelineService,
  createExtendedTimelineService,
} from './plot/extendedTimelineService';
import {
  SubplotManagementService,
  createSubplotManagementService,
} from './plot/subplotManagementService';
import { CharacterArcService, createCharacterArcService } from './character/characterArcService';
import { ArtisticStyleService, createArtisticStyleService } from './style/artisticStyleService';
import { SmartReminderService, createSmartReminderService } from './writing/smartReminderService';
import {
  QualityAssessmentService,
  createQualityAssessmentService,
} from './analysis/qualityAssessmentService';
import {
  IterationOptimizationService,
  createIterationOptimizationService,
} from './analysis/iterationOptimizationService';
import {
  ParallelVisualizationService,
  createParallelVisualizationService,
} from './plot/parallelVisualizationService';
import {
  PerspectiveSwitchService,
  createPerspectiveSwitchService,
} from './writing/perspectiveSwitchService';
import {
  BehaviorConsistencyService,
  createBehaviorConsistencyService,
} from './character/behaviorConsistencyService';
import {
  EmotionAuthenticityService,
  createEmotionAuthenticityService,
} from './character/emotionAuthenticityService';
import {
  StyleInternalizationService,
  createStyleInternalizationService,
} from './style/styleInternalizationService';
import {
  ReaderPerspectiveService,
  createReaderPerspectiveService,
} from './writing/readerPerspectiveService';
import { WritingGuideService, createWritingGuideService } from './writing/writingGuideService';

export interface NovelServices {
  intentUnderstanding: IntentUnderstandingService;
  infoExtraction: InfoExtractionService;
  creationFlow: CreationFlowService;
  novelType: NovelTypeService;
  plotNode: PlotNodeService;
  foreshadowing: ForeshadowingService;
  character: CharacterService;
  styleLearning: StyleLearningService;
  timeline: TimelineService;
  reminder: ReminderService;
  toolChain: ToolChainService;
  conflictDetection: ConflictDetectionService;
  extendedTimeline: ExtendedTimelineService;
  subplotManagement: SubplotManagementService;
  characterArc: CharacterArcService;
  artisticStyle: ArtisticStyleService;
  smartReminder: SmartReminderService;
  qualityAssessment: QualityAssessmentService;
  iterationOptimization: IterationOptimizationService;
  parallelVisualization: ParallelVisualizationService;
  perspectiveSwitch: PerspectiveSwitchService;
  behaviorConsistency: BehaviorConsistencyService;
  emotionAuthenticity: EmotionAuthenticityService;
  styleInternalization: StyleInternalizationService;
  readerPerspective: ReaderPerspectiveService;
  writingGuide: WritingGuideService;
}

export function createNovelServices(projectPath: string): NovelServices {
  return {
    intentUnderstanding: createIntentUnderstandingService(projectPath),
    infoExtraction: new InfoExtractionService(),
    creationFlow: new CreationFlowService(projectPath),
    novelType: new NovelTypeService(),
    plotNode: new PlotNodeService(projectPath),
    foreshadowing: new ForeshadowingService(projectPath),
    character: new CharacterService(projectPath),
    styleLearning: new StyleLearningService(projectPath),
    timeline: new TimelineService(projectPath),
    reminder: new ReminderService(projectPath),
    toolChain: createToolChainService(projectPath),
    conflictDetection: createConflictDetectionService(projectPath),
    extendedTimeline: createExtendedTimelineService(projectPath),
    subplotManagement: createSubplotManagementService(projectPath),
    characterArc: createCharacterArcService(projectPath),
    artisticStyle: createArtisticStyleService(projectPath),
    smartReminder: createSmartReminderService(projectPath),
    qualityAssessment: createQualityAssessmentService(projectPath),
    iterationOptimization: createIterationOptimizationService(projectPath),
    parallelVisualization: createParallelVisualizationService(projectPath),
    perspectiveSwitch: createPerspectiveSwitchService(projectPath),
    behaviorConsistency: createBehaviorConsistencyService(projectPath),
    emotionAuthenticity: createEmotionAuthenticityService(projectPath),
    styleInternalization: createStyleInternalizationService(projectPath),
    readerPerspective: createReaderPerspectiveService(projectPath),
    writingGuide: createWritingGuideService(projectPath),
  };
}
