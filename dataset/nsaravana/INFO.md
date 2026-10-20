# nsaravana

- **Author:** N Saravana
- **Source:** https://www.kaggle.com/datasets/nsaravana/malware-detection
- **License:** CC0-1.0
- **Language:** not applicable (numeric process counters)

## Files

| local file | kaggle file | rows | columns |
| --- | --- | --- | --- |
| `Malware dataset.csv` | Malware dataset.csv | 100,000 | 35 |

## Notes

- Downloaded with:
  `kaggle datasets download -d nsaravana/malware-detection --unzip -p dataset/nsaravana`
- Columns: `hash`, `millisecond`, `classification`, then 32 Linux process
  counters (`state`, `prio`, `total_vm`, `nvcsw`, ...).
- The 100,000 rows are 100 distinct hashes x 1000 snapshots. Every snapshot of
  one hash carries the same `classification`, so the file must be split by
  `hash` and not at random.
- This file is used for the **regression** task: predict `nvcsw` (voluntary
  context switches) from the other counters. It is not used for malware
  classification, because a classifier here would identify which of the 100
  processes a row belongs to rather than anything about a file.
- The training script reads this file as it is. There is no derived copy.
