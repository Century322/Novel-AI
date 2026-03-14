import { ToolContext } from '../toolRegistry';
import { GenerateContentArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';
import { llmService } from '../../ai/llmService';

export const generateContentDefinition = {
  name: 'generate_content',
  description: `核心内容生成工具。用于生成小说的各种内容类型。

支持的内容类型：
- scene: 场景描写
- dialogue: 对话
- description: 描述性文字
- chapter: 完整章节
- revise: 修改现有内容

约束参数（可选）：
- style: 写作风格
- perspective: 叙事视角
- length: 目标字数
- characters: 涉及的角色列表

【重要】生成内容后，返回结果会包含 suggestSave 和 saveMessage 字段。
你应该在回复用户时，先展示生成的内容，然后询问用户是否需要保存。
如果用户确认保存，使用 file_ops 的 write 操作保存文件。

使用示例：
- generate_content({ type: "scene", prompt: "描写一场雨夜战斗", constraints: { style: "紧张", length: 500 } })
- generate_content({ type: "dialogue", prompt: "主角与反派对峙", constraints: { characters: ["主角", "反派"] } })`,
  parameters: {
    type: {
      type: 'string',
      description: '内容类型：scene | dialogue | description | chapter | revise',
      enum: ['scene', 'dialogue', 'description', 'chapter', 'revise'],
      required: true,
    },
    prompt: {
      type: 'string',
      description: '生成提示，描述要生成的内容',
      required: true,
    },
    constraints: {
      type: 'object',
      description: '可选约束条件',
      properties: {
        style: { type: 'string', description: '写作风格' },
        perspective: { type: 'string', description: '叙事视角' },
        length: { type: 'number', description: '目标字数' },
        characters: { type: 'array', items: { type: 'string' }, description: '涉及的角色' },
      },
    },
  },
  category: 'writing',
};

export async function generateContentHandler(args: GenerateContentArgs, _context: ToolContext): Promise<ToolResult> {
  const { type, prompt, constraints } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    const systemPrompt = buildSystemPrompt(type, constraints);
    const fullPrompt = buildPrompt(type, prompt, constraints);

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
      temperature: 0.7,
      maxTokens: constraints?.length ? Math.min(constraints.length * 2, 4096) : 2048,
    });

    const result = response.content;

    return {
      success: true,
      result: {
        type,
        content: result,
        wordCount: result.length,
        constraints,
        suggestSave: true,
        saveMessage: `内容已生成（约${result.length}字），是否保存到文件？如需保存，请告诉我保存路径，例如：保存到 works/chapters/第一章.md`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

function buildSystemPrompt(type: string, constraints?: { style?: string; perspective?: string }): string {
  let systemPrompt = '你是一位专业的小说作家，擅长创作引人入胜的故事内容。';

  const typeDescriptions: Record<string, string> = {
    scene: '你正在创作一个场景描写，需要用生动的语言描绘环境、氛围和细节。',
    dialogue: '你正在创作对话内容，需要让角色的对话自然、生动，体现角色性格。',
    description: '你正在创作描述性文字，需要用细腻的笔触描绘人物、物品或环境。',
    chapter: '你正在创作一个完整的章节，需要有清晰的结构和流畅的叙事。',
    revise: '你正在修改和完善现有内容，需要保持原意的同时提升文字质量。',
  };

  systemPrompt += '\n\n' + (typeDescriptions[type] || '');

  if (constraints?.style) {
    systemPrompt += `\n\n写作风格要求：${constraints.style}`;
  }

  if (constraints?.perspective) {
    systemPrompt += `\n\n叙事视角：${constraints.perspective}`;
  }

  return systemPrompt;
}

function buildPrompt(_type: string, prompt: string, constraints?: { length?: number; characters?: string[] }): string {
  let fullPrompt = prompt;

  if (constraints?.characters && Array.isArray(constraints.characters)) {
    fullPrompt = `涉及角色：${constraints.characters.join('、')}\n\n${fullPrompt}`;
  }

  if (constraints?.length) {
    fullPrompt = `目标字数：约${constraints.length}字\n\n${fullPrompt}`;
  }

  return fullPrompt;
}
