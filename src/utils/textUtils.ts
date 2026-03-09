import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/services/core/loggerService';

export function parseJsonFromMarkdown<T>(text: string): { data: T | null; cleanText: string } {
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonBlockRegex);

  if (!match) {
    return { data: null, cleanText: text };
  }

  try {
    const rawData = JSON.parse(match[1]);
    if (rawData.task && typeof rawData.task.type === 'string') {
      const validTypes = ['generate', 'refine', 'critique'] as const;
      if (!validTypes.includes(rawData.task.type as (typeof validTypes)[number])) {
        rawData.task.type = 'generate';
      }
    }
    const data = rawData as T;
    const cleanText = text.replace(jsonBlockRegex, '').trim();
    return { data, cleanText };
  } catch (e) {
    logger.error('JSON 解析错误', { error: e });
    return { data: null, cleanText: text };
  }
}

export function cleanText(text: string): string {
  const controlCharsRegex = new RegExp(
    '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]',
    'g'
  );
  return text
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(controlCharsRegex, '')
    .normalize('NFC');
}

export function splitText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

export function generateUniqueId(): string {
  return uuidv4();
}
