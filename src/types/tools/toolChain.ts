export type ToolChainStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ChainStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface ChainStep {
  id: string;
  name: string;
  toolName: string;
  args: Record<string, unknown>;
  condition?: {
    type: 'always' | 'on_success' | 'on_failure' | 'custom';
    expression?: string;
  };
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  status: ChainStepStatus;
  result?: unknown;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface ToolChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  status: ToolChainStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  context: Record<string, unknown>;
  results: Record<string, unknown>;
}

export interface ToolChainTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<ChainStep, 'id' | 'status' | 'result' | 'error' | 'startTime' | 'endTime'>[];
  variables: ChainVariable[];
}

export interface ChainVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  description: string;
}

export interface ChainExecutionResult {
  chainId: string;
  success: boolean;
  steps: ChainStep[];
  outputs: Record<string, unknown>;
  error?: string;
  duration: number;
}

export const BUILTIN_CHAIN_TEMPLATES: ToolChainTemplate[] = [
  {
    id: 'chain_create_character',
    name: '创建完整角色',
    description: '从用户描述创建角色档案、添加到时间线、建立关系网络',
    category: 'character',
    variables: [
      { name: 'characterDescription', type: 'string', required: true, description: '角色描述' },
      { name: 'relatedCharacters', type: 'array', required: false, description: '关联角色ID列表' },
    ],
    steps: [
      {
        name: '提取角色信息',
        toolName: 'extract_info',
        args: { type: 'character' },
        inputMapping: { text: 'characterDescription' },
        condition: { type: 'always' },
      },
      {
        name: '创建角色档案',
        toolName: 'create_character',
        args: {},
        inputMapping: { characterData: '$step.0.result' },
        outputMapping: { characterId: 'id' },
        condition: { type: 'on_success' },
      },
      {
        name: '添加初始时间线事件',
        toolName: 'add_timeline_event',
        args: { eventType: 'character_introduction' },
        inputMapping: {
          characterId: '$step.1.result.id',
          description: '$step.0.result.background',
        },
        condition: { type: 'on_success' },
      },
      {
        name: '建立角色关系',
        toolName: 'add_relationship',
        args: {},
        inputMapping: { characterId: '$step.1.result.id', relatedIds: 'relatedCharacters' },
        condition: { type: 'on_success' },
      },
    ],
  },
  {
    id: 'chain_create_plot_arc',
    name: '创建剧情弧',
    description: '创建完整的剧情弧，包括起点、转折点、高潮、结局',
    category: 'plot',
    variables: [
      { name: 'arcName', type: 'string', required: true, description: '剧情弧名称' },
      { name: 'arcDescription', type: 'string', required: true, description: '剧情弧描述' },
      { name: 'mainCharacter', type: 'string', required: true, description: '主角ID' },
    ],
    steps: [
      {
        name: '规划剧情节点',
        toolName: 'plan_plot_nodes',
        args: {},
        inputMapping: { name: 'arcName', description: 'arcDescription' },
        condition: { type: 'always' },
      },
      {
        name: '创建剧情线',
        toolName: 'create_plot_line',
        args: {},
        inputMapping: { name: 'arcName', description: 'arcDescription' },
        outputMapping: { plotLineId: 'id' },
        condition: { type: 'on_success' },
      },
      {
        name: '创建起始节点',
        toolName: 'create_plot_node',
        args: { type: 'opening' },
        inputMapping: {
          plotLineId: '$step.1.result.id',
          title: '$step.0.result.opening.title',
          description: '$step.0.result.opening.description',
        },
        condition: { type: 'on_success' },
      },
      {
        name: '创建转折节点',
        toolName: 'create_plot_node',
        args: { type: 'turning_point' },
        inputMapping: {
          plotLineId: '$step.1.result.id',
          title: '$step.0.result.turningPoint.title',
          description: '$step.0.result.turningPoint.description',
        },
        condition: { type: 'on_success' },
      },
      {
        name: '创建高潮节点',
        toolName: 'create_plot_node',
        args: { type: 'climax' },
        inputMapping: {
          plotLineId: '$step.1.result.id',
          title: '$step.0.result.climax.title',
          description: '$step.0.result.climax.description',
        },
        condition: { type: 'on_success' },
      },
      {
        name: '创建结局节点',
        toolName: 'create_plot_node',
        args: { type: 'resolution' },
        inputMapping: {
          plotLineId: '$step.1.result.id',
          title: '$step.0.result.resolution.title',
          description: '$step.0.result.resolution.description',
        },
        condition: { type: 'on_success' },
      },
    ],
  },
  {
    id: 'chain_write_chapter',
    name: '写作章节完整流程',
    description: '从大纲生成章节、风格检查、质量评估、保存文件',
    category: 'writing',
    variables: [
      { name: 'chapterNumber', type: 'number', required: true, description: '章节号' },
      { name: 'chapterOutline', type: 'string', required: true, description: '章节大纲' },
      { name: 'styleProfileId', type: 'string', required: false, description: '风格档案ID' },
    ],
    steps: [
      {
        name: '生成章节初稿',
        toolName: 'generate_content',
        args: { type: 'chapter' },
        inputMapping: { chapterNumber: 'chapterNumber', outline: 'chapterOutline' },
        outputMapping: { draft: 'content' },
        condition: { type: 'always' },
      },
      {
        name: '应用风格',
        toolName: 'apply_style',
        args: {},
        inputMapping: { content: '$step.0.result.content', profileId: 'styleProfileId' },
        outputMapping: { styledContent: 'result' },
        condition: { type: 'on_success' },
      },
      {
        name: '质量评估',
        toolName: 'evaluate_quality',
        args: {},
        inputMapping: { content: '$step.1.result.content' },
        outputMapping: { qualityScore: 'score' },
        condition: { type: 'on_success' },
      },
      {
        name: '保存章节文件',
        toolName: 'save_file',
        args: {},
        inputMapping: { path: '正文/第$var.chapterNumber章.md', content: '$step.1.result.content' },
        condition: { type: 'on_success' },
      },
    ],
  },
  {
    id: 'chain_foreshadowing_cycle',
    name: '伏笔完整周期',
    description: '创建伏笔、埋设暗示、追踪状态、提醒回收',
    category: 'foreshadowing',
    variables: [
      { name: 'foreshadowingName', type: 'string', required: true, description: '伏笔名称' },
      { name: 'foreshadowingContent', type: 'string', required: true, description: '伏笔内容' },
      { name: 'plantedChapter', type: 'number', required: true, description: '埋设章节' },
    ],
    steps: [
      {
        name: '创建伏笔',
        toolName: 'create_foreshadowing',
        args: {},
        inputMapping: { name: 'foreshadowingName', content: 'foreshadowingContent' },
        outputMapping: { foreshadowingId: 'id' },
        condition: { type: 'always' },
      },
      {
        name: '记录埋设节点',
        toolName: 'plant_foreshadowing',
        args: {},
        inputMapping: { id: '$step.0.result.id', chapter: 'plantedChapter' },
        condition: { type: 'on_success' },
      },
      {
        name: '规划暗示节点',
        toolName: 'plan_foreshadowing_hints',
        args: {},
        inputMapping: { foreshadowingId: '$step.0.result.id' },
        condition: { type: 'on_success' },
      },
    ],
  },
  {
    id: 'chain_worldbuilding',
    name: '世界观构建',
    description: '从类型推荐创建完整世界观设定',
    category: 'setting',
    variables: [
      { name: 'novelType', type: 'string', required: true, description: '小说类型' },
      { name: 'theme', type: 'string', required: false, description: '主题' },
    ],
    steps: [
      {
        name: '获取类型推荐设定',
        toolName: 'get_type_recommendations',
        args: {},
        inputMapping: { type: 'novelType' },
        condition: { type: 'always' },
      },
      {
        name: '生成力量体系',
        toolName: 'generate_power_system',
        args: {},
        inputMapping: { type: 'novelType', theme: 'theme' },
        outputMapping: { powerSystem: 'result' },
        condition: { type: 'on_success' },
      },
      {
        name: '生成地理设定',
        toolName: 'generate_geography',
        args: {},
        inputMapping: { type: 'novelType' },
        outputMapping: { geography: 'result' },
        condition: { type: 'on_success' },
      },
      {
        name: '生成历史背景',
        toolName: 'generate_history',
        args: {},
        inputMapping: { type: 'novelType', powerSystem: '$step.1.result' },
        outputMapping: { history: 'result' },
        condition: { type: 'on_success' },
      },
      {
        name: '保存世界观文件',
        toolName: 'save_file',
        args: {},
        inputMapping: {
          path: '设定/世界观设定.md',
          content: '$step.1.result + $step.2.result + $step.3.result',
        },
        condition: { type: 'on_success' },
      },
    ],
  },
];

export const CHAIN_CATEGORIES = [
  { id: 'character', name: '角色相关', icon: '👤' },
  { id: 'plot', name: '剧情相关', icon: '📖' },
  { id: 'writing', name: '写作相关', icon: '✍️' },
  { id: 'foreshadowing', name: '伏笔相关', icon: '🔗' },
  { id: 'setting', name: '设定相关', icon: '🌍' },
  { id: 'quality', name: '质量相关', icon: '⭐' },
];
