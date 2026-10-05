"""Demo personas, CVs and job offers used by `manage.py seed_demo`."""

from __future__ import annotations

DEMO_PASSWORD = "Demo1234!"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Admin1234!"


def build_pdf(lines: list[tuple[str, int]]) -> bytes:
    """Build a minimal multi-page text PDF (Helvetica, WinAnsi) from (text, font_size) lines."""
    pages: list[list[tuple[str, int, float]]] = [[]]
    y = 800.0
    for text, size in lines:
        leading = size * 1.45
        if y - leading < 50:
            pages.append([])
            y = 800.0
        y -= leading
        pages[-1].append((text, size, y))

    def esc(text: str) -> bytes:
        raw = text.encode("cp1252", errors="replace")
        return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")

    font_id = 3
    page_ids = []
    next_id = 4
    page_objs: list[tuple[int, bytes]] = []
    for page in pages:
        stream = b"BT\n" + b"".join(
            b"/F1 %d Tf 1 0 0 1 50 %.1f Tm (%s) Tj\n" % (size, y, esc(text)) for text, size, y in page
        ) + b"ET"
        content_id, page_id = next_id, next_id + 1
        next_id += 2
        page_ids.append(page_id)
        page_objs.append((content_id, b"<</Length %d>>\nstream\n%s\nendstream" % (len(stream), stream)))
        page_objs.append(
            (
                page_id,
                b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]"
                b"/Resources<</Font<</F1 %d 0 R>>>>/Contents %d 0 R>>" % (font_id, content_id),
            )
        )

    objects_by_id = {
        1: b"<</Type/Catalog/Pages 2 0 R>>",
        2: b"<</Type/Pages/Kids[%s]/Count %d>>"
        % (b" ".join(b"%d 0 R" % pid for pid in page_ids), len(page_ids)),
        3: b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    }
    objects_by_id.update(dict(page_objs))

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = {}
    for obj_id in sorted(objects_by_id):
        offsets[obj_id] = len(out)
        out += b"%d 0 obj\n%s\nendobj\n" % (obj_id, objects_by_id[obj_id])
    xref = len(out)
    count = max(objects_by_id) + 1
    out += b"xref\n0 %d\n0000000000 65535 f \n" % count
    for obj_id in range(1, count):
        out += b"%010d 00000 n \n" % offsets[obj_id]
    out += b"trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n" % (count, xref)
    return bytes(out)


def cv_lines(persona: dict) -> list[tuple[str, int]]:
    lines: list[tuple[str, int]] = [
        (persona["full_name"], 18),
        (persona["headline"], 12),
        (f"{persona['email']} · {persona['phone']} · {persona['city']}", 10),
        ("", 8),
    ]
    for title, items in persona["sections"]:
        lines.append((title, 13))
        lines.extend((f"- {item}", 10) for item in items)
        lines.append(("", 6))
    return lines


PERSONAS = [
    {
        "username": "sarah",
        "first_name": "Sarah",
        "last_name": "Benali",
        "full_name": "Sarah Benali",
        "email": "sarah.benali@demo.resumematch.ai",
        "phone": "+33 6 11 22 33 44",
        "city": "Lyon",
        "level": "etudiant",
        "target": "Data Analyst",
        "headline": "Étudiante en Master Data Science – recherche stage de fin d'études",
        "sections": [
            (
                "Formation",
                [
                    "Master 2 Data Science – Université Lyon 1 (2025-2026)",
                    "Licence Informatique – Université Lyon 1 (2022-2025)",
                ],
            ),
            (
                "Expérience",
                [
                    "Stage Data Analyst (3 mois) – Décathlon : tableaux de bord des ventes en Python et SQL",
                    "Projet académique : prédiction de churn avec Machine Learning (scikit-learn), 82 % de précision",
                    "Tutorat en programmation Python pour 15 étudiants de L1",
                ],
            ),
            (
                "Projets",
                [
                    "Projet de recommandation de films (Python, Pandas, Git) publié sur GitHub",
                    "Application web de suivi de budget en HTML, CSS et JavaScript",
                ],
            ),
            (
                "Compétences",
                [
                    "Python, SQL, PostgreSQL, Machine Learning, Git, HTML, CSS, JavaScript",
                    "Communication, Curiosité, Travail en équipe",
                    "Langues : Français (natif), Anglais (B2)",
                ],
            ),
        ],
        "offers": [
            {
                "title": "Stage Data Analyst",
                "company": "BlaBlaCar",
                "status": "interview",
                "days_ago": 24,
                "text": (
                    "Poste: Stage Data Analyst (6 mois)\nEntreprise: BlaBlaCar\n"
                    "Au sein de l'équipe Data, vous analyserez les parcours utilisateurs et "
                    "construirez des tableaux de bord. Compétences requises : Python, SQL, "
                    "PostgreSQL, Git. Un plus : Machine Learning, AWS. Stage, étudiant en fin "
                    "d'études, anglais courant apprécié."
                ),
            },
            {
                "title": "Alternance Développeuse Python",
                "company": "Doctolib",
                "status": "applied",
                "days_ago": 15,
                "text": (
                    "Poste: Alternance Développeur Python / Django\nEntreprise: Doctolib\n"
                    "Vous rejoindrez une équipe produit pour développer des API REST en Python et "
                    "Django. Requis : Python, Django, SQL, Git, REST API, Docker. Un plus : "
                    "Kubernetes, CI/CD. Alternance de 12 mois, étudiant en Master."
                ),
            },
            {
                "title": "Stage Data Engineer",
                "company": "Criteo",
                "status": "to_apply",
                "days_ago": 4,
                "text": (
                    "Poste: Stage Data Engineer\nEntreprise: Criteo\n"
                    "Construction de pipelines de données. Requis : Python, SQL, Docker, Linux, "
                    "AWS, Kubernetes. Un plus : CI/CD, Machine Learning. Stage de 6 mois."
                ),
            },
        ],
    },
    {
        "username": "karim",
        "first_name": "Karim",
        "last_name": "Haddad",
        "full_name": "Karim Haddad",
        "email": "karim.haddad@demo.resumematch.ai",
        "phone": "+33 6 55 44 33 22",
        "city": "Paris",
        "level": "junior",
        "target": "Développeur Full-Stack",
        "headline": "Développeur Full-Stack – 2 ans d'expérience React / Django",
        "sections": [
            (
                "Expérience",
                [
                    "Développeur Full-Stack – Qonto (2024-2026) : 2 ans",
                    "Développement d'une API REST en Python et Django utilisée par 50 000 clients",
                    "Refonte du front en React et TypeScript : temps de chargement réduit de 35 %",
                    "Mise en place de tests automatisés et intégration continue (Git, Docker)",
                    "Stage Développeur Web – Agence Pixel (2023) : sites en JavaScript et Node.js",
                ],
            ),
            (
                "Formation",
                ["Diplôme d'ingénieur informatique – EPITA (2024)"],
            ),
            (
                "Compétences",
                [
                    "Python, Django, JavaScript, TypeScript, React, Node.js, SQL, PostgreSQL",
                    "Docker, Git, REST API, Linux, Agile",
                    "Travail en équipe, Autonomie",
                    "Langues : Français, Anglais (C1)",
                ],
            ),
        ],
        "offers": [
            {
                "title": "Développeur Full-Stack React / Django",
                "company": "Alan",
                "status": "offer",
                "days_ago": 28,
                "text": (
                    "Poste: Développeur Full-Stack\nEntreprise: Alan\n"
                    "Vous développerez de nouvelles fonctionnalités de bout en bout. Requis : "
                    "Python, Django, React, TypeScript, PostgreSQL, Git. Un plus : Docker, AWS. "
                    "Profil junior avec 2 ans d'expérience."
                ),
            },
            {
                "title": "Développeur Backend Python",
                "company": "Back Market",
                "status": "rejected",
                "days_ago": 20,
                "text": (
                    "Poste: Développeur Backend Python\nEntreprise: Back Market\n"
                    "Conception de microservices. Requis : Python, Django, Docker, Kubernetes, "
                    "AWS, CI/CD, SQL. Un plus : Machine Learning. Profil junior à confirmé."
                ),
            },
            {
                "title": "Développeur Frontend React",
                "company": "Swile",
                "status": "interview",
                "days_ago": 11,
                "text": (
                    "Poste: Développeur Frontend React\nEntreprise: Swile\n"
                    "Vous construirez notre application web. Requis : JavaScript, TypeScript, "
                    "React, HTML, CSS, Git, REST API. Un plus : Node.js, CI/CD. Junior bienvenu."
                ),
            },
            {
                "title": "Développeur Node.js",
                "company": "Deezer",
                "status": "to_apply",
                "days_ago": 2,
                "text": (
                    "Poste: Développeur Node.js\nEntreprise: Deezer\n"
                    "API de streaming à fort trafic. Requis : Node.js, TypeScript, Docker, "
                    "Kubernetes, AWS, SQL. Un plus : CI/CD, Agile. Junior avec 2 ans."
                ),
            },
        ],
    },
    {
        "username": "lea",
        "first_name": "Léa",
        "last_name": "Martin",
        "full_name": "Léa Martin",
        "email": "lea.martin@demo.resumematch.ai",
        "phone": "+33 7 66 77 88 99",
        "city": "Bordeaux",
        "level": "confirme",
        "target": "Lead Developer",
        "headline": "Lead Developer Backend – 8 ans d'expérience Java / Cloud",
        "sections": [
            (
                "Expérience",
                [
                    "Lead Developer – Cdiscount (2021-2026) : équipe de 7 développeurs",
                    "Architecture microservices en Java sur AWS et Kubernetes, 99,95 % de disponibilité",
                    "Migration CI/CD vers GitLab : déploiements passés de 1 par semaine à 15 par jour",
                    "Développeuse Backend – Sopra Steria (2018-2021) : API REST Java, SQL, Docker",
                ],
            ),
            (
                "Formation",
                ["Master Génie Logiciel – Université de Bordeaux (2018)"],
            ),
            (
                "Compétences",
                [
                    "Java, Python, SQL, PostgreSQL, Docker, Kubernetes, AWS, CI/CD, Linux, Git",
                    "Agile, REST API",
                    "Leadership, Communication, Mentorat",
                    "Langues : Français, Anglais (C1), Espagnol (B1)",
                ],
            ),
        ],
        "offers": [
            {
                "title": "Lead Developer Backend",
                "company": "ManoMano",
                "status": "interview",
                "days_ago": 18,
                "text": (
                    "Poste: Lead Developer Backend (senior)\nEntreprise: ManoMano\n"
                    "Vous encadrerez une équipe de 6 personnes. Requis : Java, Kubernetes, AWS, "
                    "CI/CD, SQL, Docker, Agile. Un plus : Python. Profil confirmé, lead."
                ),
            },
            {
                "title": "Architecte Cloud",
                "company": "OVHcloud",
                "status": "applied",
                "days_ago": 7,
                "text": (
                    "Poste: Architecte Cloud senior\nEntreprise: OVHcloud\n"
                    "Conception d'architectures cloud. Requis : Kubernetes, Docker, Linux, AWS, "
                    "CI/CD, Python. Un plus : Machine Learning, TypeScript. Profil confirmé."
                ),
            },
        ],
    },
]
