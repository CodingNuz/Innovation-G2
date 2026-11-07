"""FastAPI service for the spam, malware and process models.

Run:  cd innovation-g2 && python main.py     (binds 127.0.0.1:3000)
Chat uses the LLM at LLM_BASE_URL / LLM_API_KEY / LLM_MODEL (see agent.py).
"""

import json
import queue as queue_module
import sys
import threading
from pathlib import Path
from typing import Dict, List, Optional

import base64
import binascii

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]

# Serves the built React app from frontend-react/ (run npm run build there
# first), so the whole thing runs from this one server.
FRONTEND = ROOT / "frontend-react" / "dist"
FRONTEND_BUILT = (FRONTEND / "index.html").exists()

# predict.py and friends live next to the trained models.
sys.path.insert(0, str(ROOT / "spam_malware_detection_model"))
import predict  # noqa: E402
import agent  # noqa: E402
import attachments  # noqa: E402

# Upload cap. Real APKs run to tens of MB; anything bigger is rejected
# before parsing.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

# Cap on a chat attachment. It has to fit in the request body next to the
# history.
MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024

app = FastAPI(
    title="Spam and Malware Detection API",
    description="Wraps three models: spam classification, malware classification "
                "per platform, a process context-switch regression, and a "
                "tool-calling chat agent.",
    version="2.1",
)


class SpamRequest(BaseModel):
    text: str = Field(..., description="The message to check", min_length=1)


class MalwareRequest(BaseModel):
    platform: str = Field(..., description="One of GET /api/malware/platforms")
    features: Dict[str, float] = Field(
        default_factory=dict,
        description="Column name -> value. Missing columns use the training median.")


class ProcessRequest(BaseModel):
    features: Dict[str, float] = Field(
        default_factory=dict,
        description="Counter name -> value. Missing counters use the training median.")


class ChatTurn(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., min_length=1)


class ChatAttachment(BaseModel):
    filename: str = Field(..., min_length=1,
                          description="The name to show and to detect text types by")
    content_b64: str = Field(..., min_length=1,
                             description="The file's bytes, base64 encoded")


class ChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="What to ask, e.g. 'Is this spam: Win $1000 now!'",
        min_length=1,
    )
    history: List[ChatTurn] = Field(
        default_factory=list,
        description="Earlier turns, so a follow-up question keeps its context.",
    )
    attachment: Optional[ChatAttachment] = Field(
        default=None,
        description="One file to analyse with this question. Held in memory.",
    )


def decode_attachment(request: ChatRequest):
    """Parse the attached file, or return None if there isn't one."""
    if request.attachment is None:
        return None
    try:
        data = base64.b64decode(request.attachment.content_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "attachment is not valid base64")
    if not data:
        raise HTTPException(400, "attachment is empty")
    if len(data) > MAX_CHAT_ATTACHMENT_BYTES:
        raise HTTPException(413, "attachment is larger than %d MB"
                            % (MAX_CHAT_ATTACHMENT_BYTES >> 20))
    try:
        return attachments.inspect(data, request.attachment.filename)
    except attachments.UnsupportedFile as error:
        raise HTTPException(415, str(error))
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.get("/api/health")
def health():
    """Is the service up, and are the models loaded?"""
    return {"status": "ok", "models_loaded": bool(predict.load_bundle())}


@app.get("/api/model")
def model_card():
    """What the saved bundle contains, so a caller knows what to send."""
    return predict.model_info()


@app.get("/api/agent/info")
def agent_info():
    """Which model answers /api/chat, and whether its server is reachable now."""
    settings = agent.config()
    return {
        "model": settings["model"],
        "base_url": agent.masked_base_url(settings["base_url"]),
        "auth_configured": settings["api_key"] is not None,
        "tools": agent.TOOL_NAMES,
        "attachment_tools": agent.ATTACHMENT_TOOL_NAMES,
        "attachment_max_bytes": MAX_CHAT_ATTACHMENT_BYTES,
        "server": agent.server_status(),
    }


@app.post("/api/chat")
def chat(request: ChatRequest):
    """Ask the fine-tuned LLM, which calls the ML models as tools."""
    if not request.prompt.strip():
        raise HTTPException(400, "prompt is empty")
    attachment = decode_attachment(request)
    try:
        return agent.chat(request.prompt,
                          [turn.model_dump() for turn in request.history],
                          attachment=attachment)
    except agent.LLMUnavailable as error:
        raise HTTPException(503, str(error))


@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    """Same as POST /api/chat, streamed as server-sent events.

    Events: tool_start, tool_end, done, error.
    """
    if not request.prompt.strip():
        raise HTTPException(400, "prompt is empty")
    history = [turn.model_dump() for turn in request.history]
    attachment = decode_attachment(request)
    attached = (None if attachment is None else
                {"filename": attachment.filename, "kind": attachment.kind,
                 "size": attachment.size, "sha256": attachment.sha256})

    def events():
        # agent.chat blocks, so it runs in a worker thread and pushes events
        # onto a queue. This generator drains the queue as they arrive.
        events_queue = queue_module.Queue()

        def on_event(name, payload):
            events_queue.put((name, payload))

        def work():
            try:
                if attached is not None:
                    events_queue.put(("attachment", attached))
                events_queue.put(("done", agent.chat(request.prompt, history,
                                                     on_event=on_event,
                                                     attachment=attachment)))
            except agent.LLMUnavailable as error:
                events_queue.put(("error", {"detail": str(error)}))
            except Exception as error:  # noqa: BLE001 - the browser must see why
                events_queue.put(("error", {"detail": "%s: %s"
                                            % (type(error).__name__, error)}))

        worker = threading.Thread(target=work, daemon=True)
        worker.start()
        while True:
            name, payload = events_queue.get()
            yield "event: %s\ndata: %s\n\n" % (name, json.dumps(payload))
            if name in ("done", "error"):
                return

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


@app.post("/api/spam")
def check_spam(request: SpamRequest):
    """Classify one message as SPAM or HAM, with the words behind the verdict."""
    if not request.text.strip():
        raise HTTPException(400, "text is empty")
    try:
        return predict.predict_spam(request.text)
    except ValueError as error:
        raise HTTPException(400, str(error))


# One upload route for all file types; the parser picks the model.
MAX_FILES_PER_UPLOAD = 20


@app.post("/api/scan/upload")
def scan_upload(files: List[UploadFile] = File(...),
                platform: Optional[str] = Form(None)):
    """Score one or more files; the bytes decide which model runs.

    A bad file comes back with an `error` and the rest are still scored.
    Pictures go through the Assistant tab instead.
    """
    if not files:
        raise HTTPException(400, "no files were uploaded")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(413, "at most %d files per upload" % MAX_FILES_PER_UPLOAD)

    reply = []
    for file in files:
        # Read one byte past the limit: enough to reject without buffering the rest.
        data = file.file.read(MAX_UPLOAD_BYTES + 1)
        name = file.filename or "unnamed"
        if len(data) > MAX_UPLOAD_BYTES:
            reply.append({"filename": name,
                          "error": "larger than %d MB" % (MAX_UPLOAD_BYTES >> 20)})
            continue
        try:
            attachment = attachments.inspect(data, name, platform)
            if attachment.kind == "image":
                raise ValueError(
                    "%s is a picture; attach it in the Assistant tab, which reads "
                    "the text from it and scores that text as a message" % name)
            if platform and attachment.scan is None:
                raise ValueError("platform only applies to a Windows PE or an "
                                 "Android APK, and %s is a %s file"
                                 % (name, attachment.kind))
            # inspect() already ran the malware scan with the chosen platform.
            reply.append(attachments.scan(attachment))
        except (attachments.UnsupportedFile, ValueError) as error:
            reply.append({"filename": name, "error": str(error)})
    return {"files": reply}


@app.get("/api/malware/platforms")
def malware_platforms():
    """The platform names the malware models understand."""
    return predict.malware_platforms()


@app.get("/api/malware/features")
def malware_features(platform: Optional[str] = None):
    """Feature columns for one platform, or for every platform."""
    try:
        if platform:
            return {platform: predict.malware_feature_names(platform)}
        return {name: predict.malware_feature_names(name)
                for name in predict.malware_platforms()}
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.get("/api/malware/schema")
def malware_schema(platform: Optional[str] = None):
    """Per-feature kind, min, max and median, for building a form."""
    try:
        if platform:
            return {platform: predict.malware_feature_schema(platform)}
        return {name: predict.malware_feature_schema(name)
                for name in predict.malware_platforms()}
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.post("/api/malware")
def check_malware(request: MalwareRequest):
    """Classify one file as MALWARE or BENIGN for a named platform."""
    try:
        return predict.predict_malware(request.platform, request.features)
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.post("/api/process")
def predict_process(request: ProcessRequest):
    """Predict the voluntary context-switch count of a process (regression)."""
    try:
        return predict.predict_process(request.features)
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.get("/api/process/features")
def process_features():
    """The counters the regression model reads."""
    return predict.process_feature_names()


@app.get("/api/process/schema")
def process_schema():
    """What each process counter looks like: range and the imputed median."""
    return predict.process_feature_schema()


@app.get("/")
async def index():
    if not FRONTEND_BUILT:
        raise HTTPException(503, "the front end is not built: run "
                                "cd frontend-react && npm run build")
    return FileResponse(FRONTEND / "index.html")


# Mounted last so StaticFiles at "/" doesn't shadow the "/" route above.
# No build just means no page; the API still starts.
if FRONTEND_BUILT:
    app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3000)
