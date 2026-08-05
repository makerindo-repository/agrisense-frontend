import { describe, it, expect } from 'vitest';
import {
  calculateCarbonFlux,
  resolveSocBaseline,
  resolveCMax,
  calculateCpsHeadroom,
  DEFAULT_SOC_BASELINE_GC_M2,
  EMPTY_FLUX,
} from '../../utils/carbonCalculations';
import type { SensorReading, AnalyticsNode } from '../../types';

// ============================================================
// Unit Test: Carbon Flux Calculations (LUE Monteith 1972)
// ============================================================

describe('calculateCarbonFlux', () => {
  const baseSensorReading: SensorReading = {
    timestamp: '2026-07-06T10:00:00Z',
    environment: {
      air_temperature_c: 28,
      light_lux: 50000,
    },
    soil_7in1: {
      soil_moisture_percent: 45,
    },
    carbon_data: {
      co2_ppm: 420,
    },
  };

  it('should return valid flux metrics for normal tropical conditions', () => {
    const result = calculateCarbonFlux(baseSensorReading, 'Padi');
    expect(result.par).toBeGreaterThan(0);
    expect(result.parMJ).toBeGreaterThan(0);
    expect(result.fAPAR).toBe(0.78); // padi fAPAR
    expect(result.tScalar).toBeGreaterThan(0);
    expect(result.tScalar).toBeLessThanOrEqual(1);
    expect(result.wScalar).toBeGreaterThan(0);
    expect(result.cScalar).toBeGreaterThan(0);
    expect(result.gpp).toBeGreaterThan(0);
    expect(result.reco).toBeGreaterThan(0);
    expect(result.npp).toBeCloseTo(result.gpp * 0.47, 5);
    expect(result.nee).toBeCloseTo(result.gpp - result.reco, 5);
    expect(result.co2Seq).toBeCloseTo(result.nee * 3.67, 5);
  });

  it('should use default epsilon/fAPAR when plant name is unknown', () => {
    const result = calculateCarbonFlux(baseSensorReading, 'tanaman_langka_xyz');
    expect(result.fAPAR).toBe(0.63); // default
  });

  it('should use default epsilon/fAPAR when plant name is undefined', () => {
    const result = calculateCarbonFlux(baseSensorReading);
    expect(result.fAPAR).toBe(0.63);
  });

  it('should handle zero light (nighttime) — PAR and GPP should be 0', () => {
    const nightReading: SensorReading = {
      ...baseSensorReading,
      environment: { ...baseSensorReading.environment, light_lux: 0 },
    };
    const result = calculateCarbonFlux(nightReading);
    expect(result.par).toBe(0);
    expect(result.parMJ).toBe(0);
    expect(result.gpp).toBe(0);
    // RECO should still be positive (respiration happens at night)
    expect(result.reco).toBeGreaterThan(0);
    // NEE should be negative (carbon source at night)
    expect(result.nee).toBeLessThan(0);
  });

  it('should clamp tScalar to 0 when temperature <= 10°C', () => {
    const coldReading: SensorReading = {
      ...baseSensorReading,
      environment: { ...baseSensorReading.environment, air_temperature_c: 5 },
    };
    const result = calculateCarbonFlux(coldReading);
    expect(result.tScalar).toBe(0);
    expect(result.gpp).toBe(0);
  });

  it('should clamp tScalar to 0 when temperature >= 40°C', () => {
    const hotReading: SensorReading = {
      ...baseSensorReading,
      environment: { ...baseSensorReading.environment, air_temperature_c: 42 },
    };
    const result = calculateCarbonFlux(hotReading);
    expect(result.tScalar).toBe(0);
    expect(result.gpp).toBe(0);
  });

  it('should clamp wScalar minimum at 0.1 when soil moisture is 0', () => {
    const dryReading: SensorReading = {
      ...baseSensorReading,
      soil_7in1: { soil_moisture_percent: 0 },
    };
    const result = calculateCarbonFlux(dryReading);
    expect(result.wScalar).toBe(0.1);
  });

  it('should cap wScalar at 1.0 when soil moisture is very high', () => {
    const wetReading: SensorReading = {
      ...baseSensorReading,
      soil_7in1: { soil_moisture_percent: 100 },
    };
    const result = calculateCarbonFlux(wetReading);
    expect(result.wScalar).toBeLessThanOrEqual(1);
  });

  it('should use fallback values for missing sensor sub-fields', () => {
    const minimalReading: SensorReading = {
      timestamp: '2026-07-06T10:00:00Z',
    };
    // Should not throw — uses fallback defaults
    const result = calculateCarbonFlux(minimalReading);
    expect(result).toBeDefined();
    expect(typeof result.gpp).toBe('number');
    expect(typeof result.nee).toBe('number');
  });

  it('should read co2_ppm from flat field when carbon_data is missing', () => {
    const flatReading: SensorReading = {
      timestamp: '2026-07-06T10:00:00Z',
      co2_ppm: 500,
      light_lux: 30000,
    };
    const result = calculateCarbonFlux(flatReading);
    expect(result.cScalar).toBeCloseTo(500 / 420, 1);
  });

  it('should produce different results for different plant types', () => {
    const resultPadi = calculateCarbonFlux(baseSensorReading, 'padi');
    const resultJagung = calculateCarbonFlux(baseSensorReading, 'jagung');
    // Jagung has higher epsilon (1.80) than padi (1.24) → higher GPP
    expect(resultJagung.gpp).toBeGreaterThan(resultPadi.gpp);
  });
});

// ============================================================
// Unit Test: SOC Baseline & C_max Resolvers
// ============================================================

describe('resolveSocBaseline', () => {
  it('should return node soc_baseline when valid', () => {
    const node: AnalyticsNode = { soc_baseline: 7000 };
    expect(resolveSocBaseline(node)).toBe(7000);
  });

  it('should return default when soc_baseline is 0', () => {
    const node: AnalyticsNode = { soc_baseline: 0 };
    expect(resolveSocBaseline(node)).toBe(DEFAULT_SOC_BASELINE_GC_M2);
  });

  it('should return default when node is null', () => {
    expect(resolveSocBaseline(null)).toBe(DEFAULT_SOC_BASELINE_GC_M2);
  });

  it('should return default when soc_baseline is undefined', () => {
    const node: AnalyticsNode = {};
    expect(resolveSocBaseline(node)).toBe(DEFAULT_SOC_BASELINE_GC_M2);
  });
});

describe('resolveCMax', () => {
  it('should return node c_max when valid', () => {
    const node: AnalyticsNode = { c_max: 15000 };
    expect(resolveCMax(node, 5850)).toBe(15000);
  });

  it('should return 2x baseline when c_max is 0', () => {
    const node: AnalyticsNode = { c_max: 0 };
    expect(resolveCMax(node, 5850)).toBe(11700);
  });

  it('should return 2x baseline when node is null', () => {
    expect(resolveCMax(null, 5850)).toBe(11700);
  });
});

// ============================================================
// Unit Test: CPS Headroom Calculation
// ============================================================

describe('calculateCpsHeadroom', () => {
  it('should return 1 (maximum headroom) when cMax is 0 — division guard', () => {
    expect(calculateCpsHeadroom(5000, 0, 0)).toBe(1);
  });

  it('should return value between 0 and 1 for normal inputs', () => {
    const result = calculateCpsHeadroom(5850, 500, 11700);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('should return 0 when current carbon equals cMax (saturated)', () => {
    // socBaseline + cumulativeNpp = cMax
    const result = calculateCpsHeadroom(5000, 5000, 10000);
    expect(result).toBe(0);
  });

  it('should clamp to 0 when current carbon exceeds cMax', () => {
    const result = calculateCpsHeadroom(8000, 5000, 10000);
    expect(result).toBe(0);
  });

  it('should return close to 1 when very little carbon is stored', () => {
    const result = calculateCpsHeadroom(100, 0, 10000);
    expect(result).toBeGreaterThan(0.9);
  });
});

// ============================================================
// Unit Test: Constants Integrity
// ============================================================

describe('EMPTY_FLUX constant', () => {
  it('should have all fields set to 0', () => {
    Object.values(EMPTY_FLUX).forEach(value => {
      expect(value).toBe(0);
    });
  });
});
