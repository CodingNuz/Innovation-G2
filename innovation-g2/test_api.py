"""Tests for the API and the prediction code behind it.

Run:  cd innovation-g2 && python -m pytest test_api.py
(needs the saved models: run combined_model.py first)
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path

from main import app      # also puts the model folder on sys.path
import extract
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


# ------------------------------------------------------------ file upload

def make_pe(timestamp=1_400_000_000, size_of_code=4096):
    """A header-only 32-bit PE with known values (no sections, no code)."""
    import struct
    dos = b"MZ" + bytes(58) + struct.pack("<I", 0x40)
    coff = struct.pack("<HHIIIHH", 0x14C, 0, timestamp, 0, 0, 224, 0x102)
    optional = struct.pack(
        "<HBB" + "I" * 9 + "HHHHHH" + "IIII" + "HH" + "IIIIII",
        0x10B, 9, 0, size_of_code, 0, 0, 0x1000, 0x1000, 0x2000, 0x400000,
        0x1000, 0x200, 4, 0, 0, 0, 4, 0, 0, 0x3000, 0x200, 0, 3, 0x8140,
        0x100000, 0x1000, 0x100000, 0x1000, 0, 16) + bytes(128)
    return dos + b"PE\0\0" + coff + optional


def upload(data, name="sample.exe", **form):
    return client.post("/api/malware/upload", files={"file": (name, data)}, data=form)


def test_pe_header_fields_are_read_into_the_models_columns():
    columns = predict.malware_feature_names("pe_windows")
    features = extract.extract_pe(make_pe(timestamp=1_400_000_000, size_of_code=777), columns)
    assert set(features) == set(columns)           # all 50, none left for the imputer
    assert features["TimeDateStamp"] == 1_400_000_000
    assert features["SizeOfCode"] == 777
    assert features["Machine"] == 0x14C and features["Magic"] == 0x10B
    assert features["e_lfanew"] == 0x40


def test_upload_pe_is_scored_by_the_windows_model():
    reply = upload(make_pe()).json()
    assert reply["file_type"] == "pe"
    assert reply["verdict"] in ("MALWARE", "BENIGN")
    assert [r["platform"] for r in reply["results"]] == ["pe_windows"]
    assert reply["results"][0]["features_given"] == 50
    assert reply["results"][0]["features_imputed"] == 0
    assert len(reply["sha256"]) == 64 and reply["size"] == len(make_pe())


def test_upload_rejects_unsupported_empty_and_mismatched_files():
    assert upload(b"just some text, not a program").status_code == 415
    assert upload(b"").status_code == 400
    assert upload(make_pe(), platform="android_drebin").status_code == 400
    assert upload(b"MZ" + bytes(10)).status_code == 400          # PE magic, broken header


def test_upload_rejects_a_zip_that_is_not_an_apk():
    import io, zipfile
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("readme.txt", "hello")
    assert upload(buffer.getvalue(), "x.zip").status_code == 415


def test_upload_rejects_an_apk_whose_manifest_cannot_be_read():
    import io, zipfile
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("AndroidManifest.xml", b"this is not a manifest")
    assert upload(buffer.getvalue(), "broken.apk").status_code == 400


def test_upload_apk_is_scored_by_all_three_android_models():
    """A real APK, if one is placed next to the tests, must go through the
    whole path: manifest, dex, features, three models, one verdict.

    The file is not shipped with the repository (it is 12 MB and it is not
    the project's own data), so the test is skipped when it is not there.
    """
    apk = Path(__file__).resolve().parent / "sample.apk"
    if not apk.exists():
        pytest.skip("no sample.apk next to the tests")

    reply = upload(apk.read_bytes(), "sample.apk").json()
    assert reply["file_type"] == "apk"
    assert reply["verdict"] in ("MALWARE", "BENIGN")
    assert [r["platform"] for r in reply["results"]] == [
        "android_permissions", "android_drebin", "android_tuandromd"]
    for result in reply["results"]:
        # Every column of every Android model is answered from the file, so
        # the imputer has nothing to guess.
        assert result["features_imputed"] == 0
        assert result["features_given"] == len(predict.malware_feature_names(result["platform"]))
    # The majority vote of the three models is the verdict.
    votes = sum(1 for r in reply["results"] if r["verdict"] == "MALWARE")
    assert reply["verdict"] == ("MALWARE" if votes * 2 > 3 else "BENIGN")
    assert reply["models_voting_malware"] == votes


def test_android_tokens_match_each_datasets_column_spelling():
    tokens = set()
    extract._add_method(tokens, "Ljava/lang/Runtime;", "exec")
    extract._add_method(tokens, "Lorg/apache/http/client/methods/HttpGet;", "<init>")
    tokens.update({"android.permission.SEND_SMS", "SEND_SMS", "android.permission.READ_PHONE_STATE"})
    tokens.add("android.intent.action.BOOT_COMPLETED")

    drebin = extract.android_features(
        tokens, ["Runtime.exec", "HttpGet.init", "SEND_SMS", "READ_SMS",
                 "Ljava.lang.Runtime.exec", "android.intent.action.BOOT_COMPLETED"],
        "android_drebin")
    assert drebin == {"Runtime.exec": 1.0, "HttpGet.init": 1.0, "SEND_SMS": 1.0,
                      "READ_SMS": 0.0, "Ljava.lang.Runtime.exec": 1.0,
                      "android.intent.action.BOOT_COMPLETED": 1.0}

    tuandromd = extract.android_features(
        tokens, ["Ljava/lang/Runtime;->exec", "SEND_SMS", "BIND_goodwareTIFICATION_LISTENER_SERVICE"],
        "android_tuandromd")
    assert tuandromd["Ljava/lang/Runtime;->exec"] == 1.0 and tuandromd["SEND_SMS"] == 1.0
    assert extract._lookup_key("BIND_goodwareTIFICATION_LISTENER_SERVICE",
                               "android_tuandromd") == "BIND_NOTIFICATION_LISTENER_SERVICE"
    assert extract._lookup_key("Landroid/location/LocationManager;->getLastKgoodwarewnLocation",
                               "android_tuandromd").endswith("getLastKnownLocation")

    permissions = extract.android_features(
        tokens, ["android.permission.SEND_SMS",
                 "android.permission.android.permission.READ_PHONE_STATE"],
        "android_permissions")
    assert permissions == {"android.permission.SEND_SMS": 1.0,
                           "android.permission.android.permission.READ_PHONE_STATE": 1.0}
