import { ToolContext } from '../toolRegistry';
import { KnowledgeOpsArgs, ToolResult } from './types';
import { getKnowledgeService } from '../../core/serviceInitializer';
import { KnowledgeService } from '../../knowledge/knowledgeService';

export const knowledgeOpsDefinition = {
  name: 'knowledge_ops',
  description: `统一的资料库操作工具。用于管理用户上传的参考文档（小说、设定、大纲等）。

使用场景：
- 列出资料库文件：action="list"
- 搜索资料库内容：action="search", query="关键词"
- 读取文件内容：action="read" 或 action="get", filename="文件名"

当用户问"资料库有什么"、"查看资料"、"读取资料库内容"时使用此工具。`,
  parameters: {
    action: {
      type: 'string',
      description: '操作类型：list(列出文件) | search(搜索内容) | read/get(读取文件)',
      enum: ['list', 'search', 'get', 'read'],
      required: true,
    },
    query: {
      type: 'string',
      description: '搜索关键词（用于 search 操作）',
    },
    filename: {
      type: 'string',
      description: '文件名（用于 read/get 操作）',
    },
    file: {
      type: 'string',
      description: '文件名（用于 read/get 操作，与 filename 等效）',
    },
    maxResults: {
      type: 'number',
      description: '最大结果数',
      default: 5,
    },
  },
  category: 'knowledge',
};

export async function knowledgeOpsHandler(args: KnowledgeOpsArgs, _context: ToolContext): Promise<ToolResult> {
  const { action, query, file, filename, maxResults = 5 } = args;
  const targetFile = filename || file;
  const knowledgeService = getKnowledgeService();

  if (!knowledgeService) {
    return { success: false, error: '资料库服务未初始化' };
  }

  try {
    switch (action) {
      case 'list':
        return await handleList(knowledgeService);
      case 'search':
        if (!query) {
          return { success: false, error: '搜索操作需要提供 query 参数' };
        }
        return await handleSearch(knowledgeService, query, maxResults);
      case 'get':
      case 'read':
        if (!targetFile) {
          return { success: false, error: '读取文件操作需要提供 filename 参数' };
        }
        return await handleGet(knowledgeService, targetFile);
      default:
        return { success: false, error: `未知操作类型: ${action}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function handleList(knowledgeService: KnowledgeService): Promise<ToolResult> {
  const files = knowledgeService.getAllFiles();
  
  const result = files.map(f => ({
    id: f.id,
    filename: f.filename,
    type: f.type,
    chunkCount: f.chunkCount,
    totalTokens: f.totalTokens,
    indexedAt: f.indexedAt,
  }));

  return {
    success: true,
    result: {
      total: result.length,
      files: result,
    },
  };
}

async function handleSearch(
  knowledgeService: KnowledgeService,
  query: string,
  maxResults: number
): Promise<ToolResult> {
  const searchResults = knowledgeService.search({
    query,
    limit: maxResults,
  });

  const result = searchResults.map(r => ({
    fileId: r.chunk.fileId,
    filename: r.chunk.fileId,
    content: r.chunk.content.substring(0, 500),
    score: r.score,
  }));

  return {
    success: true,
    result: {
      query,
      total: result.length,
      results: result,
    },
  };
}

async function handleGet(
  knowledgeService: KnowledgeService,
  filename: string
): Promise<ToolResult> {
  const files = knowledgeService.getAllFiles();
  const file = files.find(f => f.filename === filename);

  if (!file) {
    return { success: false, error: `文件 "${filename}" 不存在于资料库中` };
  }

  const chunks = knowledgeService.getChunks(file.id);
  const MAX_CONTENT_LENGTH = 50000;
  let content = chunks.map(c => c.content).join('\n\n');
  const truncated = content.length > MAX_CONTENT_LENGTH;
  if (truncated) {
    content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n... [内容过长，已截断，请使用 search 操作搜索具体内容]';
  }

  return {
    success: true,
    result: {
      filename: file.filename,
      type: file.type,
      content,
      chunkCount: chunks.length,
      totalLength: chunks.reduce((sum, c) => sum + c.content.length, 0),
      truncated,
    },
  };
}
