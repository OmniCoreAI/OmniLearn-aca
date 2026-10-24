"""Safe ``{{variable}}`` rendering for admin-written templates.

No template engine is involved (no Jinja): placeholders are plain
``{{name}}`` tokens replaced by a regex, values are HTML-escaped for email,
and admin-written HTML is sanitized to a small allow-list before use.
"""
import html
import re
from typing import Dict, Iterable, List, Optional

from bs4 import BeautifulSoup, Comment

VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")

ALLOWED_TAGS = {
    "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "hr", "i", "img",
    "li", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
    "th", "thead", "tr", "u", "ul",
}
DROP_WITH_CONTENT = {"script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "meta", "link", "svg", "math", "template", "noscript"}
ALLOWED_ATTRS = {
    "*": {"style", "dir", "align", "title"},
    "a": {"href", "target", "rel"},
    "img": {"src", "alt", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}
SAFE_URL_RE = re.compile(r"^(https?:|mailto:|tel:|\{\{|/|#)", re.I)
BAD_STYLE_RE = re.compile(r"expression|javascript:|url\s*\(|@import|behavior", re.I)


def variables_in(text: Optional[str]) -> List[str]:
    return list(dict.fromkeys(VAR_RE.findall(text or "")))


def unknown_variables(texts: Iterable[Optional[str]], allowed: Iterable[str]) -> List[str]:
    allowed_set = set(allowed)
    found: List[str] = []
    for text in texts:
        for name in variables_in(text):
            if name not in allowed_set and name not in found:
                found.append(name)
    return found


def render_text(template: Optional[str], variables: Dict[str, object], escape: bool) -> str:
    """Replace ``{{name}}`` tokens; unknown names render as an empty string."""

    def repl(match: re.Match) -> str:
        value = variables.get(match.group(1))
        text = "" if value is None else str(value)
        return html.escape(text, quote=True) if escape else text

    return VAR_RE.sub(repl, template or "")


def sanitize_html(body: Optional[str]) -> str:
    """Reduce admin-written HTML to a safe allow-list (keeps ``{{vars}}``)."""
    soup = BeautifulSoup(body or "", "html.parser")
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()
    for tag in list(soup.find_all(True)):
        name = (tag.name or "").lower()
        if name in DROP_WITH_CONTENT:
            tag.decompose()
            continue
        if name not in ALLOWED_TAGS:
            tag.unwrap()
            continue
        allowed = ALLOWED_ATTRS["*"] | ALLOWED_ATTRS.get(name, set())
        for attr in list(tag.attrs):
            value = tag.attrs[attr]
            value_str = " ".join(value) if isinstance(value, list) else str(value)
            if attr.lower() not in allowed or attr.lower().startswith("on"):
                del tag.attrs[attr]
            elif attr in ("href", "src") and not SAFE_URL_RE.match(value_str.strip()):
                del tag.attrs[attr]
            elif attr == "style" and BAD_STYLE_RE.search(value_str):
                del tag.attrs[attr]
        if name == "a" and tag.get("target") == "_blank":
            tag["rel"] = "noopener noreferrer"
    return str(soup)


def html_to_text(body: str) -> str:
    return BeautifulSoup(body or "", "html.parser").get_text(" ", strip=True)


def sms_segments(text: str) -> int:
    """Number of SMS parts (GSM-7: 160/153 chars; Unicode e.g. Arabic: 70/67)."""
    if not text:
        return 0
    unicode_needed = any(ord(ch) > 127 for ch in text)
    single, multi = (70, 67) if unicode_needed else (160, 153)
    length = len(text)
    return 1 if length <= single else -(-length // multi)


def wrap_email(body_html: str, language: str) -> str:
    """Put a rendered body into the platform's standard email layout."""
    from src.services.users.emails import _email_layout

    content = f'<div dir="rtl" style="text-align:right">{body_html}</div>' if language == "ar" else body_html
    return _email_layout(title="", body_content=content)
