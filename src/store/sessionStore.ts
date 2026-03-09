import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEncryptedStorage } from './encryptedStorage';
import { ChatSession, Message, FileNode } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface SessionState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  globalKnowledgeBase: FileNode[];
}

interface SessionActions {
  createSession: (initialUserMessage?: string) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  addMessage: (role: 'user' | 'assistant' | 'reviewer' | 'system', content: string) => void;
  updateMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  updateLastMessage: (content: string) => void;
  getCurrentSession: () => ChatSession | undefined;
  clearCurrentSessionMessages: () => void;
  addKnowledgeFile: (file: FileNode) => void;
  removeKnowledgeFile: (id: string) => void;
  getKnowledgeBase: () => FileNode[];
}

type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      globalKnowledgeBase: [],

      createSession: (initialUserMessage?: string) => {
        const newSessionId = uuidv4();
        const messages: Message[] = initialUserMessage
          ? [{ id: uuidv4(), role: 'user', content: initialUserMessage, timestamp: Date.now() }]
          : [
              {
                id: uuidv4(),
                role: 'assistant',
                content: '你好！新的篇章开始了，请告诉我你的构思。',
                timestamp: Date.now(),
              },
            ];

        const newSession: ChatSession = {
          id: newSessionId,
          name: initialUserMessage
            ? initialUserMessage.slice(0, 10) + (initialUserMessage.length > 10 ? '...' : '')
            : `新对话 ${get().sessions.length + 1}`,
          messages,
          workspace: [],
          knowledgeBase: [],
          createdAt: Date.now(),
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSessionId,
        }));

        return newSessionId;
      },

      switchSession: (id: string) => {
        set({ currentSessionId: id });
      },

      deleteSession: (id: string) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          let nextSessionId = state.currentSessionId;

          if (state.currentSessionId === id) {
            nextSessionId = newSessions.length > 0 ? newSessions[0].id : null;
          }

          return {
            sessions: newSessions,
            currentSessionId: nextSessionId,
          };
        });
      },

      renameSession: (id: string, name: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, name } : s)),
        }));
      },

      addMessage: (role, content) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        const newMessage: Message = {
          id: uuidv4(),
          role,
          content,
          timestamp: Date.now(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? { ...session, messages: [...session.messages, newMessage] }
              : session
          ),
        }));
      },

      updateMessage: (id: string, content: string) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: session.messages.map((m) => (m.id === id ? { ...m, content } : m)),
                }
              : session
          ),
        }));
      },

      deleteMessage: (id: string) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? { ...session, messages: session.messages.filter((m) => m.id !== id) }
              : session
          ),
        }));
      },

      updateLastMessage: (content: string) => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== currentSessionId) return session;
            const messages = [...session.messages];
            if (messages.length > 0) {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content,
              };
            }
            return { ...session, messages };
          }),
        }));
      },

      getCurrentSession: () => {
        const { sessions, currentSessionId } = get();
        return sessions.find((s) => s.id === currentSessionId);
      },

      clearCurrentSessionMessages: () => {
        const { currentSessionId } = get();
        if (!currentSessionId) return;

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === currentSessionId
              ? {
                  ...session,
                  messages: [
                    {
                      id: uuidv4(),
                      role: 'assistant' as const,
                      content: '你好！新的篇章开始了，请告诉我你的构思。',
                      timestamp: Date.now(),
                    },
                  ],
                }
              : session
          ),
        }));
      },

      addKnowledgeFile: (file: FileNode) => {
        set((state) => ({
          globalKnowledgeBase: [...state.globalKnowledgeBase, file],
        }));
      },

      removeKnowledgeFile: (id: string) => {
        set((state) => ({
          globalKnowledgeBase: state.globalKnowledgeBase.filter((f) => f.id !== id),
        }));
      },

      getKnowledgeBase: () => {
        return get().globalKnowledgeBase;
      },
    }),
    {
      name: 'session-store',
      storage: createEncryptedStorage<SessionStore>(),
    }
  )
);
