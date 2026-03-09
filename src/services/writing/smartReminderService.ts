import {
  Contradiction,
  ContradictionType,
  ContradictionSeverity,
  PacingAnalysis,
  PacingPhaseAnalysis,
  PacingIssue,
  PacingRecommendation,
  SmartReminder,
  PacingIssueType,
  PacingPhase,
  PACING_ISSUE_LABELS,
} from '@/types/writing/smartReminder';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class SmartReminderService {
  private projectPath: string;
  private contradictions: Map<string, Contradiction> = new Map();
  private reminders: Map<string, SmartReminder> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const contradictionsPath = `${this.projectPath}/设定/智能提醒/矛盾检测.json`;
      const remindersPath = `${this.projectPath}/设定/智能提醒/提醒列表.json`;

      const contradictionsContent = await workshopService.readFile(contradictionsPath);
      if (contradictionsContent) {
        const data: Contradiction[] = JSON.parse(contradictionsContent);
        this.contradictions = new Map(data.map((c) => [c.id, c]));
      }

      const remindersContent = await workshopService.readFile(remindersPath);
      if (remindersContent) {
        const data: SmartReminder[] = JSON.parse(remindersContent);
        this.reminders = new Map(data.map((r) => [r.id, r]));
      }
    } catch (error) {
      logger.error('加载智能提醒数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/智能提醒`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/矛盾检测.json`,
        JSON.stringify(Array.from(this.contradictions.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/提醒列表.json`,
        JSON.stringify(Array.from(this.reminders.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存智能提醒数据失败', { error });
    }
  }

  async runContradictionCheck(): Promise<Contradiction[]> {
    const newContradictions: Contradiction[] = [];

    const chapters = await this.loadChapters();
    const characters = await this.loadCharacters();
    const settings = await this.loadSettings();

    const powerContradictions = this.checkPowerConsistency(characters, chapters);
    newContradictions.push(...powerContradictions);

    const locationContradictions = this.checkLocationConsistency(characters, chapters);
    newContradictions.push(...locationContradictions);

    const relationshipContradictions = this.checkRelationshipConsistency(characters, chapters);
    newContradictions.push(...relationshipContradictions);

    const worldRuleContradictions = this.checkWorldRuleConsistency(settings, chapters);
    newContradictions.push(...worldRuleContradictions);

    for (const contradiction of newContradictions) {
      this.contradictions.set(contradiction.id, contradiction);
    }

    await this.saveToDisk();
    return newContradictions;
  }

  private async loadChapters(): Promise<Array<{ name: string; content: string; number: number }>> {
    const chapters: Array<{ name: string; content: string; number: number }> = [];
    try {
      const contentPath = `${this.projectPath}/正文`;
      const entries = await workshopService.readDirectory(contentPath);

      for (const entry of entries.filter((e) => !e.isDirectory && e.name.endsWith('.md'))) {
        const content = await workshopService.readFile(`${contentPath}/${entry.name}`);
        if (content) {
          const number = parseInt(entry.name.match(/第?(\d+)/)?.[1] || '0', 10);
          chapters.push({ name: entry.name, content, number });
        }
      }
    } catch {
      return [];
    }
    return chapters.sort((a, b) => a.number - b.number);
  }

  private async loadCharacters(): Promise<Array<Record<string, unknown>>> {
    try {
      const content = await workshopService.readFile(`${this.projectPath}/设定/人物档案.json`);
      return content ? JSON.parse(content) : [];
    } catch {
      return [];
    }
  }

  private async loadSettings(): Promise<Record<string, unknown>> {
    try {
      const content = await workshopService.readFile(`${this.projectPath}/设定/世界观设定.json`);
      return content ? JSON.parse(content) : {};
    } catch {
      return {};
    }
  }

  private checkPowerConsistency(
    characters: Array<Record<string, unknown>>,
    chapters: Array<{ name: string; content: string; number: number }>
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const char of characters) {
      const charName = String(char.name || '');
      const charPower = char.powerLevel || char.power_level;

      if (!charName || !charPower) {
        continue;
      }

      const powerPattern = new RegExp(`${charName}[^。]*?(击败|战胜|打败|压制)[^。]*`, 'g');
      const defeatedPattern = new RegExp(`${charName}[^。]*?(败|输|不敌|被击败)[^。]*`, 'g');

      for (let i = 0; i < chapters.length - 1; i++) {
        const currentChapter = chapters[i];
        const nextChapter = chapters[i + 1];

        const currentDefeats = currentChapter.content.match(powerPattern) || [];
        const nextDefeated = nextChapter.content.match(defeatedPattern) || [];

        if (currentDefeats.length > 0 && nextDefeated.length > 0) {
          contradictions.push({
            id: `contradiction_${uuidv4()}`,
            type: 'character_ability',
            severity: 'major',
            title: `${charName} 战力表现矛盾`,
            description: `角色在第${currentChapter.number}章击败强敌，但在第${nextChapter.number}章却轻易败北`,
            location1: {
              type: 'chapter',
              reference: `第${currentChapter.number}章`,
              content: currentDefeats[0] || '',
            },
            location2: {
              type: 'chapter',
              reference: `第${nextChapter.number}章`,
              content: nextDefeated[0] || '',
            },
            conflict: '战力表现前后不一致',
            resolution: '需要解释战力变化原因或调整情节',
            autoFixable: false,
            suggestedFixes: [
              '添加战力变化的解释（如受伤、状态不佳）',
              '调整其中一章的战斗结果',
              '增加对手实力的描述',
            ],
            detectedAt: Date.now(),
            status: 'detected',
          });
        }
      }
    }

    return contradictions;
  }

  private checkLocationConsistency(
    characters: Array<Record<string, unknown>>,
    chapters: Array<{ name: string; content: string; number: number }>
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const char of characters) {
      const charName = String(char.name || '');
      if (!charName) {
        continue;
      }

      const locationPattern = new RegExp(`${charName}[^。]*?在([^，。]+)[^。]*`, 'g');
      const chapterLocations: Array<{ chapter: number; location: string; context: string }> = [];

      for (const chapter of chapters) {
        const matches = chapter.content.matchAll(locationPattern);
        for (const match of matches) {
          chapterLocations.push({
            chapter: chapter.number,
            location: match[1],
            context: match[0],
          });
        }
      }

      for (let i = 0; i < chapterLocations.length - 1; i++) {
        const current = chapterLocations[i];
        const next = chapterLocations[i + 1];

        if (current.chapter === next.chapter && current.location !== next.location) {
          const distance = this.calculateLocationDistance(current.location, next.location);

          if (distance > 100) {
            contradictions.push({
              id: `contradiction_${uuidv4()}`,
              type: 'timeline',
              severity: 'critical',
              title: `${charName} 位置瞬移`,
              description: `角色在同一章节内同时出现在 ${current.location} 和 ${next.location}`,
              location1: {
                type: 'chapter',
                reference: `第${current.chapter}章`,
                content: current.context,
              },
              location2: {
                type: 'chapter',
                reference: `第${next.chapter}章`,
                content: next.context,
              },
              conflict: '角色位置不合理',
              resolution: '需要添加移动过程或调整位置描述',
              autoFixable: false,
              suggestedFixes: [
                '添加从一个地点到另一个地点的移动描述',
                '修改其中一个位置描述',
                '说明使用了特殊移动方式（如传送）',
              ],
              detectedAt: Date.now(),
              status: 'detected',
            });
          }
        }
      }
    }

    return contradictions;
  }

  private calculateLocationDistance(loc1: string, loc2: string): number {
    const knownDistances: Record<string, Record<string, number>> = {
      京城: { 江南: 500, 北疆: 800, 西域: 1200 },
      江南: { 京城: 500, 北疆: 1000, 西域: 1500 },
    };

    return knownDistances[loc1]?.[loc2] || (loc1 === loc2 ? 0 : 100);
  }

  private checkRelationshipConsistency(
    characters: Array<Record<string, unknown>>,
    chapters: Array<{ name: string; content: string; number: number }>
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const char of characters) {
      const charName = String(char.name || '');
      const relationships = (char.relationships || []) as Array<{ targetId: string; type: string }>;

      for (const rel of relationships) {
        const target = characters.find((c) => c.id === rel.targetId);
        if (!target) {
          continue;
        }

        const targetName = String(target.name || '');

        if (rel.type === 'enemy' || rel.type === '敌人') {
          const friendlyPattern = new RegExp(
            `${charName}[^。]*?(与|和)${targetName}[^。]*?(友好|合作|联手|并肩)[^。]*`,
            'g'
          );

          for (const chapter of chapters) {
            const matches = chapter.content.match(friendlyPattern);
            if (matches && matches.length > 0) {
              contradictions.push({
                id: `contradiction_${uuidv4()}`,
                type: 'relationship',
                severity: 'minor',
                title: `${charName} 与 ${targetName} 关系矛盾`,
                description: '设定为敌人关系，但出现了友好互动',
                location1: {
                  type: 'character_file',
                  reference: '人物档案',
                  content: `${charName} 与 ${targetName} 是敌人关系`,
                },
                location2: {
                  type: 'chapter',
                  reference: `第${chapter.number}章`,
                  content: matches[0],
                },
                conflict: '关系表现与设定不符',
                resolution: '需要解释关系变化或修改设定',
                autoFixable: false,
                suggestedFixes: ['添加关系转变的情节', '说明是临时合作', '修改人物关系设定'],
                detectedAt: Date.now(),
                status: 'detected',
              });
            }
          }
        }
      }
    }

    return contradictions;
  }

  private checkWorldRuleConsistency(
    settings: Record<string, unknown>,
    chapters: Array<{ name: string; content: string; number: number }>
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    const powerLevels = (settings.powerLevels || settings.power_levels || []) as Array<{
      name: string;
      rank: number;
    }>;
    if (powerLevels.length === 0) {
      return contradictions;
    }

    const levelNames = powerLevels.map((l) => l.name);

    const breakthroughPattern = /突破[^。]*?([^\s，。]+)境/g;

    for (const chapter of chapters) {
      const breakthroughMatches = chapter.content.matchAll(breakthroughPattern);
      for (const match of breakthroughMatches) {
        const newLevel = match[1];
        if (!levelNames.includes(newLevel)) {
          contradictions.push({
            id: `contradiction_${uuidv4()}`,
            type: 'world_rule',
            severity: 'major',
            title: `未知境界等级: ${newLevel}`,
            description: `第${chapter.number}章出现了未定义的境界等级: ${newLevel}`,
            location1: {
              type: 'setting_file',
              reference: '世界观设定',
              content: `已定义等级: ${levelNames.join('、')}`,
            },
            location2: {
              type: 'chapter',
              reference: `第${chapter.number}章`,
              content: match[0],
            },
            conflict: '使用了未定义的世界观设定',
            resolution: '需要添加新等级到设定或修改描述',
            autoFixable: false,
            suggestedFixes: [`在设定中添加 "${newLevel}" 境界`, '修改为已定义的境界名称'],
            detectedAt: Date.now(),
            status: 'detected',
          });
        }
      }
    }

    return contradictions;
  }

  async analyzePacing(): Promise<PacingAnalysis> {
    const chapters = await this.loadChapters();
    if (chapters.length === 0) {
      return this.getEmptyPacingAnalysis();
    }

    const phases = this.analyzePacingPhases(chapters);
    const issues = this.detectPacingIssues(chapters, phases);
    const tensionCurve = this.calculateTensionCurve(chapters);
    const emotionCurve = this.calculateEmotionCurve(chapters);
    const recommendations = this.generatePacingRecommendations(chapters, phases, issues);

    const overallPacing = this.determineOverallPacing(issues);
    const averageSpeed = this.calculateAverageSpeed(chapters);

    return {
      overallPacing,
      averageSpeed,
      phases,
      issues,
      tensionCurve,
      emotionCurve,
      recommendations,
    };
  }

  private getEmptyPacingAnalysis(): PacingAnalysis {
    return {
      overallPacing: null,
      averageSpeed: 0,
      phases: [],
      issues: [],
      tensionCurve: [],
      emotionCurve: [],
      recommendations: [],
    };
  }

  private analyzePacingPhases(
    chapters: Array<{ name: string; content: string; number: number }>
  ): PacingPhaseAnalysis[] {
    const totalChapters = chapters.length;
    const phases: PacingPhaseAnalysis[] = [];

    const phaseDefinitions: Array<{ phase: PacingPhase; startRatio: number; endRatio: number }> = [
      { phase: 'opening', startRatio: 0, endRatio: 0.1 },
      { phase: 'rising', startRatio: 0.1, endRatio: 0.6 },
      { phase: 'climax', startRatio: 0.6, endRatio: 0.8 },
      { phase: 'falling', startRatio: 0.8, endRatio: 0.9 },
      { phase: 'resolution', startRatio: 0.9, endRatio: 1 },
    ];

    for (const def of phaseDefinitions) {
      const startChapter = Math.floor(totalChapters * def.startRatio) + 1;
      const endChapter = Math.floor(totalChapters * def.endRatio);

      if (startChapter <= endChapter) {
        const phaseChapters = chapters.filter(
          (c) => c.number >= startChapter && c.number <= endChapter
        );

        const speed = this.calculatePhaseSpeed(phaseChapters);
        const tensionLevel = this.calculatePhaseTension(phaseChapters);
        const eventCount = this.countPhaseEvents(phaseChapters);
        const phaseIssues = this.identifyPhaseIssues(def.phase, speed, tensionLevel, eventCount);

        phases.push({
          phase: def.phase,
          startChapter,
          endChapter,
          speed,
          tensionLevel,
          eventCount,
          issues: phaseIssues,
        });
      }
    }

    return phases;
  }

  private calculatePhaseSpeed(chapters: Array<{ content: string }>): number {
    if (chapters.length === 0) {
      return 0;
    }

    const totalEvents = chapters.reduce((sum, ch) => {
      const sentences = ch.content.split(/[。！？]/).filter((s) => s.trim());
      const actionSentences = sentences.filter((s) => /[打|杀|战|斗|冲|逃|追|攻|守|胜|败]/.test(s));
      return sum + actionSentences.length;
    }, 0);

    return totalEvents / chapters.length;
  }

  private calculatePhaseTension(chapters: Array<{ content: string }>): number {
    if (chapters.length === 0) {
      return 0;
    }

    const tensionKeywords = ['紧张', '危险', '危机', '生死', '绝望', '恐惧', '愤怒'];
    let totalTension = 0;

    for (const chapter of chapters) {
      for (const keyword of tensionKeywords) {
        const regex = new RegExp(keyword, 'g');
        const matches = chapter.content.match(regex);
        if (matches) {
          totalTension += matches.length;
        }
      }
    }

    return Math.min(10, totalTension / chapters.length);
  }

  private countPhaseEvents(chapters: Array<{ content: string }>): number {
    let eventCount = 0;

    for (const chapter of chapters) {
      const paragraphs = chapter.content.split('\n\n').filter((p) => p.trim());
      eventCount += paragraphs.length;
    }

    return eventCount;
  }

  private identifyPhaseIssues(
    phase: PacingPhase,
    speed: number,
    tension: number,
    eventCount: number
  ): string[] {
    const issues: string[] = [];

    if (phase === 'opening' && speed > 5) {
      issues.push('开篇节奏过快，缺少铺垫');
    }
    if (phase === 'opening' && eventCount < 3) {
      issues.push('开篇事件过少，可能显得拖沓');
    }
    if (phase === 'rising' && tension < 3) {
      issues.push('上升阶段张力不足');
    }
    if (phase === 'climax' && tension < 6) {
      issues.push('高潮阶段张力不够强烈');
    }
    if (phase === 'resolution' && speed > 3) {
      issues.push('结局过于仓促');
    }

    return issues;
  }

  private detectPacingIssues(
    chapters: Array<{ name: string; content: string; number: number }>,
    phases: PacingPhaseAnalysis[]
  ): PacingIssue[] {
    const issues: PacingIssue[] = [];

    for (const phase of phases) {
      for (const issueText of phase.issues) {
        let issueType: PacingIssueType = 'uneven';

        if (issueText.includes('过快')) {
          issueType = 'too_fast';
        } else if (issueText.includes('拖沓') || issueText.includes('过少')) {
          issueType = 'too_slow';
        } else if (issueText.includes('仓促')) {
          issueType = 'rushed_ending';
        }

        issues.push({
          id: `pacing_${uuidv4()}`,
          type: issueType,
          location: {
            startChapter: phase.startChapter,
            endChapter: phase.endChapter,
          },
          description: issueText,
          impact: `影响第${phase.startChapter}-${phase.endChapter}章的阅读体验`,
          suggestion: this.getPacingSuggestion(issueType, phase.phase),
        });
      }
    }

    const speedVariation = this.calculateSpeedVariation(chapters);
    if (speedVariation > 2) {
      issues.push({
        id: `pacing_${uuidv4()}`,
        type: 'uneven',
        location: {
          startChapter: 1,
          endChapter: chapters.length,
        },
        description: '整体节奏波动较大，缺乏连贯性',
        impact: '可能影响读者的沉浸感',
        suggestion: '建议调整各章节的事件密度，使节奏更加均匀',
      });
    }

    return issues;
  }

  private calculateSpeedVariation(chapters: Array<{ content: string }>): number {
    if (chapters.length < 2) {
      return 0;
    }

    const speeds = chapters.map((ch) => {
      const sentences = ch.content.split(/[。！？]/).filter((s) => s.trim());
      return sentences.length;
    });

    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / speeds.length;

    return Math.sqrt(variance) / avg;
  }

  private getPacingSuggestion(issueType: PacingIssueType, phase: PacingPhase): string {
    const suggestions: Record<PacingIssueType, Record<PacingPhase, string>> = {
      too_fast: {
        opening: '在开篇添加更多世界观和人物铺垫',
        rising: '增加细节描写和人物内心活动',
        climax: '适当放慢高潮节奏，增加细节',
        falling: '添加高潮后的余波描写',
        resolution: '给读者更多时间消化结局',
      },
      too_slow: {
        opening: '加快进入主线剧情的速度',
        rising: '增加冲突和事件密度',
        climax: '确保高潮足够紧凑有力',
        falling: '避免拖沓，保持节奏',
        resolution: '简洁有力地收尾',
      },
      uneven: {
        opening: '保持开篇节奏的一致性',
        rising: '均匀分布事件和冲突',
        climax: '确保高潮部分节奏紧凑',
        falling: '平滑过渡到结局',
        resolution: '保持整体节奏的连贯',
      },
      monotonous: {
        opening: '增加开篇的变化和悬念',
        rising: '引入不同类型的事件',
        climax: '确保高潮有足够的变化',
        falling: '添加转折和意外',
        resolution: '给结局增加惊喜元素',
      },
      rushed_ending: {
        opening: '',
        rising: '',
        climax: '',
        falling: '',
        resolution: '扩展结局部分，给读者更多满足感',
      },
      slow_start: {
        opening: '加快开篇节奏，尽早引入冲突',
        rising: '',
        climax: '',
        falling: '',
        resolution: '',
      },
    };

    return suggestions[issueType][phase] || '调整节奏以改善阅读体验';
  }

  private calculateTensionCurve(chapters: Array<{ content: string }>): number[] {
    return chapters.map((ch) => {
      const tensionKeywords = [
        '紧张',
        '危险',
        '危机',
        '生死',
        '绝望',
        '恐惧',
        '愤怒',
        '战斗',
        '冲突',
      ];
      let tension = 0;

      for (const keyword of tensionKeywords) {
        const regex = new RegExp(keyword, 'g');
        const matches = ch.content.match(regex);
        if (matches) {
          tension += matches.length;
        }
      }

      return Math.min(10, tension / 10);
    });
  }

  private calculateEmotionCurve(chapters: Array<{ content: string }>): number[] {
    const positiveWords = ['开心', '幸福', '喜悦', '满足', '希望', '爱'];
    const negativeWords = ['悲伤', '痛苦', '绝望', '愤怒', '恐惧', '恨'];

    return chapters.map((ch) => {
      let positive = 0;
      let negative = 0;

      for (const word of positiveWords) {
        const regex = new RegExp(word, 'g');
        const matches = ch.content.match(regex);
        if (matches) {
          positive += matches.length;
        }
      }

      for (const word of negativeWords) {
        const regex = new RegExp(word, 'g');
        const matches = ch.content.match(regex);
        if (matches) {
          negative += matches.length;
        }
      }

      return (positive - negative) / Math.max(1, positive + negative);
    });
  }

  private generatePacingRecommendations(
    _chapters: Array<{ name: string; content: string; number: number }>,
    _phases: PacingPhaseAnalysis[],
    issues: PacingIssue[]
  ): PacingRecommendation[] {
    const recommendations: PacingRecommendation[] = [];

    for (const issue of issues) {
      if (issue.type === 'too_fast') {
        recommendations.push({
          id: `rec_${uuidv4()}`,
          type: 'add_content',
          priority: 'medium',
          location: { chapter: issue.location.startChapter },
          description: issue.suggestion,
          example: '可以添加环境描写、人物内心活动或对话来放慢节奏',
          expectedEffect: '使节奏更加舒缓，增强阅读体验',
        });
      } else if (issue.type === 'too_slow') {
        recommendations.push({
          id: `rec_${uuidv4()}`,
          type: 'remove_content',
          priority: 'medium',
          location: { chapter: issue.location.startChapter },
          description: issue.suggestion,
          example: '可以精简描写，加快剧情推进',
          expectedEffect: '使节奏更加紧凑，保持读者兴趣',
        });
      } else if (issue.type === 'uneven') {
        recommendations.push({
          id: `rec_${uuidv4()}`,
          type: 'rearrange',
          priority: 'low',
          location: { chapter: issue.location.startChapter },
          description: issue.suggestion,
          expectedEffect: '使整体节奏更加流畅',
        });
      }
    }

    return recommendations;
  }

  private determineOverallPacing(issues: PacingIssue[]): PacingIssueType | null {
    if (issues.length === 0) {
      return null;
    }

    const typeCounts = new Map<PacingIssueType, number>();
    for (const issue of issues) {
      typeCounts.set(issue.type, (typeCounts.get(issue.type) || 0) + 1);
    }

    let maxType: PacingIssueType | null = null;
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxType = type;
        maxCount = count;
      }
    }

    return maxType;
  }

  private calculateAverageSpeed(chapters: Array<{ content: string }>): number {
    if (chapters.length === 0) {
      return 0;
    }

    const totalLength = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
    return totalLength / chapters.length;
  }

  async generateSmartReminders(): Promise<SmartReminder[]> {
    const reminders: SmartReminder[] = [];

    const contradictions = await this.runContradictionCheck();
    for (const contradiction of contradictions) {
      reminders.push({
        id: `reminder_${uuidv4()}`,
        type: 'contradiction',
        priority:
          contradiction.severity === 'critical'
            ? 'critical'
            : contradiction.severity === 'major'
              ? 'high'
              : 'medium',
        title: contradiction.title,
        description: contradiction.description,
        relatedData: { contradictionId: contradiction.id },
        action: {
          type: 'fix',
          suggestions: contradiction.suggestedFixes,
        },
        createdAt: Date.now(),
        dismissed: false,
      });
    }

    const pacingAnalysis = await this.analyzePacing();
    for (const issue of pacingAnalysis.issues) {
      reminders.push({
        id: `reminder_${uuidv4()}`,
        type: 'pacing',
        priority: issue.type === 'rushed_ending' ? 'high' : 'medium',
        title: `节奏问题: ${PACING_ISSUE_LABELS[issue.type]}`,
        description: issue.description,
        relatedData: {
          chapterRange: [issue.location.startChapter, issue.location.endChapter],
        },
        action: {
          type: 'review',
          suggestions: [issue.suggestion],
        },
        createdAt: Date.now(),
        dismissed: false,
      });
    }

    for (const reminder of reminders) {
      this.reminders.set(reminder.id, reminder);
    }

    await this.saveToDisk();
    return reminders;
  }

  getContradiction(id: string): Contradiction | undefined {
    return this.contradictions.get(id);
  }

  getAllContradictions(): Contradiction[] {
    return Array.from(this.contradictions.values());
  }

  getUnresolvedContradictions(): Contradiction[] {
    return this.getAllContradictions().filter((c) => c.status === 'detected');
  }

  async resolveContradiction(id: string, resolution: string): Promise<boolean> {
    const contradiction = this.contradictions.get(id);
    if (!contradiction) {
      return false;
    }

    contradiction.status = 'resolved';
    contradiction.resolution = resolution;
    await this.saveToDisk();
    return true;
  }

  getReminder(id: string): SmartReminder | undefined {
    return this.reminders.get(id);
  }

  getActiveReminders(): SmartReminder[] {
    return Array.from(this.reminders.values()).filter((r) => !r.dismissed);
  }

  async dismissReminder(id: string): Promise<boolean> {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      return false;
    }

    reminder.dismissed = true;
    await this.saveToDisk();
    return true;
  }

  getStats(): {
    totalContradictions: number;
    unresolvedContradictions: number;
    totalReminders: number;
    activeReminders: number;
    byType: Record<ContradictionType, number>;
    bySeverity: Record<ContradictionSeverity, number>;
  } {
    const contradictions = this.getAllContradictions();
    const reminders = this.getActiveReminders();

    const byType: Record<ContradictionType, number> = {
      character_behavior: 0,
      character_ability: 0,
      timeline: 0,
      setting: 0,
      relationship: 0,
      plot_logic: 0,
      world_rule: 0,
      dialogue: 0,
    };

    const bySeverity: Record<ContradictionSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      potential: 0,
    };

    for (const c of contradictions) {
      byType[c.type]++;
      bySeverity[c.severity]++;
    }

    return {
      totalContradictions: contradictions.length,
      unresolvedContradictions: this.getUnresolvedContradictions().length,
      totalReminders: this.reminders.size,
      activeReminders: reminders.length,
      byType,
      bySeverity,
    };
  }
}

export function createSmartReminderService(projectPath: string): SmartReminderService {
  return new SmartReminderService(projectPath);
}
