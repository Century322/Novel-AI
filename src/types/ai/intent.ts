export type IntentCategory =
  | 'creation'
  | 'query'
  | 'modification'
  | 'management'
  | 'analysis'
  | 'learning'
  | 'chat'
  | 'unknown';

export type CreationIntent =
  | 'write_chapter'
  | 'continue_writing'
  | 'write_outline'
  | 'write_character'
  | 'write_worldbuilding'
  | 'write_scene'
  | 'write_dialogue';

export type QueryIntent =
  | 'get_character_info'
  | 'get_timeline'
  | 'get_plot_info'
  | 'get_worldbuilding'
  | 'search_content'
  | 'get_foreshadowing';

export type ModificationIntent =
  | 'revise_content'
  | 'polish_content'
  | 'expand_content'
  | 'shorten_content'
  | 'change_style';

export type ManagementIntent =
  | 'add_character'
  | 'update_character'
  | 'add_plot_event'
  | 'add_foreshadowing'
  | 'resolve_foreshadowing'
  | 'add_worldbuilding';

export type AnalysisIntent =
  | 'analyze_content'
  | 'analyze_character'
  | 'analyze_plot'
  | 'analyze_style'
  | 'check_consistency';

export type LearningIntent = 'learn_style' | 'learn_from_reference' | 'analyze_reference';

export type ChatIntent = 'greeting' | 'question' | 'discussion' | 'brainstorm';

export type SpecificIntent =
  | CreationIntent
  | QueryIntent
  | ModificationIntent
  | ManagementIntent
  | AnalysisIntent
  | LearningIntent
  | ChatIntent;

export interface IntentResult {
  category: IntentCategory;
  specificIntent: SpecificIntent;
  confidence: number;
  tools: ToolRecommendation[];
  context: {
    characters?: string[];
    chapters?: string[];
    files?: string[];
    topics?: string[];
  };
  reasoning: string;
}

export interface ToolRecommendation {
  toolName: string;
  priority: 'primary' | 'secondary' | 'optional';
  args: Record<string, unknown>;
  reason: string;
}

export interface IntentContext {
  projectPath: string;
  sessionId: string;
  conversationHistory: ConversationMessage[];
  existingCharacters: string[];
  existingChapters: string[];
  currentPlotStage?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export const INTENT_TOOL_MAPPING: Record<IntentCategory, Record<string, string[]>> = {
  creation: {
    write_chapter: ['generate_content', 'write_file'],
    continue_writing: ['continue_writing'],
    write_outline: ['generate_content', 'write_file'],
    write_character: ['add_character', 'write_file'],
    write_worldbuilding: ['write_file'],
    write_scene: ['generate_content'],
    write_dialogue: ['generate_content'],
  },
  query: {
    get_character_info: ['get_character_info'],
    get_timeline: ['get_timeline'],
    get_plot_info: ['search_content'],
    get_worldbuilding: ['read_file', 'search_content'],
    search_content: ['search_content'],
    get_foreshadowing: ['search_content'],
  },
  modification: {
    revise_content: ['revise_content'],
    polish_content: ['revise_content'],
    expand_content: ['generate_content'],
    shorten_content: ['revise_content'],
    change_style: ['revise_content'],
  },
  management: {
    add_character: ['add_character'],
    update_character: ['write_file'],
    add_plot_event: ['add_plot_event'],
    add_foreshadowing: ['add_foreshadowing'],
    resolve_foreshadowing: ['write_file'],
    add_worldbuilding: ['write_file'],
  },
  analysis: {
    analyze_content: ['analyze_content'],
    analyze_character: ['get_character_info', 'analyze_content'],
    analyze_plot: ['search_content', 'analyze_content'],
    analyze_style: ['learn_style'],
    check_consistency: ['search_content', 'analyze_content'],
  },
  learning: {
    learn_style: ['learn_style'],
    learn_from_reference: ['learn_style'],
    analyze_reference: ['learn_style', 'analyze_content'],
  },
  chat: {
    greeting: [],
    question: [],
    discussion: [],
    brainstorm: [],
  },
  unknown: {},
};

export const INTENT_EXAMPLES: Record<SpecificIntent, string[]> = {
  write_chapter: ['写第一章', '生成第三章内容', '帮我写这一章'],
  continue_writing: ['续写', '继续写', '接着写下去', '往下写'],
  write_outline: ['写大纲', '生成大纲', '帮我规划大纲'],
  write_character: ['写人物设定', '创建人物', '添加角色'],
  write_worldbuilding: ['写世界观', '设定世界观', '创建设定'],
  write_scene: ['写一个场景', '描写战斗场景', '写一段对话'],
  write_dialogue: ['写对话', '生成对话', '帮我写人物对话'],
  get_character_info: ['查询人物', '人物信息', '主角是谁', '分析人物'],
  get_timeline: ['时间线', '查看时间线', '剧情时间'],
  get_plot_info: ['剧情信息', '查询剧情', '故事发展'],
  get_worldbuilding: ['世界观设定', '查看设定', '设定信息'],
  search_content: ['搜索', '查找', '有没有提到'],
  get_foreshadowing: ['伏笔', '查看伏笔', '伏笔列表'],
  revise_content: ['修改', '改一下', '帮我改'],
  polish_content: ['润色', '优化', '修饰一下', '改得更好'],
  expand_content: ['扩写', '写长一点', '详细写'],
  shorten_content: ['缩写', '精简', '写短一点'],
  change_style: ['换个风格', '用另一种风格写', '改变文风'],
  add_character: ['添加人物', '新建角色', '增加人物'],
  update_character: ['修改人物', '更新角色', '改一下人物设定'],
  add_plot_event: ['添加剧情', '记录事件', '添加情节'],
  add_foreshadowing: ['埋伏笔', '添加伏笔', '设置伏笔'],
  resolve_foreshadowing: ['回收伏笔', '伏笔回收', '揭示伏笔'],
  add_worldbuilding: ['添加设定', '新建设定', '补充世界观'],
  analyze_content: ['分析内容', '评估质量', '检查问题'],
  analyze_character: ['分析人物', '人物分析', '角色深度'],
  analyze_plot: ['分析剧情', '剧情分析', '故事结构'],
  analyze_style: ['分析风格', '文风分析', '写作特点'],
  check_consistency: ['检查一致性', '有没有矛盾', '前后是否一致'],
  learn_style: ['学习风格', '分析文风', '学习这种写法'],
  learn_from_reference: ['学习参考', '参考这个写法', '模仿这种风格'],
  analyze_reference: ['分析参考', '分析这个作品', '学习这个小说'],
  greeting: ['你好', '嗨', '在吗', 'hello'],
  question: ['什么是', '为什么', '怎么', '如何'],
  discussion: ['讨论一下', '聊聊', '说说你的看法'],
  brainstorm: ['头脑风暴', '给点灵感', '帮我想想', '创意'],
};
