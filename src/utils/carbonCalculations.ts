// ============================================================
// Kalkulasi Carbon Flux — Model LUE Monteith (1972)
// Sumber: Diekstrak dari src/pages/AnalyticsView.tsx L207-L316
// ============================================================

import type {
  SensorReading,
  AnalyticsNode,
  CarbonFluxMetrics,
  DynamicMetrics,
  CciBreakdownItem,
} from '../types';
import { EPSILON_TABLE, FAPAR_TABLE, normalizePlantKey } from '../constants/agriConstants';

// --- Default Constants ---

export const DEFAULT_SOC_BASELINE_GC_M2 = 5850;

export const EMPTY_FLUX: CarbonFluxMetrics = {
  par: 0,
  parMJ: 0,
  fAPAR: 0,
  tScalar: 0,
  wScalar: 0,
  cScalar: 0,
  gpp: 0,
  reco: 0,
  npp: 0,
  nee: 0,
  co2Seq: 0,
};

export const EMPTY_DYNAMIC_METRICS: DynamicMetrics = {
  r2: "0",
  cci: "0",
  cciStatus: 'RENDAH',
  cciRaw: 0,
  carbonState: 'Stabil',
  co2Status: 'Menunggu Data',
  avgCo2: 0,
  currentCo2: 0,
  cciBd: [],
  fx: EMPTY_FLUX,
  photosynthesis: 0,
  soilCapacity: 0,
  socBaseline: 0,
  cumulativeNpp: 0,
  cCurrent: 0,
  cMax: 0,
  latest: null,
};

// --- Core Calculation Functions ---

/**
 * Menghitung Carbon Flux menggunakan model Light Use Efficiency (LUE) Monteith 1972.
 * GPP = PAR_MJ × fAPAR × εmax × T_scalar × W_scalar × C_scalar
 * RECO menggunakan model Lloyd-Taylor.
 * NEE = GPP - RECO (positif = menyerap karbon / Carbon Sink)
 */
export const calculateCarbonFlux = (r: SensorReading, plantName?: string): CarbonFluxMetrics => {
  const co2 = r.carbon_data?.co2_ppm ?? r.co2_ppm ?? 420;
  const lux = r.environment?.light_lux ?? r.light_lux ?? 0;
  const temp = r.environment?.air_temperature_c ?? 25;
  const moisture = r.soil_7in1?.soil_moisture_percent ?? 30;
  const plantKey = normalizePlantKey(plantName);
  const par = lux * 0.0185;
  const parMJ = par * 0.00756;
  const fAPAR = FAPAR_TABLE[plantKey] ?? FAPAR_TABLE.default;
  const tScalar = temp > 10 && temp < 40
    ? Math.max(0, Math.min(1, ((temp - 10) * (40 - temp)) / ((28 - 10) * (40 - 28))))
    : 0;
  const wScalar = Math.min(1, Math.max(0.1, moisture / 60));
  const cScalar = Math.min(1.2, Math.max(0.7, co2 / 420));
  const epsilonMax = EPSILON_TABLE[plantKey] ?? EPSILON_TABLE.default;
  const gpp = parMJ * fAPAR * epsilonMax * tScalar * wScalar * cScalar;
  const taK = temp + 273.15;
  const recoUmol = 2.0 * Math.exp(308.56 * (1 / (283.15 - 227.13) - 1 / (taK - 227.13)));
  const reco = recoUmol * 0.0432;
  const npp = gpp * 0.47;
  const nee = gpp - reco;

  return { par, parMJ, fAPAR, tScalar, wScalar, cScalar, gpp, reco, npp, nee, co2Seq: nee * 3.67 };
};

/**
 * Menentukan SOC Baseline dari data node, atau fallback ke default.
 */
export const resolveSocBaseline = (node: AnalyticsNode | null): number => {
  const value = Number(node?.soc_baseline ?? 0);
  return value > 0 ? value : DEFAULT_SOC_BASELINE_GC_M2;
};

/**
 * Menentukan Carbon Maximum (C_max) dari data node, atau fallback ke 2x baseline.
 */
export const resolveCMax = (node: AnalyticsNode | null, socBaseline: number): number => {
  const value = Number(node?.c_max ?? 0);
  return value > 0 ? value : socBaseline * 2;
};

/**
 * Menghitung CPS Headroom (Carbon Potential Score).
 * CPS = 1 - (C_current / C_max)
 * Rentang: 0 (penuh) sampai 1 (masih banyak ruang penyimpanan karbon)
 */
export const calculateCpsHeadroom = (socBaseline: number, cumulativeNpp: number, cMax: number): number => {
  if (cMax <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - ((socBaseline + cumulativeNpp) / cMax)));
};
