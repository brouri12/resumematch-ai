from django.conf import settings
from django.db import models

from cvs.models import CV


class JobOffer(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_offers",
    )
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True, default="")
    raw_text = models.TextField()
    parsed_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} @ {self.company or 'N/A'}"


class Analysis(models.Model):
    class Level(models.TextChoices):
        ETUDIANT = "etudiant", "Étudiant"
        JUNIOR = "junior", "Junior"
        CONFIRME = "confirme", "Confirmé"

    class Status(models.TextChoices):
        TO_APPLY = "to_apply", "À postuler"
        APPLIED = "applied", "Candidature envoyée"
        INTERVIEW = "interview", "Entretien"
        REJECTED = "rejected", "Refusé"
        OFFER = "offer", "Offre reçue"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="analyses",
    )
    cv = models.ForeignKey(CV, on_delete=models.CASCADE, related_name="analyses")
    job_offer = models.ForeignKey(
        JobOffer,
        on_delete=models.CASCADE,
        related_name="analyses",
    )
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.JUNIOR,
    )
    score = models.PositiveSmallIntegerField(default=0)
    present_skills = models.JSONField(default=list, blank=True)
    missing_skills = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    score_breakdown = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TO_APPLY,
    )
    language = models.CharField(max_length=5, default="fr")
    ai_mode = models.CharField(max_length=10, blank=True, default="")
    # Lazily generated content: interview_prep, cv_rewrite, learning_plan, ats (keyed by language)
    extras = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "analyses"

    def __str__(self) -> str:
        return f"Analysis #{self.pk} – {self.score}%"


class CoverLetter(models.Model):
    class Tone(models.TextChoices):
        FORMAL = "formal", "Formel"
        DYNAMIC = "dynamic", "Dynamique"
        CONCISE = "concise", "Concis"

    analysis = models.ForeignKey(
        Analysis,
        on_delete=models.CASCADE,
        related_name="cover_letters",
    )
    tone = models.CharField(max_length=20, choices=Tone.choices, default=Tone.FORMAL)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CoverLetter #{self.pk} ({self.tone})"


class AnalysisJob(models.Model):
    class State(models.TextChoices):
        PENDING = "pending", "En attente"
        RUNNING = "running", "En cours"
        DONE = "done", "Terminé"
        FAILED = "failed", "Échec"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="analysis_jobs",
    )
    state = models.CharField(max_length=10, choices=State.choices, default=State.PENDING)
    progress = models.PositiveSmallIntegerField(default=0)
    step = models.CharField(max_length=60, blank=True, default="")
    error = models.TextField(blank=True, default="")
    analysis = models.ForeignKey(
        Analysis,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AnalysisJob #{self.pk} ({self.state} {self.progress}%)"


class JobSearch(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_searches",
    )
    cv = models.ForeignKey(
        CV, on_delete=models.SET_NULL, null=True, blank=True, related_name="job_searches"
    )
    params = models.JSONField(default=dict, blank=True)
    plan = models.JSONField(default=dict, blank=True)
    results = models.JSONField(default=list, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    ai_mode = models.CharField(max_length=10, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "job searches"

    def __str__(self) -> str:
        return f"JobSearch #{self.pk} ({len(self.results)} offres)"


class LLMCacheEntry(models.Model):
    key = models.CharField(max_length=64, unique=True)
    kind = models.CharField(max_length=20)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.kind}:{self.key[:10]}"
