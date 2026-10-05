"""Provider-agnostic LLM service with Pydantic validation and mock fallback."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from typing import Any, Literal

from django.conf import settings
from pydantic import BaseModel, Field, ValidationError, field_validator

logger = logging.getLogger(__name__)

LevelType = Literal["etudiant", "junior", "confirme"]
ToneType = Literal["formal", "dynamic", "concise"]
LanguageType = Literal["fr", "en"]

GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"


class CVParsedData(BaseModel):
    technical_skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    experience_years: float = 0
    projects: list[str] = Field(default_factory=list)

    @field_validator("experience_years", mode="before")
    @classmethod
    def coerce_years(cls, value: Any) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0


class JobParsedData(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    nice_to_have_skills: list[str] = Field(default_factory=list)
    seniority: str = "junior"
    responsibilities: list[str] = Field(default_factory=list)
    title: str = ""
    company: str = ""


class SemanticEvaluation(BaseModel):
    semantic_score: int = Field(ge=0, le=100)
    rationale: str = ""
    experience_fit: str = ""
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)

    @field_validator("semantic_score", mode="before")
    @classmethod
    def clamp_score(cls, value: Any) -> int:
        try:
            score = int(round(float(value)))
        except (TypeError, ValueError):
            score = 50
        return max(0, min(100, score))


class RecommendationsResult(BaseModel):
    recommandations: list[str] = Field(default_factory=list)
    detailed_improvements: list[str] = Field(default_factory=list)


class CoverLetterResult(BaseModel):
    content: str


class InterviewQuestion(BaseModel):
    question: str
    category: str = "technique"
    why: str = ""
    answer_tips: str = ""


class InterviewPrepResult(BaseModel):
    questions: list[InterviewQuestion] = Field(default_factory=list)


class RewriteItem(BaseModel):
    section: str = "Expérience"
    before: str = ""
    after: str
    reason: str = ""


class CVRewriteResult(BaseModel):
    items: list[RewriteItem] = Field(default_factory=list)


class LearningResource(BaseModel):
    title: str
    url: str = ""
    kind: str = "cours"


class LearningStep(BaseModel):
    skill: str
    priority: Literal["haute", "moyenne", "basse"] = "moyenne"
    estimated_weeks: float = 2
    resources: list[LearningResource] = Field(default_factory=list)
    project_idea: str = ""

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: Any) -> str:
        mapping = {"high": "haute", "medium": "moyenne", "low": "basse"}
        value = str(value or "moyenne").lower()
        value = mapping.get(value, value)
        return value if value in ("haute", "moyenne", "basse") else "moyenne"

    @field_validator("estimated_weeks", mode="before")
    @classmethod
    def coerce_weeks(cls, value: Any) -> float:
        try:
            return max(0.5, float(value))
        except (TypeError, ValueError):
            return 2.0


class LearningPlanResult(BaseModel):
    steps: list[LearningStep] = Field(default_factory=list)


class JobSearchPlan(BaseModel):
    target_titles: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    seniority: str = "junior"
    summary: str = ""


class JobMatch(BaseModel):
    index: int
    score: int = 0
    reason: str = ""
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)

    @field_validator("score", mode="before")
    @classmethod
    def clamp_score(cls, value: Any) -> int:
        try:
            score = int(round(float(value)))
        except (TypeError, ValueError):
            score = 0
        return max(0, min(100, score))


class JobMatchRanking(BaseModel):
    matches: list[JobMatch] = Field(default_factory=list)


LEVEL_PROMPTS = {
    "etudiant": (
        "Le candidat est ÉTUDIANT. Mets en avant les projets académiques, "
        "stages, certifications et le potentiel d'apprentissage. "
        "L'expérience professionnelle pèse moins dans l'évaluation."
    ),
    "junior": (
        "Le candidat est JUNIOR. Mets en avant les réalisations concrètes, "
        "outils maîtrisés et le travail en équipe."
    ),
    "confirme": (
        "Le candidat est CONFIRMÉ. Mets en avant l'impact, le leadership, "
        "les décisions d'architecture et les résultats mesurables."
    ),
}

TONE_PROMPTS = {
    "formal": "Ton formel, professionnel et respectueux.",
    "dynamic": "Ton dynamique, enthousiaste et motivé.",
    "concise": "Ton concis, direct, sans fioritures (max 250 mots).",
}

LANGUAGE_PROMPTS = {
    "fr": "Rédige tout le contenu textuel en français.",
    "en": "Write all textual content in English.",
}


def _language_hint(language: str) -> str:
    return LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["fr"])


def _extract_json_object(text: str) -> dict[str, Any]:
    """Parse JSON from model output, tolerating markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("No JSON object found in LLM response")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("LLM JSON root is not an object")
    return data


class AIService:
    """Calls an LLM API or falls back to deterministic mock responses."""

    def __init__(self) -> None:
        self.provider = (settings.LLM_PROVIDER or "anthropic").lower()
        self.api_key = settings.LLM_API_KEY or ""
        self.model = settings.LLM_MODEL
        self.max_retries = settings.LLM_MAX_RETRIES
        self.live_calls = 0
        self.mock_calls = 0
        self.cache_hits = 0
        self.forced_mock = _site_forces_mock()

    @property
    def use_mock(self) -> bool:
        return self.forced_mock or not bool(self.api_key.strip())

    @property
    def mode(self) -> str:
        """'live' if every call hit the LLM, 'mock' if none did, else 'mixed'."""
        if self.mock_calls == 0:
            return "live"
        if self.live_calls == 0 and self.cache_hits == 0:
            return "mock"
        return "mixed"

    def extract_cv_skills(self, cv_text: str) -> CVParsedData:
        schema_hint = CVParsedData.model_json_schema()
        prompt = (
            "Extrais du CV les informations suivantes en JSON strict. "
            "Réponds UNIQUEMENT avec un objet JSON valide.\n"
            f"Schéma attendu: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:12000]}"
        )
        return self._call_validated(
            prompt,
            CVParsedData,
            mock_fn=lambda: self._mock_cv(cv_text),
            cache_kind="cv",
        )

    def analyze_job_offer(self, job_text: str) -> JobParsedData:
        schema_hint = JobParsedData.model_json_schema()
        prompt = (
            "Analyse cette offre d'emploi et extrais les compétences et infos "
            "en JSON strict. Réponds UNIQUEMENT avec un objet JSON valide.\n"
            f"Schéma attendu: {json.dumps(schema_hint)}\n\n"
            f"Offre:\n{job_text[:12000]}"
        )
        return self._call_validated(
            prompt,
            JobParsedData,
            mock_fn=lambda: self._mock_job(job_text),
            cache_kind="job",
        )

    def evaluate_semantic_fit(
        self,
        cv_text: str,
        job_text: str,
        level: LevelType,
        present_skills: list[str],
        missing_skills: list[str],
    ) -> SemanticEvaluation:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = SemanticEvaluation.model_json_schema()
        prompt = (
            "Évalue la compatibilité sémantique entre le CV et l'offre (0-100). "
            "Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n"
            f"Compétences présentes: {present_skills}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV (extrait):\n{cv_text[:6000]}\n\n"
            f"Offre (extrait):\n{job_text[:6000]}"
        )
        return self._call_validated(
            prompt,
            SemanticEvaluation,
            mock_fn=lambda: self._mock_semantic(present_skills, missing_skills, level),
        )

    def generate_recommendations(
        self,
        cv_text: str,
        job_text: str,
        level: LevelType,
        missing_skills: list[str],
        detailed: bool = False,
        language: LanguageType = "fr",
    ) -> RecommendationsResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = RecommendationsResult.model_json_schema()
        detail = (
            "Fournis aussi detailed_improvements avec des réécritures concrètes de sections CV."
            if detailed
            else "Focus sur recommandations actionnables (3 à 6 items)."
        )
        prompt = (
            "Propose des recommandations d'amélioration du CV pour cette offre. "
            "Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{detail}\n{_language_hint(language)}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:5000]}\n\nOffre:\n{job_text[:5000]}"
        )
        return self._call_validated(
            prompt,
            RecommendationsResult,
            mock_fn=lambda: self._mock_recommendations(missing_skills, level, detailed, language),
        )

    def generate_cover_letter(
        self,
        cv_text: str,
        job_text: str,
        level: LevelType,
        tone: ToneType,
        candidate_name: str = "",
        job_title: str = "",
        company: str = "",
        language: LanguageType = "fr",
    ) -> CoverLetterResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        tone_hint = TONE_PROMPTS.get(tone, TONE_PROMPTS["formal"])
        schema_hint = CoverLetterResult.model_json_schema()
        prompt = (
            "Rédige une lettre de motivation personnalisée. "
            "Réponds UNIQUEMENT en JSON strict avec la clé content.\n"
            f"{level_hint}\n{tone_hint}\n{_language_hint(language)}\n"
            f"Candidat: {candidate_name or 'le candidat'}\n"
            f"Poste: {job_title or 'le poste'}\n"
            f"Entreprise: {company or "l'entreprise"}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:5000]}\n\nOffre:\n{job_text[:5000]}"
        )
        return self._call_validated(
            prompt,
            CoverLetterResult,
            mock_fn=lambda: self._mock_cover_letter(
                candidate_name, job_title, company, level, tone, language
            ),
        )

    def generate_interview_prep(
        self,
        cv_text: str,
        job_text: str,
        level: LevelType,
        missing_skills: list[str],
        language: LanguageType = "fr",
    ) -> InterviewPrepResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = InterviewPrepResult.model_json_schema()
        prompt = (
            "Prépare le candidat à l'entretien pour cette offre. Génère 8 à 10 questions "
            "probables (catégories: technique, comportementale, motivation, lacune). "
            "Pour chaque question: pourquoi le recruteur la pose (why) et des pistes de "
            "réponse s'appuyant sur des éléments RÉELS du CV (answer_tips). "
            "Inclue au moins une question par compétence manquante. "
            "Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{_language_hint(language)}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:5000]}\n\nOffre:\n{job_text[:5000]}"
        )
        return self._call_validated(
            prompt,
            InterviewPrepResult,
            mock_fn=lambda: self._mock_interview(missing_skills, level, language),
        )

    def rewrite_cv(
        self,
        cv_text: str,
        job_text: str,
        level: LevelType,
        missing_skills: list[str],
        language: LanguageType = "fr",
    ) -> CVRewriteResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = CVRewriteResult.model_json_schema()
        prompt = (
            "Sélectionne 4 à 8 phrases/puces du CV qui gagneraient à être réécrites pour "
            "cette offre. Pour chacune: section, before (texte EXACT du CV), after (version "
            "réécrite: verbe d'action, résultat mesurable, mots-clés de l'offre, sans "
            "inventer de faits), reason. Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{_language_hint(language)}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:6000]}\n\nOffre:\n{job_text[:4000]}"
        )
        return self._call_validated(
            prompt,
            CVRewriteResult,
            mock_fn=lambda: self._mock_rewrite(cv_text, missing_skills, language),
        )

    def generate_learning_plan(
        self,
        missing_skills: list[str],
        level: LevelType,
        job_title: str = "",
        language: LanguageType = "fr",
    ) -> LearningPlanResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = LearningPlanResult.model_json_schema()
        prompt = (
            "Construis un plan d'apprentissage pour combler ces compétences manquantes. "
            "Pour chaque compétence: priority (haute/moyenne/basse), estimated_weeks, "
            "2 à 3 resources (documentation officielle ou plateformes reconnues, URLs "
            "réelles uniquement), project_idea (mini-projet démontrable sur un CV). "
            "Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{_language_hint(language)}\n"
            f"Poste visé: {job_title or 'non précisé'}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}"
        )
        return self._call_validated(
            prompt,
            LearningPlanResult,
            mock_fn=lambda: self._mock_learning_plan(missing_skills, level, language),
        )

    def plan_job_search(
        self,
        cv_text: str,
        skills: list[str],
        level: LevelType,
        target_role: str = "",
        language: LanguageType = "fr",
    ) -> JobSearchPlan:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = JobSearchPlan.model_json_schema()
        prompt = (
            "Tu prépares une recherche d'offres d'emploi pour ce candidat. Déduis du CV: "
            "target_titles (3 à 5 intitulés de poste courts et réalistes, en anglais ET en "
            "français, ex. 'Full Stack Developer', 'Développeur Full-Stack'), keywords (6 à 10 "
            "compétences techniques les plus recherchées du CV, telles qu'écrites dans les "
            "offres), seniority (etudiant/junior/confirme) et summary (une phrase décrivant le "
            "profil). Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{_language_hint(language)}\n"
            f"Poste visé déclaré: {target_role or 'non précisé'}\n"
            f"Compétences détectées: {skills[:25]}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:6000]}"
        )
        return self._call_validated(
            prompt,
            JobSearchPlan,
            mock_fn=lambda: self._mock_job_plan(skills, level, target_role, language),
            cache_kind="job_plan",
        )

    def rank_job_matches(
        self,
        cv_text: str,
        offers: list[dict],
        level: LevelType,
        language: LanguageType = "fr",
    ) -> JobMatchRanking:
        """Score each offer; ``offers`` items carry index, title, company, location, excerpt."""
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        schema_hint = JobMatchRanking.model_json_schema()
        compact = [
            {k: o.get(k, "") for k in ("index", "title", "company", "location", "excerpt")}
            for o in offers
        ]
        prompt = (
            "Évalue l'adéquation entre le CV et CHAQUE offre ci-dessous (score 0-100: "
            "compétences, séniorité, domaine, type de poste). Sois exigeant: une offre hors "
            "métier du candidat doit être sous 30. Pour chaque offre renvoie index (identique "
            "à l'entrée), score, reason (une phrase concrète), matching_skills et "
            "missing_skills (5 max chacun). Réponds UNIQUEMENT en JSON strict.\n"
            f"{level_hint}\n{_language_hint(language)}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:4000]}\n\n"
            f"Offres:\n{json.dumps(compact, ensure_ascii=False)}"
        )
        return self._call_validated(
            prompt,
            JobMatchRanking,
            mock_fn=lambda: self._mock_rank(offers, language),
        )

    def _call_validated(
        self,
        prompt: str,
        model_cls: type[BaseModel],
        mock_fn,
        cache_kind: str | None = None,
    ) -> BaseModel:
        if self.use_mock:
            logger.info("LLM_API_KEY empty – using mock AI responses")
            self.mock_calls += 1
            return mock_fn()

        cache_key = None
        if cache_kind:
            cache_key = hashlib.sha256(
                f"{self.provider}|{self.model}|{prompt}".encode("utf-8")
            ).hexdigest()
            cached = _cache_get(cache_key)
            if cached is not None:
                try:
                    result = model_cls.model_validate(cached)
                    self.cache_hits += 1
                    return result
                except ValidationError:
                    pass

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                raw = self._invoke_llm(prompt if attempt == 1 else (
                    prompt
                    + "\n\nIMPORTANT: Your previous answer was invalid JSON. "
                    "Reply with ONLY a valid JSON object, no markdown."
                ))
                data = _extract_json_object(raw)
                result = model_cls.model_validate(data)
                self.live_calls += 1
                if cache_key:
                    _cache_set(cache_key, cache_kind, result.model_dump())
                return result
            except (ValidationError, ValueError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("LLM JSON validation failed (attempt %s): %s", attempt, exc)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.warning("LLM call failed (attempt %s): %s", attempt, exc)
                if attempt < self.max_retries:
                    time.sleep(2 ** attempt)

        logger.error("Falling back to mock after LLM failures: %s", last_error)
        self.mock_calls += 1
        return mock_fn()

    def _invoke_llm(self, prompt: str) -> str:
        if self.provider in ("anthropic", "claude"):
            return self._invoke_anthropic(prompt)
        if self.provider in ("openai", "compatible"):
            return self._invoke_openai_compatible(prompt)
        if self.provider in ("gemini", "google"):
            return self._invoke_openai_compatible(
                prompt, default_base_url=GEMINI_OPENAI_BASE_URL
            )
        raise ValueError(f"Unsupported LLM_PROVIDER: {self.provider}")

    def _invoke_anthropic(self, prompt: str) -> str:
        import anthropic

        client = anthropic.Anthropic(api_key=self.api_key)
        message = client.messages.create(
            model=self.model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        parts = []
        for block in message.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts)

    def _invoke_openai_compatible(
        self, prompt: str, default_base_url: str = "https://api.openai.com/v1"
    ) -> str:
        import httpx

        base_url = getattr(settings, "LLM_BASE_URL", "") or default_base_url
        response = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            timeout=90.0,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["choices"][0]["message"]["content"]

    # --- Mock helpers (deterministic, keyword-based) ---

    def _mock_cv(self, cv_text: str | None = None) -> CVParsedData:
        text = (cv_text or "").lower()
        catalog = [
            "Python", "Django", "JavaScript", "TypeScript", "React", "SQL",
            "PostgreSQL", "Docker", "Git", "REST API", "Linux", "HTML", "CSS",
            "Node.js", "Machine Learning", "Agile", "Java", "AWS",
        ]
        found = [
            s
            for s in catalog
            if re.search(rf"(?<![a-z]){re.escape(s.lower())}(?![a-z])", text)
        ]
        if not found:
            found = ["Python", "Django", "SQL", "Git"]
        soft = [s for s in ["Communication", "Travail en équipe", "Autonomie", "Curiosité"] if s.lower() in text]
        if not soft:
            soft = ["Travail en équipe", "Autonomie"]
        years = 0.0
        m = re.search(r"(\d+)\s*(?:ans|années|years)", text)
        if m:
            years = float(m.group(1))
        return CVParsedData(
            technical_skills=found,
            soft_skills=soft,
            languages=["Français", "Anglais"] if "anglais" in text or "english" in text else ["Français"],
            education=["Formation mentionnée dans le CV"] if text else [],
            experience_years=years,
            projects=["Projet détecté dans le CV"] if "projet" in text else [],
        )

    def _mock_job(self, job_text: str) -> JobParsedData:
        text = job_text.lower()
        catalog = [
            "Python", "Django", "JavaScript", "TypeScript", "React", "SQL",
            "PostgreSQL", "Docker", "Kubernetes", "Git", "REST API", "AWS",
            "Linux", "CI/CD", "Agile", "Machine Learning", "Node.js",
        ]
        required = [s for s in catalog if s.lower() in text]
        if not required:
            required = ["Python", "Django", "SQL", "Docker"]
        nice = [s for s in ["Kubernetes", "AWS", "TypeScript", "CI/CD"] if s not in required and s.lower() in text]
        if not nice:
            nice = ["Kubernetes", "AWS"]
        seniority = "junior"
        if any(w in text for w in ("senior", "confirmé", "confirme", "lead")):
            seniority = "confirme"
        elif any(w in text for w in ("stage", "alternance", "étudiant", "etudiant", "internship")):
            seniority = "etudiant"
        title_match = re.search(r"(?:poste|titre)\s*[:\-]\s*(.+)", job_text, re.I)
        company_match = re.search(r"(?:entreprise|société|company)\s*[:\-]\s*(.+)", job_text, re.I)
        return JobParsedData(
            required_skills=required[:8],
            nice_to_have_skills=nice[:5],
            seniority=seniority,
            responsibilities=["Développer des fonctionnalités", "Collaborer avec l'équipe", "Assurer la qualité du code"],
            title=(title_match.group(1).strip()[:120] if title_match else ""),
            company=(company_match.group(1).strip()[:120] if company_match else ""),
        )

    def _mock_semantic(
        self,
        present: list[str],
        missing: list[str],
        level: str,
    ) -> SemanticEvaluation:
        total = len(present) + len(missing) or 1
        base = int(100 * len(present) / total)
        if level == "etudiant":
            base = min(100, base + 8)
        elif level == "confirme":
            base = max(0, base - 5)
        return SemanticEvaluation(
            semantic_score=base,
            rationale="Évaluation mock basée sur le recouvrement des compétences.",
            experience_fit="Correspondance estimée sans clé API LLM.",
            strengths=present[:5],
            gaps=missing[:5],
        )

    def _mock_recommendations(
        self,
        missing: list[str],
        level: str,
        detailed: bool,
        language: str = "fr",
    ) -> RecommendationsResult:
        if language == "en":
            recs_en = [
                f"Add a concrete project or experience demonstrating {skill}."
                for skill in missing[:5]
            ] or [
                "Add project examples related to the position.",
                "Quantify your achievements with measurable results.",
                "Highlight your team contributions.",
            ]
            details_en = (
                [
                    "Experience: start each bullet with an action verb and a measurable result.",
                    "Skills: group technical / soft / tools and align them with the offer.",
                    "Add a Projects section with stack, role and outcome.",
                ]
                if detailed
                else []
            )
            return RecommendationsResult(recommandations=recs_en, detailed_improvements=details_en)

        recs: list[str] = []
        for skill in missing[:5]:
            if level == "etudiant":
                recs.append(
                    f"Ajoutez un projet académique ou un mini-projet démontrant {skill}."
                )
            elif level == "confirme":
                recs.append(
                    f"Quantifiez l'impact de votre usage de {skill} (métriques, décisions techniques)."
                )
            else:
                recs.append(
                    f"Mentionnez votre expérience concrète avec {skill} et les outils associés."
                )
        if not recs:
            recs = [
                "Ajoutez des exemples de projets liés au poste.",
                "Mentionnez l'expérience avec les bases de données.",
                "Précisez vos contributions en équipe.",
            ]
        details = []
        if detailed:
            details = [
                "Section Expérience : commencez chaque puce par un verbe d'action et un résultat mesurable.",
                "Section Compétences : regroupez technique / soft / outils et alignez-les sur l'offre.",
                "Ajoutez une section Projets avec stack, rôle et résultat.",
            ] + [f"Intégrez une preuve concrète de maîtrise de {s}." for s in missing[:3]]
        return RecommendationsResult(recommandations=recs, detailed_improvements=details)

    def _mock_cover_letter(
        self,
        name: str,
        title: str,
        company: str,
        level: str,
        tone: str,
        language: str = "fr",
    ) -> CoverLetterResult:
        if language == "en":
            name = name or "Candidate"
            title = title or "the position"
            company = company or "your company"
            opening = {
                "dynamic": f"Hello,\n\nI am thrilled to apply for the {title} position at {company}!",
                "concise": f"Dear Hiring Manager,\n\nApplication for {title} – {company}.",
            }.get(tone, f"Dear Hiring Manager,\n\nI am writing to apply for the {title} position at {company}.")
            body = {
                "etudiant": "As a student, I have built academic projects and internships that show my ability to learn fast and contribute from day one.",
                "confirme": f"Throughout my career I have driven architecture decisions and delivered measurable results. I would like to bring this technical leadership to {company}.",
            }.get(level, f"With hands-on experience, I master everyday tools and enjoy teamwork. I would love to put these skills to work at {company}.")
            closing = {
                "dynamic": f"Looking forward to talking soon!\n\n{name}",
                "concise": f"Available for a call.\n\n{name}",
            }.get(tone, f"I would welcome the opportunity to discuss my application.\n\nSincerely,\n\n{name}")
            return CoverLetterResult(content="\n\n".join([opening, body, closing]))

        name = name or "Candidat"
        title = title or "le poste"
        company = company or "votre entreprise"
        openings = {
            "formal": f"Madame, Monsieur,\n\nJe me permets de vous adresser ma candidature pour le poste de {title} au sein de {company}.",
            "dynamic": f"Bonjour,\n\nPassionné(e) par les défis techniques, je candidate avec enthousiasme au poste de {title} chez {company} !",
            "concise": f"Madame, Monsieur,\n\nCandidature pour {title} – {company}.",
        }
        bodies = {
            "etudiant": (
                f"Actuellement en formation, j'ai développé des projets académiques et stages "
                f"qui démontrent ma capacité à apprendre rapidement et à contribuer dès le premier jour. "
                f"Mon CV reflète cette dynamique d'apprentissage."
            ),
            "junior": (
                f"Fort(e) d'une première expérience concrète, je maîtrise les outils du quotidien "
                f"et apprécie le travail en équipe. Je souhaite mettre ces compétences au service de {company}."
            ),
            "confirme": (
                f"Au fil de mon parcours, j'ai mené des décisions d'architecture et livré des résultats mesurables. "
                f"Je souhaite apporter ce leadership technique à {company}."
            ),
        }
        closings = {
            "formal": f"Je reste à votre disposition pour un entretien.\n\nVeuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n{name}",
            "dynamic": f"Au plaisir d'échanger bientôt !\n\n{name}",
            "concise": f"Disponible pour un échange.\n\n{name}",
        }
        content = "\n\n".join(
            [
                openings.get(tone, openings["formal"]),
                bodies.get(level, bodies["junior"]),
                closings.get(tone, closings["formal"]),
            ]
        )
        return CoverLetterResult(content=content)

    def _mock_interview(
        self, missing: list[str], level: str, language: str = "fr"
    ) -> InterviewPrepResult:
        en = language == "en"
        questions = [
            InterviewQuestion(
                question="Tell me about yourself." if en else "Présentez-vous en quelques minutes.",
                category="motivation",
                why=(
                    "Checks your ability to summarize your background."
                    if en
                    else "Vérifie votre capacité à synthétiser votre parcours."
                ),
                answer_tips=(
                    "Present / past / future structure, linked to the position."
                    if en
                    else "Structure présent / passé / futur, reliée au poste visé."
                ),
            ),
            InterviewQuestion(
                question="Why this company?" if en else "Pourquoi notre entreprise ?",
                category="motivation",
                why="Measures your motivation." if en else "Mesure votre motivation réelle.",
                answer_tips=(
                    "Cite a product, value or recent news of the company."
                    if en
                    else "Citez un produit, une valeur ou une actualité de l'entreprise."
                ),
            ),
            InterviewQuestion(
                question=(
                    "Describe a technical problem you solved."
                    if en
                    else "Décrivez un problème technique que vous avez résolu."
                ),
                category="technique",
                why="Evaluates your reasoning." if en else "Évalue votre raisonnement.",
                answer_tips=(
                    "Use the STAR method (Situation, Task, Action, Result)."
                    if en
                    else "Utilisez la méthode STAR (Situation, Tâche, Action, Résultat)."
                ),
            ),
            InterviewQuestion(
                question=(
                    "Tell me about a conflict within a team."
                    if en
                    else "Parlez-moi d'un désaccord au sein d'une équipe."
                ),
                category="comportementale",
                why="Assesses your soft skills." if en else "Évalue vos soft skills.",
                answer_tips=(
                    "Show listening, compromise and the outcome."
                    if en
                    else "Montrez l'écoute, le compromis et le résultat obtenu."
                ),
            ),
        ]
        for skill in missing[:5]:
            questions.append(
                InterviewQuestion(
                    question=(
                        f"What is your experience with {skill}?"
                        if en
                        else f"Quelle est votre expérience avec {skill} ?"
                    ),
                    category="lacune",
                    why=(
                        f"{skill} is required but absent from your CV."
                        if en
                        else f"{skill} est demandé mais absent de votre CV."
                    ),
                    answer_tips=(
                        f"Be honest, mention related skills and your plan to learn {skill}."
                        if en
                        else f"Soyez honnête, citez des compétences proches et votre plan pour apprendre {skill}."
                    ),
                )
            )
        if level == "confirme":
            questions.append(
                InterviewQuestion(
                    question=(
                        "Describe an architecture decision you made."
                        if en
                        else "Décrivez une décision d'architecture que vous avez prise."
                    ),
                    category="technique",
                    why="Evaluates seniority." if en else "Évalue votre séniorité.",
                    answer_tips=(
                        "Context, alternatives considered, trade-offs, measured impact."
                        if en
                        else "Contexte, alternatives étudiées, compromis, impact mesuré."
                    ),
                )
            )
        return InterviewPrepResult(questions=questions[:10])

    def _mock_rewrite(
        self, cv_text: str, missing: list[str], language: str = "fr"
    ) -> CVRewriteResult:
        en = language == "en"
        lines = [
            ln.strip(" •-*\t")
            for ln in (cv_text or "").splitlines()
            if 25 <= len(ln.strip()) <= 220
        ]
        keyword = missing[0] if missing else ("the required stack" if en else "la stack demandée")
        items = []
        for line in lines[:5]:
            items.append(
                RewriteItem(
                    section="Experience" if en else "Expérience",
                    before=line,
                    after=(
                        f"Delivered: {line.rstrip('.')} — resulting in a measurable improvement (to quantify), using {keyword}."
                        if en
                        else f"Réalisé : {line.rstrip('.')} — avec un résultat mesurable (à chiffrer), en mobilisant {keyword}."
                    ),
                    reason=(
                        "Adds an action verb, an outcome and an offer keyword."
                        if en
                        else "Ajoute un verbe d'action, un résultat et un mot-clé de l'offre."
                    ),
                )
            )
        if not items:
            items.append(
                RewriteItem(
                    section="Summary" if en else "Résumé",
                    before="",
                    after=(
                        f"Motivated profile seeking to apply {keyword} in a demanding team."
                        if en
                        else f"Profil motivé souhaitant mettre en œuvre {keyword} dans une équipe exigeante."
                    ),
                    reason="No rewritable bullet detected." if en else "Aucune puce réécrivable détectée.",
                )
            )
        return CVRewriteResult(items=items)

    def _mock_learning_plan(
        self, missing: list[str], level: str, language: str = "fr"
    ) -> LearningPlanResult:
        en = language == "en"
        weeks = {"etudiant": 3.0, "junior": 2.0, "confirme": 1.0}.get(level, 2.0)
        steps = []
        for index, skill in enumerate(missing[:8]):
            query = skill.replace(" ", "+")
            steps.append(
                LearningStep(
                    skill=skill,
                    priority="haute" if index < 2 else "moyenne" if index < 5 else "basse",
                    estimated_weeks=weeks,
                    resources=[
                        LearningResource(
                            title=f"{skill} – documentation" if en else f"{skill} – documentation officielle",
                            url=f"https://www.google.com/search?q={query}+official+documentation",
                            kind="documentation",
                        ),
                        LearningResource(
                            title=f"{skill} tutorials" if en else f"Tutoriels {skill}",
                            url=f"https://www.youtube.com/results?search_query={query}+tutorial",
                            kind="vidéo",
                        ),
                    ],
                    project_idea=(
                        f"Build a small public GitHub project using {skill} and link it on your CV."
                        if en
                        else f"Réalisez un mini-projet public sur GitHub utilisant {skill} et ajoutez-le à votre CV."
                    ),
                )
            )
        return LearningPlanResult(steps=steps)

    def _mock_job_plan(
        self, skills: list[str], level: str, target_role: str, language: str = "fr"
    ) -> JobSearchPlan:
        lowered = {s.lower() for s in skills}

        def has(*names: str) -> bool:
            return any(n in lowered for n in names)

        front = has("react", "vue", "vue.js", "angular", "javascript", "typescript")
        back = has("django", "flask", "fastapi", "node.js", "spring", "java", "php", "laravel")
        if has("machine learning", "tensorflow", "pytorch", "scikit-learn"):
            titles = ["Data Scientist", "Machine Learning Engineer", "Data Scientist junior"]
        elif has("pandas", "power bi", "tableau", "excel") and has("sql"):
            titles = ["Data Analyst", "Business Intelligence Analyst", "Analyste de données"]
        elif front and back:
            titles = ["Full Stack Developer", "Développeur Full-Stack", "Software Engineer"]
        elif front:
            titles = ["Frontend Developer", "Développeur Front-End", "React Developer"]
        elif back:
            titles = ["Backend Developer", "Développeur Back-End", "Python Developer"]
        elif has("docker", "kubernetes", "aws", "terraform"):
            titles = ["DevOps Engineer", "Ingénieur DevOps", "Cloud Engineer"]
        else:
            titles = ["Software Developer", "Développeur logiciel"]
        if target_role:
            titles = [target_role] + [t for t in titles if t.lower() != target_role.lower()]
        summary = (
            f"Profile {level} – {', '.join(skills[:4]) or 'general skills'}."
            if language == "en"
            else f"Profil {level} – {', '.join(skills[:4]) or 'compétences générales'}."
        )
        return JobSearchPlan(
            target_titles=titles[:5], keywords=skills[:10], seniority=level, summary=summary
        )

    def _mock_rank(self, offers: list[dict], language: str = "fr") -> JobMatchRanking:
        en = language == "en"
        matches = []
        for offer in offers:
            matched = offer.get("matched_skills") or []
            if matched:
                reason = (
                    f"Shares {len(matched)} key skill(s) with your CV: {', '.join(matched[:4])}."
                    if en
                    else f"{len(matched)} compétence(s) clé(s) en commun avec votre CV : {', '.join(matched[:4])}."
                )
            else:
                reason = "Job title close to your profile." if en else "Intitulé proche de votre profil."
            matches.append(
                JobMatch(
                    index=offer["index"],
                    score=offer.get("local_score", 0),
                    reason=reason,
                    matching_skills=matched[:5],
                )
            )
        return JobMatchRanking(matches=matches)


def _site_forces_mock() -> bool:
    try:
        from adminpanel.models import SiteSettings

        return SiteSettings.objects.filter(pk=1, force_mock_ai=True).exists()
    except Exception:  # noqa: BLE001
        return False


def _cache_get(key: str) -> dict | None:
    try:
        from analyses.models import LLMCacheEntry

        entry = LLMCacheEntry.objects.filter(key=key).only("data").first()
        return entry.data if entry else None
    except Exception:  # noqa: BLE001
        logger.debug("LLM cache read failed", exc_info=True)
        return None


def _cache_set(key: str, kind: str, data: dict) -> None:
    try:
        from analyses.models import LLMCacheEntry

        LLMCacheEntry.objects.update_or_create(key=key, defaults={"kind": kind, "data": data})
    except Exception:  # noqa: BLE001
        logger.debug("LLM cache write failed", exc_info=True)


def normalize_in_text(skill: str, text: str) -> bool:
    return skill.lower() in text


def get_ai_service() -> AIService:
    return AIService()
