export type CharacterRole =
  | 'protagonist'
  | 'deuteragonist'
  | 'antagonist'
  | 'supporting'
  | 'minor'
  | 'background';

export type CharacterArchetype =
  | 'hero'
  | 'mentor'
  | 'shadow'
  | 'trickster'
  | 'guardian'
  | 'herald'
  | 'shapeshifter'
  | 'ally'
  | 'enemy'
  | 'love_interest'
  | 'rival'
  | 'comic_relief'
  | 'sacrifice'
  | 'mystery'
  | 'custom';

export type CharacterGrowthStage =
  | 'introduction'
  | 'development'
  | 'transformation'
  | 'climax'
  | 'resolution';

export interface CharacterAppearance {
  age: string;
  gender: string;
  height?: string;
  build?: string;
  hair?: string;
  eyes?: string;
  distinctiveFeatures: string[];
  clothing: string;
  overallImpression: string;
}

export interface CharacterPersonality {
  traits: string[];
  virtues: string[];
  flaws: string[];
  fears: string[];
  desires: string[];
  habits: string[];
  quirks: string[];
  speech: {
    style: string;
    catchphrases: string[];
    vocabulary: string;
  };
}

export interface CharacterBackground {
  birthplace: string;
  family: {
    parents: string;
    siblings: string;
    spouse?: string;
    children?: string;
    other?: string;
  };
  childhood: string;
  education: string;
  occupation: string;
  socialStatus: string;
  significantEvents: Array<{
    event: string;
    age: string;
    impact: string;
  }>;
}

export interface CharacterAbilities {
  skills: Array<{
    name: string;
    level: string;
    description: string;
  }>;
  powers: Array<{
    name: string;
    type: string;
    description: string;
    limitations: string;
  }>;
  equipment: Array<{
    name: string;
    description: string;
    significance: string;
  }>;
  weaknesses: string[];
}

export interface ProfileCharacterRelationship {
  targetId: string;
  targetName: string;
  relationshipType: string;
  description: string;
  history: string;
  currentStatus: 'friendly' | 'hostile' | 'neutral' | 'complicated' | 'unknown';
  development: Array<{
    event: string;
    change: string;
  }>;
}

export interface ProfileCharacterArc {
  startingPoint: {
    state: string;
    beliefs: string[];
    goals: string[];
  };
  journey: Array<{
    stage: CharacterGrowthStage;
    events: string;
    internalChange: string;
    externalChange: string;
  }>;
  endPoint: {
    state: string;
    beliefs: string[];
    goals: string[];
    resolution: string;
  };
  theme: string;
}

export interface CharacterSecret {
  id: string;
  content: string;
  type: 'identity' | 'past' | 'motive' | 'ability' | 'relationship' | 'other';
  knownBy: string[];
  revealedAt?: string;
  impact: string;
}

export interface CharacterMotivation {
  consciousGoals: string[];
  unconsciousDesires: string[];
  fears: string[];
  values: string[];
  internalConflict: string;
  externalConflict: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  aliases: string[];
  role: CharacterRole;
  archetype: CharacterArchetype;

  appearance: CharacterAppearance;
  personality: CharacterPersonality;
  background: CharacterBackground;
  abilities: CharacterAbilities;

  relationships: ProfileCharacterRelationship[];
  arc: ProfileCharacterArc;
  secrets: CharacterSecret[];
  motivations: CharacterMotivation;

  firstAppearance: string;
  lastAppearance?: string;
  totalAppearances: number;

  notes: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export const CHARACTER_ROLES: Record<CharacterRole, { name: string; description: string }> = {
  protagonist: { name: '主角', description: '故事的核心人物' },
  deuteragonist: { name: '第二主角', description: '与主角并列的主要人物' },
  antagonist: { name: '反派', description: '与主角对立的人物' },
  supporting: { name: '配角', description: '支持主角的重要人物' },
  minor: { name: '次要人物', description: '戏份较少的人物' },
  background: { name: '背景人物', description: '背景中出现的人物' },
};

export const CHARACTER_ARCHETYPES: Record<
  CharacterArchetype,
  { name: string; description: string }
> = {
  hero: { name: '英雄', description: '故事的核心，经历成长和转变' },
  mentor: { name: '导师', description: '指导和帮助主角' },
  shadow: { name: '阴影', description: '代表主角的黑暗面' },
  trickster: { name: '捣蛋鬼', description: '制造混乱和喜剧效果' },
  guardian: { name: '守护者', description: '保护主角或重要事物' },
  herald: { name: '信使', description: '带来变化和挑战' },
  shapeshifter: { name: '变形者', description: '立场不明确，可能转变' },
  ally: { name: '盟友', description: '主角的支持者和朋友' },
  enemy: { name: '敌人', description: '主角的对手' },
  love_interest: { name: '恋人', description: '主角的爱慕对象' },
  rival: { name: '竞争对手', description: '与主角竞争的人' },
  comic_relief: { name: '喜剧角色', description: '提供轻松和幽默' },
  sacrifice: { name: '牺牲者', description: '为剧情做出牺牲' },
  mystery: { name: '神秘人物', description: '充满谜团的人物' },
  custom: { name: '自定义', description: '其他类型' },
};

export const RELATIONSHIP_TYPES = [
  { value: 'family', label: '家人', opposite: 'family' },
  { value: 'friend', label: '朋友', opposite: 'friend' },
  { value: 'enemy', label: '敌人', opposite: 'enemy' },
  { value: 'rival', label: '竞争对手', opposite: 'rival' },
  { value: 'lover', label: '恋人', opposite: 'lover' },
  { value: 'ex_lover', label: '前任', opposite: 'ex_lover' },
  { value: 'mentor_student', label: '师徒', opposite: 'student_mentor' },
  { value: 'master_servant', label: '主仆', opposite: 'servant_master' },
  { value: 'ally', label: '盟友', opposite: 'ally' },
  { value: 'acquaintance', label: '熟人', opposite: 'acquaintance' },
  { value: 'stranger', label: '陌生人', opposite: 'stranger' },
  { value: 'complicated', label: '复杂', opposite: 'complicated' },
];
