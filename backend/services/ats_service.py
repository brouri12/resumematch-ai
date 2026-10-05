"""Deterministic ATS (Applicant Tracking System) compatibility checks for a CV."""

from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

SECTION_PATTERNS = {
    "experience": r"exp[ée]riences?|experience|parcours professionnel|employment",
    "education": r"formations?|[ée]ducation|dipl[ôo]mes?|études",
    "skills": r"comp[ée]tences|skills|savoir-faire",
}

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){3,5}\d{2,4}")

LABELS = {
    "fr": {
        "text": "Texte extractible",
        "pages": "Nombre de pages",
        "columns": "Mise en page en colonnes",
        "tables": "Tableaux",
        "images": "Images / graphiques",
        "sections": "Sections standard",
        "contact": "Coordonnées",
        "keywords": "Mots-clés exacts de l'offre",
        "length": "Longueur du contenu",
    },
    "en": {
        "text": "Extractable text",
        "pages": "Page count",
        "columns": "Column layout",
        "tables": "Tables",
        "images": "Images / graphics",
        "sections": "Standard sections",
        "contact": "Contact details",
        "keywords": "Exact offer keywords",
        "length": "Content length",
    },
}


def collect_pdf_layout(file_path: str | Path) -> dict:
    """Return layout stats used by the ATS checks (pages, images, tables, column ratio)."""
    stats = {"pages": 0, "images": 0, "tables": 0, "column_ratio": 0.0}
    try:
        import pdfplumber

        split_lines = 0
        total_lines = 0
        with pdfplumber.open(file_path) as pdf:
            stats["pages"] = len(pdf.pages)
            for page in pdf.pages:
                stats["images"] += len(page.images or [])
                try:
                    stats["tables"] += len(page.find_tables() or [])
                except Exception:  # noqa: BLE001
                    pass
                split, total = _column_split_lines(page.extract_words() or [], float(page.width))
                split_lines += split
                total_lines += total
        if total_lines:
            stats["column_ratio"] = round(split_lines / total_lines, 3)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ATS layout analysis failed: %s", exc)
    return stats


def _column_split_lines(words: list[dict], width: float) -> tuple[int, int]:
    """Count lines that have words on both sides of a wide gap around the page middle."""
    if not words or not width:
        return 0, 0
    lines: dict[int, list[dict]] = {}
    for word in words:
        lines.setdefault(int(round(float(word["top"]) / 3)), []).append(word)
    split = 0
    middle_low, middle_high = width * 0.3, width * 0.7
    for line_words in lines.values():
        line_words.sort(key=lambda w: float(w["x0"]))
        for left, right in zip(line_words, line_words[1:]):
            gap = float(right["x0"]) - float(left["x1"])
            if gap > width * 0.08 and middle_low < float(left["x1"]) < middle_high:
                split += 1
                break
    return split, len(lines)


def _has_keyword(skill: str, text_lower: str) -> bool:
    pattern = rf"(?<![\w]){re.escape(skill.lower())}(?![\w])"
    return re.search(pattern, text_lower) is not None


def evaluate_ats(
    text: str,
    layout: dict,
    required_skills: list[str],
    language: str = "fr",
) -> dict:
    """Score 0-100 plus a list of checks with status ok|warn|fail."""
    labels = LABELS.get(language, LABELS["fr"])
    en = language == "en"
    text = text or ""
    lower = text.lower()
    words = len(text.split())
    checks: list[dict] = []
    penalty = 0

    def add(check_id: str, status: str, detail: str, cost: int) -> None:
        nonlocal penalty
        if status == "fail":
            penalty += cost
        elif status == "warn":
            penalty += cost // 2
        checks.append(
            {"id": check_id, "label": labels[check_id], "status": status, "detail": detail}
        )

    if words < 80:
        add(
            "text",
            "fail",
            "Very little text extracted: the CV may be an image/scan. ATS cannot read it."
            if en
            else "Très peu de texte extrait : le CV est peut-être une image/un scan illisible par les ATS.",
            35,
        )
    else:
        add("text", "ok", f"{words} words extracted." if en else f"{words} mots extraits.", 0)

    pages = int(layout.get("pages") or 0)
    if pages > 2:
        add(
            "pages",
            "warn",
            f"{pages} pages: aim for 1–2." if en else f"{pages} pages : visez 1 à 2 pages.",
            10,
        )
    else:
        add("pages", "ok", f"{pages or 1} page(s).", 0)

    ratio = float(layout.get("column_ratio") or 0)
    if ratio > 0.35:
        add(
            "columns",
            "fail",
            "Multi-column layout detected: many ATS read lines across columns and mix up content."
            if en
            else "Mise en page multi-colonnes détectée : beaucoup d'ATS lisent en travers et mélangent le contenu.",
            15,
        )
    elif ratio > 0.15:
        add(
            "columns",
            "warn",
            "Some lines look split into columns." if en else "Certaines lignes semblent découpées en colonnes.",
            15,
        )
    else:
        add("columns", "ok", "Single-column layout." if en else "Mise en page sur une colonne.", 0)

    tables = int(layout.get("tables") or 0)
    if tables:
        add(
            "tables",
            "warn",
            f"{tables} table(s) detected: prefer plain lists."
            if en
            else f"{tables} tableau(x) détecté(s) : préférez des listes simples.",
            10,
        )
    else:
        add("tables", "ok", "No tables." if en else "Aucun tableau.", 0)

    images = int(layout.get("images") or 0)
    if images > 1:
        add(
            "images",
            "warn",
            f"{images} images: skill bars, icons and logos are ignored by ATS."
            if en
            else f"{images} images : jauges, icônes et logos sont ignorés par les ATS.",
            8,
        )
    else:
        add(
            "images",
            "ok",
            "No problematic images." if en else "Pas d'images problématiques.",
            0,
        )

    missing_sections = [
        name for name, pattern in SECTION_PATTERNS.items() if not re.search(pattern, lower)
    ]
    if missing_sections:
        names_fr = {"experience": "Expérience", "education": "Formation", "skills": "Compétences"}
        names = ", ".join(s.title() if en else names_fr[s] for s in missing_sections)
        add(
            "sections",
            "fail" if len(missing_sections) > 1 else "warn",
            f"Missing standard headings: {names}." if en else f"Titres standard manquants : {names}.",
            15,
        )
    else:
        add(
            "sections",
            "ok",
            "Experience, Education and Skills headings found."
            if en
            else "Titres Expérience, Formation et Compétences présents.",
            0,
        )

    has_email = bool(EMAIL_RE.search(text))
    has_phone = bool(PHONE_RE.search(text))
    if has_email and has_phone:
        add("contact", "ok", "Email and phone found." if en else "Email et téléphone trouvés.", 0)
    else:
        missing = [
            label
            for label, ok in (("email", has_email), ("téléphone" if not en else "phone", has_phone))
            if not ok
        ]
        add(
            "contact",
            "fail" if not has_email else "warn",
            f"Not found in text: {', '.join(missing)}." if en else f"Introuvable dans le texte : {', '.join(missing)}.",
            10,
        )

    found = [s for s in required_skills if _has_keyword(s, lower)]
    missing_kw = [s for s in required_skills if s not in found]
    if required_skills:
        coverage = len(found) / len(required_skills)
        status = "ok" if coverage >= 0.7 else "warn" if coverage >= 0.4 else "fail"
        add(
            "keywords",
            status,
            f"{len(found)}/{len(required_skills)} keywords written exactly as in the offer."
            if en
            else f"{len(found)}/{len(required_skills)} mots-clés écrits exactement comme dans l'offre.",
            20,
        )

    if words > 1200:
        add(
            "length",
            "warn",
            "Very long CV: recruiters and ATS favor concise content."
            if en
            else "CV très long : recruteurs et ATS privilégient un contenu concis.",
            6,
        )
    elif words >= 80:
        add("length", "ok", "Appropriate length." if en else "Longueur appropriée.", 0)

    return {
        "score": max(0, 100 - penalty),
        "checks": checks,
        "keywords": {"found": found, "missing": missing_kw},
    }
