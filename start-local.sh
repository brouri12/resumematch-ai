#!/usr/bin/env bash
# Start ResumeMatch AI locally (backend + frontend)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8765}"
FRONTEND_PORT="${FRONTEND_PORT:-43124}"

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example (add LLM_API_KEY later if needed)."
fi

# Backend
if [[ ! -d "$ROOT/backend/.venv" ]]; then
  python3 -m venv "$ROOT/backend/.venv"
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
  pip install --upgrade pip
  pip install -r "$ROOT/backend/requirements.txt"
else
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
fi

cd "$ROOT/backend"
python manage.py migrate --noinput
python manage.py runserver "127.0.0.1:${BACKEND_PORT}" &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Frontend
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  npm install
fi

echo ""
echo "ResumeMatch AI"
echo "  API : http://127.0.0.1:${BACKEND_PORT}/api/health/"
echo "  App : http://127.0.0.1:${FRONTEND_PORT}/"
echo ""

npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}"
