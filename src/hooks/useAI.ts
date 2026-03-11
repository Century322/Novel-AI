import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateContent } from '@/api';
import {
  useAgentStore,
  useSessionStore,
  useTaskStore,
  useApiKeyStore,
  useNotificationStore,
  useFileStore,
  useWorkshopStore,
} from '@/store';
import { useSystemContext } from './useSystemContext';
import { parseJsonFromMarkdown } from '@/utils';
import { Message } from '@/types';
import type { LLMProvider } from '@/types/core/llm';
import type { AgentState } from '@/services/ai/agentEngine';
import type { IntentResult, IntentContext } from '@/types/ai/intent';
import type { ExtractionResult, ExtractedInfo } from '@/types/knowledge/extraction';
import type { Reminder, ReminderStats } from '@/types/writing/reminder';
import type { StyleProfile } from '@/types/style/styleLearning';
import type { ThinkingProcess } from '@/types/ai/thinkingProcess';
import { infoExtractionService } from '@/services/analysis/infoExtractionService';
import { llmService } from '@/services/ai/llmService';
import { logger } from '@/services/core/loggerService';
import { thinkingProcessService } from '@/services/ai/thinkingProcessService';
import {
  initializeServices,
  disposeServices,
  getToolRegistry,
  getAgentEngine,
  getIntentService,
  getDeepStyleService,
  getReminderService,
  getKnowledgeService,
} from '@/services/core/serviceInitializer';

interface FileOperation {
  path: string;
  content: string;
}

interface ParsedFilePayload {
  files?: FileOperation[];
}

function mapStoreProviderToLLMProvider(provider: string): LLMProvider {
  switch (provider) {
    case 'gateway':
    case 'openai':
      return 'openai';
    case 'anthropic':
      return 'anthropic';
    case 'deepseek':
      return 'deepseek';
    case 'moonshot':
      return 'moonshot';
    case 'zai':
      return 'zhipu';
    default:
      return 'openai';
  }
}

function createAgentState(status: AgentState['status'], currentThought = ''): AgentState {
  return {
    iteration: 0,
    status,
    currentThought,
    currentAction: null,
    observations: [],
    messages: [],
    tokensUsed: 0,
    startTime: Date.now(),
  };
}

function createFallbackIntent(userMsg: string): IntentResult {
  return {
    category: 'chat',
    specificIntent: 'discussion',
    confidence: 0.3,
    tools: [],
    context: { topics: [userMsg.slice(0, 60)] },
    reasoning: 'Fallback intent.',
  };
}

export function useAI() {
  const { isProcessing, setProcessing, setCurrentAction, clearCurrentAction, agentConfig } =
    useAgentStore();
  const { addMessage, updateLastMessage, currentSessionId } = useSessionStore();
  const { createFileByPath } = useFileStore();
  const { addTask, updateTask } = useTaskStore();
  const { getCurrentConfig, hasValidKey, keys, selectedKeyId, selectedModelId } = useApiKeyStore();
  const { addNotification } = useNotificationStore();
  const { projectPath } = useWorkshopStore();
  const systemContext = useSystemContext();

  const [error, setError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [currentIntent, setCurrentIntent] = useState<IntentResult | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [thinkingProcess, setThinkingProcess] = useState<ThinkingProcess | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const unsubscribe = thinkingProcessService.subscribe((process) => {
      setThinkingProcess({
        ...process,
        steps: [...process.steps],
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let disposed = false;

    const initServices = async () => {
      const workshopStore = await import('@/store/workshopStore').then(m => m.useWorkshopStore);
      const store = workshopStore.getState();
      
      if (!store.isInitialized) {
        await store.init();
      }
      
      const currentProjectPath = workshopStore.getState().projectPath;
      if (!currentProjectPath) {
        await disposeServices();
        return;
      }

      await initializeServices(currentProjectPath, {
        maxIterations: agentConfig.maxIterations || 1,
        agentMode: true,
      });

      if (disposed) {
        await disposeServices();
      }
    };

    initServices();

    return () => {
      disposed = true;
      disposeServices();
    };
  }, [agentConfig.maxIterations]);

  useEffect(() => {
    const config = getCurrentConfig();
    if (!config) {
      return;
    }

    const provider = mapStoreProviderToLLMProvider(config.key.provider);

    llmService.registerProvider(provider, {
      provider,
      model: config.model.id,
      apiKey: config.key.apiKey,
      baseUrl: config.key.baseUrl,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
    });
    llmService.setDefaultProvider(provider);
  }, [getCurrentConfig, keys, selectedKeyId, selectedModelId]);

  const parseAndCreateFiles = useCallback(
    async (text: string): Promise<string> => {
      const { data, cleanText } = parseJsonFromMarkdown<ParsedFilePayload>(text);

      if (data?.files && data.files.length > 0) {
        for (const file of data.files) {
          if (!file.path || typeof file.content !== 'string') {
            continue;
          }
          await createFileByPath(file.path, file.content);
        }
      }

      return cleanText || text;
    },
    [createFileByPath]
  );

  const callAI = useCallback(
    async (
      prompt: string,
      history: Message[],
      customSystemContext?: string,
      onStream?: (chunk: string) => void
    ): Promise<string> => {
      const config = getCurrentConfig();
      if (!config) {
        throw new Error('No API key/model selected.');
      }

      const { key, model } = config;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        return await generateContent({
          provider: key.provider,
          apiKey: key.apiKey,
          baseUrl: key.baseUrl,
          model: model.id,
          prompt,
          history,
          systemContext: customSystemContext || systemContext,
          enableSearch: key.provider === 'google',
          onStream,
          abortSignal: abortController.signal,
        });
      } finally {
        abortControllerRef.current = null;
      }
    },
    [getCurrentConfig, systemContext]
  );

  const analyzeIntent = useCallback(
    async (userMsg: string, history: Message[]): Promise<IntentResult> => {
      const intentService = getIntentService();
      if (!intentService || !projectPath) {
        const fallback = createFallbackIntent(userMsg);
        setCurrentIntent(fallback);
        return fallback;
      }

      const context: IntentContext = {
        projectPath,
        sessionId: currentSessionId || 'default',
        conversationHistory: history.slice(-10).map((m) => ({
          role: m.role === 'reviewer' ? 'assistant' : m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        existingCharacters: [],
        existingChapters: [],
      };

      try {
        const result = await intentService.analyzeIntent(userMsg, context);
        setCurrentIntent(result);
        return result;
      } catch (err) {
        logger.error('Intent analysis failed', { error: err });
        const fallback = createFallbackIntent(userMsg);
        setCurrentIntent(fallback);
        return fallback;
      }
    },
    [currentSessionId, projectPath]
  );

  const sendMessage = useCallback(
    async (userMsg: string, history: Message[]): Promise<string | null> => {
      if (!hasValidKey()) {
        setError('Please configure and enable an API key first.');
        return null;
      }

      addMessage('user', userMsg);
      addMessage('assistant', '');

      setError(null);
      setProcessing(true);
      setCurrentAction({ type: 'generating', description: 'Generating response...' });

      thinkingProcessService.startProcess();
      const stepId = thinkingProcessService.addStep('thinking', 'AI processing', userMsg.slice(0, 80));
      thinkingProcessService.startStep(stepId);

      try {
        await analyzeIntent(userMsg, history);

        let fullResponse = '';
        const responseText = await callAI(userMsg, history, undefined, (chunk) => {
          fullResponse += chunk;
          updateLastMessage(fullResponse);
        });

        const finalText = await parseAndCreateFiles(responseText);
        if (!fullResponse) {
          updateLastMessage(finalText);
        }

        thinkingProcessService.completeStep(stepId);
        return finalText;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        updateLastMessage(`Error: ${errorMessage}`);
        thinkingProcessService.errorStep(stepId, errorMessage);
        logger.error('sendMessage failed', { error: err });
        return null;
      } finally {
        setProcessing(false);
        clearCurrentAction();
        thinkingProcessService.endProcess();
      }
    },
    [addMessage, analyzeIntent, callAI, clearCurrentAction, hasValidKey, parseAndCreateFiles, setCurrentAction, setProcessing, updateLastMessage]
  );

  const sendMessageWithAgent = useCallback(
    async (userMsg: string, history: Message[]): Promise<string | null> => {
      if (!hasValidKey()) {
        setError('Please configure and enable an API key first.');
        return null;
      }

      addMessage('user', userMsg);
      addMessage('assistant', '');

      setError(null);
      setProcessing(true);
      setCurrentAction({ type: 'generating', description: 'Agent is planning...' });
      setAgentState(createAgentState('planning', 'Planning response...'));

      thinkingProcessService.startProcess();
      const stepId = thinkingProcessService.addStep(
        'thinking',
        'Agent processing',
        userMsg.slice(0, 80)
      );
      thinkingProcessService.startStep(stepId);

      try {
        await analyzeIntent(userMsg, history);

        const engine = getAgentEngine();
        if (!engine) {
          const responseText = await callAI(userMsg, history);
          const fallbackText = await parseAndCreateFiles(responseText);
          updateLastMessage(fallbackText);
          setAgentState(createAgentState('completed', 'Completed (fallback mode)'));
          thinkingProcessService.completeStep(stepId);
          return fallbackText;
        }

        const result = await engine.run(userMsg, (state) => {
          setAgentState({
            ...state,
            observations: [...state.observations],
            messages: [...state.messages],
          });

          if (state.status === 'planning') {
            setCurrentAction({ type: 'generating', description: 'Agent planning tasks...' });
          } else if (state.status === 'acting') {
            setCurrentAction({
              type: 'generating',
              description: `Executing: ${state.currentAction?.toolName || 'task'}`,
            });
          } else if (state.status === 'responding') {
            setCurrentAction({ type: 'generating', description: 'Composing response...' });
          }
        });

        if (!result.success && result.error) {
          throw new Error(result.error);
        }

        const responseText = result.response || '';
        const finalText = await parseAndCreateFiles(responseText);
        updateLastMessage(finalText || responseText || 'Task completed.');

        if (result.toolCalls.length > 0) {
          addMessage('system', `Agent executed ${result.toolCalls.length} tool call(s).`);
        }

        setAgentState(createAgentState('completed', 'Completed'));
        thinkingProcessService.completeStep(stepId);
        return finalText || responseText || 'Task completed.';
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        updateLastMessage(`Error: ${errorMessage}`);
        setAgentState(createAgentState('error', errorMessage));
        thinkingProcessService.errorStep(stepId, errorMessage);
        logger.error('sendMessageWithAgent failed', { error: err });
        return null;
      } finally {
        setProcessing(false);
        clearCurrentAction();
        thinkingProcessService.endProcess();
      }
    },
    [
      addMessage,
      analyzeIntent,
      callAI,
      clearCurrentAction,
      hasValidKey,
      parseAndCreateFiles,
      projectPath,
      setCurrentAction,
      setProcessing,
      updateLastMessage,
    ]
  );

  const executeTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      const registry = getToolRegistry();
      if (!projectPath || !registry) {
        return 'Tool registry is unavailable. Open a project first.';
      }

      const result = await registry.execute(
        {
          id: `call_${Date.now()}`,
          name,
          arguments: args,
          status: 'pending',
          startTime: Date.now(),
        },
        { projectPath, sessionId: currentSessionId || 'default' }
      );

      if (!result.success) {
        return `Tool failed: ${result.error || 'unknown error'}`;
      }

      if (typeof result.result === 'string') {
        return result.result;
      }

      return JSON.stringify(result.result, null, 2);
    },
    [currentSessionId, projectPath]
  );

  const getAvailableTools = useCallback(() => {
    const registry = getToolRegistry();
    if (!registry) {
      return [] as Array<{ name: string; description: string }>;
    }
    return registry.getDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }, []);

  const generateBatchChapters = useCallback(
    async (
      start: number,
      end: number,
      _history: Message[],
      sessionId: string | null,
      sessionName: string
    ) => {
      const taskId = addTask({
        id: uuidv4(),
        type: 'batch_generate',
        status: 'processing',
        message: `Generating chapters ${start}-${end}...`,
      });

      const totalChapters = end - start + 1;
      let completedChapters = 0;

      for (let chapterNum = start; chapterNum <= end; chapterNum++) {
        try {
          const chapterPrompt = `Generate chapter ${chapterNum}. Keep continuity with existing story context.`;
          const response = await callAI(chapterPrompt, []);
          await parseAndCreateFiles(response);

          completedChapters++;
          updateTask(taskId, {
            message: `Generated ${completedChapters}/${totalChapters} chapters`,
            progress: Math.round((completedChapters / totalChapters) * 100),
          });
        } catch (err) {
          logger.error('Batch chapter generation failed', { chapter: chapterNum, error: err });
        }
      }

      updateTask(taskId, {
        status: 'completed',
        message: `Batch completed: ${completedChapters}/${totalChapters}`,
      });

      addMessage(
        'system',
        `Batch generation finished for chapters ${start}-${end}. Completed ${completedChapters} chapter(s).`
      );

      addNotification({
        type: 'task_complete',
        title: 'Batch generation completed',
        message: `Completed ${completedChapters} chapter(s).`,
        sessionId: sessionId || undefined,
        sessionName,
      });
    },
    [addMessage, addNotification, addTask, callAI, parseAndCreateFiles, updateTask]
  );

  const confirmExtraction = useCallback(
    async (extractions: ExtractedInfo[]): Promise<boolean> => {
      if (extractions.length === 0) {
        return false;
      }

      const timestamp = Date.now();
      for (let i = 0; i < extractions.length; i++) {
        const extraction = extractions[i];
        const path = `notes/extractions/${extraction.type}-${timestamp}-${i + 1}.md`;
        const content = `# ${extraction.type}\n\n\`\`\`json\n${JSON.stringify(extraction.data, null, 2)}\n\`\`\``;
        await createFileByPath(path, content);
      }

      addMessage('system', `Saved ${extractions.length} extracted item(s).`);
      return true;
    },
    [addMessage, createFileByPath]
  );

  const extractAndSaveInfo = useCallback(
    async (text: string): Promise<ExtractionResult | null> => {
      try {
        const result = await infoExtractionService.extractFromText(text);
        setExtractionResult(result);

        if (result.success && result.extractions.length > 0) {
          await confirmExtraction(result.extractions);
        }

        return result;
      } catch (err) {
        logger.error('Extraction failed', { error: err });
        return null;
      }
    },
    [confirmExtraction]
  );

  const analyzeStyle = useCallback(async (text: string, source: string = 'user_input') => {
    const service = getDeepStyleService();
    if (!service) {
      return null as StyleProfile | null;
    }

    try {
      return (await service.analyzeText(text, source)) as StyleProfile;
    } catch (err) {
      logger.error('analyzeStyle failed', { error: err });
      return null as StyleProfile | null;
    }
  }, []);

  const getStyleProfiles = useCallback(() => {
    const service = getDeepStyleService();
    if (!service) {
      return [] as StyleProfile[];
    }
    return service.getAllProfiles() as StyleProfile[];
  }, []);

  const applyStyle = useCallback(
    async (content: string, profileId: string) => {
      const service = getDeepStyleService();
      if (!service) {
        return null as { appliedPatterns: string[]; modifications: string[] } | null;
      }

      try {
        const result = await service.applyStyle(content, profileId);
        return {
          appliedPatterns: result.appliedPatterns,
          modifications: result.modifications,
        };
      } catch (err) {
        logger.error('applyStyle failed', { error: err, profileId });
        return null as { appliedPatterns: string[]; modifications: string[] } | null;
      }
    },
    []
  );

  const getPendingReminders = useCallback(() => {
    const service = getReminderService();
    return service ? service.getPendingReminders() : ([] as Reminder[]);
  }, []);

  const getReminderStats = useCallback(() => {
    const service = getReminderService();
    return service ? service.getStats() : (null as ReminderStats | null);
  }, []);

  const acknowledgeReminder = useCallback(async (id: string) => {
    const service = getReminderService();
    if (!service) {
      return false;
    }
    return service.acknowledgeReminder(id);
  }, []);

  const resolveReminder = useCallback(async (id: string) => {
    const service = getReminderService();
    if (!service) {
      return false;
    }
    return service.resolveReminder(id);
  }, []);

  const runReminderChecks = useCallback(async () => {
    const service = getReminderService();
    if (!service) {
      return [] as Reminder[];
    }
    return service.runAllChecks();
  }, []);

  const addKnowledgeFile = useCallback(
    async (
      filePath: string,
      type:
        | 'novel'
        | 'reference'
        | 'style_guide'
        | 'research'
        | 'character_card'
        | 'worldbuilding'
        | 'outline'
        | 'chapter'
        | 'custom' = 'reference'
    ): Promise<{ success: boolean; file?: unknown; error?: string }> => {
      const service = getKnowledgeService();
      if (!service) {
        return { success: false, error: 'Knowledge service is not initialized.' };
      }

      try {
        const file = await service.addFile(filePath, type);
        if (!file) {
          return { success: false, error: 'Indexing failed.' };
        }

        addNotification({
          type: 'success',
          title: 'Knowledge file added',
          message: file.filename,
        });

        return { success: true, file };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('addKnowledgeFile failed', { error: err });
        return { success: false, error: errorMessage };
      }
    },
    [addNotification]
  );

  const removeKnowledgeFile = useCallback(async (fileId: string): Promise<boolean> => {
    const service = getKnowledgeService();
    if (!service) {
      return false;
    }

    try {
      return await service.removeFile(fileId);
    } catch (err) {
      logger.error('removeKnowledgeFile failed', { error: err });
      return false;
    }
  }, []);

  const getKnowledgeFiles = useCallback(() => {
    const service = getKnowledgeService();
    return service ? service.getAllFiles() : [];
  }, []);

  const getKnowledgeStats = useCallback(() => {
    const service = getKnowledgeService();
    return (
      service?.getStats() || {
        totalFiles: 0,
        totalChunks: 0,
        totalTokens: 0,
        byType: {},
      }
    );
  }, []);

  const searchKnowledge = useCallback((query: string, limit: number = 10) => {
    const service = getKnowledgeService();
    if (!service) {
      return [];
    }
    return service.search({ query, limit });
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    getAgentEngine()?.cancel();

    setProcessing(false);
    clearCurrentAction();
    setAgentState(null);
    setCurrentIntent(null);
    thinkingProcessService.clear();

    addMessage('system', 'Generation aborted.');
  }, [addMessage, clearCurrentAction, setProcessing]);

  const resetAIState = useCallback(() => {
    setAgentState(null);
    setCurrentIntent(null);
    thinkingProcessService.clear();
    setProcessing(false);
    clearCurrentAction();
  }, [clearCurrentAction, setProcessing]);

  return {
    sendMessage,
    sendMessageWithAgent,
    executeTool,
    getAvailableTools,
    callAI,
    isProcessing,
    error,
    setError,
    generateBatchChapters,
    agentState,
    currentIntent,
    analyzeIntent,
    extractionResult,
    extractAndSaveInfo,
    confirmExtraction,
    analyzeStyle,
    getStyleProfiles,
    applyStyle,
    getPendingReminders,
    abort,
    getReminderStats,
    acknowledgeReminder,
    resolveReminder,
    runReminderChecks,
    addKnowledgeFile,
    removeKnowledgeFile,
    getKnowledgeFiles,
    getKnowledgeStats,
    searchKnowledge,
    thinkingProcess,
    resetAIState,
  };
}
