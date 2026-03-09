import {
  ExtractionType,
  ExtractedInfo,
  ExtractedCharacter,
  DOCUMENT_TEMPLATES,
} from '@/types/knowledge/extraction';
import { workshopService } from '../core/workshopService';

export interface GeneratedDocument {
  path: string;
  content: string;
  type: ExtractionType;
  action: 'create' | 'update' | 'append';
}

export class DocumentGeneratorService {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async generateDocuments(extractions: ExtractedInfo[]): Promise<GeneratedDocument[]> {
    const documents: GeneratedDocument[] = [];

    for (const extraction of extractions) {
      const doc = await this.generateDocument(extraction);
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  }

  private async generateDocument(extraction: ExtractedInfo): Promise<GeneratedDocument | null> {
    const template = DOCUMENT_TEMPLATES[extraction.type];

    const data = extraction.data as unknown as Record<string, unknown>;
    const content = this.renderTemplate(template.template, data);
    const filename = this.renderTemplate(template.filename, data);
    const folder = template.folder;

    const fullPath = `${folder}/${filename}`;
    const action = await this.determineAction(fullPath);

    let finalContent = content;
    if (action === 'append') {
      finalContent = await this.appendToExisting(fullPath, content);
    } else if (action === 'update') {
      finalContent = await this.mergeWithExisting(fullPath, content, extraction);
    }

    return {
      path: fullPath,
      content: finalContent,
      type: extraction.type,
      action,
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    let result = template;

    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
      const items = data[key];
      if (!Array.isArray(items) || items.length === 0) {
        return '';
      }
      return items
        .map((item: unknown) => {
          let itemResult = inner;
          if (typeof item === 'string') {
            itemResult = itemResult.replace(/\{\{this\}\}/g, item);
          } else if (typeof item === 'object' && item !== null) {
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              itemResult = itemResult.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            }
          }
          return itemResult;
        })
        .join('');
    });

    result = result.replace(/\{\{#each\s+details\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, inner) => {
      const details = data.details;
      if (!details || typeof details !== 'object') {
        return '';
      }
      return Object.entries(details as Record<string, unknown>)
        .map(([key, value]) => {
          let itemResult = inner;
          itemResult = itemResult.replace(/\{\{@key\}\}/g, key);
          itemResult = itemResult.replace(/\{\{this\}\}/g, String(value));
          return itemResult;
        })
        .join('');
    });

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      let replacement: string;

      if (Array.isArray(value)) {
        replacement = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        replacement = JSON.stringify(value);
      } else {
        replacement = String(value ?? '');
      }

      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        replacement
      );
    }

    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
  }

  private async determineAction(path: string): Promise<'create' | 'update' | 'append'> {
    const fullPath = `${this.projectPath}/${path}`;
    const exists = await workshopService.pathExists(fullPath);

    if (!exists) {
      return 'create';
    }

    const filename = path.split('/').pop() || '';
    if (filename.includes('伏笔') || filename.includes('时间线') || filename.includes('关系')) {
      return 'append';
    }

    return 'update';
  }

  private async appendToExisting(path: string, newContent: string): Promise<string> {
    const fullPath = `${this.projectPath}/${path}`;

    try {
      const existingContent = await workshopService.readFile(fullPath);
      return existingContent + '\n\n' + newContent;
    } catch {
      return newContent;
    }
  }

  private async mergeWithExisting(
    path: string,
    newContent: string,
    extraction: ExtractedInfo
  ): Promise<string> {
    const fullPath = `${this.projectPath}/${path}`;

    try {
      const existingContent = await workshopService.readFile(fullPath);

      if (extraction.type === 'character') {
        return this.mergeCharacterContent(existingContent, extraction.data as ExtractedCharacter);
      }

      return newContent;
    } catch {
      return newContent;
    }
  }

  private mergeCharacterContent(existing: string, newData: ExtractedCharacter): string {
    const lines = existing.split('\n');
    const result: string[] = [];
    let inSection = false;
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        inSection = true;
        currentSection = line.replace('## ', '').trim();
      }

      if (inSection && currentSection === '性格特征' && newData.personality.length > 0) {
        if (!line.startsWith('-') && !line.startsWith('##')) {
          result.push(line);
          for (const trait of newData.personality) {
            result.push(`- ${trait}`);
          }
          continue;
        }
      }

      result.push(line);
    }

    return result.join('\n');
  }

  async saveDocuments(
    documents: GeneratedDocument[]
  ): Promise<{ success: boolean; saved: string[]; errors: string[] }> {
    const saved: string[] = [];
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        const fullPath = `${this.projectPath}/${doc.path}`;
        await workshopService.writeFile(fullPath, doc.content);
        saved.push(doc.path);
      } catch (error) {
        errors.push(`${doc.path}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      saved,
      errors,
    };
  }

  generatePreview(extraction: ExtractedInfo): string {
    const template = DOCUMENT_TEMPLATES[extraction.type];
    return this.renderTemplate(
      template.template,
      extraction.data as unknown as Record<string, unknown>
    );
  }

  generateSummary(extractions: ExtractedInfo[]): string {
    if (extractions.length === 0) {
      return '未检测到需要保存的信息';
    }

    const summary: string[] = ['📋 检测到以下信息：\n'];

    const typeNames: Record<ExtractionType, string> = {
      character: '人物',
      worldbuilding: '世界观',
      plot: '剧情',
      foreshadowing: '伏笔',
      skill: '技能',
      item: '物品',
      relationship: '关系',
      timeline: '时间线',
      setting: '设定',
    };

    for (const extraction of extractions) {
      const data = extraction.data as unknown as Record<string, unknown>;
      const name = data.name || data.title || data.key || data.content || '未命名';

      summary.push(`- ${typeNames[extraction.type]}: ${name}`);
    }

    return summary.join('\n');
  }

  async checkConflicts(
    extractions: ExtractedInfo[]
  ): Promise<Array<{ type: ExtractionType; name: string; conflict: string }>> {
    const conflicts: Array<{ type: ExtractionType; name: string; conflict: string }> = [];

    for (const extraction of extractions) {
      if (extraction.type === 'character') {
        const charData = extraction.data as ExtractedCharacter;
        const charPath = `设定/人物/${charData.name}.md`;
        const exists = await workshopService.pathExists(`${this.projectPath}/${charPath}`);

        if (exists) {
          conflicts.push({
            type: 'character',
            name: charData.name,
            conflict: `人物 "${charData.name}" 已存在，将更新现有文件`,
          });
        }
      }
    }

    return conflicts;
  }
}

export function createDocumentGeneratorService(projectPath: string): DocumentGeneratorService {
  return new DocumentGeneratorService(projectPath);
}
