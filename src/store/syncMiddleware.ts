import { useFileStore } from './fileStore';
import { useTabStore } from './tabStore';
import { logger } from '@/services/core/loggerService';

let isInitialized = false;

export function initializeSync() {
  if (isInitialized) {
    logger.warn('同步中间件已初始化');
    return;
  }

  isInitialized = true;
  logger.info('同步中间件已初始化');
}

export function cleanupSync() {
  isInitialized = false;
}

export function getSyncStatus() {
  return {
    isInitialized,
    rootPath: useFileStore.getState().rootPath,
    openTabs: useTabStore.getState().tabs.length,
  };
}
