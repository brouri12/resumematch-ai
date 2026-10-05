from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Profil ResumeMatch", {"fields": ("level", "target_job_title")}),
    )
    list_display = ("username", "email", "level", "target_job_title", "is_staff")
    list_filter = ("level", "is_staff", "is_superuser")
