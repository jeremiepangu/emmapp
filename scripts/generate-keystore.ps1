# Génère la clé de signature Android (à faire UNE SEULE FOIS)
# Conservez upload-keystore.jks en lieu sûr — perte = impossible de mettre à jour l'app

$keytool = "keytool"
if (Test-Path "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe") {
    $keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
} elseif (Test-Path "C:\Program Files\Java\*\bin\keytool.exe") {
    $keytool = (Get-ChildItem "C:\Program Files\Java\*\bin\keytool.exe" | Select-Object -First 1).FullName
}

$out = Join-Path $PSScriptRoot "..\mobile\android\app\upload-keystore.jks"
Write-Host "Generation de la cle: $out"

& $keytool -genkey -v `
    -keystore $out `
    -alias upload `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass EMMAPP2026! `
    -keypass EMMAPP2026! `
    -dname "CN=EMMAPP Mobile, OU=IT, O=EMMAPP, L=Kinshasa, ST=Kinshasa, C=CD"

Write-Host ""
Write-Host "IMPORTANT - Ajoutez ces secrets GitHub:" -ForegroundColor Yellow
Write-Host "  ANDROID_KEYSTORE_PASSWORD = EMMAPP2026!"
Write-Host "  ANDROID_KEY_PASSWORD = EMMAPP2026!"
Write-Host "  ANDROID_KEYSTORE_BASE64 = (voir commande ci-dessous)"
Write-Host ""
Write-Host "[Convert]::ToBase64String([IO.File]::ReadAllBytes('$out'))"
