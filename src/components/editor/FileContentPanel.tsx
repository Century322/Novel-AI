import React from 'react';
import { FileText, Edit3, Eye, FolderOpen } from 'lucide-react';
import Markdown from 'react-markdown';
import { FileNode } from '@/types';

interface FileContentPanelProps {
  showFileContent: boolean;
  activeFile: FileNode | null;
  wordCount: number;
  isEditMode: boolean;
  isMobile?: boolean;
  onBackToFileList?: () => void;
  onToggleEditMode: () => void;
  onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function FileContentPanel({
  showFileContent,
  activeFile,
  wordCount,
  isEditMode,
  isMobile = false,
  onBackToFileList,
  onToggleEditMode,
  onContentChange,
}: FileContentPanelProps) {
  if (showFileContent && activeFile) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#1a1a1a]">
        <div className="h-12 border-b flex items-center justify-between px-4 bg-transparent shrink-0 border-white/5">
          <div className="flex items-center gap-2 overflow-hidden group">
            {isMobile && onBackToFileList && (
              <button
                onClick={onBackToFileList}
                className="p-1 rounded md:hidden hover:bg-white/10"
              >
                <FolderOpen size={16} />
              </button>
            )}
            <FileText size={16} className="shrink-0 transition-colors text-blue-400/70" />
            <span className="font-medium text-sm truncate glass-text text-zinc-200">
              {activeFile.name}
            </span>
            <span className="text-[10px] font-mono shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-zinc-600 bg-white/5">
              {wordCount} 字
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onToggleEditMode}
              className="p-1.5 rounded transition-colors hover:bg-white/10 text-zinc-400 hover:text-blue-400"
              title={isEditMode ? '预览模式' : '编辑模式'}
            >
              {isEditMode ? <Eye size={16} /> : <Edit3 size={16} />}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 w-full">
          {isEditMode ? (
            <textarea
              className="w-full h-full bg-transparent border-none resize-none focus:outline-none leading-relaxed font-mono text-base selection:bg-blue-500/30 text-zinc-300 placeholder-zinc-600 overflow-y-auto"
              value={activeFile.content || ''}
              onChange={onContentChange}
              placeholder="开始写作..."
              spellCheck={false}
            />
          ) : (
            <div className="h-full overflow-y-auto prose max-w-none px-1 prose-invert prose-zinc text-zinc-300">
              <Markdown>{activeFile.content || ''}</Markdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#1a1a1a]">
      <div className="h-12 border-b flex items-center px-4 bg-transparent shrink-0 border-white/5">
        <FolderOpen size={16} className="mr-2 text-blue-400/70" />
        <span className="font-medium text-sm glass-text text-zinc-200">文件浏览</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 no-scrollbar min-h-0">
        <div className="h-full flex flex-col items-center justify-center text-sm opacity-50 text-zinc-400">
          <FileText size={32} className="mb-2 opacity-30" />
          <p>选择左侧文件打开</p>
        </div>
      </div>
    </div>
  );
}
