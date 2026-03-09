export type NovelType =
  | 'xuanhuan'
  | 'xianxia'
  | 'urban'
  | 'scifi'
  | 'history'
  | 'mystery'
  | 'romance'
  | 'wuxia'
  | 'fantasy'
  | 'apocalypse'
  | 'game'
  | 'other';

export type AudienceType = 'male' | 'female' | 'general';

export type NovelTheme =
  | 'growth'
  | 'revenge'
  | 'romance'
  | 'adventure'
  | 'mystery'
  | 'comedy'
  | 'tragedy'
  | 'business'
  | 'cultivation'
  | 'kingdom_building'
  | 'survival';

export interface NovelTypeInfo {
  type: NovelType;
  name: string;
  aliases: string[];
  description: string;
  keywords: string[];
  commonElements: string[];
  requiredSettings: SettingRequirement[];
  optionalSettings: SettingRequirement[];
  typicalThemes: NovelTheme[];
  audiencePreference: AudienceType[];
  powerSystems: string[];
  typicalCharacters: string[];
  plotPatterns: string[];
}

export interface SettingRequirement {
  name: string;
  description: string;
  priority: 'required' | 'recommended' | 'optional';
  examples: string[];
}

export interface NovelTypeDetectionResult {
  detectedType: NovelType;
  confidence: number;
  audienceType: AudienceType;
  suggestedThemes: NovelTheme[];
  requiredSettings: SettingRequirement[];
  recommendedSettings: SettingRequirement[];
  analysis: string;
}

export interface TypeLearningResult {
  type: NovelType;
  learnedElements: string[];
  commonPatterns: string[];
  styleCharacteristics: string[];
  vocabularyPatterns: string[];
}

export const NOVEL_TYPES: Record<NovelType, NovelTypeInfo> = {
  xuanhuan: {
    type: 'xuanhuan',
    name: '玄幻',
    aliases: ['玄幻小说', '玄幻修仙', '东方玄幻'],
    description: '以东方玄幻为背景，包含修炼、境界、法术等元素',
    keywords: ['修炼', '境界', '灵气', '宗门', '丹药', '法宝', '飞升', '渡劫', '元婴', '金丹'],
    commonElements: ['修炼体系', '宗门势力', '丹药法宝', '境界划分', '灵石资源'],
    requiredSettings: [
      {
        name: '修炼境界',
        description: '力量等级划分',
        priority: 'required',
        examples: ['炼气-筑基-金丹-元婴', '一阶-九阶'],
      },
      {
        name: '世界观',
        description: '世界背景设定',
        priority: 'required',
        examples: ['修仙世界', '玄幻大陆'],
      },
    ],
    optionalSettings: [
      {
        name: '宗门势力',
        description: '主要势力分布',
        priority: 'recommended',
        examples: ['五大宗门', '正魔两道'],
      },
      {
        name: '丹药系统',
        description: '丹药等级和效果',
        priority: 'optional',
        examples: ['一品到九品丹药'],
      },
    ],
    typicalThemes: ['growth', 'revenge', 'cultivation'],
    audiencePreference: ['male'],
    powerSystems: ['灵力', '真元', '法力', '仙力'],
    typicalCharacters: ['天才少年', '废柴逆袭', '宗门弟子', '世家子弟'],
    plotPatterns: ['废柴逆袭', '天才崛起', '宗门争斗', '秘境探险'],
  },
  xianxia: {
    type: 'xianxia',
    name: '仙侠',
    aliases: ['仙侠小说', '修仙', '仙侠修真'],
    description: '以修仙求道为主题，追求长生不老',
    keywords: ['修仙', '仙', '道', '长生', '渡劫', '飞升', '仙人', '仙界', '凡间'],
    commonElements: ['修仙功法', '仙界设定', '渡劫飞升', '仙缘', '道心'],
    requiredSettings: [
      {
        name: '修仙境界',
        description: '修仙等级体系',
        priority: 'required',
        examples: ['炼气-筑基-金丹-元婴-化神-渡劫-大乘'],
      },
      {
        name: '世界观',
        description: '三界设定',
        priority: 'required',
        examples: ['凡界-灵界-仙界'],
      },
    ],
    optionalSettings: [
      {
        name: '功法系统',
        description: '修炼功法分类',
        priority: 'recommended',
        examples: ['天阶功法', '地阶功法'],
      },
    ],
    typicalThemes: ['cultivation', 'growth', 'adventure'],
    audiencePreference: ['male', 'female'],
    powerSystems: ['仙元', '道力', '灵力'],
    typicalCharacters: ['修仙者', '散修', '宗门弟子', '仙人'],
    plotPatterns: ['凡人修仙', '仙缘奇遇', '渡劫飞升'],
  },
  urban: {
    type: 'urban',
    name: '都市',
    aliases: ['都市小说', '都市异能', '现代都市'],
    description: '以现代都市为背景，可能包含异能、商战等元素',
    keywords: ['都市', '现代', '异能', '商战', '都市生活', '都市言情', '总裁', '豪门'],
    commonElements: ['现代背景', '都市生活', '职场', '异能者', '豪门世家'],
    requiredSettings: [
      {
        name: '时代背景',
        description: '现代都市设定',
        priority: 'required',
        examples: ['现代都市', '架空现代'],
      },
    ],
    optionalSettings: [
      {
        name: '异能系统',
        description: '如果有异能元素',
        priority: 'optional',
        examples: ['觉醒异能', '基因变异'],
      },
      {
        name: '势力分布',
        description: '都市势力',
        priority: 'optional',
        examples: ['四大家族', '地下势力'],
      },
    ],
    typicalThemes: ['growth', 'romance', 'business'],
    audiencePreference: ['male', 'female'],
    powerSystems: ['异能', '内力', '精神力'],
    typicalCharacters: ['都市青年', '总裁', '异能者', '富二代'],
    plotPatterns: ['都市逆袭', '商战崛起', '异能觉醒'],
  },
  scifi: {
    type: 'scifi',
    name: '科幻',
    aliases: ['科幻小说', '未来科幻', '星际'],
    description: '以未来科技、星际探索为主题',
    keywords: ['科幻', '未来', '星际', '机甲', '人工智能', '太空', '外星', '科技'],
    commonElements: ['未来科技', '星际文明', '机甲', '人工智能', '基因改造'],
    requiredSettings: [
      {
        name: '时代背景',
        description: '未来/星际设定',
        priority: 'required',
        examples: ['星际时代', '赛博朋克'],
      },
      {
        name: '科技水平',
        description: '科技发展程度',
        priority: 'required',
        examples: ['机甲时代', 'AI时代'],
      },
    ],
    optionalSettings: [
      {
        name: '星际势力',
        description: '星际文明分布',
        priority: 'recommended',
        examples: ['联邦', '帝国'],
      },
    ],
    typicalThemes: ['adventure', 'growth', 'mystery'],
    audiencePreference: ['male'],
    powerSystems: ['精神力', '基因力量', '机甲战力'],
    typicalCharacters: ['星际探险家', '机甲驾驶员', '科学家', 'AI'],
    plotPatterns: ['星际探险', '文明冲突', '科技革命'],
  },
  history: {
    type: 'history',
    name: '历史架空',
    aliases: ['历史小说', '架空历史', '穿越历史'],
    description: '以历史为背景，可能包含穿越元素',
    keywords: ['历史', '架空', '穿越', '古代', '朝代', '皇帝', '将军', '谋士'],
    commonElements: ['历史背景', '朝代设定', '权谋', '战争', '穿越者'],
    requiredSettings: [
      {
        name: '历史背景',
        description: '朝代/时代设定',
        priority: 'required',
        examples: ['三国', '唐宋', '架空朝代'],
      },
    ],
    optionalSettings: [
      {
        name: '势力分布',
        description: '各方势力',
        priority: 'recommended',
        examples: ['诸国争霸', '朝堂派系'],
      },
    ],
    typicalThemes: ['growth', 'kingdom_building', 'revenge'],
    audiencePreference: ['male'],
    powerSystems: ['武力', '谋略', '兵权'],
    typicalCharacters: ['穿越者', '皇帝', '将军', '谋士', '公主'],
    plotPatterns: ['穿越改命', '争霸天下', '权谋斗争'],
  },
  mystery: {
    type: 'mystery',
    name: '悬疑推理',
    aliases: ['悬疑', '推理', '侦探'],
    description: '以解谜、推理为主题',
    keywords: ['悬疑', '推理', '侦探', '案件', '谜题', '真相', '凶手', '破案'],
    commonElements: ['案件', '侦探', '推理', '真相', '悬疑氛围'],
    requiredSettings: [
      {
        name: '背景设定',
        description: '故事发生环境',
        priority: 'required',
        examples: ['现代都市', '古代'],
      },
    ],
    optionalSettings: [
      {
        name: '侦探设定',
        description: '主角能力',
        priority: 'recommended',
        examples: ['神探', '法医', '私家侦探'],
      },
    ],
    typicalThemes: ['mystery', 'revenge'],
    audiencePreference: ['male', 'female'],
    powerSystems: [],
    typicalCharacters: ['侦探', '法医', '警察', '嫌疑人'],
    plotPatterns: ['破案推理', '寻找真相', '连环案件'],
  },
  romance: {
    type: 'romance',
    name: '言情',
    aliases: ['言情小说', '爱情', '青春言情'],
    description: '以爱情为主线',
    keywords: ['言情', '爱情', '恋爱', '青春', '校园', '甜宠', '虐恋', 'CP'],
    commonElements: ['爱情线', '感情纠葛', '甜宠/虐恋', 'CP感'],
    requiredSettings: [
      {
        name: '背景设定',
        description: '故事背景',
        priority: 'required',
        examples: ['现代', '古代', '校园'],
      },
      {
        name: '主角设定',
        description: '男女主基本信息',
        priority: 'required',
        examples: ['霸道总裁x小白兔', '学霸x学渣'],
      },
    ],
    optionalSettings: [
      {
        name: '感情线规划',
        description: '感情发展',
        priority: 'recommended',
        examples: ['欢喜冤家', '日久生情'],
      },
    ],
    typicalThemes: ['romance', 'growth'],
    audiencePreference: ['female'],
    powerSystems: [],
    typicalCharacters: ['霸道总裁', '小奶狗', '高冷学霸', '软萌女主'],
    plotPatterns: ['欢喜冤家', '日久生情', '破镜重圆', '先婚后爱'],
  },
  wuxia: {
    type: 'wuxia',
    name: '武侠',
    aliases: ['武侠小说', '江湖', '武林'],
    description: '以武侠江湖为背景',
    keywords: ['武侠', '江湖', '武林', '武功', '侠客', '门派', '义气', '恩仇'],
    commonElements: ['武功', '江湖', '门派', '侠义', '恩仇'],
    requiredSettings: [
      {
        name: '江湖设定',
        description: '江湖背景',
        priority: 'required',
        examples: ['明清江湖', '架空江湖'],
      },
      {
        name: '武功体系',
        description: '武功等级',
        priority: 'required',
        examples: ['三流-二流-一流-绝顶'],
      },
    ],
    optionalSettings: [
      {
        name: '门派设定',
        description: '主要门派',
        priority: 'recommended',
        examples: ['少林武当', '六大门派'],
      },
    ],
    typicalThemes: ['growth', 'revenge', 'adventure'],
    audiencePreference: ['male'],
    powerSystems: ['内力', '真气', '武功'],
    typicalCharacters: ['侠客', '浪子', '掌门', '隐士高手'],
    plotPatterns: ['江湖恩仇', '复仇之路', '武林争霸'],
  },
  fantasy: {
    type: 'fantasy',
    name: '奇幻',
    aliases: ['奇幻小说', '西幻', '魔法'],
    description: '以西方奇幻或魔法世界为背景',
    keywords: ['奇幻', '魔法', '精灵', '龙', '骑士', '法师', '异世界', '召唤'],
    commonElements: ['魔法', '种族', '神明', '龙', '骑士', '法师'],
    requiredSettings: [
      {
        name: '世界观',
        description: '奇幻世界设定',
        priority: 'required',
        examples: ['魔法世界', '异世界'],
      },
      {
        name: '力量体系',
        description: '魔法/力量系统',
        priority: 'required',
        examples: ['魔法等级', '斗气等级'],
      },
    ],
    optionalSettings: [
      {
        name: '种族设定',
        description: '种族分布',
        priority: 'recommended',
        examples: ['人类精灵矮人'],
      },
    ],
    typicalThemes: ['adventure', 'growth'],
    audiencePreference: ['male'],
    powerSystems: ['魔力', '斗气', '神力'],
    typicalCharacters: ['法师', '骑士', '召唤师', '勇者'],
    plotPatterns: ['异世界召唤', '勇者冒险', '魔王讨伐'],
  },
  apocalypse: {
    type: 'apocalypse',
    name: '末世',
    aliases: ['末世小说', '末日', '丧尸'],
    description: '以末日灾难为背景',
    keywords: ['末世', '末日', '丧尸', '灾难', '生存', '变异', '废土', '资源'],
    commonElements: ['末日灾难', '生存', '变异', '资源匮乏', '人性'],
    requiredSettings: [
      {
        name: '灾难类型',
        description: '末日原因',
        priority: 'required',
        examples: ['丧尸病毒', '核战争', '自然灾害'],
      },
      {
        name: '世界观',
        description: '末世背景',
        priority: 'required',
        examples: ['丧尸末世', '废土世界'],
      },
    ],
    optionalSettings: [
      {
        name: '变异系统',
        description: '变异/进化设定',
        priority: 'recommended',
        examples: ['异能觉醒', '基因进化'],
      },
    ],
    typicalThemes: ['growth', 'adventure', 'survival'],
    audiencePreference: ['male'],
    powerSystems: ['异能', '进化', '精神力'],
    typicalCharacters: ['幸存者', '异能者', '军人', '科学家'],
    plotPatterns: ['末世求生', '基地建设', '异能崛起'],
  },
  game: {
    type: 'game',
    name: '游戏',
    aliases: ['游戏小说', '网游', '电竞'],
    description: '以游戏世界为背景',
    keywords: ['游戏', '网游', '电竞', '副本', '公会', 'BOSS', '装备', '等级'],
    commonElements: ['游戏系统', '副本', '装备', '公会', 'PK'],
    requiredSettings: [
      {
        name: '游戏类型',
        description: '游戏设定',
        priority: 'required',
        examples: ['VR网游', '电竞游戏'],
      },
      {
        name: '游戏系统',
        description: '游戏规则',
        priority: 'required',
        examples: ['职业系统', '等级系统'],
      },
    ],
    optionalSettings: [
      { name: '公会设定', description: '主要公会', priority: 'optional', examples: ['十大公会'] },
    ],
    typicalThemes: ['growth', 'adventure'],
    audiencePreference: ['male'],
    powerSystems: ['等级', '装备', '技能'],
    typicalCharacters: ['职业玩家', '公会会长', '游戏大神', '新人'],
    plotPatterns: ['游戏称霸', '电竞夺冠', '游戏穿越'],
  },
  other: {
    type: 'other',
    name: '其他',
    aliases: [],
    description: '其他类型小说',
    keywords: [],
    commonElements: [],
    requiredSettings: [],
    optionalSettings: [],
    typicalThemes: [],
    audiencePreference: ['male', 'female'],
    powerSystems: [],
    typicalCharacters: [],
    plotPatterns: [],
  },
};

export const AUDIENCE_KEYWORDS: Record<AudienceType, string[]> = {
  male: ['爽文', '逆袭', '打脸', '后宫', '无敌', '争霸', '热血', '兄弟'],
  female: ['甜宠', '虐恋', '言情', 'CP', '霸总', '小奶狗', '闺蜜', '甜文'],
  general: ['成长', '冒险', '友情', '亲情'],
};
