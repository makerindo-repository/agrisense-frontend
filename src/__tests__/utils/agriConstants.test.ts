import { describe, it, expect } from 'vitest';
import { normalizePlantKey, translateWeather, EPSILON_TABLE, FAPAR_TABLE } from '../../constants/agriConstants';

// ============================================================
// Unit Test: Agri Constants — Plant Key Normalizer & Weather Translation
// ============================================================

describe('normalizePlantKey', () => {
  it('should lowercase and return first word before comma', () => {
    expect(normalizePlantKey('Padi, Sawah')).toBe('padi');
  });

  it('should return "default" when input is undefined', () => {
    expect(normalizePlantKey(undefined)).toBe('default');
  });

  it('should return "default" when input is empty string', () => {
    expect(normalizePlantKey('')).toBe('default');
  });

  it('should trim whitespace', () => {
    expect(normalizePlantKey('  Jagung  ')).toBe('jagung');
  });

  it('should handle single word input', () => {
    expect(normalizePlantKey('Kopi')).toBe('kopi');
  });
});

describe('EPSILON_TABLE', () => {
  it('should have a default value', () => {
    expect(EPSILON_TABLE.default).toBeDefined();
    expect(EPSILON_TABLE.default).toBe(1.20);
  });

  it('should have matching values for Indonesian and English keys', () => {
    expect(EPSILON_TABLE.padi).toBe(EPSILON_TABLE.rice);
    expect(EPSILON_TABLE.jagung).toBe(EPSILON_TABLE.corn);
    expect(EPSILON_TABLE.kopi).toBe(EPSILON_TABLE.coffee);
  });
});

describe('FAPAR_TABLE', () => {
  it('should have a default value', () => {
    expect(FAPAR_TABLE.default).toBe(0.63);
  });

  it('all values should be between 0 and 1', () => {
    Object.values(FAPAR_TABLE).forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });
});

describe('translateWeather', () => {
  it('should translate known English weather to Indonesian', () => {
    expect(translateWeather('clear sky')).toBe('Cerah');
    expect(translateWeather('light rain')).toBe('Hujan Ringan');
    expect(translateWeather('thunderstorm')).toBe('Badai Petir');
  });

  it('should be case-insensitive', () => {
    expect(translateWeather('Clear Sky')).toBe('Cerah');
    expect(translateWeather('LIGHT RAIN')).toBe('Hujan Ringan');
  });

  it('should return original description for unknown weather', () => {
    expect(translateWeather('alien invasion')).toBe('alien invasion');
  });

  it('should return "Tidak Diketahui" for empty string', () => {
    expect(translateWeather('')).toBe('Tidak Diketahui');
  });

  it('should return English capitalized when lang=en', () => {
    expect(translateWeather('clear sky', 'en')).toBe('Clear Sky');
  });

  it('should return "Unknown" for empty string when lang=en', () => {
    expect(translateWeather('', 'en')).toBe('Unknown');
  });
});
