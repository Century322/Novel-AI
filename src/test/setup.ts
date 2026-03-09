import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = ResizeObserverMock;

const originalCrypto = globalThis.crypto;
if (!originalCrypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        generateKey: vi.fn().mockResolvedValue({}),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        importKey: vi.fn().mockResolvedValue({}),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
  });
}
