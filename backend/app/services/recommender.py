"""기업 특성 정보 기반 최적 오퍼 추천 엔진.

물물교환은 '양방향 적합성'이 핵심이므로 두 방향의 유사도를 함께 본다.
  1) 수요 적합도  : 오퍼가 제공하는 것  ↔ 우리 기업이 필요로 하는 것(needs, 관심 카테고리)
  2) 상호 교환성  : 오퍼 등록자가 원하는 것 ↔ 우리 기업이 제공할 수 있는 것(제품, 보유기술, 사업분야, 실적)
  3) 카테고리 일치, 4) 업종/기술 연관성, 5) 과거 협상 이력 유사도, 6) 최신성

텍스트 유사도는 한국어 친화 토크나이저(어절 + 음절 bigram)와 TF-IDF 코사인 유사도를 사용한다.
외부 ML 의존성 없이 동작하며, 운영 규모가 커지면 pgvector + 임베딩으로 교체할 수 있도록
`TfIdf`·`cosine()` 으로 분리해 두었다.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..models import Company, Negotiation, Offer, OfferStatus, User, UserStatus

_TOKEN_RE = re.compile(r"[가-힣]+|[a-zA-Z][a-zA-Z0-9+#.\-]*|\d+")
_STOP = {"및", "등", "의", "을", "를", "이", "가", "은", "는", "에", "와", "과", "으로", "로", "합니다", "있습니다",
         "제공", "가능", "원합니다", "희망", "필요", "관련", "업체", "기업", "회사", "the", "and", "for", "of"}
_JOSA = ("으로", "에서", "에게", "까지", "부터", "입니다", "합니다", "을", "를", "이", "가", "은", "는", "의", "에", "와", "과", "도", "로")


def _strip_josa(w: str) -> str:
    for j in _JOSA:
        if len(w) > len(j) + 1 and w.endswith(j):
            return w[: -len(j)]
    return w


def words(text: str) -> list[str]:
    out = []
    for m in _TOKEN_RE.findall((text or "").lower()):
        w = _strip_josa(m)
        if len(w) < 2 or w in _STOP:
            continue
        out.append(w)
    return out


def tokenize(text: str) -> list[str]:
    toks: list[str] = []
    for w in words(text):
        toks.append(w)
        if re.match(r"[가-힣]", w) and len(w) >= 3:
            toks.extend("#" + w[i : i + 2] for i in range(len(w) - 1))  # 음절 bigram (부분일치)
    return toks


class TfIdf:
    def __init__(self, corpus: list[str]):
        self.n = max(len(corpus), 1)
        df: Counter = Counter()
        for doc in corpus:
            df.update(set(tokenize(doc)))
        self.idf = {t: math.log((1 + self.n) / (1 + c)) + 1.0 for t, c in df.items()}
        self.default_idf = math.log(1 + self.n) + 1.0

    def vec(self, text: str) -> dict[str, float]:
        tf = Counter(tokenize(text))
        if not tf:
            return {}
        v = {}
        for t, c in tf.items():
            w = (1 + math.log(c)) * self.idf.get(t, self.default_idf)
            if t.startswith("#"):
                w *= 0.5  # bigram 가중치 하향
            v[t] = w
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    return sum(w * b.get(t, 0.0) for t, w in a.items())


def common_terms(a: str, b: str, k: int = 3) -> list[str]:
    wb = set(words(b))
    seen, out = set(), []
    for w in words(a):
        if w in wb and w not in seen:
            seen.add(w)
            out.append(w)
        if len(out) >= k:
            break
    return out


# ---------- 문서 구성 ----------
def company_need_doc(c: Company) -> str:
    return " ".join([c.needs or "", c.needs or "", " ".join(c.interest_categories or [])])


def company_have_doc(c: Company) -> str:
    return " ".join([
        c.products or "", c.products or "",
        " ".join(c.technologies or []), " ".join(c.technologies or []),
        " ".join(c.business_areas or []), c.industry or "",
        c.track_record or "", " ".join(c.certifications or []),
    ])


def company_identity_doc(c: Company) -> str:
    return " ".join([c.industry or "", " ".join(c.business_areas or []), " ".join(c.technologies or []), c.description or ""])


def offer_give_doc(o: Offer) -> str:
    return " ".join([o.title, o.title, " ".join(o.category_names or [o.category]), o.description or "", " ".join(o.tags or [])])


def offer_want_doc(o: Offer) -> str:
    return " ".join([o.wants or "", " ".join(o.want_categories or [])])


def _freshness(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - dt).total_seconds() / 86400
    return math.exp(-max(days, 0) / 30)


WEIGHTS = {"need": 0.34, "recip": 0.26, "cat": 0.12, "identity": 0.08, "history": 0.10, "fresh": 0.10}


def recommend_offers(db: Session, company: Company, limit: int = 10) -> list[dict]:
    now = datetime.now(timezone.utc)
    offers = db.scalars(
        select(Offer)
        .options(joinedload(Offer.company))
        .where(Offer.status.in_([OfferStatus.open, OfferStatus.negotiating]))
        .where(Offer.company_id != company.id)
        .where(or_(Offer.valid_until.is_(None), Offer.valid_until >= now))
    ).unique().all()
    if not offers:
        return []

    # 과거 협상 이력 (우리 기업이 협상을 시작했던 오퍼들)
    hist_offers = db.scalars(
        select(Offer).join(Negotiation, Negotiation.offer_id == Offer.id)
        .where(Negotiation.buyer_company_id == company.id)
    ).all()
    negotiated_ids = {o.id for o in hist_offers}
    history_doc = " ".join(offer_give_doc(o) for o in hist_offers)

    corpus = [offer_give_doc(o) + " " + offer_want_doc(o) for o in offers]
    corpus += [company_have_doc(company), company_need_doc(company)]
    tfidf = TfIdf(corpus)

    need_v = tfidf.vec(company_need_doc(company))
    have_v = tfidf.vec(company_have_doc(company))
    ident_v = tfidf.vec(company_identity_doc(company))
    hist_v = tfidf.vec(history_doc)
    interests = set(company.interest_categories or [])

    results = []
    for o in offers:
        if o.id in negotiated_ids:
            continue  # 이미 협상 중인 오퍼는 제외
        give_v = tfidf.vec(offer_give_doc(o))
        want_v = tfidf.vec(offer_want_doc(o))
        s = {
            "need": cosine(need_v, give_v),
            "recip": cosine(have_v, want_v),
            "cat": 1.0 if interests.intersection(o.category_names or [o.category]) else 0.0,
            "identity": cosine(ident_v, give_v),
            "history": cosine(hist_v, give_v),
            "fresh": _freshness(o.created_at),
        }
        score = sum(WEIGHTS[k] * min(v, 1.0) for k, v in s.items())

        reasons = []
        if s["need"] >= 0.08:
            terms = common_terms(company.needs or "", offer_give_doc(o))
            reasons.append("귀사의 필요 품목과 일치" + (f" ({', '.join(terms)})" if terms else ""))
        if s["recip"] >= 0.08:
            terms = common_terms(company_have_doc(company), offer_want_doc(o))
            reasons.append("등록 기업이 귀사의 제품·기술을 원함" + (f" ({', '.join(terms)})" if terms else ""))
        if s["cat"]:
            hit = next((n for n in (o.category_names or [o.category]) if n in interests), o.category)
            reasons.append(f"관심 카테고리 '{hit}'")
        if o.want_cash and s["need"] >= 0.08:
            reasons.append("현금으로도 거래 가능")
        if s["history"] >= 0.1:
            reasons.append("과거 협상한 오퍼와 유사")
        if s["identity"] >= 0.1 and len(reasons) < 2:
            reasons.append("귀사 업종·보유기술과 연관")
        if not reasons:
            reasons.append("새로 등록된 오퍼" if s["fresh"] > 0.8 else "탐색 추천")

        # 화면 표시용 적합도(0~100): 원점수를 포화 곡선으로 보정 (순위는 그대로 유지)
        fit = 100 * (1 - math.exp(-score * 100 / 28))
        results.append({"offer": o, "score": round(fit), "reasons": reasons, "_signal": s["need"] + s["recip"] + s["cat"]})

    results.sort(key=lambda r: (r["_signal"] > 0, r["score"]), reverse=True)
    for r in results:
        r.pop("_signal", None)
    return results[:limit]


def recommend_companies_for_offer(db: Session, offer: Offer, limit: int = 8) -> list[dict]:
    """오퍼 등록자에게: 이 오퍼에 관심을 가질 만한(그리고 원하는 것을 줄 수 있는) 기업 추천."""
    companies = db.scalars(
        select(Company).join(User, User.company_id == Company.id)
        .where(User.status == UserStatus.approved)
        .where(Company.id != offer.company_id)
    ).unique().all()
    if not companies:
        return []
    corpus = [company_have_doc(c) + " " + company_need_doc(c) for c in companies]
    corpus += [offer_give_doc(offer), offer_want_doc(offer)]
    tfidf = TfIdf(corpus)
    give_v = tfidf.vec(offer_give_doc(offer))
    want_v = tfidf.vec(offer_want_doc(offer))

    out = []
    for c in companies:
        need = cosine(tfidf.vec(company_need_doc(c)), give_v)
        recip = cosine(tfidf.vec(company_have_doc(c)), want_v)
        hit = next((n for n in (offer.category_names or [offer.category]) if n in (c.interest_categories or [])), None)
        cat = 1.0 if hit else 0.0
        score = 0.45 * need + 0.40 * recip + 0.15 * cat
        if score <= 0.02:
            continue
        reasons = []
        if need >= 0.08:
            reasons.append("이 오퍼를 필요로 할 가능성 높음")
        if recip >= 0.08:
            t = common_terms(offer_want_doc(offer), company_have_doc(c))
            reasons.append("희망 교환품 제공 가능" + (f" ({', '.join(t)})" if t else ""))
        if cat:
            reasons.append(f"관심 카테고리 '{hit}'")
        out.append({"company": c, "score": round(100 * (1 - math.exp(-score * 100 / 28))), "reasons": reasons or ["업종 연관"]})
    out.sort(key=lambda r: r["score"], reverse=True)
    return out[:limit]
