import { describe, it, expect, beforeEach } from 'vitest';
import { useApiKeyStore } from '../apiKeyStore';

describe('ApiKeyStore', () => {
  beforeEach(() => {
    useApiKeyStore.setState({
      keys: [],
      selectedModelId: null,
      selectedKeyId: null,
    });
  });

  it('should add a new API key', async () => {
    const { addKey } = useApiKeyStore.getState();

    const keyId = await addKey('openai', 'sk-test123', 'Test Key');
    const { keys } = useApiKeyStore.getState();

    expect(keyId).toBeDefined();
    expect(keys.length).toBe(1);
    expect(keys[0].provider).toBe('openai');
    expect(keys[0].name).toBe('Test Key');
    expect(keys[0].isEnabled).toBe(true);
  });

  it('should remove an API key', async () => {
    const { addKey, removeKey } = useApiKeyStore.getState();

    const keyId = await addKey('openai', 'sk-test123');
    expect(useApiKeyStore.getState().keys.length).toBe(1);

    removeKey(keyId);
    expect(useApiKeyStore.getState().keys.length).toBe(0);
  });

  it('should toggle key enabled state', async () => {
    const { addKey, toggleKey } = useApiKeyStore.getState();

    const keyId = await addKey('openai', 'sk-test123');
    expect(useApiKeyStore.getState().keys[0].isEnabled).toBe(true);

    toggleKey(keyId);
    expect(useApiKeyStore.getState().keys[0].isEnabled).toBe(false);

    toggleKey(keyId);
    expect(useApiKeyStore.getState().keys[0].isEnabled).toBe(true);
  });

  it('should update key', async () => {
    const { addKey, updateKey } = useApiKeyStore.getState();

    const keyId = await addKey('openai', 'sk-test123');
    updateKey(keyId, { name: 'Updated Name' });

    expect(useApiKeyStore.getState().keys[0].name).toBe('Updated Name');
  });

  it('should get active keys', async () => {
    const { addKey, toggleKey } = useApiKeyStore.getState();

    await addKey('openai', 'sk-test1');
    const keyId2 = await addKey('anthropic', 'sk-test2');

    toggleKey(keyId2);

    const { getActiveKeys } = useApiKeyStore.getState();
    const activeKeys = getActiveKeys();
    expect(activeKeys.length).toBe(1);
    expect(activeKeys[0].provider).toBe('openai');
  });

  it('should set selected model', async () => {
    const { addKey, setSelectedModel } = useApiKeyStore.getState();

    const keyId = await addKey('openai', 'sk-test123');
    setSelectedModel(keyId, 'gpt-4');

    const state = useApiKeyStore.getState();
    expect(state.selectedKeyId).toBe(keyId);
    expect(state.selectedModelId).toBe('gpt-4');
  });

  it('should check if has valid key', async () => {
    const { addKey, hasValidKey } = useApiKeyStore.getState();

    expect(hasValidKey()).toBe(false);

    await addKey('openai', 'sk-test123');
    expect(useApiKeyStore.getState().hasValidKey()).toBe(true);
  });
});
