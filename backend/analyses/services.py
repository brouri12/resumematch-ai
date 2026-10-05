"""Analysis orchestration: scoring, recommendations, cover letters."""

from __future__ import annotations

from django.conf import settings

from cvs.models import CV
from services.ai_service import get_ai_service
from services.scoring import canonicalize_skills, skill_overlap_score

from .models import Analysis, CoverLetter, JobOffer


def run_analysis(
    *,
    user,
    cv: CV,
    job_offer_text: str,
    title: str = "",
    company: str = "",
    level: str = Analysis.Level.JUNIOR,
) -> Analysis:
    ai = get_ai_service()

    # Ensure CV has parsed data
    if not cv.parsed_data and cv.extracted_text:
        cv.parsed_data = ai.extract_cv_skills(cv.extracted_text).model_dump()
        cv.save(update_fields=["parsed_data"])

    job_parsed = ai.analyze_job_offer(job_offer_text)
    resolved_title = title.strip() or job_parsed.title or "Offre sans titre"
    resolved_company = company.strip() or job_parsed.company or ""

    job_offer = JobOffer.objects.create(
        user=user,
        title=resolved_title,
        company=resolved_company,
        raw_text=job_offer_text,
        parsed_data=job_parsed.model_dump(),
    )

    cv_skills = list(cv.parsed_data.get("technical_skills") or []) + list(
        cv.parsed_data.get("soft_skills") or []
    )
    required = list(job_parsed.required_skills or [])
    nice = list(job_parsed.nice_to_have_skills or [])

    skills_score, present, missing = skill_overlap_score(cv_skills, required)

    # Nice-to-have bonus (small)
    nice_present = 0
    if nice:
        _, nice_hit, _ = skill_overlap_score(cv_skills, nice)
        nice_present = len(nice_hit)

    semantic = ai.evaluate_semantic_fit(
        cv.extracted_text or "",
        job_offer_text,
        level=level,  # type: ignore[arg-type]
        present_skills=present,
        missing_skills=missing,
    )

    w_skills = settings.SCORE_WEIGHT_SKILLS
    w_semantic = settings.SCORE_WEIGHT_SEMANTIC
    level_mult = settings.SCORE_LEVEL_MULTIPLIERS.get(level, 1.0)

    # Renormalize weights after level multiplier on semantic part
    adj_semantic = w_semantic * level_mult
    total_w = w_skills + adj_semantic
    skills_contrib = (w_skills / total_w) * skills_score
    semantic_contrib = (adj_semantic / total_w) * semantic.semantic_score
    nice_bonus = min(5.0, nice_present * 1.5)
    final_score = int(round(min(100.0, skills_contrib + semantic_contrib + nice_bonus)))

    recs = ai.generate_recommendations(
        cv.extracted_text or "",
        job_offer_text,
        level=level,  # type: ignore[arg-type]
        missing_skills=missing,
        detailed=False,
    )

    breakdown = {
        "skills_score": round(skills_score, 1),
        "semantic_score": semantic.semantic_score,
        "skills_weight": round(w_skills / total_w, 3),
        "semantic_weight": round(adj_semantic / total_w, 3),
        "skills_contribution": round(skills_contrib, 1),
        "semantic_contribution": round(semantic_contrib, 1),
        "nice_to_have_bonus": round(nice_bonus, 1),
        "level": level,
        "level_semantic_multiplier": level_mult,
        "rationale": semantic.rationale,
        "experience_fit": semantic.experience_fit,
        "present_count": len(present),
        "missing_count": len(missing),
        "required_count": len(canonicalize_skills(required)),
    }

    analysis = Analysis.objects.create(
        user=user,
        cv=cv,
        job_offer=job_offer,
        level=level,
        score=final_score,
        present_skills=present,
        missing_skills=missing,
        recommendations=recs.recommandations,
        score_breakdown=breakdown,
        status=Analysis.Status.TO_APPLY,
    )
    return analysis


def improve_cv_suggestions(analysis: Analysis) -> dict:
    ai = get_ai_service()
    result = ai.generate_recommendations(
        analysis.cv.extracted_text or "",
        analysis.job_offer.raw_text,
        level=analysis.level,  # type: ignore[arg-type]
        missing_skills=analysis.missing_skills or [],
        detailed=True,
    )
    return {
        "recommandations": result.recommandations,
        "detailed_improvements": result.detailed_improvements,
        "niveau": analysis.level,
        "analysis_id": analysis.id,
    }


def create_cover_letter(analysis: Analysis, tone: str) -> CoverLetter:
    ai = get_ai_service()
    user = analysis.user
    name = (user.get_full_name() or user.username).strip()
    result = ai.generate_cover_letter(
        analysis.cv.extracted_text or "",
        analysis.job_offer.raw_text,
        level=analysis.level,  # type: ignore[arg-type]
        tone=tone,  # type: ignore[arg-type]
        candidate_name=name,
        job_title=analysis.job_offer.title,
        company=analysis.job_offer.company,
    )
    return CoverLetter.objects.create(
        analysis=analysis,
        tone=tone,
        content=result.content,
    )
