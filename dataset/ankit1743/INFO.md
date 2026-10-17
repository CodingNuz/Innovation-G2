# ankit1743

- **Author:** Ankit Bhardwaj
- **Source:** https://www.kaggle.com/datasets/ankit1743/android-malware-detection-dataset
- **License:** CC0 (public domain)
- **Language:** numeric features, no text

## Files

| local file | kaggle file | rows | columns |
| --- | --- | --- | --- |
| `Android_Malware.csv` | Android_Malware.csv | 29,332 | 87 |

## Notes

- Downloaded with:
  `kaggle datasets download -d ankit1743/android-malware-detection-dataset --unzip -p dataset/ankit1743`
- The label column is `Result`: 0 = benign, 1 = malware (NATICUSdroid).
- `build_datasets.py` turns this into the training file
  `dataset/ankit1743/malware_android_permissions.csv` (7,379 rows, 86 permission
  features + label). Feature-identical rows are dropped: 21,953 rows were
  duplicates, and 96 groups disagreed about the label and were resolved by
  majority vote or dropped on a tie.
