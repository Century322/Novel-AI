import React, { useState, useEffect } from 'react';
import {
  useTaskStore,
  useNotificationStore,
  useUIStore,
  useAgentStore,
  useApiKeyStore,
  useFileStore,
  useProjectStore,
} from '@/store';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Bell,
  X,
  Bot,
  Database,
  Wifi,
  WifiOff,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const StatusBar: React.FC = () => {
  const { ragEnabled, toggleRag } = useUIStore();
  const { tasks } = useTaskStore();
  const { notifications, removeNotification } = useNotificationStore();
  const { agentConfig, setAgentConfig } = useAgentStore();
  const { keys, selectedKeyId, selectedModelId } = useApiKeyStore();
  const { selectedFilePath } = useFileStore();
  const { getFileContent } = useProjectStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState<string | null>(null);

  const runningTasks = tasks.filter((t) => t.status === 'processing' || t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed');
  const unreadNotifications = notifications.filter((n) => !n.read);

  const currentTask = runningTasks[0];

  const selectedKey = keys.find((k) => k.id === selectedKeyId);
  const selectedModel = selectedKey?.models?.find((m) => m.id === selectedModelId);
  const currentModel = selectedModel?.name || selectedKey?.name || '未选择模型';

  const hasValidKey = selectedKey?.isValid && selectedKey?.apiKey;

  useEffect(() => {
    const loadFileInfo = async () => {
      if (selectedFilePath) {
        const fileName = selectedFilePath.split('/').pop() || selectedFilePath;
        setCurrentFileName(fileName);
        const content = await getFileContent(selectedFilePath);
        setCurrentFileContent(content);
      } else {
        setCurrentFileName(null);
        setCurrentFileContent(null);
      }
    };
    loadFileInfo();
  }, [selectedFilePath, getFileContent]);

  return (
    <div className="h-6 flex items-center justify-between px-3 border-t shrink-0 text-xs bg-[#242424] border-white/10 text-zinc-400">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {hasValidKey ? (
            <Wifi size={12} className="text-green-500" />
          ) : (
            <WifiOff size={12} className="text-red-500" />
          )}
          <span className={hasValidKey ? 'text-green-500' : 'text-red-500'}>
            {hasValidKey ? '已配置' : '未配置'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="opacity-60">模型:</span>
          <span className="font-medium text-zinc-300">{currentModel}</span>
        </div>

        {currentFileName && (
          <div className="flex items-center gap-1">
            <FileText size={12} />
            <span className="truncate max-w-[150px] text-zinc-300">{currentFileName}</span>
            {currentFileContent && (
              <span className="opacity-60">{currentFileContent.length} 字</span>
            )}
          </div>
        )}

        {currentTask ? (
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-blue-500" />
            <span>{currentTask.message}</span>
          </div>
        ) : (
          completedTasks.length === 0 &&
          failedTasks.length === 0 && <span className="opacity-50">就绪</span>
        )}

        {completedTasks.length > 0 && (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle2 size={12} />
            <span>{completedTasks.length} 完成</span>
          </div>
        )}

        {failedTasks.length > 0 && (
          <div className="flex items-center gap-1 text-red-500">
            <XCircle size={12} />
            <span>{failedTasks.length} 失败</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleRag}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded transition-colors',
            ragEnabled ? 'text-blue-500' : 'hover:bg-white/10'
          )}
        >
          <Database size={12} />
          <span>RAG</span>
          {ragEnabled && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </button>

        <button
          onClick={() => setAgentConfig({ ...agentConfig, enabled: !agentConfig?.enabled })}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded transition-colors',
            agentConfig?.enabled ? 'text-purple-500' : 'hover:bg-white/10'
          )}
        >
          <Bot size={12} />
          <span>智能体</span>
          {agentConfig?.enabled && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors relative hover:bg-white/10"
          >
            <Bell size={12} />
            <span>通知</span>
            {unreadNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {unreadNotifications.length}
              </span>
            )}
          </button>

          {showNotifications && notifications.length > 0 && (
            <div className="absolute bottom-full right-0 mb-1 w-64 rounded-lg border shadow-lg z-50 max-h-48 overflow-y-auto bg-zinc-900 border-white/10">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between p-2 border-b last:border-b-0 border-white/5"
                >
                  <div className="flex-1">
                    <div className="text-xs font-medium text-zinc-300">{notification.title}</div>
                    <div className="text-[10px] text-zinc-500">{notification.message}</div>
                  </div>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="p-0.5 hover:bg-black/10 rounded"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
