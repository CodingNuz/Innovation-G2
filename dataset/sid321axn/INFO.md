# sid321axn

Kaggle dataset: https://www.kaggle.com/datasets/sid321axn/malicious-urls-dataset

Download:
```bash
kaggle datasets download -d sid321axn/malicious-urls-dataset --unzip -p dataset/sid321axn/
```

Files: `malicious_phish_sample.csv`

URL strings; `type` benign/defacement/phishing/malware. Balanced to 40,000 rows.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
