import { ToolContext } from '../toolRegistry';
import { StyleOpsArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';

export const styleOpsDefinition = {
  name: 'style_ops',
  description: `统一的风格操作工具。用于学习、分析和应用写作风格。

支持的操作：
- learn: 学习文本风格，添加到风格库
- analyze: 分析文本的风格特征
- apply: 应用指定风格生成提示
- add_reference: 添加参考段落
- extract: 从文本中提取风格设置

使用示例：
- style_ops({ action: "learn", text: "参考文本..." })
- style_ops({ action: "analyze", text: "要分析的文本..." })
- style_ops({ action: "apply", style: "金庸风格" })`,
  parameters: {
    action: {
      type: 'string' as const,
      description: '操作类型：learn | analyze | apply | add_reference | extract',
      enum: ['learn', 'analyze', 'apply', 'add_reference', 'extract'],
      required: true,
    },
    text: {
      type: 'string' as const,
      description: '输入文本（learn/analyze/extract 操作需要）',
    },
    style: {
      type: 'string' as const,
      description: '风格名称（apply 操作需要）',
    },
    passage: {
      type: 'string' as const,
      description: '参考段落（add_reference 操作需要）',
    },
  },
  category: 'style',
};

export async function styleOpsHandler(args: StyleOpsArgs, _context: ToolContext): Promise<ToolResult> {
  const { action, text, passage } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  const styleService = services.styleService;
  if (!styleService) {
    return { success: false, error: '风格服务未初始化' };
  }

  try {
    switch (action) {
      case 'learn':
        if (!text) {
          return { success: false, error: '学习操作需要提供 text 参数' };
        }
        const session = await styleService.learnFromContent(text);
        return { success: true, result: { action: 'learned', sessionId: session.id, textLength: text.length } };

      case 'analyze':
        if (!text) {
          return { success: false, error: '分析操作需要提供 text 参数' };
        }
        const analysis = await styleService.learnFromContent(text);
        return { success: true, result: { action: 'analyzed', features: analysis.extractedFeatures } };

      case 'apply':
        const profile = styleService.getProfile();
        if (!profile) {
          return { success: false, error: '没有可用的风格档案' };
        }
        return { success: true, result: { action: 'applied', profile: { name: profile.name, features: profile.features } } };

      case 'add_reference':
        const refText = passage || text;
        if (!refText) {
          return { success: false, error: '添加参考操作需要提供 passage 或 text 参数' };
        }
        const refSession = await styleService.learnFromContent(refText);
        return { success: true, result: { action: 'added', sessionId: refSession.id, passageLength: refText.length } };

      case 'extract':
        if (!text) {
          return { success: false, error: '提取操作需要提供 text 参数' };
        }
        const extractSession = await styleService.learnFromContent(text);
        return { success: true, result: { action: 'extracted', features: extractSession.extractedFeatures, vocabulary: extractSession.newVocabulary } };

      default:
        return { success: false, error: `未知操作类型: ${action}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}
