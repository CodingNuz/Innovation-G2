# satyaprakash138

Kaggle dataset: https://www.kaggle.com/datasets/satyaprakash138/cleaned-cic-pdf-malware-2022-dataset

Download:
```bash
kaggle datasets download -d satyaprakash138/cleaned-cic-pdf-malware-2022-dataset --unzip -p dataset/satyaprakash138/
```

Files: `Final.csv`

CIC PDF-Malware 2022 cleaned; `class` Benign/Malicious.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
