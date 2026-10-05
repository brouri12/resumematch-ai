"""Provider-agnostic LLM service with Pydantic validation and mock fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from django.conf import settings
from pydantic import BaseModel, Field, ValidationError, field_validator

logger = logging.getLogger(__name__)

LevelType = Literal["etudiant", "junior", "confirme"]
ToneType = Literal["formal", "dynamic", "concise"]


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

    @property
    def use_mock(self) -> bool:
        return not bool(self.api_key.strip())

    def extract_cv_skills(self, cv_text: str) -> CVParsedData:
        schema_hint = CVParsedData.model_json_schema()
        prompt = (
            "Extrais du CV les informations suivantes en JSON strict. "
            "Réponds UNIQUEMENT avec un objet JSON valide.\n"
            f"Schéma attendu: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:12000]}"
        )
        return self._call_validated(
            prompt, CVParsedData, mock_fn=lambda: self._mock_cv(cv_text)
        )

    def analyze_job_offer(self, job_text: str) -> JobParsedData:
        schema_hint = JobParsedData.model_json_schema()
        prompt = (
            "Analyse cette offre d'emploi et extrais les compétences et infos "
            "en JSON strict. Réponds UNIQUEMENT avec un objet JSON valide.\n"
            f"Schéma attendu: {json.dumps(schema_hint)}\n\n"
            f"Offre:\n{job_text[:12000]}"
        )
        return self._call_validated(prompt, JobParsedData, mock_fn=lambda: self._mock_job(job_text))

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
            f"{level_hint}\n{detail}\n"
            f"Compétences manquantes: {missing_skills}\n"
            f"Schéma: {json.dumps(schema_hint)}\n\n"
            f"CV:\n{cv_text[:5000]}\n\nOffre:\n{job_text[:5000]}"
        )
        return self._call_validated(
            prompt,
            RecommendationsResult,
            mock_fn=lambda: self._mock_recommendations(missing_skills, level, detailed),
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
    ) -> CoverLetterResult:
        level_hint = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS["junior"])
        tone_hint = TONE_PROMPTS.get(tone, TONE_PROMPTS["formal"])
        schema_hint = CoverLetterResult.model_json_schema()
        prompt = (
            "Rédige une lettre de motivation personnalisée en français. "
            "Réponds UNIQUEMENT en JSON strict avec la clé content.\n"
            f"{level_hint}\n{tone_hint}\n"
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
                candidate_name, job_title, company, level, tone
            ),
        )

    def _call_validated(
        self,
        prompt: str,
        model_cls: type[BaseModel],
        mock_fn,
    ) -> BaseModel:
        if self.use_mock:
            logger.info("LLM_API_KEY empty – using mock AI responses")
            return mock_fn()

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                raw = self._invoke_llm(prompt if attempt == 1 else (
                    prompt
                    + "\n\nIMPORTANT: Your previous answer was invalid JSON. "
                    "Reply with ONLY a valid JSON object, no markdown."
                ))
                data = _extract_json_object(raw)
                return model_cls.model_validate(data)
            except (ValidationError, ValueError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning("LLM JSON validation failed (attempt %s): %s", attempt, exc)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.exception("LLM call failed (attempt %s): %s", attempt, exc)

        logger.error("Falling back to mock after LLM failures: %s", last_error)
        return mock_fn()

    def _invoke_llm(self, prompt: str) -> str:
        if self.provider in ("anthropic", "claude"):
            return self._invoke_anthropic(prompt)
        if self.provider in ("openai", "compatible"):
            return self._invoke_openai_compatible(prompt)
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

    def _invoke_openai_compatible(self, prompt: str) -> str:
        import httpx

        base_url = getattr(settings, "LLM_BASE_URL", "https://api.openai.com/v1")
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
    ) -> RecommendationsResult:
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
    ) -> CoverLetterResult:
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


def normalize_in_text(skill: str, text: str) -> bool:
    return skill.lower() in text


def get_ai_service() -> AIService:
    return AIService()
