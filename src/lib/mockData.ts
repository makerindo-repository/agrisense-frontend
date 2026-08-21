export interface IoTNode {
  id: string;
  db_id?: number;
  device_code?: string;
  code?: string;
  name: string;
  location: string;
  coords: [number, number];
  latitude: number;
  longitude: number;
  altitude: number;
  status: 'online' | 'offline' | 'warning';
  battery: number;
  battery_percent: number;
  battery_voltage: number;
  rssi: number;
  wind_speed: number;
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

// Formatter Nama Perangkat Sesuai Format "NODE ..."
export const formatEYDDeviceName = (name?: string, code?: string): string => {
  const rawCode = code || '01';

  if (!name || name.trim() === '') {
    return `NODE ${rawCode}`;
  }

  let cleaned = name.trim();

  // Jika sudah berawalan NODE (case-insensitive), pastikan prefix kapital "NODE "
  if (/^node\b/i.test(cleaned)) {
    return cleaned.replace(/^node\b/i, 'NODE');
  }

  // Jika berawalan "Perangkat", ubah prefix menjadi "NODE"
  if (/^perangkat\s+(sensor|telemetri)?/i.test(cleaned)) {
    cleaned = cleaned.replace(/^perangkat\s+(sensor|telemetri)?/i, '').trim();
    return cleaned ? `NODE ${cleaned}` : `NODE ${rawCode}`;
  }

  return `NODE ${cleaned}`;
};

// Helper function to normalize any raw API device response into a compliant IoTNode
export const normalizeNode = (n: any): IoTNode => {
  if (!n) return null as any;
  const dbId = n.db_id || n.dbId || n.id || 1;
  const devCode = n.device_code || n.deviceCode || n.code || n.id || `NODE-${dbId}`;

  const lat = typeof n.latitude === 'number' ? n.latitude : (n.coords?.[0] ? Number(n.coords[0]) : (n.lat ? Number(n.lat) : -6.831500));
  const lng = typeof n.longitude === 'number' ? n.longitude : (n.coords?.[1] ? Number(n.coords[1]) : (n.lng ? Number(n.lng) : 107.916000));
  const alt = n.altitude ? Number(n.altitude) : 720;

  const bat = Math.min(100, Math.max(0, n.battery_percent ?? n.battery ?? 85));
  const volt = n.battery_voltage ?? n.voltage ?? Number((3.2 + (bat / 100) * 1.0).toFixed(2));

  const rawName = n.name || n.device_name || `Perangkat ${devCode}`;
  const eydName = formatEYDDeviceName(rawName, String(devCode));

  return {
    id: String(devCode),
    device_code: String(devCode),
    code: String(devCode),
    db_id: Number(dbId),
    name: eydName,
    location: n.location || n.address || 'Subang',
    coords: [lat, lng],
    latitude: lat,
    longitude: lng,
    altitude: alt,
    status: n.status || 'online',
    battery: bat,
    battery_percent: bat,
    battery_voltage: Number(volt),
    rssi: n.rssi ?? -72,
    wind_speed: n.wind_speed ?? n.windSpeed ?? 12.5,
    lastSeen: n.last_seen_at || n.updated_at || new Date().toISOString(),
    firmware_version: n.firmware_version || n.firmware || n.firmwareVersion || '1.0.0',
    lahanId: n.lahanId ? Number(n.lahanId) : (n.lahan_id ? Number(n.lahan_id) : undefined),
    gardenId: n.gardenId ? Number(n.gardenId) : (n.garden_id ? Number(n.garden_id) : undefined),
    garden_name: n.garden_name || n.garden?.garden_name,
    plant_name: n.plant_name || n.garden?.plant?.name,
    plot_name: n.plot_name || n.land_plot?.plot_name,
    address: n.address || n.location,
  };
};

// Evaluasi ambang batas telemetri untuk menentukan apakah node aktif memiliki peringatan
export const evaluateNodeWarning = (latestReading: any, nodeStatus: string = 'online'): { isWarning: boolean; reasons: string[] } => {
  const reasons: string[] = [];

  const st = (nodeStatus || '').toLowerCase();
  if (st === 'offline') {
    return { isWarning: true, reasons: ['Perangkat offline'] };
  }

  if (!latestReading) {
    return { isWarning: false, reasons: [] };
  }

  const co2 = latestReading.co2_sensor ?? latestReading.co2_ppm ?? latestReading.carbon_data?.co2_ppm ?? 0;
  const ch4 = latestReading.ch4_ppm ?? latestReading.carbon_data?.ch4_ppm ?? 0;
  const no2 = latestReading.no2_ppb ?? latestReading.carbon_data?.no2_ppb ?? 0;
  const temp = latestReading.air_temperature_sensor ?? latestReading.air_temperature_c ?? latestReading.environment?.air_temperature_c ?? 25;
  const humidity = latestReading.air_humidity_sensor ?? latestReading.air_humidity_percent ?? latestReading.environment?.air_humidity_percent ?? 50;
  const battery = latestReading.battery_percent ?? latestReading.power?.battery_percent ?? 100;
  const sensorStatus = latestReading.sensor_status ?? latestReading.status?.sensor_status ?? 'normal';

  if (co2 > 1000) reasons.push(`CO₂ Tinggi (${Math.round(co2)} ppm)`);
  if (ch4 > 10.0) reasons.push(`CH₄ Tinggi (${Number(ch4).toFixed(1)} ppm)`);
  if (no2 > 50.0) reasons.push(`NO₂ Tinggi (${Math.round(no2)} ppb)`);
  if (temp > 35.0) reasons.push(`Suhu Tinggi (${Number(temp).toFixed(1)}°C)`);
  if (temp < 15.0) reasons.push(`Suhu Rendah (${Number(temp).toFixed(1)}°C)`);
  if (humidity < 30.0) reasons.push(`Kelembapan Sangat Rendah (${Number(humidity).toFixed(1)}%)`);
  if (battery < 20) reasons.push(`Baterai Lemah (${battery}%)`);
  if (sensorStatus === 'degraded' || sensorStatus === 'error') reasons.push('Kinerja sensor menurun (degraded)');

  return {
    isWarning: reasons.length > 0,
    reasons
  };
};

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

// Live state arrays for Land Plots and Gardens with fallback default plantations
export const mockLandPlots: LandPlot[] = [
  {
    id: 1,
    plot_code: "LHN-SBG-01",
    plot_name: "Lahan Subang Utama",
    owner_name: "Kelompok Tani Subang",
    address: "Padasuka, Sumedang, Jawa Barat",
    latitude: -6.8315,
    longitude: 107.9160,
    polygon: [
      [-6.8300, 107.9140],
      [-6.8300, 107.9180],
      [-6.8330, 107.9180],
      [-6.8330, 107.9140]
    ],
    area_hectare: 4.5,
    soil_type: "Andosol",
    plant_types: "Jagung, Kopi"
  },
  {
    id: 2,
    plot_code: "LHN-SMD-02",
    plot_name: "Lahan Pasirhuni Sumedang",
    owner_name: "Kelompok Tani Pasirhuni",
    address: "Pasirhuni, Sumedang, Jawa Barat",
    latitude: -6.8350,
    longitude: 107.9200,
    polygon: [
      [-6.8340, 107.9180],
      [-6.8340, 107.9220],
      [-6.8370, 107.9220],
      [-6.8370, 107.9180]
    ],
    area_hectare: 3.2,
    soil_type: "Latosol",
    plant_types: "Padi, Sayuran"
  }
];

export const mockGardens: Garden[] = [
  {
    id: 1,
    land_plot_id: 1,
    garden_code: "KBN-01",
    garden_name: "Blok A - Kebun Jagung",
    latitude: -6.8315,
    longitude: 107.9160,
    polygon: [],
    area_hectare: 2.0,
    soil_type: "Andosol",
    plant_types: "Jagung Hybrid"
  },
  {
    id: 2,
    land_plot_id: 1,
    garden_code: "KBN-02",
    garden_name: "Blok B - Kebun Kopi",
    latitude: -6.8320,
    longitude: 107.9170,
    polygon: [],
    area_hectare: 2.5,
    soil_type: "Andosol",
    plant_types: "Kopi Arabika"
  }
];
