import { workshopService } from '../core/workshopService';
import { MemoryService } from '../knowledge/memoryService';
import { KnowledgeService } from '../knowledge/knowledgeService';

export interface CompressionOptions {
  maxTokens: number;
  includeCharacters: boolean;
  includeTimeline: boolean;
  includeForeshadowing: boolean;
  includeWorldbuilding: boolean;
  includeRecentContent: boolean;
  recentChaptersCount: number;
  focusCharacter?: string;
  focusLocation?: string;
  focusPlot?: string;
}

export interface CompressedContext {
  summary: string;
  characters: CharacterSummary[];
  timeline: TimelineSummary;
  activeForeshadowing: string[];
  worldbuilding: WorldbuildingSummary[];
  recentContent: string;
  focusContext: string;
  totalTokens: number;
  compressionRatio: number;
}

export interface CharacterSummary {
  name: string;
  role: string;
  keyTraits: string[];
  recentActions: string[];
  relationships: string[];
}

export interface TimelineSummary {
  currentPoint: string;
  recentEvents: string[];
  upcomingEvents: string[];
}

export interface WorldbuildingSummary {
  category: string;
  name: string;
  keyInfo: string;
}

export class ContextCompressionService {
  private projectPath: string;
  private memoryService: MemoryService | null = null;
  private knowledgeService: KnowledgeService | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  setMemoryService(service: MemoryService): void {
    this.memoryService = service;
  }

  setKnowledgeService(service: KnowledgeService): void {
    this.knowledgeService = service;
  }

  async compress(options: Partial<CompressionOptions> = {}): Promise<CompressedContext> {
    const opts: CompressionOptions = {
      maxTokens: 4000,
      includeCharacters: true,
      includeTimeline: true,
      includeForeshadowing: true,
      includeWorldbuilding: true,
      includeRecentContent: true,
      recentChaptersCount: 3,
      ...options,
    };

    let totalTokens = 0;
    const context: CompressedContext = {
      summary: '',
      characters: [],
      timeline: { currentPoint: '', recentEvents: [], upcomingEvents: [] },
      activeForeshadowing: [],
      worldbuilding: [],
      recentContent: '',
      focusContext: '',
      totalTokens: 0,
      compressionRatio: 0,
    };

    context.summary = await this.generateProjectSummary();
    totalTokens += this.estimateTokens(context.summary);

    if (opts.includeCharacters && this.memoryService) {
      const chars = this.memoryService.getCharacters();
      const charSummaries = chars.slice(0, 10).map((char) => ({
        name: char.name,
        role: char.role,
        keyTraits: char.traits.slice(0, 5),
        recentActions: char.arc.slice(-3).map((a) => a.event),
        relationships: char.relationships.map((r) => `${r.targetName}(${r.type})`),
      }));
      context.characters = charSummaries;
      totalTokens += this.estimateTokens(JSON.stringify(charSummaries));
    }

    if (opts.includeTimeline && this.memoryService) {
      const timeline = this.memoryService.getTimeline();
      const recentEvents = timeline.slice(-10).map((e) => `${e.chapter}: ${e.event}`);
      context.timeline = {
        currentPoint: timeline.length > 0 ? timeline[timeline.length - 1].event : '',
        recentEvents,
        upcomingEvents: [],
      };
      totalTokens += this.estimateTokens(JSON.stringify(context.timeline));
    }

    if (opts.includeForeshadowing && this.memoryService) {
      const foreshadows = this.memoryService.getForeshadowing('planted');
      context.activeForeshadowing = foreshadows
        .slice(0, 10)
        .map((f) => `${f.content} (埋设于: ${f.plantedAt})`);
      totalTokens += this.estimateTokens(context.activeForeshadowing.join('\n'));
    }

    if (opts.includeWorldbuilding && this.memoryService) {
      const worlds = this.memoryService.getWorldbuilding();
      context.worldbuilding = worlds.slice(0, 10).map((w) => ({
        category: w.category,
        name: w.name,
        keyInfo: w.description.substring(0, 100),
      }));
      totalTokens += this.estimateTokens(JSON.stringify(context.worldbuilding));
    }

    if (opts.includeRecentContent) {
      context.recentContent = await this.getRecentContent(opts.recentChaptersCount);
      totalTokens += this.estimateTokens(context.recentContent);
    }

    if (opts.focusCharacter || opts.focusLocation || opts.focusPlot) {
      context.focusContext = await this.generateFocusContext(opts);
      totalTokens += this.estimateTokens(context.focusContext);
    }

    context.totalTokens = totalTokens;
    context.compressionRatio = totalTokens > 0 ? opts.maxTokens / totalTokens : 1;

    return context;
  }

  private async generateProjectSummary(): Promise<string> {
    if (!this.memoryService) {
      return '';
    }

    return this.memoryService.getProjectSummary();
  }

  private async getRecentContent(chaptersCount: number): Promise<string> {
    const candidateDirs = [`${this.projectPath}/content`, `${this.projectPath}/chapters`];
    let contentPath: string | null = null;

    for (const dir of candidateDirs) {
      if (await workshopService.pathExists(dir)) {
        contentPath = dir;
        break;
      }
    }

    if (!contentPath) {
      return '';
    }

    try {
      const entries = await workshopService.readDirectory(contentPath);
      const chapterFiles = entries
        .filter((e) => !e.isDirectory && (e.name.endsWith('.txt') || e.name.endsWith('.md')))
        .map((e) => e.name)
        .sort()
        .slice(-chaptersCount);

      const contents: string[] = [];
      for (const file of chapterFiles) {
        const content = await workshopService.readFile(`${contentPath}/${file}`);
        contents.push(`【${file}】\n${content.substring(0, 1000)}...`);
      }

      return contents.join('\n\n---\n\n');
    } catch {
      return '';
    }
  }

  private async generateFocusContext(opts: CompressionOptions): Promise<string> {
    const focusParts: string[] = [];

    if (opts.focusCharacter && this.memoryService) {
      const characters = this.memoryService.getCharacters();
      const char = characters.find(
        (c) => c.name === opts.focusCharacter || c.aliases.includes(opts.focusCharacter!)
      );

      if (char) {
        focusParts.push(`## 聚焦人物: ${char.name}
角色: ${char.role}
描述: ${char.description}
特质: ${char.traits.join(', ')}
关系: ${char.relationships.map((r) => `${r.targetName}(${r.type})`).join(', ')}
发展轨迹: ${char.arc.map((a) => a.event).join(' → ')}
`);
      }
    }

    if (opts.focusLocation && this.memoryService) {
      const worlds = this.memoryService.getWorldbuilding();
      const location = worlds.find(
        (w) => w.category === 'location' && w.name.includes(opts.focusLocation!)
      );

      if (location) {
        focusParts.push(`## 聚焦地点: ${location.name}
${location.description}
规则: ${location.rules.join(', ')}
关联: ${location.connections.join(', ')}
`);
      }
    }

    if (opts.focusPlot && this.knowledgeService) {
      const results = this.knowledgeService.search({
        query: opts.focusPlot,
        limit: 5,
      });

      if (results.length > 0) {
        focusParts.push(`## 聚焦情节: ${opts.focusPlot}
${results.map((r) => r.chunk.content.substring(0, 200)).join('\n\n')}
`);
      }
    }

    return focusParts.join('\n');
  }

  estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars =
      text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length;
    return Math.ceil(chineseChars * 0.5 + englishWords * 1.3 + otherChars * 0.3);
  }

  async compressForContinuation(
    currentChapter: string,
    currentPosition: number,
    options: Partial<CompressionOptions> = {}
  ): Promise<string> {
    const context = await this.compress(options);

    let prompt = `# 小说创作上下文

## 项目概览
${context.summary}

## 当前章节
${currentChapter}

## 当前位置
正在第 ${currentPosition} 字处续写

`;

    if (context.characters.length > 0) {
      prompt += `## 相关人物
${context.characters.map((c) => `- **${c.name}** (${c.role}): ${c.keyTraits.join(', ')}`).join('\n')}

`;
    }

    if (context.timeline.recentEvents.length > 0) {
      prompt += `## 近期事件
${context.timeline.recentEvents.slice(-5).join('\n')}

`;
    }

    if (context.activeForeshadowing.length > 0) {
      prompt += `## 待回收伏笔
${context.activeForeshadowing.slice(0, 5).join('\n')}

`;
    }

    if (context.focusContext) {
      prompt += `## 重点上下文
${context.focusContext}

`;
    }

    return prompt;
  }

  async compressForRevision(
    targetContent: string,
    revisionType: 'style' | 'plot' | 'character' | 'detail',
    options: Partial<CompressionOptions> = {}
  ): Promise<string> {
    const context = await this.compress(options);

    let prompt = `# 小说修改上下文

## 修改类型: ${revisionType}

## 待修改内容
${targetContent.substring(0, 2000)}

`;

    switch (revisionType) {
      case 'style':
        prompt += `## 风格参考
请参考项目整体风格进行修改。

`;
        break;
      case 'plot':
        prompt += `## 情节上下文
${context.timeline.recentEvents.join('\n')}

`;
        break;
      case 'character':
        prompt += `## 人物信息
${context.characters.map((c) => `${c.name}: ${c.keyTraits.join(', ')}`).join('\n')}

`;
        break;
      case 'detail':
        prompt += `## 世界观设定
${context.worldbuilding.map((w) => `${w.name}: ${w.keyInfo}`).join('\n')}

`;
        break;
    }

    return prompt;
  }

  async compressForAnalysis(
    content: string,
    analysisType: 'quality' | 'consistency' | 'plot' | 'character',
    options: Partial<CompressionOptions> = {}
  ): Promise<string> {
    const context = await this.compress(options);

    let prompt = `# 小说分析上下文

## 分析类型: ${analysisType}

## 待分析内容
${content.substring(0, 3000)}

`;

    if (analysisType === 'consistency') {
      prompt += `## 人物设定参考
${context.characters.map((c) => `${c.name}(${c.role}): ${c.keyTraits.join(', ')}`).join('\n')}

## 世界观参考
${context.worldbuilding.map((w) => `${w.name}: ${w.keyInfo}`).join('\n')}

`;
    }

    if (analysisType === 'plot') {
      prompt += `## 时间线参考
${context.timeline.recentEvents.join('\n')}

## 伏笔追踪
${context.activeForeshadowing.join('\n')}

`;
    }

    return prompt;
  }

  async getSmartContextForQuery(query: string): Promise<string> {
    const keywords = this.extractKeywords(query);

    const context = await this.compress({
      maxTokens: 2000,
      includeCharacters: keywords.some((k) => ['人物', '角色', '主角', '配角'].includes(k)),
      includeTimeline: keywords.some((k) => ['情节', '时间', '事件', '发展'].includes(k)),
      includeForeshadowing: keywords.some((k) => ['伏笔', '铺垫', '暗示'].includes(k)),
      includeWorldbuilding: keywords.some((k) => ['世界', '设定', '背景', '地点'].includes(k)),
      includeRecentContent: keywords.some((k) => ['最近', '当前', '最新', '续写'].includes(k)),
    });

    return this.formatContextAsPrompt(context);
  }

  private extractKeywords(query: string): string[] {
    const keywordPatterns = [
      { pattern: /人物|角色|主角|配角|名字/g, keyword: '人物' },
      { pattern: /情节|时间|事件|发展|剧情/g, keyword: '情节' },
      { pattern: /伏笔|铺垫|暗示|回收/g, keyword: '伏笔' },
      { pattern: /世界|设定|背景|地点|场景/g, keyword: '世界' },
      { pattern: /最近|当前|最新|续写|继续/g, keyword: '最近' },
      { pattern: /风格|文风|语气|表达/g, keyword: '风格' },
    ];

    const keywords: string[] = [];
    for (const { pattern, keyword } of keywordPatterns) {
      if (pattern.test(query)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  private formatContextAsPrompt(context: CompressedContext): string {
    const parts: string[] = [];

    if (context.summary) {
      parts.push(`## 项目概览\n${context.summary}`);
    }

    if (context.characters.length > 0) {
      parts.push(
        `## 相关人物\n${context.characters
          .map((c) => `- **${c.name}** (${c.role}): ${c.keyTraits.join(', ')}`)
          .join('\n')}`
      );
    }

    if (context.timeline.recentEvents.length > 0) {
      parts.push(`## 近期事件\n${context.timeline.recentEvents.join('\n')}`);
    }

    if (context.activeForeshadowing.length > 0) {
      parts.push(`## 待回收伏笔\n${context.activeForeshadowing.join('\n')}`);
    }

    if (context.worldbuilding.length > 0) {
      parts.push(
        `## 世界观\n${context.worldbuilding.map((w) => `- **${w.name}**: ${w.keyInfo}`).join('\n')}`
      );
    }

    if (context.focusContext) {
      parts.push(`## 重点上下文\n${context.focusContext}`);
    }

    return parts.join('\n\n');
  }
}

export function createContextCompressionService(projectPath: string): ContextCompressionService {
  return new ContextCompressionService(projectPath);
}
