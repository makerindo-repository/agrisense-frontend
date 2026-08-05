// ============================================================
// Konstanta Agrikultur Terpusat
// Sumber: Diekstrak dari AnalyticsView.tsx & DashboardView.tsx
// ============================================================

/**
 * Tabel Epsilon Max (Light Use Efficiency) per jenis tanaman.
 * Satuan: gC/MJ PAR
 * Referensi: Model LUE — Monteith (1972)
 */
export const EPSILON_TABLE: Record<string, number> = {
  padi: 1.24,
  rice: 1.24,
  jagung: 1.80,
  corn: 1.80,
  maize: 1.80,
  kopi: 0.95,
  coffee: 0.95,
  'kelapa sawit': 1.15,
  sawit: 1.15,
  tebu: 1.95,
  sugarcane: 1.95,
  default: 1.20,
};

/**
 * Tabel fAPAR (Fraction of Absorbed PAR) per jenis tanaman.
 * Rentang: 0.0 – 1.0
 */
export const FAPAR_TABLE: Record<string, number> = {
  padi: 0.78,
  rice: 0.78,
  jagung: 0.82,
  corn: 0.82,
  maize: 0.82,
  kopi: 0.60,
  coffee: 0.60,
  'kelapa sawit': 0.80,
  sawit: 0.80,
  tebu: 0.85,
  sugarcane: 0.85,
  default: 0.63,
};

/**
 * Menormalisasi nama tanaman menjadi key lookup untuk tabel EPSILON & FAPAR.
 * Mengambil kata pertama sebelum koma, lalu di-lowercase.
 */
export const normalizePlantKey = (plantName?: string): string => {
  const key = (plantName || 'default').split(',')[0].trim().toLowerCase();
  return key || 'default';
};

/**
 * Peta terjemahan deskripsi cuaca dari Bahasa Inggris ke Bahasa Indonesia.
 * Digunakan oleh DashboardView untuk menampilkan label cuaca lokal.
 */
export const weatherTranslation: Record<string, string> = {
  'clear sky': 'Cerah',
  'few clouds': 'Berawan Tipis',
  'scattered clouds': 'Berawan Sebagian',
  'broken clouds': 'Berawan Tebal',
  'overcast clouds': 'Mendung Tebal',
  'light rain': 'Hujan Ringan',
  'moderate rain': 'Hujan Sedang',
  'heavy intensity rain': 'Hujan Lebat',
  'very heavy rain': 'Hujan Sangat Lebat',
  'extreme rain': 'Hujan Ekstrem',
  'freezing rain': 'Hujan Beku',
  'light intensity shower rain': 'Gerimis Ringan',
  'shower rain': 'Hujan Singkat',
  'heavy intensity shower rain': 'Hujan Singkat Lebat',
  'thunderstorm': 'Badai Petir',
  'thunderstorm with light rain': 'Badai Petir Hujan Ringan',
  'thunderstorm with rain': 'Badai Petir Hujan',
  'thunderstorm with heavy rain': 'Badai Petir Hujan Lebat',
  'light snow': 'Salju Ringan',
  'snow': 'Bersalju',
  'heavy snow': 'Salju Lebat',
  'mist': 'Berkabut',
  'smoke': 'Berasap',
  'haze': 'Kabut Tipis',
  'fog': 'Kabut Tebal',
  'drizzle': 'Gerimis',
  'light intensity drizzle': 'Gerimis Ringan',
  'heavy intensity drizzle': 'Gerimis Lebat',
};

export const translateWeather = (desc: string, lang?: string): string => {
  if (!desc) return lang === 'en' ? 'Unknown' : 'Tidak Diketahui';
  const lower = desc.toLowerCase().trim();

  if (lang === 'en') {
    return lower.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return weatherTranslation[lower] || desc;
};
