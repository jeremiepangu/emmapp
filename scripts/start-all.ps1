# EMMAPP — Démarrage local complet (sans Docker)
# Usage : .\scripts\start-all.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:DATABASE_URL = "postgresql://emmapp:emmapp_secret@127.0.0.1:5432/emmapp?schema=public"

function Find-Npm {
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\nodejs\PFiles64\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\Programs\nodejs\nodejs\npm.cmd",
    "$env:ProgramFiles\nodejs\npm.cmd"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Test-PortListening([int]$Port) {
  $escaped = [regex]::Escape(":$Port")
  $hit = netstat -ano 2>$null | Select-String "$escaped\s+.*LISTENING"
  return [bool]$hit
}

function Wait-PortListening([int]$Port, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening $Port) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

$npm = Find-Npm
if (-not $npm) {
  Write-Host "Node.js / npm introuvable. Installez Node 20+ puis relancez."
  exit 1
}

$npmDir = Split-Path -Parent $npm
$env:PATH = "$npmDir;$env:PATH"
Write-Host "npm : $npm"

$envFile = Join-Path $root "backend\.env"
$envExample = Join-Path $root "backend\.env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Host "Fichier backend\.env cree depuis .env.example"
}

if (-not (Test-Path (Join-Path $root "backend\node_modules"))) {
  Write-Host "Installation des dependances backend..."
  Push-Location (Join-Path $root "backend")
  & $npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install backend a echoue" }
  Pop-Location
}

if (-not (Test-Path (Join-Path $root "backoffice\node_modules\vite"))) {
  Write-Host "Installation des dependances backoffice..."
  Push-Location (Join-Path $root "backoffice")
  & $npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install backoffice a echoue" }
  Pop-Location
}

if (-not (Test-PortListening 5432)) {
  Write-Host "[1/3] Demarrage PostgreSQL embarque..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; node scripts/start-local-db.mjs" -WindowStyle Minimized
  if (-not (Wait-PortListening 5432 45)) {
    Write-Host "PostgreSQL n'a pas ouvert le port 5432. L'API peut echouer, mais on continue le front."
  }
} else {
  Write-Host "[1/3] PostgreSQL deja actif sur le port 5432"
}

if (-not (Test-PortListening 3000)) {
  Write-Host "[2/3] Demarrage API (port 3000)..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; `$env:DATABASE_URL='$env:DATABASE_URL'; & '$npm' run start:dev" -WindowStyle Minimized
} else {
  Write-Host "[2/3] API deja active sur le port 3000"
}

if (-not (Test-PortListening 5175)) {
  Write-Host "[3/3] Demarrage interface web (port 5175)..."
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backoffice'; & '$npm' run dev -- --host --port 5175" -WindowStyle Minimized
  if (-not (Wait-PortListening 5175 40)) {
    Write-Host ""
    Write-Host "ECHEC : rien n'ecoute sur http://localhost:5175/" -ForegroundColor Red
    Write-Host "Ouvrez la fenetre PowerShell minimisée du backoffice pour voir l'erreur npm/vite."
    exit 1
  }
} else {
  Write-Host "[3/3] Interface web deja active sur le port 5175"
}

Write-Host ""
Write-Host "=== EMMAPP pret ===" -ForegroundColor Green
Write-Host "Admin  : http://localhost:5175/"
Write-Host "Livreur: http://localhost:5175/mobile"
Write-Host "Comptes: admin@emmapp.cd / livreur@emmapp.cd — password123"
Write-Host ""
Start-Process "http://localhost:5175/"
