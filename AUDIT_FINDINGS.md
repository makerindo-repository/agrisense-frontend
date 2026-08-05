# 🔍 AGRISENSE — COMPREHENSIVE AUDIT FINDINGS

**Tanggal Audit:** 2026-07-04
**Model:** Claude Opus 4.8 (max effort)
**Scope:** Full-stack (React 19 + TypeScript frontend, Laravel 11 backend)
**Metode:** Static analysis — 20+ file dibaca menyeluruh, pola risiko di-grep lintas codebase, verifikasi git & config.

---

## 📊 RINGKASAN EKSEKUTIF

| Severity | Jumlah | Arti |
|----------|--------|------|
| 🔴 CRITICAL | **0** | — |
| 🟠 HIGH | **2** | Perbaiki minggu ini |
| 🟡 MEDIUM | **9** | Perbaiki sprint ini |
| 🟢 LOW | **6** | Backlog |
| **TOTAL** | **17** | |

### Penilaian Umum
**Postur keamanan AgriSense TERGOLONG BAIK.** Tidak ada temuan CRITICAL. Codebase menunjukkan hardening yang matang: tidak ada hardcoded secret, `.env` ter-gitignore, query pakai Eloquent (aman dari SQLi), route diproteksi `auth:sanctum` + role middleware + throttling, CORS fail-secure, session encrypted. Sebagian besar temuan bersifat **robustness, performa, & kualitas kode**, bukan lubang keamanan fatal.

---

## 🔧 FIX LOG (2026-07-04) — Diverifikasi via `php artisan test`

Test dijalankan pada SQLite in-memory (tak menyentuh data asli). **Baseline menemukan 2 bug nyata → diperbaiki; +5 test regresi ditambahkan. Total 100 test, 0 gagal.**

| # | Bug | Status | Bukti |
|---|-----|--------|-------|
| **B-0** | `LandPlot@store` crash **500** — kolom `latitude/longitude/area_hectare` NOT NULL padahal validasi `nullable` (ditemukan saat menjalankan test) | ✅ **FIXED** | migration `2026_07_04_000001_make_land_plot_coords_nullable.php`; test `land_plot_minimal_payload` & `land_plot_xss_in_name` kini hijau |
| **M-2** | Komoditi sub-payload skalar → TypeError **500** (+ ditemukan lubang saudara: elemen `hama_penyakit` skalar) | ✅ **FIXED** | rule `array` di `validateSubPayloads()`; 3 test regresi hijau (int, JSON-string, array-of-scalar) |
| **M-1** | Bocor `$e->getMessage()` ke client (`updateSettings` + `sendTestEmail`) | ✅ **FIXED** | pesan generik + detail di-`Log::error`; test `send_test_email_hides_internal_exception` hijau |
| **M-3** | `node_id` AiInsight `required` → array memicu **500**; tak konsisten dgn `getHistory` | ✅ **FIXED** | rule string-atau-integer via helper `nodeIdRules()`, dipakai kedua endpoint; 2 regresi hijau (array→422, int→OK) |
| **H-1** | `JSON.parse(localStorage)` tanpa guard (App.tsx ×2, ProfileView, AboutView) → white-screen tak terpulihkan bila data `agrisense_user` korup | ✅ **FIXED** | helper `src/lib/storage.ts::getStoredUser()` (try/catch + clear sesi) di 4 lokasi; `tsc --noEmit` lolos |
| **B-0b** | `Garden@store` crash 500 — `gardens.latitude/longitude/area_hectare` NOT NULL padahal validasi `nullable` (kembaran B-0, ditemukan via feature test) | ✅ **FIXED** | migration `2026_07_04_000002_make_garden_coords_nullable.php`; test `garden_create_without_optional_geo_succeeds` hijau |
| **L-2** | Panjang password minimum lemah (6) | ✅ **FIXED** | `min:8` di createUser & changePassword (backend) + ProfileView (frontend); test `create_user_rejects_short_password` hijau |
| **L-3** | Admin bisa ubah peran sendiri → risiko lockout admin terakhir | ✅ **FIXED** | guard 403 di `updateUser`; 2 test hijau (tolak ubah role sendiri, izinkan ubah nama) |
| **M-6** | `/readings` cap 500 diam-diam memotong permintaan frontend (1500) → data monitoring hilang | ✅ **FIXED** | cap dinaikkan ke 1500 (sinkron App.tsx); test `readings_limit_returns_more_than_old_cap` (505 row) hijau |
| **M-4** | Tak ada index `iot_readings(device_id, reading_time)` & `(reading_time)` → query time-series lambat saat data membesar | ✅ **FIXED** | migration `2026_07_04_000003_add_iot_readings_indexes.php` (2 index); ter-apply bersih di suite |

**Total test backend: 114, 0 gagal (198 assertions). Frontend: `tsc --noEmit` bersih.**
**Cakupan baru:** `FeatureCrudRbacTest` (12 test) — Planting lifecycle, matriks peran **operator** (dulu tak teruji), User CRUD, kunci L-2/L-3.

**Sisa belum ditangani:** M-5 (`any`), M-7 (test frontend), + LOW tersisa (aiEngineKey di DB, paket `mqtt` dead, cleanup `.env.test`, console.log, H-1b JSON.parse QR/impor).

**🆕 Temuan baru saat fix H-1:** `JSON.parse` tanpa guard di jalur input tak-tepercaya — `NodesView.tsx:560` (hasil scan QR) & `:619` (impor file), plus beberapa render polygon peta (`MapView`, `LeafletDrawMap`, `NodeMap`, dll). Scan QR / file non-JSON → komponen crash. **Robustness MEDIUM (H-1b)**, belum digarap.

---

## ✅ HAL YANG SUDAH BENAR (Positif — Pertahankan)

| Area | Bukti |
|------|-------|
| **Secrets** | `.env` & `backend/.env` TIDAK ter-commit (hanya `.env.example` berisi placeholder). Verified via `git ls-files`. |
| **SQL Injection** | Semua query pakai Eloquent/Query Builder. 3 `selectRaw` semuanya SQL statis (agregasi), tanpa interpolasi input user. |
| **Mass Assignment** | Semua model pakai `$fillable` eksplisit (bukan `$guarded=[]`). `device_status`, `last_seen_at` sengaja non-fillable. |
| **XSS (Frontend)** | NOL penggunaan `dangerouslySetInnerHTML`/`innerHTML`. React auto-escape aktif. Backend tambah `strip_tags()` di Komoditi. |
| **CORS** | `config/cors.php` fail-secure — origin kosong = tolak semua cross-origin. |
| **Auth & Routing** | `routes/api.php` rapi: throttle login 5/menit, IoT dual-axis, role middleware konsisten. Google token diverifikasi audience (anti-hijack). |
| **File Upload** | Validasi berlapis: MIME asli via `finfo`, cek dimensi `getimagesizefromstring`, whitelist ekstensi, batas ukuran. |
| **Session** | `.env.example`: `SESSION_ENCRYPT=true`, `SESSION_SECURE_COOKIE=true`, `SAME_SITE=lax`, `BCRYPT_ROUNDS=12`, `APP_DEBUG=false`. |
| **Testing (Backend)** | 95 test function, termasuk 33 edge-case hunt + 33 unit test service kalkulasi karbon. |

---

## 🟠 HIGH (Perbaiki Minggu Ini)

### H-1 | FRONTEND | `JSON.parse(localStorage)` tanpa guard → white-screen crash
**Lokasi:** `src/App.tsx:147-150` dan `src/App.tsx:154-161` (juga `ProfileView.tsx:51`, `AboutView.tsx:55`)
```tsx
const [user, setUser] = useState<any | null>(() => {
  const saved = localStorage.getItem('agrisense_user');
  return saved ? JSON.parse(saved) : null;   // ← throw jika korup
});
```
**Masalah:** Kedua `useState` initializer memanggil `JSON.parse` tanpa `try/catch`. Jika `agrisense_user` korup (partial write, tampering, quota error, ekstensi browser), `JSON.parse` melempar error saat render awal → **seluruh app blank (white screen), dan tidak bisa pulih** karena error terulang tiap reload. User terkunci total tanpa cara logout.
**Fix:** Bungkus dengan helper aman:
```tsx
const safeParseUser = () => {
  try { const s = localStorage.getItem('agrisense_user'); return s ? JSON.parse(s) : null; }
  catch { localStorage.removeItem('agrisense_user'); localStorage.removeItem('agrisense_token'); return null; }
};
```

### H-2 | SECURITY | Endpoint ingestion IoT tanpa autentikasi (hanya device_code)
**Lokasi:** `routes/api.php:29` → `IotReadingController@storeReading` (`IotReadingController.php:84`)
**Masalah:** `POST /iot/agrisense/readings` bersifat **publik** (di luar `auth:sanctum`), hanya dilindungi throttle + syarat device sudah terdaftar (403 bila belum). Namun `device_code` **bukan rahasia** — bisa tercetak di perangkat, tampil di UI, atau ditebak. Siapa pun yang tahu satu `device_code` valid dapat menyuntik pembacaan palsu (data poisoning → false alert, analitik & AI Insight melenceng). Dibatasi throttle 20/menit/device, tapi tetap tidak terautentikasi.
**Fix:** Tambahkan HMAC signature per-device (shared secret di device + backend) atau API key per-device pada header, verifikasi sebelum `create()`. Jika keterbukaan ini memang keputusan desain sadar, dokumentasikan sebagai accepted risk.
> **✅ ACCEPTED BY DESIGN (keputusan pemilik, 2026-07-04):** Node fisik sudah terpasang di lokasi nyata; alur pengiriman data dari node TIDAK diubah. Risiko diterima. Termitigasi oleh pra-registrasi device + throttle 20/menit/device. Tidak ada perubahan kode pada endpoint ini.

---

## 🟡 MEDIUM (Perbaiki Sprint Ini)

### M-1 | BACKEND | Pesan error internal bocor ke client
**Lokasi:** `SystemController.php:255` (`'Backend Error: '.$e->getMessage()`) & `SystemController.php:487` (`'Gagal mengirim email: '.$e->getMessage()`)
**Masalah:** Detail exception internal (konfigurasi SMTP, error DB, path) dikembalikan ke response. Information disclosure. (Endpoint admin-only, jadi eksposur terbatas, tapi tetap bocor.)
**Fix:** Log detail via `Log::error`, kembalikan pesan generik ke client: `'Terjadi kesalahan pada server.'`

### M-2 | BACKEND | Sub-payload non-array → TypeError 500 (bukan 422)
**Lokasi:** `KomoditiController.php:96-99, 117-123, 126-141` + `validateSubPayloads()` di `:302-390`
**Masalah:** `validateSubPayloads` tidak punya rule `'lingkungan' => 'array'` (hanya `hama_penyakit` & `rekomendasi` yang punya). Payload `{"lingkungan": 123}` lolos validasi, lalu `array_merge(['komoditi_id'=>x], 123)` melempar **TypeError → 500**. `lingkungan`, `sensor`, `fase_tanam`, `nutrisi` tidak dijaga `is_array()` sebelum `array_merge` (beda dengan `hama_penyakit` yang dijaga).
**Fix:** Tambah `'lingkungan'=>'nullable|array'` dll di validator, DAN guard `is_array($data)` sebelum tiap `array_merge`.

### M-3 | BACKEND | Validasi `node_id` dilonggarkan & tidak konsisten
**Lokasi:** `AiInsightController.php:43` (`'node_id' => 'required'`) vs `AiInsightController.php:763` (`getHistory`: `'node_id' => 'required|string'`)
**Masalah:** Perubahan terbaru (uncommitted) melepas constraint `|string`. Kini `node_id` bisa array/tipe apa pun → `Device::where('device_code', [array])` berperilaku aneh (diselamatkan try/catch jadi rule-based, tapi menyembunyikan bug). Tidak konsisten dengan `getHistory`.
**Fix:** Kembalikan ke `'required|string'` untuk konsistensi & type-safety.

### M-4 | PERFORMANCE | Tidak ada composite index di `iot_readings(device_id, reading_time)`
**Lokasi:** `database/migrations/2026_04_14_095100_create_iot_readings_table.php` — `reading_time` (line 18) tanpa index; hanya FK `device_id` yang auto-index.
**Masalah:** Tabel time-series ini paling sering di-query dengan pola `WHERE device_id=? AND reading_time>=? ORDER BY reading_time DESC` (di AiInsight, IotReading, System). Tanpa composite index → filesort + scan yang memburuk seiring jutaan baris IoT.
**Fix:** Migration baru: `$table->index(['device_id', 'reading_time']);`

### M-5 | FRONTEND | Pemakaian `any` masif merusak type-safety
**Lokasi:** 205 kemunculan di 29 file (terparah: `AreaFormModal.tsx` 31, `App.tsx` 16, `MapView.tsx` 15, `NodesView.tsx` 15, `DashboardView.tsx` 14)
**Masalah:** Script lint hanya `tsc --noEmit`; `any` melewati semua pengecekan tipe → bug tipe lolos ke runtime (mis. `latest.id.toString()` di App.tsx bisa undefined).
**Fix:** Ganti `any` bertahap dengan interface (sudah ada `src/types/index.ts`). Prioritaskan tipe payload API & props.

### M-6 | INTEGRATION | Mismatch limit: frontend minta 1500, backend cap 500
**Lokasi:** `src/App.tsx:247` (`api.get('/readings?limit=1500')`) vs `IotReadingController.php:32` (`min((int)$limit, 500)`)
**Masalah:** Frontend mengira menerima 1500 reading, backend diam-diam batasi 500. Chart/dashboard/notifikasi kehilangan data tanpa peringatan.
**Fix:** Samakan ekspektasi — naikkan cap backend bila memang perlu, atau turunkan request frontend + paginasi.

### M-7 | TESTING | Nol test frontend; controller terkompleks minim test
**Lokasi:** Tidak ada Jest/Vitest/RTL di `package.json`; `AiInsightControllerTest.php` hanya 1 test untuk controller 790 baris.
**Masalah:** Zero komponen/E2E test di React. `AiInsightController` (multi-provider fallback Gemini→Groq→OpenRouter→rule-based) nyaris tak teruji.
**Fix:** Tambah Vitest + React Testing Library untuk alur kritikal (login, polling, form). Perluas test AiInsight (mock tiap provider, cek fallback chain).

### M-8 | SECURITY | Token JWT disimpan di `localStorage` (rawan XSS-exfiltration)
**Lokasi:** `src/lib/api.ts:16`, `src/App.tsx:382-383, 411-412`
**Masalah:** Token Sanctum di `localStorage` bisa dibaca JavaScript mana pun. Saat ini risiko rendah karena tidak ada sink XSS, tapi satu XSS = pencurian token. Tradeoff SPA yang umum.
**Fix (opsional/hardening):** Pertimbangkan httpOnly cookie + Sanctum SPA mode. Minimal: pertahankan disiplin nol-`dangerouslySetInnerHTML`.

### M-9 | SECURITY | Google login auto-provision akun untuk SEMUA akun Google
**Lokasi:** `AuthController.php:121-129`
**Masalah:** `googleLogin` membuat user baru (role `viewer`) untuk email Google apa pun. Untuk tool riset internal, registrasi terbuka mungkin tak diinginkan (siapa pun sedunia bisa punya akun viewer).
**Fix:** Terapkan allowlist domain email (mis. `@unikom.ac.id`) atau mode invite-only sebelum `User::create`.

---

## 🟢 LOW (Backlog)

### L-1 | FRONTEND | 47 `console.log`/error di 17 file
**Lokasi:** al. `src/App.tsx:345` (`"Background service started..."`), NodesView (7), DashboardView (3), UsersView (3)
**Fix:** Hapus log produksi; pakai flag `import.meta.env.DEV` bila perlu debug.

### L-2 | SECURITY | Panjang password minimum lemah (6)
**Lokasi:** `SystemController.php:92` (createUser), `:411` (changePassword), `ProfileView.tsx:96`
**Fix:** Naikkan ke minimal 8 + pertimbangkan cek kompleksitas.

### L-3 | BACKEND | Admin bisa ubah role sendiri → risiko lockout admin terakhir
**Lokasi:** `SystemController.php:110-125` (updateUser). `deleteUser` sudah cegah hapus-diri (`:133`), tapi `updateUser` tidak cegah demote-diri.
**Fix:** Tolak perubahan role bila `$id === auth()->id()` atau bila akan menghapus admin terakhir.

### L-4 | BACKEND | `aiEngineKey` disimpan di DB & dikirim ke frontend admin
**Lokasi:** `SystemController.php:159, 175` (getSettings). AiInsight sudah baca `config('gemini.api_key')` dari `.env`, jadi salinan DB redundant.
**Fix:** Hapus `aiEngineKey` dari settings DB; andalkan `.env` backend saja (komentar di `App.tsx:219` sudah mengakui ini).

### L-5 | FRONTEND | Paket `mqtt` kemungkinan tak terpakai (dead dependency)
**Lokasi:** `package.json:39` (`mqtt ^5.15.1`). Tidak ada `mqtt.connect()` di `src/` (hanya string config & keyword log).
**Fix:** Verifikasi; hapus dari dependency bila memang tak dipakai (kurangi bundle & attack surface).

### L-6 | FRONTEND | `JSON.parse(localStorage)` tanpa guard di cleanup ProfileView
**Lokasi:** `src/ProfileView.tsx:51` (dalam useEffect cleanup)
**Fix:** Sama seperti H-1 — bungkus try/catch (severity lebih rendah karena di cleanup).

---

## 🎯 REKOMENDASI PRIORITAS

| Urutan | Aksi | Estimasi |
|--------|------|----------|
| 1️⃣ | **H-1** — Amankan semua `JSON.parse(localStorage)` (helper `safeParseUser`) | 30 menit |
| 2️⃣ | **M-2, M-3** — Guard sub-payload Komoditi + kembalikan `node_id\|string` | 1 jam |
| 3️⃣ | **M-1** — Hilangkan bocoran `$e->getMessage()` ke client | 30 menit |
| 4️⃣ | **M-4** — Migration composite index `iot_readings` | 20 menit |
| 5️⃣ | **M-6** — Selaraskan limit readings 1500 vs 500 | 20 menit |
| 6️⃣ | **H-2 / M-9** — Keputusan desain: auth ingestion IoT & allowlist Google | diskusi tim |
| 7️⃣ | **M-5, M-7** — Kurangi `any` + tambah test frontend (bertahap) | ongoing |
| 8️⃣ | **LOW** — console.log, password length, dll | saat menyentuh file terkait |

---

## 📌 CATATAN METODOLOGI
- File yang dibaca penuh: `api.ts`, `App.tsx`, `ProfileView.tsx`, `LogsView.tsx`, `routes/api.php`, `RoleAccess.php`, `AuthController`, `SystemController`, `IotReadingController`, `KomoditiController`, `AboutCardController`, `AiInsightController`, `NodeController`, `GardenController`, `cors.php`, `.env.example`, model-model, migrasi iot_readings.
- Verifikasi git: `.env` tidak tracked ✓
- Belum dijalankan: `npm audit` / `composer audit` (butuh env runtime) — disarankan sebagai langkah lanjutan otomatis.
- Tidak ada temuan yang dibuat-buat; profil severity condong ke MEDIUM/LOW karena codebase memang sudah di-hardening dengan baik (terlihat dari commit QC Edge Hunt terbaru).
