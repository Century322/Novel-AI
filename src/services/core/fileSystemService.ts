import { indexedDBService } from '@/services/web/indexedDBService';

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileInfo[] | null;
}

const DEFAULT_STORAGE_ID = 'default_storage';

let initialized = false;
let cachedFiles: Map<string, { content: string; type: 'file' | 'directory' }> = new Map();

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  
  const existingFiles = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
  if (existingFiles.length === 0) {
    await indexedDBService.createProject(DEFAULT_STORAGE_ID, '文件存储');
  }
  
  for (const file of existingFiles) {
    if (!cachedFiles.has(file.path)) {
      cachedFiles.set(file.path, { content: file.content, type: file.type || 'file' });
    }
  }
  initialized = true;
}

async function refreshCache(): Promise<void> {
  const existingFiles = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
  cachedFiles.clear();
  for (const file of existingFiles) {
    cachedFiles.set(file.path, { content: file.content, type: file.type || 'file' });
  }
}

export const fileSystemService = {
  async init(): Promise<void> {
    await ensureInitialized();
  },

  async readDirectory(path: string, skipRefresh: boolean = false): Promise<FileInfo[]> {
    await ensureInitialized();
    if (!skipRefresh) {
      await refreshCache();
    }
    const result: FileInfo[] = [];
    const dirChildren: Map<string, FileInfo[]> = new Map();

    if (path === '' || path === '/') {
      for (const [filePath, fileData] of cachedFiles) {
        const parts = filePath.split('/').filter(Boolean);
        if (parts.length === 1) {
          if (fileData.type === 'directory') {
            const dirFiles = await this.readDirectory(filePath, true);
            result.push({
              name: parts[0],
              path: filePath,
              is_dir: true,
              children: dirFiles.length > 0 ? dirFiles : null,
            });
          } else {
            result.push({
              name: parts[0],
              path: filePath,
              is_dir: false,
              children: null,
            });
          }
        } else {
          const dirName = parts[0];
          if (!dirChildren.has(dirName)) {
            dirChildren.set(dirName, []);
          }
        }
      }

      for (const [dirName] of dirChildren) {
        const existingDir = result.find((r) => r.name === dirName);
        if (!existingDir) {
          const dirFiles = await this.readDirectory(dirName, true);
          result.push({
            name: dirName,
            path: dirName,
            is_dir: true,
            children: dirFiles.length > 0 ? dirFiles : null,
          });
        }
      }
    } else {
      const dirPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
      for (const [filePath, fileData] of cachedFiles) {
        if (filePath.startsWith(dirPath + '/')) {
          const relativePath = filePath.slice(dirPath.length + 1);
          const parts = relativePath.split('/');
          if (parts.length === 1) {
            if (fileData.type === 'directory') {
              const subDirFiles = await this.readDirectory(filePath, true);
              result.push({
                name: parts[0],
                path: filePath,
                is_dir: true,
                children: subDirFiles.length > 0 ? subDirFiles : null,
              });
            } else {
              result.push({
                name: parts[0],
                path: filePath,
                is_dir: false,
                children: null,
              });
            }
          } else {
            const subDirName = parts[0];
            if (!dirChildren.has(subDirName)) {
              dirChildren.set(subDirName, []);
            }
          }
        }
      }

      for (const [subDirName] of dirChildren) {
        const existingDir = result.find((r) => r.name === subDirName);
        if (!existingDir) {
          const subDirFiles = await this.readDirectory(`${dirPath}/${subDirName}`, true);
          result.push({
            name: subDirName,
            path: `${dirPath}/${subDirName}`,
            is_dir: true,
            children: subDirFiles.length > 0 ? subDirFiles : null,
          });
        }
      }
    }

    return result;
  },

  async readFile(path: string): Promise<string> {
    await ensureInitialized();
    await refreshCache();
    const file = cachedFiles.get(path);
    return file?.content || '';
  },

  async writeFile(path: string, content: string): Promise<void> {
    await ensureInitialized();
    const existing = cachedFiles.has(path);
    if (existing) {
      await indexedDBService.updateFile(path, content);
      cachedFiles.set(path, { content, type: 'file' });
    } else {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content, 'file');
      cachedFiles.set(path, { content, type: 'file' });
    }
  },

  async createFile(path: string, content: string = ''): Promise<void> {
    await ensureInitialized();
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content, 'file');
    cachedFiles.set(path, { content, type: 'file' });
  },

  async createDirectory(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, '', 'directory');
    cachedFiles.set(path, { content: '', type: 'directory' });
  },

  async deleteFile(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.deleteFile(path);
    cachedFiles.delete(path);
  },

  async deleteDirectory(path: string): Promise<void> {
    await ensureInitialized();
    const pathsToDelete: string[] = [];
    for (const filePath of cachedFiles.keys()) {
      if (filePath.startsWith(path + '/') || filePath === path) {
        pathsToDelete.push(filePath);
      }
    }
    for (const filePath of pathsToDelete) {
      await indexedDBService.deleteFile(filePath);
      cachedFiles.delete(filePath);
    }
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await ensureInitialized();
    const file = cachedFiles.get(oldPath);
    if (file) {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, newPath, file.content);
      await indexedDBService.deleteFile(oldPath);
      cachedFiles.delete(oldPath);
      cachedFiles.set(newPath, file);
    }
  },

  async fileExists(path: string): Promise<boolean> {
    await ensureInitialized();
    return cachedFiles.has(path);
  },

  async pathExists(path: string): Promise<boolean> {
    await ensureInitialized();
    return cachedFiles.has(path);
  },

  async exportAll(): Promise<Blob> {
    await ensureInitialized();
    return await indexedDBService.exportProject(DEFAULT_STORAGE_ID);
  },

  async importFiles(file: File): Promise<void> {
    await ensureInitialized();
    const content = await file.text();
    const path = file.name;
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content);
    cachedFiles.set(path, { content, type: 'file' });
  },

  async importFromJson(file: File): Promise<void> {
    await ensureInitialized();
    const content = await file.text();
    const data = JSON.parse(content);
    
    if (data.files && Array.isArray(data.files)) {
      for (const f of data.files) {
        await indexedDBService.createFile(DEFAULT_STORAGE_ID, f.path, f.content || '');
        cachedFiles.set(f.path, { content: f.content || '', type: f.type || 'file' });
      }
    }
  },

  hasOpenProject(): boolean {
    return true;
  },

  getProjectName(): string {
    return '文件存储';
  },
};

export function isFileSystemAccessSupported(): boolean {
  return false;
}

export function getStorageModeName(): string {
  return '浏览器存储';
}
