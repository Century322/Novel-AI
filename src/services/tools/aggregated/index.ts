import { ToolRegistry, ToolDefinition, ToolHandler } from '../toolRegistry';
import { fileOpsDefinition, fileOpsHandler } from './fileOps';
import { knowledgeOpsDefinition, knowledgeOpsHandler } from './knowledgeOps';
import { projectContextDefinition, projectContextHandler } from './projectContext';
import { storyQueryDefinition, storyQueryHandler } from './storyQuery';
import { storyUpdateDefinition, storyUpdateHandler } from './storyUpdate';
import { storyGraphDefinition, storyGraphHandler } from './storyGraph';
import { storyStateSummaryDefinition, storyStateSummaryHandler } from './storyStateSummary';
import { generateContentDefinition, generateContentHandler } from './generateContent';
import { continueWritingDefinition, continueWritingHandler } from './continueWriting';
import { styleOpsDefinition, styleOpsHandler } from './styleOps';
import { storyAnalysisDefinition, storyAnalysisHandler } from './storyAnalysis';
import { readerSimulationDefinition, readerSimulationHandler } from './readerSimulation';

export function createAggregatedToolRegistry(projectPath: string): ToolRegistry {
  const registry = new ToolRegistry(projectPath, true);

  const tools: Array<{ definition: unknown; handler: unknown }> = [
    { definition: fileOpsDefinition, handler: fileOpsHandler },
    { definition: knowledgeOpsDefinition, handler: knowledgeOpsHandler },
    { definition: projectContextDefinition, handler: projectContextHandler },
    { definition: storyQueryDefinition, handler: storyQueryHandler },
    { definition: storyUpdateDefinition, handler: storyUpdateHandler },
    { definition: storyGraphDefinition, handler: storyGraphHandler },
    { definition: storyStateSummaryDefinition, handler: storyStateSummaryHandler },
    { definition: generateContentDefinition, handler: generateContentHandler },
    { definition: continueWritingDefinition, handler: continueWritingHandler },
    { definition: styleOpsDefinition, handler: styleOpsHandler },
    { definition: storyAnalysisDefinition, handler: storyAnalysisHandler },
    { definition: readerSimulationDefinition, handler: readerSimulationHandler },
  ];

  for (const { definition, handler } of tools) {
    registry.register(
      definition as unknown as ToolDefinition,
      handler as unknown as ToolHandler
    );
  }

  return registry;
}

export {
  fileOpsDefinition,
  fileOpsHandler,
  knowledgeOpsDefinition,
  knowledgeOpsHandler,
  projectContextDefinition,
  projectContextHandler,
  storyQueryDefinition,
  storyQueryHandler,
  storyUpdateDefinition,
  storyUpdateHandler,
  storyGraphDefinition,
  storyGraphHandler,
  storyStateSummaryDefinition,
  storyStateSummaryHandler,
  generateContentDefinition,
  generateContentHandler,
  continueWritingDefinition,
  continueWritingHandler,
  styleOpsDefinition,
  styleOpsHandler,
  storyAnalysisDefinition,
  storyAnalysisHandler,
  readerSimulationDefinition,
  readerSimulationHandler,
};
