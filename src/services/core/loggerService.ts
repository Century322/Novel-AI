import { useTerminalStore, LogLevel, LogSource } from '@/store/terminalStore';

class LoggerService {
  private addLog(
    level: LogLevel,
    source: LogSource,
    message: string,
    details?: Record<string, unknown>
  ) {
    try {
      useTerminalStore.getState().addLog({ level, source, message, details });
    } catch {
      console.log(`[${level}] [${source}] ${message}`, details || '');
    }
  }

  info(message: string, details?: Record<string, unknown>) {
    this.addLog('info', 'system', message, details);
  }

  warn(message: string, details?: Record<string, unknown>) {
    this.addLog('warn', 'system', message, details);
  }

  error(message: string, details?: Record<string, unknown>) {
    this.addLog('error', 'system', message, details);
  }

  debug(message: string, details?: Record<string, unknown>) {
    this.addLog('debug', 'system', message, details);
  }

  ai(message: string, details?: Record<string, unknown>) {
    this.addLog('info', 'ai', message, details);
  }

  aiError(message: string, details?: Record<string, unknown>) {
    this.addLog('error', 'ai', message, details);
  }

  tool(message: string, details?: Record<string, unknown>) {
    this.addLog('info', 'tool', message, details);
  }

  toolError(message: string, details?: Record<string, unknown>) {
    this.addLog('error', 'tool', message, details);
  }

  api(message: string, details?: Record<string, unknown>) {
    this.addLog('info', 'api', message, details);
  }

  apiError(message: string, details?: Record<string, unknown>) {
    this.addLog('error', 'api', message, details);
  }

  user(message: string, details?: Record<string, unknown>) {
    this.addLog('info', 'user', message, details);
  }

  toolCall(
    toolName: string,
    toolType: string,
    parameters: Record<string, unknown>,
    result: unknown,
    success: boolean,
    duration: number,
    error?: string
  ) {
    try {
      useTerminalStore.getState().addToolCall({
        toolName,
        toolType,
        parameters,
        result,
        success,
        duration,
        error,
      });
    } catch {
      console.log(`Tool call: ${toolName}`, { success, duration });
    }
  }

  generation(
    type: 'generate' | 'refine' | 'analyze' | 'tool',
    summary: string,
    content: string | undefined,
    tokenUsage: { input: number; output: number; total: number } | undefined,
    duration: number,
    model: string | undefined,
    success: boolean
  ) {
    try {
      useTerminalStore.getState().addOutput({
        type,
        summary,
        content,
        tokenUsage,
        duration,
        model,
        success,
      });
    } catch {
      console.log(`Generation: ${type}`, { summary, success, duration });
    }
  }

  problem(
    type:
      | 'plot_conflict'
      | 'character_inconsistency'
      | 'timeline_issue'
      | 'foreshadowing'
      | 'setting_conflict'
      | 'style_issue'
      | 'other',
    severity: 'critical' | 'major' | 'minor',
    title: string,
    description: string,
    location?: { chapter?: number; scene?: string; character?: string },
    suggestion?: string
  ) {
    try {
      useTerminalStore.getState().addProblem({
        type,
        severity,
        title,
        description,
        location,
        suggestion,
      });
    } catch {
      console.log(`Problem: ${title}`, { type, severity });
    }
  }
}

export const logger = new LoggerService();
