import { Link } from 'react-router-dom'
import { won } from '../api'
import type { Offer } from '../types'
import { CategoryTag } from './Category'

const OFFER_STATUS: Record<string, [string, string]> = {
  open: ['모집중', 'teal'], negotiating: ['협상중', 'amber'], closed: ['거래완료', ''], cancelled: ['취소', 'red'],
}
const DEAL_STATUS: Record<string, [string, string]> = {
  contract_pending: ['서명 대기', 'amber'], payment_pending: ['결제 대기', 'blue'], in_progress: ['이행 중', 'teal'],
  completed: ['완료', ''], cancelled: ['취소', 'red'],
}
const USER_STATUS: Record<string, [string, string]> = {
  pending: ['승인 대기', 'amber'], approved: ['승인', 'teal'], rejected: ['반려', 'red'], suspended: ['정지', 'red'],
}

export function Badge({ kind, value }: { kind: 'offer' | 'deal' | 'user'; value: string }) {
  const map = kind === 'offer' ? OFFER_STATUS : kind === 'deal' ? DEAL_STATUS : USER_STATUS
  const [label, color] = map[value] ?? [value, '']
  return <span className={`badge ${color}`}>{label}</span>
}

export function TypeBadge({ t }: { t: string }) {
  return <span className={`badge ${t === 'goods' ? 'orange' : 'indigo'}`}>{t === 'goods' ? '물품' : '용역'}</span>
}

export function ScoreRing({ score }: { score: number }) {
  const v = Math.max(0, Math.min(100, score))
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#ece5fd" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#7048e8" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <div className="ring-v"><b>{Math.round(v)}</b><small>적합도</small></div>
    </div>
  )
}

/** 교환 희망 요약: "홈페이지 제작" / "현금 800만원" / "홈페이지 제작 + 현금 300만원" */
export function wantLabel(o: Pick<Offer, 'wants' | 'want_cash' | 'want_cash_amount'>) {
  const cash = `현금 ${o.want_cash_amount ? won(o.want_cash_amount) : '(금액 협의)'}`
  const goods = o.wants && o.wants !== '현금' ? o.wants : ''
  if (!o.want_cash) return goods || '제안받음'
  return goods ? `${goods} + ${cash}` : cash
}

const isNew = (s: string) => Date.now() - new Date(s).getTime() < 3 * 86400000

export function OfferCard({ offer, score, reasons }: { offer: Offer; score?: number; reasons?: string[] }) {
  return (
    <Link to={`/offers/${offer.id}`} className="card offer-card">
      <div className="row">
        <TypeBadge t={offer.offer_type} />
        {isNew(offer.created_at) && <span className="badge mint">NEW</span>}
        {offer.want_cash && <span className="badge amber">현금</span>}
        <CategoryTag name={offer.category} />
        {(offer.category_names?.length ?? 0) > 1 && <span className="small muted" title={offer.category_names.slice(1).join(', ')}>+{offer.category_names.length - 1}</span>}
        <span className="spacer" />
        {score === undefined && <Badge kind="offer" value={offer.status} />}
      </div>
      <div className="offer-main">
        {score !== undefined && <ScoreRing score={score} />}
        <div style={{ minWidth: 0 }}>
          <h3 className="clamp">{offer.title}</h3>
          <div className="small muted" style={{ marginTop: 2 }}>{offer.company.name} · {offer.region || '전국'}</div>
        </div>
      </div>
      <div className="swap">
        <div><span className="lbl">제공</span><span className="clamp">{offer.quantity || '수량 협의'} · {won(offer.estimated_value)}</span></div>
        <div className="arrow">⇄</div>
        <div><span className="lbl">희망</span><span className="clamp">{wantLabel(offer)}</span></div>
      </div>
      {reasons && reasons.length > 0 && (
        <div className="chips">{reasons.slice(0, 2).map(r => <span key={r} className="reason">{r}</span>)}</div>
      )}
      <div className="card-foot">
        <span>조회 {offer.view_count}</span>
        <span className="spacer" />
        <span className="go">상세 보기</span>
      </div>
    </Link>
  )
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <input
      className="input"
      placeholder={placeholder ?? '쉼표(,)로 구분'}
      defaultValue={value.join(', ')}
      onBlur={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
    />
  )
}
