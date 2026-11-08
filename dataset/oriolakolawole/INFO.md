# oriolakolawole

Kaggle dataset: https://www.kaggle.com/datasets/oriolakolawole/ransomware-and-goodware-pe-header

Download:
```bash
kaggle datasets download -d oriolakolawole/ransomware-and-goodware-pe-header --unzip -p dataset/oriolakolawole/
```

Files: `pe_headers.csv`

Ransomware / goodware PE headers; `GR` 0/1.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
