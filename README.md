# Innovation-G2

If you see this line, you are on the right repository

## Spam / malware model

In `Test_trained_ML_model/`: `spam_model.joblib` (Logistic Regression + TF-IDF, F1 0.947),
`test_model.py` (runner), `requirements.txt` (dependencies).

### How to use
Recommend to run it in venv environment 

```bash
.../.venv/bin/python \
    Test_trained_ML_model/test_model.py "your message here"

# or score a labelled CSV:
.../.venv/bin/python \
    Test_trained_ML_model/test_model.py --file dataset_test/emails.csv text spam
```

To run elsewhere: `pip install -r Test_trained_ML_model/requirements.txt`

Or in Python:

```python
import joblib

bundle = joblib.load("Test_trained_ML_model/spam_model.joblib")
prob = bundle["model"].predict_proba(
    bundle["vectorizer"].transform(["your message here"])
)[0][1]
# prob >= bundle["threshold"] (0.5) means SPAM
```

Note: trained on English SMS/email data only, so non-English text is unreliable.
