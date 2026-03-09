import React, { useEffect, useState } from 'react';
import { useTabStore, useProjectStore } from '@/store';
import { FileContentPanel } from '@/components/editor/FileContentPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { FileText } from 'lucide-react';
import { FileNode } from '@/types';
import { logger } from '@/services/core/loggerService';

interface MainContentProps {
  showSettingsPanel: boolean;
  settingsInitialTab?: 'general' | 'backup';
  activeTabOverride?: {
    id: string;
    type: string;
    title: string;
    path?: string;
    fileId?: string;
  } | null;
}

export const MainContent: React.FC<MainContentProps> = ({
  showSettingsPanel,
  settingsInitialTab,
  activeTabOverride,
}) => {
  const { getActiveTab } = useTabStore();
  const { getFileContent, saveFileContent } = useProjectStore();

  const [isEditMode, setIsEditMode] = React.useState(true);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const storeTab = getActiveTab();
  const activeTab = activeTabOverride || storeTab;

  useEffect(() => {
    const loadFileContent = async () => {
      if (activeTab?.type === 'file' && activeTab.fileId) {
        setIsLoading(true);
        try {
          const content = await getFileContent(activeTab.fileId);
          setFileContent(content);
        } catch (e) {
          logger.error('加载文件失败', { error: e });
          setFileContent('');
        }
        setIsLoading(false);
      }
    };
    loadFileContent();
  }, [activeTab?.fileId, activeTab?.type, getFileContent]);

  if (showSettingsPanel) {
    return <SettingsPanel initialTab={settingsInitialTab} />;
  }

  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#1a1a1a] text-zinc-500 min-h-0">
        <FileText size={48} className="opacity-30" />
        <div className="text-center">
          <p className="text-sm">选择一个文件或创建新标签页开始</p>
          <p className="text-xs mt-1 opacity-60">点击右侧文件树中的文件打开</p>
        </div>
      </div>
    );
  }

  if (activeTab.type === 'terminal') {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TerminalPanel />
      </div>
    );
  }

  if (activeTab.type === 'file') {
    const wordCount = fileContent?.length || 0;

    const activeFile: FileNode | null = activeTab.fileId
      ? {
          id: activeTab.fileId,
          name: activeTab.title,
          type: 'file',
          content: fileContent,
        }
      : null;

    return (
      <FileContentPanel
        showFileContent={!!activeFile && !isLoading}
        activeFile={activeFile}
        wordCount={wordCount}
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onContentChange={async (e) => {
          const newContent = e.target.value;
          setFileContent(newContent);
          if (activeTab.fileId) {
            await saveFileContent(activeTab.fileId, newContent);
          }
        }}
      />
    );
  }

  return null;
};
