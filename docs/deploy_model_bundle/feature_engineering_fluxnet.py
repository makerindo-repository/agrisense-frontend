"""
=============================================================
TAHAP 2 v3: Feature Engineering IoT -> ML Target
=============================================================
Memodifikasi data mentah IoT AgriSense menjadi dataset latih
dengan target Biologi (GPP, RECO, CPS) yang disimulasikan.
"""
import pandas as pd
import numpy as np
import os, math

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "agrisense_synthetic_21k.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "processed_tropical_features.csv")

# Constants
LUX_TO_PAR = 0.0185
PAR_TO_MJ_PER_HOUR = 0.00756
T_MIN, T_OPT, T_MAX = 10.0, 28.0, 40.0
CO2_BASELINE = 420.0
AUTOTROPHIC_RESP_FRACTION = 0.53
R_REF = 2.0
T_REF_K = 283.15
T0_K = 227.13
E0 = 308.56

np.random.seed(42)

print("=" * 70)
print("TAHAP 2 v3: Migrasi Dataset Latih IoT -> XGBoost")
print("=" * 70)

# 1. LOAD DATA
print("\n--- Memuat Dataset Mentah ---")
df = pd.read_csv(INPUT_FILE)
df = df.reset_index(drop=True)
print(f"Baris dimuat: {len(df)}")

# 2. PARSING WAKTU
print("\n--- Time Embeddings ---")
df['dt'] = pd.to_datetime(df['timestamp'], utc=True).dt.tz_convert('Asia/Jakarta')
df['hour'] = df['dt'].dt.hour + df['dt'].dt.minute / 60.0
df['dow'] = df['dt'].dt.dayofweek

df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24.0)
df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24.0)
df['dow_sin'] = np.sin(2 * np.pi * df['dow'] / 7.0)
df['dow_cos'] = np.cos(2 * np.pi * df['dow'] / 7.0)
df['is_daytime'] = ((df['hour'] >= 6) & (df['hour'] < 18)).astype(int)
df['elapsed_hours'] = np.arange(len(df)) * 0.5

# 3. TRANSFORMASI SENSOR
df['suhu_udara'] = df['air_temperature_c'].clip(18.0, 38.0)
df['kelembapan_udara'] = df['air_humidity_percent'].clip(30.0, 100.0)
df['co2_ppm'] = df['co2_ppm'].clip(350.0, 600.0)

# VPD (Vapor Pressure Deficit) estimation
e_sat = 0.611 * np.exp((17.27 * df['suhu_udara']) / (df['suhu_udara'] + 237.3))
e_act = e_sat * (df['kelembapan_udara'] / 100.0)
df['vpd_approx'] = (e_sat - e_act).clip(0.0, 5.0)

# 4. FITUR TURUNAN BIOLOGI
print("\n--- Fitur Turunan Biologi ---")
temp_stress = 1.0 - 0.02 * np.abs(df['suhu_udara'] - 28.0)
df['epsilon'] = (1.20 * temp_stress.clip(0.7, 1.0) + np.random.normal(0, 0.03, len(df))).clip(0.60, 1.80)

veg_index = 0.55
df['fapar'] = (veg_index + np.random.normal(0, 0.04, len(df))).clip(0.30, 0.90)

def calc_t_scalar(temp):
    if temp <= T_MIN or temp >= T_MAX:
        return 0.0
    return ((temp - T_MIN) * (temp - T_MAX)) / ((temp - T_MIN) * (temp - T_MAX) - (temp - T_OPT) ** 2 + 1e-9)

df['t_scalar'] = df['suhu_udara'].apply(lambda t: max(0.0, min(1.0, calc_t_scalar(t))))

co2_ambient = 415.0 + np.random.normal(0, 5, len(df))
df['c_scalar'] = (co2_ambient / CO2_BASELINE).clip(0.5, 1.5)

# SIMULASI CAHAYA (PAR) BUKAN DARI SENSOR
simulated_lux = np.where(df['is_daytime'] == 1, 
                         100000.0 * np.sin(np.pi * (df['hour'] - 6.0) / 12.0) * (1 - df['cloud_cover_percent']/200.0), 
                         0.0)
par_mj = (simulated_lux * LUX_TO_PAR) * PAR_TO_MJ_PER_HOUR * 0.5
df['gpp'] = (par_mj * df['fapar'] * df['epsilon'] * df['t_scalar'] * df['c_scalar']).clip(0.0, None)

def calc_reco(temp_c):
    temp_k = temp_c + 273.15
    denom = temp_k - T0_K
    if denom <= 0:
        return 0.0
    return R_REF * math.exp(E0 * (1.0 / (T_REF_K - T0_K) - 1.0 / denom))

df['reco'] = df['suhu_udara'].apply(lambda t: max(0.0, calc_reco(t)) * 0.0036 * 12 * 0.5)
df['npp'] = df['gpp'] * (1 - AUTOTROPHIC_RESP_FRACTION)

n_segments = 10
segment_size = len(df) // n_segments
soc_values = np.random.uniform(4000, 8000, n_segments)
soc_arr = np.zeros(len(df))
for i in range(n_segments):
    start = i * segment_size
    end = (i + 1) * segment_size if i < n_segments - 1 else len(df)
    soc_arr[start:end] = soc_values[i] + np.random.normal(0, 100, end - start)

df['soc_baseline_gC_m2'] = np.clip(soc_arr, 3000, 10000)

df['c_biomass_acc'] = 0.0
for i in range(n_segments):
    start = i * segment_size
    end = (i + 1) * segment_size if i < n_segments - 1 else len(df)
    segment_npp = df['npp'].iloc[start:end].values
    local_acc = np.cumsum(segment_npp) * 0.001
    seasonal = 50 * np.sin(2 * np.pi * np.arange(end - start) / (365 * 48))
    df.iloc[start:end, df.columns.get_loc('c_biomass_acc')] = local_acc + seasonal

df['c_current'] = df['soc_baseline_gC_m2'] + df['c_biomass_acc']
df['c_max'] = df['soc_baseline_gC_m2'] * (1.30 + np.random.uniform(0, 0.15, len(df)))
df['carbon_potential_score'] = (1 - df['c_current'] / df['c_max']).clip(0.0, 1.0)

df['is_cabai'] = np.random.choice([0, 1], size=len(df), p=[0.30, 0.70])
df['has_full_data'] = np.random.choice([0, 1], size=len(df), p=[0.10, 0.90])

print("\n--- Fitur Historis ---")
df['suhu_udara_lag1'] = df['suhu_udara'].shift(2).bfill()
df['co2_lag1'] = df['co2_ppm'].shift(2).bfill()
df['suhu_udara_roll6'] = df['suhu_udara'].rolling(window=12, min_periods=1).mean()

# NEE
df['nee_agrisense'] = (df['reco'] - df['gpp']) * 1.1

print("\n--- Target Shift (Prediksi 30 Menit) ---")
df['target_co2_ppm'] = df['co2_ppm'].shift(-1)
df['target_nee_agrisense'] = df['nee_agrisense'].shift(-1)
df['target_carbon_potential_score'] = df['carbon_potential_score'].shift(-1)

df = df.dropna(subset=['target_co2_ppm', 'target_nee_agrisense', 'target_carbon_potential_score'])
df = df.reset_index(drop=True)

FEATURE_COLS = [
    'suhu_udara', 'kelembapan_udara',
    'epsilon', 'fapar',
    't_scalar', 'c_scalar',
    'gpp', 'reco', 'npp',
    'soc_baseline_gC_m2', 'c_biomass_acc', 'c_current', 'c_max',
    'elapsed_hours', 'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'is_daytime', 'is_cabai', 'has_full_data',
    'suhu_udara_lag1', 'co2_lag1',
    'suhu_udara_roll6',
    'vpd_approx'
]

TARGET_COLS = [
    'target_co2_ppm', 'target_nee_agrisense',
    'target_carbon_potential_score'
]

assert len(FEATURE_COLS) == 25, f"FATAL: {len(FEATURE_COLS)} fitur!"

df_final = df[FEATURE_COLS + TARGET_COLS].copy()
df_final = df_final.replace([np.inf, -np.inf], np.nan).dropna()
df_final.to_csv(OUTPUT_FILE, index=False)
print(f"SELESAI! {len(df_final)} baris disimpan ke {OUTPUT_FILE}")
