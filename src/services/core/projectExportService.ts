import { workshopService } from '../core/workshopService';
import { logger } from '../core/loggerService';
import { contentStructureService } from '../content/contentStructureService';

export interface ExportData {
  version: string;
  exportedAt: number;
  projectName: string;
  totalWordCount: number;
  chapters: number;
  volumes: number;
  worldModel: unknown;
  preferences: unknown;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface ImportResult {
  success: boolean;
  importedFiles: number;
  errors: string[];
  warnings: string[];
}

export class ProjectExportService {
  private projectPath: string | null = null;

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  async exportProject(): Promise<string> {
    if (!this.projectPath) {
      throw new Error('项目路径未设置');
    }

    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      projectName: this.projectPath.split('/').pop() || '未命名项目',
      totalWordCount: 0,
      chapters: 0,
      volumes: 0,
      worldModel: null,
      preferences: null,
      files: [],
    };

    try {
      const worldModelPath = `${this.projectPath}/.ai-workshop/world/worldModel.json`;
      if (await workshopService.pathExists(worldModelPath)) {
        const content = await workshopService.readFile(worldModelPath);
        exportData.worldModel = JSON.parse(content);
      }
    } catch (error) {
      logger.warn('导出世界模型失败', { error: String(error) });
    }

    try {
      const prefPath = `${this.projectPath}/.ai-workshop/memory/longTermMemory.json`;
      if (await workshopService.pathExists(prefPath)) {
        const content = await workshopService.readFile(prefPath);
        exportData.preferences = JSON.parse(content);
      }
    } catch (error) {
      logger.warn('导出偏好失败', { error: String(error) });
    }

    const contentDirs = ['大纲', '设定', '人物', '正文', '细纲', '分卷'];

    for (const dir of contentDirs) {
      await this.exportDirectory(dir, exportData);
    }

    exportData.totalWordCount = this.calculateTotalWords(exportData.files);
    exportData.chapters = exportData.files.filter((f) => f.path.includes('正文/')).length;
    exportData.volumes = exportData.files.filter((f) => f.path.includes('分卷/')).length;

    return JSON.stringify(exportData, null, 2);
  }

  private async exportDirectory(dirName: string, exportData: ExportData): Promise<void> {
    if (!this.projectPath) return;

    const dirPath = `${this.projectPath}/${dirName}`;

    try {
      const items = await workshopService.readDirectory(dirPath);

      for (const item of items) {
        if (item.isDirectory) {
          await this.exportSubDirectory(`${dirName}/${item.name}`, exportData);
        } else if (item.name.endsWith('.md') || item.name.endsWith('.txt')) {
          const filePath = `${dirPath}/${item.name}`;
          const content = await workshopService.readFile(filePath);
          exportData.files.push({
            path: `${dirName}/${item.name}`,
            content,
          });
        }
      }
    } catch (error) {
      logger.warn(`导出目录失败: ${dirName}`, { error: String(error) });
    }
  }

  private async exportSubDirectory(subDirPath: string, exportData: ExportData): Promise<void> {
    if (!this.projectPath) return;

    const dirPath = `${this.projectPath}/${subDirPath}`;

    try {
      const items = await workshopService.readDirectory(dirPath);

      for (const item of items) {
        if (!item.isDirectory && (item.name.endsWith('.md') || item.name.endsWith('.txt'))) {
          const filePath = `${dirPath}/${item.name}`;
          const content = await workshopService.readFile(filePath);
          exportData.files.push({
            path: `${subDirPath}/${item.name}`,
            content,
          });
        }
      }
    } catch (error) {
      logger.warn(`导出子目录失败: ${subDirPath}`, { error: String(error) });
    }
  }

  private calculateTotalWords(files: ExportData['files']): number {
    let total = 0;
    for (const file of files) {
      const chineseChars = (file.content.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = (file.content.match(/[a-zA-Z]+/g) || []).length;
      total += chineseChars + englishWords;
    }
    return total;
  }

  async importProject(jsonData: string, targetPath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      importedFiles: 0,
      errors: [],
      warnings: [],
    };

    let data: ExportData;
    try {
      data = JSON.parse(jsonData);
    } catch {
      result.errors.push('无效的 JSON 格式');
      return result;
    }

    if (!data.version || !data.files) {
      result.errors.push('无效的项目导出文件格式');
      return result;
    }

    this.projectPath = targetPath;

    try {
      await contentStructureService.initialize(targetPath);
    } catch (error) {
      result.errors.push(`初始化项目结构失败: ${String(error)}`);
      return result;
    }

    for (const file of data.files) {
      try {
        const filePath = `${targetPath}/${file.path}`;
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));

        if (!(await workshopService.pathExists(dir))) {
          await workshopService.createDirectory(dir);
        }

        await workshopService.writeFile(filePath, file.content);
        result.importedFiles++;
      } catch {
        result.warnings.push(`导入文件失败: ${file.path}`);
      }
    }

    if (data.worldModel) {
      try {
        const worldModelPath = `${targetPath}/.ai-workshop/world/worldModel.json`;
        await workshopService.writeFile(worldModelPath, JSON.stringify(data.worldModel, null, 2));
      } catch {
        result.warnings.push('导入世界模型失败');
      }
    }

    if (data.preferences) {
      try {
        const prefPath = `${targetPath}/.ai-workshop/memory/longTermMemory.json`;
        await workshopService.writeFile(prefPath, JSON.stringify(data.preferences, null, 2));
      } catch {
        result.warnings.push('导入偏好设置失败');
      }
    }

    result.success = result.importedFiles > 0;
    return result;
  }

  async exportToMarkdown(): Promise<string> {
    if (!this.projectPath) {
      throw new Error('项目路径未设置');
    }

    const exportData = JSON.parse(await this.exportProject());
    const parts: string[] = [];

    parts.push(`# ${exportData.projectName}\n`);
    parts.push(`导出时间: ${new Date(exportData.exportedAt).toLocaleString()}\n`);
    parts.push(`总字数: ${exportData.totalWordCount}\n`);
    parts.push(`章节数: ${exportData.chapters}\n\n`);

    for (const file of exportData.files) {
      if (file.path.includes('正文/')) {
        parts.push(`---\n\n`);
        parts.push(file.content);
        parts.push('\n\n');
      }
    }

    return parts.join('');
  }

  async createBackup(): Promise<string> {
    const exportData = await this.exportProject();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.projectPath}/.ai-workshop/backups/backup-${timestamp}.json`;

    if (!this.projectPath) {
      throw new Error('项目路径未设置');
    }

    const backupDir = backupPath.substring(0, backupPath.lastIndexOf('/'));
    if (!(await workshopService.pathExists(backupDir))) {
      await workshopService.createDirectory(backupDir);
    }

    await workshopService.writeFile(backupPath, exportData);
    return backupPath;
  }

  async listBackups(): Promise<
    Array<{
      path: string;
      timestamp: number;
      size: number;
    }>
  > {
    if (!this.projectPath) return [];

    const backupDir = `${this.projectPath}/.ai-workshop/backups`;
    const backups: Array<{ path: string; timestamp: number; size: number }> = [];

    try {
      if (!(await workshopService.pathExists(backupDir))) {
        return [];
      }

      const items = await workshopService.readDirectory(backupDir);

      for (const item of items) {
        if (!item.isDirectory && item.name.endsWith('.json')) {
          const match = item.name.match(/backup-(.+)\.json/);
          if (match) {
            backups.push({
              path: `${backupDir}/${item.name}`,
              timestamp: new Date(match[1]).getTime(),
              size: 0,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('列出备份失败', { error: String(error) });
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  async restoreBackup(backupPath: string): Promise<ImportResult> {
    if (!this.projectPath) {
      throw new Error('项目路径未设置');
    }

    const content = await workshopService.readFile(backupPath);
    return this.importProject(content, this.projectPath);
  }
}

export const projectExportService = new ProjectExportService();
