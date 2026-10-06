# ==================================================================
# test_model.py -- load the trained model and score new messages.
#
#   spam_malware_detection_model_test/.venv/bin/python \
#       spam_malware_detection_model_test/test_model.py "your message"
#
# No argument      run the built-in smoke test
# --file PATH      score every row of a CSV and report accuracy
# --threshold N    move the spam cutoff (default 0.5)
# ==================================================================
import csv
import sys
from pathlib import Path

import joblib

# The 357 MB SpamAssassin export has multi-line bodies.
csv.field_size_limit(2**31 - 1)

HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "spam_model.joblib"


def load(path=MODEL_PATH):
    """Return (vectorizer, model, threshold) from the saved bundle."""
    bundle = joblib.load(path)
    return bundle["vectorizer"], bundle["model"], bundle.get("threshold", 0.5)


def predict_text(text, vectorizer, model, threshold=0.5):
    """Return (verdict, spam_probability) for one message."""
    feats = vectorizer.transform([str(text)])
    prob = float(model.predict_proba(feats)[0][1])
    return ("MALICIOUS/SPAM" if prob >= threshold else "BENIGN/HAM"), prob


def score_csv(path, vectorizer, model, threshold, text_col, label_col):
    """Score a labelled CSV and print a confusion summary."""
    import pandas as pd

    df = pd.read_csv(path, encoding="latin-1", on_bad_lines="skip")
    df = df.rename(columns=lambda c: str(c).strip())
    df = df[[text_col, label_col]].dropna()
    df[text_col] = df[text_col].astype(str)

    # Accept either a textual label (ham/spam) or a 0/1 column.
    raw = df[label_col].astype(str).str.strip().str.lower()
    truth = raw.map({
        "ham": 0, "spam": 1,
        "0": 0, "1": 1,
        "0.0": 0, "1.0": 1,
    })
    df = df.assign(y=truth).dropna(subset=["y"])
    df["y"] = df["y"].astype(int)

    probs = model.predict_proba(vectorizer.transform(df[text_col].tolist()))[:, 1]
    preds = (probs >= threshold).astype(int)

    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    )

    y, p = df["y"].to_numpy(), preds
    print("Rows scored :", len(y))
    print("Accuracy :", round(accuracy_score(y, p), 3))
    print("Precision:", round(precision_score(y, p, zero_division=0), 3))
    print("Recall   :", round(recall_score(y, p, zero_division=0), 3))
    print("F1 score :", round(f1_score(y, p, zero_division=0), 3))
    print("\nConfusion matrix (rows = actual, cols = predicted)")
    print("            pred HAM  pred SPAM")
    cm = confusion_matrix(y, p, labels=[0, 1])
    for name, row in zip(("actual HAM ", "actual SPAM"), cm):
        print("  %s   %6d    %6d" % (name, row[0], row[1]))

    wrong = df.assign(p=probs)[(df["y"].to_numpy() != p)]
    if len(wrong):
        print("\n--- %d misclassified, first 5 ---" % len(wrong))
        for _, row in wrong.head(5).iterrows():
            body = row[text_col].replace("\n", " ")[:60]
            print("  y=%d p=%.2f | %s" % (row["y"], row["p"], body))


if __name__ == "__main__":
    vec, mdl, thr = load()

    args = sys.argv[1:]
    if "--threshold" in args:
        i = args.index("--threshold")
        thr = float(args[i + 1])
        del args[i:i + 2]

    print("Model: %s (threshold %.2f)" % (mdl.__class__.__name__, thr))

    if args and args[0] == "--file":
        path = args[1]
        text_col = args[2] if len(args) > 2 else "text"
        label_col = args[3] if len(args) > 3 else "spam"
        score_csv(path, vec, mdl, thr, text_col, label_col)
    elif args:
        for text in args:
            verdict, prob = predict_text(text, vec, mdl, thr)
            print("  %-15s (%5.1f%% spam) | %s" % (verdict, prob * 100, text[:52]))
    else:
        samples = [
            "WIN a FREE prize now!! click http://bit.ly/x",
            "Can you send me the lecture notes?",
            "hi how are you",
            "Subject: buy cheap medication online, no prescription needed",
            "Team standup moved to 10am tomorrow, see you there",
        ]
        print("\n--- smoke test ---")
        for s in samples:
            verdict, prob = predict_text(s, vec, mdl, thr)
            print("  %-15s (%5.1f%% spam) | %s" % (verdict, prob * 100, s[:52]))
