"""Skill synonym map and deterministic overlap scoring."""

from __future__ import annotations

import re
from typing import Iterable

# Canonical skill -> aliases (lowercase)
SKILL_SYNONYMS: dict[str, list[str]] = {
    "javascript": ["js", "ecmascript", "es6", "es2015"],
    "typescript": ["ts"],
    "python": ["py"],
    "postgresql": ["postgres", "psql", "postgre"],
    "mongodb": ["mongo"],
    "react": ["reactjs", "react.js"],
    "nodejs": ["node", "node.js"],
    "django": ["django rest", "drf"],
    "docker": ["containerisation", "containerization"],
    "kubernetes": ["k8s"],
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "microsoft azure": ["azure"],
    "ci/cd": ["cicd", "continuous integration", "continuous delivery"],
    "machine learning": ["ml", "apprentissage automatique"],
    "artificial intelligence": ["ai", "ia", "intelligence artificielle"],
    "sql": ["structured query language"],
    "html": ["html5"],
    "css": ["css3"],
    "git": ["github", "gitlab", "version control"],
    "rest api": ["rest", "restful", "api rest"],
    "agile": ["scrum", "kanban"],
    "java": ["jdk", "jvm"],
    "c++": ["cpp", "c plus plus"],
    "c#": ["csharp", "c sharp", ".net", "dotnet"],
}


def _build_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for canonical, aliases in SKILL_SYNONYMS.items():
        lookup[canonical.lower()] = canonical
        for alias in aliases:
            lookup[alias.lower()] = canonical
    return lookup


_LOOKUP = _build_lookup()


def normalize_skill(skill: str) -> str:
    cleaned = re.sub(r"\s+", " ", (skill or "").strip().lower())
    cleaned = cleaned.replace("_", " ")
    return _LOOKUP.get(cleaned, cleaned)


def canonicalize_skills(skills: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for skill in skills:
        if not skill or not str(skill).strip():
            continue
        norm = normalize_skill(str(skill))
        if norm not in seen:
            seen.add(norm)
            # Prefer title-ish display for known skills
            display = next(
                (k.title() if k.islower() else k for k, v in ((norm, norm),) if True),
                norm,
            )
            # Use canonical title casing for known keys
            for canonical in SKILL_SYNONYMS:
                if normalize_skill(canonical) == norm:
                    display = canonical.title() if canonical.islower() else canonical
                    # Special cases
                    specials = {
                        "javascript": "JavaScript",
                        "typescript": "TypeScript",
                        "postgresql": "PostgreSQL",
                        "mongodb": "MongoDB",
                        "nodejs": "Node.js",
                        "ci/cd": "CI/CD",
                        "html": "HTML",
                        "css": "CSS",
                        "sql": "SQL",
                        "aws": "AWS",
                        "rest api": "REST API",
                        "c++": "C++",
                        "c#": "C#",
                        "machine learning": "Machine Learning",
                        "artificial intelligence": "Artificial Intelligence",
                        "amazon web services": "AWS",
                        "google cloud platform": "GCP",
                        "microsoft azure": "Azure",
                    }
                    display = specials.get(canonical, display)
                    break
            result.append(display)
    return result


def skill_overlap_score(
    cv_skills: Iterable[str],
    required_skills: Iterable[str],
) -> tuple[float, list[str], list[str]]:
    """
    Return (score_0_100, present_skills, missing_skills).
    Score is |intersection| / |required| * 100 when required is non-empty.
    """
    cv_norm = {normalize_skill(s) for s in cv_skills if s}
    required_list = [s for s in required_skills if s]
    required_norm = [normalize_skill(s) for s in required_list]

    if not required_norm:
        present = canonicalize_skills(cv_norm)
        return 100.0, present, []

    present_norm: list[str] = []
    missing_norm: list[str] = []
    seen_present: set[str] = set()
    seen_missing: set[str] = set()

    for original, norm in zip(required_list, required_norm):
        if norm in cv_norm:
            if norm not in seen_present:
                present_norm.append(original)
                seen_present.add(norm)
        else:
            if norm not in seen_missing:
                missing_norm.append(original)
                seen_missing.add(norm)

    unique_required = len(set(required_norm))
    matched = len(seen_present)
    score = (matched / unique_required) * 100.0 if unique_required else 100.0
    return score, canonicalize_skills(present_norm), canonicalize_skills(missing_norm)
