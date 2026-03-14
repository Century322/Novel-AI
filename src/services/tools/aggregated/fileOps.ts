import { ToolContext } from '../toolRegistry';
import { FileOpsArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';
import { workshopService } from '../../core/workshopService';

export const fileOpsDefinition = {
  name: 'file_ops',
  description: `统一的文件操作工具。用于读写项目文件。

支持的操作：
- read: 读取文件内容
- write: 写入文件内容
- delete: 删除文件
- list: 列出目录内容
- search: 搜索文件内容
- tree: 获取目录树结构
- stats: 获取项目统计
- chapters: 获取章节列表

使用示例：
- file_ops({ action: "read", path: "章节/第一章.md" })
- file_ops({ action: "write", path: "章节/第二章.md", content: "..." })
- file_ops({ action: "list", path: "章节" })`,
  parameters: {
    action: {
      type: 'string' as const,
      description: '操作类型：read | write | delete | list | search | tree | stats | chapters',
      enum: ['read', 'write', 'delete', 'list', 'search', 'tree', 'stats', 'chapters'],
      required: true,
    },
    path: {
      type: 'string' as const,
      description: '文件或目录路径',
    },
    content: {
      type: 'string' as const,
      description: '写入内容（write 操作需要）',
    },
    recursive: {
      type: 'boolean' as const,
      description: '是否递归（list 操作）',
    },
    query: {
      type: 'string' as const,
      description: '搜索关键词（search 操作)',
    },
    maxResults: {
      type: 'number' as const,
      description: '最大结果数',
    },
  },
  category: 'file',
};

export async function fileOpsHandler(args: FileOpsArgs, _context: ToolContext): Promise<ToolResult> {
  const { action, path, content, query, maxResults = 10 } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  const projectPath = services.container.getProjectPath();

  try {
    switch (action) {
      case 'read':
        if (!path) return { success: false, error: 'read 操作需要 path 参数' };
        return await handleRead(projectPath, path);
      case 'write':
        if (!path) return { success: false, error: 'write 操作需要 path 参数' };
        if (!content) return { success: false, error: 'write 操作需要 content 参数' };
        return await handleWrite(projectPath, path, content);
      case 'delete':
        if (!path) return { success: false, error: 'delete 操作需要 path 参数' };
        return await handleDelete(projectPath, path);
      case 'list':
        return await handleList(projectPath, path);
      case 'search':
        if (!query) return { success: false, error: 'search 操作需要 query 参数' };
        return await handleSearch(projectPath, query, maxResults);
      case 'tree':
        return await handleTree(projectPath);
      case 'stats':
        return await handleStats(projectPath);
      case 'chapters':
        return await handleChapters(projectPath);
      default:
        return { success: false, error: `未知操作类型: ${action}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function handleRead(projectPath: string, filePath: string): Promise<ToolResult> {
  const fullPath = `${projectPath}/${filePath}`;
  const content = await workshopService.readFile(fullPath);
  if (!content) {
    return { success: false, error: `文件 "${filePath}" 不存在或无法读取` };
  }
  return {
    success: true,
    result: {
      path: filePath,
      content,
      size: content.length,
    },
  };
}

async function handleWrite(projectPath: string, filePath: string, content: string): Promise<ToolResult> {
  const fullPath = `${projectPath}/${filePath}`;
  await workshopService.writeFile(fullPath, content);
  return {
    success: true,
    result: {
      path: filePath,
      size: content.length,
      message: '文件写入成功',
    },
  };
}

async function handleDelete(projectPath: string, filePath: string): Promise<ToolResult> {
  const fullPath = `${projectPath}/${filePath}`;
  await workshopService.deleteFile(fullPath);
  return {
    success: true,
    result: {
      path: filePath,
      message: '文件删除成功',
    },
  };
}

async function handleList(projectPath: string, dirPath?: string): Promise<ToolResult> {
  const fullPath = dirPath ? `${projectPath}/${dirPath}` : projectPath;
  const entries = await workshopService.readDirectory(fullPath);
  const items: Array<{ name: string; type: 'file' | 'directory'; path: string }> = [];
  for (const entry of entries) {
    const itemPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
    items.push({
      name: entry.name,
      type: entry.isDirectory ? 'directory' : 'file',
      path: itemPath,
    });
  }
  return {
    success: true,
    result: {
      path: dirPath || '/',
      total: items.length,
      items,
    },
  };
}

async function handleSearch(projectPath: string, query: string, maxResults: number): Promise<ToolResult> {
  const results: Array<{ path: string; line: number; content: string }> = [];

  async function searchInDir(dirPath: string): Promise<void> {
    const dirEntries = await workshopService.readDirectory(dirPath);
    for (const entry of dirEntries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory) {
        await searchInDir(entry.path);
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
        const content = await workshopService.readFile(entry.path);
        if (!content) continue;
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            results.push({
              path: entry.path.replace(projectPath, ''),
              line: i + 1,
              content: lines[i].trim().substring(0, 200),
            });
            if (results.length >= maxResults) return;
          }
        }
      }
      if (results.length >= maxResults) return;
    }
  }

  await searchInDir(projectPath);

  return {
    success: true,
    result: {
      query,
      total: results.length,
      results,
    },
  };
}

async function handleTree(projectPath: string): Promise<ToolResult> {
  async function buildTree(dirPath: string, depth: number = 0): Promise<unknown> {
    if (depth > 3) return null;
    const entries = await workshopService.readDirectory(dirPath);
    const items: unknown[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const itemPath = `${dirPath}/${entry.name}`;
      if (entry.isDirectory) {
        const children = await buildTree(itemPath, depth + 1);
        items.push({
          name: entry.name,
          type: 'directory',
          children,
        });
      } else {
        items.push({
          name: entry.name,
          type: 'file',
          extension: entry.name.split('.').pop(),
        });
      }
    }
    return items;
  }
  const tree = await buildTree(projectPath);
  return { success: true, result: { type: 'tree', root: projectPath, tree } };
}

async function handleStats(projectPath: string): Promise<ToolResult> {
  let totalFiles = 0;
  let totalDirs = 0;
  const extensions: Record<string, number> = {};

  async function scan(dirPath: string): Promise<void> {
    const entries = await workshopService.readDirectory(dirPath);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory) {
        totalDirs++;
        await scan(entry.path);
      } else {
        totalFiles++;
        const ext = entry.name.split('.').pop() || 'unknown';
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    }
  }

  await scan(projectPath);
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
  const chapters: Array<{ name: string; path: string; order: number }> = [];

  async function scanForChapters(dirPath: string): Promise<void> {
    const entries = await workshopService.readDirectory(dirPath);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory) {
        await scanForChapters(entry.path);
      } else {
        const name = entry.name.toLowerCase();
        if (
          name.includes('chapter') ||
          name.includes('章') ||
          /^\d+[-_.]/.test(name) ||
          /第\d+章/.test(name)
        ) {
          const orderMatch = entry.name.match(/(\d+)/);
          chapters.push({
            name: entry.name,
            path: entry.path.replace(projectPath, ''),
            order: orderMatch ? parseInt(orderMatch[1], 10) : chapters.length + 1,
          });
        }
      }
    }
  }

  await scanForChapters(projectPath);
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
