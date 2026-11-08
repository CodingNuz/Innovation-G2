# ang3loliveira

Kaggle dataset: https://www.kaggle.com/datasets/ang3loliveira/malware-analysis-datasets-api-call-sequences

Download:
```bash
kaggle datasets download -d ang3loliveira/malware-analysis-datasets-api-call-sequences --unzip -p dataset/ang3loliveira/
```

Files: `dynamic_api_call_sequence_per_malware_100_0_306.csv`

Windows dynamic API-call sequences; `malware` 0/1.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
