@echo off
echo ==================================================
echo MediMind - Restart Development Server
echo ==================================================

echo Stopping existing Node/Next processes safely...
taskkill /F /IM node.exe 2>NUL

echo Starting MediMind Development Server...
npm run dev
