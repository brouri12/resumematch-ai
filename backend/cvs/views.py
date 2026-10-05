from rest_framework import generics, parsers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.ai_service import get_ai_service
from services.pdf_service import extract_text_from_pdf

from .models import CV
from .serializers import CVSerializer, CVUploadSerializer


class CVListCreateView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request):
        qs = CV.objects.filter(user=request.user)
        return Response(CVSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = CVUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]

        cv = CV.objects.create(
            user=request.user,
            file=uploaded,
            original_filename=uploaded.name,
        )
        try:
            text = extract_text_from_pdf(cv.file.path)
        except Exception:  # noqa: BLE001
            text = ""
        cv.extracted_text = text
        if text:
            parsed = get_ai_service().extract_cv_skills(text)
            cv.parsed_data = parsed.model_dump()
        cv.save()
        return Response(
            CVSerializer(cv, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CVDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = CVSerializer

    def get_queryset(self):
        return CV.objects.filter(user=self.request.user)
