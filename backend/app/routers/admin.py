from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_admin
from ..models import (
    Company, Deal, DealStatus, Negotiation, NegotiationStatus, Notification, Offer, OfferStatus, Payment,
    PaymentStatus, User, UserRole, UserStatus,
)
from ..schemas import AdminUserOut, ApprovalIn, OfferOut, StatsOut

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_admin)])


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    c = lambda q: db.scalar(q) or 0  # noqa: E731
    return StatsOut(
        users_pending=c(select(func.count(User.id)).where(User.status == UserStatus.pending)),
        users_approved=c(select(func.count(User.id)).where(User.status == UserStatus.approved, User.role == UserRole.member)),
        companies=c(select(func.count(Company.id))),
        offers_open=c(select(func.count(Offer.id)).where(Offer.status.in_([OfferStatus.open, OfferStatus.negotiating]))),
        negotiations_active=c(select(func.count(Negotiation.id)).where(Negotiation.status == NegotiationStatus.active)),
        deals_total=c(select(func.count(Deal.id))),
        deals_completed=c(select(func.count(Deal.id)).where(Deal.status == DealStatus.completed)),
        trade_volume=c(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PaymentStatus.paid)),
    )


@router.get("/users", response_model=list[AdminUserOut])
def users(status: str | None = None, db: Session = Depends(get_db)):
    q = select(User).options(joinedload(User.company)).where(User.role == UserRole.member).order_by(User.id.desc())
    if status:
        q = q.where(User.status == UserStatus(status))
    return db.scalars(q).all()


@router.post("/users/{user_id}/approval", response_model=AdminUserOut)
def approve(user_id: int, body: ApprovalIn, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role == UserRole.admin:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if body.approve:
        user.status = UserStatus.approved
        user.approved_at = datetime.now(timezone.utc)
        user.reject_reason = ""
        db.add(Notification(user_id=user.id, title="가입이 승인되었습니다", body="이제 BizBarter의 모든 기능을 이용할 수 있습니다.", link="/"))
    else:
        user.status = UserStatus.rejected
        user.reject_reason = body.reason
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def suspend(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role == UserRole.admin:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    user.status = UserStatus.suspended if user.status != UserStatus.suspended else UserStatus.approved
    db.commit()
    db.refresh(user)
    return user


@router.get("/offers", response_model=list[OfferOut])
def offers(db: Session = Depends(get_db)):
    return db.scalars(select(Offer).options(joinedload(Offer.company)).order_by(Offer.id.desc()).limit(200)).all()


@router.post("/offers/{offer_id}/hide", response_model=OfferOut)
def hide_offer(offer_id: int, db: Session = Depends(get_db)):
    o = db.get(Offer, offer_id)
    if not o:
        raise HTTPException(404)
    o.status = OfferStatus.cancelled
    db.commit()
    db.refresh(o)
    return o
