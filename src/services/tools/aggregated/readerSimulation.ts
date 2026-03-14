import { ToolContext } from '../toolRegistry';
import { ReaderSimulationArgs, ToolResult } from './types';
import { getServiceRegistry } from '../../core/serviceInitializer';

export const readerSimulationDefinition = {
  name: 'reader_simulation',
  description: `模拟读者反馈。从不同读者视角评估文本效果。

支持的读者类型：
- casual: 普通读者，关注故事流畅性和可读性
- hardcore: 资深读者，关注细节、伏笔和世界观一致性
- editor: 编辑视角，关注商业价值和市场接受度

返回内容包括：
- 整体评价
- 具体问题
- 改进建议
- 情感反应

使用示例：
- reader_simulation({ text: "要评估的文本...", reader_type: "editor" })`,
  parameters: {
    text: {
      type: 'string',
      description: '要评估的文本内容',
      required: true,
    },
    reader_type: {
      type: 'string',
      description: '读者类型：casual | hardcore | editor',
      enum: ['casual', 'hardcore', 'editor'],
      default: 'casual',
    },
  },
  category: 'analysis',
};

export async function readerSimulationHandler(args: ReaderSimulationArgs, _context: ToolContext): Promise<ToolResult> {
  const { text, reader_type = 'casual' } = args;
  const services = getServiceRegistry();

  if (!services) {
    return { success: false, error: '服务容器未初始化' };
  }

  try {
    const simulatedFeedback = await simulateReaderLocally(text, reader_type);
    return { success: true, result: simulatedFeedback };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

interface ReaderFeedback {
  reader_type: string;
  overallRating: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  emotionalResponse: string;
  engagementLevel: 'high' | 'medium' | 'low';
}

async function simulateReaderLocally(text: string, readerType: string): Promise<ReaderFeedback> {
  const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
  const avgSentenceLength = text.length / Math.max(sentences.length, 1);
  const dialogueRatio = ((text.match(/["「」『』]/g) || []).length / 2) / Math.max(sentences.length, 1);

  const feedback: ReaderFeedback = {
    reader_type: readerType,
    overallRating: 7,
    strengths: [],
    weaknesses: [],
    suggestions: [],
    emotionalResponse: '',
    engagementLevel: 'medium',
  };

  switch (readerType) {
    case 'casual':
      if (avgSentenceLength < 30) {
        feedback.strengths.push('节奏明快，易于阅读');
      } else {
        feedback.weaknesses.push('句子较长，可能影响阅读流畅度');
        feedback.suggestions.push('适当缩短长句，增加短句');
      }
      if (dialogueRatio > 0.3) {
        feedback.strengths.push('对话丰富，生动有趣');
      }
      feedback.emotionalResponse = '故事整体流畅，期待后续发展';
      break;

    case 'hardcore':
      if (text.includes('伏笔') || text.includes('暗示')) {
        feedback.strengths.push('有伏笔设置，增加阅读深度');
      } else {
        feedback.suggestions.push('可以增加一些伏笔或暗示，增加故事深度');
      }
      feedback.emotionalResponse = '细节处理需要更多打磨';
      feedback.weaknesses.push('世界观细节可能不够丰富');
      break;

    case 'editor':
      if (text.length > 500) {
        feedback.strengths.push('内容充实，有商业潜力');
      }
      feedback.suggestions.push('注意开头吸引力，确保能抓住读者');
      feedback.suggestions.push('检查是否有足够的冲突和转折');
      feedback.emotionalResponse = '整体有潜力，但需要进一步打磨';
      break;
  }

  if (feedback.strengths.length > feedback.weaknesses.length) {
    feedback.overallRating = Math.min(9, feedback.overallRating + 1);
    feedback.engagementLevel = 'high';
  } else if (feedback.weaknesses.length > feedback.strengths.length) {
    feedback.overallRating = Math.max(5, feedback.overallRating - 1);
    feedback.engagementLevel = 'low';
  }

  return feedback;
}
