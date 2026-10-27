"""FastAPI service for the spam, malware and process models + AI Agent Tool Calling.

Routes:
    POST /api/chat                  {"prompt"} -> AI calls backend models as tools
    POST /api/spam                  {"text"} -> verdict, probability, words
    POST /api/spam/upload           multipart PDF file -> verdict
    GET  /api/malware/platforms     -> platform names
    GET  /api/malware/features      -> feature columns (all, or ?platform=)
    GET  /api/malware/schema        -> feature ranges and medians
    POST /api/malware               {"platform", "features"} -> verdict
    POST /api/malware/upload        multipart file (+ optional platform) -> verdict
    POST /api/process               {"features"} -> predicted context switches
    GET  /api/process/features      -> counter names
    GET  /api/process/schema        -> counter ranges and medians
    GET  /api/model                 -> what is inside the saved bundle
    GET  /api/health                -> readiness, for a load balancer (Public)
    GET  /docs                      -> generated API documentation (Public)
    GET  /                          -> the front-end page (Public)

Run:  cd innovation-g2 && python main.py     (binds 127.0.0.1:3000)
"""

import os
import secrets
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import pymupdf
import uvicorn
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Security,
    UploadFile,
)
from fastapi.responses import FileResponse
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
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

# ---------------------------------------------------------------------------
# API Key Authentication Setup
# ---------------------------------------------------------------------------
API_KEY = os.getenv(
    "API_KEY",
    ,
)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)):
    """Rejects requests without a matching X-API-Key header."""
    if not api_key or not secrets.compare_digest(api_key, API_KEY):
        raise HTTPException(status_code=403, detail="Invalid or missing API Key")
    return api_key


app = FastAPI(
    title="Spam and Malware Detection API",
    description="Wraps three models: spam classification, malware classification "
                "per platform, process context-switch regression, and an AI tool-calling agent.",
    version="2.1",
)

# Protected router: every route registered on `api_router` requires X-API-Key
api_router = APIRouter(dependencies=[Depends(verify_api_key)])


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------
class SpamRequest(BaseModel):
    text: str = Field(..., description="The message to check", min_length=1)


class MalwareRequest(BaseModel):
    platform: str = Field(..., description="One of GET /api/malware/platforms")
    features: Dict[str, float] = Field(
        default_factory=dict,
        description="Column name -> value. Missing columns use the training median.",
    )


class ProcessRequest(BaseModel):
    features: Dict[str, float] = Field(
        default_factory=dict,
        description="Counter name -> value. Missing counters use the training median.",
    )


class ChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="Natural language request (e.g., 'Is this message spam: Win $1000 now!')",
        min_length=1,
    )


# ---------------------------------------------------------------------------
# Tool Definitions for the LLM Agent
# ---------------------------------------------------------------------------
# The Google GenAI SDK reads the type hints and docstrings of these functions
# to build the tool schemas automatically and execute them when called.

def tool_check_spam(text: str) -> Dict[str, Any]:
    """Classify a text message or email as SPAM or HAM (legitimate).

    Args:
        text: The full text message to analyze for spam.
    """
    return predict.predict_spam(text)


def tool_list_malware_platforms() -> List[str]:
    """Return the list of supported malware detection platforms and get feature schemas."""
    return predict.malware_platforms()


def tool_check_malware(platform: str, features: Dict[str, float]) -> Dict[str, Any]:
    """Classify a file as MALWARE or BENIGN for a given platform based on its feature values.

    Args:
        platform: Target platform name (call tool_list_malware_platforms first if unknown).
        features: Dictionary mapping feature column names to numeric values.
    """
    return predict.predict_malware(platform, features)


def tool_predict_process(features: Dict[str, float]) -> Dict[str, Any]:
    """Predict the voluntary context-switch count of a system process using regression.

    Args:
        features: Dictionary mapping system counter names to numeric values.
    """
    return predict.predict_process(features)


def tool_get_model_info() -> Dict[str, Any]:
    """Get metadata and details about the loaded spam, malware, and process ML models."""
    return predict.model_info()


BACKEND_TOOLS = [
    tool_check_spam,
    tool_list_malware_platforms,
    tool_check_malware,
    tool_predict_process,
    tool_get_model_info,
]


# ---------------------------------------------------------------------------
# Public Endpoints (No API Key Required)
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    """Is the service up, and are the models loaded?"""
    return {"status": "ok", "models_loaded": bool(predict.load_bundle())}


# ---------------------------------------------------------------------------
# Protected API Endpoints (Requires X-API-Key Header)
# ---------------------------------------------------------------------------
@api_router.post("/api/chat")
def chat_with_tools(request: ChatRequest):
    """Send a prompt to the AI model, which automatically calls backend ML tools as needed."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set on the server.",
        )

    try:
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=request.prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are the security AI assistant for the Spam and Malware Detection service. "
                    "Whenever a user asks to check a message for spam, evaluate malware features, "
                    "predict process context switches, or inspect available models/platforms, "
                    "call the provided backend tools and clearly explain the results."
                ),
                tools=BACKEND_TOOLS,
                temperature=0.1,
            ),
        )

        # Extract a log of which backend tools the model actually invoked
        tool_calls_made = []
        if response.automatic_function_calling_history:
            for content in response.automatic_function_calling_history:
                for part in content.parts or []:
                    if part.function_call:
                        tool_calls_made.append(
                            {
                                "tool": part.function_call.name,
                                "args": dict(part.function_call.args),
                            }
                        )

        return {
            "reply": response.text,
            "tool_calls": tool_calls_made,
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Tool call error: {error}")


@api_router.get("/api/model")
def model_card():
    """What the saved bundle contains, so a caller knows what to send."""
    return predict.model_info()


@api_router.post("/api/spam")
def check_spam(request: SpamRequest):
    """Classify one message as SPAM or HAM, with the words behind the verdict."""
    if not request.text.strip():
        raise HTTPException(400, "text is empty")
    try:
        return predict.predict_spam(request.text)
    except ValueError as error:
        raise HTTPException(400, str(error))


@api_router.post("/api/spam/upload")
async def check_spam_pdf(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF and classify it as SPAM or HAM."""
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
        raise HTTPException(400, "No readable text.")

    try:
        return predict.predict_spam(text)
    except ValueError as error:
        raise HTTPException(400, str(error))
    finally:
        await file.close()


@api_router.get("/api/malware/platforms")
def malware_platforms():
    """The platform names the malware models understand."""
    return predict.malware_platforms()


@api_router.get("/api/malware/features")
def malware_features(platform: Optional[str] = None):
    """Feature columns for one platform, or for every platform."""
    try:
        if platform:
            return {platform: predict.malware_feature_names(platform)}
        return {
            name: predict.malware_feature_names(name)
            for name in predict.malware_platforms()
        }
    except ValueError as error:
        raise HTTPException(
