r"""
run_inference.py — Stateless inference script untuk AgriSense Model Bundle.

Dijalankan oleh Laravel background job via Symfony\Component\Process.

Pemakaian:
    python run_inference.py <path_input.json> [--models svm,xgboost] [--targets "Soil Moisture (%),pH"] [--horizons 1,6,24]

Input JSON:
    {
        "device_id": "AGRISENSE-CC-001",
        "rows": [ { ... sensor + features ... }, ... ]
    }

Output (stdout, JSON murni):
    {
        "success": true,
        "predictions": [
            { "model": "svm", "target": "Soil Moisture (%)", "horizon": 1, "value": 42.5 },
            ...
        ]
    }

PENTING: Script ini TIDAK BOLEH mencetak apapun selain JSON output.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import joblib

try:
    import torch
    HAS_TORCH = True
except Exception:
    torch = None
    HAS_TORCH = False

BUNDLE_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = BUNDLE_DIR / "model_manifest.json"

# Feature columns yang digunakan oleh model SVM dan XGBoost
# Harus sinkron dengan pipeline training (agrisense_ml_prototype.py)
SENSOR_COLS = [
    "CO2 (ppm)", "TVOC (ppb)", "Suhu Udara (°C)", "Kelembapan Udara (%)",
    "Tekanan (hPa)", "Cahaya (Lux)", "Kelembapan Tanah (%)",
    "Suhu Tanah (°C)", "pH Tanah", "N (mg/kg)", "P (mg/kg)", "K (mg/kg)",
    "Baterai (%)", "RSSI (dBm)",
]

ENGINEERED_COLS = [
    "sin_hour", "cos_hour", "sin_dow", "cos_dow", "is_night",
    "vpd_approx", "npk_total", "npk_balance", "ph_sm_interact",
]

# Kolom yang dikenali alias oleh model
ALIAS_MAP = {
    "Suhu Udara (°C)": "Temp (°C)",
    "Kelembapan Udara (%)": "Humidity (%)",
    "Kelembapan Tanah (%)": "Soil Moisture (%)",
    "pH Tanah": "pH",
    "Baterai (%)": "Battery (%)",
}

FORECAST_TARGETS = ["Soil Moisture (%)", "pH"]
FORECAST_HORIZONS = [1, 6, 24]


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def apply_aliases(df: pd.DataFrame) -> pd.DataFrame:
    """Rename kolom ke format yang dikenali model."""
    rename_map = {}
    for original, alias in ALIAS_MAP.items():
        if original in df.columns and alias not in df.columns:
            rename_map[original] = alias
    return df.rename(columns=rename_map)


def predict_tabular(model_path: str, df: pd.DataFrame, feature_cols: list[str]) -> float:
    """Predict menggunakan model SVM atau XGBoost (scikit-learn / xgboost)."""
    model = joblib.load(BUNDLE_DIR / model_path)

    expected_cols = getattr(model, "feature_names_in_", None)
    if expected_cols is not None:
        feature_cols = list(expected_cols)

    # Handle missing columns dengan nilai 0 sebelum subset, supaya payload node
    # yang belum lengkap tetap bisa diproses di server.
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0.0

    # Ambil baris terakhir sebagai input (prediksi 1 titik waktu)
    row = df[feature_cols].iloc[[-1]]

    prediction = model.predict(row)
    return float(prediction[0])


def predict_lstm(device_bundle_path: str, df: pd.DataFrame, device_id: str) -> float | None:
    """Predict menggunakan model LSTM per-device."""
    if not HAS_TORCH:
        return None

    bundle = torch.load(BUNDLE_DIR / device_bundle_path, map_location="cpu")

    feature_cols = bundle["feature_columns"]
    seq_len = int(bundle["seq_len"])

    # Pastikan ada cukup data
    if len(df) < seq_len:
        return None

    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0.0

    X_raw = df[feature_cols].tail(seq_len).to_numpy(dtype=float)

    # Handle NaN
    col_means = np.nanmean(X_raw, axis=0)
    nan_mask = np.isnan(X_raw)
    if nan_mask.any():
        X_raw[nan_mask] = np.take(col_means, np.where(nan_mask)[1])

    # Scale input
    x_mean = np.array(bundle["scaler_X_mean"], dtype=float)
    x_scale = np.array(bundle["scaler_X_scale"], dtype=float)
    scale_safe = np.where(x_scale == 0, 1.0, x_scale)
    X_scaled = (X_raw - x_mean) / scale_safe

    # Reshape ke (1, seq_len, features) dan predict
    X_tensor = torch.tensor(X_scaled[np.newaxis, :, :], dtype=torch.float32)

    # Rebuild model
    from collections import OrderedDict

    class LSTMForecaster(torch.nn.Module):
        def __init__(self, input_size, hidden_size, num_layers):
            super().__init__()
            self.lstm = torch.nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
            self.fc = torch.nn.Linear(hidden_size, 1)

        def forward(self, x):
            out, _ = self.lstm(x)
            return self.fc(out[:, -1, :])

    model = LSTMForecaster(
        input_size=int(bundle["input_size"]),
        hidden_size=int(bundle["hidden_size"]),
        num_layers=int(bundle["num_layers"]),
    )
    model.load_state_dict(bundle["state_dict"])
    model.eval()

    with torch.no_grad():
        pred_scaled = model(X_tensor).squeeze().item()

    # Inverse scale output
    y_mean = float(bundle["scaler_y_mean"][0])
    y_scale = float(bundle["scaler_y_scale"][0])
    y_scale = y_scale if y_scale != 0 else 1.0

    return round(pred_scaled * y_scale + y_mean, 4)


def run_inference(input_path: str, models: list[str], targets: list[str], horizons: list[int]) -> dict:
    """Jalankan inference untuk semua kombinasi model/target/horizon."""
    manifest = load_manifest()

    with open(input_path, "r", encoding="utf-8") as f:
        input_data = json.load(f)

    device_id = input_data["device_id"]
    rows = input_data["rows"]

    if not rows:
        return {"success": False, "error": "Input rows kosong."}

    df = pd.DataFrame(rows)
    df_aliased = apply_aliases(df.copy())

    predictions = []

    for target in targets:
        if target not in manifest["forecast_models"]:
            continue

        for horizon in horizons:
            h_key = str(horizon)
            if h_key not in manifest["forecast_models"][target]:
                continue

            horizon_config = manifest["forecast_models"][target][h_key]

            for model_name in models:
                if model_name not in horizon_config:
                    continue

                try:
                    value = None
                    config = horizon_config[model_name]

                    if model_name in ("svm", "xgboost"):
                        available_cols = [
                            *[ALIAS_MAP.get(c, c) for c in SENSOR_COLS],
                            *ENGINEERED_COLS,
                        ]

                        value = predict_tabular(config["path"], df_aliased, available_cols)

                    elif model_name == "lstm":
                        per_device = config.get("per_device", {})
                        # Cari device path yang cocok
                        device_key = None
                        for key in per_device:
                            if key.upper().replace("-", "_") in device_id.upper().replace("-", "_") or \
                               device_id.upper().replace("-", "_") in key.upper().replace("-", "_"):
                                device_key = key
                                break

                        if device_key:
                            value = predict_lstm(per_device[device_key], df_aliased, device_id)

                    if value is not None:
                        predictions.append({
                            "model": model_name,
                            "target": target,
                            "horizon_hours": horizon,
                            "predicted_value": round(value, 4),
                        })

                except Exception as e:
                    predictions.append({
                        "model": model_name,
                        "target": target,
                        "horizon_hours": horizon,
                        "predicted_value": None,
                        "error": str(e),
                    })

    return {
        "success": True,
        "device_id": device_id,
        "prediction_count": len([p for p in predictions if p.get("predicted_value") is not None]),
        "predictions": predictions,
    }


def main():
    parser = argparse.ArgumentParser(description="AgriSense ML Inference")
    parser.add_argument("input_json", help="Path ke file JSON input")
    parser.add_argument("--models", default="svm,xgboost,lstm", help="Model yang dijalankan (comma-separated)")
    parser.add_argument("--targets", default="Soil Moisture (%),pH", help="Target prediksi (comma-separated)")
    parser.add_argument("--horizons", default="1,6,24", help="Horizon prediksi dalam jam (comma-separated)")

    args = parser.parse_args()

    models = [m.strip() for m in args.models.split(",")]
    targets = [t.strip() for t in args.targets.split(",")]
    horizons = [int(h.strip()) for h in args.horizons.split(",")]

    try:
        result = run_inference(args.input_json, models, targets, horizons)
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        error_output = {
            "success": False,
            "error": traceback.format_exc(),
        }
        print(json.dumps(error_output, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
