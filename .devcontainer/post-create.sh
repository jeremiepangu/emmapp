#!/usr/bin/env bash
set -e

echo "=== EMMAPP Codespaces - Configuration ==="

cd /workspace/backend
cp -n .env.example .env 2>/dev/null || true

npm install
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
npm run prisma:seed || true

cd /workspace/backoffice
npm install

echo ""
echo "=== Demarrage des services ==="
echo "Terminal 1: cd backend && npm run start:dev"
echo "Terminal 2: cd backoffice && npm run dev -- --host"
echo ""
echo "Comptes demo: admin@emmapp.cd / livreur@emmapp.cd (password123)"
