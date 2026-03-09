import React, { useEffect, useState } from 'react';
import {
  ThinkingStep,
  ThinkingProcess,
  THINKING_STEP_CONFIG,
  ThinkingStepType,
} from '@/types/ai/thinkingProcess';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ThinkingProcessViewerProps {
  process: ThinkingProcess | null;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const ThinkingProcessViewer: React.FC<ThinkingProcessViewerProps> = ({
  process,
  className,
  expanded = true,
  onToggleExpand,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!process || process.endTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - process.startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [process]);

  if (!process || process.steps.length === 0) {
    return null;
  }

  const currentStep = process.steps[process.currentStepIndex];
  const completedSteps = process.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = process.steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div
      className={cn('rounded-lg border border-white/10 bg-zinc-900/50 overflow-hidden', className)}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-xs font-medium text-zinc-300">AI 思考过程</span>
          {currentStep && currentStep.status === 'running' && (
            <div className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin text-blue-400" />
              <span className="text-xs text-blue-400">{currentStep.title}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500">
            {completedSteps}/{totalSteps}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <Clock size={10} />
            <span>
              {process.endTime
                ? `${((process.endTime - process.startTime) / 1000).toFixed(1)}s`
                : `${(elapsedTime / 1000).toFixed(1)}s`}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {process.steps.map((step, index) => (
            <ThinkingStepItem
              key={step.id}
              step={step}
              isCurrent={index === process.currentStepIndex}
              isLast={index === process.steps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ThinkingStepItemProps {
  step: ThinkingStep;
  isCurrent: boolean;
  isLast: boolean;
}

const ThinkingStepItem: React.FC<ThinkingStepItemProps> = ({ step, isCurrent, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const config = THINKING_STEP_CONFIG[step.type];

  const statusIcon = () => {
    switch (step.status) {
      case 'pending':
        return <div className="w-3 h-3 rounded-full border border-zinc-600" />;
      case 'running':
        return <Loader2 size={12} className="animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle2 size={12} className="text-green-500" />;
      case 'error':
        return <XCircle size={12} className="text-red-500" />;
    }
  };

  return (
    <div className="relative">
      {!isLast && (
        <div
          className={cn(
            'absolute left-[5px] top-6 w-px h-full',
            step.status === 'completed' ? 'bg-green-500/30' : 'bg-zinc-700'
          )}
        />
      )}

      <div
        className={cn(
          'flex items-start gap-2 py-1.5',
          isCurrent && 'bg-white/5 -mx-2 px-2 rounded'
        )}
      >
        <div className="flex items-center justify-center w-3 shrink-0 mt-0.5">{statusIcon()}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">{config.icon}</span>
            <span className={cn('text-xs font-medium', config.color)}>{step.title}</span>
            {step.duration && <span className="text-[10px] text-zinc-500">{step.duration}ms</span>}
          </div>

          {step.description && (
            <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{step.description}</p>
          )}

          {step.details && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400 hover:text-zinc-300"
            >
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span>详情</span>
            </button>
          )}

          {expanded && step.details && (
            <div className="mt-1.5 p-2 rounded bg-black/30 text-[10px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto">
              {step.details}
            </div>
          )}

          {step.subSteps && step.subSteps.length > 0 && (
            <div className="mt-1 ml-4 space-y-0.5">
              {step.subSteps.map((subStep, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <span>{THINKING_STEP_CONFIG[subStep.type as ThinkingStepType]?.icon || '•'}</span>
                  <span>{subStep.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ThinkingProcessCompactProps {
  process: ThinkingProcess | null;
  className?: string;
}

export const ThinkingProcessCompact: React.FC<ThinkingProcessCompactProps> = ({
  process,
  className,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!process || process.endTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - process.startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [process]);

  if (!process || process.steps.length === 0) {
    return null;
  }

  const currentStep = process.steps[process.currentStepIndex];
  const config = currentStep ? THINKING_STEP_CONFIG[currentStep.type] : null;

  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/50', className)}>
      <Loader2 size={12} className="animate-spin text-blue-400" />
      <span className="text-sm">{config?.icon || '🤔'}</span>
      <span className="text-xs text-zinc-300">{currentStep?.title || '处理中...'}</span>
      {currentStep?.description && (
        <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
          {currentStep.description}
        </span>
      )}
      <span className="text-[10px] text-zinc-500 ml-auto">{(elapsedTime / 1000).toFixed(1)}s</span>
    </div>
  );
};
