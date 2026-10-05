from django.contrib.auth import get_user_model
from rest_framework import serializers

from analyses.models import Analysis, AnalysisJob

from .models import SiteSettings

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    analyses_count = serializers.IntegerField(read_only=True)
    cvs_count = serializers.IntegerField(read_only=True)
    average_score = serializers.FloatField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "level",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "analyses_count",
            "cvs_count",
            "average_score",
        )
        read_only_fields = (
            "id",
            "username",
            "is_superuser",
            "date_joined",
            "last_login",
            "analyses_count",
            "cvs_count",
            "average_score",
        )


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("is_active", "is_staff", "level")


class AdminAnalysisSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    job_title = serializers.CharField(source="job_offer.title", read_only=True)
    company = serializers.CharField(source="job_offer.company", read_only=True)

    class Meta:
        model = Analysis
        fields = (
            "id",
            "username",
            "job_title",
            "company",
            "level",
            "score",
            "status",
            "ai_mode",
            "language",
            "created_at",
        )
        read_only_fields = fields


class AdminJobSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    analysis_id = serializers.IntegerField(source="analysis.id", read_only=True, default=None)

    class Meta:
        model = AnalysisJob
        fields = ("id", "username", "state", "progress", "step", "error", "analysis_id", "created_at", "updated_at")
        read_only_fields = fields


class SiteSettingsSerializer(serializers.ModelSerializer):
    effective_daily_quota = serializers.IntegerField(read_only=True)

    class Meta:
        model = SiteSettings
        fields = (
            "analysis_daily_quota",
            "effective_daily_quota",
            "force_mock_ai",
            "allow_registration",
            "announcement",
            "updated_at",
        )
        read_only_fields = ("effective_daily_quota", "updated_at")
