from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_approved_user, get_optional_user
from ..models import Company, Offer, OfferStatus, User
from ..schemas import (
    CompanyOut, OfferIn, OfferOut, OfferPage, OfferUpdate, RecommendedCompany, RecommendedOffer,
)
from ..services.catalog import CATALOG, CATEGORY_NAMES, REGIONS, canonical_name, category_info
from ..services.classify import classify_offer
from ..services.recommender import recommend_companies_for_offer, recommend_offers

router = APIRouter(prefix="/api", tags=["offers"])


@router.get("/meta")
def meta(db: Session = Depends(get_db)):
    # 대분류별 모집중 오퍼 수 (복수 분야 포함)
    counts = dict.fromkeys(CATEGORY_NAMES, 0)
    for names, cat in db.execute(select(Offer.category_names, Offer.category).where(
            Offer.status.in_([OfferStatus.open, OfferStatus.negotiating]))).all():
        for n in dict.fromkeys(names or [cat]):
            if n in counts:
                counts[n] += 1
    info = [{**c, "count": counts[c["name"]]} for c in category_info()]
    return {"categories": CATEGORY_NAMES, "category_info": info, "regions": REGIONS}


def normalize_categories(category: str | None, names: list[str] | None, wants: list[str] | None = None):
    """category_names 첫 항목이 대표 분야. 예전 이름도 받아서 현재 이름으로 바꾼다."""
    lst = [canonical_name(n) for n in (names or [])] or ([canonical_name(category)] if category else [])
    lst = list(dict.fromkeys(lst))
    if category and canonical_name(category) in lst:   # 대표 분야를 앞으로
        rep = canonical_name(category)
        lst = [rep] + [n for n in lst if n != rep]
    if not lst or any(n not in CATALOG for n in lst):
        raise HTTPException(422, f"등록된 {len(CATALOG)}개 카테고리에서 하나 이상 선택해 주세요.")
    w = [canonical_name(n) for n in (wants or [])]
    return lst, [n for n in dict.fromkeys(w) if n in CATALOG]


class ClassifyIn(BaseModel):
    title: str = Field(default="", max_length=240)
    description: str = Field(default="", max_length=5000)


@router.post("/ai/offer-categories")
def ai_offer_categories(body: ClassifyIn, user: User = Depends(get_approved_user)):
    """MasterBuy 와 같은 방식의 대분류 자동 분류 (첫 항목이 대표 분야)."""
    if len((body.title + body.description).strip()) < 5:
        raise HTTPException(422, "오퍼 내용을 5자 이상 입력해 주세요.")
    return classify_offer(body.title, body.description)


@router.get("/offers", response_model=OfferPage)
def list_offers(
    q: str | None = None,
    category: str | None = None,
    offer_type: str | None = None,
    region: str | None = None,
    mine: bool = False,
    want_cash: bool | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=50),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    stmt = select(Offer).options(joinedload(Offer.company))
    if mine:
        if not user or not user.company_id:
            raise HTTPException(401, "로그인이 필요합니다.")
        stmt = stmt.where(Offer.company_id == user.company_id)
        if status:
            stmt = stmt.where(Offer.status == OfferStatus(status))
    else:
        stmt = stmt.where(Offer.status.in_([OfferStatus.open, OfferStatus.negotiating]))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Offer.title.ilike(like), Offer.description.ilike(like), Offer.wants.ilike(like)))
    if category:
        category = canonical_name(category)
        stmt = stmt.where(or_(Offer.category == category, cast(Offer.category_names, JSONB).contains([category])))
    if want_cash is not None:
        stmt = stmt.where(Offer.want_cash.is_(want_cash))
    if offer_type:
        stmt = stmt.where(Offer.offer_type == offer_type)
    if region and region != "전국":
        stmt = stmt.where(or_(Offer.region == region, Offer.region == "전국"))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.scalars(stmt.order_by(Offer.created_at.desc()).offset((page - 1) * size).limit(size)).unique().all()
    return OfferPage(items=items, total=total or 0, page=page, size=size)


@router.post("/offers", response_model=OfferOut, status_code=201)
def create_offer(body: OfferIn, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    data = body.model_dump()
    data["category_names"], data["want_categories"] = normalize_categories(body.category, body.category_names, body.want_categories)
    data["category"] = data["category_names"][0]
    if data["want_cash"]:
        data["allow_cash"] = True
        if not data.get("wants"):
            data["wants"] = "현금"
    else:
        data["want_cash_amount"] = None
    o = Offer(**data, company_id=user.company_id, user_id=user.id)
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


@router.get("/offers/{offer_id}", response_model=OfferOut)
def get_offer(offer_id: int, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    o = db.get(Offer, offer_id, options=[joinedload(Offer.company)])
    if not o:
        raise HTTPException(404, "오퍼를 찾을 수 없습니다.")
    if not user and o.status not in (OfferStatus.open, OfferStatus.negotiating):
        raise HTTPException(404, "오퍼를 찾을 수 없습니다.")
    if not user or o.company_id != user.company_id:
        o.view_count += 1
        db.commit()
        db.refresh(o)
    return o


@router.get("/offers/{offer_id}/company", response_model=CompanyOut)
def offer_company(offer_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    o = db.get(Offer, offer_id)
    if not o:
        raise HTTPException(404)
    return db.get(Company, o.company_id)


@router.patch("/offers/{offer_id}", response_model=OfferOut)
def update_offer(offer_id: int, body: OfferUpdate, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    o = db.get(Offer, offer_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(404, "오퍼를 찾을 수 없습니다.")
    upd = body.model_dump(exclude_unset=True)
    if "category" in upd or "category_names" in upd or "want_categories" in upd:
        names, wants = normalize_categories(upd.get("category", o.category), upd.get("category_names", o.category_names if "category" not in upd else None),
                                            upd.get("want_categories", o.want_categories))
        upd.update(category=names[0], category_names=names, want_categories=wants)
    for k, v in upd.items():
        setattr(o, k, OfferStatus(v) if k == "status" else v)
    if o.want_cash:
        o.allow_cash = True
    else:
        o.want_cash_amount = None
    db.commit()
    db.refresh(o)
    return o


@router.get("/recommendations/offers", response_model=list[RecommendedOffer])
def rec_offers(limit: int = Query(8, le=30), user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    company = db.get(Company, user.company_id)
    return recommend_offers(db, company, limit)


@router.get("/offers/{offer_id}/recommended-companies", response_model=list[RecommendedCompany])
def rec_companies(offer_id: int, user: User = Depends(get_approved_user), db: Session = Depends(get_db)):
    o = db.get(Offer, offer_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(404)
    return recommend_companies_for_offer(db, o)
