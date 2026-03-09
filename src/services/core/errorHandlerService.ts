import { useNotificationStore } from '@/store/notificationStore';
import { logger } from './loggerService';

interface ErrorHandlerOptions {
  title?: string;
  showNotification?: boolean;
  logToTerminal?: boolean;
  rethrow?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handle(error: unknown, options: ErrorHandlerOptions = {}): void {
    const {
      title = '操作失败',
      showNotification = true,
      logToTerminal = true,
      rethrow = false,
    } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (logToTerminal) {
      logger.error(title, {
        message: errorMessage,
        stack: errorStack,
      });
    }

    if (showNotification) {
      useNotificationStore.getState().addNotification({
        type: 'error',
        title,
        message: errorMessage,
      });
    }

    if (rethrow) {
      throw error;
    }
  }

  handleApiError(error: unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.apiError(context || 'API 调用失败', { error: errorMessage });

    useNotificationStore.getState().addNotification({
      type: 'error',
      title: '网络请求失败',
      message: errorMessage.includes('fetch') ? '网络连接失败，请检查网络设置' : errorMessage,
    });
  }

  handleToolError(toolName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.toolError(`工具执行失败: ${toolName}`, { error: errorMessage });

    useNotificationStore.getState().addNotification({
      type: 'error',
      title: '工具执行失败',
      message: `${toolName}: ${errorMessage}`,
    });
  }

  handleAIError(error: unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.aiError(context || 'AI 调用失败', { error: errorMessage });

    let userMessage = errorMessage;
    if (errorMessage.includes('401') || errorMessage.includes('API key')) {
      userMessage = 'API 密钥无效，请检查设置';
    } else if (errorMessage.includes('429')) {
      userMessage = '请求过于频繁，请稍后重试';
    } else if (errorMessage.includes('timeout')) {
      userMessage = '请求超时，请检查网络连接';
    }

    useNotificationStore.getState().addNotification({
      type: 'error',
      title: 'AI 调用失败',
      message: userMessage,
    });
  }

  wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options?: ErrorHandlerOptions
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, options);
        return undefined;
      }
    }) as T;
  }
}

export const errorHandler = ErrorHandler.getInstance();

export function setupGlobalErrorHandling(): void {
  window.addEventListener('error', (event) => {
    errorHandler.handle(event.error, {
      title: '应用错误',
      showNotification: true,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handle(event.reason, {
      title: '异步操作错误',
      showNotification: true,
    });
  });

  logger.info('全局错误处理已初始化');
}
