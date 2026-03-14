import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  useSessionStore,
  useAgentStore,
  useWorkshopStore,
  useTaskStore,
} from '@/store';
import { useAI, useMessages } from '@/hooks';
import {
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  FileEdit,
  Database,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  PanelLeft,
  ChevronRight,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelSelector } from '@/components/settings/ModelSelector';
import { GuidedCardComponent } from '@/components/common/GuidedCard';
import {
  createCreationFlowService,
  CreationFlowService,
} from '@/services/writing/creationFlowService';
import { GuidedCard } from '@/types/writing/creationFlow';
import {
  ContextCompressionService,
  createContextCompressionService,
} from '@/services/knowledge/contextCompressionService';
import { logger } from '@/services/core/loggerService';
import { ThinkingProcessViewer } from '@/components/ai/ThinkingProcessViewer';

interface ChatContentProps {
  width: number;
  onDragStart: (e: React.MouseEvent) => void;
  isSessionListOpen?: boolean;
  onToggleSessionList?: () => void;
  onSwitchToEditor?: () => void;
  onOpenSettings?: () => void;
  isMobile?: boolean;
}

interface MessageChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  file: string;
  message: string;
  timestamp: number;
}

export const ChatContent: React.FC<ChatContentProps> = ({
  width,
  onDragStart,
  isSessionListOpen = false,
  onToggleSessionList,
  onSwitchToEditor,
  onOpenSettings,
  isMobile = false,
}) => {
  const { currentSessionId, createSession, rollbackToMessage } = useSessionStore();
  const agentStore = useAgentStore();
  const { isInitialized, init } = useWorkshopStore();
  const { tasks } = useTaskStore();

  const [input, setInput] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [currentGuidedCard, setCurrentGuidedCard] = useState<GuidedCard | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [messageChanges] = useState<Record<string, MessageChange[]>>({});
  const [messageTokens, setMessageTokens] = useState<Record<string, number>>({});
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [compressingMessages, setCompressingMessages] = useState<Set<string>>(new Set());
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike' | null>>(
    {}
  );

  const messages = useMessages();
  const {
    sendMessageWithAgent,
    isProcessing: aiProcessing,
    error,
    agentState,
    currentIntent,
    extractAndSaveInfo,
    abort,
    thinkingProcess,
    resetAIState,
  } = useAI();

  const isProcessing = aiProcessing || agentStore.isProcessing;

  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  useEffect(() => {
    logger.debug('[ChatContent] 状态更新', {
      thinkingProcess: thinkingProcess ? `有${thinkingProcess.steps.length}个步骤` : '无',
      isProcessing,
      aiProcessing,
      agentStoreIsProcessing: agentStore.isProcessing,
    });
  }, [thinkingProcess, isProcessing, aiProcessing, agentStore.isProcessing]);

  const creationFlowRef = useRef<CreationFlowService | null>(null);
  const compressionServiceRef = useRef<ContextCompressionService | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  useEffect(() => {
    if (!creationFlowRef.current) {
      creationFlowRef.current = createCreationFlowService('');
      compressionServiceRef.current = createContextCompressionService('');
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const startGuidedCreation = useCallback(() => {
    if (!creationFlowRef.current) {
      return;
    }

    setShowGuide(true);
    const welcomeCard = creationFlowRef.current.getWelcomeCard();
    setCurrentGuidedCard(welcomeCard);
  }, []);

  const handleGuidedAction = useCallback(
    async (actionId: string, data: Record<string, unknown>) => {
      if (!creationFlowRef.current || !currentGuidedCard) {
        return;
      }

      if (actionId === 'start') {
        const choice = data.start_choice as string;
        if (choice === 'guided') {
          const nextStep = creationFlowRef.current.getNextStep();
          if (nextStep) {
            creationFlowRef.current.startStep(nextStep.id);
            const card = creationFlowRef.current.getGuidedCardForStep(nextStep);
            setCurrentGuidedCard(card);
          }
        } else if (choice === 'free') {
          setShowGuide(false);
          setCurrentGuidedCard(null);
        } else if (choice === 'continue') {
          const progressCard = creationFlowRef.current.getProgressCard();
          setCurrentGuidedCard(progressCard);
        }
      } else if (actionId === 'confirm') {
        const stepId = currentGuidedCard.data?.stepId as string;
        if (stepId) {
          creationFlowRef.current.completeStep(stepId, data);

          const extractionText = Object.entries(data)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

          if (extractAndSaveInfo) {
            await extractAndSaveInfo(extractionText);
          }

          const nextStep = creationFlowRef.current.getNextStep();
          if (nextStep) {
            creationFlowRef.current.startStep(nextStep.id);
            const card = creationFlowRef.current.getGuidedCardForStep(nextStep);
            setCurrentGuidedCard(card);
          } else {
            const progress = creationFlowRef.current.getProgress();
            if (progress.percentage >= 100) {
              setCurrentGuidedCard({
                id: 'complete',
                type: 'confirmation',
                title: '设定完成！',
                content: '你已经完成了基础设定，可以开始创作正文了。',
                actions: [
                  {
                    id: 'start_writing',
                    label: '开始写作',
                    type: 'primary',
                    action: 'start_writing',
                  },
                ],
              });
            } else {
              setShowGuide(false);
              setCurrentGuidedCard(null);
            }
          }
        }
      } else if (actionId === 'skip') {
        const stepId = currentGuidedCard.data?.stepId as string;
        if (stepId) {
          creationFlowRef.current.skipStep(stepId);
          const nextStep = creationFlowRef.current.getNextStep();
          if (nextStep) {
            creationFlowRef.current.startStep(nextStep.id);
            const card = creationFlowRef.current.getGuidedCardForStep(nextStep);
            setCurrentGuidedCard(card);
          }
        }
      } else if (actionId === 'continue') {
        const nextStep = creationFlowRef.current.getNextStep();
        if (nextStep) {
          creationFlowRef.current.startStep(nextStep.id);
          const card = creationFlowRef.current.getGuidedCardForStep(nextStep);
          setCurrentGuidedCard(card);
        }
      } else if (actionId === 'start_writing') {
        setShowGuide(false);
        setCurrentGuidedCard(null);
      }
    },
    [currentGuidedCard, extractAndSaveInfo]
  );

  const handleSend = async () => {
    if (!input.trim() || isProcessing) {
      return;
    }

    const userMsg = input;
    setInput('');
    setIsAtBottom(true);

    if (!currentSessionId) {
      createSession(userMsg);
    }

    if (userMsg.includes('引导') || userMsg.includes('开始创作')) {
      startGuidedCreation();
      return;
    }

    try {
      await sendMessageWithAgent(userMsg, messages);
    } catch (err) {
      logger.error('发送消息失败', { error: err });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMessageExpand = (msgId: string) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) {
        newSet.delete(msgId);
      } else {
        newSet.add(msgId);
      }
      return newSet;
    });
  };

  const handleCompress = async (msgId: string) => {
    if (!compressionServiceRef.current || compressingMessages.has(msgId)) {
      return;
    }

    setCompressingMessages((prev) => new Set(prev).add(msgId));

    try {
      const context = await compressionServiceRef.current.compress({
        maxTokens: 2000,
        includeCharacters: true,
        includeTimeline: true,
        includeForeshadowing: true,
        includeWorldbuilding: true,
        includeRecentContent: true,
        recentChaptersCount: 3,
      });

      setMessageTokens((prev) => ({
        ...prev,
        [msgId]: context.totalTokens,
      }));

      logger.info('上下文压缩完成', {
        msgId,
        tokens: context.totalTokens,
        ratio: context.compressionRatio,
      });
    } catch (err) {
      logger.error('上下文压缩失败', { error: err });
    } finally {
      setCompressingMessages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(msgId);
        return newSet;
      });
    }
  };

  const getMessageTask = (msgId: string) => {
    return tasks.find((t) => t.id.includes(msgId) || msgId.includes(t.id));
  };

  const getMessageChanges = (msgId: string): MessageChange[] => {
    return messageChanges[msgId] || [];
  };

  const handleFeedback = (msgId: string, type: 'like' | 'dislike') => {
    const currentFeedback = messageFeedback[msgId];
    if (currentFeedback === type) {
      setMessageFeedback((prev) => ({ ...prev, [msgId]: null }));
    } else {
      setMessageFeedback((prev) => ({ ...prev, [msgId]: type }));
      logger.info('用户反馈', { msgId, type });
    }
  };

  const handleRegenerate = async (msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex <= 0) {
      if (msgIndex === 0) {
        logger.warn('无法重新生成第一条消息');
      }
      return;
    }

    const userMessage = messages[msgIndex - 1];
    if (!userMessage) {
      logger.warn('找不到对应的用户消息');
      return;
    }
    if (userMessage.role !== 'user') {
      logger.warn('前一条消息不是用户消息，无法重新生成');
      return;
    }

    const { deleteMessage } = useSessionStore.getState();
    deleteMessage(msgId);

    setTimeout(() => {
      sendMessageWithAgent(userMessage.content, messages.slice(0, msgIndex - 1));
    }, 100);
  };

  const toggleRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      logger.warn('浏览器不支持语音识别');
      alert('您的浏览器不支持语音识别，请使用 Chrome、Edge 或 Safari 浏览器');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        logger.info('语音识别已开始');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        let errorMsg = '语音识别错误';
        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            errorMsg = '请允许麦克风权限后重试';
            break;
          case 'no-speech':
            errorMsg = '未检测到语音，请重试';
            break;
          case 'network':
            errorMsg = '网络错误，请检查网络连接';
            break;
          case 'audio-capture':
            errorMsg = '无法访问麦克风，请检查设备';
            break;
          case 'aborted':
            errorMsg = '语音识别已取消';
            break;
          default:
            errorMsg = `语音识别错误: ${event.error}`;
        }
        logger.error('语音识别错误', { error: event.error, message: errorMsg });
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
        logger.info('语音识别已结束');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      logger.info('语音识别已启动');
    } catch (err) {
      logger.error('启动语音识别失败', { error: err });
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <div
      className={cn('relative flex flex-col h-full shrink-0', 'bg-[#1e1e1e]')}
      style={{ width: `${width}px` }}
    >
      <div className={cn("shrink-0 flex items-center justify-between gap-2", isMobile ? "p-3 pb-0" : "p-2 pb-0")}>
        <div className="flex items-center gap-2">
          {!isSessionListOpen && onToggleSessionList && (
            <button
              onClick={onToggleSessionList}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
              title="展开会话列表"
            >
              <PanelLeft size={isMobile ? 18 : 14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMobile && onSwitchToEditor && (
            <button
              onClick={onSwitchToEditor}
              className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
              title="文件"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div ref={messagesContainerRef} className="relative flex-1 overflow-y-auto p-3 no-scrollbar">
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>
        )}

        {showGuide && currentGuidedCard && (
          <div className="mb-4">
            <GuidedCardComponent
              card={currentGuidedCard}
              onAction={handleGuidedAction}
              onDismiss={() => {
                setShowGuide(false);
                setCurrentGuidedCard(null);
              }}
            />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-sm gap-4">
            <div className="text-center text-zinc-500">
              <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
              <p>开始新对话...</p>
              <p className="text-xs mt-1 opacity-70">支持自然语言命令和工具调用</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const task = getMessageTask(msg.id);
              const changes = getMessageChanges(msg.id);
              const tokens = messageTokens[msg.id];
              const isExpanded = expandedMessages.has(msg.id);
              const isCompressing = compressingMessages.has(msg.id);

              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end items-start gap-2 group">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1 max-sm:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(msg.content);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="复制"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resetAIState();
                          rollbackToMessage(msg.id);
                        }}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        title="回退到此处"
                      >
                        <Undo2 size={12} />
                      </button>
                    </div>
                    <div className="text-[13px] px-3 py-1.5 rounded-lg max-w-[70%] bg-zinc-700 text-zinc-100">
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                );
              }

              if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="text-xs px-3 py-1 rounded bg-white/5 text-zinc-500">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="text-[13px]">
                  <div className="whitespace-pre-wrap text-zinc-300">{msg.content}</div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {task ? (
                          <>
                            {task.status === 'processing' ? (
                              <Loader2 size={10} className="animate-spin text-blue-500" />
                            ) : task.status === 'completed' ? (
                              <CheckCircle2 size={10} className="text-green-500" />
                            ) : task.status === 'failed' ? (
                              <XCircle size={10} className="text-red-500" />
                            ) : null}
                            <span>{task.message}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={10} className="text-zinc-600" />
                            <span className="text-zinc-600">无任务</span>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => toggleMessageExpand(msg.id)}
                        className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                      >
                        <FileEdit size={10} />
                        <span>{changes.length > 0 ? `${changes.length} 变更` : '无变更'}</span>
                        {changes.length > 0 &&
                          (isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                      </button>

                      <button
                        onClick={() => handleCompress(msg.id)}
                        disabled={isCompressing}
                        className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                      >
                        {isCompressing ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Database size={10} />
                        )}
                        <span>压缩</span>
                        {tokens !== undefined && (
                          <span
                            className={cn(
                              tokens > 3000
                                ? 'text-red-500'
                                : tokens > 2000
                                  ? 'text-yellow-500'
                                  : 'text-green-500'
                            )}
                          >
                            {tokens}tokens
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleFeedback(msg.id, 'like')}
                        className={cn(
                          'p-1 rounded transition-colors',
                          messageFeedback[msg.id] === 'like'
                            ? 'bg-green-500/20 text-green-400'
                            : 'hover:bg-white/10 hover:text-zinc-300'
                        )}
                        title="赞"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        className={cn(
                          'p-1 rounded transition-colors',
                          messageFeedback[msg.id] === 'dislike'
                            ? 'bg-red-500/20 text-red-400'
                            : 'hover:bg-white/10 hover:text-zinc-300'
                        )}
                        title="踩"
                      >
                        <ThumbsDown size={12} />
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                        }}
                        className="p-1 rounded hover:bg-white/10 hover:text-zinc-300 transition-colors"
                        title="复制"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="p-1 rounded hover:bg-white/10 hover:text-zinc-300 transition-colors"
                        title="重试"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && changes.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-white/5 text-[10px] space-y-1">
                      {changes.map((change) => (
                        <div key={change.id} className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-1 rounded',
                              change.type === 'create'
                                ? 'bg-green-500/20 text-green-400'
                                : change.type === 'update'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {change.type === 'create'
                              ? '新建'
                              : change.type === 'update'
                                ? '修改'
                                : '删除'}
                          </span>
                          <span className="truncate text-zinc-400">{change.file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {(thinkingProcess || currentIntent || agentState) && isProcessing && (
              <div className="mb-3">
                <ThinkingProcessViewer
                  process={thinkingProcess}
                  expanded={thinkingExpanded}
                  onToggleExpand={() => setThinkingExpanded(!thinkingExpanded)}
                  intent={currentIntent}
                  agentState={agentState}
                />
              </div>
            )}
          </div>
        )}

        {!isAtBottom && (
          <button
            onClick={() => {
              setIsAtBottom(true);
              scrollToBottom();
            }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-zinc-800 text-xs text-zinc-300 border border-zinc-600 shadow-lg hover:bg-zinc-700 transition-colors z-10"
          >
            ↓ 滚动到最新消息
          </button>
        )}
      </div>

      <div className="p-2 shrink-0">
        <div className="flex flex-col rounded-lg bg-black/20 border border-white/5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息或命令（如：续写、润色、分析人物...）"
            className="w-full bg-transparent resize-none text-[13px] focus:outline-none leading-relaxed p-3 min-h-[100px] text-zinc-200 placeholder-zinc-500"
          />
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            <div className="flex items-center gap-2">
              <ModelSelector className="shrink-0" onOpenSettings={onOpenSettings} />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={toggleRecording}
                className={cn(
                  'p-2 rounded transition-colors shrink-0',
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                )}
              >
                {isRecording ? <MicOff size={16} className="sm:w-3 sm:h-3" /> : <Mic size={16} className="sm:w-3 sm:h-3" />}
              </button>
              <button
                onClick={isProcessing ? abort : handleSend}
                className={cn(
                  'p-2 rounded transition-colors shrink-0',
                  isProcessing
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : input.trim()
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-white/5 text-zinc-500'
                )}
                title={isProcessing ? '点击中断生成' : '发送'}
              >
                {isProcessing ? <XCircle size={16} className="sm:w-3 sm:h-3" /> : <Send size={16} className="sm:w-3 sm:h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10"
        onMouseDown={onDragStart}
      />
    </div>
  );
};
