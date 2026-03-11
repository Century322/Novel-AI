import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';
import {
  ToolDefinition,
  ToolHandler,
  ToolContext,
  ToolRegistryEntry,
  ToolResult,
  ToolCall,
} from '@/types/ai/tools';
import { MemoryService } from '../knowledge/memoryService';
import { KnowledgeService } from '../knowledge/knowledgeService';
import { ContextCompressionService } from '../knowledge/contextCompressionService';
import { AuthorStyleLearningService } from '../style/authorStyleLearningService';
import { QualityService } from '../analysis/qualityService';
import { llmService } from '../ai/llmService';
import { CharacterService } from '../character/characterService';
import { CharacterArcService } from '../character/characterArcService';
import { BehaviorConsistencyService } from '../character/behaviorConsistencyService';
import { EmotionAuthenticityService } from '../character/emotionAuthenticityService';
import { TimelineService } from '../plot/timelineService';
import { ForeshadowingService } from '../plot/foreshadowingService';
import { ConflictDetectionService } from '../plot/conflictDetectionService';
import { SubplotManagementService } from '../plot/subplotManagementService';
import { ForeshadowingStatus } from '@/types/plot/foreshadowing';
import type { WorldModelService } from '../world/worldModelService';
import type { WorldBuildingService } from '../worldbuilding/worldBuildingService';
import type { SettingExtractionService } from '../extraction/settingExtractionService';
import type { NovelBibleService } from '../world/novelBibleService';
import type {
  NovelBibleCharacter,
  NovelBibleForeshadowing,
  NovelBibleMetadata,
  NovelBibleTimelineEvent,
  NovelBibleTimelineTrack,
} from '@/types/world/novelBible';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private memoryService: MemoryService | null = null;
  private knowledgeService: KnowledgeService | null = null;
  private compressionService: ContextCompressionService | null = null;
  private styleService: AuthorStyleLearningService | null = null;
  private qualityService: QualityService | null = null;
  private characterService: CharacterService | null = null;
  private characterArcService: CharacterArcService | null = null;
  private behaviorConsistencyService: BehaviorConsistencyService | null = null;
  private emotionAuthenticityService: EmotionAuthenticityService | null = null;
  private timelineService: TimelineService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private conflictDetectionService: ConflictDetectionService | null = null;
  private subplotManagementService: SubplotManagementService | null = null;
  private worldModelService: WorldModelService | null = null;
  private worldBuildingService: WorldBuildingService | null = null;
  private settingExtractionService: SettingExtractionService | null = null;
  private novelBibleService: NovelBibleService | null = null;

  constructor(_projectPath: string) {
    this.registerBuiltinTools();
  }

  setMemoryService(service: MemoryService): void {
    this.memoryService = service;
  }

  setKnowledgeService(service: KnowledgeService): void {
    this.knowledgeService = service;
  }

  setCompressionService(service: ContextCompressionService): void {
    this.compressionService = service;
  }

  setStyleService(service: AuthorStyleLearningService): void {
    this.styleService = service;
  }

  setQualityService(service: QualityService): void {
    this.qualityService = service;
  }

  setCharacterService(service: CharacterService): void {
    this.characterService = service;
  }

  setCharacterArcService(service: CharacterArcService): void {
    this.characterArcService = service;
  }

  setBehaviorConsistencyService(service: BehaviorConsistencyService): void {
    this.behaviorConsistencyService = service;
  }

  setEmotionAuthenticityService(service: EmotionAuthenticityService): void {
    this.emotionAuthenticityService = service;
  }

  setTimelineService(service: TimelineService): void {
    this.timelineService = service;
  }

  setForeshadowingService(service: ForeshadowingService): void {
    this.foreshadowingService = service;
  }

  setConflictDetectionService(service: ConflictDetectionService): void {
    this.conflictDetectionService = service;
  }

  setSubplotManagementService(service: SubplotManagementService): void {
    this.subplotManagementService = service;
  }

  setWorldModelService(service: WorldModelService): void {
    this.worldModelService = service;
  }

  setWorldBuildingService(service: WorldBuildingService): void {
    this.worldBuildingService = service;
  }

  setSettingExtractionService(service: SettingExtractionService): void {
    this.settingExtractionService = service;
  }

  setNovelBibleService(service: NovelBibleService): void {
    this.novelBibleService = service;
  }

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, {
      definition,
      handler,
      registeredAt: Date.now(),
      callCount: 0,
    });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ToolRegistryEntry[] {
    return Array.from(this.tools.values()).filter(
      (entry) => entry.definition.category === category
    );
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((entry) => entry.definition);
  }

  private registerBuiltinTools(): void {
    this.register(
      {
        name: 'read_file',
        description: '读取项目中的文件内容',
        parameters: {
          path: { type: 'string', description: '文件路径', required: true },
        },
        required: ['path'],
        category: 'file',
      },
      this.readFile.bind(this)
    );

    this.register(
      {
        name: 'write_file',
        description: '写入内容到项目文件',
        parameters: {
          path: { type: 'string', description: '文件路径', required: true },
          content: { type: 'string', description: '内容', required: true },
        },
        required: ['path', 'content'],
        category: 'file',
        dangerous: true,
      },
      this.writeFile.bind(this)
    );

    this.register(
      {
        name: 'delete_file',
        description: '删除项目中的文件',
        parameters: {
          path: { type: 'string', description: '文件路径', required: true },
        },
        required: ['path'],
        category: 'file',
        dangerous: true,
      },
      this.deleteFile.bind(this)
    );

    this.register(
      {
        name: 'list_directory',
        description: '列出目录内容',
        parameters: {
          path: { type: 'string', description: '目录路径', default: '.' },
          recursive: { type: 'boolean', description: '递归', default: false },
        },
        category: 'file',
      },
      this.listDirectory.bind(this)
    );

    this.register(
      {
        name: 'search_content',
        description: '搜索文件内容',
        parameters: {
          query: { type: 'string', description: '搜索词', required: true },
          maxResults: { type: 'number', description: '最大结果数', default: 10 },
        },
        required: ['query'],
        category: 'search',
      },
      this.searchContent.bind(this)
    );

    this.register(
      {
        name: 'search_knowledge',
        description: '搜索资料库内容，返回相关文本片段。用于快速查找特定信息。',
        parameters: {
          query: { type: 'string', description: '搜索关键词', required: true },
          maxResults: { type: 'number', description: '最大结果数', default: 5 },
        },
        required: ['query'],
        category: 'search',
      },
      this.searchKnowledge.bind(this)
    );

    this.register(
      {
        name: 'get_knowledge_content',
        description: '获取资料库中某个文件的完整内容。用于学习写作风格、分析全文等需要完整内容的场景。返回文件的所有分块合并后的完整文本。',
        parameters: {
          filename: { type: 'string', description: '文件名', required: true },
        },
        required: ['filename'],
        category: 'search',
      },
      this.getKnowledgeContent.bind(this)
    );

    this.register(
      {
        name: 'get_character_info',
        description: '获取人物信息',
        parameters: {
          name: { type: 'string', description: '人物名称', required: true },
        },
        required: ['name'],
        category: 'novel',
      },
      this.getCharacterInfo.bind(this)
    );

    this.register(
      {
        name: 'add_character',
        description: '添加人物',
        parameters: {
          name: { type: 'string', description: '名称', required: true },
          role: { type: 'string', description: '角色类型', default: 'supporting' },
          description: { type: 'string', description: '描述' },
          traits: { type: 'array', description: '特质' },
        },
        required: ['name'],
        category: 'novel',
      },
      this.addCharacter.bind(this)
    );

    this.register(
      {
        name: 'get_timeline',
        description: '获取时间线',
        parameters: {
          startChapter: { type: 'string', description: '起始章节' },
          endChapter: { type: 'string', description: '结束章节' },
        },
        category: 'novel',
      },
      this.getTimeline.bind(this)
    );

    this.register(
      {
        name: 'add_plot_event',
        description: '添加情节事件',
        parameters: {
          chapter: { type: 'string', description: '章节', required: true },
          event: { type: 'string', description: '事件', required: true },
          characters: { type: 'array', description: '涉及人物' },
        },
        required: ['chapter', 'event'],
        category: 'novel',
      },
      this.addPlotEvent.bind(this)
    );

    this.register(
      {
        name: 'add_foreshadowing',
        description: '添加伏笔',
        parameters: {
          content: { type: 'string', description: '伏笔内容', required: true },
          plantedAt: { type: 'string', description: '埋设位置', required: true },
        },
        required: ['content', 'plantedAt'],
        category: 'novel',
      },
      this.addForeshadowing.bind(this)
    );

    this.register(
      {
        name: 'analyze_content',
        description: '分析内容质量',
        parameters: {
          content: { type: 'string', description: '内容', required: true },
        },
        required: ['content'],
        category: 'analysis',
      },
      this.analyzeContent.bind(this)
    );

    this.register(
      {
        name: 'get_writing_context',
        description: '获取写作上下文',
        parameters: {
          focusCharacter: { type: 'string', description: '聚焦人物' },
          maxTokens: { type: 'number', description: '最大Token', default: 4000 },
        },
        category: 'context',
      },
      this.getWritingContext.bind(this)
    );

    this.register(
      {
        name: 'learn_style',
        description: '学习写作风格',
        parameters: {
          content: { type: 'string', description: '学习样本', required: true },
        },
        required: ['content'],
        category: 'style',
      },
      this.learnStyle.bind(this)
    );

    this.register(
      {
        name: 'generate_content',
        description: '生成小说内容',
        parameters: {
          prompt: { type: 'string', description: '提示', required: true },
          length: { type: 'number', description: '长度', default: 500 },
        },
        required: ['prompt'],
        category: 'generation',
      },
      this.generateContent.bind(this)
    );

    this.register(
      {
        name: 'continue_writing',
        description: '续写内容',
        parameters: {
          context: { type: 'string', description: '前文', required: true },
          length: { type: 'number', description: '长度', default: 300 },
        },
        required: ['context'],
        category: 'generation',
      },
      this.continueWriting.bind(this)
    );

    this.register(
      {
        name: 'revise_content',
        description: '修改内容',
        parameters: {
          content: { type: 'string', description: '内容', required: true },
          instructions: { type: 'string', description: '指令', required: true },
        },
        required: ['content', 'instructions'],
        category: 'generation',
      },
      this.reviseContent.bind(this)
    );

    this.register(
      {
        name: 'detect_conflicts',
        description: '检测情节冲突和矛盾',
        parameters: {
          chapter: { type: 'number', description: '章节号' },
          content: { type: 'string', description: '内容' },
        },
        category: 'analysis',
      },
      this.detectConflicts.bind(this)
    );

    this.register(
      {
        name: 'check_foreshadowing',
        description: '检查伏笔状态',
        parameters: {
          status: { type: 'string', description: '状态筛选: planted, resolved, abandoned' },
        },
        category: 'novel',
      },
      this.checkForeshadowing.bind(this)
    );

    this.register(
      {
        name: 'get_character_arc',
        description: '获取角色成长弧线',
        parameters: {
          characterId: { type: 'string', description: '角色ID', required: true },
        },
        required: ['characterId'],
        category: 'novel',
      },
      this.getCharacterArc.bind(this)
    );

    this.register(
      {
        name: 'analyze_emotion_authenticity',
        description: '分析情感真实性',
        parameters: {
          characterId: { type: 'string', description: '角色ID', required: true },
        },
        required: ['characterId'],
        category: 'analysis',
      },
      this.analyzeEmotionAuthenticity.bind(this)
    );

    this.register(
      {
        name: 'check_behavior_consistency',
        description: '检查角色行为一致性',
        parameters: {
          characterId: { type: 'string', description: '角色ID', required: true },
        },
        required: ['characterId'],
        category: 'analysis',
      },
      this.checkBehaviorConsistency.bind(this)
    );

    this.register(
      {
        name: 'get_subplot_status',
        description: '获取支线剧情状态',
        parameters: {
          subplotId: { type: 'string', description: '支线ID' },
        },
        category: 'novel',
      },
      this.getSubplotStatus.bind(this)
    );

    this.register(
      {
        name: 'simulate_reader_feedback',
        description: '模拟读者反馈',
        parameters: {
          content: { type: 'string', description: '内容', required: true },
          readerType: {
            type: 'string',
            description: '读者类型: casual, avid, critical, genre_fan',
          },
        },
        required: ['content'],
        category: 'analysis',
      },
      this.simulateReaderFeedback.bind(this)
    );

    this.register(
      {
        name: 'get_writing_guide',
        description: '获取写作指导',
        parameters: {
          type: {
            type: 'string',
            description:
              '指导类型: plot_structure, character_development, dialogue_writing, scene_description, pacing_control, emotion_expression',
          },
        },
        category: 'guide',
      },
      this.getWritingGuide.bind(this)
    );

    this.register(
      {
        name: 'assess_quality',
        description: '评估内容质量',
        parameters: {
          content: { type: 'string', description: '内容', required: true },
          dimensions: { type: 'array', description: '评估维度' },
        },
        required: ['content'],
        category: 'analysis',
      },
      this.assessQuality.bind(this)
    );

    this.register(
      {
        name: 'get_visualization_data',
        description: '获取可视化数据',
        parameters: {
          type: { type: 'string', description: '类型: timeline, characters, plot' },
        },
        category: 'visualization',
      },
      this.getVisualizationData.bind(this)
    );

    this.register(
      {
        name: 'suggest_perspective_switch',
        description: '建议视角切换',
        parameters: {
          content: { type: 'string', description: '当前内容', required: true },
          chapter: { type: 'number', description: '章节号', required: true },
        },
        required: ['content', 'chapter'],
        category: 'novel',
      },
      this.suggestPerspectiveSwitch.bind(this)
    );

    this.register(
      {
        name: 'check_world_completeness',
        description: '检查世界模型完整度，返回缺失的设定和建议',
        parameters: {},
        category: 'worldbuilding',
      },
      this.checkWorldCompleteness.bind(this)
    );

    this.register(
      {
        name: 'extract_settings',
        description: '从用户输入中提取设定信息（人物、世界观、伏笔等）',
        parameters: {
          input: { type: 'string', description: '用户输入的灵感描述', required: true },
          autoSave: { type: 'boolean', description: '是否自动保存到世界模型', default: true },
        },
        required: ['input'],
        category: 'worldbuilding',
      },
      this.extractSettings.bind(this)
    );

    this.register(
      {
        name: 'build_world',
        description: '从用户输入构建完整的世界模型，包括人物、世界观、大纲',
        parameters: {
          input: { type: 'string', description: '用户输入的灵感描述', required: true },
          generateOutline: { type: 'boolean', description: '是否生成大纲', default: true },
          targetWordCount: { type: 'number', description: '目标字数', default: 100000 },
        },
        required: ['input'],
        category: 'worldbuilding',
      },
      this.buildWorld.bind(this)
    );

    this.register(
      {
        name: 'get_world_context',
        description: '获取世界模型上下文，用于生成内容时注入设定',
        parameters: {
          chapterId: { type: 'string', description: '章节ID（可选）' },
        },
        category: 'worldbuilding',
      },
      this.getWorldContext.bind(this)
    );

    this.register(
      {
        name: 'suggest_next_steps',
        description: '根据当前世界模型状态，建议下一步操作',
        parameters: {},
        category: 'worldbuilding',
      },
      this.suggestNextSteps.bind(this)
    );

    this.register(
      {
        name: 'get_novel_bible',
        description: '获取小说圣经结构化数据，可按 section 提取',
        parameters: {
          section: {
            type: 'string',
            description:
              '可选 section: metadata/world/characters/relationships/timelineTracks/foreshadowing/notes',
          },
        },
        category: 'worldbuilding',
      },
      this.getNovelBible.bind(this)
    );

    this.register(
      {
        name: 'update_novel_bible_meta',
        description: '更新小说圣经元信息（标题、类型、目标字数等）',
        parameters: {
          updates: { type: 'object', description: '元信息更新对象', required: true },
        },
        required: ['updates'],
        category: 'worldbuilding',
      },
      this.updateNovelBibleMeta.bind(this)
    );

    this.register(
      {
        name: 'upsert_bible_character',
        description: '新增或更新小说圣经角色',
        parameters: {
          character: { type: 'object', description: '角色对象', required: true },
        },
        required: ['character'],
        category: 'worldbuilding',
      },
      this.upsertBibleCharacter.bind(this)
    );

    this.register(
      {
        name: 'upsert_bible_timeline_track',
        description: '新增或更新时间线轨道',
        parameters: {
          track: { type: 'object', description: '轨道对象', required: true },
        },
        required: ['track'],
        category: 'worldbuilding',
      },
      this.upsertBibleTimelineTrack.bind(this)
    );

    this.register(
      {
        name: 'upsert_bible_timeline_event',
        description: '向指定时间线轨道新增或更新事件',
        parameters: {
          trackId: { type: 'string', description: '轨道ID', required: true },
          event: { type: 'object', description: '事件对象', required: true },
        },
        required: ['trackId', 'event'],
        category: 'worldbuilding',
      },
      this.upsertBibleTimelineEvent.bind(this)
    );

    this.register(
      {
        name: 'upsert_bible_foreshadowing',
        description: '新增或更新小说圣经伏笔',
        parameters: {
          foreshadowing: { type: 'object', description: '伏笔对象', required: true },
        },
        required: ['foreshadowing'],
        category: 'worldbuilding',
      },
      this.upsertBibleForeshadowing.bind(this)
    );

    this.register(
      {
        name: 'validate_novel_bible',
        description: '执行小说圣经结构校验并返回问题清单',
        parameters: {},
        category: 'analysis',
      },
      this.validateNovelBible.bind(this)
    );

    this.register(
      {
        name: 'get_novel_bible_context',
        description: '生成用于写作注入的小说圣经上下文',
        parameters: {
          maxCharacters: { type: 'number', description: '最多注入角色数' },
          maxTracks: { type: 'number', description: '最多注入时间线数' },
          maxForeshadowing: { type: 'number', description: '最多注入伏笔数' },
        },
        category: 'context',
      },
      this.getNovelBibleContext.bind(this)
    );

    this.register(
      {
        name: 'analyze_scene_style',
        description: '分析文本片段的场景类型和写作意图',
        parameters: {
          content: { type: 'string', description: '要分析的文本内容', required: true },
        },
        required: ['content'],
        category: 'style',
      },
      this.analyzeSceneStyle.bind(this)
    );

    this.register(
      {
        name: 'get_style_constraints',
        description: '获取特定场景类型的风格约束',
        parameters: {
          sceneType: { type: 'string', description: '场景类型', required: true },
          intents: { type: 'string', description: '写作意图列表，逗号分隔' },
        },
        required: ['sceneType'],
        category: 'style',
      },
      this.getStyleConstraints.bind(this)
    );

    this.register(
      {
        name: 'add_reference_passage',
        description: '添加参考范文用于风格学习',
        parameters: {
          content: { type: 'string', description: '范文内容', required: true },
          sceneType: { type: 'string', description: '场景类型' },
          source: { type: 'string', description: '来源' },
        },
        required: ['content'],
        category: 'style',
      },
      this.addReferencePassage.bind(this)
    );

    this.register(
      {
        name: 'build_style_prompt',
        description: '构建风格约束提示词，用于生成内容时注入',
        parameters: {
          sceneType: { type: 'string', description: '场景类型', required: true },
          intents: { type: 'string', description: '写作意图，逗号分隔' },
          context: { type: 'string', description: '当前上下文' },
        },
        required: ['sceneType'],
        category: 'style',
      },
      this.buildStylePrompt.bind(this)
    );
  }

  private async readFile(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      const path = args.path as string;
      const exists = await workshopService.pathExists(path);
      if (!exists) {
        return { toolCallId: generateId(), success: false, error: `File not found: ${path}` };
      }
      const content = await workshopService.readFile(path);
      return { toolCallId: generateId(), success: true, result: content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async writeFile(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const path = args.path as string;
      const content = args.content as string;
      await workshopService.writeFile(path, content);
      return { toolCallId: generateId(), success: true, result: { path, size: content.length } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async deleteFile(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const path = args.path as string;
      await workshopService.deleteFile(path);
      return { toolCallId: generateId(), success: true, result: { deleted: path } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async listDirectory(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const path = (args.path as string) || '.';
      const entries = await workshopService.readDirectory(path);
      return { toolCallId: generateId(), success: true, result: entries };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async searchContent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const query = args.query as string;
      const maxResults = (args.maxResults as number) || 10;
      if (this.knowledgeService) {
        const results = this.knowledgeService.search({ query, limit: maxResults });
        return { toolCallId: generateId(), success: true, result: results };
      }
      return { toolCallId: generateId(), success: false, error: 'Knowledge service not available' };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async searchKnowledge(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const query = args.query as string;
      const maxResults = (args.maxResults as number) || 5;
      if (!this.knowledgeService) {
        return { toolCallId: generateId(), success: false, error: 'Knowledge service not available' };
      }
      const results = this.knowledgeService.search({ query, limit: maxResults });
      const content = results.map((r) => `【相关度: ${r.score.toFixed(2)}】\n${r.chunk.content}`).join('\n\n---\n\n');
      return { toolCallId: generateId(), success: true, result: content || '未找到相关内容' };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getKnowledgeContent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const filename = args.filename as string;
      
      if (!this.knowledgeService) {
        return { toolCallId: generateId(), success: false, error: 'Knowledge service not available' };
      }
      
      const files = this.knowledgeService.getAllFiles();
      
      const file = files.find((f: { filename: string }) => f.filename === filename);
      if (!file) {
        return { toolCallId: generateId(), success: false, error: `文件 "${filename}" 不在资料库中` };
      }
      
      const chunks = this.knowledgeService.getChunks(file.id);
      
      if (chunks.length === 0) {
        return { toolCallId: generateId(), success: false, error: `文件 "${filename}" 没有内容分块` };
      }
      
      const content = chunks.map((c: { content: string }) => c.content).join('\n\n');
      
      return { toolCallId: generateId(), success: true, result: content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getCharacterInfo(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const name = args.name as string;

      if (this.characterService) {
        const character = this.characterService.getCharacterByName(name);
        if (character) {
          return { toolCallId: generateId(), success: true, result: character };
        }
      }

      if (!this.memoryService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Character service not available',
        };
      }
      const characters = this.memoryService.getCharacters();
      const character = characters.find((c) => c.name === name || c.aliases.includes(name));
      if (!character) {
        return { toolCallId: generateId(), success: false, error: `Character not found: ${name}` };
      }
      return { toolCallId: generateId(), success: true, result: character };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async addCharacter(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.memoryService) {
        return { toolCallId: generateId(), success: false, error: 'Memory service not available' };
      }
      const entry = await this.memoryService.addCharacterMemory({
        name: args.name as string,
        role: (args.role as 'protagonist' | 'antagonist' | 'supporting' | 'minor') || 'supporting',
        description: (args.description as string) || '',
        aliases: [],
        traits: (args.traits as string[]) || [],
        relationships: [],
        firstAppear: '工具添加',
        lastMention: '工具添加',
        arc: [],
      });
      return { toolCallId: generateId(), success: true, result: { id: entry.id, name: args.name } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getTimeline(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (this.timelineService) {
        let events = this.timelineService.getAllEvents();
        if (args.startChapter) {
          events = events.filter(
            (e) => e.storyTime && e.storyTime >= (args.startChapter as string)
          );
        }
        if (args.endChapter) {
          events = events.filter((e) => e.storyTime && e.storyTime <= (args.endChapter as string));
        }
        return { toolCallId: generateId(), success: true, result: events };
      }

      if (!this.memoryService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Timeline service not available',
        };
      }
      let timeline = this.memoryService.getTimeline();
      if (args.startChapter) {
        timeline = timeline.filter((e) => e.chapter >= (args.startChapter as string));
      }
      if (args.endChapter) {
        timeline = timeline.filter((e) => e.chapter <= (args.endChapter as string));
      }
      return { toolCallId: generateId(), success: true, result: timeline };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async addPlotEvent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.memoryService) {
        return { toolCallId: generateId(), success: false, error: 'Memory service not available' };
      }
      const entry = await this.memoryService.addTimelineEvent({
        chapter: args.chapter as string,
        time: '',
        event: args.event as string,
        characters: (args.characters as string[]) || [],
        importance: 'minor',
        relatedEvents: [],
      });
      return {
        toolCallId: generateId(),
        success: true,
        result: { id: entry.id, event: args.event },
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async addForeshadowing(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.memoryService) {
        return { toolCallId: generateId(), success: false, error: 'Memory service not available' };
      }
      const entry = await this.memoryService.addForeshadowing({
        content: args.content as string,
        plantedAt: args.plantedAt as string,
        relatedCharacters: [],
        importance: 0.5,
        status: 'planted',
      });
      return {
        toolCallId: generateId(),
        success: true,
        result: { id: entry.id, content: args.content },
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async analyzeContent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const content = args.content as string;

      if (!this.qualityService) {
        const prompt = `请分析以下小说内容质量，并给出结构化建议：

${content}

请至少覆盖以下维度：
1. 情节连贯性
2. 人物一致性
3. 语言表现力
4. 节奏控制
5. 可执行改进建议

请用 JSON 返回：{"summary":"...","scores":{"plot":0-1,"character":0-1,"language":0-1,"pacing":0-1},"issues":[...],"suggestions":[...]}`;
        const response = await llmService.chat({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          maxTokens: 800,
        });
        return { toolCallId: generateId(), success: true, result: response.content };
      }
      const assessment = await this.qualityService.assessContent(content);
      return { toolCallId: generateId(), success: true, result: assessment };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getWritingContext(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.compressionService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Compression service not available',
        };
      }
      const context = await this.compressionService.compress({
        maxTokens: (args.maxTokens as number) || 4000,
        focusCharacter: args.focusCharacter as string,
      });
      return { toolCallId: generateId(), success: true, result: context };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async learnStyle(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.styleService) {
        return { toolCallId: generateId(), success: false, error: 'Style service not available' };
      }
      const session = await this.styleService.learnFromContent(args.content as string);
      return { toolCallId: generateId(), success: true, result: { sessionId: session.id } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async generateContent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      let systemPrompt = '你是一个专业的小说写作助手。';
      if (this.styleService) {
        const stylePrompt = this.styleService.generateStylePrompt();
        if (stylePrompt) {
          systemPrompt += '\n\n' + stylePrompt;
        }
      }
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: args.prompt as string },
        ],
        maxTokens: (args.length as number) || 500,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async continueWriting(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const prompt = `请续写以下内容：\n\n${args.context}\n\n请继续写：`;
      let systemPrompt = '你是一个专业的小说写作助手。';
      if (this.styleService) {
        const stylePrompt = this.styleService.generateStylePrompt();
        if (stylePrompt) {
          systemPrompt += '\n\n' + stylePrompt;
        }
      }
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        maxTokens: (args.length as number) || 300,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async reviseContent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const prompt = `请根据以下指令修改内容：\n\n原文：\n${args.content}\n\n修改指令：\n${args.instructions}\n\n请输出修改后的内容：`;
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: '你是一个专业的小说编辑助手。' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1000,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async detectConflicts(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const chapter = args.chapter as number | undefined;
      const content = args.content as string | undefined;

      if (this.conflictDetectionService) {
        if (chapter !== undefined) {
          const allConflicts = this.conflictDetectionService.getAllConflicts();
          const conflicts = allConflicts.filter(
            (c) =>
              c.source.location?.includes(`第${chapter}章`) ||
              c.source.location?.includes(`chapter ${chapter}`)
          );
          return { toolCallId: generateId(), success: true, result: conflicts };
        }
        const allConflicts = this.conflictDetectionService.getAllConflicts();
        return { toolCallId: generateId(), success: true, result: allConflicts };
      }

      if (this.timelineService && content) {
        const events = this.timelineService.getAllEvents();
        return {
          toolCallId: generateId(),
          success: true,
          result: {
            message: '时间线冲突检测',
            events: events.slice(0, 10),
            total: events.length,
          },
        };
      }

      const prompt = `分析以下小说内容中的情节冲突和矛盾：

${content || '请分析指定章节'}

请检查：
1. 时间线矛盾
2. 人物行为不一致
3. 设定冲突
4. 逻辑漏洞

以JSON格式返回检测结果：{
  "conflicts": [
    {"type": "类型", "description": "描述", "severity": "critical/major/minor", "suggestion": "建议"}
  ]
}`;
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 800,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async checkForeshadowing(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (this.foreshadowingService) {
        const status = args.status as ForeshadowingStatus | undefined;
        const foreshadowings = status
          ? this.foreshadowingService.getByStatus(status)
          : this.foreshadowingService.getAllForeshadowings();
        return { toolCallId: generateId(), success: true, result: foreshadowings };
      }

      if (!this.memoryService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Foreshadowing service not available',
        };
      }
      const foreshadowing = this.memoryService.getForeshadowing();
      const status = args.status as string;
      const filtered = status ? foreshadowing.filter((f) => f.status === status) : foreshadowing;
      return { toolCallId: generateId(), success: true, result: filtered };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getCharacterArc(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const characterId = args.characterId as string;

      if (this.characterArcService) {
        const arcs = this.characterArcService.getArcsByCharacter(characterId);
        if (arcs && arcs.length > 0) {
          return { toolCallId: generateId(), success: true, result: arcs[0] };
        }
      }

      if (this.characterService) {
        const character =
          this.characterService.getCharacter(characterId) ||
          this.characterService.getCharacterByName(characterId);
        if (character) {
          return {
            toolCallId: generateId(),
            success: true,
            result: {
              characterId: character.id,
              characterName: character.name,
              arc: character.arc || [],
              message: '角色成长弧线数据',
            },
          };
        }
      }

      if (!this.memoryService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Character service not available',
        };
      }

      const characters = this.memoryService.getCharacters();
      const character = characters.find((c) => c.id === characterId || c.name === characterId);

      if (!character) {
        return {
          toolCallId: generateId(),
          success: false,
          error: `Character not found: ${characterId}`,
        };
      }

      return {
        toolCallId: generateId(),
        success: true,
        result: {
          characterId: character.id,
          characterName: character.name,
          arc: character.arc || [],
          message: '角色成长弧线数据',
        },
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async analyzeEmotionAuthenticity(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const characterId = args.characterId as string;

      if (this.emotionAuthenticityService) {
        const profile = this.emotionAuthenticityService.getCharacterProfile(characterId);
        if (profile) {
          const analysis = this.emotionAuthenticityService.analyzeCharacter(characterId);
          return { toolCallId: generateId(), success: true, result: { profile, analysis } };
        }
      }

      const prompt = `分析角色"${characterId}"的情感真实性。

请评估以下方面：
1. 情感转换是否合理
2. 情感强度是否适当
3. 情感表现是否自然

以JSON格式返回：{
  "characterId": "角色ID",
  "authenticityScore": 0.85,
  "analysis": {
    "transitionRationality": {"score": 0.9, "comment": "评价"},
    "intensityAppropriateness": {"score": 0.8, "comment": "评价"},
    "expressionNaturalness": {"score": 0.85, "comment": "评价"}
  },
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`;

      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        maxTokens: 600,
      });

      return {
        toolCallId: generateId(),
        success: true,
        result: response.content,
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async checkBehaviorConsistency(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const characterId = args.characterId as string;

      if (this.behaviorConsistencyService) {
        const analysis = this.behaviorConsistencyService.analyzeCharacter(characterId);
        if (analysis) {
          return { toolCallId: generateId(), success: true, result: analysis };
        }
      }

      if (this.characterService) {
        const character =
          this.characterService.getCharacter(characterId) ||
          this.characterService.getCharacterByName(characterId);
        if (character) {
          return {
            toolCallId: generateId(),
            success: true,
            result: {
              characterId: character.id,
              characterName: character.name,
              traits: character.personality?.traits || [],
              consistencyScore: 0.85,
              message: '角色行为一致性数据',
            },
          };
        }
      }

      const prompt = `检查角色"${characterId}"的行为一致性。

请检查以下方面：
1. 性格一致性
2. 语言风格一致性
3. 情感反应一致性
4. 决策理性

以JSON格式返回：{
  "characterId": "角色ID",
  "consistencyScore": 0.88,
  "checks": {
    "personalityConsistency": {"score": 0.9, "issues": []},
    "speechPatternConsistency": {"score": 0.85, "issues": ["问题"]},
    "emotionalResponseConsistency": {"score": 0.9, "issues": []},
    "decisionRationality": {"score": 0.87, "issues": []}
  },
  "overallAssessment": "总体评价"
}`;

      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        maxTokens: 600,
      });

      return {
        toolCallId: generateId(),
        success: true,
        result: response.content,
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getSubplotStatus(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const subplotId = args.subplotId as string | undefined;

      if (this.subplotManagementService) {
        if (subplotId) {
          const subplot = this.subplotManagementService.getSubplot(subplotId);
          if (subplot) {
            return { toolCallId: generateId(), success: true, result: subplot };
          }
        } else {
          const subplots = this.subplotManagementService.getAllSubplots();
          return { toolCallId: generateId(), success: true, result: subplots };
        }
      }

      const prompt = subplotId
        ? `获取支线剧情"${subplotId}"的详细状态。包括：进度、关联角色、关键节点、待解决问题。`
        : '列出所有支线剧情的状态概览。包括：名称、状态、进度百分比、主要角色。';

      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 500,
      });

      return {
        toolCallId: generateId(),
        success: true,
        result: response.content,
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async simulateReaderFeedback(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const readerType = (args.readerType as string) || 'casual';
      const readerProfiles: Record<string, string> = {
        casual: '休闲读者，喜欢轻松有趣的剧情，对复杂设定不太感兴趣',
        avid: '资深读者，注重逻辑和世界观，讨厌烂尾',
        critical: '挑剔读者，关注人物深度和文笔',
        genre_fan: '类型爱好者，熟悉套路，喜欢创新',
      };

      const prompt = `作为一个${readerProfiles[readerType] || readerProfiles.casual}，评价以下小说内容：

${args.content}

请提供：
1. 总体印象（1-10分）
2. 最喜欢的部分
3. 不喜欢的部分
4. 改进建议`;

      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 500,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getWritingGuide(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const guides: Record<string, { title: string; tips: string[] }> = {
        plot_structure: {
          title: '情节结构指导',
          tips: [
            '开篇要抓住读者注意力',
            '冲突是推动故事发展的核心动力',
            '高潮前的铺垫要充分',
            '结局要合理且令人满意',
          ],
        },
        character_development: {
          title: '角色塑造指导',
          tips: [
            '角色要有明确的动机和目标',
            '角色需要有缺点和成长空间',
            '通过行动而非描述来展现性格',
            '角色之间的关系要有层次',
          ],
        },
        dialogue_writing: {
          title: '对话写作指导',
          tips: [
            '对话要推动情节或展现角色',
            '每句话要有说话者的特点',
            '避免信息倾倒式对话',
            '适当使用潜台词',
          ],
        },
        scene_description: {
          title: '场景描写指导',
          tips: [
            '调动读者的多种感官',
            '描写要服务于情节和氛围',
            '避免过度描写',
            '用细节而非形容词来展现',
          ],
        },
        pacing_control: {
          title: '节奏控制指导',
          tips: [
            '紧张与舒缓交替',
            '重要场景放慢节奏',
            '过渡场景简洁处理',
            '根据情节需要调整段落长度',
          ],
        },
        emotion_expression: {
          title: '情感表达指导',
          tips: ['展示而非讲述情感', '通过细节传达情绪', '情感变化要有铺垫', '避免过度煽情'],
        },
      };

      const type = args.type as string;
      const guide = guides[type] || guides.plot_structure;
      return { toolCallId: generateId(), success: true, result: guide };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async assessQuality(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.qualityService) {
        const prompt = `评估以下小说内容的质量：

${args.content}

请从以下维度评分（1-10分）：
1. 情节吸引力
2. 人物塑造
3. 对话自然度
4. 描写生动性
5. 节奏把控
6. 情感表达
7. 语言流畅度
8. 创新程度

以JSON格式返回：{"scores": {...}, "overall": 总分, "summary": "总结"}`;
        const response = await llmService.chat({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          maxTokens: 500,
        });
        return { toolCallId: generateId(), success: true, result: response.content };
      }
      const assessment = await this.qualityService.assessContent(args.content as string);
      return { toolCallId: generateId(), success: true, result: assessment };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getVisualizationData(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const type = (args.type as string) || 'timeline';

      let result: Record<string, unknown> = { type };

      switch (type) {
        case 'timeline':
          if (this.timelineService) {
            const events = this.timelineService.getAllEvents();
            result = {
              type,
              events,
              totalCount: events.length,
              message: '时间线可视化数据',
            };
          } else if (this.memoryService) {
            const timeline = this.memoryService.getTimeline();
            result = {
              type,
              events: timeline,
              totalCount: timeline.length,
              message: '时间线可视化数据',
            };
          }
          break;

        case 'characters':
          if (this.characterService) {
            const characters = this.characterService.getAllCharacters();
            result = {
              type,
              characters,
              totalCount: characters.length,
              message: '角色可视化数据',
            };
          } else if (this.memoryService) {
            const characters = this.memoryService.getCharacters();
            result = {
              type,
              characters,
              totalCount: characters.length,
              message: '角色可视化数据',
            };
          }
          break;

        case 'relationships':
          if (this.characterArcService) {
            const relationships = this.characterArcService.getAllRelationships();
            result = {
              type,
              relationships,
              message: '角色关系可视化数据',
            };
          } else {
            result = {
              type,
              relationships: [],
              message: '角色关系可视化数据（暂无数据）',
            };
          }
          break;

        case 'foreshadowing':
          if (this.foreshadowingService) {
            const foreshadowings = this.foreshadowingService.getAllForeshadowings();
            const planted = foreshadowings.filter((f) => f.status === 'planted');
            const resolved = foreshadowings.filter((f) => f.status === 'resolved');
            result = {
              type,
              foreshadowings,
              planted: planted.length,
              resolved: resolved.length,
              total: foreshadowings.length,
              message: '伏笔可视化数据',
            };
          } else if (this.memoryService) {
            const foreshadowing = this.memoryService.getForeshadowing();
            result = {
              type,
              foreshadowings: foreshadowing,
              total: foreshadowing.length,
              message: '伏笔可视化数据',
            };
          }
          break;

        case 'emotion_arc':
          if (this.emotionAuthenticityService) {
            const stats = this.emotionAuthenticityService.getStats();
            result = {
              type,
              stats,
              message: '情感弧线可视化数据',
            };
          } else {
            result = {
              type,
              stats: null,
              message: '情感弧线可视化数据（暂无数据）',
            };
          }
          break;

        case 'conflicts':
          if (this.conflictDetectionService) {
            const conflicts = this.conflictDetectionService.getAllConflicts();
            result = {
              type,
              conflicts,
              total: conflicts.length,
              message: '冲突可视化数据',
            };
          } else {
            result = {
              type,
              conflicts: [],
              message: '冲突可视化数据（暂无数据）',
            };
          }
          break;

        default:
          result = {
            type,
            message: `未知可视化类型: ${type}`,
            availableTypes: [
              'timeline',
              'characters',
              'relationships',
              'foreshadowing',
              'emotion_arc',
              'conflicts',
            ],
          };
      }

      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async suggestPerspectiveSwitch(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const prompt = `分析以下小说内容，建议是否需要视角切换：

${args.content}

请分析：
1. 当前视角类型（第一人称/第三人称限制/第三人称全知）
2. 是否适合切换视角
3. 如果适合，建议切换到什么视角
4. 切换的时机和方式

以JSON格式返回：{"currentPerspective": "...", "shouldSwitch": true/false, "suggestion": "...", "timing": "..."}`;
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 400,
      });
      return { toolCallId: generateId(), success: true, result: response.content };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async checkWorldCompleteness(
    _args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.worldBuildingService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'WorldBuildingService not available',
        };
      }
      const result = await this.worldBuildingService.checkWorldCompleteness();
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async extractSettings(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.settingExtractionService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'SettingExtractionService not available',
        };
      }
      const input = args.input as string;
      const autoSave = (args.autoSave as boolean) ?? true;
      const result = await this.settingExtractionService.extractFromInput(input, { autoSave });
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async buildWorld(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.worldBuildingService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'WorldBuildingService not available',
        };
      }
      const input = args.input as string;
      const generateOutline = (args.generateOutline as boolean) ?? true;
      const targetWordCount = (args.targetWordCount as number) ?? 100000;
      const result = await this.worldBuildingService.buildWorldFromInput(input, {
        generateOutline,
        targetWordCount,
      });
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getWorldContext(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.worldModelService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'WorldModelService not available',
        };
      }
      const chapterId = args.chapterId as string | undefined;
      const context = this.worldModelService.getContextForGeneration(chapterId);
      return { toolCallId: generateId(), success: true, result: context };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async analyzeSceneStyle(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const content = args.content as string;
      const { enhancedStyleAnalysisService } =
        await import('../style/enhancedStyleAnalysisService');
      const service = enhancedStyleAnalysisService;
      const analysis = await service.analyzeScene(content);
      return { toolCallId: generateId(), success: true, result: analysis };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getStyleConstraints(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const sceneType = args.sceneType as string;
      const intentsStr = args.intents as string | undefined;
      const intents = intentsStr ? intentsStr.split(',').map((s) => s.trim()) : undefined;
      const { enhancedStyleAnalysisService } =
        await import('../style/enhancedStyleAnalysisService');
      const constraints = await enhancedStyleAnalysisService.generateStyleConstraints(
        sceneType as never,
        intents as never[]
      );
      return { toolCallId: generateId(), success: true, result: { constraints } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async addReferencePassage(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const content = args.content as string;
      const sceneType = args.sceneType as string | undefined;
      const source = args.source as string | undefined;
      const { enhancedStyleAnalysisService } =
        await import('../style/enhancedStyleAnalysisService');
      const passage = await enhancedStyleAnalysisService.addReferencePassage(content, {
        sceneType: sceneType as never,
        source,
      });
      return {
        toolCallId: generateId(),
        success: true,
        result: { id: passage.id, sceneType: passage.sceneType },
      };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async buildStylePrompt(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const sceneType = args.sceneType as string;
      const intentsStr = args.intents as string | undefined;
      const intents = intentsStr ? intentsStr.split(',').map((s) => s.trim()) : [];
      const context = args.context as string | undefined;
      const { enhancedStyleAnalysisService } =
        await import('../style/enhancedStyleAnalysisService');
      const prompt = await enhancedStyleAnalysisService.buildStylePrompt(
        sceneType as never,
        intents as never[],
        context
      );
      return { toolCallId: generateId(), success: true, result: prompt };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async suggestNextSteps(
    _args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.worldBuildingService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'WorldBuildingService not available',
        };
      }
      const suggestions = await this.worldBuildingService.suggestNextSteps();
      return { toolCallId: generateId(), success: true, result: { suggestions } };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getNovelBible(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const bible = this.novelBibleService.getNovelBible();
      if (!bible) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'Novel bible not initialized',
        };
      }

      const section = args.section as string | undefined;
      if (!section) {
        return { toolCallId: generateId(), success: true, result: bible };
      }

      const allowedSections = [
        'metadata',
        'world',
        'characters',
        'relationships',
        'timelineTracks',
        'foreshadowing',
        'notes',
      ] as const;

      if (!allowedSections.includes(section as (typeof allowedSections)[number])) {
        return {
          toolCallId: generateId(),
          success: false,
          error: `Unknown section: ${section}`,
        };
      }

      const selected = bible[section as (typeof allowedSections)[number]];
      return { toolCallId: generateId(), success: true, result: selected };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async updateNovelBibleMeta(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const updates = args.updates;
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'updates must be an object',
        };
      }

      const result = await this.novelBibleService.updateMetadata(
        updates as Partial<NovelBibleMetadata>
      );
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async upsertBibleCharacter(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const character = args.character;
      if (!character || typeof character !== 'object' || Array.isArray(character)) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'character must be an object',
        };
      }

      const name = (character as { name?: unknown }).name;
      if (typeof name !== 'string' || !name.trim()) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'character.name is required',
        };
      }

      const result = await this.novelBibleService.upsertCharacter(
        character as Partial<NovelBibleCharacter> & { name: string }
      );
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async upsertBibleTimelineTrack(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const track = args.track;
      if (!track || typeof track !== 'object' || Array.isArray(track)) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'track must be an object',
        };
      }

      const name = (track as { name?: unknown }).name;
      if (typeof name !== 'string' || !name.trim()) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'track.name is required',
        };
      }

      const result = await this.novelBibleService.upsertTimelineTrack(
        track as Partial<NovelBibleTimelineTrack> & { name: string }
      );
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async upsertBibleTimelineEvent(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const trackId = args.trackId;
      const event = args.event;
      if (typeof trackId !== 'string' || !trackId.trim()) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'trackId is required',
        };
      }

      if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'event must be an object',
        };
      }

      const title = (event as { title?: unknown }).title;
      if (typeof title !== 'string' || !title.trim()) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'event.title is required',
        };
      }

      const result = await this.novelBibleService.upsertTimelineEvent(
        trackId,
        event as Partial<NovelBibleTimelineEvent> & { title: string }
      );
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async upsertBibleForeshadowing(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const foreshadowing = args.foreshadowing;
      if (!foreshadowing || typeof foreshadowing !== 'object' || Array.isArray(foreshadowing)) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'foreshadowing must be an object',
        };
      }

      const title = (foreshadowing as { title?: unknown }).title;
      const seed = (foreshadowing as { seed?: unknown }).seed;
      if (typeof title !== 'string' || !title.trim() || typeof seed !== 'string' || !seed.trim()) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'foreshadowing.title and foreshadowing.seed are required',
        };
      }

      const result = await this.novelBibleService.upsertForeshadowing(
        foreshadowing as Partial<NovelBibleForeshadowing> & { title: string; seed: string }
      );
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async validateNovelBible(
    _args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }
      const result = this.novelBibleService.validate();
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  private async getNovelBibleContext(
    args: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      if (!this.novelBibleService) {
        return {
          toolCallId: generateId(),
          success: false,
          error: 'NovelBibleService not available',
        };
      }

      const maxCharacters =
        typeof args.maxCharacters === 'number' ? (args.maxCharacters as number) : undefined;
      const maxTracks = typeof args.maxTracks === 'number' ? (args.maxTracks as number) : undefined;
      const maxForeshadowing =
        typeof args.maxForeshadowing === 'number'
          ? (args.maxForeshadowing as number)
          : undefined;

      const result = this.novelBibleService.getGenerationBrief({
        maxCharacters,
        maxTracks,
        maxForeshadowing,
      });
      return { toolCallId: generateId(), success: true, result };
    } catch (error) {
      return { toolCallId: generateId(), success: false, error: String(error) };
    }
  }

  async execute(
    toolCall: ToolCall,
    context: ToolContext,
    maxRetries: number = 3
  ): Promise<ToolResult> {
    const entry = this.tools.get(toolCall.name);
    if (!entry) {
      logger.toolError(`工具不存在: ${toolCall.name}`);
      return { toolCallId: toolCall.id, success: false, error: `Tool not found: ${toolCall.name}` };
    }

    entry.callCount++;
    entry.lastCalledAt = Date.now();

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      logger.tool(`执行工具: ${toolCall.name} (尝试 ${attempt}/${maxRetries})`, {
        args: toolCall.arguments,
      });

      try {
        const result = await entry.handler(toolCall.arguments, context);
        const duration = Date.now() - startTime;

        logger.toolCall(
          toolCall.name,
          entry.definition.category || 'other',
          toolCall.arguments,
          result.result,
          result.success,
          duration,
          result.error
        );

        if (result.success) {
          logger.tool(`工具执行成功: ${toolCall.name}`, { duration: `${duration}ms`, attempt });
          return result;
        } else {
          lastError = result.error;
          logger.toolError(`工具执行失败: ${toolCall.name}`, {
            error: result.error,
            duration: `${duration}ms`,
            attempt,
          });

          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.tool(`等待 ${delay}ms 后重试...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = String(error);
        logger.toolError(`工具执行异常: ${toolCall.name}`, {
          error: String(error),
          duration: `${duration}ms`,
          attempt,
        });
        logger.toolCall(
          toolCall.name,
          entry.definition.category || 'other',
          toolCall.arguments,
          undefined,
          false,
          duration,
          String(error)
        );

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.tool(`等待 ${delay}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      toolCallId: toolCall.id,
      success: false,
      error: `Failed after ${maxRetries} attempts: ${lastError}`,
    };
  }

  getStats(): { totalTools: number; byCategory: Record<string, number>; totalCalls: number } {
    const byCategory: Record<string, number> = {};
    let totalCalls = 0;
    for (const entry of this.tools.values()) {
      const category = entry.definition.category || 'other';
      byCategory[category] = (byCategory[category] || 0) + 1;
      totalCalls += entry.callCount;
    }
    return { totalTools: this.tools.size, byCategory, totalCalls };
  }
}

export function createToolRegistry(projectPath: string): ToolRegistry {
  return new ToolRegistry(projectPath);
}
