export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SERVICE_NOT_AVAILABLE = 'SERVICE_NOT_AVAILABLE',
  INVALID_INPUT = 'INVALID_INPUT',
  OPERATION_FAILED = 'OPERATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.context = context;
    this.cause = cause;

    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  static fromError(error: unknown, context?: Record<string, unknown>): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    if (error instanceof Error) {
      return new ServiceError(error.message, ErrorCode.UNKNOWN, context, error);
    }

    return new ServiceError(String(error), ErrorCode.UNKNOWN, context);
  }

  static notFound(resource: string, id?: string): ServiceError {
    return new ServiceError(
      `${resource}${id ? ` with id "${id}"` : ''} not found`,
      ErrorCode.NOT_FOUND,
      { resource, id }
    );
  }

  static notAvailable(serviceName: string): ServiceError {
    return new ServiceError(
      `${serviceName} is not available`,
      ErrorCode.SERVICE_NOT_AVAILABLE,
      { serviceName }
    );
  }

  static invalidInput(message: string, field?: string): ServiceError {
    return new ServiceError(message, ErrorCode.INVALID_INPUT, { field });
  }

  static operationFailed(operation: string, reason?: string): ServiceError {
    return new ServiceError(
      `Operation "${operation}" failed${reason ? `: ${reason}` : ''}`,
      ErrorCode.OPERATION_FAILED,
      { operation, reason }
    );
  }
}

export type ErrorHandler = (error: ServiceError) => void;

export class ErrorRegistry {
  private static handlers: ErrorHandler[] = [];

  static register(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  static emit(error: ServiceError): void {
    for (const handler of this.handlers) {
      try {
        handler(error);
      } catch {
        // Ignore handler errors
      }
    }
  }
}

export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const serviceError = ServiceError.fromError(error, { context, args });
      ErrorRegistry.emit(serviceError);
      throw serviceError;
    }
  };
}

export function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  return operation().catch((error) => {
    const serviceError = ServiceError.fromError(error, { context });
    ErrorRegistry.emit(serviceError);
    return fallback;
  });
}

export function assertDefined<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw ServiceError.invalidInput(`${name} is required`, name);
  }
  return value;
}

export function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw ServiceError.invalidInput(message);
  }
}
