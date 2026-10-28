from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from .config import settings
from .database import Base, SessionLocal, engine
from .models import User, UserRole, UserStatus
from .routers import admin, assistant, auth, deals, negotiations, offers
from .security import hash_password, verify_password


def migrate_categories():
    """예전 분류명(구 15개·MasterBuy 구 명칭)을 MasterBuy 와 통일한 17개 대분류로 변환. 이미 변환된 행은 그대로."""
    from .models import Company, Offer
    from .services.catalog import CATALOG, guess_categories, migrate_name

    def conv(names, context=""):
        out = []
        for n in names or []:
            out += migrate_name(n, context)
        return list(dict.fromkeys(out))

    with SessionLocal() as db:
        changed = 0
        for o in db.scalars(select(Offer)).all():
            ctx = f"{o.title} {o.description}"
            names = conv(o.category_names or [o.category], ctx) or guess_categories(ctx, 1) or ["생활사무·가구"]
            wants = conv(o.want_categories, o.wants or "")
            if names != (o.category_names or []) or o.category != names[0] or wants != (o.want_categories or []):
                o.category_names, o.category, o.want_categories = names, names[0], wants
                changed += 1
        for c in db.scalars(select(Company)).all():
            ints = conv(c.interest_categories)
            if ints != (c.interest_categories or []):
                c.interest_categories = ints
                changed += 1
        if changed:
            db.commit()
            print(f"[categories] {changed}건을 17개 대분류로 변환")


def init_db():
    Base.metadata.create_all(bind=engine)
    # 간이 마이그레이션: 기존 DB 에 새 컬럼 추가 (운영 시 Alembic 권장)
    with engine.begin() as conn:
        for ddl in (
            "ALTER TABLE offers ADD COLUMN IF NOT EXISTS want_cash BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE offers ADD COLUMN IF NOT EXISTS want_cash_amount BIGINT",
            "ALTER TABLE offers ADD COLUMN IF NOT EXISTS category_names JSONB NOT NULL DEFAULT '[]'::jsonb",
        ):
            conn.execute(text(ddl))
    migrate_categories()
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == settings.ADMIN_EMAIL.lower()))
        if admin is None:
            db.add(User(email=settings.ADMIN_EMAIL.lower(), password_hash=hash_password(settings.ADMIN_PASSWORD),
                        name="관리자", role=UserRole.admin, status=UserStatus.approved))
            db.commit()
        elif not verify_password(settings.ADMIN_PASSWORD, admin.password_hash):
            # 설정(ADMIN_PASSWORD)을 바꾸면 다음 기동 시 관리자 비밀번호에 반영
            admin.password_hash = hash_password(settings.ADMIN_PASSWORD)
            admin.role, admin.status = UserRole.admin, UserStatus.approved
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="BizBarter API", version="1.0.0", lifespan=lifespan,
              description="기업간 재화·용역 물물교환 마켓플레이스")

app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

for r in (auth.router, auth.me_router, admin.router, offers.router, assistant.router, negotiations.router, deals.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
