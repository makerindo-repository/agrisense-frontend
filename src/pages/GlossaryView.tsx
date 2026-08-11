import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, ChevronRight, Info, Layers, Radio, AlertTriangle, Leaf, Thermometer, Droplets, FlaskConical, Zap, Activity, MapPin, CloudSun, Filter, BarChart3, Download, Eye, Shield, Target, TrendingUp, Database, Map as MapIcon, Plus, Edit, Trash2, Cpu, Compass, HardDrive, FileSpreadsheet, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getStoredUser } from '../lib/storage';

// Glosarium Data Terpadu berdasarkan KBBI & EYD V
const getGlossaryData = (t: any) => [
  // 1. OPERASIONAL
  {
    term: "Dasbor",
    description: "Halaman utama berisi ringkasan kondisi lahan dan telemetri sensor secara seketika.",
    detail: "Pusat komando utama untuk memantau status perangkat, peringatan lingkungan, peta ringkas lokasi node sensor, dan indikator terkini. Dirancang untuk pemantauan cepat dan efisien.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Ringkasan Carbon Flux (NEE)", desc: "Menampilkan laju pertukaran karbon bersih. Nilai positif mengindikasikan tanaman menyerap CO₂ dari atmosfer.", icon: Leaf },
      { name: "Cuaca dan Klimatologi BMKG", desc: "Menampilkan suhu udara, kondisi cuaca, laju angin, dan prakiraan periode ke depan berbasis integrasi data BMKG.", icon: CloudSun },
      { name: "Status Perangkat (Node)", desc: "Indikator status seketika: Kondisi Normal (Hijau), Anomali Terdeteksi (Kuning/Merah), dan Terputus (Abu-abu).", icon: Radio },
      { name: "Parameter Lingkungan Utama", desc: "Pembacaan seketika kadar CO₂, CH₄, NO₂, Suhu Udara, Kelembapan, dan Kecepatan Angin.", icon: Activity }
    ]
  },
  {
    term: "Peta Node",
    description: "Visualisasi geospasial lokasi perangkat sensor dan batas poligon lahan.",
    detail: "Menampilkan posisi fisik node sensor di atas peta satelit. Penanda merah berkedip menunjukkan lokasi anomali lingkungan atau perangkat bermasalah.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Poligon Batas Lahan", desc: "Garis batas maya yang menunjukkan cakupan area perkebunan yang terdaftar dalam sistem.", icon: Layers },
      { name: "Penanda Status Warna", desc: "Pin lokasi: Hijau = Normal dan Aktif. Merah = Anomali Lingkungan. Abu-abu = Perangkat Terputus.", icon: MapPin },
      { name: "Jendela Info Telemetri Langsung", desc: "Klik pin sensor untuk melihat jendela info ringkas data suhu, kelembapan, dan kadar CO₂ secara seketika.", icon: Eye }
    ]
  },
  {
    term: "Data Sensor",
    description: "Catatan kronologis pembacaan telemetri seluruh perangkat IoT node.",
    detail: "Tabel dan grafik rekam jejak data mentah mencakup kadar CO₂, CH₄, NO₂, suhu udara, kelembapan, kecepatan angin, hingga persentase daya baterai aki.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Penyaringan Rentang Waktu", desc: "Penyaringan data berdasarkan rentang 24 Jam, 7 Hari, atau 30 Hari Terakhir.", icon: Filter },
      { name: "Tabel Telemetri Kronologis", desc: "Catatan kronologis baris data mentah dari stempel waktu terbaru hingga terlama.", icon: Database },
      { name: "Grafik Tren Parameter", desc: "Grafik interaktif untuk mengamati pola dinamika emisi gas dan iklim mikro.", icon: BarChart3 }
    ]
  },

  // 2. MANAJEMEN
  {
    term: "Lahan, Kebun dan Tanaman",
    description: "Manajemen penggambaran batas poligon lahan dan zonasi perkebunan.",
    detail: "Fitur untuk mendaftarkan lahan baru, menggambar koordinat poligon batas area, mengukur elevasi (mdpl), dan membagi blok tanam.",
    roles: ['admin', 'operator'],
    category: "MANAJEMEN",
    features: [
      { name: "Penggambaran Poligon", desc: "Alat pemetaan interaktif pada peta satelit untuk membentuk batas geografis lahan.", icon: MapIcon },
      { name: "Deteksi Elevasi Otomatis", desc: "Ketinggian dari permukaan laut (mdpl) yang berguna untuk kalibrasi analitik iklim.", icon: TrendingUp },
      { name: "Manajemen Blok Perkebunan", desc: "Pengelompokan jenis tanaman dan varietas pada setiap unit kebun.", icon: Leaf }
    ]
  },
  {
    term: "Komoditi",
    description: "Katalog komoditi pertanian dan parameter ambang batas pertumbuhan.",
    detail: "Menyimpan preferensi syarat tumbuh komoditi pertanian, batas kelembapan tanah ideal, dan rentang suhu optimal.",
    roles: ['admin', 'operator'],
    category: "MANAJEMEN",
    features: [
      { name: "Profil Syarat Tumbuh", desc: "Pengaturan batas ambang suhu, kelembapan, dan nutrisi ideal per komoditas.", icon: FlaskConical },
      { name: "Katalog Hama dan Penyakit", desc: "Dokumentasi indikator awal penyakit tanaman berbasis anomali iklim mikro.", icon: AlertTriangle }
    ]
  },
  {
    term: "Perangkat",
    description: "Inventarisasi perangkat keras IoT node dan konfigurasi konektivitas MQTT.",
    detail: "Mendaftarkan pengidentifikasi unik perangkat keras, memetakan perangkat ke lahan fisik, serta memantau kesehatan aki solar cell dan sinyal RSSI WiFi.",
    roles: ['admin', 'operator', 'viewer'],
    category: "MANAJEMEN",
    features: [
      { name: "Registrasi Pengidentifikasi Perangkat Keras", desc: "Pendaftaran unik perangkat (misal: AGRISENSE-CC-001) ke dalam basis data.", icon: Cpu },
      { name: "Pemetaan Perangkat ke Lahan", desc: "Penetapan lokasi penempatan fisik alat pada blok lahan tertentu.", icon: MapPin },
      { name: "Pemantauan Daya Aki", desc: "Indikator tegangan aki (11.0V - 12.8V) dan persentase sisa daya baterai.", icon: Zap }
    ]
  },
  {
    term: "Pengguna",
    description: "Pengelolaan akun pengguna dan kontrol hak akses sistem.",
    detail: "Menambah anggota tim baru dan menetapkan tingkatan hak akses (Administrator Sistem, Operator Perangkat, atau Pemantau Data).",
    roles: ['admin'],
    category: "MANAJEMEN",
    features: [
      { name: "Tingkatan Hak Akses", desc: "Admin (Akses Penuh), Operator (Operasional dan Analitik), Pemantau (Hanya Lihat Data).", icon: Shield },
      { name: "Manajemen Akun Tim", desc: "Pembuatan akun baru dan pembaruan informasi profil anggota.", icon: Plus }
    ]
  },

  // 3. ANALITIK
  {
    term: "Data Klimatologi",
    description: "Analisis spasial iklim mikro lahan dan integrasi BMKG.",
    detail: "Memadukan data stasiun cuaca BMKG dengan sensor iklim mikro lapangan untuk memprediksi perubahan cuaca dan risiko kekeringan.",
    roles: ['admin', 'operator', 'viewer'],
    category: "ANALITIK",
    features: [
      { name: "Integrasi Stasiun BMKG", desc: "Prakiraan cuaca harian dan laju angin dari stasiun BMKG terdekat.", icon: CloudSun },
      { name: "Laju dan Arah Angin", desc: "Informasi kecepatan angin (km/jam) untuk perencanaan penyemprotan pupuk.", icon: Activity }
    ]
  },
  {
    term: "Karbon dan Tanaman",
    description: "Analisis laju pertukaran karbon bersih (Carbon Flux) dan CPS.",
    detail: "Model perhitungan serapan karbon (NEE) dan Carbon Potential Score (CPS) untuk mengevaluasi kemampuan lahan dalam menyerap emisi.",
    roles: ['admin', 'operator', 'viewer'],
    category: "ANALITIK",
    features: [
      { name: "Carbon Potential Score (CPS)", desc: "Skor potensi sisa ruang serapan karbon pada ekosistem tanah (0-100%).", icon: Target },
      { name: "Net Ecosystem Exchange (NEE)", desc: "Estimasi kuantitatif laju penyerapan (Sink) atau pelepasan (Source) karbon.", icon: Leaf }
    ]
  },
  {
    term: "Performa Model",
    description: "Evaluasi akurasi dan konvergensi model kecerdasan buatan (AI).",
    detail: "Membandingkan performa model ML (XGBoost, RandomForest, SVR) berdasarkan metrik RMSE, MAE, MAPE, dan R² Score.",
    roles: ['admin', 'operator'],
    category: "ANALITIK",
    features: [
      { name: "Evaluasi Metrik Akurasi", desc: "Perbandingan R² Score, MAE, MAPE, dan RMSE antar model prediksi AI.", icon: BarChart3 },
      { name: "Feature Importance", desc: "Grafik kontribusi variabel (CO₂, Suhu, Kelembapan) terhadap hasil prediksi.", icon: TrendingUp }
    ]
  },

  // 4. SISTEM
  {
    term: "Laporan dan Ekspor",
    description: "Generasi dokumen laporan dan ekspor data mentah.",
    detail: "Fasilitas mengunduh ringkasan laporan resmi format PDF atau data mentah CSV/Excel untuk kebutuhan audit dan arsip.",
    roles: ['admin', 'operator'],
    category: "SISTEM",
    features: [
      { name: "Ekspor Format CSV/Excel", desc: "Pengunduhan data mentah telemetri untuk olah data analisis statistik lanjutan.", icon: Download },
      { name: "Cetak Dokumen Laporan PDF", desc: "Generasi dokumen ringkasan formal bertemplate resmi AgriSense.", icon: FileSpreadsheet }
    ]
  },
  {
    term: "Log Aktivitas",
    description: "Catatan rekam jejak audit aksi pengguna dan sistem.",
    detail: "Merekam setiap aktivitas penting seperti sesi masuk (login), perubahan profil, pembaruan kata sandi, dan manipulasi data.",
    roles: ['admin', 'operator'],
    category: "SISTEM",
    features: [
      { name: "Audit Rekam Jejak", desc: "Catatan detail pengguna, jenis tindakan, modul sistem, IP address, dan stempel waktu.", icon: Activity }
    ]
  },
  {
    term: "Pengaturan",
    description: "Konfigurasi parameter global dan ambang batas peringatan.",
    detail: "Menyetel ambang batas aman CO₂, suhu maksimum, kelembapan minimum, serta konfigurasi koneksi MQTT Broker.",
    roles: ['admin'],
    category: "SISTEM",
    features: [
      { name: "Ambang Batas Peringatan", desc: "Penetapan batas anomali untuk memicu notifikasi peringatan pada sistem.", icon: AlertTriangle },
      { name: "Konfigurasi MQTT Broker", desc: "Pengaturan URL broker (HiveMQ / EMQX), port 1883, dan topik telemetri.", icon: Radio }
    ]
  },

  // 5. SPESIFIKASI SENSOR HARDWARE
  {
    term: "MQ-135 (Sensor Karbon Dioksida - CO₂)",
    description: "Sensor gas elektrokimia khusus pengukuran konsentrasi CO₂ (PPM).",
    detail: "Sensor utama pembacaan emisi karbon lingkungan pada modul perangkat IoT Node V1.2. Menggunakan kalibrasi parameter presisi tinggi: R0 = 127.831 kΩ, A = 110.743, B = -2.8569 dengan oversampling 50x pembacaan ADC.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Rentang Pengukuran", desc: "0 - 5000 PPM (Parts Per Million) Karbon Dioksida.", icon: Activity },
      { name: "Kalibrasi Sinyal Analog", desc: "Dihitung via rumus pow(Rs/R0, B) dengan resistor beban RL = 10.0 kΩ.", icon: Cpu },
      { name: "Koneksi Perangkat Keras", desc: "Terhubung ke Channel 1 (MQ135ADCPin) pada ADC Adafruit ADS1115.", icon: HardDrive }
    ]
  },
  {
    term: "MQ-4 (Sensor Gas Metana - CH₄)",
    description: "Sensor gas semi-konduktor untuk mendeteksi emisi gas Metana.",
    detail: "Mengukur emisi gas metana (CH₄) dari aktivitas pembusukan organik lahan. Dikalibrasi pada perangkat dengan parameter R0 = 8.492 kΩ, A = 1012.2, B = -2.786.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Rentang Pengukuran", desc: "300 - 10,000 PPM gas Metana (CH₄).", icon: Activity },
      { name: "Koneksi Perangkat Keras", desc: "Terhubung ke Channel 2 (MQ4ADCPin) pada ADC ADS1115.", icon: HardDrive }
    ]
  },
  {
    term: "MEMS NO₂ (Sensor Nitrogen Dioksida)",
    description: "Sensor MEMS presisi tinggi untuk konsentrasi gas NO₂.",
    detail: "Sensor gas Nitrogen Dioksida (NO₂) dengan respon cepat. Terkalibrasi pada modul perangkat dengan parameter R0 = 3.172 kΩ, A = 0.55, B = -0.82 (Satuan: PPB).",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Rentang Pengukuran", desc: "0.05 - 10 PPM / PPB Nitrogen Dioksida.", icon: Activity },
      { name: "Koneksi Perangkat Keras", desc: "Terhubung ke Channel 0 (MEMSNO2ADCPin) pada ADC ADS1115.", icon: HardDrive }
    ]
  },
  {
    term: "DHT22 (Sensor Suhu dan Kelembapan Udara)",
    description: "Sensor digital presisi untuk mikroklimat udara sekitar.",
    detail: "Mengukur suhu udara (°C) dan kelembapan relatif udara (%). Terhubung ke Pin GPIO 4 mikrokontroler dengan pembacaan teratur setiap 5 detik.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Presisi Suhu", desc: "Akurasi ±0.5°C pada rentang -40°C hingga +80°C.", icon: Thermometer },
      { name: "Presisi Kelembapan", desc: "Akurasi ±2-5% RH pada rentang 0-100% RH.", icon: Droplets }
    ]
  },
  {
    term: "Anemometer RS485 Modbus (Kecepatan Angin)",
    description: "Sensor laju angin industri dengan protokol RS485 Modbus RTU.",
    detail: "Membaca laju angin fisik (m/s dan km/jam) menggunakan komunikasi serial Modbus RTU (TX Pin 17, RX Pin 18). Dijalankan secara non-blocking via FreeRTOS Task khusus.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Protokol Komunikasi", desc: "Frame Request Modbus RTU 0x01 0x03 0x00 0x00 0x00 0x01 0x84 0x0A.", icon: Radio },
      { name: "Transmisi Akses Memori Aman", desc: "FreeRTOS Mutex Semaphore (anemoMutex) untuk keamanan akses memori.", icon: Cpu }
    ]
  },
  {
    term: "TinyGPS++ NEO-6M / GT-U7 (Geospasial GPS)",
    description: "Modul penerima satelit GPS untuk lokasi dan waktu presisi.",
    detail: "Menentukan koordinat Latitude, Longitude, dan Altitude (ketinggian mdpl) secara otomatis. Terhubung ke HardwareSerial 2 (RX Pin 1, TX Pin 15).",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Koordinat Presisi", desc: "Pembacaan latitude, longitude, dan altitude seketika.", icon: Compass },
      { name: "Efisiensi Prosesor", desc: "Dikelola via vTaskGPS untuk efisiensi CPU mikrokontroler.", icon: Cpu }
    ]
  },
  {
    term: "Adafruit ADS1115 (16-Bit I2C ADC)",
    description: "Modul pengubah sinyal Analog ke Digital 16-Bit presisi tinggi.",
    detail: "Converter I2C (Alamat 0x48, SDA Pin 8, SCL Pin 9) dengan Gain 2/3x yang mengonversi tegangan analog sensor gas MQ-135, MQ-4, dan MEMS NO₂ menjadi data digital presisi.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Resolusi tinggi", desc: "16-Bit ADC (65.536 steps) jauh melebihi ADC bawaan mikrokontroler standar.", icon: HardDrive }
    ]
  },
  {
    term: "Aki dan Solar Panel Power Management",
    description: "Sirkuit pemantau tegangan aki 12V dan persentase baterai.",
    detail: "Mengukur tegangan aki (Battery ADC Pin 5) menggunakan pembagi tegangan R-Divider (Ratio 5.166, Calibration 0.9899). Mengalkulasi persentase baterai 0-100% pada rentang 11.0V - 12.8V.",
    roles: ['admin', 'operator', 'viewer'],
    category: "SPESIFIKASI SENSOR HARDWARE",
    features: [
      { name: "Rentang Tegangan Aman", desc: "Batas bawah 11.0 Volt, batas atas 12.8 Volt.", icon: Zap },
      { name: "Oversampling ADC", desc: "Pembacaan 16 sampel analog untuk meredam derau tegangan aki.", icon: Cpu }
    ]
  },

  // 6. KAMUS ILMIAH
  {
    term: "Carbon Potential Score (CPS)",
    description: "Skor potensi sisa kapasitas serapan karbon tanah (0-100%).",
    detail: "Skor tinggi mengindikasikan lahan masih memiliki ruang serapan karbon yang besar. Diukur dari kombinasi parameter organik tanah dan iklim mikro.",
    roles: ['admin', 'operator', 'viewer'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "Sequestration Headroom", desc: "Sisa kapasitas tanah dalam mengikat unsur karbon secara stabil.", icon: Target }
    ]
  },
  {
    term: "Net Ecosystem Exchange (NEE)",
    description: "Laju pertukaran karbon bersih antara ekosistem dan atmosfer.",
    detail: "Nilai kuantitatif (gC/m²/jam). Nilai positif menandakan ekosistem bertindak sebagai penyerap emisi (Sink), sedangkan negatif adalah penyumbang emisi (Source).",
    roles: ['admin', 'operator', 'viewer'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "GPP dan RECO", desc: "Gross Primary Production dikurangi Respirasi Ekosistem Total.", icon: Leaf }
    ]
  }
];

export default function GlossaryView({ userRole }: { userRole?: string }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const normalizedRole = (userRole || getStoredUser()?.role || 'viewer').toLowerCase();

  const glossaryData = getGlossaryData(t);

  // Filter terms by user role safely
  const allowedTerms = glossaryData.filter(item => 
    !item.roles || item.roles.includes(normalizedRole) || normalizedRole === 'admin'
  );
  
  // Apply Search and Category filter safely
  const filteredTerms = allowedTerms.filter(item => {
    if (!item) return false;
    const termStr = item.term || '';
    const descStr = item.description || '';
    const matchesSearch = termStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
      descStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedTerms = filteredTerms.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, typeof glossaryData>);

  // Urutan Kategori Baku (Sesuai Struktur Sidebar System)
  const categoryOrder = [
    "OPERASIONAL", 
    "MANAJEMEN", 
    "ANALITIK", 
    "SISTEM", 
    "SPESIFIKASI SENSOR HARDWARE", 
    "KAMUS ILMIAH"
  ];

  const sortedCategories = Object.keys(groupedTerms).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    return (indexA !== -1 ? indexA : 99) - (indexB !== -1 ? indexB : 99);
  });

  const categoryBadgeColors: Record<string, string> = {
    "OPERASIONAL": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    "MANAJEMEN": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "ANALITIK": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    "SISTEM": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "SPESIFIKASI SENSOR HARDWARE": "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    "KAMUS ILMIAH": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
  };

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-24 select-none">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-xs shrink-0">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {t('Glosarium dan Dokumentasi Sistem')}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {t('Panduan lengkap fitur, spesifikasi sensor perangkat, dan metrik analitik')}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Glassmorphism Banner Header */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden text-center sm:text-left"
      >
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-64 h-64 rounded-full bg-teal-400/20 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/15 backdrop-blur-md ring-4 ring-white/30 flex items-center justify-center p-3 shadow-2xl shrink-0">
            <BookOpen size={48} className="text-emerald-200" />
          </div>

          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
                {t('Glosarium dan Dokumentasi Sistem')}
              </h2>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed font-medium opacity-95 max-w-3xl">
              {t('Panduan lengkap fitur, spesifikasi sensor perangkat, dan metrik analitik')}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Control Bar: Search & Category Filter Chips */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder={t('Cari istilah, sensor, atau fitur...')}
            className="pl-11 pr-10 h-12 rounded-2xl bg-card border-border/80 font-extrabold text-sm focus-visible:ring-emerald-500/20 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
              selectedCategory === "ALL" 
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
                : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            {t('Semua Kategori')} ({allowedTerms.length})
          </button>
          {categoryOrder.map(cat => {
            const count = allowedTerms.filter(t => t.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer border ${
                  selectedCategory === cat 
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25" 
                    : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(cat)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Glossary Categories Grid */}
      {sortedCategories.length > 0 ? (
        <div className="space-y-10">
          {sortedCategories.map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`px-3.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${categoryBadgeColors[category] || 'bg-muted'}`}>
                  {t(category)}
                </Badge>
                <div className="h-[1px] flex-1 bg-border/60 rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedTerms[category].map((item, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card 
                      className="h-full bg-card border-border/80 shadow-md hover:shadow-lg rounded-3xl cursor-pointer group hover:border-emerald-500/40 relative overflow-hidden flex flex-col justify-between"
                      onClick={() => setSelectedTerm(item)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base font-extrabold text-foreground leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.term}
                          </CardTitle>
                          <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <ChevronRight size={16} />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-3">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pt-2 border-t border-border/40">
                          <Info size={13} />
                          <span>{t('Klik untuk Detail Lengkap')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-3xl bg-muted/20 p-8">
          <BookOpen size={40} className="text-muted-foreground/30 mb-3" />
          <h3 className="font-extrabold text-base text-foreground">{t('Kamus Tidak Ditemukan')}</h3>
          <p className="text-xs text-muted-foreground font-medium max-w-sm mt-1">{t('Istilah atau sensor yang Anda cari tidak ditemukan.')}</p>
        </div>
      )}

      {/* Modal Detail Glosarium & Sensor */}
      <Dialog open={!!selectedTerm} onOpenChange={(open) => !open && setSelectedTerm(null)}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border shadow-2xl">
          {selectedTerm && (
            <>
              <DialogHeader className="border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${categoryBadgeColors[selectedTerm.category] || 'bg-muted'}`}>
                    {t(selectedTerm.category)}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black text-foreground leading-tight">
                  {selectedTerm.term}
                </DialogTitle>
                <DialogDescription className="text-xs pt-1 text-muted-foreground font-medium">
                  {selectedTerm.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-2 space-y-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {t('Penjelasan Lebih Lanjut')}
                  </p>
                  <p className="text-xs text-foreground leading-relaxed font-medium bg-muted/40 p-4 rounded-2xl border border-border/60 whitespace-pre-line">
                    {selectedTerm.detail}
                  </p>
                </div>

                {selectedTerm.features && selectedTerm.features.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers size={14} className="text-emerald-600 dark:text-emerald-400" />
                      {t('Fitur dan Komponen Utama')}
                    </p>
                    <div className="grid gap-2.5 max-h-[35vh] overflow-y-auto pr-1">
                      {selectedTerm.features.map((f: any, i: number) => {
                        const FeatureIcon = f?.icon;
                        const isValidIcon = typeof FeatureIcon === 'function' || (typeof FeatureIcon === 'object' && FeatureIcon !== null);
                        return (
                          <div key={i} className="p-3.5 rounded-2xl bg-card border border-border/60 hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              {isValidIcon ? (
                                <FeatureIcon size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <Info size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              )}
                              <p className="text-xs font-extrabold text-foreground">{f.name}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed pl-6 font-medium">{f.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
