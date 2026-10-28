import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..deps import get_approved_user
from ..models import (
    Deal, DealStatus, Message, MessageKind, Negotiation, NegotiationStatus, Offer, OfferStatus, Payment,
    PaymentStatus, User,
)
from ..schemas import DealOut, PayIn, SignIn
from ..services.notify import notify_company
from ..services.realtime import manager

router = APIRouter(prefix="/api/deals", tags=["deals"])

_OPTS = [joinedload(Deal.offer).joinedload(Offer.company), joinedload(Deal.owner_company),
         joinedload(Deal.buyer_company), joinedload(Deal.payments)]


def _side(d: Deal, user: User) -> str | None:
    if user.company_id == d.owner_company_id:
        return "owner"
    if user.company_id == d.buyer_company_id:
        return "buyer"
    return None


def deal_out(d: Deal, user: User) -> dict:
    o = DealOut.model_validate(d).model_dump(mode="json")
    o["my_side"] = _side(d, user)
    return o


def _load(db: Session, deal_id: int, user: User) -> Deal:
    d = db.get(Deal, deal_id, options=_OPTS, populate_existing=True)
    if not d or _side(d, user) is None:
        raise HTTPException(404, "거래를 찾을 수 없습니다.")
    return d


def _needs_cash(d: Deal) -> bool:
    return int(d.terms.get("cash_amount") or 0) > 0 and d.terms.get("cash_payer") in ("owner", "buyer")


def _sys(db: Session, d: Deal, text: str):
    m = Message(negotiation_id=d.negotiation_id, kind=MessageKind.system, content=text)
    db.add(m)
    db.flush()
    manager.broadcast_from_sync(d.negotiation_id, {"event": "message", "message": {
        "id": m.id, "negotiation_id": d.negotiation_id, "sender_id": None, "sender_company_id": None, "sender_name": None,
        "kind": "system", "content": text, "proposal": None, "created_at": datetime.now(timezone.utc).isoformat()}})


def _maybe_complete(db: Session, d: Deal):
    paid = not _needs_cash(d) or any(p.status == PaymentStatus.paid for p in d.payments)
    if d.owner_delivered_at and d.buyer_delivered_at and paid:
        d.status = DealStatus.completed
        d.completed_at = datetime.now(timezone.utc)
        offer = db.get(Offer, d.offer_id)
        offer.status = OfferStatus.closed
        _sys(db, d, f"거래 {d.deal_no}가 완료되었습니다. 에스크로 차액이 정산되었습니다." if _needs_cash(d) else f"거래 {d.deal_no}가 완료되었습니다.")
        for cid in (d.owner_company_id, d.buyer_company_id):
            notify_company(db, cid, "거래 완료", d.deal_no, f"/deals/{d.id}")


@router.get("")
def list_deals(user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    ds = db.scalars(select(Deal).options(*_OPTS)
                    .where(or_(Deal.owner_company_id == user.company_id, Deal.buyer_company_id == user.company_id))
                    .order_by(Deal.id.desc())).unique().all()
    return [deal_out(d, user) for d in ds]


@router.get("/{deal_id}")
def get_deal(deal_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    return deal_out(_load(db, deal_id, user), user)


@router.post("/{deal_id}/sign")
def sign(deal_id: int, body: SignIn, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    d = _load(db, deal_id, user)
    if d.status != DealStatus.contract_pending:
        raise HTTPException(400, "서명 단계가 아닙니다.")
    if not body.agree:
        raise HTTPException(422, "계약 내용에 동의해야 서명할 수 있습니다.")
    now = datetime.now(timezone.utc)
    side = _side(d, user)
    if side == "owner":
        if d.owner_signed_at:
            raise HTTPException(400, "이미 서명했습니다.")
        d.owner_signed_at, d.owner_signer = now, f"{body.signer_name} ({user.email})"
    else:
        if d.buyer_signed_at:
            raise HTTPException(400, "이미 서명했습니다.")
        d.buyer_signed_at, d.buyer_signer = now, f"{body.signer_name} ({user.email})"
    other = d.buyer_company_id if side == "owner" else d.owner_company_id
    if d.owner_signed_at and d.buyer_signed_at:
        if _needs_cash(d):
            d.status = DealStatus.payment_pending
            payer = d.owner_company_id if d.terms["cash_payer"] == "owner" else d.buyer_company_id
            payee = d.buyer_company_id if payer == d.owner_company_id else d.owner_company_id
            amount = int(d.terms["cash_amount"])
            db.add(Payment(deal_id=d.id, payer_company_id=payer, payee_company_id=payee, amount=amount,
                           fee=int(amount * settings.PLATFORM_FEE_RATE / 100)))
            _sys(db, d, "양측 서명 완료. 차액 결제를 진행해 주세요.")
        else:
            d.status = DealStatus.in_progress
            _sys(db, d, "양측 서명 완료. 계약이 체결되었습니다. 교환을 이행해 주세요.")
        for cid in (d.owner_company_id, d.buyer_company_id):
            notify_company(db, cid, "계약 체결", d.deal_no, f"/deals/{d.id}")
    else:
        notify_company(db, other, "상대방이 계약서에 서명했습니다", d.deal_no, f"/deals/{d.id}")
    db.commit()
    return deal_out(_load(db, deal_id, user), user)


@router.post("/{deal_id}/pay")
def pay(deal_id: int, body: PayIn, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    """차액 결제 (데모: 모의 PG). 실제 연동 시 토스페이먼츠/나이스페이 등 PG 승인 콜백에서 처리."""
    d = _load(db, deal_id, user)
    if d.status != DealStatus.payment_pending:
        raise HTTPException(400, "결제 단계가 아닙니다.")
    p = next((p for p in d.payments if p.status == PaymentStatus.pending), None)
    if not p or p.payer_company_id != user.company_id:
        raise HTTPException(403, "결제 의무가 있는 기업만 결제할 수 있습니다.")
    p.method = body.method
    p.status = PaymentStatus.paid
    p.paid_at = datetime.now(timezone.utc)
    p.pg_tid = f"MOCK-{uuid.uuid4().hex[:16].upper()}"
    d.status = DealStatus.in_progress
    _sys(db, d, f"차액 {p.amount:,}원 결제가 완료되었습니다 (에스크로 보관). 교환을 이행해 주세요.")
    notify_company(db, p.payee_company_id, "차액 결제 완료", d.deal_no, f"/deals/{d.id}")
    db.commit()
    return deal_out(_load(db, deal_id, user), user)


@router.post("/{deal_id}/deliver")
def deliver(deal_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    d = _load(db, deal_id, user)
    if d.status != DealStatus.in_progress:
        raise HTTPException(400, "이행 단계가 아닙니다.")
    now = datetime.now(timezone.utc)
    if _side(d, user) == "owner":
        d.owner_delivered_at = d.owner_delivered_at or now
    else:
        d.buyer_delivered_at = d.buyer_delivered_at or now
    _sys(db, d, f"{user.company.name}에서 이행 완료를 등록했습니다.")
    _maybe_complete(db, d)
    db.commit()
    return deal_out(_load(db, deal_id, user), user)


@router.post("/{deal_id}/cancel")
def cancel(deal_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    d = _load(db, deal_id, user)
    if d.status not in (DealStatus.contract_pending, DealStatus.payment_pending):
        raise HTTPException(400, "계약 체결/결제 이후에는 상호 협의를 통해서만 취소할 수 있습니다.")
    d.status = DealStatus.cancelled
    for p in d.payments:
        if p.status == PaymentStatus.pending:
            p.status = PaymentStatus.failed
    n = db.get(Negotiation, d.negotiation_id)
    n.status = NegotiationStatus.active  # 재협상 가능
    _sys(db, d, f"거래 {d.deal_no}가 취소되었습니다. 협상을 계속할 수 있습니다.")
    db.commit()
    return deal_out(_load(db, deal_id, user), user)
