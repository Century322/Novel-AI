import React, { useState, useEffect } from 'react';
import { MessageCircle, AlertTriangle, Lightbulb, CheckCircle, Clock, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AgentInteraction,
  InteractionType,
  InteractionPriority,
} from '@/services/agent/agentInteractionService';

interface InteractionCardProps {
  interaction: AgentInteraction;
  onRespond: (interactionId: string, response: string) => void;
  onSkip: (interactionId: string) => void;
  onDismiss: (interactionId: string) => void;
}

const typeIcons: Record<InteractionType, React.ReactNode> = {
  question: <MessageCircle size={20} />,
  suggestion: <Lightbulb size={20} />,
  confirmation: <CheckCircle size={20} />,
  reminder: <Clock size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <MessageCircle size={20} />,
};

const typeColors: Record<InteractionType, string> = {
  question: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  suggestion: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmation: 'text-green-400 bg-green-500/10 border-green-500/20',
  reminder: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  warning: 'text-red-400 bg-red-500/10 border-red-500/20',
  info: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

const priorityBorders: Record<InteractionPriority, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  normal: 'border-l-blue-500',
  low: 'border-l-zinc-500',
};

export const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  onRespond,
  onSkip,
  onDismiss,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const defaultOption = interaction.options?.find((o) => o.isDefault);
    if (defaultOption) {
      setSelectedOption(defaultOption.value);
    }
  }, [interaction.options]);

  const handleSubmit = () => {
    const response = customInput.trim() || selectedOption;
    if (response) {
      onRespond(interaction.id, response);
    }
  };

  const handleSkip = () => {
    onSkip(interaction.id);
  };

  const handleDismiss = () => {
    onDismiss(interaction.id);
  };

  const icon = typeIcons[interaction.type];
  const colorClass = typeColors[interaction.type];
  const borderClass = priorityBorders[interaction.priority];

  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 transition-all duration-200',
        colorClass,
        borderClass,
        !isExpanded && 'h-12 overflow-hidden'
      )}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', colorClass.split(' ')[1])}>{icon}</div>
          <div>
            <h4 className="font-medium text-white">{interaction.title}</h4>
            {!isExpanded && (
              <p className="text-xs text-zinc-400 truncate max-w-xs">
                {interaction.message.substring(0, 50)}...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {interaction.priority === 'urgent' && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">紧急</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          <p className="text-sm text-zinc-300 mb-4">{interaction.message}</p>

          {interaction.options && interaction.options.length > 0 && (
            <div className="space-y-2 mb-4">
              {interaction.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.value)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                    selectedOption === option.value
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-zinc-500">{option.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {interaction.allowCustomInput && (
            <div className="mb-4">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={interaction.placeholder || '输入你的回答...'}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              跳过
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                忽略
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedOption && !customInput.trim()}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                  selectedOption || customInput.trim()
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-white/5 text-zinc-500 cursor-not-allowed'
                )}
              >
                <Send size={14} />
                <span>确认</span>
              </button>
            </div>
          </div>

          {interaction.context && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                {interaction.context.chapter && <span>第 {interaction.context.chapter} 章</span>}
                {interaction.context.character && (
                  <span>人物: {interaction.context.character}</span>
                )}
                {interaction.context.setting && <span>设定: {interaction.context.setting}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface InteractionPanelProps {
  interactions: AgentInteraction[];
  onRespond: (interactionId: string, response: string) => void;
  onSkip: (interactionId: string) => void;
  onDismiss: (interactionId: string) => void;
}

export const InteractionPanel: React.FC<InteractionPanelProps> = ({
  interactions,
  onRespond,
  onSkip,
  onDismiss,
}) => {
  if (interactions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">需要你的确认 ({interactions.length})</h3>
      </div>
      {interactions.map((interaction) => (
        <InteractionCard
          key={interaction.id}
          interaction={interaction}
          onRespond={onRespond}
          onSkip={onSkip}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

export default InteractionCard;
