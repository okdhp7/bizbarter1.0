"""채팅형 Q&A 오퍼 등록 도우미.

질문 → 답변을 주고받으며 오퍼 항목을 채운다. 기본은 규칙 기반(키워드 분류, 금액 파싱)으로
동작하고, ANTHROPIC_API_KEY 가 설정되면 첫 자유서술 답변에서 LLM 으로 여러 항목을 한 번에
추출해 이후 질문의 기본값(추천값)으로 제시한다.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone

import httpx

from ..config import settings
from .catalog import CATALOG, CATEGORY_NAMES, REGIONS, canonical_name, guess_categories
from .classify import classify_offer
from .recommender import words

STEPS = ["type", "describe", "category", "title", "quantity", "value", "want_type", "wants", "want_amount", "cash",
         "region", "period", "confirm"]

WANT_GOODS, WANT_CASH, WANT_BOTH = "재화·용역", "현금", "재화·용역 + 현금"


def _skipped(step: str, data: dict) -> bool:
    """교환 희망 방식에 따라 묻지 않아도 되는 단계."""
    mode = data.get("want_mode")
    if step == "wants":
        return mode == "cash"
    if step == "want_amount":
        return mode not in ("cash", "both")
    if step == "cash":  # 현금을 희망하면 현금 정산은 자동 허용
        return mode in ("cash", "both")
    return False

BACK = "이전 단계"
RESTART = "처음부터 다시"
SUBMIT = "오퍼 등록하기"
KEEP = "추천값 사용"


def _msg(role: str, content: str, choices: list[str] | None = None) -> dict:
    return {"role": role, "content": content, "choices": choices or []}


def fmt_won(v: int | None) -> str:
    if v is None:
        return "미정"
    if v >= 100_000_000:
        return f"{v / 100_000_000:,.1f}억원".replace(".0억", "억")
    if v >= 10_000:
        return f"{v // 10_000:,}만원"
    return f"{v:,}원"


def parse_won(text: str) -> int | None | str:
    """'500만원', '1.2억', '3,000,000', '약 2천만' → int. 미정/모름 → None. 해석불가 → 'invalid'."""
    t = text.replace(",", "").replace(" ", "")
    if any(k in t for k in ("모름", "미정", "협의", "없음", "모르")):
        return None
    total, found = 0.0, False
    for num, unit in re.findall(r"(\d+(?:\.\d+)?)(억|천만|백만|만|천)?", t):
        found = True
        n = float(num)
        mult = {"억": 1e8, "천만": 1e7, "백만": 1e6, "만": 1e4, "천": 1e3}.get(unit, 1)
        total += n * mult
    return int(total) if found and total > 0 else "invalid"


def _suggest_title(desc: str, offer_type: str) -> str:
    first = re.split(r"[.\n!?]", desc.strip())[0].strip()
    first = re.sub(r"(을|를)?\s*(제공|교환|판매)\s*(합니다|하고\s*싶습니다|하려고\s*합니다|원합니다)?$", "", first).strip()
    if 4 <= len(first) <= 40:
        return first
    kws = words(desc)[:4]
    base = " ".join(kws) if kws else ("물품" if offer_type == "goods" else "서비스")
    return f"{base} {'교환 제공' if offer_type == 'goods' else '용역 제공'}"[:60]


def _extract_tags(text: str, k: int = 6) -> list[str]:
    seen, out = set(), []
    for w in words(text):
        if len(w) >= 2 and w not in seen and not w.isdigit():
            seen.add(w)
            out.append(w)
        if len(out) >= k:
            break
    return out


def llm_extract(desc: str, offer_type: str) -> dict:
    """선택 기능: Claude API 로 자유서술에서 구조화 항목 추출. 실패 시 빈 dict."""
    if not settings.ANTHROPIC_API_KEY:
        return {}
    prompt = (
        "다음은 기업간 물물교환 플랫폼에 올릴 '교환 오퍼' 설명입니다. JSON 으로만 답하세요.\n"
        '형식: {"title": 40자 이내 제목, "quantity": 수량/기간 문자열 또는 "", '
        '"estimated_value": 원 단위 정수 또는 null, "wants": 교환 희망 내용 또는 "", "tags": [키워드 최대 6개]}\n'
        f"유형: {'물품/재화' if offer_type == 'goods' else '용역/서비스'}\n설명: {desc}"
    )
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": settings.LLM_MODEL, "max_tokens": 600, "messages": [{"role": "user", "content": prompt}]},
            timeout=20,
        )
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json().get("content", []))
        m = re.search(r"\{.*\}", text, re.S)
        data = json.loads(m.group(0)) if m else {}
        return {k: v for k, v in data.items() if v not in (None, "", [])}
    except Exception:
        return {}


# ---------- 질문 ----------
def question(step: str, data: dict) -> dict:
    s = data.get("_suggest", {})
    if step == "type":
        return _msg("assistant", "안녕하세요! 교환 오퍼 등록을 도와드릴게요.\n먼저, 제공하실 것이 어떤 유형인가요?",
                    ["물품/재화", "용역/서비스"])
    if step == "describe":
        what = "물품의 사양·상태·수량" if data.get("offer_type") == "goods" else "서비스의 내용·범위·수행 기간"
        return _msg("assistant", f"제공하실 {what} 등을 자유롭게 설명해 주세요.\n"
                    "교환으로 원하는 것까지 함께 적어주시면 나머지 질문을 줄여드려요.")
    if step == "category":
        guess = s.get("categories") or []
        rest = [c for c in CATEGORY_NAMES if c not in guess]
        if guess:
            extra = f"\n함께 해당하는 분야: {', '.join(guess[1:])}" if len(guess) > 1 else ""
            hint = (f"설명을 보니 '{guess[0]}' 분야로 보여요.{extra}\n"
                    "대표 분야를 선택해 주세요. (분야에 마우스를 올리면 포함 범위가 보여요)")
        else:
            hint = "어느 분야에 해당하나요? 대표 분야를 선택해 주세요.\n(분야에 마우스를 올리면 포함 범위가 보여요)"
        return _msg("assistant", hint, guess + rest)
    if step == "title":
        return _msg("assistant", f"오퍼 제목을 이렇게 제안드려요:\n「{s.get('title', '')}」\n그대로 쓰시거나 원하는 제목을 입력해 주세요.", [KEEP, BACK])
    if step == "quantity":
        ch = [s["quantity"]] if s.get("quantity") else []
        unit = "수량(예: 500개, 2톤)" if data.get("offer_type") == "goods" else "제공 범위/기간(예: 3개월, 10회)"
        return _msg("assistant", f"{unit}을 알려주세요.", ch + ["협의 가능", BACK])
    if step == "value":
        ch = [fmt_won(s["estimated_value"])] if s.get("estimated_value") else []
        return _msg("assistant", "제공하실 것의 예상 가치(시장가 기준)는 어느 정도인가요?\n교환 비율과 차액 정산의 기준이 됩니다. (예: 500만원, 1.2억)",
                    ch + ["미정(협의)", BACK])
    if step == "want_type":
        return _msg("assistant", "교환으로 무엇을 받고 싶으신가요?\n재화·용역 대신 현금으로 받거나, 둘을 함께 받을 수도 있어요.",
                    [WANT_GOODS, WANT_CASH, WANT_BOTH, BACK])
    if step == "wants":
        ch = [s["wants"]] if s.get("wants") else []
        return _msg("assistant", "교환으로 받고 싶은 재화나 용역은 무엇인가요?\n구체적일수록 AI 매칭이 정확해집니다.", ch + ["무엇이든 제안받음", BACK])
    if step == "want_amount":
        ev = data.get("estimated_value")
        ch = [f"예상 가치와 같은 금액 ({fmt_won(ev)})"] if ev else []
        q = ("현금으로 받고 싶은 희망 금액은 얼마인가요?" if data.get("want_mode") == "cash"
             else "재화·용역과 함께 받고 싶은 현금 희망 금액은 얼마인가요?")
        return _msg("assistant", q + " (예: 500만원, 1.2억)", ch + ["금액 협의", BACK])
    if step == "cash":
        return _msg("assistant", "교환 가치에 차이가 있을 때 현금으로 차액을 정산하는 것을 허용할까요?", ["허용", "허용 안 함(순수 물물교환)", BACK])
    if step == "region":
        return _msg("assistant", "거래(인도/수행) 가능 지역은 어디인가요?", REGIONS[:8] + [BACK])
    if step == "period":
        return _msg("assistant", "오퍼 게시 기간을 선택해 주세요.", ["14일", "30일", "60일", "90일", BACK])
    if step == "confirm":
        d = data
        summary = (
            "아래 내용으로 오퍼를 등록할까요?\n\n"
            f"• 유형: {'물품/재화' if d.get('offer_type') == 'goods' else '용역/서비스'}\n"
            f"• 카테고리: {' · '.join(d.get('category_names') or [d.get('category')])}\n"
            f"• 제목: {d.get('title')}\n"
            f"• 수량/범위: {d.get('quantity') or '협의'}\n"
            f"• 예상 가치: {fmt_won(d.get('estimated_value'))}\n"
            f"• 교환 희망: {want_summary(d)}\n"
            f"• 현금 정산: {'허용' if d.get('allow_cash', True) else '불가'}\n"
            f"• 지역: {d.get('region')}\n"
            f"• 게시 기간: {d.get('period_days')}일\n"
            f"• 키워드: {', '.join(d.get('tags', []))}"
        )
        return _msg("assistant", summary, [SUBMIT, BACK, RESTART])
    return _msg("assistant", "")


def start() -> tuple[str, dict, list[dict]]:
    return "type", {}, [question("type", {})]


def want_summary(d: dict) -> str:
    mode = d.get("want_mode", "goods")
    cash = f"현금 {fmt_won(d.get('want_cash_amount')) if d.get('want_cash_amount') else '(금액 협의)'}"
    goods = d.get("wants") or "재화·용역 제안받음"
    return cash if mode == "cash" else f"{goods} + {cash}" if mode == "both" else goods


def _prev(step: str, data: dict | None = None) -> str:
    i = STEPS.index(step) - 1
    while i > 0 and _skipped(STEPS[i], data or {}):
        i -= 1
    return STEPS[max(i, 0)]


def _next(step: str, data: dict) -> str:
    i = STEPS.index(step) + 1
    while _skipped(STEPS[i], data):
        i += 1
    return STEPS[i]


def answer(step: str, data: dict, text: str) -> tuple[str, dict, list[dict], bool]:
    """답변 처리. 반환: (다음 step, data, 추가 메시지들, 등록요청 여부)"""
    text = (text or "").strip()
    out: list[dict] = []
    data = dict(data)

    if text == RESTART:
        return "type", {}, [question("type", {})], False
    if text == BACK and step != "type":
        nxt = _prev(step, data)
        return nxt, data, [question(nxt, data)], False

    def err(msg: str):
        q = question(step, data)
        return step, data, [_msg("assistant", msg, q["choices"])], False

    if step == "type":
        if "물품" in text or "재화" in text or text.lower() == "goods":
            data["offer_type"] = "goods"
        elif "용역" in text or "서비스" in text or text.lower() == "service":
            data["offer_type"] = "service"
        else:
            return err("'물품/재화' 또는 '용역/서비스' 중에서 선택해 주세요.")
    elif step == "describe":
        if len(text) < 10:
            return err("조금만 더 자세히 설명해 주세요. (10자 이상)")
        data["description"] = text
        cls = classify_offer("", text)
        sug = {
            "categories": cls["category_names"],
            "title": _suggest_title(text, data.get("offer_type", "goods")),
            "tags": _extract_tags(text),
        }
        llm = llm_extract(text, data.get("offer_type", "goods"))
        if llm:
            for k in ("title", "quantity", "estimated_value", "wants", "tags"):
                if llm.get(k):
                    sug[k] = llm[k]
            out.append(_msg("assistant", "AI가 설명을 분석해 항목별 추천값을 준비했어요."))
        else:
            m = re.search(r"(\d[\d,]*\s*(?:개|대|톤|kg|박스|세트|ea|EA|개월|회|시간|명|평|㎡))", text)
            if m:
                sug["quantity"] = m.group(1)
            v = re.search(r"(\d[\d,.]*\s*(?:억|천만|백만|만)\s*원?)", text)
            if v and isinstance(parse_won(v.group(1)), int):
                sug["estimated_value"] = parse_won(v.group(1))
            w = re.search(r"(?:대신|교환으로|반대급부로)\s*(.+?)(?:을|를)?\s*(?:원합니다|희망합니다|받고\s*싶습니다|원해요)", text)
            if w:
                sug["wants"] = w.group(1).strip()[:200]
        data["_suggest"] = sug
    elif step == "category":
        cat = next((c for c in CATEGORY_NAMES if c == text), None) or next((c for c in CATEGORY_NAMES if text and text in c), None)
        if not cat:
            return err("목록에서 카테고리를 선택해 주세요.")
        data["category"] = cat
        # AI 가 함께 제시한 다른 분야는 보조 분야로 유지 (대표 = 첫 항목)
        data["category_names"] = [cat] + [c for c in data.get("_suggest", {}).get("categories", []) if c != cat and c in CATALOG][:2]
    elif step == "title":
        title = data.get("_suggest", {}).get("title", "") if text == KEEP else text
        if len(title) < 2:
            return err("제목을 2자 이상 입력해 주세요.")
        data["title"] = title[:200]
    elif step == "quantity":
        data["quantity"] = "" if text == "협의 가능" else text[:100]
    elif step == "value":
        v = parse_won(text)
        if v == "invalid":
            return err("금액을 이해하지 못했어요. 예) 500만원, 1.2억, 3000000 또는 '미정'")
        data["estimated_value"] = v
    elif step == "want_type":
        if text == WANT_BOTH or ("현금" in text and ("재화" in text or "용역" in text or "+" in text or "함께" in text)):
            data["want_mode"] = "both"
        elif "현금" in text or "돈" in text:
            data["want_mode"] = "cash"
        elif "재화" in text or "용역" in text or "물품" in text or "서비스" in text:
            data["want_mode"] = "goods"
        else:
            return err("'재화·용역', '현금', '재화·용역 + 현금' 중에서 선택해 주세요.")
        data["want_cash"] = data["want_mode"] != "goods"
        if data["want_mode"] == "cash":
            data["wants"], data["want_categories"] = "", []
        if data["want_cash"]:
            data["allow_cash"] = True
        else:
            data["want_cash_amount"] = None
    elif step == "wants":
        data["wants"] = "" if text == "무엇이든 제안받음" else text
        data["want_categories"] = guess_categories(text)
    elif step == "want_amount":
        if text == "금액 협의" or "협의" in text:
            data["want_cash_amount"] = None
        elif text.startswith("예상 가치와 같은 금액"):
            data["want_cash_amount"] = data.get("estimated_value")
        else:
            v = parse_won(text)
            if v == "invalid":
                return err("금액을 이해하지 못했어요. 예) 500만원, 1.2억, 3000000 또는 '금액 협의'")
            data["want_cash_amount"] = v
    elif step == "cash":
        data["allow_cash"] = not ("안" in text or "불가" in text or "아니" in text)
    elif step == "region":
        data["region"] = text[:100]
    elif step == "period":
        m = re.search(r"\d+", text)
        days = int(m.group(0)) if m else 30
        data["period_days"] = max(1, min(days, 365))
        data["tags"] = data.get("_suggest", {}).get("tags", []) or _extract_tags(data.get("description", ""))
    elif step == "confirm":
        if text == SUBMIT or text in ("등록", "네", "예", "확인"):
            return "done", data, [], True
        return err("'오퍼 등록하기'를 누르시거나 '이전 단계'로 돌아가 수정해 주세요.")

    nxt = _next(step, data)
    out.append(question(nxt, data))
    return nxt, data, out, False


def to_offer_fields(data: dict) -> dict:
    return {
        "offer_type": data["offer_type"],
        "category": canonical_name(data["category"]),
        "category_names": list(dict.fromkeys(canonical_name(c) for c in (data.get("category_names") or [data["category"]]))),
        "title": data["title"],
        "description": data.get("description", ""),
        "quantity": data.get("quantity", ""),
        "estimated_value": data.get("estimated_value"),
        "wants": data.get("wants", "") or ("현금" if data.get("want_mode") == "cash" else ""),
        "want_categories": [c for c in dict.fromkeys(canonical_name(c) for c in data.get("want_categories", [])) if c in CATALOG],
        "want_cash": bool(data.get("want_cash")),
        "want_cash_amount": data.get("want_cash_amount") if data.get("want_cash") else None,
        "allow_cash": True if data.get("want_cash") else data.get("allow_cash", True),
        "region": data.get("region", ""),
        "tags": data.get("tags", []),
        "valid_until": datetime.now(timezone.utc) + timedelta(days=data.get("period_days", 30)),
    }
