@echo off
echo ==================================================
echo   Lancement de l'audit A11Y Puppeteer - Renowify
echo ==================================================

REM 1) Afficher le dossier du projet
echo 1) Dossier courant : %cd%

REM 2) Lancer le script du crawler
echo 2) Lancement du crawler...
node crawler.js
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'exécution de crawler.js
    pause
    exit /b
)

REM 3) Générer le rapport
echo 3) Generation du rapport...
node report.js
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'exécution de report.js
    pause
    exit /b
)

REM 4) Lancer Chrome avec CORS désactivé et ouvrir le dashboard
echo 4) Ouverture du dashboard dans Chrome...

REM Chemin par défaut de Chrome Windows
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

REM Si Chrome est dans Program Files (x86)
if not exist %CHROME_PATH% (
    set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

REM Lancer Chrome avec CORS désactivé
%CHROME_PATH% --disable-web-security --user-data-dir="%TEMP%\chrome_dev" "%cd%\dashboard\index.html"

echo Terminé !
PAUSE
EXIT
