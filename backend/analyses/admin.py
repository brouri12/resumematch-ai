from django.contrib import admin

from .models import Analysis, AnalysisJob, CoverLetter, JobOffer, JobSearch, LLMCacheEntry


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


@admin.register(AnalysisJob)
class AnalysisJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "state", "progress", "step", "analysis", "created_at")
    list_filter = ("state",)


@admin.register(JobSearch)
class JobSearchAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "cv", "ai_mode", "created_at")
    list_filter = ("ai_mode",)


@admin.register(LLMCacheEntry)
class LLMCacheEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "key", "created_at")
    list_filter = ("kind",)
