from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Company ----------
class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    biz_reg_no: str = Field(min_length=10, max_length=20, description="사업자등록번호 (000-00-00000)")
    ceo_name: str = Field(min_length=1, max_length=100)
    address: str = ""
    phone: str = ""
    website: str = ""
    founded_year: int | None = None
    employees: int | None = None
    annual_revenue: int | None = None
    industry: str = ""
    business_areas: list[str] = []
    technologies: list[str] = []
    track_record: str = ""
    certifications: list[str] = []
    products: str = ""
    needs: str = ""
    interest_categories: list[str] = []
    description: str = ""


class CompanyUpdate(BaseModel):
    name: str | None = None
    ceo_name: str | None = None
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    founded_year: int | None = None
    employees: int | None = None
    annual_revenue: int | None = None
    industry: str | None = None
    business_areas: list[str] | None = None
    technologies: list[str] | None = None
    track_record: str | None = None
    certifications: list[str] | None = None
    products: str | None = None
    needs: str | None = None
    interest_categories: list[str] | None = None
    description: str | None = None


class CompanyOut(CompanyBase, ORM):
    id: int
    created_at: datetime


class CompanyBrief(ORM):
    id: int
    name: str
    industry: str


# ---------- Auth / User ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    phone: str = ""
    position: str = ""
    company: CompanyBase


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    email: str
    name: str
    phone: str
    position: str
    role: str
    status: str
    reject_reason: str
    company_id: int | None
    created_at: datetime


class MeOut(UserOut):
    company: CompanyOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


# ---------- Offer ----------
class OfferIn(BaseModel):
    offer_type: Literal["goods", "service"]
    category: str = ""
    category_names: list[str] = []
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    quantity: str = ""
    estimated_value: int | None = None
    wants: str = ""
    want_categories: list[str] = []
    want_cash: bool = False
    want_cash_amount: int | None = None
    allow_cash: bool = True
    region: str = ""
    tags: list[str] = []
    valid_until: datetime | None = None


class OfferUpdate(BaseModel):
    category: str | None = None
    category_names: list[str] | None = None
    title: str | None = None
    description: str | None = None
    quantity: str | None = None
    estimated_value: int | None = None
    wants: str | None = None
    want_categories: list[str] | None = None
    want_cash: bool | None = None
    want_cash_amount: int | None = None
    allow_cash: bool | None = None
    region: str | None = None
    tags: list[str] | None = None
    valid_until: datetime | None = None
    status: Literal["open", "closed", "cancelled"] | None = None


class OfferOut(ORM):
    id: int
    company_id: int
    user_id: int
    offer_type: str
    category: str
    category_names: list[str] = []
    title: str
    description: str
    quantity: str
    estimated_value: int | None
    wants: str
    want_categories: list[str]
    want_cash: bool
    want_cash_amount: int | None
    allow_cash: bool
    region: str
    tags: list[str]
    valid_until: datetime | None
    status: str
    view_count: int
    created_at: datetime
    company: CompanyBrief


class OfferPage(BaseModel):
    items: list[OfferOut]
    total: int
    page: int
    size: int


class RecommendedOffer(BaseModel):
    offer: OfferOut
    score: float
    reasons: list[str]


class RecommendedCompany(BaseModel):
    company: CompanyBrief
    score: float
    reasons: list[str]


# ---------- Assistant (Q&A 등록) ----------
class AssistantMessage(BaseModel):
    role: Literal["assistant", "user"]
    content: str
    choices: list[str] = []


class DraftOut(ORM):
    id: int
    step: str
    data: dict
    messages: list[AssistantMessage]
    completed: bool
    offer_id: int | None


class DraftAnswer(BaseModel):
    answer: str


# ---------- Negotiation ----------
class ProposalIn(BaseModel):
    owner_gives: str = Field(min_length=1, description="오퍼 등록 기업이 제공")
    buyer_gives: str = Field(min_length=1, description="협상 요청 기업이 제공")
    cash_amount: int = 0
    cash_payer: Literal["owner", "buyer", "none"] = "none"
    delivery_date: str = ""
    notes: str = ""


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class MessageOut(ORM):
    id: int
    negotiation_id: int
    sender_id: int | None
    sender_company_id: int | None
    sender_name: str | None = None
    kind: str
    content: str
    proposal: dict | None
    created_at: datetime


class NegotiationOut(ORM):
    id: int
    offer_id: int
    owner_company_id: int
    buyer_company_id: int
    status: str
    last_message_at: datetime
    created_at: datetime
    offer: OfferOut
    owner_company: CompanyBrief
    buyer_company: CompanyBrief
    my_side: str | None = None
    unread: int = 0
    last_message: str | None = None
    deal_id: int | None = None


# ---------- Deal ----------
class PaymentOut(ORM):
    id: int
    payer_company_id: int
    payee_company_id: int
    amount: int
    fee: int
    method: str
    status: str
    pg_tid: str
    paid_at: datetime | None


class DealOut(ORM):
    id: int
    deal_no: str
    negotiation_id: int
    offer_id: int
    owner_company_id: int
    buyer_company_id: int
    terms: dict
    contract_text: str
    owner_signed_at: datetime | None
    owner_signer: str
    buyer_signed_at: datetime | None
    buyer_signer: str
    owner_delivered_at: datetime | None
    buyer_delivered_at: datetime | None
    status: str
    created_at: datetime
    completed_at: datetime | None
    owner_company: CompanyBrief
    buyer_company: CompanyBrief
    offer: OfferOut
    payments: list[PaymentOut]
    my_side: str | None = None


class SignIn(BaseModel):
    signer_name: str = Field(min_length=1, max_length=100)
    agree: bool


class PayIn(BaseModel):
    method: Literal["card", "transfer", "escrow"] = "escrow"


# ---------- Admin ----------
class ApprovalIn(BaseModel):
    approve: bool
    reason: str = ""


class AdminUserOut(UserOut):
    company: CompanyOut | None = None


class StatsOut(BaseModel):
    users_pending: int
    users_approved: int
    companies: int
    offers_open: int
    negotiations_active: int
    deals_total: int
    deals_completed: int
    trade_volume: int


class NotificationOut(ORM):
    id: int
    title: str
    body: str
    link: str
    is_read: bool
    created_at: datetime
