import { ToolContext } from '../toolRegistry';
import { ProjectContextArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';
import { workshopService } from '../../core/workshopService';

export const projectContextDefinition = {
  name: 'project_context',
  description: `获取项目上下文信息。用于了解当前小说项目的整体结构。

使用场景：
- 获取目录结构：type="tree"
- 获取项目统计：type="stats"
- 获取章节列表：type="chapters"

在开始写作任务前，建议先调用此工具了解项目结构。`,
  parameters: {
    type: {
      type: 'string',
      description: '信息类型：tree(目录结构) | stats(项目统计) | chapters(章节列表)',
      enum: ['tree', 'stats', 'chapters'],
      required: true,
    },
  },
  category: 'project',
};

export async function projectContextHandler(args: ProjectContextArgs, _context: ToolContext): Promise<ToolResult> {
  const { type } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  const projectPath = services.container.getProjectPath();

  try {
    switch (type) {
      case 'tree':
        return await handleTree(projectPath);
      case 'stats':
        return await handleStats(projectPath);
      case 'chapters':
        return await handleChapters(projectPath);
      default:
        return { success: false, error: `未知类型: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function collectAllFiles(dirPath: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> {
  const results: Array<{ name: string; path: string; isDirectory: boolean }> = [];
  
  async function scan(path: string): Promise<void> {
    const entries = await workshopService.readDirectory(path);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.isDirectory,
      });
      if (entry.isDirectory) {
        await scan(entry.path);
      }
    }
  }
  
  await scan(dirPath);
  return results;
}

async function handleTree(projectPath: string): Promise<ToolResult> {
  const files = await collectAllFiles(projectPath);
  
  const tree = files.map(f => ({
    name: f.name,
    type: f.isDirectory ? 'directory' : 'file',
    path: f.path,
  }));

  return {
    success: true,
    result: {
      type: 'tree',
      root: projectPath,
      total: tree.length,
      items: tree.slice(0, 100),
    },
  };
}

async function handleStats(projectPath: string): Promise<ToolResult> {
  const files = await collectAllFiles(projectPath);
  
  let totalFiles = 0;
  let totalDirs = 0;
  const extensions: Record<string, number> = {};

  for (const file of files) {
    if (file.isDirectory) {
      totalDirs++;
    } else {
      totalFiles++;
      const ext = file.name.split('.').pop() || 'unknown';
      extensions[ext] = (extensions[ext] || 0) + 1;
    }
  }

  return {
    success: true,
    result: {
      type: 'stats',
      totalFiles,
      totalDirs,
      extensions,
    },
  };
}

async function handleChapters(projectPath: string): Promise<ToolResult> {
  const files = await collectAllFiles(projectPath);
  
  const chapters: Array<{ name: string; path: string; order: number }> = [];

  for (const file of files) {
    if (file.isDirectory) continue;
    
    const name = file.name.toLowerCase();
    if (
      name.includes('chapter') ||
      name.includes('章') ||
      /^\d+[-_.]/.test(name) ||
      /第\d+章/.test(name)
    ) {
      const orderMatch = file.name.match(/(\d+)/);
      chapters.push({
        name: file.name,
        path: file.path,
        order: orderMatch ? parseInt(orderMatch[1], 10) : chapters.length + 1,
      });
    }
  }

  chapters.sort((a, b) => a.order - b.order);

  return {
    success: true,
    result: {
      type: 'chapters',
      total: chapters.length,
      chapters,
    },
  };
}
