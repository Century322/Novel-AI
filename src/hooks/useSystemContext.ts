import { useMemo, useEffect, useRef } from 'react';
import { useSessionStore, useFileStore, useUIStore, useSkillStore, useProjectStore } from '@/store';
import { SYSTEM_PROMPT_TEMPLATE } from '@/constants';
import { getFileStructure, findNode } from '@/utils';
import { MemoryService, SearchEngine } from '@/services/knowledge/memoryService';
import { KnowledgeService } from '@/services/knowledge/knowledgeService';
import { useFileTreeFromProject } from '@/store/fileStore';
import { logger } from '@/services/core/loggerService';

let knowledgeServiceInstance: KnowledgeService | null = null;
const memoryServiceCache = new Map<string, MemoryService>();
const searchEngineCache = new Map<string, SearchEngine>();

function getKnowledgeService(): KnowledgeService {
  if (!knowledgeServiceInstance) {
    knowledgeServiceInstance = new KnowledgeService();
  }
  return knowledgeServiceInstance;
}

function getMemoryService(projectPath: string): MemoryService {
  if (!memoryServiceCache.has(projectPath)) {
    memoryServiceCache.set(projectPath, new MemoryService(projectPath));
  }
  return memoryServiceCache.get(projectPath)!;
}

function getSearchEngine(projectPath: string): SearchEngine {
  if (!searchEngineCache.has(projectPath)) {
    const knowledgeService = getKnowledgeService();
    const memoryService = getMemoryService(projectPath);
    searchEngineCache.set(projectPath, new SearchEngine(knowledgeService, memoryService));
  }
  return searchEngineCache.get(projectPath)!;
}

export function useSystemContext() {
  const { ragEnabled } = useUIStore();
  const { generateAllPrompts } = useSkillStore();
  const { currentProject, fileTree } = useProjectStore();
  const { selectedFilePath } = useFileStore();
  const fileNodes = useFileTreeFromProject();
  const lastFileTreeRef = useRef<string>('');
  const initializedRef = useRef<string | null>(null);

  const projectPath = currentProject?.path || null;

  useEffect(() => {
    if (!ragEnabled || !projectPath) {
      return;
    }
    if (initializedRef.current === projectPath) {
      return;
    }

    initializedRef.current = projectPath;

    const currentFT = JSON.stringify(fileTree.map((f) => f.path));
    if (currentFT === lastFileTreeRef.current) {
      return;
    }
    lastFileTreeRef.current = currentFT;

    const knowledgeService = getKnowledgeService();
    const memoryService = getMemoryService(projectPath);

    Promise.all([knowledgeService.initialize(), memoryService.initialize()]).catch((error) =>
      logger.error('初始化服务失败', { error })
    );
  }, [fileTree, ragEnabled, projectPath]);

  useEffect(() => {
    return () => {
      if (projectPath) {
        memoryServiceCache.delete(projectPath);
        searchEngineCache.delete(projectPath);
      }
    };
  }, [projectPath]);

  return useMemo(() => {
    let context = SYSTEM_PROMPT_TEMPLATE;

    const skillPrompts = generateAllPrompts();
    if (skillPrompts) {
      context += skillPrompts;
    }

    if (currentProject) {
      context += `\n\n【当前项目: ${currentProject.name}】\n`;
      context += getFileStructure(fileNodes);
    } else {
      context += '\n\n【当前项目文件结构】\n(请先打开一个项目文件夹)\n';
    }

    if (selectedFilePath) {
      const selectedFile = findNode(fileNodes, selectedFilePath);
      if (selectedFile && selectedFile.type === 'file') {
        context += `\n\n【当前正在编辑/查看的文件】\n=== 文件名: ${selectedFile.name} ===\n${selectedFile.content || '(空)'}\n=== 文件结束 ===\n`;
        context += '(请重点参考上述当前文件的内容进行续写或修改)\n';
      }
    }

    if (ragEnabled && projectPath) {
      const memoryService = getMemoryService(projectPath);
      const projectSummary = memoryService.getProjectSummary();
      if (projectSummary && projectSummary !== '# 项目记忆摘要\n\n') {
        context += `\n\n【项目记忆】\n${projectSummary}`;
      }
    }

    context += '\n\n(你可以读取以上文件的内容来保持剧情连贯性)\n';

    return context;
  }, [currentProject, fileNodes, selectedFilePath, generateAllPrompts, ragEnabled, projectPath]);
}

export function useKnowledgeService() {
  return getKnowledgeService();
}

export function useMemoryService() {
  const { currentProject } = useProjectStore();
  const projectPath = currentProject?.path;

  if (!projectPath) {
    return null;
  }
  return getMemoryService(projectPath);
}

export function useSearchEngine() {
  const { currentProject } = useProjectStore();
  const projectPath = currentProject?.path;

  if (!projectPath) {
    return null;
  }
  return getSearchEngine(projectPath);
}

export function useCurrentSession() {
  const { sessions, currentSessionId } = useSessionStore();
  return sessions.find((s) => s.id === currentSessionId);
}

export function useMessages() {
  const currentSession = useCurrentSession();
  return currentSession?.messages || [];
}
