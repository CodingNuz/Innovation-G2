# jeffborschowa

Kaggle dataset: https://www.kaggle.com/datasets/jeffborschowa/malwarebazaar-threat-intelligence-csv

Download:
```bash
kaggle datasets download -d jeffborschowa/malwarebazaar-threat-intelligence-csv --unzip -p dataset/jeffborschowa/
```

Files: `malware_full_sample.csv`

MalwareBazaar threat feed. `file_type_guess` names the OS/file type (macho, dmg, pkg, elf, exe, dll, apk, doc, docx, xls, xlsx, js, sh, vbs, hta, bat, ps1, ...). The 414 MB raw file was stratified to a per-type sample of at most 2,500 rows.

Every file here feeds the malware side of `combined_model.joblib` only.
`build_datasets.py` turns these raw downloads into the normalized
`dataset/<platform>.csv` training tables. Files over GitHub's 50 MB warning
are listed in `.gitignore` and are reproducible with the command above.
