import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanAddress } from '../../utils/geolocation';

// ============================================================
// Unit Test: Geolocation Utilities
// ============================================================

describe('cleanAddress', () => {
  it('should remove "Indonesia" from address', () => {
    const result = cleanAddress('Jl. Merdeka, Bandung, Jawa Barat, Indonesia');
    expect(result).not.toContain('Indonesia');
    expect(result).toContain('Bandung');
    expect(result).toContain('Jawa Barat');
  });

  it('should remove standalone "Jawa" but keep "Jawa Barat"', () => {
    const result = cleanAddress('Cimahi, Jawa Barat, Jawa, Indonesia');
    expect(result).toContain('Jawa Barat');
    expect(result).not.toContain(', Jawa,');
    expect(result).not.toContain('Indonesia');
  });

  it('should remove 5-digit postal codes', () => {
    const result = cleanAddress('Bandung, 40132, Jawa Barat');
    expect(result).not.toContain('40132');
    expect(result).toContain('Bandung');
    expect(result).toContain('Jawa Barat');
  });

  it('should return empty string for undefined input', () => {
    expect(cleanAddress(undefined)).toBe('');
  });

  it('should return empty string for empty string input', () => {
    expect(cleanAddress('')).toBe('');
  });

  it('should return fallback when provided and address is empty', () => {
    expect(cleanAddress(undefined, 'Alamat tidak tersedia')).toBe('Alamat tidak tersedia');
    expect(cleanAddress('', 'Fallback')).toBe('Fallback');
  });

  it('should not remove partial number matches (not exactly 5 digits)', () => {
    const result = cleanAddress('Jl. No. 123, Bandung, 12345678');
    expect(result).toContain('123');
    expect(result).toContain('12345678');
  });

  it('should handle address with no items to clean', () => {
    const result = cleanAddress('Cianjur, Sukabumi');
    expect(result).toBe('Cianjur, Sukabumi');
  });

  it('should trim whitespace from parts', () => {
    const result = cleanAddress('  Bandung  ,  Jawa Barat  , Indonesia ');
    expect(result).toBe('Bandung, Jawa Barat');
  });

  it('should handle address with only removable items', () => {
    const result = cleanAddress('Indonesia, Jawa, 40132');
    expect(result).toBe('');
  });
});
