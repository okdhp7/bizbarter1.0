import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, dt, won } from '../api'
import { Badge, TypeBadge, wantLabel } from '../components/ui'
import type { Offer } from '../types'

export default function MyOffers() {
  const [items, setItems] = useState<Offer[] | null>(null)
  const [status, setStatus] = useState('')
  useEffect(() => { api(`/offers?mine=true&size=50${status ? `&status=${status}` : ''}`).then(p => setItems(p.items)) }, [status])

  return (
    <>
      <div className="page-head">
        <div><h1>내 오퍼</h1><p>우리 기업이 등록한 교환 오퍼를 관리합니다.</p></div>
        <Link to="/offers/new" className="btn btn-accent">새 오퍼 등록</Link>
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {[['', '전체'], ['open', '모집중'], ['negotiating', '협상중'], ['closed', '거래완료'], ['cancelled', '취소']].map(([v, l]) => (
          <button key={v} className={`chip ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {!items ? <div className="empty">불러오는 중…</div> : items.length === 0 ? <div className="empty">등록한 오퍼가 없습니다.</div> : (
          <table className="table rtable">
            <thead><tr><th>오퍼</th><th>교환 희망</th><th>예상가치</th><th>상태</th><th>조회</th><th>등록일</th></tr></thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id}>
                  <td><Link to={`/offers/${o.id}`}><div className="row"><TypeBadge t={o.offer_type} /><b>{o.title}</b></div></Link><div className="small muted">{o.category}</div></td>
                  <td data-label="교환 희망" className="small">{wantLabel(o)}</td>
                  <td data-label="예상가치">{won(o.estimated_value)}</td>
                  <td data-label="상태"><Badge kind="offer" value={o.status} /></td>
                  <td data-label="조회">{o.view_count}</td>
                  <td data-label="등록일" className="small muted">{dt(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
