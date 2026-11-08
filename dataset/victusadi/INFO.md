# victusadi

Kaggle dataset: https://www.kaggle.com/datasets/victusadi/phishing-urls-dataset-with-extracted-features

Download:
```bash
kaggle datasets download -d victusadi/phishing-urls-dataset-with-extracted-features --unzip -p dataset/victusadi/
```

Files: `phishing_features.csv`

13 numeric URL features; `label` 0/1.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
