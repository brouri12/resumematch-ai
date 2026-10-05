from django.test import TestCase

from services.scoring import normalize_skill, skill_overlap_score


class ScoringTests(TestCase):
    def test_synonyms(self):
        self.assertEqual(normalize_skill("JS"), normalize_skill("JavaScript"))
        self.assertEqual(normalize_skill("Postgres"), normalize_skill("PostgreSQL"))
        self.assertEqual(normalize_skill("k8s"), normalize_skill("Kubernetes"))

    def test_overlap_score(self):
        score, present, missing = skill_overlap_score(
            ["Python", "JS", "Git"],
            ["Python", "JavaScript", "Docker"],
        )
        self.assertAlmostEqual(score, 66.7, places=0)
        self.assertIn("Python", present)
        self.assertTrue(any("JavaScript" in p or "javascript" in p.lower() for p in present) or "JS" in str(present))
        self.assertTrue(any("docker" in m.lower() for m in missing))
