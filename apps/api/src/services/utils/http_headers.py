"""HTTP header helpers."""
import unicodedata
from urllib.parse import quote


def content_disposition(filename: str, disposition: str = "inline") -> str:
    """A Content-Disposition value that is safe for any filename.

    Headers must be Latin-1, so non-ASCII names (Arabic, "…", emoji) would crash
    the response. Send an ASCII fallback plus the real name as RFC 5987
    ``filename*`` (which browsers prefer).
    """
    name = (filename or "download").replace("\r", " ").replace("\n", " ")
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    ascii_name = ascii_name.replace('"', "").replace("\\", "").strip()
    stem, dot, ext = ascii_name.rpartition(".")
    if dot and not stem.strip(" ._-"):
        ascii_name = f"document.{ext}"  # e.g. an Arabic-only name
    ascii_name = ascii_name or "download"
    return f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name, safe='')}"
