# rtatman

- **Author:** Rachael Tatman
- **Institution:** National University of Singapore
- **Source:** https://www.kaggle.com/datasets/rtatman/the-national-university-of-singapore-sms-corpus
- **Language:** English (Singlish)

## Files

| local file | kaggle file | rows | label 0 | label 1 | columns |
| --- | --- | --- | --- | --- | --- |
| `smsCorpus_en_2015.03.09_all.json` | smsCorpus_en_2015.03.09_all.json | 55835 | - | - | text, source, destination |
| `sms_nus_corpus.csv` | derived from the json | 48621 | 48621 | 0 | text, label, source |

## Notes

- The original json carries no spam label.
- The csv labels every row as ham (0), because all messages are real
  conversational Singlish with no unsolicited commercial content.
- 7,214 duplicate or empty records were removed when building the csv.
