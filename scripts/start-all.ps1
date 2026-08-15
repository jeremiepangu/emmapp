# EMMAPP — Démarrage local complet (sans Docker)
# Usage : .\scripts\start-all.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$nodeDir = "$env:LOCALAPPDATA\Programs\nodejs\PFiles64\nodejs"
$npm = Join-Path $nodeDir "npm.cmd"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:DATABASE_URL = "postgresql://emmapp:emmapp_secret@127.0.0.1:5432/emmapp?schema=public"

if (-not (Test-Path $npm)) {
  Write-Host "Node.js introuvable. Installez Node ou lancez depuis Cursor."
  exit 1
}

# PostgreSQL embarqué (si port 5432 libre)
$pgRunning = netstat -ano 2>$null | Select-String ":5432.*LISTENING"
if (-not $pgRunning) {
  Write-Host "[1/3] Démarrage PostgreSQL embarqué..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; node scripts/start-local-db.mjs" -WindowStyle Minimized
  Start-Sleep -Seconds 15
} else {
  Write-Host "[1/3] PostgreSQL déjà actif sur le port 5432"
}

# API backend
$apiRunning = netstat -ano 2>$null | Select-String ":3000.*LISTENING"
if (-not $apiRunning) {
  Write-Host "[2/3] Démarrage API (port 3000)..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; `$env:DATABASE_URL='$env:DATABASE_URL'; & '$npm' run start:dev" -WindowStyle Minimized
  Start-Sleep -Seconds 20
} else {
  Write-Host "[2/3] API déjà active sur le port 3000"
}

# Interface web
$webRunning = netstat -ano 2>$null | Select-String ":5173.*LISTENING"
if (-not $webRunning) {
  Write-Host "[3/3] Démarrage interface web (port 5173)..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backoffice'; & '$npm' run dev -- --host" -WindowStyle Minimized
  Start-Sleep -Seconds 5
} else {
  Write-Host "[3/3] Interface web déjà active sur le port 5173"
}

Write-Host ""
Write-Host "=== EMMAPP prêt ===" -ForegroundColor Green
Write-Host "Admin  : http://localhost:5173/"
Write-Host "Livreur: http://localhost:5173/mobile"
Write-Host "Comptes: admin@emmapp.cd / livreur@emmapp.cd — password123"
Write-Host ""
Start-Process "http://localhost:5173/"
