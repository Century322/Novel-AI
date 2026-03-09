import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface TaskState {
  tasks: Task[];
}

interface TaskActions {
  addTask: (task: Omit<Task, 'createdAt'>) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
  getTasksByStatus: (status: Task['status']) => Task[];
  getTasksByType: (type: Task['type']) => Task[];
  clearCompletedTasks: () => void;
  retryTask: (id: string) => void;
  cancelTask: (id: string) => void;
  reset: () => void;
}

type TaskStore = TaskState & TaskActions;

const initialState: TaskState = {
  tasks: [],
};

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addTask: (task) => {
        const id = task.id || uuidv4();
        set((state) => ({
          tasks: [...state.tasks, { ...task, id, createdAt: Date.now() }],
        }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },

      getTaskById: (id) => {
        return get().tasks.find((t) => t.id === id);
      },

      getTasksByStatus: (status) => {
        return get().tasks.filter((t) => t.status === status);
      },

      getTasksByType: (type) => {
        return get().tasks.filter((t) => t.type === type);
      },

      clearCompletedTasks: () => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.status !== 'completed'),
        }));
      },

      retryTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: 'pending' as const, error: undefined, progress: 0 } : t
          ),
        }));
      },

      cancelTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: 'cancelled' as const } : t)),
        }));
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'task-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'),
      }),
    }
  )
);
