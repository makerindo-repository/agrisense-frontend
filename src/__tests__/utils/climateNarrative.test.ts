import { describe, it, expect } from 'vitest';
import { generateClimateNarrative } from '../../utils/climateNarrative';

// ============================================================
// Unit Test: Climate Narrative Generator — 9 Branches
// ============================================================

describe('generateClimateNarrative', () => {
  // Helper to create weather data
  const makeData = (temp: number, humidity: number, weather: string, windSpeed = 5) => ({
    current: { temp, humidity, weather },
    windSpeed,
    station: 'Test Station',
  });

  it('should return fallback message when data is null', () => {
    const result = generateClimateNarrative(null);
    expect(result).toContain('Menunggu data cuaca');
  });

  it('should return fallback message when data is undefined', () => {
    const result = generateClimateNarrative(undefined);
    expect(result).toContain('Menunggu data cuaca');
  });

  it('should return fallback when data.current is missing', () => {
    const result = generateClimateNarrative({});
    expect(result).toContain('Menunggu data cuaca');
  });

  // Branch 1: Rain + Wind > 20
  it('Branch 1 — Hujan + Angin Kencang', () => {
    const data = makeData(25, 85, 'heavy rain', 25);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Hujan disertai angin kencang');
    expect(result).toContain('25.0 km/j');
    expect(result).toContain('25.0°C');
    expect(result).toContain('VPD');
  });

  // Branch 2: Rain without heavy wind
  it('Branch 2 — Hujan Normal', () => {
    const data = makeData(26, 90, 'light rain', 10);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Hujan terdeteksi');
    expect(result).toContain('carbon source');
  });

  // Branch 2b: Thunderstorm (alias for rain)
  it('Branch 2b — Thunderstorm should match rain branch', () => {
    const data = makeData(27, 80, 'thunderstorm', 15);
    const result = generateClimateNarrative(data);
    // Thunderstorm with wind < 20 → normal rain branch
    expect(result).toContain('Hujan terdeteksi');
  });

  // Branch 2c: Drizzle should match rain branch
  it('Branch 2c — Drizzle matches rain', () => {
    const data = makeData(24, 88, 'drizzle', 5);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Hujan terdeteksi');
  });

  // Branch 3: Hot + Dry (temp > 32, humidity < 50)
  it('Branch 3 — Stres Panas Ekstrem (Kering)', () => {
    const data = makeData(36, 30, 'clear sky', 8);
    const result = generateClimateNarrative(data);
    expect(result).toContain('sangat terik');
    expect(result).toContain('36.0°C');
    expect(result).toContain('30%');
  });

  // Branch 4: Hot + Humid (temp > 32, humidity >= 50)
  it('Branch 4 — Stres Panas Lembap (Gerah)', () => {
    const data = makeData(34, 65, 'clear sky', 5);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Suhu tinggi');
    expect(result).toContain('34.0°C');
    expect(result).toContain('65%');
  });

  // Branch 5: Optimal (24-30°C, 50-80% humidity, wind < 15)
  it('Branch 5 — Kondisi Optimal', () => {
    const data = makeData(27, 65, 'clear sky', 8);
    const result = generateClimateNarrative(data);
    expect(result).toContain('sangat ideal');
    expect(result).toContain('carbon sink');
    expect(result).toContain('27.0°C');
  });

  // Branch 6: High humidity (>85) + Cool (<26)
  it('Branch 6 — Kelembapan Tinggi + Sejuk', () => {
    const data = makeData(22, 90, 'mist', 5);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Suhu sejuk');
    expect(result).toContain('22.0°C');
    expect(result).toContain('90%');
  });

  // Branch 7: Strong wind (> 25 km/h)
  it('Branch 7 — Angin Kencang (no rain)', () => {
    const data = makeData(28, 60, 'clear sky', 30);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Angin kencang');
    expect(result).toContain('30.0 km/j');
  });

  // Branch 8: Cold (temp < 20)
  it('Branch 8 — Suhu Dingin', () => {
    const data = makeData(16, 55, 'few clouds', 5);
    const result = generateClimateNarrative(data);
    expect(result).toContain('Suhu relatif dingin');
    expect(result).toContain('16.0°C');
  });

  // Branch 9: Default (stable)
  it('Branch 9 — Default Stabil', () => {
    const data = makeData(28, 55, 'clear sky', 18); // wind > 15 → not optimal, not > 25
    const result = generateClimateNarrative(data);
    expect(result).toContain('cukup stabil');
  });

  // Edge: custom station name
  it('should use custom station name when provided', () => {
    const data = makeData(27, 65, 'clear sky', 8);
    const result = generateClimateNarrative(data, 'Kebun Mawar');
    expect(result).toContain('Kebun Mawar');
  });

  // Edge: VPD calculation correctness
  it('should embed correct VPD value in narrative', () => {
    // VPD = SVP - AVP where SVP = 0.6108 * exp(17.27*T / (T+237.3))
    const temp = 25;
    const humidity = 60;
    const svp = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
    const avp = svp * (humidity / 100);
    const expectedVpd = (svp - avp).toFixed(2);
    
    const data = makeData(temp, humidity, 'clear sky', 8);
    const result = generateClimateNarrative(data);
    expect(result).toContain(expectedVpd);
  });
});
