"""
=============================================================
AUDIT MENDALAM: Evaluasi Model XGBoost (Tahap 3)
=============================================================
Script ini membuka kembali model XGBoost yang baru dilatih, lalu 
menganalisisnya untuk memastikan:
1. Tidak ada Overfitting (Membandingkan Akurasi Train vs Test)
2. Logika Model Masuk Akal (Menganalisis Feature Importance)
3. Evaluasi Prediksi Ekstrim
"""
import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb

BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
DATA_FILE = os.path.join(BASE_DIR, "fluxnet_indonesia_32features.csv")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts", "sintetik_90")

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

TARGETS_TO_AUDIT = {
    'target_kelembapan_tanah': 'kelembapan_tanah',
    'target_nee_agrisense': 'nee_agrisense',
    'target_ph_tanah': 'ph_tanah'
}

print("=" * 70)
print("AUDIT MENDALAM TAHAP 3: Evaluasi Logika Model XGBoost")
print("=" * 70)

# Load Data
df = pd.read_csv(DATA_FILE)
X = df[FEATURE_COLS].values
y = df[list(TARGETS_TO_AUDIT.keys())]

# Gunakan random_state=42 agar split-nya persis sama dengan saat training
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Load Scaler
scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "scaler_X.joblib"))
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)

for target_col, model_name in TARGETS_TO_AUDIT.items():
    print(f"\n" + "-" * 50)
    print(f"🔍 AUDIT MODEL: {model_name.upper()}")
    print("-" * 50)
    
    # Load Model
    model_path = os.path.join(ARTIFACTS_DIR, f"xgboost_{model_name}.joblib")
    if not os.path.exists(model_path):
        print(f"Model {model_name} tidak ditemukan.")
        continue
        
    model = joblib.load(model_path)
    
    # 1. OVERFITTING CHECK
    y_train_pred = model.predict(X_train_scaled)
    y_test_pred = model.predict(X_test_scaled)
    
    r2_train = r2_score(y_train[target_col], y_train_pred)
    r2_test = r2_score(y_test[target_col], y_test_pred)
    mae_train = mean_absolute_error(y_train[target_col], y_train_pred)
    mae_test = mean_absolute_error(y_test[target_col], y_test_pred)
    
    print("\n[1] Pengecekan Overfitting (Hafalan vs Pemahaman)")
    print(f"  R2 Train Data : {r2_train:.4f}  |  R2 Test Data : {r2_test:.4f}")
    print(f"  MAE Train     : {mae_train:.4f}  |  MAE Test     : {mae_test:.4f}")
    
    diff_r2 = abs(r2_train - r2_test)
    if diff_r2 < 0.05:
        print("  Status: ✅ AMAN. Model benar-benar belajar, tidak cuma menghafal.")
    elif diff_r2 < 0.15:
        print("  Status: 🟡 WARNING. Sedikit Overfitting.")
    else:
        print("  Status: 🔴 BAHAYA. Model Overfitting (hanya menghafal data train).")
        
    # 2. LOGIKA FISIKA (Feature Importance)
    print("\n[2] Pengecekan Logika Keputusan AI (Top 5 Alasan)")
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    total_importance = sum(importances)
    for i in range(5):
        idx = indices[i]
        feat_name = FEATURE_COLS[idx]
        score = importances[idx] * 100
        print(f"  {i+1}. {feat_name:20s} : {score:.1f}%")
        
    # Diagnosa Logika
    if model_name == 'kelembapan_tanah':
        if FEATURE_COLS[indices[0]] in ['kelembapan_tanah', 'w_scalar']:
            print("  Diagnosa: ✅ LOGIS! Prediksi kelembapan masa depan bergantung pada kelembapan saat ini.")
    elif model_name == 'nee_agrisense':
        top_feats = [FEATURE_COLS[idx] for idx in indices[:3]]
        has_light_or_temp = any(f in top_feats for f in ['gpp', 'reco', 'cahaya_lux', 'par', 'suhu_udara', 't_scalar'])
        if has_light_or_temp:
            print("  Diagnosa: ✅ LOGIS! Model menebak Carbon Flux berdasarkan Cahaya (Fotosintesis) atau Suhu (Respirasi).")
    
    # 3. KESALAHAN TERBESAR (Worst Prediction Check)
    print("\n[3] Analisis Titik Buta (Kapan model salah?)")
    y_test_actual = y_test[target_col].values
    errors = np.abs(y_test_actual - y_test_pred)
    worst_idx = np.argmax(errors)
    
    worst_actual = y_test_actual[worst_idx]
    worst_pred = y_test_pred[worst_idx]
    worst_error = errors[worst_idx]
    
    print(f"  Kesalahan maksimum : {worst_error:.2f} unit")
    print(f"  Saat aslinya bernilai {worst_actual:.2f}, AI memprediksi {worst_pred:.2f}")

print("\n" + "=" * 70)
print("AUDIT SELESAI")
print("=" * 70)
