#!/bin/sh
set -e
# 테이블 생성 + 관리자 계정 생성, SEED_DEMO=true 이면 데모 데이터 (이미 있으면 건너뜀)
if [ "$SEED_DEMO" = "true" ]; then
  python seed.py
else
  python -c "from app.main import init_db; init_db()"
fi
exec "$@"
