from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Level(models.TextChoices):
        ETUDIANT = "etudiant", "Étudiant"
        JUNIOR = "junior", "Junior"
        CONFIRME = "confirme", "Confirmé"

    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.JUNIOR,
    )
    target_job_title = models.CharField(max_length=200, blank=True, default="")

    def __str__(self) -> str:
        return self.username
