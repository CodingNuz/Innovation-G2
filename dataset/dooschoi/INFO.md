# dooschoi

Kaggle dataset: https://www.kaggle.com/datasets/dooschoi/malpdf-efs-malicious-pdf-enhanced-feature-set

Download:
```bash
kaggle datasets download -d dooschoi/malpdf-efs-malicious-pdf-enhanced-feature-set --unzip -p dataset/dooschoi/
```

Files: `FS31/*.csv, FS43/*.csv`

PDF enhanced feature sets; `class` benign/old_malicious/recent_malicious.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
