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
