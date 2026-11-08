# kk0105

Kaggle dataset: https://www.kaggle.com/datasets/kk0105/cicpdfmal2022

Download:
```bash
kaggle datasets download -d kk0105/cicpdfmal2022 --unzip -p dataset/kk0105/
```

Files: `PDFMalware2022.csv`

CIC-PDFMal2022; `Class` Malicious/Benign.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
