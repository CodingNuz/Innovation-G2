"""FastAPI service for the spam, malware and process models.

Routes:
    POST /api/spam                  {"text"} -> verdict, probability, words
    GET  /api/malware/platforms      -> platform names
    GET  /api/malware/features       -> feature columns (all, or ?platform=)
    POST /api/malware                {"platform", "features"} -> verdict
    POST /api/malware/upload         multipart file (+ optional platform) -> verdict
    POST /api/process                {"features"} -> predicted context switches
    GET  /api/model                  -> what is inside the saved bundle
    GET  /api/health                 -> readiness, for a load balancer
    GET  /docs                       -> generated API documentation
    GET  /                           -> the front-end page

Run:  cd innovation-g2 && python main.py     (binds 127.0.0.1:3000)
"""

import sys
from pathlib import Path
from typing import Dict, Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]

# The React app in frontend-react/ is the current front end.  When it has been
# built (npm run build) the build output is served here, so the whole app runs
# from this one server.  frontend/ holds the older hand-written page and is
# only used when no build output exists.
REACT_BUILD = ROOT / "frontend-react" / "dist"
FRONTEND = REACT_BUILD if (REACT_BUILD / "index.html").exists() else ROOT / "frontend"

# The prediction code lives next to the trained models.
sys.path.insert(0, str(ROOT / "spam_malware_detection_model"))
import predict  # noqa: E402
import extract  # noqa: E402

# The largest upload accepted.  Real APKs are tens of megabytes; anything
# bigger is refused before it is parsed.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

app = FastAPI(
    title="Spam and Malware Detection API",
    description="Wraps three models: spam classification, malware classification "
                "per platform, and a process context-switch regression.",
    version="2.0",
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


@app.get("/api/health")
def health():
    """Is the service up, and are the models loaded?"""
    return {"status": "ok", "models_loaded": bool(predict.load_bundle())}


@app.get("/api/model")
def model_card():
    """What the saved bundle contains, so a caller knows what to send."""
    return predict.model_info()


@app.post("/api/spam")
def check_spam(request: SpamRequest):
    """Classify one message as SPAM or HAM, with the words behind the verdict."""
    if not request.text.strip():
        raise HTTPException(400, "text is empty")
    try:
        return predict.predict_spam(request.text)
    except ValueError as error:
        raise HTTPException(400, str(error))


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
    # The React build starts at index.html; the older hand-written page starts
    # at spamchameleon.html.
    page = "index.html" if FRONTEND == REACT_BUILD else "spamchameleon.html"
    return FileResponse(FRONTEND / page)


# Mount last: StaticFiles at "/" must not shadow the "/" route above.
app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3000)
