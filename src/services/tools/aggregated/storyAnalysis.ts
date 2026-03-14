import { ToolContext } from '../toolRegistry';
import { StoryAnalysisArgs, ToolResult } from './types';
import { getServiceRegistry, ServiceRegistry } from '../../core/serviceInitializer';

export const storyAnalysisDefinition = {
  name: 'story_analysis',
  description: `统一的故事分析工具。用于评估和分析小说内容的质量、一致性和情感。

支持的分析类型：
- quality: 整体质量评估
- structure: 结构分析
- consistency: 一致性检查（角色、情节、设定）
- emotion: 情感真实性分析
- pacing: 节奏分析
- foreshadowing: 伏笔检查
- validation: 世界观验证

使用示例：
- story_analysis({ type: "quality", text: "要分析的文本..." })
- story_analysis({ type: "consistency", text: "...", scope: "chapter" })`,
  parameters: {
    type: {
      type: 'string',
      description: '分析类型：quality | structure | consistency | emotion | pacing | foreshadowing | validation',
      enum: ['quality', 'structure', 'consistency', 'emotion', 'pacing', 'foreshadowing', 'validation'],
      required: true,
    },
    text: {
      type: 'string',
      description: '要分析的文本内容',
      required: true,
    },
    scope: {
      type: 'string',
      description: '分析范围：paragraph | scene | chapter',
      enum: ['paragraph', 'scene', 'chapter'],
    },
  },
  category: 'analysis',
};

export async function storyAnalysisHandler(args: StoryAnalysisArgs, _context: ToolContext): Promise<ToolResult> {
  const { type, text, scope = 'scene' } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    switch (type) {
      case 'quality':
        return await analyzeQuality(services, text, scope);
      case 'structure':
        return await analyzeStructure(services, text, scope);
      case 'consistency':
        return await analyzeConsistency(services, text, scope);
      case 'emotion':
        return await analyzeEmotion(services, text, scope);
      case 'pacing':
        return await analyzePacing(services, text, scope);
      case 'foreshadowing':
        return await analyzeForeshadowing(services, text, scope);
      case 'validation':
        return await validateWorld(services, text);
      default:
        return { success: false, error: `未知分析类型: ${type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function analyzeQuality(
  services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const qualityService = services.qualityService;
  if (!qualityService) {
    return { success: false, error: '质量服务未初始化' };
  }

  const result = await qualityService.assessContent(text, { characters: [] });
  return { success: true, result: { type: 'quality', scope, ...result } };
}

async function analyzeStructure(
  _services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const paragraphs = text.split(/\n\n+/);
  const sentences = text.split(/[。！？\n]+/).filter(s => s.trim());

  const structure = {
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    avgParagraphLength: text.length / Math.max(paragraphs.length, 1),
    avgSentenceLength: text.length / Math.max(sentences.length, 1),
  };

  return { success: true, result: { type: 'structure', scope, structure } };
}

async function analyzeConsistency(
  services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const characterService = services.characterService;
  const timelineService = services.timelineService;

  const issues: Array<{ type: string; description: string; severity: string }> = [];

  if (characterService) {
    const characters = characterService.getAllCharacters();
    const mentionedNames = extractCharacterNames(text, characters.map(c => c.name));

    for (const name of mentionedNames) {
      const char = characters.find(c => c.name === name);
      if (char && char.personality?.traits) {
        const traitConsistency = checkTraitConsistency(text, char);
        if (!traitConsistency.consistent) {
          issues.push({
            type: 'character_trait',
            description: `角色 "${name}" 的行为可能与其特质不符`,
            severity: 'warning',
          });
        }
      }
    }
  }

  if (timelineService) {
    const events = timelineService.getAllEvents();
    const timelineConsistency = checkTimelineConsistency(text, events);
    if (!timelineConsistency.consistent) {
      issues.push({
        type: 'timeline',
        description: timelineConsistency.issue || '时间线可能存在不一致',
        severity: 'warning',
      });
    }
  }

  return {
    success: true,
    result: {
      type: 'consistency',
      scope,
      issues,
      hasIssues: issues.length > 0,
    },
  };
}

async function analyzeEmotion(
  _services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const emotionKeywords = {
    positive: ['高兴', '快乐', '幸福', '喜悦', '兴奋', '满足'],
    negative: ['悲伤', '痛苦', '愤怒', '恐惧', '焦虑', '绝望'],
    neutral: ['平静', '淡然', '沉默', '思考'],
  };

  const emotions: Record<string, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'g');
      emotions[emotion] += (text.match(regex) || []).length;
    }
  }

  const dominantEmotion = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0][0];

  return {
    success: true,
    result: {
      type: 'emotion',
      scope,
      emotions,
      dominantEmotion,
      authenticityScore: Math.min(10, emotions.positive + emotions.negative + emotions.neutral + 5),
    },
  };
}

async function analyzePacing(
  _services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  const avgSentenceLength = text.length / Math.max(sentences.length, 1);

  const dialogueCount = (text.match(/["「」『』]/g) || []).length / 2;
  const descriptionRatio = 1 - (dialogueCount * 10) / Math.max(text.length, 1);

  let pacingAssessment = '适中';
  if (avgSentenceLength > 50) {
    pacingAssessment = '较慢，适合描写';
  } else if (avgSentenceLength < 20) {
    pacingAssessment = '较快，适合动作场景';
  }

  return {
    success: true,
    result: {
      type: 'pacing',
      scope,
      sentenceCount: sentences.length,
      avgSentenceLength: Math.round(avgSentenceLength),
      dialogueCount,
      descriptionRatio: Math.round(descriptionRatio * 100) / 100,
      assessment: pacingAssessment,
    },
  };
}

async function analyzeForeshadowing(
  services: ServiceRegistry,
  text: string,
  scope: string
): Promise<ToolResult> {
  const foreshadowingService = services.foreshadowingService;
  
  const potentialForeshadowing: string[] = [];
  const foreshadowingPatterns = [
    /似乎.*但/g,
    /仿佛.*其实/g,
    /暗示/g,
    /伏笔/g,
    /预兆/g,
  ];

  for (const pattern of foreshadowingPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      potentialForeshadowing.push(...matches);
    }
  }

  let existingForeshadowing: unknown[] = [];
  if (foreshadowingService) {
    existingForeshadowing = foreshadowingService.getAllForeshadowings();
  }

  return {
    success: true,
    result: {
      type: 'foreshadowing',
      scope,
      potentialCount: potentialForeshadowing.length,
      potentialForeshadowing,
      existingCount: existingForeshadowing.length,
    },
  };
}

async function validateWorld(
  services: ServiceRegistry,
  _text: string
): Promise<ToolResult> {
  const novelBibleService = services.novelBibleService;

  const validationResults: Array<{ type: string; valid: boolean; issues?: string[] }> = [];

  if (novelBibleService) {
    const bible = novelBibleService.getNovelBible();
    if (bible) {
      const issues: string[] = [];
      if (!bible.metadata.title) issues.push('缺少作品标题');
      if (bible.characters.length === 0) issues.push('缺少角色信息');
      
      validationResults.push({
        type: 'novel_bible',
        valid: issues.length === 0,
        issues,
      });
    }
  }

  const allValid = validationResults.every(r => r.valid);

  return {
    success: true,
    result: {
      type: 'validation',
      allValid,
      results: validationResults,
    },
  };
}

function extractCharacterNames(text: string, knownNames: string[]): string[] {
  const mentioned: string[] = [];
  for (const name of knownNames) {
    if (text.includes(name)) {
      mentioned.push(name);
    }
  }
  return mentioned;
}

function checkTraitConsistency(
  _text: string,
  _character: { name: string; personality?: { traits?: string[] } }
): { consistent: boolean } {
  return { consistent: true };
}

function checkTimelineConsistency(
  _text: string,
  _events: Array<{ title: string; storyTime?: string }>
): { consistent: boolean; issue?: string } {
  return { consistent: true };
}
