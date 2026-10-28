import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, dt } from '../api'
import { Badge } from '../components/ui'
import type { Deal } from '../types'

export default function Deals() {
  const [deals, setDeals] = useState<Deal[] | null>(null)
  useEffect(() => { api<Deal[]>('/deals').then(setDeals) }, [])
  return (
    <>
      <div className="page-head"><div><h1>거래·계약</h1><p>협상 합의로 생성된 거래의 계약 서명, 차액 결제, 이행 현황을 관리합니다.</p></div></div>
      <div className="card">
        {!deals ? <div className="empty">불러오는 중…</div> : deals.length === 0 ? <div className="empty">아직 거래가 없습니다. 협상에서 거래조건을 합의하면 거래가 생성됩니다.</div> : (
          <table className="table rtable">
            <thead><tr><th>계약번호</th><th>오퍼</th><th>상대 기업</th><th>교환 내용</th><th>차액</th><th>상태</th><th>생성일</th></tr></thead>
            <tbody>{deals.map(d => (
              <tr key={d.id}>
                <td><Link to={`/deals/${d.id}`} style={{ fontWeight: 700, color: 'var(--teal)' }}>{d.deal_no}</Link></td>
                <td data-label="오퍼">{d.offer.title}</td>
                <td data-label="상대 기업">{d.my_side === 'owner' ? d.buyer_company.name : d.owner_company.name}</td>
                <td data-label="교환 내용" className="small">{d.terms.owner_gives} ⇄ {d.terms.buyer_gives}</td>
                <td data-label="차액">{d.terms.cash_amount ? `${Number(d.terms.cash_amount).toLocaleString()}원` : '-'}</td>
                <td data-label="상태"><Badge kind="deal" value={d.status} /></td>
                <td data-label="생성일" className="small muted">{dt(d.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}
