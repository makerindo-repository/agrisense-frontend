"""
Stateless inference runner for the latest sintetik_90 AgriSense models.

Input JSON is produced by Laravel AiDataFormatter and must contain "rows".
The latest bundle is single-step: it does not provide explicit 1h/6h/24h
horizons, so results are stored with horizon_hours = 0.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
import warnings
from pathlib import Path
from typing import Any

warnings.filterwarnings("ignore", category=UserWarning)

joblib = None
np = None
pd = None
keras = None

BUNDLE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BUNDLE_DIR / "artifacts" / "sintetik_90"
HORIZON_HOURS = 0

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

TARGETS = {
    "co2_ppm": "CO2 (ppm)",
    "nee_agrisense": "Carbon Flux (NEE AgriSense)",
    "carbon_potential_score": "Carbon Potential Score",
}


def _ensure_keras_imported() -> None:
    """Import TensorFlow/Keras before tabular native libs on Windows.

    On the current Windows/Python 3.13 runtime, importing joblib/numpy/pandas
    before TensorFlow can make TensorFlow's native DLL initialization fail.
    """
    global keras
    if keras is None:
        from tensorflow import keras as keras_module

        keras = keras_module


def _ensure_tabular_imports() -> None:
    global joblib, np, pd
    if joblib is None:
        import joblib as joblib_module

        joblib = joblib_module
    if np is None:
        import numpy as np_module

        np = np_module
    if pd is None:
        import pandas as pd_module

        pd = pd_module


def _load_input(input_path: str) -> pd.DataFrame:
    _ensure_tabular_imports()

    with open(input_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    rows = payload.get("rows") or []
    if not rows:
        raise ValueError("Input rows kosong.")

    df = pd.DataFrame(rows)
    
    # ── Strategi 1: Hitung Lag dan Rolling Features ──
    # Jika rows hanya 1 baris, bfill() akan mengisi dengan nilai baris itu sendiri
    if 'suhu_udara' in df.columns:
        df['suhu_udara_lag1'] = df['suhu_udara'].shift(2).bfill()
        df['suhu_udara_roll6'] = df['suhu_udara'].rolling(window=12, min_periods=1).mean()
        
    if 'CO2 (ppm)' in df.columns:
        df['co2_lag1'] = df['CO2 (ppm)'].shift(2).bfill()
    else:
        df['co2_lag1'] = 400.0

    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = 0.0

    return df[FEATURE_COLS].replace([np.inf, -np.inf], np.nan).fillna(0.0)


def _predict_svm(df: pd.DataFrame) -> list[dict[str, Any]]:
    _ensure_tabular_imports()

    latest = df.tail(1).to_numpy(dtype=float)
    predictions: list[dict[str, Any]] = []

    # Cek apakah scaler SVM baru dari Kaggle ada
    scaler_path = MODEL_DIR / "svm_feature_scaler.joblib"
    if scaler_path.is_file():
        scaler_X = joblib.load(scaler_path)
        x_scaled = scaler_X.transform(latest)
        
        for key, label in TARGETS.items():
            model_path = MODEL_DIR / f"svm_model_{label}.joblib"
            if not model_path.is_file():
                continue
            model = joblib.load(model_path)
            # SVM yang dilatih langsung dengan target asli tanpa target_scaler
            value = model.predict(x_scaled)[0]
            predictions.append(_prediction("svm", label, value))
            
        if predictions:
            return predictions

    # Fallback ke bundel lama (jika model baru tidak ditemukan)
    path = MODEL_DIR / "svm_model.pkl"
    if not path.is_file():
        raise FileNotFoundError(f"SVM model not found: {path}")

    bundle = joblib.load(path)
    for key, label in TARGETS.items():
        package = bundle.get(key)
        if not package:
            continue

        x_scaled = package["scaler_X"].transform(latest)
        y_scaled = package["model"].predict(x_scaled).reshape(-1, 1)
        value = package["scaler_y"].inverse_transform(y_scaled)[0, 0]
        predictions.append(_prediction("svm", label, value))

    return predictions


def _predict_xgboost(df: pd.DataFrame) -> list[dict[str, Any]]:
    _ensure_tabular_imports()

    latest = df.tail(1).to_numpy(dtype=float)
    predictions: list[dict[str, Any]] = []

    # ── Strategi 1: Model baru per-target (dari FLUXNET training) ──
    scaler_path = MODEL_DIR / "scaler_X.joblib"
    has_new_models = scaler_path.is_file()

    if has_new_models:
        scaler_X = joblib.load(scaler_path)
        latest_scaled = scaler_X.transform(latest)

        for key, label in TARGETS.items():
            model_path = MODEL_DIR / f"xgboost_{key}.joblib"
            if not model_path.is_file():
                continue
            model = joblib.load(model_path)
            value = model.predict(latest_scaled)[0]
            predictions.append(_prediction("xgboost", label, value))

        if predictions:
            return predictions

    # ── Strategi 2: Fallback ke bundel lama (xgboost_model.pkl) ──
    legacy_path = MODEL_DIR / "xgboost_model.pkl"
    if not legacy_path.is_file():
        raise FileNotFoundError(
            f"XGBoost model not found (neither new per-target nor legacy bundle)"
        )

    bundle = joblib.load(legacy_path)
    for key, label in TARGETS.items():
        model = bundle.get(key)
        if not model:
            continue
        value = model.predict(latest)[0]
        predictions.append(_prediction("xgboost", label, value))

    return predictions


def _predict_lstm(df: pd.DataFrame) -> list[dict[str, Any]]:
    _ensure_keras_imported()
    _ensure_tabular_imports()

    predictions: list[dict[str, Any]] = []
    
    # Kaggle scaler
    feature_scaler_path = MODEL_DIR / "lstm_feature_scaler.joblib"
    if not feature_scaler_path.is_file():
        raise FileNotFoundError("LSTM feature scaler not found.")
        
    feature_scaler = joblib.load(feature_scaler_path)
    seq_len = 24 # Harcoded sesuai skrip Kaggle

    if len(df) < seq_len:
        return []

    # Ambil features
    seq = df[FEATURE_COLS].tail(seq_len).to_numpy(dtype=float)
    x_scaled = feature_scaler.transform(seq).reshape(1, seq_len, len(FEATURE_COLS))

    # Loop setiap target
    for key, label in TARGETS.items():
        model_path = MODEL_DIR / f"lstm_model_{label}_h24.keras"
        target_scaler_path = MODEL_DIR / f"lstm_target_scaler_{label}.joblib"
        
        if not model_path.is_file() or not target_scaler_path.is_file():
            continue
            
        model = keras.models.load_model(model_path, compile=False)
        target_scaler = joblib.load(target_scaler_path)
        
        y_scaled = model.predict(x_scaled, verbose=0)
        value = target_scaler.inverse_transform(y_scaled)[0][0]
        
        # Override horizon_hours menjadi 24 khusus untuk LSTM
        predictions.append({
            "model": "lstm",
            "target": label,
            "horizon_hours": 24,
            "predicted_value": round(float(value), 4),
        })

    return predictions


def _prediction(model: str, target: str, value: Any) -> dict[str, Any]:
    return {
        "model": model,
        "target": target,
        "horizon_hours": HORIZON_HOURS,
        "predicted_value": round(float(value), 4),
    }


def run_inference(input_path: str, models: list[str]) -> dict[str, Any]:
    requested = {m.strip().lower() for m in models if m.strip()}
    errors: list[dict[str, str]] = []
    if "lstm" in requested:
        try:
            _ensure_keras_imported()
        except Exception as exc:
            errors.append({"model": "lstm", "error": str(exc)})
            requested.discard("lstm")

    df = _load_input(input_path)
    predictions: list[dict[str, Any]] = []

    runners = {
        "svm": _predict_svm,
        "xgboost": _predict_xgboost,
        "lstm": _predict_lstm,
    }

    for model_name, runner in runners.items():
        if model_name not in requested:
            continue

        try:
            predictions.extend(runner(df))
        except Exception as exc:
            errors.append({"model": model_name, "error": str(exc)})

    return {
        "success": True,
        "bundle": "sintetik_90",
        "horizon_hours": HORIZON_HOURS,
        "prediction_count": len(predictions),
        "predictions": predictions,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="AgriSense sintetik_90 inference")
    parser.add_argument("input_json", help="Path to Laravel-generated input JSON")
    parser.add_argument("--models", default="svm,xgboost,lstm", help="Comma-separated models")
    args = parser.parse_args()

    try:
        result = run_inference(args.input_json, args.models.split(","))
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        print(json.dumps({"success": False, "error": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
