"""
=============================================================
AUDIT MENDALAM TAHAP 2: Deteksi Semua Potensi Masalah
=============================================================
Checklist:
1. Data Quality: NaN, Inf, Outlier, Distribusi Miring
2. Korelasi: Fitur redundan, multikolinearitas
3. Target Leakage: Apakah fitur "bocor" ke target
4. Temporal: Continuity, Stationarity
5. Scale: Apakah fitur perlu normalisasi
6. Kompatibilitas: Cocok dgn scaler/model lama?
"""
import pandas as pd
import numpy as np
import os, json

BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
DATA_FILE = os.path.join(BASE_DIR, "fluxnet_indonesia_32features.csv")

df = pd.read_csv(DATA_FILE)

FEATURE_COLS = [
    'suhu_udara', 'kelembapan_udara', 'tekanan_hpa', 'cahaya_lux',
    'kelembapan_tanah', 'suhu_tanah', 'ph_tanah', 'tvoc_ppb',
    'n_mg_kg', 'p_mg_kg', 'k_mg_kg',
    'epsilon', 'fapar', 'par',
    't_scalar', 'w_scalar', 'c_scalar',
    'gpp', 'reco', 'npp',
    'soc_baseline_gC_m2', 'c_biomass_acc', 'c_current', 'c_max',
    'elapsed_hours', 'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'is_daytime', 'is_cabai', 'has_full_data'
]

TARGET_COLS = ['target_co2_ppm', 'target_nee_agrisense',
               'target_carbon_potential_score',
               'target_kelembapan_tanah', 'target_ph_tanah']

findings = []  # (severity, category, detail)

print("=" * 70)
print("AUDIT MENDALAM: Deteksi Masalah Dataset Tahap 2")
print(f"Total baris: {len(df)}, Kolom: {len(df.columns)}")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════
# 1. DATA QUALITY
# ═══════════════════════════════════════════════════════════════
print("\n[1] DATA QUALITY")

# 1a. NaN / Inf
nan_counts = df[FEATURE_COLS + TARGET_COLS].isna().sum()
inf_mask = np.isinf(df[FEATURE_COLS + TARGET_COLS].select_dtypes(include=[np.number]))
inf_counts = inf_mask.sum()

has_nan = nan_counts[nan_counts > 0]
has_inf = inf_counts[inf_counts > 0]

if len(has_nan) > 0:
    findings.append(("MERAH", "Data Quality", f"Kolom dengan NaN: {dict(has_nan)}"))
    print(f"  [MERAH] NaN ditemukan: {dict(has_nan)}")
else:
    print("  [OK] Tidak ada NaN")

if len(has_inf) > 0:
    findings.append(("MERAH", "Data Quality", f"Kolom dengan Inf: {dict(has_inf)}"))
    print(f"  [MERAH] Inf ditemukan: {dict(has_inf)}")
else:
    print("  [OK] Tidak ada Infinity")

# 1b. Konstanta (variasi nol)
for col in FEATURE_COLS:
    std = df[col].std()
    if std == 0 or (std < 1e-10):
        findings.append(("MERAH", "Data Quality",
                        f"Kolom '{col}' adalah KONSTANTA (std={std:.2e}). "
                        f"Model tidak bisa belajar dari fitur ini."))
        print(f"  [MERAH] '{col}' adalah konstanta (std={std:.2e})")

# 1c. Hampir konstanta (very low variance)
for col in FEATURE_COLS:
    nunique = df[col].nunique()
    if 1 < nunique <= 3:
        findings.append(("KUNING", "Data Quality",
                        f"Kolom '{col}' hanya punya {nunique} nilai unik. "
                        f"Mungkin terlalu sedikit variasi."))
        print(f"  [KUNING] '{col}' hanya {nunique} nilai unik")

# 1d. Outlier (> 4 std dari mean)
print("\n  Outlier check (> 4 std):")
for col in FEATURE_COLS:
    if df[col].std() > 0:
        z = np.abs((df[col] - df[col].mean()) / df[col].std())
        n_outlier = (z > 4).sum()
        if n_outlier > 0:
            pct = n_outlier / len(df) * 100
            if pct > 5:
                findings.append(("KUNING", "Outlier",
                                f"'{col}': {n_outlier} outlier ({pct:.1f}%)"))
                print(f"    [KUNING] {col}: {n_outlier} outlier ({pct:.1f}%)")

# ═══════════════════════════════════════════════════════════════
# 2. TARGET LEAKAGE (Kebocoran Data)
# ═══════════════════════════════════════════════════════════════
print("\n[2] TARGET LEAKAGE CHECK")
print("  Mengecek apakah ada fitur yang identik/hampir identik dengan target...")

for tcol in TARGET_COLS:
    for fcol in FEATURE_COLS:
        if df[tcol].std() > 0 and df[fcol].std() > 0:
            corr = df[tcol].corr(df[fcol])
            if abs(corr) > 0.99:
                findings.append(("MERAH", "Target Leakage",
                    f"KRITIS: Fitur '{fcol}' berkorelasi {corr:.4f} dengan "
                    f"target '{tcol}'. Model akan 'curang' dan tidak generalize!"))
                print(f"  [MERAH] LEAKAGE: '{fcol}' <-> '{tcol}' (corr={corr:.4f})")

# Cek khusus: kelembapan_tanah (fitur) vs target_kelembapan_tanah
corr_sm = df['kelembapan_tanah'].corr(df['target_kelembapan_tanah'])
corr_ph = df['ph_tanah'].corr(df['target_ph_tanah'])
print(f"  kelembapan_tanah (fitur) vs target: corr = {corr_sm:.4f}")
print(f"  ph_tanah (fitur) vs target: corr = {corr_ph:.4f}")

if abs(corr_sm) > 0.99:
    findings.append(("MERAH", "Target Leakage",
        f"KRITIS: 'kelembapan_tanah' fitur dan target IDENTIK (corr={corr_sm:.4f})! "
        f"Model akan mendapat skor R2=1.0 palsu. HARUS diperbaiki dengan "
        f"menggunakan nilai SHIFTED (t+1) sebagai target."))
    print(f"  [MERAH] kelembapan_tanah: FITUR = TARGET (IDENTIK!)")

if abs(corr_ph) > 0.99:
    findings.append(("MERAH", "Target Leakage",
        f"KRITIS: 'ph_tanah' fitur dan target IDENTIK (corr={corr_ph:.4f})! "
        f"Sama seperti di atas. HARUS diperbaiki."))
    print(f"  [MERAH] ph_tanah: FITUR = TARGET (IDENTIK!)")

# ═══════════════════════════════════════════════════════════════
# 3. MULTIKOLINEARITAS (Fitur Redundan)
# ═══════════════════════════════════════════════════════════════
print("\n[3] MULTIKOLINEARITAS (Fitur yang terlalu mirip satu sama lain)")
high_corr_pairs = []
numeric_features = [c for c in FEATURE_COLS if df[c].std() > 0]
corr_matrix = df[numeric_features].corr()

for i in range(len(numeric_features)):
    for j in range(i+1, len(numeric_features)):
        c = abs(corr_matrix.iloc[i, j])
        if c > 0.95:
            pair = (numeric_features[i], numeric_features[j], round(c, 4))
            high_corr_pairs.append(pair)
            findings.append(("KUNING", "Multikolinearitas",
                f"'{pair[0]}' dan '{pair[1]}' berkorelasi {pair[2]}. "
                f"Salah satu mungkin redundan."))

if high_corr_pairs:
    for a, b, c in high_corr_pairs:
        print(f"  [KUNING] {a} <-> {b} (corr={c})")
else:
    print("  [OK] Tidak ada pasangan fitur dengan korelasi > 0.95")

# ═══════════════════════════════════════════════════════════════
# 4. SCALE MISMATCH
# ═══════════════════════════════════════════════════════════════
print("\n[4] SCALE MISMATCH (Perbedaan skala antar fitur)")
scales = {}
for col in FEATURE_COLS:
    rng = df[col].max() - df[col].min()
    scales[col] = rng

max_scale = max(scales.values())
min_scale = min(v for v in scales.values() if v > 0)
ratio = max_scale / min_scale if min_scale > 0 else float('inf')

print(f"  Fitur dgn range terbesar: {max(scales, key=scales.get)} "
      f"(range={max_scale:.0f})")
print(f"  Fitur dgn range terkecil: {min(scales, key=lambda k: scales[k] if scales[k]>0 else 999999)} "
      f"(range={min_scale:.4f})")
print(f"  Rasio max/min: {ratio:.0f}x")

if ratio > 10000:
    findings.append(("KUNING", "Scale",
        f"Rasio skala antar fitur = {ratio:.0f}x. "
        f"WAJIB normalisasi (StandardScaler/MinMaxScaler) sebelum training. "
        f"Ini sudah dilakukan oleh scaler di pipeline training."))
    print(f"  [KUNING] Rasio {ratio:.0f}x -> normalisasi WAJIB")

# ═══════════════════════════════════════════════════════════════
# 5. CARBON POTENTIAL SCORE (CPS) VARIASI
# ═══════════════════════════════════════════════════════════════
print("\n[5] ANALISIS TARGET: Carbon Potential Score (CPS)")
cps = df['target_carbon_potential_score']
print(f"  Min={cps.min():.6f}, Max={cps.max():.6f}, Std={cps.std():.6f}")

if cps.std() < 0.01:
    findings.append(("MERAH", "Target CPS",
        f"CPS hampir KONSTANTA (std={cps.std():.6f}). "
        f"Model tidak akan bisa memprediksi CPS karena tidak ada variasi. "
        f"Penyebab: c_biomass_acc sangat kecil dibanding soc_baseline (5850)."))
    print(f"  [MERAH] CPS hampir tidak bervariasi! Std hanya {cps.std():.6f}")

# ═══════════════════════════════════════════════════════════════
# 6. TEMPORAL CONTINUITY
# ═══════════════════════════════════════════════════════════════
print("\n[6] TEMPORAL CONTINUITY (Untuk LSTM)")
elapsed = df['elapsed_hours']
gaps = elapsed.diff().dropna()
normal_gap = 0.5  # Setiap 30 menit
abnormal = gaps[gaps != normal_gap]

if len(abnormal) > 0:
    max_gap = gaps.max()
    n_gaps = len(abnormal)
    findings.append(("KUNING", "Temporal",
        f"{n_gaps} gap non-standar ditemukan. Gap terbesar = {max_gap:.1f} jam. "
        f"LSTM mungkin perlu dilatih dengan perhatian khusus pada gap ini."))
    print(f"  [KUNING] {n_gaps} gap non-standar, gap terbesar = {max_gap:.1f} jam")
else:
    print("  [OK] Semua interval konsisten 0.5 jam")

# ═══════════════════════════════════════════════════════════════
# 7. KOMPATIBILITAS DENGAN SCALER LAMA
# ═══════════════════════════════════════════════════════════════
print("\n[7] KOMPATIBILITAS DENGAN MODEL LAMA")
artifacts_dir = os.path.join(BASE_DIR, "artifacts", "sintetik_90")
if os.path.exists(artifacts_dir):
    import joblib
    scaler_files = [f for f in os.listdir(artifacts_dir) if 'scaler_X' in f]
    if scaler_files:
        print(f"  Scaler lama ditemukan: {scaler_files}")
        findings.append(("KUNING", "Kompatibilitas",
            f"Scaler lama ({scaler_files}) dilatih dengan 90 baris data sintetik. "
            f"HARUS dilatih ulang dengan data baru 26K baris ini. "
            f"Jika tidak, prediksi akan SALAH karena distribusi data berbeda."))
        print(f"  [KUNING] Scaler WAJIB dilatih ulang")
    else:
        print("  Tidak ada scaler lama")
else:
    print(f"  Folder artifacts tidak ditemukan di {artifacts_dir}")

# ═══════════════════════════════════════════════════════════════
# RINGKASAN
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("RINGKASAN TEMUAN AUDIT")
print("=" * 70)

merah = [f for f in findings if f[0] == "MERAH"]
kuning = [f for f in findings if f[0] == "KUNING"]

print(f"\nTotal temuan: {len(findings)}")
print(f"  MERAH (HARUS diperbaiki sebelum training): {len(merah)}")
print(f"  KUNING (Perlu perhatian tapi bisa ditangani): {len(kuning)}")

if merah:
    print("\n--- TEMUAN MERAH (KRITIS) ---")
    for i, (sev, cat, detail) in enumerate(merah, 1):
        print(f"\n  {i}. [{cat}]")
        print(f"     {detail}")

if kuning:
    print("\n--- TEMUAN KUNING (PERINGATAN) ---")
    for i, (sev, cat, detail) in enumerate(kuning, 1):
        print(f"\n  {i}. [{cat}]")
        print(f"     {detail}")

if not findings:
    print("\n  SEMPURNA! Tidak ada masalah yang ditemukan.")

# Simpan temuan
audit_result = {
    'total_findings': len(findings),
    'critical': len(merah),
    'warnings': len(kuning),
    'details': [{'severity': s, 'category': c, 'detail': d} for s, c, d in findings]
}
with open(os.path.join(BASE_DIR, "tahap2_deep_audit.json"), 'w') as f:
    json.dump(audit_result, f, indent=2)

print(f"\nAudit disimpan ke: tahap2_deep_audit.json")
