from rest_framework import serializers

from .models import CV


class CVSerializer(serializers.ModelSerializer):
    class Meta:
        model = CV
        fields = (
            "id",
            "original_filename",
            "extracted_text",
            "parsed_data",
            "uploaded_at",
            "file",
        )
        read_only_fields = (
            "id",
            "original_filename",
            "extracted_text",
            "parsed_data",
            "uploaded_at",
        )


class CVUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        name = (value.name or "").lower()
        content_type = getattr(value, "content_type", "") or ""
        if not name.endswith(".pdf") and "pdf" not in content_type.lower():
            raise serializers.ValidationError("Seuls les fichiers PDF sont acceptés.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Le fichier ne doit pas dépasser 5 Mo.")
        return value
