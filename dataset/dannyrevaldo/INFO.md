# dannyrevaldo

Kaggle dataset: https://www.kaggle.com/datasets/dannyrevaldo/android-malware-detection-dataset

Download:
```bash
kaggle datasets download -d dannyrevaldo/android-malware-detection-dataset --unzip -p dataset/dannyrevaldo/
```

Files: `Android_Malware_Benign.csv`

Android permissions; `Label` Benign/Malware. Second Android source.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
