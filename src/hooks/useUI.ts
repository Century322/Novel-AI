import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/store';
import { UI_CONFIG } from '@/constants';

export function useTaskAutoDismiss(
  taskId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed'
) {
  const { removeTask } = useTaskStore();
  const removedRef = useRef(new Set<string>());

  useEffect(() => {
    if ((status === 'completed' || status === 'failed') && !removedRef.current.has(taskId)) {
      removedRef.current.add(taskId);
      const timer = setTimeout(() => {
        removeTask(taskId);
        removedRef.current.delete(taskId);
      }, UI_CONFIG.TASK_AUTO_DISMISS_MS);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [taskId, status, removeTask]);
}

export function useAutoScroll<T>(dependency: T) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dependency]);

  return scrollRef;
}
