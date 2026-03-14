import { vectorStoreService } from '../retrieval/vectorStoreService';
import { storyStateManager } from './storyStateManager';
import type { StoryState } from '@/types/narrative/storyState';
import type { SearchResult } from '@/types/retrieval/vectorStore';

export interface NarrativeConsistencyIssue {
  type: 'contradiction' | 'missing_info' | 'timeline_conflict' | 'character_inconsistency' | 'foreshadow_unresolved';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  location?: string;
  suggestion?: string;
  relatedContent?: SearchResult[];
}

export class ConsistencyChecker {
  async checkContent(newContent: string): Promise<NarrativeConsistencyIssue[]> {
    const issues: NarrativeConsistencyIssue[] = [];
    const state = storyStateManager.getState();

    const relevantContent = await vectorStoreService.search(newContent, {
      topK: 10,
      minScore: 0.6,
    });

    const contradictionIssues = await this.detectContradictions(newContent, relevantContent);
    issues.push(...contradictionIssues);

    const characterIssues = await this.checkCharacterConsistency(newContent, state);
    issues.push(...characterIssues);

    const timelineIssues = this.checkTimelineConsistency(newContent, state);
    issues.push(...timelineIssues);

    return issues;
  }

  async checkFullStory(): Promise<NarrativeConsistencyIssue[]> {
    const issues: NarrativeConsistencyIssue[] = [];
    const state = storyStateManager.getState();

    const foreshadowIssues = this.checkForeshadowing(state);
    issues.push(...foreshadowIssues);

    const characterIssues = this.checkAllCharacterConsistency(state);
    issues.push(...characterIssues);

    const timelineIssues = this.checkTimelineGaps(state);
    issues.push(...timelineIssues);

    return issues;
  }

  private async detectContradictions(
    newContent: string,
    relevantContent: SearchResult[]
  ): Promise<NarrativeConsistencyIssue[]> {
    const issues: NarrativeConsistencyIssue[] = [];

    const contradictionPatterns: Array<{
      pattern: RegExp;
      check: (content: string, match: RegExpMatchArray) => { type: string; data: Record<string, unknown> };
    }> = [
      {
        pattern: /(?:死了|死亡|牺牲|去世|殒命)/,
        check: (content: string, match: RegExpMatchArray) => {
          const characterName = this.extractCharacterName(content, match.index || 0);
          return { type: 'death', data: { characterName } };
        },
      },
      {
        pattern: /(?:获得|得到|捡到|收到).{1,10}(?:剑|刀|枪|武器|宝物|神器)/,
        check: (_content: string, match: RegExpMatchArray) => {
          const itemName = match[0];
          return { type: 'item_acquired', data: { itemName } };
        },
      },
      {
        pattern: /(?:成为|变成|晋升).{1,10}(?:王|帝|皇|神|仙|圣)/,
        check: (_content: string, match: RegExpMatchArray) => {
          const title = match[0];
          return { type: 'status_change', data: { title } };
        },
      },
    ];

    for (const { pattern, check } of contradictionPatterns) {
      const newMatches = newContent.match(pattern);
      if (!newMatches) continue;

      for (const match of newMatches) {
        const matchResult = check(newContent, [match]);

        for (const result of relevantContent) {
          const oldContent = result.document.content;
          const oldMatches = oldContent.match(pattern);

          if (oldMatches) {
            const oldMatchResult = check(oldContent, oldMatches);

            if (matchResult.type === oldMatchResult.type && matchResult.type === 'death') {
              const newCharName = matchResult.data.characterName;
              const oldCharName = oldMatchResult.data.characterName;

              if (newCharName && oldCharName && newCharName === oldCharName) {
                const alreadyDead = /(?:死了|死亡|牺牲|去世|殒命)/.test(oldContent);
                const appearsAgain = /(?:出现|登场|说话|行动)/.test(newContent);

                if (alreadyDead && appearsAgain) {
                  issues.push({
                    type: 'contradiction',
                    severity: 'critical',
                    description: `角色 "${newCharName}" 已死亡但再次出现`,
                    location: result.document.metadata.chapter,
                    suggestion: '请检查角色是否真的死亡，或者这是回忆/幻觉场景',
                    relatedContent: [result],
                  });
                }
              }
            }
          }
        }
      }
    }

    return issues;
  }

  private async checkCharacterConsistency(
    content: string,
    state: StoryState
  ): Promise<NarrativeConsistencyIssue[]> {
    const issues: NarrativeConsistencyIssue[] = [];

    for (const [_id, character] of Object.entries(state.characters)) {
      if (!content.includes(character.name)) continue;

      if (character.currentStatus === '死亡' || character.currentStatus === '失踪') {
        const actionPatterns = /(?:说|走|跑|笑|哭|打|杀|想|看|听)/;
        if (actionPatterns.test(content)) {
          const contextMatch = content.substring(
            Math.max(0, content.indexOf(character.name) - 50),
            content.indexOf(character.name) + 100
          );

          if (!/(?:回忆|梦境|幻觉|想起|曾经)/.test(contextMatch)) {
            issues.push({
              type: 'character_inconsistency',
              severity: 'critical',
              description: `角色 "${character.name}" 状态为 "${character.currentStatus}"，但似乎在进行正常活动`,
              suggestion: '如果是回忆或梦境场景，请明确标注',
            });
          }
        }
      }

      if (character.currentLocation && !/(?:回忆|梦境|幻觉)/.test(content)) {
        const locationMentioned = this.extractLocation(content);
        if (locationMentioned && locationMentioned !== character.currentLocation) {
          const travelKeywords = /(?:前往|来到|到达|离开|赶往)/;
          if (!travelKeywords.test(content)) {
            issues.push({
              type: 'character_inconsistency',
              severity: 'minor',
              description: `角色 "${character.name}" 当前位置为 "${character.currentLocation}"，但场景似乎在 "${locationMentioned}"`,
              suggestion: '请确认角色是否已移动，或添加移动描述',
            });
          }
        }
      }
    }

    return issues;
  }

  private checkTimelineConsistency(content: string, state: StoryState): NarrativeConsistencyIssue[] {
    const issues: NarrativeConsistencyIssue[] = [];

    const timePatterns = [
      /(?:第[一二三四五六七八九十百千万]+天|过了?[一二三四五六七八九十百千万]+天|数天后|几日后)/,
      /(?:清晨|上午|中午|下午|傍晚|夜晚|深夜|凌晨)/,
      /(?:春天|夏天|秋天|冬天|春季|夏季|秋季|冬季)/,
    ];

    for (const pattern of timePatterns) {
      const match = content.match(pattern);
      if (match) {
        const lastEvent = state.timeline.events[state.timeline.events.length - 1];
        if (lastEvent && lastEvent.description) {
          for (const p of timePatterns) {
            const lastMatch = lastEvent.description.match(p);
            if (lastMatch && lastMatch[0] !== match[0]) {
              const timeOrder = this.getTimeOrder(lastMatch[0], match[0]);
              if (timeOrder === 'invalid') {
                issues.push({
                  type: 'timeline_conflict',
                  severity: 'major',
                  description: `时间线可能存在冲突：上次是 "${lastMatch[0]}"，现在是 "${match[0]}"`,
                  suggestion: '请检查时间顺序是否正确',
                });
              }
            }
          }
        }
      }
    }

    return issues;
  }

  private checkForeshadowing(state: StoryState): NarrativeConsistencyIssue[] {
    const issues: NarrativeConsistencyIssue[] = [];

    const unresolvedForeshadows = state.foreshadowing.planted.filter(
      (f) => !state.foreshadowing.resolved.includes(f.id)
    );

    for (const foreshadow of unresolvedForeshadows) {
      const daysSincePlanted = (Date.now() - foreshadow.plantedAt) / (1000 * 60 * 60 * 24);

      if (foreshadow.importance === 'critical' && daysSincePlanted > 7) {
        issues.push({
          type: 'foreshadow_unresolved',
          severity: 'critical',
          description: `重要伏笔 "${foreshadow.description}" 已埋设超过7天，尚未回收`,
          suggestion: '请尽快安排伏笔回收，避免读者遗忘',
        });
      } else if (foreshadow.importance === 'major' && daysSincePlanted > 14) {
        issues.push({
          type: 'foreshadow_unresolved',
          severity: 'major',
          description: `主要伏笔 "${foreshadow.description}" 已埋设超过14天，尚未回收`,
          suggestion: '建议在近期章节中回收此伏笔',
        });
      }
    }

    return issues;
  }

  private checkAllCharacterConsistency(state: StoryState): NarrativeConsistencyIssue[] {
    const issues: NarrativeConsistencyIssue[] = [];

    for (const [_id, character] of Object.entries(state.characters)) {
      if (character.arcProgress < 0.3 && character.lastAppearance) {
        const daysSinceAppearance = (Date.now() - character.lastAppearance) / (1000 * 60 * 60 * 24);
        if (daysSinceAppearance > 5 && character.relationships.length > 0) {
          issues.push({
            type: 'missing_info',
            severity: 'minor',
            description: `角色 "${character.name}" 已超过5天未出现，但其关系网络中还有其他角色`,
            suggestion: '考虑让此角色重新出场或解释其去向',
          });
        }
      }
    }

    return issues;
  }

  private checkTimelineGaps(state: StoryState): NarrativeConsistencyIssue[] {
    const issues: NarrativeConsistencyIssue[] = [];

    const events = state.timeline.events;
    if (events.length < 2) return issues;

    for (let i = 1; i < events.length; i++) {
      const prevEvent = events[i - 1];
      const currEvent = events[i];

      if (prevEvent.participants && currEvent.participants) {
        const commonParticipants = prevEvent.participants.filter((p) =>
          currEvent.participants?.includes(p)
        );

        if (commonParticipants.length > 0) {
          const timeDiff = currEvent.timestamp - prevEvent.timestamp;
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          if (hoursDiff > 24 && !prevEvent.location && currEvent.location) {
            issues.push({
              type: 'timeline_conflict',
              severity: 'minor',
              description: `角色 ${commonParticipants.join('、')} 在两个事件之间有超过24小时的空白`,
              suggestion: '考虑补充这段时间的活动描述',
            });
          }
        }
      }
    }

    return issues;
  }

  private extractCharacterName(content: string, position: number): string | null {
    const beforeContent = content.substring(Math.max(0, position - 20), position);
    const afterContent = content.substring(position, position + 20);

    const nameMatch = beforeContent.match(/([^\s，。！？、]{2,4})(?:的|之)?$/);
    if (nameMatch) {
      return nameMatch[1];
    }

    const afterMatch = afterContent.match(/^([^\s，。！？、]{2,4})/);
    if (afterMatch) {
      return afterMatch[1];
    }

    return null;
  }

  private extractLocation(content: string): string | null {
    const locationPatterns = [
      /在([^\s，。！？、]{2,8})(?:里|中|内|上|下)/,
      /来到([^\s，。！？、]{2,8})/,
      /位于([^\s，。！？、]{2,8})/,
      /身处([^\s，。！？、]{2,8})/,
    ];

    for (const pattern of locationPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private getTimeOrder(time1: string, time2: string): 'valid' | 'invalid' | 'unknown' {
    const dayOrder = ['清晨', '上午', '中午', '下午', '傍晚', '夜晚', '深夜', '凌晨'];
    const seasonOrder = ['春天', '春季', '夏天', '夏季', '秋天', '秋季', '冬天', '冬季'];

    const idx1 = dayOrder.indexOf(time1);
    const idx2 = dayOrder.indexOf(time2);

    if (idx1 !== -1 && idx2 !== -1) {
      if (idx2 < idx1) return 'invalid';
      return 'valid';
    }

    const sidx1 = seasonOrder.indexOf(time1);
    const sidx2 = seasonOrder.indexOf(time2);

    if (sidx1 !== -1 && sidx2 !== -1) {
      if (sidx2 < sidx1) return 'invalid';
      return 'valid';
    }

    return 'unknown';
  }
}

export const consistencyChecker = new ConsistencyChecker();
