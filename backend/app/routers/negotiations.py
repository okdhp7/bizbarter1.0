from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import SessionLocal, get_db
from ..deps import get_approved_user
from ..models import (
    Company, Deal, DealStatus, Message, MessageKind, Negotiation, NegotiationStatus, Offer, OfferStatus, User, UserStatus,
)
from ..schemas import MessageIn, MessageOut, NegotiationOut, ProposalIn
from ..security import decode_token
from ..services.assistant import fmt_won
from ..services.contract import build_contract
from ..services.notify import notify_company
from ..services.realtime import manager

router = APIRouter(prefix="/api", tags=["negotiations"])


def _side(n: Negotiation, user: User) -> str | None:
    if user.company_id == n.owner_company_id:
        return "owner"
    if user.company_id == n.buyer_company_id:
        return "buyer"
    return None


def _load(db: Session, nid: int, user: User) -> Negotiation:
    n = db.get(Negotiation, nid, options=[joinedload(Negotiation.offer).joinedload(Offer.company),
                                          joinedload(Negotiation.owner_company), joinedload(Negotiation.buyer_company)])
    if not n or _side(n, user) is None:
        raise HTTPException(404, "협상방을 찾을 수 없습니다.")
    return n


def msg_out(m: Message) -> dict:
    d = MessageOut.model_validate(m).model_dump(mode="json")
    d["sender_name"] = m.sender.name if m.sender else None
    return d


def neg_out(db: Session, n: Negotiation, user: User) -> dict:
    side = _side(n, user)
    last_read = n.owner_last_read_at if side == "owner" else n.buyer_last_read_at
    uq = select(func.count(Message.id)).where(Message.negotiation_id == n.id, Message.sender_company_id != user.company_id)
    if last_read:
        uq = uq.where(Message.created_at > last_read)
    last = db.scalar(select(Message).where(Message.negotiation_id == n.id).order_by(Message.id.desc()).limit(1))
    deal_id = db.scalar(select(Deal.id).where(Deal.negotiation_id == n.id, Deal.status != DealStatus.cancelled).order_by(Deal.id.desc()).limit(1))
    d = NegotiationOut.model_validate(n).model_dump(mode="json")
    d.update(my_side=side, unread=db.scalar(uq) or 0, last_message=(last.content[:80] if last else None), deal_id=deal_id)
    return d


def _post(db: Session, n: Negotiation, user: User | None, kind: MessageKind, content: str, proposal: dict | None = None) -> Message:
    m = Message(negotiation_id=n.id, sender_id=user.id if user else None,
                sender_company_id=user.company_id if user else None, kind=kind, content=content, proposal=proposal)
    db.add(m)
    n.last_message_at = datetime.now(timezone.utc)
    db.flush()
    return m


def _push(n: Negotiation, m: Message, event: str = "message"):
    manager.broadcast_from_sync(n.id, {"event": event, "message": msg_out(m)})


@router.post("/offers/{offer_id}/negotiations")
def start_negotiation(offer_id: int, body: dict | None = None, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    offer = db.get(Offer, offer_id)
    if not offer or offer.status not in (OfferStatus.open, OfferStatus.negotiating):
        raise HTTPException(404, "협상 가능한 오퍼가 아닙니다.")
    if offer.company_id == user.company_id:
        raise HTTPException(400, "자사 오퍼에는 협상을 요청할 수 없습니다.")
    n = db.scalar(select(Negotiation).where(Negotiation.offer_id == offer_id, Negotiation.buyer_company_id == user.company_id))
    if n is None:
        n = Negotiation(offer_id=offer_id, owner_company_id=offer.company_id, buyer_company_id=user.company_id, initiated_by=user.id)
        db.add(n)
        db.flush()
        buyer = db.get(Company, user.company_id)
        _post(db, n, None, MessageKind.system, f"{buyer.name}에서 '{offer.title}' 오퍼에 대한 협상을 요청했습니다.")
        first = str((body or {}).get("content") or "").strip()[:5000]
        if first:
            _post(db, n, user, MessageKind.text, first)
        offer.status = OfferStatus.negotiating
        notify_company(db, offer.company_id, "새 협상 요청", f"{buyer.name} → {offer.title}", f"/negotiations/{n.id}")
        db.commit()
    return neg_out(db, _load(db, n.id, user), user)


@router.get("/negotiations")
def list_negotiations(user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    ns = db.scalars(
        select(Negotiation)
        .options(joinedload(Negotiation.offer).joinedload(Offer.company), joinedload(Negotiation.owner_company), joinedload(Negotiation.buyer_company))
        .where(or_(Negotiation.owner_company_id == user.company_id, Negotiation.buyer_company_id == user.company_id))
        .order_by(Negotiation.last_message_at.desc())
    ).unique().all()
    return [neg_out(db, n, user) for n in ns]


@router.get("/negotiations/{nid}")
def get_negotiation(nid: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    return neg_out(db, _load(db, nid, user), user)


@router.get("/negotiations/{nid}/messages")
def messages(nid: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    n = _load(db, nid, user)
    ms = db.scalars(select(Message).options(joinedload(Message.sender)).where(Message.negotiation_id == nid).order_by(Message.id)).all()
    now = datetime.now(timezone.utc)
    if _side(n, user) == "owner":
        n.owner_last_read_at = now
    else:
        n.buyer_last_read_at = now
    db.commit()
    return [msg_out(m) for m in ms]


@router.post("/negotiations/{nid}/messages")
def send(nid: int, body: MessageIn, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    n = _load(db, nid, user)
    if n.status == NegotiationStatus.closed:
        raise HTTPException(400, "종료된 협상입니다.")
    m = _post(db, n, user, MessageKind.text, body.content)
    other = n.buyer_company_id if _side(n, user) == "owner" else n.owner_company_id
    notify_company(db, other, f"새 메시지 · {n.offer.title}", body.content[:100], f"/negotiations/{n.id}")
    db.commit()
    db.refresh(m)
    _push(n, m)
    return msg_out(m)


@router.post("/negotiations/{nid}/proposals")
def propose(nid: int, body: ProposalIn, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    n = _load(db, nid, user)
    if n.status != NegotiationStatus.active:
        raise HTTPException(400, "진행 중인 협상에서만 제안할 수 있습니다.")
    if body.cash_payer != "none" and body.cash_amount <= 0:
        raise HTTPException(422, "현금 정산 금액을 입력해 주세요.")
    if body.cash_amount > 0 and not n.offer.allow_cash:
        raise HTTPException(422, "이 오퍼는 현금 차액 정산을 허용하지 않습니다.")
    # 이전 대기 중 제안은 자동 철회
    for old in db.scalars(select(Message).where(Message.negotiation_id == nid, Message.kind == MessageKind.proposal)):
        if old.proposal and old.proposal.get("state") == "pending":
            old.proposal = {**old.proposal, "state": "superseded"}
    p = body.model_dump()
    if p["cash_payer"] == "none":
        p["cash_amount"] = 0
    p.update(state="pending", proposer_side=_side(n, user))
    cash_txt = "" if not p["cash_amount"] else f" / 차액 {fmt_won(p['cash_amount'])} ({'등록기업' if p['cash_payer'] == 'owner' else '요청기업'} 지급)"
    m = _post(db, n, user, MessageKind.proposal, f"거래조건 제안: {p['owner_gives']} ⇄ {p['buyer_gives']}{cash_txt}", p)
    other = n.buyer_company_id if _side(n, user) == "owner" else n.owner_company_id
    notify_company(db, other, "거래조건 제안 도착", n.offer.title, f"/negotiations/{n.id}")
    db.commit()
    db.refresh(m)
    _push(n, m)
    return msg_out(m)


@router.post("/negotiations/{nid}/proposals/{mid}/{action}")
def respond(nid: int, mid: int, action: str, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    if action not in ("accept", "reject", "withdraw"):
        raise HTTPException(404)
    n = _load(db, nid, user)
    m = db.get(Message, mid)
    if not m or m.negotiation_id != nid or m.kind != MessageKind.proposal or not m.proposal:
        raise HTTPException(404, "제안을 찾을 수 없습니다.")
    if m.proposal.get("state") != "pending":
        raise HTTPException(400, "이미 처리된 제안입니다.")
    mine = m.sender_company_id == user.company_id
    if action == "withdraw" and not mine:
        raise HTTPException(403, "본인이 보낸 제안만 철회할 수 있습니다.")
    if action in ("accept", "reject") and mine:
        raise HTTPException(403, "상대방의 제안만 수락/거절할 수 있습니다.")

    state = {"accept": "accepted", "reject": "rejected", "withdraw": "withdrawn"}[action]
    m.proposal = {**m.proposal, "state": state, "responded_at": datetime.now(timezone.utc).isoformat()}
    label = {"accept": "수락", "reject": "거절", "withdraw": "철회"}[action]
    company = db.get(Company, user.company_id)
    sys = _post(db, n, None, MessageKind.system, f"{company.name}에서 거래조건 제안을 {label}했습니다.")

    deal = None
    if action == "accept":
        if db.scalar(select(Deal.id).where(Deal.negotiation_id == nid, Deal.status != DealStatus.cancelled)):
            raise HTTPException(400, "이미 거래가 생성된 협상입니다.")
        n.status = NegotiationStatus.agreed
        count = db.scalar(select(func.count(Deal.id))) or 0
        deal_no = f"BB-{datetime.now():%Y%m%d}-{count + 1:05d}"
        terms = {k: m.proposal.get(k) for k in ("owner_gives", "buyer_gives", "cash_amount", "cash_payer", "delivery_date", "notes")}
        terms["offer_estimated_value"] = n.offer.estimated_value
        deal = Deal(
            deal_no=deal_no, negotiation_id=n.id, offer_id=n.offer_id, owner_company_id=n.owner_company_id,
            buyer_company_id=n.buyer_company_id, proposal_message_id=m.id, terms=terms,
            contract_text=build_contract(deal_no, n.offer, n.owner_company, n.buyer_company, terms, settings.PLATFORM_FEE_RATE),
        )
        db.add(deal)
        db.flush()
        sys2 = _post(db, n, None, MessageKind.system, f"합의 완료! 거래 {deal_no}가 생성되었습니다. 계약서를 확인하고 서명해 주세요.")
        sys2.proposal = {"deal_id": deal.id}
        for cid in (n.owner_company_id, n.buyer_company_id):
            notify_company(db, cid, "거래 합의 · 계약서 서명 요청", n.offer.title, f"/deals/{deal.id}")
    db.commit()
    db.refresh(m)
    _push(n, m, "proposal_updated")
    _push(n, sys)
    if deal:
        _push(n, sys2)
    return {"message": msg_out(m), "deal_id": deal.id if deal else None}


@router.post("/negotiations/{nid}/close")
def close(nid: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    n = _load(db, nid, user)
    if n.status == NegotiationStatus.agreed:
        raise HTTPException(400, "합의된 협상은 거래 화면에서 취소해 주세요.")
    n.status = NegotiationStatus.closed
    company = db.get(Company, user.company_id)
    sys = _post(db, n, None, MessageKind.system, f"{company.name}에서 협상을 종료했습니다.")
    db.commit()
    _push(n, sys)
    return neg_out(db, n, user)


@router.websocket("/ws/negotiations/{nid}")
async def ws_negotiation(ws: WebSocket, nid: int, token: str = ""):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = db.get(User, int(payload["sub"]))
        n = db.get(Negotiation, nid)
        ok = user and n and user.status == UserStatus.approved and user.company_id in (n.owner_company_id, n.buyer_company_id)
    if not ok:
        await ws.close(code=4403)
        return
    await manager.connect(nid, ws)
    try:
        while True:
            data = await ws.receive_json()
            if data.get("event") == "typing":  # 입력 중 표시는 저장 없이 중계
                await manager.broadcast(nid, {"event": "typing", "user_id": user.id, "company_id": user.company_id})
    except (WebSocketDisconnect, Exception):
        manager.disconnect(nid, ws)
