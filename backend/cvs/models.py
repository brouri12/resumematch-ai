from django.conf import settings
from django.db import models


class CV(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cvs",
    )
    file = models.FileField(upload_to="cvs/%Y/%m/")
    original_filename = models.CharField(max_length=255, blank=True, default="")
    extracted_text = models.TextField(blank=True, default="")
    parsed_data = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return f"CV #{self.pk} – {self.user.username}"
