@echo off
chcp 65001 >nul
cd /d %~dp0
echo ================================================================
echo  외부 접속용 임시 주소 만들기 (Cloudflare Tunnel)
echo  - LTE 등 다른 네트워크의 휴대폰에서도 접속할 수 있습니다
echo  - docker-up.bat 이 실행 중이면 수정사항이 외부에서도 즉시 반영됩니다
echo  - 주소를 아는 사람은 누구나 접속할 수 있으니 테스트에만 사용하세요
echo ================================================================
docker compose --profile tunnel up -d tunnel
if errorlevel 1 (
  echo [오류] 먼저 docker-up.bat 으로 서비스를 실행하세요.
  pause
  exit /b 1
)
echo 주소 발급 중... (최대 30초)
powershell -NoProfile -Command "$u=$null; for($i=0;$i -lt 30 -and -not $u;$i++){Start-Sleep 1; $m=(docker compose logs tunnel 2>&1 | Out-String) | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches; if($m){$u=$m.Matches[-1].Value}}; if($u){Write-Host ''; Write-Host ('  URL: ' + $u) -ForegroundColor Green; Set-Clipboard $u; Write-Host '  (copied to clipboard)'}else{Write-Host 'URL not found. Run: docker compose logs tunnel'}"
echo.
echo 위 주소를 휴대폰으로 보내 접속하세요. 주소는 클립보드에 복사되어 있습니다.
echo 터널 종료: docker compose stop tunnel   (또는 docker-down.bat)
echo 터널을 다시 시작하면 주소가 바뀝니다.
pause
