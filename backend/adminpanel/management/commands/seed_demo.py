from contextlib import nullcontext
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.test.utils import override_settings
from django.utils import timezone

from accounts.models import User
from analyses.models import Analysis, AnalysisJob
from analyses.services import create_cover_letter, get_or_generate_extra, run_analysis
from cvs.models import CV
from services.ai_service import get_ai_service
from services.pdf_service import extract_text_from_pdf

from ...demo_data import ADMIN_PASSWORD, ADMIN_USERNAME, DEMO_PASSWORD, PERSONAS, build_pdf, cv_lines


class Command(BaseCommand):
    help = "Crée des comptes, CV (PDF), analyses et candidatures de démonstration."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Supprime puis recrée les comptes de démo (les autres comptes ne sont pas touchés).",
        )
        parser.add_argument(
            "--with-ai",
            action="store_true",
            help="Utilise la vraie IA (consomme des crédits). Par défaut : moteur démo, gratuit et rapide.",
        )

    def handle(self, *args, **options):
        demo_usernames = [p["username"] for p in PERSONAS]
        existing = User.objects.filter(username__in=demo_usernames)
        if existing.exists():
            if not options["reset"]:
                self.stdout.write(
                    self.style.WARNING(
                        "Les comptes de démo existent déjà. Relancez avec --reset pour les recréer."
                    )
                )
                return
            for cv in CV.objects.filter(user__in=existing):
                cv.file.delete(save=False)
            existing.delete()
            self.stdout.write("Anciens comptes de démo supprimés.")

        ai_context = nullcontext() if options["with_ai"] else override_settings(LLM_API_KEY="")
        with ai_context:
            admin = self._ensure_admin()
            for persona in PERSONAS:
                with transaction.atomic():
                    self._seed_persona(persona)
            self._seed_job_history(admin)

        self.stdout.write(self.style.SUCCESS("\nDonnées de démo prêtes."))
        self.stdout.write(f"  Admin      : {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
        for p in PERSONAS:
            self.stdout.write(f"  Candidat   : {p['username']} / {DEMO_PASSWORD}  ({p['level']}, {p['target']})")

    def _ensure_admin(self) -> User:
        admin, created = User.objects.get_or_create(
            username=ADMIN_USERNAME,
            defaults={
                "email": "admin@demo.resumematch.ai",
                "first_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password(ADMIN_PASSWORD)
            admin.save()
            self.stdout.write(f"Compte admin créé : {ADMIN_USERNAME}")
        elif not admin.is_staff:
            self.stdout.write(
                self.style.WARNING(f"L'utilisateur « {ADMIN_USERNAME} » existe mais n'est pas admin : inchangé.")
            )
        return admin

    def _seed_persona(self, persona: dict) -> None:
        user = User.objects.create_user(
            username=persona["username"],
            password=DEMO_PASSWORD,
            email=persona["email"],
            first_name=persona["first_name"],
            last_name=persona["last_name"],
            level=persona["level"],
            target_job_title=persona["target"],
        )
        cv = CV(user=user, original_filename=f"CV_{persona['first_name']}_{persona['last_name']}.pdf")
        cv.file.save(cv.original_filename, ContentFile(build_pdf(cv_lines(persona))), save=False)
        cv.extracted_text = extract_text_from_pdf(cv.file.path)
        cv.parsed_data = get_ai_service().extract_cv_skills(cv.extracted_text).model_dump()
        cv.save()

        now = timezone.now()
        analyses = []
        for offer in persona["offers"]:
            analysis = run_analysis(
                user=user,
                cv=cv,
                job_offer_text=offer["text"],
                title=offer["title"],
                company=offer["company"],
                level=persona["level"],
            )
            created = now - timedelta(days=offer["days_ago"], hours=len(analyses) * 3)
            Analysis.objects.filter(pk=analysis.pk).update(status=offer["status"], created_at=created)
            analysis.job_offer.__class__.objects.filter(pk=analysis.job_offer_id).update(created_at=created)
            analysis.refresh_from_db()
            analyses.append(analysis)

        best = max(analyses, key=lambda a: a.score)
        create_cover_letter(best, "formal" if persona["level"] != "junior" else "dynamic")
        for kind in ("ats", "interview_prep", "learning_plan"):
            get_or_generate_extra(best, kind, "fr")

        scores = ", ".join(f"{a.job_offer.company} {a.score}" for a in analyses)
        self.stdout.write(f"{persona['first_name']} : {len(analyses)} analyses ({scores})")

    def _seed_job_history(self, admin: User) -> None:
        karim = User.objects.get(username="karim")
        AnalysisJob.objects.create(
            user=karim,
            state=AnalysisJob.State.FAILED,
            progress=45,
            step="semantic",
            error="Exemple : délai dépassé lors de l'appel au fournisseur d'IA (donnée de démo).",
        )
        latest = Analysis.objects.filter(user=karim).order_by("-created_at").first()
        AnalysisJob.objects.create(
            user=karim, state=AnalysisJob.State.DONE, progress=100, step="done", analysis=latest
        )
