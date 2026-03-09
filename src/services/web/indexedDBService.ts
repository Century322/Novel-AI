const DB_NAME = 'ai-novel-workshop';
const DB_VERSION = 1;

interface ProjectData {
  id: string;
  name: string;
  files: FileEntry[];
  createdAt: number;
  updatedAt: number;
}

interface FileEntry {
  path: string;
  content: string;
  type: 'file' | 'directory';
  createdAt: number;
  updatedAt: number;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'path' });
          fileStore.createIndex('projectId', 'projectId', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  async createProject(id: string, name: string): Promise<ProjectData> {
    const db = await this.init();
    const project: ProjectData = {
      id,
      name,
      files: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.add(project);

      request.onsuccess = () => resolve(project);
      request.onerror = () => reject(new Error('Failed to create project'));
    });
  }

  async getProject(id: string): Promise<ProjectData | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get project'));
    });
  }

  async getAllProjects(): Promise<ProjectData[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result as ProjectData[];
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(projects);
      };
      request.onerror = () => reject(new Error('Failed to get projects'));
    });
  }

  async updateProject(id: string, updates: Partial<ProjectData>): Promise<void> {
    const db = await this.init();
    const project = await this.getProject(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const updated = {
      ...project,
      ...updates,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(updated);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update project'));
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.init();

    await this.deleteProjectFiles(id);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete project'));
    });
  }

  async createFile(projectId: string, path: string, content: string = ''): Promise<FileEntry> {
    const db = await this.init();
    const file: FileEntry & { projectId: string } = {
      path,
      content,
      type: 'file',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectId,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(file);

      request.onsuccess = () => resolve(file);
      request.onerror = () => reject(new Error('Failed to create file'));
    });
  }

  async getFile(path: string): Promise<FileEntry | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(path);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get file'));
    });
  }

  async updateFile(path: string, content: string): Promise<void> {
    const db = await this.init();
    const file = await this.getFile(path);

    if (!file) {
      throw new Error('File not found');
    }

    const updated = {
      ...file,
      content,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(updated);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update file'));
    });
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(path);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete file'));
    });
  }

  async getProjectFiles(projectId: string): Promise<FileEntry[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get project files'));
    });
  }

  private async deleteProjectFiles(projectId: string): Promise<void> {
    const files = await this.getProjectFiles(projectId);
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      for (const file of files) {
        store.delete(file.path);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete project files'));
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(new Error('Failed to get setting'));
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to set setting'));
    });
  }

  async exportProject(projectId: string): Promise<Blob> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const files = await this.getProjectFiles(projectId);
    const exportData = {
      version: 1,
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      files: files.map((f) => ({
        path: f.path,
        content: f.content,
        type: f.type,
      })),
    };

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
  }

  async importProject(file: File): Promise<ProjectData> {
    const content = await file.text();
    const data = JSON.parse(content);

    if (data.version !== 1) {
      throw new Error('Unsupported project version');
    }

    const project = await this.createProject(
      data.project.id || `imported_${Date.now()}`,
      data.project.name
    );

    for (const file of data.files) {
      await this.createFile(project.id, file.path, file.content);
    }

    return project;
  }
}

export const indexedDBService = new IndexedDBService();
