import React from 'react';
import { cn } from '@/lib/utils';
import {
  CREATION_STAGES,
  CreationStage,
} from '@/types/writing/creationFlow';

interface SimpleProgressIndicatorProps {
  currentStage: CreationStage;
}

export const SimpleProgressIndicator: React.FC<SimpleProgressIndicatorProps> = ({
  currentStage,
}) => {
  const stages = Object.entries(CREATION_STAGES)
    .filter(([key]) => key !== 'complete')
    .map(([key, stage]) => ({
      key: key as CreationStage,
      icon: stage.icon,
    }));

  const currentIndex = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-0.5">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.key}>
          <div
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors',
              index === currentIndex
                ? 'bg-blue-500 text-white'
                : index < currentIndex
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-zinc-500'
            )}
            title={`${CREATION_STAGES[stage.key].name} ${index < currentIndex ? '(已完成)' : index === currentIndex ? '(进行中)' : ''}`}
          >
            {stage.icon}
          </div>
          {index < stages.length - 1 && (
            <div
              className={cn(
                'w-3 h-0.5 transition-colors',
                index < currentIndex ? 'bg-green-500' : 'bg-white/10'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
