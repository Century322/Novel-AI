import { FileNode } from '@/types';

export function findNode(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function getFileStructure(nodes: FileNode[] | undefined | null, depth = 0): string {
  if (!nodes || !Array.isArray(nodes)) {
    return '';
  }
  return nodes
    .map((node) => {
      const indent = '  '.repeat(depth);
      if (node.type === 'folder') {
        return `${indent}- 📂 ${node.name}\n${getFileStructure(node.children || [], depth + 1)}`;
      } else {
        return `${indent}- 📄 ${node.name}`;
      }
    })
    .join('\n');
}

export function getFolderContent(nodes: FileNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'file' && node.content) {
        return node.content;
      }
      if (node.type === 'folder' && node.children) {
        return getFolderContent(node.children);
      }
      return '';
    })
    .join('\n');
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  const partSize = Math.floor(maxLength / 3);
  const startText = content.slice(0, partSize);
  const midStart = Math.floor(content.length / 2) - Math.floor(partSize / 2);
  const midText = content.slice(midStart, midStart + partSize);
  const endText = content.slice(content.length - partSize);

  return `${startText}\n\n[...中间内容略...]\n\n${midText}\n\n[...中间内容略...]\n\n${endText}`;
}

export function deleteNode(nodes: FileNode[], id: string): FileNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (node.children) {
        return { ...node, children: deleteNode(node.children, id) };
      }
      return node;
    });
}

export function updateNodeContent(nodes: FileNode[], id: string, content: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, content };
    }
    if (node.children) {
      return { ...node, children: updateNodeContent(node.children, id, content) };
    }
    return node;
  });
}

export function toggleNodeFolder(nodes: FileNode[], id: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, isOpen: !node.isOpen };
    }
    if (node.children) {
      return { ...node, children: toggleNodeFolder(node.children, id) };
    }
    return node;
  });
}

export function renameNode(nodes: FileNode[], id: string, newName: string): FileNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, name: newName };
    }
    if (node.children) {
      return { ...node, children: renameNode(node.children, id, newName) };
    }
    return node;
  });
}
