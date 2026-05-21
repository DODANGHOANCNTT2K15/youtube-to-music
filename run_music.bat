@echo off
title Running Youtube To Music App
cd /d "C:\CODEMEO\MYCODE\youtube-to-music"

:: 1. Chạy server Flask Python của bạn
start "" python app.py

:: 2. Chạy Ứng dụng Brave App (PWA) của bạn
cd /d "C:\Program Files\BraveSoftware\Brave-Browser\Application"
start "" "chrome_proxy.exe" --profile-directory=Default --app-id=dpckklemgligkjpihmopkkknllapmclp