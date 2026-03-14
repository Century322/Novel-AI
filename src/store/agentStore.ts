import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SimpleAgentConfig } from '@/types';

export const DEFAULT_AGENT_MAX_ITERATIONS = 8;
export const MIN_AGENT_MAX_ITERATIONS = 3;

export interface AgentCurrentAction {
  type: 'editing' | 'reading' | 'analyzing' | 'generating' | 'idle';
  targetFile?: string;
  targetTab?: string;
  description?: string;
  step?: number;
  totalSteps?: number;
}

interface AgentState {
  agentConfig: SimpleAgentConfig;
  isProcessing: boolean;
  currentAction: AgentCurrentAction;
}

interface AgentActions {
  updateAgentConfig: (config: Partial<SimpleAgentConfig>) => void;
  setAgentConfig: (config: SimpleAgentConfig) => void;
  setProcessing: (processing: boolean) => void;
  setCurrentAction: (action: Partial<AgentCurrentAction>) => void;
  clearCurrentAction: () => void;
}

type AgentStore = AgentState & AgentActions;

const initialAgentConfig: SimpleAgentConfig = {
  enabled: false,
  maxIterations: DEFAULT_AGENT_MAX_ITERATIONS,
};

const initialCurrentAction: AgentCurrentAction = {
  type: 'idle',
};

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      agentConfig: initialAgentConfig,
      isProcessing: false,
      currentAction: initialCurrentAction,

      updateAgentConfig: (config) => {
        set((state) => ({
          agentConfig: { ...state.agentConfig, ...config },
        }));
      },

      setAgentConfig: (config) => {
        set({ agentConfig: config });
      },

      setProcessing: (processing) => set({ isProcessing: processing }),

      setCurrentAction: (action) => {
        set((state) => ({
          currentAction: { ...state.currentAction, ...action },
        }));
      },

      clearCurrentAction: () => {
        set({ currentAction: initialCurrentAction });
      },
    }),
    {
      name: 'agent-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ agentConfig: state.agentConfig }),
    }
  )
);
