"""BizBarter 데이터 모델.

용어
- Company   : 회원 기업 (기업 특성 정보 = 추천의 기반)
- User      : 기업 소속 사용자 (관리자 승인 후 이용)
- Offer     : 교환 오퍼 — 사용자가 올리는 '공고'. 제공할 재화/용역 + 교환 희망 조건
- Negotiation / Message : 오퍼별 1:1 협상 메신저
- Deal      : 협상 합의 후 생성되는 거래 (계약서, 서명, 정산)
- Payment   : 거래의 현금 차액 정산 결제
- OfferDraft: 채팅형 Q&A 오퍼 등록 세션
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    member = "member"
    admin = "admin"


class UserStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class OfferType(str, enum.Enum):
    goods = "goods"      # 물품/재화
    service = "service"  # 용역/서비스


class OfferStatus(str, enum.Enum):
    open = "open"
    negotiating = "negotiating"
    closed = "closed"
    cancelled = "cancelled"


class NegotiationStatus(str, enum.Enum):
    active = "active"
    agreed = "agreed"
    closed = "closed"


class MessageKind(str, enum.Enum):
    text = "text"
    proposal = "proposal"
    system = "system"


class DealStatus(str, enum.Enum):
    contract_pending = "contract_pending"  # 계약서 서명 대기
    payment_pending = "payment_pending"    # 차액 결제 대기
    in_progress = "in_progress"            # 이행(납품/용역 수행) 중
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


def _enum(e):
    return Enum(e, native_enum=False, length=32)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    biz_reg_no: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # 사업자등록번호
    ceo_name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(300), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    website: Mapped[str] = mapped_column(String(300), default="")
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    annual_revenue: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # 원

    # --- 기업 특성 정보 (추천 엔진 입력) ---
    industry: Mapped[str] = mapped_column(String(100), default="")                 # 주 사업분야
    business_areas: Mapped[list] = mapped_column(JSONType, default=list)           # 세부 사업분야 태그
    technologies: Mapped[list] = mapped_column(JSONType, default=list)             # 보유기술
    track_record: Mapped[str] = mapped_column(Text, default="")                    # 사업 실적
    certifications: Mapped[list] = mapped_column(JSONType, default=list)           # 인증/특허
    products: Mapped[str] = mapped_column(Text, default="")                        # 주요 제품/서비스(제공 가능 자원)
    needs: Mapped[str] = mapped_column(Text, default="")                           # 필요로 하는 재화/용역
    interest_categories: Mapped[list] = mapped_column(JSONType, default=list)      # 관심 카테고리
    description: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    users: Mapped[list[User]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(50), default="")
    position: Mapped[str] = mapped_column(String(100), default="")
    role: Mapped[UserRole] = mapped_column(_enum(UserRole), default=UserRole.member)
    status: Mapped[UserStatus] = mapped_column(_enum(UserStatus), default=UserStatus.pending, index=True)
    reject_reason: Mapped[str] = mapped_column(String(500), default="")
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    company: Mapped[Company | None] = relationship(back_populates="users")


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    offer_type: Mapped[OfferType] = mapped_column(_enum(OfferType))
    category: Mapped[str] = mapped_column(String(100), index=True)                 # 대표 분야 (= category_names[0])
    category_names: Mapped[list] = mapped_column(JSONType, default=list)           # 복수 분야 (MasterBuy 와 동일 방식)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    quantity: Mapped[str] = mapped_column(String(100), default="")     # 예: "500개", "3개월"
    estimated_value: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # 원

    wants: Mapped[str] = mapped_column(Text, default="")               # 교환 희망 재화/용역
    want_categories: Mapped[list] = mapped_column(JSONType, default=list)
    want_cash: Mapped[bool] = mapped_column(Boolean, default=False)            # 교환 희망에 현금 포함
    want_cash_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # 희망 금액 (원)
    allow_cash: Mapped[bool] = mapped_column(Boolean, default=True)    # 현금 차액 정산 허용
    region: Mapped[str] = mapped_column(String(100), default="")
    tags: Mapped[list] = mapped_column(JSONType, default=list)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[OfferStatus] = mapped_column(_enum(OfferStatus), default=OfferStatus.open, index=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    company: Mapped[Company] = relationship()
    user: Mapped[User] = relationship()


class OfferDraft(Base):
    """채팅형 Q&A 오퍼 등록 세션."""

    __tablename__ = "offer_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    step: Mapped[str] = mapped_column(String(50))
    data: Mapped[dict] = mapped_column(JSONType, default=dict)
    messages: Mapped[list] = mapped_column(JSONType, default=list)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("offers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Negotiation(Base):
    __tablename__ = "negotiations"
    __table_args__ = (UniqueConstraint("offer_id", "buyer_company_id", name="uq_negotiation_offer_buyer"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"), index=True)
    owner_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)   # 오퍼 등록 기업
    buyer_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)   # 협상 요청 기업
    initiated_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[NegotiationStatus] = mapped_column(_enum(NegotiationStatus), default=NegotiationStatus.active)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    owner_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    buyer_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    offer: Mapped[Offer] = relationship()
    owner_company: Mapped[Company] = relationship(foreign_keys=[owner_company_id])
    buyer_company: Mapped[Company] = relationship(foreign_keys=[buyer_company_id])


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    negotiation_id: Mapped[int] = mapped_column(ForeignKey("negotiations.id"), index=True)
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sender_company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    kind: Mapped[MessageKind] = mapped_column(_enum(MessageKind), default=MessageKind.text)
    content: Mapped[str] = mapped_column(Text, default="")
    # 거래조건 제안: {owner_gives, buyer_gives, cash_amount, cash_payer: owner|buyer|none, delivery_date, notes, state: pending|accepted|rejected|withdrawn}
    proposal: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    sender: Mapped[User | None] = relationship()


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_no: Mapped[str] = mapped_column(String(30), unique=True)
    negotiation_id: Mapped[int] = mapped_column(ForeignKey("negotiations.id"), index=True)
    offer_id: Mapped[int] = mapped_column(ForeignKey("offers.id"))
    owner_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    buyer_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    proposal_message_id: Mapped[int] = mapped_column(ForeignKey("messages.id"))

    terms: Mapped[dict] = mapped_column(JSONType)          # 합의된 거래조건 스냅샷
    contract_text: Mapped[str] = mapped_column(Text)
    owner_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    owner_signer: Mapped[str] = mapped_column(String(100), default="")
    buyer_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    buyer_signer: Mapped[str] = mapped_column(String(100), default="")
    owner_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    buyer_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[DealStatus] = mapped_column(_enum(DealStatus), default=DealStatus.contract_pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    offer: Mapped[Offer] = relationship()
    owner_company: Mapped[Company] = relationship(foreign_keys=[owner_company_id])
    buyer_company: Mapped[Company] = relationship(foreign_keys=[buyer_company_id])
    payments: Mapped[list[Payment]] = relationship(back_populates="deal", order_by="Payment.id")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id"), index=True)
    payer_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    payee_company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    amount: Mapped[int] = mapped_column(BigInteger)       # 차액 (원)
    fee: Mapped[int] = mapped_column(BigInteger, default=0)  # 플랫폼 수수료
    method: Mapped[str] = mapped_column(String(30), default="")  # card | transfer | escrow
    status: Mapped[PaymentStatus] = mapped_column(_enum(PaymentStatus), default=PaymentStatus.pending)
    pg_tid: Mapped[str] = mapped_column(String(100), default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    deal: Mapped[Deal] = relationship(back_populates="payments")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(String(500), default="")
    link: Mapped[str] = mapped_column(String(300), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
