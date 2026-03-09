import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AgentConfig } from '@/types';

export interface AgentCurrentAction {
  type: 'editing' | 'reading' | 'analyzing' | 'generating' | 'idle';
  targetFile?: string;
  targetTab?: string;
  description?: string;
  step?: number;
  totalSteps?: number;
}

interface AgentState {
  agentConfig: AgentConfig;
  isProcessing: boolean;
  currentAction: AgentCurrentAction;
}

interface AgentActions {
  updateAgentConfig: (config: Partial<AgentConfig>) => void;
  setAgentConfig: (config: AgentConfig) => void;
  setProcessing: (processing: boolean) => void;
  setCurrentAction: (action: Partial<AgentCurrentAction>) => void;
  clearCurrentAction: () => void;
}

type AgentStore = AgentState & AgentActions;

const initialAgentConfig: AgentConfig = {
  enabled: false,
  maxIterations: 1,
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
