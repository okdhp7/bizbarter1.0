import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_approved_user, get_current_user
from ..models import Company, Notification, User, UserRole, UserStatus
from ..schemas import CompanyOut, CompanyUpdate, LoginIn, MeOut, NotificationOut, RegisterIn, TokenOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
me_router = APIRouter(prefix="/api/me", tags=["me"])


def _norm_brn(v: str) -> str:
    d = re.sub(r"\D", "", v)
    if len(d) != 10:
        raise HTTPException(422, "사업자등록번호는 숫자 10자리여야 합니다.")
    return f"{d[:3]}-{d[3:5]}-{d[5:]}"


@router.post("/register", response_model=MeOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == body.email.lower())):
        raise HTTPException(409, "이미 가입된 이메일입니다.")
    brn = _norm_brn(body.company.biz_reg_no)
    company = db.scalar(select(Company).where(Company.biz_reg_no == brn))
    if company is None:
        data = body.company.model_dump()
        data["biz_reg_no"] = brn
        company = Company(**data)
        db.add(company)
        db.flush()
    # 이미 등록된 기업이면 같은 기업의 추가 사용자로 가입 (관리자 승인 필요)
    user = User(
        email=body.email.lower(), password_hash=hash_password(body.password), name=body.name,
        phone=body.phone, position=body.position, company_id=company.id, status=UserStatus.pending,
    )
    db.add(user)
    for admin in db.scalars(select(User).where(User.role == UserRole.admin)).all():
        db.add(Notification(user_id=admin.id, title="신규 가입 승인 요청", body=f"{company.name} · {user.name}", link="/admin"))
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    if user.status == UserStatus.suspended:
        raise HTTPException(403, "이용이 정지된 계정입니다.")
    # pending/rejected 도 로그인은 허용 → 프론트에서 승인 대기 화면 표시
    return TokenOut(access_token=create_access_token(user.id, user.role.value), user=MeOut.model_validate(user))


@me_router.get("", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return user


@me_router.put("/company", response_model=CompanyOut)
def update_company(body: CompanyUpdate, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    company = db.get(Company, user.company_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company


@me_router.get("/notifications", response_model=list[NotificationOut])
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50)
    ).all()


@me_router.post("/notifications/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))):
        n.is_read = True
    db.commit()
    return {"ok": True}
