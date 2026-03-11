import React, { useState, useEffect, useRef } from 'react';
import { useSessionStore, useWorkshopStore, useSkillStore } from '@/store';
import { Plus, Trash2, Settings, Sparkles, BookOpen, Brain, BarChart3, ChevronDown, ChevronRight, Upload, X, Play, Terminal, Search, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKnowledgeService } from '@/hooks/useSystemContext';
import { MemoryType } from '@/types/core/workshop';
import { LongPressMenu } from '@/components/ui/LongPressMenu';

interface SessionListPanelProps {
  isOpen: boolean;
  onOpenSettings: () => void;
  onOpenTerminal: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  isMobile?: boolean;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  isMobile = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("shrink-0", isMobile ? "p-3 pt-0" : "p-2 pt-0")}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors border-white/10 hover:bg-white/5 text-zinc-400",
          isMobile ? "text-base" : "text-sm"
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {isOpen ? (
            <ChevronDown size={isMobile ? 18 : 14} className="shrink-0" />
          ) : (
            <ChevronRight size={isMobile ? 18 : 14} className="shrink-0" />
          )}
          {icon}
          <span className="truncate">{title}</span>
        </div>
      </button>
      {isOpen && children && <div className={cn("overflow-y-auto no-scrollbar mt-1", isMobile ? "max-h-64" : "max-h-48")}>{children}</div>}
    </div>
  );
};

export const SessionListPanel: React.FC<SessionListPanelProps> = ({ isOpen, onOpenSettings, onOpenTerminal, isMobile = false, onClose }) => {
  const { sessions, currentSessionId, switchSession, createSession, deleteSession } =
    useSessionStore();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    skills: workshopSkills,
    scanSkills,
    memory,
    refreshKnowledgeIndex,
    knowledgeIndex,
    init: initWorkshop,
    addMemoryEntry,
    deleteMemoryEntry,
  } = useWorkshopStore();

  const {
    skills: skillFiles,
    init: initSkillStore,
    createSkill,
    runAnalysis,
  } = useSkillStore();

  const knowledgeService = useKnowledgeService();
  
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillContent, setNewSkillContent] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'style' | 'structure' | 'setting' | 'technique' | 'workflow' | 'review' | 'analysis' | 'custom'>('custom');
  
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryType, setNewMemoryType] = useState<MemoryType>('character');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initWorkshop();
    initSkillStore();
    scanSkills();
    refreshKnowledgeIndex();
  }, [initWorkshop, initSkillStore, scanSkills, refreshKnowledgeIndex]);

  const handleSessionClick = (sessionId: string) => {
    switchSession(sessionId);
  };

  const handleNewSession = () => {
    createSession();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        if (knowledgeService) {
          const result = await knowledgeService.addFile(file.name, 'reference', content);
          if (result) {
            console.log('上传成功:', result.filename, '分块数:', result.chunkCount);
          }
        }
      } catch (err) {
        console.error('上传文件失败:', err);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkillName || !newSkillContent) return;
    
    await createSkill({
      meta: {
        id: `skill_${Date.now()}`,
        name: newSkillName,
        version: '1.0.0',
        description: newSkillName,
        category: newSkillCategory,
        tags: [],
      },
      prompt: {
        system: newSkillContent,
      },
      filePath: '',
      rawContent: '',
    });
    
    setNewSkillName('');
    setNewSkillContent('');
    setShowCreateSkill(false);
    scanSkills();
  };

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) return;
    
    await addMemoryEntry({
      type: newMemoryType,
      content: newMemoryContent,
      relevanceScore: 1,
      metadata: {},
    });
    
    setNewMemoryContent('');
    setShowAddMemory(false);
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await runAnalysis();
      await refreshKnowledgeIndex();
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const allSkills = [...workshopSkills, ...skillFiles.map(s => ({ id: s.meta.id, name: s.meta.name, category: s.meta.category, enabled: true }))];
  
  const filteredSessions = sessions.filter(session => 
    session.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn(
      "flex flex-col h-full shrink-0 bg-white/5 overflow-hidden",
      isMobile ? "w-full" : "w-52 lg:w-52 md:w-44 sm:w-36"
    )}>
      <div className={cn("shrink-0 flex items-center gap-2", isMobile ? "p-3 pb-0" : "p-2 pb-0")}>
        <div className="flex-1 relative">
          <Search size={isMobile ? 14 : 12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话"
            className={cn(
              "w-full bg-transparent border border-white/10 rounded-lg pl-7 pr-2 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20",
              isMobile ? "h-9 text-sm" : "h-7 text-xs"
            )}
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-400 shrink-0"
          >
            <PanelLeftClose size={isMobile ? 18 : 14} />
          </button>
        )}
      </div>
      <div className={cn("shrink-0", isMobile ? "p-3" : "p-2")}>
        <button
          onClick={handleNewSession}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors border-white/10 hover:bg-white/5 text-zinc-400",
            isMobile ? "text-sm" : "text-sm"
          )}
        >
          <Plus size={isMobile ? 18 : 14} className="shrink-0" />
          <span className="truncate">新对话</span>
        </button>
      </div>

      <div className={cn("flex-1 overflow-y-auto no-scrollbar", isMobile ? "p-2" : "p-1")}>
        {filteredSessions.map((session) => (
          <LongPressMenu
            key={session.id}
            onDelete={() => deleteSession(session.id)}
            isMobile={isMobile}
          >
            <div
              className={cn(
                'group flex items-center gap-2 px-3 cursor-pointer transition-colors rounded-md',
                isMobile ? "mx-1 py-2.5" : "mx-1 py-1.5",
                currentSessionId === session.id
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'hover:bg-white/5 text-zinc-400'
              )}
              onClick={() => handleSessionClick(session.id)}
            >
              <span className={cn("truncate flex-1", isMobile ? "text-base" : "text-sm")}>{session.name || '新对话'}</span>
              {!isMobile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 text-zinc-500"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </LongPressMenu>
        ))}
      </div>

      <div className="shrink-0 mt-auto space-y-1">
        <Section
          title="技能模板"
          icon={<Sparkles size={isMobile ? 18 : 14} className="text-purple-400 shrink-0" />}
          defaultOpen={false}
          isMobile={isMobile}
        >
          <div className={cn("space-y-1", isMobile ? "px-3" : "px-2")}>
            {allSkills.length === 0 ? (
              <div className={cn("text-zinc-500 px-1 py-1", isMobile ? "text-sm" : "text-[10px]")}>暂无技能模板</div>
            ) : (
              allSkills.slice(0, 5).map((skill) => (
                <div
                  key={skill.id}
                  className={cn(
                    "truncate hover:text-zinc-300 cursor-pointer flex items-center justify-between group",
                    isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
                  )}
                  title={skill.name}
                >
                  <span className="truncate flex-1">{skill.name}</span>
                </div>
              ))
            )}
            <button
              onClick={() => setShowCreateSkill(true)}
              className={cn(
                "w-full flex items-center gap-1 text-zinc-500 hover:text-zinc-300",
                isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
              )}
            >
              <Plus size={isMobile ? 14 : 10} />
              <span>创建模板</span>
            </button>
          </div>
        </Section>

        <Section
          title="资料库"
          icon={<BookOpen size={isMobile ? 18 : 14} className="text-blue-400 shrink-0" />}
          defaultOpen={false}
          isMobile={isMobile}
        >
          <div className={cn("space-y-1", isMobile ? "px-3" : "px-2")}>
            {(() => {
              const knowledgeFiles = knowledgeService?.getAllFiles() || [];
              if (knowledgeFiles.length === 0) {
                return <div className={cn("text-zinc-500 px-1 py-1", isMobile ? "text-sm" : "text-[10px]")}>暂无资料</div>;
              }
              return knowledgeFiles.slice(0, 5).map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "truncate hover:text-zinc-300 cursor-pointer flex items-center justify-between group",
                    isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
                  )}
                  title={file.filename}
                >
                  <span className="truncate flex-1">{file.filename}</span>
                  <span className="text-zinc-600 ml-1">({file.chunkCount}块)</span>
                </div>
              ));
            })()}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full flex items-center gap-1 text-zinc-500 hover:text-zinc-300",
                isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
              )}
            >
              <Upload size={isMobile ? 14 : 10} />
              <span>上传资料</span>
            </button>
          </div>
        </Section>

        <Section
          title="记忆"
          icon={<Brain size={isMobile ? 18 : 14} className="text-green-400 shrink-0" />}
          defaultOpen={false}
          isMobile={isMobile}
        >
          <div className={cn("space-y-1", isMobile ? "px-3" : "px-2")}>
            {memory.length === 0 ? (
              <div className={cn("text-zinc-500 px-1 py-1", isMobile ? "text-sm" : "text-[10px]")}>暂无记忆</div>
            ) : (
              memory.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "hover:text-zinc-300 cursor-pointer flex items-center justify-between group",
                    isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
                  )}
                  title={entry.content.substring(0, 50)}
                >
                  <span className="truncate flex-1">{entry.content.substring(0, 20)}...</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteMemoryEntry(entry.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400"
                  >
                    <X size={isMobile ? 14 : 8} />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => setShowAddMemory(true)}
              className={cn(
                "w-full flex items-center gap-1 text-zinc-500 hover:text-zinc-300",
                isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
              )}
            >
              <Plus size={isMobile ? 14 : 10} />
              <span>添加记忆</span>
            </button>
          </div>
        </Section>

        <Section
          title="项目分析"
          icon={<BarChart3 size={isMobile ? 18 : 14} className="text-orange-400 shrink-0" />}
          defaultOpen={false}
          isMobile={isMobile}
        >
          <div className={cn("space-y-1", isMobile ? "px-3" : "px-2")}>
            {knowledgeIndex.length === 0 ? (
              <div className={cn("text-zinc-500 px-1 py-1", isMobile ? "text-sm" : "text-[10px]")}>暂无分析结果</div>
            ) : (
              <>
                <div className={cn("text-zinc-400 px-1 py-1", isMobile ? "text-sm" : "text-[10px]")}>
                  已分析 {knowledgeIndex.length} 项
                </div>
                {knowledgeIndex.slice(0, 3).map((item, idx) => (
                  <div
                    key={idx}
                    className={cn("truncate", isMobile ? "text-sm px-3 py-2" : "text-[10px] px-1 py-1")}
                    title={item.filename}
                  >
                    {item.type}: {item.filename.substring(0, 15)}...
                  </div>
                ))}
              </>
            )}
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className={cn(
                "w-full flex items-center gap-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-50",
                isMobile ? "text-sm px-3 py-3" : "text-[10px] px-1 py-1"
              )}
            >
              <Play size={isMobile ? 14 : 10} className={isAnalyzing ? 'animate-spin' : ''} />
              <span>{isAnalyzing ? '分析中...' : '运行分析'}</span>
            </button>
          </div>
        </Section>

        <div className={cn("shrink-0", isMobile ? "p-3 pt-0" : "p-2 pt-0")}>
          <button
            onClick={onOpenTerminal}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors border-white/10 hover:bg-white/5 text-zinc-400",
              isMobile ? "text-base" : "text-sm"
            )}
          >
            <Terminal size={isMobile ? 18 : 14} className="shrink-0" />
            <span className="truncate">终端</span>
          </button>
        </div>
        <div className={cn("shrink-0", isMobile ? "p-3 pt-0" : "p-2 pt-0")}>
          <button
            onClick={onOpenSettings}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors border-white/10 hover:bg-white/5 text-zinc-400",
              isMobile ? "text-base" : "text-sm"
            )}
          >
            <Settings size={isMobile ? 18 : 14} className="shrink-0" />
            <span className="truncate">设置</span>
          </button>
        </div>
      </div>

      {showCreateSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center justify-between mb-3">
              <span className={cn("font-medium text-zinc-200", isMobile ? "text-base" : "text-sm")}>创建技能模板</span>
              <button
                onClick={() => setShowCreateSkill(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400"
              >
                <X size={isMobile ? 18 : 14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={cn("text-zinc-400 mb-1 block", isMobile ? "text-sm" : "text-xs")}>模板名称</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className={cn("w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200", isMobile ? "text-sm" : "text-xs")}
                  placeholder="输入模板名称"
                />
              </div>
              <div>
                <label className={cn("text-zinc-400 mb-1 block", isMobile ? "text-sm" : "text-xs")}>模板类型</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value as any)}
                  className={cn("w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200", isMobile ? "text-sm" : "text-xs")}
                >
                  <option value="style">风格</option>
                  <option value="structure">结构</option>
                  <option value="setting">设定</option>
                  <option value="technique">技巧</option>
                  <option value="workflow">工作流</option>
                  <option value="review">审核</option>
                  <option value="analysis">分析</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className={cn("text-zinc-400 mb-1 block", isMobile ? "text-sm" : "text-xs")}>模板内容（系统提示词）</label>
                <textarea
                  value={newSkillContent}
                  onChange={(e) => setNewSkillContent(e.target.value)}
                  className={cn("w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 min-h-[100px] resize-none", isMobile ? "text-sm" : "text-xs")}
                  placeholder="输入模板内容"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateSkill(false)}
                  className={cn("flex-1 px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors", isMobile ? "text-sm" : "text-xs")}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateSkill}
                  disabled={!newSkillName || !newSkillContent}
                  className={cn("flex-1 px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50", isMobile ? "text-sm" : "text-xs")}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddMemory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center justify-between mb-3">
              <span className={cn("font-medium text-zinc-200", isMobile ? "text-base" : "text-sm")}>添加记忆</span>
              <button
                onClick={() => setShowAddMemory(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400"
              >
                <X size={isMobile ? 18 : 14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={cn("text-zinc-400 mb-1 block", isMobile ? "text-sm" : "text-xs")}>记忆类型</label>
                <select
                  value={newMemoryType}
                  onChange={(e) => setNewMemoryType(e.target.value as MemoryType)}
                  className={cn("w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200", isMobile ? "text-sm" : "text-xs")}
                >
                  <option value="character">人物</option>
                  <option value="timeline">时间线</option>
                  <option value="foreshadowing">伏笔</option>
                  <option value="worldbuilding">世界观</option>
                  <option value="style_rule">风格规则</option>
                  <option value="lesson_learned">经验教训</option>
                  <option value="user_preference">用户偏好</option>
                  <option value="project_summary">项目摘要</option>
                </select>
              </div>
              <div>
                <label className={cn("text-zinc-400 mb-1 block", isMobile ? "text-sm" : "text-xs")}>记忆内容</label>
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  className={cn("w-full px-2 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 min-h-[100px] resize-none", isMobile ? "text-sm" : "text-xs")}
                  placeholder="输入记忆内容"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddMemory(false)}
                  className={cn("flex-1 px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors", isMobile ? "text-sm" : "text-xs")}
                >
                  取消
                </button>
                <button
                  onClick={handleAddMemory}
                  disabled={!newMemoryContent.trim()}
                  className={cn("flex-1 px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50", isMobile ? "text-sm" : "text-xs")}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
