"""
=============================================================
AUDIT KESIAPAN PRESENTASI (Pre-Demo Checklist)
=============================================================
Tes ini mensimulasikan semua skenario yang mungkin terjadi saat
Anda demo di depan dosen penguji. Jika ada satu saja yang gagal,
JANGAN presentasikan dulu sampai diperbaiki.

Kategori Tes:
A. File & Infrastruktur (Apakah semua file model ada?)
B. Kewarasan Prediksi (Apakah prediksi masuk akal di 50+ skenario?)
C. Robustness (Apakah model tahan input aneh?)
D. Performa (Seberapa cepat model menjawab?)
E. Kompatibilitas Laravel (Apakah format output sesuai?)
"""
import pandas as pd
import numpy as np
import json
import subprocess
import sys
import os
import time
import joblib

BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts", "sintetik_90")
DATA_FILE = os.path.join(BASE_DIR, "fluxnet_indonesia_32features.csv")
SCRIPT_PATH = os.path.join(BASE_DIR, "run_sintetik90_inference.py")

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

results = []  # (kategori, nama_tes, status, detail)

def log(cat, name, passed, detail=""):
    results.append((cat, name, passed, detail))
    sym = "LULUS" if passed else "GAGAL"
    print(f"  [{sym}] {name}")
    if detail and not passed:
        print(f"         -> {detail}")

def call_inference(rows_data):
    input_data = {
        "device_id": "AGRISENSE-AUDIT", "device_db_id": 1,
        "row_count": len(rows_data),
        "latest_reading_time": "2026-06-13T12:00:00+07:00",
        "current_values": {}, "rows": rows_data,
    }
    f = os.path.join(BASE_DIR, "_presentasi_audit.json")
    with open(f, "w") as fh:
        json.dump(input_data, fh)
    r = subprocess.run(
        [sys.executable, SCRIPT_PATH, f, "--models", "xgboost"],
        capture_output=True, text=True, cwd=BASE_DIR
    )
    if os.path.exists(f):
        os.remove(f)
    if r.returncode != 0:
        return None, r.stderr[:300]
    return json.loads(r.stdout), None

def make_row(**overrides):
    row = {c: 0.0 for c in FEATURE_COLS}
    # Default realistis Indonesia
    defaults = {
        'suhu_udara': 28.0, 'kelembapan_udara': 75.0, 'tekanan_hpa': 1010.0,
        'cahaya_lux': 35000.0, 'kelembapan_tanah': 32.0, 'suhu_tanah': 26.5,
        'ph_tanah': 6.3, 'tvoc_ppb': 150.0, 'n_mg_kg': 180.0, 'p_mg_kg': 35.0,
        'k_mg_kg': 180.0, 'epsilon': 1.1, 'fapar': 0.6, 'par': 647.5,
        't_scalar': 0.85, 'w_scalar': 0.53, 'c_scalar': 0.99,
        'gpp': 0.5, 'reco': 0.18, 'npp': 0.23,
        'soc_baseline_gC_m2': 5850.0, 'c_biomass_acc': 10.0,
        'c_current': 5860.0, 'c_max': 7900.0,
        'elapsed_hours': 1.0, 'hour_sin': 0.5, 'hour_cos': 0.87,
        'dow_sin': 0.78, 'dow_cos': -0.22,
        'is_daytime': 1, 'is_cabai': 1, 'has_full_data': 1,
    }
    row.update(defaults)
    row.update(overrides)
    return row

print("=" * 70)
print("AUDIT KESIAPAN PRESENTASI / DEMO")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════
# A. FILE & INFRASTRUKTUR
# ═══════════════════════════════════════════════════════════════
print("\n[A] FILE & INFRASTRUKTUR")

required_files = {
    'Script Inference': SCRIPT_PATH,
    'Scaler X': os.path.join(ARTIFACTS_DIR, 'scaler_X.joblib'),
    'XGB CO2': os.path.join(ARTIFACTS_DIR, 'xgboost_co2_ppm.joblib'),
    'XGB NEE': os.path.join(ARTIFACTS_DIR, 'xgboost_nee_agrisense.joblib'),
    'XGB CPS': os.path.join(ARTIFACTS_DIR, 'xgboost_carbon_potential_score.joblib'),
    'XGB SM': os.path.join(ARTIFACTS_DIR, 'xgboost_kelembapan_tanah.joblib'),
    'XGB pH': os.path.join(ARTIFACTS_DIR, 'xgboost_ph_tanah.joblib'),
    'Dataset Training': DATA_FILE,
}

for name, path in required_files.items():
    exists = os.path.exists(path)
    size = os.path.getsize(path) if exists else 0
    log("A", f"{name} ({os.path.basename(path)}, {size//1024}KB)", exists,
        f"File tidak ditemukan: {path}" if not exists else "")

# Cek scaler bisa di-load
try:
    scaler = joblib.load(os.path.join(ARTIFACTS_DIR, 'scaler_X.joblib'))
    n_features = scaler.n_features_in_
    log("A", f"Scaler X: {n_features} fitur (harus 32)", n_features == 32,
        f"Scaler punya {n_features} fitur, seharusnya 32!")
except Exception as e:
    log("A", "Scaler X loadable", False, str(e))

# Cek setiap model bisa di-load
for mname in ['co2_ppm', 'nee_agrisense', 'carbon_potential_score',
              'kelembapan_tanah', 'ph_tanah']:
    try:
        m = joblib.load(os.path.join(ARTIFACTS_DIR, f'xgboost_{mname}.joblib'))
        log("A", f"Model {mname} loadable", True)
    except Exception as e:
        log("A", f"Model {mname} loadable", False, str(e))

# ═══════════════════════════════════════════════════════════════
# B. KEWARASAN PREDIKSI (30+ Skenario)
# ═══════════════════════════════════════════════════════════════
print("\n[B] KEWARASAN PREDIKSI")

# Batas wajar untuk setiap target
BOUNDS = {
    'CO2 (ppm)': (300, 700),
    'Carbon Flux (NEE AgriSense)': (-40, 25),
    'Carbon Potential Score': (0, 1),
    'Soil Moisture (%)': (0, 100),
    'pH Tanah': (3, 10),
}

scenarios = [
    ("Siang cerah normal", make_row(cahaya_lux=45000, suhu_udara=30, is_daytime=1)),
    ("Pagi mendung", make_row(cahaya_lux=8000, suhu_udara=24, is_daytime=1)),
    ("Malam gelap", make_row(cahaya_lux=0, suhu_udara=22, is_daytime=0, par=0, gpp=0, npp=0)),
    ("Siang terik panas", make_row(cahaya_lux=100000, suhu_udara=37, is_daytime=1)),
    ("Tanah kering", make_row(kelembapan_tanah=10, w_scalar=0.17)),
    ("Tanah basah", make_row(kelembapan_tanah=55, w_scalar=0.92)),
    ("pH rendah (asam)", make_row(ph_tanah=5.0)),
    ("pH tinggi (basa)", make_row(ph_tanah=7.5)),
    ("CO2 tinggi", make_row(c_scalar=1.3)),
    ("CO2 rendah", make_row(c_scalar=0.7)),
    ("Tanaman NON-cabai", make_row(is_cabai=0)),
    ("Data parsial", make_row(has_full_data=0)),
    ("Suhu dingin", make_row(suhu_udara=18, suhu_tanah=18, t_scalar=0.3)),
    ("NPK rendah", make_row(n_mg_kg=50, p_mg_kg=5, k_mg_kg=30)),
    ("NPK tinggi", make_row(n_mg_kg=400, p_mg_kg=100, k_mg_kg=450)),
]

for scenario_name, row in scenarios:
    rows_data = [row] * 5  # 5 baris identik
    output, err = call_inference(rows_data)
    
    if err or not output or not output.get('success'):
        log("B", f"{scenario_name}: inference berjalan", False, str(err)[:200])
        continue
    
    all_in_bounds = True
    bad_detail = ""
    for pred in output.get('predictions', []):
        t = pred['target']
        v = pred['predicted_value']
        lo, hi = BOUNDS.get(t, (-1e9, 1e9))
        if not (lo <= v <= hi) or not np.isfinite(v):
            all_in_bounds = False
            bad_detail += f"{t}={v:.2f} (batas {lo}-{hi}); "
    
    log("B", f"{scenario_name}", all_in_bounds, bad_detail)

# ═══════════════════════════════════════════════════════════════
# C. ROBUSTNESS (Tahan Banting)
# ═══════════════════════════════════════════════════════════════
print("\n[C] ROBUSTNESS (Tahan Banting)")

# C1. Input semua nol
rows_zero = [{c: 0.0 for c in FEATURE_COLS}] * 5
output, err = call_inference(rows_zero)
if output and output.get('success'):
    finite = all(np.isfinite(p['predicted_value']) for p in output.get('predictions', []))
    log("C", "Input semua 0 -> tidak crash", finite)
else:
    log("C", "Input semua 0 -> tidak crash", False, str(err)[:200])

# C2. Input negatif
rows_neg = [{c: -999.0 for c in FEATURE_COLS}] * 5
output, err = call_inference(rows_neg)
if output and output.get('success'):
    finite = all(np.isfinite(p['predicted_value']) for p in output.get('predictions', []))
    log("C", "Input negatif (-999) -> tidak crash", finite)
else:
    log("C", "Input negatif (-999) -> tidak crash", False, str(err)[:200])

# C3. Input sangat besar
rows_big = [{c: 999999.0 for c in FEATURE_COLS}] * 5
output, err = call_inference(rows_big)
if output and output.get('success'):
    finite = all(np.isfinite(p['predicted_value']) for p in output.get('predictions', []))
    log("C", "Input sangat besar (999999) -> tidak crash", finite)
else:
    log("C", "Input sangat besar (999999) -> tidak crash", False, str(err)[:200])

# C4. Hanya 1 baris (minimum)
rows_one = [make_row()]
output, err = call_inference(rows_one)
if output and output.get('success'):
    log("C", "Input 1 baris saja -> tidak crash", True)
else:
    log("C", "Input 1 baris saja -> tidak crash", False, str(err)[:200])

# ═══════════════════════════════════════════════════════════════
# D. PERFORMA (Kecepatan)
# ═══════════════════════════════════════════════════════════════
print("\n[D] PERFORMA (Kecepatan)")

rows_data = [make_row()] * 5
times = []
for _ in range(3):
    t0 = time.time()
    output, err = call_inference(rows_data)
    elapsed = time.time() - t0
    times.append(elapsed)

avg_time = np.mean(times)
max_time = np.max(times)
log("D", f"Waktu rata-rata: {avg_time:.1f}s (Batas: <10s)", avg_time < 10,
    f"Terlalu lambat: {avg_time:.1f}s")
log("D", f"Waktu terburuk: {max_time:.1f}s (Batas: <15s)", max_time < 15,
    f"Terlalu lambat: {max_time:.1f}s")

# ═══════════════════════════════════════════════════════════════
# E. KOMPATIBILITAS FORMAT OUTPUT (Laravel)
# ═══════════════════════════════════════════════════════════════
print("\n[E] KOMPATIBILITAS FORMAT OUTPUT (Laravel)")

rows_data = [make_row()] * 5
output, err = call_inference(rows_data)

if output:
    # Cek field wajib yang Laravel harapkan
    log("E", "Field 'success' ada", 'success' in output)
    log("E", "Field 'predictions' ada", 'predictions' in output)
    log("E", "Field 'bundle' ada", 'bundle' in output)
    log("E", "Field 'errors' ada", 'errors' in output)
    
    if output.get('predictions'):
        p = output['predictions'][0]
        log("E", "Prediksi punya 'model'", 'model' in p)
        log("E", "Prediksi punya 'target'", 'target' in p)
        log("E", "Prediksi punya 'predicted_value'", 'predicted_value' in p)
        log("E", "Prediksi punya 'horizon_hours'", 'horizon_hours' in p)
        
        # Cek nama target cocok dengan yang Laravel harapkan
        expected_targets = {
            'CO2 (ppm)', 'Carbon Flux (NEE AgriSense)',
            'Carbon Potential Score', 'Soil Moisture (%)', 'pH Tanah'
        }
        actual_targets = {p['target'] for p in output['predictions']}
        missing = expected_targets - actual_targets
        log("E", f"Semua 5 target ada dalam output", len(missing) == 0,
            f"Target hilang: {missing}" if missing else "")
else:
    log("E", "Output bisa di-parse JSON", False, str(err)[:200])

# ═══════════════════════════════════════════════════════════════
# RINGKASAN
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("RINGKASAN AUDIT KESIAPAN PRESENTASI")
print("=" * 70)

categories = {}
for cat, name, passed, detail in results:
    if cat not in categories:
        categories[cat] = {'lulus': 0, 'gagal': 0}
    if passed:
        categories[cat]['lulus'] += 1
    else:
        categories[cat]['gagal'] += 1

total_lulus = sum(c['lulus'] for c in categories.values())
total_gagal = sum(c['gagal'] for c in categories.values())
total = total_lulus + total_gagal

print(f"\n{'Kategori':<40} {'Lulus':>6} {'Gagal':>6}")
print("-" * 55)
cat_names = {
    'A': 'File & Infrastruktur',
    'B': 'Kewarasan Prediksi',
    'C': 'Robustness (Tahan Banting)',
    'D': 'Performa (Kecepatan)',
    'E': 'Kompatibilitas Laravel',
}
for cat, counts in categories.items():
    cname = cat_names.get(cat, cat)
    print(f"  {cname:<38} {counts['lulus']:>6} {counts['gagal']:>6}")

print("-" * 55)
print(f"  {'TOTAL':<38} {total_lulus:>6} {total_gagal:>6}")
print(f"\n  Tingkat Kelulusan: {total_lulus}/{total} ({total_lulus/total*100:.0f}%)")

if total_gagal == 0:
    print("\n  KESIMPULAN: SISTEM 100% SIAP UNTUK PRESENTASI!")
else:
    print(f"\n  PERINGATAN: {total_gagal} tes gagal. Perbaiki sebelum demo!")
    print("\n  Detail kegagalan:")
    for cat, name, passed, detail in results:
        if not passed:
            print(f"    [{cat}] {name}")
            if detail:
                print(f"         {detail}")
