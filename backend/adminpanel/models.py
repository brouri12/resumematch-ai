from django.conf import settings
from django.db import models


class SiteSettings(models.Model):
    """Singleton (pk=1) holding settings an admin can change at runtime without a restart."""

    analysis_daily_quota = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Analyses par utilisateur sur 24 h. Vide = valeur du .env, 0 = illimité.",
    )
    force_mock_ai = models.BooleanField(
        default=False,
        help_text="Force le moteur démo même si une clé API est configurée (économise les crédits).",
    )
    allow_registration = models.BooleanField(default=True)
    announcement = models.CharField(max_length=300, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres du site"
        verbose_name_plural = "Paramètres du site"

    def __str__(self) -> str:
        return "Paramètres du site"

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def effective_daily_quota(self) -> int:
        if self.analysis_daily_quota is None:
            return settings.ANALYSIS_DAILY_QUOTA
        return self.analysis_daily_quota
