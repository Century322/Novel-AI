import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FileNode } from '@/types';
import { useProjectStore } from './projectStore';
import { FileInfo } from '@/services/core/fileSystemService';

interface FileState {
  selectedFileId: string | null;
  selectedFilePath: string | null;
  expandedFolders: string[];
  rootPath: string;
}

interface FileActions {
  selectFile: (id: string | null, path?: string) => void;
  toggleFolderExpand: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;
  setRootPath: (path: string) => void;
  getSelectedFileContent: () => Promise<string>;
  createFileByPath: (path: string, content: string) => Promise<void>;
  getExpandedFolders: () => string[];
}

type FileStore = FileState & FileActions;

function fileInfoToFileNode(info: FileInfo, expandedFolders: string[] = []): FileNode {
  const isOpen = expandedFolders.includes(info.path);
  return {
    id: info.path,
    name: info.name,
    type: info.is_dir ? 'folder' : 'file',
    isOpen,
    children: info.children?.map((c) => fileInfoToFileNode(c, expandedFolders)),
  };
}

const initialState: FileState = {
  selectedFileId: null,
  selectedFilePath: null,
  expandedFolders: [],
  rootPath: '',
};

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      selectFile: (id, path) => {
        set({
          selectedFileId: id,
          selectedFilePath: path || null,
        });
      },

      toggleFolderExpand: (path: string) => {
        set((state) => {
          const expandedFolders = state.expandedFolders.includes(path)
            ? state.expandedFolders.filter((p) => p !== path)
            : [...state.expandedFolders, path];
          return { expandedFolders };
        });
      },

      expandFolder: (path: string) => {
        set((state) => {
          if (state.expandedFolders.includes(path)) {
            return state;
          }
          return { expandedFolders: [...state.expandedFolders, path] };
        });
      },

      collapseFolder: (path: string) => {
        set((state) => ({
          expandedFolders: state.expandedFolders.filter((p) => p !== path),
        }));
      },

      expandAllFolders: () => {
        const projectStore = useProjectStore.getState();
        const allPaths = getAllFolderPaths(projectStore.fileTree);
        set({ expandedFolders: allPaths });
      },

      collapseAllFolders: () => {
        set({ expandedFolders: [] });
      },

      setRootPath: (path: string) => {
        set({ rootPath: path, expandedFolders: [], selectedFileId: null, selectedFilePath: null });
      },

      getSelectedFileContent: async () => {
        const { selectedFilePath } = get();
        if (!selectedFilePath) {
          return '';
        }

        const projectStore = useProjectStore.getState();
        return await projectStore.getFileContent(selectedFilePath);
      },

      createFileByPath: async (path: string, content: string) => {
        const projectStore = useProjectStore.getState();

        const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
        await projectStore.saveFileContent(normalizedPath, content);
        await projectStore.refreshFileTree();
      },

      getExpandedFolders: () => {
        return get().expandedFolders;
      },
    }),
    {
      name: 'file-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedFileId: state.selectedFileId,
        selectedFilePath: state.selectedFilePath,
        expandedFolders: state.expandedFolders,
        rootPath: state.rootPath,
      }),
    }
  )
);

function getAllFolderPaths(files: FileInfo[]): string[] {
  const paths: string[] = [];
  for (const file of files) {
    if (file.is_dir) {
      paths.push(file.path);
      if (file.children) {
        paths.push(...getAllFolderPaths(file.children));
      }
    }
  }
  return paths;
}

export function useFileTreeFromProject() {
  const { fileTree } = useProjectStore();
  const { expandedFolders } = useFileStore();

  const convertToFileNodes = (files: FileInfo[]): FileNode[] => {
    return files.map((f) => fileInfoToFileNode(f, expandedFolders));
  };

  return fileTree.length > 0 ? convertToFileNodes(fileTree) : [];
}
