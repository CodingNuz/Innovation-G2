# joebeachcapital

- **Author:** Joakim Arvidsson
- **License:** CC BY 4.0
- **Language:** numeric features, no text

## Sources

| dataset | files used |
| --- | --- |
| [windows-malwares](https://www.kaggle.com/datasets/joebeachcapital/windows-malwares) | `PE_Header.csv` |
| [TUANDROMD](https://www.kaggle.com/datasets/joebeachcapital/tuandromd) | `TUANDROMD.csv` |

## Files

| local file | kaggle file | rows | columns |
| --- | --- | --- | --- |
| `PE_Header.csv` | PE_Header.csv | 29,807 | 54 |
| `TUANDROMD.csv` | TUANDROMD.csv | 4,465 | 242 |

## Notes

- Downloaded with:
  `kaggle datasets download -d joebeachcapital/windows-malwares --unzip -p dataset/joebeachcapital`
  `kaggle datasets download -d joebeachcapital/tuandromd --unzip -p dataset/joebeachcapital`
- `PE_Header.csv` labels the `Type` column: 0 = benign, 1 to 6 = malware
  family. It is merged in `build_datasets.py` with
  `mauricio/dataset_malwares.csv` on the 51 feature columns the two files share,
  giving the training file `dataset/malware_pe_windows.csv`
  (39,669 rows, 50 features + label).
- `TUANDROMD.csv` labels with the words `malware` and `goodware`, in the
  `Label` column. It gives the training file
  `dataset/joebeachcapital/malware_android_tuandromd.csv` (660 rows, 241 features + label).
  Most of its 4,465 rows are duplicates of each other and are dropped.
- The API-call and DLL views (`API_Functions.csv`, `DLLs_Imported.csv`) and the
  PE section file are not downloaded here: they describe the same samples
  through a different view and add no rows to the platform table.
