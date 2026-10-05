"""Import a job offer from a public URL (JSON-LD JobPosting first, visible text fallback)."""

from __future__ import annotations

import html
import ipaddress
import json
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

MAX_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 3
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36 ResumeMatchAI"
)
BLOCKED_HOST_HINTS = {
    "linkedin.com": "LinkedIn bloque l'accès automatique : copiez-collez le texte de l'offre.",
}


class JobImportError(Exception):
    pass


def _assert_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise JobImportError("URL invalide : utilisez une adresse http(s) complète.")
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or None)
    except socket.gaierror as exc:
        raise JobImportError("Nom de domaine introuvable.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise JobImportError("Adresse non autorisée.")


def fetch_html(url: str) -> str:
    import httpx

    current = url
    for _ in range(MAX_REDIRECTS + 1):
        _assert_public_url(current)
        with httpx.stream(
            "GET",
            current,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "fr,en;q=0.8"},
            follow_redirects=False,
            timeout=15.0,
        ) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise JobImportError("Redirection invalide.")
                current = urljoin(current, location)
                continue
            if response.status_code >= 400:
                raise JobImportError(
                    f"La page a répondu {response.status_code} : copiez-collez le texte de l'offre."
                )
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise JobImportError("Page trop volumineuse.")
                chunks.append(chunk)
            encoding = response.encoding or "utf-8"
            return b"".join(chunks).decode(encoding, errors="replace")
    raise JobImportError("Trop de redirections.")


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "nav", "footer", "header", "svg", "form"}
    BLOCK = {"p", "div", "li", "br", "h1", "h2", "h3", "h4", "section", "article", "tr"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip_depth = 0
        self.title = ""
        self._in_title = False
        self.json_ld: list[str] = []
        self._in_json_ld = False

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        if tag == "script" and (attrs_d.get("type") or "").lower() == "application/ld+json":
            self._in_json_ld = True
            self.json_ld.append("")
            return
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self.skip_depth += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self._in_json_ld and tag == "script":
            self._in_json_ld = False
            return
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if self._in_json_ld:
            self.json_ld[-1] += data
            return
        if self._in_title:
            self.title += data
        if not self.skip_depth:
            self.parts.append(data)


def _html_to_text(fragment: str) -> str:
    extractor = _TextExtractor()
    extractor.feed(fragment)
    return _clean("".join(extractor.parts))


def _clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def _find_job_posting(node):
    if isinstance(node, list):
        for item in node:
            found = _find_job_posting(item)
            if found:
                return found
    elif isinstance(node, dict):
        kind = node.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        if "JobPosting" in kinds:
            return node
        for key in ("@graph", "mainEntity", "itemListElement"):
            if key in node:
                found = _find_job_posting(node[key])
                if found:
                    return found
    return None


def parse_job_page(page_html: str) -> dict:
    extractor = _TextExtractor()
    extractor.feed(page_html)

    for raw in extractor.json_ld:
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            continue
        posting = _find_job_posting(data)
        if not posting:
            continue
        org = posting.get("hiringOrganization") or {}
        company = org.get("name", "") if isinstance(org, dict) else str(org)
        parts = [_html_to_text(str(posting.get("description") or ""))]
        for key in ("qualifications", "skills", "responsibilities", "experienceRequirements"):
            value = posting.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(_html_to_text(value))
        text = "\n\n".join(p for p in parts if p)
        if len(text) >= 20:
            return {
                "title": _clean(str(posting.get("title") or ""))[:255],
                "company": _clean(company)[:255],
                "text": text[:20000],
                "source": "json-ld",
            }

    text = _clean("".join(extractor.parts))
    return {
        "title": _clean(extractor.title)[:255],
        "company": "",
        "text": text[:20000],
        "source": "html",
    }


def import_job_offer(url: str) -> dict:
    host = (urlparse(url).hostname or "").lower()
    for blocked, message in BLOCKED_HOST_HINTS.items():
        if host == blocked or host.endswith("." + blocked):
            raise JobImportError(message)
    result = parse_job_page(fetch_html(url))
    if len(result["text"]) < 100:
        raise JobImportError(
            "Impossible d'extraire le texte de l'offre (page dynamique ?) : copiez-collez-le."
        )
    return result
