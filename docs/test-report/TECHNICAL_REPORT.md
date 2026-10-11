# ResumeMatch AI — Technical Test Report

| | |
|---|---|
| **Project** | ResumeMatch AI (CVisionnaires AI) — CV / job-offer matching platform |
| **Version tested** | `main` @ `4c99d1f` (+ test tooling) |
| **Test date** | 11 October 2026 |
| **Environment** | Windows 11 · Python 3.14.3 · Django 5.2.18 · DRF 3.18.3 · Node 24.14.1 · React 19 · Vite 8 · SQLite · AI engine in *demo (mock) mode* |
| **Tools** | Django test runner + Coverage.py · Vitest · Playwright · Locust · Lighthouse |
| **Design** | UML class, use case and activity diagrams (PlantUML) — section 3 |
| **Prompts** | Development prompts given to the Cursor agent and LLM prompts embedded in the app — section 4 |

---

## 1. Executive summary

The full application (Django REST API + React SPA) was tested with **five complementary tools**, each covering a different level of the test pyramid: backend unit/integration tests, frontend unit tests, browser end-to-end tests, load testing and a quality audit.

| Indicator | Result |
|---|---|
| Automated functional tests executed | **86** (52 backend + 19 frontend + 15 end-to-end) |
| Functional tests passed | **86 / 86 (100 %)** |
| Backend code coverage | **83 %** of statements (2 169 statements, 369 missed) |
| Frontend unit coverage | **90 %** of `src/lib` business logic — **4.4 %** of the whole `src` tree |
| API under normal load (20 users) | **975 requests, 0 errors**, median **7 ms**, p95 **23 ms** |
| API under stress (100 users) | **4 517 requests**, median **10 ms**, p95 **97 ms**; the only errors (3.4 %) are intentional `429` quota responses |
| Lighthouse (desktop) | Performance **89–98**, Accessibility **100**, Best practices **100**, SEO **82–83** |
| Lighthouse (mobile landing page) | Performance **65** (LCP 7.1 s) |

**Verdict:** the application is functionally stable — every user journey works end to end, the API is fast and did not produce a single server error under load, and accessibility/best-practice audits are perfect. The main improvement areas are **mobile loading performance of the landing page**, **SEO metadata**, **unit tests for React components**, and the **cost of login under concurrent load**.

---

## 2. System under test

```
Browser (React 19 SPA, Vite)  ──/api──►  Django 5 + DRF (JWT auth)  ──►  SQLite
                                               │
                                               ├── AI service (Anthropic/OpenAI/Gemini, or deterministic mock)
                                               └── Job feeds (Remotive, Arbeitnow, Jobicy, Adzuna, France Travail)
```

| Module | Backend app | Main frontend pages |
|---|---|---|
| Authentication | `accounts` | Landing, Login, Register, Profile |
| CV management | `cvs`, `pdf_service`, `ats_service` | Analysis wizard (upload step) |
| Analysis engine | `analyses`, `ai_service`, `scoring` | Wizard, Results, History, Compare, Dashboard |
| Job search | `job_search_service`, `job_import_service` | Job search, Application board |
| Administration | `adminpanel` | Admin console |

**Test data:** the database was seeded with the built-in `seed_demo` command (1 admin, 3 candidates — Sarah, Karim, Léa — with CVs, analyses and cover letters). The developer database was backed up before testing and restored afterwards.

**AI mode:** no LLM API key is configured, so the AI engine ran in its deterministic *demo* mode. Response times therefore measure the application itself, not a third-party AI provider.

---

## 3. Software design — UML diagrams

The application was modelled with **PlantUML** from its actual code (Django models, API views, services and React pages). Diagram labels are in French, the project's working language. Sources are in `docs/conception/diagrammes/`; PNG and SVG renderings are in `docs/conception/images/`.

| Diagram | UML type | What it shows |
|---|---|---|
| Domain model | Class | Entities, attributes, enumerations, multiplicities and service dependencies |
| Visitor and Candidate | Use case | 21 use cases with include / extend relations and two external systems |
| Administration | Use case | Admin console features, all requiring an `is_staff` account |
| Run a CV / job analysis | Activity | Upload, quota check, asynchronous job and progress polling |
| AI job search | Activity | Search plan, 5 job sources in parallel, filtering and AI ranking |
| Registration, login and JWT session | Activity | Sign-up, login, automatic token refresh and logout |

### 3.1 Class diagram

![Class diagram — domain model](../conception/images/diagramme-classes.png)

| Class | Role |
|---|---|
| `User` | Extends Django's `AbstractUser` with a level (student / junior / senior) and a target job title |
| `CV` | Uploaded PDF, extracted text and structured skills (`parsed_data`) |
| `JobOffer` | Job offer pasted or imported from a URL, with its structured analysis |
| `Analysis` | Matches one CV with one offer: score 0–100, present / missing skills, recommendations, application status (Kanban) and career-toolkit results (`extras`) |
| `CoverLetter` | Cover letter generated for an analysis in a given tone |
| `AnalysisJob` | Asynchronous analysis task (pending → running → done / failed) with progress |
| `JobSearch` | AI job search: parameters, plan and ranked results (last 10 kept per user) |
| `LLMCacheEntry` | Cache of LLM answers, keyed by a hash of the prompt |
| `SiteSettings` | Configuration singleton: daily quota, forced demo mode, registrations, announcement |
| `AIService` | Provider-agnostic AI service with Pydantic validation and mock fallback |

A user **owns** (composition, `on_delete=CASCADE`) their CVs, offers, analyses, jobs and searches. An analysis links exactly one CV and one offer, while a CV or an offer can be reused in many analyses. An `AnalysisJob` produces at most one analysis, and a `JobSearch` is based on at most one CV (both `SET_NULL`).

### 3.2 Use case diagrams

![Use cases — Visitor and Candidate](../conception/images/cas-utilisation-candidat.png)

The **Visitor** can browse the landing page, register, log in and switch language. The **Candidate** inherits these and uses every analysis feature. *Run an analysis* includes skill extraction and score calculation; *import an offer from a URL* extends it; *export the cover letter* extends cover-letter generation. The AI provider (Claude, OpenAI, Gemini or the demo engine) and the job sites (Remotive, Arbeitnow, Jobicy, Adzuna, France Travail) are external system actors.

![Use cases — Administration](../conception/images/cas-utilisation-administration.png)

The **Administrator** inherits from the Candidate. Every administration use case includes authentication with an `is_staff` account. User management (search, activate, promote, change level, delete) and platform configuration (quota, demo mode, registrations, announcement) are modelled as extensions.

### 3.3 Activity diagrams

Swimlanes show who performs each action: the candidate, the React interface, the Django API or the AI service.

![Activity — run a CV / job analysis](../conception/images/activite-analyse.png)

The CV is validated (PDF, 5 MB maximum) and its skills extracted; the offer is pasted or imported from a URL (SSRF-protected). If the daily quota is reached the API answers **429**; otherwise it creates an `AnalysisJob` and answers **202** immediately. The analysis then runs in the background (offer analysis, skill score, semantic score, 55 % / 45 % weighting adjusted to the level, recommendations) **in parallel** with the interface polling the job (250 ms growing to 1.5 s), before redirecting to the results.

![Activity — AI job search](../conception/images/activite-recherche-offres.png)

The API rejects a CV without usable text (**400**), reuses already-extracted skills, asks the AI for a search plan (French and English titles, keywords, seniority), then queries the **5 sources in parallel** (1-hour cache, 8 s maximum per source, a failing source is skipped; **502** if all fail). Offers are deduplicated, filtered by location / remote, pre-ranked locally and ranked by the AI; the top 20 are kept and the search is saved.

![Activity — registration, login and JWT session](../conception/images/activite-authentification.png)

Registration checks that sign-ups are open (**403** otherwise) and validates the form (unique e-mail, matching and strong passwords; PBKDF2 hashing). Login issues an access token (60 min) and a refresh token (7 days). When an API call returns **401**, the interface requests a new token and replays the request, or clears the session and redirects to the login page if the refresh token is invalid.

---

## 4. Prompts used to build the application

ResumeMatch AI was built with the **Cursor AI agent**. Two kinds of prompts are documented here: the instructions given to the agent during development, and the prompts the application itself sends to the LLM. The full French version, with every prompt text, is in `docs/conception/PROMPTS.md`.

### 4.1 Project timeline

| Date | Commit | Author | Step |
|---|---|---|---|
| 05/10/2026 | `47f5c5f` | azouzi marwen | Repository initialised |
| 05/10/2026 | `58adf16` | Cursor Agent | Full MVP: Django API + React interface |
| 05/10/2026 | `34bf48f` | Cursor Agent | History search filter fix |
| 05/10/2026 | `1ad595b` | Cursor Agent | Scoring unit tests (synonyms, overlap) |
| 05/10/2026 | `fbc695e`, `d6d6a07` | Cursor Agent | Forest / teal colour palette and favicon |
| 05/10/2026 | `c10ac4a` | Cursor Agent | `start-local.sh` one-command launcher |
| 05/10/2026 | `13a2769` | Mahdibouazizi + Cursor | AI job search, admin console, demo data, career toolkit, async analyses, FR / EN |
| 11/10/2026 | `4c99d1f` | brouri12 + Cursor | Interface responsiveness optimisation |
| 11/10/2026 | — | Cursor Agent | 5 module branches, test campaign, this report, UML design |

### 4.2 Creation phase — 5 October 2026 (reconstructed prompts)

> The conversations of this phase were held with a Cursor agent on another account (commits signed *Cursor Agent*, co-author `marwenazouzi44`), so their original text is **not available locally**. The prompts below are **reconstructed** from the exact content of each commit; they describe faithfully what was requested and delivered, but are not word-for-word.

| # | Commit | Reconstructed prompt (summary) |
|---|---|---|
| C1 | `58adf16` | Build the full-stack « ResumeMatch AI » app (Django 5 + DRF + JWT, React + Vite + Tailwind): JWT accounts with level, PDF CV upload and text extraction, LLM skill extraction, job-offer analysis, hybrid 0–100 score (55 % skills / 45 % semantic, adjusted by level), recommendations, cover letters in 3 tones with export, history; provider-agnostic AI with an offline mock when no API key is set |
| C2 | `34bf48f` | Fix the history page search filter |
| C3 | `1ad595b` | Add unit tests for scoring: skill synonyms and overlap score |
| C4 | `fbc695e`, `d6d6a07` | Replace the cream / terracotta palette with forest / teal tones and align the favicon |
| C5 | `c10ac4a` | Add `start-local.sh`: venv, migrations, Django on :8765 and Vite on :43124 in one command |
| C6 | `13a2769` | Add AI job search over real job feeds, live offers on the landing page, admin console, `seed_demo`, interview prep, CV rewrite, ATS check, learning plan, .docx report, async analyses, URL import, multi-offer comparison, Kanban board, score timeline, FR / EN interface, LLM cache, throttling and quotas |

### 4.3 Evolution and quality phase — 11 October 2026 (original prompts)

Exact prompts typed in Cursor, in order (automatic environment notifications excluded):

| # | Original prompt (verbatim) | Result |
|---|---|---|
| P1 | `https://github.com/brouri12/resumematch-ai pull the project and run it in ide cursor` | Project cloned and running locally |
| P2 | `i want you to split this progect to 5  modules and the you push each module in that repo git in braches that has the name of each module ok` | Branches `auth`, `cv-management`, `analysis`, `job-search`, `admin-panel` |
| P3 | `now i want you to solve the prolems in the app because it take alot of time to respense for any action` | Slowness traced to page animations (API was fast); navigation ≈ 0.35 s instead of over 1 s — commit `4c99d1f` |
| P4 | `YES` | Fix pushed to `main` and the 5 module branches |
| P5 | `I WANT YOU TO use 5 tools of test to test the full app and the collect the resultes and make a comparation table and dont forget to take screenshots to add it tho the technical raport that you gonna make it ok` | Test campaign and this report (sections 5 to 13) |
| P6 | `AJOUTER LES PROMPT utilisuer durant touts la creation de app et creerer les diagramme de classe et usecase et activiter` | Sections 3 and 4 of this report, `docs/conception/` |
| P7 | `ajouter le travail demander au rapport technique` | Design and prompts integrated into this report |

### 4.4 Prompts embedded in the application

The application sends its own prompts to the LLM (`backend/services/ai_service.py`). Each prompt demands an answer **« UNIQUEMENT en JSON strict »**, includes the expected JSON schema (generated from a Pydantic model), and is validated with up to **3 attempts** before falling back to the mock engine. Three reusable fragments personalise them:

| Fragment | Values | Example of injected text |
|---|---|---|
| Level | `etudiant`, `junior`, `confirme` | « Le candidat est JUNIOR. Mets en avant les réalisations concrètes, outils maîtrisés et le travail en équipe. » |
| Tone | `formal`, `dynamic`, `concise` | « Ton concis, direct, sans fioritures (max 250 mots). » |
| Language | `fr`, `en` | « Write all textual content in English. » |

| Method | Feature | Prompt instruction (beginning) |
|---|---|---|
| `extract_cv_skills` | CV parsing | « Extrais du CV les informations suivantes en JSON strict. » |
| `analyze_job_offer` | Offer analysis | « Analyse cette offre d'emploi et extrais les compétences et infos en JSON strict. » |
| `evaluate_semantic_fit` | Semantic score | « Évalue la compatibilité sémantique entre le CV et l'offre (0-100). » |
| `generate_recommendations` | Recommendations | « Propose des recommandations d'amélioration du CV pour cette offre. » |
| `generate_cover_letter` | Cover letter | « Rédige une lettre de motivation personnalisée. » |
| `generate_interview_prep` | Interview prep | « Prépare le candidat à l'entretien pour cette offre. Génère 8 à 10 questions probables… » |
| `rewrite_cv` | CV rewrite | « Sélectionne 4 à 8 phrases/puces du CV qui gagneraient à être réécrites… sans inventer de faits » |
| `generate_learning_plan` | Learning plan | « Construis un plan d'apprentissage pour combler ces compétences manquantes… URLs réelles uniquement » |
| `plan_job_search` | Job search plan | « Tu prépares une recherche d'offres d'emploi pour ce candidat. Déduis du CV : target_titles… » |
| `rank_job_matches` | Offer ranking | « Évalue l'adéquation entre le CV et CHAQUE offre… Sois exigeant : une offre hors métier du candidat doit être sous 30. » |

**Prompt-engineering practices applied:** structured output with schema + Pydantic validation; tolerant JSON extraction and retries; anti-hallucination constraints (« texte EXACT du CV », « sans inventer de faits », « URLs réelles uniquement »); cost control through text truncation (4 000–12 000 characters), the `LLMCacheEntry` cache, quotas and throttling.

---

## 5. Test strategy

| Level | Question answered | Tool |
|---|---|---|
| Unit + integration (backend) | Do models, services, API endpoints and permissions behave correctly? How much code is exercised? | **Django test runner + Coverage.py** |
| Unit (frontend) | Is the client-side business logic (scoring display, i18n, helpers) correct? | **Vitest** (+ V8 coverage) |
| End-to-end (system) | Can a real user complete every journey in a real browser? | **Playwright** |
| Performance / load | How does the API behave with many simultaneous users? | **Locust** |
| Quality audit | Is the UI fast to load, accessible, secure and SEO-friendly? | **Lighthouse** |

---

## 6. Tool 1 — Django test runner + Coverage.py (backend)

**Purpose:** unit and integration tests of the REST API, business services and permissions, measured with statement coverage.

**Command**

```powershell
cd backend
python -m coverage run --source=accounts,cvs,analyses,adminpanel,services `
  --omit="*/migrations/*,*/tests*.py" manage.py test -v 2
python -m coverage report --sort=cover
python -m coverage html -d ../docs/test-report/coverage-backend-html
```

**Results**

| Metric | Value |
|---|---|
| Tests run | 52 |
| Passed / failed / errors | **52 / 0 / 0** |
| Duration | 12.9 s |
| Statement coverage | **83 %** (1 800 / 2 169) |

| Least-covered modules | Coverage |
|---|---|
| `cvs/views.py` | 45 % |
| `services/pdf_service.py` | 53 % |
| `cvs/serializers.py` | 59 % |
| `accounts/serializers.py` | 63 % |
| `analyses/views.py` | 65 % |

Best-covered: `scoring.py` 95 %, `ats_service.py` 95 %, `analyses/models.py` 94 %, `adminpanel/views.py` 90 %, all serializers of `analyses` and `adminpanel` 100 %.

Covered behaviours include: JWT registration/login, admin-only endpoints (`non_staff_is_forbidden`), daily analysis quota, async analysis jobs, DOCX report export, LLM JSON-retry fallback, ATS layout detection, SSRF protection on URL import (`private_addresses_are_rejected`), job-feed caching and failure isolation.

> The red lines in the console capture are **expected log messages** produced by tests that deliberately simulate failures (an unreachable job source, an invalid LLM response); the tests themselves pass.

![Django test run](screenshots/tool1-django-tests.png)

![Coverage.py console report](screenshots/tool1-coverage-console.png)

![Coverage.py HTML report](screenshots/tool1-coverage-html.png)

---

## 7. Tool 2 — Vitest (frontend unit tests)

**Purpose:** fast unit tests of the React application's pure logic (helpers, translations), with V8 coverage.

**Command**

```powershell
cd frontend
npm run test:coverage
```

**Results**

| Metric | Value |
|---|---|
| Test files / tests | 2 / 19 |
| Passed / failed | **19 / 0** |
| Duration | 0.65 s |
| Coverage of `src/lib` (business logic) | **90 %** statements · 84.6 % branches · 90 % functions |
| Coverage of whole `src` (incl. pages/components) | **4.4 %** statements |

Tested: score buckets, job-offer text builder, Kanban grouping by status, SVG score-chart geometry and trend, job ranking, URL validation, translation lookup/fallback/interpolation, and **parity of keys and placeholders between French and English**.

**Finding:** React pages, components and contexts have **no unit tests** (0 %). They are exercised only by the Playwright end-to-end suite (Tool 3).

![Vitest console output](screenshots/tool2-vitest-console.png)

![Vitest coverage report](screenshots/tool2-vitest-coverage-html.png)

---

## 8. Tool 3 — Playwright (end-to-end browser tests)

**Purpose:** drive a real Chromium browser through complete user journeys against the running frontend + backend, and capture screenshots.

**Files:** `frontend/playwright.config.js`, `frontend/e2e/app.spec.js`

**Command**

```powershell
cd frontend
npm run test:e2e
```

**Results — 15 / 15 passed in 75 s (Chromium 1280×800, locale fr-FR)**

| ID | Scenario | Result |
|---|---|---|
| E2E-01 | Landing page renders hero and call-to-action | ✅ Pass |
| E2E-02 | Protected route redirects anonymous users to login | ✅ Pass |
| E2E-03 | Login with a wrong password shows an error | ✅ Pass |
| E2E-04 | Registration creates an account and opens the dashboard | ✅ Pass |
| E2E-05 | Dashboard shows statistics and score timeline | ✅ Pass |
| E2E-06 | Upload a PDF CV in the analysis wizard | ✅ Pass |
| E2E-07 | Full CV / job-offer analysis (4-step wizard → results) | ✅ Pass — analysis completed in **148 ms** |
| E2E-08 | History lists previous analyses | ✅ Pass |
| E2E-09 | Application board shows status columns | ✅ Pass |
| E2E-10 | Compare page and job-search page load | ✅ Pass |
| E2E-11 | Profile page shows the user's information | ✅ Pass |
| E2E-12 | Non-admin users cannot open the admin console | ✅ Pass |
| E2E-13 | Language switch translates the interface (FR → EN) | ✅ Pass |
| E2E-14 | Admin console shows the platform overview | ✅ Pass |
| E2E-15 | Mobile layout (390×844 viewport) | ✅ Pass |

![Playwright console](screenshots/tool3-playwright-console.png)

![Playwright HTML report](screenshots/tool3-playwright-html.png)

### 8.1 Screenshots captured during the end-to-end run

| | |
|---|---|
| ![Landing](screenshots/e2e-01-landing.png) **E2E-01** Landing page | ![Login redirect](screenshots/e2e-02-login-redirect.png) **E2E-02** Redirect to login |
| ![Login error](screenshots/e2e-03-login-error.png) **E2E-03** Wrong password | ![Register](screenshots/e2e-04a-register-form.png) **E2E-04** Registration form |
| ![Dashboard](screenshots/e2e-05-dashboard.png) **E2E-05** Dashboard | ![CV upload](screenshots/e2e-06-cv-upload.png) **E2E-06** CV upload |
| ![Wizard offer](screenshots/e2e-07a-wizard-offer.png) **E2E-07** Wizard — job offer | ![Wizard summary](screenshots/e2e-07b-wizard-summary.png) **E2E-07** Wizard — summary |
| ![Results](screenshots/e2e-07c-results.png) **E2E-07** Analysis result (score 87/100) | ![History](screenshots/e2e-08-history.png) **E2E-08** History |
| ![Board](screenshots/e2e-09-board.png) **E2E-09** Application board | ![Compare](screenshots/e2e-10a-compare.png) **E2E-10** Compare offers |
| ![Job search](screenshots/e2e-10b-job-search.png) **E2E-10** AI job search | ![Profile](screenshots/e2e-11-profile.png) **E2E-11** Profile |
| ![English UI](screenshots/e2e-13-english.png) **E2E-13** English interface | ![Admin](screenshots/e2e-14-admin.png) **E2E-14** Admin console |
| ![Mobile](screenshots/e2e-15-mobile-dashboard.png) **E2E-15** Mobile dashboard | |

**Observation (UX):** on E2E-03 the error message is displayed in the brand teal colour. Since the palette change, the `coral` colour token used by `Alert type="error"` is teal, so errors are not visually distinguishable from informational messages.

---

## 9. Tool 4 — Locust (load and stress testing)

**Purpose:** simulate many concurrent candidates using the REST API and measure throughput, latency percentiles and error rate.

**File:** `backend/loadtests/locustfile.py` — each virtual user logs in (JWT) and then randomly, with weights, opens the dashboard (5), lists analyses (4), opens an analysis (3), reads the profile (3), checks system status (2), lists job sources (2), **runs a new analysis** (1) and calls the health check (1), waiting 0.5–2 s between actions.

**Commands**

```powershell
cd backend
locust -f loadtests/locustfile.py --host http://127.0.0.1:8765 --headless -u 20  -r 5  -t 60s --html ../docs/test-report/locust-report.html
locust -f loadtests/locustfile.py --host http://127.0.0.1:8765 --headless -u 100 -r 10 -t 60s --html ../docs/test-report/locust-stress-report.html
```

### 9.1 Normal load — 20 concurrent users, 60 s

| Endpoint | Requests | Failures | Median (ms) | Avg (ms) | p95 (ms) | Max (ms) |
|---|---|---|---|---|---|---|
| GET /api/dashboard/stats/ | 238 | 0 | 10 | 11.7 | 20 | 68 |
| GET /api/analyses/ | 199 | 0 | 7 | 8.2 | 13 | 23 |
| GET /api/analyses/:id/ | 129 | 0 | 5 | 6.1 | 10 | 32 |
| GET /api/auth/me | 130 | 0 | 4 | 4.9 | 9 | 19 |
| GET /api/job-search/sources | 97 | 0 | 4 | 4.1 | 7 | 9 |
| GET /api/system/status/ | 71 | 0 | 6 | 6.9 | 12 | 13 |
| GET /api/health/ | 40 | 0 | 2 | 2.5 | 5 | 17 |
| GET /api/cvs/ | 20 | 0 | 7 | 7.1 | 14 | 14 |
| POST /api/analyses/ | 31 | 0 | 23 | 23.4 | 30 | 31 |
| POST /api/auth/login | 20 | 0 | 770 | 788 | 950 | 953 |
| **Total** | **975** | **0 (0 %)** | **7** | **24** | **23** | **953** |

Throughput: **16.7 requests/s** (limited by the simulated think time, not by the server).

### 9.2 Stress — 100 concurrent users, 60 s

| Metric | Value |
|---|---|
| Requests | 4 517 |
| Throughput | **76.2 requests/s** |
| Median / p95 / p99 | 10 ms / 97 ms / 1 800 ms |
| Login median under stress | 1 800 ms (max 2.6 s) |
| Failures | 153 (3.4 %) — **all `429 Too Many Requests` on `POST /api/analyses/`** |
| Server errors (5xx) / timeouts | **0** |

**Interpretation of the 429 responses:** the 100 virtual users share the 3 demo accounts, so each account quickly exceeded the business rule *"20 analyses per user per 24 h"* (`ANALYSIS_DAILY_QUOTA`) and the AI rate limit (30/hour). The API correctly refused the extra analyses with HTTP 429 and a clear message, which is the expected behaviour. Read-only endpoints served every request.

**Finding:** login is the slowest operation (≈0.8 s alone, 1.8 s under stress). This is caused by the deliberately expensive password hashing (PBKDF2) running on a single development server process; it is a security feature, but it limits how many logins per second one process can handle.

![Locust console summary](screenshots/tool4-locust-console.png)

![Locust HTML report — statistics](screenshots/tool4-locust-html.png)

![Locust HTML report — charts](screenshots/tool4-locust-charts.png)

![Locust stress report](screenshots/tool4-locust-stress-html.png)

---

## 10. Tool 5 — Lighthouse (performance, accessibility, best practices, SEO)

**Purpose:** audit the production build (`vite build` + `vite preview`) of the public pages with Google Lighthouse 12.8.2 (headless Chromium).

**Command (example)**

```powershell
npx lighthouse http://127.0.0.1:43131/ --preset=desktop --output=html --output=json `
  --output-path=docs/test-report/lighthouse/landing-desktop `
  --only-categories=performance,accessibility,best-practices,seo
```

**Results**

| Page | Device | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| Landing `/` | Desktop | **89** | **100** | **100** | 83 | 0.6 s | 1.5 s | 0 ms | 0.039 | 2.5 s |
| Landing `/` | Mobile | **65** | **100** | **100** | 83 | 3.3 s | 7.1 s | 170 ms | 0.034 | 5.0 s |
| Login `/connexion` | Desktop | **95** | **100** | **100** | 82 | 0.9 s | 1.3 s | 0 ms | 0.023 | 1.1 s |
| Register `/inscription` | Desktop | **98** | **100** | **100** | 82 | 0.6 s | 1.1 s | 0 ms | 0.023 | 0.9 s |

**Findings**

- **Mobile LCP 7.1 s:** the largest element is the full-screen hero background, a 1920 px image loaded from `images.unsplash.com` (external host, not optimised for mobile).
- **Main-thread work 2.2 s** and **62 KiB of unused JavaScript** on mobile (animation library + shared bundle).
- **SEO:** the page has no `<meta name="description">`, and `/robots.txt` is missing (the SPA returns `index.html` instead).
- **Accessibility 100 / Best practices 100** on every page: correct contrast, labels, roles, HTTPS-ready headers, no console errors.

![Lighthouse — landing desktop](screenshots/tool5-lighthouse-landing-desktop.png)

![Lighthouse — landing mobile](screenshots/tool5-lighthouse-landing-mobile.png)

![Lighthouse — login desktop](screenshots/tool5-lighthouse-login-desktop.png)

---

## 11. Comparison of the five tools

### 11.1 Tool characteristics

| Criterion | Django test + Coverage.py | Vitest | Playwright | Locust | Lighthouse |
|---|---|---|---|---|---|
| **Test type** | Unit + integration | Unit | End-to-end (system) | Load / stress | Quality audit |
| **Layer tested** | Backend (API, models, services) | Frontend logic | Whole stack via the browser | Backend API | Frontend (rendered pages) |
| **Language** | Python | JavaScript | JavaScript | Python | CLI (no code) |
| **Main metric** | Pass/fail + % statements covered | Pass/fail + % coverage | Pass/fail + screenshots | Latency percentiles, RPS, error rate | 0–100 scores + Web Vitals |
| **Speed** | 12.9 s | 0.65 s | 75 s | 60 s per scenario | ≈20 s per page |
| **Needs running servers** | No (test DB) | No | Yes (frontend + backend) | Yes (backend) | Yes (built frontend) |
| **Detects** | Logic bugs, permission and validation errors, regressions | Logic bugs in helpers / i18n | Broken journeys, routing, UI integration, visual issues | Bottlenecks, slow endpoints, errors under load | Slow loading, a11y, SEO, bad practices |
| **Does not detect** | UI problems, performance | UI rendering, API issues | Performance limits, untested branches | Functional correctness of UI | Functional bugs |
| **Effort to write tests** | Medium | Low | Medium–high | Low–medium | None |
| **Report produced** | Console + HTML coverage | Console + HTML coverage | HTML report + JSON + screenshots | HTML report + CSV | HTML + JSON |
| **Best use in CI** | Every commit | Every commit | Before merge / release | Before release | Before release |

### 11.2 Results obtained

| Tool | Tests / scenarios | Passed | Key result | Rating |
|---|---|---|---|---|
| Django test + Coverage.py | 52 tests | 52 (100 %) | 83 % backend coverage | ✅ Very good |
| Vitest | 19 tests | 19 (100 %) | 90 % of `src/lib`, 4.4 % of all frontend code | ⚠️ Good logic coverage, no component tests |
| Playwright | 15 journeys | 15 (100 %) | All user journeys work; analysis in 148 ms | ✅ Very good |
| Locust | 2 scenarios (20 and 100 users) | 0 server errors | Median 7–10 ms, 76 RPS at 100 users; login 0.8–1.8 s | ✅ Good (login is the bottleneck) |
| Lighthouse | 4 audits | — | A11y 100, BP 100, Desktop perf 89–98, Mobile perf 65, SEO 82–83 | ⚠️ Good on desktop, mobile to improve |

---

## 12. Defects and recommendations

| # | Severity | Finding | Source tool | Recommendation |
|---|---|---|---|---|
| 1 | Medium | Mobile landing page LCP 7.1 s (performance 65) | Lighthouse | Self-host the hero image in WebP/AVIF with responsive `srcset` (≈800 px for mobile) and `fetchpriority="high"`; preload it |
| 2 | Medium | React pages/components have 0 % unit coverage | Vitest | Add component tests with `@testing-library/react` (login form, wizard steps, results page) |
| 3 | Medium | Login takes 0.8 s alone and 1.8 s under 100 users | Locust | Run Django with several workers in production (gunicorn/uvicorn); keep refresh tokens so users rarely log in again |
| 4 | Low | No meta description, missing `robots.txt` (SEO 82–83) | Lighthouse | Add `<meta name="description">` in `index.html` and `public/robots.txt` |
| 5 | Low | 62 KiB unused JS, 2.2 s main-thread work on mobile | Lighthouse | Keep route-level code splitting; lazy-load the landing-page animations |
| 6 | Low | Error alerts use the brand teal colour | Playwright (screenshot E2E-03) | Give `Alert type="error"` a dedicated red/orange token |
| 7 | Low | `cvs/views.py` (45 %) and `pdf_service.py` (53 %) weakly covered | Coverage.py | Add tests for CV upload errors (non-PDF, oversize, empty text) and PDF extraction fallbacks |
| 8 | Info | Daily quota correctly returned HTTP 429 under stress | Locust | No action — expected behaviour; document it for load tests |

---

## 13. Conclusion

Across **86 automated functional tests** and **4 517 load-test requests**, ResumeMatch AI showed **no functional failure and no server error**. The backend is well covered (83 %) and very fast (median 7–10 ms per API call), every user journey works in a real browser on desktop and mobile, and the UI scores 100 in accessibility and best practices.

The five tools turned out to be complementary: **Coverage.py and Vitest** guarantee correctness of the code, **Playwright** proves that the integrated product works for a user, **Locust** shows how it behaves at scale, and **Lighthouse** evaluates the experience perceived in the browser. No single tool would have found all eight findings in section 12.

Priority next steps: optimise the mobile hero image, add React component tests, and deploy the API with multiple worker processes.

---

## Appendix A — How to reproduce

```powershell
# Backend tools
cd backend
pip install -r requirements-dev.txt
python -m coverage run --source=accounts,cvs,analyses,adminpanel,services --omit="*/migrations/*,*/tests*.py" manage.py test
python -m coverage report

# Frontend unit tests
cd ../frontend
npm install
npm run test:coverage

# Start the application with demo data (two terminals)
cd ../backend; python manage.py seed_demo --reset; python manage.py runserver 127.0.0.1:8765
cd ../frontend; npx vite --port 43130 --strictPort

# End-to-end
npx playwright install chromium
npm run test:e2e

# Load test
cd ../backend
locust -f loadtests/locustfile.py --host http://127.0.0.1:8765 --headless -u 20 -r 5 -t 60s

# Lighthouse (on the production build)
cd ../frontend; npm run build; npx vite preview --port 43131
npx lighthouse http://127.0.0.1:43131/ --preset=desktop --view
```

## Appendix B — Deliverables in `docs/test-report/`

| Path | Content |
|---|---|
| `TECHNICAL_REPORT.md` / `TECHNICAL_REPORT.docx` | This report |
| `screenshots/` | 32 screenshots (18 from the end-to-end run, 14 of tool reports) |
| `coverage-backend-html/` | Coverage.py HTML report |
| `coverage-frontend-html/` | Vitest V8 coverage HTML report |
| `playwright-html/` | Playwright HTML report |
| `locust-report.html`, `locust-stress-report.html` | Locust reports |
| `lighthouse/` | Lighthouse HTML + JSON reports (4 audits) |
| `raw/` | Raw console logs, Locust CSV, Playwright JSON |
| `console/`, `tools/` | Console captures and the scripts that render them and build the .docx / .html / .pdf reports |
| `../conception/diagrammes/`, `../conception/images/` | PlantUML sources and PNG / SVG renderings of the 6 UML diagrams (section 3) |
| `../conception/PROMPTS.md`, `../conception/CONCEPTION.md` | Full French versions of the prompts and design documents (also as .docx / .pdf) |
