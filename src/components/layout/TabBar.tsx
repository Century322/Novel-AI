import React from 'react';
import { useTabStore } from '@/store';
import { X, FileText, Settings, Terminal, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useTabStore();

  if (tabs.length === 0) {
    return null;
  }

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'settings':
        return <Settings size={14} />;
      case 'terminal':
        return <Terminal size={14} />;
      case 'visualization':
        return <BarChart3 size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number, tabId: string) => {
    e.dataTransfer.setData('tabIndex', index.toString());
    e.dataTransfer.setData('tabId', tabId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('tabIndex'));
    if (fromIndex !== toIndex && reorderTabs) {
      reorderTabs(fromIndex, toIndex);
    }
  };

  return (
    <div className="h-10 flex items-center border-b px-2 gap-1 shrink-0 overflow-x-auto pretty-scrollbar bg-[#1a1a1a] border-white/5">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index, tab.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          className={cn(
            'group flex items-center gap-1.5 px-3 py-1.5 rounded-t cursor-pointer transition-colors min-w-[80px] max-w-[180px] cursor-grab active:cursor-grabbing',
            activeTabId === tab.id
              ? 'bg-black/60 text-zinc-100 border-t border-x border-white/10 -mb-px'
              : 'bg-transparent text-zinc-400 hover:bg-white/5'
          )}
          onClick={() => setActiveTab(tab.id)}
          title={tab.title}
        >
          <span className="shrink-0 text-zinc-500">{getTabIcon(tab.type)}</span>
          <span className="truncate text-sm flex-1 hidden sm:inline">{tab.title}</span>
          {tab.isDirty && <span className="w-2 h-2 rounded-full shrink-0 bg-blue-500" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-white/10 hidden sm:inline"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};
