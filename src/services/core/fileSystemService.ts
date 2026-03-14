import { indexedDBService } from '@/services/web/indexedDBService';
import { logger } from '@/services/core/loggerService';

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileInfo[] | null;
}

const DEFAULT_STORAGE_ID = 'default_storage';

let initialized = false;
let cacheVersion = 0;
let dbVersion = 0;
let cachedFiles: Map<string, { content: string; type: 'file' | 'directory' }> = new Map();
let refreshPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  
  try {
    const existingProject = await indexedDBService.getProject(DEFAULT_STORAGE_ID);
    if (!existingProject) {
      try {
        await indexedDBService.createProject(DEFAULT_STORAGE_ID, '文件存储');
      } catch (createError) {
        logger.warn('项目可能已存在，继续加载', { error: createError });
      }
    }
    
    const existingFiles = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
    for (const file of existingFiles) {
      if (!cachedFiles.has(file.path)) {
        cachedFiles.set(file.path, { content: file.content, type: file.type || 'file' });
      }
    }
    cacheVersion++;
    dbVersion = cacheVersion;
    initialized = true;
  } catch (error) {
    logger.error('初始化文件系统失败', { error });
    initialized = true;
  }
}

async function refreshCache(force: boolean = false): Promise<void> {
  if (!force && cacheVersion === dbVersion) {
    return;
  }
  
  if (refreshPromise) {
    return refreshPromise;
  }
  
  refreshPromise = (async () => {
    try {
      const existingFiles = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
      cachedFiles.clear();
      for (const file of existingFiles) {
        cachedFiles.set(file.path, { content: file.content, type: file.type || 'file' });
      }
      cacheVersion = dbVersion;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

function invalidateCache(): void {
  dbVersion++;
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
    const file = cachedFiles.get(path);
    if (file) {
      return file.content;
    }
    await refreshCache(true);
    const refreshedFile = cachedFiles.get(path);
    return refreshedFile?.content || '';
  },

  async writeFile(path: string, content: string): Promise<void> {
    await ensureInitialized();
    
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      if (!cachedFiles.has(dirPath)) {
        await this.createDirectory(dirPath);
      }
    }
    
    const existing = cachedFiles.has(path);
    if (existing) {
      await indexedDBService.updateFile(path, content);
    } else {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content, 'file');
    }
    cachedFiles.set(path, { content, type: 'file' });
    invalidateCache();
  },

  async createFile(path: string, content: string = ''): Promise<void> {
    await ensureInitialized();
    
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      if (!cachedFiles.has(dirPath)) {
        await this.createDirectory(dirPath);
      }
    }
    
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content, 'file');
    cachedFiles.set(path, { content, type: 'file' });
    invalidateCache();
  },

  async createDirectory(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, '', 'directory');
    cachedFiles.set(path, { content: '', type: 'directory' });
    invalidateCache();
  },

  async deleteFile(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.deleteFile(path);
    cachedFiles.delete(path);
    invalidateCache();
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
    invalidateCache();
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await ensureInitialized();
    const file = cachedFiles.get(oldPath);
    if (file) {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, newPath, file.content);
      await indexedDBService.deleteFile(oldPath);
      cachedFiles.delete(oldPath);
      cachedFiles.set(newPath, file);
      invalidateCache();
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
    invalidateCache();
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
      invalidateCache();
    }
  },

  hasOpenProject(): boolean {
    return true;
  },

  getProjectName(): string {
    return '文件存储';
  },

  async forceRefresh(): Promise<void> {
    await ensureInitialized();
    await refreshCache(true);
  },
};

export function isFileSystemAccessSupported(): boolean {
  return false;
}

export function getStorageModeName(): string {
  return '浏览器存储';
}

export function getStorageMode(): 'indexeddb' | 'filesystem' {
  return 'indexeddb';
}

export async function exportProject(): Promise<Blob | null> {
  return await fileSystemService.exportAll();
}

export async function importProject(file: File): Promise<string | null> {
  await fileSystemService.importFromJson(file);
  return DEFAULT_STORAGE_ID;
}

export async function openProjectDialog(): Promise<string | null> {
  return null;
}
