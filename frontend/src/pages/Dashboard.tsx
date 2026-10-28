import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ago, api } from '../api'
import { useAuth } from '../auth'
import { Badge, OfferCard } from '../components/ui'
import Icon from '../components/Icon'
import type { Deal, Negotiation, RecommendedOffer } from '../types'

type OfferPageT = { total: number }

const EXAMPLES = ['남는 포장재 박스를 홈페이지 제작과 교환', '창고 보관 공간이 필요해요', '사무용 가구와 바꿀 IT 용역']

export default function Dashboard() {
  const { user } = useAuth()
  const [recs, setRecs] = useState<RecommendedOffer[] | null>(null)
  const [negs, setNegs] = useState<Negotiation[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [mine, setMine] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(9)
  const nav = useNavigate()

  useEffect(() => {
    api<RecommendedOffer[]>('/recommendations/offers?limit=30').then(setRecs).catch(() => setRecs([]))
    api<Negotiation[]>('/negotiations').then(setNegs)
    api<Deal[]>('/deals').then(setDeals)
    api<OfferPageT>('/offers?mine=true&size=1').then(p => setMine(p.total))
    api<OfferPageT>('/offers?size=1').then(p => setOpenCount(p.total))
  }, [])

  const c = user?.company
  const profileThin = c && (!c.needs || !c.products || c.technologies.length === 0)
  const activeDeals = deals.filter(d => !['completed', 'cancelled'].includes(d.status))

  return (
    <>
      <section className="hero">
        <h1 className="hero-title"><span>우리 회사에 맞는 교환,</span><br />AI가 먼저 찾아드립니다.</h1>
        <p className="hero-sub">{c?.name}의 사업분야·보유기술·필요 품목을 분석해, 서로 주고받을 것이 맞는 기업의 오퍼를 연결해 드립니다.</p>
      </section>

      <section className="band">
        <form className="search-card" onSubmit={e => { e.preventDefault(); nav(`/${q ? `?q=${encodeURIComponent(q)}` : ''}`) }}>
          <div className="search-head">
            <span className="spark">✦</span><b>오퍼 검색</b>
            <span className="spacer" />
            <Link to="/offers/new" className="btn btn-sm">새 오퍼 등록</Link>
          </div>
          <div className="search-box">
            <input className="search-input" value={q} onChange={e => setQ(e.target.value)} placeholder="찾는 재화·용역이나 교환하고 싶은 것을 입력하세요" />
            <button className="btn btn-primary btn-lg"><Icon name="search" />검색</button>
          </div>
          <div className="search-hints">
            <span className="muted">예시</span>
            {EXAMPLES.map(x => <button type="button" key={x} className="hint-chip" onClick={() => setQ(x)}>{x}</button>)}
          </div>
        </form>
      </section>

      <div className="stats">
        <Link to="/" className="stat stat-primary"><div className="v">{openCount.toLocaleString()}<small>건</small></div><div className="k">교환 가능한 전체 오퍼</div></Link>
        <Link to="/my/offers" className="stat"><div className="v">{mine}<small>건</small></div><div className="k">우리 회사 오퍼</div></Link>
        <Link to="/negotiations" className="stat"><div className="v">{negs.filter(n => n.status === 'active').length}<small>건</small></div><div className="k">진행 중 협상</div></Link>
        <Link to="/deals" className="stat"><div className="v">{activeDeals.length}<small>건</small></div><div className="k">진행 중 거래</div></Link>
      </div>

      {profileThin && (
        <div className="notice">
          <div className="spacer">기업 프로필에 <b>제공 가능한 재화·용역, 필요한 재화·용역, 보유기술</b>을 채우면 추천 정확도가 크게 올라갑니다.</div>
          <Link to="/profile" className="btn btn-sm">프로필 보완</Link>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <div className="row"><h2>AI 추천 교환 오퍼</h2>{recs && <span className="count-pill">{recs.length}건</span>}</div>
          <Link to="/" className="btn btn-sm">전체 보기</Link>
        </div>
        {recs === null ? <div className="empty">분석 중…</div> : recs.length === 0 ? <div className="card empty">추천할 오퍼가 아직 없습니다.</div> : (
          <>
            <div className="offer-grid">{recs.slice(0, shown).map(r => <OfferCard key={r.offer.id} offer={r.offer} score={r.score} reasons={r.reasons} />)}</div>
            {recs.length > shown && (
              <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
                <button className="btn" onClick={() => setShown(n => n + 9)}>추천 오퍼 더 보기 ({recs.length - shown}건 남음)</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid-2 section">
        <div className="card">
          <div className="conv-head"><h3>최근 협상</h3><span className="spacer" /><Link to="/negotiations" className="small muted">더보기</Link></div>
          {negs.length === 0 && <div className="empty">진행 중인 협상이 없습니다</div>}
          {negs.slice(0, 5).map(n => (
            <Link key={n.id} to={`/negotiations/${n.id}`} className="conv">
              <div className="row"><span className="t">{n.my_side === 'owner' ? n.buyer_company.name : n.owner_company.name}</span>
                {n.unread > 0 && <span className="badge amber">{n.unread}</span>}<span className="spacer" /><span className="small muted">{ago(n.last_message_at)}</span></div>
              <div className="small muted clamp">{n.offer.title} · {n.last_message}</div>
            </Link>
          ))}
        </div>
        <div className="card">
          <div className="conv-head"><h3>진행 중 거래</h3><span className="spacer" /><Link to="/deals" className="small muted">더보기</Link></div>
          {activeDeals.length === 0 && <div className="empty">진행 중인 거래가 없습니다</div>}
          {activeDeals.slice(0, 5).map(d => (
            <Link key={d.id} to={`/deals/${d.id}`} className="conv">
              <div className="row"><span className="t">{d.deal_no}</span><span className="spacer" /><Badge kind="deal" value={d.status} /></div>
              <div className="small muted clamp">{d.offer.title} · {d.my_side === 'owner' ? d.buyer_company.name : d.owner_company.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
