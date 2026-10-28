@echo off
chcp 65001 >nul
cd /d %~dp0
docker compose --profile tunnel down
pause
