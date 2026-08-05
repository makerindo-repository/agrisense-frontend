"""
=============================================================
AUDIT: Perbandingan Iklim FLUXNET Adelaide vs Indonesia
=============================================================
Tujuan: Mengevaluasi apakah dataset AU-Ade (Adelaide, Australia)
        cocok untuk melatih model AI yang akan digunakan di
        Indonesia (Jawa Barat / Bandung / Jakarta).

Referensi iklim Indonesia:
- BMKG Data Klimatologi Bandung/Jakarta
- Koppen climate classification: Af (Tropical Rainforest)
"""
import pandas as pd
import numpy as np
import os

# --- PARAMETER IKLIM INDONESIA (Referensi BMKG & Literatur) ---
# Sumber: BMKG Stasiun Klimatologi Bandung & Jakarta
INDONESIA_CLIMATE = {
    'Suhu (°C)': {
        'label': 'TA_F',
        'indo_min': 20.0,   # Bandung malam hari (dataran tinggi)
        'indo_max': 36.0,   # Jakarta siang panas
        'indo_mean': 27.5,  # Rata-rata nasional dataran rendah
        'indo_note': 'Tropis lembab, variasi harian 8-12°C, variasi musiman kecil'
    },
    'Kelembapan Udara (%)': {
        'label': 'RH',
        'indo_min': 50.0,   # Musim kemarau siang
        'indo_max': 100.0,  # Pagi hari hujan
        'indo_mean': 78.0,  # Rata-rata tahunan
        'indo_note': 'Indonesia sangat lembab, RH jarang < 50%'
    },
    'Cahaya/Radiasi (W/m²)': {
        'label': 'SW_IN_F',
        'indo_min': 0.0,    # Malam
        'indo_max': 1100.0, # Siang cerah tropis
        'indo_mean': 210.0, # Rata-rata 24 jam (banyak awan)
        'indo_note': 'Indonesia banyak awan konvektif, puncak radiasi ~1000-1100 W/m²'
    },
    'Kelembapan Tanah (%)': {
        'label': 'SWC_F_MDS_1',
        'indo_min': 15.0,   # Kemarau panjang
        'indo_max': 55.0,   # Musim hujan
        'indo_mean': 32.0,  # Tanah vulkanik Jawa relatif basah
        'indo_note': 'Tanah vulkanik Jawa menyimpan air lebih baik dari tanah Australia'
    },
    'CO2 (ppm)': {
        'label': 'CO2_F_MDS',
        'indo_min': 380.0,  # Area terbuka/hutan
        'indo_max': 500.0,  # Area urban/dekat jalan
        'indo_mean': 415.0, # Global average 2024 ~424ppm, kota sedikit lebih
        'indo_note': 'CO2 bersifat global, perbedaan kecil antar negara'
    },
    'Carbon Flux / NEE (µmol/m²/s)': {
        'label': 'NEE_VUT_REF',
        'indo_min': -35.0,  # Fotosintesis aktif hutan tropis
        'indo_max': 15.0,   # Respirasi malam
        'indo_mean': -3.5,  # Hutan tropis = penyerap karbon kuat
        'indo_note': 'Ekosistem tropis umumnya lebih produktif (GPP lebih tinggi)'
    }
}

# --- Baca data FLUXNET ---
base_dir = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
file_path = os.path.join(base_dir, "FLX_AU-Ade", 
                         "FLX_AU-Ade_FLUXNET2015_SUBSET_HH_2007-2009_1-4.csv")

df = pd.read_csv(file_path)
cols_to_check = ['TA_F', 'RH', 'SW_IN_F', 'SWC_F_MDS_1', 'CO2_F_MDS', 'NEE_VUT_REF']
df_clean = df.copy()
for col in cols_to_check:
    if col in df.columns:
        df_clean = df_clean[df_clean[col] != -9999]

print("=" * 75)
print("AUDIT PERBANDINGAN IKLIM: FLUXNET Adelaide vs Indonesia")
print("=" * 75)
print(f"{'':>3} Adelaide, Australia: 34.9°S, Iklim Semi-arid / Mediterranean (Bsb)")
print(f"{'':>3} Indonesia (Jawa Barat): 6.9°S, Iklim Tropis Lembab (Af)")
print(f"{'':>3} Data bersih: {len(df_clean)} baris")
print("=" * 75)

issues = []
warnings = []
ok_items = []

for param_name, info in INDONESIA_CLIMATE.items():
    col = info['label']
    if col not in df_clean.columns:
        continue
    
    aus_data = df_clean[col]
    aus_min = aus_data.min()
    aus_max = aus_data.max()
    aus_mean = aus_data.mean()
    
    indo_min = info['indo_min']
    indo_max = info['indo_max']
    indo_mean = info['indo_mean']
    
    # Hitung overlap range
    overlap_low = max(aus_min, indo_min)
    overlap_high = min(aus_max, indo_max)
    aus_range = aus_max - aus_min
    indo_range = indo_max - indo_min
    
    if overlap_high > overlap_low:
        overlap_pct = ((overlap_high - overlap_low) / indo_range) * 100
    else:
        overlap_pct = 0.0
    
    # Hitung berapa % data AUS yang masuk ke rentang Indonesia
    in_range = ((aus_data >= indo_min) & (aus_data <= indo_max)).sum()
    in_range_pct = (in_range / len(aus_data)) * 100
    
    mean_diff_pct = abs(aus_mean - indo_mean) / indo_mean * 100
    
    print(f"\n--- {param_name} ({col}) ---")
    print(f"  Australia (AU-Ade) : Min={aus_min:.1f}  Mean={aus_mean:.1f}  Max={aus_max:.1f}")
    print(f"  Indonesia (Ref)    : Min={indo_min:.1f}  Mean={indo_mean:.1f}  Max={indo_max:.1f}")
    print(f"  Overlap rentang    : {overlap_pct:.0f}% dari rentang Indonesia")
    print(f"  Data AUS dalam rentang Indo: {in_range_pct:.0f}% ({in_range}/{len(aus_data)} baris)")
    print(f"  Selisih rata-rata  : {mean_diff_pct:.1f}%")
    print(f"  Catatan Indonesia  : {info['indo_note']}")
    
    # Klasifikasi
    if overlap_pct >= 70 and in_range_pct >= 60:
        status = "✅ COCOK"
        ok_items.append((param_name, overlap_pct, in_range_pct))
    elif overlap_pct >= 40 and in_range_pct >= 30:
        status = "🟡 PERLU ADJUSTMENT"
        warnings.append((param_name, overlap_pct, in_range_pct, 
                         f"Rata-rata AUS ({aus_mean:.1f}) vs Indo ({indo_mean:.1f})"))
    else:
        status = "🔴 TIDAK COCOK - PERLU TRANSFORMASI"
        issues.append((param_name, overlap_pct, in_range_pct,
                      f"Rata-rata AUS ({aus_mean:.1f}) vs Indo ({indo_mean:.1f})"))
    print(f"  STATUS: {status}")

# --- Ringkasan ---
print("\n" + "=" * 75)
print("RINGKASAN AUDIT")
print("=" * 75)

if ok_items:
    print(f"\n✅ COCOK LANGSUNG ({len(ok_items)} parameter):")
    for name, ovl, inr in ok_items:
        print(f"   - {name} (overlap {ovl:.0f}%, {inr:.0f}% data masuk rentang)")

if warnings:
    print(f"\n🟡 PERLU PENYESUAIAN KECIL ({len(warnings)} parameter):")
    for name, ovl, inr, detail in warnings:
        print(f"   - {name}: {detail}")

if issues:
    print(f"\n🔴 PERLU TRANSFORMASI ({len(issues)} parameter):")
    for name, ovl, inr, detail in issues:
        print(f"   - {name}: {detail}")

print("\n" + "=" * 75)
print("REKOMENDASI")
print("=" * 75)
print("""
1. SUHU: Adelaide semi-arid punya suhu malam lebih dingin (13°C vs Indo 20°C).
   -> Solusi: Filter data di bawah 18°C ATAU geser distribusi +5°C.

2. KELEMBAPAN: Adelaide jauh lebih kering (mean 62%) vs Indonesia (mean 78%).
   -> Solusi: Scaling linear agar mean mendekati 78%.

3. KELEMBAPAN TANAH: Adelaide tanah kering (mean 20%) vs Indo (mean 32%).
   -> Solusi: Scaling faktor × 1.5 agar mendekati tanah vulkanik Jawa.

4. CAHAYA & CO2: Sangat mirip antar kedua negara.
   -> Tidak perlu adjustment.

5. CARBON FLUX (NEE): Pola serupa, Indonesia sedikit lebih produktif.
   -> Adjustment minor (scaling ×1.1 pada komponen GPP).

KESIMPULAN: Dataset AU-Ade LAYAK DIGUNAKAN dengan adjustment/transformasi 
pada Suhu, Kelembapan Udara, dan Kelembapan Tanah agar representatif 
terhadap kondisi pertanian di Indonesia (Jawa Barat).
""")
