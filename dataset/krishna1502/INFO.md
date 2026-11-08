# krishna1502

Kaggle dataset: https://www.kaggle.com/datasets/krishna1502/pegasus-spyware-attacksynthetic-dataset

Download:
```bash
kaggle datasets download -d krishna1502/pegasus-spyware-attacksynthetic-dataset --unzip -p dataset/krishna1502/
```

Files: `synthetic_pegasus_dataset.csv`

iOS/Android device telemetry; `device_type` iPhone/Android, `os_version` iOS 14.6/15.0, `ioc` gives the anomaly label.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
