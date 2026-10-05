from rest_framework import serializers

from .models import Analysis, AnalysisJob, CoverLetter, JobOffer, JobSearch

LANGUAGE_CHOICES = (("fr", "Français"), ("en", "English"))


class JobOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobOffer
        fields = (
            "id",
            "title",
            "company",
            "raw_text",
            "parsed_data",
            "created_at",
        )
        read_only_fields = fields


class AnalysisCreateSerializer(serializers.Serializer):
    cv_id = serializers.IntegerField()
    job_offer_text = serializers.CharField(min_length=20)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    company = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    level = serializers.ChoiceField(
        choices=Analysis.Level.choices,
        required=False,
        default=Analysis.Level.JUNIOR,
    )
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, required=False, default="fr")


class CompareOfferSerializer(serializers.Serializer):
    job_offer_text = serializers.CharField(min_length=20)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    company = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class CompareCreateSerializer(serializers.Serializer):
    cv_id = serializers.IntegerField()
    level = serializers.ChoiceField(
        choices=Analysis.Level.choices,
        required=False,
        default=Analysis.Level.JUNIOR,
    )
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, required=False, default="fr")
    offers = CompareOfferSerializer(many=True, min_length=2, max_length=5)


class AnalysisJobSerializer(serializers.ModelSerializer):
    analysis_id = serializers.IntegerField(source="analysis.id", read_only=True, default=None)
    score = serializers.IntegerField(source="analysis.score", read_only=True, default=None)
    job_title = serializers.CharField(source="analysis.job_offer.title", read_only=True, default=None)
    company = serializers.CharField(source="analysis.job_offer.company", read_only=True, default=None)

    class Meta:
        model = AnalysisJob
        fields = (
            "id",
            "state",
            "progress",
            "step",
            "error",
            "analysis_id",
            "score",
            "job_title",
            "company",
            "created_at",
        )
        read_only_fields = fields


class JobImportSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2000)


class AnalysisSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job_offer.title", read_only=True)
    company = serializers.CharField(source="job_offer.company", read_only=True)
    competences_presentes = serializers.JSONField(source="present_skills", read_only=True)
    competences_manquantes = serializers.JSONField(source="missing_skills", read_only=True)
    recommandations = serializers.JSONField(source="recommendations", read_only=True)
    niveau = serializers.CharField(source="level", read_only=True)
    analysis_id = serializers.IntegerField(source="id", read_only=True)
    job_offer = JobOfferSerializer(read_only=True)

    class Meta:
        model = Analysis
        fields = (
            "id",
            "analysis_id",
            "cv",
            "job_offer",
            "job_title",
            "company",
            "level",
            "niveau",
            "score",
            "competences_presentes",
            "competences_manquantes",
            "recommandations",
            "present_skills",
            "missing_skills",
            "recommendations",
            "score_breakdown",
            "status",
            "language",
            "ai_mode",
            "created_at",
        )
        read_only_fields = fields


class AnalysisStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Analysis.Status.choices)


class CoverLetterCreateSerializer(serializers.Serializer):
    tone = serializers.ChoiceField(choices=CoverLetter.Tone.choices)
    content = serializers.CharField(required=False, allow_blank=True)
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, required=False, default="fr")


class CoverLetterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoverLetter
        fields = ("id", "analysis", "tone", "content", "created_at", "updated_at")
        read_only_fields = ("id", "analysis", "created_at", "updated_at")


class CoverLetterUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoverLetter
        fields = ("content", "tone")


class JobSearchCreateSerializer(serializers.Serializer):
    cv_id = serializers.IntegerField()
    location = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    remote_only = serializers.BooleanField(required=False, default=False)
    custom_query = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    level = serializers.ChoiceField(choices=Analysis.Level.choices, required=False)
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, required=False, default="fr")
    sources = serializers.ListField(child=serializers.CharField(max_length=30), required=False)


class JobSearchSerializer(serializers.ModelSerializer):
    cv_name = serializers.CharField(source="cv.original_filename", read_only=True, default="")

    class Meta:
        model = JobSearch
        fields = ("id", "cv", "cv_name", "params", "plan", "results", "stats", "ai_mode", "created_at")
        read_only_fields = fields


class JobSearchSummarySerializer(serializers.ModelSerializer):
    result_count = serializers.SerializerMethodField()
    best_score = serializers.SerializerMethodField()
    target_titles = serializers.SerializerMethodField()

    class Meta:
        model = JobSearch
        fields = ("id", "params", "target_titles", "result_count", "best_score", "ai_mode", "created_at")
        read_only_fields = fields

    def get_result_count(self, obj):
        return len(obj.results or [])

    def get_best_score(self, obj):
        return max((r.get("score", 0) for r in obj.results or []), default=None)

    def get_target_titles(self, obj):
        return (obj.plan or {}).get("target_titles", [])[:3]
