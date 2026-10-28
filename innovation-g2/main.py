"""FastAPI service for the spam, malware and process models.

Routes:
    POST /api/spam                  {"text"} -> verdict, probability, words
    GET  /api/malware/platforms      -> platform names
    GET  /api/malware/features       -> feature columns (all, or ?platform=)
    POST /api/malware                {"platform", "features"} -> verdict
    POST /api/malware/upload         multipart file (+ optional platform) -> verdict
    POST /api/process                {"features"} -> predicted context switches
    POST /api/chat                   {"prompt", "history", "attachment"} -> answer
    POST /api/chat/stream            same body -> server-sent events, one per step
    GET  /api/agent/info             -> model server, model name, tool names
    GET  /api/model                  -> what is inside the saved bundle
    GET  /api/health                 -> readiness, for a load balancer
    GET  /docs                       -> generated API documentation
    GET  /                           -> the front-end page

The chat route talks to the fine-tuned LLM on a remote OpenAI-compatible
server.  Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL (see agent.config) to
point at it; see agent.py for the tool loop.

`attachment` is optional: {"filename": str, "content_b64": str}.  The bytes
are parsed in memory (see attachments.py) and never written to disk.

Run:  cd innovation-g2 && python main.py     (binds 127.0.0.1:3000)
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
import pymupdf
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]

# The React app in frontend-react/ is the front end.  Build it first
# (cd frontend-react && npm run build) so its output can be served here and
# the whole app runs from this one server.
FRONTEND = ROOT / "frontend-react" / "dist"
FRONTEND_BUILT = (FRONTEND / "index.html").exists()

# The prediction code lives next to the trained models.
sys.path.insert(0, str(ROOT / "spam_malware_detection_model"))
import predict  # noqa: E402
import extract  # noqa: E402
import agent  # noqa: E402
import attachments  # noqa: E402

# The largest upload accepted.  Real APKs are tens of megabytes; anything
# bigger is refused before it is parsed.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

# A file attached to a chat question.  Small enough to sit in a request body
# next to the conversation, large enough for a long PDF or a small APK.
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
    """Parse the attached file, or None when nothing was attached.

    The bytes are decoded, size-checked and parsed here, in the request
    thread, so both chat routes behave the same way and the parsing cost is
    paid once.  Nothing is written to disk.
    """
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
    """Ask the fine-tuned LLM, which calls the ML models as tools and explains them.

    The reply names the tools that actually ran, so the caller can show the
    verdict the explanation is based on.
    """
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
    """The same answer as POST /api/chat, sent as server-sent events.

    A tool round costs two completions on the local model, so a reply can take
    half a minute.  The events let a chat box say which model is being
    consulted while it waits:

        event: tool_start   data: {"tool": "check_spam", "args": {...}}
        event: tool_end     data: {"tool": "check_spam", "result": {...}}
        event: done         data: {"reply", "tool_calls", "rounds"}
        event: error        data: {"detail"}
    """
    if not request.prompt.strip():
        raise HTTPException(400, "prompt is empty")
    history = [turn.model_dump() for turn in request.history]
    attachment = decode_attachment(request)
    attached = (None if attachment is None else
                {"filename": attachment.filename, "kind": attachment.kind,
                 "size": attachment.size, "sha256": attachment.sha256})

    def events():
        # agent.chat blocks on the model, so it runs in a worker thread and
        # pushes events into a queue.  This generator drains the queue and
        # yields each one as it happens, which is what makes the events
        # useful: the chat box can say "check_spam is running" immediately.
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

@app.post("/api/spam/upload")
async def check_spam_pdf(file: UploadFile = File(...)):
   
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Upload PDF file.")

    try:
        content = await file.read()

        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(413, "File maximum size is 10 MB.")

        if not content:
            raise HTTPException(400, "File is empty.")

        with pymupdf.open(stream=content, filetype="pdf") as pdf:
            text = "\n".join(page.get_text() for page in pdf)

    except HTTPException:
        raise
    except Exception as error:
        print(f"PDF parsing error: {type(error).__name__}: {error}")
        raise HTTPException(400, "Unable to read file.")

    if not text.strip():
        raise HTTPException(
            400,
            "No readable text."
        )

    try:
        return predict.predict_spam(text)
    except ValueError as error:
        raise HTTPException(400, str(error))
    finally:
        await file.close()


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
    """What each malware feature looks like, so a form can be built.

    For every feature: its kind (a binary yes/no switch or a number), the
    smallest and largest value in the training data, and the median, which is
    the value the model imputes when a feature is left out.
    """
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


@app.post("/api/malware/upload")
def upload_malware(file: UploadFile = File(...), platform: Optional[str] = Form(None)):
    """Scan an uploaded Windows PE (.exe, .dll) or Android APK.

    The platform is worked out from the file's bytes.  The features are read
    from the file and given to the same models as POST /api/malware.  An APK
    is scored by the three Android models, whose majority vote is the verdict.
    Pass `platform` only to force one model.  The file is parsed, never run.
    """
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file is larger than %d MB" % (MAX_UPLOAD_BYTES >> 20))
    try:
        return extract.scan(data, file.filename or "", platform or None)
    except extract.UnsupportedFile as error:
        raise HTTPException(415, str(error))
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


# Mount last: StaticFiles at "/" must not shadow the "/" route above.
# Without a build the API still starts; only the page is missing.
if FRONTEND_BUILT:
    app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3000)
