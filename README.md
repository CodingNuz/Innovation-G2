# Innovation-G2

COS30049 group project: spam, malware and process detection with machine
learning, served by a FastAPI web application with a React front end.

| folder | what it is |
| --- | --- |
| `spam_malware_detection_model/` | the training code, the saved models and the results |
| `innovation-g2/` | the FastAPI back end that serves the models |
| `frontend-react/` | the React front end (Vite) — the only front end |
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
`frontend-react/dist/` when it exists; without a build, `/` returns 503 and
the API is still available.

### 5. The API documentation

<http://127.0.0.1:3000/docs> is the generated Swagger page, where every
endpoint can be called from the browser.

### 6. The assistant tab

The **Assistant** tab is a chat box over the three models. It does not answer
from the language model's memory: the model calls the same prediction code as
the other tabs and explains the result it gets back. Each answer can be
expanded to show the tool call and its raw output.

The chat talks to an OpenAI-compatible server. There are no built-in hosts or
keys: copy `.env.example` to `.env` (or export the variables) and set:

| setting | what it is |
| --- | --- |
| `LLM_BASE_URL` | base URL of any OpenAI-compatible server, e.g. `http://localhost:8000/v1` |
| `LLM_MODEL` | the model ID that server exposes |
| `LLM_API_KEY` | its API key (never committed) |

`LLM_TIMEOUT` is optional (default 300 seconds). With the variables set,
`cd innovation-g2 && python main.py` needs nothing else. Without them the API
still starts and the other tabs work, but a chat request returns a clear
"model server is not configured" error.
`GET /api/agent/info` reports whether the server is reachable and whether
the configured model is one it serves.

The chat box also takes one attached file: a PDF, a Windows PE (.exe/.dll), an
Android APK, a picture (PNG, JPEG, GIF or BMP), or a plain text/email/HTML
message, up to 10 MB. Attach it with the paperclip or by dropping it on the
panel, then ask a question or leave the box empty to get "Analyse the attached
file". The assistant gets three extra tools for that turn
(`get_attachment`, `read_attachment_text`, `scan_attachment`) and the
reply still carries the tool log.

The file is held in memory only. Nothing is written to disk and nothing is
executed: a PDF is read with PyMuPDF (text, links, embedded files, active
content), and a PE or APK goes through the same parser the Malware tab uses.
A PDF or text file is scored by the spam model on its extracted text; a PE or
APK is scored by the malware models. An unsupported file is refused with 415.

Pictures are accepted in the Assistant tab only. Reading a screenshot is a job
the assistant does before any model can judge it: the vision model is the only
reader, it writes out the visible text and passes that transcription to
`scan_attachment`, which scores it with the same spam model the Spam tab uses.
A screenshot of a phishing email therefore gets the same verdict as the email
pasted in as text, and there is no second reader for the two paths to drift
apart on. If the model cannot read any text it says so instead of inventing a
verdict. Large images are halved until they fit 1600 px on the long side, which
keeps the request small.

`POST /api/scan/upload` refuses a picture and points at the Assistant tab.

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
| spam | message text to ham/spam | F1 0.979 | F1 0.912 (unseen source) |
| malware | file features to benign/malware, one model per platform | F1 0.689 to 1.000 (per-platform CV F1) | Windows files from a new source: F1 0.71 to 0.89; the platform is chosen by the caller |
| regression | process counters to context switches | R2 0.979 | MAE 742 against 6390 for the mean answer |

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
  languages. SMS is the weakest part: on an unseen SMS source the F1 is 0.816
  (`sms_master`) and 0.803 (`sms_smishing_kaggle`), against 0.956 to 0.984 for
  the email sources. On ordinary SMS, where 9.5% of the messages are spam, the
  precision is 0.572, so about half of the flagged messages are not spam.
- Each malware model only understands its own platform's feature columns.
- **Scanning a file.** `POST /api/scan/upload` (also the "Scan a file" box on the
  malware screen) takes one or more files in a `files` field: a Windows `.exe`/`.dll`,
  an Android `.apk`, a PDF or a text/email message. The bytes decide which model
  runs: `pefile` reads the 50 PE header fields, `androguard` reads the manifest
  permissions and the API calls in every `classes.dex`, and a PDF or message is
  scored by the spam model on its extracted text. An APK is scored by the three
  Android models and the majority vote is the verdict. Pass `platform=...` to
  score a PE/APK with one named model only. The file is parsed and never run.
  The models are unchanged, so they keep their limits: a clean 64-bit or unusual PE
  can score as malware (the Windows model reaches F1 0.71 to 0.89 on files from a new
  source), and only the features that the file itself provides are used.
  ```bash
  curl -F files=@sample.apk http://127.0.0.1:3000/api/scan/upload
  ```
  The upload is read, never run, and the file is not kept. The `python-multipart`,
  `pefile` and `androguard` packages it needs are in `innovation-g2/requirements.txt`
  and in `spam_malware_detection_model/environment.yml`.

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
