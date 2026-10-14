import { describe, expect, it } from 'vitest';
import { FONT_OPTIONS, defaultSettings, fontCss } from '../lib/masjid-types';

describe('font options', () => {
  it('exposes unique font keys with non-empty css stacks', () => {
    const keys = FONT_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const option of FONT_OPTIONS)
      expect(option.css.length).toBeGreaterThan(0);
  });

  it('resolves a known font and falls back for an unknown key', () => {
    expect(fontCss('playfair', 'fallback')).toContain('--font-playfair');
    expect(fontCss(undefined, 'fallback')).toBe('fallback');
  });

  it('defaults the heading/body fonts and takeover duration', () => {
    expect(defaultSettings.headingFont).toBe('montserrat');
    expect(defaultSettings.bodyFont).toBe('inter');
    expect(defaultSettings.takeoverDuration).toBeGreaterThanOrEqual(5);
  });
});
