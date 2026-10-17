# gokhansoyturk

- **Author:** Gokhan Soyturk
- **Source:** https://www.kaggle.com/datasets/gokhansoyturk/smishing-sms-dataset
- **License:** MIT
- **Language:** English

## Files

| local file | kaggle file | rows | label 0 | label 1 | columns |
| --- | --- | --- | --- | --- | --- |
| `combined_sms.csv` | combined_sms.csv | 74,323 | 45,924 | 28,399 | label, text, source, is_smishing, brand, url |

## Notes

- Downloaded with:
  `kaggle datasets download -d gokhansoyturk/smishing-sms-dataset --unzip -p dataset/gokhansoyturk`
- Only `text` and `label` are read; the extra columns describe the source of
  each row inside the download.
- The download repeats the UCI SMS Spam Collection: 5,081 of the 5,197 rows in
  `uciml/sms_master.csv` also appear here (97.8%). `build_datasets.py` reads
  `sms_master.csv` first, so those messages are counted once and the remaining
  66,650 rows of this file enter the training data as `sms_smishing_kaggle`.
- Label convention: 0 = legitimate, 1 = spam/smishing.
