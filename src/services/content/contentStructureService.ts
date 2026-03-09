import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';

export interface ContentStructure {
  outline: ContentFile[];
  settings: ContentFile[];
  characters: ContentFile[];
  chapters: ContentFile[];
  detailedOutlines: ContentFile[];
  volumes: ContentFile[];
}

export interface ContentFile {
  path: string;
  name: string;
  type: 'outline' | 'setting' | 'character' | 'chapter' | 'detailed_outline' | 'volume';
  wordCount: number;
  lastModified: number;
  status: 'draft' | 'completed' | 'reviewing';
}

export interface ProjectStructure {
  projectName: string;
  basePath: string;
  totalWordCount: number;
  chapters: number;
  volumes: number;
  structure: ContentStructure;
}

export class ContentStructureService {
  private projectPath: string | null = null;

  async initialize(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    await this.ensureStructure();
  }

  private async ensureStructure(): Promise<void> {
    if (!this.projectPath) return;

    const dirs = ['大纲', '设定', '人物', '正文', '细纲', '分卷', '人物/人物小传'];

    for (const dir of dirs) {
      const dirPath = `${this.projectPath}/${dir}`;
      if (!(await workshopService.pathExists(dirPath))) {
        await workshopService.createDirectory(dirPath);
        logger.info(`创建目录: ${dir}`);
      }
    }

    await this.ensureDefaultFiles();
  }

  private async ensureDefaultFiles(): Promise<void> {
    if (!this.projectPath) return;

    const defaultFiles = [
      { path: '大纲/大纲.md', content: '# 故事大纲\n\n## 第一卷\n\n### 主要情节\n\n' },
      {
        path: '大纲/故事主线.md',
        content: '# 故事主线\n\n## 开端\n\n## 发展\n\n## 高潮\n\n## 结局\n\n',
      },
      {
        path: '设定/世界观设定.md',
        content: '# 世界观设定\n\n## 世界背景\n\n## 力量体系\n\n## 主要势力\n\n',
      },
      {
        path: '设定/力量体系.md',
        content: '# 力量体系\n\n## 等级划分\n\n## 能力类型\n\n## 限制条件\n\n',
      },
      { path: '设定/势力设定.md', content: '# 势力设定\n\n## 主要势力\n\n' },
      { path: '设定/地点设定.md', content: '# 地点设定\n\n## 主要地点\n\n' },
      { path: '人物/人物关系图.md', content: '# 人物关系图\n\n## 主要人物关系\n\n' },
    ];

    for (const file of defaultFiles) {
      const filePath = `${this.projectPath}/${file.path}`;
      if (!(await workshopService.pathExists(filePath))) {
        await workshopService.writeFile(filePath, file.content);
        logger.info(`创建文件: ${file.path}`);
      }
    }
  }

  async getProjectStructure(): Promise<ProjectStructure | null> {
    if (!this.projectPath) return null;

    const structure: ContentStructure = {
      outline: await this.scanDirectory('大纲'),
      settings: await this.scanDirectory('设定'),
      characters: await this.scanDirectory('人物'),
      chapters: await this.scanDirectory('正文'),
      detailedOutlines: await this.scanDirectory('细纲'),
      volumes: await this.scanDirectory('分卷'),
    };

    const totalWordCount = this.calculateTotalWordCount(structure);
    const chapters = structure.chapters.length;
    const volumes = structure.volumes.length;

    return {
      projectName: this.projectPath.split('/').pop() || '未命名项目',
      basePath: this.projectPath,
      totalWordCount,
      chapters,
      volumes,
      structure,
    };
  }

  private async scanDirectory(dirName: string): Promise<ContentFile[]> {
    if (!this.projectPath) return [];

    const dirPath = `${this.projectPath}/${dirName}`;
    const files: ContentFile[] = [];

    try {
      const items = await workshopService.readDirectory(dirPath);

      for (const item of items) {
        if (!item.isDirectory && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
          const filePath = `${dirPath}/${item.name}`;
          const content = await workshopService.readFile(filePath);
          const wordCount = this.countWords(content);

          files.push({
            path: filePath,
            name: item.name,
            type: this.getFileType(dirName),
            wordCount,
            lastModified: Date.now(),
            status: 'draft',
          });
        }
      }
    } catch (error) {
      logger.warn(`扫描目录失败: ${dirName}`, { error: String(error) });
    }

    return files;
  }

  private getFileType(dirName: string): ContentFile['type'] {
    const typeMap: Record<string, ContentFile['type']> = {
      大纲: 'outline',
      设定: 'setting',
      人物: 'character',
      正文: 'chapter',
      细纲: 'detailed_outline',
      分卷: 'volume',
    };
    return typeMap[dirName] || 'setting';
  }

  private countWords(content: string): number {
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  private calculateTotalWordCount(structure: ContentStructure): number {
    let total = 0;
    for (const key of Object.keys(structure) as Array<keyof ContentStructure>) {
      for (const file of structure[key]) {
        total += file.wordCount;
      }
    }
    return total;
  }

  async saveChapter(
    chapterNumber: number,
    title: string,
    content: string,
    volumeNumber?: number
  ): Promise<string> {
    if (!this.projectPath) throw new Error('项目未初始化');

    let chapterPath: string;
    if (volumeNumber) {
      chapterPath = `${this.projectPath}/正文/第${volumeNumber}卷/第${chapterNumber}章_${this.sanitizeFileName(title)}.md`;
    } else {
      chapterPath = `${this.projectPath}/正文/第${chapterNumber}章_${this.sanitizeFileName(title)}.md`;
    }

    const dir = chapterPath.substring(0, chapterPath.lastIndexOf('/'));
    if (!(await workshopService.pathExists(dir))) {
      await workshopService.createDirectory(dir);
    }

    const fullContent = `# 第${chapterNumber}章 ${title}\n\n${content}`;
    await workshopService.writeFile(chapterPath, fullContent);

    logger.info(`保存章节: ${chapterPath}`);
    return chapterPath;
  }

  async saveOutline(
    outline: string,
    type: 'main' | 'volume' | 'chapter' = 'main'
  ): Promise<string> {
    if (!this.projectPath) throw new Error('项目未初始化');

    const fileName =
      type === 'main' ? '大纲.md' : type === 'volume' ? '分卷大纲.md' : '章节大纲.md';
    const filePath = `${this.projectPath}/大纲/${fileName}`;

    await workshopService.writeFile(filePath, outline);
    return filePath;
  }

  async saveCharacterProfile(characterName: string, profile: string): Promise<string> {
    if (!this.projectPath) throw new Error('项目未初始化');

    const filePath = `${this.projectPath}/人物/人物小传/${this.sanitizeFileName(characterName)}.md`;

    const fullContent = `# ${characterName}\n\n${profile}`;
    await workshopService.writeFile(filePath, fullContent);

    return filePath;
  }

  async saveSetting(
    settingName: string,
    content: string,
    category: 'world' | 'power' | 'faction' | 'location' = 'world'
  ): Promise<string> {
    if (!this.projectPath) throw new Error('项目未初始化');

    const categoryMap: Record<string, string> = {
      world: '世界观设定.md',
      power: '力量体系.md',
      faction: '势力设定.md',
      location: '地点设定.md',
    };

    const fileName = categoryMap[category];
    const filePath = `${this.projectPath}/设定/${fileName}`;

    const existing = (await workshopService.pathExists(filePath))
      ? await workshopService.readFile(filePath)
      : '';

    const section = `\n## ${settingName}\n\n${content}\n`;
    const newContent = existing + section;

    await workshopService.writeFile(filePath, newContent);
    return filePath;
  }

  async readChapter(chapterNumber: number): Promise<string | null> {
    if (!this.projectPath) return null;

    const pattern = `第${chapterNumber}章`;
    const chapters = await this.scanDirectory('正文');
    const chapter = chapters.find((c) => c.name.includes(pattern));

    if (!chapter) return null;

    return workshopService.readFile(chapter.path);
  }

  async listChapters(): Promise<Array<{ number: number; title: string; path: string }>> {
    if (!this.projectPath) return [];

    const files = await this.scanDirectory('正文');
    const chapters: Array<{ number: number; title: string; path: string }> = [];

    for (const file of files) {
      const match = file.name.match(/第(\d+)章[_.\s]*(.+)?\.md$/);
      if (match) {
        chapters.push({
          number: parseInt(match[1], 10),
          title: match[2] || '',
          path: file.path,
        });
      }
    }

    return chapters.sort((a, b) => a.number - b.number);
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
  }

  async exportProject(): Promise<string> {
    if (!this.projectPath) throw new Error('项目未初始化');

    const structure = await this.getProjectStructure();
    if (!structure) throw new Error('无法获取项目结构');

    const exportData = {
      projectName: structure.projectName,
      exportedAt: Date.now(),
      totalWordCount: structure.totalWordCount,
      chapters: structure.chapters,
      volumes: structure.volumes,
      files: [] as Array<{ path: string; content: string }>,
    };

    const allFiles = [
      ...structure.structure.outline,
      ...structure.structure.settings,
      ...structure.structure.characters,
      ...structure.structure.chapters,
      ...structure.structure.detailedOutlines,
      ...structure.structure.volumes,
    ];

    for (const file of allFiles) {
      try {
        const content = await workshopService.readFile(file.path);
        exportData.files.push({
          path: file.path.replace(this.projectPath!, ''),
          content,
        });
      } catch (error) {
        logger.warn(`导出文件失败: ${file.path}`, { error: String(error) });
      }
    }

    return JSON.stringify(exportData, null, 2);
  }
}

export const contentStructureService = new ContentStructureService();
