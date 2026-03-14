import React, { useState } from 'react';
import { FileNode } from '@/types';
import { Folder, FileText, ChevronRight, ChevronDown, Trash2, Edit2, Plus, Sparkles, BookOpen, Brain, Settings, Wrench } from 'lucide-react';
import { useFileStore, useProjectStore } from '@/store';
import { cn } from '@/lib/utils';
import { LongPressMenu } from '@/components/ui/LongPressMenu';
import { logger } from '@/services/core/loggerService';

const FOLDER_DISPLAY_NAMES: Record<string, { name: string; icon: React.ReactNode; description: string }> = {
  '.ai-workshop': { name: 'AI工作区', icon: <Settings size={16} className="text-purple-400" />, description: 'AI系统配置和数据' },
  'skills': { name: '技能模板', icon: <Sparkles size={16} className="text-purple-400" />, description: '自定义AI行为模板' },
  'knowledge': { name: '资料库', icon: <BookOpen size={16} className="text-blue-400" />, description: '上传的参考资料' },
  'memory': { name: 'AI记忆', icon: <Brain size={16} className="text-green-400" />, description: 'AI对话记忆存储' },
  'agents': { name: '智能体', icon: <Brain size={16} className="text-orange-400" />, description: 'Agent配置' },
  'tools': { name: '自定义工具', icon: <Wrench size={16} className="text-yellow-400" />, description: '自定义工具配置' },
  'analysis': { name: '项目分析', icon: <Brain size={16} className="text-cyan-400" />, description: '小说分析结果' },
  'chunks': { name: '文本分块', icon: <FileText size={16} className="text-zinc-400" />, description: '资料库分块数据' },
  'files': { name: '原始文件', icon: <FileText size={16} className="text-zinc-400" />, description: '上传的原始文件' },
  'system': { name: '系统预设', icon: <Settings size={16} className="text-zinc-400" />, description: '系统内置配置' },
  'user': { name: '用户创建', icon: <Folder size={16} className="text-blue-400" />, description: '用户自定义内容' },
  'custom': { name: '自定义', icon: <Wrench size={16} className="text-yellow-400" />, description: '用户自定义内容' },
  'works': { name: '作品', icon: <FileText size={16} className="text-amber-400" />, description: '小说作品目录' },
  'outline': { name: '大纲', icon: <FileText size={16} className="text-blue-400" />, description: '小说大纲' },
  'characters': { name: '角色', icon: <Brain size={16} className="text-pink-400" />, description: '角色设定' },
  'chapters': { name: '章节', icon: <FileText size={16} className="text-green-400" />, description: '小说章节' },
  'settings': { name: '设定', icon: <Settings size={16} className="text-cyan-400" />, description: '世界观设定' },
  'world': { name: '世界观', icon: <Brain size={16} className="text-indigo-400" />, description: '世界模型和小说圣经' },
  'styles': { name: '风格配置', icon: <Sparkles size={16} className="text-pink-400" />, description: '写作风格配置' },
  'author': { name: '作者配置', icon: <Brain size={16} className="text-violet-400" />, description: '作者风格学习' },
  'versions': { name: '版本管理', icon: <Settings size={16} className="text-zinc-400" />, description: '版本快照' },
  'backups': { name: '备份', icon: <Settings size={16} className="text-zinc-400" />, description: '项目备份' },
  'snapshots': { name: '快照', icon: <Settings size={16} className="text-zinc-400" />, description: '版本快照存储' },
};

function getFolderDisplayName(name: string): { displayName: string; icon: React.ReactNode; description: string } {
  const folderInfo = FOLDER_DISPLAY_NAMES[name];
  if (folderInfo) {
    return { displayName: folderInfo.name, icon: folderInfo.icon, description: folderInfo.description };
  }
  return { displayName: name, icon: <Folder size={16} className="text-blue-400/80" />, description: '' };
}

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
  const [isCreating, setIsCreating] = useState(false);

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
    if (!newFileName.trim() || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      if (newFileType === 'folder') {
        await createFolder(parentPath, newFileName.trim());
      } else {
        await createFile(parentPath, newFileName.trim());
      }
      setShowNewFileInput(null);
      setNewFileName('');
    } catch (error) {
      logger.error('创建失败', { error });
    } finally {
      setIsCreating(false);
    }
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
                'group flex items-center gap-2 px-2 py-2 sm:py-1.5 cursor-pointer text-sm transition-all duration-200 relative rounded-lg border',
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
                )}
              >
                {node.type === 'folder' 
                  ? getFolderDisplayName(node.name).icon 
                  : <FileText size={16} className="text-zinc-500" />
                }
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
                <div className="flex-1 min-w-0">
                  <span className="truncate font-medium glass-text block">
                    {node.type === 'folder' 
                      ? getFolderDisplayName(node.name).displayName 
                      : node.name
                    }
                  </span>
                  {node.type === 'folder' && getFolderDisplayName(node.name).description && (
                    <span className="text-[10px] text-zinc-500 block truncate">
                      {getFolderDisplayName(node.name).description}
                    </span>
                  )}
                </div>
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
                  if (newFileName.trim() && !isCreating) {
                    handleCreateNew(node.id);
                  } else if (!newFileName.trim()) {
                    setShowNewFileInput(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFileName.trim() && !isCreating) {
                    e.preventDefault();
                    handleCreateNew(node.id);
                  } else if (e.key === 'Escape') {
                    setShowNewFileInput(null);
                    setNewFileName('');
                  }
                }}
                placeholder={newFileType === 'folder' ? '文件夹名称' : '文件名.md'}
                className="flex-1 bg-transparent border-b px-1 py-0.5 text-sm focus:outline-none min-w-0 border-blue-500/50 text-zinc-200 placeholder:text-zinc-500"
                disabled={isCreating}
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
          {node.type === 'folder' && !node.children && (
            <div style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }} className="text-zinc-500 text-xs py-1">
              (空文件夹)
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
