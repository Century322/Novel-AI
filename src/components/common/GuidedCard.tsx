import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  GuidedCard as GuidedCardType,
  GuidedQuestion,
  GuidedOption,
  GuidedAction,
  CreationStage,
  CREATION_STAGES,
} from '@/types/writing/creationFlow';
import { Check, ChevronRight, SkipForward, Lightbulb, X } from 'lucide-react';

interface GuidedCardProps {
  card: GuidedCardType;
  onAction: (actionId: string, data: Record<string, unknown>) => void;
  onDismiss?: () => void;
}

export const GuidedCardComponent: React.FC<GuidedCardProps> = ({ card, onAction, onDismiss }) => {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const handleOptionSelect = (questionId: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: value }));
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleAction = (action: GuidedAction) => {
    onAction(action.action, { ...answers, ...selectedOptions });
  };

  const renderQuestion = (question: GuidedQuestion) => {
    switch (question.type) {
      case 'choice':
        return (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {question.options?.map((option: GuidedOption) => (
                <button
                  key={option.value}
                  onClick={() => handleOptionSelect(question.id, option.value)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    selectedOptions[question.id] === option.value
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-white/10 hover:border-white/20 text-zinc-400'
                  )}
                >
                  {option.icon && <span className="mr-2">{option.icon}</span>}
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <p className="text-xs mt-1 text-zinc-500">{option.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 'multiselect':
        return (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">{question.question}</p>
            <div className="flex flex-wrap gap-2">
              {question.options?.map((option: GuidedOption) => {
                const currentValues = (answers[question.id] as string[]) || [];
                const isSelected = currentValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      const newValues = isSelected
                        ? currentValues.filter((v) => v !== option.value)
                        : [...currentValues, option.value];
                      setAnswers((prev) => ({ ...prev, [question.id]: newValues }));
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm transition-all',
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'number':
        return (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </p>
            <input
              type="number"
              placeholder={question.placeholder}
              onChange={(e) => handleTextChange(question.id, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm bg-black/20 border-white/10 text-zinc-200"
            />
          </div>
        );

      case 'text':
      default:
        return (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </p>
            <textarea
              placeholder={question.placeholder}
              rows={2}
              onChange={(e) => handleTextChange(question.id, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none bg-black/20 border-white/10 text-zinc-200 placeholder-zinc-500"
            />
            {question.helpText && <p className="text-xs text-zinc-500">💡 {question.helpText}</p>}
          </div>
        );
    }
  };

  const renderProgress = () => {
    const stages = card.data?.stages as
      | Array<{
          name: string;
          icon: string;
          status: string;
        }>
      | undefined;

    if (!stages) {
      return null;
    }

    return (
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg',
              stage.status === 'in_progress' && 'bg-blue-500/10',
              stage.status === 'completed' && 'bg-green-500/10',
              stage.status === 'locked' && 'opacity-50'
            )}
          >
            <span className="text-lg">{stage.icon}</span>
            <span className="flex-1 text-sm text-zinc-300">{stage.name}</span>
            {stage.status === 'completed' && <Check size={16} className="text-green-500" />}
            {stage.status === 'in_progress' && <ChevronRight size={16} className="text-blue-500" />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl border shadow-lg overflow-hidden bg-zinc-900 border-white/10">
      <div className="px-4 py-3 border-b flex items-center justify-between border-white/10 bg-black/20">
        <h3 className="font-medium text-zinc-200">{card.title}</h3>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded transition-colors hover:bg-white/10 text-zinc-500"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {card.content && <p className="text-sm text-zinc-400">{card.content}</p>}

        {card.type === 'progress' && renderProgress()}

        {card.questions?.map(renderQuestion)}

        {card.type === 'suggestion' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10">
            <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">{card.content}</p>
          </div>
        )}
      </div>

      {card.actions && card.actions.length > 0 && (
        <div className="px-4 py-3 border-t flex justify-end gap-2 border-white/10 bg-black/20">
          {card.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                action.type === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
                action.type === 'secondary' && 'bg-white/10 text-zinc-400 hover:bg-white/20',
                action.type === 'danger' && 'bg-red-500 text-white hover:bg-red-600'
              )}
            >
              {action.action === 'skip' && <SkipForward size={14} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface CreationProgressIndicatorProps {
  currentStage: CreationStage;
  percentage: number;
}

export const CreationProgressIndicator: React.FC<CreationProgressIndicatorProps> = ({
  currentStage,
  percentage,
}) => {
  const stages = Object.entries(CREATION_STAGES)
    .filter(([key]) => key !== 'complete')
    .map(([key, stage]) => ({
      key: key as CreationStage,
      name: stage.name,
      icon: stage.icon,
    }));

  return (
    <div className="px-3 py-2 rounded-lg bg-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400">创作进度</span>
        <span className="text-xs text-zinc-500">{percentage}%</span>
      </div>

      <div className="flex items-center gap-1">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.key}>
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                stage.key === currentStage
                  ? 'bg-blue-500 text-white'
                  : index < stages.findIndex((s) => s.key === currentStage)
                    ? 'bg-green-500 text-white'
                    : 'bg-white/10 text-zinc-500'
              )}
              title={stage.name}
            >
              {stage.icon}
            </div>
            {index < stages.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5',
                  index < stages.findIndex((s) => s.key === currentStage)
                    ? 'bg-green-500'
                    : 'bg-white/10'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
