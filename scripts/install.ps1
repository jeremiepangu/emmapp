# EMMAPP - Script d'installation automatique
# Executer dans PowerShell : .\scripts\install.ps1
# Certaines etapes demandent une elevation administrateur (UAC) - cliquez Oui

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$NodeHome = "$env:LOCALAPPDATA\Programs\nodejs\PFiles64\nodejs"

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Ensure-Node {
    Write-Step "Installation de Node.js (sans admin)"
    if (-not (Test-Path "$NodeHome\node.exe")) {
        $msi = "$env:LOCALAPPDATA\Temp\WinGet\OpenJS.NodeJS.LTS.24.19.0\node-v24.19.0-x64.msi"
        if (-not (Test-Path $msi)) {
            Write-Host "Telechargement via winget..." -ForegroundColor Yellow
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --disable-interactivity
            $msi = "$env:LOCALAPPDATA\Temp\WinGet\OpenJS.NodeJS.LTS.24.19.0\node-v24.19.0-x64.msi"
        }
        if (-not (Test-Path $msi)) {
            throw "MSI Node.js introuvable. Acceptez l'invite UAC winget ou installez Node.js manuellement."
        }
        $target = "$env:LOCALAPPDATA\Programs\nodejs"
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        Start-Process msiexec.exe -ArgumentList "/a `"$msi`" TARGETDIR=`"$target`" /qn" -Wait
    }
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$NodeHome*") {
        [Environment]::SetEnvironmentVariable("Path", "$NodeHome;$userPath", "User")
    }
    $env:PATH = "$NodeHome;$env:PATH"
    $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
    npm config set strict-ssl false --location=user
    Write-Host "Node.js $($(& `"$NodeHome\node.exe`" --version)) OK" -ForegroundColor Green
}

function Install-WingetPackage($id, $name) {
    Write-Step "Installation de $name (admin requis - acceptez UAC)"
    winget install $id --accept-package-agreements --accept-source-agreements --disable-interactivity
}

function Install-ProjectDeps {
    Write-Step "Installation des dependances npm (backend)"
    Set-Location "$ProjectRoot\backend"
    if (-not (Test-Path .env)) { Copy-Item .env.example .env }
    $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
    npm install
    npm approve-scripts --allow-scripts-pending 2>$null
    npx prisma generate

    Write-Step "Installation des dependances npm (backoffice)"
    Set-Location "$ProjectRoot\backoffice"
    npm install
}

function Setup-Database {
    Write-Step "Demarrage PostgreSQL (Docker)"
    Set-Location $ProjectRoot
    docker compose up -d
    Start-Sleep -Seconds 5

    Write-Step "Migration et donnees de demo"
    Set-Location "$ProjectRoot\backend"
    npx prisma migrate dev --name init
    npm run prisma:seed
}

function Setup-Flutter {
    Write-Step "Configuration Flutter mobile"
    Set-Location "$ProjectRoot\mobile"
    if (-not (Test-Path android)) {
        flutter create . --project-name emmapp_mobile
    }
    flutter pub get
}

# --- Execution ---
Write-Host "=== EMMAPP - Installation ===" -ForegroundColor Blue
Ensure-Node

$installAll = Read-Host "Installer Docker Desktop et Git via winget ? (O/n)"
if ($installAll -ne "n") {
    Install-WingetPackage "Docker.DockerDesktop" "Docker Desktop"
    Install-WingetPackage "Git.Git" "Git"
}

Install-ProjectDeps

$setupDb = Read-Host "Demarrer PostgreSQL et initialiser la BDD ? (O/n)"
if ($setupDb -ne "n") {
    Setup-Database
}

if (Get-Command flutter -ErrorAction SilentlyContinue) {
    Setup-Flutter
} else {
    Write-Host "`nFlutter non installe. Installez-le depuis https://flutter.dev/docs/get-started/install/windows" -ForegroundColor Yellow
}

Write-Host "`n=== Installation terminee ===" -ForegroundColor Green
Write-Host "Backend  : cd backend && npm run start:dev"
Write-Host "Backoffice: cd backoffice && npm run dev"
Write-Host "Mobile   : cd mobile && flutter run"
