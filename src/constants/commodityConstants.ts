// ============================================================
// Konstanta Komoditi Terpusat
// Sumber: Diekstrak dari src/pages/CommodityView.tsx L38-L180
// ============================================================

export const KATEGORI_OPTIONS = [
  'Tanaman Pangan (Biji & Umbi)',
  'Hortikultura (Sayur & Bumbu)',
  'Perkebunan',
  'Buah-buahan',
  'Tanaman Obat (Herbal)',
  'Tanaman Hias',
  'Lainnya'
];

export const PRESET_KOMODITI_MAP: Record<string, string[]> = {
  'Tanaman Pangan (Biji & Umbi)': ["Padi", "Jagung", "Kedelai", "Kacang Tanah", "Singkong", "Ubi Jalar"].sort(),
  'Hortikultura (Sayur & Bumbu)': ["Cabai", "Tomat", "Kangkung", "Bayam", "Sawi", "Buncis", "Mentimun", "Terong", "Bawang Merah", "Wortel", "Kentang", "Kubis", "Selada"].sort(),
  'Buah-buahan': ["Pisang", "Mangga", "Pepaya", "Jeruk", "Semangka", "Strawberry"].sort(),
  'Perkebunan': ["Kopi", "Teh", "Kelapa Sawit", "Tebu", "Kakao"].sort(),
  'Tanaman Obat (Herbal)': ["Jahe", "Kunyit", "Serai"].sort(),
  'Tanaman Hias': [],
  'Lainnya': []
};

export const PRESET_HAMA = [
  "Ulat Grayak", "Wereng Coklat", "Penggerek Batang", "Kutu Daun (Aphids)", "Lalat Buah",
  "Kutu Kebul", "Tikus", "Burung Pipit", "Tungau", "Keong Mas", "Walang Sangit", "Ulat Tanah"
].sort();

export const PRESET_PENYAKIT = [
  "Bercak Daun", "Busuk Buah", "Layu Fusarium", "Layu Bakteri", "Karat Daun",
  "Embun Bulu (Downy Mildew)", "Embun Tepung (Powdery Mildew)", "Virus Kuning (Gemini)",
  "Antraknosa", "Hawar Daun", "Busuk Akar"
].sort();

export const LATIN_MAP: Record<string, string> = {
  "Padi": "Oryza sativa",
  "Jagung": "Zea mays",
  "Kedelai": "Glycine max",
  "Kacang Tanah": "Arachis hypogaea",
  "Singkong": "Manihot esculenta",
  "Ubi Jalar": "Ipomoea batatas",
  "Cabai": "Capsicum annuum",
  "Tomat": "Solanum lycopersicum",
  "Kangkung": "Ipomoea aquatica",
  "Bayam": "Amaranthus spp.",
  "Sawi": "Brassica rapa",
  "Buncis": "Phaseolus vulgaris",
  "Mentimun": "Cucumis sativus",
  "Terong": "Solanum melongena",
  "Bawang Merah": "Allium cepa",
  "Wortel": "Daucus carota",
  "Kentang": "Solanum tuberosum",
  "Kubis": "Brassica oleracea",
  "Selada": "Lactuca sativa",
  "Pisang": "Musa spp.",
  "Mangga": "Mangifera indica",
  "Pepaya": "Carica papaya",
  "Jeruk": "Citrus spp.",
  "Semangka": "Citrullus lanatus",
  "Strawberry": "Fragaria × ananassa",
  "Kopi": "Coffea spp.",
  "Teh": "Camellia sinensis",
  "Kelapa Sawit": "Elaeis guineensis",
  "Tebu": "Saccharum officinarum",
  "Kakao": "Theobroma cacao",
  "Jahe": "Zingiber officinale",
  "Kunyit": "Curcuma longa",
  "Serai": "Cymbopogon citratus"
};

export const VARIETAS_MAP: Record<string, string> = {
  "Padi": "Ciherang",
  "Jagung": "Bisi 18",
  "Kedelai": "Anjasmoro",
  "Kacang Tanah": "Kelinci",
  "Singkong": "Adira",
  "Ubi Jalar": "Cilembu",
  "Cabai": "Rawit Merah",
  "Tomat": "Servo",
  "Kangkung": "Bisi",
  "Bayam": "Maestro",
  "Sawi": "Shinta",
  "Buncis": "Lebat",
  "Mentimun": "Zatavy",
  "Terong": "Yumi",
  "Bawang Merah": "Bima Brebes",
  "Wortel": "Kuroda",
  "Kentang": "Granola",
  "Kubis": "Green Nova",
  "Selada": "Grand Rapids",
  "Pisang": "Cavendish",
  "Mangga": "Harumanis",
  "Pepaya": "California",
  "Jeruk": "Keprok",
  "Semangka": "Inul",
  "Strawberry": "Mencir",
  "Kopi": "Arabica",
  "Teh": "Assamica",
  "Kelapa Sawit": "Tenera",
  "Tebu": "Bululawang",
  "Kakao": "Lindak",
  "Jahe": "Gajah",
  "Kunyit": "Kunyit Putih",
  "Serai": "Serai Wangi"
};

export const USIA_PANEN_MAP: Record<string, string> = {
  // Pangan & Umbi
  "Padi": "115",
  "Jagung": "100",
  "Kedelai": "85",
  "Kacang Tanah": "90",
  "Singkong": "270",     // 9 bulan
  "Ubi Jalar": "110",    // 3.5 - 4 bulan
  // Sayuran Daun & Buah (Hortikultura)
  "Cabai": "90",         // Mulai panen pertama
  "Tomat": "75",
  "Kangkung": "25",
  "Bayam": "25",
  "Sawi": "35",
  "Buncis": "50",
  "Mentimun": "38",
  "Terong": "80",
  "Bawang Merah": "60",
  "Wortel": "100",
  "Kentang": "110",
  "Kubis": "80",
  "Selada": "45",
  // Buah-buahan
  "Pisang": "300",       // ~10 bulan
  "Mangga": "1095",      // ~3 tahun (panen pertama pohon baru)
  "Pepaya": "240",       // ~8 bulan (Pepaya California)
  "Jeruk": "1095",       // ~3 tahun
  "Semangka": "65",
  "Strawberry": "60",
  // Perkebunan & Industri
  "Kopi": "1095",        // ~3 tahun
  "Teh": "1095",         // ~3 tahun
  "Kelapa Sawit": "1095", // ~30-36 bulan (Tanaman Menghasilkan)
  "Tebu": "330",         // ~11 bulan
  "Kakao": "1095",       // ~3 tahun
  // Tanaman Obat
  "Jahe": "270",         // ~9 bulan (Jahe gajah tua)
  "Kunyit": "270",       // ~9 bulan
  "Serai": "210"         // ~7 bulan
};
