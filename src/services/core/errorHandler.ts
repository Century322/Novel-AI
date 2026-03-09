import { logger } from '../core/loggerService';

export type ErrorType =
  | 'api_error'
  | 'timeout'
  | 'rate_limit'
  | 'invalid_response'
  | 'network_error'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  retryable: boolean;
  userMessage: string;
  suggestedAction?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

const USER_MESSAGES: Record<ErrorType, { message: string; action?: string }> = {
  api_error: {
    message: 'AI 服务暂时不可用，请稍后再试',
    action: '可以尝试重新发送请求',
  },
  timeout: {
    message: '请求超时，AI 正在思考中',
    action: '请稍等片刻后重试',
  },
  rate_limit: {
    message: '请求过于频繁，请稍后再试',
    action: '建议等待 1 分钟后再继续',
  },
  invalid_response: {
    message: 'AI 返回了意外的响应格式',
    action: '请重新描述你的需求',
  },
  network_error: {
    message: '网络连接出现问题',
    action: '请检查网络连接后重试',
  },
  unknown: {
    message: '发生了未知错误',
    action: '请刷新页面或重启应用',
  },
};

export class ErrorHandler {
  private retryConfig: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  classifyError(error: unknown): AppError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('timeout') || message.includes('timed out')) {
        return this.createError('timeout', error);
      }

      if (message.includes('rate limit') || message.includes('429')) {
        return this.createError('rate_limit', error);
      }

      if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('econnrefused')
      ) {
        return this.createError('network_error', error);
      }

      if (
        message.includes('api') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503')
      ) {
        return this.createError('api_error', error);
      }

      if (message.includes('json') || message.includes('parse') || message.includes('unexpected')) {
        return this.createError('invalid_response', error);
      }
    }

    return this.createError('unknown', error);
  }

  private createError(type: ErrorType, originalError: unknown): AppError {
    const info = USER_MESSAGES[type];
    return {
      type,
      message: originalError instanceof Error ? originalError.message : String(originalError),
      originalError,
      retryable: ['api_error', 'timeout', 'rate_limit', 'network_error'].includes(type),
      userMessage: info.message,
      suggestedAction: info.action,
    };
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: AppError) => void
  ): Promise<T> {
    let lastError: AppError | null = null;
    let delay = this.retryConfig.baseDelay;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.classifyError(error);

        if (!lastError.retryable || attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }

        logger.warn(`操作失败，准备重试`, {
          attempt,
          error: lastError.message,
          delay,
        });

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await this.sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getUserFriendlyMessage(error: unknown): string {
    const appError = this.classifyError(error);
    let message = appError.userMessage;

    if (appError.suggestedAction) {
      message += `\n\n建议：${appError.suggestedAction}`;
    }

    return message;
  }

  logError(error: unknown, context?: Record<string, unknown>): void {
    const appError = this.classifyError(error);
    logger.error(`[${appError.type}] ${appError.message}`, {
      ...context,
      originalError: appError.originalError,
    });
  }
}

export const errorHandler = new ErrorHandler();

export function withErrorHandling<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  return operation().catch((error) => {
    errorHandler.logError(error);
    return fallback;
  });
}

export function createErrorResponse(error: unknown): {
  success: false;
  error: string;
  userMessage: string;
  retryable: boolean;
} {
  const appError = errorHandler.classifyError(error);
  return {
    success: false,
    error: appError.message,
    userMessage: appError.userMessage,
    retryable: appError.retryable,
  };
}
