export type ExtractionType =
  | 'character'
  | 'worldbuilding'
  | 'plot'
  | 'foreshadowing'
  | 'skill'
  | 'item'
  | 'relationship'
  | 'timeline'
  | 'setting';

export interface ExtractedSkill {
  name: string;
  type: 'combat' | 'cultivation' | 'support' | 'passive';
  description: string;
  level: string;
  requirements: string[];
  effects: string[];
  origin: string;
}

export interface ExtractedCharacter {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  personality: string[];
  appearance: string;
  background: string;
  abilities: string[];
  relationships: Array<{
    targetName: string;
    relationshipType: string;
  }>;
  goals: string[];
  secrets: string[];
}

export interface ExtractedWorldbuilding {
  name: string;
  category: 'power_system' | 'geography' | 'history' | 'culture' | 'faction' | 'rules';
  description: string;
  details: Record<string, string>;
  relatedElements: string[];
}

export interface ExtractedPlot {
  title: string;
  type: 'main' | 'subplot';
  description: string;
  characters: string[];
  location: string;
  stage: 'setup' | 'development' | 'climax' | 'resolution';
  foreshadowing: string[];
  consequences: string[];
}

export interface ExtractedForeshadowing {
  content: string;
  plantedAt: string;
  plannedResolution: string;
  relatedCharacters: string[];
  importance: 'major' | 'minor';
  status: 'planted' | 'hinted' | 'resolved';
}

export interface ExtractedItem {
  name: string;
  type: 'weapon' | 'artifact' | 'consumable' | 'material' | 'other';
  description: string;
  abilities: string[];
  origin: string;
  currentOwner: string;
}

export interface ExtractedRelationship {
  character1: string;
  character2: string;
  relationshipType: string;
  description: string;
  development: string[];
}

export interface ExtractedTimeline {
  event: string;
  time: string;
  characters: string[];
  location: string;
  significance: string;
}

export interface ExtractedSetting {
  key: string;
  value: string;
  category: string;
  notes: string;
}

export type ExtractedInfo =
  | { type: 'character'; data: ExtractedCharacter }
  | { type: 'worldbuilding'; data: ExtractedWorldbuilding }
  | { type: 'plot'; data: ExtractedPlot }
  | { type: 'foreshadowing'; data: ExtractedForeshadowing }
  | { type: 'skill'; data: ExtractedSkill }
  | { type: 'item'; data: ExtractedItem }
  | { type: 'relationship'; data: ExtractedRelationship }
  | { type: 'timeline'; data: ExtractedTimeline }
  | { type: 'setting'; data: ExtractedSetting };

export interface ExtractionResult {
  success: boolean;
  extractions: ExtractedInfo[];
  confidence: number;
  rawText: string;
  suggestions: string[];
}

export interface DocumentTemplate {
  type: ExtractionType;
  filename: string;
  folder: string;
  template: string;
}

export const DOCUMENT_TEMPLATES: Record<ExtractionType, DocumentTemplate> = {
  character: {
    type: 'character',
    filename: '{{name}}.md',
    folder: '设定/人物',
    template: `# {{name}}

## 基本信息
- **角色定位**: {{role}}
- **外貌**: {{appearance}}
- **背景**: {{background}}

## 性格特征
{{#each personality}}
- {{this}}
{{/each}}

## 能力
{{#each abilities}}
- {{this}}
{{/each}}

## 人际关系
{{#each relationships}}
- **{{targetName}}**: {{relationshipType}}
{{/each}}

## 目标
{{#each goals}}
- {{this}}
{{/each}}

## 秘密
{{#each secrets}}
- {{this}}
{{/each}}

## 描述
{{description}}
`,
  },
  worldbuilding: {
    type: 'worldbuilding',
    filename: '{{name}}.md',
    folder: '设定/世界观',
    template: `# {{name}}

## 类型
{{category}}

## 描述
{{description}}

## 详细信息
{{#each details}}
- **{{@key}}**: {{this}}
{{/each}}

## 相关元素
{{#each relatedElements}}
- {{this}}
{{/each}}
`,
  },
  plot: {
    type: 'plot',
    filename: '{{title}}.md',
    folder: '设定/剧情',
    template: `# {{title}}

## 类型
{{type}}

## 阶段
{{stage}}

## 描述
{{description}}

## 涉及人物
{{#each characters}}
- {{this}}
{{/each}}

## 地点
{{location}}

## 伏笔
{{#each foreshadowing}}
- {{this}}
{{/each}}

## 后果
{{#each consequences}}
- {{this}}
{{/each}}
`,
  },
  foreshadowing: {
    type: 'foreshadowing',
    filename: '伏笔追踪.md',
    folder: '设定',
    template: `## {{content}}

- **埋设位置**: {{plantedAt}}
- **计划回收**: {{plannedResolution}}
- **相关人物**: {{relatedCharacters}}
- **重要程度**: {{importance}}
- **状态**: {{status}}

---
`,
  },
  skill: {
    type: 'skill',
    filename: '{{name}}.md',
    folder: '设定/技能',
    template: `# {{name}}

## 类型
{{type}}

## 等级
{{level}}

## 描述
{{description}}

## 效果
{{#each effects}}
- {{this}}
{{/each}}

## 学习条件
{{#each requirements}}
- {{this}}
{{/each}}

## 来源
{{origin}}
`,
  },
  item: {
    type: 'item',
    filename: '{{name}}.md',
    folder: '设定/物品',
    template: `# {{name}}

## 类型
{{type}}

## 描述
{{description}}

## 能力
{{#each abilities}}
- {{this}}
{{/each}}

## 来源
{{origin}}

## 当前持有者
{{currentOwner}}
`,
  },
  relationship: {
    type: 'relationship',
    filename: '人物关系.md',
    folder: '设定',
    template: `## {{character1}} & {{character2}}

- **关系类型**: {{relationshipType}}
- **描述**: {{description}}

### 发展历程
{{#each development}}
- {{this}}
{{/each}}

---
`,
  },
  timeline: {
    type: 'timeline',
    filename: '时间线.md',
    folder: '设定',
    template: `## {{time}}

- **事件**: {{event}}
- **涉及人物**: {{characters}}
- **地点**: {{location}}
- **意义**: {{significance}}

---
`,
  },
  setting: {
    type: 'setting',
    filename: '通用设定.md',
    folder: '设定',
    template: `## {{key}}

- **分类**: {{category}}
- **内容**: {{value}}
- **备注**: {{notes}}

---
`,
  },
};

export const EXTRACTION_PROMPTS: Record<ExtractionType, string> = {
  character: `从用户输入中提取人物信息。请识别以下内容：
- 姓名（必须）
- 角色定位（主角/反派/配角/次要人物）
- 外貌描述
- 背景故事
- 性格特征（数组）
- 能力/技能（数组）
- 与其他人物的关系
- 目标/动机
- 秘密

输出 JSON 格式。如果某项信息未提及，使用空字符串或空数组。`,

  worldbuilding: `从用户输入中提取世界观设定。请识别以下内容：
- 设定名称（必须）
- 分类（力量体系/地理/历史/文化/势力/规则）
- 详细描述
- 具体细节（键值对）
- 相关元素

输出 JSON 格式。`,

  plot: `从用户输入中提取剧情信息。请识别以下内容：
- 剧情标题
- 类型（主线/支线）
- 详细描述
- 涉及人物
- 发生地点
- 当前阶段（铺垫/发展/高潮/结局）
- 相关伏笔
- 后续影响

输出 JSON 格式。`,

  foreshadowing: `从用户输入中提取伏笔信息。请识别以下内容：
- 伏笔内容
- 埋设位置/时机
- 计划回收方式
- 相关人物
- 重要程度（重要/次要）

输出 JSON 格式。`,

  skill: `从用户输入中提取技能/功法信息。请识别以下内容：
- 技能名称
- 类型（战斗/修炼/辅助/被动）
- 等级
- 描述
- 效果（数组）
- 学习条件（数组）
- 来源

输出 JSON 格式。`,

  item: `从用户输入中提取物品信息。请识别以下内容：
- 物品名称
- 类型（武器/神器/消耗品/材料/其他）
- 描述
- 能力/效果
- 来源
- 当前持有者

输出 JSON 格式。`,

  relationship: `从用户输入中提取人物关系。请识别以下内容：
- 人物1姓名
- 人物2姓名
- 关系类型
- 关系描述
- 关系发展历程

输出 JSON 格式。`,

  timeline: `从用户输入中提取时间线事件。请识别以下内容：
- 事件内容
- 发生时间
- 涉及人物
- 发生地点
- 事件意义

输出 JSON 格式。`,

  setting: `从用户输入中提取通用设定。请识别以下内容：
- 设定名称
- 设定内容
- 分类
- 备注

输出 JSON 格式。`,
};
