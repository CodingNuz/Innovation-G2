# greenwarbler

Kaggle dataset: https://www.kaggle.com/datasets/greenwarbler/malware-benignpe-files

Download:
```bash
kaggle datasets download -d greenwarbler/malware-benignpe-files --unzip -p dataset/greenwarbler/
```

Files: `Malware-Benign.csv`

Windows PE headers; label column `Malware` (0/1).

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
