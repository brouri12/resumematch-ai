from django.contrib import admin

from .models import CV


@admin.register(CV)
class CVAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "original_filename", "uploaded_at")
    search_fields = ("original_filename", "user__username")
