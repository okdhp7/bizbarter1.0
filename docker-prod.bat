@echo off
chcp 65001 >nul
cd /d %~dp0
echo BizBarter 운영 모드 (nginx 정적 빌드, 자동 반영 없음)
docker compose -f docker-compose.yml up -d --build
echo 웹: http://localhost:3500
pause
