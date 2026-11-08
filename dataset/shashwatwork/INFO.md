# shashwatwork

Kaggle dataset: https://www.kaggle.com/datasets/shashwatwork/android-malware-dataset-for-machine-learning

Download:
```bash
kaggle datasets download -d shashwatwork/android-malware-dataset-for-machine-learning --unzip -p dataset/shashwatwork/
```

Files: `drebin-215-dataset-5560malware-9476-benign.csv`

Android Drebin features; `class` B (benign) / S (malware). Second source for android_drebin cross-dataset scoring.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
