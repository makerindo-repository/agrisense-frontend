from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, mean_absolute_error, mean_squared_error, r2_score

from load_models import ModelBundle


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import agrisense_ml_prototype as amp


DEFAULT_DATASET = ROOT_DIR / "dataset" / "AgriSense_Data_Historis_All_Nodes_20260506.csv"
OUTPUT_JSON = Path(__file__).resolve().parent / "evaluation_historical_20260506.json"


def _safe_scale(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    scale_safe = np.where(scale == 0, 1.0, scale)
    return (values - mean) / scale_safe


def _safe_inverse_scale(values: np.ndarray, mean: np.ndarray, scale: np.ndarray) -> np.ndarray:
    scale_safe = np.where(scale == 0, 1.0, scale)
    return values * scale_safe + mean


def evaluate_tabular_forecasts(
    bundle: ModelBundle,
    label_df: pd.DataFrame,
) -> dict[str, list[dict[str, Any]]]:
    results: dict[str, list[dict[str, Any]]] = {
        "svm": [],
        "xgboost": [],
    }
    for target in amp.FORECAST_TARGETS:
        for horizon in amp.FORECAST_HORIZONS:
            dataset = amp.prepare_forecast_data(label_df, target, horizon)
            feature_cols = dataset["feature_cols"]
            test_df = dataset["test_df"]
            actual = test_df[dataset["target_col"]].to_numpy(dtype=float)

            for model_name in ("svm", "xgboost"):
                model = bundle.load_forecast_model(target, horizon, model_name)
                pred = model.predict(test_df[feature_cols])
                metrics = {
                    "model": model_name.upper() if model_name == "svm" else "XGBoost",
                    "target": target,
                    "horizon_hours": horizon,
                    "rows_used": int(len(dataset["model_df"])),
                    "test_rows": int(len(test_df)),
                    "MAE": round(float(mean_absolute_error(actual, pred)), 4),
                    "RMSE": round(float(mean_squared_error(actual, pred) ** 0.5), 4),
                    "MAPE_pct": round(float(np.mean(np.abs((actual - pred) / (np.abs(actual) + 1e-8))) * 100), 2),
                    "R2": round(float(r2_score(actual, pred)), 4),
                }
                results[model_name].append(metrics)
    return results


def evaluate_lstm_forecasts(
    bundle: ModelBundle,
    label_df: pd.DataFrame,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    if not amp.HAS_TORCH:
        return results

    for target in amp.FORECAST_TARGETS:
        for horizon in amp.FORECAST_HORIZONS:
            lstm_models = bundle.load_forecast_model(target, horizon, "lstm")
            per_device: list[dict[str, Any]] = []

            for device_id, device_bundle in lstm_models.items():
                gdf = label_df[label_df["Device ID"] == device_id].sort_values("Timestamp").copy()
                feature_cols = device_bundle["feature_columns"]
                target_col = f"target_{target}_h{horizon}"
                if target_col not in gdf.columns:
                    target_col = f"target_{target}_h1"

                X_raw = gdf[feature_cols].to_numpy(dtype=float).copy()
                y_raw = gdf[target_col].to_numpy(dtype=float).copy()

                col_means = np.nanmean(X_raw, axis=0)
                nan_mask = np.isnan(X_raw)
                X_raw[nan_mask] = np.take(col_means, np.where(nan_mask)[1])

                valid_mask = ~np.isnan(y_raw)
                X_raw = X_raw[valid_mask]
                y_raw = y_raw[valid_mask]

                seq_len = int(device_bundle["seq_len"])
                if len(X_raw) < seq_len + 10:
                    continue

                x_mean = np.array(device_bundle["scaler_X_mean"], dtype=float)
                x_scale = np.array(device_bundle["scaler_X_scale"], dtype=float)
                y_mean = np.array(device_bundle["scaler_y_mean"], dtype=float)
                y_scale = np.array(device_bundle["scaler_y_scale"], dtype=float)

                X_scaled = _safe_scale(X_raw, x_mean, x_scale)
                y_scaled = _safe_scale(y_raw.reshape(-1, 1), y_mean, y_scale).ravel()

                X_seq, y_seq = [], []
                for i in range(seq_len, len(X_scaled)):
                    X_seq.append(X_scaled[i - seq_len: i])
                    y_seq.append(y_scaled[i])

                X_seq = np.array(X_seq, dtype=np.float32)
                y_seq = np.array(y_seq, dtype=np.float32)
                split = int(len(X_seq) * 0.8)
                X_te = amp.torch.tensor(X_seq[split:])
                y_te = y_seq[split:]

                model = amp.LSTMForecaster(
                    input_size=int(device_bundle["input_size"]),
                    hidden_size=int(device_bundle["hidden_size"]),
                    num_layers=int(device_bundle["num_layers"]),
                )
                model.load_state_dict(device_bundle["state_dict"])
                model.eval()

                with amp.torch.no_grad():
                    pred_scaled = model(X_te).squeeze().numpy()

                pred = _safe_inverse_scale(pred_scaled.reshape(-1, 1), y_mean, y_scale).ravel()
                actual = _safe_inverse_scale(y_te.reshape(-1, 1), y_mean, y_scale).ravel()

                per_device.append(
                    {
                        "device_id": device_id,
                        "MAE": round(float(mean_absolute_error(actual, pred)), 4),
                        "RMSE": round(float(mean_squared_error(actual, pred) ** 0.5), 4),
                        "MAPE_pct": round(float(np.mean(np.abs((actual - pred) / (np.abs(actual) + 1e-8))) * 100), 2),
                        "R2": round(float(r2_score(actual, pred)), 4),
                    }
                )

            if per_device:
                results.append(
                    {
                        "model": "LSTM",
                        "target": target,
                        "horizon_hours": horizon,
                        "per_device": per_device,
                        "avg_MAE": round(float(np.mean([item["MAE"] for item in per_device])), 4),
                        "avg_RMSE": round(float(np.mean([item["RMSE"] for item in per_device])), 4),
                        "avg_MAPE_pct": round(float(np.mean([item["MAPE_pct"] for item in per_device])), 2),
                        "avg_R2": round(float(np.mean([item["R2"] for item in per_device])), 4),
                    }
                )

    return results


def evaluate_classifier(bundle: ModelBundle, label_df: pd.DataFrame) -> dict[str, Any]:
    clf = bundle.get_condition_classifier()
    model_df = label_df.sort_values("Timestamp").copy()
    feature_cols = (
        ["Device ID"]
        + amp.SENSOR_COLS
        + ["sin_hour", "cos_hour", "sin_dow", "cos_dow", "is_night", "vpd_approx", "npk_total", "npk_balance", "ph_sm_interact"]
    )
    feature_cols = [c for c in feature_cols if c in model_df.columns]
    split_index = int(len(model_df) * 0.8)
    test_df = model_df.iloc[split_index:]
    pred = clf.predict(test_df[feature_cols])
    report = classification_report(test_df["condition_label"], pred, output_dict=True, zero_division=0)
    return {
        "rows_used": int(len(model_df)),
        "test_rows": int(len(test_df)),
        "accuracy": round(float(report["accuracy"]), 4),
        "macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
        "weighted_f1": round(float(report["weighted avg"]["f1-score"]), 4),
        "classification_report": report,
    }


def main() -> None:
    dataset_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_DATASET
    bundle = ModelBundle(Path(__file__).resolve().parent)

    df = amp.load_agrisense_csv(dataset_path)
    modeling_df = amp.regularize_hourly_timeseries(df)
    feature_df = amp.add_features(modeling_df)
    feature_df = amp.detect_anomalies(feature_df)
    label_df, weak_label_bounds = amp.make_condition_labels(feature_df)
    drift = amp.detect_drift(label_df)

    tabular = evaluate_tabular_forecasts(bundle, label_df)
    lstm = evaluate_lstm_forecasts(bundle, label_df)
    classifier = evaluate_classifier(bundle, label_df)

    result = {
        "dataset_path": str(dataset_path),
        "raw_shape": list(df.shape),
        "modeling_shape": list(modeling_df.shape),
        "anomaly_rate_pct": round(float(label_df["is_anomaly"].mean()) * 100, 2),
        "drift_detection_psi": drift,
        "weak_label_bounds": weak_label_bounds,
        "forecast_evaluation": {
            "svm": tabular["svm"],
            "xgboost": tabular["xgboost"],
            "lstm": lstm,
        },
        "condition_classifier_evaluation": classifier,
    }

    OUTPUT_JSON.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nSaved evaluation -> {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
