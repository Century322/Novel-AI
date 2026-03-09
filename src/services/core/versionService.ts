import { workshopService } from './workshopService';
import { logger } from './loggerService';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface VersionSnapshot {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  files: VersionFile[];
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface VersionFile {
  path: string;
  content: string;
  hash: string;
  size: number;
}

export interface VersionDiff {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  lineNumber: number;
}

export class VersionService {
  private projectPath: string;
  private snapshots: Map<string, VersionSnapshot> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(): Promise<void> {
    await this.loadSnapshots();
  }

  private async loadSnapshots(): Promise<void> {
    const versionPath = `${this.projectPath}/.ai-workshop/versions/index.json`;

    if (await workshopService.pathExists(versionPath)) {
      try {
        const content = await workshopService.readFile(versionPath);
        const data = JSON.parse(content);

        for (const snapshot of data.snapshots || []) {
          this.snapshots.set(snapshot.id, snapshot);
        }
      } catch (error) {
        logger.error('加载版本快照失败', { error });
      }
    }
  }

  private async saveSnapshots(): Promise<void> {
    const versionPath = `${this.projectPath}/.ai-workshop/versions/index.json`;
    const data = {
      snapshots: Array.from(this.snapshots.values()),
      lastUpdated: Date.now(),
    };
    await workshopService.writeFile(versionPath, JSON.stringify(data, null, 2));
  }

  async createSnapshot(
    name: string,
    description: string,
    filePaths: string[],
    tags: string[] = []
  ): Promise<VersionSnapshot> {
    const files: VersionFile[] = [];

    for (const filePath of filePaths) {
      const fullPath = `${this.projectPath}/${filePath}`;
      if (await workshopService.pathExists(fullPath)) {
        const content = await workshopService.readFile(fullPath);
        files.push({
          path: filePath,
          content,
          hash: this.hashContent(content),
          size: content.length,
        });
      }
    }

    const snapshot: VersionSnapshot = {
      id: generateId(),
      name,
      description,
      timestamp: Date.now(),
      files,
      tags,
      metadata: {},
    };

    await this.saveSnapshotFiles(snapshot);
    this.snapshots.set(snapshot.id, snapshot);
    await this.saveSnapshots();

    return snapshot;
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async saveSnapshotFiles(snapshot: VersionSnapshot): Promise<void> {
    const snapshotPath = `${this.projectPath}/.ai-workshop/versions/snapshots/${snapshot.id}`;

    for (const file of snapshot.files) {
      const filePath = `${snapshotPath}/${file.path}`;
      await workshopService.writeFile(filePath, file.content);
    }
  }

  async getSnapshot(snapshotId: string): Promise<VersionSnapshot | undefined> {
    return this.snapshots.get(snapshotId);
  }

  async loadSnapshotContent(snapshotId: string, filePath: string): Promise<string | null> {
    const snapshotPath = `${this.projectPath}/.ai-workshop/versions/snapshots/${snapshotId}/${filePath}`;

    if (await workshopService.pathExists(snapshotPath)) {
      return await workshopService.readFile(snapshotPath);
    }

    return null;
  }

  async restoreSnapshot(snapshotId: string, filePaths?: string[]): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }

    const filesToRestore = filePaths || snapshot.files.map((f) => f.path);

    for (const filePath of filesToRestore) {
      const file = snapshot.files.find((f) => f.path === filePath);
      if (file) {
        const fullPath = `${this.projectPath}/${filePath}`;
        await workshopService.writeFile(fullPath, file.content);
      }
    }

    return true;
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    if (!this.snapshots.has(snapshotId)) {
      return false;
    }

    this.snapshots.delete(snapshotId);
    await this.saveSnapshots();

    const snapshotPath = `${this.projectPath}/.ai-workshop/versions/snapshots/${snapshotId}`;
    await workshopService.deleteFile(snapshotPath);

    return true;
  }

  getAllSnapshots(): VersionSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getSnapshotsByTag(tag: string): VersionSnapshot[] {
    return this.getAllSnapshots().filter((s) => s.tags.includes(tag));
  }

  async compareSnapshots(snapshotId1: string, snapshotId2: string): Promise<VersionDiff[]> {
    const snapshot1 = this.snapshots.get(snapshotId1);
    const snapshot2 = this.snapshots.get(snapshotId2);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }

    const diffs: VersionDiff[] = [];
    const allPaths = new Set([
      ...snapshot1.files.map((f) => f.path),
      ...snapshot2.files.map((f) => f.path),
    ]);

    for (const path of allPaths) {
      const file1 = snapshot1.files.find((f) => f.path === path);
      const file2 = snapshot2.files.find((f) => f.path === path);

      if (!file1 && file2) {
        diffs.push({
          path,
          type: 'added',
          newContent: file2.content,
          hunks: this.createFullContentHunks(file2.content, 'add'),
        });
      } else if (file1 && !file2) {
        diffs.push({
          path,
          type: 'deleted',
          oldContent: file1.content,
          hunks: this.createFullContentHunks(file1.content, 'delete'),
        });
      } else if (file1 && file2 && file1.hash !== file2.hash) {
        const hunks = this.computeDiffHunks(file1.content, file2.content);
        diffs.push({
          path,
          type: 'modified',
          oldContent: file1.content,
          newContent: file2.content,
          hunks,
        });
      }
    }

    return diffs;
  }

  private createFullContentHunks(content: string, type: 'add' | 'delete'): DiffHunk[] {
    const lines = content.split('\n');
    return [
      {
        oldStart: type === 'delete' ? 1 : 0,
        oldLines: type === 'delete' ? lines.length : 0,
        newStart: type === 'add' ? 1 : 0,
        newLines: type === 'add' ? lines.length : 0,
        lines: lines.map((line, index) => ({
          type,
          content: line,
          lineNumber: index + 1,
        })),
      },
    ];
  }

  private computeDiffHunks(oldContent: string, newContent: string): DiffHunk[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const hunks: DiffHunk[] = [];

    const lcs = this.computeLCS(oldLines, newLines);

    let oldIndex = 0;
    let newIndex = 0;
    let lcsIndex = 0;
    let currentHunk: DiffHunk | null = null;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (
        lcsIndex < lcs.length &&
        oldIndex < oldLines.length &&
        newIndex < newLines.length &&
        oldLines[oldIndex] === lcs[lcsIndex] &&
        newLines[newIndex] === lcs[lcsIndex]
      ) {
        if (currentHunk) {
          hunks.push(currentHunk);
          currentHunk = null;
        }

        if (!currentHunk) {
          currentHunk = {
            oldStart: oldIndex + 1,
            oldLines: 0,
            newStart: newIndex + 1,
            newLines: 0,
            lines: [],
          };
        }

        currentHunk.lines.push({
          type: 'context',
          content: oldLines[oldIndex],
          lineNumber: oldIndex + 1,
        });
        currentHunk.oldLines++;
        currentHunk.newLines++;

        oldIndex++;
        newIndex++;
        lcsIndex++;
      } else if (
        oldIndex < oldLines.length &&
        (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])
      ) {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldIndex + 1,
            oldLines: 0,
            newStart: newIndex + 1,
            newLines: 0,
            lines: [],
          };
        }

        currentHunk.lines.push({
          type: 'delete',
          content: oldLines[oldIndex],
          lineNumber: oldIndex + 1,
        });
        currentHunk.oldLines++;
        oldIndex++;
      } else if (
        newIndex < newLines.length &&
        (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])
      ) {
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldIndex + 1,
            oldLines: 0,
            newStart: newIndex + 1,
            newLines: 0,
            lines: [],
          };
        }

        currentHunk.lines.push({
          type: 'add',
          content: newLines[newIndex],
          lineNumber: newIndex + 1,
        });
        currentHunk.newLines++;
        newIndex++;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks.length > 0 ? hunks : this.createFullContentHunks(newContent, 'add');
  }

  private computeLCS(oldLines: string[], newLines: string[]): string[] {
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lcs: string[] = [];
    let i = m,
      j = n;
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs.unshift(oldLines[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  async createAutoSnapshot(description: string): Promise<VersionSnapshot | null> {
    try {
      const projectFiles = await this.getProjectFiles();

      const snapshot = await this.createSnapshot(
        `自动快照 ${new Date().toLocaleString()}`,
        description,
        projectFiles,
        ['auto']
      );

      return snapshot;
    } catch (error) {
      logger.error('创建自动快照失败', { error });
      return null;
    }
  }

  private async getProjectFiles(): Promise<string[]> {
    const files: string[] = [];
    const contentPath = `${this.projectPath}/content`;

    if (await workshopService.pathExists(contentPath)) {
      await this.scanDirectory(contentPath, files, 'content');
    }

    return files;
  }

  private async scanDirectory(dir: string, files: string[], basePath: string): Promise<void> {
    const entries = await workshopService.readDirectory(dir);

    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      const relativePath = `${basePath}/${entry.name}`;

      if (entry.isDirectory) {
        await this.scanDirectory(fullPath, files, relativePath);
      } else if (this.isContentFile(entry.name)) {
        files.push(relativePath);
      }
    }
  }

  private isContentFile(filename: string): boolean {
    const extensions = ['.txt', '.md', '.json'];
    return extensions.some((ext) => filename.endsWith(ext));
  }

  async cleanupOldSnapshots(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAge;
    const toDelete: string[] = [];

    for (const snapshot of this.snapshots.values()) {
      if (snapshot.tags.includes('auto') && snapshot.timestamp < cutoff) {
        toDelete.push(snapshot.id);
      }
    }

    for (const id of toDelete) {
      await this.deleteSnapshot(id);
    }

    return toDelete.length;
  }

  getSnapshotStats(): {
    total: number;
    autoSnapshots: number;
    manualSnapshots: number;
    totalSize: number;
    oldestSnapshot: number | null;
    newestSnapshot: number | null;
  } {
    const snapshots = this.getAllSnapshots();

    return {
      total: snapshots.length,
      autoSnapshots: snapshots.filter((s) => s.tags.includes('auto')).length,
      manualSnapshots: snapshots.filter((s) => !s.tags.includes('auto')).length,
      totalSize: snapshots.reduce(
        (sum, s) => sum + s.files.reduce((fSum, f) => fSum + f.size, 0),
        0
      ),
      oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : null,
      newestSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : null,
    };
  }
}

export function createVersionService(projectPath: string): VersionService {
  return new VersionService(projectPath);
}
