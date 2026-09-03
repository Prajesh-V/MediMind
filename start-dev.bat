@echo off
echo ==================================================
echo MediMind - Start Development Server
echo ==================================================

echo Stopping existing Node/Next processes to prevent conflicts...
taskkill /F /IM node.exe 2>NUL

echo Starting MediMind Development Server...
npm run dev
