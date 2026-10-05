"""Find live job offers matching a CV: AI search plan, multi-source fetch, local + AI ranking."""

from __future__ import annotations

import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.core.cache import caches

from services.ai_service import get_ai_service
from services.job_import_service import USER_AGENT, _html_to_text

logger = logging.getLogger(__name__)

AI_RANK_LIMIT = 20
DESCRIPTION_LIMIT = 8000

SOURCES = {
    "remotive": {"label": "Remotive", "url": "https://remotive.com", "needs_key": False},
    "arbeitnow": {"label": "Arbeitnow", "url": "https://www.arbeitnow.com", "needs_key": False},
    "jobicy": {"label": "Jobicy", "url": "https://jobicy.com", "needs_key": False},
    "adzuna": {"label": "Adzuna", "url": "https://www.adzuna.fr", "needs_key": True},
    "france_travail": {
        "label": "France Travail",
        "url": "https://candidat.francetravail.fr",
        "needs_key": True,
    },
}

REMOTE_GEO_OK = ("worldwide", "anywhere", "global", "europe", "emea", "eu", "remote")
STOPWORDS = {
    "de", "du", "des", "la", "le", "les", "et", "en", "a", "the", "of", "and", "for", "h", "f",
    "m", "w", "d", "x", "junior", "senior", "confirme", "confirmé", "stage", "stagiaire", "intern",
}
TOKEN_ALIASES = {
    "developer": "dev", "développeur": "dev", "developpeur": "dev", "développeuse": "dev",
    "engineer": "dev", "ingénieur": "dev", "ingenieur": "dev", "programmer": "dev",
    "software": "logiciel", "analyste": "analyst", "données": "data", "donnees": "data",
}
COMPOUNDS = {
    "fullstack": "full stack", "full-stack": "full stack", "frontend": "front end",
    "front-end": "front end", "backend": "back end", "back-end": "back end", "devops": "dev ops",
}


class JobSearchError(Exception):
    pass


# --- Source configuration ---------------------------------------------------


def _enabled(source: str) -> bool:
    if source == "adzuna":
        return bool(settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY)
    if source == "france_travail":
        return bool(settings.FRANCE_TRAVAIL_CLIENT_ID and settings.FRANCE_TRAVAIL_CLIENT_SECRET)
    return source in settings.JOB_SEARCH_SOURCES


def available_sources() -> list[dict]:
    return [{"id": sid, **meta, "enabled": _enabled(sid)} for sid, meta in SOURCES.items()]


# --- HTTP helpers -------------------------------------------------------------


def _http_get(url: str, *, params=None, headers=None, timeout: float = 20.0):
    import httpx

    response = httpx.get(
        url,
        params=params,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})},
        timeout=timeout,
        follow_redirects=True,
    )
    response.raise_for_status()
    return response.json()


def _cached(key: str, ttl: int, fetch):
    cache = caches["jobs"]
    data = cache.get(key)
    if data is None:
        data = fetch()
        cache.set(key, data, ttl)
    return data


def _as_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v]
    if isinstance(value, str) and value.strip():
        return [value]
    return []


def _iso(value) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)) or str(value).isdigit():
        return datetime.fromtimestamp(int(value), tz=dt_timezone.utc).isoformat()
    return str(value)


def _listing(source: str, external_id, **fields) -> dict:
    description = fields.get("description") or ""
    if "<" in description:
        description = _html_to_text(description)
    return {
        "id": f"{source}:{external_id}",
        "source": source,
        "title": (fields.get("title") or "").strip()[:255],
        "company": (fields.get("company") or "").strip()[:255],
        "location": (fields.get("location") or "").strip()[:255],
        "remote": bool(fields.get("remote")),
        "url": fields.get("url") or "",
        "description": description[:DESCRIPTION_LIMIT],
        "published_at": _iso(fields.get("published_at")),
        "tags": _as_list(fields.get("tags"))[:12],
        "salary": str(fields.get("salary") or "")[:120],
        "contract": ", ".join(_as_list(fields.get("contract")))[:120],
    }


# --- Fetchers (feed sources ignore the query; keyed sources search with it) ----


def fetch_remotive(queries: list[str], location: str) -> list[dict]:
    data = _cached(
        "remotive:all",
        6 * 3600,
        lambda: _http_get("https://remotive.com/api/remote-jobs").get("jobs", []),
    )
    return [
        _listing(
            "remotive",
            j.get("id"),
            title=j.get("title"),
            company=j.get("company_name"),
            location=j.get("candidate_required_location") or "Remote",
            remote=True,
            url=j.get("url"),
            description=j.get("description"),
            published_at=j.get("publication_date"),
            tags=j.get("tags"),
            salary=j.get("salary"),
            contract=j.get("job_type"),
        )
        for j in data
    ]


def fetch_arbeitnow(queries: list[str], location: str) -> list[dict]:
    data = _cached(
        "arbeitnow:p1",
        3600,
        lambda: _http_get("https://www.arbeitnow.com/api/job-board-api").get("data", []),
    )
    return [
        _listing(
            "arbeitnow",
            j.get("slug"),
            title=j.get("title"),
            company=j.get("company_name"),
            location=j.get("location"),
            remote=j.get("remote") in (True, "true", "True", 1),
            url=j.get("url"),
            description=j.get("description"),
            published_at=j.get("created_at"),
            tags=j.get("tags"),
            contract=j.get("job_types"),
        )
        for j in data
    ]


def fetch_jobicy(queries: list[str], location: str) -> list[dict]:
    data = _cached(
        "jobicy:100",
        3600,
        lambda: _http_get("https://jobicy.com/api/v2/remote-jobs", params={"count": 100}).get(
            "jobs", []
        ),
    )
    return [
        _listing(
            "jobicy",
            j.get("id"),
            title=j.get("jobTitle"),
            company=j.get("companyName"),
            location=j.get("jobGeo") or "Remote",
            remote=True,
            url=j.get("url"),
            description=j.get("jobDescription") or j.get("jobExcerpt"),
            published_at=j.get("pubDate"),
            tags=j.get("jobIndustry"),
            contract=j.get("jobType"),
        )
        for j in data
    ]


def fetch_adzuna(queries: list[str], location: str) -> list[dict]:
    results: list[dict] = []
    for query in queries[:2]:
        params = {
            "app_id": settings.ADZUNA_APP_ID,
            "app_key": settings.ADZUNA_APP_KEY,
            "what": query,
            "results_per_page": 50,
            "content-type": "application/json",
        }
        if location:
            params["where"] = location
        url = f"https://api.adzuna.com/v1/api/jobs/{settings.ADZUNA_COUNTRY}/search/1"
        data = _cached(
            f"adzuna:{settings.ADZUNA_COUNTRY}:{query.lower()}:{location.lower()}",
            3600,
            lambda url=url, params=params: _http_get(url, params=params).get("results", []),
        )
        for j in data:
            results.append(
                _listing(
                    "adzuna",
                    j.get("id"),
                    title=j.get("title"),
                    company=(j.get("company") or {}).get("display_name"),
                    location=(j.get("location") or {}).get("display_name"),
                    url=j.get("redirect_url"),
                    description=j.get("description"),
                    published_at=j.get("created"),
                    contract=j.get("contract_type"),
                )
            )
    return results


def _france_travail_token() -> str:
    import httpx

    def fetch():
        response = httpx.post(
            "https://entreprise.francetravail.fr/connexion/oauth2/access_token",
            params={"realm": "/partenaire"},
            data={
                "grant_type": "client_credentials",
                "client_id": settings.FRANCE_TRAVAIL_CLIENT_ID,
                "client_secret": settings.FRANCE_TRAVAIL_CLIENT_SECRET,
                "scope": "api_offresdemploiv2 o2dsoffre",
            },
            timeout=20.0,
        )
        response.raise_for_status()
        return response.json()["access_token"]

    return _cached("france_travail:token", 1200, fetch)


def fetch_france_travail(queries: list[str], location: str) -> list[dict]:
    token = _france_travail_token()
    results: list[dict] = []
    for query in queries[:2]:
        words = [w for w in re.split(r"[^\w+#.-]+", query) if len(w) >= 2][:3]
        if not words:
            continue
        keywords = ",".join(words)
        data = _cached(
            f"france_travail:{keywords.lower()}",
            3600,
            lambda keywords=keywords: _http_get(
                "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search",
                params={"motsCles": keywords, "range": "0-49"},
                headers={"Authorization": f"Bearer {token}"},
            ).get("resultats", []),
        )
        for j in data:
            origin = (j.get("origineOffre") or {}).get("urlOrigine") or (
                f"https://candidat.francetravail.fr/offres/recherche/detail/{j.get('id')}"
            )
            results.append(
                _listing(
                    "france_travail",
                    j.get("id"),
                    title=j.get("intitule"),
                    company=(j.get("entreprise") or {}).get("nom"),
                    location=(j.get("lieuTravail") or {}).get("libelle"),
                    url=origin,
                    description=j.get("description"),
                    published_at=j.get("dateCreation"),
                    salary=(j.get("salaire") or {}).get("libelle"),
                    contract=j.get("typeContratLibelle"),
                )
            )
    return results


FETCHERS = {
    "remotive": fetch_remotive,
    "arbeitnow": fetch_arbeitnow,
    "jobicy": fetch_jobicy,
    "adzuna": fetch_adzuna,
    "france_travail": fetch_france_travail,
}


def collect_listings(
    queries: list[str], location: str = "", sources: list[str] | None = None
) -> tuple[list[dict], dict]:
    """Fetch all enabled sources in parallel; returns (deduplicated listings, per-source stats)."""
    selected = [s for s in (sources or FETCHERS) if s in FETCHERS and _enabled(s)]
    if not selected:
        raise JobSearchError("Aucune source d'offres n'est activée.")

    def run(source: str):
        try:
            return source, FETCHERS[source](queries, location), ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("Job source %s failed: %s", source, exc)
            return source, [], str(exc)[:200]

    with ThreadPoolExecutor(max_workers=len(selected)) as pool:
        outcomes = list(pool.map(run, selected))

    stats: dict[str, dict] = {}
    seen: set[tuple[str, str]] = set()
    listings: list[dict] = []
    for source, items, error in outcomes:
        stats[source] = {"count": len(items), "error": error}
        for item in items:
            key = (_dedupe_key(item["title"]), _dedupe_key(item["company"]))
            if not item["title"] or not item["url"] or key in seen:
                continue
            seen.add(key)
            listings.append(item)
    return listings, stats


# --- Filtering & local scoring ----------------------------------------------------


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _dedupe_key(text: str) -> str:
    return re.sub(r"\W+", "", (text or "").lower())


def _tokens(text: str) -> set[str]:
    text = _norm(text)
    for compound, expanded in COMPOUNDS.items():
        text = text.replace(compound, expanded)
    tokens = set()
    for raw in re.split(r"[^\w+#]+", text):
        if len(raw) < 2 or raw in STOPWORDS:
            continue
        tokens.add(TOKEN_ALIASES.get(raw, raw))
    return tokens


def location_matches(listing: dict, location: str, remote_only: bool) -> bool:
    if remote_only and not listing["remote"]:
        return False
    if not location:
        return True
    wanted = _norm(location)
    where = _norm(listing["location"])
    if wanted in where:
        return True
    if listing["remote"]:
        return not where or any(word in where for word in REMOTE_GEO_OK)
    return False


def skill_in_text(skill: str, text: str) -> bool:
    skill = _norm(skill)
    if len(skill) < 2:
        return False
    return re.search(rf"(?<![\w+#]){re.escape(skill)}(?![\w+#])", text) is not None


def title_similarity(title: str, targets: list[str]) -> float:
    have = _tokens(title)
    best = 0.0
    for target in targets:
        want = _tokens(target)
        if want:
            best = max(best, len(want & have) / len(want))
    return best


def score_listing(listing: dict, skills: list[str], targets: list[str]) -> tuple[int, list[str]]:
    haystack = _norm(" ".join([listing["title"], " ".join(listing["tags"]), listing["description"]]))
    matched = [s for s in skills if skill_in_text(s, haystack)]
    skill_ratio = min(1.0, len(matched) / max(3, min(len(skills), 8))) if skills else 0.0
    title_score = title_similarity(listing["title"], targets)
    return round(100 * (0.65 * skill_ratio + 0.35 * title_score)), matched


# --- Public showcase (landing page) ---------------------------------------------

FEATURED_QUERIES = ["développeur", "data analyst"]
TECH_TOKENS = {
    "dev", "data", "logiciel", "web", "full", "front", "back", "ops", "cloud", "python", "java",
    "javascript", "react", "php", "sql", "it", "si", "qa", "test", "mobile", "android", "ios",
    "machine", "ai", "ia", "cyber", "security", "sécurité", "réseau", "network", "système",
    "systems", "analyst", "product", "ux", "ui", "tech", "technicien", "informatique",
}


def _round_robin(groups: dict[str, list[dict]], limit: int) -> list[dict]:
    picked: list[dict] = []
    queues = [list(items) for items in groups.values() if items]
    while queues and len(picked) < limit:
        for queue in list(queues):
            picked.append(queue.pop(0))
            if not queue:
                queues.remove(queue)
            if len(picked) >= limit:
                break
    return picked


def featured_jobs(limit: int = 9) -> dict:
    """Recent tech offers spread across sources, cached so anonymous visits never hit the APIs."""

    def build() -> dict:
        try:
            listings, stats = collect_listings(FEATURED_QUERIES)
        except JobSearchError:
            listings, stats = [], {}
        groups: dict[str, list[dict]] = {}
        for item in listings:
            if _tokens(item["title"]) & TECH_TOKENS:
                groups.setdefault(item["source"], []).append(item)
        for items in groups.values():
            items.sort(key=lambda i: i["published_at"], reverse=True)
        priority = ["france_travail", "adzuna", "remotive", "jobicy", "arbeitnow"]
        groups = dict(sorted(groups.items(), key=lambda kv: priority.index(kv[0]) if kv[0] in priority else 99))
        offers = [
            {
                **{k: item[k] for k in ("id", "source", "title", "company", "location", "remote", "url", "published_at", "contract")},
                "excerpt": item["description"][:180],
            }
            for item in _round_robin(groups, limit)
        ]
        sources = [
            {**s, "count": stats.get(s["id"], {}).get("count", 0)}
            for s in available_sources()
            if s["enabled"]
        ]
        return {"offers": offers, "sources": sources, "total": len(listings)}

    return _cached(f"featured:v2:{limit}", 1800, build)


# --- Orchestration ----------------------------------------------------------------


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out = []
    for value in values:
        key = _norm(value)
        if key and key not in seen:
            seen.add(key)
            out.append(value.strip())
    return out


def find_matching_jobs(
    *,
    cv,
    level: str,
    target_role: str = "",
    location: str = "",
    remote_only: bool = False,
    custom_query: str = "",
    language: str = "fr",
    sources: list[str] | None = None,
) -> dict:
    started = time.monotonic()
    ai = get_ai_service()
    if not cv.parsed_data and cv.extracted_text:
        cv.parsed_data = ai.extract_cv_skills(cv.extracted_text).model_dump()
        cv.save(update_fields=["parsed_data"])
    cv_skills = list((cv.parsed_data or {}).get("technical_skills") or [])

    plan = ai.plan_job_search(cv.extracted_text, cv_skills, level, target_role, language)
    targets = _dedupe(
        [q for q in custom_query.split(",") if q.strip()] + plan.target_titles
    ) or ["Developer"]
    skills = _dedupe(plan.keywords + cv_skills)[:15]

    listings, stats = collect_listings(targets, location, sources)
    filtered = [item for item in listings if location_matches(item, location, remote_only)]

    candidates = []
    for item in filtered:
        local, matched = score_listing(item, skills, targets)
        if matched or local >= 20:
            candidates.append({**item, "local_score": local, "matched_skills": matched})
    candidates.sort(key=lambda c: c["local_score"], reverse=True)
    top = candidates[:AI_RANK_LIMIT]

    ranking = ai.rank_job_matches(
        cv.extracted_text,
        [
            {
                "index": i,
                "title": c["title"],
                "company": c["company"],
                "location": c["location"],
                "excerpt": c["description"][:600],
                "local_score": c["local_score"],
                "matched_skills": c["matched_skills"],
            }
            for i, c in enumerate(top)
        ],
        level,
        language,
    )
    by_index = {m.index: m for m in ranking.matches}

    results = []
    for i, c in enumerate(top):
        match = by_index.get(i)
        results.append(
            {
                **c,
                "score": match.score if match else c["local_score"],
                "reason": match.reason if match else "",
                "matching_skills": (match.matching_skills if match else []) or c["matched_skills"][:5],
                "missing_skills": match.missing_skills if match else [],
            }
        )
    results.sort(key=lambda r: (r["score"], r["local_score"]), reverse=True)

    return {
        "plan": {**plan.model_dump(), "target_titles": targets, "keywords": skills},
        "results": results,
        "stats": {
            "fetched": len(listings),
            "after_filters": len(filtered),
            "candidates": len(candidates),
            "sources": stats,
            "duration_s": round(time.monotonic() - started, 1),
        },
        "ai_mode": ai.mode,
    }
