import { describe, it, expect } from 'vitest';
import { generateUniqueCode } from '../../utils/generators';

// ============================================================
// Unit Test: Unique Code Generator
// ============================================================

describe('generateUniqueCode', () => {
  it('should start with the given prefix', () => {
    const code = generateUniqueCode('LHN');
    expect(code.startsWith('LHN-')).toBe(true);
  });

  it('should contain exactly 2 hyphens (PREFIX-TS-RAND)', () => {
    const code = generateUniqueCode('KBN');
    const parts = code.split('-');
    expect(parts.length).toBe(3);
  });

  it('should produce uppercase characters', () => {
    const code = generateUniqueCode('TEST');
    expect(code).toBe(code.toUpperCase());
  });

  it('should generate unique codes on successive calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateUniqueCode('UNQ'));
    }
    // All 50 codes should be unique
    expect(codes.size).toBe(50);
  });

  it('should handle empty prefix', () => {
    const code = generateUniqueCode('');
    expect(code.startsWith('-')).toBe(true);
    expect(code.split('-').length).toBe(3);
  });

  it('should handle long prefix', () => {
    const code = generateUniqueCode('ABCDEFGHIJ');
    expect(code.startsWith('ABCDEFGHIJ-')).toBe(true);
  });

  it('should have a random part of 3 characters', () => {
    const code = generateUniqueCode('TST');
    const parts = code.split('-');
    expect(parts[2].length).toBe(3);
  });
});
