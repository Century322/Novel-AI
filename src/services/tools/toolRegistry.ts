import { logger } from '../core/loggerService';
import {
  ToolDefinition,
  ToolHandler,
  ToolContext,
  ToolRegistryEntry,
  ToolResult,
  ToolCall,
} from '@/types/ai/tools';

export type { ToolDefinition, ToolHandler, ToolContext, ToolRegistryEntry, ToolResult, ToolCall };

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();

  constructor(_projectPath: string, _skipBuiltinTools: boolean = true) {}

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, {
      definition,
      handler,
      registeredAt: Date.now(),
      callCount: 0,
    });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter(
      (entry) => entry.definition.category === category
    );
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  async execute(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const entry = this.tools.get(toolCall.name);

    if (!entry) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: `Tool "${toolCall.name}" not found`,
      };
    }

    const maxRetries = 3;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Executing tool: ${toolCall.name}`, { attempt, args: toolCall.arguments });

        const result = await entry.handler(toolCall.arguments, context);

        entry.callCount++;
        entry.lastCalledAt = Date.now();

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        logger.warn(`Tool execution failed: ${toolCall.name}`, { attempt, error: lastError });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    return {
      toolCallId: toolCall.id,
      success: false,
      error: `Failed after ${maxRetries} attempts: ${lastError}`,
    };
  }

  getStats(): { totalTools: number; byCategory: Record<string, number>; totalCalls: number } {
    const byCategory: Record<string, number> = {};
    let totalCalls = 0;
    for (const entry of this.tools.values()) {
      const category = entry.definition.category || 'other';
      byCategory[category] = (byCategory[category] || 0) + 1;
      totalCalls += entry.callCount;
    }
    return { totalTools: this.tools.size, byCategory, totalCalls };
  }
}

export function createToolRegistry(projectPath: string): ToolRegistry {
  return new ToolRegistry(projectPath);
}
