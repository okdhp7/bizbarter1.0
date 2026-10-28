from datetime import datetime, timezone

from ..models import Company, Offer
from .assistant import fmt_won


def build_contract(deal_no: str, offer: Offer, owner: Company, buyer: Company, terms: dict, fee_rate: float) -> str:
    cash = int(terms.get("cash_amount") or 0)
    payer = terms.get("cash_payer", "none")
    if cash > 0 and payer in ("owner", "buyer"):
        p, q = (owner, buyer) if payer == "owner" else (buyer, owner)
        cash_clause = (
            f"③ 교환 가치의 차액으로 {p.name}(이하 '지급인')은 {q.name}에게 금 {cash:,}원({fmt_won(cash)})을 지급한다.\n"
            f"④ 차액은 플랫폼 에스크로를 통해 결제하며, 양 당사자의 이행 완료 확인 후 지급된다. "
            f"플랫폼 수수료는 차액의 {fee_rate:g}%로 지급인이 부담한다."
        )
    else:
        cash_clause = "③ 본 거래는 현금 정산 없는 순수 물물교환으로 한다."

    today = datetime.now(timezone.utc).astimezone().strftime("%Y년 %m월 %d일")
    return f"""물물교환 거래 계약서

계약번호: {deal_no}
관련 오퍼: #{offer.id} {offer.title}

{owner.name}(사업자등록번호 {owner.biz_reg_no}, 대표 {owner.ceo_name}, 이하 '갑')과
{buyer.name}(사업자등록번호 {buyer.biz_reg_no}, 대표 {buyer.ceo_name}, 이하 '을')은
BizBarter 플랫폼에서의 협상 결과에 따라 다음과 같이 재화·용역 교환 계약을 체결한다.

제1조 (목적)
본 계약은 갑과 을이 상호 보유한 재화 또는 용역을 교환함에 있어 필요한 권리·의무를 정함을 목적으로 한다.

제2조 (교환 대상)
① 갑이 을에게 제공하는 것: {terms.get('owner_gives')}
② 을이 갑에게 제공하는 것: {terms.get('buyer_gives')}
{cash_clause}

제3조 (이행 기한 및 방법)
① 이행 기한: {terms.get('delivery_date') or '계약 체결일로부터 30일 이내'}
② 각 당사자는 이행 완료 시 플랫폼에서 '이행 완료'를 등록하며, 상대방은 7일 이내 이의를 제기할 수 있다.

제4조 (품질 보증 및 하자)
각 당사자는 제공하는 재화·용역이 협상 과정에서 제시한 사양과 일치함을 보증하며, 하자 발견 시
상대방의 요청에 따라 보완, 교체 또는 상응하는 금액으로 배상한다.

제5조 (세금계산서)
각 당사자는 부가가치세법에 따라 교환되는 재화·용역의 공급가액에 대한 세금계산서를 상호 발행한다.

제6조 (계약 해제)
일방이 정당한 사유 없이 이행 기한 내 의무를 이행하지 않는 경우, 상대방은 서면(플랫폼 메시지 포함)으로
14일 이상의 기간을 정하여 이행을 최고한 후 계약을 해제할 수 있다.

제7조 (비밀유지)
양 당사자는 본 계약 및 협상 과정에서 취득한 상대방의 영업 비밀을 제3자에게 누설하지 않는다.

제8조 (분쟁 해결)
본 계약에 관한 분쟁은 상호 협의로 해결하며, 협의가 되지 않을 경우 갑의 본점 소재지 관할 법원을 관할로 한다.

특약사항: {terms.get('notes') or '없음'}

본 계약은 양 당사자가 플랫폼에서 전자서명함으로써 성립하며, 전자문서로 보관한다.

{today}

갑: {owner.name}  (대표 {owner.ceo_name})
을: {buyer.name}  (대표 {buyer.ceo_name})
"""
