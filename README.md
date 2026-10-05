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

## Démarrage local (recommandé)

```bash
# 1) Cloner le dépôt (après Create repo dans Cursor)
cd ~/Desktop
git clone <URL_DU_REPO>
cd resumematch-ai   # adapte le nom

# 2) Lancer backend + frontend
chmod +x start-local.sh
./start-local.sh
```

- App : http://127.0.0.1:43124/
- API : http://127.0.0.1:8765/api/health/

Sans `LLM_API_KEY` dans `.env`, le mode mock fonctionne tout de suite.

### Ouverture dans Cursor Desktop

```bash
cursor ~/Desktop/resumematch-ai
```

Puis File → Open Folder si besoin. Choisis l’agent **Local** (pas Cloud).

## Démarrage manuel

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

### 4. Données de démonstration

```bash
cd backend
python manage.py seed_demo            # crée admin + 3 candidats avec CV PDF, analyses, lettres, extras
python manage.py seed_demo --reset    # supprime puis recrée uniquement les comptes de démo
python manage.py seed_demo --with-ai  # utilise le vrai LLM (sinon moteur mock, gratuit)
```

| Compte | Mot de passe | Profil |
| --- | --- | --- |
| `admin` | `Admin1234!` | Super-admin → menu **Administration** (`/administration`) |
| `sarah` | `Demo1234!` | Étudiante, Data Analyst (3 offres) |
| `karim` | `Demo1234!` | Junior Full-Stack (4 offres, une offre reçue, une tâche en échec) |
| `lea` | `Demo1234!` | Confirmée, Lead Dev (2 offres) |

La console d'administration permet de suivre les statistiques globales, gérer les utilisateurs
(activer, promouvoir admin, niveau, suppression), les analyses, les tâches asynchrones, et de régler
quota quotidien, mode démo forcé, ouverture des inscriptions, annonce globale et cache IA.

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
11. **Offres IA** (`/offres`) : l'IA déduit du CV les intitulés et compétences à chercher, récupère des
    offres réelles (Remotive, Arbeitnow, Jobicy ; Adzuna et France Travail si clés API dans `.env`),
    les filtre par lieu / télétravail, puis classe les 20 meilleures avec score, raison, atouts et lacunes.
    Un clic lance l'analyse détaillée complète de l'offre choisie.

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
