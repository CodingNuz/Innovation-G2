# fouadtrad2

Kaggle dataset: https://www.kaggle.com/datasets/fouadtrad2/evasive-pdf-samples

Download:
```bash
kaggle datasets download -d fouadtrad2/evasive-pdf-samples --unzip -p dataset/fouadtrad2/
```

Files: `evasive_pdf_sample.csv`

Evasive PDF structural features; `class` 0/1. The 500,000-row raw file was balanced to 40,000 rows.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
