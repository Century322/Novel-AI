export type PerspectiveType =
  | 'first_person'
  | 'third_limited'
  | 'third_omniscient'
  | 'second_person'
  | 'stream_of_consciousness';

export type PerspectiveCharacter = string;

export type SwitchTrigger =
  | 'scene_change'
  | 'time_jump'
  | 'character_focus'
  | 'plot_requirement'
  | 'emotional_shift'
  | 'information_reveal'
  | 'parallel_action';

export type SwitchSmoothness = 'seamless' | 'smooth' | 'noticeable' | 'jarring';

export interface PerspectiveState {
  type: PerspectiveType;
  character?: PerspectiveCharacter;

  knowledge: 'full' | 'limited' | 'unreliable';
  emotionalDistance: 'intimate' | 'close' | 'neutral' | 'distant';

  strengths: string[];
  limitations: string[];

  suitableScenes: string[];
  unsuitableScenes: string[];
}

export interface PerspectiveSwitch {
  id: string;
  from: PerspectiveState;
  to: PerspectiveState;

  trigger: SwitchTrigger;
  location: {
    chapter: number;
    paragraph?: number;
    context: string;
  };

  smoothness: SwitchSmoothness;
  transition: string;

  reason: string;
  impact: string;

  alternatives: PerspectiveAlternative[];

  createdAt: number;
}

export interface PerspectiveAlternative {
  perspective: PerspectiveState;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface PerspectiveStrategy {
  id: string;
  name: string;
  description: string;

  currentPerspective: PerspectiveState;
  perspectiveHistory: PerspectiveSwitch[];

  plannedSwitches: PlannedSwitch[];

  characterPerspectives: Map<string, CharacterPerspectiveInfo>;

  consistencyRules: PerspectiveRule[];

  createdAt: number;
  updatedAt: number;
}

export interface PlannedSwitch {
  id: string;
  targetPerspective: PerspectiveState;
  targetLocation: {
    chapter: number;
    scene?: string;
  };
  trigger: SwitchTrigger;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CharacterPerspectiveInfo {
  characterId: string;
  characterName: string;

  totalScenes: number;
  perspectiveScenes: number;

  knowledgeScope: string[];
  blindSpots: string[];

  emotionalRange: string[];
  narrativeVoice: string;

  suitableFor: string[];
  notSuitableFor: string[];
}

export interface PerspectiveRule {
  id: string;
  name: string;
  description: string;

  condition: {
    type: 'scene_type' | 'emotion' | 'information' | 'character';
    value: string;
  };

  recommendation: {
    preferredPerspective: PerspectiveType;
    reason: string;
  };

  priority: number;
}

export interface SwitchSuggestion {
  id: string;
  currentPerspective: PerspectiveState;
  suggestedPerspective: PerspectiveState;

  trigger: SwitchTrigger;
  location: {
    chapter: number;
    position: string;
  };

  reason: string;
  benefits: string[];
  risks: string[];

  transitionExample: string;

  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

export const PERSPECTIVE_TYPE_LABELS: Record<PerspectiveType, string> = {
  first_person: '第一人称',
  third_limited: '第三人称限制',
  third_omniscient: '第三人称全知',
  second_person: '第二人称',
  stream_of_consciousness: '意识流',
};

export const SWITCH_TRIGGER_LABELS: Record<SwitchTrigger, string> = {
  scene_change: '场景变化',
  time_jump: '时间跳跃',
  character_focus: '角色聚焦',
  plot_requirement: '剧情需要',
  emotional_shift: '情感转变',
  information_reveal: '信息揭示',
  parallel_action: '并行行动',
};

export const SWITCH_SMOOTHNESS_LABELS: Record<SwitchSmoothness, string> = {
  seamless: '无缝',
  smooth: '流畅',
  noticeable: '明显',
  jarring: '突兀',
};

export const PERSPECTIVE_CHARACTERISTICS: Record<PerspectiveType, PerspectiveState> = {
  first_person: {
    type: 'first_person',
    knowledge: 'limited',
    emotionalDistance: 'intimate',
    strengths: ['情感真实', '代入感强', '内心描写深入'],
    limitations: ['视野受限', '无法描写其他角色内心', '信息获取受限'],
    suitableScenes: ['情感场景', '内心独白', '个人成长'],
    unsuitableScenes: ['多角色互动', '大场面', '需要全知信息的场景'],
  },
  third_limited: {
    type: 'third_limited',
    knowledge: 'limited',
    emotionalDistance: 'close',
    strengths: ['平衡感好', '可聚焦单一角色', '叙事灵活'],
    limitations: ['仍有视野限制', '需要明确焦点角色'],
    suitableScenes: ['角色聚焦', '剧情推进', '情感描写'],
    unsuitableScenes: ['需要同时展示多角色内心的场景'],
  },
  third_omniscient: {
    type: 'third_omniscient',
    knowledge: 'full',
    emotionalDistance: 'neutral',
    strengths: ['视野开阔', '信息全面', '可自由切换焦点'],
    limitations: ['情感距离较远', '可能降低代入感', '需要控制信息量'],
    suitableScenes: ['大场面', '多线叙事', '世界观展示'],
    unsuitableScenes: ['需要强烈情感代入的场景'],
  },
  second_person: {
    type: 'second_person',
    knowledge: 'limited',
    emotionalDistance: 'intimate',
    strengths: ['独特体验', '互动感强', '沉浸感'],
    limitations: ['使用范围有限', '容易产生违和感'],
    suitableScenes: ['游戏叙事', '互动小说', '特殊效果'],
    unsuitableScenes: ['传统叙事', '长篇作品'],
  },
  stream_of_consciousness: {
    type: 'stream_of_consciousness',
    knowledge: 'limited',
    emotionalDistance: 'intimate',
    strengths: ['心理深度', '意识真实', '创新表达'],
    limitations: ['阅读难度高', '叙事松散', '需要技巧'],
    suitableScenes: ['心理描写', '梦境', '精神状态'],
    unsuitableScenes: ['动作场景', '对话场景'],
  },
};

export const DEFAULT_PERSPECTIVE_RULES: PerspectiveRule[] = [
  {
    id: 'rule_emotion_intimate',
    name: '情感场景规则',
    description: '需要强烈情感代入的场景应使用近距离视角',
    condition: { type: 'emotion', value: 'intense' },
    recommendation: { preferredPerspective: 'first_person', reason: '第一人称能最大程度传达情感' },
    priority: 10,
  },
  {
    id: 'rule_battle_omniscient',
    name: '战斗场景规则',
    description: '大规模战斗场景适合全知视角',
    condition: { type: 'scene_type', value: 'battle' },
    recommendation: { preferredPerspective: 'third_omniscient', reason: '全知视角能展示战场全貌' },
    priority: 8,
  },
  {
    id: 'rule_mystery_limited',
    name: '悬疑场景规则',
    description: '悬疑场景应限制信息获取',
    condition: { type: 'information', value: 'mystery' },
    recommendation: { preferredPerspective: 'third_limited', reason: '限制视角能保持悬念' },
    priority: 9,
  },
  {
    id: 'rule_character_focus',
    name: '角色聚焦规则',
    description: '聚焦单一角色时使用限制视角',
    condition: { type: 'character', value: 'single' },
    recommendation: { preferredPerspective: 'third_limited', reason: '限制视角能深入角色内心' },
    priority: 7,
  },
];
