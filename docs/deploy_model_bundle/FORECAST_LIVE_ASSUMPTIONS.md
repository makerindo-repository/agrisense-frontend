# Asumsi Tetap pada Forecasting Langsung (Live Inference) — AgriSense

**Versi asumsi:** `v1-fixed-baseline-2026-07-30`
**Berlaku untuk:** `GET /api/forecasts`, job `App\Jobs\GenerateForecastForDevice`, service `App\Services\ForecastFeatureService` (backend Laravel)
**Model yang terdampak:** SVM, XGBoost, LSTM pada bundle `artifacts/sintetik_90` (dipanggil melalui `run_sintetik90_inference.py`)

## 1. Latar Belakang

Model prediksi (`sintetik_90`) dilatih menggunakan 36 fitur input yang dibangun
oleh `feature_engineering_fluxnet.py` dari data menara FLUXNET (Australia) yang
ditransformasikan agar menyerupai iklim tropis. Skrip tersebut membangun beberapa
fitur dengan **komponen acak** (`np.random.normal`, `np.random.uniform`,
`np.random.choice`) karena tujuannya saat itu adalah membuat dataset latih yang
bervariasi secara statistik, bukan menyajikan nilai yang harus direproduksi
persis di lapangan.

Ketika model ini dipakai untuk **forecasting langsung** dari data sensor
AgriSense yang sesungguhnya, komponen acak tersebut tidak relevan (tidak ada
"pelatihan" yang berlangsung saat inferensi) dan harus diganti dengan nilai
deterministik. Untuk sebagian besar fitur, ini berarti sekadar membuang suku
noise dan memakai bagian rumus yang sistematis. Namun **empat kuantitas terkait
karbon organik tanah (SOC)** tidak memiliki padanan pengukuran pada sensor
AgriSense saat ini sama sekali — tidak ada cara sah menurunkannya dari data
sensor, sehingga harus memakai asumsi tetap yang didokumentasikan di sini.

Dokumen ini adalah rujukan wajib sebelum mengutip angka forecasting dari sistem
ini pada laporan, presentasi, atau naskah jurnal — hasil prediksi **valid
sebagai estimasi sensitivitas di bawah asumsi baseline regional**, bukan
sebagai hasil yang telah divalidasi dengan pengukuran SOC lapangan.

## 2. Klasifikasi 36 Fitur Input Model

| # | Fitur | Sumber | Keterangan |
|---|-------|--------|------------|
| 1 | `suhu_udara` | **Sensor riil** | `air_temperature_sensor` |
| 2 | `kelembapan_udara` | **Sensor riil** | `air_humidity_sensor` |
| 3 | `tekanan_hpa` | **Sensor riil** | `air_pressure_hpa` |
| 4 | `cahaya_lux` | **Sensor riil** | `light_lux` |
| 5 | `kelembapan_tanah` | **Sensor riil** | `soil_moisture` |
| 6 | `suhu_tanah` | **Sensor riil** | `soil_temperature` |
| 7 | `ph_tanah` | **Sensor riil** | `soil_ph` |
| 8 | `tvoc_ppb` | **Sensor riil** | `tvoc_ppb` |
| 9 | `n_mg_kg` / `p_mg_kg` / `k_mg_kg` | **Sensor riil** | `soil_n/p/k_mg_kg` |
| 12 | `epsilon` | **Rumus deterministik** | Suku noise dibuang; hanya komponen `temp_stress` dari suhu udara riil |
| 13 | `fapar` | **Rumus deterministik** | Suku noise dibuang; proksi vegetasi dari kelembapan tanah riil |
| 14 | `par` | **Rumus fisis riil** | `cahaya_lux × 0.0185` (identik dengan skrip pelatihan) |
| 15 | `t_scalar` | **Rumus fisis riil** | Kurva respons suhu (identik dengan skrip pelatihan) |
| 16 | `w_scalar` | **Rumus fisis riil** | `kelembapan_tanah / 60`, dibatasi [0,1] |
| 17 | `c_scalar` | **ASUMSI TETAP** | Lihat §3.1 |
| 18 | `gpp` | **Rumus fisis riil** | Turunan dari par/fapar/epsilon/t_scalar/w_scalar/c_scalar di atas |
| 19 | `reco` | **Rumus fisis riil** | Persamaan Lloyd–Taylor dari suhu udara riil (identik dengan skrip pelatihan) |
| 20 | `npp` | **Rumus fisis riil** | `gpp × (1 − 0.53)` |
| 21 | `soc_baseline_gC_m2` | **ASUMSI TETAP** | Lihat §3.2 |
| 22 | `c_biomass_acc` | **ASUMSI TETAP (disederhanakan)** | Lihat §3.3 |
| 23 | `c_current` | **Turunan dari asumsi §3.2 + §3.3** | `soc_baseline + c_biomass_acc` |
| 24 | `c_max` | **ASUMSI TETAP** | Lihat §3.4 |
| 25 | `elapsed_hours` | **Data riil** | Jam sejak pembacaan pertama node tsb tercatat |
| 26–27 | `hour_sin` / `hour_cos` | **Data riil** | Dari jam pembacaan (`reading_time`) |
| 28–29 | `dow_sin` / `dow_cos` | **Data riil** | Dari hari-dalam-minggu `reading_time` |
| 30 | `is_daytime` | **Data riil** | Jam 06.00–18.00 dari `reading_time` |
| 31 | `is_cabai` | **Data riil jika tersedia** | 1 jika `plant_types` pada Kebun/Lahan node memuat kata "cabai"; default 0 (bukan koin-lempar acak seperti skrip pelatihan) |
| 32 | `has_full_data` | **Data riil** | 1 jika seluruh kolom sensor inti terisi pada pembacaan tsb, else 0 |
| 33–35 | `*_lag1`, `co2_lag1` | **Data riil** | Pembacaan node yang sama ±1 jam sebelumnya (fallback ke nilai saat ini jika tidak ada riwayat, setara `.bfill()`) |
| 36 | `*_roll6` | **Data riil** | Rata-rata bergerak 6 jam dari riwayat pembacaan node yang sama |
| 37 | `vpd_approx` | **Rumus fisis riil (ditingkatkan)** | Lihat §3.5 |

Dari 36 fitur, **hanya 4 kuantitas** (`c_scalar`, `soc_baseline_gC_m2`,
`c_biomass_acc`, `c_max`) memakai nilai yang tidak diturunkan langsung dari
sensor atau riwayat data node. Implementasi: `App\Services\ForecastFeatureService`.

## 3. Rincian Setiap Asumsi Tetap

### 3.1 `c_scalar` — Baseline CO2 Atmosferik Regional

- **Nilai:** `415.0 / 420.0 ≈ 0.9881` (konstan untuk seluruh prediksi)
- **Kenapa bukan nilai sensor CO2 per-node:** Ini **disengaja secara metodologis**,
  bukan kompromi. Skrip pelatihan (`feature_engineering_fluxnet.py`, FIX #2)
  secara eksplisit **menghindari** memakai `co2_ppm` per-baris untuk menghitung
  `c_scalar` demi mencegah *target leakage* (model "mengintip" jawaban dari
  fitur input yang berkorelasi langsung dengan target CO2). Memakai baseline
  atmosferik tetap konsisten dengan desain asli model.
- **Sumber nilai:** 415 ppm adalah perkiraan konsentrasi CO2 atmosferik latar
  belakang global pertengahan dekade 2020-an; 420 ppm adalah `CO2_BASELINE`
  pada skrip pelatihan.
- **Dampak jika salah:** Karena `c_scalar` konstan untuk semua prediksi pada
  suatu waktu, ia hanya menggeser skala GPP secara seragam — tidak
  mendistorsi perbandingan antar-node atau antar-waktu.
- **Rencana kalibrasi:** Perbarui nilai 415 ppm secara berkala mengikuti data
  CO2 atmosferik regional terbaru (mis. dari BMKG/observatorium terdekat),
  bukan dari sensor CO2 AgriSense sendiri (yang mengukur CO2 mikro di sekitar
  tanaman/tanah, bukan CO2 atmosferik latar belakang).

### 3.2 `soc_baseline_gC_m2` — Baseline Karbon Organik Tanah

- **Nilai:** `6000.0` gC/m² (konstan untuk seluruh node)
- **Kenapa ini yang paling krusial:** Sensor AgriSense **tidak mengukur karbon
  organik tanah** sama sekali (bukan bagian dari 7-in-1 soil sensor). Pada
  skrip pelatihan, nilai ini adalah **konstanta acak per-segmen** (`np.random.
  uniform(4000, 8000)` per 1 dari 10 segmen sintetis) — sama sekali tanpa dasar
  pengukuran nyata, bahkan pada data latihnya sendiri.
- **Sumber nilai 6000:** Titik tengah rentang yang dipakai skrip pelatihan
  (3000–10000 gC/m², setelah `np.clip`).
- **Dampak jika salah:** `soc_baseline_gC_m2` adalah input langsung ke model
  (bukan sekadar langkah antara), dipakai untuk memprediksi **seluruh lima
  target** (CO2, Carbon Flux, Carbon Potential Score, Soil Moisture, pH),
  bukan cuma target yang tampak berkaitan dengannya. Karena nilainya konstan
  di semua node dan waktu, ia **tidak bisa membedakan** lahan dengan cadangan
  karbon tanah yang sesungguhnya berbeda — ini adalah keterbatasan ilmiah yang
  harus dinyatakan eksplisit pada setiap publikasi yang mengutip hasil
  forecasting sistem ini.
- **Rencana kalibrasi (prioritas tertinggi):**
  1. Lakukan pengukuran SOC laboratorium per lahan (metode Walkley–Black atau
     *loss-on-ignition*) minimal sekali per lokasi penelitian.
  2. Tambahkan kolom `soc_baseline_gc_m2` pada tabel `land_plots`/`gardens`
     agar nilainya **per-plot**, bukan konstanta global — `ForecastFeatureService`
     sudah membaca relasi `landPlot`/`garden` milik node (lihat `resolveIsCabai`
     sebagai pola yang sama bisa direplikasi), sehingga menambahkan field ini
     tinggal melanjutkan pola yang sudah ada, tidak perlu desain ulang.
  3. Sampai langkah 1–2 selesai, setiap angka forecasting yang dipublikasikan
     WAJIB mencantumkan catatan "diestimasi dengan asumsi SOC baseline
     regional tetap (6000 gC/m²), belum tervalidasi pengukuran lapangan."

### 3.3 `c_biomass_acc` — Akumulasi Biomassa Karbon

- **Nilai:** `0.0` (disederhanakan dari skema akumulasi kumulatif-per-segmen
  pada skrip pelatihan)
- **Kenapa disederhanakan, bukan direplikasi:** Pada skrip pelatihan, fitur ini
  adalah integral kumulatif NPP **per segmen sintetis** ditambah suku musiman
  sinusoidal — konsep "segmen" itu sendiri adalah artefak pembagian dataset
  latih, bukan entitas yang punya padanan pada satu pembacaan sensor tunggal
  saat inferensi langsung. Menetapkannya ke 0 berarti mengasumsikan **kondisi
  baseline** (belum ada akumulasi biomassa karbon tambahan di atas baseline).
- **Dampak jika salah:** Menggeser `c_current` (§di bawah) ke arah bawah
  dibanding kondisi lapangan sesungguhnya jika lahan sudah mengakumulasi
  biomassa karbon signifikan sejak baseline ditetapkan.
- **Rencana kalibrasi:** Setelah §3.2 (SOC per-plot riil) tersedia, pertimbangkan
  mengganti nilai 0 dengan estimasi akumulasi NPP riil sejak tanggal
  pengukuran SOC baseline (memerlukan riwayat NPP terhitung yang cukup panjang
  per node — bukan pekerjaan satu kali, perlu akumulasi berkelanjutan).

### 3.4 `c_max` — Kapasitas Maksimum Karbon Tanah

- **Nilai:** `soc_baseline_gC_m2 × 1.375` (rasio, bukan konstanta absolut)
- **Sumber nilai 1.375:** Titik tengah rentang rasio pelatihan (`1.30` hingga
  `1.45`, hasil `1.30 + np.random.uniform(0, 0.15)`).
- **Dampak jika salah:** Karena `c_max` adalah rasio terhadap
  `soc_baseline_gC_m2`, akurasinya sepenuhnya bergantung pada §3.2 — begitu
  SOC baseline per-plot riil tersedia, `c_max` otomatis ikut menjadi lebih
  akurat tanpa perubahan kode lebih lanjut.
- **Rencana kalibrasi:** Sama seperti §3.2; idealnya rasio ini juga divalidasi
  dengan data kapasitas retensi karbon tanah spesifik jenis tanah pada
  `land_plots.soil_type`, bukan rasio tunggal untuk semua jenis tanah.

### 3.5 `vpd_approx` — Catatan (Bukan Asumsi, Tapi Perubahan Metode)

Skrip pelatihan mengisi `vpd_approx` dengan nilai FLUXNET asli (jika ada) atau
placeholder bernoise (`1.0 + noise`) jika tidak ada. Implementasi live memakai
**persamaan Tetens** (rumus meteorologi baku untuk defisit tekanan uap),
dihitung deterministik dari suhu dan kelembapan udara riil:

```
es = 0.6108 × exp(17.27 × T / (T + 237.3))   # tekanan uap jenuh (kPa)
ea = es × RH / 100                            # tekanan uap aktual (kPa)
VPD = max(0, es − ea)
```

Ini **bukan kompromi** melainkan **perbaikan** dibanding placeholder bernoise
pada skrip pelatihan — dicatat di sini agar transparan bahwa nilai VPD yang
dipakai saat inferensi dihitung dengan metode berbeda (lebih valid secara
meteorologis) dari salah satu variabel yang dipakai saat pelatihan.

## 4. Traceability

Setiap baris pada tabel `forecast_predictions` menyimpan kolom
`assumptions_version` (nilai saat ini: `v1-fixed-baseline-2026-07-30`) dan
`feature_snapshot` (JSON lengkap 36 fitur yang benar-benar dipakai untuk
prediksi tsb). Jika konstanta pada §3 diperbarui di kemudian hari, **naikkan
`ForecastFeatureService::ASSUMPTIONS_VERSION`** agar prediksi lama dan baru
dapat dibedakan secara analitis, dan jangan menimpa histori lama.

## 5. Cara Mengutip Hasil Forecasting Ini pada Naskah Ilmiah

Rekomendasi kalimat baku:

> "Estimasi forecasting [target] dihasilkan model [SVM/XGBoost/LSTM] AgriSense
> dengan input fitur karbon organik tanah memakai asumsi baseline regional
> tetap sebesar 6000 gC/m² (lihat dokumentasi asumsi model), karena
> instrumentasi sensor saat ini belum mencakup pengukuran karbon organik tanah
> langsung. Angka ini merepresentasikan estimasi sensitivitas di bawah asumsi
> tersebut, bukan hasil yang telah divalidasi dengan pengukuran laboratorium
> tanah per lahan."
