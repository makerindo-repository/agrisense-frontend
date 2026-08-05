import pandas as pd
import numpy as np
import os

# Tentukan path file
base_dir = r"C:\NoteISlam\AgriSense-UNIKOM-V1.0\docs\deploy_model_bundle"
file_path = os.path.join(base_dir, "FLX_AU-Ade", "FLX_AU-Ade_FLUXNET2015_SUBSET_HH_2007-2009_1-4.csv")

print(f"Membaca file: {file_path}")
df = pd.read_csv(file_path)

print(f"Total baris data mentah: {len(df)}")

# Kolom yang akan kita gunakan untuk AgriSense:
# TA_F = Suhu (Temperature)
# RH = Kelembapan Udara (Humidity)
# SW_IN_F = Cahaya (Shortwave Radiation)
# SWC_F_MDS_1 = Kelembapan Tanah (Soil Moisture)
# CO2_F_MDS = Konsentrasi CO2
# NEE_VUT_REF = Carbon Flux (Net Ecosystem Exchange)
cols_to_check = ['TA_F', 'RH', 'SW_IN_F', 'SWC_F_MDS_1', 'CO2_F_MDS', 'NEE_VUT_REF']

# FLUXNET menggunakan -9999 untuk menandai sensor error / data kosong.
# Kita buang semua baris yang mengandung -9999 pada kolom penting kita.
df_clean = df.copy()
for col in cols_to_check:
    if col in df.columns:
        df_clean = df_clean[df_clean[col] != -9999]

print(f"Total baris bersih (Tanpa -9999): {len(df_clean)}")

if len(df_clean) > 0:
    print("\n=========================================")
    print("RINGKASAN STATISTIK DATA BERSIH (AUDIT 1)")
    print("=========================================")
    stats = df_clean[cols_to_check].describe().T
    print(stats[['mean', 'min', 'max', 'std']].round(2))
else:
    print("\nPERINGATAN: Semua baris terhapus! Silakan cek apakah ada kolom yang semuanya bernilai -9999.")
