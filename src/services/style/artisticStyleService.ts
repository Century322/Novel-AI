import {
  WhiteSpacePattern,
  EmotionTransmission,
  ArtisticStyleProfile,
  StyleAnalysisResult,
  StyleRecommendation,
  ArtisticExample,
  ArtisticTechnique,
  EmotionType,
  EmotionIntensity,
  ARTISTIC_TECHNIQUE_LABELS,
  EMOTION_LABELS,
  EmotionTechnique,
} from '@/types/style/artisticStyle';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class ArtisticStyleService {
  private projectPath: string;
  private profiles: Map<string, ArtisticStyleProfile> = new Map();
  private examples: Map<string, ArtisticExample> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const profilesPath = `${this.projectPath}/设定/艺术风格/风格档案.json`;
      const examplesPath = `${this.projectPath}/设定/艺术风格/范例库.json`;

      const profilesContent = await workshopService.readFile(profilesPath);
      if (profilesContent) {
        const data: ArtisticStyleProfile[] = JSON.parse(profilesContent);
        this.profiles = new Map(data.map((p) => [p.id, p]));
      }

      const examplesContent = await workshopService.readFile(examplesPath);
      if (examplesContent) {
        const data: ArtisticExample[] = JSON.parse(examplesContent);
        this.examples = new Map(data.map((e) => [e.id, e]));
      }
    } catch (error) {
      logger.error('加载艺术风格数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/艺术风格`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/风格档案.json`,
        JSON.stringify(Array.from(this.profiles.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/范例库.json`,
        JSON.stringify(Array.from(this.examples.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存艺术风格数据失败', { error });
    }
  }

  async analyzeText(text: string, _source: string = 'unknown'): Promise<StyleAnalysisResult> {
    const whiteSpacePatterns = await this.detectWhiteSpacePatterns(text);
    const emotionTransmissions = await this.detectEmotionTransmissions(text);
    const artisticTechniques = await this.detectArtisticTechniques(text);

    const overallScore = this.calculateOverallScore(
      whiteSpacePatterns,
      emotionTransmissions,
      artisticTechniques
    );

    const recommendations = this.generateRecommendations(
      whiteSpacePatterns,
      emotionTransmissions,
      artisticTechniques
    );

    return {
      whiteSpacePatterns,
      emotionTransmissions,
      artisticTechniques,
      overallScore,
      recommendations,
    };
  }

  private async detectWhiteSpacePatterns(text: string): Promise<WhiteSpacePattern[]> {
    const patterns: WhiteSpacePattern[] = [];
    const paragraphs = text.split('\n\n').filter((p) => p.trim());

    for (let i = 1; i < paragraphs.length; i++) {
      const prev = paragraphs[i - 1];
      const curr = paragraphs[i];

      if (prev.length > 100 && curr.length > 100) {
        const gap = this.analyzeParagraphGap(prev, curr);
        if (gap) {
          patterns.push(gap);
        }
      }
    }

    const dialogueMatches = text.match(/["「『][^"」』]*["」』"]/g) || [];
    let silenceCount = 0;
    for (let i = 0; i < dialogueMatches.length - 1; i++) {
      const between = text.substring(
        text.indexOf(dialogueMatches[i]) + dialogueMatches[i].length,
        text.indexOf(dialogueMatches[i + 1])
      );
      if (between.length < 10 && !between.match(/[。！？]/)) {
        silenceCount++;
      }
    }

    if (silenceCount > 0) {
      patterns.push({
        id: `ws_${uuidv4()}`,
        name: '对话沉默',
        type: 'dialogue_silence',
        description: `发现 ${silenceCount} 处对话中的沉默效果`,
        beforeContext: '',
        afterContext: '',
        theBlank: '对话之间的短暂沉默',
        effect: '增加对话的张力和真实感',
        readerEmotion: '期待、紧张',
        examples: [],
        usageGuidelines: ['用于强调重要对话', '表现角色内心挣扎', '制造悬念'],
      });
    }

    return patterns;
  }

  private analyzeParagraphGap(prev: string, curr: string): WhiteSpacePattern | null {
    const prevEnds = prev.slice(-20);
    const currStarts = curr.slice(0, 20);

    const isSceneChange =
      (prev.includes('夜') && curr.includes('晨')) ||
      (prev.includes('离开') && curr.includes('到达')) ||
      (prev.includes('告别') && curr.includes('相遇'));

    if (isSceneChange) {
      return {
        id: `ws_${uuidv4()}`,
        name: '场景过渡留白',
        type: 'scene_transition',
        description: '通过段落间隔实现场景转换',
        beforeContext: prevEnds,
        afterContext: currStarts,
        theBlank: '场景转换',
        effect: '自然过渡，给读者想象空间',
        readerEmotion: '期待、好奇',
        examples: [],
        usageGuidelines: ['时间跨度转换', '地点转换', '视角转换'],
      };
    }

    const prevEmotion = this.detectEmotion(prev);
    const currEmotion = this.detectEmotion(curr);

    if (prevEmotion !== currEmotion && prevEmotion && currEmotion) {
      return {
        id: `ws_${uuidv4()}`,
        name: '情感停顿',
        type: 'emotional_pause',
        description: `情感从 ${EMOTION_LABELS[prevEmotion as EmotionType]} 转向 ${EMOTION_LABELS[currEmotion as EmotionType]}`,
        beforeContext: prevEnds,
        afterContext: currStarts,
        theBlank: '情感转换',
        effect: '让读者感受情感变化',
        readerEmotion: '共鸣、感动',
        examples: [],
        usageGuidelines: ['情感高潮后', '转折点前', '内心转变时'],
      };
    }

    return null;
  }

  private detectEmotion(text: string): EmotionType | null {
    const emotionKeywords: Record<EmotionType, string[]> = {
      joy: ['开心', '高兴', '快乐', '幸福', '笑'],
      sorrow: ['悲伤', '难过', '伤心', '眼泪', '哭'],
      anger: ['愤怒', '生气', '恼怒', '暴怒', '恨'],
      fear: ['恐惧', '害怕', '惊恐', '颤抖', '不安'],
      love: ['爱', '喜欢', '心动', '温柔', '深情'],
      hate: ['恨', '厌恶', '讨厌', '憎恨'],
      hope: ['希望', '期待', '盼望', '憧憬'],
      despair: ['绝望', '崩溃', '无助', '绝望'],
      surprise: ['惊讶', '意外', '震惊', '吃惊'],
      anticipation: ['期待', '等待', '盼望', '渴望'],
      nostalgia: ['怀念', '回忆', '往事', '曾经'],
      melancholy: ['忧郁', '惆怅', '落寞', '凄凉'],
      excitement: ['兴奋', '激动', '热血', '澎湃'],
      peace: ['平静', '安宁', '祥和', '宁静'],
      tension: ['紧张', '紧绷', '压迫', '窒息'],
      relief: ['释然', '轻松', '解脱', '放下'],
    };

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return emotion as EmotionType;
        }
      }
    }

    return null;
  }

  private async detectEmotionTransmissions(text: string): Promise<EmotionTransmission[]> {
    const transmissions: EmotionTransmission[] = [];

    const emotionPatterns = this.findEmotionPatterns(text);

    for (const pattern of emotionPatterns) {
      const transmission: EmotionTransmission = {
        id: `et_${uuidv4()}`,
        emotion: pattern.emotion,
        intensity: pattern.intensity,
        techniques: this.identifyEmotionTechniques(pattern.text),
        physicalManifestations: this.extractPhysicalManifestations(pattern.text),
        behavioralCues: this.extractBehavioralCues(pattern.text),
        environmentalReflections: this.extractEnvironmentalReflections(pattern.text),
        dialoguePatterns: [],
        internalMonologue: this.extractInternalMonologue(pattern.text),
        buildUp: this.buildEmotionBuildUp(pattern.text, pattern.intensity),
        examples: [
          { text: pattern.text, analysis: pattern.analysis, effectiveness: pattern.effectiveness },
        ],
      };
      transmissions.push(transmission);
    }

    return transmissions;
  }

  private findEmotionPatterns(text: string): Array<{
    text: string;
    emotion: EmotionType;
    intensity: EmotionIntensity;
    analysis: string;
    effectiveness: number;
  }> {
    const patterns: Array<{
      text: string;
      emotion: EmotionType;
      intensity: EmotionIntensity;
      analysis: string;
      effectiveness: number;
    }> = [];

    const sentences = text.split(/[。！？\n]/).filter((s) => s.trim().length > 20);

    for (const sentence of sentences) {
      const emotion = this.detectEmotion(sentence);
      if (emotion) {
        const intensity = this.assessIntensity(sentence);
        const hasPhysical = /[手|心|眼|脸|身|颤抖|心跳|呼吸]/.test(sentence);
        const hasShow = !/(感到|觉得|非常|很)/.test(sentence);

        patterns.push({
          text: sentence,
          emotion,
          intensity,
          analysis: hasShow ? '展示而非讲述' : '直接描述',
          effectiveness: hasPhysical && hasShow ? 0.9 : hasPhysical ? 0.7 : 0.5,
        });
      }
    }

    return patterns.slice(0, 10);
  }

  private assessIntensity(text: string): EmotionIntensity {
    const strongWords = ['极', '非常', '无比', '彻底', '完全', '崩溃'];
    const overwhelmingWords = ['撕心裂肺', '痛不欲生', '欣喜若狂', '暴怒'];

    for (const word of overwhelmingWords) {
      if (text.includes(word)) {
        return 'overwhelming';
      }
    }

    for (const word of strongWords) {
      if (text.includes(word)) {
        return 'strong';
      }
    }

    return 'moderate';
  }

  private identifyEmotionTechniques(text: string): EmotionTechnique[] {
    const techniques: EmotionTechnique[] = [];

    if (/[手|心|眼|脸|身|颤抖|心跳|呼吸]/.test(text)) {
      techniques.push({
        type: 'physical',
        description: '通过身体反应表现情感',
        examples: [text.match(/[手|心|眼|脸|身|颤抖|心跳|呼吸][^，。！？]*/)?.[0] || ''],
      });
    }

    if (/[风|雨|光|影|月|花|叶]/.test(text)) {
      techniques.push({
        type: 'environmental',
        description: '通过环境烘托情感',
        examples: [text.match(/[风|雨|光|影|月|花|叶][^，。！？]*/)?.[0] || ''],
      });
    }

    return techniques;
  }

  private extractPhysicalManifestations(text: string): string[] {
    const manifestations: string[] = [];
    const patterns = [
      /手[^，。！？]{0,10}/g,
      /心[^，。！？]{0,10}/g,
      /眼[^，。！？]{0,10}/g,
      /脸[^，。！？]{0,10}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        manifestations.push(...matches.slice(0, 2));
      }
    }

    return manifestations;
  }

  private extractBehavioralCues(text: string): string[] {
    const cues: string[] = [];
    const actionVerbs = ['走', '站', '坐', '看', '说', '笑', '哭', '转身', '抬头', '低头'];

    for (const verb of actionVerbs) {
      const regex = new RegExp(verb + '[^，。！？]{0,10}', 'g');
      const matches = text.match(regex);
      if (matches) {
        cues.push(...matches);
      }
    }

    return cues;
  }

  private extractEnvironmentalReflections(text: string): string[] {
    const reflections: string[] = [];
    const envWords = ['风', '雨', '光', '影', '月', '花', '叶', '云', '雪'];

    for (const word of envWords) {
      if (text.includes(word)) {
        const regex = new RegExp(word + '[^，。！？]{0,15}', 'g');
        const matches = text.match(regex);
        if (matches) {
          reflections.push(...matches);
        }
      }
    }

    return reflections;
  }

  private extractInternalMonologue(text: string): string[] {
    const monologues: string[] = [];
    const internalPatterns = [
      /「[^」]+」/g,
      /『[^』]+』/g,
      /心想[^，。！？]+/g,
      /心中[^，。！？]+/g,
    ];

    for (const pattern of internalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        monologues.push(...matches);
      }
    }

    return monologues;
  }

  private buildEmotionBuildUp(
    _text: string,
    intensity: EmotionIntensity
  ): Array<{ stage: number; description: string; intensity: number; technique: string }> {
    const intensityValue = { subtle: 1, moderate: 2, strong: 3, overwhelming: 4 }[intensity];

    return [
      { stage: 1, description: '情感萌芽', intensity: 1, technique: '暗示' },
      { stage: 2, description: '情感积累', intensity: 2, technique: '细节描写' },
      { stage: 3, description: '情感高潮', intensity: intensityValue, technique: '爆发' },
    ];
  }

  private async detectArtisticTechniques(text: string): Promise<
    Array<{
      technique: ArtisticTechnique;
      instances: number;
      examples: string[];
      effectiveness: number;
    }>
  > {
    const techniques: Array<{
      technique: ArtisticTechnique;
      instances: number;
      examples: string[];
      effectiveness: number;
    }> = [];

    const metaphorMatches = text.match(/[像|似|如|若][^，。！？]{2,15}/g) || [];
    if (metaphorMatches.length > 0) {
      techniques.push({
        technique: 'metaphor',
        instances: metaphorMatches.length,
        examples: metaphorMatches.slice(0, 3),
        effectiveness: Math.min(1, metaphorMatches.length / 10),
      });
    }

    const contrastPairs = [
      ['生', '死'],
      ['明', '暗'],
      ['热', '冷'],
      ['快', '慢'],
      ['喜', '悲'],
      ['聚', '散'],
      ['得', '失'],
    ];

    let contrastCount = 0;
    for (const [a, b] of contrastPairs) {
      if (text.includes(a) && text.includes(b)) {
        contrastCount++;
      }
    }

    if (contrastCount > 0) {
      techniques.push({
        technique: 'contrast',
        instances: contrastCount,
        examples: contrastPairs
          .filter(([a, b]) => text.includes(a) && text.includes(b))
          .map(([a, b]) => `${a}与${b}`),
        effectiveness: Math.min(1, contrastCount / 3),
      });
    }

    const sentences = text.split(/[。！？\n]/).filter((s) => s.trim());
    const lengths = sentences.map((s) => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;

    if (variance > 100) {
      techniques.push({
        technique: 'rhythm',
        instances: sentences.length,
        examples: ['长短句交替使用'],
        effectiveness: Math.min(1, variance / 500),
      });
    }

    const showDontTellScore = this.assessShowDontTell(text);
    techniques.push({
      technique: 'show_dont_tell',
      instances: showDontTellScore.instances,
      examples: showDontTellScore.examples,
      effectiveness: showDontTellScore.effectiveness,
    });

    return techniques;
  }

  private assessShowDontTell(text: string): {
    instances: number;
    examples: string[];
    effectiveness: number;
  } {
    const tellWords = ['感到', '觉得', '非常', '很', '十分', '极其'];
    const showPatterns = [/[手|心|眼|脸][^，。！？]{3,15}/g, /[颤抖|心跳|呼吸|汗水][^，。！？]*/g];

    let tellCount = 0;
    for (const word of tellWords) {
      const regex = new RegExp(word, 'g');
      const matches = text.match(regex);
      if (matches) {
        tellCount += matches.length;
      }
    }

    let showCount = 0;
    const showExamples: string[] = [];
    for (const pattern of showPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        showCount += matches.length;
        showExamples.push(...matches.slice(0, 2));
      }
    }

    const effectiveness =
      showCount > 0 ? Math.max(0, 1 - tellCount / (showCount + tellCount + 1)) : 0;

    return {
      instances: showCount,
      examples: showExamples,
      effectiveness,
    };
  }

  private calculateOverallScore(
    whiteSpacePatterns: WhiteSpacePattern[],
    emotionTransmissions: EmotionTransmission[],
    artisticTechniques: Array<{ effectiveness: number }>
  ): number {
    const whiteSpaceScore = Math.min(1, whiteSpacePatterns.length / 5);
    const emotionScore =
      emotionTransmissions.length > 0
        ? emotionTransmissions.reduce((sum, e) => sum + (e.examples[0]?.effectiveness || 0.5), 0) /
          emotionTransmissions.length
        : 0.3;
    const techniqueScore =
      artisticTechniques.length > 0
        ? artisticTechniques.reduce((sum, t) => sum + t.effectiveness, 0) /
          artisticTechniques.length
        : 0.3;

    return whiteSpaceScore * 0.3 + emotionScore * 0.4 + techniqueScore * 0.3;
  }

  private generateRecommendations(
    whiteSpacePatterns: WhiteSpacePattern[],
    _emotionTransmissions: EmotionTransmission[],
    artisticTechniques: Array<{
      technique: ArtisticTechnique;
      instances: number;
      effectiveness: number;
    }>
  ): StyleRecommendation[] {
    const recommendations: StyleRecommendation[] = [];

    if (whiteSpacePatterns.length < 2) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'add_white_space',
        priority: 'medium',
        description: '建议增加留白效果，给读者更多想象空间',
        example: '在情感转折处使用段落间隔，让读者自行体会情感变化',
        expectedImprovement: '增强阅读体验的层次感',
      });
    }

    const showTechnique = artisticTechniques.find((t) => t.technique === 'show_dont_tell');
    if (showTechnique && showTechnique.effectiveness < 0.5) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'improve_technique',
        priority: 'high',
        description: '建议减少直接描述情感，改用细节展示',
        example: '不要写"他很伤心"，而是写"他的眼眶微微泛红，手指无意识地摩挲着那张旧照片"',
        expectedImprovement: '让情感表达更加真实动人',
      });
    }

    const metaphorTechnique = artisticTechniques.find((t) => t.technique === 'metaphor');
    if (!metaphorTechnique || metaphorTechnique.instances < 2) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'improve_technique',
        priority: 'low',
        description: '建议适当使用比喻修辞，增强表达效果',
        example: '用"心如止水"代替"平静"，用"怒火中烧"代替"生气"',
        expectedImprovement: '让文字更加生动形象',
      });
    }

    return recommendations;
  }

  async createProfile(
    name: string,
    description: string,
    analysisResult: StyleAnalysisResult
  ): Promise<ArtisticStyleProfile> {
    const now = Date.now();
    const profile: ArtisticStyleProfile = {
      id: `profile_${uuidv4()}`,
      name,
      description,
      whiteSpaceUsage: {
        frequency: analysisResult.whiteSpacePatterns.length,
        types: analysisResult.whiteSpacePatterns.reduce(
          (acc, p) => {
            const existing = acc.find((a) => a.type === p.type);
            if (existing) {
              existing.count++;
            } else {
              acc.push({ type: p.type, count: 1 });
            }
            return acc;
          },
          [] as Array<{ type: string; count: number }>
        ),
        effectiveness: analysisResult.whiteSpacePatterns.length > 0 ? 0.7 : 0.3,
      },
      emotionTransmission: {
        dominantEmotions: [...new Set(analysisResult.emotionTransmissions.map((e) => e.emotion))],
        averageIntensity: analysisResult.emotionTransmissions.length > 0 ? 0.6 : 0.3,
        techniques: analysisResult.emotionTransmissions
          .flatMap((e) => e.techniques)
          .reduce(
            (acc, t) => {
              const existing = acc.find((a) => a.technique === t.type);
              if (existing) {
                existing.frequency++;
              } else {
                acc.push({ technique: t.type, frequency: 1 });
              }
              return acc;
            },
            [] as Array<{ technique: string; frequency: number }>
          ),
      },
      artisticTechniques: analysisResult.artisticTechniques.map((t) => ({
        technique: t.technique,
        frequency: t.instances,
        effectiveness: t.effectiveness,
        examples: t.examples,
      })),
      strengths: analysisResult.artisticTechniques
        .filter((t) => t.effectiveness > 0.6)
        .map((t) => ARTISTIC_TECHNIQUE_LABELS[t.technique]),
      areasToImprove: analysisResult.recommendations
        .filter((r) => r.priority === 'high')
        .map((r) => r.description),
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    await this.saveToDisk();
    return profile;
  }

  async addExample(
    source: string,
    category: ArtisticTechnique | EmotionType,
    text: string,
    analysis: string,
    tags: string[]
  ): Promise<ArtisticExample> {
    const example: ArtisticExample = {
      id: `example_${uuidv4()}`,
      source,
      category,
      text,
      analysis,
      tags,
      rating: 0,
    };

    this.examples.set(example.id, example);
    await this.saveToDisk();
    return example;
  }

  getProfile(id: string): ArtisticStyleProfile | undefined {
    return this.profiles.get(id);
  }

  getAllProfiles(): ArtisticStyleProfile[] {
    return Array.from(this.profiles.values());
  }

  getExamplesByCategory(category: ArtisticTechnique | EmotionType): ArtisticExample[] {
    return Array.from(this.examples.values()).filter((e) => e.category === category);
  }

  async applyStyleGuidance(
    content: string,
    profileId: string
  ): Promise<{
    original: string;
    suggestions: Array<{ position: number; suggestion: string; reason: string }>;
  }> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return { original: content, suggestions: [] };
    }

    const suggestions: Array<{ position: number; suggestion: string; reason: string }> = [];

    if (profile.whiteSpaceUsage.frequency < 3) {
      const sentences = content.split(/[。！？]/);
      for (let i = 0; i < sentences.length; i++) {
        if (i > 0 && sentences[i].length > 50 && sentences[i - 1].length > 50) {
          const prevEmotion = this.detectEmotion(sentences[i - 1]);
          const currEmotion = this.detectEmotion(sentences[i]);
          if (prevEmotion !== currEmotion) {
            suggestions.push({
              position: content.indexOf(sentences[i]),
              suggestion: '此处可添加段落分隔，形成情感留白',
              reason: '情感转换处适合使用留白',
            });
            break;
          }
        }
      }
    }

    const showProfile = profile.artisticTechniques.find((t) => t.technique === 'show_dont_tell');
    if (showProfile && showProfile.effectiveness < 0.5) {
      const tellMatches = content.matchAll(/(感到|觉得|非常|很)[^，。！？]{2,10}/g);
      for (const match of tellMatches) {
        suggestions.push({
          position: match.index || 0,
          suggestion: `将"${match[0]}"改为细节描写`,
          reason: '展示而非讲述，让读者自己感受',
        });
      }
    }

    return { original: content, suggestions };
  }

  deleteProfile(id: string): boolean {
    const result = this.profiles.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  getStats(): {
    totalProfiles: number;
    totalExamples: number;
    byTechnique: Record<string, number>;
    byEmotion: Record<string, number>;
  } {
    const byTechnique: Record<string, number> = {};
    const byEmotion: Record<string, number> = {};

    for (const example of this.examples.values()) {
      if (example.category in ARTISTIC_TECHNIQUE_LABELS) {
        byTechnique[example.category] = (byTechnique[example.category] || 0) + 1;
      } else {
        byEmotion[example.category] = (byEmotion[example.category] || 0) + 1;
      }
    }

    return {
      totalProfiles: this.profiles.size,
      totalExamples: this.examples.size,
      byTechnique,
      byEmotion,
    };
  }
}

export function createArtisticStyleService(projectPath: string): ArtisticStyleService {
  return new ArtisticStyleService(projectPath);
}
