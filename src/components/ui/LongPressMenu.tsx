import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Edit2, Copy } from 'lucide-react';

interface LongPressMenuProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  isMobile?: boolean;
}

interface MenuPosition {
  x: number;
  y: number;
}

export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  children,
  onEdit,
  onDelete,
  onCopy,
  isMobile = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimer.current = setTimeout(() => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height,
      });
      setShowMenu(true);
    }, 500);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!longPressTimer.current) return;
    
    const touch = e.touches[0];
    const moveX = Math.abs(touch.clientX - touchStartPos.current.x);
    const moveY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    if (moveX > 10 || moveY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isMobile) return;
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }, [isMobile]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  useEffect(() => {
    if (showMenu) {
      const handleScroll = () => setShowMenu(false);
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
    return undefined;
  }, [showMenu]);

  const handleAction = (action: () => void) => {
    action();
    closeMenu();
  };

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className="relative"
      >
        {children}
      </div>

      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={closeMenu}
          />
          <div
            className="fixed z-[9999] bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[120px]"
            style={{
              left: Math.min(menuPosition.x - 60, window.innerWidth - 140),
              top: Math.min(menuPosition.y + 5, window.innerHeight - 150),
            }}
          >
            {onEdit && (
              <button
                onClick={() => handleAction(onEdit)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Edit2 size={16} />
                <span>重命名</span>
              </button>
            )}
            {onCopy && (
              <button
                onClick={() => handleAction(onCopy)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Copy size={16} />
                <span>复制</span>
              </button>
            )}
            <button
              onClick={() => handleAction(onDelete)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
              <span>删除</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};
