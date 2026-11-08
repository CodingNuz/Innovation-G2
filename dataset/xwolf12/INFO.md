# xwolf12

Kaggle dataset: https://www.kaggle.com/datasets/xwolf12/malicious-and-benign-websites

Download:
```bash
kaggle datasets download -d xwolf12/malicious-and-benign-websites --unzip -p dataset/xwolf12/
```

Files: `dataset.csv`

Website features; `Type` 0/1.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
