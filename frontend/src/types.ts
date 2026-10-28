export interface Company {
  id: number
  name: string
  biz_reg_no: string
  ceo_name: string
  address: string
  phone: string
  website: string
  founded_year: number | null
  employees: number | null
  annual_revenue: number | null
  industry: string
  business_areas: string[]
  technologies: string[]
  track_record: string
  certifications: string[]
  products: string
  needs: string
  interest_categories: string[]
  description: string
}

export interface CompanyBrief { id: number; name: string; industry: string }

export interface User {
  id: number
  email: string
  name: string
  phone: string
  position: string
  role: 'member' | 'admin'
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  reject_reason: string
  company_id: number | null
  created_at: string
  company?: Company | null
}

export interface Offer {
  id: number
  company_id: number
  user_id: number
  offer_type: 'goods' | 'service'
  category: string
  category_names: string[]
  title: string
  description: string
  quantity: string
  estimated_value: number | null
  wants: string
  want_categories: string[]
  want_cash: boolean
  want_cash_amount: number | null
  allow_cash: boolean
  region: string
  tags: string[]
  valid_until: string | null
  status: 'open' | 'negotiating' | 'closed' | 'cancelled'
  view_count: number
  created_at: string
  company: CompanyBrief
}

export interface RecommendedOffer { offer: Offer; score: number; reasons: string[] }
export interface RecommendedCompany { company: CompanyBrief; score: number; reasons: string[] }

export interface ChatMsg { role: 'assistant' | 'user'; content: string; choices: string[] }
export interface Draft { id: number; step: string; data: Record<string, unknown>; messages: ChatMsg[]; completed: boolean; offer_id: number | null }

export interface Proposal {
  owner_gives: string
  buyer_gives: string
  cash_amount: number
  cash_payer: 'owner' | 'buyer' | 'none'
  delivery_date: string
  notes: string
  state?: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded'
  proposer_side?: 'owner' | 'buyer'
  deal_id?: number
}

export interface Message {
  id: number
  negotiation_id: number
  sender_id: number | null
  sender_company_id: number | null
  sender_name: string | null
  kind: 'text' | 'proposal' | 'system'
  content: string
  proposal: Proposal | null
  created_at: string
}

export interface Negotiation {
  id: number
  offer_id: number
  owner_company_id: number
  buyer_company_id: number
  status: 'active' | 'agreed' | 'closed'
  last_message_at: string
  created_at: string
  offer: Offer
  owner_company: CompanyBrief
  buyer_company: CompanyBrief
  my_side: 'owner' | 'buyer'
  unread: number
  last_message: string | null
  deal_id: number | null
}

export interface Payment {
  id: number
  payer_company_id: number
  payee_company_id: number
  amount: number
  fee: number
  method: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  pg_tid: string
  paid_at: string | null
}

export interface Deal {
  id: number
  deal_no: string
  negotiation_id: number
  offer_id: number
  owner_company_id: number
  buyer_company_id: number
  terms: Proposal & { offer_estimated_value?: number | null }
  contract_text: string
  owner_signed_at: string | null
  owner_signer: string
  buyer_signed_at: string | null
  buyer_signer: string
  owner_delivered_at: string | null
  buyer_delivered_at: string | null
  status: 'contract_pending' | 'payment_pending' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
  owner_company: CompanyBrief
  buyer_company: CompanyBrief
  offer: Offer
  payments: Payment[]
  my_side: 'owner' | 'buyer'
}

export interface Notification { id: number; title: string; body: string; link: string; is_read: boolean; created_at: string }
