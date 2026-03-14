import { useMemo, useEffect, useRef } from 'react';
import { useSessionStore, useFileStore, useUIStore, useSkillStore, useWorkshopStore } from '@/store';
import { SYSTEM_PROMPT_TEMPLATE } from '@/constants';
import { getFileStructure, findNode } from '@/utils';
import { MemoryService, SearchEngine } from '@/services/knowledge/memoryService';
import { useFileTreeFromProject } from '@/store/fileStore';
import { logger } from '@/services/core/loggerService';
import { fileSystemService } from '@/services/core/fileSystemService';
import {
  getKnowledgeService as getGlobalKnowledgeService,
  getMemoryService as getGlobalMemoryService,
} from '@/services/core/serviceInitializer';

const memoryServiceCache = new Map<string, MemoryService>();
const searchEngineCache = new Map<string, SearchEngine>();

function getKnowledgeService() {
  return getGlobalKnowledgeService();
}

function getMemoryService(projectPath: string): MemoryService | null {
  const globalService = getGlobalMemoryService();
  if (globalService) return globalService;
  
  if (!memoryServiceCache.has(projectPath)) {
    const { MemoryService } = require('@/services/knowledge/memoryService');
    memoryServiceCache.set(projectPath, new MemoryService(projectPath));
  }
  return memoryServiceCache.get(projectPath)!;
}

function getSearchEngine(projectPath: string): SearchEngine | null {
  const knowledgeService = getKnowledgeService();
  const memoryService = getMemoryService(projectPath);
  
  if (!knowledgeService || !memoryService) {
    return null;
  }
  
  if (!searchEngineCache.has(projectPath)) {
    searchEngineCache.set(projectPath, new SearchEngine(knowledgeService, memoryService));
  }
  return searchEngineCache.get(projectPath)!;
}

export function useSystemContext() {
  const { ragEnabled } = useUIStore();
  const { generateAllPrompts } = useSkillStore();
  const { selectedFilePath } = useFileStore();
  const { projectPath } = useWorkshopStore();
  const fileNodes = useFileTreeFromProject();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!ragEnabled) {
      return;
    }
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const knowledgeService = getKnowledgeService();
    if (knowledgeService) {
      knowledgeService.initialize().catch((error) =>
        logger.error('初始化知识服务失败', { error })
      );
    }

    if (projectPath) {
      const memoryService = getMemoryService(projectPath);
      if (memoryService) {
        memoryService.initialize().catch((error) =>
          logger.error('初始化记忆服务失败', { error })
        );
      }
    }
  }, [ragEnabled, projectPath]);

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
      context += '\n\n【当前激活的技能模板】\n';
      context += skillPrompts;
    }

    if (projectPath) {
      context += `\n\n【当前项目: ${fileSystemService.getProjectName()}】\n`;
      context += getFileStructure(fileNodes);
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
      if (memoryService) {
        const projectSummary = memoryService.getProjectSummary();
        if (projectSummary && projectSummary !== '# 项目记忆摘要\n\n') {
          context += `\n\n【项目记忆】\n${projectSummary}`;
        }
      }
    }

    const knowledgeService = getKnowledgeService();
    if (knowledgeService) {
      const files = knowledgeService.getAllFiles();
      if (files.length > 0) {
        context += `\n\n【资料库】\n当前资料库中有 ${files.length} 个文件：\n`;
        for (const file of files.slice(0, 10)) {
          context += `- ${file.filename} (${file.type}, ${file.chunkCount}个分块)\n`;
        }
        if (files.length > 10) {
          context += `... 还有 ${files.length - 10} 个文件\n`;
        }
        context += '\n【读取资料库内容的方法】\n';
        context += '使用工具: knowledge_ops({"action": "read", "filename": "文件名"})\n';
        context += '使用工具: knowledge_ops({"action": "search", "query": "关键词"})\n';
        context += '\n【重要】学习写作风格时，必须使用 knowledge_ops 的 read action 获取完整内容！\n';
      }
    }

    context += '\n\n【读取文件树文件的方法】\n';
    context += '使用工具: file_ops({"action": "read", "path": "文件路径"})\n';

    context += '\n\n(你可以读取以上文件的内容来保持剧情连贯性)\n';

    return context;
  }, [projectPath, fileNodes, selectedFilePath, generateAllPrompts, ragEnabled]);
}

export function useKnowledgeService() {
  return getKnowledgeService();
}

export function useMemoryService() {
  const { projectPath } = useWorkshopStore();

  if (!projectPath) {
    return null;
  }
  return getMemoryService(projectPath);
}

export function useSearchEngine() {
  const { projectPath } = useWorkshopStore();

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
  const sessions = useSessionStore((state) => state.sessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  return currentSession?.messages || [];
}
