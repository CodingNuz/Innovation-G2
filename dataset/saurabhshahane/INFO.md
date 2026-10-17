# saurabhshahane

- **Author:** Saurabh Shahane
- **Source:** https://www.kaggle.com/datasets/saurabhshahane/android-malware-dataset
- **License:** CC BY 4.0
- **Language:** numeric features, no text

## Files

| local file | kaggle file | rows | columns |
| --- | --- | --- | --- |
| `drebin-215-dataset-5560malware-9476-benign.csv` | dataset.csv | 15,036 | 216 |

## Notes

- Downloaded with:
  `kaggle datasets download -d saurabhshahane/android-malware-dataset --unzip -p dataset/saurabhshahane`
- The label column is `class`: `B` = benign, `S` = malware.
- 215 binary features: Android permissions, API calls, intents and
  transact/bindService style IPC markers.
- `build_datasets.py` turns this into the training file
  `dataset/saurabhshahane/malware_android_drebin.csv` (7,257 rows, 215 features + label).
  Feature-identical rows are dropped: 7,779 rows were duplicates of each other.
- A second set from the same author, `saurabhshahane/android-permission-dataset`,
  was downloaded and rejected: 1,927 package IDs carry both labels, so the file
  is genuinely ambiguous.
