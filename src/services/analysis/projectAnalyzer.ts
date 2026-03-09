import {
  ProjectAnalysis,
  CharacterInfo,
  TimelineEvent,
  ForeshadowingItem,
  WorldbuildingInfo,
} from '@/types/tools/skill';
import { skillService } from '../tools/skillService';
import { logger } from '../core/loggerService';

interface AnalysisResult {
  characters: CharacterInfo[];
  timeline: TimelineEvent[];
  foreshadowing: ForeshadowingItem[];
  worldbuilding: WorldbuildingInfo;
}

const ANALYSIS_PROMPT = `你是一个专业的小说分析助手。请分析以下小说内容，提取关键信息。

请以JSON格式输出分析结果，格式如下：

{
  "characters": [
    {
      "name": "角色名",
      "aliases": ["别名1", "别名2"],
      "role": "protagonist|antagonist|supporting|minor",
      "description": "角色描述",
      "traits": ["性格特点1", "性格特点2"],
      "relationships": [{"target": "其他角色", "relation": "关系"}],
      "firstAppear": "首次出现的章节/位置",
      "lastMention": "最后提及的章节/位置"
    }
  ],
  "timeline": [
    {
      "chapter": "章节",
      "time": "时间描述",
      "event": "事件描述",
      "characters": ["涉及角色"],
      "importance": "major|minor"
    }
  ],
  "foreshadowing": [
    {
      "content": "伏笔内容",
      "plantedAt": "埋设位置",
      "resolvedAt": "回收位置（如果已回收）",
      "status": "planted|hinted|resolved|abandoned",
      "relatedCharacters": ["相关角色"]
    }
  ],
  "worldbuilding": {
    "setting": "世界观设定概述",
    "rules": ["规则1", "规则2"],
    "locations": [{"name": "地点名", "description": "描述"}],
    "factions": [{"name": "势力名", "description": "描述", "members": ["成员"]}],
    "magicSystem": "魔法系统描述（如有）",
    "technology": "科技水平描述（如有）"
  }
}

请只输出JSON，不要有其他内容。`;

export class ProjectAnalyzer {
  private callAI: (prompt: string, history: unknown[]) => Promise<string>;

  constructor(
    _projectPath: string,
    callAI: (prompt: string, history: unknown[]) => Promise<string>
  ) {
    this.callAI = callAI;
  }

  async analyzeProject(filePaths: string[]): Promise<ProjectAnalysis> {
    const existingAnalysis = await skillService.loadProjectAnalysis();

    const allContent: string[] = [];
    for (const filePath of filePaths) {
      const content = await skillService.readFile(filePath);
      if (content) {
        allContent.push(`【文件: ${filePath.split('/').pop()}】\n${content}`);
      }
    }

    if (allContent.length === 0) {
      return existingAnalysis || { ...this.getEmptyAnalysis(), lastAnalyzed: 0 };
    }

    const combinedContent = allContent.join('\n\n---\n\n');
    const chunks = this.chunkContent(combinedContent, 6000);

    let mergedResult: AnalysisResult = {
      characters: existingAnalysis?.characters || [],
      timeline: existingAnalysis?.timeline || [],
      foreshadowing: existingAnalysis?.foreshadowing || [],
      worldbuilding: existingAnalysis?.worldbuilding || this.getEmptyWorldbuilding(),
    };

    for (const chunk of chunks) {
      try {
        const result = await this.analyzeChunk(chunk, mergedResult);
        mergedResult = this.mergeAnalysis(mergedResult, result);
      } catch (error) {
        logger.error('分析内容块失败', { error });
      }
    }

    mergedResult.characters = this.deduplicateCharacters(mergedResult.characters);
    mergedResult.timeline = this.sortTimeline(mergedResult.timeline);
    mergedResult.foreshadowing = this.updateForeshadowingStatus(mergedResult.foreshadowing);

    const finalAnalysis: ProjectAnalysis = {
      ...mergedResult,
      lastAnalyzed: Date.now(),
    };

    await skillService.saveProjectAnalysis(finalAnalysis);

    return finalAnalysis;
  }

  private async analyzeChunk(content: string, existing: AnalysisResult): Promise<AnalysisResult> {
    const existingContext = this.buildExistingContext(existing);

    const prompt = `${ANALYSIS_PROMPT}

【已有分析结果（请在此基础上更新和补充）】
${existingContext}

【待分析内容】
${content}

请分析以上内容，输出完整的JSON分析结果。注意：
1. 保留已有的人物信息，只更新或补充
2. 时间线按时间顺序排列
3. 伏笔要标注状态
4. 世界观设定要完整`;

    try {
      const response = await this.callAI(prompt, []);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('解析分析结果失败', { error });
      return this.getEmptyAnalysis();
    }
  }

  private buildExistingContext(existing: AnalysisResult): string {
    const parts: string[] = [];

    if (existing.characters.length > 0) {
      parts.push(`已识别人物: ${existing.characters.map((c) => c.name).join(', ')}`);
    }

    if (existing.timeline.length > 0) {
      parts.push(`时间线事件数: ${existing.timeline.length}`);
    }

    if (existing.foreshadowing.length > 0) {
      parts.push(`伏笔数: ${existing.foreshadowing.length}`);
    }

    if (existing.worldbuilding.setting) {
      parts.push(`世界观: ${existing.worldbuilding.setting}`);
    }

    return parts.join('\n');
  }

  private mergeAnalysis(existing: AnalysisResult, newResult: AnalysisResult): AnalysisResult {
    return {
      characters: this.mergeCharacters(existing.characters, newResult.characters),
      timeline: [...existing.timeline, ...newResult.timeline],
      foreshadowing: this.mergeForeshadowing(existing.foreshadowing, newResult.foreshadowing),
      worldbuilding: this.mergeWorldbuilding(existing.worldbuilding, newResult.worldbuilding),
    };
  }

  private mergeCharacters(existing: CharacterInfo[], newChars: CharacterInfo[]): CharacterInfo[] {
    const merged = new Map<string, CharacterInfo>();

    for (const char of existing) {
      merged.set(char.name, char);
    }

    for (const char of newChars) {
      const existingChar = merged.get(char.name);
      if (existingChar) {
        merged.set(char.name, {
          ...existingChar,
          aliases: [...new Set([...existingChar.aliases, ...char.aliases])],
          traits: [...new Set([...existingChar.traits, ...char.traits])],
          relationships: [...existingChar.relationships, ...char.relationships],
          lastMention: char.lastMention || existingChar.lastMention,
        });
      } else {
        merged.set(char.name, char);
      }
    }

    return Array.from(merged.values());
  }

  private mergeForeshadowing(
    existing: ForeshadowingItem[],
    newItems: ForeshadowingItem[]
  ): ForeshadowingItem[] {
    const merged = new Map<string, ForeshadowingItem>();

    for (const item of existing) {
      merged.set(item.content.substring(0, 50), item);
    }

    for (const item of newItems) {
      const key = item.content.substring(0, 50);
      const existingItem = merged.get(key);
      if (existingItem) {
        merged.set(key, {
          ...existingItem,
          ...item,
          resolvedAt: item.resolvedAt || existingItem.resolvedAt,
          status: item.status !== 'planted' ? item.status : existingItem.status,
        });
      } else {
        merged.set(key, item);
      }
    }

    return Array.from(merged.values());
  }

  private mergeWorldbuilding(
    existing: WorldbuildingInfo,
    newInfo: WorldbuildingInfo
  ): WorldbuildingInfo {
    return {
      setting: newInfo.setting || existing.setting,
      rules: [...new Set([...existing.rules, ...newInfo.rules])],
      locations: this.mergeLocations(existing.locations, newInfo.locations),
      factions: this.mergeFactions(existing.factions, newInfo.factions),
      magicSystem: newInfo.magicSystem || existing.magicSystem,
      technology: newInfo.technology || existing.technology,
    };
  }

  private mergeLocations(
    existing: WorldbuildingInfo['locations'],
    newLocs: WorldbuildingInfo['locations']
  ): WorldbuildingInfo['locations'] {
    const merged = new Map(existing.map((l) => [l.name, l]));
    for (const loc of newLocs) {
      if (!merged.has(loc.name)) {
        merged.set(loc.name, loc);
      }
    }
    return Array.from(merged.values());
  }

  private mergeFactions(
    existing: WorldbuildingInfo['factions'],
    newFactions: WorldbuildingInfo['factions']
  ): WorldbuildingInfo['factions'] {
    const merged = new Map(existing.map((f) => [f.name, f]));
    for (const faction of newFactions) {
      const existingFaction = merged.get(faction.name);
      if (existingFaction) {
        merged.set(faction.name, {
          ...existingFaction,
          members: [...new Set([...existingFaction.members, ...faction.members])],
        });
      } else {
        merged.set(faction.name, faction);
      }
    }
    return Array.from(merged.values());
  }

  private deduplicateCharacters(characters: CharacterInfo[]): CharacterInfo[] {
    const seen = new Set<string>();
    return characters.filter((char) => {
      if (seen.has(char.name)) {
        return false;
      }
      seen.add(char.name);
      return true;
    });
  }

  private sortTimeline(timeline: TimelineEvent[]): TimelineEvent[] {
    return [...timeline].sort((a, b) => {
      if (a.chapter < b.chapter) {
        return -1;
      }
      if (a.chapter > b.chapter) {
        return 1;
      }
      return 0;
    });
  }

  private updateForeshadowingStatus(foreshadowing: ForeshadowingItem[]): ForeshadowingItem[] {
    return foreshadowing.map((item) => ({
      ...item,
      status: item.resolvedAt ? 'resolved' : item.status,
    }));
  }

  private chunkContent(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let current = '';

    const lines = content.split('\n');
    for (const line of lines) {
      if (current.length + line.length > maxLength) {
        if (current) {
          chunks.push(current);
        }
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }

    if (current) {
      chunks.push(current);
    }
    return chunks;
  }

  private getEmptyAnalysis(): AnalysisResult {
    return {
      characters: [],
      timeline: [],
      foreshadowing: [],
      worldbuilding: this.getEmptyWorldbuilding(),
    };
  }

  private getEmptyWorldbuilding(): WorldbuildingInfo {
    return {
      setting: '',
      rules: [],
      locations: [],
      factions: [],
    };
  }

  async quickAnalyze(content: string): Promise<Partial<AnalysisResult>> {
    const prompt = `${ANALYSIS_PROMPT}

【待分析内容】
${content.substring(0, 4000)}

请快速分析以上内容，输出JSON结果。`;

    try {
      const response = await this.callAI(prompt, []);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('快速分析失败', { error });
      return {};
    }
  }

  async extractCharacters(content: string): Promise<CharacterInfo[]> {
    const prompt = `从以下小说内容中提取人物信息。以JSON数组格式输出：

[{"name": "角色名", "role": "protagonist|antagonist|supporting|minor", "description": "描述", "traits": ["特点"]}]

内容：
${content.substring(0, 3000)}`;

    try {
      const response = await this.callAI(prompt, []);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  async checkConsistency(analysis: ProjectAnalysis): Promise<string[]> {
    const issues: string[] = [];

    for (const char of analysis.characters) {
      const sameNameDifferentRole = analysis.characters.find(
        (c) => c.name === char.name && c.role !== char.role
      );
      if (sameNameDifferentRole) {
        issues.push(`人物 "${char.name}" 角色定位不一致`);
      }
    }

    for (let i = 0; i < analysis.timeline.length - 1; i++) {
      const current = analysis.timeline[i];
      const next = analysis.timeline[i + 1];
      if (current.chapter === next.chapter && current.time && next.time) {
        const timeConflict = this.detectTimeConflict(current.time, next.time);
        if (timeConflict) {
          issues.push(`时间线冲突: 第${current.chapter}章 "${current.event}" 与 "${next.event}"`);
        }
      }
    }

    for (const foreshadow of analysis.foreshadowing) {
      if (foreshadow.status === 'planted') {
        const daysSincePlanted =
          (Date.now() - new Date(foreshadow.plantedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePlanted > 30) {
          issues.push(`伏笔 "${foreshadow.content.substring(0, 20)}..." 已埋设超过30天未回收`);
        }
      }
    }

    return issues;
  }

  private detectTimeConflict(time1: string, time2: string): boolean {
    const timePatterns = [
      /(\d+)年/,
      /(\d+)月/,
      /(\d+)日/,
      /(\d+)时/,
      /早上|上午|中午|下午|晚上|深夜/,
    ];

    for (const pattern of timePatterns) {
      const match1 = time1.match(pattern);
      const match2 = time2.match(pattern);
      if (match1 && match2 && match1[0] !== match2[0]) {
        return true;
      }
    }

    return false;
  }
}

export function createProjectAnalyzer(
  projectPath: string,
  callAI: (prompt: string, history: unknown[]) => Promise<string>
): ProjectAnalyzer {
  return new ProjectAnalyzer(projectPath, callAI);
}
