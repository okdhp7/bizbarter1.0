@echo off
chcp 65001 >nul
cd /d %~dp0
echo ================================================================
echo  샘플 데이터 추가 (실행 중인 Docker 백엔드 컨테이너에 바로 반영)
echo ================================================================
docker compose ps --status running backend | findstr /i "bizbarter-backend" >nul
if errorlevel 1 (
  echo [오류] 백엔드 컨테이너가 실행 중이 아닙니다. 먼저 docker-up.bat 을 실행하세요.
  pause
  exit /b 1
)
echo [1/3] 최신 코드를 컨테이너로 복사
docker compose cp backend/app backend:/app
docker compose cp backend/seed.py backend:/app/seed.py
echo [2/3] 샘플 데이터 추가
docker compose exec -T backend python seed.py
echo [3/3] 백엔드 재시작 (새 코드 반영)
docker compose restart backend
echo.
echo 완료되었습니다. 브라우저를 새로고침하세요.
pause
