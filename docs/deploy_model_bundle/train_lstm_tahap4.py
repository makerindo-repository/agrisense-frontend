import os
import json
import time
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Konfigurasi
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_PATH = os.path.join(BASE_DIR, "processed_tropical_features.csv")
AUDIT_FILE = os.path.join(BASE_DIR, "tahap4_training_audit.json")

os.makedirs(ARTIFACTS_DIR, exist_ok=True)

# Parameter LSTM
SEQ_LEN = 24       # Window history = 24 jam ke belakang
HORIZON = 24       # Target = 24 jam ke depan
BATCH_SIZE = 128
EPOCHS = 15
LEARNING_RATE = 0.001

TARGET_MAP = {
    'target_co2_ppm': 'CO2 (ppm)',
    'target_nee_agrisense': 'Carbon Flux (NEE AgriSense)',
    'target_carbon_potential_score': 'Carbon Potential Score',
    'target_kelembapan_tanah': 'Soil Moisture (%)',
    'target_ph_tanah': 'pH Tanah'
}

def create_sequences(data_features, data_targets, seq_len, horizon):
    xs, ys = [], []
    for i in range(len(data_features) - seq_len - horizon + 1):
        x = data_features[i : i + seq_len]
        y = data_targets[i + seq_len + horizon - 1]
        xs.append(x)
        ys.append(y)
    return np.array(xs), np.array(ys)

def main():
    print(f"🚀 Memulai Tahap 4: Deep Learning LSTM Training (Keras) untuk Horizon {HORIZON} Jam")
    start_time = time.time()

    # 1. Load Dataset
    print(f"📦 Load Dataset: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    if 'TIMESTAMP' in df.columns:
        df = df.sort_values('TIMESTAMP').reset_index(drop=True)
        feature_df = df.drop(columns=['TIMESTAMP'])
    else:
        feature_df = df.copy()

    available_targets = [t for t in TARGET_MAP.keys() if t in feature_df.columns]
    feature_columns = [c for c in feature_df.columns if c not in TARGET_MAP.keys()]

    feature_df.ffill(inplace=True)
    feature_df.bfill(inplace=True)

    # 2. Scaling Fitur
    feature_scaler = StandardScaler()
    scaled_features = feature_scaler.fit_transform(feature_df[feature_columns])
    joblib.dump(feature_scaler, os.path.join(ARTIFACTS_DIR, "sintetik_90", "lstm_feature_scaler.joblib"))
    feature_dim = scaled_features.shape[1]
    print(f"✅ Features di-scaling. Dimensi Input: {feature_dim}")

    audit_results = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "horizon_hours": HORIZON,
        "seq_len": SEQ_LEN,
        "metrics": []
    }

    for target in available_targets:
        target_label = TARGET_MAP[target]
        print(f"\n========================================")
        print(f"🧠 Training LSTM (TensorFlow) untuk Target: {target_label}")
        print(f"========================================")
        
        target_scaler = StandardScaler()
        scaled_target = target_scaler.fit_transform(feature_df[[target]])
        joblib.dump(target_scaler, os.path.join(ARTIFACTS_DIR, "sintetik_90", f"lstm_target_scaler_{target_label}.joblib"))

        # 3. Create Sequences
        print(f"✂️ Membuat Sliding Window (Seq: {SEQ_LEN}, Horizon: {HORIZON})...")
        X_seq, y_seq = create_sequences(scaled_features, scaled_target.flatten(), SEQ_LEN, HORIZON)
        
        # 4. Train-Test Split (Chronological)
        split_idx = int(len(X_seq) * 0.8)
        X_train, X_test = X_seq[:split_idx], X_seq[split_idx:]
        y_train, y_test = y_seq[:split_idx], y_seq[split_idx:]

        # 5. Build Model
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

        # 6. Training
        print("Mulai proses training (ini mungkin membutuhkan waktu beberapa menit)...")
        model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE, 
                  validation_data=(X_test, y_test), verbose=1)

        # 7. Evaluation
        pred_scaled = model.predict(X_test)
        actual_scaled = y_test.reshape(-1, 1)

        # Inverse Transform
        pred_real = target_scaler.inverse_transform(pred_scaled)
        actual_real = target_scaler.inverse_transform(actual_scaled)

        # Metrik
        mae = mean_absolute_error(actual_real, pred_real)
        rmse = np.sqrt(mean_squared_error(actual_real, pred_real))
        r2 = r2_score(actual_real, pred_real)
        
        eps = 1e-8
        mape = np.mean(np.abs((actual_real - pred_real) / (actual_real + eps))) * 100

        print(f"📊 Evaluasi {target_label} (Horizon +{HORIZON}h):")
        print(f"  - R² Score: {r2:.4f}")
        print(f"  - MAE:      {mae:.4f}")
        print(f"  - RMSE:     {rmse:.4f}")
        print(f"  - MAPE:     {mape:.2f}%")

        audit_results['metrics'].append({
            "model_key": "lstm",
            "model": "LSTM",
            "target": target_label,
            "horizon_hours": HORIZON,
            "MAE": round(float(mae), 4),
            "RMSE": round(float(rmse), 4),
            "MAPE_pct": round(float(mape), 2),
            "R2": round(float(max(0, r2)), 4)
        })

        # 8. Simpan Model
        model_path = os.path.join(ARTIFACTS_DIR, "sintetik_90", f"lstm_model_{target_label}_h{HORIZON}.keras")
        model.save(model_path)
        print(f"💾 Model tersimpan di {model_path}")

    # Simpan hasil audit
    with open(AUDIT_FILE, 'w') as f:
        json.dump(audit_results, f, indent=4)
        
    print(f"\n✅ Audit berhasil disimpan ke {AUDIT_FILE}")
    print(f"⏱️ Total Waktu: {round((time.time() - start_time)/60, 2)} Menit")

if __name__ == "__main__":
    main()
