import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Users,
  MapPin,
  Scroll,
  BookOpen,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useWorkshopStore } from '@/store/workshopStore';
import { createWorldModelService, WorldModelService } from '@/services/world/worldModelService';
import { logger } from '@/services/core/loggerService';
import type { WorldModel, WorldLocation, WorldFaction, WorldRule } from '@/types/world/worldModel';
import type { CharacterProfile } from '@/types/character/characterProfile';
import type { Foreshadowing } from '@/types/plot/foreshadowing';

type TabType = 'characters' | 'locations' | 'factions' | 'rules' | 'foreshadowing';

export const WorldPanel: React.FC = () => {
  const { projectPath, isInitialized } = useWorkshopStore();
  const [worldModelService, setWorldModelService] = useState<WorldModelService | null>(null);
  const [worldModel, setWorldModel] = useState<WorldModel | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initService = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const service = createWorldModelService(projectPath || '');
        await service.initialize();
        setWorldModelService(service);
        setWorldModel(service.getWorldModel());
      } catch (err) {
        logger.error('初始化世界模型服务失败', { error: err });
        setError(err instanceof Error ? err.message : '初始化失败');
      } finally {
        setIsLoading(false);
      }
    };

    initService();
  }, [projectPath, isInitialized]);

  const refreshModel = useCallback(() => {
    if (worldModelService) {
      setWorldModel(worldModelService.getWorldModel());
    }
  }, [worldModelService]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <RefreshCw size={24} className="animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2">
        <AlertCircle size={32} />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!worldModel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Globe size={32} className="opacity-50" />
        <p className="text-sm">暂无世界设定数据</p>
        <p className="text-xs text-zinc-600">使用世界构建功能创建设定</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <RefreshCw size={24} className="animate-spin mr-2" />
        加载世界模型...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-400">加载失败</p>
        <p className="text-xs text-zinc-600">{error}</p>
      </div>
    );
  }

  if (!worldModel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Globe size={32} className="opacity-50" />
        <p className="text-sm">未找到世界模型数据</p>
        <p className="text-xs text-zinc-600">请使用"世界构建"功能创建</p>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'characters', label: '人物', icon: <Users size={16} />, count: worldModel.characters.items.length },
    { id: 'locations', label: '地点', icon: <MapPin size={16} />, count: worldModel.worldbuilding.locations.length },
    { id: 'factions', label: '势力', icon: <Scroll size={16} />, count: worldModel.worldbuilding.factions.length },
    { id: 'rules', label: '规则', icon: <BookOpen size={16} />, count: worldModel.worldbuilding.rules.length },
    { id: 'foreshadowing', label: '伏笔', icon: <Globe size={16} />, count: worldModel.foreshadowing.items.length },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#1a1a1a]">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">世界体系</h2>
        <button
          onClick={refreshModel}
          className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          title="刷新"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 text-xs flex items-center justify-center gap-1 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className="text-[10px] text-zinc-500">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'characters' && (
          <EntityList<CharacterProfile>
            entities={worldModel.characters.items}
            renderEntity={(char) => (
              <>
                <span className="font-medium text-white">{char.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{char.role}</span>
                {char.notes && <p className="text-xs text-zinc-400 mt-1">{char.notes}</p>}
              </>
            )}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
          />
        )}
        {activeTab === 'locations' && (
          <EntityList<WorldLocation>
            entities={worldModel.worldbuilding.locations}
            renderEntity={(loc) => (
              <>
                <span className="font-medium text-white">{loc.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{loc.type}</span>
                {loc.description && <p className="text-xs text-zinc-400 mt-1">{loc.description}</p>}
              </>
            )}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
          />
        )}
        {activeTab === 'factions' && (
          <EntityList<WorldFaction>
            entities={worldModel.worldbuilding.factions}
            renderEntity={(faction) => (
              <>
                <span className="font-medium text-white">{faction.name}</span>
                {faction.description && <p className="text-xs text-zinc-400 mt-1">{faction.description}</p>}
              </>
            )}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
          />
        )}
        {activeTab === 'rules' && (
          <EntityList<WorldRule>
            entities={worldModel.worldbuilding.rules}
            renderEntity={(rule) => (
              <>
                <span className="font-medium text-white">{rule.name}</span>
                {rule.description && <p className="text-xs text-zinc-400 mt-1">{rule.description}</p>}
              </>
            )}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
          />
        )}
        {activeTab === 'foreshadowing' && (
          <EntityList<Foreshadowing>
            entities={worldModel.foreshadowing.items}
            renderEntity={(foreshadow) => (
              <>
                <span className="font-medium text-white">{foreshadow.title}</span>
                <span className="text-xs text-zinc-500 ml-2">{foreshadow.status}</span>
                {foreshadow.content && <p className="text-xs text-zinc-400 mt-1">{foreshadow.content}</p>}
              </>
            )}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
          />
        )}
      </div>
    </div>
  );
};

interface EntityListProps<T extends { id: string }> {
  entities: T[];
  renderEntity: (entity: T) => React.ReactNode;
  expandedItems: Set<string>;
  toggleExpand: (id: string) => void;
}

function EntityList<T extends { id: string }>({
  entities,
  renderEntity,
  expandedItems,
  toggleExpand,
}: EntityListProps<T>) {
  if (entities.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <p className="text-sm">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entities.map((entity) => (
        <div
          key={entity.id}
          className="bg-white/5 rounded-lg border border-white/10 p-3"
        >
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleExpand(entity.id)}
          >
            <div className="flex-1">{renderEntity(entity)}</div>
            {expandedItems.has(entity.id) ? (
              <ChevronDown size={16} className="text-zinc-400" />
            ) : (
              <ChevronRight size={16} className="text-zinc-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
