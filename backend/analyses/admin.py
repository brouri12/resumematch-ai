from django.contrib import admin

from .models import Analysis, CoverLetter, JobOffer


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "company", "user", "created_at")
    search_fields = ("title", "company")


@admin.register(Analysis)
class AnalysisAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "score", "level", "status", "created_at")
    list_filter = ("level", "status")


@admin.register(CoverLetter)
class CoverLetterAdmin(admin.ModelAdmin):
    list_display = ("id", "analysis", "tone", "created_at")
