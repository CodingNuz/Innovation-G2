# Spam and Malware Detection: Report (DRAFT)

> **Draft notes for the team.** The numbers below come from the saved result
> files in `spam_malware_detection_model/`. Fill the `[TODO]` items, rewrite
> the text in your own words (the assignment forbids AI-generated content),
> add figures from `spam_malware_detection_model/spam/figures/` (malware and
> regression figures are in their own folders), and check the word
> count (limit 3000, excluding cover page, table of contents, bibliography and
> appendix). The body is now about 2,975 words, so rewriting it in your own
> words will change the count; check it again before submitting.

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
messages and files, and it can be retrained when attackers change. The signal
is spread over many small clues (a word, a header value, a permission), none
of which is enough alone, and models are good at weighing many weak clues
together.

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
| pe_windows | 39,669 | 50 | PE headers: two Kaggle sets merged ("windows-malwares" and "pe-files-malwares"); a `source` column records which set a row came from |
| android_drebin | 7,257 | 215 | Drebin-215 (Arp et al. 2014) |
| android_permissions | 7,379 | 86 | NATICUSdroid |
| android_tuandromd | 660 | 241 | TUANDROMD (Borah et al. 2020) |

The feature counts are the columns as downloaded. Constant columns are dropped
before training, leaving 50, 215, 86 and 199 columns.

**Process snapshots (1 dataset, 100,000 rows) for the regression task.**

| rows | processes | features | target | origin |
| --- | --- | --- | --- | --- |
| 100,000 | 100 | 32 counters | `nvcsw` | Kaggle "Malware Detection" (Saravana) |

We used many sources so the model sees different kinds of text, files and
processes. This helped, and also created the main difficulty of the project
(section 4).

**Challenges.** Label meanings differed between files (`B`/`S`, `goodware`/
`malware`, `0`/`1`) and were checked by reading sample rows before merging. One
file renamed its label column between versions, and two files describing the
same samples listed them under different identifier columns (`SHA256` and
`Name`), so the merge deduplicates on the feature values themselves.
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

`spam/clean_spam_dataset.py` applies four steps, in this order:

1. Replace links by `urltoken`, e-mail addresses by `emailtoken`, numbers by
   `0`, and drop quoted replies, month names and years. This is `scrub()` in
   `textclean.py`; `predict.py` imports the same function, so a message typed
   into the website is cleaned the way the training texts were. Month names
   are matched as whole words (a first version also deleted "junk" and "market").
2. Remove empty texts, and texts that appear with both labels.
3. Remove duplicates, ignoring case and punctuation. This runs after step 1,
   because scrubbing makes many different messages identical.
4. Balance each source: the same number of spam and ham texts, at most 10,000
   of each. 87,798 messages remain. The spam share each source had before this
   step is saved, because the balanced test sets hide it (section 6.2).

**Why steps 1 and 4.** Our first model scored F1 0.949 in cross-validation, but
its strongest "ham" words were `enron`, `wrote`, `opensuse` and `vince`, and its
strongest "spam" words were `aug`, `2004` and `cnn`. These identify the corpus,
not the message. **Leave-one-source-out** validation (train on seven sources,
test on the eighth) exposed it: F1 on an unseen SMS source fell to 0.47 and
0.66. Balancing each source and scrubbing the clues raised the mean
unseen-source F1 from 0.81 to 0.90. Raising the per-source cap to 10,000 rows
helped a little more.

**Analysis.** Figure 1 (`1_spam_sources.png`) shows messages per source after
balancing. Figure 2 shows that ham messages are longer on average (248 words)
than spam (162 words). Figure 4 shows the words the final model uses. Figure 5
shows the regression target and the counters that track it.

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

The `label` column is never used as a feature. Figure 3 shows rows and malware
share per platform (19.7% to 82.8%).

The Windows table has the same trap on a smaller scale: it merges two files, one
92% malware and one 70%. A `source` column records the file of each row (the
model never reads it), so the table is also scored by training on one file and
testing on the other (section 6.2).

### 4.3 Regression dataset

A second dataset answers a different kind of question, which is what the
assignment asks for as an additional implementation: instead of a yes/no label
it has a number to predict. `nsaravana/malware-detection` records 100 Linux
processes with 1,000 snapshots each, described by 32 runtime counters. We
predict `nvcsw`, the number of voluntary context switches.

The trap here is the same shape as the platform trap above. Every snapshot of
one process carries the same label, so a random split puts snapshots of the
same process on both sides and the model recognises the process. The split is
therefore grouped by `hash`: the R2 of Ridge falls from 0.980 (random) to 0.962
(grouped), and that of HistGradientBoosting from a perfect 1.000 to 0.974
(grouped 5-fold). The grouped number is the one we report.

## 5. Model selection

**Spam classification.** Logistic Regression on TF-IDF features: it is fast on
88,000 texts, gives a probability, and gives each word a weight, so the model
can explain itself to the user. Seven settings were compared by the
leave-one-source-out score, each trained once per held-out source:

| setting | mean F1, unseen source |
| --- | --- |
| Logistic Regression, 20,000 words, C = 3 | **0.898** |
| Logistic Regression, 20,000 words + word pairs | 0.897 |
| Logistic Regression, 20,000 words (C = 1, the baseline) | 0.892 |
| Logistic Regression, 20,000 words, source words removed | 0.890 |
| Logistic Regression, 20,000 words, C = 0.3 | 0.886 |
| Logistic Regression, 3,000 words | 0.878 |
| Complement Naive Bayes, 3,000 words | 0.865 |

C sets how strongly large word weights are penalised (smaller C, stronger
penalty). We ship C = 3, which beats the baseline by 0.006; in the code a
setting must win by 0.002 to replace the baseline. Word pairs score the same
(0.897) but make the model several times larger. Dropping seven corpus-revealing
words does not help on a new source (0.890). Complement Naive Bayes is clearly
behind. The setting was picked on this score, so 0.898 is slightly optimistic;
it was not chosen on the test split or on cross-validation.

**Clustering.** K-Means on the TF-IDF vectors, reduced to 50 dimensions with
SVD. It sees no labels. With 2 clusters, purity is 0.748 and the adjusted Rand
index (ARI) is 0.245. Purity alone flatters the result, because a random split
of two half-size clusters already scores about 0.5; ARI corrects for that.
K-Means beat a Gaussian mixture and Ward clustering (ARI 0.08 each), and more
clusters raised purity but not ARI (0.272 at 4, 0.210 at 8). The two clusters
are not spam and ham: cluster 0 (42,599 messages, 26% spam) is led by `know`,
`enron`, `message` and `wrote`, work e-mail; cluster 1 (45,199 messages, 76%
spam) by `urltoken`, `free`, `click` and `offer`, promotion. The groups follow the
kind of text and partly the source corpus, so K-Means is an experiment, not a
detector.

**Malware classification.** Two models on every platform: Logistic Regression
(linear baseline, features scaled) and HistGradientBoosting (many small
decision trees, each fixing the errors of the last; Ke et al. 2017 describe
the method scikit-learn follows). Gradient boosting handles values on very
different scales and finds interactions between columns without extra work.
The winner per platform is chosen on cross-validation, not on the test split.

**Regression.** Ridge (linear regression with a small penalty on large weights)
and HistGradientBoosting on the 31 process counters, predicting `nvcsw`. They
are compared by grouped 5-fold cross-validation, which keeps all snapshots of a
process in one fold; one grouped split holds only 20 processes, too few to
separate them. Each is also compared with the mean-answer baseline, because an
R2 without it says nothing about how much the counters help.

## 6. Implementation and evaluation

### 6.1 Technical implementation

Python 3.12 with pandas, scikit-learn, matplotlib and joblib. Files:

| file | job |
| --- | --- |
| `build_datasets.py` | merges the raw Kaggle downloads into the training files |
| `spam/clean_spam_dataset.py` | spam cleaning |
| `textclean.py` | the text scrub, shared by training and prediction |
| `evaluation.py` | leave-one-source-out scoring and precision at another class mix |
| `analyze_data.py` | the five figures |
| `combined_model.py` | trains, evaluates and saves every model |
| `predict.py` | loads the models, makes predictions |
| `innovation-g2/main.py` | FastAPI service: `/api/spam`, `/api/malware`, `/api/process` |
| `test_model.py`, `innovation-g2/test_api.py` | tests for the model code and the API |

Pipelines (`sklearn.pipeline.Pipeline`) tie preprocessing to the model. In
cross-validation they are refit inside every fold, so no information from the
test fold reaches training. Fixed random seed 42. We reused scikit-learn's
standard classes (Pedregosa et al. 2011) and wrote no custom algorithm.
The hard part was the data, not the algorithms: merged sources with different
formats, labels and hidden biases. One build script, one cleaning script and
one training script made every number in this report reproducible with three
commands.

### 6.2 Results

**Spam** (87,798 messages).

| evaluation | accuracy | precision | recall | F1 |
| --- | --- | --- | --- | --- |
| 20% test split | 0.968 | 0.969 | 0.969 | 0.969 |
| 5-fold cross-validation | | | | 0.968 ± 0.002 |
| mean of unseen sources | | | | 0.898 |

`email_nigerian` is not in the table: it contains only spam, so a leave-one-
source-out run has one class and F1 is undefined.

F1 for each unseen source, and the precision the model would have on the class
mix that source really has. The test sets are balanced, which flatters
precision wherever spam is the smaller class, so the precision is worked out
from recall, the false positive rate and the spam share each source had before
balancing:

| source | F1 | real spam share | precision at that share |
| --- | --- | --- | --- |
| email_ling | 0.970 | 16% | 0.910 |
| email_ceas | 0.964 | 47% | 0.955 |
| email_enron | 0.951 | 49% | 0.986 |
| email_phishing | 0.941 | 53% | 0.984 |
| email_spamassassin | 0.928 | 28% | 0.845 |
| sms_master | 0.785 | 9% | 0.377 |
| sms_smishing_kaggle | 0.745 | 40% | 0.570 |

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

The `pe_windows` score is for a random split. Trained on one source file and
scored on the other, it falls:

| trained on | scored on | Logistic Regression F1 | HistGradientBoosting F1 |
| --- | --- | --- | --- |
| windows_malwares (92% malware) | pe_files_malwares (70%) | 0.773 | 0.750 |
| pe_files_malwares | windows_malwares | 0.764 | 0.891 |

**Regression**, predicting `nvcsw` from the other counters:

| model | grouped 5-fold R2 | grouped 5-fold MAE | R2 without `utime` | R2, random split |
| --- | --- | --- | --- | --- |
| HistGradientBoosting (chosen) | **0.974** ± 0.014 | **815** | 0.940 | 1.000 |
| Ridge | 0.963 ± 0.026 | 1,058 | 0.933 | 0.980 |

The target varies by about 47,000 across snapshots, so an MAE of 815 is a real
gain next to the 6,390 of a model that always answers the average. That
baseline scores R2 **-0.444** on the grouped split, because the held-out
processes differ from the training ones. The random split shows the leak we
removed: HistGradientBoosting scores a perfect 1.000 there by recognising the
process. The closest counter is `utime` (correlation 0.946, CPU time); without
it R2 stays above 0.93. The target still grows with running time, so this task
says little about whether a process is malware.

### 6.3 Discussion

- The goal (F1 above 0.90 on unseen data) is met for the email sources and,
  by cross-validation, for the Windows, Drebin and permissions platforms. It is
  **not met for SMS** (0.745 and 0.785) or TUANDROMD (0.886 in
  cross-validation, 0.76 on its test split). SMS messages are short and use
  slang, and are the smallest part of the training set.
- Precision on real traffic is lower than the balanced tests suggest. For
  ordinary SMS, where 9% of messages are spam, it is about 0.38: most messages
  flagged as spam would be ham.
- The unseen-source number (0.898) is lower than cross-validation (0.968). The
  gap is the honest cost of a new source, and what a user should expect.
- Source bias remains: `enron`, `wrote`, `vince`, `opensuse` and `louise` are among
  the strongest ham words. Dropping them moved the score from 0.892 to 0.890,
  so we left them in. More diverse ham data is the better fix.
- The Windows score of 0.992 falls to 0.75 to 0.89 on the file the model did not
  train on, so it holds only for files that look like the training files.
- The malware models cannot judge a file from another platform; the user must
  say which platform a sample is from.
- TUANDROMD has only 660 rows, so its score is less certain (cross-validation
  standard deviation 0.046 against 0.001 to 0.008 elsewhere).
- Testing on held-out sources, platforms and processes found all four problems;
  the ordinary scores hid them.

## 7. Conclusion

We built a spam classifier (F1 0.968 cross-validated, 0.898 on unseen sources),
four platform-specific malware classifiers (F1 0.886 to 0.992), a clustering
experiment (purity 0.748, ARI 0.245) and a regression model (R2 0.974), behind
a web service for all of them. The main lesson is that the first high score was
not trustworthy: every model looked excellent until tested on data from a
source, platform or process it had not seen. Fixing the **dataset** (balancing,
removing clues, splitting by platform and by process, and choosing the split
that matches how the model will be used) improved honest performance more than
changing the algorithm. The second lesson is that a measurement, not a
hunch, should decide each change.

**Future work.** More SMS data from different countries and years. A
multilingual model (the data is English only). A way to guess the platform of
an uploaded file automatically. Predict the next counter value from a sequence
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
