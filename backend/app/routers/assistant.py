from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_approved_user
from ..models import Offer, OfferDraft, User
from ..services import assistant as bot

router = APIRouter(prefix="/api/assistant/drafts", tags=["assistant"])


def _out(d: OfferDraft) -> dict:
    data = {k: v for k, v in (d.data or {}).items() if not k.startswith("_")}
    return {"id": d.id, "step": d.step, "data": data, "messages": d.messages, "completed": d.completed, "offer_id": d.offer_id}


@router.post("")
def start(user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    step, data, msgs = bot.start()
    d = OfferDraft(user_id=user.id, step=step, data=data, messages=msgs)
    db.add(d)
    db.commit()
    db.refresh(d)
    return _out(d)


@router.get("/{draft_id}")
def get(draft_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    d = db.get(OfferDraft, draft_id)
    if not d or d.user_id != user.id:
        raise HTTPException(404)
    return _out(d)


@router.post("/{draft_id}/answer")
def answer(draft_id: int, body: dict, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    d = db.get(OfferDraft, draft_id)
    if not d or d.user_id != user.id:
        raise HTTPException(404)
    if d.completed:
        raise HTTPException(400, "이미 등록이 완료된 세션입니다.")
    text = str(body.get("answer", ""))[:3000]
    msgs = list(d.messages) + [bot._msg("user", text)]
    step, data, new_msgs, submit = bot.answer(d.step, d.data, text)
    if submit:
        offer = Offer(**bot.to_offer_fields(data), company_id=user.company_id, user_id=user.id)
        db.add(offer)
        db.flush()
        d.offer_id = offer.id
        d.completed = True
        new_msgs = [bot._msg("assistant", f"오퍼가 등록되었습니다! (#{offer.id})\n관심 있는 기업에 AI 추천으로 노출됩니다.")]
    d.step, d.data, d.messages = step, data, msgs + new_msgs
    db.commit()
    db.refresh(d)
    return _out(d)
