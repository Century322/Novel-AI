import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createAgentEngine, AgentEngine, AgentState } from '@/services/ai/agentEngine';
import { getAgentEngine } from '@/services/core/serviceInitializer';
import {
  Send,
  Loader2,
  Sparkles,
  Wand2,
  RefreshCw,
  Copy,
  Check,
  PenTool,
  MessageSquare,
  Lightbulb,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WritingAssistantPanelProps {
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
}

type WritingMode = 'chat' | 'continue' | 'revise' | 'analyze' | 'brainstorm';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  mode: WritingMode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'continue',
    label: '续写',
    icon: <PenTool size={14} />,
    prompt: '请续写当前内容',
    mode: 'continue',
  },
  {
    id: 'revise',
    label: '润色',
    icon: <Wand2 size={14} />,
    prompt: '请润色当前内容，提升文笔',
    mode: 'revise',
  },
  {
    id: 'analyze',
    label: '分析',
    icon: <Target size={14} />,
    prompt: '请分析当前内容的质量和问题',
    mode: 'analyze',
  },
  {
    id: 'brainstorm',
    label: '灵感',
    icon: <Lightbulb size={14} />,
    prompt: '请给我一些创作灵感和建议',
    mode: 'brainstorm',
  },
];

export const WritingAssistantPanel: React.FC<WritingAssistantPanelProps> = ({
  width,
  onDragStart,
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: number;
    }>
  >([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentMode, setCurrentMode] = useState<WritingMode>('chat');
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<AgentEngine | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!agentRef.current) {
      const engine = getAgentEngine();
      if (engine) {
        agentRef.current = engine;
      } else {
        agentRef.current = createAgentEngine('');
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) {
      return;
    }

    const userMessage = input.trim();
    setInput('');

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: userMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setStreamingContent('');

    try {
      const engine = getAgentEngine() || agentRef.current || createAgentEngine('');
      agentRef.current = engine;

      const result = await engine.run(userMessage, (state) => {
        setAgentState(state);
      });

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: result.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (result.toolCalls.length > 0) {
        const toolMsg = {
          id: (Date.now() + 2).toString(),
          role: 'system' as const,
          content: `执行了 ${result.toolCalls.length} 个工具调用`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, toolMsg]);
      }
    } catch (error) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'system' as const,
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      setAgentState(null);
    }
  }, [input, isProcessing]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    setCurrentMode(action.mode);
    setInput(action.prompt);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <div
      className="relative flex flex-col h-full border-r shrink-0 bg-black/40 border-white/5"
      style={{ width: `${width}px` }}
    >
      <div className="h-12 border-b flex items-center justify-between px-3 shrink-0 border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-400" />
          <span className="font-medium text-sm text-zinc-200">AI 写作助手</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-1.5 rounded transition-colors hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
            title="清空对话"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-2 border-b shrink-0 flex-wrap border-white/5 bg-black/20">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleQuickAction(action)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              currentMode === action.mode
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/5'
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-sm text-zinc-500">
            <MessageSquare size={32} className="mb-2 opacity-30" />
            <p>开始与 AI 对话...</p>
            <p className="text-xs mt-1 opacity-70">选择上方的快捷操作或直接输入</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'text-sm p-3 rounded-lg group relative',
                  msg.role === 'user'
                    ? 'bg-blue-500/10 text-blue-300'
                    : msg.role === 'system'
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'bg-white/5 text-zinc-300'
                )}
              >
                <div className="whitespace-pre-wrap pr-6">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  >
                    {copiedId === msg.id ? (
                      <Check size={12} className="text-green-500" />
                    ) : (
                      <Copy size={12} className="text-zinc-500" />
                    )}
                  </button>
                )}
              </div>
            ))}

            {isProcessing && agentState && (
              <div className="text-xs p-2 rounded bg-white/5 text-zinc-400">
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  <span>
                    {agentState.status === 'thinking' && '思考中...'}
                    {agentState.status === 'acting' && '执行操作...'}
                    {agentState.status === 'observing' && '观察结果...'}
                    {agentState.status === 'responding' && '生成回复...'}
                  </span>
                  <span className="opacity-50">迭代 {agentState.iteration}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-2 border-t shrink-0 border-white/5">
        <div className="flex items-end gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入创作指令..."
            rows={3}
            className="flex-1 bg-transparent resize-none text-sm focus:outline-none text-zinc-200 placeholder-zinc-500"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className={cn(
              'p-2 rounded-lg transition-colors shrink-0',
              input.trim() ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-white/5 text-zinc-500'
            )}
          >
            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
        onMouseDown={onDragStart}
      />
    </div>
  );
};

export default WritingAssistantPanel;
