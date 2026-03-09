import { ThinkingStep, ThinkingProcess, ThinkingStepType } from '@/types/ai/thinkingProcess';
import { logger } from '@/services/core/loggerService';

type ThinkingCallback = (process: ThinkingProcess) => void;

class ThinkingProcessService {
  private currentProcess: ThinkingProcess | null = null;
  private callbacks: Set<ThinkingCallback> = new Set();
  private stepStartTime: number = 0;

  subscribe(callback: ThinkingCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notify(): void {
    if (this.currentProcess) {
      this.callbacks.forEach((cb) => cb(this.currentProcess!));
    }
  }

  startProcess(): void {
    this.currentProcess = {
      steps: [],
      currentStepIndex: -1,
      totalDuration: 0,
      startTime: Date.now(),
    };
    this.notify();
  }

  addStep(
    type: ThinkingStepType,
    title: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): string {
    if (!this.currentProcess) {
      this.startProcess();
    }

    const step: ThinkingStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      title,
      description,
      timestamp: Date.now(),
      status: 'pending',
      metadata,
    };

    this.currentProcess!.steps.push(step);
    this.currentProcess!.currentStepIndex = this.currentProcess!.steps.length - 1;
    this.notify();

    logger.debug(`[ThinkingProcess] 添加步骤: ${type} - ${title}`);
    return step.id;
  }

  startStep(stepId: string): void {
    if (!this.currentProcess) return;

    const step = this.currentProcess.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'running';
      this.stepStartTime = Date.now();
      this.currentProcess.currentStepIndex = this.currentProcess.steps.findIndex(
        (s) => s.id === stepId
      );
      this.notify();

      logger.debug(`[ThinkingProcess] 开始步骤: ${step.title}`);
    }
  }

  updateStep(stepId: string, updates: Partial<ThinkingStep>): void {
    if (!this.currentProcess) return;

    const step = this.currentProcess.steps.find((s) => s.id === stepId);
    if (step) {
      Object.assign(step, updates);
      this.notify();
    }
  }

  completeStep(stepId: string, details?: string): void {
    if (!this.currentProcess) return;

    const step = this.currentProcess.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.details = details;
      step.duration = Date.now() - this.stepStartTime;
      this.currentProcess.totalDuration += step.duration;
      this.notify();

      logger.debug(`[ThinkingProcess] 完成步骤: ${step.title} (${step.duration}ms)`);
    }
  }

  errorStep(stepId: string, error: string): void {
    if (!this.currentProcess) return;

    const step = this.currentProcess.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'error';
      step.details = error;
      step.duration = Date.now() - this.stepStartTime;
      this.notify();

      logger.error(`[ThinkingProcess] 步骤失败: ${step.title}`, { error });
    }
  }

  endProcess(): ThinkingProcess | null {
    if (!this.currentProcess) return null;

    this.currentProcess.endTime = Date.now();
    this.currentProcess.totalDuration = this.currentProcess.endTime - this.currentProcess.startTime;

    const process = this.currentProcess;
    this.notify();

    logger.info(
      `[ThinkingProcess] 流程结束，总耗时: ${process.totalDuration}ms，步骤数: ${process.steps.length}`
    );

    this.currentProcess = null;
    return process;
  }

  getProcess(): ThinkingProcess | null {
    return this.currentProcess;
  }

  clear(): void {
    this.currentProcess = null;
    this.notify();
  }

  async runWithThinking<T>(
    type: ThinkingStepType,
    title: string,
    fn: () => Promise<T>,
    description?: string
  ): Promise<T> {
    const stepId = this.addStep(type, title, description);
    this.startStep(stepId);

    try {
      const result = await fn();
      this.completeStep(stepId);
      return result;
    } catch (error) {
      this.errorStep(stepId, String(error));
      throw error;
    }
  }
}

export const thinkingProcessService = new ThinkingProcessService();
