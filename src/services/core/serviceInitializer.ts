import { ServiceContainer, createServiceContainer } from './serviceContainer';
import { KnowledgeService } from '../knowledge/knowledgeService';
import { createMemoryService, MemoryService } from '../knowledge/memoryService';
import { createContextCompressionService, ContextCompressionService } from '../knowledge/contextCompressionService';
import { CharacterService } from '../character/characterService';
import { TimelineService } from '../plot/timelineService';
import { ForeshadowingService } from '../plot/foreshadowingService';
import { createAuthorStyleLearningService, AuthorStyleLearningService } from '../style/authorStyleLearningService';
import { DeepStyleLearningService } from '../style/deepStyleLearningService';
import { ReminderService } from '../writing/reminderService';
import { QualityService } from '../analysis/qualityService';
import { createWorldModelService } from '../world/worldModelService';
import { createNovelBibleService, NovelBibleService } from '../world/novelBibleService';
import { SettingExtractionService } from '../extraction/settingExtractionService';
import { WorldBuildingService } from '../worldbuilding/worldBuildingService';
import { createToolRegistry, ToolRegistry } from '../tools/toolRegistry';
import { createAgentEngine, AgentEngine } from '../ai/agentEngine';
import { createIntentUnderstandingService, IntentUnderstandingService } from '../ai/intentUnderstandingService';
import { logger } from './loggerService';

export interface ServiceRegistry {
  container: ServiceContainer;
  knowledgeService: KnowledgeService | null;
  memoryService: MemoryService | null;
  compressionService: ContextCompressionService | null;
  styleService: AuthorStyleLearningService | null;
  deepStyleService: DeepStyleLearningService | null;
  reminderService: ReminderService | null;
  qualityService: QualityService | null;
  characterService: CharacterService | null;
  timelineService: TimelineService | null;
  foreshadowingService: ForeshadowingService | null;
  worldModelService: ReturnType<typeof createWorldModelService> | null;
  novelBibleService: NovelBibleService | null;
  settingExtractionService: SettingExtractionService | null;
  worldBuildingService: WorldBuildingService | null;
  toolRegistry: ToolRegistry | null;
  agentEngine: AgentEngine | null;
  intentService: IntentUnderstandingService | null;
}

let currentRegistry: ServiceRegistry | null = null;

export function getServiceRegistry(): ServiceRegistry | null {
  return currentRegistry;
}

export async function initializeServices(
  projectPath: string,
  agentConfig: { maxIterations: number; agentMode?: boolean }
): Promise<ServiceRegistry> {
  if (currentRegistry) {
    await disposeServices();
  }

  const container = createServiceContainer(projectPath);

  const registry: ServiceRegistry = {
    container,
    knowledgeService: null,
    memoryService: null,
    compressionService: null,
    styleService: null,
    deepStyleService: null,
    reminderService: null,
    qualityService: null,
    characterService: null,
    timelineService: null,
    foreshadowingService: null,
    worldModelService: null,
    novelBibleService: null,
    settingExtractionService: null,
    worldBuildingService: null,
    toolRegistry: null,
    agentEngine: null,
    intentService: null,
  };

  if (!projectPath) {
    currentRegistry = registry;
    return registry;
  }

  try {
    registry.intentService = createIntentUnderstandingService(projectPath);
  } catch (err) {
    logger.error('Intent service init failed', { error: err });
  }

  try {
    registry.knowledgeService = new KnowledgeService();
    await registry.knowledgeService.initialize();
  } catch (err) {
    logger.error('Knowledge service init failed', { error: err });
  }

  try {
    registry.memoryService = createMemoryService(projectPath);
    await registry.memoryService.initialize();
  } catch (err) {
    logger.error('Memory service init failed', { error: err });
  }

  try {
    registry.styleService = createAuthorStyleLearningService(projectPath);
    await registry.styleService.initialize();
  } catch (err) {
    logger.error('Style service init failed', { error: err });
  }

  try {
    registry.worldModelService = createWorldModelService(projectPath);
    await registry.worldModelService.initialize();
  } catch (err) {
    logger.error('World model service init failed', { error: err });
  }

  try {
    registry.novelBibleService = createNovelBibleService(projectPath);
    if (registry.worldModelService) {
      registry.novelBibleService.setWorldModelService(registry.worldModelService);
    }
    await registry.novelBibleService.initialize();
  } catch (err) {
    logger.error('Novel bible service init failed', { error: err });
  }

  registry.compressionService = createContextCompressionService(projectPath);
  if (registry.memoryService) {
    registry.compressionService.setMemoryService(registry.memoryService);
  }
  if (registry.knowledgeService) {
    registry.compressionService.setKnowledgeService(registry.knowledgeService);
  }

  registry.deepStyleService = new DeepStyleLearningService(projectPath);
  registry.reminderService = new ReminderService(projectPath);
  registry.qualityService = new QualityService(projectPath);
  registry.characterService = new CharacterService(projectPath);
  registry.timelineService = new TimelineService(projectPath);
  registry.foreshadowingService = new ForeshadowingService(projectPath);

  registry.settingExtractionService = new SettingExtractionService();
  if (registry.worldModelService) {
    registry.settingExtractionService.setWorldModelService(registry.worldModelService);
  }

  registry.worldBuildingService = new WorldBuildingService();
  if (registry.worldModelService) {
    registry.worldBuildingService.setWorldModelService(registry.worldModelService);
  }
  if (registry.settingExtractionService) {
    registry.worldBuildingService.setExtractionService(registry.settingExtractionService);
  }

  registry.toolRegistry = createToolRegistry(projectPath);
  if (registry.knowledgeService) {
    registry.toolRegistry.setKnowledgeService(registry.knowledgeService);
  }
  if (registry.memoryService) {
    registry.toolRegistry.setMemoryService(registry.memoryService);
  }
  registry.toolRegistry.setCompressionService(registry.compressionService);
  if (registry.styleService) {
    registry.toolRegistry.setStyleService(registry.styleService);
  }
  registry.toolRegistry.setQualityService(registry.qualityService);
  registry.toolRegistry.setCharacterService(registry.characterService);
  registry.toolRegistry.setTimelineService(registry.timelineService);
  registry.toolRegistry.setForeshadowingService(registry.foreshadowingService);
  if (registry.worldModelService) {
    registry.toolRegistry.setWorldModelService(registry.worldModelService);
  }
  registry.toolRegistry.setSettingExtractionService(registry.settingExtractionService);
  registry.toolRegistry.setWorldBuildingService(registry.worldBuildingService);
  if (registry.novelBibleService) {
    registry.toolRegistry.setNovelBibleService(registry.novelBibleService);
  }

  registry.agentEngine = createAgentEngine(
    projectPath,
    {
      maxIterations: Math.max(1, agentConfig.maxIterations || 1),
      agentMode: agentConfig.agentMode ?? true,
    },
    registry.toolRegistry
  );
  if (registry.memoryService) {
    registry.agentEngine.setMemoryService(registry.memoryService);
  }
  registry.agentEngine.setCompressionService(registry.compressionService);
  if (registry.styleService) {
    registry.agentEngine.setStyleService(registry.styleService);
  }

  currentRegistry = registry;
  return registry;
}

export async function disposeServices(): Promise<void> {
  if (!currentRegistry) {
    return;
  }

  currentRegistry = null;
}

export function getKnowledgeService(): KnowledgeService | null {
  return currentRegistry?.knowledgeService ?? null;
}

export function getMemoryService(): MemoryService | null {
  return currentRegistry?.memoryService ?? null;
}

export function getCompressionService(): ContextCompressionService | null {
  return currentRegistry?.compressionService ?? null;
}

export function getStyleService(): AuthorStyleLearningService | null {
  return currentRegistry?.styleService ?? null;
}

export function getDeepStyleService(): DeepStyleLearningService | null {
  return currentRegistry?.deepStyleService ?? null;
}

export function getReminderService(): ReminderService | null {
  return currentRegistry?.reminderService ?? null;
}

export function getToolRegistry(): ToolRegistry | null {
  return currentRegistry?.toolRegistry ?? null;
}

export function getAgentEngine(): AgentEngine | null {
  return currentRegistry?.agentEngine ?? null;
}

export function getIntentService(): IntentUnderstandingService | null {
  return currentRegistry?.intentService ?? null;
}

export function getNovelBibleService(): NovelBibleService | null {
  return currentRegistry?.novelBibleService ?? null;
}
