from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from analyses.models import Analysis, AnalysisJob, CoverLetter, JobOffer, LLMCacheEntry
from cvs.models import CV
from services.ai_service import get_ai_service

from .models import SiteSettings
from .serializers import (
    AdminAnalysisSerializer,
    AdminJobSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    SiteSettingsSerializer,
)

User = get_user_model()


def _paginate(request, qs, serializer_cls):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except ValueError:
        page = 1
    try:
        page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
    except ValueError:
        page_size = 20
    total = qs.count()
    start = (page - 1) * page_size
    return Response(
        {
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": serializer_cls(qs[start : start + page_size], many=True).data,
        }
    )


class AdminAPIView(APIView):
    permission_classes = (IsAdminUser,)


class OverviewView(AdminAPIView):
    def get(self, request):
        now = timezone.now()
        since_14 = now - timedelta(days=13)
        analyses = Analysis.objects.all()
        per_day = {
            row["day"].isoformat(): row["n"]
            for row in analyses.filter(created_at__date__gte=since_14.date())
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(n=Count("id"))
        }
        days = [(since_14 + timedelta(days=i)).date().isoformat() for i in range(14)]
        ai = get_ai_service()
        return Response(
            {
                "users": {
                    "total": User.objects.count(),
                    "active": User.objects.filter(is_active=True).count(),
                    "staff": User.objects.filter(is_staff=True).count(),
                    "new_7d": User.objects.filter(date_joined__gte=now - timedelta(days=7)).count(),
                },
                "analyses": {
                    "total": analyses.count(),
                    "last_24h": analyses.filter(created_at__gte=now - timedelta(days=1)).count(),
                    "average_score": round(analyses.aggregate(v=Avg("score"))["v"] or 0, 1),
                    "by_status": {
                        c: analyses.filter(status=c).count() for c, _ in Analysis.Status.choices
                    },
                    "by_level": {
                        c: analyses.filter(level=c).count() for c, _ in Analysis.Level.choices
                    },
                    "by_ai_mode": {
                        (row["ai_mode"] or "unknown"): row["n"]
                        for row in analyses.values("ai_mode").annotate(n=Count("id"))
                    },
                    "per_day": [{"day": d, "count": per_day.get(d, 0)} for d in days],
                },
                "cvs": CV.objects.count(),
                "job_offers": JobOffer.objects.count(),
                "cover_letters": CoverLetter.objects.count(),
                "jobs": {
                    s: AnalysisJob.objects.filter(state=s).count() for s, _ in AnalysisJob.State.choices
                },
                "cache_entries": LLMCacheEntry.objects.count(),
                "llm": {
                    "mode": "mock" if ai.use_mock else "live",
                    "forced_mock": ai.forced_mock,
                    "provider": ai.provider,
                    "model": ai.model,
                    "has_api_key": bool(ai.api_key.strip()),
                },
                "top_missing_skills": _top_missing_skills(),
            }
        )


def _top_missing_skills(limit: int = 8) -> list[dict]:
    counts: dict[str, int] = {}
    for skills in Analysis.objects.values_list("missing_skills", flat=True)[:1000]:
        for skill in skills or []:
            counts[skill] = counts.get(skill, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"skill": s, "count": n} for s, n in ranked]


class UserListView(AdminAPIView):
    def get(self, request):
        qs = User.objects.annotate(
            analyses_count=Count("analyses", distinct=True),
            cvs_count=Count("cvs", distinct=True),
            average_score=Avg("analyses__score"),
        ).order_by("-date_joined")
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        role = request.query_params.get("role")
        if role == "staff":
            qs = qs.filter(is_staff=True)
        elif role == "inactive":
            qs = qs.filter(is_active=False)
        return _paginate(request, qs, AdminUserSerializer)


class UserDetailView(AdminAPIView):
    def _get(self, pk):
        return get_object_or_404(
            User.objects.annotate(
                analyses_count=Count("analyses", distinct=True),
                cvs_count=Count("cvs", distinct=True),
                average_score=Avg("analyses__score"),
            ),
            pk=pk,
        )

    def patch(self, request, pk):
        user = self._get(pk)
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if user == request.user and (
            serializer.validated_data.get("is_active") is False
            or serializer.validated_data.get("is_staff") is False
        ):
            return Response(
                {"detail": "Vous ne pouvez pas retirer vos propres droits."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Seul un super-administrateur peut modifier ce compte."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer.save()
        return Response(AdminUserSerializer(self._get(pk)).data)

    def delete(self, request, pk):
        user = self._get(pk)
        if user == request.user:
            return Response(
                {"detail": "Vous ne pouvez pas supprimer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "Seul un super-administrateur peut supprimer ce compte."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnalysisListView(AdminAPIView):
    def get(self, request):
        qs = Analysis.objects.select_related("user", "job_offer").order_by("-created_at")
        params = request.query_params
        if params.get("search"):
            s = params["search"]
            qs = qs.filter(
                Q(job_offer__title__icontains=s)
                | Q(job_offer__company__icontains=s)
                | Q(user__username__icontains=s)
            )
        for field in ("status", "level", "ai_mode"):
            if params.get(field):
                qs = qs.filter(**{field: params[field]})
        if params.get("user"):
            qs = qs.filter(user_id=params["user"])
        return _paginate(request, qs, AdminAnalysisSerializer)


class AnalysisDeleteView(AdminAPIView):
    def delete(self, request, pk):
        get_object_or_404(Analysis, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JobListView(AdminAPIView):
    def get(self, request):
        qs = AnalysisJob.objects.select_related("user", "analysis").order_by("-created_at")
        if request.query_params.get("state"):
            qs = qs.filter(state=request.query_params["state"])
        return _paginate(request, qs, AdminJobSerializer)

    def delete(self, request):
        """Purge finished jobs (done/failed); running ones are kept."""
        deleted, _ = AnalysisJob.objects.filter(
            state__in=[AnalysisJob.State.DONE, AnalysisJob.State.FAILED]
        ).delete()
        return Response({"deleted": deleted})


class CacheView(AdminAPIView):
    def delete(self, request):
        deleted, _ = LLMCacheEntry.objects.all().delete()
        return Response({"deleted": deleted})


class SettingsView(AdminAPIView):
    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def put(self, request):
        site = SiteSettings.load()
        serializer = SiteSettingsSerializer(site, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SiteSettingsSerializer(site).data)
