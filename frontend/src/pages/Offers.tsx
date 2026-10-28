import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { OfferCard } from '../components/ui'
import { CategoryChip, useMeta } from '../components/Category'
import type { Offer } from '../types'

export default function Offers() {
  const { user } = useAuth()
  const meta = useMeta(true)
  const init = new URLSearchParams(location.search)
  const [f, setF] = useState({ q: init.get('q') ?? '', category: init.get('category') ?? '', offer_type: '', want_cash: '', region: '' })
  const [q, setQ] = useState(f.q)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: Offer[]; total: number; size: number } | null>(null)

  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), size: '12' })
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v))
    api(`/offers?${p}`).then(setData)
  }, [f, page])

  const upd = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(1) }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1

  return (
    <>
      {!user ? (
        <section className="landing-band">
          <div>
            <h1>남는 자원이 다른 기업의 필요가 되는 곳</h1>
            <p>재고·유휴 설비·전문 용역을 다른 기업의 재화·서비스 또는 현금과 교환하세요. 지금 올라온 교환 오퍼를 로그인 없이 둘러볼 수 있습니다.</p>
          </div>
          <div className="landing-cta">
            <Link to="/register" className="btn btn-light">무료 기업 회원가입</Link>
            <Link to="/login" className="btn btn-outline-light">로그인</Link>
          </div>
        </section>
      ) : (
        <div className="page-head">
          <div><h1>오퍼 둘러보기</h1><p>다른 기업이 내놓은 재화·용역과 교환 희망 조건을 확인하세요.</p></div>
          {user.role === 'member' && <Link to="/offers/new" className="btn btn-accent">새 오퍼 등록</Link>}
        </div>
      )}
      <div className="card card-pad stack" style={{ marginBottom: 18 }}>
        <form className="row filter-row" onSubmit={e => { e.preventDefault(); upd('q', q) }}>
          <input className="input" placeholder="제목, 설명, 교환 희망 내용 검색" value={q} onChange={e => setQ(e.target.value)} />
          <select className="select" style={{ width: 130 }} value={f.offer_type} onChange={e => upd('offer_type', e.target.value)}>
            <option value="">전체 유형</option><option value="goods">물품/재화</option><option value="service">용역/서비스</option>
          </select>
          <select className="select" style={{ width: 130 }} value={f.want_cash} onChange={e => upd('want_cash', e.target.value)}>
            <option value="">전체 교환방식</option><option value="false">물물교환</option><option value="true">현금 거래 가능</option>
          </select>
          <select className="select" style={{ width: 120 }} value={f.region} onChange={e => upd('region', e.target.value)}>
            <option value="">전체 지역</option>{meta.regions.map(r => <option key={r}>{r}</option>)}
          </select>
          <button className="btn btn-primary">검색</button>
        </form>
        <div className="chips">
          <button className={`chip ${!f.category ? 'on' : ''}`} onClick={() => upd('category', '')}>전체</button>
          {meta.category_info.map(c => (
            <CategoryChip key={c.name} name={c.name} description={c.description} selected={f.category === c.name} onSelect={() => upd('category', f.category === c.name ? '' : c.name)}>
              {!!c.count && <small className="chip-count">{c.count}</small>}
            </CategoryChip>
          ))}
        </div>
      </div>
      {!data ? <div className="empty">불러오는 중…</div> : data.items.length === 0 ? <div className="card empty">조건에 맞는 오퍼가 없습니다.</div> : (
        <>
          <p className="small muted" style={{ marginBottom: 10 }}>총 {data.total}건</p>
          <div className="offer-grid">{data.items.map(o => <OfferCard key={o.id} offer={o} />)}</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span className="small muted">{page} / {pages}</span>
            <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        </>
      )}
    </>
  )
}
