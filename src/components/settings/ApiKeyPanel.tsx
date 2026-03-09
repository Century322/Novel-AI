import React, { useState, useRef, useEffect } from 'react';
import { useApiKeyStore } from '@/store';
import { PROVIDERS } from '@/config/providers';
import { AIProvider, ApiKeyConfig, getProviderConfig } from '@/store/apiKeyStore';
import {
  Key,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Zap,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ isOpen, onClose }) => {
  const { keys, addKey, updateKey, removeKey, toggleKey, validateKey } = useApiKeyStore();
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newProvider, setNewProvider] = useState<AIProvider>('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleAddKey = async () => {
    if (!newApiKey.trim()) {
      return;
    }
    const id = await addKey(
      newProvider,
      newApiKey.trim(),
      newName.trim() || undefined,
      newBaseUrl.trim() || undefined
    );
    validateKey(id);
    setNewApiKey('');
    setNewName('');
    setNewBaseUrl('');
    setIsAddingKey(false);
  };

  const handleValidateKey = (id: string) => {
    validateKey(id);
  };

  const handleProviderChange = (provider: AIProvider) => {
    setNewProvider(provider);
    setNewBaseUrl('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="absolute bottom-16 right-0 w-80 max-h-[70vh] overflow-hidden rounded-xl border shadow-2xl z-50 bg-black/95 border-white/10 backdrop-blur-xl"
        >
          <div className="p-3 border-b flex items-center justify-between border-white/10">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-blue-400" />
              <span className="font-medium text-sm text-zinc-200">API 密钥管理</span>
            </div>
            <button onClick={onClose} className="p-1 rounded transition-colors hover:bg-white/10">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[50vh] p-2 space-y-2 no-scrollbar">
            {keys.length === 0 && !isAddingKey && (
              <div className="text-center py-6 text-sm text-zinc-400">
                <Key size={24} className="mx-auto mb-2 opacity-30" />
                <p>暂无配置的 API 密钥</p>
                <p className="text-xs mt-1 opacity-70">点击下方按钮添加</p>
              </div>
            )}

            {keys.map((key) => (
              <KeyCard
                key={key.id}
                config={key}
                isExpanded={expandedKeyId === key.id}
                onToggleExpand={() => setExpandedKeyId(expandedKeyId === key.id ? null : key.id)}
                onToggle={() => toggleKey(key.id)}
                onValidate={() => handleValidateKey(key.id)}
                onRemove={() => removeKey(key.id)}
                onUpdate={(updates) => updateKey(key.id, updates)}
              />
            ))}

            {isAddingKey && (
              <div className="p-3 rounded-lg border space-y-2 bg-white/5 border-white/10">
                <select
                  value={newProvider}
                  onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full p-2 rounded text-sm border bg-black/50 border-white/10 text-zinc-200"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="名称 (可选)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2 rounded text-sm border bg-black/50 border-white/10 placeholder-zinc-500 text-zinc-200"
                />

                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="API Key"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="w-full p-2 pr-8 rounded text-sm border bg-black/50 border-white/10 placeholder-zinc-500 text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Base URL (可选，使用默认值)"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  className="w-full p-2 rounded text-sm border bg-black/50 border-white/10 placeholder-zinc-500 text-zinc-200"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddingKey(false)}
                    className="flex-1 py-2 rounded text-sm transition-colors bg-white/10 hover:bg-white/20 text-zinc-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddKey}
                    disabled={!newApiKey.trim()}
                    className="flex-1 py-2 rounded text-sm transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-2 border-t border-white/10">
            <button
              onClick={() => setIsAddingKey(true)}
              className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-800"
            >
              <Plus size={14} />
              添加密钥
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface KeyCardProps {
  config: ApiKeyConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onValidate: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ApiKeyConfig>) => void;
}

const KeyCard: React.FC<KeyCardProps> = ({
  config,
  isExpanded,
  onToggleExpand,
  onToggle,
  onValidate,
  onRemove,
}) => {
  const providerConfig = getProviderConfig(config.provider);

  const getStatusIcon = () => {
    if (config.isValidating) {
      return <Loader2 size={14} className="animate-spin text-amber-500" />;
    }
    if (config.isValid === true) {
      return <CheckCircle size={14} className="text-green-500" />;
    }
    if (config.isValid === false) {
      return <AlertCircle size={14} className="text-red-500" />;
    }
    return <AlertCircle size={14} className="text-zinc-600" />;
  };

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        `border-white/10 ${config.isEnabled ? 'bg-white/5' : 'bg-white/5 opacity-40'}`
      )}
    >
      <div className="p-2 flex items-center gap-2 cursor-pointer" onClick={onToggleExpand}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            'w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0',
            config.isEnabled ? 'bg-sky-500 border-sky-500 text-white' : 'border-zinc-600'
          )}
        >
          {config.isEnabled && <Check size={12} />}
        </button>

        {getStatusIcon()}

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-zinc-200">{config.name}</div>
          <div className="text-xs truncate text-zinc-400">
            {providerConfig?.name || config.provider}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onValidate();
            }}
            disabled={config.isValidating}
            className="p-1 rounded transition-colors hover:bg-white/10 text-zinc-500"
            title="验证"
          >
            {config.isValidating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded transition-colors hover:bg-red-900/30 text-zinc-500 hover:text-red-400"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t overflow-hidden border-white/5"
          >
            <div className="p-2 space-y-2">
              {config.error && (
                <div className="text-xs p-2 rounded bg-red-900/30 text-red-400">{config.error}</div>
              )}

              <div className="text-xs text-zinc-400">
                <span className="opacity-70">API Key:</span> {config.apiKey.slice(0, 8)}...
                {config.apiKey.slice(-4)}
              </div>

              {config.models && config.models.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1 text-zinc-300">
                    可用模型 ({config.models.length})
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {config.models.map((model) => (
                      <span
                        key={model.id}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1',
                          model.isFree
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-white/10 text-zinc-400'
                        )}
                      >
                        {model.isFree && <DollarSign size={8} />}
                        {model.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
