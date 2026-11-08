# nkongolo

Kaggle dataset: https://www.kaggle.com/datasets/nkongolo/ugransome-dataset

Download:
```bash
kaggle datasets download -d nkongolo/ugransome-dataset --unzip -p dataset/nkongolo/
```

Files: `final(2).csv`

UGRansome network attacks; `Threats` and `Prediction` S/A/SS.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
