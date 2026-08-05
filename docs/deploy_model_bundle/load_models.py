from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib

try:
    import torch
except ImportError:  # pragma: no cover
    torch = None


class ModelBundle:
    def __init__(self, bundle_dir: str | Path | None = None) -> None:
        self.bundle_dir = Path(bundle_dir) if bundle_dir else Path(__file__).resolve().parent
        self.manifest_path = self.bundle_dir / "model_manifest.json"
        self.manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        self.loaded: dict[str, Any] = {
            "forecast": {},
            "classifier": None,
        }

    def _resolve(self, relative_path: str) -> Path:
        return self.bundle_dir / relative_path

    def load_classifier(self) -> Any:
        classifier_path = self._resolve(self.manifest["classifier"]["path"])
        model = joblib.load(classifier_path)
        self.loaded["classifier"] = model
        return model

    def load_forecast_model(self, target: str, horizon_hours: int, model_name: str) -> Any:
        target_config = self.manifest["forecast_models"][target][str(horizon_hours)][model_name]
        cache_key = f"{target}|{horizon_hours}|{model_name}"
        if cache_key in self.loaded["forecast"]:
            return self.loaded["forecast"][cache_key]

        if model_name == "lstm":
            if torch is None:
                raise RuntimeError("torch belum tersedia. Install dependency dari requirements.txt.")
            model = {
                device_id: torch.load(self._resolve(path), map_location="cpu")
                for device_id, path in target_config["per_device"].items()
            }
        else:
            model = joblib.load(self._resolve(target_config["path"]))

        self.loaded["forecast"][cache_key] = model
        return model

    def load_all(self) -> None:
        self.load_classifier()
        for target, target_payload in self.manifest["forecast_models"].items():
            for horizon_hours, horizon_payload in target_payload.items():
                for model_name in horizon_payload.keys():
                    self.load_forecast_model(target, int(horizon_hours), model_name)

    def get_forecast_models(self, target: str, horizon_hours: int) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for model_name in self.manifest["forecast_models"][target][str(horizon_hours)].keys():
            result[model_name] = self.load_forecast_model(target, horizon_hours, model_name)
        return result

    def get_condition_classifier(self) -> Any:
        if self.loaded["classifier"] is None:
            return self.load_classifier()
        return self.loaded["classifier"]


if __name__ == "__main__":
    bundle = ModelBundle()
    bundle.load_all()
    print("Bundle loaded successfully.")
    print("Available targets:", ", ".join(bundle.manifest["forecast_models"].keys()))
