import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, dt, won } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Badge, ScoreRing, TypeBadge, wantLabel } from '../components/ui'
import { CategoryTag } from '../components/Category'
import type { Company, Negotiation, Offer, RecommendedCompany } from '../types'

const dday = (s: string | null) => {
  if (!s) return { label: '상시', sub: '마감일 없음' }
  const d = Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)
  return { label: d < 0 ? '마감' : d === 0 ? 'D-Day' : `D-${d}`, sub: dt(s) }
}

export default function OfferDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [o, setO] = useState<Offer | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [recs, setRecs] = useState<RecommendedCompany[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const mine = o && o.company_id === user?.company_id

  useEffect(() => {
    api<Offer>(`/offers/${id}`).then(setO).catch(e => setErr(e.message))
    if (user) api<Company>(`/offers/${id}/company`).then(setCompany).catch(() => {})
  }, [id, user])
  useEffect(() => { if (mine) api<RecommendedCompany[]>(`/offers/${id}/recommended-companies`).then(setRecs) }, [mine, id])
  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheet])

  const start = async () => {
    setErr(''); setBusy(true)
    try {
      const n = await api<Negotiation>(`/offers/${id}/negotiations`, { body: msg ? { content: msg } : {} })
      nav(`/negotiations/${n.id}`)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const setStatus = async (status: string) => setO(await api(`/offers/${id}`, { method: 'PATCH', body: { status } }))

  if (err && !o) return <div className="error">{err}</div>
  if (!o) return <div className="empty">불러오는 중…</div>

  const canNegotiate = !mine && o.status !== 'closed' && o.status !== 'cancelled'
  const due = dday(o.valid_until)
  const loginUrl = `/login?next=${encodeURIComponent(`/offers/${o.id}`)}`

  const negotiateForm = !user ? (
    <>
      <p className="small muted">협상 요청과 등록 기업 상세 정보는 승인된 기업 회원만 이용할 수 있습니다.</p>
      <Link to={loginUrl} className="btn btn-primary btn-block">로그인하고 협상하기</Link>
      <Link to="/register" className="btn btn-block">기업 회원가입</Link>
    </>
  ) : (
    <>
      {err && <div className="error">{err}</div>}
      <textarea className="textarea" placeholder="첫 메시지 (선택) — 예: 귀사 박스 5,000개와 당사 홈페이지 제작 교환을 제안드립니다." value={msg} onChange={e => setMsg(e.target.value)} />
      <button className="btn btn-primary btn-block" disabled={busy} onClick={start}>{busy ? '요청 중…' : '협상 요청 보내기'}</button>
    </>
  )

  return (
    <div className={`offer-detail ${canNegotiate ? 'has-cta' : ''}`}>
      <div className="crumb small muted"><Link to="/">오퍼 둘러보기</Link> › #{o.id}</div>

      <header className="od-head">
        <div className="row wrap" style={{ gap: 6 }}><TypeBadge t={o.offer_type} />{(o.category_names?.length ? o.category_names : [o.category]).map((n, i) => <CategoryTag key={n} name={n} primary={i === 0} className="badge" />)}<Badge kind="offer" value={o.status} /></div>
        <h1>{o.title}</h1>
        <div className="od-company"><span className="me-avatar">{o.company.name.slice(0, 2)}</span><div><b>{o.company.name}</b><small>{o.company.industry} · 조회 {o.view_count}</small></div></div>
        {mine && (
          <div className="row wrap">
            {o.status !== 'closed' ? <button className="btn btn-sm" onClick={() => setStatus('closed')}>오퍼 마감</button>
              : <button className="btn btn-sm" onClick={() => setStatus('open')}>다시 게시</button>}
            <Link to="/negotiations" className="btn btn-sm">받은 협상 보기</Link>
          </div>
        )}
      </header>

      <div className="od-metrics">
        <div><small>예상 가치</small><b>{won(o.estimated_value)}</b></div>
        <div><small>수량·범위</small><b>{o.quantity || '협의'}</b></div>
        <div><small>거래 지역</small><b>{o.region || '전국'}</b></div>
        <div className="od-due"><small>게시 마감</small><b>{due.label}</b><em>{due.sub}</em></div>
      </div>

      <div className="split split-wide">
        <div className="stack">
          <section className="card card-pad stack">
            <h3>교환 조건</h3>
            <div className="od-swap">
              <div className="od-give"><span className="lbl">제공 · {o.offer_type === 'goods' ? '물품/재화' : '용역/서비스'}</span><b>{o.title}</b><small>{o.quantity || '수량 협의'} · {won(o.estimated_value)}</small></div>
              <div className="od-arrow" aria-hidden="true"><Icon name="swap" size={18} /></div>
              <div className="od-want">
                <span className="lbl">교환 희망{o.want_cash ? (o.wants && o.wants !== '현금' ? ' · 재화·용역 + 현금' : ' · 현금') : ''}</span>
                {(!o.want_cash || (o.wants && o.wants !== '현금')) && <b>{o.wants && o.wants !== '현금' ? o.wants : '자유롭게 제안받습니다'}</b>}
                {!o.want_cash && o.want_categories.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{o.want_categories.map(n => <CategoryTag key={n} name={n} className="badge" />)}</div>}
                {o.want_cash && <div className="od-cash-want"><small>{o.wants && o.wants !== '현금' ? '함께 받을 현금' : '희망 금액'}</small><b>{o.want_cash_amount ? won(o.want_cash_amount) : '금액 협의'}</b></div>}
              </div>
            </div>
            <div className={`od-cash ${o.allow_cash ? 'ok' : ''}`}>
              {o.want_cash ? '현금 대금은 플랫폼 에스크로로 보관되었다가 이행 완료 후 지급됩니다'
                : o.allow_cash ? '가치 차이는 현금으로 정산할 수 있습니다 (에스크로 보관)' : '현금 정산 없이 순수 물물교환만 가능합니다'}
            </div>
          </section>

          <section className="card card-pad stack">
            <h3>상세 설명</h3>
            <p className="od-desc">{o.description || '등록된 설명이 없습니다.'}</p>
            {o.tags.length > 0 && <div className="chips od-tags">{o.tags.map(t => <span className="tag" key={t}>#{t}</span>)}</div>}
            <div className="small muted">등록 {dt(o.created_at)} · 마감 {dt(o.valid_until)}</div>
          </section>

          {mine && (
            <section className="card card-pad stack">
              <div><h3>이 오퍼에 맞는 추천 기업</h3><p className="small muted" style={{ marginTop: 4 }}>오퍼를 필요로 하거나, 귀사가 원하는 것을 줄 수 있는 기업입니다.</p></div>
              {recs.length === 0 ? <div className="muted">아직 추천 기업이 없습니다.</div> : (
                <ul className="rec-list">
                  {recs.map(r => (
                    <li key={r.company.id}>
                      <ScoreRing score={r.score} />
                      <div className="rec-body">
                        <b>{r.company.name}</b><small>{r.company.industry}</small>
                        <div className="chips">{r.reasons.map(x => <span key={x} className="reason">{x}</span>)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="stack">
          {canNegotiate && (
            <section className="card card-pad stack hide-mobile">
              <h3>협상 시작하기</h3>
              <p className="small muted">등록 기업과 1:1 메신저로 교환 조건을 협상합니다.</p>
              {negotiateForm}
            </section>
          )}
          {company && (
            <section className="card card-pad stack">
              <h3>등록 기업 정보</h3>
              <dl className="kv">
                <dt>기업명</dt><dd><b>{company.name}</b></dd>
                <dt>주 사업분야</dt><dd>{company.industry}</dd>
                <dt>보유기술</dt><dd>{company.technologies.join(', ') || '-'}</dd>
                <dt>사업 실적</dt><dd>{company.track_record || '-'}</dd>
                <dt>인증</dt><dd>{company.certifications.join(', ') || '-'}</dd>
                <dt>소재지</dt><dd>{company.address || '-'}</dd>
                <dt>설립·규모</dt><dd>{company.founded_year ?? '-'}년 · {company.employees ?? '-'}명</dd>
              </dl>
            </section>
          )}
        </div>
      </div>

      {canNegotiate && (
        <>
          <div className="cta-bar only-mobile">
            <div className="cta-info"><small>희망</small><b>{wantLabel(o)}</b></div>
            {user ? <button className="btn btn-primary" onClick={() => setSheet(true)}>협상 요청</button>
              : <Link to={loginUrl} className="btn btn-primary">로그인하고 협상</Link>}
          </div>
          {sheet && (
            <div className="sheet-backdrop" onClick={() => setSheet(false)}>
              <div className="sheet" role="dialog" aria-modal="true" aria-label="협상 요청" onClick={e => e.stopPropagation()}>
                <div className="sheet-grip" />
                <div className="row"><h3>협상 요청</h3><span className="spacer" /><button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>닫기</button></div>
                <p className="small muted">{o.company.name}에 1:1 협상을 요청합니다. 첫 메시지는 선택입니다.</p>
                {negotiateForm}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
