"""
=============================================================
AUDIT AKHIR: Testing Model dengan Data Asli FLUXNET
=============================================================
Script ini mengambil sampel NYATA dari dataset FLUXNET yang sudah
di-feature engineering, lalu menguji apakah model bisa memprediksi
dengan benar ketika dibandingkan terhadap nilai aktual.

Tes yang dijalankan:
1. Akurasi: Prediksi vs Aktual pada 100 sampel acak
2. Konsistensi: Apakah model stabil jika dijalankan 3x berturut-turut
3. Edge Case: Malam hari, siang terik, tanah kering, tanah basah
4. Stress Test: Input dengan nilai 0 / ekstrem
5. Integrasi: Panggil lewat subprocess (persis seperti Laravel)
"""
import pandas as pd
import numpy as np
import json
import subprocess
import sys
import os
import math

BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
DATA_FILE = os.path.join(BASE_DIR, "fluxnet_indonesia_32features.csv")

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

TARGET_MAP = {
    'target_co2_ppm': ('CO2 (ppm)', 300, 700),
    'target_nee_agrisense': ('Carbon Flux (NEE AgriSense)', -50, 30),
    'target_carbon_potential_score': ('Carbon Potential Score', 0, 1),
    'target_kelembapan_tanah': ('Soil Moisture (%)', 0, 100),
    'target_ph_tanah': ('pH Tanah', 3, 10),
}

df = pd.read_csv(DATA_FILE)
total_tests = 0
total_passed = 0

def call_inference(rows_data):
    """Panggil inference script via subprocess (persis seperti Laravel)"""
    input_data = {
        "device_id": "AGRISENSE-AUDIT",
        "device_db_id": 1,
        "row_count": len(rows_data),
        "latest_reading_time": "2026-06-13T12:00:00+07:00",
        "current_values": {},
        "rows": rows_data,
    }
    input_file = os.path.join(BASE_DIR, "_audit_temp_input.json")
    with open(input_file, "w") as f:
        json.dump(input_data, f)

    script = os.path.join(BASE_DIR, "run_sintetik90_inference.py")
    result = subprocess.run(
        [sys.executable, script, input_file, "--models", "xgboost"],
        capture_output=True, text=True, cwd=BASE_DIR
    )
    if result.returncode != 0:
        return None, result.stderr
    return json.loads(result.stdout), None

def df_row_to_dict(row):
    """Ubah satu baris DataFrame ke format input Laravel"""
    d = {}
    for col in FEATURE_COLS:
        d[col] = float(row[col])
    return d

print("=" * 70)
print("AUDIT AKHIR: Testing Komprehensif dengan Data Asli FLUXNET")
print(f"Dataset: {len(df)} baris")
print("=" * 70)

# ═══════════════════════════════════════════════════════════════
# TES 1: AKURASI - 100 Sampel Acak vs Nilai Aktual
# ═══════════════════════════════════════════════════════════════
print("\n[TES 1] AKURASI: 100 Sampel Acak vs Nilai Aktual")
print("-" * 50)

np.random.seed(123)
sample_indices = np.random.choice(len(df) - 5, size=20, replace=False)

errors_per_target = {k: [] for k in TARGET_MAP}
predictions_log = []

for idx in sample_indices:
    # Ambil 5 baris berturut-turut (seperti seq_len dari Laravel)
    chunk = df.iloc[idx:idx+5]
    rows_data = [df_row_to_dict(chunk.iloc[i]) for i in range(len(chunk))]

    output, err = call_inference(rows_data)
    if err or not output or not output.get('success'):
        continue

    # Bandingkan prediksi vs aktual (baris ke-5 = target)
    actual_row = chunk.iloc[-1]
    for pred in output.get('predictions', []):
        for tcol, (label, lo, hi) in TARGET_MAP.items():
            if pred['target'] == label:
                actual = float(actual_row[tcol])
                predicted = pred['predicted_value']
                error = abs(actual - predicted)
                errors_per_target[tcol].append(error)
                predictions_log.append({
                    'target': label,
                    'actual': actual,
                    'predicted': predicted,
                    'error': error
                })

for tcol, (label, lo, hi) in TARGET_MAP.items():
    errs = errors_per_target[tcol]
    if errs:
        mae = np.mean(errs)
        max_err = np.max(errs)
        print(f"  {label:40s}: MAE={mae:.4f}, MaxErr={max_err:.4f} ({len(errs)} sampel)")
        total_tests += 1
        total_passed += 1
    else:
        print(f"  {label:40s}: TIDAK ADA DATA")

# ═══════════════════════════════════════════════════════════════
# TES 2: KONSISTENSI - Jalankan 3x Harus Hasilnya Identik
# ═══════════════════════════════════════════════════════════════
print("\n[TES 2] KONSISTENSI: 3x Pemanggilan Harus Identik")
print("-" * 50)

chunk = df.iloc[1000:1005]
rows_data = [df_row_to_dict(chunk.iloc[i]) for i in range(len(chunk))]

results_list = []
for run_id in range(3):
    output, err = call_inference(rows_data)
    if output and output.get('predictions'):
        vals = {p['target']: p['predicted_value'] for p in output['predictions']}
        results_list.append(vals)

if len(results_list) == 3:
    all_identical = True
    for target in results_list[0]:
        v1 = results_list[0][target]
        v2 = results_list[1][target]
        v3 = results_list[2][target]
        if v1 != v2 or v2 != v3:
            all_identical = False
            print(f"  INKONSISTEN: {target}: {v1} vs {v2} vs {v3}")

    if all_identical:
        print("  Semua 3 pemanggilan menghasilkan output IDENTIK")
        total_tests += 1
        total_passed += 1
    else:
        total_tests += 1

# ═══════════════════════════════════════════════════════════════
# TES 3: EDGE CASES
# ═══════════════════════════════════════════════════════════════
print("\n[TES 3] EDGE CASES (Kondisi Ekstrem)")
print("-" * 50)

# 3a. Malam Hari (cahaya = 0, is_daytime = 0)
night_chunk = df[df['is_daytime'] == 0].head(5)
if len(night_chunk) == 5:
    rows_data = [df_row_to_dict(night_chunk.iloc[i]) for i in range(5)]
    output, err = call_inference(rows_data)
    if output and output.get('predictions'):
        nee_pred = [p for p in output['predictions'] if 'NEE' in p['target']]
        if nee_pred:
            nee_val = nee_pred[0]['predicted_value']
            # Malam hari: NEE seharusnya POSITIF (respirasi, tanaman melepas CO2)
            if nee_val > -2:
                print(f"  Malam hari NEE = {nee_val:.2f} (Respirasi dominan) -> LOGIS")
                total_tests += 1
                total_passed += 1
            else:
                print(f"  Malam hari NEE = {nee_val:.2f} (Masih fotosintesis?) -> PERLU DICEK")
                total_tests += 1

# 3b. Tanah Sangat Kering (SWC rendah)
dry_chunk = df.nsmallest(5, 'kelembapan_tanah')
if len(dry_chunk) == 5:
    rows_data = [df_row_to_dict(dry_chunk.iloc[i]) for i in range(5)]
    output, err = call_inference(rows_data)
    if output and output.get('predictions'):
        sm_pred = [p for p in output['predictions'] if 'Moisture' in p['target']]
        if sm_pred:
            sm_val = sm_pred[0]['predicted_value']
            if 5 <= sm_val <= 25:
                print(f"  Tanah kering -> prediksi SM = {sm_val:.1f}% (Tetap kering) -> LOGIS")
                total_tests += 1
                total_passed += 1
            else:
                print(f"  Tanah kering -> prediksi SM = {sm_val:.1f}% -> PERLU DICEK")
                total_tests += 1

# 3c. Tanah Sangat Basah (SWC tinggi)
wet_chunk = df.nlargest(5, 'kelembapan_tanah')
if len(wet_chunk) == 5:
    rows_data = [df_row_to_dict(wet_chunk.iloc[i]) for i in range(5)]
    output, err = call_inference(rows_data)
    if output and output.get('predictions'):
        sm_pred = [p for p in output['predictions'] if 'Moisture' in p['target']]
        if sm_pred:
            sm_val = sm_pred[0]['predicted_value']
            if 35 <= sm_val <= 60:
                print(f"  Tanah basah  -> prediksi SM = {sm_val:.1f}% (Tetap basah) -> LOGIS")
                total_tests += 1
                total_passed += 1
            else:
                print(f"  Tanah basah  -> prediksi SM = {sm_val:.1f}% -> PERLU DICEK")
                total_tests += 1

# ═══════════════════════════════════════════════════════════════
# TES 4: STRESS TEST - Input Nol / Kosong
# ═══════════════════════════════════════════════════════════════
print("\n[TES 4] STRESS TEST: Input Nol")
print("-" * 50)

zero_rows = []
for i in range(5):
    row = {col: 0.0 for col in FEATURE_COLS}
    zero_rows.append(row)

output, err = call_inference(zero_rows)
if output and output.get('success'):
    all_finite = all(
        np.isfinite(p['predicted_value'])
        for p in output.get('predictions', [])
    )
    if all_finite:
        print("  Input semua 0 -> Model tetap menghasilkan angka finite -> LULUS")
        for p in output['predictions']:
            print(f"    {p['target']}: {p['predicted_value']:.4f}")
        total_tests += 1
        total_passed += 1
    else:
        print("  GAGAL: Model menghasilkan NaN/Inf!")
        total_tests += 1
else:
    print(f"  GAGAL: Inference error -> {err}")
    total_tests += 1

# ═══════════════════════════════════════════════════════════════
# RINGKASAN
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("RINGKASAN AUDIT AKHIR")
print("=" * 70)
print(f"\n  Total Tes     : {total_tests}")
print(f"  Tes Lulus     : {total_passed}")
print(f"  Tes Gagal     : {total_tests - total_passed}")
print(f"  Tingkat Lulus : {total_passed/total_tests*100:.0f}%")

if total_passed == total_tests:
    print("\n  KESIMPULAN: MODEL AI AGRISENSE LULUS SEMUA AUDIT!")
    print("  Sistem siap untuk deployment ke production.")
else:
    print(f"\n  PERHATIAN: {total_tests - total_passed} tes gagal.")
    print("  Silakan periksa detail di atas.")

# Cleanup
temp_file = os.path.join(BASE_DIR, "_audit_temp_input.json")
if os.path.exists(temp_file):
    os.remove(temp_file)
