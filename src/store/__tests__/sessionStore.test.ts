import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../sessionStore';

describe('SessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      currentSessionId: null,
      globalKnowledgeBase: [],
    });
  });

  it('should create a new session', () => {
    const { createSession } = useSessionStore.getState();

    const sessionId = createSession();
    const { sessions, currentSessionId } = useSessionStore.getState();

    expect(sessionId).toBeDefined();
    expect(sessions.length).toBe(1);
    expect(currentSessionId).toBe(sessionId);
    expect(sessions[0].messages.length).toBe(1);
  });

  it('should create session with initial message', () => {
    const { createSession } = useSessionStore.getState();

    createSession('Hello World');
    const { sessions } = useSessionStore.getState();

    expect(sessions[0].messages.length).toBe(1);
    expect(sessions[0].messages[0].role).toBe('user');
    expect(sessions[0].messages[0].content).toBe('Hello World');
    expect(sessions[0].name).toContain('Hello Wor');
  });

  it('should switch session', () => {
    const { createSession, switchSession } = useSessionStore.getState();

    const sessionId1 = createSession();
    const sessionId2 = createSession();

    expect(useSessionStore.getState().currentSessionId).toBe(sessionId2);

    switchSession(sessionId1);
    expect(useSessionStore.getState().currentSessionId).toBe(sessionId1);
  });

  it('should delete session', () => {
    const { createSession, deleteSession } = useSessionStore.getState();

    const sessionId1 = createSession();
    const sessionId2 = createSession();

    expect(useSessionStore.getState().sessions.length).toBe(2);

    deleteSession(sessionId2);
    const state = useSessionStore.getState();
    expect(state.sessions.length).toBe(1);
    expect(state.sessions[0].id).toBe(sessionId1);
  });

  it('should rename session', () => {
    const { createSession, renameSession } = useSessionStore.getState();

    const sessionId = createSession();
    renameSession(sessionId, 'New Name');

    expect(useSessionStore.getState().sessions[0].name).toBe('New Name');
  });

  it('should add message to current session', () => {
    const { createSession, addMessage } = useSessionStore.getState();

    createSession();
    addMessage('user', 'Test message');

    const session = useSessionStore.getState().sessions[0];
    expect(session.messages.length).toBe(2);
    expect(session.messages[1].content).toBe('Test message');
  });

  it('should update message', () => {
    const { createSession, addMessage, updateMessage } = useSessionStore.getState();

    createSession();
    addMessage('user', 'Original message');

    const session = useSessionStore.getState().sessions[0];
    const messageId = session.messages[1].id;

    updateMessage(messageId, 'Updated message');

    const updatedSession = useSessionStore.getState().sessions[0];
    expect(updatedSession.messages[1].content).toBe('Updated message');
  });

  it('should delete message', () => {
    const { createSession, addMessage, deleteMessage } = useSessionStore.getState();

    createSession();
    addMessage('user', 'Message to delete');

    let session = useSessionStore.getState().sessions[0];
    expect(session.messages.length).toBe(2);

    const messageId = session.messages[1].id;
    deleteMessage(messageId);

    session = useSessionStore.getState().sessions[0];
    expect(session.messages.length).toBe(1);
  });

  it('should update last message', () => {
    const { createSession, updateLastMessage } = useSessionStore.getState();

    createSession();
    updateLastMessage('Updated last message');

    const session = useSessionStore.getState().sessions[0];
    expect(session.messages[session.messages.length - 1].content).toBe('Updated last message');
  });

  it('should get current session', () => {
    const { createSession, getCurrentSession } = useSessionStore.getState();

    const sessionId = createSession();
    const session = getCurrentSession();

    expect(session).toBeDefined();
    expect(session?.id).toBe(sessionId);
  });

  it('should clear current session messages', () => {
    const { createSession, addMessage, clearCurrentSessionMessages } = useSessionStore.getState();

    createSession();
    addMessage('user', 'Message 1');
    addMessage('assistant', 'Message 2');

    let session = useSessionStore.getState().sessions[0];
    expect(session.messages.length).toBe(3);

    clearCurrentSessionMessages();

    session = useSessionStore.getState().sessions[0];
    expect(session.messages.length).toBe(1);
    expect(session.messages[0].role).toBe('assistant');
  });

  it('should manage knowledge base', () => {
    const { addKnowledgeFile, removeKnowledgeFile } = useSessionStore.getState();

    const file = {
      id: 'file1',
      name: 'test.txt',
      path: '/test.txt',
      type: 'file' as const,
      children: [],
    };

    addKnowledgeFile(file);
    const { getKnowledgeBase } = useSessionStore.getState();
    expect(getKnowledgeBase().length).toBe(1);

    removeKnowledgeFile('file1');
    expect(useSessionStore.getState().getKnowledgeBase().length).toBe(0);
  });
});
