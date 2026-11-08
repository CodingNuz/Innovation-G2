# ahmadzulfiqar001

Kaggle dataset: https://www.kaggle.com/datasets/ahmadzulfiqar001/iot-malware-dataset

Download:
```bash
kaggle datasets download -d ahmadzulfiqar001/iot-malware-dataset --unzip -p dataset/ahmadzulfiqar001/
```

Files: `iot_malware_sample.csv`

IoT multi-OS traffic; `Operating_System` Linux / Embedded Linux / FreeRTOS / OpenWRT and `Is_Malicious` 0/1. The 1.96 GB raw CSV was streamed to a 120,000-row sample.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
