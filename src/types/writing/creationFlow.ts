export type CreationStage =
  | 'concept'
  | 'worldbuilding'
  | 'characters'
  | 'outline'
  | 'writing'
  | 'revision'
  | 'complete';

export type StageStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface CreationStep {
  id: string;
  title: string;
  description: string;
  stage: CreationStage;
  required: boolean;
  dependencies: string[];
  prompts: string[];
  examples: string[];
  outputType: 'document' | 'choice' | 'input' | 'confirmation';
}

export interface StageInfo {
  stage: CreationStage;
  name: string;
  description: string;
  icon: string;
  steps: CreationStep[];
  nextStage: CreationStage | null;
  prevStage: CreationStage | null;
}

export interface CreationProgress {
  currentStage: CreationStage;
  currentStep: string | null;
  completedSteps: string[];
  stageStatus: Record<CreationStage, StageStatus>;
  percentage: number;
}

export interface GuidedQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'multiselect' | 'number';
  options?: GuidedOption[];
  placeholder?: string;
  required: boolean;
  helpText?: string;
}

export interface GuidedOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

export interface GuidedCard {
  id: string;
  type: 'question' | 'confirmation' | 'progress' | 'suggestion' | 'action';
  title: string;
  content: string;
  questions?: GuidedQuestion[];
  actions?: GuidedAction[];
  data?: Record<string, unknown>;
}

export interface GuidedAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  icon?: string;
  action: string;
}

export const CREATION_STAGES: Record<CreationStage, StageInfo> = {
  concept: {
    stage: 'concept',
    name: '创意构思',
    description: '确定小说的核心创意、主题和类型',
    icon: '💡',
    steps: [
      {
        id: 'concept_type',
        title: '选择小说类型',
        description: '确定你的小说属于什么类型',
        stage: 'concept',
        required: true,
        dependencies: [],
        prompts: ['你想写什么类型的小说？'],
        examples: ['玄幻修仙', '都市异能', '科幻未来', '历史架空', '悬疑推理', '青春校园'],
        outputType: 'choice',
      },
      {
        id: 'concept_theme',
        title: '确定核心主题',
        description: '小说想表达什么核心思想',
        stage: 'concept',
        required: true,
        dependencies: ['concept_type'],
        prompts: ['你的小说想表达什么主题？', '主角的成长故事想传达什么？'],
        examples: ['逆袭成长', '探索真相', '守护爱情', '追求自由'],
        outputType: 'input',
      },
      {
        id: 'concept_hook',
        title: '设定核心卖点',
        description: '吸引读者的核心元素',
        stage: 'concept',
        required: false,
        dependencies: ['concept_type'],
        prompts: ['你的小说有什么独特之处？', '读者为什么要看你的小说？'],
        examples: ['独特的金手指设定', '新颖的世界观', '有趣的人物关系'],
        outputType: 'input',
      },
    ],
    nextStage: 'worldbuilding',
    prevStage: null,
  },
  worldbuilding: {
    stage: 'worldbuilding',
    name: '世界观设定',
    description: '构建小说的世界观体系',
    icon: '🌍',
    steps: [
      {
        id: 'world_background',
        title: '世界背景',
        description: '设定故事发生的时代和背景',
        stage: 'worldbuilding',
        required: true,
        dependencies: [],
        prompts: ['故事发生在什么样的世界？', '这个世界有什么特点？'],
        examples: ['古代修仙世界', '现代都市', '未来科幻世界', '异世界'],
        outputType: 'input',
      },
      {
        id: 'world_power',
        title: '力量体系',
        description: '设定世界的力量/等级体系',
        stage: 'worldbuilding',
        required: false,
        dependencies: ['world_background'],
        prompts: ['这个世界有力量体系吗？', '等级是如何划分的？'],
        examples: ['修仙境界：炼气-筑基-金丹-元婴...', '武者等级：一阶到九阶'],
        outputType: 'input',
      },
      {
        id: 'world_factions',
        title: '势力分布',
        description: '设定世界中的主要势力',
        stage: 'worldbuilding',
        required: false,
        dependencies: ['world_background'],
        prompts: ['这个世界有哪些势力？', '势力之间的关系如何？'],
        examples: ['正道联盟 vs 魔教', '三大帝国', '五大宗门'],
        outputType: 'input',
      },
    ],
    nextStage: 'characters',
    prevStage: 'concept',
  },
  characters: {
    stage: 'characters',
    name: '人物设定',
    description: '创建小说中的主要人物',
    icon: '👥',
    steps: [
      {
        id: 'char_protagonist',
        title: '主角设定',
        description: '创建主角的基本信息',
        stage: 'characters',
        required: true,
        dependencies: [],
        prompts: ['主角叫什么名字？', '主角的性格是怎样的？', '主角有什么背景？'],
        examples: ['林风：穿越者，程序员，理性冷静', '苏婉：天才少女，傲娇，内心善良'],
        outputType: 'input',
      },
      {
        id: 'char_goldfinger',
        title: '金手指设定',
        description: '主角的特殊能力或优势',
        stage: 'characters',
        required: false,
        dependencies: ['char_protagonist'],
        prompts: ['主角有什么特殊能力？', '主角的优势是什么？'],
        examples: ['属性面板：可以看到万物属性', '系统：完成任务获得奖励'],
        outputType: 'input',
      },
      {
        id: 'char_supporting',
        title: '配角设定',
        description: '创建重要的配角',
        stage: 'characters',
        required: false,
        dependencies: ['char_protagonist'],
        prompts: ['有哪些重要配角？', '他们与主角的关系？'],
        examples: ['师兄张三：热心肠，主角的引路人', '师姐李四：高冷，暗中帮助主角'],
        outputType: 'input',
      },
      {
        id: 'char_antagonist',
        title: '反派设定',
        description: '创建反派角色',
        stage: 'characters',
        required: false,
        dependencies: ['char_protagonist'],
        prompts: ['主要反派是谁？', '反派的动机是什么？'],
        examples: ['赵无极：表面正派，实为魔教卧底', '魔尊：追求力量，想统治世界'],
        outputType: 'input',
      },
    ],
    nextStage: 'outline',
    prevStage: 'worldbuilding',
  },
  outline: {
    stage: 'outline',
    name: '大纲规划',
    description: '规划小说的整体剧情走向',
    icon: '📝',
    steps: [
      {
        id: 'outline_main',
        title: '主线剧情',
        description: '规划主线剧情的发展',
        stage: 'outline',
        required: true,
        dependencies: [],
        prompts: ['主线剧情是什么？', '故事的开端、发展、高潮、结局是怎样的？'],
        examples: ['主角从凡人成长为至强者', '主角揭开身世之谜'],
        outputType: 'input',
      },
      {
        id: 'outline_arc',
        title: '剧情阶段',
        description: '划分主要剧情阶段',
        stage: 'outline',
        required: false,
        dependencies: ['outline_main'],
        prompts: ['故事分为几个阶段？', '每个阶段的主要内容？'],
        examples: ['第一阶段：入门修炼\n第二阶段：宗门大比\n第三阶段：秘境探险'],
        outputType: 'input',
      },
      {
        id: 'outline_foreshadowing',
        title: '伏笔规划',
        description: '规划主要伏笔',
        stage: 'outline',
        required: false,
        dependencies: ['outline_main'],
        prompts: ['有哪些重要伏笔？', '伏笔什么时候埋，什么时候回收？'],
        examples: ['神秘玉佩：开篇埋设，身世揭秘时回收'],
        outputType: 'input',
      },
    ],
    nextStage: 'writing',
    prevStage: 'characters',
  },
  writing: {
    stage: 'writing',
    name: '正文创作',
    description: '开始创作小说正文',
    icon: '✍️',
    steps: [
      {
        id: 'write_chapter',
        title: '章节创作',
        description: '创作章节内容',
        stage: 'writing',
        required: true,
        dependencies: [],
        prompts: ['要写第几章？', '这一章的主要内容？'],
        examples: ['第一章：穿越', '第二章：进入宗门'],
        outputType: 'input',
      },
    ],
    nextStage: 'revision',
    prevStage: 'outline',
  },
  revision: {
    stage: 'revision',
    name: '修改润色',
    description: '对已创作内容进行修改和润色',
    icon: '🔧',
    steps: [
      {
        id: 'revise_check',
        title: '内容检查',
        description: '检查内容质量',
        stage: 'revision',
        required: false,
        dependencies: [],
        prompts: ['要检查哪部分内容？'],
        examples: ['检查人物一致性', '检查剧情连贯性'],
        outputType: 'input',
      },
      {
        id: 'revise_polish',
        title: '润色优化',
        description: '优化文字表达',
        stage: 'revision',
        required: false,
        dependencies: [],
        prompts: ['要润色哪部分？'],
        examples: ['润色第一章', '优化对话描写'],
        outputType: 'input',
      },
    ],
    nextStage: 'complete',
    prevStage: 'writing',
  },
  complete: {
    stage: 'complete',
    name: '创作完成',
    description: '小说创作完成',
    icon: '🎉',
    steps: [],
    nextStage: null,
    prevStage: 'revision',
  },
};

export const NOVEL_TYPES = [
  { label: '玄幻修仙', value: 'xuanhuan', description: '修真、仙侠、玄幻世界', icon: '🌟' },
  { label: '都市异能', value: 'urban', description: '现代都市、超能力', icon: '🏙️' },
  { label: '科幻未来', value: 'scifi', description: '未来世界、科技', icon: '🚀' },
  { label: '历史架空', value: 'history', description: '历史背景、架空设定', icon: '📜' },
  { label: '悬疑推理', value: 'mystery', description: '推理、悬疑、解谜', icon: '🔍' },
  { label: '青春校园', value: 'campus', description: '校园、青春、成长', icon: '📚' },
  { label: '武侠江湖', value: 'wuxia', description: '武侠、江湖、侠义', icon: '⚔️' },
  { label: '奇幻冒险', value: 'fantasy', description: '魔法、冒险、异世界', icon: '🧙' },
];

export const THEME_TEMPLATES = [
  { label: '逆袭成长', value: 'growth', description: '从弱小到强大的成长之路' },
  { label: '探索真相', value: 'truth', description: '揭开隐藏的真相' },
  { label: '守护爱情', value: 'love', description: '守护重要的人' },
  { label: '追求自由', value: 'freedom', description: '打破束缚，追求自由' },
  { label: '复仇雪恨', value: 'revenge', description: '复仇之路' },
  { label: '拯救世界', value: 'save', description: '拯救世界于危难' },
];
