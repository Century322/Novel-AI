import React, { useEffect, useState } from 'react';
import {
  ThinkingStep,
  ThinkingProcess,
  THINKING_STEP_CONFIG,
} from '@/types/ai/thinkingProcess';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { IntentResult } from '@/types/ai/intent';
import type { AgentState } from '@/services/ai/agentEngine';

interface ThinkingProcessViewerProps {
  process: ThinkingProcess | null;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  intent?: IntentResult | null;
  agentState?: AgentState | null;
}

export const ThinkingProcessViewer: React.FC<ThinkingProcessViewerProps> = ({
  process,
  className,
  expanded = false,
  onToggleExpand,
  intent,
  agentState,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!process || process.endTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - process.startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [process]);

  const hasContent = process?.steps.length || intent || agentState;
  if (!hasContent) return null;

  const getStatusText = (): string => {
    if (agentState && agentState.status !== 'completed' && agentState.status !== 'idle') {
      switch (agentState.status) {
        case 'planning': return '规划中';
        case 'thinking': return '思考中';
        case 'acting': return `执行 ${agentState.currentAction?.toolName || ''}`;
        case 'observing': return '观察中';
        case 'responding': return '生成中';
        case 'error': return '出错';
        case 'paused': return '暂停';
        default: return '处理中';
      }
    }
    const currentStep = process?.steps[process.currentStepIndex];
    return currentStep?.title || '处理中';
  };

  const thinkingTime = process?.endTime
    ? ((process.endTime - process.startTime) / 1000).toFixed(1)
    : (elapsedTime / 1000).toFixed(1);

  return (
    <div className={cn('text-[11px] text-zinc-500', className)}>
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-1 hover:text-zinc-400 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="text-zinc-400">{getStatusText()}</span>
        <span className="text-zinc-600">{thinkingTime}s</span>
      </button>

      {expanded && (
        <div className="mt-1.5 ml-3 space-y-0.5 font-mono text-[10px]">
          {intent && (
            <div className="text-purple-400/70">
              <span className="text-zinc-600">intent:</span> {intent.category} → {intent.specificIntent}
              <span className="ml-1 text-zinc-600">({Math.round(intent.confidence * 100)}%)</span>
            </div>
          )}

          {agentState && agentState.status !== 'completed' && agentState.status !== 'idle' && (
            <div className="text-blue-400/70">
              <span className="text-zinc-600">agent:</span> {agentState.status}
              {agentState.currentAction?.toolName && (
                <span className="text-zinc-600"> → {agentState.currentAction.toolName}</span>
              )}
            </div>
          )}

          {process?.steps.map((step, index) => (
            <StepLine
              key={step.id}
              step={step}
              isCurrent={index === process.currentStepIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface StepLineProps {
  step: ThinkingStep;
  isCurrent: boolean;
}

const StepLine: React.FC<StepLineProps> = ({ step, isCurrent }) => {
  const config = THINKING_STEP_CONFIG[step.type];

  const StatusIcon = () => {
    switch (step.status) {
      case 'pending': return <span className="text-zinc-700">○</span>;
      case 'running': return <Loader2 size={8} className="text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle2 size={8} className="text-green-500/70" />;
      case 'error': return <XCircle size={8} className="text-red-500/70" />;
    }
  };

  return (
    <div className={cn('flex items-center gap-1', isCurrent && 'text-zinc-400')}>
      <StatusIcon />
      <span>{config.icon}</span>
      <span className={cn(config.color, 'opacity-70')}>{step.title}</span>
      {step.duration && <span className="text-zinc-700">{step.duration}ms</span>}
    </div>
  );
};

interface ThinkingProcessCompactProps {
  process: ThinkingProcess | null;
  className?: string;
  intent?: IntentResult | null;
  agentState?: AgentState | null;
}

export const ThinkingProcessCompact: React.FC<ThinkingProcessCompactProps> = ({
  process,
  className,
  intent,
  agentState,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!process || process.endTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - process.startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [process]);

  const getStatusText = () => {
    if (agentState && agentState.status !== 'completed') {
      switch (agentState.status) {
        case 'planning': return '规划中';
        case 'thinking': return '思考中';
        case 'acting': return `执行: ${agentState.currentAction?.toolName || ''}`;
        case 'responding': return '生成中';
        default: return '处理中';
      }
    }
    if (intent) return `${intent.category}`;
    const currentStep = process?.steps[process.currentStepIndex];
    return currentStep?.title || '处理中';
  };

  return (
    <div className={cn('flex items-center gap-1.5 text-[10px] text-zinc-500', className)}>
      <Loader2 size={10} className="animate-spin text-blue-400" />
      <span>{getStatusText()}</span>
      <span className="text-zinc-600">{(elapsedTime / 1000).toFixed(1)}s</span>
    </div>
  );
};
