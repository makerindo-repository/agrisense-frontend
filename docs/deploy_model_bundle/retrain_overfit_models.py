"""
=============================================================
PERBAIKAN OVERFITTING: Retraining Model NEE dan pH
=============================================================
Script ini menerapkan Hyperparameter Tuning (Regularisasi)
untuk mencegah overfitting pada target NEE dan pH Tanah.
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

# Hanya target yang overfit
TARGETS_TO_FIX = {
    'target_nee_agrisense': 'nee_agrisense',
    'target_ph_tanah': 'ph_tanah'
}

# Parameter baru yang lebih KETAT (Regularisasi tinggi)
HYPERPARAMS = {
    'nee_agrisense': {
        'n_estimators': 200,      # Dikurangi dari 300
        'max_depth': 4,           # Dipotong dari 6 ke 4
        'learning_rate': 0.05,
        'min_child_weight': 3,    # Baru (mencegah overfit)
        'reg_lambda': 2.0,        # L2 Regularization (Lasso)
        'subsample': 0.8,
        'random_state': 42
    },
    'ph_tanah': {
        'n_estimators': 150,      # Sangat dikurangi
        'max_depth': 3,           # Pohon sangat dangkal
        'learning_rate': 0.03,    # Belajar lebih lambat
        'min_child_weight': 5,    # Sangat ketat
        'reg_lambda': 5.0,        # Regularisasi sangat tinggi
        'reg_alpha': 1.0,         # L1 Regularization (Ridge)
        'subsample': 0.7,
        'random_state': 42
    }
}

print("=" * 70)
print("PERBAIKAN OVERFITTING (Hyperparameter Tuning)")
print("=" * 70)

df = pd.read_csv(DATA_FILE)
X = df[FEATURE_COLS].values
scaler = joblib.load(os.path.join(ARTIFACTS_DIR, "scaler_X.joblib"))

for target_col, model_name in TARGETS_TO_FIX.items():
    print(f"\n--- Retraining Model: {model_name} ---")
    
    y = df[target_col].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    params = HYPERPARAMS[model_name]
    print(f"  Menerapkan parameter ketat: max_depth={params['max_depth']}, lambda={params['reg_lambda']}")
    
    xgb_model = xgb.XGBRegressor(**params, n_jobs=-1)
    
    xgb_model.fit(X_train_scaled, y_train)
    
    y_train_pred = xgb_model.predict(X_train_scaled)
    y_test_pred = xgb_model.predict(X_test_scaled)
    
    r2_train = r2_score(y_train, y_train_pred)
    r2_test = r2_score(y_test, y_test_pred)
    mae_test = mean_absolute_error(y_test, y_test_pred)
    
    diff = abs(r2_train - r2_test)
    
    print("\n  [Hasil Perbaikan]")
    print(f"  R2 Train : {r2_train:.4f}")
    print(f"  R2 Test  : {r2_test:.4f}")
    print(f"  Selisih  : {diff:.4f} (Idealnya < 0.05)")
    print(f"  MAE Test : {mae_test:.4f}")
    
    if diff < 0.05:
        print("  Status   : ✅ OVERFITTING TERATASI!")
    else:
        print("  Status   : 🟡 MASIH ADA SELISIH, TAPI JAUH LEBIH BAIK.")
        
    model_path = os.path.join(ARTIFACTS_DIR, f"xgboost_{model_name}.joblib")
    joblib.dump(xgb_model, model_path)
    print(f"  Model baru ditimpa ke: {model_path}")

print("\n" + "=" * 70)
print("PROSES PERBAIKAN SELESAI")
print("=" * 70)
