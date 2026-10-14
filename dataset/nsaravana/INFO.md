# nsaravana

- **Author:** N Saravana
- **Source:** https://www.kaggle.com/datasets/nsaravana/malware-detection
- **Language:** numeric features, no text

## Files

| local file | kaggle file | rows | benign | malware | columns |
| --- | --- | --- | --- | --- | --- |
| `malware.csv` | Malware dataset.csv | 100 | 50 | 50 | 34 numeric + classification |

## Notes

- Deduplicated to 100 rows. The Kaggle original has 100,000 rows because each
  of the 100 hashes is repeated 1000 times.
- Numeric only, so it is not used by the TF-IDF text model.
