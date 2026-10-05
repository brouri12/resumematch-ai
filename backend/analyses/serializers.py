from rest_framework import serializers

from .models import Analysis, CoverLetter, JobOffer


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
            "created_at",
        )
        read_only_fields = fields


class AnalysisStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Analysis.Status.choices)


class CoverLetterCreateSerializer(serializers.Serializer):
    tone = serializers.ChoiceField(choices=CoverLetter.Tone.choices)
    content = serializers.CharField(required=False, allow_blank=True)


class CoverLetterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoverLetter
        fields = ("id", "analysis", "tone", "content", "created_at", "updated_at")
        read_only_fields = ("id", "analysis", "created_at", "updated_at")


class CoverLetterUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoverLetter
        fields = ("content", "tone")
