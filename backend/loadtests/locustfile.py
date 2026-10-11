"""Load test for the ResumeMatch AI API.

Run against a server seeded with `python manage.py seed_demo` and relaxed throttles, e.g.:
    locust -f loadtests/locustfile.py --host http://127.0.0.1:8765 --headless -u 20 -r 5 -t 60s
"""

import itertools
import random

from locust import HttpUser, between, task

DEMO_USERS = itertools.cycle(["karim", "sarah", "lea"])
DEMO_PASSWORD = "Demo1234!"

OFFER = (
    "Développeur Full-Stack Python / React. Compétences : Python, Django, React, "
    "JavaScript, PostgreSQL, Docker, Git, CI/CD. 2 ans d'expérience minimum."
)


class Candidate(HttpUser):
    wait_time = between(0.5, 2)

    def on_start(self):
        response = self.client.post(
            "/api/auth/login",
            json={"username": next(DEMO_USERS), "password": DEMO_PASSWORD},
            name="POST /api/auth/login",
        )
        self.client.headers["Authorization"] = f"Bearer {response.json()['access']}"
        self.cv_ids = [cv["id"] for cv in self._results(self.client.get("/api/cvs/", name="GET /api/cvs/"))]
        self.analysis_ids = [
            a["id"] for a in self._results(self.client.get("/api/analyses/", name="GET /api/analyses/"))
        ]

    @staticmethod
    def _results(response):
        data = response.json()
        return data.get("results", data) if isinstance(data, dict) else data

    @task(5)
    def dashboard(self):
        self.client.get("/api/dashboard/stats/", name="GET /api/dashboard/stats/")

    @task(4)
    def history(self):
        self.client.get("/api/analyses/?page=1&page_size=10", name="GET /api/analyses/")

    @task(3)
    def analysis_detail(self):
        if self.analysis_ids:
            self.client.get(f"/api/analyses/{random.choice(self.analysis_ids)}/", name="GET /api/analyses/:id/")

    @task(3)
    def profile(self):
        self.client.get("/api/auth/me", name="GET /api/auth/me")

    @task(2)
    def system_status(self):
        self.client.get("/api/system/status/", name="GET /api/system/status/")

    @task(2)
    def job_sources(self):
        self.client.get("/api/job-search/sources", name="GET /api/job-search/sources")

    @task(1)
    def run_analysis(self):
        if not self.cv_ids:
            return
        response = self.client.post(
            "/api/analyses/",
            json={"cv_id": random.choice(self.cv_ids), "job_offer_text": OFFER, "title": "Load test"},
            name="POST /api/analyses/",
        )
        if response.ok:
            self.analysis_ids.append(response.json()["id"])

    @task(1)
    def health(self):
        self.client.get("/api/health/", name="GET /api/health/")
