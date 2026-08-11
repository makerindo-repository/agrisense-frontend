// ============================================================
// Tipe Data Terpusat (Centralized Types)
// Sumber: Diekstrak dari src/pages/AnalyticsView.tsx
// ============================================================

// --- Carbon & CCI Status ---
export type CarbonState = 'Stabil' | 'Carbon Sink' | 'Carbon Source';
export type CciStatus = 'RENDAH' | 'CUKUP' | 'BAIK' | 'OPTIMAL';

// --- Sensor Sub-Interfaces ---
export interface SensorEnvironment {
  air_temperature_c?: number;
  air_humidity_percent?: number;
  wind_speed_kmh?: number;
  light_lux?: number;
  air_pressure_hpa?: number;
}

export interface CarbonReading {
  co2_ppm?: number;
  ch4_ppm?: number;
  no2_ppb?: number;
  cci_value?: number | string;
}

// --- Main Sensor Reading ---
export interface SensorReading {
  id?: string | number;
  device_id?: string | number;
  device_code?: string | number;
  timestamp: string;
  time?: string;
  environment?: SensorEnvironment;
  carbon_data?: CarbonReading;
  location?: {
    altitude_m?: number;
  };
  co2_ppm?: number;
  cci_value?: number | string;
  light_lux?: number;
  soil_7in1?: {
    soil_moisture_percent?: number;
    soil_ph?: number;
  };
}

// --- Analytics Node ---
export interface AnalyticsNode {
  id?: string | number;
  db_id?: string | number;
  device_code?: string | number;
  name?: string;
  plot_name?: string;
  plant_name?: string;
  address?: string;
  soc_baseline?: number;
  c_max?: number;
  cumulative_npp?: number;
  c_current?: number;
  cps?: number;
  kondisi_sekitar?: string;
  radius_konteks_m?: number;
}

// --- CCI Breakdown ---
export interface CciBreakdownItem {
  l: string;
  s: number;
  w: number;
  r: number | string;
  u: string;
  formula?: string;
}

// --- Carbon Flux Metrics (LUE Monteith 1972) ---
export interface CarbonFluxMetrics {
  par: number;
  parMJ: number;
  fAPAR: number;
  tScalar: number;
  wScalar: number;
  cScalar: number;
  gpp: number;
  reco: number;
  npp: number;
  nee: number;
  co2Seq: number;
}

// --- Dynamic Metrics (Dashboard / Analytics) ---
export interface DynamicMetrics {
  r2: string;
  cci: string;
  cciStatus: CciStatus;
  cciRaw: number;
  carbonState: CarbonState;
  co2Status: string;
  avgCo2: number;
  currentCo2: number;
  cciBd: CciBreakdownItem[];
  fx: CarbonFluxMetrics;
  photosynthesis: number;
  soilCapacity: number;
  socBaseline: number;
  cumulativeNpp: number;
  cCurrent: number;
  cMax: number;
  latest: SensorReading | null;
}

// --- Grouped Reading (Chart Aggregation) ---
export interface GroupedReading {
  timestamp: string;
  displayLabel: string;
  air_temperature_c: number;
  air_humidity_percent: number;
  count: number;
}

// --- Komoditi (Commodity) ---
// Sumber: Diekstrak dari src/pages/CommodityView.tsx L17-L36
export interface Komoditi {
  id: number;
  kode_komoditi: string;
  nama_komoditi: string;
  kategori_tanaman: string;
  nama_latin?: string;
  varietas?: string;
  deskripsi?: string;
  status: string;
  fapar?: number;
  epsilon_max?: number;
  is_system: boolean;
  foto?: string;
  lingkungan?: any;
  hama_penyakit?: any[];
  sensor?: any;
  fase_tanam?: any;
  nutrisi?: any;
  rekomendasi?: any;
}
