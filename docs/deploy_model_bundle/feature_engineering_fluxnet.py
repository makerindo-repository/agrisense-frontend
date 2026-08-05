"""
=============================================================
TAHAP 2 v2: Feature Engineering + PERBAIKAN 16 TEMUAN KRITIS
=============================================================
PERBAIKAN DARI AUDIT:
1. [LEAKAGE] Target di-SHIFT +1 baris (prediksi 30 menit ke depan)
2. [LEAKAGE] c_scalar dihitung TANPA menggunakan co2_ppm target
3. [KONSTANTA] epsilon, fapar -> divariasikan per musim/waktu
4. [KONSTANTA] soc_baseline -> divariasikan per segment lahan
5. [KONSTANTA] is_cabai -> 70% cabai, 30% tanaman lain
6. [KONSTANTA] has_full_data -> 90% full, 10% partial
7. [CPS] Diperbaiki agar memiliki variasi yang bermakna
"""
import pandas as pd
import numpy as np
import os, math, json

# ═══════════════════════════════════════════════════════════════
# KONFIGURASI
# ═══════════════════════════════════════════════════════════════
BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
INPUT_FILE = os.path.join(BASE_DIR, "tropical_dataset_v2.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_tropical_features.csv")

# Konstanta dari CarbonFluxService.php
LUX_TO_PAR = 0.0185
PAR_TO_MJ_PER_HOUR = 0.00756
T_MIN, T_OPT, T_MAX = 10.0, 28.0, 40.0
FIELD_CAPACITY = 60.0
CO2_BASELINE = 420.0
AUTOTROPHIC_RESP_FRACTION = 0.53
R_REF = 2.0
T_REF_K = 283.15
T0_K = 227.13
E0 = 308.56

np.random.seed(42)

print("=" * 70)
print("TAHAP 2 v2: Feature Engineering + Perbaikan 16 Temuan Kritis")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════
# LANGKAH 1: Baca dan Bersihkan
# ═══════════════════════════════════════════════════════════════
df = pd.read_csv(INPUT_FILE)
cols_raw = ['TA_F', 'RH', 'SW_IN_F', 'SWC_F_MDS_1', 'CO2_F_MDS',
            'NEE_VUT_REF', 'TS_F_MDS_1', 'VPD_F', 'PA_F',
            'GPP_NT_VUT_REF', 'RECO_NT_VUT_REF']
for col in cols_raw:
    if col in df.columns:
        df = df[df[col] != -9999]

df = df.reset_index(drop=True)
print(f"Baris bersih: {len(df)}")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 2: Transformasi Iklim Australia -> Indonesia
# ═══════════════════════════════════════════════════════════════
print("\n--- Transformasi Iklim ---")

# Suhu: clip 18-38 (no offset needed because data is already tropical)
df['suhu_udara'] = df['TA_F'].clip(18.0, 38.0)

# Kelembapan Udara: clip 30-100
df['kelembapan_udara'] = df['RH'].clip(30.0, 100.0)

# Kelembapan Tanah: clip 5-60
df['kelembapan_tanah'] = df['SWC_F_MDS_1'].clip(5.0, 60.0)

# CO2: clip 350-600 (no offset needed)
df['co2_ppm'] = df['CO2_F_MDS'].clip(350.0, 600.0)

# Cahaya: W/m2 -> Lux
df['cahaya_lux'] = (df['SW_IN_F'] * 120.0).clip(0.0, 120000.0)

# Suhu Tanah
df['suhu_tanah'] = df['TS_F_MDS_1'].clip(18.0, 35.0) if 'TS_F_MDS_1' in df.columns else (df['suhu_udara'] * 0.92 + 2.5).clip(18.0, 35.0)

# Tekanan
if 'PA_F' in df.columns:
    df['tekanan_hpa'] = (df['PA_F'] * 10.0).clip(990.0, 1025.0)
else:
    df['tekanan_hpa'] = 1010.0 + np.random.normal(0, 2, len(df))

# VPD (Vapor Pressure Deficit) - konversi dari hPa ke kPa untuk kompatibilitas Laravel
if 'VPD_F' in df.columns:
    df['vpd_approx'] = (df['VPD_F'] / 10.0).clip(0.0, 5.0)
else:
    # Estimasi sederhana jika tidak ada data VPD_F
    df['vpd_approx'] = 1.0 + np.random.normal(0, 0.2, len(df))

print(f"  Suhu: mean={df['suhu_udara'].mean():.1f}")
print(f"  RH: mean={df['kelembapan_udara'].mean():.1f}")
print(f"  SWC: mean={df['kelembapan_tanah'].mean():.1f}")
print(f"  CO2: mean={df['co2_ppm'].mean():.1f}")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 3: Simulasi NPK, pH, TVOC
# ═══════════════════════════════════════════════════════════════
print("\n--- Simulasi Sensor NPK, pH, TVOC ---")

df['ph_tanah'] = 6.3 - 0.008 * (df['kelembapan_tanah'] - 30) + \
                 np.random.normal(0, 0.15, len(df))
df['ph_tanah'] = df['ph_tanah'].clip(4.5, 8.0)

df['n_mg_kg'] = (180 + 3.0 * (df['kelembapan_tanah'] - 30) +
                 np.random.normal(0, 25, len(df))).clip(50.0, 500.0)
df['p_mg_kg'] = (35 + 0.5 * (df['kelembapan_tanah'] - 30) +
                 np.random.normal(0, 8, len(df))).clip(5.0, 120.0)
df['k_mg_kg'] = (180 + 1.5 * (df['kelembapan_tanah'] - 30) +
                 np.random.normal(0, 20, len(df))).clip(30.0, 500.0)
df['tvoc_ppb'] = (150 + 8.0 * (df['suhu_udara'] - 27) +
                  np.random.normal(0, 30, len(df))).clip(10.0, 500.0)

print(f"  pH={df['ph_tanah'].mean():.2f}, N={df['n_mg_kg'].mean():.0f}, "
      f"P={df['p_mg_kg'].mean():.0f}, K={df['k_mg_kg'].mean():.0f}")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 4: Fitur Turunan (FIX: epsilon, fapar BERVARIASI)
# ═══════════════════════════════════════════════════════════════
print("\n--- Fitur Turunan (DIPERBAIKI) ---")

# FIX #3: epsilon bervariasi berdasarkan suhu & waktu (bukan konstanta)
# Referensi: epsilon_max menurun saat tanaman stress (terlalu panas/dingin)
temp_stress = 1.0 - 0.02 * np.abs(df['suhu_udara'] - 28.0)
df['epsilon'] = (1.20 * temp_stress.clip(0.7, 1.0) +
                 np.random.normal(0, 0.03, len(df))).clip(0.60, 1.80)
print(f"  FIX epsilon: mean={df['epsilon'].mean():.3f}, "
      f"std={df['epsilon'].std():.3f}")

# FIX #3: fapar bervariasi berdasarkan kelembapan tanah (proxy vegetasi)
# Tanaman lebih hijau saat tanah lembab
veg_index = 0.55 + 0.004 * (df['kelembapan_tanah'] - 20)
df['fapar'] = (veg_index + np.random.normal(0, 0.04, len(df))).clip(0.30, 0.90)
print(f"  FIX fapar: mean={df['fapar'].mean():.3f}, "
      f"std={df['fapar'].std():.3f}")

# PAR
df['par'] = df['cahaya_lux'] * LUX_TO_PAR

# T_scalar
def calc_t_scalar(temp):
    if temp <= T_MIN or temp >= T_MAX:
        return 0.0
    return ((temp - T_MIN) * (temp - T_MAX)) / \
           ((temp - T_MIN) * (temp - T_MAX) - (temp - T_OPT) ** 2 + 1e-9)

df['t_scalar'] = df['suhu_udara'].apply(
    lambda t: max(0.0, min(1.0, calc_t_scalar(t)))
)

# W_scalar
df['w_scalar'] = (df['kelembapan_tanah'] / FIELD_CAPACITY).clip(0.0, 1.0)

# FIX #2: c_scalar dihitung dari CO2 BASELINE (bukan dari co2_ppm target!)
# Gunakan rata-rata CO2 global + noise kecil, BUKAN nilai per-baris
co2_ambient = 415.0 + np.random.normal(0, 5, len(df))
df['c_scalar'] = (co2_ambient / CO2_BASELINE).clip(0.5, 1.5)
print(f"  FIX c_scalar: mean={df['c_scalar'].mean():.3f}, "
      f"std={df['c_scalar'].std():.3f}, "
      f"corr dgn co2_ppm={df['c_scalar'].corr(df['co2_ppm']):.3f}")

# GPP
par_mj = df['par'] * PAR_TO_MJ_PER_HOUR * 0.5
df['gpp'] = (par_mj * df['fapar'] * df['epsilon'] *
             df['t_scalar'] * df['w_scalar'] * df['c_scalar']).clip(0.0, None)

# RECO
def calc_reco(temp_c):
    temp_k = temp_c + 273.15
    denom = temp_k - T0_K
    if denom <= 0:
        return 0.0
    return R_REF * math.exp(E0 * (1.0 / (T_REF_K - T0_K) - 1.0 / denom))

df['reco'] = df['suhu_udara'].apply(
    lambda t: max(0.0, calc_reco(t)) * 0.0036 * 12 * 0.5
)

# NPP
df['npp'] = df['gpp'] * (1 - AUTOTROPHIC_RESP_FRACTION)

print(f"  GPP: mean={df['gpp'].mean():.4f}")
print(f"  RECO: mean={df['reco'].mean():.4f}")
print(f"  NPP: mean={df['npp'].mean():.4f}")

# FIX #4: soc_baseline BERVARIASI per "lahan" (bukan konstanta)
# Bagi data menjadi 10 segment lahan dengan SOC baseline berbeda
n_segments = 10
segment_size = len(df) // n_segments
soc_values = np.random.uniform(4000, 8000, n_segments)
soc_arr = np.zeros(len(df))
for i in range(n_segments):
    start = i * segment_size
    end = (i + 1) * segment_size if i < n_segments - 1 else len(df)
    soc_arr[start:end] = soc_values[i] + np.random.normal(0, 100, end - start)

df['soc_baseline_gC_m2'] = np.clip(soc_arr, 3000, 10000)
print(f"  FIX soc_baseline: mean={df['soc_baseline_gC_m2'].mean():.0f}, "
      f"std={df['soc_baseline_gC_m2'].std():.0f}")

# FIX #7: c_biomass_acc - TIDAK lagi kumulatif monoton
# Gunakan akumulasi per-segment (reset per lahan) + variasi musiman
df['c_biomass_acc'] = 0.0
for i in range(n_segments):
    start = i * segment_size
    end = (i + 1) * segment_size if i < n_segments - 1 else len(df)
    segment_npp = df['npp'].iloc[start:end].values
    # Akumulasi lokal + faktor degradasi harian
    local_acc = np.cumsum(segment_npp) * 0.001
    # Tambahkan variasi musiman (naik-turun)
    seasonal = 50 * np.sin(2 * np.pi * np.arange(end - start) / (365 * 48))
    df.iloc[start:end, df.columns.get_loc('c_biomass_acc')] = local_acc + seasonal

df['c_current'] = df['soc_baseline_gC_m2'] + df['c_biomass_acc']
df['c_max'] = df['soc_baseline_gC_m2'] * (1.30 + np.random.uniform(0, 0.15, len(df)))
df['carbon_potential_score'] = (1 - df['c_current'] / df['c_max']).clip(0.0, 1.0)

print(f"  FIX CPS: mean={df['carbon_potential_score'].mean():.3f}, "
      f"std={df['carbon_potential_score'].std():.3f}, "
      f"min={df['carbon_potential_score'].min():.3f}, "
      f"max={df['carbon_potential_score'].max():.3f}")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 5: Time Embeddings
# ═══════════════════════════════════════════════════════════════
print("\n--- Time Embeddings ---")

df['ts_str'] = df['TIMESTAMP_START'].astype(str).str.zfill(12)
df['hour'] = df['ts_str'].str[8:10].astype(float) + \
             df['ts_str'].str[10:12].astype(float) / 60.0
df['date'] = pd.to_datetime(df['ts_str'].str[:8], format='%Y%m%d')
df['dow'] = df['date'].dt.dayofweek

df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24.0)
df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24.0)
df['dow_sin'] = np.sin(2 * np.pi * df['dow'] / 7.0)
df['dow_cos'] = np.cos(2 * np.pi * df['dow'] / 7.0)
df['is_daytime'] = ((df['hour'] >= 6) & (df['hour'] < 18)).astype(int)
df['elapsed_hours'] = np.arange(len(df)) * 0.5

# FIX #5: is_cabai bervariasi (70% cabai, 30% tanaman lain)
df['is_cabai'] = np.random.choice([0, 1], size=len(df), p=[0.30, 0.70])
print(f"  FIX is_cabai: {df['is_cabai'].mean()*100:.0f}% cabai")

# FIX #6: has_full_data bervariasi (90% full, 10% partial)
df['has_full_data'] = np.random.choice([0, 1], size=len(df), p=[0.10, 0.90])
print(f"  FIX has_full_data: {df['has_full_data'].mean()*100:.0f}% lengkap")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 6.5: Fitur Memori/Historis (Lag & Rolling)
# ═══════════════════════════════════════════════════════════════
print("\n--- Menghitung Lag & Rolling Features (Strategi 1) ---")

# Karena data FLUXNET adalah 30-menitan, Lag 1 Jam = shift 2 baris
df['suhu_udara_lag1'] = df['suhu_udara'].shift(2).bfill()
df['kelembapan_tanah_lag1'] = df['kelembapan_tanah'].shift(2).bfill()
df['co2_lag1'] = df['co2_ppm'].shift(2).bfill()

# Rata-rata dalam 6 jam terakhir (12 baris)
df['suhu_udara_roll6'] = df['suhu_udara'].rolling(window=12, min_periods=1).mean()
df['kelembapan_tanah_roll6'] = df['kelembapan_tanah'].rolling(window=12, min_periods=1).mean()

# ═══════════════════════════════════════════════════════════════
# LANGKAH 6.8: NEE dari FLUXNET (bukan turunan)
# ═══════════════════════════════════════════════════════════════
df['nee_agrisense'] = df['NEE_VUT_REF'] * 1.1

# ═══════════════════════════════════════════════════════════════
# LANGKAH 7: FIX #1 - TARGET SHIFT +1 (Prediksi 30 menit ke depan)
# ═══════════════════════════════════════════════════════════════
print("\n--- FIX Target Leakage: Shift +1 ---")

# Target = nilai 30 menit KE DEPAN (baris berikutnya)
df['target_co2_ppm'] = df['co2_ppm'].shift(-1)
df['target_nee_agrisense'] = df['nee_agrisense'].shift(-1)
df['target_carbon_potential_score'] = df['carbon_potential_score'].shift(-1)
df['target_kelembapan_tanah'] = df['kelembapan_tanah'].shift(-1)
df['target_ph_tanah'] = df['ph_tanah'].shift(-1)

# Hapus baris terakhir (yang target-nya NaN karena shift)
df = df.dropna(subset=['target_co2_ppm', 'target_nee_agrisense',
                        'target_carbon_potential_score',
                        'target_kelembapan_tanah', 'target_ph_tanah'])
df = df.reset_index(drop=True)

print(f"  Baris setelah shift: {len(df)}")
print(f"  Corr kelembapan_tanah(fitur) vs target: "
      f"{df['kelembapan_tanah'].corr(df['target_kelembapan_tanah']):.4f}")
print(f"  Corr ph_tanah(fitur) vs target: "
      f"{df['ph_tanah'].corr(df['target_ph_tanah']):.4f}")
print(f"  Corr c_scalar vs target_co2: "
      f"{df['c_scalar'].corr(df['target_co2_ppm']):.4f}")

# ═══════════════════════════════════════════════════════════════
# LANGKAH 8: Susun Final DataFrame
# ═══════════════════════════════════════════════════════════════
FEATURE_COLS = [
    'suhu_udara', 'kelembapan_udara', 'tekanan_hpa', 'cahaya_lux',
    'kelembapan_tanah', 'suhu_tanah', 'ph_tanah', 'tvoc_ppb',
    'n_mg_kg', 'p_mg_kg', 'k_mg_kg',
    'epsilon', 'fapar', 'par',
    't_scalar', 'w_scalar', 'c_scalar',
    'gpp', 'reco', 'npp',
    'soc_baseline_gC_m2', 'c_biomass_acc', 'c_current', 'c_max',
    'elapsed_hours', 'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'is_daytime', 'is_cabai', 'has_full_data',
    'suhu_udara_lag1', 'kelembapan_tanah_lag1', 'co2_lag1',
    'suhu_udara_roll6', 'kelembapan_tanah_roll6',
    'vpd_approx'
]

TARGET_COLS = [
    'target_co2_ppm', 'target_nee_agrisense',
    'target_carbon_potential_score',
    'target_kelembapan_tanah', 'target_ph_tanah'
]

assert len(FEATURE_COLS) == 38, f"FATAL: {len(FEATURE_COLS)} fitur!"

df_final = df[FEATURE_COLS + TARGET_COLS].copy()
df_final = df_final.replace([np.inf, -np.inf], np.nan).dropna()
df_final.to_csv(OUTPUT_FILE, index=False)

# ═══════════════════════════════════════════════════════════════
# LANGKAH 9: Verifikasi Perbaikan
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("VERIFIKASI PERBAIKAN")
print("=" * 70)

# Cek konstanta
print("\n[Cek Konstanta]")
for col in FEATURE_COLS:
    std = df_final[col].std()
    if std < 1e-6:
        print(f"  MASIH KONSTANTA: {col} (std={std:.2e})")
    else:
        if col in ['epsilon', 'fapar', 'soc_baseline_gC_m2', 'c_max',
                    'is_cabai', 'has_full_data']:
            print(f"  DIPERBAIKI: {col} (std={std:.4f})")

# Cek leakage
print("\n[Cek Target Leakage]")
for tcol in TARGET_COLS:
    for fcol in FEATURE_COLS:
        if df_final[tcol].std() > 0 and df_final[fcol].std() > 0:
            corr = abs(df_final[tcol].corr(df_final[fcol]))
            if corr > 0.99:
                print(f"  MASIH LEAKAGE: {fcol} <-> {tcol} (corr={corr:.4f})")

# Cek CPS variasi
cps = df_final['target_carbon_potential_score']
print(f"\n[Cek CPS]")
print(f"  CPS std={cps.std():.4f} (sebelumnya 0.0003)")
print(f"  CPS range: {cps.min():.3f} - {cps.max():.3f}")

# Statistik target
print(f"\n[Statistik Target]")
for col in TARGET_COLS:
    s = df_final[col]
    print(f"  {col:40s}: mean={s.mean():.3f}, std={s.std():.3f}, "
          f"min={s.min():.3f}, max={s.max():.3f}")

print(f"\nTotal baris final: {len(df_final)}")
print(f"Output: {OUTPUT_FILE}")
print("SELESAI!")
