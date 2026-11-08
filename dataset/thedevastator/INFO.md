# thedevastator

Kaggle dataset: https://www.kaggle.com/datasets/thedevastator/assembly-shellcode-dataset

Download:
```bash
kaggle datasets download -d thedevastator/assembly-shellcode-dataset --unzip -p dataset/thedevastator/
```

Files: `train.csv/validation.csv/test.csv`

Assembly / shellcode snippets with an `intent` column.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
