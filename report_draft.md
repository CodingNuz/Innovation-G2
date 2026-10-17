# Spam and Malware Detection: Report (DRAFT)

> **Draft notes for the team.** The numbers below come from the saved result
> files in `spam_malware_detection_model/`. Fill the `[TODO]` items, rewrite
> the text in your own words (the assignment forbids AI-generated content),
> add figures from `spam_malware_detection_model/spam/figures/` (malware and
> regression figures are in their own folders), and check the word
> count (limit 3000, excluding cover page, table of contents, bibliography and
> appendix).

**Group:** [TODO group name and ID] **Students:** [TODO names and IDs] **Tutor:** [TODO]

---

## 1. Introduction

Spam and malware are two of the most common ways attackers reach ordinary
people. A spam message carries a scam or a link to one. A malicious file gives
an attacker control of a computer or phone. This project builds two machine
learning models that help with both, and puts them behind a small web service.

**Intended users.** People who receive suspicious messages, such as students
and office staff, and the security staff who check suspicious files for them.
The spam model gives a verdict plus the words that caused it, so a non-expert
can see why a message looks bad. The malware model gives a verdict and a
probability for the analyst.

## 2. Problem framing

**Spam.** Given the text of an email or SMS, decide whether it is spam (1) or
legitimate (0). This is binary classification.

**Malware.** Given numeric features taken from a file (for example PE header
fields of a Windows program, or the permissions an Android app asks for),
decide whether it is malware (1) or benign (0). This is also binary
classification.

**Limits of existing solutions.** Fixed rule lists (block "free prize") are
easy to get around, and signature scanners only know samples seen before. A
model trained on many examples can pick up patterns across thousands of
messages and files, and it can be retrained when attackers change.

**Why machine learning fits.** The signal is spread over many small clues (a
word, a header value, a permission), none of which is enough alone. Models are
good at weighing many weak clues together.

**Goal and measure.** F1 score above 0.90 on data the model has never seen,
because a model that only works on its own training data is of no use to a
real user. We also report accuracy, precision and recall.

## 3. Data collection

All data is open source, downloaded from Kaggle with the Kaggle command line
tool (`kaggle datasets download -d <owner>/<name>`). Licenses are recorded in
`dataset/*/INFO.md`.

**Spam (8 sources, 232,430 rows after merging).**

| source | type | origin |
| --- | --- | --- |
| email_ceas, email_enron, email_ling, email_spamassassin, email_nigerian, email_phishing | email | Kaggle "Phishing Email Dataset" (Alam) |
| sms_master | SMS | UCI SMS Spam Collection (Almeida et al. 2011) |
| sms_smishing_kaggle | SMS | Kaggle "Smishing SMS Dataset" (Soyturk) |

**Malware (4 platforms, 54,965 rows).**

| platform | rows | features | origin |
| --- | --- | --- | --- |
| pe_windows | 39,669 | 50 | PE headers: two Kaggle sets merged ("windows-malwares" and "pe-files-malwares") |
| android_drebin | 7,257 | 215 | Drebin-215 (Arp et al. 2014) |
| android_permissions | 7,379 | 86 | NATICUSdroid |
| android_tuandromd | 660 | 199 | TUANDROMD (Borah et al. 2020) |

**Process snapshots (1 dataset, 100,000 rows) for the regression task.**

| rows | processes | features | target | origin |
| --- | --- | --- | --- | --- |
| 100,000 | 100 | 32 counters | `nvcsw` | Kaggle "Malware Detection" (Saravana) |

The basic dataset covers one source. We used many sources so the model sees
different kinds of text, files and processes. This helped, and also created the
main difficulty of the project (section 4).

**Challenges.** Label meanings differed between files (`B`/`S`, `goodware`/
`malware`, `0`/`1`) and were checked by reading sample rows before merging. One
file renamed its label column between versions, and two files that describe the
same samples listed them under different identifier columns (`SHA256` and
`Name`), so the merge has to deduplicate on the feature values themselves.
Several sets were rejected after checking: `ang3loliveira` (96 to 97% malware,
no benign class to learn from), an Android permission set where 1,927 packages
carry both labels, and a Singapore SMS corpus with no label column at all.

The `nsaravana/malware` file was first rejected for classification, because
each of its 100 processes is repeated 1,000 times and every snapshot of a
process carries the same label, so a classifier would learn to identify the
process. Rather than discard 100,000 rows, we gave the file the task it can
honestly support: regression (section 4.3).

## 4. Data processing and analysis

### 4.1 Spam

`spam/clean_spam_dataset.py` applies five steps:

1. Remove empty texts, and texts that appear with both labels (the same text
   cannot be both).
2. Remove duplicates, ignoring case and punctuation. The email corpora overlap.
3. Replace links by `urltoken`, e-mail addresses by `emailtoken`, numbers by
   `0`, and drop quoted replies, month names and years.
4. Balance each source: the same number of spam and ham texts, at most 10,000
   of each. 88,077 messages remain.

**Why steps 3 and 4.** Our first model scored F1 0.949 in cross-validation but
looked suspicious: its strongest "ham" words were `enron`, `wrote`, `opensuse`,
`vince`, and its strongest "spam" words were `aug`, `2004`, `cnn`. These
identify the corpus, not the message. Every corpus has its own ham/spam ratio,
so a model can score well just by recognising the corpus. We tested this by
**leave-one-source-out** validation: train on seven sources, test on the
eighth. On the first dataset, F1 on an unseen SMS source fell to 0.47 (sms_master)
and 0.66 (smishing). Balancing each source and scrubbing the clues raised the
mean unseen-source F1 from 0.81 to 0.90. We later raised the per-source cap
from 5,000 to 10,000 rows and measured both settings the same way: the mean
unseen-source F1 moved from 0.898 to 0.902, and the email sources all improved
(for example `email_ceas` from 0.955 to 0.964), so the cap is now 10,000.
Experiments that did not change the dataset (a Naive Bayes model, K-Means on
raw TF-IDF) are in section 5.

**Analysis.** Figure 1 (`1_spam_sources.png`) shows messages per source after
balancing. Figure 2 shows that ham messages are longer on average (243 words)
than spam (169 words). Figure 4 shows the words the final model uses. Figure 5
shows the distribution of the regression target and the counters that track it.

### 4.2 Malware

Each platform has its own columns, and a table holding all four would be mostly
empty cells. We found that a single model trained on all four platforms reaches
F1 0.984 in ordinary cross-validation but only **0.099** when one platform is
held out entirely: it had learned to recognise the platform from which columns
were filled, not to recognise malware. The processing therefore keeps the
platforms apart:

1. One training file per platform, built from that platform's own raw download.
2. Drop rows whose feature values repeat, so the same sample cannot sit on both
   sides of a split; when a repeated group disagrees about the label, the
   majority vote decides and a tie drops the group.
3. Drop constant columns, and fill missing values with the training median
   inside the model pipeline so the medians come from the training data only.

The `label` column is never used as a feature.
Figure 3 shows rows and malware share per platform (19.7% to 82.8%).

### 4.3 Regression dataset

A second dataset answers a different kind of question, which is what the
assignment asks for as an additional implementation: instead of a yes/no label
it has a number to predict. `nsaravana/malware-detection` records 100 Linux
processes with 1,000 snapshots each, described by 32 runtime counters. We
predict `nvcsw`, the number of voluntary context switches.

The trap here is the same shape as the platform trap above. Every snapshot of
one process carries the same label, so a random split puts snapshots of the
same process on both sides and the model recognises the process. The split is
therefore grouped by `hash`: R2 falls from 0.980 (random) to 0.962 (grouped),
and the grouped number is the one we report. The file is not used for
classification, because a classifier would only identify which of the 100
processes a row belongs to.

## 5. Model selection

**Spam classification.** Logistic Regression on TF-IDF features. Reasons: it
is fast on 88,000 texts, it gives a probability, and each word gets a weight,
so the model can explain itself to the user. Settings were chosen using the
leave-one-source-out score, re-measured after the dataset was rebuilt:

| variant | mean F1, unseen source |
| --- | --- |
| Logistic Regression, 3,000 words | 0.886 |
| Logistic Regression, 20,000 words | 0.902 |
| Logistic Regression, 20,000 words + word pairs | 0.901 |
| Complement Naive Bayes, 3,000 words | 0.843 |

We use 20,000 single words. Word pairs were worth 0.004 on the earlier dataset
but 0.001 less than single words on the rebuilt one, and they make the model
several times larger and harder to explain, so we left them out. Complement
Naive Bayes is cheaper to train but clearly behind, which confirms the choice.

**Clustering.** K-Means (2 clusters) on the TF-IDF vectors, reduced to 50
dimensions with SVD. It sees no labels. Purity is 0.732 and the adjusted Rand
index is 0.215. Purity alone would flatter the result: with two clusters that
are each about half the data, a random split already scores around 0.5, and ARI
corrects for exactly that. So K-Means groups the messages only weakly by class
and is not a detector. [TODO: inspect the clusters and describe what they do
capture.] We report it as an experiment, and explain this limit in section 6.

**Malware classification.** Two models on every platform: Logistic Regression
(linear baseline, features scaled) and HistGradientBoosting (many small
decision trees, each fixing the errors of the last; Ke et al. 2017 describe
the method scikit-learn follows). Gradient boosting handles values on very
different scales and finds interactions between columns without extra work.

**Regression.** Ridge (linear regression with a small penalty on large
weights) on the 31 process counters, predicting `nvcsw`. Ridge is the right
first choice here because several counters move together (a process that does
more work raises several of them at once), and the penalty keeps the weights
stable when two inputs carry nearly the same information. We compare its
grouped score against the mean-answer baseline, because an R2 without that
baseline says nothing about how much the counters actually help.

## 6. Implementation and evaluation

### 6.1 Technical implementation

Python 3.12 with pandas, scikit-learn, matplotlib and joblib. Files:

| file | job |
| --- | --- |
| `build_datasets.py` | merges the raw Kaggle downloads into the training files |
| `spam/clean_spam_dataset.py` | spam cleaning |
| `analyze_data.py` | the five figures |
| `combined_model.py` | trains, evaluates and saves every model |
| `predict.py` | loads the models, makes predictions |
| `innovation-g2/main.py` | FastAPI service: `/api/spam`, `/api/malware`, `/api/process` |

Pipelines (`sklearn.pipeline.Pipeline`) tie preprocessing to the model. In
cross-validation they are refit inside every fold, so no information from the
test fold reaches training. Fixed random seed 42. We reused scikit-learn's
standard classes (Pedregosa et al. 2011) and wrote no custom algorithm.
The hard part was not the algorithms but the data: merged sources with
different formats, labels and hidden biases. Splitting the work into one build
script, one cleaning script and one training script made every number in this
report reproducible with three commands.

### 6.2 Results

**Spam** (88,077 messages).

| evaluation | accuracy | precision | recall | F1 |
| --- | --- | --- | --- | --- |
| 20% test split | 0.965 | 0.966 | 0.968 | 0.967 |
| 5-fold cross-validation | | | | 0.966 ± 0.001 |
| mean of unseen sources | | | | 0.902 |

F1 for each unseen source:

| source | F1 |
| --- | --- |
| email_ling | 0.968 |
| email_ceas | 0.964 |
| email_phishing | 0.962 |
| email_enron | 0.941 |
| email_spamassassin | 0.932 |
| sms_master | 0.800 |
| sms_smishing_kaggle | 0.749 |

`email_nigerian` is not in the table: it contains only spam, so a leave-one-
source-out run has one class and F1 is undefined.

**Malware**, 5-fold cross-validation F1 (test-split values are in
`malware_results.json`):

| platform | Logistic Regression | HistGradientBoosting |
| --- | --- | --- |
| pe_windows | 0.952 | **0.992** |
| android_drebin | 0.918 | **0.954** |
| android_permissions | 0.917 | **0.936** |
| android_tuandromd | 0.837 | **0.886** |

HistGradientBoosting wins on every platform. On `pe_windows` the test-split
precision is 0.992 and recall 0.997.

**Regression**, predicting `nvcsw` from the other counters:

| split | R2 | MAE | MAE of the mean-answer baseline |
| --- | --- | --- | --- |
| grouped by process (honest) | 0.962 | 954 | 6,390 |
| random | 0.980 | 945 | 6,642 |

The target varies by about 9,000 across snapshots, so an MAE of 954 is a real
gain next to the 6,390 a model that always answers the average would make. The
mean-answer baseline scores R2 0 on the random split but **-0.444** on the
grouped one, which is a useful reminder that the held-out processes are not
interchangeable: their average differs from the training processes, so a model
that answers the training mean does worse than no model at all. The gap
between R2 0.962 and 0.980 is the cost of the leak we removed.

### 6.3 Discussion

- The goal (F1 above 0.90 on unseen data) is met for email and for all
  malware platforms, but **not for SMS** (0.75 to 0.80). SMS messages are
  short, use slang and abbreviations, and our SMS data is the smallest part of
  the training set.
- The unseen-source number (0.902) is lower than the cross-validation number
  (0.966). The gap is the honest cost of a new source, and the number a user
  should expect.
- The model still keeps some bias to its sources: `enron` and `wrote` remain
  among its strongest ham words. We tested removing them by hand and measured
  the effect: the leave-one-source-out score moved from 0.898 to 0.892, so the
  hand-written word list did not help, and we left the words in. More diverse
  ham data is the better fix, since a hand-made list never ends.
- Two earlier conclusions did not survive the rebuilt dataset, which is why we
  re-measured them instead of quoting the old numbers: word pairs no longer
  help (0.901 against 0.902), and the per-source cap of 10,000 rows is now
  better than 5,000 (0.902 against 0.898).
- The malware models cannot judge a file from a platform they were not trained
  on. The user (or the website) has to say which platform a sample is from.
- TUANDROMD has only 660 rows. Its cross-validation standard deviation (0.046) is
  much larger than on the other platforms (0.001 to 0.008), so its score is less certain.
- K-Means reaches purity 0.732 but ARI only 0.215, so the grouping is weak and
  is reported as an experiment rather than used as a detector.
- Testing on held-out sources, platforms and processes found all three
  problems; the ordinary cross-validation scores (0.949, 0.984 and 0.980) hid
  them.

## 7. Conclusion

We built a spam classifier (F1 0.966 cross-validated, 0.902 on unseen sources),
four platform-specific malware classifiers (F1 0.886 to 0.992), a clustering
experiment (purity 0.732, ARI 0.215) and a regression model (R2 0.962), behind
a web service for all of them. The main lesson is that the first high score was
not trustworthy: every model looked excellent until tested on data from a
source, platform or process it had not seen. Fixing the **dataset** (balancing,
removing clues, splitting by platform and by process, and choosing the split
that matches how the model will be used) improved honest performance more than
changing the algorithm. The second lesson is that a measurement, not a
hunch, should decide each change: we tried six dataset variants and kept the
one that moved the honest score.

**Future work.** More SMS data from different countries and years. A
multilingual model (the data is English only). A way to guess the platform of
an uploaded file automatically. Run the dynamic API call data of the malware
sets through a sequence model. Predict the next counter value from a sequence
of snapshots instead of from a single one.

## Bibliography (Harvard style; check each entry and add the ones you really cite)

- Almeida, T.A., Hidalgo, J.M.G. and Yamakami, A. (2011) 'Contributions to the study of SMS spam filtering: new collection and results', *Proceedings of the 11th ACM Symposium on Document Engineering*, pp. 259-262.
- Arp, D., Spreitzenbarth, M., Hubner, M., Gascon, H. and Rieck, K. (2014) 'Drebin: effective and explainable detection of Android malware in your pocket', *NDSS Symposium*.
- Borah, P., Bhattacharyya, D.K. and Kalita, J.K. (2020) 'Malware dataset generation and evaluation', *IEEE CONECCT*.
- Ke, G. et al. (2017) 'LightGBM: a highly efficient gradient boosting decision tree', *Advances in Neural Information Processing Systems*, 30.
- Pedregosa, F. et al. (2011) 'Scikit-learn: machine learning in Python', *Journal of Machine Learning Research*, 12, pp. 2825-2830.
- Kaggle datasets: see `dataset/Kaggle datasets source.md` for authors, links and licenses.

## Appendix

- A: confusion matrices (`spam/spam_confusion_matrix.png`, `malware/malware_confusion_matrix.png`)
- B: figures 1 to 5 (`spam_malware_detection_model/spam/figures/`,
  `malware/figures/`, `regression/figures/`)
- C: full result files (`spam/spam_cv_results.json`, `malware/malware_results.json`,
  `regression/regression_results.json`)
- D: the training files the final models read, and `build_datasets.py` that
  rebuilds them from the raw Kaggle downloads
