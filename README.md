# Innovation-G2

COS30049 group project: spam, malware and process detection with machine
learning, served by a FastAPI web application with a React front end.

| folder | what it is |
| --- | --- |
| `spam_malware_detection_model/` | the training code, the saved models and the results |
| `innovation-g2/` | the FastAPI back end that serves the models |
| `frontend-react/` | the React front end (Vite) |
| `frontend/` | the earlier hand-written page, kept as a fallback |
| `dataset/` | the raw Kaggle downloads and the training files built from them |

## Run the app

Two servers: the FastAPI back end on port 3000 and the Vite dev server on
port 5173. Start the back end first, because the front end calls it.

### 1. The Python environment

The back end needs fastapi, uvicorn and pydantic; the models need pandas,
numpy, scikit-learn and joblib.

With conda:

```bash
conda env create -f spam_malware_detection_model/environment.yml
conda activate spam-malware
```

Without conda, a plain virtual environment works the same way:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r innovation-g2/requirements.txt
```

### 2. The back end

```bash
cd innovation-g2
python main.py
```

It binds 127.0.0.1:3000. Check it with:

```bash
curl http://127.0.0.1:3000/api/health
# {"status":"ok","models_loaded":true}
```

`models_loaded` is false when `combined_model.joblib` is missing. In that case
train the models first, see [Data and reproducibility](#data-and-reproducibility).

### 3. The front end

In a second terminal, from the repository root:

```bash
cd frontend-react
npm install
npm run dev
```

Then open <http://127.0.0.1:5173/>.

The dev server proxies `/api` to the back end on port 3000, so the browser
only ever talks to one origin and no CORS setup is needed. The dev server
listens on every interface, so a phone on the same network can open
`http://<the-computer-ip>:5173` to check the mobile layout.

### 4. One server instead of two

To serve the built front end from FastAPI, so only one process is needed:

```bash
cd frontend-react
npm install
npm run build

cd ../innovation-g2
python main.py
```

Then open <http://127.0.0.1:3000/>. The back end serves
`frontend-react/dist/` when it exists, and falls back to the older
hand-written page in `frontend/` when it does not.

### 5. The API documentation

<http://127.0.0.1:3000/docs> is the generated Swagger page, where every
endpoint can be called from the browser.

### The tests

```bash
cd innovation-g2 && python -m pytest test_api.py
cd spam_malware_detection_model && python -m pytest test_model.py
```

## Models

Three models ship in one bundle, `spam_malware_detection_model/combined_model.joblib`
(keys `spam`, `malware`, `regression`); the K-Means experiment on the
spam text is run and scored by the training script and is not saved:

| model | task | score (5-fold CV) | score on unseen data |
| --- | --- | --- | --- |
| spam | message text to ham/spam | F1 0.968 | F1 0.898 (unseen source) |
| malware | file features to benign/malware, one model per platform | F1 0.886 to 0.992 | Windows files from a new source: F1 0.75 to 0.89; the platform is chosen by the caller |
| regression | process counters to context switches | R2 0.974 | MAE 815 against 6390 for the mean answer |

Training code, data processing and instructions:
[spam_malware_detection_model/README.md](spam_malware_detection_model/README.md)

## Data and reproducibility

Every training file is rebuilt from the raw Kaggle downloads by one script:

```bash
python spam_malware_detection_model/build_datasets.py         # merge raw data
python spam_malware_detection_model/spam/clean_spam_dataset.py # clean the text
python spam_malware_detection_model/combined_model.py          # train and evaluate
```

Each task compares several models or settings and ships the best one; the
scores, the comparisons and the tests that guard the cleaning code are in the
model README. The tests run with `python -m pytest` in `innovation-g2/` and in
`spam_malware_detection_model/`.

Sources, authors and licenses are listed in `dataset/Kaggle datasets source.md`
and in the `INFO.md` file inside each source folder.

## Notes

- Both text models are trained on English SMS and email. Neither handles other
  languages. SMS is the weakest part (F1 0.745 to 0.785 on an unseen SMS source,
  and about 0.38 precision on ordinary SMS where 9% of messages are spam).
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

The Hugging Face copies were uploaded before the last round of cleaning, so
the model and dataset there are older than the ones in this repository.
Re-upload them if you want the published copies to match.
