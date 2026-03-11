import { useCallback } from 'react';
import { useSessionStore, useProjectStore } from '@/store';
import { validateAndReadFile } from '@/utils';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { FileNode } from '@/types';
import { logger } from '@/services/core/loggerService';

export function useFileUpload() {
  const { addKnowledgeFile } = useSessionStore();
  const { saveFileContent, refreshFileTree } = useProjectStore();

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) {
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.name.endsWith('.zip')) {
          try {
            const zip = await JSZip.loadAsync(file);
            const folderId = uuidv4();
            const folderNode: FileNode = {
              id: folderId,
              name: file.name,
              type: 'folder',
              isOpen: false,
              children: [],
            };

            const children: FileNode[] = [];
            for (const [path, zipEntry] of Object.entries(zip.files)) {
              if (!zipEntry.dir) {
                const content = await zipEntry.async('string');
                children.push({
                  id: uuidv4(),
                  name: path.split('/').pop() || path,
                  type: 'file',
                  content,
                });
              }
            }
            folderNode.children = children;
            addKnowledgeFile(folderNode);
          } catch (error) {
            logger.error('处理 ZIP 文件失败', { error });
          }
        } else {
          const result = await validateAndReadFile(file);
          if (result.valid && result.content) {
            addKnowledgeFile({
              id: uuidv4(),
              name: file.name,
              type: 'file',
              content: result.content,
            });
          } else {
            logger.error('文件验证失败', { error: result.error });
          }
        }
      }

      e.target.value = '';
    },
    [addKnowledgeFile]
  );

  const handleWorkspaceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) {
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await validateAndReadFile(file);

        if (result.valid && result.content) {
          const filePath = (file.webkitRelativePath || file.name)
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');
          await saveFileContent(filePath, result.content);
        } else {
          logger.error('文件验证失败', { error: result.error });
        }
      }

      await refreshFileTree();
      e.target.value = '';
    },
    [saveFileContent, refreshFileTree]
  );

  return {
    handleFileUpload,
    handleWorkspaceUpload,
  };
}
