import React from 'react';
import {
  useAgentStore,
} from '@/store';
import { PanelLeft, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SimpleProgressIndicator } from '@/components/common/SimpleProgressIndicator';
import { useWorkshopStore } from '@/store/workshopStore';

interface TopToolbarProps {
  isSessionListOpen: boolean;
  onToggleSessionList: () => void;
  useAgent?: boolean;
  onToggleAgent?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  isSessionListOpen,
  onToggleSessionList,
  useAgent = true,
  onToggleAgent,
}) => {
  const { isProcessing } = useAgentStore();
  const { currentStage } = useWorkshopStore();

  return (
    <div className="flex items-center justify-between w-full px-3">
      <div className="flex items-center gap-2">
        {!isSessionListOpen && onToggleAgent && (
          <button
            onClick={onToggleAgent}
            disabled={isProcessing}
            className={cn(
              'relative flex items-center h-7 rounded border transition-colors duration-300 overflow-visible',
              useAgent ? 'bg-green-900/25 border-green-900/20' : 'border-zinc-600',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
            style={{ width: '84px' }}
            title={
              isProcessing
                ? 'AI 生成中，无法切换模式'
                : useAgent
                  ? 'Agent 模式已开启'
                  : 'Agent 模式已关闭'
            }
          >
            <div
              className={cn(
                'absolute top-0 bottom-0 w-7 flex items-center justify-center bg-gradient-to-b from-white to-zinc-100 rounded shadow-md transition-all duration-300 ease-in-out z-10',
                useAgent ? 'left-[54px]' : 'left-0'
              )}
            >
              <Bot size={18} className="text-zinc-700" strokeWidth={2.5} />
            </div>

            <span
              className={cn(
                'absolute top-0 bottom-0 left-0 w-[54px] flex items-center justify-center text-xs font-medium transition-all duration-300',
                useAgent
                  ? 'text-green-300 opacity-100 drop-shadow-[0_0_4px_rgba(74,222,128,0.3)]'
                  : 'opacity-0'
              )}
            >
              Agent
            </span>

            <span
              className={cn(
                'absolute top-0 bottom-0 right-0 w-[54px] flex items-center justify-center text-xs font-medium transition-all duration-300',
                useAgent ? 'opacity-0' : 'text-zinc-400 opacity-100'
              )}
            >
              普通
            </span>
          </button>
        )}

        {!isSessionListOpen && (
          <button
            onClick={onToggleSessionList}
            className="p-1.5 rounded transition-colors shrink-0 hover:bg-white/5 text-zinc-400"
            title="展开会话列表"
          >
            <PanelLeft size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SimpleProgressIndicator currentStage={currentStage} />
      </div>
    </div>
  );
};
