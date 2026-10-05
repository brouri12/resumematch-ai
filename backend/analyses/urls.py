from django.urls import path

from .views import (
    AnalysisCoverLetterView,
    AnalysisDetailView,
    AnalysisImproveCVView,
    AnalysisListCreateView,
    AnalysisStatusView,
    CoverLetterDetailView,
    CoverLetterExportView,
    DashboardStatsView,
)

urlpatterns = [
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("analyses/", AnalysisListCreateView.as_view(), name="analysis-list-create"),
    path("analyses/<int:pk>/", AnalysisDetailView.as_view(), name="analysis-detail"),
    path(
        "analyses/<int:pk>/status",
        AnalysisStatusView.as_view(),
        name="analysis-status",
    ),
    path(
        "analyses/<int:pk>/improve-cv",
        AnalysisImproveCVView.as_view(),
        name="analysis-improve-cv",
    ),
    path(
        "analyses/<int:pk>/cover-letter",
        AnalysisCoverLetterView.as_view(),
        name="analysis-cover-letter",
    ),
    path(
        "cover-letters/<int:pk>/export",
        CoverLetterExportView.as_view(),
        name="cover-letter-export",
    ),
    path(
        "cover-letters/<int:pk>/",
        CoverLetterDetailView.as_view(),
        name="cover-letter-detail",
    ),
]
