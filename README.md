<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AgriSense - Smart Agriculture IoT Platform

AgriSense adalah platform monitoring IoT dan intelijen klimatologi untuk pertanian presisi. Sistem ini mengintegrasikan sensor IoT, AI forecasting, dan analitik karbon untuk optimasi pertanian secara real-time.

---

## Persiapan Cepat

### Prasyarat
- **Node.js** (v18+)
- **PHP** (v8.1+) & **Composer**
- **MySQL/MariaDB**

### Cara Instalasi (Rekomendasi)

Gunakan script automasi untuk setup cepat:

```powershell
# 1. Clone repository
git clone <repository-url>
cd AgriSense-UNIKOM-V1.0

# 2. Setup Environment (.env)
copy .env.example .env
cd backend
copy .env.example .env
cd ..

# 3. Instalasi Dependensi
npm install
cd backend
composer install
cd ..

# 4. Jalankan Server (Backend + Frontend)
.\start-dev.ps1
```

Script `start-dev.ps1` akan otomatis menjalankan:
- ✅ Laravel Backend (`http://localhost:8000`)
- ✅ Vite Frontend (`http://localhost:5173`)
- ✅ Health Check sistem

---

## Struktur Proyek

```text
AgriSense-UNIKOM-V1.0/
├── backend/                 # API (Laravel Framework)
│   ├── app/                 # Logic, Models, & Services
│   ├── routes/api.php       # Endpoint API
│   └── ...
├── src/                     # UI (React + Vite)
│   ├── components/          # Reusable UI
│   ├── pages/               # View/Halaman Utama
│   └── ...
├── docs/                    # Dokumentasi & AI Model Bundle
├── TROUBLESHOOTING.md       # Panduan penanganan error
├── AUDIT-REPORT.md          # Analisis teknis sistem
├── check-api.ps1            # Script cek kesehatan API
└── start-dev.ps1            # Script peluncur server dev
```

---

## Endpoint API Utama

### Akses Publik
- `POST /api/login` - Autentikasi User
- `POST /api/auth/google` - Login via Google OAuth

### Akses Terproteksi (Bearer Token)
- `GET /api/dashboard/summary` - Ringkasan data dashboard
- `GET /api/nodes` - Daftar perangkat IoT
- `GET /api/readings` - Riwayat data sensor
- `GET /api/model-performance` - Metrik performa model AI
- `GET /api/forecasts` - Data prediksi (Forecasting)
- `GET /api/cci` - Analitik Carbon Flux

---

## Penanganan Masalah (Troubleshooting)

### API 404 / Model Performance Tidak Muncul
1. Jalankan `.\check-api.ps1` untuk mendiagnosa koneksi.
2. Pastikan file `.env` di folder `backend` sudah terkonfigurasi dengan database yang benar.
3. Pastikan `VITE_API_URL` di folder root sudah mengarah ke `http://localhost:8000/api`.

### Error Chart atau Favicon
Jika Anda mengalami masalah rendering chart atau icon yang hilang, pastikan Anda menggunakan versi terbaru dan telah menjalankan `npm install` ulang.

---

## Akun Akses Default
- **Email:** `admin@agrisense.com`
- **Password:** `password`

---

##  Tim Pengembang
**Universitas Komputer Indonesia (UNIKOM)**
*Research & Development Team for Precision Agriculture*

---

**Versi:** 1.0.1  
**Terakhir Diperbarui:** 11 Mei 2026


---

## Troubleshooting Local Development

### Backend serve ke port lain (bukan 8000)

Vite di-config proxy ke `http://localhost:8000` (`vite.config.ts`). Kalau `php artisan serve` ke-throw ke port 8001 otomatis, port 8000 sudah dipakai proses lain. Bersihkan dulu:

```powershell
# Windows: cek proses yang pakai port 8000
netstat -ano | findstr :8000

# Bunuh proses (PID dari kolom terakhir output di atas)
taskkill /PID <pid> /F

# Jalankan ulang
php artisan serve --port=8000
```

```bash
# Linux / macOS
lsof -i :8000
kill -9 <pid>
php artisan serve --port=8000
```

Kalau Anda memang sengaja jalan di port lain, ubah `vite.config.ts` baris `target: 'http://localhost:8000'` sesuai port-nya, lalu restart `npm run dev`.
