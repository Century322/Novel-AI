import React, { useState, useEffect, useRef } from 'react';
import { useUIStore, useAgentStore, useWorkshopStore, useApiKeyStore } from '@/store';
import { Keyboard, FileText, Download, Upload, RotateCcw, Settings, HardDrive, Key, Eye, EyeOff, Plus, Trash2, Zap, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/services/core/loggerService';
import { PROVIDERS, getProviderConfig } from '@/store/apiKeyStore';
import { AIProvider } from '@/config/providers';

type SettingsCategory = 'general' | 'backup';

interface SettingsPanelProps {
  initialTab?: SettingsCategory;
  isMobile?: boolean;
}

interface ShortcutConfig {
  id: string;
  name: string;
  description: string;
  defaultKey: string;
  key: string;
  category: string;
}

interface EditorConfig {
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  spellCheck: boolean;
  showLineNumbers: boolean;
  highlightCurrentLine: boolean;
}

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  {
    id: 'save',
    name: '保存',
    description: '保存当前文件',
    defaultKey: 'Ctrl+S',
    key: 'Ctrl+S',
    category: '文件',
  },
  {
    id: 'saveAll',
    name: '保存全部',
    description: '保存所有文件',
    defaultKey: 'Ctrl+Shift+S',
    key: 'Ctrl+Shift+S',
    category: '文件',
  },
  {
    id: 'newFile',
    name: '新建文件',
    description: '创建新文件',
    defaultKey: 'Ctrl+N',
    key: 'Ctrl+N',
    category: '文件',
  },
  {
    id: 'openFile',
    name: '打开文件',
    description: '打开文件',
    defaultKey: 'Ctrl+O',
    key: 'Ctrl+O',
    category: '文件',
  },
  {
    id: 'find',
    name: '查找',
    description: '在当前文件中查找',
    defaultKey: 'Ctrl+F',
    key: 'Ctrl+F',
    category: '编辑',
  },
  {
    id: 'replace',
    name: '替换',
    description: '在当前文件中替换',
    defaultKey: 'Ctrl+H',
    key: 'Ctrl+H',
    category: '编辑',
  },
  {
    id: 'undo',
    name: '撤销',
    description: '撤销上一步操作',
    defaultKey: 'Ctrl+Z',
    key: 'Ctrl+Z',
    category: '编辑',
  },
  {
    id: 'redo',
    name: '重做',
    description: '重做上一步操作',
    defaultKey: 'Ctrl+Y',
    key: 'Ctrl+Y',
    category: '编辑',
  },
  {
    id: 'selectAll',
    name: '全选',
    description: '选择全部内容',
    defaultKey: 'Ctrl+A',
    key: 'Ctrl+A',
    category: '编辑',
  },
  {
    id: 'toggleSidebar',
    name: '切换侧边栏',
    description: '显示/隐藏侧边栏',
    defaultKey: 'Ctrl+B',
    key: 'Ctrl+B',
    category: '视图',
  },
  {
    id: 'toggleTerminal',
    name: '切换终端',
    description: '显示/隐藏终端面板',
    defaultKey: 'Ctrl+`',
    key: 'Ctrl+`',
    category: '视图',
  },
  {
    id: 'newChat',
    name: '新对话',
    description: '创建新的AI对话',
    defaultKey: 'Ctrl+Shift+N',
    key: 'Ctrl+Shift+N',
    category: 'AI',
  },
  {
    id: 'sendChat',
    name: '发送消息',
    description: '发送当前消息给AI',
    defaultKey: 'Enter',
    key: 'Enter',
    category: 'AI',
  },
  {
    id: 'newLine',
    name: '换行',
    description: '在输入框中换行',
    defaultKey: 'Shift+Enter',
    key: 'Shift+Enter',
    category: 'AI',
  },
];

const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  fontSize: 14,
  lineHeight: 1.6,
  tabSize: 2,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 3000,
  spellCheck: false,
  showLineNumbers: true,
  highlightCurrentLine: true,
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ initialTab = 'general', isMobile = false }) => {
  const { ragEnabled } = useUIStore();
  const { agentConfig } = useAgentStore();
  const { projectPath } = useWorkshopStore();
  const { keys, addKey, removeKey, toggleKey } = useApiKeyStore();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveCategory(initialTab);
    }
  }, [initialTab]);

  const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);

  const [editorConfig, setEditorConfig] = useState<EditorConfig>(DEFAULT_EDITOR_CONFIG);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyProvider, setNewKeyProvider] = useState<AIProvider>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyBaseUrl, setNewKeyBaseUrl] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const categories: { id: SettingsCategory; icon: React.ReactNode; label: string }[] = isMobile
    ? [{ id: 'general', icon: <Settings size={16} />, label: '常规' }]
    : [
        { id: 'general', icon: <Settings size={16} />, label: '常规' },
        { id: 'backup', icon: <HardDrive size={16} />, label: '备份' },
      ];

  const handleAddKey = async () => {
    if (!newKeyValue.trim()) {
      return;
    }
    await addKey(
      newKeyProvider,
      newKeyValue.trim(),
      newKeyName.trim() || undefined,
      newKeyBaseUrl.trim() || undefined
    );
    setNewKeyValue('');
    setNewKeyName('');
    setNewKeyBaseUrl('');
    setShowAddKey(false);
  };

  const handleResetShortcut = (id: string) => {
    setShortcuts((prev) => prev.map((s) => (s.id === id ? { ...s, key: s.defaultKey } : s)));
  };

  const handleExportSettings = async () => {
    setIsExporting(true);
    try {
      const settings = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        ragEnabled,
        agentConfig,
        shortcuts,
        editorConfig,
      };

      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-novel-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('导出设置失败', { error });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const settings = JSON.parse(text);

      if (settings.shortcuts) {
        setShortcuts(settings.shortcuts);
      }
      if (settings.editorConfig) {
        setEditorConfig(settings.editorConfig);
      }
    } catch (error) {
      logger.error('导入设置失败', { error });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportProject = async () => {
    if (!projectPath) {
      return;
    }

    setIsExporting(true);
    try {
      const projectName = projectPath.split('/').pop() || 'project';
      const projectData = {
        name: projectName,
        path: projectPath,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('导出项目失败', { error });
    } finally {
      setIsExporting(false);
    }
  };

  const renderApiKeySection = () => (
    <div className="rounded-lg border border-white/10 p-3 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-300 shrink-0">
          <Key size={16} />
          <span>API 密钥</span>
        </h4>
        <button
          onClick={() => setShowAddKey(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shrink-0"
        >
          <Plus size={12} />
          <span>添加</span>
        </button>
      </div>

      {showAddKey && (
        <div className="p-3 rounded-lg border border-white/10 space-y-3 bg-[#2a2a2a]">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">平台</label>
            <div className="relative" ref={providerDropdownRef}>
              <button
                type="button"
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] text-zinc-200 text-sm text-left flex items-center justify-between focus:outline-none"
              >
                <span>{getProviderConfig(newKeyProvider)?.name || '选择平台'}</span>
                <ChevronDown size={14} className={cn('transition-transform', showProviderDropdown && 'rotate-180')} />
              </button>
              {showProviderDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg overflow-hidden z-50 shadow-lg">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNewKeyProvider(p.id);
                        setShowProviderDropdown(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                        newKeyProvider === p.id
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-zinc-300 hover:bg-white/5'
                      )}
                    >
                      <span>{p.name}</span>
                      {newKeyProvider === p.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400">名称（可选）</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={getProviderConfig(newKeyProvider)?.name || ''}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400">API 密钥</label>
            <div className="relative">
              <input
                type={showKeyValue ? 'text' : 'password'}
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="输入密钥..."
                className="w-full px-3 py-2 pr-10 rounded-lg border border-white/10 bg-[#1a1a1a] text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKeyValue(!showKeyValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
              >
                {showKeyValue ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {newKeyProvider === 'gateway' && (
            <div className="space-y-2">
              <label className="text-xs text-zinc-400">Base URL（可选）</label>
              <input
                type="text"
                value={newKeyBaseUrl}
                onChange={(e) => setNewKeyBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowAddKey(false)}
              className="flex-1 py-2 rounded-lg text-sm bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddKey}
              disabled={!newKeyValue.trim()}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm transition-colors',
                newKeyValue.trim()
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-white/5 text-zinc-500'
              )}
            >
              添加
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-2 rounded-lg border border-white/10"
            >
              <div className="flex items-center gap-2">
                <Zap size={12} className={key.isEnabled ? 'text-yellow-400' : 'text-zinc-500'} />
                <div>
                  <div className="text-xs text-zinc-300">{key.name}</div>
                  <div className="text-[10px] text-zinc-500">
                    {key.apiKey.slice(0, 8)}...{key.apiKey.slice(-4)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleKey(key.id)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px]',
                    key.isEnabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/5 text-zinc-500'
                  )}
                >
                  {key.isEnabled ? '启用' : '禁用'}
                </button>
                <button
                  onClick={() => removeKey(key.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <Key size={24} className="mx-auto mb-2 text-zinc-600" />
          <p className="text-xs text-zinc-500">添加 API 密钥以使用 AI 模型</p>
        </div>
      )}
    </div>
  );

  const renderModelsSection = () => {
    const enabledKeys = keys.filter((k) => k.isEnabled);
    const totalModels = enabledKeys.reduce((acc, k) => acc + (k.models?.length || 0), 0);

    return (
      <div className="rounded-lg border border-white/10 p-3 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-300">
          <Zap size={16} />
          <span>可用模型</span>
          <span className="text-xs text-zinc-500">({totalModels} 个)</span>
        </h4>

        {enabledKeys.length > 0 ? (
          <div className="space-y-2">
            {enabledKeys.map((key) => (
              <div key={key.id} className="space-y-1">
                <div className="text-xs text-zinc-400 flex items-center gap-1">
                  <Key size={10} className="text-green-400" />
                  {key.name}
                </div>
                {key.models && key.models.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1">
                    {key.models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded bg-white/5 text-xs"
                      >
                        <span className="text-zinc-300 truncate">{model.name}</span>
                        {model.isFree && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">
                            免费
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 px-2">暂无可用模型</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Zap size={24} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-xs text-zinc-500">启用 API 密钥后可查看可用模型</p>
          </div>
        )}
      </div>
    );
  };

  const renderEditorSection = () => (
    <div className="p-4 rounded-lg border border-white/10 space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-300">
        <FileText size={16} />
        编辑器设置
      </h4>

      <div className="space-y-2">
        <label className="text-xs text-zinc-400">字体大小: {editorConfig.fontSize}px</label>
        <input
          type="range"
          min={10}
          max={24}
          value={editorConfig.fontSize}
          onChange={(e) =>
            setEditorConfig((prev) => ({ ...prev, fontSize: parseInt(e.target.value) }))
          }
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-zinc-400">行高: {editorConfig.lineHeight}</label>
        <input
          type="range"
          min={1}
          max={2.5}
          step={0.1}
          value={editorConfig.lineHeight}
          onChange={(e) =>
            setEditorConfig((prev) => ({ ...prev, lineHeight: parseFloat(e.target.value) }))
          }
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Tab 大小: {editorConfig.tabSize}</label>
        <div className="flex gap-2">
          {[2, 4, 8].map((size) => (
            <button
              key={size}
              onClick={() => setEditorConfig((prev) => ({ ...prev, tabSize: size }))}
              className={cn(
                'flex-1 py-1.5 rounded text-xs transition-colors',
                editorConfig.tabSize === size
                  ? 'bg-zinc-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {[
          { key: 'wordWrap', label: '自动换行' },
          { key: 'autoSave', label: '自动保存' },
          { key: 'spellCheck', label: '拼写检查' },
          { key: 'showLineNumbers', label: '显示行号' },
          { key: 'highlightCurrentLine', label: '高亮当前行' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">{item.label}</span>
            <button
              onClick={() =>
                setEditorConfig((prev) => ({
                  ...prev,
                  [item.key]: !prev[item.key as keyof EditorConfig],
                }))
              }
              className={cn(
                'px-2 py-1 rounded text-xs transition-colors',
                editorConfig[item.key as keyof EditorConfig]
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-zinc-400'
              )}
            >
              {editorConfig[item.key as keyof EditorConfig] ? '开' : '关'}
            </button>
          </div>
        ))}
      </div>

      {editorConfig.autoSave && (
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            自动保存延迟: {editorConfig.autoSaveDelay / 1000}秒
          </label>
          <input
            type="range"
            min={1000}
            max={30000}
            step={1000}
            value={editorConfig.autoSaveDelay}
            onChange={(e) =>
              setEditorConfig((prev) => ({ ...prev, autoSaveDelay: parseInt(e.target.value) }))
            }
            className="w-full"
          />
        </div>
      )}
    </div>
  );

  const renderShortcutsSection = () => {
    const groupedShortcuts = shortcuts.reduce(
      (acc, s) => {
        if (!acc[s.category]) {
          acc[s.category] = [];
        }
        acc[s.category].push(s);
        return acc;
      },
      {} as Record<string, ShortcutConfig[]>
    );

    return (
      <div className="p-4 rounded-lg border border-white/10">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-zinc-300">
          <Keyboard size={16} />
          快捷键设置
        </h4>

        <div className="space-y-3">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="space-y-1">
              <h5 className="text-xs font-medium text-zinc-500">{category}</h5>
              <div className="rounded border border-white/10 overflow-hidden">
                {items.map((shortcut, index) => (
                  <div
                    key={shortcut.id}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5',
                      index > 0 && 'border-t border-white/5'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300">{shortcut.name}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingShortcut === shortcut.id ? (
                        <input
                          type="text"
                          value={shortcut.key}
                          onChange={(e) =>
                            setShortcuts((prev) =>
                              prev.map((s) =>
                                s.id === shortcut.id ? { ...s, key: e.target.value } : s
                              )
                            )
                          }
                          onBlur={() => setEditingShortcut(null)}
                          onKeyDown={(e) => {
                            e.preventDefault();
                            const keyParts: string[] = [];
                            if (e.ctrlKey) {
                              keyParts.push('Ctrl');
                            }
                            if (e.shiftKey) {
                              keyParts.push('Shift');
                            }
                            if (e.altKey) {
                              keyParts.push('Alt');
                            }
                            if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                              keyParts.push(e.key.toUpperCase());
                            }
                            if (keyParts.length > 0) {
                              setShortcuts((prev) =>
                                prev.map((s) =>
                                  s.id === shortcut.id ? { ...s, key: keyParts.join('+') } : s
                                )
                              );
                            }
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] w-20 bg-black/20 border border-zinc-600"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setEditingShortcut(shortcut.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 hover:bg-white/10"
                        >
                          {shortcut.key}
                        </button>
                      )}
                      {shortcut.key !== shortcut.defaultKey && (
                        <button
                          onClick={() => handleResetShortcut(shortcut.id)}
                          className="p-0.5 rounded hover:bg-white/5 text-zinc-500"
                          title="重置"
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBackupSection = () => (
    <div className="p-4 rounded-lg border border-white/10 space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-300">
        <Download size={16} />
        备份与恢复
      </h4>

      <div>
        <h5 className="text-xs font-medium mb-2 text-zinc-400">导出设置</h5>
        <p className="text-[10px] mb-2 text-zinc-500">
          将当前设置导出为 JSON 文件，包括快捷键、编辑器配置等。
        </p>
        <button
          onClick={handleExportSettings}
          disabled={isExporting}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors',
            'bg-zinc-600 text-white hover:bg-zinc-500',
            isExporting && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Download size={14} />
          {isExporting ? '导出中...' : '导出设置'}
        </button>
      </div>

      <div className="pt-3 border-t border-white/5">
        <h5 className="text-xs font-medium mb-2 text-zinc-400">导入设置</h5>
        <p className="text-[10px] mb-2 text-zinc-500">从 JSON 文件导入设置，将覆盖当前配置。</p>
        <label className="flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors cursor-pointer bg-white/5 text-zinc-300 hover:bg-white/10">
          <Upload size={14} />
          {isImporting ? '导入中...' : '导入设置'}
          <input
            type="file"
            accept=".json"
            onChange={handleImportSettings}
            className="hidden"
            disabled={isImporting}
          />
        </label>
      </div>

      {projectPath && (
        <div className="pt-3 border-t border-white/5">
          <h5 className="text-xs font-medium mb-2 text-zinc-400">导出项目</h5>
          <p className="text-[10px] mb-2 text-zinc-500">导出当前项目配置和元数据。</p>
          <button
            onClick={handleExportProject}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors',
              'bg-green-600 text-white hover:bg-green-500',
              isExporting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Download size={14} />
            导出项目配置
          </button>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeCategory) {
      case 'general':
        return (
          <div className="space-y-4">
            {renderApiKeySection()}
            {renderEditorSection()}
            {!isMobile && renderShortcutsSection()}
          </div>
        );

      case 'backup':
        return renderBackupSection();

      default:
        return null;
    }
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-transparent overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {renderApiKeySection()}
        {renderModelsSection()}
        {renderEditorSection()}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-32 shrink-0 overflow-y-auto bg-transparent">
          <div className="p-2 space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                  activeCategory === category.id
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:bg-white/5'
                )}
              >
                {category.icon}
                <span className="flex-1 text-left">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      </div>
    </div>
  );
};
