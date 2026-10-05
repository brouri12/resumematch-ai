from django.urls import path

from .views import CVDetailView, CVListCreateView

urlpatterns = [
    path("", CVListCreateView.as_view(), name="cv-list-create"),
    path("<int:pk>/", CVDetailView.as_view(), name="cv-detail"),
]
