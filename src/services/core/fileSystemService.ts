import { indexedDBService } from '@/services/web/indexedDBService';

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileInfo[] | null;
}

const DEFAULT_STORAGE_ID = 'default_storage';

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  
  const existingFiles = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
  if (existingFiles.length === 0) {
    await indexedDBService.createProject(DEFAULT_STORAGE_ID, '文件存储');
  }
  initialized = true;
}

export const fileSystemService = {
  async init(): Promise<void> {
    await ensureInitialized();
  },

  async readDirectory(path: string): Promise<FileInfo[]> {
    await ensureInitialized();
    const files = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
    const result: FileInfo[] = [];
    const seenDirs = new Set<string>();

    if (path === '' || path === '/') {
      for (const file of files) {
        const parts = file.path.split('/').filter(Boolean);
        if (parts.length === 1) {
          result.push({
            name: parts[0],
            path: file.path,
            is_dir: file.type === 'directory',
            children: null,
          });
        } else {
          const dirName = parts[0];
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            result.push({
              name: dirName,
              path: dirName,
              is_dir: true,
              children: null,
            });
          }
        }
      }
    } else {
      const dirPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
      for (const file of files) {
        if (file.path.startsWith(dirPath + '/')) {
          const relativePath = file.path.slice(dirPath.length + 1);
          const parts = relativePath.split('/');
          if (parts.length === 1) {
            result.push({
              name: parts[0],
              path: file.path,
              is_dir: file.type === 'directory',
              children: null,
            });
          } else {
            const subDirName = parts[0];
            if (!seenDirs.has(subDirName)) {
              seenDirs.add(subDirName);
              result.push({
                name: subDirName,
                path: `${dirPath}/${subDirName}`,
                is_dir: true,
                children: null,
              });
            }
          }
        }
      }
    }

    return result;
  },

  async readFile(path: string): Promise<string> {
    await ensureInitialized();
    const file = await indexedDBService.getFile(path);
    return file?.content || '';
  },

  async writeFile(path: string, content: string): Promise<void> {
    await ensureInitialized();
    const existing = await indexedDBService.getFile(path);
    if (existing) {
      await indexedDBService.updateFile(path, content);
    } else {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content);
    }
  },

  async createFile(path: string, content: string = ''): Promise<void> {
    await ensureInitialized();
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, content);
  },

  async createDirectory(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.createFile(DEFAULT_STORAGE_ID, path, '');
  },

  async deleteFile(path: string): Promise<void> {
    await ensureInitialized();
    await indexedDBService.deleteFile(path);
  },

  async deleteDirectory(path: string): Promise<void> {
    await ensureInitialized();
    const files = await indexedDBService.getProjectFiles(DEFAULT_STORAGE_ID);
    for (const file of files) {
      if (file.path.startsWith(path + '/') || file.path === path) {
        await indexedDBService.deleteFile(file.path);
      }
    }
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await ensureInitialized();
    const file = await indexedDBService.getFile(oldPath);
    if (file) {
      await indexedDBService.createFile(DEFAULT_STORAGE_ID, newPath, file.content);
      await indexedDBService.deleteFile(oldPath);
    }
  },

  async fileExists(path: string): Promise<boolean> {
    await ensureInitialized();
    const file = await indexedDBService.getFile(path);
    return file !== null;
  },

  async pathExists(path: string): Promise<boolean> {
    await ensureInitialized();
    const file = await indexedDBService.getFile(path);
    return file !== null;
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
  },

  async importFromJson(file: File): Promise<void> {
    await ensureInitialized();
    const content = await file.text();
    const data = JSON.parse(content);
    
    if (data.files && Array.isArray(data.files)) {
      for (const f of data.files) {
        await indexedDBService.createFile(DEFAULT_STORAGE_ID, f.path, f.content || '');
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
