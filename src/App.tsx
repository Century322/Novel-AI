import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ChatContent } from '@/components/chat/ChatContent';
import { SessionListPanel } from '@/components/panels/SessionListPanel';
import { FileTreePanel } from '@/components/editor/FileTreePanel';
import { MobileWarning } from '@/components/common/MobileWarning';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { initializeSync } from '@/store';
import { LAYOUT_CONSTANTS } from '@/constants';
import { X, Loader2, ChevronLeft, PanelRight } from 'lucide-react';
import { setupGlobalErrorHandling } from '@/services/core/errorHandlerService';
import { cn } from '@/lib/utils';

setupGlobalErrorHandling();

const MainContent = lazy(() =>
  import('@/components/layout/MainContent').then((m) => ({ default: m.MainContent }))
);

initializeSync();

function App() {
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(
    LAYOUT_CONSTANTS.RIGHT_PANEL.DEFAULT_WIDTH
  );
  const [chatWidth, setChatWidth] = useState<number>(400);
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTerminalModal, setShowTerminalModal] = useState(false);

  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'chat' | 'editor'>('chat');
  const [showMobileFileTree, setShowMobileFileTree] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < LAYOUT_CONSTANTS.BREAKPOINTS.TABLET);
      
      if (width < LAYOUT_CONSTANTS.BREAKPOINTS.MOBILE) {
        setRightPanelWidth(Math.min(LAYOUT_CONSTANTS.RIGHT_PANEL.MIN_WIDTH, width * 0.25));
      } else if (width < LAYOUT_CONSTANTS.BREAKPOINTS.TABLET) {
        setRightPanelWidth(Math.min(200, width * 0.22));
      } else {
        setRightPanelWidth(LAYOUT_CONSTANTS.RIGHT_PANEL.DEFAULT_WIDTH);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleRightDragStart = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDraggingRight(true);
  }, [isMobile]);

  const handleChatDragStart = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDraggingChat(true);
  }, [isMobile]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isDraggingRight) {
        const newWidth = rect.right - e.clientX;
        setRightPanelWidth(Math.min(350, Math.max(180, newWidth)));
      }

      if (isDraggingChat) {
        const newWidth = e.clientX - rect.left;
        setChatWidth(Math.min(600, Math.max(300, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingRight(false);
      setIsDraggingChat(false);
    };

    if (isDraggingRight || isDraggingChat) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDraggingRight, isDraggingChat]);

  const handleOpenSettings = () => {
    setShowSettingsModal(true);
    setIsSessionListOpen(false);
  };

  const handleOpenTerminal = () => {
    setShowTerminalModal(true);
    setIsSessionListOpen(false);
  };

  const handleToggleSessionList = () => {
    setIsSessionListOpen(!isSessionListOpen);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && mobileView === 'chat') {
        setMobileView('editor');
      } else if (diff < 0 && mobileView === 'editor') {
        setMobileView('chat');
      }
    }
  };

  if (isMobile) {
    return (
      <div 
        className="flex flex-col h-[100dvh] font-sans overflow-hidden relative selection:bg-blue-500/30 transition-colors duration-500 bg-[#1a1a1a] text-zinc-100"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <MobileWarning />
        
        {mobileView === 'chat' && (
          <ChatContent 
            width={window.innerWidth} 
            onDragStart={() => {}} 
            isSessionListOpen={isSessionListOpen}
            onToggleSessionList={handleToggleSessionList}
            onSwitchToEditor={() => setMobileView('editor')}
            onOpenSettings={() => {
              setIsSessionListOpen(false);
              setShowSettingsModal(true);
            }}
            isMobile={true}
          />
        )}

        {mobileView === 'editor' && (
          <div className="h-full flex flex-col">
            <div className="shrink-0 flex items-center justify-between gap-2 p-3 pb-0">
              <button
                onClick={() => setMobileView('chat')}
                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
                title="返回聊天"
              >
                <ChevronLeft size={18} />
              </button>
              <div></div>
              <button
                onClick={() => setShowMobileFileTree(true)}
                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
                title="展开文件树"
              >
                <PanelRight size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center bg-transparent">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                }
              >
                <MainContent showSettingsPanel={false} />
              </Suspense>
            </div>
          </div>
        )}

        {isSessionListOpen && createPortal(
          <div 
            className="fixed inset-0 bg-[#1a1a1a] z-[9999] flex flex-col"
            onClick={() => setIsSessionListOpen(false)}
          >
            <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <SessionListPanel 
                isOpen={true} 
                onOpenSettings={handleOpenSettings}
                onOpenTerminal={handleOpenTerminal}
                isMobile={true}
                onClose={() => setIsSessionListOpen(false)}
              />
            </div>
          </div>,
          document.body
        )}

        {showMobileFileTree && createPortal(
          <div 
            className="fixed inset-0 bg-[#1a1a1a] z-[9999]"
            onClick={() => setShowMobileFileTree(false)}
          >
            <div 
              className="h-full w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <FileTreePanel 
                width={window.innerWidth} 
                onDragStart={() => {}} 
                isMobile={true}
                onClose={() => setShowMobileFileTree(false)}
              />
            </div>
          </div>,
          document.body
        )}

        {showSettingsModal && createPortal(
          <div 
            className={cn(
              "fixed inset-0 z-[9999] flex flex-col",
              isMobile ? "bg-[#1a1a1a]" : "bg-black/60 items-center justify-center"
            )}
            onClick={() => !isMobile && setShowSettingsModal(false)}
          >
            <div 
              className={cn(
                "flex flex-col",
                isMobile 
                  ? "h-full w-full bg-[#1a1a1a]" 
                  : "bg-zinc-900 border border-zinc-700 rounded-lg w-[95vw] h-[80vh] shadow-2xl"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                "flex items-center px-4 py-3 border-b border-white/10",
                isMobile ? "gap-2" : "justify-between"
              )}>
                {isMobile && (
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      setIsSessionListOpen(true);
                    }}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <span className="text-sm font-medium text-zinc-200">设置</span>
                {!isMobile && (
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <SettingsPanel isMobile={isMobile} />
              </div>
            </div>
          </div>,
          document.body
        )}

        {showTerminalModal && createPortal(
          <div 
            className={cn(
              "fixed inset-0 z-[9999] flex flex-col",
              isMobile ? "bg-[#1a1a1a]" : "bg-black/60 items-center justify-center"
            )}
            onClick={() => !isMobile && setShowTerminalModal(false)}
          >
            <div 
              className={cn(
                "flex flex-col",
                isMobile 
                  ? "h-full w-full bg-[#1a1a1a]" 
                  : "bg-zinc-900 border border-zinc-700 rounded-lg w-[95vw] h-[80vh] shadow-2xl"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                "flex items-center px-4 py-3 border-b border-white/10",
                isMobile ? "gap-2" : "justify-between"
              )}>
                {isMobile && (
                  <button
                    onClick={() => {
                      setShowTerminalModal(false);
                      setIsSessionListOpen(true);
                    }}
                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <span className="text-sm font-medium text-zinc-200">终端</span>
                {!isMobile && (
                  <button
                    onClick={() => setShowTerminalModal(false)}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <TerminalPanel />
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] font-sans overflow-hidden relative selection:bg-blue-500/30 transition-colors duration-500 bg-[#1a1a1a] text-zinc-100">
      <MobileWarning />
      
      <SessionListPanel 
        isOpen={isSessionListOpen} 
        onOpenSettings={handleOpenSettings}
        onOpenTerminal={handleOpenTerminal}
        onClose={() => setIsSessionListOpen(false)}
      />

      <ChatContent 
        width={chatWidth} 
        onDragStart={handleChatDragStart} 
        isSessionListOpen={isSessionListOpen}
        onToggleSessionList={handleToggleSessionList}
      />

      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-[300px] overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#1a1a1a]">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center bg-transparent">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              }
            >
              <MainContent showSettingsPanel={false} />
            </Suspense>
          </div>
        </div>

        <div
          className="flex flex-col shrink-0 min-w-[150px]"
          style={{ width: `${rightPanelWidth}px` }}
        >
          <FileTreePanel width={rightPanelWidth} onDragStart={handleRightDragStart} />
        </div>
      </div>

      {showSettingsModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
          onClick={() => setShowSettingsModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-lg w-[640px] max-w-[90vw] h-[480px] max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
              <span className="text-sm font-medium text-zinc-200">设置</span>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SettingsPanel />
            </div>
          </div>
        </div>,
        document.body
      )}

      {showTerminalModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]"
          onClick={() => setShowTerminalModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-lg w-[800px] max-w-[90vw] h-[500px] max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
              <span className="text-sm font-medium text-zinc-200">终端</span>
              <button
                onClick={() => setShowTerminalModal(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TerminalPanel />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
