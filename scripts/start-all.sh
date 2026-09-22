#!/usr/bin/env bash
# Démarre PostgreSQL embarqué, l'API NestJS (3000) et le back-office Vite (5173).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://emmapp:emmapp_secret@127.0.0.1:5432/emmapp?schema=public}"
cd "$ROOT"

port_open() {
  local p="$1"
  bash -c "echo >/dev/tcp/127.0.0.1/${p}" >/dev/null 2>&1
}

wait_port() {
  local p="$1"
  local n="${2:-60}"
  local i
  for i in $(seq 1 "$n"); do
    if port_open "$p"; then
      return 0
    fi
    sleep 1
  done
  echo "Timeout: port $p" >&2
  return 1
}

mkdir -p backend
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
fi

if ! port_open 5432; then
  echo "[1/3] PostgreSQL embarqué..."
  (cd backend && node scripts/start-local-db.mjs) &
  wait_port 5432 90
else
  echo "[1/3] PostgreSQL déjà actif"
fi

if ! port_open 3000; then
  echo "[2/3] API NestJS (port 3000)..."
  (cd backend && npm run start:dev) &
  wait_port 3000 90
else
  echo "[2/3] API déjà active"
fi

if ! port_open 5173; then
  echo "[3/3] Back-office Vite (port 5173)..."
  (cd backoffice && npm run dev -- --host 0.0.0.0 --port 5173) &
  wait_port 5173 60
else
  echo "[3/3] Back-office déjà actif"
fi

echo ""
echo "=== EMMAPP prêt ==="
echo "Interface : http://127.0.0.1:5173/  (aussi via http://127.0.0.1:3000/)"
echo "Swagger   : http://127.0.0.1:3000/api/docs"
echo "Comptes   : admin@emmapp.cd / livreur@emmapp.cd — password123"
echo ""

# Garde le script vivant si on a lancé des enfants ; sinon on sort (déjà en cours).
wait || true
