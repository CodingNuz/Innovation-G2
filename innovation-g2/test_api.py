"""Tests for the API and the prediction code behind it.

Run:  cd innovation-g2 && python -m pytest test_api.py
(needs the saved models: run combined_model.py first)
"""

import pytest
from fastapi.testclient import TestClient

from main import app      # also puts the model folder on sys.path
import predict

client = TestClient(app)


def post(path, body):
    return client.post("/api/" + path, json=body)


def test_health_reports_models_loaded():
    assert client.get("/api/health").json() == {"status": "ok", "models_loaded": True}


def test_spam_and_ham_get_opposite_verdicts():
    spam = post("spam", {"text": "WIN a FREE prize now, click the link to claim your reward"})
    ham = post("spam", {"text": "Are we still meeting for lunch tomorrow at the office?"})
    assert spam.json()["verdict"] == "SPAM"
    assert ham.json()["verdict"] == "HAM"


@pytest.mark.parametrize("text", ["", "   ", "zzzqq xxkkj", "日本語のメッセージ"])
def test_spam_rejects_text_with_no_known_word(text):
    assert post("spam", {"text": text}).status_code in (400, 422)


def test_malware_partial_sample_reports_what_was_imputed():
    columns = client.get("/api/malware/features", params={"platform": "pe_windows"}).json()
    first = columns["pe_windows"][0]
    reply = post("malware", {"platform": "pe_windows", "features": {first: 4}}).json()
    assert reply["features_given"] == 1
    assert reply["features_imputed"] == len(columns["pe_windows"]) - 1


def test_malware_rejects_unknown_platform_and_unknown_columns():
    assert post("malware", {"platform": "nope", "features": {}}).status_code == 400
    assert post("malware", {"platform": "pe_windows", "features": {}}).status_code == 400
    assert post("malware", {"platform": "pe_windows", "features": {"zzz": 1}}).status_code == 400


def test_process_answer_stays_inside_the_training_range():
    reply = post("process", {"features": {"utime": 1e12}}).json()
    low, high = predict.load_bundle()["regression"]["target_range"]
    assert low <= reply["prediction"] <= high
    assert isinstance(reply["clipped"], bool)
    assert client.get("/api/model").json()["regression_target"] == "nvcsw"


def test_process_rejects_unknown_columns():
    assert post("process", {"features": {"zzz": 1}}).status_code == 400
    assert post("process", {"features": {}}).status_code == 400
