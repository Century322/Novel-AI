import { CONTEXT_LIMITS } from '@/constants';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  content?: string;
}

export function validateFileType(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return (CONTEXT_LIMITS.ALLOWED_FILE_TYPES as readonly string[]).includes(ext);
}

export function validateFileSize(file: File): boolean {
  return file.size <= CONTEXT_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
}

export async function validateAndReadFile(file: File): Promise<FileValidationResult> {
  if (!validateFileType(file.name)) {
    return {
      valid: false,
      error: `不支持的文件类型。支持的类型: ${CONTEXT_LIMITS.ALLOWED_FILE_TYPES.join(', ')}`,
    };
  }

  if (!validateFileSize(file)) {
    return {
      valid: false,
      error: `文件大小超过限制 (${CONTEXT_LIMITS.MAX_FILE_SIZE_MB}MB)`,
    };
  }

  try {
    const content = await file.text();
    return { valid: true, content };
  } catch {
    return {
      valid: false,
      error: '无法读取文件内容',
    };
  }
}
