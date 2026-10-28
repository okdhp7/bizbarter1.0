@echo off
chcp 65001 >nul
echo [1/3] Python 가상환경 및 백엔드 패키지 설치
cd /d %~dp0backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
if not exist .env copy .env.example .env
echo [2/3] 프론트엔드 패키지 설치
cd /d %~dp0frontend
call npm install
echo [3/3] 완료. PostgreSQL 실행 후 run-backend.bat / run-frontend.bat 를 실행하세요.
echo   (Docker 사용 시: docker compose up -d)
pause
