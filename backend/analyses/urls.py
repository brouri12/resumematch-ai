from django.urls import path

from .views import (
    AnalysisAsyncCreateView,
    AnalysisCompareView,
    AnalysisCoverLetterView,
    AnalysisDetailView,
    AnalysisExtraView,
    AnalysisImproveCVView,
    AnalysisJobDetailView,
    AnalysisListCreateView,
    AnalysisReportExportView,
    AnalysisStatusView,
    CoverLetterDetailView,
    CoverLetterExportView,
    DashboardStatsView,
    JobOfferImportView,
    JobSearchDetailView,
    JobSearchFeaturedView,
    JobSearchListCreateView,
    JobSearchSourcesView,
    SystemStatusView,
)

urlpatterns = [
    path("system/status/", SystemStatusView.as_view(), name="system-status"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("job-offers/import-url", JobOfferImportView.as_view(), name="job-offer-import"),
    path("job-search/sources", JobSearchSourcesView.as_view(), name="job-search-sources"),
    path("job-search/featured", JobSearchFeaturedView.as_view(), name="job-search-featured"),
    path("job-search/", JobSearchListCreateView.as_view(), name="job-search"),
    path("job-search/<int:pk>/", JobSearchDetailView.as_view(), name="job-search-detail"),
    path("analyses/", AnalysisListCreateView.as_view(), name="analysis-list-create"),
    path("analyses/async", AnalysisAsyncCreateView.as_view(), name="analysis-async"),
    path("analyses/compare", AnalysisCompareView.as_view(), name="analysis-compare"),
    path("analysis-jobs/<int:pk>/", AnalysisJobDetailView.as_view(), name="analysis-job-detail"),
    path(
        "analyses/<int:pk>/extras/<str:kind>",
        AnalysisExtraView.as_view(),
        name="analysis-extra",
    ),
    path(
        "analyses/<int:pk>/report",
        AnalysisReportExportView.as_view(),
        name="analysis-report",
    ),
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
