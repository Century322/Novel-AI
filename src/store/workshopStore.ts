import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  WorkshopConfig,
  SkillManifest,
  AgentManifest,
  MemoryEntry,
  KnowledgeIndex,
} from '@/types/core/workshop';
import { CreationStage } from '@/types/writing/creationFlow';
import { workshopService } from '@/services/core/workshopService';
import { logger } from '@/services/core/loggerService';

interface WorkshopState {
  isInitialized: boolean;
  isLoading: boolean;
  projectPath: string | null;
  config: WorkshopConfig | null;
  skills: SkillManifest[];
  agents: AgentManifest[];
  memory: MemoryEntry[];
  knowledgeIndex: KnowledgeIndex[];
  currentStage: CreationStage;
  progress: number;
}

interface WorkshopActions {
  init: () => Promise<void>;
  loadProject: (projectPath: string) => Promise<void>;
  setProjectPath: (projectPath: string | null) => void;
  saveConfig: () => Promise<void>;
  updateConfig: (updates: Partial<WorkshopConfig>) => void;
  scanSkills: () => Promise<void>;
  scanAgents: () => Promise<void>;
  addMemoryEntry: (
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>
  ) => Promise<MemoryEntry>;
  updateMemoryEntry: (id: string, updates: Partial<MemoryEntry>) => Promise<boolean>;
  deleteMemoryEntry: (id: string) => Promise<boolean>;
  getMemoryByType: (type: MemoryEntry['type']) => MemoryEntry[];
  searchMemory: (query: string) => MemoryEntry[];
  refreshKnowledgeIndex: () => Promise<void>;
  getEnabledSkills: () => SkillManifest[];
  getEnabledAgents: () => AgentManifest[];
  getSkillById: (id: string) => SkillManifest | undefined;
  getAgentById: (id: string) => AgentManifest | undefined;
  setCurrentStage: (stage: CreationStage) => void;
  setProgress: (progress: number) => void;
}

type WorkshopStore = WorkshopState & WorkshopActions;

export const useWorkshopStore = create<WorkshopStore>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      isLoading: false,
      projectPath: null,
      config: null,
      skills: [],
      agents: [],
      memory: [],
      knowledgeIndex: [],
      currentStage: 'concept' as CreationStage,
      progress: 0,

      init: async () => {
        if (get().isInitialized) return;
        
        set({ isLoading: true });
        try {
          const config = await workshopService.initProject('', '文件存储');
          const [skills, agents, memory, knowledgeIndex] = await Promise.all([
            workshopService.scanSkills(),
            workshopService.scanAgents(),
            workshopService.loadMemory(),
            workshopService.loadKnowledgeIndex(),
          ]);

          set({
            isInitialized: true,
            isLoading: false,
            config,
            skills,
            agents,
            memory,
            knowledgeIndex,
          });
        } catch (error) {
          logger.error('初始化失败', { error });
          set({ isLoading: false, isInitialized: true });
        }
      },

      loadProject: async (projectPath: string) => {
        set({ isLoading: true });
        try {
          const config = await workshopService.initProject(projectPath, '文件存储');
          const [skills, agents, memory, knowledgeIndex] = await Promise.all([
            workshopService.scanSkills(),
            workshopService.scanAgents(),
            workshopService.loadMemory(),
            workshopService.loadKnowledgeIndex(),
          ]);

          set({
            isInitialized: true,
            isLoading: false,
            projectPath,
            config,
            skills,
            agents,
            memory,
            knowledgeIndex,
          });
        } catch (error) {
          logger.error('加载项目失败', { error, projectPath });
          set({ isLoading: false });
        }
      },

      setProjectPath: (projectPath: string | null) => {
        set({ projectPath });
      },

      saveConfig: async () => {
        const { config } = get();
        if (!config) {
          return;
        }
        await workshopService.saveConfig(config);
      },

      updateConfig: (updates: Partial<WorkshopConfig>) => {
        const { config } = get();
        if (!config) {
          return;
        }
        set({ config: { ...config, ...updates } });
      },

      scanSkills: async () => {
        const skills = await workshopService.scanSkills();
        set({ skills });
      },

      scanAgents: async () => {
        const agents = await workshopService.scanAgents();
        set({ agents });
      },

      addMemoryEntry: async (entry) => {
        const newEntry = await workshopService.addMemoryEntry(entry);
        set((state) => ({ memory: [...state.memory, newEntry] }));
        return newEntry;
      },

      updateMemoryEntry: async (id, updates) => {
        const success = await workshopService.updateMemoryEntry(id, updates);
        if (success) {
          set((state) => ({
            memory: state.memory.map((e) => (e.id === id ? { ...e, ...updates } : e)),
          }));
        }
        return success;
      },

      deleteMemoryEntry: async (id) => {
        const success = await workshopService.deleteMemoryEntry(id);
        if (success) {
          set((state) => ({ memory: state.memory.filter((e) => e.id !== id) }));
        }
        return success;
      },

      getMemoryByType: (type) => {
        return get().memory.filter((e) => e.type === type);
      },

      searchMemory: (query) => {
        const { memory } = get();
        const lowerQuery = query.toLowerCase();
        return memory
          .filter(
            (e) =>
              e.content.toLowerCase().includes(lowerQuery) ||
              JSON.stringify(e.metadata).toLowerCase().includes(lowerQuery)
          )
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
      },

      refreshKnowledgeIndex: async () => {
        const knowledgeIndex = await workshopService.loadKnowledgeIndex();
        set({ knowledgeIndex });
      },

      getEnabledSkills: () => {
        return get()
          .skills.filter((s) => s.enabled)
          .sort((a, b) => b.priority - a.priority);
      },

      getEnabledAgents: () => {
        return get()
          .agents.filter((a) => a.enabled)
          .sort((a, b) => b.priority - a.priority);
      },

      getSkillById: (id) => {
        return get().skills.find((s) => s.id === id);
      },

      getAgentById: (id) => {
        return get().agents.find((a) => a.id === id);
      },

      setCurrentStage: (stage: CreationStage) => {
        set({ currentStage: stage });
      },

      setProgress: (progress: number) => {
        set({ progress });
      },
    }),
    {
      name: 'workshop-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
