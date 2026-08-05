import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, ChevronRight, Info, Layers, Radio, AlertTriangle, X as XIcon, Leaf, Thermometer, Droplets, FlaskConical, Zap, Activity, MapPin, CloudSun, Filter, Calendar, BarChart3, Download, Eye, Brain, Shield, Target, TrendingUp, Database, Map as MapIcon, Layers as LayersIcon, Settings, Users, FileText, Bell, Plus, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Glossary Data with friendly, formal language and extended details
const glossaryData = [
  {
    term: "Dasbor (Dashboard)",
    description: "Halaman utama berisi ringkasan kondisi kebun secara langsung.",
    detail: "Tempat melihat status perangkat, peringatan lingkungan, peta singkat lokasi sensor, dan data sensor terbaru. Cocok untuk pantauan cepat setiap pagi.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Ringkasan Carbon Flux (NEE)", desc: "Kartu hijau dengan ikon daun. Menampilkan laju pertukaran karbon bersih. Nilai positif = tanaman menyerap CO₂. Klik ikon (i) di pojok kanan atas kartu untuk melihat penjelasan singkat.", icon: Leaf },
      { name: "Suhu & Cuaca Terkini (BMKG)", desc: "Panel abu-abu gelap di sisi kanan. Menampilkan suhu dalam derajat Celsius, kondisi cuaca (cerah/hujan), arah angin, dan prakiraan 4 periode ke depan dari BMKG.", icon: CloudSun },
      { name: "Status Perangkat (Node)", desc: "Kartu dengan ikon antena. Hijau = Aktif mengirim data. Kuning = Peringatan (ada parameter di luar ambang batas). Merah = Tidak aktif / mati.", icon: Radio },
      { name: "Parameter Lingkungan Utama", desc: "Kartu ringkas di bawah ringkasan utama. Menampilkan nilai real-time untuk CO₂, CH₄, NO₂, Suhu Udara, Kelembapan, dan Kecepatan Angin. Klik kartu untuk membalik dan melihat deskripsi singkat.", icon: Activity },
      { name: "Grafik Riwayat Analitik", desc: "Grafik garis besar di bagian bawah. Gunakan dropdown di pojok kanan atas grafik untuk mengubah parameter yang ditampilkan (CO₂, Suhu, Kelembapan, dll). Gunakan filter rentang waktu (24 Jam / 7 Hari / 30 Hari).", icon: BarChart3 },
      { name: "Pemilih Perangkat & Tanggal", desc: "Di bagian atas halaman. Dropdown pertama untuk memilih sensor/node yang ingin dipantau. Ikon kalender untuk memilih tanggal spesifik.", icon: Filter }
    ]
  },
  {
    term: "Data Sensor",
    description: "Catatan rinci pembacaan sensor di lapangan.",
    detail: "Berisi data CO₂, CH₄, NO₂, suhu udara, kelembapan, kecepatan angin, dan parameter lain dari setiap node. Bisa difilter per waktu untuk melihat tren lingkungan.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Filter Rentang Waktu", desc: "Dropdown di pojok kanan atas. Pilih '24 Jam', '7 Hari', atau '30 Hari' untuk menyaring data sensor yang ditampilkan di tabel dan grafik.", icon: Filter },
      { name: "Tabel Data Kronologis", desc: "Tabel utama menampilkan setiap baris data mentah: waktu pengiriman, CO₂, gas lainnya, iklim mikro, dll. Baris terbaru selalu muncul di paling atas.", icon: Database },
      { name: "Grafik Parameter Sensor", desc: "Grafik garis interaktif di bawah tabel. Hover pada titik data untuk melihat nilai tepat. Gunakan dropdown parameter untuk berganti antarmetrik.", icon: BarChart3 },
      { name: "Pemilih Node/Sensor", desc: "Dropdown untuk memilih perangkat sensor spesifik yang ingin dilihat datanya. Setiap node memiliki data independen.", icon: Radio }
    ]
  },
  {
    term: "Peta Node",
    description: "Peta lokasi setiap sensor di kebun.",
    detail: "Menampilkan posisi alat secara visual. Pin merah berkedip menandakan kondisi krisis di area tersebut.",
    roles: ['admin', 'operator', 'viewer'],
    category: "OPERASIONAL",
    features: [
      { name: "Poligon Lahan", desc: "Garis batas virtual berwarna di atas peta satelit yang menunjukkan area kebun yang telah didaftarkan. Setiap poligon mewakili satu unit lahan.", icon: LayersIcon },
      { name: "Marker Status Warna", desc: "Titik/pin di peta: Hijau = sensor aktif & normal. Merah = sensor mendeteksi anomali (suhu/kelembapan di luar batas). Abu-abu = sensor offline.", icon: MapPin },
      { name: "Tooltip Data Langsung", desc: "Klik pada pin sensor untuk melihat popup kecil berisi data suhu, kelembapan, dan CO₂ terkini tanpa berpindah halaman.", icon: Eye }
    ]
  },
  {
    term: "Klimatologi (BMKG)",
    description: "Prakiraan cuaca dari BMKG untuk lokasi kebun.",
    detail: "Berguna untuk merencanakan aktivitas harian. Data cuaca digabung dengan sensor kebun untuk rekomendasi yang lebih presisi.",
    roles: ['admin', 'operator', 'viewer'],
    category: "ANALITIK",
    features: [
      { name: "Prakiraan Cuaca Harian", desc: "Panel utama menampilkan suhu saat ini dan prediksi cuaca (cerah, berawan, hujan) untuk beberapa periode ke depan dari data BMKG.", icon: CloudSun },
      { name: "Kecepatan & Arah Angin", desc: "Informasi laju angin (km/jam) untuk menentukan waktu ideal penyemprotan pupuk atau pestisida. Ditampilkan di bagian bawah panel cuaca.", icon: Activity },
      { name: "Kelembapan Udara", desc: "Persentase kelembapan udara sekitar lokasi sensor. Ditampilkan di panel info bawah bersama laju angin.", icon: Droplets }
    ]
  },
  {
    term: "Analitik Karbon",
    description: "Analisis serapan karbon dan kesehatan lahan.",
    detail: "Menghitung skor CCI dan Carbon Flux dari data sensor tanah. AI memberi saran perawatan jika diaktifkan. Halaman ini punya beberapa tab di atas.",
    roles: ['admin', 'operator', 'viewer'],
    category: "ANALITIK",
    features: [
      { name: "Carbon Potential Score (CPS)", desc: "Potensi sisa serapan karbon (0-100%). Menghitung seberapa banyak 'ruang' yang tersisa di lahan untuk menyimpan karbon (Sequestration Headroom).", icon: Target },
      { name: "Carbon Flux (NEE)", desc: "Estimasi laju pertukaran karbon bersih (gC/m²/jam). Mengetahui apakah ekosistem sedang menyerap (Sink) atau melepas (Source) karbon.", icon: Leaf },
      { name: "Grafik Korelasi Cahaya & CO₂", desc: "Grafik scatter di tab 'Korelasi' yang menunjukkan titik paling optimal untuk fotosintesis berdasarkan intensitas cahaya matahari.", icon: BarChart3 },
      { name: "AgriSense True AI", desc: "Tombol interaktif di tab 'AI Insight'. Klik untuk meminta AI merangkum kondisi lahan saat ini menjadi instruksi kerja yang mudah dipahami. Memerlukan konfigurasi API Key di Pengaturan.", icon: Brain },
      { name: "Tab Navigasi", desc: "Tombol di tengah atas halaman untuk berpindah antara: Ringkasan CCI, Korelasi Parameter, dan AI Insight.", icon: Filter }
    ]
  },
  {
    term: "Performa Model AI",
    description: "Perbandingan akurasi model prediksi emisi karbon.",
    detail: "Membandingkan model LSTM, XGBoost, dan SVR menggunakan metrik RMSE, MAE, MAPE, dan R² Score. Hanya admin dan operator.",
    roles: ['admin', 'operator'],
    category: "ANALITIK",
    features: [
      { name: "Banner Model Terbaik", desc: "Banner hijau di bagian atas menampilkan model dengan performa terbaik beserta ringkasan metrik utamanya (MAPE, MAE, RMSE, R²).", icon: Shield },
      { name: "Grafik Perbandingan Metrik", desc: "Grafik batang di tab 'Perbandingan Model' yang membandingkan R² Score, MAPE, RMSE, dan MAE dari ketiga model secara visual.", icon: BarChart3 },
      { name: "Radar Performa", desc: "Grafik radar pentagon yang mengevaluasi setiap model dari 5 dimensi: R² Score, Kecepatan Pelatihan, Akurasi Jangka Panjang, Interpretability, dan Adaptasi Pola.", icon: Target },
      { name: "Tabel Detail Metrik", desc: "Tabel lengkap di bawah grafik berisi semua angka metrik per model. Model terbaik ditandai badge hijau 'Terbaik'.", icon: Database },
      { name: "Kurva Training Loss", desc: "Grafik garis di tab 'Akurasi Prediksi' yang menunjukkan penurunan error dari Epoch ke Epoch selama pelatihan. Semakin cepat turun = model semakin cepat belajar.", icon: TrendingUp },
      { name: "Feature Importance", desc: "Grafik batang horizontal di tab 'Feature Importance' yang menunjukkan variabel mana yang paling berpengaruh terhadap prediksi (CO₂, Kelembapan, Suhu, dll).", icon: BarChart3 }
    ]
  },
  {
    term: "Manajemen Lahan & Kebun",
    description: "Pemetaan batas lahan dan pembagian blok kebun.",
    detail: "Tempat menggambar batas lahan di peta dan membaginya ke dalam blok kerja. Dipakai sebelum mendaftarkan sensor agar lokasi tertata.",
    roles: ['admin', 'operator'],
    category: "MANAJEMEN",
    features: [
      { name: "Tombol Tambah Lahan", desc: "Tombol '+' di pojok kanan atas untuk membuka form pendaftaran lahan baru. Isi nama, alamat, dan gambar batas lahan di peta.", icon: Plus },
      { name: "Penggambaran Poligon", desc: "Alat gambar di dalam peta satelit. Klik titik-titik di peta untuk membentuk batas area lahan Anda. Klik titik pertama lagi untuk menutup poligon.", icon: MapIcon },
      { name: "Informasi Elevasi", desc: "Ketinggian dari permukaan laut (mdpl) yang otomatis terdeteksi. Krusial untuk kalibrasi sensor karbon.", icon: TrendingUp },
      { name: "Tombol Edit & Hapus", desc: "Ikon pensil untuk mengedit data lahan, ikon tempat sampah untuk menghapus. Hanya muncul untuk pengguna dengan hak akses.", icon: Edit }
    ]
  },
  {
    term: "Manajemen Perangkat",
    description: "Daftar sensor terpasang dan status koneksinya.",
    detail: "Tempat mendaftarkan sensor baru, melihat status koneksi, dan menetapkan sensor ke lahan/kebun tertentu.",
    roles: ['admin', 'operator', 'viewer'],
    category: "MANAJEMEN",
    features: [
      { name: "Registrasi Node", desc: "Tombol 'Tambah Perangkat' untuk memasukkan ID unik alat sensor baru ke dalam sistem.", icon: Plus },
      { name: "Pemetaan Node ke Lahan", desc: "Dropdown di form pendaftaran untuk menentukan di lahan/blok mana alat tersebut ditanam secara fisik.", icon: MapPin },
      { name: "Indikator Status", desc: "Badge warna di setiap baris perangkat: Hijau (Online), Kuning (Warning), Merah (Offline). Menunjukkan kondisi koneksi real-time.", icon: Radio }
    ]
  },
  {
    term: "Laporan & Ekspor",
    description: "Unduh data historis ke format Excel atau PDF.",
    detail: "Pilih rentang tanggal dan perangkat, sistem akan membuat tabel laporan otomatis untuk dokumentasi.",
    roles: ['admin', 'operator'],
    category: "SISTEM",
    features: [
      { name: "Ekspor Excel/CSV", desc: "Tombol dengan ikon panah bawah. Mengunduh data mentah sensor dalam format spreadsheet yang dapat diolah lebih lanjut.", icon: Download },
      { name: "Cetak Dokumen PDF", desc: "Tombol untuk mengunduh ringkasan elegan dan formal dari data kebun Anda untuk kebutuhan laporan resmi.", icon: FileText },
      { name: "Filter Waktu Kustom", desc: "Dua kolom tanggal (Dari - Sampai) untuk memilih rentang waktu spesifik data yang ingin diunduh.", icon: Calendar }
    ]
  },
  {
    term: "Log Aktivitas",
    description: "Catatan setiap aksi penting yang terjadi di sistem.",
    detail: "Merekam login, penambahan, perubahan, dan penghapusan data beserta waktunya. Hanya admin dan operator yang dapat melihat.",
    roles: ['admin', 'operator'],
    category: "SISTEM",
    features: [
      { name: "Tabel Rekam Jejak", desc: "Menampilkan siapa pengguna yang melakukan aksi, apa yang dilakukan (login/tambah/hapus), dan jam berapa aksi tersebut dieksekusi.", icon: Activity },
      { name: "Filter Jenis Aksi", desc: "Dropdown untuk memfilter tipe catatan tertentu saja, contoh: hanya melihat aksi 'Penghapusan Data' atau 'Login'.", icon: Filter }
    ]
  },
  {
    term: "Manajemen Pengguna",
    description: "Pengaturan akun pengguna dan hak akses (admin only).",
    detail: "Tempat menambah pengguna baru dan mengatur peran (admin, operator, viewer). Setiap peran punya akses berbeda.",
    roles: ['admin'],
    category: "SISTEM",
    features: [
      { name: "Pengaturan Role", desc: "Dropdown pemilihan peran: Admin (akses penuh), Operator (operasional & analitik), Viewer (hanya lihat data dasar). Setiap role membatasi menu yang terlihat di sidebar.", icon: Shield },
      { name: "Penambahan Akun Baru", desc: "Form untuk mendaftarkan email dan nama anggota tim baru. Setelah dibuat, mereka bisa langsung login ke portal AgriSense.", icon: Users },
      { name: "Hapus Pengguna", desc: "Tombol ikon tempat sampah merah di baris pengguna. Hanya Admin yang bisa menghapus akun.", icon: Trash2 }
    ]
  },
  {
    term: "Pengaturan Sistem",
    description: "Konfigurasi global aplikasi (admin only).",
    detail: "Pengaturan ambang batas peringatan, kunci API untuk fitur AI, dan parameter inti lainnya.",
    roles: ['admin'],
    category: "SISTEM",
    features: [
      { name: "Konfigurasi Threshold", desc: "Menyetel angka batas peringatan. Contoh: Jika kelembapan tanah di bawah 30%, maka sistem menampilkan alarm kuning di Dasbor.", icon: AlertTriangle },
      { name: "Konfigurasi API AI", desc: "Kolom input untuk memasukkan API Key dari Groq atau Google Gemini agar fitur AgriSense True AI (Analitik Karbon) bisa aktif.", icon: Brain }
    ]
  },
  {
    term: "Carbon Potential Score (CPS)",
    description: "Skor potensi serapan karbon lahan (0-100%).",
    detail: "Skor tinggi berarti lahan masih punya kapasitas besar untuk menyerap karbon. Skor rendah berarti kapasitas penyimpanan hampir penuh.",
    roles: ['admin', 'operator', 'viewer'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "Sequestration Headroom", desc: "Konsep yang menilai sisa 'gudang' karbon tanah. Berguna untuk perencanaan reboisasi atau pemupukan organik.", icon: Target },
      { name: "Rentang Skor", desc: "Di atas 75% = Potensi Tinggi (hijau). 50-75% = Cukup. Di bawah 25% = Potensi Rendah (merah) karena kapasitas penyimpanan hampir penuh.", icon: BarChart3 }
    ]
  },
  {
    term: "Vapor Pressure Deficit (VPD)",
    description: "Indikator kebutuhan air tanaman dari kondisi udara.",
    detail: "Membantu menentukan waktu ideal untuk menyiram atau pengkabutan. VPD tinggi berarti tanaman cepat kehilangan air.",
    roles: ['admin', 'operator', 'viewer'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "Stres Dehidrasi", desc: "Jika VPD tinggi (>1.5 kPa), udara menyedot kelembapan terlalu cepat sehingga stomata tanaman menutup paksa dan fotosintesis terhenti.", icon: AlertTriangle },
      { name: "Risiko Jamur", desc: "Jika VPD terlalu rendah (<0.4 kPa), udara terlalu basah dan tanaman sangat rawan terserang penyakit fungi (jamur).", icon: Droplets }
    ]
  },
  {
    term: "Carbon Flux / NEE",
    description: "Laju pertukaran karbon antara lahan dan atmosfer.",
    detail: "Positif berarti lahan menyerap karbon, negatif berarti melepas karbon. Diukur dalam gC/m² per jam.",
    roles: ['admin', 'operator', 'viewer'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "PAR (Photosynthetically Active Radiation)", desc: "Bagian dari cahaya matahari (400-700nm) yang bisa digunakan tanaman untuk fotosintesis.", icon: Activity },
      { name: "fAPAR (Fraction of Absorbed PAR)", desc: "Seberapa efisien tajuk daun menangkap cahaya. Nilai ini dipengaruhi oleh kerapatan daun (Leaf Area Index).", icon: Leaf },
      { name: "T_scalar (Stress Suhu)", desc: "Faktor pembatas dari suhu udara. Fotosintesis melambat jika suhu terlalu dingin (<10°C) atau terlalu panas (>40°C).", icon: Thermometer },
      { name: "C_scalar (CO2 Fertilization)", desc: "Efek 'pupuk udara'. Kenaikan konsentrasi CO2 di sekitar daun dapat memacu laju fotosintesis hingga batas tertentu.", icon: Zap },
      { name: "Net Ecosystem Exchange (NEE)", desc: "Hasil akhir (GPP - RECO). Mengetahui apakah lahan Anda adalah penyerap karbon (Sink) atau pelepas emisi (Source).", icon: TrendingUp }
    ]
  },
  {
    term: "RMSE, MAE, MAPE, R²",
    description: "Metrik akurasi model AI prediksi karbon.",
    detail: "Standar untuk menilai performa model regresi. Nilai lebih kecil pada RMSE, MAE, dan MAPE berarti model lebih akurat. R² mendekati 1 berarti model menjelaskan data dengan baik.",
    roles: ['admin', 'operator'],
    category: "KAMUS ILMIAH",
    features: [
      { name: "RMSE (Root Mean Square Error)", desc: "Rata-rata akar kuadrat dari selisih antara prediksi dan kenyataan. Semakin kecil = semakin akurat. Satuan: ppm.", icon: Target },
      { name: "MAE (Mean Absolute Error)", desc: "Rata-rata kesalahan absolut prediksi. Lebih mudah diinterpretasi dibanding RMSE. Satuan: ppm.", icon: BarChart3 },
      { name: "MAPE (Mean Absolute % Error)", desc: "Persentase rata-rata kesalahan. Contoh: MAPE 4.8% artinya prediksi meleset rata-rata 4.8% dari nilai sebenarnya.", icon: TrendingUp },
      { name: "R² Score", desc: "Skor koefisien determinasi (0-1). Semakin mendekati 1 = model semakin mampu menjelaskan pola data. R² 0.95 artinya model menangkap 95% pola.", icon: Shield }
    ]
  }
];

export default function GlossaryView({ userRole }: { userRole: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<any | null>(null);

  // Filter terms by role
  const allowedTerms = glossaryData.filter(item => item.roles.includes(userRole));
  
  // Apply Search
  const filteredTerms = allowedTerms.filter(item => 
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const groupedTerms = filteredTerms.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, typeof glossaryData>);

  // Tentukan urutan kategori (seperti di sidebar)
  const categoryOrder = ["OPERASIONAL", "MANAJEMEN", "ANALITIK", "SISTEM", "KAMUS ILMIAH"];
  const sortedCategories = Object.keys(groupedTerms).sort((a, b) => {
    return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
  });

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Glosarium AgriSense</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Panduan fitur dan istilah dalam sistem AgriSense.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input 
          placeholder="Cari istilah, menu, atau metrik..." 
          className="pl-10 rounded-md bg-background border-2 border-border/50 focus-visible:ring-primary/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {sortedCategories.length > 0 ? (
        <div className="space-y-10">
          {sortedCategories.map(category => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-0.5 flex-1 bg-border/40 rounded-full"></div>
                <h2 className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground">{category}</h2>
                <div className="h-0.5 flex-1 bg-border/40 rounded-full"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {groupedTerms[category].map((item, idx) => (
                  <Card 
                    key={idx} 
                    className="hover:shadow-sm hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-border/60 hover:border-primary/30 relative overflow-hidden"
                    onClick={() => setSelectedTerm(item)}
                  >
                    <CardHeader className="pb-3 relative z-10">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg font-bold text-foreground leading-tight group-hover:text-foreground/80 transition-colors">
                          {item.term}
                        </CardTitle>
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                      <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <Info size={12} />
                        <span>Klik untuk Detail Lengkap</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center flex flex-col items-center justify-center border-2 border-dashed border-border rounded-md bg-muted/20">
          <BookOpen size={40} className="text-muted-foreground/30 mb-3" />
          <h3 className="font-bold text-lg text-foreground">Kamus Tidak Ditemukan</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">Istilah yang Anda cari tidak ada atau hak akses Anda tidak diizinkan untuk melihat menu tersebut.</p>
        </div>
      )}

      {/* Dialog / Popup untuk Detail Glosarium */}
      <Dialog open={!!selectedTerm} onOpenChange={(open) => !open && setSelectedTerm(null)}>
        <DialogContent className="sm:max-w-md rounded-md">
          {selectedTerm && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="text-[10px] font-black uppercase tracking-widest">{selectedTerm.category}</Badge>
                </div>
                <DialogTitle className="text-xl font-black text-primary leading-tight">
                  {selectedTerm.term}
                </DialogTitle>
                <DialogDescription className="text-sm pt-2 text-foreground font-medium">
                  {selectedTerm.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-2 pt-4 border-t border-border/50">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <BookOpen size={14} />
                  Penjelasan Lebih Lanjut
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {selectedTerm.detail}
                </p>

                {selectedTerm.features && selectedTerm.features.length > 0 && (
                  <div className="mt-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers size={14} />
                      Fitur & Komponen Utama
                    </p>
                    <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                      {selectedTerm.features.map((f: any, i: number) => {
                        const FeatureIcon = f.icon;
                        return (
                          <div key={i} className="p-3 rounded-md bg-muted/30 border border-border/50 transition-colors hover:bg-muted/50">
                            <div className="flex items-center gap-2 mb-1">
                              {FeatureIcon && <FeatureIcon size={15} className="text-primary shrink-0" />}
                              <p className="text-sm font-bold text-primary">{f.name}</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed pl-[23px]">{f.desc}</p>
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
