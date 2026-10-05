# ResumeMatch AI

**Matching intelligent entre CV et offres d'emploi**  
Équipe **CVisionnaires AI** · Slogan : *« Transformez votre CV, visualisez votre avenir. »*

Plateforme web MVP qui compare un CV (PDF) à une offre d'emploi, calcule un score de compatibilité hybride, liste les compétences manquantes, propose des améliorations et génère une lettre de motivation.

## Stack

| Couche | Techno |
|--------|--------|
| Backend | Python 3.11+, Django 5, Django REST Framework, SimpleJWT |
| Frontend | React (Vite), Tailwind CSS, React Router |
| Base | SQLite (dev) / PostgreSQL via variables d'environnement |
| PDF | pdfplumber (fallback PyPDF2) |
| IA | `services/ai_service.py` provider-agnostique (Anthropic par défaut) |

## Démarrage rapide

### 1. Variables d'environnement

```bash
cp .env.example .env
# Optionnel : renseigner LLM_API_KEY pour activer Claude.
# Sans clé, le backend utilise un moteur mock déterministe.
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8765
```

API : http://127.0.0.1:8765/api/health/

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App : http://127.0.0.1:43124/

Le serveur Vite proxy les appels `/api` vers le backend.

## Fonctionnalités

1. Inscription / connexion JWT, édition du profil (niveau, poste cible)
2. Import CV PDF (max 5 Mo) + extraction de texte
3. Extraction structurée des compétences (LLM / mock)
4. Analyse d'offre (compétences requises, nice-to-have, séniorité)
5. Score 0–100 = pondération compétences + évaluation sémantique (poids configurables)
6. Compétences manquantes ordonnées
7. Recommandations d'amélioration du CV
8. Lettre de motivation (ton formel / dynamique / concis), édition + export `.txt` / `.docx`
9. Historique des candidatures (filtres, statut, suppression)
10. **Mode niveau** Étudiant / Junior / Confirmé (prompts, pondération, ton)

## Endpoints principaux (`/api/`)

- `POST auth/register`, `POST auth/login`, `POST auth/refresh`, `GET/PUT auth/me`
- `POST/GET cvs/`, `GET/DELETE cvs/{id}/`
- `POST analyses/` → contrat JSON (`score`, `competences_presentes`, `competences_manquantes`, `recommandations`, …)
- `GET analyses/`, `GET/DELETE analyses/{id}/`, `PATCH analyses/{id}/status`
- `POST analyses/{id}/improve-cv`
- `POST analyses/{id}/cover-letter`
- `GET cover-letters/{id}/export?format=txt|docx`
- `GET dashboard/stats/`

## Configuration LLM

```env
LLM_PROVIDER=anthropic
LLM_API_KEY=
LLM_MODEL=claude-sonnet-4-20250514
SCORE_WEIGHT_SKILLS=0.55
SCORE_WEIGHT_SEMANTIC=0.45
```

Sans `LLM_API_KEY`, toutes les réponses IA passent par le mock (idéal pour le développement local).

## PostgreSQL

Renseigner dans `.env` :

```env
POSTGRES_DB=resumematch
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

ou une `DATABASE_URL=postgres://user:pass@host:5432/dbname`.

## Structure

```
backend/          Django project (accounts, cvs, analyses, services)
frontend/         React + Vite + Tailwind
.env.example      Modèle de configuration
```

## Équipe

Projet académique — **CVisionnaires AI** (6 étudiants).
