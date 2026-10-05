from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from cvs.models import CV
from services.ai_service import get_ai_service
from services.job_import_service import JobImportError, import_job_offer
from services.job_search_service import (
    JobSearchError,
    available_sources,
    featured_jobs,
    find_matching_jobs,
)

from .models import Analysis, AnalysisJob, CoverLetter, JobSearch
from .serializers import (
    AnalysisCreateSerializer,
    AnalysisJobSerializer,
    AnalysisSerializer,
    AnalysisStatusSerializer,
    CompareCreateSerializer,
    CoverLetterCreateSerializer,
    CoverLetterSerializer,
    CoverLetterUpdateSerializer,
    JobImportSerializer,
    JobSearchCreateSerializer,
    JobSearchSerializer,
    JobSearchSummarySerializer,
)
from .services import (
    build_report_docx,
    create_cover_letter,
    effective_daily_quota,
    get_or_generate_extra,
    improve_cv_suggestions,
    quota_remaining,
    run_analysis,
    start_analysis_job,
)

EXTRA_KINDS = ("interview_prep", "cv_rewrite", "learning_plan", "ats")


class AIThrottle(UserRateThrottle):
    scope = "ai"


class JobImportThrottle(UserRateThrottle):
    scope = "job_import"


class PostThrottledMixin:
    """Apply the AI throttle to POST only, so listing/reading stays unlimited."""

    post_throttle_classes = (AIThrottle,)

    def get_throttles(self):
        if self.request.method == "POST":
            return [cls() for cls in self.post_throttle_classes]
        return super().get_throttles()


def _request_language(request) -> str:
    lang = (request.data.get("language") if hasattr(request, "data") else None) or request.query_params.get(
        "language", "fr"
    )
    return lang if lang in ("fr", "en") else "fr"


def _quota_exceeded_response():
    return Response(
        {
            "detail": (
                f"Quota atteint : {effective_daily_quota()} analyses par 24 h. "
                "Réessayez plus tard."
            )
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


class AnalysisListCreateView(PostThrottledMixin, APIView):
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
            page_size = min(100, max(1, int(request.query_params.get("page_size", 10))))
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
        if quota_remaining(request.user) <= 0:
            return _quota_exceeded_response()

        analysis = run_analysis(
            user=request.user,
            cv=cv,
            job_offer_text=data["job_offer_text"],
            title=data.get("title") or "",
            company=data.get("company") or "",
            level=level,
            language=data.get("language") or "fr",
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


class AnalysisAsyncCreateView(PostThrottledMixin, APIView):
    def post(self, request):
        serializer = AnalysisCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cv = get_object_or_404(CV, pk=data["cv_id"], user=request.user)
        if quota_remaining(request.user) <= 0:
            return _quota_exceeded_response()
        job = start_analysis_job(
            user=request.user,
            cv=cv,
            job_offer_text=data["job_offer_text"],
            title=data.get("title") or "",
            company=data.get("company") or "",
            level=data.get("level") or request.user.level or Analysis.Level.JUNIOR,
            language=data.get("language") or "fr",
        )
        return Response(AnalysisJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class AnalysisCompareView(PostThrottledMixin, APIView):
    def post(self, request):
        serializer = CompareCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cv = get_object_or_404(CV, pk=data["cv_id"], user=request.user)
        offers = data["offers"]
        if quota_remaining(request.user) < len(offers):
            return _quota_exceeded_response()
        jobs = [
            start_analysis_job(
                user=request.user,
                cv=cv,
                job_offer_text=offer["job_offer_text"],
                title=offer.get("title") or "",
                company=offer.get("company") or "",
                level=data.get("level") or Analysis.Level.JUNIOR,
                language=data.get("language") or "fr",
            )
            for offer in offers
        ]
        return Response(
            {"jobs": AnalysisJobSerializer(jobs, many=True).data},
            status=status.HTTP_202_ACCEPTED,
        )


class AnalysisJobDetailView(APIView):
    def get(self, request, pk):
        job = get_object_or_404(
            AnalysisJob.objects.select_related("analysis", "analysis__job_offer"),
            pk=pk,
            user=request.user,
        )
        return Response(AnalysisJobSerializer(job).data)


class AnalysisExtraView(PostThrottledMixin, APIView):
    """GET returns cached content (or null); POST generates it (refresh=true to regenerate)."""

    def _get(self, request, pk, kind):
        if kind not in EXTRA_KINDS:
            return None, Response({"detail": "Type inconnu."}, status=status.HTTP_404_NOT_FOUND)
        analysis = get_object_or_404(
            Analysis.objects.select_related("cv", "job_offer"), pk=pk, user=request.user
        )
        return analysis, None

    def get(self, request, pk, kind):
        analysis, error = self._get(request, pk, kind)
        if error:
            return error
        language = _request_language(request)
        return Response({"data": (analysis.extras or {}).get(f"{kind}:{language}")})

    def post(self, request, pk, kind):
        analysis, error = self._get(request, pk, kind)
        if error:
            return error
        refresh = str(request.data.get("refresh", "")).lower() in ("1", "true", "yes")
        data = get_or_generate_extra(analysis, kind, _request_language(request), refresh=refresh)
        return Response({"data": data})


class AnalysisReportExportView(APIView):
    format_kwarg = None

    def get(self, request, pk):
        analysis = get_object_or_404(
            Analysis.objects.select_related("job_offer"), pk=pk, user=request.user
        )
        content = build_report_docx(analysis, _request_language(request))
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="rapport_analyse_{analysis.id}.docx"'
        return response


class JobOfferImportView(APIView):
    throttle_classes = (JobImportThrottle,)

    def post(self, request):
        serializer = JobImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = import_job_offer(serializer.validated_data["url"])
        except JobImportError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception:  # noqa: BLE001
            return Response(
                {"detail": "Impossible de récupérer la page : copiez-collez le texte de l'offre."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(result)


KEEP_JOB_SEARCHES = 10


class JobSearchSourcesView(APIView):
    def get(self, request):
        return Response(available_sources())


class JobSearchFeaturedView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response(featured_jobs())


class JobSearchListCreateView(PostThrottledMixin, APIView):
    def get(self, request):
        qs = JobSearch.objects.filter(user=request.user)[:KEEP_JOB_SEARCHES]
        return Response(JobSearchSummarySerializer(qs, many=True).data)

    def post(self, request):
        serializer = JobSearchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cv = get_object_or_404(CV, pk=data["cv_id"], user=request.user)
        if not cv.extracted_text.strip():
            return Response(
                {"detail": "Ce CV ne contient pas de texte exploitable."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        level = data.get("level") or request.user.level or Analysis.Level.JUNIOR
        try:
            outcome = find_matching_jobs(
                cv=cv,
                level=level,
                target_role=request.user.target_job_title,
                location=data["location"].strip(),
                remote_only=data["remote_only"],
                custom_query=data["custom_query"],
                language=data["language"],
                sources=data.get("sources") or None,
            )
        except JobSearchError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        source_stats = outcome["stats"]["sources"]
        if source_stats and all(s["error"] for s in source_stats.values()):
            return Response(
                {"detail": "Aucune source d'offres n'a répondu. Réessayez dans quelques minutes."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        search = JobSearch.objects.create(
            user=request.user,
            cv=cv,
            params={
                "location": data["location"].strip(),
                "remote_only": data["remote_only"],
                "custom_query": data["custom_query"],
                "level": level,
                "language": data["language"],
            },
            plan=outcome["plan"],
            results=outcome["results"],
            stats=outcome["stats"],
            ai_mode=outcome["ai_mode"],
        )
        stale = JobSearch.objects.filter(user=request.user).values_list("pk", flat=True)[
            KEEP_JOB_SEARCHES:
        ]
        JobSearch.objects.filter(pk__in=list(stale)).delete()
        return Response(JobSearchSerializer(search).data, status=status.HTTP_201_CREATED)


class JobSearchDetailView(APIView):
    def get(self, request, pk):
        search = get_object_or_404(JobSearch, pk=pk, user=request.user)
        return Response(JobSearchSerializer(search).data)

    def delete(self, request, pk):
        get_object_or_404(JobSearch, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SystemStatusView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        from adminpanel.models import SiteSettings

        site = SiteSettings.load()
        ai = get_ai_service()
        quota = site.effective_daily_quota
        payload = {
            "llm_mode": "mock" if ai.use_mock else "live",
            "forced_mock": ai.forced_mock,
            "provider": ai.provider,
            "model": "" if ai.use_mock else ai.model,
            "daily_quota": quota,
            "announcement": site.announcement,
            "registration_open": site.allow_registration,
        }
        if request.user and request.user.is_authenticated:
            payload["quota_remaining"] = quota_remaining(request.user) if quota > 0 else None
        return Response(payload)


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


class AnalysisImproveCVView(PostThrottledMixin, APIView):
    def post(self, request, pk):
        analysis = get_object_or_404(Analysis, pk=pk, user=request.user)
        return Response(improve_cv_suggestions(analysis, _request_language(request)))


class AnalysisCoverLetterView(PostThrottledMixin, APIView):
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
            letter = create_cover_letter(
                analysis, tone, serializer.validated_data.get("language") or "fr"
            )
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
        timeline_qs = qs.select_related("job_offer").order_by("-created_at")[:30]
        timeline = [
            {
                "id": a.id,
                "score": a.score,
                "date": a.created_at,
                "job_title": a.job_offer.title,
                "cv_id": a.cv_id,
            }
            for a in reversed(list(timeline_qs))
        ]
        return Response(
            {
                "analyses_count": count,
                "average_score": avg,
                "by_status": by_status,
                "recent": AnalysisSerializer(recent, many=True).data,
                "timeline": timeline,
            }
        )
