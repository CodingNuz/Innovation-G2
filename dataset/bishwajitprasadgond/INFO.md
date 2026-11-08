# bishwajitprasadgond

Kaggle dataset: https://www.kaggle.com/datasets/bishwajitprasadgond/malware-benign-api-call-argument-feature-vector

Download:
```bash
kaggle datasets download -d bishwajitprasadgond/malware-benign-api-call-argument-feature-vector --unzip -p dataset/bishwajitprasadgond/
```

Files: `api_args_top500.csv`

Windows API-argument feature vectors. The raw 7.8 GB CSV was reduced to its 500 most frequent columns; `family` benign vs rest.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
