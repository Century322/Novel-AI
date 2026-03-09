import type { VectorDocument } from '@/types/retrieval/vectorStore';
import type { StoryState, StateChange, StateSnapshot } from '@/types/narrative/storyState';
import { logger } from '../core/loggerService';

const DB_NAME = 'NarrativeEngineDB';
const DB_VERSION = 1;

const STORES = {
  VECTORS: 'vectors',
  EMBEDDINGS: 'embeddings',
  STORY_STATE: 'storyState',
  SNAPSHOTS: 'snapshots',
  CHANGES: 'changes',
} as const;

export class NarrativePersistenceService {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB', { error: request.error });
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.debug('NarrativePersistenceService initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.VECTORS)) {
          const vectorStore = db.createObjectStore(STORES.VECTORS, { keyPath: 'id' });
          vectorStore.createIndex('type', 'metadata.type', { unique: false });
          vectorStore.createIndex('chapter', 'metadata.chapter', { unique: false });
          vectorStore.createIndex('character', 'metadata.character', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.EMBEDDINGS)) {
          db.createObjectStore(STORES.EMBEDDINGS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.STORY_STATE)) {
          db.createObjectStore(STORES.STORY_STATE, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'createdAt' });
          snapshotStore.createIndex('label', 'label', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CHANGES)) {
          const changeStore = db.createObjectStore(STORES.CHANGES, { keyPath: 'timestamp' });
          changeStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async saveVectorDocument(document: VectorDocument): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VECTORS], 'readwrite');
      const store = transaction.objectStore(STORES.VECTORS);
      const request = store.put(document);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to save vector document', { error: request.error });
        reject(request.error);
      };
    });
  }

  async saveVectorDocuments(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VECTORS], 'readwrite');
      const store = transaction.objectStore(STORES.VECTORS);

      for (const doc of documents) {
        store.put(doc);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        logger.error('Failed to save vector documents', { error: transaction.error });
        reject(transaction.error);
      };
    });
  }

  async getVectorDocument(id: string): Promise<VectorDocument | undefined> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VECTORS], 'readonly');
      const store = transaction.objectStore(STORES.VECTORS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        logger.error('Failed to get vector document', { error: request.error });
        reject(request.error);
      };
    });
  }

  async getAllVectorDocuments(): Promise<VectorDocument[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VECTORS], 'readonly');
      const store = transaction.objectStore(STORES.VECTORS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        logger.error('Failed to get all vector documents', { error: request.error });
        reject(request.error);
      };
    });
  }

  async deleteVectorDocument(id: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.VECTORS], 'readwrite');
      const store = transaction.objectStore(STORES.VECTORS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to delete vector document', { error: request.error });
        reject(request.error);
      };
    });
  }

  async saveEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.EMBEDDINGS], 'readwrite');
      const store = transaction.objectStore(STORES.EMBEDDINGS);
      const request = store.put({ id, embedding });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to save embedding', { error: request.error });
        reject(request.error);
      };
    });
  }

  async getEmbedding(id: string): Promise<number[] | undefined> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.EMBEDDINGS], 'readonly');
      const store = transaction.objectStore(STORES.EMBEDDINGS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result?.embedding);
      request.onerror = () => {
        logger.error('Failed to get embedding', { error: request.error });
        reject(request.error);
      };
    });
  }

  async saveStoryState(state: StoryState): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.STORY_STATE], 'readwrite');
      const store = transaction.objectStore(STORES.STORY_STATE);
      const request = store.put({ key: 'current', state });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to save story state', { error: request.error });
        reject(request.error);
      };
    });
  }

  async loadStoryState(): Promise<StoryState | undefined> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.STORY_STATE], 'readonly');
      const store = transaction.objectStore(STORES.STORY_STATE);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result?.state);
      request.onerror = () => {
        logger.error('Failed to load story state', { error: request.error });
        reject(request.error);
      };
    });
  }

  async saveSnapshot(snapshot: StateSnapshot): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SNAPSHOTS], 'readwrite');
      const store = transaction.objectStore(STORES.SNAPSHOTS);
      const request = store.put(snapshot);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to save snapshot', { error: request.error });
        reject(request.error);
      };
    });
  }

  async loadSnapshots(): Promise<StateSnapshot[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SNAPSHOTS], 'readonly');
      const store = transaction.objectStore(STORES.SNAPSHOTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        logger.error('Failed to load snapshots', { error: request.error });
        reject(request.error);
      };
    });
  }

  async deleteSnapshot(createdAt: number): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SNAPSHOTS], 'readwrite');
      const store = transaction.objectStore(STORES.SNAPSHOTS);
      const request = store.delete(createdAt);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to delete snapshot', { error: request.error });
        reject(request.error);
      };
    });
  }

  async saveChange(change: StateChange): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHANGES], 'readwrite');
      const store = transaction.objectStore(STORES.CHANGES);
      const request = store.put(change);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Failed to save change', { error: request.error });
        reject(request.error);
      };
    });
  }

  async loadChanges(limit?: number): Promise<StateChange[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHANGES], 'readonly');
      const store = transaction.objectStore(STORES.CHANGES);
      const request = store.openCursor(null, 'prev');
      const changes: StateChange[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          changes.push(cursor.value);
          if (limit && changes.length >= limit) {
            resolve(changes);
            return;
          }
          cursor.continue();
        } else {
          resolve(changes);
        }
      };

      request.onerror = () => {
        logger.error('Failed to load changes', { error: request.error });
        reject(request.error);
      };
    });
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    const storeNames = Object.values(STORES);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite');

      for (const storeName of storeNames) {
        transaction.objectStore(storeName).clear();
      }

      transaction.oncomplete = () => {
        logger.debug('All narrative data cleared');
        resolve();
      };

      transaction.onerror = () => {
        logger.error('Failed to clear all data', { error: transaction.error });
        reject(transaction.error);
      };
    });
  }

  async exportAll(): Promise<{
    documents: VectorDocument[];
    state: StoryState | undefined;
    snapshots: StateSnapshot[];
  }> {
    await this.ensureInitialized();

    const documents = await this.getAllVectorDocuments();
    const state = await this.loadStoryState();
    const snapshots = await this.loadSnapshots();

    return { documents, state, snapshots };
  }

  async importAll(data: {
    documents: VectorDocument[];
    state?: StoryState;
    snapshots?: StateSnapshot[];
  }): Promise<void> {
    await this.ensureInitialized();

    if (data.documents.length > 0) {
      await this.saveVectorDocuments(data.documents);
    }

    if (data.state) {
      await this.saveStoryState(data.state);
    }

    if (data.snapshots) {
      for (const snapshot of data.snapshots) {
        await this.saveSnapshot(snapshot);
      }
    }

    logger.debug('Narrative data imported', {
      documents: data.documents.length,
      hasState: !!data.state,
      snapshots: data.snapshots?.length || 0,
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}

export const narrativePersistenceService = new NarrativePersistenceService();
