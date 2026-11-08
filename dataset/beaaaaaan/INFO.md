# beaaaaaan

Kaggle dataset: https://www.kaggle.com/datasets/beaaaaaan/programmatically-generated-security-logs-v1

Download:
```bash
kaggle datasets download -d beaaaaaan/programmatically-generated-security-logs-v1 --unzip -p dataset/beaaaaaan/
```

Files: `*.csv`

Synthetic cloud / product security logs with a verdict column.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
