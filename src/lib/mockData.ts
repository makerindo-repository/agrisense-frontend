export interface IoTNode {
  id: string;
  db_id?: number;
  name: string;
  location: string;
  coords: [number, number];
  altitude: number;
  status: 'online' | 'offline' | 'warning';
  battery: number;
  rssi: number;
  lastSeen: string;
  firmware_version: string;
  gardenId?: number;
  lahanId?: number;
  garden_name?: string;
  plant_name?: string;
  plot_name?: string;
  address?: string;
}

export interface SensorReading {
  message_id: string;
  device_id: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    altitude_m: number;
  };
  carbon_data: {
    co2_ppm: number;
    ch4_ppm: number;
    no2_ppb: number;
  };
  environment: {
    air_temperature_c: number;
    air_humidity_percent: number;
  };
  power: {
    battery_voltage: number;
    battery_percent: number;
  };
  communication: {
    network_type: string;
    rssi_dbm: number;
  };
  status: {
    node_status: string;
    sensor_status: string;
    firmware_version: string;
  };
}

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin: string;
  avatar?: string;
  real_id?: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  status: 'success' | 'warning' | 'error';
  ip: string;
}

// === Sesuai migration: 2026_04_08_030655_create_land_plots_table.php ===
export interface LandPlot {
  id: number;
  plot_code: string;
  plot_name: string;
  owner_name: string;
  address: string;
  latitude: number;
  longitude: number;
  polygon: any | null; // GeoJSON geometry
  area_hectare: number;
  soil_type: string;
  plant_types: string;
  created_at?: string;
  updated_at?: string;
}

// === Sesuai migration: 2026_04_08_031108_create_gardens_table.php ===
export interface Garden {
  id: number;
  land_plot_id: number; // FK to land_plots
  garden_code: string;
  garden_name: string;
  latitude: number;
  longitude: number;
  polygon: any | null; // GeoJSON geometry
  area_hectare: number;
  soil_type: string;
  plant_types: string;
  created_at?: string;
  updated_at?: string;
}

// Keep old alias for backward compatibility in other pages
export interface LahanArea {
  id: string;
  name: string;
  type: string;
  areaSize: number;
  polygon?: [number, number][];
}

// All data starts empty - will be populated via API or user interaction
export const mockUsers: User[] = [
  { id: 'USR-001', name: 'AgriSense Dev', email: 'dev@agrisense.id', role: 'admin', status: 'active', lastLogin: new Date().toISOString() }
];

export const mockNodes: IoTNode[] = [];
export const mockReadings: SensorReading[] = [];

export const mockBMKG = {
  station: '-',
  weather: 'Memuat...',
  temp: 0,
  humidity: 0,
  windSpeed: 0,
  forecast: []
};

export const mockActivityLogs: ActivityLog[] = [];
export const mockLahanArea: LahanArea[] = [];

// Live state arrays for Land Plots and Gardens
export const mockLandPlots: LandPlot[] = [];
export const mockGardens: Garden[] = [];
