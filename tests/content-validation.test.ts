import { describe, expect, it } from 'vitest';
import { canManage } from '../lib/content-validation';

describe('canManage', () => {
  it('lets administrators manage every entity', () => {
    for (const entity of [
      'content',
      'media',
      'settings',
      'donation',
      'programme',
      'announcement',
      'user',
    ]) {
      expect(canManage(entity, 'admin')).toBe(true);
    }
  });

  it('restricts editors to content and media', () => {
    expect(canManage('content', 'editor')).toBe(true);
    expect(canManage('media', 'editor')).toBe(true);
  });

  it('blocks editors from administrative entities', () => {
    for (const entity of [
      'settings',
      'donation',
      'programme',
      'announcement',
      'user',
    ]) {
      expect(canManage(entity, 'editor')).toBe(false);
    }
  });
});
