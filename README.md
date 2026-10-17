# Innovation-G2

COS30049 group project: spam, malware and process detection with machine
learning, served by a FastAPI web application.

## Run the server

```bash
cd innovation-g2
python main.py
```

Then open <http://127.0.0.1:3000/> for the page and
<http://127.0.0.1:3000/docs> for the API documentation.

The server needs pandas, scikit-learn and joblib as well as fastapi, because
it loads the models. Install them first:

```bash
conda env create -f spam_malware_detection_model/environment.yml
conda activate spam-malware
```

## Models

Four models ship in one bundle, `spam_malware_detection_model/combined_model.joblib`
(keys `spam`, `malware`, `regression`):

| model | task | score (5-fold CV) | score on unseen data |
| --- | --- | --- | --- |
| spam | message text to ham/spam | F1 0.966 | F1 0.902 (unseen source) |
| malware | file features to benign/malware, one model per platform | F1 0.886 to 0.992 | not applicable, the platform is chosen by the caller |
| clustering | K-Means groups the messages with no labels | purity 0.732 | ARI 0.215 |
| regression | process counters to context switches | R2 0.962 | MAE 954 against 6390 for the mean answer |

Training code, data processing and instructions:
[spam_malware_detection_model/README.md](spam_malware_detection_model/README.md)

## Data and reproducibility

Every training file is rebuilt from the raw Kaggle downloads by one script:

```bash
python spam_malware_detection_model/build_datasets.py         # merge raw data
python spam_malware_detection_model/spam/clean_spam_dataset.py # clean the text
python spam_malware_detection_model/combined_model.py          # train and evaluate
```

Sources, authors and licenses are listed in `dataset/Kaggle datasets source.md`
and in the `INFO.md` file inside each source folder.

## Notes

- Both text models are trained on English SMS and email. Neither handles other
  languages. SMS is the weakest part (F1 0.75 to 0.80 on an unseen SMS source).
- Each malware model only understands its own platform's feature columns.

## Published copies

The model and the complete dataset are also on Hugging Face, for people who
want the data without cloning the repository:

- Model: <https://huggingface.co/Skibidibois2000/spam-malware-detection-model>
- Dataset: <https://huggingface.co/datasets/Skibidibois2000/spam-malware-detection-dataset>

The two largest files, `dataset/spam_train_dataset.csv` and
`dataset/spam_train_clean.csv`, are not tracked in git because they exceed
GitHub's size limits. Both are in the Hugging Face dataset above, and both can
be rebuilt from the raw downloads with the three commands in
[Data and reproducibility](#data-and-reproducibility).
