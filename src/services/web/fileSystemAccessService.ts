import { logger } from '@/services/core/loggerService';

class FileSystemAccessService {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  private directoryHandles: Map<string, FileSystemDirectoryHandle> = new Map();
  private projectPath: string = '';

  isSupported(): boolean {
    return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window;
  }

  async openProjectDialog(): Promise<string | null> {
    if (!this.isSupported()) {
      logger.error('File System Access API 不支持');
      return null;
    }

    try {
      const showDirectoryPicker = (
        window as unknown as {
          showDirectoryPicker: (options?: { mode: string }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;

      this.rootHandle = await showDirectoryPicker({ mode: 'readwrite' });

      if (this.rootHandle) {
        const projectName = this.rootHandle.name;
        this.projectPath = '';
        this.directoryHandles.clear();
        this.fileHandles.clear();
        this.directoryHandles.set('', this.rootHandle);

        logger.info(`项目已打开: ${projectName}`);
        return projectName;
      }

      return null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug('用户取消了选择');
        return null;
      }
      logger.error('打开项目失败', { error });
      return null;
    }
  }

  async readFile(path: string): Promise<string> {
    if (!this.rootHandle) {
      throw new Error('项目未打开，请点击"打开项目"按钮重新选择文件夹');
    }
    const fileHandle = await this.getFileHandle(path);
    if (!fileHandle) {
      throw new Error(`文件不存在: ${path}`);
    }

    const file = await fileHandle.getFile();
    return await file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('项目未打开，请点击"打开项目"按钮重新选择文件夹');
    }

    const dirPath = path.substring(0, path.lastIndexOf('/'));
    const fileName = path.substring(path.lastIndexOf('/') + 1);

    logger.debug(`writeFile: path=${path}, dirPath=${dirPath}, fileName=${fileName}`);

    const dirHandle = await this.getOrCreateDirectoryHandle(dirPath);
    if (!dirHandle) {
      logger.error(`writeFile: 无法获取目录句柄: ${dirPath}`);
      throw new Error(`无法创建目录: ${dirPath}`);
    }

    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      this.fileHandles.set(path, fileHandle);
      logger.debug(`文件已写入: ${path}`);
    } catch (error) {
      logger.error(`writeFile: 写入文件失败: ${path}`, { error });
      throw error;
    }
  }

  async createFile(path: string, content: string = ''): Promise<void> {
    await this.writeFile(path, content);
  }

  async createDirectory(path: string): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('项目未打开，请先选择项目文件夹');
    }
    await this.getOrCreateDirectoryHandle(path);
    logger.debug(`目录已创建: ${path}`);
  }

  async deleteFile(path: string): Promise<void> {
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    const fileName = path.substring(path.lastIndexOf('/') + 1);

    const dirHandle = await this.getDirectoryHandle(dirPath);
    if (!dirHandle) {
      throw new Error(`目录不存在: ${dirPath}`);
    }

    await dirHandle.removeEntry(fileName);
    this.fileHandles.delete(path);
    logger.debug(`文件已删除: ${path}`);
  }

  async deleteDirectory(path: string): Promise<void> {
    const dirHandle = await this.getDirectoryHandle(path);
    if (!dirHandle) {
      throw new Error(`目录不存在: ${path}`);
    }

    await this.removeDirectoryRecursive(path, dirHandle);
    this.directoryHandles.delete(path);
    logger.debug(`目录已删除: ${path}`);
  }

  private async removeDirectoryRecursive(
    path: string,
    dirHandle: FileSystemDirectoryHandle
  ): Promise<void> {
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    const dirName = path.substring(path.lastIndexOf('/') + 1);

    const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
    for await (const entry of dirHandle.values()) {
      entries.push({ name: entry.name, kind: entry.kind });
    }

    for (const entry of entries) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
        await this.removeDirectoryRecursive(entryPath, subDirHandle);
        this.directoryHandles.delete(entryPath);
      } else {
        await dirHandle.removeEntry(entry.name);
        this.fileHandles.delete(entryPath);
      }
    }

    const parentHandle = parentPath ? await this.getDirectoryHandle(parentPath) : this.rootHandle;

    if (parentHandle) {
      await parentHandle.removeEntry(dirName);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const handle = await this.getFileHandle(path);
      return handle !== null;
    } catch {
      return false;
    }
  }

  async pathExists(path: string): Promise<boolean> {
    if (!path || path === '' || path === '/') {
      return this.rootHandle !== null;
    }

    const dirPath = path.substring(0, path.lastIndexOf('/'));
    const name = path.substring(path.lastIndexOf('/') + 1);

    if (!name) {
      return await this.directoryExists(path);
    }

    const dirHandle = await this.getDirectoryHandle(dirPath);
    if (!dirHandle) {
      return false;
    }

    try {
      for await (const entry of dirHandle.values()) {
        if (entry.name === name) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    if (!path || path === '' || path === '/') {
      return this.rootHandle !== null;
    }

    const handle = await this.getDirectoryHandle(path);
    return handle !== null;
  }

  async readDirectory(path: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
    const dirHandle = await this.getDirectoryHandle(path);
    if (!dirHandle) {
      return [];
    }

    const entries: Array<{ name: string; isDirectory: boolean }> = [];

    for await (const entry of dirHandle.values()) {
      entries.push({
        name: entry.name,
        isDirectory: entry.kind === 'directory',
      });
    }

    return entries;
  }

  async getFileHandle(path: string): Promise<FileSystemFileHandle | null> {
    if (this.fileHandles.has(path)) {
      return this.fileHandles.get(path)!;
    }

    const dirPath = path.substring(0, path.lastIndexOf('/'));
    const fileName = path.substring(path.lastIndexOf('/') + 1);

    const dirHandle = await this.getDirectoryHandle(dirPath);
    if (!dirHandle) {
      return null;
    }

    try {
      const fileHandle = await dirHandle.getFileHandle(fileName);
      this.fileHandles.set(path, fileHandle);
      return fileHandle;
    } catch {
      return null;
    }
  }

  async getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle | null> {
    if (path === '' || path === '/') {
      return this.rootHandle;
    }

    if (this.directoryHandles.has(path)) {
      return this.directoryHandles.get(path)!;
    }

    if (!this.rootHandle) {
      return null;
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle = this.rootHandle;

    for (const part of parts) {
      try {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      } catch {
        return null;
      }
    }

    this.directoryHandles.set(path, currentHandle);
    return currentHandle;
  }

  async getOrCreateDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle | null> {
    if (path === '' || path === '/') {
      return this.rootHandle;
    }

    if (!this.rootHandle) {
      logger.error('getOrCreateDirectoryHandle: rootHandle is null');
      return null;
    }

    if (this.directoryHandles.has(path)) {
      logger.debug(`getOrCreateDirectoryHandle: 从缓存获取目录: ${path}`);
      return this.directoryHandles.get(path)!;
    }

    const parts = path.split('/').filter(Boolean);
    let currentHandle = this.rootHandle;
    let currentPath = '';

    logger.debug(`getOrCreateDirectoryHandle: 开始创建目录路径: ${path}, parts: ${parts.join(',')}`);

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (this.directoryHandles.has(currentPath)) {
        logger.debug(`getOrCreateDirectoryHandle: 从缓存获取子目录: ${currentPath}`);
        currentHandle = this.directoryHandles.get(currentPath)!;
        continue;
      }

      try {
        logger.debug(`getOrCreateDirectoryHandle: 创建子目录: ${part}`);
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        this.directoryHandles.set(currentPath, currentHandle);
        logger.debug(`getOrCreateDirectoryHandle: 子目录创建成功: ${currentPath}`);
      } catch (error) {
        logger.error(`创建目录失败: ${part}`, { error });
        return null;
      }
    }

    this.directoryHandles.set(path, currentHandle);
    logger.debug(`getOrCreateDirectoryHandle: 目录创建完成: ${path}`);
    return currentHandle;
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  getProjectName(): string {
    return this.rootHandle?.name || '未命名项目';
  }

  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  hasRootHandle(): boolean {
    return this.rootHandle !== null;
  }

  clearHandles(): void {
    this.rootHandle = null;
    this.fileHandles.clear();
    this.directoryHandles.clear();
    this.projectPath = '';
  }
}

export const fileSystemAccessService = new FileSystemAccessService();
