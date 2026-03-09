import { logger } from '../core/loggerService';
import { TaskPlan, TaskStep, TaskNode, TaskGraph as TaskGraphType } from '@/types/kernel/task';

export class TaskGraph {
  private graph: TaskGraphType;
  private plan: TaskPlan;

  constructor(plan: TaskPlan) {
    this.plan = plan;
    this.graph = this.buildGraph(plan);
  }

  private buildGraph(plan: TaskPlan): TaskGraphType {
    const nodes = new Map<string, TaskNode>();
    const adjacencyList = new Map<string, string[]>();
    const reverseAdjacencyList = new Map<string, string[]>();

    for (const step of plan.steps) {
      nodes.set(step.id, {
        step,
        children: [],
        parents: [...step.dependencies],
        level: 0,
      });
      adjacencyList.set(step.id, []);
      reverseAdjacencyList.set(step.id, []);
    }

    for (const step of plan.steps) {
      for (const depId of step.dependencies) {
        const parentNode = nodes.get(depId);
        if (parentNode) {
          parentNode.children.push(step.id);
          adjacencyList.get(depId)?.push(step.id);
          reverseAdjacencyList.get(step.id)?.push(depId);
        }
      }
    }

    this.calculateLevels(nodes, adjacencyList);

    return {
      planId: plan.id,
      nodes,
      adjacencyList,
      reverseAdjacencyList,
      totalNodes: plan.steps.length,
      completedNodes: 0,
      failedNodes: 0,
    };
  }

  private calculateLevels(
    nodes: Map<string, TaskNode>,
    adjacencyList: Map<string, string[]>
  ): void {
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const [id, node] of nodes) {
      if (node.parents.length === 0) {
        node.level = 0;
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const currentNode = nodes.get(currentId);
      if (!currentNode) {
        continue;
      }

      const children = adjacencyList.get(currentId) || [];
      for (const childId of children) {
        const childNode = nodes.get(childId);
        if (childNode) {
          childNode.level = Math.max(childNode.level, currentNode.level + 1);
          queue.push(childId);
        }
      }
    }
  }

  nextReady(): TaskStep | null {
    for (const [id, node] of this.graph.nodes) {
      if (node.step.status !== 'pending') {
        continue;
      }

      const allParentsComplete = node.parents.every((parentId) => {
        const parent = this.graph.nodes.get(parentId);
        return parent && parent.step.status === 'completed';
      });

      const noParentsFailed = node.parents.every((parentId) => {
        const parent = this.graph.nodes.get(parentId);
        return parent && parent.step.status !== 'failed';
      });

      if (allParentsComplete && noParentsFailed) {
        logger.debug('[TaskGraph] 找到可执行任务', {
          stepId: id,
          action: node.step.action,
        });
        return node.step;
      }
    }

    return null;
  }

  hasReadyTasks(): boolean {
    return this.nextReady() !== null;
  }

  isComplete(): boolean {
    for (const node of this.graph.nodes.values()) {
      if (node.step.status === 'pending' || node.step.status === 'running') {
        return false;
      }
    }
    return true;
  }

  hasFailed(): boolean {
    for (const node of this.graph.nodes.values()) {
      if (node.step.status === 'failed') {
        const hasPendingChildren = node.children.some((childId) => {
          const child = this.graph.nodes.get(childId);
          return child && (child.step.status === 'pending' || child.step.status === 'running');
        });
        if (hasPendingChildren) {
          return true;
        }
      }
    }
    return false;
  }

  updateStepStatus(
    stepId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    error?: string
  ): void {
    const node = this.graph.nodes.get(stepId);
    if (!node) {
      logger.warn('[TaskGraph] 未找到任务节点', { stepId });
      return;
    }

    const oldStatus = node.step.status;
    node.step.status = status;

    if (status === 'running') {
      node.step.startedAt = Date.now();
    } else if (status === 'completed' || status === 'failed') {
      node.step.completedAt = Date.now();
      if (error) {
        node.step.error = error;
      }
    }

    if (oldStatus !== 'completed' && status === 'completed') {
      this.graph.completedNodes++;
    }
    if (status === 'failed') {
      this.graph.failedNodes++;
    }

    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex !== -1) {
      this.plan.steps[stepIndex] = node.step;
      this.plan.metadata.completedSteps = this.graph.completedNodes;
    }

    logger.debug('[TaskGraph] 更新任务状态', {
      stepId,
      action: node.step.action,
      oldStatus,
      newStatus: status,
    });
  }

  setStepOutput(stepId: string, output: unknown): void {
    const node = this.graph.nodes.get(stepId);
    if (!node) {
      return;
    }

    node.step.output = output;
    const stepIndex = this.plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex !== -1) {
      this.plan.steps[stepIndex].output = output;
    }
  }

  getStep(stepId: string): TaskStep | undefined {
    return this.graph.nodes.get(stepId)?.step;
  }

  getPlan(): TaskPlan {
    return this.plan;
  }

  getProgress(): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    percentage: number;
  } {
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let running = 0;

    for (const node of this.graph.nodes.values()) {
      switch (node.step.status) {
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'running':
          running++;
          break;
        case 'pending':
          pending++;
          break;
      }
    }

    const total = this.graph.totalNodes;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, failed, pending, running, percentage };
  }

  getExecutionOrder(): TaskStep[][] {
    const levels = new Map<number, TaskStep[]>();

    for (const node of this.graph.nodes.values()) {
      const level = node.level;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node.step);
    }

    const result: TaskStep[][] = [];
    const maxLevel = Math.max(...Array.from(levels.keys()), 0);

    for (let i = 0; i <= maxLevel; i++) {
      const steps = levels.get(i);
      if (steps) {
        result.push(
          steps.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          })
        );
      }
    }

    return result;
  }

  getDependentSteps(stepId: string): TaskStep[] {
    const children = this.graph.adjacencyList.get(stepId) || [];
    return children
      .map((id) => this.graph.nodes.get(id)?.step)
      .filter((step): step is TaskStep => step !== undefined);
  }

  getDependencySteps(stepId: string): TaskStep[] {
    const parents = this.graph.reverseAdjacencyList.get(stepId) || [];
    return parents
      .map((id) => this.graph.nodes.get(id)?.step)
      .filter((step): step is TaskStep => step !== undefined);
  }

  skipStep(stepId: string, reason: string): void {
    const node = this.graph.nodes.get(stepId);
    if (!node) {
      return;
    }

    node.step.status = 'skipped';
    node.step.error = reason;

    logger.info('[TaskGraph] 跳过任务', { stepId, action: node.step.action, reason });

    const children = this.graph.adjacencyList.get(stepId) || [];
    for (const childId of children) {
      const childNode = this.graph.nodes.get(childId);
      if (childNode) {
        childNode.parents = childNode.parents.filter((id) => id !== stepId);
        childNode.step.dependencies = childNode.step.dependencies.filter((id) => id !== stepId);
      }
    }
  }

  retryStep(stepId: string): boolean {
    const node = this.graph.nodes.get(stepId);
    if (!node || node.step.retryCount >= node.step.maxRetries) {
      return false;
    }

    node.step.status = 'pending';
    node.step.retryCount++;
    node.step.error = undefined;
    node.step.startedAt = undefined;
    node.step.completedAt = undefined;

    logger.info('[TaskGraph] 重试任务', {
      stepId,
      action: node.step.action,
      retryCount: node.step.retryCount,
    });

    return true;
  }

  getSummary(): string {
    const progress = this.getProgress();
    const lines: string[] = [
      `任务计划: ${this.plan.goal}`,
      `进度: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
      `状态: 完成=${progress.completed}, 运行中=${progress.running}, 等待=${progress.pending}, 失败=${progress.failed}`,
    ];

    const executionOrder = this.getExecutionOrder();
    lines.push('\n执行顺序:');
    executionOrder.forEach((steps, level) => {
      lines.push(`  Level ${level}: ${steps.map((s) => s.action).join(', ')}`);
    });

    return lines.join('\n');
  }
}

export function createTaskGraph(plan: TaskPlan): TaskGraph {
  return new TaskGraph(plan);
}
