from django.urls import path

from .views import (
    AnalysisDeleteView,
    AnalysisListView,
    CacheView,
    JobListView,
    OverviewView,
    SettingsView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    path("overview/", OverviewView.as_view(), name="admin-overview"),
    path("users/", UserListView.as_view(), name="admin-users"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="admin-user-detail"),
    path("analyses/", AnalysisListView.as_view(), name="admin-analyses"),
    path("analyses/<int:pk>/", AnalysisDeleteView.as_view(), name="admin-analysis-delete"),
    path("jobs/", JobListView.as_view(), name="admin-jobs"),
    path("cache/", CacheView.as_view(), name="admin-cache"),
    path("settings/", SettingsView.as_view(), name="admin-settings"),
]
