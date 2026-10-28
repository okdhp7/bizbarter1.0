"""데모 데이터 생성: python seed.py
승인된 기업 회원 5곳(비밀번호 공통: demo1234!)과 오퍼 10건을 만든다.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.main import init_db
from app.models import Company, Offer, OfferType, User, UserStatus
from app.security import hash_password

COMPANIES = [
    dict(email="pack@demo.kr", user="김포장", c=dict(
        name="한빛패키징", biz_reg_no="101-81-00001", ceo_name="김한빛", address="경기 화성시", industry="포장재 제조",
        business_areas=["골판지 박스", "완충재", "친환경 포장"], technologies=["골판지 성형", "생분해 완충재"],
        track_record="연 300만 박스 생산, 식품·전자 업체 120곳 납품", certifications=["ISO 9001", "FSC 인증"],
        products="골판지 박스, 에어캡, 친환경 완충재 포장재", needs="홈페이지 리뉴얼, 온라인 마케팅, 물류 창고 보관",
        interest_categories=["IT·소프트웨어", "디자인·마케팅", "차량·물류"], employees=45, founded_year=2009)),
    dict(email="soft@demo.kr", user="이개발", c=dict(
        name="코드웨이브", biz_reg_no="220-81-00002", ceo_name="이웨이브", address="서울 강남구", industry="소프트웨어 개발",
        business_areas=["웹/앱 개발", "ERP 구축", "AI 솔루션"], technologies=["React", "Python", "AI 챗봇", "클라우드"],
        track_record="중소기업 ERP 40건, 쇼핑몰 구축 80건", certifications=["벤처기업", "GS인증"],
        products="홈페이지 제작, 쇼핑몰 개발, ERP 시스템 구축, AI 챗봇 개발 용역", needs="사무용 가구, 판촉물, 사무실 인테리어, 직원 간식",
        interest_categories=["생활사무·가구", "건설·시설", "식품·농축수산"], employees=22, founded_year=2016)),
    dict(email="logi@demo.kr", user="박물류", c=dict(
        name="스피드로지스", biz_reg_no="305-81-00003", ceo_name="박스피드", address="경기 이천시", industry="물류/창고",
        business_areas=["3PL", "창고 보관", "화물 운송"], technologies=["WMS", "콜드체인"],
        track_record="풀필먼트 고객사 60곳, 상온·냉장 창고 2만평", certifications=["우수물류기업"],
        products="창고 보관, 화물 운송, 택배 풀필먼트 물류 대행", needs="포장재 박스, 지게차 장비, 물류 관리 시스템 개발",
        interest_categories=["생활사무·가구", "기계장비·공구", "IT·소프트웨어"], employees=80, founded_year=2012)),
    dict(email="design@demo.kr", user="최디자", c=dict(
        name="브랜드온", biz_reg_no="410-81-00004", ceo_name="최브랜드", address="서울 성동구", industry="디자인·마케팅",
        business_areas=["브랜딩", "SNS 마케팅", "영상 제작"], technologies=["퍼포먼스 마케팅", "3D 모션그래픽"],
        track_record="중소기업 브랜딩 150건, 유튜브 광고 캠페인 다수", certifications=["여성기업"],
        products="로고 디자인, 브랜딩, SNS 마케팅 대행, 홍보 영상 촬영 제작", needs="촬영 스튜디오 공간 임대, 노트북 등 전자 장비, 세무 회계 자문",
        interest_categories=["건설·시설", "전기전자·통신", "경영·전문서비스"], employees=15, founded_year=2018)),
    dict(email="food@demo.kr", user="정식품", c=dict(
        name="정성푸드", biz_reg_no="512-81-00005", ceo_name="정성", address="충남 천안시", industry="식품 제조",
        business_areas=["간편식", "베이커리", "단체 급식"], technologies=["HACCP 공정", "급속 냉동"],
        track_record="대형마트 PB 납품, 기업 단체급식 30곳", certifications=["HACCP"],
        products="수제 쿠키, 간식 박스, 도시락, 커피 원두 선물세트", needs="냉장 물류 운송, 식품 포장재, 쇼핑몰 구축, 브랜드 디자인",
        interest_categories=["차량·물류", "생활사무·가구", "디자인·마케팅", "IT·소프트웨어"], employees=60, founded_year=2014)),
]

OFFERS = {
    "pack@demo.kr": [
        dict(offer_type=OfferType.goods, category="생활사무·가구", title="친환경 골판지 박스 5,000개", description="재생지 골판지 박스 3종 사이즈(소/중/대), 로고 인쇄 가능. 식품·택배용.",
             quantity="5,000개", estimated_value=7_000_000, wants="홈페이지 리뉴얼 또는 SNS 마케팅 대행", want_categories=["IT·소프트웨어", "디자인·마케팅"], region="경기", tags=["골판지", "박스", "포장재", "친환경"]),
        dict(offer_type=OfferType.goods, category="생활사무·가구", title="생분해 완충재 2톤", description="옥수수 전분 기반 생분해 완충재(루즈필). 전자제품 포장에 적합.",
             quantity="2톤", estimated_value=4_000_000, wants="창고 보관 공간 6개월", want_categories=["차량·물류", "건설·시설"], region="전국", tags=["완충재", "생분해"]),
    ],
    "soft@demo.kr": [
        dict(offer_type=OfferType.service, category="IT·소프트웨어", title="반응형 홈페이지 제작 (10페이지)", description="React 기반 반응형 기업 홈페이지, 관리자 페이지 포함, 3개월 유지보수.",
             quantity="1건 (6주)", estimated_value=12_000_000, wants="사무용 가구 또는 사무실 인테리어", want_categories=["생활사무·가구", "건설·시설"], region="서울", tags=["홈페이지", "웹개발", "react"]),
        dict(offer_type=OfferType.service, category="IT·소프트웨어", title="AI 상담 챗봇 구축", description="자사 FAQ 학습 AI 챗봇, 카카오톡·웹 연동.",
             quantity="1식", estimated_value=8_000_000, wants="판촉물, 직원 간식 정기 납품", want_categories=["생활사무·가구", "식품·농축수산"], region="전국", tags=["ai", "챗봇"]),
    ],
    "logi@demo.kr": [
        dict(offer_type=OfferType.service, category="차량·물류", title="상온 창고 300평 6개월 보관", description="이천 물류센터 상온 창고, 랙 보관 및 입출고 대행 포함.",
             quantity="300평 · 6개월", estimated_value=18_000_000, wants="포장재 박스 정기 공급, 물류 관리 시스템 개발", want_categories=["생활사무·가구", "IT·소프트웨어"], region="경기", tags=["창고", "보관", "3pl"]),
        dict(offer_type=OfferType.service, category="차량·물류", title="냉장 화물 운송 월 20회", description="1톤·5톤 냉장 탑차, 수도권·충청권 정기 배송.",
             quantity="월 20회 · 3개월", estimated_value=9_000_000, wants="지게차 등 물류 장비", want_categories=["기계장비·공구"], region="충남", tags=["냉장", "운송", "콜드체인"]),
    ],
    "design@demo.kr": [
        dict(offer_type=OfferType.service, category="디자인·마케팅", title="브랜드 로고·패키지 디자인", description="로고, BI 가이드, 제품 패키지 디자인 3종.",
             quantity="1식", estimated_value=6_000_000, wants="촬영 스튜디오 공간 임대 또는 세무 자문", want_categories=["건설·시설", "경영·전문서비스"], region="서울", tags=["로고", "브랜딩", "패키지디자인"]),
        dict(offer_type=OfferType.service, category="디자인·마케팅", title="SNS 마케팅 3개월 대행", description="인스타그램·유튜브 콘텐츠 기획 및 광고 운영.",
             quantity="3개월", estimated_value=9_000_000, wants="노트북, 모니터 등 전자 장비", want_categories=["전기전자·통신"], region="전국", tags=["sns", "마케팅"]),
    ],
    "food@demo.kr": [
        dict(offer_type=OfferType.goods, category="식품·농축수산", title="기업 간식 박스 월 200세트", description="HACCP 공장 생산 수제 쿠키·견과 간식 박스. 사내 복지용.",
             quantity="월 200세트 · 6개월", estimated_value=10_000_000, wants="쇼핑몰 구축 또는 브랜드 디자인", want_categories=["IT·소프트웨어", "디자인·마케팅"], region="전국", tags=["간식", "복지", "쿠키"]),
        dict(offer_type=OfferType.goods, category="식품·농축수산", title="커피 원두 선물세트 300개", description="스페셜티 원두 200g x 2 선물세트, 명절 선물용.",
             quantity="300개", estimated_value=7_500_000, wants="냉장 물류 운송", want_categories=["차량·물류"], want_cash=True, want_cash_amount=3_000_000, region="충남", tags=["커피", "원두", "선물세트"]),
    ],
}


# ---------- 추가 샘플 오퍼 20건 (기존 DB 에도 제목 기준으로 없을 때만 추가) ----------
def _o(t, cat, title, desc, qty, val, wants="", wcats=(), cash=False, cash_amt=None, region="전국", tags=(), days_ago=0, allow_cash=True):
    return dict(offer_type=t, category=cat, title=title, description=desc, quantity=qty, estimated_value=val, wants=wants,
                want_categories=list(dict.fromkeys(wcats)), want_cash=cash, want_cash_amount=cash_amt, allow_cash=True if cash else allow_cash,
                region=region, tags=list(tags), _days_ago=days_ago)


EXTRA_OFFERS = {
    "pack@demo.kr": [
        _o(OfferType.goods, "생활사무·가구", "택배 박스 대량 재고 20,000매", "규격 3호·4호 택배 박스 재고 정리. 인쇄 없음, 즉시 출고 가능.",
           "20,000매", 6_000_000, cash=True, cash_amt=5_000_000, region="경기", tags=["택배박스", "재고", "골판지"], days_ago=1),
        _o(OfferType.goods, "생활사무·가구", "에어캡(뽁뽁이) 롤 300개", "폭 1m × 50m 에어캡 롤. 창고 이전으로 일괄 교환 희망.",
           "300롤", 4_500_000, "화물 운송 또는 창고 정리 인력", ["차량·물류", "인력·아웃소싱"], region="경기", tags=["에어캡", "완충재"], days_ago=4),
        _o(OfferType.service, "디자인·마케팅", "맞춤 패키지 디자인·인쇄 1건", "제품 박스 디자인부터 시제품 인쇄까지 원스톱 제공.",
           "1건", 3_000_000, "ERP 또는 재고관리 프로그램", ["IT·소프트웨어"], region="전국", tags=["패키지", "인쇄", "디자인"], days_ago=8),
        _o(OfferType.goods, "기계장비·공구", "중고 박스 접착기(폴더글루어) 1대", "2019년식, 정상 가동. 라인 교체로 처분.",
           "1대", 25_000_000, "포장 자동화 장비 또는 현금", ["기계장비·공구"], cash=True, cash_amt=10_000_000, region="경기", tags=["중고장비", "접착기"], days_ago=12),
    ],
    "soft@demo.kr": [
        _o(OfferType.service, "IT·소프트웨어", "쇼핑몰 구축 (카페24/자체몰)", "상품 등록·결제·배송 연동까지 포함한 쇼핑몰 구축.",
           "1건 (8주)", 15_000_000, "식자재 정기 납품 또는 사무 공간 임대", ["식품·농축수산", "건설·시설"], region="서울", tags=["쇼핑몰", "웹개발"], days_ago=2),
        _o(OfferType.service, "IT·소프트웨어", "RPA 업무 자동화 컨설팅", "반복 엑셀·ERP 입력 업무를 자동화하는 RPA 설계·구현.",
           "3개월", 9_000_000, cash=True, cash_amt=9_000_000, region="전국", tags=["rpa", "자동화"], days_ago=5),
        _o(OfferType.service, "IT·소프트웨어", "사내 그룹웨어 구축·이전", "메일·전자결재·일정 관리 그룹웨어 도입 지원.",
           "1식", 7_000_000, "사무용 가구, 노트북", ["생활사무·가구", "전기전자·통신"], region="서울", tags=["그룹웨어"], days_ago=9),
        _o(OfferType.service, "교육·연구", "임직원 AI 활용 교육 (8시간)", "ChatGPT·Claude 등 생성형 AI 실무 활용 교육.",
           "1회 (20명)", 2_500_000, "직원 간식 또는 기념품", ["식품·농축수산", "생활사무·가구"], cash=True, cash_amt=1_000_000, region="수도권", tags=["ai", "교육"], days_ago=14),
    ],
    "logi@demo.kr": [
        _o(OfferType.service, "차량·물류", "냉동 창고 50평 3개월", "영하 18도 냉동 창고, 팔레트 보관·입출고 대행 포함.",
           "50평 · 3개월", 12_000_000, "식품 또는 포장재", ["식품·농축수산", "생활사무·가구"], region="경기", tags=["냉동창고", "콜드체인"], days_ago=1),
        _o(OfferType.service, "차량·물류", "수도권 화물 운송 5톤 월 10회", "5톤 윙바디 차량, 수도권 왕복.",
           "월 10회 · 2개월", 8_000_000, cash=True, cash_amt=7_000_000, region="경기", tags=["화물", "운송"], days_ago=6),
        _o(OfferType.goods, "기계장비·공구", "전동 지게차 1.5톤 (중고)", "2020년식 배터리 지게차, 정기 점검 완료.",
           "1대", 14_000_000, "물류 관리 시스템(WMS) 개발", ["IT·소프트웨어"], region="경기", tags=["지게차", "중고장비"], days_ago=10),
        _o(OfferType.service, "인력·아웃소싱", "물류센터 단기 인력 지원", "성수기 입출고·검수 인력 하루 10명 지원.",
           "10명 · 5일", 5_000_000, "홍보 영상 제작", ["디자인·마케팅"], region="경기", tags=["인력", "아웃소싱"], days_ago=16),
    ],
    "design@demo.kr": [
        _o(OfferType.service, "디자인·마케팅", "제품 홍보 영상 1편 (60초)", "기획·촬영·편집 포함, 유튜브·SNS용 숏폼 버전 제공.",
           "1편", 5_000_000, "스튜디오 공간 임대 또는 조명 장비", ["건설·시설", "전기전자·통신"], region="서울", tags=["영상", "촬영"], days_ago=2),
        _o(OfferType.service, "디자인·마케팅", "홈페이지 UI/UX 디자인", "반응형 웹 10페이지 디자인 시안 및 가이드.",
           "10페이지", 6_000_000, cash=True, cash_amt=5_500_000, region="전국", tags=["uiux", "웹디자인"], days_ago=7),
        _o(OfferType.service, "디자인·마케팅", "네이버 스마트스토어 상세페이지 제작", "상품 상세페이지 5종 기획·디자인.",
           "5종", 3_500_000, "식품 또는 생활용품 재고", ["식품·농축수산", "생활사무·가구"], region="전국", tags=["상세페이지", "스마트스토어"], days_ago=11),
        _o(OfferType.service, "디자인·마케팅", "전시회 부스 디자인·시공 연계", "B2B 전시회 3×3 부스 디자인 및 시공사 연결.",
           "1부스", 8_000_000, "물류 운송, 인쇄물", ["차량·물류", "디자인·마케팅"], cash=True, cash_amt=3_000_000, region="서울", tags=["전시회", "부스"], days_ago=18),
    ],
    "food@demo.kr": [
        _o(OfferType.goods, "식품·농축수산", "HACCP 냉동 도시락 1,000식", "기업 행사·야근 식사용 냉동 도시락 5종.",
           "1,000식", 6_000_000, "냉동 창고 보관 또는 냉장 운송", ["차량·물류"], region="충남", tags=["도시락", "냉동식품"], days_ago=1),
        _o(OfferType.goods, "식품·농축수산", "명절 선물세트 (한과·견과) 500개", "추석·설 선물용 프리미엄 한과·견과 세트.",
           "500개", 15_000_000, cash=True, cash_amt=12_000_000, region="전국", tags=["선물세트", "명절"], days_ago=3),
        _o(OfferType.goods, "식품·농축수산", "카페용 원두 월 100kg 정기 공급", "스페셜티 블렌드 원두, 로스팅 후 3일 내 배송.",
           "월 100kg · 6개월", 18_000_000, "매장 인테리어 또는 POS 시스템", ["건설·시설", "IT·소프트웨어"], region="전국", tags=["원두", "카페"], days_ago=8),
        _o(OfferType.service, "식품·농축수산", "기업 행사 케이터링 200인분", "뷔페형 케이터링, 세팅·서빙 인력 포함.",
           "200인분 · 1회", 7_000_000, "브랜드 리뉴얼 디자인", ["디자인·마케팅"], cash=True, cash_amt=2_000_000, region="수도권", tags=["케이터링", "행사"], days_ago=13),
    ],
}


def main():
    init_db()
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        added = 0
        for item in COMPANIES:
            u = db.scalar(select(User).where(User.email == item["email"]))
            if u is None:
                c = Company(**item["c"])
                db.add(c)
                db.flush()
                u = User(email=item["email"], password_hash=hash_password("demo1234!"), name=item["user"], company_id=c.id,
                         status=UserStatus.approved, approved_at=now)
                db.add(u)
                db.flush()
                for i, o in enumerate(OFFERS[item["email"]]):
                    db.add(Offer(**o, category_names=[o["category"]], company_id=c.id, user_id=u.id, valid_until=now + timedelta(days=60),
                                 created_at=now - timedelta(days=i * 3 + len(item["email"]) % 5)))
                    added += 1
            # 추가 샘플: 같은 기업에 같은 제목이 없을 때만
            for o in EXTRA_OFFERS.get(item["email"], []):
                o = dict(o)
                days_ago = o.pop("_days_ago", 0)
                if db.scalar(select(Offer.id).where(Offer.company_id == u.company_id, Offer.title == o["title"])):
                    continue
                db.add(Offer(**o, category_names=[o["category"]], company_id=u.company_id, user_id=u.id, valid_until=now + timedelta(days=45 + days_ago * 2),
                             created_at=now - timedelta(days=days_ago, hours=days_ago * 3)))
                added += 1
        db.commit()
    print(f"샘플 오퍼 {added}건 추가")
    print("데모 데이터 생성 완료. 계정: pack@demo.kr / soft@demo.kr / logi@demo.kr / design@demo.kr / food@demo.kr (비밀번호 demo1234!)")


if __name__ == "__main__":
    main()
