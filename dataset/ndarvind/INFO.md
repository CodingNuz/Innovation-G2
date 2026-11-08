# ndarvind

Kaggle dataset: https://www.kaggle.com/datasets/ndarvind/phiusiil-phishing-url-dataset

Download:
```bash
kaggle datasets download -d ndarvind/phiusiil-phishing-url-dataset --unzip -p dataset/ndarvind/
```

Files: `phiusiil_sample.csv`

PhiUSIIL numeric URL features; `label` 0/1. Balanced to 40,000 rows.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
