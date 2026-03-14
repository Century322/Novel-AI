import React, { useState, useEffect } from 'react';
import { useFileStore, useTabStore, useProjectStore } from '@/store';
import { FileTree } from './FileTree';
import { useFileTreeFromProject } from '@/store/fileStore';
import { cn } from '@/lib/utils';
import { FileNode } from '@/types/core/types';
import { FileText, FolderOpen, RefreshCw, Download, Upload, PanelRight } from 'lucide-react';
import { logger } from '@/services/core/loggerService';

interface FileTreePanelProps {
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export const FileTreePanel: React.FC<FileTreePanelProps> = ({ width, onDragStart, isMobile = false, onClose }) => {
  const { selectedFileId, selectFile } = useFileStore();
  const { openTab, getTabByFileId, setActiveTab } = useTabStore();
  const { createFile, createFolder, init, refreshFileTree, exportAll, importFiles } = useProjectStore();
  const fileNodes = useFileTreeFromProject();
  const [showNewInput, setShowNewInput] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
  }, [init]);

  const filteredFileNodes: FileNode[] = fileNodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    isOpen: node.isOpen,
    children: node.children,
  }));

  const handleFileSelect = async (node: FileNode) => {
    if (node.type === 'file') {
      selectFile(node.id, node.id);
      const existingTab = getTabByFileId(node.id);
      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        openTab({
          type: 'file',
          title: node.name,
          fileId: node.id,
        });
      }
    }
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) {
      setShowNewInput(null);
      return;
    }

    const nameToCreate = newName.trim();
    setShowNewInput(null);
    setNewName('');

    try {
      if (showNewInput === 'folder') {
        await createFolder('', nameToCreate);
      } else {
        await createFile('', nameToCreate);
      }
      await refreshFileTree();
    } catch (error) {
      logger.error('创建失败', { error });
    }
  };

  return (
    <div
      className={cn('flex flex-col h-full shrink-0 relative')}
      style={{ width: `${width}px` }}
    >
      <div className="flex flex-col h-full bg-white/5">
        <div className={cn("shrink-0 flex items-center justify-between gap-2", isMobile ? "p-3 pb-0" : "px-3 h-10 border-b border-white/5")}>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
              title="收起文件树"
            >
              <PanelRight size={18} />
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => refreshFileTree()}
              className={cn("rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400", isMobile ? "p-2" : "p-1.5")}
              title="刷新"
            >
              <RefreshCw size={isMobile ? 18 : 14} />
            </button>
            <button
              onClick={async () => {
                const blob = await exportAll();
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `project_${Date.now()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }}
              className={cn("rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400", isMobile ? "p-2" : "p-1.5")}
              title="导出"
            >
              <Download size={isMobile ? 18 : 14} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn("rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400", isMobile ? "p-2" : "p-1.5")}
              title="导入"
            >
              <Upload size={isMobile ? 18 : 14} />
            </button>
            <button
              onClick={() => {
                setShowNewInput('file');
              }}
              className={cn("rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400", isMobile ? "p-2" : "p-1.5")}
              title="新建文件"
            >
              <FileText size={isMobile ? 18 : 14} />
            </button>
            <button
              onClick={() => {
                setShowNewInput('folder');
              }}
              className={cn("rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400", isMobile ? "p-2" : "p-1.5")}
              title="新建文件夹"
            >
              <FolderOpen size={isMobile ? 18 : 14} />
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.md,.txt"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              await importFiles(files);
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
        />
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {showNewInput && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 shrink-0">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  if (newName.trim()) {
                    handleCreateNew();
                  } else {
                    setShowNewInput(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    handleCreateNew();
                  } else if (e.key === 'Escape') {
                    setShowNewInput(null);
                    setNewName('');
                  }
                }}
                placeholder={showNewInput === 'folder' ? '文件夹名称' : '文件名.md'}
                className="flex-1 bg-transparent border border-white/20 rounded px-2 py-1 text-sm focus:outline-none text-zinc-200 placeholder:text-zinc-500"
              />
            </div>
          )}

          <div className="flex-1 min-h-0">
            <FileTree
              nodes={filteredFileNodes}
              onSelect={handleFileSelect}
              selectedId={selectedFileId || undefined}
              isMobile={isMobile}
            />
          </div>
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
          onMouseDown={onDragStart}
        />
      </div>
    </div>
  );
};
