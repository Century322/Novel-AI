export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  type: ToolParameterType;
  description: string;
  enum?: string[];
  default?: unknown;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required?: string[];
  returns?: {
    type: ToolParameterType;
    description: string;
  };
  examples?: {
    input: Record<string, unknown>;
    output: unknown;
  }[];
  category?: string;
  dangerous?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

export interface ToolContext {
  projectPath: string;
  sessionId: string;
  userId?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface ToolRegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  registeredAt: number;
  callCount: number;
  lastCalledAt?: number;
}

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取项目中的文件内容',
    parameters: {
      path: {
        type: 'string',
        description: '文件路径（相对于项目根目录）',
        required: true,
      },
      encoding: {
        type: 'string',
        description: '文件编码，默认 utf-8',
        default: 'utf-8',
      },
    },
    required: ['path'],
    returns: {
      type: 'string',
      description: '文件内容',
    },
    category: 'file',
  },
  {
    name: 'write_file',
    description: '写入内容到项目文件',
    parameters: {
      path: {
        type: 'string',
        description: '文件路径（相对于项目根目录）',
        required: true,
      },
      content: {
        type: 'string',
        description: '要写入的内容',
        required: true,
      },
      mode: {
        type: 'string',
        description: '写入模式： overwrite（覆盖）, append（追加）, prepend（前置）',
        enum: ['overwrite', 'append', 'prepend'],
        default: 'overwrite',
      },
    },
    required: ['path', 'content'],
    category: 'file',
    dangerous: true,
  },
  {
    name: 'delete_file',
    description: '删除项目中的文件',
    parameters: {
      path: {
        type: 'string',
        description: '要删除的文件路径',
        required: true,
      },
    },
    required: ['path'],
    category: 'file',
    dangerous: true,
  },
  {
    name: 'list_directory',
    description: '列出目录中的文件和子目录',
    parameters: {
      path: {
        type: 'string',
        description: '目录路径，默认为项目根目录',
        default: '.',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录',
        default: false,
      },
    },
    returns: {
      type: 'array',
      description: '文件和目录列表',
    },
    category: 'file',
  },
  {
    name: 'search_content',
    description: '在项目文件中搜索内容',
    parameters: {
      query: {
        type: 'string',
        description: '搜索关键词或正则表达式',
        required: true,
      },
      filePattern: {
        type: 'string',
        description: '文件名模式，如 *.txt',
        default: '*',
      },
      maxResults: {
        type: 'number',
        description: '最大返回结果数',
        default: 10,
      },
    },
    required: ['query'],
    returns: {
      type: 'array',
      description: '搜索结果列表',
    },
    category: 'search',
  },
  {
    name: 'get_character_info',
    description: '获取小说中人物的信息',
    parameters: {
      name: {
        type: 'string',
        description: '人物名称',
        required: true,
      },
    },
    required: ['name'],
    returns: {
      type: 'object',
      description: '人物信息',
    },
    category: 'novel',
  },
  {
    name: 'add_character',
    description: '添加或更新小说人物',
    parameters: {
      name: {
        type: 'string',
        description: '人物名称',
        required: true,
      },
      role: {
        type: 'string',
        description: '人物角色类型',
        enum: ['protagonist', 'antagonist', 'supporting', 'minor'],
        default: 'supporting',
      },
      description: {
        type: 'string',
        description: '人物描述',
      },
      traits: {
        type: 'array',
        description: '人物特质列表',
      },
    },
    required: ['name'],
    category: 'novel',
  },
  {
    name: 'get_timeline',
    description: '获取小说时间线事件',
    parameters: {
      startChapter: {
        type: 'string',
        description: '起始章节',
      },
      endChapter: {
        type: 'string',
        description: '结束章节',
      },
    },
    returns: {
      type: 'array',
      description: '时间线事件列表',
    },
    category: 'novel',
  },
  {
    name: 'add_plot_event',
    description: '添加情节事件到时间线',
    parameters: {
      chapter: {
        type: 'string',
        description: '章节',
        required: true,
      },
      event: {
        type: 'string',
        description: '事件描述',
        required: true,
      },
      characters: {
        type: 'array',
        description: '涉及的人物',
      },
      importance: {
        type: 'number',
        description: '重要程度 0-1',
        default: 0.5,
      },
    },
    required: ['chapter', 'event'],
    category: 'novel',
  },
  {
    name: 'add_foreshadowing',
    description: '添加伏笔',
    parameters: {
      content: {
        type: 'string',
        description: '伏笔内容',
        required: true,
      },
      plantedAt: {
        type: 'string',
        description: '埋设位置（章节）',
        required: true,
      },
      importance: {
        type: 'number',
        description: '重要程度 0-1',
        default: 0.5,
      },
    },
    required: ['content', 'plantedAt'],
    category: 'novel',
  },
  {
    name: 'resolve_foreshadowing',
    description: '回收伏笔',
    parameters: {
      id: {
        type: 'string',
        description: '伏笔ID',
      },
      resolvedAt: {
        type: 'string',
        description: '回收位置（章节）',
        required: true,
      },
    },
    required: ['resolvedAt'],
    category: 'novel',
  },
  {
    name: 'analyze_content',
    description: '分析小说内容质量',
    parameters: {
      content: {
        type: 'string',
        description: '要分析的内容',
        required: true,
      },
      aspects: {
        type: 'array',
        description: '要分析的方面',
        enum: [
          'coherence',
          'creativity',
          'character_consistency',
          'plot_logic',
          'language_quality',
          'pacing',
          'dialogue',
          'description',
          'emotional_impact',
          'originality',
        ],
      },
    },
    required: ['content'],
    returns: {
      type: 'object',
      description: '分析结果',
    },
    category: 'analysis',
  },
  {
    name: 'get_writing_context',
    description: '获取当前写作上下文（压缩后的）',
    parameters: {
      focusCharacter: {
        type: 'string',
        description: '聚焦的人物',
      },
      focusLocation: {
        type: 'string',
        description: '聚焦的地点',
      },
      maxTokens: {
        type: 'number',
        description: '最大 Token 数',
        default: 4000,
      },
    },
    returns: {
      type: 'string',
      description: '压缩后的上下文',
    },
    category: 'context',
  },
  {
    name: 'learn_style',
    description: '从内容中学习写作风格',
    parameters: {
      content: {
        type: 'string',
        description: '用于学习的内容样本',
        required: true,
      },
      genre: {
        type: 'string',
        description: '内容类型',
      },
    },
    required: ['content'],
    category: 'style',
  },
  {
    name: 'generate_content',
    description: '使用 AI 生成小说内容',
    parameters: {
      prompt: {
        type: 'string',
        description: '生成提示',
        required: true,
      },
      style: {
        type: 'string',
        description: '写作风格',
      },
      length: {
        type: 'number',
        description: '目标长度（字数）',
        default: 500,
      },
      temperature: {
        type: 'number',
        description: '创意程度 0-1',
        default: 0.7,
      },
    },
    required: ['prompt'],
    category: 'generation',
  },
  {
    name: 'continue_writing',
    description: '续写小说内容',
    parameters: {
      context: {
        type: 'string',
        description: '前文内容',
        required: true,
      },
      direction: {
        type: 'string',
        description: '续写方向提示',
      },
      length: {
        type: 'number',
        description: '续写长度（字数）',
        default: 300,
      },
    },
    required: ['context'],
    category: 'generation',
  },
  {
    name: 'revise_content',
    description: '修改小说内容',
    parameters: {
      content: {
        type: 'string',
        description: '要修改的内容',
        required: true,
      },
      instructions: {
        type: 'string',
        description: '修改指令',
        required: true,
      },
      preserveStyle: {
        type: 'boolean',
        description: '是否保持原有风格',
        default: true,
      },
    },
    required: ['content', 'instructions'],
    category: 'generation',
  },
];

export const TOOL_CATEGORIES = {
  file: '文件操作',
  search: '搜索查询',
  novel: '小说管理',
  analysis: '内容分析',
  context: '上下文管理',
  style: '风格学习',
  generation: '内容生成',
};
