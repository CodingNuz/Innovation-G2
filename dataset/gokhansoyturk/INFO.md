# gokhansoyturk

- **Author:** Gokhan Soyturk
- **Source:** https://www.kaggle.com/datasets/gokhansoyturk/smishing-sms-dataset
- **Language:** English

## Files

| local file | kaggle file | rows | label 0 | label 1 | columns |
| --- | --- | --- | --- | --- | --- |
| `combined_sms.csv` | combined_sms.csv | 74323 | 45924 | 28399 | label, text, source, is_smishing, brand, url |

## Notes

- Downloaded with:
  `kaggle datasets download -d gokhansoyturk/smishing-sms-dataset --unzip`
- 69,543 rows were merged into `train_dataset.csv`; 4,780 were dropped as
  duplicates of rows already present in other corpora.
