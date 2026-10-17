# naserabdullahalam

- **Author:** Naser Abdullah Alam
- **Source:** https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset
- **License:** CC BY-SA 4.0
- **Language:** English

## Files

| local file | kaggle file | rows | columns | label |
| --- | --- | --- | --- | --- |
| `email_ceas.csv` | CEAS_08.csv | 38,348 | subject, body, label | 0/1 |
| `email_enron.csv` | Enron.csv | 29,350 | subject, body, label | 0/1 |
| `email_ling.csv` | Ling.csv | 2,858 | subject, body, label | 0/1 |
| `email_nigerian.csv` | Nigerian_Fraud.csv | 3,267 | subject, body, label | 0/1, spam only |
| `email_phishing.csv` | phishing_email.csv | 82,076 | text, label | 0/1 |
| `email_spamassassin.csv` | SpamAssasin.csv | 6,246 | subject, body, label | 0/1 |

## Notes

- Downloaded with:
  `kaggle datasets download -d naserabdullahalam/phishing-email-dataset --unzip -p dataset/naserabdullahalam`
- Files were renamed from the Kaggle names (`CEAS_08.csv`, `Enron.csv`, and so
  on) to the `email_<corpus>.csv` names used by `build_datasets.py`.
- The five corpora with a subject column are read as subject plus body, because
  that is what a mail client shows the user. `phishing_email.csv` has no
  subject, only `text`.
- `email_nigerian.csv` contains spam only, so it cannot be scored
  leave-one-source-out and no F1 is reported for it.
- `phishing_email.csv` overlaps the others: 351 of its texts are also in
  `email_enron.csv`. `build_datasets.py` drops the duplicate rather than
  counting the same message twice.
- Label convention: 0 = ham, 1 = spam/phishing.
