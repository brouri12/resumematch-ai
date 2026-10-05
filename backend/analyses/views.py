from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from cvs.models import CV

from .models import Analysis, CoverLetter
from .serializers import (
    AnalysisCreateSerializer,
    AnalysisSerializer,
    AnalysisStatusSerializer,
    CoverLetterCreateSerializer,
    CoverLetterSerializer,
    CoverLetterUpdateSerializer,
)
from .services import create_cover_letter, improve_cv_suggestions, run_analysis


class AnalysisListCreateView(APIView):
    def get(self, request):
        qs = Analysis.objects.filter(user=request.user).select_related("job_offer", "cv")

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        level = request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)

        min_score = request.query_params.get("min_score")
        if min_score is not None:
            try:
                qs = qs.filter(score__gte=int(min_score))
            except ValueError:
                pass

        search = request.query_params.get("search")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(job_offer__title__icontains=search)
                | Q(job_offer__company__icontains=search)
            )

        # Simple pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1
        try:
            page_size = min(50, max(1, int(request.query_params.get("page_size", 10))))
        except ValueError:
            page_size = 10

        total = qs.count()
        start = (page - 1) * page_size
        items = qs[start : start + page_size]
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": AnalysisSerializer(items, many=True).data,
            }
        )

    def post(self, request):
        serializer = AnalysisCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cv = get_object_or_404(CV, pk=data["cv_id"], user=request.user)
        level = data.get("level") or request.user.level or Analysis.Level.JUNIOR

        analysis = run_analysis(
            user=request.user,
            cv=cv,
            job_offer_text=data["job_offer_text"],
            title=data.get("title") or "",
            company=data.get("company") or "",
            level=level,
        )
        payload = AnalysisSerializer(analysis).data
        # Guarantee API contract keys at top level
        payload.update(
            {
                "score": analysis.score,
                "competences_presentes": analysis.present_skills,
                "competences_manquantes": analysis.missing_skills,
                "recommandations": analysis.recommendations,
                "score_breakdown": analysis.score_breakdown,
                "niveau": analysis.level,
                "analysis_id": analysis.id,
                "created_at": analysis.created_at,
            }
        )
        return Response(payload, status=status.HTTP_201_CREATED)


class AnalysisDetailView(APIView):
    def get_object(self, request, pk):
        return get_object_or_404(
            Analysis.objects.select_related("job_offer", "cv"),
            pk=pk,
            user=request.user,
        )

    def get(self, request, pk):
        analysis = self.get_object(request, pk)
        return Response(AnalysisSerializer(analysis).data)

    def delete(self, request, pk):
        analysis = self.get_object(request, pk)
        analysis.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnalysisStatusView(APIView):
    def patch(self, request, pk):
        analysis = get_object_or_404(Analysis, pk=pk, user=request.user)
        serializer = AnalysisStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        analysis.status = serializer.validated_data["status"]
        analysis.save(update_fields=["status"])
        return Response(AnalysisSerializer(analysis).data)


class AnalysisImproveCVView(APIView):
    def post(self, request, pk):
        analysis = get_object_or_404(Analysis, pk=pk, user=request.user)
        return Response(improve_cv_suggestions(analysis))


class AnalysisCoverLetterView(APIView):
    def post(self, request, pk):
        analysis = get_object_or_404(Analysis, pk=pk, user=request.user)
        serializer = CoverLetterCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tone = serializer.validated_data["tone"]
        content = serializer.validated_data.get("content")
        if content:
            letter = CoverLetter.objects.create(
                analysis=analysis, tone=tone, content=content
            )
        else:
            letter = create_cover_letter(analysis, tone)
        return Response(
            CoverLetterSerializer(letter).data,
            status=status.HTTP_201_CREATED,
        )


class CoverLetterDetailView(APIView):
    def get_object(self, request, pk):
        return get_object_or_404(
            CoverLetter.objects.select_related("analysis"),
            pk=pk,
            analysis__user=request.user,
        )

    def get(self, request, pk):
        letter = self.get_object(request, pk)
        return Response(CoverLetterSerializer(letter).data)

    def put(self, request, pk):
        letter = self.get_object(request, pk)
        serializer = CoverLetterUpdateSerializer(letter, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CoverLetterSerializer(letter).data)


class CoverLetterExportView(APIView):
    # Prevent DRF from treating ?format= as content-negotiation (would 404 for txt/docx)
    format_kwarg = None

    def get(self, request, pk):
        letter = get_object_or_404(
            CoverLetter.objects.select_related("analysis", "analysis__job_offer"),
            pk=pk,
            analysis__user=request.user,
        )
        fmt = (
            request.query_params.get("export_format")
            or request.query_params.get("file_format")
            or request.query_params.get("format")
            or "txt"
        ).lower()
        if fmt not in ("txt", "docx"):
            return Response(
                {"detail": "Format non supporté. Utilisez txt ou docx."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        filename_base = f"lettre_motivation_{letter.id}"

        if fmt == "docx":
            from io import BytesIO

            from docx import Document

            doc = Document()
            for paragraph in letter.content.split("\n"):
                doc.add_paragraph(paragraph)
            buffer = BytesIO()
            doc.save(buffer)
            buffer.seek(0)
            response = HttpResponse(
                buffer.getvalue(),
                content_type=(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ),
            )
            response["Content-Disposition"] = f'attachment; filename="{filename_base}.docx"'
            return response

        response = HttpResponse(letter.content, content_type="text/plain; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename_base}.txt"'
        return response


class DashboardStatsView(APIView):
    def get(self, request):
        qs = Analysis.objects.filter(user=request.user)
        count = qs.count()
        avg = 0
        if count:
            avg = round(sum(a.score for a in qs) / count, 1)
        recent = qs.select_related("job_offer")[:5]
        by_status = {}
        for choice, _label in Analysis.Status.choices:
            by_status[choice] = qs.filter(status=choice).count()
        return Response(
            {
                "analyses_count": count,
                "average_score": avg,
                "by_status": by_status,
                "recent": AnalysisSerializer(recent, many=True).data,
            }
        )
