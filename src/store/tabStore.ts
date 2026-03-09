import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TabType =
  | 'file'
  | 'settings'
  | 'skill'
  | 'workshop'
  | 'chat'
  | 'terminal'
  | 'visualization';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  path?: string;
  fileId?: string;
  isDirty?: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

interface TabActions {
  openTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  getActiveTab: () => Tab | null;
  getTabByFileId: (fileId: string) => Tab | undefined;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

type TabStore = TabState & TabActions;

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (tab) => {
        const id = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        set((state) => ({
          tabs: [...state.tabs, { ...tab, id }],
          activeTabId: id,
        }));
      },

      closeTab: (id) => {
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          return {
            tabs: newTabs,
            activeTabId:
              state.activeTabId === id
                ? newTabs.length > 0
                  ? newTabs[newTabs.length - 1].id
                  : null
                : state.activeTabId,
          };
        });
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
      },

      setActiveTab: (id) => {
        set({ activeTabId: id });
      },

      getActiveTab: () => {
        const state = get();
        return state.tabs.find((t) => t.id === state.activeTabId) || null;
      },

      getTabByFileId: (fileId) => {
        return get().tabs.find((t) => t.fileId === fileId);
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [movedTab] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, movedTab);
          return { tabs: newTabs };
        });
      },
    }),
    {
      name: 'tab-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);
