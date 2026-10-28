@echo off
chcp 65001 >nul
cd /d %~dp0
rem 최초 1회 또는 package.json/Dockerfile 변경 시에만 필요 (= docker compose up -d --build)
rem 이후에는 Docker Desktop 만 켜져 있으면 컨테이너가 자동 실행되고, 파일 저장 즉시 반영됩니다.
docker compose up -d --build
if errorlevel 1 (echo [오류] Docker Desktop 이 실행 중인지 확인하세요. & pause & exit /b 1)
echo.
echo  웹  http://localhost:3500     API  http://localhost:8500/docs
echo  이제 파일을 저장하면 화면/API 에 자동 반영됩니다. 이 창은 닫아도 됩니다.
start http://localhost:3500
timeout /t 5
