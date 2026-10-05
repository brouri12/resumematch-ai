import shutil
import tempfile
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from analyses.models import JobSearch
from cvs.models import CV
from services import job_search_service as jss
from services.job_search_service import (
    _listing,
    collect_listings,
    location_matches,
    score_listing,
    title_similarity,
)

CV_TEXT = (
    "Karim Dupont\nDéveloppeur Full-Stack junior\nCompétences: Python, Django, React, "
    "PostgreSQL, Docker, Git\n" + "Projet web en équipe. " * 20
)
TEST_MEDIA = tempfile.mkdtemp(prefix="rm-test-jobsearch-")
LOCMEM_CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    "jobs": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "jobs-test"},
}
NO_KEYED_SOURCES = {
    "ADZUNA_APP_ID": "",
    "ADZUNA_APP_KEY": "",
    "FRANCE_TRAVAIL_CLIENT_ID": "",
    "FRANCE_TRAVAIL_CLIENT_SECRET": "",
}


def offer(source, ext_id, title, description, location="Remote", remote=True, company="Acme"):
    return _listing(
        source,
        ext_id,
        title=title,
        company=company,
        location=location,
        remote=remote,
        url=f"https://example.com/{source}/{ext_id}",
        description=description,
    )


FEED_A = [
    offer("remotive", 1, "Full Stack Developer", "<p>React and Django, PostgreSQL, Docker.</p>"),
    offer("remotive", 2, "Freelance Copywriter", "Write marketing content in English."),
    offer("remotive", 3, "Backend Engineer", "Python, Django REST, Git.", location="USA only"),
]
FEED_B = [
    offer("arbeitnow", "x", "Full-Stack Developer", "React, Django", company="acme "),
    offer("arbeitnow", "y", "Développeur Python", "Python Django Docker", location="Paris", remote=False),
]


class ScoringTests(SimpleTestCase):
    def test_skills_require_word_boundaries(self):
        listing = offer("t", 1, "Developer", "We use JavaScript and C++ daily.")
        _, matched = score_listing(listing, ["Java", "C++", "JavaScript"], [])
        self.assertEqual(matched, ["C++", "JavaScript"])

    def test_title_similarity_handles_aliases_and_compounds(self):
        self.assertEqual(title_similarity("Senior Fullstack Engineer", ["Full Stack Developer"]), 1.0)
        self.assertEqual(title_similarity("Développeur Python", ["Python Developer"]), 1.0)
        self.assertEqual(title_similarity("Copywriter", ["Full Stack Developer"]), 0.0)

    def test_relevant_offer_outscores_unrelated_one(self):
        skills, titles = ["React", "Django", "Docker"], ["Full Stack Developer"]
        good, _ = score_listing(FEED_A[0], skills, titles)
        bad, _ = score_listing(FEED_A[1], skills, titles)
        self.assertGreater(good, 80)
        self.assertEqual(bad, 0)

    def test_location_filter(self):
        worldwide, usa_only, paris_onsite = FEED_A[0], FEED_A[2], FEED_B[1]
        self.assertTrue(location_matches(worldwide, "Paris", False))
        self.assertFalse(location_matches(usa_only, "Paris", False))
        self.assertTrue(location_matches(paris_onsite, "paris", False))
        self.assertFalse(location_matches(paris_onsite, "", True))


@override_settings(CACHES=LOCMEM_CACHES, JOB_SEARCH_SOURCES=["remotive", "arbeitnow"], **NO_KEYED_SOURCES)
class CollectTests(SimpleTestCase):
    def test_dedupes_and_reports_failing_source(self):
        def boom(queries, location):
            raise RuntimeError("timeout")

        fetchers = {"remotive": lambda q, l: FEED_A, "arbeitnow": boom}
        with mock.patch.dict(jss.FETCHERS, fetchers):
            listings, stats = collect_listings(["Developer"])
        self.assertEqual(len(listings), 3)
        self.assertEqual(stats["arbeitnow"]["error"], "timeout")
        self.assertEqual(stats["remotive"]["count"], 3)

    def test_disabled_keyed_sources_are_skipped(self):
        with mock.patch.dict(jss.FETCHERS, {"remotive": lambda q, l: FEED_A}):
            _, stats = collect_listings(["Dev"], sources=["remotive", "adzuna"])
        self.assertEqual(list(stats), ["remotive"])

    def test_cache_avoids_refetching_feeds(self):
        with mock.patch.object(jss, "_http_get", return_value={"jobs": []}) as http:
            jss.fetch_remotive([], "")
            jss.fetch_remotive([], "")
        self.assertEqual(http.call_count, 1)


@override_settings(
    LLM_API_KEY="",
    CACHES=LOCMEM_CACHES,
    JOB_SEARCH_SOURCES=["remotive", "arbeitnow"],
    MEDIA_ROOT=TEST_MEDIA,
    **NO_KEYED_SOURCES,
)
class JobSearchApiTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="karim", password="pass12345!")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.cv = CV.objects.create(
            user=self.user,
            file=SimpleUploadedFile("cv.pdf", b"%PDF-1.4 fake"),
            original_filename="cv.pdf",
            extracted_text=CV_TEXT,
        )
        patcher = mock.patch.dict(
            jss.FETCHERS, {"remotive": lambda q, l: FEED_A, "arbeitnow": lambda q, l: FEED_B}
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_search_ranks_relevant_offers_and_persists(self):
        res = self.client.post(
            "/api/job-search/", {"cv_id": self.cv.id, "location": "Paris"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        body = res.json()
        titles = [r["title"] for r in body["results"]]
        self.assertEqual(titles[0], "Full Stack Developer")
        self.assertIn("Développeur Python", titles)
        self.assertNotIn("Freelance Copywriter", titles)
        self.assertNotIn("Backend Engineer", titles)  # USA only
        self.assertEqual(body["ai_mode"], "mock")
        self.assertTrue(body["results"][0]["reason"])
        self.assertEqual(body["stats"]["fetched"], 4)  # one cross-source duplicate removed
        self.assertEqual(body["params"]["location"], "Paris")

        listing = self.client.get("/api/job-search/").json()
        self.assertEqual(listing[0]["id"], body["id"])
        self.assertEqual(listing[0]["result_count"], len(body["results"]))

    def test_custom_query_leads_the_plan(self):
        res = self.client.post(
            "/api/job-search/", {"cv_id": self.cv.id, "custom_query": "Data Engineer"}, format="json"
        )
        self.assertEqual(res.json()["plan"]["target_titles"][0], "Data Engineer")

    def test_other_users_cannot_read_or_use_cv(self):
        search = JobSearch.objects.create(user=self.user, cv=self.cv)
        other = APIClient()
        other.force_authenticate(User.objects.create_user(username="eve", password="pass12345!"))
        self.assertEqual(other.get(f"/api/job-search/{search.id}/").status_code, 404)
        res = other.post("/api/job-search/", {"cv_id": self.cv.id}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_all_sources_down_returns_502(self):
        def boom(queries, location):
            raise RuntimeError("down")

        with mock.patch.dict(jss.FETCHERS, {"remotive": boom, "arbeitnow": boom}):
            res = self.client.post("/api/job-search/", {"cv_id": self.cv.id}, format="json")
        self.assertEqual(res.status_code, 502)
        self.assertFalse(JobSearch.objects.exists())

    def test_featured_is_public_tech_only_and_cached(self):
        calls = []

        def feed(queries, location):
            calls.append(1)
            return FEED_A

        anon = APIClient()
        with mock.patch.dict(jss.FETCHERS, {"remotive": feed, "arbeitnow": lambda q, l: FEED_B}):
            first = anon.get("/api/job-search/featured")
            anon.get("/api/job-search/featured")
        self.assertEqual(first.status_code, 200)
        titles = [o["title"] for o in first.json()["offers"]]
        self.assertNotIn("Freelance Copywriter", titles)
        self.assertEqual(titles[0], "Full Stack Developer")
        self.assertNotIn("description", first.json()["offers"][0])
        self.assertEqual(len(calls), 1)

    def test_keeps_only_recent_searches(self):
        for _ in range(12):
            JobSearch.objects.create(user=self.user, cv=self.cv)
        self.client.post("/api/job-search/", {"cv_id": self.cv.id}, format="json")
        self.assertEqual(JobSearch.objects.filter(user=self.user).count(), 10)
