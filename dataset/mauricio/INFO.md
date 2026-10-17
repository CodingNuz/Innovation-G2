# mauricio

- **Author:** amauricio
- **Source:** https://www.kaggle.com/datasets/amauricio/pe-files-malwares
- **License:** CC0 (public domain)
- **Language:** numeric features, no text

## Files

| local file | kaggle file | rows | columns |
| --- | --- | --- | --- |
| `dataset_malwares.csv` | dataset_malwares.csv | 19,611 | 79 |

## Notes

- Downloaded with:
  `kaggle datasets download -d amauricio/pe-files-malwares --unzip -p dataset/mauricio`
- This set contributes no training file of its own. Its rows are merged into
  `dataset/malware_pe_windows.csv`, because it shares 51 PE header columns with
  `joebeachcapital/PE_Header.csv` and the two files describe Windows
  executables with the same features.
- Label column is `Malware`: 0 = benign, 1 = malware. The column beyond the 51
  shared ones (entropy and section statistics) are dropped in the merge so both
  sources fit the same table.
