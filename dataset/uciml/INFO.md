# uciml

- **Author:** Esther Kim (UCI Machine Learning Repository)
- **Source:** https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset
- **License:** unknown (Kaggle does not list one for this dataset)
- **Language:** English

## Files

| local file | kaggle file | rows | label 0 | label 1 | columns |
| --- | --- | --- | --- | --- | --- |
| `sms_master.csv` | spam.csv | 5,197 | 4,559 | 638 | message, label |

## Notes

- Downloaded with:
  `kaggle datasets download -d uciml/sms-spam-collection-dataset --unzip -p dataset/uciml`
- The Kaggle file is `spam.csv` with the columns `v1` (ham/spam text) and `v2`
  (the message). It was renamed to `sms_master.csv` and the labels were
  converted to 0/1 when the file was first prepared, so the label column here
  is numeric: 0 = ham, 1 = spam.
- Cited as Almeida, Hidalgo and Yamakami (2011).
- This is the reference SMS corpus in the project. Its rows are read first in
  `build_datasets.py`, so a message that also appears in the smishing download
  is counted as `sms_master`.
