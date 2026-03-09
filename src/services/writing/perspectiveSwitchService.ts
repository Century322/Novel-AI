import {
  PerspectiveState,
  PerspectiveSwitch,
  PerspectiveStrategy,
  PerspectiveAlternative,
  SwitchSuggestion,
  PlannedSwitch,
  PerspectiveType,
  SwitchTrigger,
  SwitchSmoothness,
  PerspectiveRule,
  PERSPECTIVE_CHARACTERISTICS,
  DEFAULT_PERSPECTIVE_RULES,
} from '@/types/writing/perspectiveSwitch';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class PerspectiveSwitchService {
  private projectPath: string;
  private strategies: Map<string, PerspectiveStrategy> = new Map();
  private rules: PerspectiveRule[] = [...DEFAULT_PERSPECTIVE_RULES];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const strategyPath = `${this.projectPath}/设定/视角策略/策略列表.json`;
      const rulesPath = `${this.projectPath}/设定/视角策略/自定义规则.json`;

      const strategyContent = await workshopService.readFile(strategyPath);
      if (strategyContent) {
        const data: PerspectiveStrategy[] = JSON.parse(strategyContent);
        this.strategies = new Map(data.map((s) => [s.id, s]));
      }

      const rulesContent = await workshopService.readFile(rulesPath);
      if (rulesContent) {
        const customRules: PerspectiveRule[] = JSON.parse(rulesContent);
        this.rules = [...DEFAULT_PERSPECTIVE_RULES, ...customRules];
      }
    } catch (error) {
      logger.error('加载视角策略失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/视角策略`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/策略列表.json`,
        JSON.stringify(Array.from(this.strategies.values()), null, 2)
      );

      const customRules = this.rules.filter(
        (r) => !DEFAULT_PERSPECTIVE_RULES.some((d) => d.id === r.id)
      );
      await workshopService.writeFile(
        `${basePath}/自定义规则.json`,
        JSON.stringify(customRules, null, 2)
      );
    } catch (error) {
      logger.error('保存视角策略失败', { error });
    }
  }

  createStrategy(
    name: string,
    description: string,
    initialPerspective: PerspectiveType = 'third_limited'
  ): PerspectiveStrategy {
    const now = Date.now();
    const strategy: PerspectiveStrategy = {
      id: `strategy_${uuidv4()}`,
      name,
      description,
      currentPerspective: PERSPECTIVE_CHARACTERISTICS[initialPerspective],
      perspectiveHistory: [],
      plannedSwitches: [],
      characterPerspectives: new Map(),
      consistencyRules: this.rules,
      createdAt: now,
      updatedAt: now,
    };

    this.strategies.set(strategy.id, strategy);
    this.saveToDisk();
    return strategy;
  }

  recordSwitch(
    strategyId: string,
    from: PerspectiveState,
    to: PerspectiveState,
    trigger: SwitchTrigger,
    location: { chapter: number; paragraph?: number; context: string },
    reason: string
  ): PerspectiveSwitch | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return null;
    }

    const smoothness = this.evaluateSwitchSmoothness(from, to, trigger);
    const transition = this.generateTransition(from, to, trigger);
    const impact = this.analyzeSwitchImpact(from, to);
    const alternatives = this.generateAlternatives(to, trigger);

    const switchRecord: PerspectiveSwitch = {
      id: `switch_${uuidv4()}`,
      from,
      to,
      trigger,
      location,
      smoothness,
      transition,
      reason,
      impact,
      alternatives,
      createdAt: Date.now(),
    };

    strategy.perspectiveHistory.push(switchRecord);
    strategy.currentPerspective = to;
    strategy.updatedAt = Date.now();

    this.saveToDisk();
    return switchRecord;
  }

  private evaluateSwitchSmoothness(
    from: PerspectiveState,
    to: PerspectiveState,
    trigger: SwitchTrigger
  ): SwitchSmoothness {
    if (from.type === to.type && from.character === to.character) {
      return 'seamless';
    }

    if (trigger === 'scene_change' || trigger === 'time_jump') {
      return 'smooth';
    }

    if (from.type === 'first_person' && to.type === 'first_person') {
      return 'noticeable';
    }

    if (from.type === 'third_omniscient' && to.type === 'first_person') {
      return 'jarring';
    }

    return 'smooth';
  }

  private generateTransition(
    _from: PerspectiveState,
    _to: PerspectiveState,
    trigger: SwitchTrigger
  ): string {
    const transitions: Record<SwitchTrigger, string> = {
      scene_change: '场景转换自然带出视角切换',
      time_jump: '时间跳跃提供了视角转换的契机',
      character_focus: '焦点角色的变化引导视角转换',
      plot_requirement: '剧情需要推动视角转换',
      emotional_shift: '情感氛围的变化伴随视角转换',
      information_reveal: '信息揭示需要视角转换',
      parallel_action: '并行行动需要切换视角展示',
    };

    return transitions[trigger] || '视角转换';
  }

  private analyzeSwitchImpact(from: PerspectiveState, to: PerspectiveState): string {
    const impacts: string[] = [];

    if (from.knowledge !== to.knowledge) {
      impacts.push(`信息获取范围从${from.knowledge}变为${to.knowledge}`);
    }

    if (from.emotionalDistance !== to.emotionalDistance) {
      impacts.push(`情感距离从${from.emotionalDistance}变为${to.emotionalDistance}`);
    }

    if (from.character !== to.character) {
      impacts.push(`焦点角色从${from.character || '无'}变为${to.character || '无'}`);
    }

    return impacts.length > 0 ? impacts.join('；') : '视角转换无明显影响';
  }

  private generateAlternatives(
    current: PerspectiveState,
    trigger: SwitchTrigger
  ): PerspectiveAlternative[] {
    const alternatives: PerspectiveAlternative[] = [];

    const otherTypes: PerspectiveType[] = [
      'first_person',
      'third_limited',
      'third_omniscient',
    ].filter((t) => t !== current.type) as PerspectiveType[];

    for (const type of otherTypes.slice(0, 2)) {
      const state = PERSPECTIVE_CHARACTERISTICS[type];
      const pros: string[] = [];
      const cons: string[] = [];

      if (trigger === 'emotional_shift' && state.emotionalDistance === 'intimate') {
        pros.push('更适合情感场景');
      }
      if (trigger === 'parallel_action' && state.knowledge === 'full') {
        pros.push('能同时展示多条线索');
      }
      if (state.knowledge === 'limited' && trigger === 'information_reveal') {
        cons.push('可能限制信息揭示');
      }

      alternatives.push({
        perspective: state,
        pros,
        cons,
        recommended: pros.length > cons.length,
      });
    }

    return alternatives;
  }

  async suggestSwitch(
    strategyId: string,
    currentContent: string,
    chapter: number,
    position: string
  ): Promise<SwitchSuggestion[]> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return [];
    }

    const suggestions: SwitchSuggestion[] = [];

    const contentAnalysis = await this.analyzeContent(currentContent);

    for (const analysis of contentAnalysis) {
      const suggestedPerspective = this.determineBestPerspective(analysis);

      if (suggestedPerspective.type !== strategy.currentPerspective.type) {
        suggestions.push({
          id: `suggestion_${uuidv4()}`,
          currentPerspective: strategy.currentPerspective,
          suggestedPerspective,
          trigger: analysis.trigger,
          location: { chapter, position },
          reason: analysis.reason,
          benefits: analysis.benefits,
          risks: analysis.risks,
          transitionExample: this.generateTransitionExample(
            strategy.currentPerspective,
            suggestedPerspective
          ),
          priority: analysis.priority,
          confidence: analysis.confidence,
        });
      }
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async analyzeContent(content: string): Promise<
    Array<{
      trigger: SwitchTrigger;
      reason: string;
      benefits: string[];
      risks: string[];
      priority: 'high' | 'medium' | 'low';
      confidence: number;
    }>
  > {
    const analyses: Array<{
      trigger: SwitchTrigger;
      reason: string;
      benefits: string[];
      risks: string[];
      priority: 'high' | 'medium' | 'low';
      confidence: number;
    }> = [];

    if (/[战斗|厮杀|混战|交锋]/.test(content)) {
      analyses.push({
        trigger: 'scene_change',
        reason: '检测到战斗场景，可能需要更广阔的视角',
        benefits: ['展示战场全貌', '协调多角色行动'],
        risks: ['可能降低情感代入'],
        priority: 'medium',
        confidence: 0.7,
      });
    }

    if (/[心想|内心|暗自|默默]/.test(content)) {
      analyses.push({
        trigger: 'character_focus',
        reason: '检测到内心活动描写，可能需要聚焦视角',
        benefits: ['深入角色内心', '增强情感真实感'],
        risks: ['信息获取受限'],
        priority: 'high',
        confidence: 0.8,
      });
    }

    if (/[同时|另一边|与此同时|此时此刻]/.test(content)) {
      analyses.push({
        trigger: 'parallel_action',
        reason: '检测到并行行动，可能需要切换视角',
        benefits: ['展示多条线索', '增加叙事张力'],
        risks: ['可能造成混乱', '需要清晰过渡'],
        priority: 'high',
        confidence: 0.85,
      });
    }

    if (/[惊讶|意外|震惊|不可思议]/.test(content)) {
      analyses.push({
        trigger: 'information_reveal',
        reason: '检测到信息揭示场景，视角选择影响悬念',
        benefits: ['控制信息释放', '保持悬念'],
        risks: ['可能过早揭示'],
        priority: 'medium',
        confidence: 0.6,
      });
    }

    return analyses;
  }

  private determineBestPerspective(analysis: {
    trigger: SwitchTrigger;
    reason: string;
  }): PerspectiveState {
    const triggerPerspectiveMap: Partial<Record<SwitchTrigger, PerspectiveType>> = {
      scene_change: 'third_omniscient',
      character_focus: 'third_limited',
      parallel_action: 'third_omniscient',
      emotional_shift: 'first_person',
      information_reveal: 'third_limited',
    };

    const type = triggerPerspectiveMap[analysis.trigger] || 'third_limited';
    return PERSPECTIVE_CHARACTERISTICS[type];
  }

  private generateTransitionExample(_from: PerspectiveState, to: PerspectiveState): string {
    if (to.type === 'first_person') {
      return '示例：将镜头拉近，以"我"的视角重新审视这一切...';
    }
    if (to.type === 'third_omniscient') {
      return '示例：镜头拉远，俯瞰整个场景...';
    }
    if (to.type === 'third_limited' && to.character) {
      return `示例：将焦点转移到${to.character}身上，透过他的眼睛看世界...`;
    }
    return '示例：自然过渡到新的视角...';
  }

  addPlannedSwitch(
    strategyId: string,
    targetPerspective: PerspectiveState,
    targetLocation: { chapter: number; scene?: string },
    trigger: SwitchTrigger,
    reason: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): PlannedSwitch | null {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return null;
    }

    const planned: PlannedSwitch = {
      id: `planned_${uuidv4()}`,
      targetPerspective,
      targetLocation,
      trigger,
      reason,
      priority,
    };

    strategy.plannedSwitches.push(planned);
    strategy.plannedSwitches.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    strategy.updatedAt = Date.now();
    this.saveToDisk();
    return planned;
  }

  removePlannedSwitch(strategyId: string, plannedId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return false;
    }

    const index = strategy.plannedSwitches.findIndex((p) => p.id === plannedId);
    if (index < 0) {
      return false;
    }

    strategy.plannedSwitches.splice(index, 1);
    strategy.updatedAt = Date.now();
    this.saveToDisk();
    return true;
  }

  addRule(rule: Omit<PerspectiveRule, 'id'>): PerspectiveRule {
    const newRule: PerspectiveRule = {
      id: `rule_${uuidv4()}`,
      ...rule,
    };

    this.rules.push(newRule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.saveToDisk();
    return newRule;
  }

  removeRule(ruleId: string): boolean {
    if (DEFAULT_PERSPECTIVE_RULES.some((r) => r.id === ruleId)) {
      return false;
    }

    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index < 0) {
      return false;
    }

    this.rules.splice(index, 1);
    this.saveToDisk();
    return true;
  }

  validateSwitch(
    strategyId: string,
    proposedSwitch: PerspectiveSwitch
  ): {
    valid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (
      proposedSwitch.from.type === 'first_person' &&
      proposedSwitch.to.type === 'first_person' &&
      proposedSwitch.from.character !== proposedSwitch.to.character
    ) {
      warnings.push('第一人称视角切换角色可能导致读者困惑');
      suggestions.push('考虑使用场景分隔或章节分隔来明确切换');
    }

    if (proposedSwitch.smoothness === 'jarring') {
      warnings.push('此视角切换可能显得突兀');
      suggestions.push('添加过渡段落或使用场景转换来平滑切换');
    }

    const recentSwitches = this.getRecentSwitches(strategyId, 5);
    if (recentSwitches.length >= 3) {
      warnings.push('近期视角切换频繁，可能影响阅读连贯性');
      suggestions.push('考虑减少切换频率，保持视角稳定');
    }

    return {
      valid: warnings.length === 0,
      warnings,
      suggestions,
    };
  }

  private getRecentSwitches(strategyId: string, count: number): PerspectiveSwitch[] {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return [];
    }

    return strategy.perspectiveHistory.slice(-count);
  }

  getStrategy(id: string): PerspectiveStrategy | undefined {
    return this.strategies.get(id);
  }

  getAllStrategies(): PerspectiveStrategy[] {
    return Array.from(this.strategies.values());
  }

  deleteStrategy(id: string): boolean {
    const result = this.strategies.delete(id);
    if (result) {
      this.saveToDisk();
    }
    return result;
  }

  getRules(): PerspectiveRule[] {
    return [...this.rules];
  }

  getStats(): {
    totalStrategies: number;
    totalSwitches: number;
    averageSwitchesPerStrategy: number;
    byTrigger: Record<SwitchTrigger, number>;
    bySmoothness: Record<SwitchSmoothness, number>;
  } {
    const strategies = this.getAllStrategies();

    let totalSwitches = 0;
    const byTrigger: Record<SwitchTrigger, number> = {
      scene_change: 0,
      time_jump: 0,
      character_focus: 0,
      plot_requirement: 0,
      emotional_shift: 0,
      information_reveal: 0,
      parallel_action: 0,
    };
    const bySmoothness: Record<SwitchSmoothness, number> = {
      seamless: 0,
      smooth: 0,
      noticeable: 0,
      jarring: 0,
    };

    for (const strategy of strategies) {
      totalSwitches += strategy.perspectiveHistory.length;

      for (const sw of strategy.perspectiveHistory) {
        byTrigger[sw.trigger]++;
        bySmoothness[sw.smoothness]++;
      }
    }

    return {
      totalStrategies: strategies.length,
      totalSwitches,
      averageSwitchesPerStrategy: strategies.length > 0 ? totalSwitches / strategies.length : 0,
      byTrigger,
      bySmoothness,
    };
  }
}

export function createPerspectiveSwitchService(projectPath: string): PerspectiveSwitchService {
  return new PerspectiveSwitchService(projectPath);
}
