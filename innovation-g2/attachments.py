"""Read an attached file in memory and describe it.

Nothing touches disk and nothing is executed. Pictures carry only the bytes
for the vision model: the assistant reads the visible text out of them and
passes the transcription to the spam model. Malware scanning reuses extract.py.
"""

import hashlib
import html
import io
import re
import zipfile
from email import message_from_bytes
from typing import Any, Dict, List

import predict

# PDFs start with this marker, but the spec allows junk before it, so we also
# look in the first kilobyte.
PDF_MAGIC = b"%PDF-"

# Bigger than this and it's not a message anyone reads.
MAX_TEXT_CHARS = 2_000_000

LINK_RE = re.compile(r"https?://[^\s<>\"')]+", re.I)
TAG_RE = re.compile(r"<[^>]+>")
HREF_RE = re.compile(r"href\s*=\s*[\"']([^\"']+)[\"']", re.I)

# PDF catalogue keys that let the document act on its own.
PDF_SCRIPT_KEYS = ("/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch",
                   "/EmbeddedFile", "/RichMedia")

# Image formats by magic number. Pictures have no text layer, so the kind is
# settled here, before anything tries to decode the bytes as text.
IMAGE_MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
    (b"BM", "image/bmp", "bmp"),
)


def is_image(data):
    """True when the first bytes name one of the picture formats above."""
    return any(data.startswith(magic) for magic, _mime, _ext in IMAGE_MAGIC)

# The vision endpoint wants a data URL. Big photos get downscaled first to
# keep the request small.
MAX_IMAGE_SIDE = 1600


class UnsupportedFile(ValueError):
    """Not a file type the chat box can read."""


class Attachment:
    """One parsed attachment: `text` for the spam model, `scan` for malware."""

    def __init__(self, filename: str, data: bytes, kind: str,
                 text: str = "", notes: List[str] = None,
                 links: List[str] = None, pages: int = 0,
                 scan: Dict[str, Any] = None,
                 image: Dict[str, Any] = None):
        self.filename = filename or "attachment"
        self.data = data
        self.kind = kind
        self.text = text or ""
        self.notes = list(notes or [])
        self.links = list(links or [])
        self.pages = pages
        self.scan = scan
        # Picture only: the data URL for the vision model, plus its size.
        # None for other kinds, so callers can just test this field.
        self.image = image

    @property
    def size(self) -> int:
        return len(self.data)

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()

    def summary(self) -> Dict[str, Any]:
        """What the model is told about the file: facts, no raw bytes."""
        return {
            "filename": self.filename,
            "size": self.size,
            "sha256": self.sha256,
            "kind": self.kind,
            "pages": self.pages,
            "text_chars": len(self.text),
            "links": self.links[:20],
            "notes": self.notes,
        }

    def user_content(self):
        """Content for this turn's user message."""
        if not self.image:
            return None
        return [
            {"type": "text", "text": self.image["question"]},
            {"type": "image_url",
             "image_url": {"url": self.image["data_url"]}},
        ]


def detect_kind(data: bytes, filename: str = "") -> str:
    """File type from the bytes; the name only matters for text (.eml, .html)."""
    if not data:
        raise UnsupportedFile("the file is empty")
    if data[:5] == PDF_MAGIC or PDF_MAGIC in data[:1024]:
        return "pdf"
    if data[:2] == b"MZ":
        return "pe"
    for magic, _mime, _ext in IMAGE_MAGIC:
        if data.startswith(magic):
            return "image"
    if zipfile.is_zipfile(io.BytesIO(data)):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "AndroidManifest.xml" in archive.namelist():
                    return "apk"
        except zipfile.BadZipFile:
            pass
    if b"\x00" in data[:8192]:
        raise UnsupportedFile(
            "unsupported file: expected a PDF, a Windows PE, an Android APK, "
            "an image, or a text/email file")
    lowered = (filename or "").lower()
    if lowered.endswith(".eml"):
        return "email"
    if lowered.endswith((".html", ".htm")):
        return "html"
    return "text"


def _decode(data: bytes) -> str:
    """Text decoded with the encoding the message was sent in."""
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", "replace")


def _unique(values) -> List[str]:
    """Drop repeats, keep the first occurrence of each value."""
    seen = set()
    out = []
    for value in values:
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            out.append(value)
    return out

def inspect_pdf(data: bytes, filename: str) -> Attachment:
    """Text, links, embedded files and active content from a PDF."""
    import pymupdf

    notes: List[str] = []
    links: List[str] = []
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as error:            # pymupdf has its own error types
        raise ValueError("cannot read this PDF: %s" % error)

    try:
        if document.needs_pass:
            raise ValueError("this PDF is encrypted; its text cannot be read")

        pages = document.page_count
        text = "\n".join(page.get_text() for page in document)
        for page in document:
            for link in page.get_links():
                uri = link.get("uri")
                if uri:
                    links.append(uri)

        metadata = {k: v for k, v in (document.metadata or {}).items()
                    if v and k in ("title", "author", "creator", "producer",
                                   "creationDate", "modDate")}
        if metadata:
            notes.append("metadata: %s" % ", ".join(
                "%s=%s" % (k, v) for k, v in metadata.items()))

        embedded = document.embfile_count()
        if embedded:
            names = []
            for index in range(embedded):
                try:
                    names.append(document.embfile_info(index).get("filename")
                                 or "unnamed")
                except Exception:
                    names.append("unnamed")
            notes.append("%d embedded file(s) inside the PDF: %s"
                         % (embedded, ", ".join(names[:10])))

        # Document-level switches (open actions, scripts) live in the catalogue;
        # annotations on a page can have their own.
        raw = ""
        if document.xref_length() > 1:
            try:
                raw = document.xref_object(1, compressed=False)
            except Exception:
                raw = ""
        active = [key for key in PDF_SCRIPT_KEYS if key in raw]
        if active:
            notes.append("the PDF carries active content (%s); it was not run"
                         % ", ".join(active))
    finally:
        document.close()

    text = text.strip()[:MAX_TEXT_CHARS]
    return Attachment(filename, data, "pdf", text=text, notes=notes,
                      links=_unique(links), pages=pages)


def _html_to_text(markup: str) -> str:
    """Readable text from markup; block tags become line breaks."""
    markup = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", " ", markup)
    markup = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", markup)
    text = html.unescape(TAG_RE.sub(" ", markup))
    lines = [" ".join(line.split()) for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def inspect_email(data: bytes, filename: str) -> Attachment:
    """Subject, sender, body and links of an .eml."""
    message = message_from_bytes(data)
    body_parts = []
    for part in message.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get_filename():
            body_parts.append("[attachment: %s]" % part.get_filename())
            continue
        if part.get_content_type() not in ("text/plain", "text/html"):
            continue
        payload = part.get_payload(decode=True) or b""
        body = _decode(payload)
        if part.get_content_type() == "text/html":
            body = _html_to_text(body)
        body_parts.append(body)

    headers = []
    for header in ("Subject", "From", "Reply-To", "Return-Path", "Date"):
        value = message.get(header)
        if value:
            headers.append("%s: %s" % (header, value))
    received = message.get_all("Received")
    if received:
        headers.append("Received: %s" % received[0])

    notes = []
    if message.get("Authentication-Results"):
        notes.append("Authentication-Results: %s"
                     % message.get("Authentication-Results"))
    if any(part.startswith("[attachment:") for part in body_parts):
        notes.append("the email carries attachments")

    body = "\n".join(part for part in body_parts if part.strip())
    text = "\n".join(headers + ["", body]).strip()[:MAX_TEXT_CHARS]
    return Attachment(filename, data, "email", text=text, notes=notes,
                      links=_unique(LINK_RE.findall(text)))


def inspect_html(data: bytes, filename: str) -> Attachment:
    """Visible text and links of an HTML message."""
    markup = _decode(data)
    text = _html_to_text(markup)[:MAX_TEXT_CHARS]
    hrefs = [href for href in HREF_RE.findall(markup)
             if not href.lower().startswith(("javascript:", "#", "mailto:"))]
    notes = []
    if re.search(r"(?i)<(script|iframe|form)\b", markup):
        notes.append("the page contains script, iframe or form markup")
    return Attachment(filename, data, "html", text=text, notes=notes,
                      links=_unique(hrefs + LINK_RE.findall(text)))


def inspect_text(data: bytes, filename: str) -> Attachment:
    """Plain text message; links go into the notes."""
    text = _decode(data)[:MAX_TEXT_CHARS]
    return Attachment(filename, data, "text", text=text,
                      links=_unique(LINK_RE.findall(text)))


def inspect_binary(data: bytes, kind: str, filename: str,
                   platform: str = None) -> Attachment:
    """Scan a PE or APK with the same parser as the Malware tab."""
    import extract

    scan = extract.scan(data, filename, platform)
    notes = ["scanned by %d model(s); %d voted malware"
             % (len(scan["results"]), scan["models_voting_malware"])]
    if kind == "pe":
        first = scan["results"][0]
        notes.append("%d of %d PE header fields were read from the file"
                     % (first["features_given"],
                        first["features_given"] + first["features_imputed"]))
    return Attachment(filename, data, kind, notes=notes, scan=scan)


def _image_mime(data: bytes) -> str:
    """MIME type of a picture, from its magic number."""
    for magic, mime, _ext in IMAGE_MAGIC:
        if data.startswith(magic):
            return mime
    return "application/octet-stream"


def _shrink_image(data: bytes) -> bytes:
    """Halve a large picture until it fits; phone photos cost too many tokens."""
    import pymupdf

    try:
        pix = pymupdf.Pixmap(data)
    except Exception:
        return data
    if max(pix.width, pix.height) <= MAX_IMAGE_SIDE:
        return data

    while max(pix.width, pix.height) > MAX_IMAGE_SIDE and pix.width > 1:
        pix.shrink(1)
    try:
        return pix.tobytes("png")
    except Exception:
        return data


def inspect_image(data: bytes, filename: str) -> Attachment:
    """Picture attachment. The sha256 covers the original bytes, not the downscaled ones."""
    import base64

    prepared = _shrink_image(data)
    mime = "image/png" if prepared is not data else _image_mime(data)
    image = {
        "data_url": "data:%s;base64,%s" % (mime, base64.b64encode(prepared).decode()),
        "question": "",
    }
    # The caller fills in the question, since it knows what the user asked.
    return Attachment(filename, data, "image",
                      notes=["a picture, read by the vision model"], image=image)


def inspect(data: bytes, filename: str = "", platform: str = None) -> Attachment:
    """Parse one attachment. Raises UnsupportedFile or ValueError."""
    kind = detect_kind(data, filename)
    if kind == "pdf":
        return inspect_pdf(data, filename)
    if kind in ("pe", "apk"):
        return inspect_binary(data, kind, filename, platform)
    if kind == "image":
        return inspect_image(data, filename)
    if kind == "email":
        return inspect_email(data, filename)
    if kind == "html":
        return inspect_html(data, filename)
    return inspect_text(data, filename)


def scan(attachment: Attachment) -> Dict[str, Any]:
    """Score the attachment with the model that fits its type.

    `kind` is "malware" (per-model `results`) or "spam" (words behind the score).
    """
    if attachment.scan is not None:
        return {**attachment.scan, "kind": "malware"}
    if not attachment.text.strip():
        if attachment.kind == "image":
            raise ValueError("%s is a picture: ask the assistant to read its "
                             "text and pass it to scan_attachment before scoring"
                             % attachment.filename)
        raise ValueError("%s %s has no text to score"
                         % (attachment.kind, attachment.filename))
    return predict.spam_file_reply(attachment.text, attachment)
