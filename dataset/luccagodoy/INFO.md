# luccagodoy

Kaggle dataset: https://www.kaggle.com/datasets/luccagodoy/obfuscated-malware-memory-2022-cic

Download:
```bash
kaggle datasets download -d luccagodoy/obfuscated-malware-memory-2022-cic --unzip -p dataset/luccagodoy/
```

Files: `Obfuscated-MalMem2022.csv`

CIC-MalMem-2022 Windows memory dumps; `Class` = Benign/Malware.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
