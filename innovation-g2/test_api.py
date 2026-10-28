"""Tests for the API and the prediction code behind it.

Run:  cd innovation-g2 && python -m pytest test_api.py
(needs the saved models: run combined_model.py first)
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path

import hashlib
import base64
import io

import pymupdf

from main import app      # also puts the model folder on sys.path
import extract
import predict
import attachments

# --------------------------------------------------- chat attachments

import base64
import io
import zipfile

import pymupdf

import attachments


def pdf_with_text(text="WIN a FREE prize now, click http://evil.example/claim",
                  links=True):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    if links:
        page.insert_link({"kind": pymupdf.LINK_URI,
                          "from": pymupdf.Rect(72, 100, 200, 120),
                          "uri": "http://evil.example/claim"})
    return doc.tobytes()


def minimal_pe():
    """A DOS header with the PE signature where pefile looks for it."""
    header = bytearray(0x40 + 4 + 20)
    header[0:2] = b"MZ"
    header[0x3C:0x40] = (0x40).to_bytes(4, "little")
    header[0x40:0x44] = b"PE\x00\x00"
    return bytes(header)


def test_inspect_pdf_reads_text_links_and_metadata():
    attachment = attachments.inspect(pdf_with_text(), "mail.pdf")
    assert attachment.kind == "pdf"
    assert attachment.pages == 1
    assert "WIN a FREE prize" in attachment.text
    assert attachment.links == ["http://evil.example/claim"]
    summary = attachment.summary()
    assert summary["sha256"] == hashlib.sha256(attachment.data).hexdigest()
    assert summary["size"] == len(attachment.data)
    # The bytes are described, never included.
    assert "data" not in summary and "text" not in summary


def test_inspect_pdf_notes_embedded_files():
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "hi")
    doc.embfile_add("evil.js", b"app.alert(1)")
    attachment = attachments.inspect(doc.tobytes(), "e.pdf")
    assert any("embedded file" in note for note in attachment.notes)
    assert any("active content" in note for note in attachment.notes)


def test_inspect_text_email_and_html():
    plain = attachments.inspect(b"WIN a FREE prize", "m.txt")
    assert plain.kind == "text" and plain.text == "WIN a FREE prize"

    eml = (b"From: a@b.com\nSubject: Prize\nContent-Type: text/plain\n\n"
           b"WIN a FREE prize, click http://evil.example\n")
    email = attachments.inspect(eml, "m.eml")
    assert email.kind == "email"
    assert "Subject: Prize" in email.text
    assert "http://evil.example" in email.links

    markup = attachments.inspect(
        b"<html><body><p>WIN</p><script>x()</script>"
        b"<a href=\"http://e.example\">c</a></body></html>", "p.html")
    assert markup.kind == "html"
    assert "WIN" in markup.text
    assert "http://e.example" in markup.links
    assert any("script" in note for note in markup.notes)


def test_inspect_rejects_empty_unsupported_and_encrypted():
    for data in (b"", b"\x00\x01 binary"):
        with pytest.raises(attachments.UnsupportedFile):
            attachments.inspect(data, "x.bin")

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "secret")
    encrypted = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256,
                            owner_pw="o", user_pw="u")
    with pytest.raises(ValueError):
        attachments.inspect(encrypted, "enc.pdf")


def test_inspect_never_writes_to_disk(monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("inspect wrote a file")

    monkeypatch.setattr(io, "open", refuse, raising=False)
    attachment = attachments.inspect(pdf_with_text(), "mail.pdf")
    assert attachment.text


def test_file_tools_refuse_without_an_attachment():
    for name in agent.ATTACHMENT_TOOL_NAMES:
        assert "no file is attached" in agent.run_tool(name, {})["error"]


def test_read_attachment_text_paginates():
    attachment = attachments.inspect(b"abcdefghij", "a.txt")
    first = agent.run_tool("read_attachment_text",
                           {"offset": 0, "limit": 4}, attachment)
    assert first["text"] == "abcd" and first["next_offset"] == 4
    second = agent.run_tool("read_attachment_text",
                            {"offset": 4, "limit": 4}, attachment)
    assert second["text"] == "efgh" and second["next_offset"] == 8
    last = agent.run_tool("read_attachment_text",
                          {"offset": 8, "limit": 4}, attachment)
    assert last["text"] == "ij" and last["next_offset"] is None
    assert last["total_chars"] == 10


def test_read_attachment_text_caps_the_limit():
    attachment = attachments.inspect(b"x" * 20000, "a.txt")
    reply = agent.run_tool("read_attachment_text",
                           {"offset": 0, "limit": 999999}, attachment)
    assert reply["returned"] == agent.ATTACHMENT_TEXT_CHUNK


def test_scan_attachment_uses_the_spam_model_for_text():
    attachment = attachments.inspect(
        b"WIN a FREE prize now, click the link to claim your reward", "m.txt")
    reply = agent.run_tool("scan_attachment", {}, attachment)
    assert reply["verdict"] == "SPAM"
    assert reply["filename"] == "m.txt"


def test_get_attachment_returns_the_summary():
    attachment = attachments.inspect(pdf_with_text(), "mail.pdf")
    reply = agent.run_tool("get_attachment", {}, attachment)
    assert reply["filename"] == "mail.pdf"
    assert reply["kind"] == "pdf"
    assert reply["links"] == ["http://evil.example/claim"]


def test_chat_offers_file_tools_only_when_a_file_is_attached(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    sent = []

    def handler(request):
        sent.append(json.loads(request.content))
        return httpx.Response(200, json=text_reply("done"))

    agent.chat("hello", client=fake_client(handler))
    names = [t["function"]["name"] for t in sent[-1]["tools"]]
    assert names == agent.TOOL_NAMES
    assert "A file is attached" not in sent[-1]["messages"][0]["content"]

    attachment = attachments.inspect(pdf_with_text(), "mail.pdf")
    agent.chat("check this", client=fake_client(handler), attachment=attachment)
    names = [t["function"]["name"] for t in sent[-1]["tools"]]
    assert names == agent.TOOL_NAMES + agent.ATTACHMENT_TOOL_NAMES
    assert "A file is attached" in sent[-1]["messages"][0]["content"]
    # The prompt names the file but never carries its bytes.
    assert "mail.pdf" in sent[-1]["messages"][-1]["content"]
    assert "JVBERi" not in json.dumps(sent[-1])


def test_chat_with_a_pdf_runs_the_file_tools(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    attachment = attachments.inspect(pdf_with_text(), "mail.pdf")
    rounds = [
        tool_call_reply("call_1", "get_attachment", {}),
        tool_call_reply("call_2", "scan_attachment", {}),
        text_reply("SPAM, 0.95"),
    ]

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    reply = agent.chat("is this spam?", client=fake_client(handler),
                       attachment=attachment)
    assert [c["tool"] for c in reply["tool_calls"]] == ["get_attachment", "scan_attachment"]
    assert reply["tool_calls"][0]["result"]["kind"] == "pdf"
    assert reply["tool_calls"][1]["result"]["verdict"] == "SPAM"
    assert reply["reply"] == "SPAM, 0.95"


def test_chat_route_rejects_a_bad_attachment():
    body = {"prompt": "check", "attachment": {"filename": "a.pdf",
                                              "content_b64": "not base64!!"}}
    assert post("chat", body).status_code == 400

    body["attachment"]["content_b64"] = base64.b64encode(b"").decode()
    assert post("chat", body).status_code == 422

    big = base64.b64encode(b"\x00" * (10 * 1024 * 1024 + 1)).decode()
    body["attachment"] = {"filename": "big.bin", "content_b64": big}
    assert post("chat", body).status_code == 413

    body["attachment"] = {"filename": "a.bin",
                          "content_b64": base64.b64encode(b"\x00\x01").decode()}
    assert post("chat", body).status_code == 415


def test_chat_route_accepts_a_pdf_attachment(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    seen = {}

    def fake_chat(prompt, history=None, client=None, on_event=None, attachment=None):
        seen["attachment"] = attachment
        return {"reply": "ok", "tool_calls": [], "rounds": 1, "finish_reason": "stop"}

    monkeypatch.setattr(agent, "chat", fake_chat)
    body = {"prompt": "check this",
            "attachment": {"filename": "mail.pdf",
                           "content_b64": base64.b64encode(pdf_with_text()).decode()}}
    reply = post("chat", body)
    assert reply.status_code == 200
    assert seen["attachment"].kind == "pdf"
    assert "WIN a FREE prize" in seen["attachment"].text


def test_chat_stream_sends_the_attachment_event_first(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    rounds = [
        tool_call_reply("call_1", "scan_attachment", {}),
        text_reply("SPAM"),
    ]

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    monkeypatch.setattr(agent, "default_client", lambda: fake_client(handler))
    body = {"prompt": "check this", "history": [],
            "attachment": {"filename": "mail.pdf",
                           "content_b64": base64.b64encode(pdf_with_text()).decode()}}

    with client.stream("POST", "/api/chat/stream", json=body) as reply:
        text = "".join(reply.iter_text())

    events = [line.split(": ", 1)[1] for line in text.splitlines()
              if line.startswith("event: ")]
    assert events == ["attachment", "tool_start", "tool_end", "done"]
    assert json.loads(text.splitlines()[1][6:])["filename"] == "mail.pdf"


def test_agent_info_lists_the_attachment_tools():
    info = client.get("/api/agent/info").json()
    assert info["attachment_tools"] == agent.ATTACHMENT_TOOL_NAMES
    assert info["attachment_max_bytes"] == 10 * 1024 * 1024

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


# ------------------------------------------------------- chat agent (offline)

import json

import httpx

import agent


REAL_HTTPX_CLIENT = httpx.Client


def fake_client(handler):
    """An httpx.Client whose transport is a function, so no server is needed."""
    return REAL_HTTPX_CLIENT(transport=httpx.MockTransport(handler))


def tool_call_reply(call_id, name, arguments):
    """A server reply where the model asks for one function call."""
    return {
        "choices": [{
            "finish_reason": "tool_calls",
            "message": {
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": call_id,
                    "type": "function",
                    "function": {"name": name, "arguments": json.dumps(arguments)},
                }],
            },
        }]
    }


def text_reply(text):
    return {"choices": [{"finish_reason": "stop",
                         "message": {"role": "assistant", "content": text}}]}


def test_tool_specs_are_valid_openai_functions():
    assert agent.TOOL_NAMES == ["check_spam", "list_malware_platforms",
                                "check_malware", "predict_process", "get_model_info"]
    for spec in agent.TOOL_SPECS:
        assert spec["type"] == "function"
        function = spec["function"]
        assert function["name"] in agent.TOOL_NAMES
        assert function["description"]
        assert function["parameters"]["type"] == "object"
        assert function["parameters"]["additionalProperties"] is False
        for name in function["parameters"]["required"]:
            assert name in function["parameters"]["properties"]


def test_run_tool_dispatches_to_the_ml_models(monkeypatch):
    seen = {}

    def spy(text):
        seen["text"] = text
        return {"verdict": "SPAM"}

    monkeypatch.setattr(predict, "predict_spam", spy)
    assert agent.run_tool("check_spam", {"text": "win a prize"}) == {"verdict": "SPAM"}
    assert seen["text"] == "win a prize"

    platforms = agent.run_tool("list_malware_platforms", {})
    assert platforms["platforms"] == predict.malware_platforms()
    assert set(platforms["features"]) == set(platforms["platforms"])

    assert agent.run_tool("get_model_info", {})["regression_target"] == "nvcsw"


def test_run_tool_reports_bad_arguments_as_an_error_payload():
    bad_platform = agent.run_tool("check_malware", {"platform": "nope", "features": {}})
    assert "error" in bad_platform and "unknown platform" in bad_platform["error"]

    bad_columns = agent.run_tool("predict_process", {"features": {"zzz": 1}})
    assert "error" in bad_columns

    bad_text = agent.run_tool("check_spam", {"text": "zzzqq xxkkj"})
    assert "error" in bad_text

    assert "error" in agent.run_tool("not_a_tool", {})
    assert "error" in agent.run_tool("check_malware", {"platform": "pe_windows",
                                                       "features": "not a dict"})


def test_chat_runs_the_tool_and_returns_the_explanation(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "sk-test")
    requests = []

    def handler(request):
        body = json.loads(request.content)
        requests.append(body)
        assert request.headers["authorization"] == "Bearer sk-test"
        if len(requests) == 1:
            # The model asks for a tool before answering.
            return httpx.Response(200, json=tool_call_reply(
                "call_1", "check_spam", {"text": "WIN a FREE prize now"}))
        # The tool result must come back on the next turn, under its call id.
        assert body["messages"][-1] == {
            "role": "tool",
            "tool_call_id": "call_1",
            "content": body["messages"][-1]["content"],
        }
        result = json.loads(body["messages"][-1]["content"])
        assert result["verdict"] == "SPAM"
        return httpx.Response(200, json=text_reply("This is spam: 96.8% probability."))

    reply = agent.chat("Is this spam: WIN a FREE prize now?", client=fake_client(handler))

    assert reply["rounds"] == 2
    assert reply["reply"] == "This is spam: 96.8% probability."
    assert len(reply["tool_calls"]) == 1
    assert reply["tool_calls"][0]["tool"] == "check_spam"
    assert reply["tool_calls"][0]["result"]["verdict"] == "SPAM"
    # The tools are sent on every round, so the server can constrain the format.
    assert requests[0]["tools"] and requests[0]["tool_choice"] == "auto"
    assert requests[0]["model"] == agent.config()["model"]


def test_chat_passes_history_and_survives_a_bad_tool_argument(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    rounds = []

    def handler(request):
        body = json.loads(request.content)
        rounds.append(body["messages"])
        if len(rounds) == 1:
            return httpx.Response(200, json=tool_call_reply(
                "call_1", "check_malware", {"platform": "windows", "features": {}}))
        if len(rounds) == 2:
            # The model reads the error and retries with a real platform.
            result = json.loads(body["messages"][-1]["content"])
            assert "unknown platform" in result["error"]
            return httpx.Response(200, json=tool_call_reply(
                "call_2", "check_malware", {"platform": "pe_windows", "features": {}}))
        return httpx.Response(200, json=text_reply("Benign, from training medians only."))

    reply = agent.chat("Check this file", history=[
        {"role": "user", "content": "what platforms do you support?"},
        {"role": "assistant", "content": "Four: two Android, one permissions, one PE."},
    ], client=fake_client(handler))

    assert [c["tool"] for c in reply["tool_calls"]] == ["check_malware", "check_malware"]
    assert reply["rounds"] == 3
    sent = [m["content"] for m in rounds[0] if m["role"] in ("user", "assistant")]
    assert sent[0] == "what platforms do you support?"
    assert sent[-1] == "Check this file"


def test_chat_stops_after_the_round_limit(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")

    def handler(request):
        return httpx.Response(200, json=tool_call_reply(
            "call_x", "list_malware_platforms", {}))

    reply = agent.chat("loop forever", client=fake_client(handler))
    assert reply["rounds"] == agent.MAX_TOOL_ROUNDS
    assert reply["finish_reason"] == "max_rounds"
    assert len(reply["tool_calls"]) == agent.MAX_TOOL_ROUNDS


def test_chat_route_validates_and_reports_an_unreachable_server(monkeypatch):
    assert post("chat", {"prompt": ""}).status_code == 422
    assert post("chat", {}).status_code == 422

    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")

    def refuse(request):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(agent, "default_client", lambda: fake_client(refuse))
    reply = post("chat", {"prompt": "Is this spam?"})
    assert reply.status_code == 503
    assert "cannot reach the model server" in reply.json()["detail"]


def test_agent_info_reports_the_server_state(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    monkeypatch.setenv("LLM_MODEL", "qwen35-2b-spam")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setattr(agent.httpx, "Client", lambda **kwargs: fake_client(
        lambda request: httpx.Response(200, json={"data": [{"id": "qwen35-2b-spam"}]})))

    info = client.get("/api/agent/info").json()
    assert info["model"] == "qwen35-2b-spam"
    assert info["base_url"] == "http://llm.test/v1"
    assert info["tools"] == agent.TOOL_NAMES
    assert info["auth_configured"] is True
    assert info["server"] == {"reachable": True, "served_models": ["qwen35-2b-spam"],
                              "model_in_use": "qwen35-2b-spam", "model_is_served": True}


def test_the_default_endpoint_is_the_local_mlx_server(monkeypatch):
    for name in ("LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    settings = agent.config()
    assert settings["base_url"] == "http://100.107.98.17:8000/v1"
    assert settings["model"] == "orcarouter--Nex-N2.5-mini-Uncensored-MLX-4bit"
    assert settings["api_key"]


def test_agent_info_is_reachable_false_when_the_server_is_down(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")

    def refuse(request):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(agent.httpx, "Client", lambda **kwargs: fake_client(refuse))
    info = client.get("/api/agent/info").json()
    assert info["server"]["reachable"] is False


def test_masked_base_url_hides_credentials():
    assert agent.masked_base_url("https://user:pw@llm.example.com/v1") == \
        "https://llm.example.com/v1"
    assert agent.masked_base_url("http://127.0.0.1:8000/v1") == "http://127.0.0.1:8000/v1"
# --------------------------------------------------- chat streaming route


def test_clean_reply_drops_the_reasoning_block():
    assert agent.clean_reply("<think>\ncheck spam first\n</think>\n**SPAM** 0.95") == "**SPAM** 0.95"
    # A template that only emits the closing tag still loses the reasoning.
    assert agent.clean_reply("thinking...\n</think>\nSPAM") == "SPAM"
    assert agent.clean_reply("") == ""
    assert agent.clean_reply(None) == ""
    assert agent.clean_reply("plain answer") == "plain answer"


def test_chat_reports_tool_progress(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    seen = []
    rounds = [
        tool_call_reply("call_1", "check_spam", {"text": "WIN a FREE prize now"}),
        text_reply("<think>done</think>SPAM, 0.95"),
    ]

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    reply = agent.chat("is this spam?", client=fake_client(handler),
                       on_event=lambda name, payload: seen.append((name, payload["tool"])))

    assert seen == [("tool_start", "check_spam"), ("tool_end", "check_spam")]
    assert reply["reply"] == "SPAM, 0.95"


def test_chat_stream_sends_events_in_order(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    rounds = [
        tool_call_reply("call_1", "list_malware_platforms", {}),
        text_reply("<think>ok</think>Four platforms."),
    ]

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    monkeypatch.setattr(agent, "default_client", lambda: fake_client(handler))

    with client.stream("POST", "/api/chat/stream",
                       json={"prompt": "what platforms?", "history": []}) as reply:
        assert reply.status_code == 200
        assert reply.headers["content-type"].startswith("text/event-stream")
        body = "".join(reply.iter_text())

    events = [line.split(": ", 1)[1] for line in body.splitlines() if line.startswith("event: ")]
    assert events == ["tool_start", "tool_end", "done"]

    payloads = [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]
    assert payloads[0] == {"tool": "list_malware_platforms", "args": {}}
    assert payloads[-1]["reply"] == "Four platforms."
    assert payloads[-1]["tool_calls"][0]["tool"] == "list_malware_platforms"


def test_chat_stream_reports_an_unreachable_server(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")

    def refuse(request):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(agent, "default_client", lambda: fake_client(refuse))

    with client.stream("POST", "/api/chat/stream", json={"prompt": "hi"}) as reply:
        body = "".join(reply.iter_text())

    assert "event: error" in body
    assert "cannot reach the model server" in body


def test_chat_stream_rejects_an_empty_prompt():
    assert post("chat/stream", {"prompt": "   "}).status_code == 400
def test_chat_falls_back_when_the_model_returns_no_text(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    rounds = [
        tool_call_reply("call_1", "list_malware_platforms", {}),
    ] + [
        # The round keeps coming back empty, so the retry gives up too.
        {"choices": [{"finish_reason": "length",
                      "message": {"role": "assistant", "content": None}}]}
    ] * 3

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    reply = agent.chat("what platforms?", client=fake_client(handler))
    assert reply["finish_reason"] == "length"
    assert "list_malware_platforms" in reply["reply"]
    assert reply["tool_calls"][0]["tool"] == "list_malware_platforms"


def test_a_round_that_spends_its_budget_on_reasoning_is_asked_again(monkeypatch):
    """The reasoning stays on; only the budget grows on the retry."""
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    budgets = []
    rounds = [
        tool_call_reply("call_1", "check_spam", {"text": "WIN a FREE prize"}),
        {"choices": [{"finish_reason": "length",
                      "message": {"role": "assistant", "content": None}}]},
        text_reply("SPAM, 0.95"),
    ]

    def handler(request):
        budgets.append(json.loads(request.content)["max_tokens"])
        return httpx.Response(200, json=rounds.pop(0))

    events = []
    reply = agent.chat("is this spam?", client=fake_client(handler),
                       on_event=lambda name, payload: events.append(name))

    assert reply["reply"] == "SPAM, 0.95"
    assert budgets[1] == agent.MAX_REPLY_TOKENS
    assert budgets[2] > budgets[1]
    assert "retry" in events


def test_the_retry_keeps_reasoning_enabled(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    bodies = []
    rounds = [
        {"choices": [{"finish_reason": "length",
                      "message": {"role": "assistant", "content": None}}]},
        text_reply("done"),
    ]

    def handler(request):
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=rounds.pop(0))

    agent.chat("hi", client=fake_client(handler))
    for body in bodies:
        assert "reasoning" not in body


def test_the_fallback_reports_the_verdict_from_the_tool(monkeypatch):
    """An exhausted model still tells the user what the model decided."""
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.test/v1")
    rounds = [
        tool_call_reply("call_1", "check_spam", {"text": "WIN a FREE prize"}),
    ] + [
        {"choices": [{"finish_reason": "length",
                      "message": {"role": "assistant", "content": None}}]}
    ] * 3

    def handler(request):
        return httpx.Response(200, json=rounds.pop(0))

    reply = agent.chat("is this spam?", client=fake_client(handler))
    assert reply["reply"].startswith("Verdict: SPAM")
    assert "probability" in reply["reply"]
