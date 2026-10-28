# BizBarter 1.0 — 기업간 재화·용역 물물교환 마켓플레이스

React(Vite + TypeScript) · FastAPI · PostgreSQL 기반 B2B 물물교환 플랫폼입니다.

## 용어: 교환 오퍼 (Offer)

사용자가 올리는 '공고'의 이름은 **교환 오퍼(Offer)** 로 정했습니다.
"내가 내놓는 것(제공) ⇄ 내가 원하는 것(희망)"을 한 장에 담는다는 의미입니다.
다른 후보: `바터 카드`, `교환 제안서`, `딜 포스트`. 이름을 바꾸려면 프론트엔드 문구만 고치면 됩니다 (API 경로는 `/offers`).

## 주요 기능

| 영역 | 내용 |
|---|---|
| 회원가입·승인 | 담당자 계정과 기업정보(사업자등록번호, 주 사업분야, 보유기술, 사업실적, 인증, 제공 가능/필요 재화·용역, 관심 카테고리)를 입력합니다. 관리자가 **승인한 뒤에만** 서비스를 이용할 수 있습니다. 같은 사업자번호로 가입하면 그 기업의 추가 담당자로 등록됩니다. |
| 대화형 오퍼 등록 | 챗봇이 질문하고 사용자가 답하는 방식입니다. 자유롭게 쓴 설명에서 카테고리·제목·수량·가치·교환 희망을 자동으로 추출해 추천값으로 보여 줍니다. 이전 단계로 돌아가거나 처음부터 다시 할 수 있고, 직접 입력 폼도 있습니다. |
| AI 맞춤 추천 | 기업 특성 정보를 바탕으로 **양방향 매칭**을 합니다. 오퍼가 제공하는 것이 우리가 필요한 것과 맞는지(수요 적합도), 오퍼 등록자가 원하는 것을 우리가 줄 수 있는지(상호 교환성)를 함께 봅니다. 여기에 카테고리, 업종·기술 연관성, 협상 이력, 최신성을 반영하고 **추천 사유**를 함께 보여 줍니다. 오퍼 등록자에게는 반대 방향으로 *추천 기업*을 보여 줍니다. |
| 협상 메신저 | 오퍼마다 1:1 채팅방이 열리며 WebSocket으로 실시간 전송되고 입력 중 표시도 됩니다. **거래조건 제안 카드**(양측 제공물, 현금 차액, 이행 기한, 특약)를 보내면 상대가 수락·거절하고, 보낸 쪽은 철회할 수 있습니다. |
| 거래 실행 | 제안을 수락하면 거래가 생성되고 **계약서가 자동으로 작성**됩니다. 이후 양측 전자서명 → 차액 결제(에스크로, 수수료) → 양측 이행 완료 → 거래 완료 순서로 진행되며, 거래가 끝나면 오퍼가 자동 마감됩니다. |
| 알림·관리자 | 승인, 협상 요청, 메시지, 제안, 서명, 결제 이벤트마다 알림이 갑니다. 관리자 화면에서는 통계 확인, 가입 승인·반려, 회원 정지, 오퍼 비공개 처리를 할 수 있습니다. |

## 실행 방법 1 — Docker (권장)

Docker Desktop 만 있으면 됩니다. DB·백엔드·프론트엔드가 모두 컨테이너로 실행됩니다.

| 서비스 | 컨테이너 | 주소 |
|---|---|---|
| 웹(프론트엔드, nginx) | bizbarter-frontend | http://localhost:3500 |
| API(백엔드, FastAPI) | bizbarter-backend | http://localhost:8500/docs |
| DB(PostgreSQL 16) | bizbarter-db | localhost:5435 (bizbarter / bizbarter) |

```bat
docker-up.bat      :: 최초 1회 실행 (= docker compose up -d --build). 이후엔 Docker Desktop 만 켜져 있으면 자동 실행·자동 반영
docker-logs.bat    :: 로그 보기
docker-down.bat    :: 중지 (데이터는 pgdata 볼륨에 유지)
docker-prod.bat    :: 운영 모드 (nginx 정적 빌드, 자동 반영 없음)
```

### 개발 모드 — 수정하면 자동 반영 (소스 마운트 + polling)

소스 폴더가 컨테이너에 직접 마운트되어 있어(FindBid 와 같은 방식) 파일을 저장하면 polling 으로 감지해
자동으로 반영됩니다. 사람이 다시 실행할 것은 없습니다.

| 수정한 파일 | 자동으로 일어나는 일 |
|---|---|
| `frontend/src/**`, `public/**`, `index.html` | Vite HMR 로 브라우저 화면이 새로고침 없이 갱신 |
| `backend/app/**` | uvicorn 이 API 서버를 자동 재시작 (1~2초) |
| `package.json`, `package-lock.json`, `requirements.txt`, Dockerfile | `docker compose up -d --build` 1회 실행 (패키지 재설치) |

요구사항: Docker Desktop. 컨테이너는 `restart: unless-stopped` 라 Docker Desktop 이 켜지면 자동으로 실행되므로 별도 창·배치 실행이 필요 없습니다. `package.json`/`Dockerfile` 을 바꾼 경우에만 `docker compose up -d --build` 를 다시 실행합니다.

### 휴대폰에서 확인하기

| 상황 | 방법 |
|---|---|
| 같은 와이파이 | PC 의 IP(`ipconfig` 의 IPv4)로 `http://192.168.x.x:3500` 접속 |
| 외부 네트워크(LTE 등) | `docker-tunnel.bat` 실행 → 발급된 `https://xxxx.trycloudflare.com` 주소로 접속 (클립보드에 복사됨) |

두 경우 모두 개발 모드에서는 수정사항이 휴대폰에도 즉시 반영됩니다. 터널 주소는 누구나 접속할 수 있으므로 테스트에만 쓰고,
`docker compose stop tunnel` 로 종료하세요. 다시 실행하면 주소가 바뀝니다.

### 운영 모드

`docker-prod.bat` (= `docker compose -f docker-compose.yml up -d --build`) — 프론트엔드를 빌드해 nginx 로 서비스합니다.

- 첫 실행 시 관리자 계정과 데모 데이터가 자동으로 생성됩니다 (`SEED_DEMO=false` 로 끌 수 있음).
- 비밀키·API키 등은 프로젝트 루트에 `.env` 파일을 만들어 넣으면 compose 가 읽습니다
  (`JWT_SECRET`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `SEED_DEMO` …).
- DB 를 완전히 초기화하려면 `docker compose down -v`.

## 실행 방법 2 — 로컬 개발 (Python + Node 직접 설치)

DB 만 Docker 로 띄우고(`docker compose up -d db`) 앱은 로컬에서 실행합니다.

```bat
setup.bat           :: 가상환경/npm 설치 (처음 한 번)
seed-demo.bat       :: 데모 데이터 (선택)
run-backend.bat     :: http://localhost:8500  (--reload)
run-frontend.bat    :: http://localhost:3500  (vite dev, /api → 8500 프록시)
```

### 계정

- 관리자: `admin@bizbarter.kr` / `bizbarter2026` — `backend/.env`에서 바꿀 수 있습니다
- 데모 기업(seed): `pack@demo.kr`, `soft@demo.kr`, `logi@demo.kr`, `design@demo.kr`, `food@demo.kr` / `demo1234!`

### 환경변수 (`backend/.env`)

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:pw@host:5432/db` |
| `JWT_SECRET` | 운영 환경에서는 반드시 32자 이상의 임의 문자열로 바꾸세요 |
| `ANTHROPIC_API_KEY` | (선택) 설정하면 대화형 등록 도우미가 Claude로 자유서술 답변을 분석합니다. 없으면 규칙 기반으로 동작합니다 |
| `PLATFORM_FEE_RATE` | 차액 정산 수수료(%) |

## 구조

```
backend/
  app/
    main.py            앱 생성, 관리자 계정 자동 생성, 테이블 생성
    models.py          Company, User, Offer, OfferDraft, Negotiation, Message, Deal, Payment, Notification
    schemas.py         Pydantic 입출력 스키마
    routers/
      auth.py          회원가입·로그인·내 정보·기업 프로필·알림
      admin.py         통계, 가입 승인/반려, 정지, 오퍼 비공개
      offers.py        오퍼 CRUD·검색, 추천 API
      assistant.py     대화형 오퍼 등록 세션
      negotiations.py  협상방, 메시지, 거래조건 제안/수락, WebSocket
      deals.py         거래, 전자서명, 차액 결제, 이행, 취소
    services/
      recommender.py   TF-IDF(한국어 어절+음절 bigram) 기반 양방향 추천 엔진
      assistant.py     Q&A 상태머신, 금액 파싱, (선택) LLM 추출
      contract.py      물물교환 계약서 생성
      catalog.py       카테고리 사전 / 키워드 분류
      realtime.py      WebSocket 연결 관리
  seed.py              데모 데이터
frontend/src/
  pages/               Login, Register, Pending, Dashboard, Offers, OfferDetail, OfferNew(대화형),
                       MyOffers, Negotiations(메신저), Deals, DealDetail, Profile, Admin
  components/          Layout, CompanyForm, ui(OfferCard, Badge…)
```

## 운영 전 확장 포인트

- **결제**: `deals.py`의 `pay()`는 데모용 모의 PG입니다. 토스페이먼츠, 나이스페이 등의 승인 API와 웹훅으로 바꾸고, 에스크로는 이행 완료 시점에 정산하도록 연결해야 합니다.
- **전자서명**: 지금은 동의 체크와 서명자명·시각을 기록하는 방식입니다. 법적 효력을 강화하려면 공동인증서, 간편인증, 모두싸인 API 등을 연동하세요.
- **사업자 진위 확인**: 국세청 사업자등록정보 진위확인 API(공공데이터포털)를 가입 단계에 붙이면 관리자 승인 작업이 줄어듭니다.
- **추천 고도화**: `recommender.py` 의 `TfIdf`·`cosine` 계층을 pgvector와 임베딩 모델로 교체하고, 협상 성사율과 클릭 데이터를 가중치 학습에 활용하세요.
- **확장성**: WebSocket을 여러 인스턴스에서 운영하려면 Redis Pub/Sub이나 PostgreSQL LISTEN/NOTIFY가 필요하고, 스키마 변경은 Alembic 마이그레이션으로 관리하세요.
- **세금계산서**: 물물교환도 부가가치세 과세 대상이므로 거래 완료 시 양측 세금계산서를 발행하도록 연동하세요.
