import React, { Component, ErrorInfo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { logger } from '@/services/core/loggerService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary 捕获错误', { error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
          <div className="max-w-[600px] text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4">出现了一些问题</h1>
            <p className="text-muted-foreground mb-6">
              应用遇到了一个意外错误。请尝试刷新页面或重置应用状态。
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className={cn(
                  'px-4 py-2 rounded-lg',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'cursor-pointer'
                )}
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  'px-4 py-2 rounded-lg',
                  'bg-secondary text-secondary-foreground',
                  'hover:bg-secondary/80 transition-colors',
                  'cursor-pointer'
                )}
              >
                刷新页面
              </button>
            </div>
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-muted-foreground text-sm">
                查看错误详情
              </summary>
              <pre
                className={cn(
                  'mt-2 p-4 rounded-lg',
                  'bg-muted text-destructive',
                  'text-xs overflow-auto max-h-[200px]',
                  'whitespace-pre-wrap break-all'
                )}
              >
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
