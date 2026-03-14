import { ToolContext } from '../toolRegistry';
import { ContinueWritingArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';
import { llmService } from '../../ai/llmService';

export const continueWritingDefinition = {
  name: 'continue_writing',
  description: `续写工具。根据已有文本继续创作后续内容。

这是小说创作的核心工具之一，用于：
- 续写章节
- 扩展场景
- 延续对话

参数说明：
- text: 已有的文本内容，作为续写的起点
- style: 可选的风格提示
- length: 建议的续写长度

【重要】续写完成后，返回结果会包含 suggestSave 和 saveMessage 字段。
你应该在回复用户时，先展示续写的内容，然后询问用户是否需要保存。
如果用户确认保存，使用 file_ops 的 write 操作保存文件。

使用示例：
- continue_writing({ text: "夜色渐深，主角独自走在...", style: "悬疑", length: 500 })`,
  parameters: {
    text: {
      type: 'string',
      description: '已有文本，作为续写起点',
      required: true,
    },
    style: {
      type: 'string',
      description: '可选的风格提示',
    },
    length: {
      type: 'number',
      description: '建议的续写长度（字数）',
    },
  },
  category: 'writing',
};

export async function continueWritingHandler(args: ContinueWritingArgs, _context: ToolContext): Promise<ToolResult> {
  const { text, style, length } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    const systemPrompt = buildSystemPrompt(style);
    const userPrompt = buildUserPrompt(text, length);

    const response = await llmService.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      maxTokens: length ? Math.min(length * 2, 4096) : 2048,
    });

    const result = response.content;

    return {
      success: true,
      result: {
        originalLength: text.length,
        continuedLength: result.length,
        content: result,
        suggestSave: true,
        saveMessage: `续写完成（约${result.length}字），是否保存到文件？如需保存，请告诉我保存路径。`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

function buildSystemPrompt(style?: string): string {
  let prompt = '你是一位专业的小说作家，擅长根据已有内容进行续写。你的续写需要：\n';
  prompt += '1. 保持与原文风格一致\n';
  prompt += '2. 自然衔接，不突兀\n';
  prompt += '3. 保持人物性格一致\n';
  prompt += '4. 推进情节发展\n';

  if (style) {
    prompt += `\n写作风格要求：${style}`;
  }

  return prompt;
}

function buildUserPrompt(text: string, length?: number): string {
  let prompt = `请续写以下内容：\n\n${text}\n\n`;

  if (length) {
    prompt += `续写约${length}字。`;
  }

  prompt += '请直接输出续写内容，不要有任何前缀或解释。';

  return prompt;
}
