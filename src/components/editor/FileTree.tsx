import React, { useState } from 'react';
import { FileNode } from '@/types';
import { Folder, FileText, ChevronRight, ChevronDown, Trash2, Edit2, Plus } from 'lucide-react';
import { useFileStore, useProjectStore } from '@/store';
import { cn } from '@/lib/utils';
import { LongPressMenu } from '@/components/ui/LongPressMenu';

interface FileTreeProps {
  nodes: FileNode[];
  onSelect: (node: FileNode) => void;
  selectedId?: string;
  level?: number;
  showActions?: boolean;
  isMobile?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  onSelect,
  selectedId,
  level = 0,
  showActions = true,
  isMobile = false,
}) => {
  const { toggleFolderExpand } = useFileStore();
  const { renameFile, deleteFile, createFile, createFolder } = useProjectStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');

  const handleDelete = async (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (showActions && window.confirm(`确定要删除 "${node.name}" 吗？`)) {
      await deleteFile(node.id);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    if (newName.trim()) {
      await renameFile(id, newName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCreateNew = async (parentPath: string) => {
    if (!newFileName.trim()) {
      return;
    }

    if (newFileType === 'folder') {
      await createFolder(parentPath, newFileName.trim());
    } else {
      await createFile(parentPath, newFileName.trim());
    }

    setShowNewFileInput(null);
    setNewFileName('');
  };

  const handleAddNew = (e: React.MouseEvent, node: FileNode, type: 'file' | 'folder') => {
    e.stopPropagation();
    setNewFileType(type);
    setShowNewFileInput(node.id);
    setNewFileName('');
  };

  if (nodes.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        文件夹为空
      </div>
    );
  }

  return (
    <div className={cn("w-full h-full overflow-y-auto select-none", isMobile ? "p-3" : "p-1")}>
      {nodes.map((node) => (
        <div key={node.id}>
          <LongPressMenu
            onDelete={() => handleDelete({ stopPropagation: () => {} } as React.MouseEvent, node)}
            onEdit={() => {
              setEditingId(node.id);
              setEditingName(node.name);
            }}
            isMobile={isMobile}
          >
            <div
              className={cn(
                'group flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm transition-all duration-200 relative rounded-lg border',
                selectedId === node.id
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border-transparent'
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (node.type === 'folder') {
                  toggleFolderExpand(node.id);
                } else {
                  onSelect(node);
                }
              }}
            >
              <span
                className="mr-1.5 opacity-70 shrink-0 transition-colors hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.type === 'folder') {
                    toggleFolderExpand(node.id);
                  }
                }}
              >
                {node.type === 'folder' ? (
                  node.isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )
                ) : (
                  <span className="w-3.5 inline-block" />
                )}
              </span>

              <span
                className={cn(
                  'mr-2 shrink-0',
                  node.type === 'folder' ? 'text-blue-400/80' : 'text-zinc-500'
                )}
              >
                {node.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
              </span>

              {editingId === node.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(node.id, editingName)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRename(node.id, editingName);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditingName('');
                    }
                  }}
                  className="flex-1 bg-transparent border-b px-1 py-0.5 text-sm focus:outline-none min-w-0 border-blue-500/50 text-zinc-200"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate flex-1 font-medium glass-text">{node.name}</span>
              )}

              {showActions && !isMobile && (
                <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100">
                  {node.type === 'folder' && (
                    <>
                      <button
                        onClick={(e) => handleAddNew(e, node, 'file')}
                        className="p-1 rounded transition-all hover:bg-white/20 text-zinc-500 hover:text-white"
                        title="新建文件"
                      >
                        <Plus size={12} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(node.id);
                      setEditingName(node.name);
                    }}
                    className="p-1 rounded transition-all hover:bg-white/20 text-zinc-500 hover:text-white"
                    title="重命名"
                  >
                    <Edit2 size={12} />
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, node)}
                    className="p-1 rounded transition-all hover:bg-red-500/20 hover:text-red-500 text-zinc-500"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </LongPressMenu>

          {showNewFileInput === node.id && (
            <div
              className="flex items-center gap-1 mx-1 py-1"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              {newFileType === 'folder' ? (
                <Folder size={16} className="text-blue-400/80" />
              ) : (
                <FileText size={16} className="text-zinc-500" />
              )}
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onBlur={() => {
                  if (newFileName.trim()) {
                    handleCreateNew(node.id);
                  } else {
                    setShowNewFileInput(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFileName.trim()) {
                    handleCreateNew(node.id);
                  } else if (e.key === 'Escape') {
                    setShowNewFileInput(null);
                    setNewFileName('');
                  }
                }}
                placeholder={newFileType === 'folder' ? '文件夹名称' : '文件名.md'}
                className="flex-1 bg-transparent border-b px-1 py-0.5 text-sm focus:outline-none min-w-0 border-blue-500/50 text-zinc-200 placeholder:text-zinc-500"
              />
            </div>
          )}

          {node.type === 'folder' && node.isOpen && node.children && (
            <FileTree
              nodes={node.children}
              onSelect={onSelect}
              selectedId={selectedId}
              level={level + 1}
              showActions={showActions}
              isMobile={isMobile}
            />
          )}
        </div>
      ))}
    </div>
  );
};
