import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  ragEnabled: boolean;
}

interface UIActions {
  toggleRag: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ragEnabled: false,

      toggleRag: () => set((state) => ({ ragEnabled: !state.ragEnabled })),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ragEnabled: state.ragEnabled,
      }),
    }
  )
);
