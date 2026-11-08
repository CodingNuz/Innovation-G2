# datamunge

Kaggle dataset: https://www.kaggle.com/datasets/datamunge/iot-firmware-image-classification

Download:
```bash
kaggle datasets download -d datamunge/iot-firmware-image-classification --unzip -p dataset/datamunge/
```

Files: `firmware/firmware.csv`

Embedded/router firmware images flattened to 1,024 pixels; `class` benignware/malware/hackware.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
