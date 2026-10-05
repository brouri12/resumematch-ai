import json
from unittest import mock

from django.test import TestCase, override_settings

from analyses.models import LLMCacheEntry
from services.ai_service import AIService
from services.ats_service import _column_split_lines, evaluate_ats
from services.job_import_service import JobImportError, _assert_public_url, parse_job_page

GOOD_CV = (
    "jean@example.com +33 6 12 34 56 78\nExpérience\nFormation\nCompétences\n"
    "Python Django Docker " + "mot " * 200
)


class ATSTests(TestCase):
    def test_clean_cv_scores_high(self):
        result = evaluate_ats(GOOD_CV, {"pages": 1, "column_ratio": 0.0}, ["Python", "Docker"])
        self.assertGreaterEqual(result["score"], 90)
        self.assertEqual(result["keywords"]["found"], ["Python", "Docker"])

    def test_problematic_layout_is_penalized(self):
        result = evaluate_ats(
            "trop court",
            {"pages": 4, "images": 5, "tables": 2, "column_ratio": 0.6},
            ["Kubernetes"],
            language="en",
        )
        self.assertLess(result["score"], 40)
        statuses = {c["id"]: c["status"] for c in result["checks"]}
        self.assertEqual(statuses["text"], "fail")
        self.assertEqual(statuses["columns"], "fail")
        self.assertEqual(statuses["keywords"], "fail")
        self.assertEqual(result["checks"][0]["label"], "Extractable text")

    def test_keyword_match_requires_word_boundaries(self):
        result = evaluate_ats(GOOD_CV + " javascript", {}, ["Java"])
        self.assertEqual(result["keywords"]["missing"], ["Java"])

    def test_column_detection(self):
        two_columns = [
            {"top": 10 * i, "x0": 20, "x1": 200} for i in range(10)
        ] + [{"top": 10 * i, "x0": 330, "x1": 560} for i in range(10)]
        split, total = _column_split_lines(two_columns, 600)
        self.assertEqual((split, total), (10, 10))


class JobImportTests(TestCase):
    def test_json_ld_job_posting_is_preferred(self):
        posting = {
            "@context": "https://schema.org",
            "@graph": [
                {"@type": "Organization", "name": "Ignore"},
                {
                    "@type": "JobPosting",
                    "title": "Développeur Python",
                    "hiringOrganization": {"name": "Acme"},
                    "description": "<p>Nous cherchons un <b>développeur</b> Django &amp; Docker.</p>",
                },
            ],
        }
        page = (
            "<html><head><title>Jobs</title>"
            f'<script type="application/ld+json">{json.dumps(posting)}</script>'
            "</head><body><nav>Menu</nav><p>Autre</p></body></html>"
        )
        result = parse_job_page(page)
        self.assertEqual(result["source"], "json-ld")
        self.assertEqual(result["title"], "Développeur Python")
        self.assertEqual(result["company"], "Acme")
        self.assertIn("Django & Docker", result["text"])

    def test_html_fallback_skips_navigation_and_scripts(self):
        page = (
            "<html><head><title>Offre</title><script>var x=1</script></head>"
            "<body><nav>Menu</nav><h1>Data Engineer</h1><p>Spark et SQL.</p><footer>©</footer></body></html>"
        )
        result = parse_job_page(page)
        self.assertEqual(result["source"], "html")
        self.assertIn("Spark et SQL.", result["text"])
        self.assertNotIn("Menu", result["text"])
        self.assertNotIn("var x", result["text"])

    def test_private_addresses_are_rejected(self):
        for url in ("http://127.0.0.1/admin", "http://10.0.0.1/", "ftp://example.com/", "http://169.254.169.254/"):
            with self.assertRaises(JobImportError, msg=url):
                _assert_public_url(url)


def _openai_response(payload: dict):
    response = mock.Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"choices": [{"message": {"content": json.dumps(payload)}}]}
    return response


@override_settings(LLM_PROVIDER="openai", LLM_API_KEY="test-key", LLM_MODEL="gpt-test", LLM_MAX_RETRIES=2)
class AIServiceLiveTests(TestCase):
    @mock.patch("httpx.post")
    def test_job_parsing_is_cached_after_first_live_call(self, post):
        post.return_value = _openai_response({"required_skills": ["Python"], "title": "Dev"})
        first = AIService()
        self.assertEqual(first.analyze_job_offer("Offre Python").required_skills, ["Python"])
        self.assertEqual(first.mode, "live")
        self.assertEqual(LLMCacheEntry.objects.filter(kind="job").count(), 1)

        second = AIService()
        self.assertEqual(second.analyze_job_offer("Offre Python").title, "Dev")
        self.assertEqual(post.call_count, 1)
        self.assertEqual(second.cache_hits, 1)

    @mock.patch("time.sleep")
    @mock.patch("httpx.post")
    def test_invalid_json_retries_then_falls_back_to_mock(self, post, _sleep):
        bad = mock.Mock()
        bad.raise_for_status.return_value = None
        bad.json.return_value = {"choices": [{"message": {"content": "not json"}}]}
        post.return_value = bad
        ai = AIService()
        result = ai.generate_interview_prep("cv", "offre", "junior", ["Docker"], "fr")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(ai.mode, "mock")
        self.assertTrue(result.questions)

    @mock.patch("httpx.post")
    def test_generation_is_not_cached(self, post):
        post.return_value = _openai_response({"content": "Bonjour"})
        ai = AIService()
        ai.generate_cover_letter("cv", "offre", "junior", "formal")
        ai.generate_cover_letter("cv", "offre", "junior", "formal")
        self.assertEqual(post.call_count, 2)
        self.assertFalse(LLMCacheEntry.objects.exists())

    @mock.patch("httpx.post")
    def test_language_is_passed_to_prompt(self, post):
        post.return_value = _openai_response({"steps": [{"skill": "Docker", "priority": "high"}]})
        plan = AIService().generate_learning_plan(["Docker"], "junior", language="en")
        prompt = post.call_args.kwargs["json"]["messages"][0]["content"]
        self.assertIn("English", prompt)
        self.assertEqual(plan.steps[0].priority, "haute")
