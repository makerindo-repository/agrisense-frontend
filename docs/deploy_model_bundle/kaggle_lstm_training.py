"""
PANDUAN TRAINING LSTM DI KAGGLE UNTUK AGRISENSE

1. Buat Notebook baru di Kaggle (New Notebook).
2. Di menu sebelah kanan (Data), klik "Upload" -> Pilih file `fluxnet_indonesia_32features.csv` dari laptop Anda.
3. Setelah ter-upload, copy-paste seluruh kode di bawah ini ke dalam satu "Cell" di Kaggle.
4. Pastikan "Accelerator" di kanan atas disetel ke "None" atau "GPU T4" (GPU akan lebih cepat).
5. Klik tombol "Run" (Play) di cell tersebut.
6. Tunggu hingga selesai (sekitar 5-10 menit).
7. Di menu kanan bawah (Output), akan muncul file-file berakhiran `.keras` dan `.joblib`. Download semua file tersebut dan masukkan ke dalam folder `docs/deploy_model_bundle/artifacts` di laptop Anda.
"""

import os
import json
import time
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# 1. Konfigurasi Path Kaggle
# Sesuaikan nama folder 'fluxnet' dengan nama dataset yang Anda buat saat upload di Kaggle.
# Biasanya formatnya: /kaggle/input/NAMA_DATASET_ANDA/fluxnet_indonesia_32features.csv
DATA_PATH = "/kaggle/input/fluxnet/fluxnet_indonesia_32features.csv" 

# Jika file tidak ditemukan, coba uncomment baris ini untuk mencari path aslinya di Kaggle:
# import glob; print(glob.glob("/kaggle/input/**/*.csv", recursive=True))

OUTPUT_DIR = "/kaggle/working/artifacts"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 2. Parameter LSTM
SEQ_LEN = 24       # Window history = 24 jam ke belakang
HORIZON = 24       # Target = 24 jam ke depan
BATCH_SIZE = 128
EPOCHS = 15
LEARNING_RATE = 0.001

TARGET_COLUMNS = [
    'CO2 (ppm)',
    'Carbon Flux (NEE AgriSense)',
    'Carbon Potential Score',
    'Soil Moisture (%)',
    'pH Tanah'
]

def create_sequences(data_features, data_targets, seq_len, horizon):
    xs, ys = [], []
    for i in range(len(data_features) - seq_len - horizon + 1):
        x = data_features[i : i + seq_len]
        y = data_targets[i + seq_len + horizon - 1]
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

def main():
    print(f"🚀 Memulai Training LSTM di Kaggle untuk Horizon {HORIZON} Jam")
    start_time = time.time()

    # Load Dataset
    print(f"📦 Load Dataset dari: {DATA_PATH}")
    try:
        df = pd.read_csv(DATA_PATH)
    except FileNotFoundError:
        print("❌ ERROR: File CSV tidak ditemukan! Pastikan Anda sudah mengupload dataset dengan benar di Kaggle.")
        return

    if 'TIMESTAMP' in df.columns:
        df = df.sort_values('TIMESTAMP').reset_index(drop=True)
        feature_df = df.drop(columns=['TIMESTAMP'])
    else:
        feature_df = df.copy()

    available_targets = [t for t in TARGET_COLUMNS if t in feature_df.columns]
    feature_columns = [c for c in feature_df.columns if c not in TARGET_COLUMNS]

    feature_df.ffill(inplace=True)
    feature_df.bfill(inplace=True)

    # Scaling Fitur
    feature_scaler = StandardScaler()
    scaled_features = feature_scaler.fit_transform(feature_df[feature_columns])
    joblib.dump(feature_scaler, os.path.join(OUTPUT_DIR, "lstm_feature_scaler.joblib"))
    feature_dim = scaled_features.shape[1]
    print(f"✅ Features di-scaling. Dimensi Input: {feature_dim}")

    audit_results = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "horizon_hours": HORIZON,
        "seq_len": SEQ_LEN,
        "metrics": []
    }

    for target in available_targets:
        print(f"\n========================================")
        print(f"🧠 Training LSTM untuk Target: {target}")
        print(f"========================================")
        
        target_scaler = StandardScaler()
        scaled_target = target_scaler.fit_transform(feature_df[[target]])
        joblib.dump(target_scaler, os.path.join(OUTPUT_DIR, f"lstm_target_scaler_{target}.joblib"))

        # Create Sequences
        print(f"✂️ Membuat Sliding Window (Seq: {SEQ_LEN}, Horizon: {HORIZON})...")
        X_seq, y_seq = create_sequences(scaled_features, scaled_target.flatten(), SEQ_LEN, HORIZON)
        
        split_idx = int(len(X_seq) * 0.8)
        X_train, X_test = X_seq[:split_idx], X_seq[split_idx:]
        y_train, y_test = y_seq[:split_idx], y_seq[split_idx:]

        # Build Model
        model = Sequential([
            LSTM(64, activation='tanh', return_sequences=True, input_shape=(SEQ_LEN, feature_dim)),
            Dropout(0.2),
            LSTM(64, activation='tanh'),
            Dropout(0.2),
            Dense(32, activation='relu'),
            Dense(1)
        ])

        optimizer = tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE)
        model.compile(optimizer=optimizer, loss='mse')

        print("Mulai proses training...")
        # Jika menggunakan GPU Kaggle, ini akan sangat cepat
        model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE, 
                  validation_data=(X_test, y_test), verbose=1)

        # Evaluation
        pred_scaled = model.predict(X_test)
        actual_scaled = y_test.reshape(-1, 1)

        pred_real = target_scaler.inverse_transform(pred_scaled)
        actual_real = target_scaler.inverse_transform(actual_scaled)

        mae = mean_absolute_error(actual_real, pred_real)
        rmse = np.sqrt(mean_squared_error(actual_real, pred_real))
        r2 = r2_score(actual_real, pred_real)
        
        eps = 1e-8
        mape = np.mean(np.abs((actual_real - pred_real) / (actual_real + eps))) * 100

        print(f"📊 Evaluasi {target} (+{HORIZON}h): R²={r2:.4f}, MAE={mae:.4f}")

        audit_results['metrics'].append({
            "model_key": "lstm",
            "model": "LSTM",
            "target": target,
            "horizon_hours": HORIZON,
            "MAE": round(float(mae), 4),
            "RMSE": round(float(rmse), 4),
            "MAPE_pct": round(float(mape), 2),
            "R2": round(float(max(0, r2)), 4)
        })

        # Save Model
        model_path = os.path.join(OUTPUT_DIR, f"lstm_model_{target}_h{HORIZON}.keras")
        model.save(model_path)

    # Simpan hasil audit
    audit_file = os.path.join(OUTPUT_DIR, "tahap4_training_audit.json")
    with open(audit_file, 'w') as f:
        json.dump(audit_results, f, indent=4)
        
    print(f"\n✅ TRAINING SELESAI! Silakan download file .keras dan .joblib di folder output Kaggle Anda.")
    print(f"⏱️ Total Waktu: {round((time.time() - start_time)/60, 2)} Menit")

if __name__ == "__main__":
    main()
