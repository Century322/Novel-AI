import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();

vi.mock('../../core/workshopService', () => ({
  workshopService: {
    pathExists: vi.fn(async (path: string) => files.has(path) || path === '.ai-workshop/world'),
    readFile: vi.fn(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error(`Not found: ${path}`);
      }
      return content;
    }),
    writeFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    createDirectory: vi.fn(async (_path: string) => undefined),
  },
}));

vi.mock('../../core/fileSystemService', () => ({
  fileSystemService: {
    getProjectName: vi.fn(() => '测试项目'),
  },
}));

vi.mock('../../core/loggerService', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createNovelBibleService } from '../novelBibleService';

describe('NovelBibleService', () => {
  beforeEach(() => {
    files.clear();
    vi.clearAllMocks();
  });

  it('should initialize default novel bible when file does not exist', async () => {
    const service = createNovelBibleService('project');
    await service.initialize();

    const bible = service.getNovelBible();
    expect(bible).not.toBeNull();
    expect(bible?.metadata.projectName).toBe('测试项目');
    expect(bible?.metadata.version).toBe(1);
    expect(files.has('.ai-workshop/world/novelBible.json')).toBe(true);
  });

  it('should remove no-protagonist error after adding a protagonist', async () => {
    const service = createNovelBibleService('project');
    await service.initialize();
    await service.upsertCharacter({
      name: '林川',
      role: 'protagonist',
      summary: '主角',
    });

    const result = service.validate();
    expect(result.issues.some((issue) => issue.code === 'NO_PROTAGONIST')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('should report relationship reference errors for missing characters', async () => {
    const service = createNovelBibleService('project');
    await service.initialize();
    await service.upsertCharacter({
      name: '林川',
      role: 'protagonist',
    });
    await service.upsertRelationship({
      sourceCharacterId: 'unknown-a',
      targetCharacterId: 'unknown-b',
      type: 'enemy',
    });

    const result = service.validate();
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'RELATION_SOURCE_MISSING')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'RELATION_TARGET_MISSING')).toBe(true);
  });

  it('should upsert timeline track and event', async () => {
    const service = createNovelBibleService('project');
    await service.initialize();
    await service.upsertCharacter({
      name: '林川',
      role: 'protagonist',
    });

    const track = await service.upsertTimelineTrack({
      name: '主线剧情',
      type: 'main',
    });
    const event = await service.upsertTimelineEvent(track.id, {
      title: '第一次觉醒',
      summary: '主角获得关键能力',
      phase: 'setup',
    });

    expect(event.title).toBe('第一次觉醒');
    const context = service.getGenerationBrief({ maxTracks: 1 });
    expect(context).toContain('主线剧情');
  });
});
