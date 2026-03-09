import { useProjectStore } from './projectStore';
import { useFileStore } from './fileStore';
import { useTabStore } from './tabStore';
import { useWorkshopStore } from './workshopStore';
import { useSkillStore } from './skillStoreV2';
import { fileSystemService } from '@/services/core/fileSystemService';
import { logger } from '@/services/core/loggerService';

let unsubscribeProject: (() => void) | null = null;
let isInitialized = false;

export function initializeSync() {
  if (isInitialized) {
    logger.warn('同步中间件已初始化');
    return;
  }

  unsubscribeProject = useProjectStore.subscribe((state, prevState) => {
    const currentPath = state.currentProject?.path;
    const prevPath = prevState.currentProject?.path;

    if (currentPath !== prevPath) {
      handleProjectChange(currentPath, state.currentProject?.name);
    }
  });

  isInitialized = true;
  logger.info('同步中间件已初始化');
}

export function cleanupSync() {
  if (unsubscribeProject) {
    unsubscribeProject();
    unsubscribeProject = null;
  }
  isInitialized = false;
}

async function handleProjectChange(projectPath: string | undefined, projectName?: string) {
  if (!projectPath) {
    resetAllStores();
    return;
  }

  try {
    if (!fileSystemService.hasOpenProject()) {
      logger.warn('文件系统未初始化，跳过 store 同步');
      useFileStore.getState().setRootPath(projectPath);
      useWorkshopStore.getState().setProjectPath(projectPath);
      useSkillStore.getState().setProjectPath(projectPath);
      return;
    }

    useFileStore.getState().setRootPath(projectPath);
    useTabStore.getState().closeAllTabs();

    const workshopStore = useWorkshopStore.getState();
    await workshopStore.loadProject(projectPath);

    const skillStore = useSkillStore.getState();
    await skillStore.loadProject(projectPath);

    logger.info('项目已切换', { projectPath, projectName });
  } catch (error) {
    logger.error('项目切换失败', { error });
  }
}

function resetAllStores() {
  useFileStore.getState().setRootPath('');
  useTabStore.getState().closeAllTabs();
}

export function getSyncStatus() {
  return {
    isInitialized,
    currentProject: useProjectStore.getState().currentProject,
    workshopInitialized: useWorkshopStore.getState().isInitialized,
    skillProjectPath: useSkillStore.getState().currentProjectPath,
    hasOpenProject: fileSystemService.hasOpenProject(),
  };
}
