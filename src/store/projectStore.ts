import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEncryptedStorage } from './encryptedStorage';
import { fileSystemService, FileInfo } from '@/services/core/fileSystemService';

interface ProjectState {
  fileTree: FileInfo[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  init: () => Promise<void>;
  refreshFileTree: () => Promise<void>;
  setFileTree: (tree: FileInfo[]) => void;
  getFileContent: (path: string) => Promise<string>;
  saveFileContent: (path: string, content: string) => Promise<void>;
  createFile: (parentPath: string, fileName: string, content?: string) => Promise<void>;
  createFolder: (parentPath: string, folderName: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  exportAll: () => Promise<Blob | null>;
  importFiles: (files: FileList) => Promise<void>;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      fileTree: [],
      isLoading: false,
      error: null,

      init: async () => {
        try {
          set({ isLoading: true, error: null });
          await fileSystemService.init();
          await get().refreshFileTree();
        } catch (e) {
          set({ error: `初始化失败: ${e}`, isLoading: false });
        }
      },

      refreshFileTree: async () => {
        try {
          set({ isLoading: true });
          const fileTree = await fileSystemService.readDirectory('');
          set({ fileTree, isLoading: false });
        } catch (e) {
          set({ error: `刷新文件树失败: ${e}`, isLoading: false });
        }
      },

      setFileTree: (tree: FileInfo[]) => {
        set({ fileTree: tree });
      },

      getFileContent: async (path: string) => {
        return await fileSystemService.readFile(path);
      },

      saveFileContent: async (path: string, content: string) => {
        await fileSystemService.writeFile(path, content);
      },

      createFile: async (parentPath: string, fileName: string, content: string = '') => {
        const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
        await fileSystemService.createFile(filePath, content);
        await get().refreshFileTree();
      },

      createFolder: async (parentPath: string, folderName: string) => {
        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
        await fileSystemService.createDirectory(folderPath);
        await get().refreshFileTree();
      },

      deleteFile: async (path: string) => {
        const fileTree = get().fileTree;
        const findNode = (nodes: FileInfo[], targetPath: string): FileInfo | null => {
          for (const node of nodes) {
            if (node.path === targetPath) return node;
            if (node.children) {
              const found = findNode(node.children, targetPath);
              if (found) return found;
            }
          }
          return null;
        };

        const node = findNode(fileTree, path);
        if (node?.is_dir) {
          await fileSystemService.deleteDirectory(path);
        } else {
          await fileSystemService.deleteFile(path);
        }
        await get().refreshFileTree();
      },

      renameFile: async (oldPath: string, newName: string) => {
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const lastSepIndex = oldPath.lastIndexOf(separator);
        const parentPath = oldPath.substring(0, lastSepIndex);
        const newPath = `${parentPath}${separator}${newName}`;
        await fileSystemService.renameFile(oldPath, newPath);
        await get().refreshFileTree();
      },

      exportAll: async () => {
        return await fileSystemService.exportAll();
      },

      importFiles: async (files: FileList) => {
        for (const file of Array.from(files)) {
          if (file.name.endsWith('.json')) {
            await fileSystemService.importFromJson(file);
          } else {
            await fileSystemService.importFiles(file);
          }
        }
        await get().refreshFileTree();
      },
    }),
    {
      name: 'project-store',
      storage: createEncryptedStorage<ProjectStore>(),
    }
  )
);
