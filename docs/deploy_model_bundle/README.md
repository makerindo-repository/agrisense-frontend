# AgriSense Model Bundle

Folder ini dipakai aplikasi untuk membaca performa model dan menjalankan
forecasting berbasis model.

## Status Saat Ini

Halaman Performa Model sekarang memakai metrik terbaru dari:

```text
C:\Users\M Fauzan Lubada\Downloads\sintetik_90\sintetik_90
```

Metrik tersebut sudah disalin ke:

```text
artifacts/model_comparison_sintetik_90_latest.csv
artifacts/comparison_payload.json
```

Target evaluasi terbaru:

- `CO2 (ppm)`
- `Carbon Flux (NEE AgriSense)`
- `Carbon Potential Score`
- `Soil Moisture (%)`
- `pH Tanah`

Model yang dibandingkan:

- `SVM`
- `XGBoost`
- `LSTM`

Catatan: dataset terbaru ini tidak membawa horizon `1`, `6`, dan `24` jam secara eksplisit. Karena itu halaman Performa Model menampilkannya sebagai `Evaluasi terbaru`.

## Struktur Penting

```text
deploy_model_bundle/
├─ artifacts/
│  ├─ comparison_payload.json
│  ├─ model_comparison_sintetik_90_latest.csv
│  ├─ training_summary.json
│  └─ model artifacts lama untuk jalur inference sebelumnya
├─ input_contract.json
├─ load_models.py
├─ model_manifest.json
├─ requirements.txt
└─ run_inference.py
```

## Catatan Integrasi

- `comparison_payload.json` adalah sumber utama untuk halaman Performa Model.
- `run_inference.py` dan `model_manifest.json` masih mengikuti jalur inference lama sampai pipeline inference model terbaru disesuaikan.
- Dashboard operasional nantinya sebaiknya hanya menampilkan forecast final `Carbon Flux`, sementara halaman Performa Model tetap menampilkan comparative 3 model.
- Forecast batch sebaiknya dijalankan dari Laravel scheduler, bukan tombol manual di frontend.

