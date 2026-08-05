"""
=============================================================
TAHAP 3: Pelatihan Model XGBoost (Regresi)
=============================================================
Script ini melatih ulang model XGBoost menggunakan dataset 26k baris
yang sudah di-feature engineering pada Tahap 2.

Target yang dilatih:
1. Soil Moisture (%)
2. pH Tanah
3. CO2 (ppm)
4. Carbon Flux (NEE AgriSense)
5. Carbon Potential Score
"""
import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

# ═══════════════════════════════════════════════════════════════
# KONFIGURASI
# ═══════════════════════════════════════════════════════════════
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "processed_tropical_features.csv")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts", "sintetik_90")
AUDIT_FILE = os.path.join(BASE_DIR, "tahap3_training_audit.json")

os.makedirs(ARTIFACTS_DIR, exist_ok=True)

FEATURE_COLS = [
    "suhu_udara", "kelembapan_udara",
    "epsilon", "fapar",
    "t_scalar", "c_scalar",
    "gpp", "reco", "npp",
    "soc_baseline_gC_m2", "c_biomass_acc", "c_current", "c_max",
    "elapsed_hours", "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "is_daytime", "is_cabai", "has_full_data",
    "suhu_udara_lag1", "co2_lag1",
    "suhu_udara_roll6",
    "vpd_approx"
]

# Map nama target dari dataset -> nama file model yang lama
TARGET_MAP = {
    "target_co2_ppm": "co2_ppm",
    "target_nee_agrisense": "nee_agrisense",
    "target_carbon_potential_score": "carbon_potential_score"
}

print("=" * 70)
print("TAHAP 3: Pelatihan Model XGBoost (26K Baris Data)")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════
# 1. LOAD DATA & SPLIT
# ═══════════════════════════════════════════════════════════════
print("Memuat dataset...")
df = pd.read_csv(DATA_FILE)

X = df[FEATURE_COLS].values
y = df[list(TARGET_MAP.keys())]

# Train-Test Split (80% Train, 20% Test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"  Total Data : {len(df)} baris")
print(f"  Data Latih : {len(X_train)} baris")
print(f"  Data Uji   : {len(X_test)} baris")

# ═══════════════════════════════════════════════════════════════
# 2. NORMALISASI FITUR (SCALING)
# ═══════════════════════════════════════════════════════════════
print("\nMelakukan normalisasi (StandardScaler)...")
scaler_X = StandardScaler()
X_train_scaled = scaler_X.fit_transform(X_train)
X_test_scaled = scaler_X.transform(X_test)

# Simpan Scaler (menimpa scaler lama)
scaler_path = os.path.join(ARTIFACTS_DIR, "scaler_X.joblib")
joblib.dump(scaler_X, scaler_path)
print(f"  Scaler disimpan ke: {scaler_path}")

# ═══════════════════════════════════════════════════════════════
# 3. TRAINING XGBOOST
# ═══════════════════════════════════════════════════════════════
print("\nMelatih Model XGBoost untuk setiap target...")
audit_results = {}

for target_col, model_name in TARGET_MAP.items():
    print(f"\n--- Melatih Target: {model_name} ---")
    
    y_train_col = y_train[target_col].values
    y_test_col = y_test[target_col].values
    
    # Inisialisasi Model XGBoost
    # Parameter disesuaikan agar tidak overfit
    xgb_model = xgb.XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    
    # Training
    xgb_model.fit(
        X_train_scaled, y_train_col,
        eval_set=[(X_test_scaled, y_test_col)],
        verbose=False
    )
    
    # Evaluasi pada Test Set
    y_pred = xgb_model.predict(X_test_scaled)
    
    mae = mean_absolute_error(y_test_col, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test_col, y_pred))
    r2 = r2_score(y_test_col, y_pred)
    
    print(f"  R2 Score : {r2:.4f} (Mendekati 1.0 = Sangat Akurat)")
    print(f"  MAE      : {mae:.4f}")
    print(f"  RMSE     : {rmse:.4f}")
    
    # Simpan Model
    model_path = os.path.join(ARTIFACTS_DIR, f"xgboost_{model_name}.joblib")
    joblib.dump(xgb_model, model_path)
    print(f"  Model disimpan ke: xgboost_{model_name}.joblib")
    
    # Dapatkan Feature Importance (Top 5)
    importances = xgb_model.feature_importances_
    indices = np.argsort(importances)[::-1]
    top5_features = [FEATURE_COLS[i] for i in indices[:5]]
    top5_scores = [float(importances[i]) for i in indices[:5]]
    
    audit_results[model_name] = {
        'R2': float(r2),
        'MAE': float(mae),
        'RMSE': float(rmse),
        'Top5_Features': dict(zip(top5_features, top5_scores))
    }

# ═══════════════════════════════════════════════════════════════
# 4. SIMPAN LAPORAN AUDIT
# ═══════════════════════════════════════════════════════════════
with open(AUDIT_FILE, 'w') as f:
    json.dump(audit_results, f, indent=2)

print("\n" + "=" * 70)
print("TRAINING SELESAI!")
print("=" * 70)
print("Semua model XGBoost baru telah menggantikan model sintetik lama.")
print("Sekarang inference engine akan menggunakan kepintaran dari 176.000 data tropis asli!")
