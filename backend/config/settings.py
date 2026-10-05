"""Django settings for ResumeMatch AI."""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-dev-key")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "accounts",
    "cvs",
    "analyses",
    "adminpanel",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: SQLite by default, PostgreSQL when POSTGRES_* or DATABASE_URL is set
POSTGRES_DB = os.getenv("POSTGRES_DB", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

if POSTGRES_DB or (DATABASE_URL and DATABASE_URL.startswith("postgres")):
    if DATABASE_URL.startswith("postgres"):
        # Simple DATABASE_URL parsing: postgres://user:pass@host:port/dbname
        import re

        match = re.match(
            r"postgres(?:ql)?://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)",
            DATABASE_URL,
        )
        if match:
            db_user, db_pass, db_host, db_port, db_name = match.groups()
            DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.postgresql",
                    "NAME": db_name,
                    "USER": db_user,
                    "PASSWORD": db_pass,
                    "HOST": db_host,
                    "PORT": db_port,
                }
            }
        else:
            DATABASES = {
                "default": {
                    "ENGINE": "django.db.backends.sqlite3",
                    "NAME": BASE_DIR / "db.sqlite3",
                }
            }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": POSTGRES_DB,
                "USER": os.getenv("POSTGRES_USER", "postgres"),
                "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
                "HOST": os.getenv("POSTGRES_HOST", "localhost"),
                "PORT": os.getenv("POSTGRES_PORT", "5432"),
            }
        }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            # Background analysis threads write concurrently with requests
            "OPTIONS": {"timeout": 20},
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    # Allow ?format=txt|docx on export endpoints without DRF content-negotiation 404
    "URL_FORMAT_OVERRIDE": None,
    "DEFAULT_THROTTLE_RATES": {
        "ai": os.getenv("AI_THROTTLE_RATE", "30/hour"),
        "job_import": os.getenv("JOB_IMPORT_THROTTLE_RATE", "20/hour"),
    },
}

# Max analyses per user over a rolling 24h window (0 = unlimited)
ANALYSIS_DAILY_QUOTA = int(os.getenv("ANALYSIS_DAILY_QUOTA", "20"))
# Run analysis jobs inline instead of in a background thread (used by tests)
ANALYSIS_JOBS_SYNC = os.getenv("ANALYSIS_JOBS_SYNC", "False").lower() in ("1", "true", "yes")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

# File upload limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024  # 6 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
MAX_CV_UPLOAD_BYTES = 5 * 1024 * 1024

# LLM configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-4-20250514")
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")

# Job search: free public feeds (no key) + optional keyed APIs, enabled when credentials are set
JOB_SEARCH_SOURCES = [
    s.strip()
    for s in os.getenv("JOB_SEARCH_SOURCES", "remotive,arbeitnow,jobicy").split(",")
    if s.strip()
]
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "fr")
FRANCE_TRAVAIL_CLIENT_ID = os.getenv("FRANCE_TRAVAIL_CLIENT_ID", "")
FRANCE_TRAVAIL_CLIENT_SECRET = os.getenv("FRANCE_TRAVAIL_CLIENT_SECRET", "")

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    # Feed responses survive restarts so public APIs are not hammered (Remotive: max ~4 calls/day)
    "jobs": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / ".cache" / "jobs",
        "TIMEOUT": 3600,
    },
}

# Score weights
SCORE_WEIGHT_SKILLS = float(os.getenv("SCORE_WEIGHT_SKILLS", "0.55"))
SCORE_WEIGHT_SEMANTIC = float(os.getenv("SCORE_WEIGHT_SEMANTIC", "0.45"))
SCORE_LEVEL_MULTIPLIERS = {
    "etudiant": float(os.getenv("SCORE_LEVEL_ETUDIANT_SEMANTIC", "0.7")),
    "junior": float(os.getenv("SCORE_LEVEL_JUNIOR_SEMANTIC", "1.0")),
    "confirme": float(os.getenv("SCORE_LEVEL_CONFIRME_SEMANTIC", "1.2")),
}
