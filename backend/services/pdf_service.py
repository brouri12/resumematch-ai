"""PDF text extraction with pdfplumber and PyPDF2 fallback."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str | Path) -> str:
    """Extract text from a PDF file. Prefer pdfplumber, fall back to PyPDF2."""
    path = Path(file_path)
    text = _extract_with_pdfplumber(path)
    if text and text.strip():
        return text.strip()

    logger.warning("pdfplumber returned empty text for %s; trying PyPDF2", path)
    text = _extract_with_pypdf2(path)
    return (text or "").strip()


def _extract_with_pdfplumber(path: Path) -> str:
    try:
        import pdfplumber

        chunks: list[str] = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text:
                    chunks.append(page_text)
        return "\n".join(chunks)
    except Exception as exc:  # noqa: BLE001
        logger.exception("pdfplumber failed: %s", exc)
        return ""


def _extract_with_pypdf2(path: Path) -> str:
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(str(path))
        chunks: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text:
                chunks.append(page_text)
        return "\n".join(chunks)
    except Exception as exc:  # noqa: BLE001
        logger.exception("PyPDF2 failed: %s", exc)
        return ""
