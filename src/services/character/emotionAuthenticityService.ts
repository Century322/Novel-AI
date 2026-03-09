import {
  EmotionState,
  EmotionTransition,
  EmotionArc,
  EmotionIssue,
  EmotionAuthenticityAnalysis,
  EmotionRecommendation,
  CharacterEmotionProfile,
  EmotionCategory,
  EmotionIntensity,
  EmotionTransitionType,
  AuthenticityLevel,
  EMOTION_LABELS,
  EMOTION_OPPOSITES,
  EMOTION_COMPATIBILITY,
} from '@/types/character/emotionAuthenticity';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class EmotionAuthenticityService {
  private projectPath: string;
  private emotionStates: Map<string, EmotionState> = new Map();
  private emotionTransitions: Map<string, EmotionTransition> = new Map();
  private emotionArcs: Map<string, EmotionArc> = new Map();
  private characterProfiles: Map<string, CharacterEmotionProfile> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/情感真实性`;

      const statesContent = await workshopService.readFile(`${basePath}/情感状态.json`);
      if (statesContent) {
        const data: EmotionState[] = JSON.parse(statesContent);
        this.emotionStates = new Map(data.map((s) => [s.id, s]));
      }

      const transitionsContent = await workshopService.readFile(`${basePath}/情感转换.json`);
      if (transitionsContent) {
        const data: EmotionTransition[] = JSON.parse(transitionsContent);
        this.emotionTransitions = new Map(data.map((t) => [t.id, t]));
      }

      const arcsContent = await workshopService.readFile(`${basePath}/情感弧线.json`);
      if (arcsContent) {
        const data: EmotionArc[] = JSON.parse(arcsContent);
        this.emotionArcs = new Map(data.map((a) => [a.id, a]));
      }

      const profilesContent = await workshopService.readFile(`${basePath}/角色情感档案.json`);
      if (profilesContent) {
        const data: CharacterEmotionProfile[] = JSON.parse(profilesContent);
        this.characterProfiles = new Map(data.map((p) => [p.characterId, p]));
      }
    } catch (error) {
      logger.error('加载情感数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/情感真实性`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/情感状态.json`,
        JSON.stringify(Array.from(this.emotionStates.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/情感转换.json`,
        JSON.stringify(Array.from(this.emotionTransitions.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/情感弧线.json`,
        JSON.stringify(Array.from(this.emotionArcs.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/角色情感档案.json`,
        JSON.stringify(Array.from(this.characterProfiles.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存情感数据失败', { error });
    }
  }

  createCharacterProfile(
    characterId: string,
    characterName: string,
    baselineEmotion: EmotionCategory = 'neutral',
    emotionalRange: EmotionCategory[] = ['joy', 'sorrow', 'anger', 'fear'],
    expressiveness: CharacterEmotionProfile['expressiveness'] = 'medium'
  ): CharacterEmotionProfile {
    const profile: CharacterEmotionProfile = {
      characterId,
      characterName,
      baselineEmotion,
      emotionalRange,
      typicalIntensity: 5,
      expressiveness,
      triggers: [],
      suppressionPatterns: [],
      physicalManifestations: {
        joy: ['微笑', '眼睛发亮'],
        sorrow: ['垂下眼帘', '叹气'],
        anger: ['皱眉', '握拳'],
        fear: ['颤抖', '脸色苍白'],
        love: ['温柔的眼神', '靠近'],
        hate: ['冷眼', '后退'],
        surprise: ['睁大眼睛', '张嘴'],
        anticipation: ['期待的眼神', '前倾'],
        trust: ['放松的姿态', '微笑'],
        disgust: ['皱鼻', '后退'],
        neutral: ['平静的表情'],
        mixed: ['复杂的表情'],
        any: ['各种表情'],
      },
      emotionalGrowth: [],
    };

    this.characterProfiles.set(characterId, profile);
    this.saveToDisk();
    return profile;
  }

  recordEmotionState(
    characterId: string,
    characterName: string,
    primaryEmotion: EmotionCategory,
    intensity: EmotionIntensity,
    location: { chapter: number; paragraph?: number; excerpt: string },
    triggers: string[] = [],
    physicalManifestations: string[] = []
  ): EmotionState {
    const state: EmotionState = {
      id: `emotion_${uuidv4()}`,
      characterId,
      characterName,
      primaryEmotion,
      secondaryEmotions: [],
      intensity,
      displayIntensity: intensity,
      triggers,
      suppressed: false,
      physicalManifestations,
      behavioralCues: [],
      verbalExpressions: [],
      duration: 0,
      startTime: Date.now(),
      location,
    };

    this.emotionStates.set(state.id, state);
    this.saveToDisk();
    return state;
  }

  recordTransition(
    characterId: string,
    fromStateId: string,
    toStateId: string,
    transitionType: EmotionTransitionType,
    trigger: EmotionTransition['trigger'],
    location: { chapter: number; startParagraph?: number; endParagraph?: number }
  ): EmotionTransition | null {
    const fromState = this.emotionStates.get(fromStateId);
    const toState = this.emotionStates.get(toStateId);

    if (!fromState || !toState) {
      return null;
    }

    const issues = this.validateTransition(fromState, toState, transitionType, trigger);

    const plausibility = this.calculatePlausibility(fromState, toState, transitionType, trigger);
    const authenticity = this.determineAuthenticity(plausibility, issues);

    const transition: EmotionTransition = {
      id: `transition_${uuidv4()}`,
      characterId,
      fromState,
      toState,
      transitionType,
      trigger,
      duration: toState.startTime - fromState.startTime,
      plausibility,
      authenticity,
      issues,
      location,
    };

    this.emotionTransitions.set(transition.id, transition);
    this.saveToDisk();
    return transition;
  }

  private validateTransition(
    from: EmotionState,
    to: EmotionState,
    transitionType: EmotionTransitionType,
    trigger: EmotionTransition['trigger']
  ): EmotionIssue[] {
    const issues: EmotionIssue[] = [];

    const opposite = EMOTION_OPPOSITES[from.primaryEmotion];
    if (opposite === to.primaryEmotion && transitionType !== 'sudden') {
      if (!trigger.description || trigger.description.length < 10) {
        issues.push({
          id: `issue_${uuidv4()}`,
          type: 'inconsistent',
          severity: 'major',
          description: `从${EMOTION_LABELS[from.primaryEmotion]}到${EMOTION_LABELS[to.primaryEmotion]}的转换需要更强的触发因素`,
          location: `第${to.location.chapter}章`,
          suggestion: '添加更充分的情感转换理由',
        });
      }
    }

    if (transitionType === 'sudden' && Math.abs(to.intensity - from.intensity) > 3) {
      issues.push({
        id: `issue_${uuidv4()}`,
        type: 'too_sudden',
        severity: 'minor',
        description: '情感强度变化过于剧烈',
        location: `第${to.location.chapter}章`,
        suggestion: '考虑添加过渡或解释',
      });
    }

    if (transitionType === 'gradual' && from.suppressed && from.duration > 10000) {
      issues.push({
        id: `issue_${uuidv4()}`,
        type: 'suppressed_too_long',
        severity: 'minor',
        description: '压抑的情感持续时间过长',
        location: `第${to.location.chapter}章`,
        suggestion: '考虑让情感更早释放或提供释放的契机',
      });
    }

    if (to.intensity > 7 && trigger.type === 'internal_thought') {
      issues.push({
        id: `issue_${uuidv4()}`,
        type: 'wrong_intensity',
        severity: 'minor',
        description: '仅靠内心想法产生高强度情感可能不够充分',
        location: `第${to.location.chapter}章`,
        suggestion: '考虑添加外部触发因素',
      });
    }

    return issues;
  }

  private calculatePlausibility(
    from: EmotionState,
    to: EmotionState,
    transitionType: EmotionTransitionType,
    trigger: EmotionTransition['trigger']
  ): number {
    let plausibility = 0.7;

    const compatibleEmotions = EMOTION_COMPATIBILITY[from.primaryEmotion];
    if (compatibleEmotions?.includes(to.primaryEmotion) || compatibleEmotions?.includes('any')) {
      plausibility += 0.15;
    }

    const opposite = EMOTION_OPPOSITES[from.primaryEmotion];
    if (opposite === to.primaryEmotion) {
      plausibility -= 0.2;
      if (trigger.type === 'external_event' && trigger.description.length > 20) {
        plausibility += 0.15;
      }
    }

    if (transitionType === 'gradual') {
      plausibility += 0.1;
    } else if (transitionType === 'sudden' && trigger.type !== 'external_event') {
      plausibility -= 0.1;
    }

    const intensityDiff = Math.abs(to.intensity - from.intensity);
    if (intensityDiff > 5) {
      plausibility -= 0.1;
    }

    return Math.max(0, Math.min(1, plausibility));
  }

  private determineAuthenticity(plausibility: number, issues: EmotionIssue[]): AuthenticityLevel {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const majorCount = issues.filter((i) => i.severity === 'major').length;

    if (criticalCount > 0 || plausibility < 0.4) {
      return 'artificial';
    }
    if (majorCount > 1 || plausibility < 0.6) {
      return 'low';
    }
    if (majorCount > 0 || plausibility < 0.8) {
      return 'medium';
    }
    return 'high';
  }

  async analyzeChapter(chapter: number): Promise<EmotionArc[]> {
    const chapterStates = Array.from(this.emotionStates.values()).filter(
      (s) => s.location.chapter === chapter
    );

    const arcsByCharacter = new Map<string, EmotionState[]>();
    for (const state of chapterStates) {
      if (!arcsByCharacter.has(state.characterId)) {
        arcsByCharacter.set(state.characterId, []);
      }
      arcsByCharacter.get(state.characterId)!.push(state);
    }

    const arcs: EmotionArc[] = [];

    for (const [characterId, states] of arcsByCharacter) {
      const sortedStates = states.sort((a, b) => a.startTime - b.startTime);

      const transitions = Array.from(this.emotionTransitions.values()).filter(
        (t) => t.characterId === characterId && t.location.chapter === chapter
      );

      const dominantEmotion = this.findDominantEmotion(sortedStates);
      const emotionalRange = [...new Set(states.map((s) => s.primaryEmotion))];

      const arcType = this.determineArcType(sortedStates);

      const issues = transitions.flatMap((t) => t.issues);

      const authenticityScore = this.calculateArcAuthenticity(transitions);
      const consistencyScore = this.calculateArcConsistency(sortedStates, transitions);

      const arc: EmotionArc = {
        id: `arc_${uuidv4()}`,
        characterId,
        characterName: states[0].characterName,
        chapter,
        states: sortedStates,
        transitions,
        dominantEmotion,
        emotionalRange,
        arcType,
        authenticityScore,
        consistencyScore,
        issues,
      };

      arcs.push(arc);
      this.emotionArcs.set(arc.id, arc);
    }

    await this.saveToDisk();
    return arcs;
  }

  private findDominantEmotion(states: EmotionState[]): EmotionCategory {
    const counts = new Map<EmotionCategory, number>();

    for (const state of states) {
      counts.set(state.primaryEmotion, (counts.get(state.primaryEmotion) || 0) + state.intensity);
    }

    let maxEmotion: EmotionCategory = 'neutral';
    let maxCount = 0;

    for (const [emotion, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxEmotion = emotion;
      }
    }

    return maxEmotion;
  }

  private determineArcType(states: EmotionState[]): EmotionArc['arcType'] {
    if (states.length < 2) {
      return 'flat';
    }

    const intensities = states.map((s) => s.intensity);
    const firstHalf = intensities.slice(0, Math.floor(intensities.length / 2));
    const secondHalf = intensities.slice(Math.floor(intensities.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const variance =
      intensities.reduce((sum, i) => {
        const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length;
        return sum + Math.pow(i - avg, 2);
      }, 0) / intensities.length;

    if (variance < 2) {
      return 'flat';
    }
    if (firstAvg < secondAvg - 1) {
      return 'rising';
    }
    if (firstAvg > secondAvg + 1) {
      return 'falling';
    }
    if (variance > 5) {
      return 'wave';
    }
    return 'complex';
  }

  private calculateArcAuthenticity(transitions: EmotionTransition[]): number {
    if (transitions.length === 0) {
      return 1;
    }

    const authenticityValues: Record<AuthenticityLevel, number> = {
      high: 1,
      medium: 0.7,
      low: 0.4,
      artificial: 0.1,
    };

    const sum = transitions.reduce((acc, t) => acc + authenticityValues[t.authenticity], 0);
    return sum / transitions.length;
  }

  private calculateArcConsistency(
    states: EmotionState[],
    _transitions: EmotionTransition[]
  ): number {
    if (states.length < 2) {
      return 1;
    }

    let consistentCount = 0;

    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1];
      const curr = states[i];

      const compatible = EMOTION_COMPATIBILITY[prev.primaryEmotion];
      if (compatible?.includes(curr.primaryEmotion) || compatible?.includes('any')) {
        consistentCount++;
      } else if (Math.abs(curr.intensity - prev.intensity) <= 2) {
        consistentCount += 0.5;
      }
    }

    return consistentCount / (states.length - 1);
  }

  async analyzeCharacter(characterId: string): Promise<EmotionAuthenticityAnalysis> {
    const charStates = Array.from(this.emotionStates.values()).filter(
      (s) => s.characterId === characterId
    );

    const charTransitions = Array.from(this.emotionTransitions.values()).filter(
      (t) => t.characterId === characterId
    );

    const charArcs = Array.from(this.emotionArcs.values()).filter(
      (a) => a.characterId === characterId
    );

    const overallAuthenticity =
      charArcs.length > 0
        ? charArcs.reduce((sum, a) => sum + a.authenticityScore, 0) / charArcs.length
        : 1;

    const overallConsistency =
      charArcs.length > 0
        ? charArcs.reduce((sum, a) => sum + a.consistencyScore, 0) / charArcs.length
        : 1;

    const allIssues = charTransitions.flatMap((t) => t.issues);
    const commonIssues = this.aggregateIssues(allIssues);

    const strengths = this.identifyStrengths(charStates, charTransitions);
    const improvements = this.identifyImprovements(allIssues);

    const recommendations = this.generateRecommendations(charStates, charTransitions);

    return {
      characterId,
      characterName: charStates[0]?.characterName || '未知角色',
      overallAuthenticity,
      overallConsistency,
      arcs: charArcs,
      commonIssues,
      strengths,
      improvements,
      recommendations,
    };
  }

  private aggregateIssues(issues: EmotionIssue[]): Array<{
    type: EmotionIssue['type'];
    count: number;
    examples: string[];
  }> {
    const grouped = new Map<EmotionIssue['type'], string[]>();

    for (const issue of issues) {
      if (!grouped.has(issue.type)) {
        grouped.set(issue.type, []);
      }
      grouped.get(issue.type)!.push(issue.description);
    }

    return Array.from(grouped.entries()).map(([type, examples]) => ({
      type,
      count: examples.length,
      examples: examples.slice(0, 3),
    }));
  }

  private identifyStrengths(states: EmotionState[], transitions: EmotionTransition[]): string[] {
    const strengths: string[] = [];

    const highAuthenticity = transitions.filter((t) => t.authenticity === 'high').length;
    if (highAuthenticity > transitions.length * 0.7) {
      strengths.push('情感转换自然流畅');
    }

    const diverseEmotions = new Set(states.map((s) => s.primaryEmotion)).size;
    if (diverseEmotions >= 4) {
      strengths.push('情感表达丰富多样');
    }

    const withPhysical = states.filter((s) => s.physicalManifestations.length > 0).length;
    if (withPhysical > states.length * 0.5) {
      strengths.push('善于通过身体语言表现情感');
    }

    return strengths;
  }

  private identifyImprovements(issues: EmotionIssue[]): string[] {
    const improvements: string[] = [];

    const issueTypes = new Set(issues.map((i) => i.type));

    if (issueTypes.has('too_sudden')) {
      improvements.push('需要增加情感转换的过渡');
    }
    if (issueTypes.has('unjustified')) {
      improvements.push('需要为情感变化提供更充分的理由');
    }
    if (issueTypes.has('wrong_intensity')) {
      improvements.push('需要调整情感强度的表达');
    }
    if (issueTypes.has('suppressed_too_long')) {
      improvements.push('需要适时释放压抑的情感');
    }

    return improvements;
  }

  private generateRecommendations(
    states: EmotionState[],
    transitions: EmotionTransition[]
  ): EmotionRecommendation[] {
    const recommendations: EmotionRecommendation[] = [];

    for (const transition of transitions.filter(
      (t) => t.authenticity === 'low' || t.authenticity === 'artificial'
    )) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'add_transition',
        priority: transition.authenticity === 'artificial' ? 'high' : 'medium',
        location: {
          chapter: transition.location.chapter,
          paragraph: transition.location.startParagraph,
        },
        currentDescription: `${EMOTION_LABELS[transition.fromState.primaryEmotion]} → ${EMOTION_LABELS[transition.toState.primaryEmotion]}`,
        suggestedImprovement: '添加情感转换的内心活动或外部触发',
        reason: transition.issues[0]?.description || '情感转换不够自然',
      });
    }

    for (const state of states.filter(
      (s) => s.intensity >= 7 && s.physicalManifestations.length === 0
    )) {
      recommendations.push({
        id: `rec_${uuidv4()}`,
        type: 'show_physically',
        priority: 'medium',
        location: {
          chapter: state.location.chapter,
          paragraph: state.location.paragraph,
        },
        currentDescription: `高强度${EMOTION_LABELS[state.primaryEmotion]}但缺少身体表现`,
        suggestedImprovement: '添加身体反应描写',
        reason: '高强度情感应该有明显的身体表现',
        example: `${EMOTION_LABELS[state.primaryEmotion]}时可以描写：心跳加速、手心出汗、呼吸急促等`,
      });
    }

    return recommendations;
  }

  getEmotionState(id: string): EmotionState | undefined {
    return this.emotionStates.get(id);
  }

  getEmotionArc(id: string): EmotionArc | undefined {
    return this.emotionArcs.get(id);
  }

  getCharacterProfile(characterId: string): CharacterEmotionProfile | undefined {
    return this.characterProfiles.get(characterId);
  }

  getStats(): {
    totalStates: number;
    totalTransitions: number;
    totalArcs: number;
    averageAuthenticity: number;
    byEmotion: Record<EmotionCategory, number>;
  } {
    const states = Array.from(this.emotionStates.values());
    const transitions = Array.from(this.emotionTransitions.values());
    const arcs = Array.from(this.emotionArcs.values());

    const byEmotion: Record<EmotionCategory, number> = {
      joy: 0,
      sorrow: 0,
      anger: 0,
      fear: 0,
      love: 0,
      hate: 0,
      surprise: 0,
      anticipation: 0,
      trust: 0,
      disgust: 0,
      neutral: 0,
      mixed: 0,
      any: 0,
    };

    for (const state of states) {
      byEmotion[state.primaryEmotion]++;
    }

    const averageAuthenticity =
      arcs.length > 0 ? arcs.reduce((sum, a) => sum + a.authenticityScore, 0) / arcs.length : 1;

    return {
      totalStates: states.length,
      totalTransitions: transitions.length,
      totalArcs: arcs.length,
      averageAuthenticity,
      byEmotion,
    };
  }
}

export function createEmotionAuthenticityService(projectPath: string): EmotionAuthenticityService {
  return new EmotionAuthenticityService(projectPath);
}
