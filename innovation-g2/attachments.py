"""Read an attached file in memory and describe it.

The chat box lets a person attach one file.  This module turns those bytes
into the handful of facts the assistant needs: what kind of file it is, its
hash, its text, the links it carries, and anything that looks worth a second
look (embedded files, JavaScript, auto-actions).

Nothing here touches the disk.  The bytes arrive in a request body, are parsed
from an in-memory stream, and are released with the request.  Nothing is
executed either: a PE and an APK are only read.

    inspect(data, filename) -> Attachment

The malware side reuses extract.py, so a file scanned from the chat box goes
through exactly the same parser as the Malware tab.
"""

import hashlib
import html
import io
import re
import zipfile
from email import message_from_bytes
from typing import Any, Dict, List

import predict

# PDFs begin with this marker; the spec allows junk before it, so the marker
# is also looked for inside the first kilobyte.
PDF_MAGIC = b"%PDF-"

# A text file that is larger than this is not a message anybody reads.
MAX_TEXT_CHARS = 2_000_000

LINK_RE = re.compile(r"https?://[^\s<>\"')]+", re.I)
TAG_RE = re.compile(r"<[^>]+>")
HREF_RE = re.compile(r"href\s*=\s*[\"']([^\"']+)[\"']", re.I)

# PDF catalogue keys that mean the document can act on its own.
PDF_SCRIPT_KEYS = ("/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch",
                   "/EmbeddedFile", "/RichMedia")


class UnsupportedFile(ValueError):
    """The bytes are not a file type the chat box can read."""


class Attachment:
    """One attached file, already parsed, kept in memory.

    `text` is the text the spam model can read; `scan` is the malware result
    for a PE or APK.  Both may be empty: a PDF has text but no malware scan,
    a PE has a scan but no text.
    """

    def __init__(self, filename: str, data: bytes, kind: str,
                 text: str = "", notes: List[str] = None,
                 links: List[str] = None, pages: int = 0,
                 scan: Dict[str, Any] = None):
        self.filename = filename or "attachment"
        self.data = data
        self.kind = kind
        self.text = text or ""
        self.notes = list(notes or [])
        self.links = list(links or [])
        self.pages = pages
        self.scan = scan

    @property
    def size(self) -> int:
        return len(self.data)

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()

    def summary(self) -> Dict[str, Any]:
        """What the model is told about the file: facts, never raw bytes."""
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


def detect_kind(data: bytes, filename: str = "") -> str:
    """Decide the file type from the bytes.

    The name is a hint only for text, where there is no magic number: an .eml
    is read as an email, .html as markup, anything else as plain text.  Binary
    formats are recognised by content, so a PDF renamed to .exe is still a PDF.
    """
    if not data:
        raise UnsupportedFile("the file is empty")
    if data[:5] == PDF_MAGIC or PDF_MAGIC in data[:1024]:
        return "pdf"
    if data[:2] == b"MZ":
        return "pe"
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
            "or a text/email file")
    lowered = (filename or "").lower()
    if lowered.endswith(".eml"):
        return "email"
    if lowered.endswith((".html", ".htm")):
        return "html"
    return "text"


def _decode(data: bytes) -> str:
    """Text in the encoding a message is actually sent in."""
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", "replace")


def _unique(values) -> List[str]:
    """Keep the first spelling of each value, in order."""
    seen = set()
    out = []
    for value in values:
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            out.append(value)
    return out

def inspect_pdf(data: bytes, filename: str) -> Attachment:
    """Text, links, embedded files and active content of a PDF."""
    import pymupdf

    notes: List[str] = []
    links: List[str] = []
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as error:            # pymupdf raises its own error types
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

        # The catalogue holds the document-level switches (open actions,
        # scripts); page annotations can carry their own actions.
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
    """Readable text from markup, with block tags as line breaks."""
    markup = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", " ", markup)
    markup = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", markup)
    text = html.unescape(TAG_RE.sub(" ", markup))
    lines = [" ".join(line.split()) for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def inspect_email(data: bytes, filename: str) -> Attachment:
    """Subject, sender and body of an .eml, with its links."""
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
    """The visible text of an HTML message, plus its links."""
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
    """A plain text message; links are pulled out for the notes."""
    text = _decode(data)[:MAX_TEXT_CHARS]
    return Attachment(filename, data, "text", text=text,
                      links=_unique(LINK_RE.findall(text)))


def inspect_binary(data: bytes, kind: str, filename: str) -> Attachment:
    """Scan a PE or APK with the same parser the Malware tab uses.

    The scan is done once, here, because it needs the whole file anyway; the
    model then asks for the result instead of re-reading the bytes.
    """
    import extract

    scan = extract.scan(data, filename)
    notes = ["scanned by %d model(s); %d voted malware"
             % (len(scan["results"]), scan["models_voting_malware"])]
    if kind == "pe":
        first = scan["results"][0]
        notes.append("%d of %d PE header fields were read from the file"
                     % (first["features_given"],
                        first["features_given"] + first["features_imputed"]))
    return Attachment(filename, data, kind, notes=notes, scan=scan)


def inspect(data: bytes, filename: str = "") -> Attachment:
    """Parse one attachment.  Raises UnsupportedFile or ValueError."""
    kind = detect_kind(data, filename)
    if kind == "pdf":
        return inspect_pdf(data, filename)
    if kind in ("pe", "apk"):
        return inspect_binary(data, kind, filename)
    if kind == "email":
        return inspect_email(data, filename)
    if kind == "html":
        return inspect_html(data, filename)
    return inspect_text(data, filename)
