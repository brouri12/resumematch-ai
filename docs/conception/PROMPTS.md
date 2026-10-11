# ResumeMatch AI — Prompts utilisés pendant la création de l'application

Ce document rassemble les **prompts (instructions) donnés à l'agent IA Cursor** pour construire, faire évoluer, optimiser et tester ResumeMatch AI, ainsi que les **prompts envoyés au modèle de langage (LLM)** par l'application elle-même.

| Partie | Contenu | Source |
|---|---|---|
| 1 | Chronologie du projet | Historique Git du dépôt `brouri12/resumematch-ai` |
| 2 | Phase de création (5 octobre 2026) | Commits de l'agent Cursor — prompts **reconstitués** |
| 3 | Phase d'évolution et de qualité (11 octobre 2026) | Historique des conversations Cursor — prompts **originaux** |
| 4 | Prompts IA intégrés à l'application | Code source `backend/services/ai_service.py` |

---

## 1. Chronologie du projet

| Date | Commit | Auteur | Étape |
|---|---|---|---|
| 05/10/2026 | `47f5c5f` | azouzi marwen | Initialisation du dépôt |
| 05/10/2026 | `58adf16` | Cursor Agent | MVP complet : API Django + interface React |
| 05/10/2026 | `34bf48f` | Cursor Agent | Correction du filtre de recherche de l'historique |
| 05/10/2026 | `1ad595b` | Cursor Agent | Tests unitaires du scoring (synonymes, recouvrement) |
| 05/10/2026 | `fbc695e` | Cursor Agent | Nouvelle palette de couleurs forêt / sarcelle |
| 05/10/2026 | `d6d6a07` | Cursor Agent | Favicon aligné sur la palette |
| 05/10/2026 | `c10ac4a` | Cursor Agent | Script `start-local.sh` (lancement en une commande) |
| 05/10/2026 | `13a2769` | Mahdibouazizi + Cursor | Offres IA, console d'administration, données de démo, outils carrière |
| 11/10/2026 | `4c99d1f` | brouri12 + Cursor | Optimisation de la réactivité de l'interface |
| 11/10/2026 | — | Cursor Agent | Découpage en 5 modules (branches Git), campagne de tests, rapport technique, conception UML |

---

## 2. Phase de création — 5 octobre 2026 (prompts reconstitués)

> **Important :** les conversations de cette phase ont été menées avec un agent Cursor sur un autre poste ou compte (les commits sont signés *Cursor Agent*, co-auteur `marwenazouzi44`). Leur texte original **n'est pas présent sur cette machine**. Les prompts ci-dessous sont **reconstitués** à partir du contenu exact de chaque commit et du README ; ils décrivent fidèlement ce qui a été demandé et livré, mais ne sont pas la formulation mot pour mot. Les originaux sont consultables dans l'historique des agents du compte Cursor qui a créé le projet (cursor.com → Agents).

### Prompt C1 — Création du MVP (commit `58adf16`)

```text
Crée une application web full-stack « ResumeMatch AI » pour l'équipe CVisionnaires AI
(slogan : « Transformez votre CV, visualisez votre avenir. »).
Backend : Python, Django 5, Django REST Framework, authentification JWT (SimpleJWT),
SQLite en développement et PostgreSQL via variables d'environnement.
Frontend : React + Vite + Tailwind CSS + React Router.
Fonctionnalités :
1. Inscription / connexion JWT et profil (niveau Étudiant / Junior / Confirmé, poste cible)
2. Import d'un CV PDF (max 5 Mo) et extraction du texte (pdfplumber, repli PyPDF2)
3. Extraction structurée des compétences du CV par un LLM
4. Analyse de l'offre d'emploi (compétences requises, nice-to-have, séniorité)
5. Score de compatibilité 0-100 hybride : recouvrement des compétences + évaluation
   sémantique par le LLM, poids configurables (55 % / 45 %) et ajustés selon le niveau
6. Compétences présentes / manquantes et recommandations d'amélioration du CV
7. Lettre de motivation (ton formel, dynamique ou concis), éditable, export .txt / .docx
8. Historique des candidatures avec filtres, statut et suppression
Le service IA doit être indépendant du fournisseur (Anthropic par défaut) et fonctionner
hors ligne avec un moteur mock déterministe quand LLM_API_KEY est vide.
```

### Prompt C2 — Correction (commit `34bf48f`)

```text
Le filtre de recherche de la page Historique ne se soumet pas correctement : stabilise-le.
```

### Prompt C3 — Tests (commit `1ad595b`)

```text
Ajoute des tests unitaires pour le calcul du score : synonymes de compétences
(ex. JS / JavaScript) et score de recouvrement.
```

### Prompt C4 — Identité visuelle (commits `fbc695e`, `d6d6a07`)

```text
Change la palette de couleurs : évite le cliché crème / terracotta et passe sur des
tons forêt / sarcelle. Aligne aussi le favicon sur cette palette.
```

### Prompt C5 — Lancement local (commit `c10ac4a`)

```text
Ajoute un script start-local.sh qui prépare tout en une commande pour Cursor Desktop :
environnement virtuel, migrations, Django sur le port 8765 et Vite sur le port 43124.
```

### Prompt C6 — Extension majeure (commit `13a2769`)

```text
Ajoute les fonctionnalités suivantes :
- « Offres IA » : à partir du CV, l'IA construit un plan de recherche, récupère des offres
  réelles (Remotive, Arbeitnow, Jobicy, et Adzuna / France Travail si clés API), les filtre
  par lieu / télétravail, les classe (score, raison, atouts, lacunes), permet de lancer
  l'analyse détaillée en un clic et enregistre les recherches.
- Page d'accueil : vitrine d'offres en direct et logos des sources.
- Console d'administration : statistiques, utilisateurs, analyses, tâches, paramètres du site
  (quota quotidien, mode démo forcé, inscriptions, annonce globale, cache IA).
- Commande seed_demo : comptes de démo, vrais CV PDF et analyses.
- Page résultats : préparation d'entretien, réécriture du CV, vérification ATS,
  plan d'apprentissage, rapport .docx et mise en page d'impression.
- Analyses asynchrones avec progression, import d'offre par URL, comparaison multi-offres,
  tableau Kanban des candidatures, courbe d'évolution du score, interface FR / EN,
  cache LLM, limitation de débit et quotas.
- Suites de tests backend et Vitest.
```

---

## 3. Phase d'évolution et de qualité — 11 octobre 2026 (prompts originaux)

Prompts **exacts** saisis dans Cursor, dans l'ordre, avec une reformulation et le résultat obtenu. Les messages automatiques de l'environnement (notifications de fin de tâche) sont exclus.

| # | Prompt original (texte exact) | Reformulation | Résultat |
|---|---|---|---|
| P1 | `https://github.com/brouri12/resumematch-ai pull the project and run it in ide cursor` | Cloner le dépôt et lancer l'application dans Cursor | Projet cloné et démarré en local |
| P2 | `i want you to split this progect to 5  modules and the you push each module in that repo git in braches that has the name of each module ok` | Découper le projet en 5 modules et pousser chacun sur une branche Git portant son nom | Branches `auth`, `cv-management`, `analysis`, `job-search`, `admin-panel` |
| P3 | `now i want you to solve the prolems in the app because it take alot of time to respense for any action` | Corriger la lenteur de l'application à chaque action | Diagnostic (API rapide, lenteur due aux animations) ; navigation ≈ 0,35 s au lieu de plus de 1 s ; commit `4c99d1f` |
| P4 | `YES` | Valider : commiter, pousser sur `main` et reporter le correctif sur les 5 branches | Correctif poussé sur `main` et les 5 branches modules |
| P5 | `I WANT YOU TO use 5 tools of test to test the full app and the collect the resultes and make a comparation table and dont forget to take screenshots to add it tho the technical raport that you gonna make it ok` | Tester l'application avec 5 outils, comparer les résultats, rédiger un rapport technique avec captures | Django test + Coverage.py, Vitest, Playwright, Locust, Lighthouse ; `docs/test-report/TECHNICAL_REPORT.{md,docx,pdf}` |
| P6 | `AJOUTER LES PROMPT utilisuer durant touts la creation de app et creerer les diagramme de classe et usecase et activiter` | Documenter les prompts de création et produire les diagrammes UML de classes, cas d'utilisation et activité | Ce document + `docs/conception/` |

---

## 4. Prompts IA intégrés à l'application

L'application envoie ses propres prompts au LLM (`backend/services/ai_service.py`). Chaque prompt :

- exige une réponse **« UNIQUEMENT en JSON strict »** et fournit le **schéma JSON** attendu (généré depuis un modèle Pydantic) ;
- est validé par Pydantic, avec **jusqu'à 3 tentatives** puis un **repli sur le moteur mock** si la réponse reste invalide ;
- est enrichi par trois fragments réutilisables : niveau, ton et langue.

### 4.1 Fragments réutilisables

| Fragment | Valeur | Texte injecté |
|---|---|---|
| Niveau | `etudiant` | Le candidat est ÉTUDIANT. Mets en avant les projets académiques, stages, certifications et le potentiel d'apprentissage. L'expérience professionnelle pèse moins dans l'évaluation. |
| Niveau | `junior` | Le candidat est JUNIOR. Mets en avant les réalisations concrètes, outils maîtrisés et le travail en équipe. |
| Niveau | `confirme` | Le candidat est CONFIRMÉ. Mets en avant l'impact, le leadership, les décisions d'architecture et les résultats mesurables. |
| Ton | `formal` | Ton formel, professionnel et respectueux. |
| Ton | `dynamic` | Ton dynamique, enthousiaste et motivé. |
| Ton | `concise` | Ton concis, direct, sans fioritures (max 250 mots). |
| Langue | `fr` | Rédige tout le contenu textuel en français. |
| Langue | `en` | Write all textual content in English. |

### 4.2 Prompts par fonctionnalité

| Méthode | Fonctionnalité | Prompt (début du texte) | Contexte envoyé |
|---|---|---|---|
| `extract_cv_skills` | Extraction du CV | « Extrais du CV les informations suivantes en JSON strict. Réponds UNIQUEMENT avec un objet JSON valide. » | Schéma + CV (12 000 caractères) |
| `analyze_job_offer` | Analyse de l'offre | « Analyse cette offre d'emploi et extrais les compétences et infos en JSON strict. » | Schéma + offre (12 000 car.) |
| `evaluate_semantic_fit` | Score sémantique | « Évalue la compatibilité sémantique entre le CV et l'offre (0-100). » | Niveau, compétences présentes / manquantes, CV et offre (6 000 car. chacun) |
| `generate_recommendations` | Recommandations | « Propose des recommandations d'amélioration du CV pour cette offre. » + « Focus sur recommandations actionnables (3 à 6 items). » | Niveau, langue, compétences manquantes, CV, offre |
| `generate_cover_letter` | Lettre de motivation | « Rédige une lettre de motivation personnalisée. Réponds UNIQUEMENT en JSON strict avec la clé content. » | Niveau, ton, langue, candidat, poste, entreprise, CV, offre |
| `generate_interview_prep` | Préparation d'entretien | « Prépare le candidat à l'entretien pour cette offre. Génère 8 à 10 questions probables (catégories : technique, comportementale, motivation, lacune)… au moins une question par compétence manquante. » | Niveau, langue, compétences manquantes, CV, offre |
| `rewrite_cv` | Réécriture du CV | « Sélectionne 4 à 8 phrases/puces du CV qui gagneraient à être réécrites… verbe d'action, résultat mesurable, mots-clés de l'offre, sans inventer de faits… » | Niveau, langue, compétences manquantes, CV, offre |
| `generate_learning_plan` | Plan d'apprentissage | « Construis un plan d'apprentissage pour combler ces compétences manquantes… priority, estimated_weeks, 2 à 3 resources (URLs réelles uniquement), project_idea… » | Niveau, langue, poste visé, compétences manquantes |
| `plan_job_search` | Plan de recherche d'offres | « Tu prépares une recherche d'offres d'emploi pour ce candidat. Déduis du CV : target_titles (3 à 5 intitulés… en anglais ET en français), keywords (6 à 10 compétences)… » | Niveau, langue, poste déclaré, compétences, CV |
| `rank_job_matches` | Classement des offres | « Évalue l'adéquation entre le CV et CHAQUE offre ci-dessous (score 0-100…). Sois exigeant : une offre hors métier du candidat doit être sous 30. » | Niveau, langue, CV (4 000 car.), offres compactées |

### 4.3 Exemple complet — lettre de motivation

```text
Rédige une lettre de motivation personnalisée. Réponds UNIQUEMENT en JSON strict avec la clé content.
Le candidat est JUNIOR. Mets en avant les réalisations concrètes, outils maîtrisés et le travail en équipe.
Ton dynamique, enthousiaste et motivé.
Rédige tout le contenu textuel en français.
Candidat: Karim Haddad
Poste: Développeur Full-Stack
Entreprise: Acme
Schéma: {"properties": {"content": {"type": "string"}}, "required": ["content"], ...}

CV:
<texte extrait du CV, 5 000 caractères max>

Offre:
<texte de l'offre, 5 000 caractères max>
```

### 4.4 Bonnes pratiques de prompt engineering appliquées

| Pratique | Mise en œuvre |
|---|---|
| Sortie structurée | Schéma JSON fourni dans chaque prompt et validation Pydantic de la réponse |
| Robustesse | Extraction du JSON même entouré de balises Markdown, 3 tentatives, repli sur le mock |
| Personnalisation | Fragments réutilisables niveau / ton / langue |
| Anti-hallucination | « texte EXACT du CV », « sans inventer de faits », « URLs réelles uniquement » |
| Maîtrise des coûts | Textes tronqués (4 000 à 12 000 caractères), cache des réponses (`LLMCacheEntry`), quota et limitation de débit |
| Évaluation exigeante | « Sois exigeant : une offre hors métier du candidat doit être sous 30 » |
