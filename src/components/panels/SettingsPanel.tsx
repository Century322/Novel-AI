import React, { useState, useEffect, useRef } from 'react';
import { useApiKeyStore } from '@/store';
import { Key, Eye, EyeOff, Plus, Trash2, Zap, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROVIDERS, getProviderConfig } from '@/store/apiKeyStore';
import { AIProvider } from '@/config/providers';

interface SettingsPanelProps {
  isMobile?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isMobile = false }) => {
  const { keys, addKey, removeKey, toggleKey } = useApiKeyStore();

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
        <div className="p-3 rounded-lg border border-white/10 space-y-3 bg-zinc-800/30">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">平台</label>
            <div className="relative" ref={providerDropdownRef}>
              <button
                type="button"
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-zinc-700/50 text-zinc-200 text-sm text-left flex items-center justify-between focus:outline-none"
              >
                <span>{getProviderConfig(newKeyProvider)?.name || '选择平台'}</span>
                <ChevronDown size={14} className={cn('transition-transform', showProviderDropdown && 'rotate-180')} />
              </button>
              {showProviderDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-lg overflow-hidden z-50 shadow-lg">
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
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-zinc-700/50 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
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
                className="w-full px-3 py-2 pr-10 rounded-lg border border-white/10 bg-zinc-700/50 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
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
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-zinc-700/50 text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none"
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

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] overflow-y-auto overflow-x-hidden p-4 space-y-4">
      {renderApiKeySection()}
      {isMobile && renderModelsSection()}
    </div>
  );
};
