export type ForeshadowingStatus = 'planted' | 'hinted' | 'resolved' | 'abandoned';

export type ForeshadowingImportance = 'major' | 'minor' | 'subtle';

export type ForeshadowingType =
  | 'character_secret'
  | 'plot_twist'
  | 'worldbuilding'
  | 'relationship'
  | 'item'
  | 'prophecy'
  | 'mystery'
  | 'callback'
  | 'symbolic'
  | 'other';

export interface Foreshadowing {
  id: string;
  title: string;
  content: string;
  type: ForeshadowingType;
  status: ForeshadowingStatus;
  importance: ForeshadowingImportance;

  plantedAt: {
    plotNodeId?: string;
    chapter?: string;
    storyTime?: string;
    description: string;
  };

  plannedResolution: {
    plotNodeId?: string;
    estimatedChapter?: string;
    estimatedStoryTime?: string;
    description: string;
  };

  actualResolution?: {
    plotNodeId: string;
    chapter: string;
    storyTime: string;
    description: string;
  };

  relatedCharacters: string[];
  relatedItems: string[];
  relatedEvents: string[];

  hints: ForeshadowingHint[];

  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface ForeshadowingHint {
  id: string;
  foreshadowingId: string;
  content: string;
  plantedAt: {
    plotNodeId?: string;
    chapter?: string;
    description: string;
  };
  subtlety: 'obvious' | 'moderate' | 'subtle';
  discovered: boolean;
}

export interface ForeshadowingReminder {
  foreshadowingId: string;
  title: string;
  status: ForeshadowingStatus;
  plantedAt: string;
  plannedResolution: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

export interface ForeshadowingAnalysis {
  total: number;
  planted: number;
  hinted: number;
  resolved: number;
  abandoned: number;
  overdueResolutions: Foreshadowing[];
  unresolved: Foreshadowing[];
  suggestions: string[];
}

export const FORESHADOWING_TYPES: Record<ForeshadowingType, { name: string; description: string }> =
  {
    character_secret: { name: '人物秘密', description: '关于人物身份、背景或动机的秘密' },
    plot_twist: { name: '剧情反转', description: '为后续剧情反转做的铺垫' },
    worldbuilding: { name: '世界观线索', description: '关于世界设定的隐藏信息' },
    relationship: { name: '关系伏笔', description: '人物之间隐藏的关系' },
    item: { name: '物品伏笔', description: '重要物品的出现或线索' },
    prophecy: { name: '预言', description: '预言或预示未来的事件' },
    mystery: { name: '谜题', description: '需要读者推理的谜题' },
    callback: { name: '呼应', description: '对之前情节的呼应' },
    symbolic: { name: '象征', description: '象征性的暗示' },
    other: { name: '其他', description: '其他类型的伏笔' },
  };

export const FORESHADOWING_STATUS_INFO: Record<
  ForeshadowingStatus,
  { name: string; color: string }
> = {
  planted: { name: '已埋设', color: '#3B82F6' },
  hinted: { name: '已暗示', color: '#F59E0B' },
  resolved: { name: '已回收', color: '#10B981' },
  abandoned: { name: '已放弃', color: '#6B7280' },
};

export const IMPORTANCE_LEVELS: Record<
  ForeshadowingImportance,
  { name: string; description: string }
> = {
  major: { name: '重要', description: '对主线剧情有重大影响' },
  minor: { name: '次要', description: '对支线或细节有影响' },
  subtle: { name: '微妙', description: '增加故事深度但不影响主线' },
};

export const SUBTLETY_LEVELS: Record<
  'obvious' | 'moderate' | 'subtle',
  { name: string; description: string }
> = {
  obvious: { name: '明显', description: '读者容易注意到' },
  moderate: { name: '适中', description: '细心的读者会发现' },
  subtle: { name: '隐晦', description: '只有回顾时才会发现' },
};
