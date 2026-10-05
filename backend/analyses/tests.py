import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from cvs.models import CV

from .models import Analysis, AnalysisJob

CV_TEXT = """Jean Dupont
jean.dupont@example.com · +33 6 12 34 56 78
Expérience
Développement d'une API REST en Python et Django pour 2000 utilisateurs
Mise en place de tests automatisés et intégration continue avec Git
Formation
Master Informatique
Compétences
Python, Django, SQL, Git, React
""" + "Projet de fin d'études sur la recommandation de contenus. " * 10

JOB_TEXT = (
    "Poste: Développeur Backend\nEntreprise: Acme\n"
    "Nous recherchons un développeur Python Django avec Docker, SQL et Kubernetes."
)


TEST_MEDIA = tempfile.mkdtemp(prefix="rm-test-media-")


@override_settings(
    LLM_API_KEY="", ANALYSIS_JOBS_SYNC=True, ANALYSIS_DAILY_QUOTA=20, MEDIA_ROOT=TEST_MEDIA
)
class AnalysisApiTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="alice", password="pass12345!")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.cv = CV.objects.create(
            user=self.user,
            file=SimpleUploadedFile("cv.pdf", b"%PDF-1.4 fake"),
            original_filename="cv.pdf",
            extracted_text=CV_TEXT,
        )

    def _create(self, **extra):
        payload = {"cv_id": self.cv.id, "job_offer_text": JOB_TEXT, "level": "junior", **extra}
        return self.client.post("/api/analyses/", payload, format="json")

    def test_create_analysis_records_mock_mode_and_language(self):
        res = self._create(language="en")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["ai_mode"], "mock")
        self.assertEqual(res.data["language"], "en")
        self.assertIn("Docker", res.data["competences_manquantes"])

    def test_async_job_completes_and_exposes_analysis(self):
        res = self.client.post(
            "/api/analyses/async",
            {"cv_id": self.cv.id, "job_offer_text": JOB_TEXT},
            format="json",
        )
        self.assertEqual(res.status_code, 202)
        job = self.client.get(f"/api/analysis-jobs/{res.data['id']}/").data
        self.assertEqual(job["state"], AnalysisJob.State.DONE)
        self.assertEqual(job["progress"], 100)
        self.assertIsNotNone(job["analysis_id"])

    def test_compare_creates_one_job_per_offer(self):
        res = self.client.post(
            "/api/analyses/compare",
            {
                "cv_id": self.cv.id,
                "offers": [
                    {"job_offer_text": JOB_TEXT, "title": "A"},
                    {"job_offer_text": JOB_TEXT + " React TypeScript", "title": "B"},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 202)
        self.assertEqual(len(res.data["jobs"]), 2)
        self.assertEqual(Analysis.objects.filter(user=self.user).count(), 2)

    @override_settings(ANALYSIS_DAILY_QUOTA=1)
    def test_daily_quota_blocks_extra_analyses(self):
        self.assertEqual(self._create().status_code, 201)
        res = self._create()
        self.assertEqual(res.status_code, 429)

    def test_extras_are_generated_then_cached(self):
        analysis_id = self._create().data["id"]
        for kind in ("interview_prep", "cv_rewrite", "learning_plan", "ats"):
            empty = self.client.get(f"/api/analyses/{analysis_id}/extras/{kind}?language=fr")
            self.assertIsNone(empty.data["data"])
            res = self.client.post(
                f"/api/analyses/{analysis_id}/extras/{kind}", {"language": "fr"}, format="json"
            )
            self.assertEqual(res.status_code, 200, kind)
            self.assertTrue(res.data["data"], kind)
            cached = self.client.get(f"/api/analyses/{analysis_id}/extras/{kind}?language=fr")
            self.assertEqual(cached.data["data"], res.data["data"])

        interview = Analysis.objects.get(pk=analysis_id).extras["interview_prep:fr"]
        self.assertTrue(any(q["category"] == "lacune" for q in interview["questions"]))

    def test_unknown_extra_kind_is_404(self):
        analysis_id = self._create().data["id"]
        res = self.client.post(f"/api/analyses/{analysis_id}/extras/nope", {}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_report_export_is_docx(self):
        analysis_id = self._create().data["id"]
        res = self.client.get(f"/api/analyses/{analysis_id}/report?language=fr")
        self.assertEqual(res.status_code, 200)
        self.assertIn("wordprocessingml", res["Content-Type"])
        self.assertTrue(res.content.startswith(b"PK"))

    def test_dashboard_timeline_is_chronological(self):
        self._create()
        self._create()
        timeline = self.client.get("/api/dashboard/stats/").data["timeline"]
        self.assertEqual(len(timeline), 2)
        self.assertLessEqual(timeline[0]["date"], timeline[1]["date"])

    def test_system_status_reports_mock_mode(self):
        res = APIClient().get("/api/system/status/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["llm_mode"], "mock")

    def test_other_users_cannot_read_jobs_or_extras(self):
        analysis_id = self._create().data["id"]
        other = APIClient()
        other.force_authenticate(User.objects.create_user(username="bob", password="pass12345!"))
        res = other.post(f"/api/analyses/{analysis_id}/extras/ats", {}, format="json")
        self.assertEqual(res.status_code, 404)

    @mock.patch("analyses.views.import_job_offer")
    def test_import_url_endpoint(self, import_mock):
        import_mock.return_value = {"title": "Dev", "company": "Acme", "text": "x" * 200, "source": "json-ld"}
        res = self.client.post(
            "/api/job-offers/import-url", {"url": "https://jobs.example.com/1"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["company"], "Acme")
