import { describe, it, expect } from 'vitest';
import { cleanText, generateUniqueId, splitText, parseJsonFromMarkdown } from './textUtils';

describe('textUtils', () => {
  describe('cleanText', () => {
    it('should remove null characters', () => {
      expect(cleanText('hello\0world')).toBe('helloworld');
    });

    it('should normalize line endings', () => {
      expect(cleanText('hello\r\nworld')).toBe('hello\nworld');
    });

    it('should preserve Chinese characters', () => {
      expect(cleanText('你好世界')).toBe('你好世界');
    });

    it('should remove control characters but keep text', () => {
      expect(cleanText('hello\x1Fworld')).toBe('helloworld');
    });
  });

  describe('generateUniqueId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateUniqueId();
      const id2 = generateUniqueId();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid UUID format', () => {
      const id = generateUniqueId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('splitText', () => {
    it('should split text into chunks', () => {
      const text = 'a'.repeat(1000);
      const chunks = splitText(text, 100, 20);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle short text', () => {
      const text = 'short text';
      const chunks = splitText(text, 100, 20);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });
  });

  describe('parseJsonFromMarkdown', () => {
    it('should parse JSON from code block', () => {
      const text = '```json\n{"name": "test"}\n```';
      const result = parseJsonFromMarkdown<{ name: string }>(text);
      expect(result.data).toEqual({ name: 'test' });
    });

    it('should return null for invalid JSON', () => {
      const text = '```json\ninvalid\n```';
      const result = parseJsonFromMarkdown(text);
      expect(result.data).toBeNull();
    });

    it('should parse inline JSON', () => {
      const text = '```json\n{"key": "value"}\n```';
      const result = parseJsonFromMarkdown<{ key: string }>(text);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.cleanText).toBe('');
    });

    it('should return null for text without JSON block', () => {
      const text = '{"key": "value"}';
      const result = parseJsonFromMarkdown(text);
      expect(result.data).toBeNull();
      expect(result.cleanText).toBe(text);
    });
  });
});
