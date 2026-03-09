import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApiKeyStore, getProviderConfig, PROVIDERS } from '@/store/apiKeyStore';
import { ChevronDown, Check, Plus, Key, Trash2, Eye, EyeOff, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIProvider } from '@/config/providers';

interface ModelSelectorProps {
  className?: string;
  onOpenSettings?: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ className, onOpenSettings }) => {
  const {
    keys,
    selectedKeyId,
    selectedModelId,
    setSelectedModel,
    getCurrentConfig,
    addKey,
    removeKey,
    toggleKey,
  } = useApiKeyStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [newKeyProvider, setNewKeyProvider] = useState<AIProvider>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyBaseUrl, setNewKeyBaseUrl] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);

  const currentConfig = getCurrentConfig();

  const hasKeys = keys.length > 0;

  const handleButtonClick = () => {
    if (!hasKeys && onOpenSettings) {
      onOpenSettings();
      return;
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        zIndex: 99999,
        maxWidth: '320px',
        width: 'max-content',
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowAddKey(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectModel = (keyId: string, modelId: string) => {
    setSelectedModel(keyId, modelId);
    setIsOpen(false);
  };

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

  const enabledKeys = keys.filter((k) => k.isEnabled);
  const totalModels = enabledKeys.reduce((acc, k) => acc + (k.models?.length || 0), 0);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        type="button"
        className={cn(
          'text-xs flex items-center gap-1 transition-colors',
          currentConfig ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-zinc-300',
          className
        )}
      >
        <Zap size={12} className={currentConfig ? 'text-yellow-400' : ''} />
        <span className="truncate max-w-[100px]">{currentConfig?.model.name || '选择模型'}</span>
        <ChevronDown
          size={12}
          className={cn('transition-transform shrink-0', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-xl shadow-2xl border overflow-hidden bg-zinc-900 border-zinc-700"
          >
            {showAddKey ? (
              <div className="p-3 space-y-3 w-[280px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">添加密钥</span>
                  <button
                    onClick={() => setShowAddKey(false)}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">平台</label>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value as AIProvider)}
                    className="w-full px-2 py-1.5 rounded border border-white/10 bg-black/20 text-zinc-200 text-xs"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">名称（可选）</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder={getProviderConfig(newKeyProvider)?.name || ''}
                    className="w-full px-2 py-1.5 rounded border border-white/10 bg-black/20 text-zinc-200 text-xs"
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
                      className="w-full px-2 py-1.5 pr-8 rounded border border-white/10 bg-black/20 text-zinc-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyValue(!showKeyValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                    >
                      {showKeyValue ? <EyeOff size={12} /> : <Eye size={12} />}
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
                      className="w-full px-2 py-1.5 rounded border border-white/10 bg-black/20 text-zinc-200 text-xs"
                    />
                  </div>
                )}

                <button
                  onClick={handleAddKey}
                  disabled={!newKeyValue.trim()}
                  className={cn(
                    'w-full py-2 rounded text-xs transition-colors',
                    newKeyValue.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-white/5 text-zinc-500'
                  )}
                >
                  添加
                </button>
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs border-b flex justify-between items-center bg-zinc-800 text-zinc-400 border-zinc-700">
                  <span>
                    {keys.length > 0
                      ? `${keys.length} 个密钥 · ${totalModels} 个模型`
                      : '未配置密钥'}
                  </span>
                  <button
                    onClick={() => setShowAddKey(true)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Plus size={12} />
                    <span>添加</span>
                  </button>
                </div>

                {keys.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    {keys.map((key) => (
                      <div key={key.id} className="border-b border-zinc-800 last:border-b-0">
                        <div className="px-3 py-2 flex items-center justify-between bg-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <Key
                              size={10}
                              className={key.isEnabled ? 'text-green-400' : 'text-zinc-500'}
                            />
                            <span className="text-xs text-zinc-300">{key.name}</span>
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
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        {key.isEnabled && key.models && key.models.length > 0 && (
                          <div className="py-1">
                            {key.models.slice(0, 5).map((model) => {
                              const isSelected =
                                selectedKeyId === key.id && selectedModelId === model.id;
                              return (
                                <div
                                  key={`${key.id}-${model.id}`}
                                  onClick={() => handleSelectModel(key.id, model.id)}
                                  className={cn(
                                    'px-3 py-1.5 flex items-center gap-2 cursor-pointer',
                                    isSelected
                                      ? 'bg-sky-900/50 text-sky-400'
                                      : 'hover:bg-zinc-800 text-zinc-400'
                                  )}
                                >
                                  <span className="flex-1 text-xs truncate">{model.name}</span>
                                  {model.isFree && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-green-900/50 text-green-400">
                                      免费
                                    </span>
                                  )}
                                  {isSelected && <Check size={12} className="shrink-0" />}
                                </div>
                              );
                            })}
                            {key.models.length > 5 && (
                              <div className="px-3 py-1 text-[10px] text-zinc-500">
                                还有 {key.models.length - 5} 个模型...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {keys.length === 0 && (
                  <div className="p-6 text-center">
                    <Key size={24} className="mx-auto mb-2 text-zinc-600" />
                    <p className="text-xs text-zinc-500 mb-3">添加 API 密钥以使用 AI 模型</p>
                    <button
                      onClick={() => setShowAddKey(true)}
                      className="px-3 py-1.5 rounded bg-blue-500 text-white text-xs hover:bg-blue-600"
                    >
                      添加密钥
                    </button>
                  </div>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
