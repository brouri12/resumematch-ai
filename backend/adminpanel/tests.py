import os
import shutil
import tempfile
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from analyses.models import Analysis, LLMCacheEntry
from services.ai_service import AIService
from services.pdf_service import extract_text_from_pdf

from .demo_data import PERSONAS, build_pdf
from .models import SiteSettings

TEST_MEDIA = tempfile.mkdtemp(prefix="rm-admin-media-")


@override_settings(LLM_API_KEY="", ANALYSIS_JOBS_SYNC=True, MEDIA_ROOT=TEST_MEDIA, ANALYSIS_DAILY_QUOTA=20)
class AdminPanelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.get(username="admin")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_seed_creates_personas_with_varied_statuses(self):
        self.assertEqual(Analysis.objects.filter(user__username="karim").count(), 4)
        statuses = set(Analysis.objects.values_list("status", flat=True))
        self.assertTrue({"to_apply", "applied", "interview", "offer", "rejected"} <= statuses)

    def test_seed_is_idempotent_and_reset_recreates(self):
        call_command("seed_demo", stdout=StringIO())
        self.assertEqual(User.objects.filter(username="sarah").count(), 1)
        call_command("seed_demo", "--reset", stdout=StringIO())
        self.assertEqual(Analysis.objects.filter(user__username="sarah").count(), len(PERSONAS[0]["offers"]))

    def test_non_staff_is_forbidden(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="karim"))
        self.assertEqual(client.get("/api/admin-panel/overview/").status_code, 403)

    def test_overview_aggregates(self):
        data = self.client.get("/api/admin-panel/overview/").data
        self.assertEqual(data["users"]["total"], 4)
        self.assertEqual(data["analyses"]["total"], 9)
        self.assertEqual(len(data["analyses"]["per_day"]), 14)
        self.assertTrue(data["top_missing_skills"])

    def test_user_search_and_toggle_active(self):
        res = self.client.get("/api/admin-panel/users/?search=lea")
        self.assertEqual(res.data["count"], 1)
        lea = res.data["results"][0]
        self.assertEqual(lea["analyses_count"], 2)
        res = self.client.patch(f"/api/admin-panel/users/{lea['id']}/", {"is_active": False}, format="json")
        self.assertFalse(res.data["is_active"])

    def test_admin_cannot_demote_or_delete_self(self):
        url = f"/api/admin-panel/users/{self.admin.id}/"
        self.assertEqual(self.client.patch(url, {"is_staff": False}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(url).status_code, 400)

    def test_delete_user_cascades(self):
        sarah = User.objects.get(username="sarah")
        self.assertEqual(self.client.delete(f"/api/admin-panel/users/{sarah.id}/").status_code, 204)
        self.assertFalse(Analysis.objects.filter(user_id=sarah.id).exists())

    def test_analysis_filters_and_delete(self):
        res = self.client.get("/api/admin-panel/analyses/?status=offer")
        self.assertEqual(res.data["count"], 1)
        analysis_id = res.data["results"][0]["id"]
        self.assertEqual(self.client.delete(f"/api/admin-panel/analyses/{analysis_id}/").status_code, 204)

    def test_jobs_list_and_purge(self):
        res = self.client.get("/api/admin-panel/jobs/?state=failed")
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(self.client.delete("/api/admin-panel/jobs/").data["deleted"], 2)

    def test_clear_cache(self):
        LLMCacheEntry.objects.create(key="x" * 64, kind="cv", data={})
        self.assertEqual(self.client.delete("/api/admin-panel/cache/").data["deleted"], 1)

    def test_settings_quota_applies_immediately(self):
        self.client.put("/api/admin-panel/settings/", {"analysis_daily_quota": 0}, format="json")
        karim = APIClient()
        karim.force_authenticate(User.objects.get(username="karim"))
        cv_id = User.objects.get(username="karim").cvs.first().id
        payload = {"cv_id": cv_id, "job_offer_text": "Poste: Dev Python Django Docker requis."}
        self.assertEqual(karim.post("/api/analyses/", payload, format="json").status_code, 201)

        self.client.put("/api/admin-panel/settings/", {"analysis_daily_quota": 1}, format="json")
        res = karim.post("/api/analyses/", payload, format="json")
        self.assertEqual(res.status_code, 429)

    @override_settings(LLM_API_KEY="real-key")
    def test_force_mock_overrides_api_key(self):
        self.assertFalse(AIService().use_mock)
        self.client.put("/api/admin-panel/settings/", {"force_mock_ai": True}, format="json")
        self.assertTrue(AIService().use_mock)
        status = APIClient().get("/api/system/status/").data
        self.assertEqual(status["llm_mode"], "mock")
        self.assertTrue(status["forced_mock"])

    def test_registration_can_be_closed(self):
        self.client.put("/api/admin-panel/settings/", {"allow_registration": False, "announcement": "Maintenance"}, format="json")
        res = APIClient().post(
            "/api/auth/register",
            {"username": "new", "email": "n@x.fr", "password": "Str0ngPass!x", "password_confirm": "Str0ngPass!x"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(APIClient().get("/api/system/status/").data["announcement"], "Maintenance")
        self.assertFalse(SiteSettings.load().allow_registration)

    def test_me_exposes_is_staff(self):
        self.assertTrue(self.client.get("/api/auth/me").data["is_staff"])


class PdfBuilderTests(TestCase):
    def test_generated_pdf_is_readable_with_accents_and_pages(self):
        lines = [("Léa – Expérience (Java)", 12)] + [(f"Ligne {i}", 10) for i in range(80)]
        fd, path = tempfile.mkstemp(suffix=".pdf")
        with os.fdopen(fd, "wb") as fh:
            fh.write(build_pdf(lines))
        try:
            text = extract_text_from_pdf(path)
        finally:
            os.remove(path)
        self.assertIn("Léa – Expérience (Java)", text)
        self.assertIn("Ligne 79", text)
