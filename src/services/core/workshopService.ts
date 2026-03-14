import {
  WorkshopConfig,
  WorkshopStructure,
  DEFAULT_WORKSHOP_CONFIG,
  WORKSHOP_DIRS,
  SkillManifest,
  AgentManifest,
  WorkshopMemoryEntry,
  KnowledgeIndex,
} from '@/types/core/workshop';
import { fileSystemService } from './fileSystemService';
import { logger } from './loggerService';

const CONFIG_FILE = '.ai-workshop/config.json';
const MEMORY_FILE = '.ai-workshop/memory/memory.json';
const KNOWLEDGE_INDEX_FILE = '.ai-workshop/knowledge/index.json';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function normalizePath(path: string): string {
  if (!path) return path;
  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
}

export const workshopService = {
  async initProject(_projectPath: string, projectName: string): Promise<WorkshopConfig> {
    for (const dir of WORKSHOP_DIRS) {
      const exists = await this.pathExists(dir);
      if (!exists) {
        await this.createDirectory(dir);
      }
    }

    const config: WorkshopConfig = {
      ...DEFAULT_WORKSHOP_CONFIG,
      project: {
        id: generateId(),
        name: projectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    await this.saveConfig(config);
    await this.initMemory();
    await this.initKnowledgeIndex();

    return config;
  },

  async loadConfig(): Promise<WorkshopConfig | null> {
    try {
      const exists = await this.pathExists(CONFIG_FILE);
      if (!exists) {
        return null;
      }

      const content = await this.readFile(CONFIG_FILE);
      return JSON.parse(content);
    } catch (error) {
      logger.error('加载工作区配置失败', { error });
      return null;
    }
  },

  async saveConfig(config: WorkshopConfig): Promise<void> {
    config.updatedAt = Date.now();
    await this.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  },

  async getStructure(): Promise<WorkshopStructure> {
    return {
      configPath: CONFIG_FILE,
      skillsPath: '.ai-workshop/skills',
      agentsPath: '.ai-workshop/agents',
      knowledgePath: '.ai-workshop/knowledge',
      memoryPath: '.ai-workshop/memory',
      toolsPath: '.ai-workshop/tools',
      worksPath: 'works',
    };
  },

  async isWorkshopProject(): Promise<boolean> {
    return await this.pathExists(CONFIG_FILE);
  },

  async initMemory(): Promise<void> {
    const exists = await this.pathExists(MEMORY_FILE);
    if (!exists) {
      await this.writeFile(
        MEMORY_FILE,
        JSON.stringify(
          {
            entries: [],
            lastUpdated: Date.now(),
          },
          null,
          2
        )
      );
    }
  },

  async loadMemory(): Promise<WorkshopMemoryEntry[]> {
    try {
      const exists = await this.pathExists(MEMORY_FILE);
      if (!exists) {
        await this.initMemory();
        logger.info('记忆文件不存在，已初始化空文件');
        return [];
      }
      const content = await this.readFile(MEMORY_FILE);
      if (!content || content.trim() === '') {
        await this.initMemory();
        logger.info('记忆文件为空，已重新初始化');
        return [];
      }
      const data = JSON.parse(content);
      const entries = data.entries || [];
      logger.info('加载记忆数据', { count: entries.length });
      return entries;
    } catch (error) {
      logger.warn('加载记忆数据失败，重新初始化', { error: String(error) });
      await this.initMemory();
      return [];
    }
  },

  async saveMemory(entries: WorkshopMemoryEntry[]): Promise<void> {
    const content = JSON.stringify(
      {
        entries,
        lastUpdated: Date.now(),
      },
      null,
      2
    );
    await this.writeFile(MEMORY_FILE, content);
    logger.info('保存记忆数据成功', { count: entries.length });
  },

  async addMemoryEntry(
    entry: Omit<WorkshopMemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>
  ): Promise<WorkshopMemoryEntry> {
    const entries = await this.loadMemory();
    const newEntry: WorkshopMemoryEntry = {
      ...entry,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
    };
    entries.push(newEntry);
    await this.saveMemory(entries);
    return newEntry;
  },

  async updateMemoryEntry(id: string, updates: Partial<WorkshopMemoryEntry>): Promise<boolean> {
    const entries = await this.loadMemory();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) {
      return false;
    }

    entries[index] = {
      ...entries[index],
      ...updates,
      updatedAt: Date.now(),
    };
    await this.saveMemory(entries);
    return true;
  },

  async deleteMemoryEntry(id: string): Promise<boolean> {
    const entries = await this.loadMemory();
    const originalLength = entries.length;
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === originalLength) {
      logger.warn('删除记忆失败: 未找到对应ID', { id, totalEntries: originalLength });
      return false;
    }
    await this.saveMemory(filtered);
    logger.info('记忆删除成功', { id, remainingEntries: filtered.length });
    return true;
  },

  async initKnowledgeIndex(): Promise<void> {
    const exists = await this.pathExists(KNOWLEDGE_INDEX_FILE);
    if (!exists) {
      await this.writeFile(
        KNOWLEDGE_INDEX_FILE,
        JSON.stringify(
          {
            files: [],
            lastUpdated: Date.now(),
          },
          null,
          2
        )
      );
    }
  },

  async loadKnowledgeIndex(): Promise<KnowledgeIndex[]> {
    try {
      const content = await this.readFile(KNOWLEDGE_INDEX_FILE);
      const data = JSON.parse(content);
      return data.files || [];
    } catch {
      return [];
    }
  },

  async saveKnowledgeIndex(files: KnowledgeIndex[]): Promise<void> {
    await this.writeFile(
      KNOWLEDGE_INDEX_FILE,
      JSON.stringify(
        {
          files,
          lastUpdated: Date.now(),
        },
        null,
        2
      )
    );
  },

  async scanSkills(): Promise<SkillManifest[]> {
    const skills: SkillManifest[] = [];
    const skillsPath = '.ai-workshop/skills';

    const scanDir = async (dir: string) => {
      try {
        const entries = await this.readDirectory(dir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            const manifestPath = `${dir}/${entry.name}/skill.yaml`;
            const manifestExists = await this.pathExists(manifestPath);
            if (manifestExists) {
              const content = await this.readFile(manifestPath);
              const manifest = this.parseYaml(content);
              if (manifest) {
                skills.push({
                  ...manifest,
                  path: `${dir}/${entry.name}`,
                } as unknown as SkillManifest);
              }
            }
          }
        }
      } catch (error) {
        logger.error('扫描目录失败', { dir, error });
      }
    };

    await scanDir(`${skillsPath}/system`);
    await scanDir(`${skillsPath}/user`);

    return skills;
  },

  async scanAgents(): Promise<AgentManifest[]> {
    const agents: AgentManifest[] = [];
    const agentsPath = '.ai-workshop/agents';

    const scanDir = async (dir: string) => {
      try {
        const entries = await this.readDirectory(dir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            const manifestPath = `${dir}/${entry.name}/agent.yaml`;
            const manifestExists = await this.pathExists(manifestPath);
            if (manifestExists) {
              const content = await this.readFile(manifestPath);
              const manifest = this.parseYaml(content);
              if (manifest) {
                agents.push({
                  ...manifest,
                  path: `${dir}/${entry.name}`,
                } as unknown as AgentManifest);
              }
            }
          }
        }
      } catch (error) {
        logger.error('扫描目录失败', { dir, error });
      }
    };

    await scanDir(`${agentsPath}/system`);
    await scanDir(`${agentsPath}/user`);

    return agents;
  },

  parseYaml(content: string): Record<string, unknown> | null {
    try {
      const result: Record<string, unknown> = {};
      const lines = content.split('\n');
      const stack: Array<{ key: string; indent: number; obj: Record<string, unknown> }> = [
        { key: '', indent: -1, obj: result },
      ];

      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) {
          continue;
        }

        const indent = line.search(/\S/);
        const trimmed = line.trim();
        const colonIndex = trimmed.indexOf(':');

        if (colonIndex === -1) {
          continue;
        }

        const key = trimmed.substring(0, colonIndex).trim();
        let value: unknown = trimmed.substring(colonIndex + 1).trim();

        if (value === '') {
          value = {};
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (value === 'null') {
          value = null;
        } else if (/^\d+$/.test(value as string)) {
          value = parseInt(value as string, 10);
        } else if (/^\d+\.\d+$/.test(value as string)) {
          value = parseFloat(value as string);
        } else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
          value = (value as string)
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
        } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
          value = (value as string).slice(1, -1);
        } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
          value = (value as string).slice(1, -1);
        }

        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }

        const current = stack[stack.length - 1];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          (current.obj as Record<string, unknown>)[key] = value;
          stack.push({ key, indent, obj: value as Record<string, unknown> });
        } else {
          (current.obj as Record<string, unknown>)[key] = value;
        }
      }

      return result;
    } catch (error) {
      logger.error('解析 YAML 失败', { error });
      return null;
    }
  },

  stringifyYaml(obj: Record<string, unknown>, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let result = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        result += `${spaces}${key}: null\n`;
      } else if (typeof value === 'boolean') {
        result += `${spaces}${key}: ${value}\n`;
      } else if (typeof value === 'number') {
        result += `${spaces}${key}: ${value}\n`;
      } else if (typeof value === 'string') {
        if (value.includes('\n') || value.includes(':') || value.includes('#')) {
          result += `${spaces}${key}: "${value}"\n`;
        } else {
          result += `${spaces}${key}: ${value}\n`;
        }
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          result += `${spaces}${key}: []\n`;
        } else if (typeof value[0] === 'object') {
          result += `${spaces}${key}:\n`;
          for (const item of value) {
            result += `${spaces}  -\n`;
            result += this.stringifyYaml(item as Record<string, unknown>, indent + 2);
          }
        } else {
          result += `${spaces}${key}: [${value
            .map((v) => (typeof v === 'string' ? `"${v}"` : v))
            .join(', ')}]\n`;
        }
      } else if (typeof value === 'object') {
        result += `${spaces}${key}:\n`;
        result += this.stringifyYaml(value as Record<string, unknown>, indent + 1);
      }
    }

    return result;
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
    return await fileSystemService.pathExists(normalizePath(path));
  },

  async createDirectory(path: string): Promise<void> {
    await fileSystemService.createDirectory(normalizePath(path));
  },

  async readDirectory(path: string): Promise<Array<{ name: string; path: string; isDirectory: boolean; children?: unknown[] | null }>> {
    const entries = await fileSystemService.readDirectory(normalizePath(path));
    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      children: e.children,
    }));
  },
};
