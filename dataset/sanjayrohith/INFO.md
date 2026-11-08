# sanjayrohith

Kaggle dataset: https://www.kaggle.com/datasets/sanjayrohith/elf-firmware-static-summary-features

Download:
```bash
kaggle datasets download -d sanjayrohith/elf-firmware-static-summary-features --unzip -p dataset/sanjayrohith/
```

Files: `elf_firmware_static_features.csv`

Linux ELF / firmware static features; `binary_label` 0/1.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
