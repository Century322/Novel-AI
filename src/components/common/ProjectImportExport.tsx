import React, { useState, useRef } from 'react';
import { Download, Upload, FolderOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fileSystemService, getStorageModeName } from '@/services/core/fileSystemService';
import { browserCapabilities } from '@/services/web/browserDetect';
import { logger } from '@/services/core/loggerService';

interface ProjectImportExportProps {
  className?: string;
  onProjectChange?: () => void;
}

export const ProjectImportExport: React.FC<ProjectImportExportProps> = ({
  className,
  onProjectChange,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageMode = fileSystemService.getStorageMode();
  const isIndexedDB = storageMode === 'indexeddb';
  const supportsFileSystem = browserCapabilities.supportsFileSystemAccess;

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const blob = await fileSystemService.exportProject();
      if (!blob) {
        setMessage({ type: 'error', text: '导出失败：没有可导出的项目' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: '项目已成功导出' });
      logger.info('项目导出成功');
    } catch (error) {
      setMessage({ type: 'error', text: `导出失败：${error}` });
      logger.error('项目导出失败', { error });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setMessage(null);

    try {
      const projectId = await fileSystemService.importProject(file);
      if (!projectId) {
        setMessage({ type: 'error', text: '导入失败：无法解析项目文件' });
        return;
      }

      setMessage({ type: 'success', text: '项目已成功导入' });
      logger.info('项目导入成功', { projectId });
      onProjectChange?.();
    } catch (error) {
      setMessage({ type: 'error', text: `导入失败：${error}` });
      logger.error('项目导入失败', { error });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenFolder = async () => {
    try {
      const path = await fileSystemService.openProjectDialog();
      if (path) {
        setMessage({ type: 'success', text: `已打开项目: ${path}` });
        onProjectChange?.();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `打开项目失败：${error}` });
      logger.error('打开项目失败', { error });
    }
  };

  return (
    <div className={`p-4 rounded-lg bg-zinc-800/50 ${className || ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">项目管理</h3>
        <span className="text-xs text-zinc-500">存储模式: {getStorageModeName()}</span>
      </div>

      <div className="space-y-3">
        {supportsFileSystem && (
          <button
            onClick={handleOpenFolder}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            <FolderOpen size={16} />
            <span>打开本地文件夹</span>
          </button>
        )}

        {isIndexedDB && (
          <>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  <span>导出中...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>导出项目</span>
                </>
              )}
            </button>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="project-import"
              />
              <label
                htmlFor="project-import"
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors cursor-pointer ${
                  isImporting ? 'opacity-50' : ''
                }`}
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>导入项目</span>
                  </>
                )}
              </label>
            </div>
          </>
        )}

        {message && (
          <div
            className={`flex items-center gap-2 p-2 rounded text-xs ${
              message.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{message.text}</span>
          </div>
        )}

        {isIndexedDB && !supportsFileSystem && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">提示</p>
                <p>
                  当前浏览器不支持直接访问本地文件系统。项目数据存储在浏览器中，可以通过导出功能保存到本地文件。
                </p>
                <p className="mt-2">推荐使用 Chrome 或 Edge 浏览器以获得最佳体验。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectImportExport;
