"""Tool-calling agent: the fine-tuned LLM on a remote OpenAI-compatible server.

Client plus tool loop: send the prompt and TOOL_SPECS, run any tool_calls
against the ML models, send the results back, repeat until the model answers.
"""

import json
import os
import re
from typing import Any, Callable, Dict, List, Optional

import httpx

import attachments
import predict

# Cap on tool rounds. Enough for "list the platforms, then score with the
# right one", and it stops a model that keeps calling the same function.
MAX_TOOL_ROUNDS = 6

# Max characters one read_attachment_text call returns. A PDF page is a few
# thousand, so this is plenty.
ATTACHMENT_TEXT_CHUNK = 6000

# Only the most recent messages of the history are sent to the model.
MAX_HISTORY_MESSAGES = 20

# Chat model, served by an OpenAI-compatible MLX server on the LAN.
# Override with LLM_BASE_URL / LLM_API_KEY / LLM_MODEL.
DEFAULT_MODEL = "orcarouter--Nex-N2.5-mini-Uncensored-MLX-4bit"
DEFAULT_BASE_URL = "http://100.107.98.17:8000/v1"
DEFAULT_API_KEY = "sk-omlx-XtwkjfsneJr7XfiEvf0fcoMs"

# Reasoning eats tokens before the first visible word, and explaining a tool
# result takes a paragraph. 800 cut answers off mid-sentence.
MAX_REPLY_TOKENS = 1600

# Reasoning burns part of the budget before any visible output, and a tool
# round is two completions, so 120 s was too tight.
DEFAULT_TIMEOUT = 300.0

SYSTEM_PROMPT = (
    "You are the security assistant of a spam, malware and process detection "
    "service.  The trained machine-learning models are only reachable through "
    "the tools you are given.\n"
    "Rules:\n"
    "1. Never guess a verdict.  Call a tool first, then explain its result.\n"
    "2. For a message, call check_spam.  For a file or app on a named platform, "
    "call list_malware_platforms if you are unsure of the name, then "
    "check_malware.  For system counters, call predict_process.\n"
    "3. If a tool returns an error, read it and correct the arguments; do not "
    "repeat the same failing call.\n"
    "4. In the final answer, state the verdict and probability in one line, "
    "then explain in plain language what pushed the score (for spam, the "
    "suspicious and safe words; for malware, how many features were real sample "
    "values versus training medians; for process, whether the answer was "
    "clipped to the training range).\n"
    "5. Answer in the language the user wrote in.  Keep the explanation to a "
    "short paragraph unless the user asks for detail."
)

# Appended only when a file is attached, so plain questions don't carry
# rules for tools that aren't there.
ATTACHMENT_PROMPT = (
    "\nA file is attached to this turn and its contents are NOT in this "
    "prompt.  Rules for it:\n"
    "6. The user message already names the file and its type.  Do not call a "
    "tool to find that out again.  Never guess what a file contains.\n"
    "7. For a PDF, email or text file, call read_attachment_text, then "
    "scan_attachment for the spam verdict.  A long document needs more than "
    "one read: pass the offset the previous reply returned.  Call "
    "get_attachment only when you need the hash, the links or the notes.\n"
    "8. For a Windows PE or Android APK, call scan_attachment; the file has "
    "already been parsed by the malware models.\n"
    "9. Report the verdict and probability exactly as the tool returned them, "
    "and mention links, embedded files or active content when the notes list "
    "them."
)

# A picture has no text layer: the assistant reads the text out of the image
# and hands it to the spam model.
IMAGE_PROMPT = (
    "\nThe attached file is a picture, and you can see it directly.  Your job "
    "on this turn is to turn the picture into a message and then have the "
    "trained spam model judge it.  Rules:\n"
    "10. Read the visible text out of the picture and write it out, keeping the "
    "sender, subject, body, amounts and links as they appear.  Say plainly "
    "when something is not legible instead of guessing it.\n"
    "11. Then call scan_attachment.  That tool scores the text that was read "
    "from the picture with the same spam model the Spam tab uses.\n"
    "12. Report that verdict and its probability as the answer, and say which "
    "words pushed the score.  If the tool refuses because no text could be "
    "read, say that instead of inventing a verdict.\n"
    "13. A picture by itself is not evidence of malware.  Judge only the text "
    "you read out of it."
)


def _tool(name: str, description: str, properties: Dict[str, Any],
          required: List[str]) -> Dict[str, Any]:
    """One OpenAI function schema. `strict` stops the server inventing fields."""
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            },
            "strict": True,
        },
    }


TOOL_SPECS = [
    _tool(
        "check_spam",
        "Classify a text message or email as SPAM or HAM.  Returns the verdict, "
        "the probability, and the words that pushed the score.",
        {"text": {"type": "string", "description": "The full message to check."}},
        ["text"],
    ),
    _tool(
        "list_malware_platforms",
        "List the platform names the malware models understand, plus the number "
        "of features each one reads.",
        {},
        [],
    ),
    _tool(
        "check_malware",
        "Classify a file as MALWARE or BENIGN for one platform, from feature "
        "values.  Missing features are filled with the training median and the "
        "reply says how many were imputed.",
        {
            "platform": {"type": "string",
                         "description": "A name from list_malware_platforms."},
            "features": {"type": "object",
                         "description": "Feature column name -> number.",
                         "additionalProperties": {"type": "number"}},
        },
        ["platform", "features"],
    ),
    _tool(
        "predict_process",
        "Predict the voluntary context-switch count of a running process from "
        "system counters.  Missing counters use the training median.",
        {"features": {"type": "object",
                      "description": "Counter name -> number.",
                      "additionalProperties": {"type": "number"}}},
        ["features"],
    ),
    _tool(
        "get_model_info",
        "Describe the loaded ML models: names, platforms, and feature counts.",
        {},
        [],
    ),
]

TOOL_NAMES = [spec["function"]["name"] for spec in TOOL_SPECS]


ATTACHMENT_TOOL_SPECS = [
    _tool(
        "get_attachment",
        "Describe the attached file: name, size, sha256, type, page count, "
        "links and notes (embedded files, active content, metadata).  Call this "
        "first when a file is attached.",
        {},
        [],
    ),
    _tool(
        "read_attachment_text",
        "Read the extracted text of the attached PDF, email or text file.  "
        "Returns one chunk and the offset to pass for the next one.",
        {
            "offset": {"type": "integer",
                       "description": "Character to start at; 0 for the beginning."},
            "limit": {"type": "integer",
                      "description": "Characters to return, at most %d."
                                     % ATTACHMENT_TEXT_CHUNK},
        },
        ["offset", "limit"],
    ),
    _tool(
        "scan_attachment",
        "Score the attached file with the trained models: the spam model for a "
        "PDF, email or text file, the malware models for a PE or APK.  Returns "
        "the verdict and probability.",
        {},
        [],
    ),
]

# Tool names the chat exposes; three more when a file is attached.
ATTACHMENT_TOOL_NAMES = [spec["function"]["name"] for spec in ATTACHMENT_TOOL_SPECS]


def clean_reply(text: str) -> str:
    """Strip the <think> block some templates leave in the content."""
    if not text:
        return ""
    text = re.sub(r"<think\b[^>]*>.*?</think\s*>", "", text, flags=re.S | re.I)
    # Some templates only emit the closing tag, leaving the opening one implied.
    if "</think>" in text.lower() and "<think" not in text.lower():
        text = re.split(r"</think\s*>", text, maxsplit=1, flags=re.I)[-1]
    text = re.sub(r"</?think\b[^>]*>", "", text, flags=re.I)
    return text.strip()


def _numbers(features: Any) -> Dict[str, float]:
    """Coerce a feature dict to floats; models sometimes send ints or numeric strings."""
    if not isinstance(features, dict):
        raise ValueError("features must be an object of column name -> number")
    return {str(k): float(v) for k, v in features.items()}


def _read_attachment_text(attachment, args: Dict[str, Any]) -> Dict[str, Any]:
    """One chunk of the attachment text, plus the offset of the next."""
    if not attachment.text:
        return {"error": "%s is a %s file; it has no text to read. Use "
                         "scan_attachment for its verdict."
                         % (attachment.filename, attachment.kind)}

    try:
        offset = int(args.get("offset") or 0)
        limit = int(args.get("limit") or ATTACHMENT_TEXT_CHUNK)
    except (TypeError, ValueError):
        return {"error": "offset and limit must be integers"}
    if offset < 0:
        return {"error": "offset must be 0 or more"}
    limit = max(1, min(limit, ATTACHMENT_TEXT_CHUNK))

    total = len(attachment.text)
    chunk = attachment.text[offset:offset + limit]
    end = offset + len(chunk)
    return {
        "filename": attachment.filename,
        "offset": offset,
        "returned": len(chunk),
        "total_chars": total,
        "next_offset": end if end < total else None,
        "text": chunk,
    }


def run_tool(name: str, args: Dict[str, Any],
             attachment=None) -> Dict[str, Any]:
    """Run one tool call and return a JSON-safe result.

    Bad arguments come back as {"error": ...} so the model can fix the call.
    File tools need `attachment` and say so when it's missing.
    """
    try:
        if name in ATTACHMENT_TOOL_NAMES:
            if attachment is None:
                return {"error": "no file is attached to this question; ask the "
                                 "user to attach one, or use the text tools"}
            if name == "get_attachment":
                return attachment.summary()
            if name == "read_attachment_text":
                return _read_attachment_text(attachment, args)
            return attachments.scan(attachment)

        if name == "check_spam":
            text = args.get("text")
            if not isinstance(text, str) or not text.strip():
                return {"error": "text must be a non-empty string"}
            return predict.predict_spam(text)

        if name == "list_malware_platforms":
            return {"platforms": predict.malware_platforms(),
                    "features": {p: len(predict.malware_feature_names(p))
                                 for p in predict.malware_platforms()}}

        if name == "check_malware":
            platform = args.get("platform")
            if not isinstance(platform, str) or not platform:
                return {"error": "platform must be a name from list_malware_platforms"}
            return predict.predict_malware(platform, _numbers(args.get("features", {})))

        if name == "predict_process":
            return predict.predict_process(_numbers(args.get("features", {})))

        if name == "get_model_info":
            return predict.model_info()

        return {"error": "unknown tool %r, use one of %s"
                         % (name, TOOL_NAMES + ATTACHMENT_TOOL_NAMES)}

    except ValueError as error:
        return {"error": str(error)}


class LLMUnavailable(RuntimeError):
    """The model server was unreachable or refused the request."""


def config() -> Dict[str, Any]:
    """Read the server settings from the environment on each call."""
    return {
        "base_url": os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        "api_key": os.getenv("LLM_API_KEY") or DEFAULT_API_KEY,
        "model": os.getenv("LLM_MODEL", DEFAULT_MODEL),
        "timeout": float(os.getenv("LLM_TIMEOUT", str(DEFAULT_TIMEOUT))),
    }


def _headers(api_key: Optional[str]) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = "Bearer " + api_key
    return headers


def masked_base_url(base_url: str) -> str:
    """Base URL with any credentials removed, safe for a status endpoint."""
    return re.sub(r"//[^/@]+@", "//", base_url)


def default_client() -> httpx.Client:
    """The real client. Tests pass their own with a MockTransport."""
    return httpx.Client(timeout=config()["timeout"])


def server_status(client: Optional[httpx.Client] = None) -> Dict[str, Any]:
    """Ask the model server which models it serves (GET /api/agent/info)."""
    settings = config()
    own_client = client is None
    client = client or httpx.Client(timeout=5.0)
    try:
        reply = client.get(settings["base_url"] + "/models",
                           headers=_headers(settings["api_key"]))
        reply.raise_for_status()
        served = [m.get("id") for m in reply.json().get("data", [])]
        return {"reachable": True, "served_models": served,
                "model_in_use": settings["model"],
                "model_is_served": settings["model"] in served}
    except (httpx.HTTPError, ValueError) as error:
        return {"reachable": False, "error": str(error),
                "model_in_use": settings["model"]}
    finally:
        if own_client:
            client.close()


def _post_chat(client: httpx.Client, settings: Dict[str, Any],
               messages: List[Dict[str, Any]],
               tools: Optional[List[Dict[str, Any]]] = None,
               max_tokens: Optional[int] = None) -> Dict[str, Any]:
    """One completion round; returns the first choice.

    `max_tokens` overrides the default budget for this call only.
    """
    body = {
        "model": settings["model"],
        "messages": messages,
        "tools": tools if tools is not None else TOOL_SPECS,
        "tool_choice": "auto",
        "temperature": 0,
        "max_tokens": max_tokens or MAX_REPLY_TOKENS,
    }
    try:
        reply = client.post(settings["base_url"] + "/chat/completions",
                            headers=_headers(settings["api_key"]), json=body)
        reply.raise_for_status()
        payload = reply.json()
    except httpx.HTTPStatusError as error:
        raise LLMUnavailable("model server answered %d: %s"
                             % (error.response.status_code,
                                error.response.text[:300]))
    except (httpx.HTTPError, ValueError) as error:
        raise LLMUnavailable("cannot reach the model server at %s (%s)"
                             % (masked_base_url(settings["base_url"]), error))

    choices = payload.get("choices") or []
    if not choices:
        raise LLMUnavailable("model server returned no choices")
    return choices[0]


# A round that burns its whole budget on reasoning returns no text and no
# tool call. Reasoning stays on and the round is asked again with a bigger
# budget, so the model can finish thinking and still answer.
RETRY_TOKEN_MULTIPLIER = 3
RETRY_TOKEN_CEILING = 12000


def _is_empty(choice: Dict[str, Any]) -> bool:
    """True when a round gave neither an answer nor a tool call."""
    message = choice.get("message") or {}
    return not (message.get("content") or "").strip() and not message.get("tool_calls")


def _ask(client: httpx.Client, settings: Dict[str, Any],
         messages: List[Dict[str, Any]], tools: List[Dict[str, Any]],
         on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None,
         budget: Optional[int] = None) -> Dict[str, Any]:
    """One round, retried with a bigger max_tokens if reasoning used it all."""
    limit = budget or MAX_REPLY_TOKENS
    choice = _post_chat(client, settings, messages, tools, max_tokens=limit)

    for _ in range(2):
        if not _is_empty(choice) or choice.get("finish_reason") != "length":
            return choice
        if limit >= RETRY_TOKEN_CEILING:
            return choice
        limit = min(limit * RETRY_TOKEN_MULTIPLIER, RETRY_TOKEN_CEILING)
        if on_event is not None:
            on_event("retry", {"reason": "reasoning used the token budget",
                               "max_tokens": limit})
        choice = _post_chat(client, settings, messages, tools, max_tokens=limit)
    return choice


def chat(prompt: str,
         history: Optional[List[Dict[str, str]]] = None,
         client: Optional[httpx.Client] = None,
         on_event: Optional[Callable[[str, Dict[str, Any]], None]] = None,
         attachment=None) -> Dict[str, Any]:
    """Answer a prompt, running the ML tools the model asks for.

    Returns {"reply", "tool_calls", "rounds"}. `history` is earlier turns,
    `on_event(name, payload)` gets "tool_start"/"tool_end", and `attachment`
    adds three file tools (the bytes never enter the transcript).
    """
    settings = config()
    own_client = client is None
    client = client or default_client()

    tools = list(TOOL_SPECS)
    system = SYSTEM_PROMPT
    if attachment is not None:
        tools = tools + ATTACHMENT_TOOL_SPECS
        system = SYSTEM_PROMPT + ATTACHMENT_PROMPT
        if getattr(attachment, "image", None):
            system = system + IMAGE_PROMPT

    messages: List[Dict[str, Any]] = [{"role": "system", "content": system}]
    for turn in (history or [])[-MAX_HISTORY_MESSAGES:]:
        role, content = turn.get("role"), turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content:
            messages.append({"role": role, "content": content})

    # The prompt names the file so "what is this?" can be answered, but the
    # file itself is only reachable through the tools.
    if attachment is not None:
        prompt = ("%s\n\n[attached file: %s, %d bytes, type %s]"
                  % (prompt, attachment.filename, attachment.size,
                     attachment.kind))

    # Pictures go out as an image part so the model sees them.
    # Everything else stays a plain string.
    content = prompt
    if attachment is not None and getattr(attachment, "image", None):
        attachment.image["question"] = prompt
        content = attachment.user_content()
    messages.append({"role": "user", "content": content})

    calls: List[Dict[str, Any]] = []
    try:
        for round_number in range(1, MAX_TOOL_ROUNDS + 1):
            choice = _ask(client, settings, messages, tools, on_event=on_event)
            message = choice.get("message") or {}
            requested = message.get("tool_calls") or []

            if not requested:
                reply = clean_reply(message.get("content") or "")
                return {"reply": reply or _fallback_reply(calls, choice, attachment),
                        "tool_calls": calls, "rounds": round_number,
                        "finish_reason": choice.get("finish_reason")}

            # The assistant turn that asked for the tools must stay in the
            # transcript, and each tool result has to name its call id.
            messages.append({"role": "assistant",
                             "content": message.get("content") or "",
                             "tool_calls": requested})
            for call in requested:
                function = call.get("function") or {}
                name = function.get("name") or ""
                try:
                    args = json.loads(function.get("arguments") or "{}")
                except ValueError:
                    args = None
                if on_event is not None:
                    on_event("tool_start", {"tool": name, "args": args})
                result = ({"error": "arguments were not valid JSON"}
                          if args is None or not isinstance(args, dict)
                          else run_tool(name, args, attachment))
                calls.append({"tool": name, "args": args, "result": result})
                if on_event is not None:
                    on_event("tool_end", {"tool": name, "args": args, "result": result})
                messages.append({"role": "tool",
                                 "tool_call_id": call.get("id") or name,
                                 "content": json.dumps(result)})

        # The model kept asking for tools. Report that; the last tool output
        # isn't the answer.
        return {"reply": "The model did not settle on an answer within %d tool "
                         "rounds.  The tool results are below."
                         % MAX_TOOL_ROUNDS,
                "tool_calls": calls, "rounds": MAX_TOOL_ROUNDS,
                "finish_reason": "max_rounds"}
    finally:
        if own_client:
            client.close()


def _fallback_reply(calls: List[Dict[str, Any]],
                    choice: Dict[str, Any],
                    attachment=None) -> str:
    """Fallback reply when the model gave no text after the retry."""
    reason = choice.get("finish_reason") or "unknown"
    scored = [call["result"] for call in calls
              if isinstance(call.get("result"), dict)
              and "verdict" in call["result"]]
    if scored:
        result = scored[-1]
        probability = result.get("probability")
        head = "Verdict: %s" % result["verdict"]
        if isinstance(probability, (int, float)):
            head += ", probability %.4f" % probability
        note = ("The model stopped before writing its explanation (%s), so "
                "this is the result from %s." % (reason, calls[-1].get("tool")))
        details = []
        if attachment is not None and attachment.links:
            details.append("links in the file: %s" % ", ".join(attachment.links[:5]))
        if attachment is not None and attachment.notes:
            details.append("notes: %s" % "; ".join(attachment.notes))
        return "\n\n".join([head + ".", note] + details)

    if not calls:
        return ("The model stopped before answering (%s). Try a shorter question."
                % reason)
    last = calls[-1]
    return ("The model ran %s but stopped before writing an explanation (%s). "
            "Its result is below." % (last.get("tool"), reason))
