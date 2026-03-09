import {
  SkillFile,
  SkillMeta,
  SkillPrompt,
  SkillCategoryType,
  ProjectConfig,
  ProjectAnalysis,
  KnowledgeFile,
} from '@/types/tools/skill';
import {
  WorkshopConfig,
  DEFAULT_WORKSHOP_CONFIG,
  WorkshopSkillCategory,
} from '@/types/core/workshop';
import { fileSystemService } from '../core/fileSystemService';
import { logger } from '../core/loggerService';

const SKILL_FILE_NAME = 'SKILL.md';
const CONFIG_FILE_NAME = 'config.json';
const ANALYSIS_DIR = '.ai-workshop/analysis';
const KNOWLEDGE_DIR = '.ai-workshop/knowledge';
const SKILLS_DIR = '.ai-workshop/skills';

function normalizePath(path: string): string {
  if (!path) return path;
  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
}

function parseSkillMarkdown(content: string, filePath: string): SkillFile | null {
  try {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      logger.error('无效的 SKILL.md 格式: 缺少 frontmatter');
      return null;
    }

    const [, frontmatter, body] = frontmatterMatch;
    const meta: Partial<SkillMeta> = {};
    const prompt: SkillPrompt = { system: '' };
    const tools: NonNullable<SkillFile['tools']> = [];
    const output: NonNullable<SkillFile['output']> = { format: 'text' };
    const chain: NonNullable<SkillFile['chain']> = {};
    const knowledge: NonNullable<SkillFile['knowledge']> = {};
    const reviewers: NonNullable<SkillFile['reviewers']> = [];

    let currentSection = '';
    let sectionContent = '';

    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      switch (key.trim()) {
        case 'id':
          meta.id = value;
          break;
        case 'name':
          meta.name = value;
          break;
        case 'version':
          meta.version = value;
          break;
        case 'author':
          meta.author = value;
          break;
        case 'description':
          meta.description = value;
          break;
        case 'category':
          meta.category = value as SkillCategoryType;
          break;
        case 'tags':
          meta.tags = value.split(',').map((t) => t.trim());
          break;
      }
    }

    const bodyLines = body.split('\n');
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];

      if (line.startsWith('## ')) {
        if (currentSection && sectionContent.trim()) {
          processSection(
            currentSection,
            sectionContent,
            prompt,
            tools,
            output,
            chain,
            knowledge,
            reviewers
          );
        }
        currentSection = line.slice(3).trim().toLowerCase();
        sectionContent = '';
      } else {
        sectionContent += line + '\n';
      }
    }

    if (currentSection && sectionContent.trim()) {
      processSection(
        currentSection,
        sectionContent,
        prompt,
        tools,
        output,
        chain,
        knowledge,
        reviewers
      );
    }

    if (!meta.id) {
      meta.id = `skill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    if (!meta.version) {
      meta.version = '1.0.0';
    }
    if (!meta.category) {
      meta.category = 'custom';
    }
    if (!meta.tags) {
      meta.tags = [];
    }

    return {
      meta: meta as SkillMeta,
      prompt,
      tools: tools.length > 0 ? tools : undefined,
      output,
      chain: Object.keys(chain).length > 0 ? chain : undefined,
      knowledge: Object.keys(knowledge).length > 0 ? knowledge : undefined,
      reviewers: reviewers.length > 0 ? reviewers : undefined,
      rawContent: content,
      filePath,
    };
  } catch (error) {
    logger.error('解析 SKILL.md 失败', { error });
    return null;
  }
}

function processSection(
  section: string,
  content: string,
  prompt: SkillPrompt,
  tools: NonNullable<SkillFile['tools']>,
  output: NonNullable<SkillFile['output']>,
  chain: NonNullable<SkillFile['chain']>,
  knowledge: NonNullable<SkillFile['knowledge']>,
  reviewers: NonNullable<SkillFile['reviewers']>
) {
  switch (section) {
    case 'system prompt':
    case '系统提示':
      prompt.system = content.trim();
      break;
    case 'user template':
    case '用户模板':
      prompt.userTemplate = content.trim();
      break;
    case 'examples':
    case '示例':
      prompt.examples = content
        .split('---')
        .map((e) => e.trim())
        .filter(Boolean);
      break;
    case 'tools':
    case '工具':
      const toolMatches = content.matchAll(/###\s*(\w+)\n([\s\S]*?)(?=###|$)/g);
      for (const match of toolMatches) {
        tools.push({
          name: match[1],
          description: match[2].trim(),
          parameters: {},
        });
      }
      break;
    case 'output':
    case '输出':
      if (content.includes('json')) {
        output.format = 'json';
      } else if (content.includes('markdown')) {
        output.format = 'markdown';
      }
      output.template = content.trim();
      break;
    case 'chain':
    case '调用链':
      const beforeMatch = content.match(/before:\s*\[([^\]]*)\]/);
      const afterMatch = content.match(/after:\s*\[([^\]]*)\]/);
      const parallelMatch = content.match(/parallel:\s*\[([^\]]*)\]/);
      if (beforeMatch) {
        chain.before = beforeMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      if (afterMatch) {
        chain.after = afterMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      if (parallelMatch) {
        chain.parallel = parallelMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      break;
    case 'knowledge':
    case '知识库':
      const requiredMatch = content.match(/required:\s*\[([^\]]*)\]/);
      const optionalMatch = content.match(/optional:\s*\[([^\]]*)\]/);
      const autoIngestMatch = content.match(/autoIngest:\s*(true|false)/);
      if (requiredMatch) {
        knowledge.required = requiredMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      if (optionalMatch) {
        knowledge.optional = optionalMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
      if (autoIngestMatch) {
        knowledge.autoIngest = autoIngestMatch[1] === 'true';
      }
      break;
    case 'reviewers':
    case '审核员':
      const reviewerMatches = content.matchAll(/###\s*(.+?)\n([\s\S]*?)(?=###|$)/g);
      for (const match of reviewerMatches) {
        reviewers.push({
          id: `reviewer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: match[1].trim(),
          prompt: match[2].trim(),
          weight: 1,
          isActive: true,
        });
      }
      break;
  }
}

function generateSkillMarkdown(skill: Partial<SkillFile>): string {
  let content = `---
id: ${skill.meta?.id || `skill_${Date.now()}`}
name: ${skill.meta?.name || '未命名Skill'}
version: ${skill.meta?.version || '1.0.0'}
author: ${skill.meta?.author || ''}
description: ${skill.meta?.description || ''}
category: ${skill.meta?.category || 'custom'}
tags: ${skill.meta?.tags?.join(', ') || ''}
---

## System Prompt

${skill.prompt?.system || '请在此填写系统提示词...'}

`;

  if (skill.prompt?.userTemplate) {
    content += `## User Template

${skill.prompt.userTemplate}

`;
  }

  if (skill.prompt?.examples?.length) {
    content += `## Examples

${skill.prompt.examples.join('\n\n---\n\n')}

`;
  }

  if (skill.chain?.before?.length || skill.chain?.after?.length || skill.chain?.parallel?.length) {
    content += `## Chain

before: [${skill.chain.before?.map((s) => `"${s}"`).join(', ') || ''}]
after: [${skill.chain.after?.map((s) => `"${s}"`).join(', ') || ''}]
parallel: [${skill.chain.parallel?.map((s) => `"${s}"`).join(', ') || ''}]

`;
  }

  if (skill.knowledge?.required?.length || skill.knowledge?.optional?.length) {
    content += `## Knowledge

required: [${skill.knowledge.required?.map((s) => `"${s}"`).join(', ') || ''}]
optional: [${skill.knowledge.optional?.map((s) => `"${s}"`).join(', ') || ''}]
autoIngest: ${skill.knowledge.autoIngest || false}

`;
  }

  if (skill.reviewers?.length) {
    content += `## Reviewers

${skill.reviewers.map((r) => `### ${r.name}\n${r.prompt}`).join('\n\n')}

`;
  }

  return content;
}

export const skillService = {
  async scanSkills(): Promise<SkillFile[]> {
    try {
      const exists = await this.pathExists(SKILLS_DIR);
      if (!exists) {
        return [];
      }

      const entries = await this.readDirectory(SKILLS_DIR);
      const skills: SkillFile[] = [];

      for (const entry of entries) {
        if (entry.isDirectory) {
          const skillFilePath = `${SKILLS_DIR}/${entry.name}/${SKILL_FILE_NAME}`;
          const skillExists = await this.pathExists(skillFilePath);
          if (skillExists) {
            const content = await this.readFile(skillFilePath);
            const skill = parseSkillMarkdown(content, skillFilePath);
            if (skill) {
              skills.push(skill);
            }
          }
        }
      }

      return skills;
    } catch (error) {
      logger.error('扫描技能失败', { error });
      return [];
    }
  },

  async loadSkill(skillPath: string): Promise<SkillFile | null> {
    try {
      const content = await this.readFile(skillPath);
      return parseSkillMarkdown(content, skillPath);
    } catch (error) {
      logger.error('加载技能失败', { skillPath, error });
      return null;
    }
  },

  async saveSkill(skill: Partial<SkillFile>): Promise<string | null> {
    try {
      const skillName = skill.meta?.name || '未命名Skill';
      const safeName = skillName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const skillDir = `${SKILLS_DIR}/${safeName}`;

      await this.createDirectory(skillDir);

      const skillFilePath = `${skillDir}/${SKILL_FILE_NAME}`;
      const content = generateSkillMarkdown(skill);

      await this.writeFile(skillFilePath, content);

      return skillFilePath;
    } catch (error) {
      logger.error('保存技能失败', { error });
      return null;
    }
  },

  async deleteSkill(skillPath: string): Promise<boolean> {
    try {
      const skillDir = skillPath.replace(`/${SKILL_FILE_NAME}`, '');
      await this.removeDirectory(skillDir);
      return true;
    } catch (error) {
      logger.error('删除技能失败', { skillPath, error });
      return false;
    }
  },

  async loadProjectConfig(): Promise<ProjectConfig | null> {
    try {
      const configPath = `.ai-workshop/${CONFIG_FILE_NAME}`;
      const exists = await this.pathExists(configPath);
      if (!exists) {
        return null;
      }
      const content = await this.readFile(configPath);
      const raw = JSON.parse(content) as Record<string, unknown>;

      // 统一 config：WorkshopConfig 含 project/paths，映射为 ProjectConfig
      if (raw.project && typeof raw.project === 'object') {
        const wc = raw as unknown as WorkshopConfig;
        return {
          id: wc.project.id,
          name: wc.project.name,
          createdAt: wc.project.createdAt,
          updatedAt: wc.updatedAt ?? wc.project.updatedAt,
          selectedSkills: (wc.selectedSkills ??
            DEFAULT_WORKSHOP_CONFIG.selectedSkills) as ProjectConfig['selectedSkills'],
          activeReviewers: wc.activeReviewers ?? [],
          knowledgeFiles: [],
          settings: {
            autoAnalyze: wc.settings.autoAnalyze,
            analyzeInterval: wc.settings.analyzeInterval,
            contextWindow: wc.settings.contextWindow,
          },
        };
      }

      // 旧版 ProjectConfig 格式，原样返回
      return raw as unknown as ProjectConfig;
    } catch (error) {
      logger.error('加载项目配置失败', { error });
      return null;
    }
  },

  async saveProjectConfig(config: ProjectConfig): Promise<boolean> {
    try {
      const configPath = `.ai-workshop/${CONFIG_FILE_NAME}`;
      await this.createDirectory('.ai-workshop');
      const exists = await this.pathExists(configPath);

      let merged: WorkshopConfig;
      if (exists) {
        const content = await this.readFile(configPath);
        const raw = JSON.parse(content) as Record<string, unknown>;
        if (raw.project && typeof raw.project === 'object') {
          merged = raw as unknown as WorkshopConfig;
          merged.selectedSkills = config.selectedSkills as Record<
            WorkshopSkillCategory,
            string | null
          >;
          merged.activeReviewers = config.activeReviewers;
          merged.settings.autoAnalyze = config.settings.autoAnalyze;
          merged.settings.analyzeInterval = config.settings.analyzeInterval;
          merged.settings.contextWindow = config.settings.contextWindow;
          merged.updatedAt = Date.now();
        } else {
          merged = this.migrateToWorkshopConfig(config);
        }
      } else {
        merged = this.migrateToWorkshopConfig(config);
      }

      await this.writeFile(configPath, JSON.stringify(merged, null, 2));
      return true;
    } catch (error) {
      logger.error('保存项目配置失败', { error });
      return false;
    }
  },

  migrateToWorkshopConfig(pc: ProjectConfig): WorkshopConfig {
    return {
      ...DEFAULT_WORKSHOP_CONFIG,
      project: {
        id: pc.id,
        name: pc.name,
        createdAt: pc.createdAt,
        updatedAt: pc.updatedAt,
      },
      selectedSkills: pc.selectedSkills as Record<WorkshopSkillCategory, string | null>,
      activeReviewers: pc.activeReviewers,
      settings: {
        ...DEFAULT_WORKSHOP_CONFIG.settings,
        autoAnalyze: pc.settings.autoAnalyze,
        analyzeInterval: pc.settings.analyzeInterval,
        contextWindow: pc.settings.contextWindow,
      },
      updatedAt: Date.now(),
    };
  },

  async initProjectConfig(projectName: string): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      id: `project_${Date.now()}`,
      name: projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      selectedSkills: {
        style: null,
        structure: null,
        setting: null,
        technique: null,
        workflow: null,
        review: null,
        analysis: null,
        custom: null,
      },
      activeReviewers: [],
      knowledgeFiles: [],
      settings: {
        autoAnalyze: true,
        analyzeInterval: 300000,
        contextWindow: 8000,
      },
    };
    await this.saveProjectConfig(config);
    return config;
  },

  async loadProjectAnalysis(): Promise<ProjectAnalysis | null> {
    try {
      const exists = await this.pathExists(ANALYSIS_DIR);
      if (!exists) {
        return null;
      }

      const analysis: ProjectAnalysis = {
        characters: [],
        timeline: [],
        foreshadowing: [],
        worldbuilding: {
          setting: '',
          rules: [],
          locations: [],
          factions: [],
        },
        lastAnalyzed: 0,
      };

      const files = [
        'characters.json',
        'timeline.json',
        'foreshadowing.json',
        'worldbuilding.json',
      ];
      for (const file of files) {
        const filePath = `${ANALYSIS_DIR}/${file}`;
        if (await this.pathExists(filePath)) {
          const content = await this.readFile(filePath);
          const key = file.replace('.json', '') as
            | 'characters'
            | 'timeline'
            | 'foreshadowing'
            | 'worldbuilding';
          (analysis as unknown as Record<string, unknown>)[key] = JSON.parse(content);
        }
      }

      return analysis;
    } catch (error) {
      logger.error('加载项目分析失败', { error });
      return null;
    }
  },

  async saveProjectAnalysis(analysis: Partial<ProjectAnalysis>): Promise<boolean> {
    try {
      await this.createDirectory(ANALYSIS_DIR);

      if (analysis.characters) {
        await this.writeFile(
          `${ANALYSIS_DIR}/characters.json`,
          JSON.stringify(analysis.characters, null, 2)
        );
      }
      if (analysis.timeline) {
        await this.writeFile(
          `${ANALYSIS_DIR}/timeline.json`,
          JSON.stringify(analysis.timeline, null, 2)
        );
      }
      if (analysis.foreshadowing) {
        await this.writeFile(
          `${ANALYSIS_DIR}/foreshadowing.json`,
          JSON.stringify(analysis.foreshadowing, null, 2)
        );
      }
      if (analysis.worldbuilding) {
        await this.writeFile(
          `${ANALYSIS_DIR}/worldbuilding.json`,
          JSON.stringify(analysis.worldbuilding, null, 2)
        );
      }

      return true;
    } catch (error) {
      logger.error('保存项目分析失败', { error });
      return false;
    }
  },

  async scanKnowledge(): Promise<KnowledgeFile[]> {
    try {
      const filesDir = `${KNOWLEDGE_DIR}/files`;
      const exists = await this.pathExists(filesDir);
      if (!exists) {
        return [];
      }

      const entries = await this.readDirectory(filesDir);
      const files: KnowledgeFile[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory) {
          const fullPath = `${filesDir}/${entry.name}`;
          const stat = await this.getFileStat(fullPath);
          files.push({
            id: `kb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: entry.name,
            path: fullPath,
            size: stat.size,
            uploadedAt: stat.modified,
            type: this.detectKnowledgeType(entry.name),
            tags: [],
          });
        }
      }

      return files;
    } catch (error) {
      logger.error('扫描知识库失败', { error });
      return [];
    }
  },

  async addKnowledgeFile(
    sourcePath: string,
    type: KnowledgeFile['type'] = 'reference'
  ): Promise<KnowledgeFile | null> {
    try {
      await this.createDirectory(KNOWLEDGE_DIR);

      const fileName = sourcePath.split('/').pop() || 'unknown';
      const destPath = `${KNOWLEDGE_DIR}/${fileName}`;

      await this.copyFile(sourcePath, destPath);

      const stat = await this.getFileStat(destPath);

      return {
        id: `kb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: fileName,
        path: destPath,
        size: stat.size,
        uploadedAt: Date.now(),
        type,
        tags: [],
      };
    } catch (error) {
      logger.error('添加知识文件失败', { sourcePath, error });
      return null;
    }
  },

  async removeKnowledgeFile(knowledgePath: string): Promise<boolean> {
    try {
      await this.deleteFile(knowledgePath);
      return true;
    } catch (error) {
      logger.error('删除知识文件失败', { knowledgePath, error });
      return false;
    }
  },

  async getKnowledgeContent(knowledgePath: string): Promise<string> {
    try {
      return await this.readFile(knowledgePath);
    } catch (error) {
      logger.error('读取知识文件失败', { knowledgePath, error });
      return '';
    }
  },

  detectKnowledgeType(fileName: string): KnowledgeFile['type'] {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('style') || lowerName.includes('风格')) {
      return 'style';
    }
    if (lowerName.includes('template') || lowerName.includes('模板')) {
      return 'template';
    }
    if (lowerName.includes('research') || lowerName.includes('研究')) {
      return 'research';
    }
    return 'reference';
  },

  async readFile(path: string): Promise<string> {
    return await fileSystemService.readFile(normalizePath(path));
  },

  async writeFile(path: string, content: string): Promise<void> {
    await fileSystemService.writeFile(normalizePath(path), content);
  },

  async deleteFile(path: string): Promise<void> {
    await fileSystemService.deleteFile(normalizePath(path));
  },

  async pathExists(path: string): Promise<boolean> {
    return await fileSystemService.fileExists(normalizePath(path));
  },

  async createDirectory(path: string): Promise<void> {
    await fileSystemService.createDirectory(normalizePath(path));
  },

  async removeDirectory(path: string): Promise<void> {
    const files = await fileSystemService.readDirectory(normalizePath(path));
    for (const file of files) {
      const fullPath = `${path}/${file.name}`;
      if (file.is_dir) {
        await this.removeDirectory(fullPath);
      } else {
        await fileSystemService.deleteFile(normalizePath(fullPath));
      }
    }
  },

  async readDirectory(path: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
    const entries = await fileSystemService.readDirectory(normalizePath(path));
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.is_dir,
    }));
  },

  async getFileStat(path: string): Promise<{ size: number; modified: number }> {
    try {
      const content = await this.readFile(path);
      return { size: content.length, modified: Date.now() };
    } catch {
      return { size: 0, modified: Date.now() };
    }
  },

  async copyFile(source: string, dest: string): Promise<void> {
    const content = await this.readFile(source);
    await this.writeFile(dest, content);
  },
};
