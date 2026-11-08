# gundalaxmisai

Kaggle dataset: https://www.kaggle.com/datasets/gundalaxmisai/iot-23-malware-typescombined-dataset

Download:
```bash
kaggle datasets download -d gundalaxmisai/iot-23-malware-typescombined-dataset --unzip -p dataset/gundalaxmisai/
```

Files: `malwareTypes(IOT23).csv`

IoT-23 network flows; `label` Benign vs C&C/DDoS/Okiru/Attack/PortScan.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
