@echo off
title PUSH GITHUB - Elections Municipales

echo ============================================
echo   DEPLOIEMENT GITHUB - BRANCHE MAIN
echo ============================================
echo.

cd /d C:\dev\elections-municipales

echo Verification du dossier...
if not exist .git (
    echo ERREUR : Ce dossier n'est pas un depot Git.
    pause
    exit /b
)

echo.
echo Passage sur la branche main...
git checkout main

echo.
echo Ajout des modifications...
git add .

echo.
set /p MESSAGE="Message du commit : "
if "%MESSAGE%"=="" (
    set MESSAGE=Mise a jour application elections municipales
)

echo.
echo Commit en cours...
git commit -m "%MESSAGE%"

echo.
echo Push vers GitHub...
git push origin main

echo.
echo ============================================
echo   DEPLOIEMENT TERMINE
echo ============================================
pause
