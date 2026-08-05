"""
=============================================================
TAHAP 5: Test End-to-End (Simulasi Panggilan dari Laravel)
=============================================================
Script ini mensimulasikan cara Laravel memanggil Python inference:
1. Membuat input JSON tiruan (seperti dari AiDataFormatter)
2. Memanggil run_sintetik90_inference.py
3. Memeriksa output JSON
"""
import json
import subprocess
import os
import sys
import math
import random

BASE_DIR = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"

# Simulasikan 5 baris data sensor (seperti dari AiDataFormatter)
# Nilai-nilai ini menyerupai data Indonesia (Jawa Barat)
random.seed(99)

rows = []
for i in range(5):
    hour = 8.0 + i * 0.5  # Mulai jam 8 pagi
    temp = 28.0 + random.uniform(-2, 4)
    rh = 75.0 + random.uniform(-10, 15)
    sm = 32.0 + random.uniform(-5, 5)
    ph = 6.3 + random.uniform(-0.3, 0.3)
    lux = max(0, 30000 + random.uniform(-10000, 20000))
    co2 = 415 + random.uniform(-15, 30)

    row = {
        "Device ID": "AGRISENSE-CC-TEST",
        "Timestamp": f"2026-06-13T{int(hour):02d}:{int((hour%1)*60):02d}:00+07:00",
        "suhu_udara": round(temp, 2),
        "kelembapan_udara": round(min(rh, 100), 2),
        "tekanan_hpa": round(1010 + random.uniform(-3, 3), 1),
        "cahaya_lux": round(lux, 1),
        "kelembapan_tanah": round(sm, 2),
        "suhu_tanah": round(temp * 0.92 + 2.5, 2),
        "ph_tanah": round(ph, 2),
        "tvoc_ppb": round(150 + random.uniform(-30, 50), 1),
        "n_mg_kg": round(180 + random.uniform(-30, 30), 1),
        "p_mg_kg": round(35 + random.uniform(-10, 10), 1),
        "k_mg_kg": round(180 + random.uniform(-20, 20), 1),
        "epsilon": round(1.1 + random.uniform(-0.1, 0.1), 3),
        "fapar": round(0.6 + random.uniform(-0.05, 0.1), 3),
        "par": round(lux * 0.0185, 2),
        "t_scalar": round(max(0, min(1, 0.85 + random.uniform(-0.1, 0.1))), 3),
        "w_scalar": round(sm / 60.0, 3),
        "c_scalar": round(co2 / 420.0, 3),
        "gpp": round(0.5 + random.uniform(0, 0.5), 4),
        "reco": round(0.18 + random.uniform(0, 0.05), 4),
        "npp": round(0.25 + random.uniform(0, 0.2), 4),
        "soc_baseline_gC_m2": round(5850 + random.uniform(-500, 500), 1),
        "c_biomass_acc": round(random.uniform(-20, 50), 2),
        "c_current": round(5850 + random.uniform(-20, 50), 1),
        "c_max": round(7900 + random.uniform(-200, 200), 1),
        "elapsed_hours": round(i * 0.5, 1),
        "hour_sin": round(math.sin(2 * math.pi * hour / 24), 4),
        "hour_cos": round(math.cos(2 * math.pi * hour / 24), 4),
        "dow_sin": round(math.sin(2 * math.pi * 4 / 7), 4),  # Kamis
        "dow_cos": round(math.cos(2 * math.pi * 4 / 7), 4),
        "is_daytime": 1,
        "is_cabai": 1,
        "has_full_data": 1,
        # Sensor asli (untuk Laravel currentValues)
        "CO2 (ppm)": round(co2, 1),
        "Kelembapan Tanah (%)": round(sm, 2),
        "pH Tanah": round(ph, 2),
    }
    rows.append(row)

# Buat input JSON (seperti buatan AiDataFormatter)
input_data = {
    "device_id": "AGRISENSE-CC-TEST",
    "device_db_id": 1,
    "row_count": len(rows),
    "latest_reading_time": rows[-1]["Timestamp"],
    "current_values": {
        "CO2 (ppm)": rows[-1]["CO2 (ppm)"],
        "Carbon Flux (NEE AgriSense)": round(rows[-1]["gpp"] - rows[-1]["reco"], 4),
        "Carbon Potential Score": round(1 - rows[-1]["c_current"] / rows[-1]["c_max"], 4),
        "Soil Moisture (%)": rows[-1]["Kelembapan Tanah (%)"],
        "pH Tanah": rows[-1]["pH Tanah"],
    },
    "rows": rows,
}

# Simpan input JSON
input_file = os.path.join(BASE_DIR, "test_input_laravel_sim.json")
with open(input_file, "w", encoding="utf-8") as f:
    json.dump(input_data, f, ensure_ascii=False, indent=2)

print("=" * 70)
print("TAHAP 5: Test End-to-End (Simulasi Panggilan Laravel)")
print("=" * 70)
print(f"\nInput JSON berisi {len(rows)} baris data sensor simulasi.")
print(f"File: {input_file}")

# Panggil inference script (PERSIS seperti Laravel memanggil)
script_path = os.path.join(BASE_DIR, "run_sintetik90_inference.py")
cmd = [sys.executable, script_path, input_file, "--models", "xgboost"]

print(f"\nMenjalankan: {' '.join(cmd)}")
print("-" * 70)

result = subprocess.run(cmd, capture_output=True, text=True, cwd=BASE_DIR)

if result.returncode != 0:
    print(f"ERROR (exit code {result.returncode}):")
    print(result.stderr)
else:
    output = json.loads(result.stdout)
    print(f"Status: {'SUKSES' if output.get('success') else 'GAGAL'}")
    print(f"Bundle: {output.get('bundle')}")
    print(f"Jumlah Prediksi: {output.get('prediction_count')}")

    if output.get('errors'):
        print(f"\nError:")
        for err in output['errors']:
            print(f"  - {err['model']}: {err['error']}")

    if output.get('predictions'):
        print(f"\n{'Target':<35} {'Model':<10} {'Prediksi':>12}")
        print("-" * 60)
        for pred in output['predictions']:
            print(f"  {pred['target']:<33} {pred['model']:<10} {pred['predicted_value']:>10.4f}")

    # Validasi logika: apakah prediksi masuk akal?
    print("\n" + "-" * 70)
    print("VALIDASI LOGIKA PREDIKSI")
    print("-" * 70)

    for pred in output.get('predictions', []):
        target = pred['target']
        value = pred['predicted_value']
        ok = True
        reason = ""

        if 'CO2' in target:
            if not (300 <= value <= 700):
                ok = False
                reason = f"CO2 {value:.1f} ppm di luar batas wajar (300-700)"
        elif 'Moisture' in target:
            if not (5 <= value <= 80):
                ok = False
                reason = f"Soil Moisture {value:.1f}% di luar batas wajar (5-80)"
        elif 'pH' in target:
            if not (4 <= value <= 9):
                ok = False
                reason = f"pH {value:.2f} di luar batas wajar (4-9)"
        elif 'NEE' in target or 'Carbon Flux' in target:
            if not (-50 <= value <= 30):
                ok = False
                reason = f"NEE {value:.2f} di luar batas wajar (-50 s/d 30)"
        elif 'Carbon Potential' in target:
            if not (0 <= value <= 1):
                ok = False
                reason = f"CPS {value:.4f} di luar batas wajar (0-1)"

        status = "LOGIS" if ok else "ANOMALI"
        symbol = "V" if ok else "X"
        print(f"  [{symbol}] {target}: {value:.4f} -> {status}")
        if not ok:
            print(f"      Alasan: {reason}")

print("\n" + "=" * 70)
print("TEST END-TO-END SELESAI")
print("=" * 70)
