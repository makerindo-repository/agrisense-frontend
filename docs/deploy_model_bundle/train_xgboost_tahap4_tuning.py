"""
=============================================================
TAHAP 4: Hyperparameter Tuning Model XGBoost (Strategi 3)
=============================================================
Script ini menerapkan RandomizedSearchCV dengan K-Fold Cross Validation
untuk mencari konfigurasi hyperparameter XGBoost terbaik.

Target difokuskan pada:
1. Carbon Flux (NEE AgriSense)
2. CO2 (ppm)
3. Kelembapan Tanah

Karena proses tuning membutuhkan komputasi berat, kita membatasi target utama
atau membiarkannya berjalan secara iteratif.
"""
import pandas as pd
import numpy as np
import os
import joblib
import json
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

# ═══════════════════════════════════════════════════════════════
# KONFIGURASI
# ═══════════════════════════════════════════════════════════════
BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
DATA_FILE = os.path.join(BASE_DIR, "processed_tropical_features.csv")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts", "sintetik_90")
AUDIT_FILE = os.path.join(BASE_DIR, "tahap4_tuning_audit.json")

os.makedirs(ARTIFACTS_DIR, exist_ok=True)

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

# Map nama target dari dataset -> nama file model yang lama
TARGET_MAP = {
    'target_co2_ppm': 'co2_ppm',
    'target_nee_agrisense': 'nee_agrisense',
    'target_carbon_potential_score': 'carbon_potential_score',
    'target_kelembapan_tanah': 'kelembapan_tanah',
    'target_ph_tanah': 'ph_tanah'
}

print("=" * 70, flush=True)
print("TAHAP 4: Hyperparameter Tuning XGBoost (K-Fold CV)", flush=True)
print("=" * 70, flush=True)

# ═══════════════════════════════════════════════════════════════
# 1. LOAD DATA & SPLIT
# ═══════════════════════════════════════════════════════════════
print("Memuat dataset...", flush=True)
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

# ═══════════════════════════════════════════════════════════════
# 3. HYPERPARAMETER TUNING XGBOOST
# ═══════════════════════════════════════════════════════════════
print("\nMemulai Tuning XGBoost untuk setiap target...")
audit_results = {}

# Definisi rentang ruang pencarian (Search Space)
param_distributions = {
    'n_estimators': [100, 200, 300, 400],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'max_depth': [4, 6, 8, 10],
    'subsample': [0.6, 0.8, 1.0],
    'colsample_bytree': [0.6, 0.8, 1.0],
    'reg_alpha': [0, 0.1, 1], # L1 Regularization
    'reg_lambda': [1, 2, 5]   # L2 Regularization
}

for target_col, model_name in TARGET_MAP.items():
    print(f"\n--- Tuning Target: {model_name} ---", flush=True)
    
    y_train_col = y_train[target_col].values
    y_test_col = y_test[target_col].values
    
    xgb_base = xgb.XGBRegressor(random_state=42, n_jobs=-1)
    
    # Konfigurasi RandomizedSearchCV (Mencari 15 kombinasi acak, dengan 3-Fold CV)
    random_search = RandomizedSearchCV(
        estimator=xgb_base,
        param_distributions=param_distributions,
        n_iter=15,          # Hanya mencoba 15 kombinasi untuk menghemat waktu komputasi
        scoring='r2',       # Evaluasi berdasarkan R2 Score tertinggi
        cv=3,               # 3-Fold Cross Validation
        verbose=1,
        random_state=42,
        n_jobs=1           # Set 1 agar tidak crash di Windows
    )
    
    # Jalankan pencarian
    print("Mencari parameter terbaik (ini mungkin memakan waktu)...", flush=True)
    random_search.fit(X_train_scaled, y_train_col)
    
    best_model = random_search.best_estimator_
    best_params = random_search.best_params_
    
    print(f"  Parameter Terbaik: {best_params}")
    
    # Evaluasi pada Test Set yang belum pernah dilihat saat tuning
    y_pred = best_model.predict(X_test_scaled)
    
    mae = mean_absolute_error(y_test_col, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test_col, y_pred))
    r2 = r2_score(y_test_col, y_pred)
    
    print(f"  R2 Score (Test) : {r2:.4f}")
    print(f"  MAE (Test)      : {mae:.4f}")
    
    # Simpan Model Terbaik
    model_path = os.path.join(ARTIFACTS_DIR, f"xgboost_{model_name}.joblib")
    joblib.dump(best_model, model_path)
    print(f"  Model disimpan ke: xgboost_{model_name}.joblib")
    
    # Dapatkan Feature Importance
    importances = best_model.feature_importances_
    indices = np.argsort(importances)[::-1]
    top5_features = [FEATURE_COLS[i] for i in indices[:5]]
    top5_scores = [float(importances[i]) for i in indices[:5]]
    
    audit_results[model_name] = {
        'R2': float(r2),
        'MAE': float(mae),
        'RMSE': float(rmse),
        'Best_Params': best_params,
        'Top5_Features': dict(zip(top5_features, top5_scores))
    }

# Simpan Log Audit
with open(AUDIT_FILE, 'w') as f:
    json.dump(audit_results, f, indent=4)

print("\n" + "=" * 70)
print("TUNING SELESAI!")
print(f"Log tersimpan di: {AUDIT_FILE}")
print("=" * 70)
